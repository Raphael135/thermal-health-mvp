#pragma once

#include <stdint.h>
#include "esp_err.h"

/**
 * Ponte entre a biblioteca da Melexis (MLX90640_API.c, que chama
 * MLX90640_I2CRead/Write/GeneralReset) e o driver I2C master do ESP-IDF (>= 5.2).
 */

/**
 * Cria o barramento I2C e registra o sensor.
 *
 * Retorna ESP_ERR_INVALID_ARG se algum GPIO não existir ou estiver reservado
 * (ex.: GPIO 6-11 são da flash no ESP32; 22-25 não existem no ESP32-S3) e
 * ESP_ERR_NOT_FOUND se nada responder no endereço informado (fiação, pull-ups
 * ou endereço errado). Nunca aborta — quem chama decide o que fazer.
 */
esp_err_t mlx90640_i2c_init(int sda_gpio, int scl_gpio, uint32_t freq_hz, uint8_t addr);

/**
 * A rotina GetFrameData da Melexis espera o sensor ficar pronto num laço sem
 * limite de tempo. Enquanto o prazo estiver armado, qualquer leitura I2C feita
 * depois dele devolve erro, o que faz esse laço terminar em vez de travar.
 */
void mlx90640_i2c_set_deadline_ms(uint32_t ms);
void mlx90640_i2c_clear_deadline(void);
