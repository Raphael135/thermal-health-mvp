#include "thermal_sensor.h"

#include <math.h>
#include <stdbool.h>
#include <stdint.h> // MLX90640_API.h usa uint16_t etc. sem incluir stdint.h por conta própria
#include <stdlib.h>
#include "esp_err.h"
#include "esp_log.h"
#include "sdkconfig.h"

#include "device_config.h"

static const char *TAG = "thermal_sensor";

#if CONFIG_THERMAL_SENSOR_SIMULATED

int thermal_sensor_init(void) {
    ESP_LOGW(TAG, "Sensor térmico SIMULADO (CONFIG_THERMAL_SENSOR_SIMULATED): sem hardware real.");
    return 0;
}

int thermal_sensor_read_frame(thermal_frame_t *out_frame) {
    if (out_frame == NULL || out_frame->temperatures == NULL) {
        return -1;
    }

    // Gera um frame plausível: baseline corporal + "hotspot" central + ruído,
    // só para permitir testar o pipeline completo sem hardware.
    float baseline = 31.0f + ((float) rand() / RAND_MAX);
    float center_x = out_frame->width / 2.0f;
    float center_y = out_frame->height / 2.0f;

    for (int y = 0; y < out_frame->height; y++) {
        for (int x = 0; x < out_frame->width; x++) {
            float dx = x - center_x;
            float dy = y - center_y;
            float distance = sqrtf(dx * dx + dy * dy);
            float hotspot = fmaxf(0.0f, 4.0f - distance * 0.3f);
            float noise = (((float) rand() / RAND_MAX) - 0.5f) * 0.6f;

            out_frame->temperatures[y * out_frame->width + x] = baseline + hotspot + noise;
        }
    }

    return 0;
}

#else // MLX90640 real

#include "MLX90640_API.h"
#include "mlx90640_i2c_esp32.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

_Static_assert(THERMAL_FRAME_WIDTH * THERMAL_FRAME_HEIGHT == MLX90640_PIXEL_NUM,
               "THERMAL_FRAME_WIDTH x THERMAL_FRAME_HEIGHT precisa ser 32x24 (MLX90640)");

#define MLX_ADDR ((uint8_t) CONFIG_THERMAL_MLX90640_ADDR)
#define MLX_CHESS_MODE 1
// Exemplos oficiais da Melexis: temperatura refletida = temperatura do sensor - 8 °C
// (sensor em ar parado).
#define REFLECTED_TEMP_SHIFT_C 8.0f
#define MAX_FRAME_READS 8
#define MIN_VALID_C (-40.0f)
#define MAX_VALID_C 300.0f

static paramsMLX90640 s_params;
static uint16_t s_frame_data[834];
static float s_to[MLX90640_PIXEL_NUM];
static bool s_ready;
// O quadro, os parâmetros e a ponte I2C são compartilhados: uma leitura por vez.
static SemaphoreHandle_t s_lock;

