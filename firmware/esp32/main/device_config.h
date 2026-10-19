#pragma once

// Identificação única do dispositivo — deve bater com o `hardwareId` cadastrado
// no painel admin (DevicesModule, services/api). Em produção, gravar isso na
// NVS durante a fabricação em vez de hardcoded.
#define DEVICE_HARDWARE_ID "ESP32-001"

// Segredo do dispositivo, retornado UMA VEZ pelo endpoint POST /admin/devices.
// Em produção: armazenar em NVS criptografada, nunca em código-fonte versionado.
#define DEVICE_SECRET_PLACEHOLDER "SUBSTITUA_PELO_SEGREDO_GERADO_NO_PAINEL_ADMIN"

// Endpoint da API principal (services/api). Usar HTTPS em produção.
#define API_BASE_URL "https://api.thermal-health.local"

// Dimensões do frame térmico: fixas pelo MLX90640 (32 colunas x 24 linhas = 768 pixels).
// A API e o thermal-processor esperam exatamente esse formato.
#define THERMAL_FRAME_WIDTH 32
#define THERMAL_FRAME_HEIGHT 24
