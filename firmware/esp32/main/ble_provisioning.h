#pragma once

// Provisionamento via BLE: o app mobile descobre o dispositivo, conecta e envia
// as credenciais Wi-Fi, além de comandos como "iniciar captura". Esta é a
// contraparte do DeviceService do app (apps/mobile/src/services/DeviceService.ts).
//
// Implementação de referência: NimBLE (CONFIG_BT_NIMBLE_ENABLED=y, ver
// sdkconfig.defaults). Este arquivo documenta o contrato; o corpo em
// ble_provisioning.c contém a estrutura do serviço GATT com TODOs nos pontos
// que dependem da biblioteca NimBLE (registro de serviço, callbacks de escrita).

typedef void (*ble_on_wifi_credentials_cb)(const char *ssid, const char *password);
typedef void (*ble_on_start_capture_cb)(void);

int ble_provisioning_init(ble_on_wifi_credentials_cb on_wifi_credentials, ble_on_start_capture_cb on_start_capture);
int ble_provisioning_start_advertising(void);
