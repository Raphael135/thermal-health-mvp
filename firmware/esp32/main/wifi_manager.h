#pragma once

// Gerencia a conexão Wi-Fi do dispositivo. As credenciais chegam via BLE
// (ver ble_provisioning.h) e são repassadas para cá.

int wifi_manager_init(void);
int wifi_manager_connect(const char *ssid, const char *password);
int wifi_manager_is_connected(void);
