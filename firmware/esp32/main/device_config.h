#pragma once

#include "sdkconfig.h"

// Identificação, segredo e endereço da API vêm do menuconfig ("Thermal Health Device"), que grava
// no sdkconfig local (fora do Git). Nada disso deve ser escrito neste arquivo.
// Em produção o ideal é gravar o segredo na NVS criptografada durante a fabricação.
#define DEVICE_HARDWARE_ID CONFIG_THERMAL_DEVICE_ID
#define DEVICE_SECRET CONFIG_THERMAL_DEVICE_SECRET
#define API_BASE_URL CONFIG_THERMAL_API_URL

// Dimensões do frame térmico: fixas pelo MLX90640 (32 colunas x 24 linhas = 768 pixels).
// A API e o thermal-processor esperam exatamente esse formato.
#define THERMAL_FRAME_WIDTH 32
#define THERMAL_FRAME_HEIGHT 24
