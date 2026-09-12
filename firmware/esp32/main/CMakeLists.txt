idf_component_register(
    SRCS
        "main.c"
        "thermal_sensor.c"
        "wifi_manager.c"
        "ble_provisioning.c"
        "api_client.c"
    INCLUDE_DIRS "."
    REQUIRES
        esp_wifi
        esp_http_client
        esp-tls
        nvs_flash
        bt
        json
)
