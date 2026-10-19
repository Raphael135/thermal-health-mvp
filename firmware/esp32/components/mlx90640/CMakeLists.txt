idf_component_register(
    SRCS
        "src/MLX90640_API.c"
        "src/mlx90640_i2c_esp32.c"
    INCLUDE_DIRS "include"
    REQUIRES
        esp_driver_i2c
        esp_driver_gpio
    PRIV_REQUIRES
        esp_timer
        freertos
        log
)