int thermal_sensor_init(void) {
    s_ready = false;
    if (s_lock == NULL) {
        s_lock = xSemaphoreCreateMutex();
        if (s_lock == NULL) {
            ESP_LOGE(TAG, "Sem memória para a trava do sensor.");
            return -6;
        }
    }

    esp_err_t err = mlx90640_i2c_init(CONFIG_THERMAL_I2C_SDA_GPIO, CONFIG_THERMAL_I2C_SCL_GPIO,
                                      CONFIG_THERMAL_I2C_FREQ_HZ, MLX_ADDR);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Sensor indisponível: %s", esp_err_to_name(err));
        return -1;
    }

    int status = MLX90640_SetChessMode(MLX_ADDR);
    if (status != MLX90640_NO_ERROR) {
        ESP_LOGE(TAG, "Falha ao configurar o modo de leitura (código %d).", status);
        return -2;
    }

    status = MLX90640_SetRefreshRate(MLX_ADDR, CONFIG_THERMAL_REFRESH_RATE);
    if (status != MLX90640_NO_ERROR) {
        ESP_LOGE(TAG, "Falha ao configurar a taxa de atualização (código %d).", status);
        return -3;
    }

    uint16_t *eeprom = malloc(MLX90640_EEPROM_DUMP_NUM * sizeof(uint16_t));
    if (eeprom == NULL) {
        ESP_LOGE(TAG, "Sem memória para ler a calibração do sensor.");
        return -4;
    }
    status = MLX90640_DumpEE(MLX_ADDR, eeprom);
    if (status == MLX90640_NO_ERROR) {
        status = MLX90640_ExtractParameters(eeprom, &s_params);
    }
    free(eeprom);
    if (status != MLX90640_NO_ERROR) {
        ESP_LOGE(TAG, "Falha ao ler/interpretar a calibração do sensor (código %d).", status);
        return -5;
    }

    s_ready = true;
    ESP_LOGI(TAG, "MLX90640 pronto (taxa %d, emissividade %.2f).", CONFIG_THERMAL_REFRESH_RATE,
             CONFIG_THERMAL_EMISSIVITY_MILLI / 1000.0f);
    return 0;
}

static int read_frame_locked(thermal_frame_t *out_frame) {
    if (out_frame == NULL || out_frame->temperatures == NULL ||
        out_frame->width != THERMAL_FRAME_WIDTH || out_frame->height != THERMAL_FRAME_HEIGHT) {
        return -1;
    }
    if (!s_ready) {
        return -2;
    }

    const float emissivity = CONFIG_THERMAL_EMISSIVITY_MILLI / 1000.0f;

    // No modo xadrez cada leitura traz só metade dos pixels (subpágina 0 ou 1);
    // um quadro completo precisa das duas.
    bool seen[2] = {false, false};
    for (int attempt = 0; attempt < MAX_FRAME_READS && !(seen[0] && seen[1]); attempt++) {
        mlx90640_i2c_set_deadline_ms(CONFIG_THERMAL_FRAME_TIMEOUT_MS);
        int subpage = MLX90640_GetFrameData(MLX_ADDR, s_frame_data);
        mlx90640_i2c_clear_deadline();

        if (subpage == -MLX90640_FRAME_DATA_ERROR) {
            ESP_LOGW(TAG, "Quadro inválido, tentando de novo.");
            continue;
        }
        if (subpage < 0) {
            ESP_LOGE(TAG, "Falha ao ler o sensor (código %d).", subpage);
            return -3;
        }
        if (subpage > 1) {
            continue;
        }

        float ta = MLX90640_GetTa(s_frame_data, &s_params);
        MLX90640_CalculateTo(s_frame_data, &s_params, emissivity, ta - REFLECTED_TEMP_SHIFT_C, s_to);
        seen[subpage] = true;
    }
    if (!(seen[0] && seen[1])) {
        ESP_LOGE(TAG, "Não consegui montar um quadro completo em %d leituras.", MAX_FRAME_READS);
        return -4;
    }

    MLX90640_BadPixelsCorrection(s_params.brokenPixels, s_to, MLX_CHESS_MODE, &s_params);
    MLX90640_BadPixelsCorrection(s_params.outlierPixels, s_to, MLX_CHESS_MODE, &s_params);

    // Nunca entregar lixo: um valor impossível invalida o quadro inteiro.
    for (int i = 0; i < MLX90640_PIXEL_NUM; i++) {
        float value = s_to[i];
        if (!isfinite(value) || value < MIN_VALID_C || value > MAX_VALID_C) {
            ESP_LOGE(TAG, "Pixel %d com valor inválido (%.2f); quadro descartado.", i, value);
            return -5;
        }
        out_frame->temperatures[i] = value;
    }

    return 0;
}

int thermal_sensor_read_frame(thermal_frame_t *out_frame) {
    if (s_lock == NULL) {
        return -2;
    }
    xSemaphoreTake(s_lock, portMAX_DELAY);
    int result = read_frame_locked(out_frame);
    xSemaphoreGive(s_lock);
    return result;
}

#endif
