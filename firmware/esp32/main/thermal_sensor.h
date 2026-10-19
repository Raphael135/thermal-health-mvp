#pragma once

#include <stddef.h>

// Camada do sensor térmico. A implementação padrão lê o MLX90640 (32x24) por I2C;
// com CONFIG_THERMAL_SENSOR_SIMULATED ligado ela gera quadros falsos para testar o
// resto do firmware sem o sensor. Nenhum outro arquivo muda entre os dois modos.

typedef struct {
    int width;
    int height;
    float *temperatures; // buffer de width*height valores em °C, alocado pelo chamador
} thermal_frame_t;

// Inicializa o sensor (ou o simulador). Retorna 0 em sucesso, < 0 se o sensor não
// respondeu ou a calibração falhou (o motivo vai para o log).
int thermal_sensor_init(void);

// Preenche `out_frame->temperatures` (width*height floats, em °C). Leva cerca de 1 s
// com o sensor a 2 Hz, porque junta duas leituras de meio quadro. Retorna 0 em
// sucesso, != 0 em erro de leitura (nesse caso o buffer não deve ser usado).
int thermal_sensor_read_frame(thermal_frame_t *out_frame);
