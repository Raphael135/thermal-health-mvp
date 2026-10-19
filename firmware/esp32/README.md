# Firmware — ESP32-S3 + sensor térmico MLX90640

Projeto ESP-IDF para o dispositivo de captura: lê um quadro térmico de 32×24 pixels
(768 temperaturas em °C) do sensor **MLX90640 D55** e envia para a API.

## Status

| Parte | Situação |
|---|---|
| Leitura do MLX90640 (I2C, biblioteca oficial da Melexis) | Escrita e conferida em simulação no PC. **Ainda não compilada com o ESP-IDF nem testada no aparelho.** |
| Wi-Fi (station) e envio HTTPS para a API | Escritos, nunca rodados em hardware |
| BLE de pareamento (`ble_provisioning.c`) | Só o esqueleto, falta implementar o NimBLE |

## Pré-requisitos

- [ESP-IDF](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/get-started/) **5.2 ou mais novo**
  (usa o driver `i2c_master` novo). A imagem Docker `espressif/idf` serve.
- Placa com ESP32-S3 e um MLX90640 (breakout com 4 fios: VIN, GND, SDA, SCL).

## Ligação

| MLX90640 | ESP32-S3 |
|---|---|
| VIN | 3V3 |
| GND | GND |
| SDA | GPIO 8 (padrão, configurável) |
| SCL | GPIO 9 (padrão, configurável) |

- Pull-ups de **4,7 kΩ** de SDA e SCL para 3V3. A maioria dos breakouts já tem; confira
  o seu. O pull-up interno do ESP32 é fraco para 400 kHz.
- No ESP32-S3 **não existem os GPIO 22–25**, os 26–32 são da flash/PSRAM e os 33–37 também
  são usados pela PSRAM nos módulos N8R8/N16R8. O firmware recusa esses pinos e avisa no log
  em vez de reiniciar.
- Endereço I2C do sensor: `0x33`.

## Compilar e gravar

```bash
cd firmware/esp32
idf.py set-target esp32s3     # só na primeira vez (ou ao mudar de chip)
idf.py menuconfig             # menu "Thermal Health Device": pinos, taxa, emissividade...
idf.py build
idf.py -p <porta_serial> flash monitor
```

Antes de compilar, edite `main/device_config.h`:

- `DEVICE_HARDWARE_ID`: deve ser igual ao `hardwareId` cadastrado no painel admin.
- `DEVICE_SECRET_PLACEHOLDER`: segredo retornado ao cadastrar o dispositivo
  (`POST /admin/devices`). Em produção, gravar em NVS, nunca em código-fonte.
- `API_BASE_URL`: URL da API (`services/api`), com HTTPS em produção.

## Testando o sensor na bancada

Por padrão o firmware liga um **autoteste**: lê o sensor em loop e mostra no monitor serial
algo como

```
I (412) mlx90640_i2c: MLX90640 detectado em 0x33 (SDA=8, SCL=9, 400000 Hz).
I (980) thermal_sensor: MLX90640 pronto (taxa 2, emissividade 0.98).
I (2010) main: Quadro: mín 24.31 °C | máx 36.02 °C | média 28.77 °C
```

Isso não depende de BLE, Wi-Fi nem da API. Aponte o sensor para a mão e veja o máximo subir.
Para desenhar o mapa de calor no PC, ligue `THERMAL_SERIAL_DUMP` no menuconfig: cada quadro sai
como uma linha `FRAME,32,24,v0,v1,...,v767`. Desligue o autoteste (`THERMAL_SELFTEST_ON_BOOT`)
quando a captura pelo app estiver pronta.

Sem o sensor ligado, `THERMAL_SENSOR_SIMULATED` gera quadros falsos para testar o resto.

| Mensagem no log | Causa provável |
|---|---|
| `GPIO nn (SCL) não existe no ESP32-S3` | Pino inválido para esse chip; escolha outro no menuconfig |
| `Nenhum dispositivo respondeu no endereço 0x33` | Fiação, pull-ups ou endereço |
| `Falha ao ler/interpretar a calibração (código 3)` | Pixels quebrados demais ou leitura da EEPROM corrompida (fios longos/ruído) |
| `Não consegui montar um quadro completo` | Taxa baixa demais para o timeout, ou I2C instável |

## Sobre as medições

- O D55 enxerga 55° na horizontal e cerca de 35° na vertical. A área enquadrada é de
  aproximadamente **1,04 × a distância** de largura por **0,63 × a distância** de altura
  (a 20 cm: uns 21 × 13 cm).
- Emissividade padrão **0,98** (pele humana). A precisão típica do sensor é de ±1 °C: serve
  para comparar regiões entre si, não como termômetro clínico.
- Cada quadro junta duas leituras de "meio quadro" (modo xadrez), então leva cerca de 1 s a 2 Hz.
- Se a imagem sair espelhada ou de cabeça para baixo, é a orientação em que o sensor foi
  montado; corrija no suporte ou invertendo as linhas/colunas antes de enviar.

## Estrutura

- `components/mlx90640/`: biblioteca oficial da Melexis (sem alterações, Apache 2.0) e a ponte
  para o I2C do ESP-IDF. Ver o README do componente.
- `main/thermal_sensor.c`: lê o sensor e entrega 768 temperaturas; descarta o quadro inteiro se
  algum valor for impossível (NaN, abaixo de -40 °C ou acima de 300 °C).
- `main/Kconfig.projbuild`: opções do menuconfig.
- `main/api_client.c`: monta o JSON e faz o POST para `/device-captures` com os headers de
  autenticação do dispositivo.
- `main/wifi_manager.c`, `main/ble_provisioning.c`: Wi-Fi e BLE.

## O que falta para produção

1. Compilar com o ESP-IDF e validar no aparelho (nada disso rodou em hardware ainda).
2. Implementar o serviço GATT completo em `ble_provisioning.c` com NimBLE. Quando existir, a
   captura e o envio HTTPS **não** devem rodar dentro do callback do BLE (a task do BLE tem pilha
   pequena, e o HTTPS precisa de mais): faça o callback só avisar uma task própria de captura.
3. Gravar `DEVICE_HARDWARE_ID`/segredo em NVS durante a fabricação, não em `.h`.
4. Validar o certificado TLS com a CA correta em `api_client.c`.
5. Receber o `patientId` associado via BLE (hoje é um placeholder vazio em `main.c`).
6. `capturedAt` em `api_client.c` ainda é uma data fixa; usar a hora real (SNTP).
