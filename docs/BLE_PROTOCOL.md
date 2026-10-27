# Protocolo BLE: app ↔ dispositivo

O dispositivo (ESP32 ou ESP32-S3) é o **periférico**: anuncia, o app (central) conecta. Implementação no
firmware: `firmware/esp32/main/ble_provisioning.c` (NimBLE) e `ble_protocol.c` (formatos).
O app usa isto em `apps/mobile/src/services/BleDeviceService.ts` (bytes em `services/ble/protocol.ts`), mas
**só foi testado contra o parser do firmware no PC**, nunca com um celular e o aparelho de verdade.

## Descoberta

- Nome anunciado: o `DEVICE_HARDWARE_ID` do aparelho (ex.: `ESP32-001`), o mesmo cadastrado no
  painel admin. O nome vai na *scan response*.
- O pacote principal anuncia o UUID do serviço: filtre o scan por ele.

## Serviço e características

Base: `7e5f00NN-1c3a-4b8e-9d2a-6f3b8c1e0a00`.

| UUID | Nome | Acesso | Conteúdo |
|---|---|---|---|
| `7e5f0001-…` | Serviço | | |
| `7e5f0002-…` | Wi-Fi | escrita | credenciais do Wi-Fi |
| `7e5f0003-…` | Paciente | escrita | `patientId` (UUID) |
| `7e5f0004-…` | Comando | escrita | 1 byte |
| `7e5f0005-…` | Status | leitura + notificação | 3 bytes |

Todas exigem **link criptografado**. O app deve parear antes (o sistema operacional faz isso
sozinho na primeira escrita) e, se o firmware foi compilado com `THERMAL_BLE_PASSKEY`, pedir a
senha de 6 dígitos ao usuário.

## Formatos

**Wi-Fi** (escrita): `[tam_ssid:1][ssid][tam_senha:1][senha]`

- SSID de 1 a 32 bytes. Senha de 8 a 63 bytes, ou tamanho 0 para rede aberta.
- Os tamanhos explícitos permitem qualquer caractere, inclusive `|`. Não pode haver bytes
  sobrando nem `0x00` dentro dos textos.
- Exemplo: SSID `Casa`, senha `12345678` →
  `04 43 61 73 61 08 31 32 33 34 35 36 37 38`.
- Não suporta senha WPA de 64 dígitos hexadecimais (formato PSK), só texto de 8 a 63 caracteres.

**Paciente** (escrita): os 36 caracteres ASCII do UUID, com hífens
(ex.: `b289be86-af1f-4ebf-84aa-e118b099bc14`). É o `PatientProfile.id` da paciente a quem o
aparelho foi vinculado no painel admin. O firmware guarda na memória e lembra após reiniciar.

**Comando** (escrita): 1 byte. `0x01` = iniciar captura.

**Status** (leitura e notificação): `[estado:1][flags:1][erro:1]`

| estado | significado | `CaptureStatus` do app |
|---|---|---|
| 0 | parado | `idle` |
| 1 | conectando ao Wi-Fi | `connecting_wifi` |
| 2 | capturando | `capturing` |
| 3 | enviando para a API | `uploading` |
| 4 | captura enviada | `done` |
| 5 | erro (ver byte de erro) | `error` |

flags: bit 0 = Wi-Fi conectado, bit 1 = paciente associada.

| erro | significado |
|---|---|
| 0 | nenhum |
| 1 | captura pedida sem Wi-Fi |
| 2 | captura pedida sem `patientId` |
| 3 | falha ao ler o sensor |
| 4 | falha ao enviar para a API |
| 5 | ocupado (já há uma captura em andamento) |
| 6 | não conectou ao Wi-Fi com esse SSID/senha |
| 7 | erro interno |

## Fluxo

1. Scan → conectar → (parear) → inscrever-se nas notificações do Status.
2. Escrever **Paciente** e **Wi-Fi**. Podem ir um logo após o outro: o firmware enfileira.
   A conexão ao Wi-Fi leva até ~15 s (estado 1; depois volta a 0 com a flag de Wi-Fi, ou vai a 5
   com erro 6).
3. Escrever **Comando** `0x01`. Estados 2 → 3 → 4 (ou 5 com o motivo).
4. O exame aparece no histórico da paciente (`GET /examinations/me`) e o médico vê a imagem no painel.

## Observações para o app

- Peça MTU maior (o firmware aceita até 247) no Android; o quadro de Wi-Fi tem até 97 bytes. Com o
  MTU padrão o BLE ainda funciona (escrita longa), mas é mais lento.
- Uma recusa de escrita chega como erro ATT: tamanho inválido (`0x0D`) ou conteúdo inválido (`0x13`).
- Um segundo pedido de captura durante uma captura é ignorado e o status mostra erro 5.
- O firmware mostra só o SSID no log serial, nunca a senha.

## Limites de segurança (leia antes de produção)

- Sem `THERMAL_BLE_PASSKEY` o pareamento é *Just Works*: o link é criptografado, mas qualquer
  celular ao alcance pode parear e enviar o Wi-Fi da casa. Com a senha de 6 dígitos (impressa na
  etiqueta) o app precisa digitá-la.
- Uma senha igual para todos os aparelhos é fraca. O ideal é uma senha por aparelho, gerada na
  fabricação e gravada na NVS.
- Se o Wi-Fi mudar, é preciso enviar as credenciais de novo.
