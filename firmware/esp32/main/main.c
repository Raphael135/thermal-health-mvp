#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "nvs.h"
#include "nvs_flash.h"
#include "sdkconfig.h"

#include "device_config.h"
#include "thermal_sensor.h"
#include "wifi_manager.h"
#include "ble_provisioning.h"
#include "api_client.h"

static const char *TAG = "main";

// O Wi-Fi bloqueia por até 15 s e o HTTPS (TLS) precisa de pilha grande: nada disso pode rodar
// na task do BLE. Os callbacks do BLE só colocam um evento nesta fila; quem executa é a task abaixo.
#define WORKER_STACK_BYTES 10240
#define EVENT_QUEUE_LEN 4

typedef enum { EVT_WIFI, EVT_PATIENT, EVT_CAPTURE } event_type_t;

typedef struct {
    event_type_t type;
    char text1[BLE_PATIENT_ID_LEN + 4]; // SSID (<= 32) ou patientId (36)
    char text2[BLE_WIFI_PASSWORD_MAX + 1]; // senha do Wi-Fi
} device_event_t;

static QueueHandle_t s_events;
static volatile bool s_busy; // a task de trabalho está processando um evento

// Só a task de trabalho lê/escreve estas duas.
static char s_patient_id[BLE_PATIENT_ID_LEN + 1];
static bool s_patient_set;

#define NVS_NAMESPACE "thermal"
#define NVS_KEY_PATIENT "patient"

static void publish(ble_device_state_t state, ble_device_error_t error) {
    uint8_t flags = 0;
    if (wifi_manager_is_connected()) {
        flags |= BLE_FLAG_WIFI_CONNECTED;
    }
    if (s_patient_set) {
        flags |= BLE_FLAG_PATIENT_SET;
    }
    ble_provisioning_update_status(state, flags, error);
}

// ---- Persistência do patientId ----------------------------------------------------

static void load_patient_id(void) {
    nvs_handle_t handle;
    if (nvs_open(NVS_NAMESPACE, NVS_READONLY, &handle) != ESP_OK) {
        return;
    }
    size_t size = sizeof s_patient_id;
    if (nvs_get_str(handle, NVS_KEY_PATIENT, s_patient_id, &size) == ESP_OK && strlen(s_patient_id) == BLE_PATIENT_ID_LEN) {
        s_patient_set = true;
        ESP_LOGI(TAG, "patientId carregado da memória.");
    } else {
        s_patient_id[0] = '\0';
    }
    nvs_close(handle);
}

static void save_patient_id(const char *patient_id) {
    nvs_handle_t handle;
    if (nvs_open(NVS_NAMESPACE, NVS_READWRITE, &handle) != ESP_OK) {
        ESP_LOGE(TAG, "Não consegui abrir a NVS; o patientId vale só até reiniciar.");
        return;
    }
    if (nvs_set_str(handle, NVS_KEY_PATIENT, patient_id) != ESP_OK || nvs_commit(handle) != ESP_OK) {
        ESP_LOGE(TAG, "Não consegui gravar o patientId na NVS.");
    }
    nvs_close(handle);
}

// ---- Callbacks do BLE (rodam na task do NimBLE: nada de trabalho pesado) -------------

// Wi-Fi e patientId esperam na fila (o app manda um logo depois do outro). Um pedido de captura
// só vale se nada estiver em andamento: um segundo toque no botão não gera outra captura.
static void post_event(const device_event_t *event) {
    bool rejected = (event->type == EVT_CAPTURE && s_busy) || xQueueSend(s_events, event, 0) != pdTRUE;
    if (rejected) {
        ESP_LOGW(TAG, "Ocupado: comando do app ignorado.");
        publish(BLE_STATE_ERROR, BLE_ERR_BUSY);
    }
}

static void on_wifi_credentials(const char *ssid, const char *password) {
    device_event_t event = {.type = EVT_WIFI};
    strlcpy(event.text1, ssid, sizeof event.text1);
    strlcpy(event.text2, password, sizeof event.text2);
    post_event(&event);
    memset(&event, 0, sizeof event);
}

static void on_patient_id(const char *patient_id) {
    device_event_t event = {.type = EVT_PATIENT};
    strlcpy(event.text1, patient_id, sizeof event.text1);
    post_event(&event);
}

static void on_start_capture(void) {
    device_event_t event = {.type = EVT_CAPTURE};
    post_event(&event);
}

// ---- Task de trabalho --------------------------------------------------------------

static void run_capture(void) {
    if (!wifi_manager_is_connected()) {
        ESP_LOGE(TAG, "Captura pedida, mas o dispositivo não está no Wi-Fi.");
        publish(BLE_STATE_ERROR, BLE_ERR_NO_WIFI);
        return;
    }
    if (!s_patient_set) {
        ESP_LOGE(TAG, "Captura pedida, mas nenhuma paciente foi associada ao dispositivo.");
        publish(BLE_STATE_ERROR, BLE_ERR_NO_PATIENT);
        return;
    }

    publish(BLE_STATE_CAPTURING, BLE_ERR_NONE);
    ESP_LOGI(TAG, "Iniciando captura térmica...");

    thermal_frame_t frame = {
        .width = THERMAL_FRAME_WIDTH,
        .height = THERMAL_FRAME_HEIGHT,
        .temperatures = malloc(sizeof(float) * THERMAL_FRAME_WIDTH * THERMAL_FRAME_HEIGHT),
    };
    if (frame.temperatures == NULL) {
        ESP_LOGE(TAG, "Sem memória para o quadro térmico.");
        publish(BLE_STATE_ERROR, BLE_ERR_INTERNAL);
        return;
    }

    if (thermal_sensor_read_frame(&frame) != 0) {
        ESP_LOGE(TAG, "Falha ao ler o sensor térmico.");
        publish(BLE_STATE_ERROR, BLE_ERR_SENSOR);
    } else {
        publish(BLE_STATE_UPLOADING, BLE_ERR_NONE);
        if (api_client_send_capture(&frame, s_patient_id) == 0) {
            ESP_LOGI(TAG, "Captura enviada com sucesso.");
            publish(BLE_STATE_DONE, BLE_ERR_NONE);
        } else {
            ESP_LOGE(TAG, "Falha ao enviar a captura para a API.");
            publish(BLE_STATE_ERROR, BLE_ERR_UPLOAD);
        }
    }

    free(frame.temperatures);
}

