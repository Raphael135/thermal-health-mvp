# Firmware ESP32 — Thermal Health (estrutura inicial)

Projeto ESP-IDF. Estrutura pronta para compilar assim que o ESP-IDF estiver instalado;
o sensor térmico real e a implementação NimBLE completa ainda precisam ser preenchidos
(ver TODOs em `main/ble_provisioning.c` e `main/thermal_sensor.c`).

## Pré-requisitos

- [ESP-IDF](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/get-started/) v5.x instalado e `idf.py` no PATH.

## Configuração

Antes de compilar, edite `main/device_config.h`:

- `DEVICE_HARDWARE_ID`: deve ser igual ao `hardwareId` cadastrado no painel admin.
- `DEVICE_SECRET_PLACEHOLDER`: segredo retornado ao cadastrar o dispositivo
  (endpoint `POST /admin/devices`). Em produção, gravar em NVS, nunca em código-fonte.
- `API_BASE_URL`: URL da API (`services/api`), com HTTPS em produção.

## Build

```
idf.py set-target esp32
idf.py build
idf.py -p <porta_serial> flash monitor
```

## O que já está pronto

- Estrutura de arquivos e responsabilidades (sensor, Wi-Fi, BLE, cliente HTTP).
- `wifi_manager.c`: conexão Wi-Fi em modo station, com retry, usando a API padrão do ESP-IDF.
- `api_client.c`: monta o payload JSON e faz o POST para `/device-captures` com os
  headers de autenticação do dispositivo.
- `thermal_sensor.c`: implementação **simulada** do sensor (gera dados plausíveis),
  atrás da interface `thermal_sensor_read_frame()` — trocar por um driver real depois.
- `ble_provisioning.c`: contrato e estrutura do serviço GATT de provisionamento,
  com TODOs claros nos pontos que dependem da API do NimBLE.

## O que falta para produção

1. Implementar o serviço GATT completo em `ble_provisioning.c` com NimBLE.
2. Trocar `thermal_sensor.c` pelo driver do sensor real escolhido (I2C/SPI).
3. Gravar `DEVICE_HARDWARE_ID`/segredo em NVS durante a fabricação, não em `.h`.
4. Configurar validação de certificado TLS apontando para a CA correta em `api_client.c`.
5. Receber o `patientId` associado via BLE (hoje é um placeholder vazio em `main.c`).
