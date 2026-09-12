#pragma once

#include "thermal_sensor.h"

// Envia uma captura térmica para POST /device-captures na API principal,
// autenticando com x-device-id / x-device-secret (mesmo contrato usado pelo
// simulador em services/device-simulator).
int api_client_send_capture(const thermal_frame_t *frame, const char *patient_id);
