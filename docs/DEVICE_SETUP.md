# Captura real: do aparelho ao painel da médica

Roteiro para receber uma captura de verdade do ESP32-S3 com o MLX90640.

**Estado:** o servidor, o app e o firmware foram escritos e conferidos no PC, cada um contra o outro
(o servidor aceita exatamente o que o firmware envia; o app gera os mesmos bytes que o firmware lê).
**Ninguém rodou isto com o aparelho ligado.** Os pontos com mais chance de precisar de ajuste na
primeira vez estão marcados com ⚠.

## O que cada peça precisa

| Peça | Precisa |
|---|---|
| Servidor | Rodando e alcançável pelo **Wi-Fi do aparelho** (não pelo do seu PC). Para teste, o túnel `https://….trycloudflare.com` serve. |
| Painel admin | O aparelho cadastrado e vinculado à paciente. |
| Firmware | ID, segredo e URL configurados; compilado com o ESP-IDF 5.2+. |
| App | O APK do perfil **device** (Bluetooth real). O Expo Go não serve: não tem BLE nativo. |
| Celular | Android com Bluetooth. O iPhone não está contemplado. |

## 1. Cadastrar o aparelho no servidor

No painel admin (`http://localhost:5173`, login de admin):

1. **Dispositivos** → ID do hardware (ex.: `ESP32-001`) → Cadastrar.
2. **Copie o segredo que aparece.** Ele só é mostrado nesta hora.
3. Vincule o aparelho à paciente: cole o **ID do perfil** dela no campo do aparelho (e tire o foco do
   campo para salvar). O ID aparece em **Usuários**, abaixo do e-mail da paciente (é o `PatientProfile.id`,
   não o ID do usuário).

O servidor só aceita a captura se o aparelho estiver vinculado **à mesma paciente** que o app informar.
Sem o vínculo a resposta é 403; com segredo errado, 401.

## 2. Configurar e gravar o firmware

```bash
cd firmware/esp32
idf.py set-target esp32s3
idf.py menuconfig        # Thermal Health Device
idf.py build flash monitor -p <porta>
```

No menu **Thermal Health Device**:

- **ID do aparelho**: o mesmo do passo 1 (também é o nome que o app mostra).
- **Segredo do aparelho**: o do passo 1.
- **URL da API**: o endereço do túnel, sem barra no final.
- Pinos do I2C, se a sua placa não usar SDA = 8 / SCL = 9 (veja o README do firmware).

O segredo fica no `sdkconfig` local (fora do Git). Antes de ligar o BLE, confira o sensor: o
autoteste mostra no monitor serial `Quadro: mín … máx … média …`.

> Com `THERMAL_SELFTEST_ON_BOOT` ligado (o padrão) o aparelho lê o sensor em loop o tempo todo. A
> captura pelo app funciona (as leituras se alternam com uma trava), mas gasta energia e enche o log:
> desligue no menuconfig depois da bancada.

## 3. Gerar o APK com Bluetooth

```bash
cd apps/mobile
npx eas-cli build --platform android --profile device
```

Antes, em `apps/mobile/eas.json`, troque `EXPO_PUBLIC_API_URL` do perfil `device` pelo endereço do
túnel (ou deixe como está e use **Servidor (teste)** dentro do app). Instale o APK no celular.

O perfil `preview` (testadores sem aparelho) continua com os dispositivos **simulados**.

## 4. Capturar

No app, logada como a paciente do passo 1:

1. **Dispositivos conectados** → aceite as permissões de Bluetooth → toque no aparelho.
2. **Conectar via BLE.** ⚠ O Android pode mostrar uma janela de pareamento (senha de 6 dígitos se o
   firmware foi compilado com `THERMAL_BLE_PASSKEY`). O app tenta por até 40 s.
3. Informe o **Wi-Fi** do aparelho (2,4 GHz, com internet) → **Enviar Wi-Fi**. O app espera o aparelho
   conectar (até 25 s) e mostra "Wi-Fi conectado".
4. **Iniciar captura.** A tela de status acompanha: capturando → enviando → enviada.
5. No painel da médica: o exame aparece como **Processado** e a imagem abre em **Ver imagem térmica**.

## Se algo falhar

| Sintoma | Onde olhar |
|---|---|
| O app não acha o aparelho | O aparelho está ligado? O monitor serial mostra `Anunciando como "ESP32-001"`? Permissão de Bluetooth liberada? Teste antes com o app genérico **nRF Connect**. |
| "Pareamento não concluído" | ⚠ Esqueça o aparelho nas configurações de Bluetooth do celular e tente de novo. |
| "Não conseguiu conectar ao Wi-Fi" | SSID/senha errados, ou rede de 5 GHz. |
| Erro "enviar para o servidor" | No monitor serial, a mensagem diz o motivo: 401 (ID/segredo), 403 (aparelho não vinculado a esta paciente), falha de conexão (URL, internet, certificado). |
| Falha de TLS | ⚠ O túnel precisa estar de pé e a URL ser `https://`. Se o monitor falar de certificado, o relógio e o pacote de certificados são os suspeitos. |
| Captura aceita, exame parado em "Recebido" | O worker do servidor não está rodando (`docker compose ps`). |

## Limites desta versão

- A captura da paciente fica **sem horário do aparelho** se a rede bloquear NTP (o servidor usa o
  horário de recebimento).
- O pareamento por padrão não autentica o celular (qualquer um ao alcance pode parear). Defina
  `THERMAL_BLE_PASSKEY` antes de qualquer uso fora da bancada.
- O segredo do aparelho fica dentro do firmware gravado.
- Um aparelho atende uma paciente: para trocar de paciente, mude o vínculo no painel admin e envie o
  novo `patientId` pelo app.
