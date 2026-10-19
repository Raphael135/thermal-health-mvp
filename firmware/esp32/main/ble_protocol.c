#include "ble_protocol.h"

#include <string.h>

static int has_nul(const uint8_t *p, size_t n) {
    return n != 0 && memchr(p, 0, n) != NULL;
}

static int is_hex(uint8_t c) {
    return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
}

ble_parse_result_t ble_protocol_parse_wifi(const uint8_t *data, size_t len,
                                           char ssid[BLE_WIFI_SSID_MAX + 1],
                                           char password[BLE_WIFI_PASSWORD_MAX + 1]) {
    if (data == NULL || len < 2) {
        return BLE_PARSE_BAD_LENGTH;
    }

    size_t ssid_len = data[0];
    if (ssid_len == 0 || ssid_len > BLE_WIFI_SSID_MAX) {
        return BLE_PARSE_BAD_VALUE;
    }
    // precisa caber: tam_ssid + ssid + tam_senha
    if (len < 1 + ssid_len + 1) {
        return BLE_PARSE_BAD_LENGTH;
    }

    size_t pass_len = data[1 + ssid_len];
    if (pass_len > BLE_WIFI_PASSWORD_MAX || (pass_len != 0 && pass_len < 8)) {
        return BLE_PARSE_BAD_VALUE;
    }
    if (len != 2 + ssid_len + pass_len) {
        return BLE_PARSE_BAD_LENGTH;
    }

    const uint8_t *ssid_bytes = data + 1;
    const uint8_t *pass_bytes = data + 2 + ssid_len;
    if (has_nul(ssid_bytes, ssid_len) || has_nul(pass_bytes, pass_len)) {
        return BLE_PARSE_BAD_VALUE;
    }

    memcpy(ssid, ssid_bytes, ssid_len);
    ssid[ssid_len] = '\0';
    memcpy(password, pass_bytes, pass_len);
    password[pass_len] = '\0';
    return BLE_PARSE_OK;
}

ble_parse_result_t ble_protocol_parse_patient_id(const uint8_t *data, size_t len,
                                                 char out[BLE_PATIENT_ID_LEN + 1]) {
    if (data == NULL || len != BLE_PATIENT_ID_LEN) {
        return BLE_PARSE_BAD_LENGTH;
    }

    for (size_t i = 0; i < BLE_PATIENT_ID_LEN; i++) {
        int is_dash_position = (i == 8 || i == 13 || i == 18 || i == 23);
        if (is_dash_position ? data[i] != '-' : !is_hex(data[i])) {
            return BLE_PARSE_BAD_VALUE;
        }
    }

    memcpy(out, data, BLE_PATIENT_ID_LEN);
    out[BLE_PATIENT_ID_LEN] = '\0';
    return BLE_PARSE_OK;
}

ble_parse_result_t ble_protocol_parse_command(const uint8_t *data, size_t len, uint8_t *command) {
    if (data == NULL || len != 1) {
        return BLE_PARSE_BAD_LENGTH;
    }
    if (data[0] != BLE_CMD_START_CAPTURE) {
        return BLE_PARSE_BAD_VALUE;
    }
    *command = data[0];
    return BLE_PARSE_OK;
}

void ble_protocol_encode_status(uint8_t out[BLE_STATUS_LEN], ble_device_state_t state,
                                uint8_t flags, ble_device_error_t error) {
    out[0] = (uint8_t) state;
    out[1] = flags;
    out[2] = (uint8_t) error;
}
