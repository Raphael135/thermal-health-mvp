#pragma once

#include <stddef.h>

// Camada abstrata do sensor térmico. Enquanto o sensor real não está definido,
// thermal_sensor.c implementa uma versão SIMULADA que gera valores plausíveis.
// Quando o sensor real for escolhido (ex.: MLX90640, AMG8833), substituir apenas
// a implementação de thermal_sensor_read_frame() — nenhum outro arquivo muda.

typedef struct {
    int width;
    int height;
    float *temperatures; // buffer de width*height valores, aquecido pelo chamador
} thermal_frame_t;

// Inicializa o sensor (ou o simulador). Retorna 0 em sucesso.
int thermal_sensor_init(void);

// Preenche `out_frame->temperatures` (já alocado pelo chamador com
// width*height floats). Retorna 0 em sucesso, != 0 em erro de leitura.
int thermal_sensor_read_frame(thermal_frame_t *out_frame);
