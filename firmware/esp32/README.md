# Firmware — ESP32-S3 + sensor térmico MLX90640

Projeto ESP-IDF para o dispositivo de captura: lê um quadro térmico de 32×24 pixels
(768 temperaturas em °C) do sensor **MLX90640 D55** e envia para a API.

## Status

| Parte | Situação |
|---|---|
| Leitura do MLX90640 (I2C, biblioteca oficial da Melexis) | Escrita e conferida em simulação no PC. **Ainda não compilada com o ESP-IDF nem testada no aparelho.** |
| Wi-Fi (station) e envio HTTPS para a API | Escritos, nunca rodados em hardware |
| App mobile usando este BLE (`BleDeviceService`) | Escrito, compila e o formato dos bytes foi conferido contra o parser do firmware. **Nunca testado num celular com o aparelho.** |
| BLE (`ble_provisioning.c`, NimBLE): pareamento, Wi-Fi, `patientId`, comando e status | Escrito e com o formato dos dados testado no PC. **Nunca compilado com o ESP-IDF nem testado com um celular.** Protocolo em `docs/BLE_PROTOCOL.md` |

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

Em `idf.py menuconfig`, menu **Thermal Health Device**:

- **ID do aparelho**: igual ao `hardwareId` cadastrado no painel admin (também é o nome BLE).
- **Segredo do aparelho**: mostrado UMA vez ao cadastrar o aparelho (`POST /admin/devices`). Fica no
  `sdkconfig` local, que o `.gitignore` não deixa ir para o repositório. Nunca o coloque em arquivo versionado.
- **URL da API**, sem barra no final (ex.: o endereço do túnel). Com `https://` o certificado é
  verificado; com `http://` nada é criptografado nem verificado.
- **Servidor de hora**: se a rede bloquear NTP, a captura segue sem hora e o servidor usa a hora em que a recebe.

Passo a passo completo, do painel admin até a captura: [`docs/DEVICE_SETUP.md`](../../docs/DEVICE_SETUP.md).

## Pareamento BLE

O aparelho anuncia com o nome `DEVICE_HARDWARE_ID` (ex.: `ESP32-001`). O app pareia, escreve o
`patientId` e o Wi-Fi, manda o comando de captura e acompanha o status por notificação. Tudo
descrito em [`docs/BLE_PROTOCOL.md`](../../docs/BLE_PROTOCOL.md), com os UUIDs e os formatos.

Para testar **sem o app**, use um aplicativo genérico de BLE no celular (ex.: nRF Connect): conecte,
pareie, escreva nas características e veja o status mudar. O formato dos bytes está no documento.

- Por padrão o pareamento é *Just Works* (criptografado, mas sem autenticar o celular). Para exigir
  uma senha de 6 dígitos, defina `THERMAL_BLE_PASSKEY` no menuconfig.
- O Wi-Fi e o envio para a API rodam numa task própria (`worker`), nunca na task do BLE.
- O `patientId` recebido é guardado na NVS e sobrevive a reinício.

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
- `main/ble_provisioning.c`: serviço GATT (NimBLE). `main/ble_protocol.c`: formatos dos dados, sem
  dependência do NimBLE.
- `main/main.c`: task de trabalho que recebe os pedidos do BLE por fila (Wi-Fi, `patientId`, captura).
- `main/api_client.c`: monta o JSON e faz o POST para `/device-captures` com os headers de
  autenticação do dispositivo.
- `main/wifi_manager.c`: Wi-Fi.

## O que falta para produção

1. Compilar com o ESP-IDF e validar no aparelho (nada disso rodou em hardware ainda).
2. Testar o BLE com um celular de verdade (nRF Connect primeiro, depois o app) e ajustar o que o
   ESP-IDF real apontar. Só existe teste do formato dos dados.
3. Testar o app (`BleDeviceService`) com o aparelho: é a parte com mais chance de precisar de ajuste
   (pareamento no Android, MTU, tempos).
4. Senha de pareamento própria de cada aparelho (hoje é uma só, ou nenhuma).
5. Gravar o ID e o segredo do aparelho na NVS (criptografada) durante a fabricação; hoje ficam no `sdkconfig`, dentro do binário gravado.
6. Validar o certificado TLS com a CA correta em `api_client.c`.
7. Conferir o SNTP e a verificação do certificado HTTPS no aparelho (escritos, só testados no PC).
8. As credenciais do Wi-Fi ficam na flash pelo padrão do ESP-IDF (sem criptografia): ligar a
   criptografia da flash/NVS antes de produção.
