#pragma once

#include <stddef.h>
#include <stdint.h>

// Formato dos dados trocados por BLE entre o app e o firmware. Sem nenhuma dependência
// do NimBLE de propósito: dá para testar no PC. Descrição completa em docs/BLE_PROTOCOL.md.

#define BLE_WIFI_SSID_MAX 32      // limite do 802.11
#define BLE_WIFI_PASSWORD_MAX 63  // WPA2 aceita 8..63 caracteres
#define BLE_PATIENT_ID_LEN 36     // UUID com hífens
#define BLE_CMD_START_CAPTURE 0x01
#define BLE_STATUS_LEN 3

typedef enum {
    BLE_STATE_IDLE = 0,
    BLE_STATE_CONNECTING_WIFI = 1,
    BLE_STATE_CAPTURING = 2,
    BLE_STATE_UPLOADING = 3,
    BLE_STATE_DONE = 4,
    BLE_STATE_ERROR = 5,
} ble_device_state_t;

typedef enum {
    BLE_ERR_NONE = 0,
    BLE_ERR_NO_WIFI = 1,      // captura pedida sem Wi-Fi conectado
    BLE_ERR_NO_PATIENT = 2,   // captura pedida antes de receber o patientId
    BLE_ERR_SENSOR = 3,       // falha ao ler o sensor térmico
    BLE_ERR_UPLOAD = 4,       // falha ao enviar para a API
    BLE_ERR_BUSY = 5,         // já existe uma operação em andamento
    BLE_ERR_WIFI_FAILED = 6,  // não conectou com o SSID/senha informados
    BLE_ERR_INTERNAL = 7,
} ble_device_error_t;

#define BLE_FLAG_WIFI_CONNECTED 0x01
#define BLE_FLAG_PATIENT_SET 0x02

typedef enum {
    BLE_PARSE_OK = 0,
    BLE_PARSE_BAD_LENGTH,  // tamanho incompatível com o formato
    BLE_PARSE_BAD_VALUE,   // tamanho certo, conteúdo inválido
} ble_parse_result_t;

// Wi-Fi: [tam_ssid:1][ssid][tam_senha:1][senha]. Rede aberta = tam_senha 0.
// Os tamanhos explícitos permitem SSID/senha com qualquer caractere (inclusive '|').
// `ssid` e `password` saem terminados em '\0' (precisam de MAX+1 bytes).
ble_parse_result_t ble_protocol_parse_wifi(const uint8_t *data, size_t len,
                                           char ssid[BLE_WIFI_SSID_MAX + 1],
                                           char password[BLE_WIFI_PASSWORD_MAX + 1]);

// patientId: 36 caracteres ASCII de um UUID. `out` precisa de 37 bytes.
ble_parse_result_t ble_protocol_parse_patient_id(const uint8_t *data, size_t len,
                                                 char out[BLE_PATIENT_ID_LEN + 1]);

// Comando: 1 byte. Hoje só existe BLE_CMD_START_CAPTURE.
ble_parse_result_t ble_protocol_parse_command(const uint8_t *data, size_t len, uint8_t *command);

// Status: [estado:1][flags:1][erro:1].
void ble_protocol_encode_status(uint8_t out[BLE_STATUS_LEN], ble_device_state_t state,
                                uint8_t flags, ble_device_error_t error);
