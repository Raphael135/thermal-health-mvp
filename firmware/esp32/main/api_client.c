#include "api_client.h"
#include "device_config.h"
#include <stdlib.h>
#include <string.h>
#include "esp_http_client.h"
#include "esp_log.h"
#include "cJSON.h"

static const char *TAG = "api_client";

static char *build_payload(const thermal_frame_t *frame, const char *patient_id) {
    cJSON *root = cJSON_CreateObject();
    cJSON_AddStringToObject(root, "patientId", patient_id);
    cJSON_AddNumberToObject(root, "width", frame->width);
    cJSON_AddNumberToObject(root, "height", frame->height);
    cJSON_AddStringToObject(root, "unit", "celsius");

    cJSON *temperatures = cJSON_CreateArray();
    int total = frame->width * frame->height;
    for (int i = 0; i < total; i++) {
        cJSON_AddItemToArray(temperatures, cJSON_CreateNumber(frame->temperatures[i]));
    }
    cJSON_AddItemToObject(root, "temperatures", temperatures);

    // TODO: usar timestamp real (SNTP) em vez de placeholder fixo.
    cJSON_AddStringToObject(root, "capturedAt", "2026-01-01T00:00:00Z");

    char *json_string = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    return json_string; // chamador deve dar free()
}

int api_client_send_capture(const thermal_frame_t *frame, const char *patient_id) {
    char *payload = build_payload(frame, patient_id);
    if (payload == NULL) {
        ESP_LOGE(TAG, "Falha ao montar payload JSON.");
        return -1;
    }

    char url[256];
    snprintf(url, sizeof(url), "%s/device-captures", API_BASE_URL);

    esp_http_client_config_t config = {
        .url = url,
        .method = HTTP_METHOD_POST,
        .timeout_ms = 15000,
        // TODO: em produção, apontar para o certificado CA correto em vez de
        // aceitar qualquer certificado — nunca usar skip_cert_common_name_check
        // fora de ambiente de desenvolvimento controlado.
    };

    esp_http_client_handle_t client = esp_http_client_init(&config);
    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_header(client, "x-device-id", DEVICE_HARDWARE_ID);
    esp_http_client_set_header(client, "x-device-secret", DEVICE_SECRET_PLACEHOLDER);
    esp_http_client_set_post_field(client, payload, strlen(payload));

    esp_err_t err = esp_http_client_perform(client);
    int result = -1;

    if (err == ESP_OK) {
        int status = esp_http_client_get_status_code(client);
        ESP_LOGI(TAG, "Captura enviada, status HTTP=%d", status);
        result = (status >= 200 && status < 300) ? 0 : -1;
    } else {
        ESP_LOGE(TAG, "Erro HTTP: %s", esp_err_to_name(err));
    }

    esp_http_client_cleanup(client);
    free(payload);
    return result;
}