static void worker_task(void *param) {
    (void) param;

    for (;;) {
        device_event_t event;
        if (xQueueReceive(s_events, &event, portMAX_DELAY) != pdTRUE) {
            continue;
        }
        s_busy = true;

        switch (event.type) {
        case EVT_WIFI:
            publish(BLE_STATE_CONNECTING_WIFI, BLE_ERR_NONE);
            if (wifi_manager_connect(event.text1, event.text2) == 0) {
                publish(BLE_STATE_IDLE, BLE_ERR_NONE);
            } else {
                ESP_LOGE(TAG, "Não consegui conectar ao Wi-Fi informado.");
                publish(BLE_STATE_ERROR, BLE_ERR_WIFI_FAILED);
            }
            break;

        case EVT_PATIENT:
            strlcpy(s_patient_id, event.text1, sizeof s_patient_id);
            s_patient_set = true;
            save_patient_id(s_patient_id);
            publish(BLE_STATE_IDLE, BLE_ERR_NONE);
            break;

        case EVT_CAPTURE:
            run_capture();
            break;
        }

        memset(&event, 0, sizeof event); // apaga a senha do Wi-Fi da pilha
        s_busy = false;
    }
}

#if CONFIG_THERMAL_SELFTEST_ON_BOOT
// Lê o sensor em loop e mostra mín/máx/média: confere fiação e leitura na bancada,
// sem depender de BLE, Wi-Fi nem da API. Não retorna.
static void thermal_selftest_loop(void) {
    const int pixels = THERMAL_FRAME_WIDTH * THERMAL_FRAME_HEIGHT;
    thermal_frame_t frame = {
        .width = THERMAL_FRAME_WIDTH,
        .height = THERMAL_FRAME_HEIGHT,
        .temperatures = malloc(sizeof(float) * pixels),
    };
    if (frame.temperatures == NULL) {
        ESP_LOGE(TAG, "Sem memória para o autoteste do sensor.");
        return;
    }

    while (1) {
        if (thermal_sensor_read_frame(&frame) == 0) {
            float min = frame.temperatures[0];
            float max = frame.temperatures[0];
            float sum = 0.0f;
            for (int i = 0; i < pixels; i++) {
                float t = frame.temperatures[i];
                if (t < min) min = t;
                if (t > max) max = t;
                sum += t;
            }
            ESP_LOGI(TAG, "Quadro: mín %.2f °C | máx %.2f °C | média %.2f °C", min, max, sum / pixels);

#if CONFIG_THERMAL_SERIAL_DUMP
            printf("FRAME,%d,%d", THERMAL_FRAME_WIDTH, THERMAL_FRAME_HEIGHT);
            for (int i = 0; i < pixels; i++) {
                printf(",%.2f", frame.temperatures[i]);
            }
            printf("\n");
#endif
        } else {
            ESP_LOGE(TAG, "Leitura do sensor falhou; tentando de novo.");
        }
        vTaskDelay(pdMS_TO_TICKS(200));
    }
}
#endif

void app_main(void) {
    esp_err_t nvs_result = nvs_flash_init();
    if (nvs_result == ESP_ERR_NVS_NO_FREE_PAGES || nvs_result == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        nvs_result = nvs_flash_init();
    }
    ESP_ERROR_CHECK(nvs_result);

    ESP_LOGI(TAG, "Inicializando dispositivo %s", DEVICE_HARDWARE_ID);

    load_patient_id();

    if (thermal_sensor_init() != 0) {
        ESP_LOGE(TAG, "Sensor térmico indisponível: as capturas vão falhar até ele responder.");
    }
    wifi_manager_init();

    s_events = xQueueCreate(EVENT_QUEUE_LEN, sizeof(device_event_t));
    if (s_events == NULL || xTaskCreate(worker_task, "worker", WORKER_STACK_BYTES, NULL, 5, NULL) != pdPASS) {
        ESP_LOGE(TAG, "Sem memória para a task de trabalho; o dispositivo não vai responder ao app.");
        return;
    }

    ble_provisioning_callbacks_t callbacks = {
        .on_wifi_credentials = on_wifi_credentials,
        .on_patient_id = on_patient_id,
        .on_start_capture = on_start_capture,
    };
    if (ble_provisioning_init(&callbacks) != 0) {
        ESP_LOGE(TAG, "BLE não iniciou; o app não vai conseguir parear.");
    }
    publish(BLE_STATE_IDLE, BLE_ERR_NONE);

    ESP_LOGI(TAG, "Dispositivo pronto. Aguardando o app via BLE.");

#if CONFIG_THERMAL_SELFTEST_ON_BOOT
    thermal_selftest_loop();
#endif

    // Tudo acontece nas tasks do BLE e de trabalho; esta fica só viva.
    while (1) {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
