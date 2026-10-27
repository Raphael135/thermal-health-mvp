#include "api_client.h"
#include "device_config.h"

#include <math.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "esp_crt_bundle.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_netif_sntp.h"
#include "freertos/FreeRTOS.h"

static const char *TAG = "api_client";

#define SNTP_WAIT_MS 8000
#define HTTP_TIMEOUT_MS 20000
// Antes de 2023 o relógio ainda está no padrão do chip (1970): não dá para usar como hora.
#define MIN_VALID_EPOCH 1700000000

static bool s_sntp_started;

// Tenta acertar o relógio por SNTP. Sem hora a captura segue mesmo assim (o servidor usa o
// horário em que a recebe), então isto nunca bloqueia o envio por mais de SNTP_WAIT_MS.
static bool clock_is_valid(void) {
    if (time(NULL) >= MIN_VALID_EPOCH) {
        return true;
    }

    if (!s_sntp_started) {
        esp_sntp_config_t config = ESP_NETIF_SNTP_DEFAULT_CONFIG(CONFIG_THERMAL_NTP_SERVER);
        if (esp_netif_sntp_init(&config) != ESP_OK) {
            ESP_LOGW(TAG, "Não consegui iniciar o SNTP.");
            return false;
        }
        s_sntp_started = true;
    }

    if (esp_netif_sntp_sync_wait(pdMS_TO_TICKS(SNTP_WAIT_MS)) != ESP_OK) {
        ESP_LOGW(TAG, "Sem resposta do servidor de hora; a captura vai sem horário do aparelho.");
        return false;
    }
    return time(NULL) >= MIN_VALID_EPOCH;
}

// Duas casas decimais, calculadas em double: um float arredondado e convertido para double volta a
// virar 30.719999313354492 (15 dígitos, ~3x mais bytes no envio).
static double round2(float value) {
    return round((double) value * 100.0) / 100.0;
}

static bool is_uuid(const char *text) {
    if (strlen(text) != 36) {
        return false;
    }
    for (int i = 0; i < 36; i++) {
        bool dash = (i == 8 || i == 13 || i == 18 || i == 23);
        char c = text[i];
        bool hex = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
        if (dash ? c != '-' : !hex) {
            return false;
        }
    }
    return true;
}

// Escreve o JSON direto num buffer (~6 KB para 768 valores). Uma árvore cJSON desses mesmos valores
// ocuparia dezenas de KB de heap, que no ESP32 comum são disputados com o Wi-Fi, o BLE e o TLS.
// patientId é validado como UUID, então não precisa de escape.
static char *build_payload(const thermal_frame_t *frame, const char *patient_id, bool with_time) {
    int total = frame->width * frame->height;
    if (total <= 0 || !is_uuid(patient_id)) {
        return NULL;
    }

    // cabeçalho + rodapé + até 9 caracteres por valor (-40..300 com 2 casas, mais a vírgula)
    size_t capacity = 256 + (size_t) total * 9;
    char *buffer = malloc(capacity);
    if (buffer == NULL) {
        return NULL;
    }

    int written = snprintf(buffer, capacity,
                           "{\"patientId\":\"%s\",\"width\":%d,\"height\":%d,\"unit\":\"celsius\",\"temperatures\":[",
                           patient_id, frame->width, frame->height);
    size_t length = (written > 0 && (size_t) written < capacity) ? (size_t) written : 0;
    bool ok = length > 0;

    for (int i = 0; ok && i < total; i++) {
        float raw = frame->temperatures[i];
        if (!isfinite(raw)) {
            ok = false; // "nan" não é JSON válido: melhor não enviar
            break;
        }
        double value = round2(raw);
        if (value == 0.0) {
            value = 0.0; // evita "-0.00"
        }
        written = snprintf(buffer + length, capacity - length, i == 0 ? "%.2f" : ",%.2f", value);
        if (written < 0 || (size_t) written >= capacity - length) {
            ok = false;
            break;
        }
        length += (size_t) written;
    }

    if (ok) {
        written = snprintf(buffer + length, capacity - length, "]");
        ok = written > 0 && (size_t) written < capacity - length;
        length += ok ? (size_t) written : 0;
    }

    if (ok && with_time) {
        time_t now = time(NULL);
        struct tm utc;
        char stamp[32];
        gmtime_r(&now, &utc);
        strftime(stamp, sizeof stamp, "%Y-%m-%dT%H:%M:%SZ", &utc);
        written = snprintf(buffer + length, capacity - length, ",\"capturedAt\":\"%s\"", stamp);
        ok = written > 0 && (size_t) written < capacity - length;
        length += ok ? (size_t) written : 0;
    }

    if (ok) {
        written = snprintf(buffer + length, capacity - length, "}");
        ok = written > 0 && (size_t) written < capacity - length;
    }

    if (!ok) {
        free(buffer);
        return NULL;
    }
    return buffer; // chamador deve dar free()
}

int api_client_send_capture(const thermal_frame_t *frame, const char *patient_id) {
    if (strlen(DEVICE_SECRET) == 0) {
        ESP_LOGE(TAG, "Segredo do aparelho não configurado (menuconfig > Thermal Health Device).");
        return -1;
    }

    char *payload = build_payload(frame, patient_id, clock_is_valid());
    if (payload == NULL) {
        ESP_LOGE(TAG, "Sem memória para montar o JSON da captura.");
        return -1;
    }

    char url[256];
    int url_len = snprintf(url, sizeof url, "%s/device-captures", API_BASE_URL);
    if (url_len < 0 || url_len >= (int) sizeof url) {
        ESP_LOGE(TAG, "URL da API longa demais.");
        free(payload);
        return -1;
    }

    esp_http_client_config_t config = {
        .url = url,
        .method = HTTP_METHOD_POST,
        .timeout_ms = HTTP_TIMEOUT_MS,
        // Verifica o certificado do servidor contra os certificados raiz embutidos. Só vale para
        // https://; com http:// (rede local de teste) nada é verificado nem criptografado.
        .crt_bundle_attach = esp_crt_bundle_attach,
    };

    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (client == NULL) {
        ESP_LOGE(TAG, "Falha ao iniciar o cliente HTTP.");
        free(payload);
        return -1;
    }
    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_header(client, "x-device-id", DEVICE_HARDWARE_ID);
    esp_http_client_set_header(client, "x-device-secret", DEVICE_SECRET);
    esp_http_client_set_post_field(client, payload, strlen(payload));

    esp_err_t err = esp_http_client_perform(client);
    int result = -1;

    if (err == ESP_OK) {
        int status = esp_http_client_get_status_code(client);
        if (status >= 200 && status < 300) {
            ESP_LOGI(TAG, "Captura enviada (HTTP %d, %u bytes).", status, (unsigned) strlen(payload));
            result = 0;
        } else if (status == 401) {
            ESP_LOGE(TAG, "A API recusou o aparelho (HTTP 401): confira o ID e o segredo no menuconfig e se ele está ativo no painel admin.");
        } else if (status == 403) {
            ESP_LOGE(TAG, "A API recusou a captura (HTTP 403): o aparelho precisa estar vinculado a esta paciente no painel admin.");
        } else {
            ESP_LOGE(TAG, "A API respondeu HTTP %d.", status);
        }
    } else {
        ESP_LOGE(TAG, "Falha de conexão com a API: %s", esp_err_to_name(err));
    }

    esp_http_client_cleanup(client);
    free(payload);
    return result;
}
