#include "mlx90640_i2c_esp32.h"
#include "MLX90640_I2C_Driver.h"
#include "MLX90640_API.h"

#include <stdbool.h>
#include "sdkconfig.h"
#include "driver/gpio.h"
#include "driver/i2c_master.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "mlx90640_i2c";

#define I2C_TIMEOUT_MS 200
// O ponteiro de endereço do MLX90640 avança sozinho numa leitura sequencial, então
// uma leitura grande pode ser quebrada em blocos de 128 bytes sem perder dados.
#define READ_CHUNK_WORDS 64

static i2c_master_bus_handle_t s_bus;
static i2c_master_dev_handle_t s_dev;
static uint32_t s_freq_hz;
static int64_t s_deadline_us; // 0 = sem prazo armado

static bool pin_is_usable(int gpio, const char *name)
{
    if (!GPIO_IS_VALID_GPIO(gpio)) {
        ESP_LOGE(TAG, "GPIO %d (%s) não existe neste chip.", gpio, name);
        return false;
    }
#if CONFIG_IDF_TARGET_ESP32S3
    if (gpio >= 22 && gpio <= 25) {
        ESP_LOGE(TAG, "GPIO %d (%s) não existe no ESP32-S3.", gpio, name);
        return false;
    }
    if (gpio >= 26 && gpio <= 32) {
        ESP_LOGE(TAG, "GPIO %d (%s) é usado pela flash/PSRAM no ESP32-S3.", gpio, name);
        return false;
    }
    if (gpio >= 33 && gpio <= 37) {
        ESP_LOGW(TAG, "GPIO %d (%s) é usado pela PSRAM octal nos módulos N8R8/N16R8.", gpio, name);
    }
    if (gpio == 19 || gpio == 20) {
        ESP_LOGW(TAG, "GPIO %d (%s) é o USB (D-/D+) do ESP32-S3.", gpio, name);
    }
#elif CONFIG_IDF_TARGET_ESP32
    // ESP32 "comum" (WROOM/WROVER).
    if (gpio >= 6 && gpio <= 11) {
        ESP_LOGE(TAG, "GPIO %d (%s) está ligado à memória flash do ESP32: usá-lo trava a placa.", gpio, name);
        return false;
    }
    if (gpio >= 34 && gpio <= 39) {
        ESP_LOGE(TAG, "GPIO %d (%s) é só de entrada no ESP32; o I2C precisa de um pino que também saia.", gpio, name);
        return false;
    }
    if (gpio == 16 || gpio == 17) {
        ESP_LOGW(TAG, "GPIO %d (%s) é usado pela PSRAM nos módulos ESP32-WROVER.", gpio, name);
    }
    if (gpio == 0 || gpio == 2 || gpio == 5 || gpio == 12 || gpio == 15) {
        ESP_LOGW(TAG, "GPIO %d (%s) define o modo de boot: o sensor ligado nele pode impedir a placa de iniciar.", gpio, name);
    }
    if (gpio == 1 || gpio == 3) {
        ESP_LOGW(TAG, "GPIO %d (%s) é a porta serial do console (log e gravação).", gpio, name);
    }
#endif
    return true;
}

esp_err_t mlx90640_i2c_init(int sda_gpio, int scl_gpio, uint32_t freq_hz, uint8_t addr)
{
    if (s_dev != NULL) {
        return ESP_OK;
    }
    if (!pin_is_usable(sda_gpio, "SDA") || !pin_is_usable(scl_gpio, "SCL")) {
        return ESP_ERR_INVALID_ARG;
    }
    if (sda_gpio == scl_gpio) {
        ESP_LOGE(TAG, "SDA e SCL não podem usar o mesmo GPIO (%d).", sda_gpio);
        return ESP_ERR_INVALID_ARG;
    }

    i2c_master_bus_config_t bus_cfg = {
        .i2c_port = I2C_NUM_0,
        .sda_io_num = sda_gpio,
        .scl_io_num = scl_gpio,
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .glitch_ignore_cnt = 7,
        // Reserva: o pull-up interno é fraco para 400 kHz; use 4,7 kΩ externos.
        .flags.enable_internal_pullup = true,
    };
    esp_err_t err = i2c_new_master_bus(&bus_cfg, &s_bus);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Falha ao criar o barramento I2C: %s", esp_err_to_name(err));
        s_bus = NULL;
        return err;
    }

    // Procura o sensor antes de registrá-lo: erro de fiação vira uma mensagem clara.
    err = i2c_master_probe(s_bus, addr, I2C_TIMEOUT_MS);
    if (err != ESP_OK) {
        ESP_LOGE(TAG,
                 "Nenhum dispositivo respondeu no endereço 0x%02X (SDA=%d, SCL=%d). "
                 "Confira fiação, pull-ups de 4,7 kΩ e o endereço do sensor.",
                 addr, sda_gpio, scl_gpio);
        i2c_del_master_bus(s_bus);
        s_bus = NULL;
        return ESP_ERR_NOT_FOUND;
    }

    i2c_device_config_t dev_cfg = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = addr,
        .scl_speed_hz = freq_hz,
    };
    err = i2c_master_bus_add_device(s_bus, &dev_cfg, &s_dev);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Falha ao registrar o sensor no barramento: %s", esp_err_to_name(err));
        i2c_del_master_bus(s_bus);
        s_bus = NULL;
        s_dev = NULL;
        return err;
    }

    s_freq_hz = freq_hz;
    ESP_LOGI(TAG, "MLX90640 detectado em 0x%02X (SDA=%d, SCL=%d, %lu Hz).", addr, sda_gpio, scl_gpio,
             (unsigned long) freq_hz);
    return ESP_OK;
}

