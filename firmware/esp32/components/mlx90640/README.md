# Componente MLX90640

Driver do sensor térmico MLX90640 (32×24 pixels) para o ESP32 e o ESP32-S3.

- `src/MLX90640_API.c`, `include/MLX90640_API.h`, `include/MLX90640_I2C_Driver.h`:
  biblioteca oficial da Melexis, **copiada sem alterações** de
  https://github.com/melexis/mlx90640-library (commit `f6be7ca`, 2023-02-07).
  Licença Apache 2.0, em `LICENSE`. Para atualizar, substitua esses três arquivos
  pelos do repositório da Melexis.
- `src/mlx90640_i2c_esp32.c`: nosso. Implementa as funções de I2C que a biblioteca
  da Melexis espera (`MLX90640_I2CRead`, `MLX90640_I2CWrite`,
  `MLX90640_I2CGeneralReset`) usando o driver I2C master do ESP-IDF (5.2 ou mais novo).

Quem usa o sensor é `main/thermal_sensor.c`, não este componente diretamente.
