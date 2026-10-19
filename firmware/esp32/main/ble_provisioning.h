#pragma once

#include <stdint.h>
#include "ble_protocol.h"

// Serviço BLE (NimBLE, o dispositivo é o "periférico"): o app descobre o aparelho, pareia,
// envia o Wi-Fi e o patientId, manda iniciar a captura e acompanha o status.
// Contraparte do DeviceService do app. Protocolo em docs/BLE_PROTOCOL.md.
//
// IMPORTANTE: os callbacks abaixo rodam na task do NimBLE. Não podem bloquear nem fazer
// trabalho pesado (Wi-Fi, HTTPS, gravar em flash, ler o sensor): só copiar os dados e
// avisar outra task, como faz o main.c.
typedef struct {
    void (*on_wifi_credentials)(const char *ssid, const char *password);
    void (*on_patient_id)(const char *patient_id);
    void (*on_start_capture)(void);
} ble_provisioning_callbacks_t;

// Sobe a pilha BLE e começa a anunciar (advertising) com o nome DEVICE_HARDWARE_ID.
// Retorna 0 em sucesso, != 0 se a pilha não iniciou (o motivo vai para o log).
int ble_provisioning_init(const ble_provisioning_callbacks_t *callbacks);

// Atualiza o status lido pelo app (e notifica quem estiver inscrito). Pode ser chamada de
// qualquer task. `flags` combina BLE_FLAG_*.
void ble_provisioning_update_status(ble_device_state_t state, uint8_t flags, ble_device_error_t error);