void mlx90640_i2c_set_deadline_ms(uint32_t ms)
{
    s_deadline_us = esp_timer_get_time() + (int64_t) ms * 1000;
}

void mlx90640_i2c_clear_deadline(void)
{
    s_deadline_us = 0;
}

// A biblioteca da Melexis espera erros como valores negativos; leitura/escrita ok = 0.

int MLX90640_I2CRead(uint8_t slaveAddr, uint16_t startAddress, uint16_t nMemAddressRead, uint16_t *data)
{
    (void) slaveAddr; // há um único sensor, registrado em mlx90640_i2c_init()
    if (s_dev == NULL || data == NULL) {
        return -MLX90640_I2C_NACK_ERROR;
    }
    if (s_deadline_us != 0 && esp_timer_get_time() > s_deadline_us) {
        return -MLX90640_I2C_NACK_ERROR;
    }

    // O laço de espera da Melexis lê o status sem parar; ceder a CPU evita encher o
    // barramento e deixa a task idle (e o watchdog) respirarem.
    if (startAddress == MLX90640_STATUS_REG) {
        vTaskDelay(1);
    }

    uint8_t buf[READ_CHUNK_WORDS * 2];
    uint16_t address = startAddress;
    uint16_t remaining = nMemAddressRead;

    while (remaining > 0) {
        uint16_t chunk = remaining > READ_CHUNK_WORDS ? READ_CHUNK_WORDS : remaining;
        uint8_t reg[2] = {(uint8_t) (address >> 8), (uint8_t) (address & 0xFF)};

        esp_err_t err = i2c_master_transmit_receive(s_dev, reg, sizeof(reg), buf, chunk * 2, I2C_TIMEOUT_MS);
        if (err != ESP_OK) {
            ESP_LOGD(TAG, "Leitura I2C falhou em 0x%04X: %s", address, esp_err_to_name(err));
            return -MLX90640_I2C_NACK_ERROR;
        }

        for (uint16_t i = 0; i < chunk; i++) {
            data[i] = ((uint16_t) buf[2 * i] << 8) | buf[2 * i + 1];
        }
        data += chunk;
        address += chunk;
        remaining -= chunk;
    }

    return MLX90640_NO_ERROR;
}

int MLX90640_I2CWrite(uint8_t slaveAddr, uint16_t writeAddress, uint16_t data)
{
    if (s_dev == NULL) {
        return -MLX90640_I2C_NACK_ERROR;
    }

    uint8_t buf[4] = {
        (uint8_t) (writeAddress >> 8),
        (uint8_t) (writeAddress & 0xFF),
        (uint8_t) (data >> 8),
        (uint8_t) (data & 0xFF),
    };
    if (i2c_master_transmit(s_dev, buf, sizeof(buf), I2C_TIMEOUT_MS) != ESP_OK) {
        return -MLX90640_I2C_NACK_ERROR;
    }

    // Só o registrador de controle é conferido depois de escrito: o de status muda
    // sozinho (bit "dado pronto"), então ler de volta daria um falso erro.
    if (writeAddress == MLX90640_CTRL_REG) {
        uint16_t check = 0;
        if (MLX90640_I2CRead(slaveAddr, writeAddress, 1, &check) != MLX90640_NO_ERROR) {
            return -MLX90640_I2C_NACK_ERROR;
        }
        if (check != data) {
            return -MLX90640_I2C_WRITE_ERROR;
        }
    }

    return MLX90640_NO_ERROR;
}

// Só é chamada pelo modo de disparo manual (MLX90640_TriggerMeasurement), que o
// firmware não usa. Um "general call" reinicia TODOS os dispositivos do barramento.
int MLX90640_I2CGeneralReset(void)
{
    if (s_bus == NULL) {
        return -MLX90640_I2C_NACK_ERROR;
    }

    i2c_device_config_t cfg = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = 0x00,
        .scl_speed_hz = s_freq_hz,
    };
    i2c_master_dev_handle_t general_call;
    if (i2c_master_bus_add_device(s_bus, &cfg, &general_call) != ESP_OK) {
        return -MLX90640_I2C_NACK_ERROR;
    }

    const uint8_t reset_cmd = 0x06;
    esp_err_t err = i2c_master_transmit(general_call, &reset_cmd, 1, I2C_TIMEOUT_MS);
    i2c_master_bus_rm_device(general_call);
    vTaskDelay(pdMS_TO_TICKS(5));

    return err == ESP_OK ? MLX90640_NO_ERROR : -MLX90640_I2C_NACK_ERROR;
}
