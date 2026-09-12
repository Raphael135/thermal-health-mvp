#include "ble_provisioning.h"
#include <string.h>
#include "esp_log.h"

static const char *TAG = "ble_provisioning";

// UUIDs do serviço de provisionamento (placeholders — gerar UUIDs próprios em produção).
// Service:            0000A000-0000-1000-8000-00805F9B34FB
// Char Wi-Fi config:  0000A001-0000-1000-8000-00805F9B34FB  (write: "ssid|password")
// Char comando:       0000A002-0000-1000-8000-00805F9B34FB  (write: "START_CAPTURE")
// Char status:        0000A003-0000-1000-8000-00805F9B34FB  (notify: status da captura)

static ble_on_wifi_credentials_cb s_on_wifi_credentials = NULL;
static ble_on_start_capture_cb s_on_start_capture = NULL;

// TODO: implementar com NimBLE:
//   - nimble_port_init()
//   - ble_hs_cfg + ble_svc_gap_init / ble_svc_gatt_init
//   - registrar o serviço/características acima via ble_gatts_count_cfg + ble_gatts_add_svcs
//   - no callback de escrita da característica Wi-Fi: parsear "ssid|password" e
//     chamar s_on_wifi_credentials(ssid, password)
//   - no callback de escrita da característica de comando: se payload == "START_CAPTURE",
//     chamar s_on_start_capture()
//   - iniciar advertising em ble_provisioning_start_advertising()

int ble_provisioning_init(ble_on_wifi_credentials_cb on_wifi_credentials, ble_on_start_capture_cb on_start_capture) {
    s_on_wifi_credentials = on_wifi_credentials;
    s_on_start_capture = on_start_capture;

    ESP_LOGI(TAG, "BLE provisioning inicializado (estrutura pronta para implementação NimBLE).");
    return 0;
}

int ble_provisioning_start_advertising(void) {
    ESP_LOGI(TAG, "Advertising BLE iniciado (placeholder).");
    return 0;
}
