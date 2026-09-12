#include <stdlib.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "nvs_flash.h"

#include "device_config.h"
#include "thermal_sensor.h"
#include "wifi_manager.h"
#include "ble_provisioning.h"
#include "api_client.h"

static const char *TAG = "main";

// Paciente vinculada a este dispositivo, recebida via BLE junto com um comando
// futuro (fora do MVP mínimo, o app pode enviar o patientId ao parear). Por ora,
// placeholder — em produção isso viria do provisionamento BLE junto com o Wi-Fi.
static char s_patient_id[64] = "";

static void on_wifi_credentials_received(const char *ssid, const char *password) {
    ESP_LOGI(TAG, "Credenciais Wi-Fi recebidas via BLE, conectando...");
    if (wifi_manager_connect(ssid, password) != 0) {
        ESP_LOGE(TAG, "Não foi possível conectar ao Wi-Fi informado.");
    }
}

static void on_start_capture_received(void) {
    if (!wifi_manager_is_connected()) {
        ESP_LOGE(TAG, "Captura solicitada, mas o dispositivo não está conectado ao Wi-Fi.");
        return;
    }
    if (strlen(s_patient_id) == 0) {
        ESP_LOGE(TAG, "Captura solicitada, mas nenhuma paciente foi associada a este dispositivo.");
        return;
    }

    ESP_LOGI(TAG, "Iniciando captura térmica...");

    thermal_frame_t frame = {
        .width = THERMAL_FRAME_WIDTH,
        .height = THERMAL_FRAME_HEIGHT,
        .temperatures = malloc(sizeof(float) * THERMAL_FRAME_WIDTH * THERMAL_FRAME_HEIGHT),
    };

    if (frame.temperatures == NULL) {
        ESP_LOGE(TAG, "Falha ao alocar buffer do frame térmico.");
        return;
    }

    if (thermal_sensor_read_frame(&frame) == 0) {
        int result = api_client_send_capture(&frame, s_patient_id);
        if (result == 0) {
            ESP_LOGI(TAG, "Captura enviada com sucesso.");
        } else {
            ESP_LOGE(TAG, "Falha ao enviar captura para a API.");
        }
    } else {
        ESP_LOGE(TAG, "Falha ao ler frame do sensor térmico.");
    }

    free(frame.temperatures);
}

void app_main(void) {
    esp_err_t nvs_result = nvs_flash_init();
    if (nvs_result == ESP_ERR_NVS_NO_FREE_PAGES || nvs_result == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        nvs_result = nvs_flash_init();
    }
    ESP_ERROR_CHECK(nvs_result);

    ESP_LOGI(TAG, "Inicializando dispositivo %s", DEVICE_HARDWARE_ID);

    thermal_sensor_init();
    wifi_manager_init();
    ble_provisioning_init(on_wifi_credentials_received, on_start_capture_received);
    ble_provisioning_start_advertising();

    ESP_LOGI(TAG, "Dispositivo pronto. Aguardando pareamento via BLE.");

    // Loop principal — em uma implementação completa, tratar reconexão de
    // Wi-Fi, watchdog, deep sleep entre capturas, etc.
    while (1) {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
