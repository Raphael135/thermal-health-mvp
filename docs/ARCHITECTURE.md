# Arquitetura — MVP Saúde Feminina + Termografia (ESP32)

## 1. Visão geral

Sistema composto por 5 aplicações independentes que se comunicam por HTTP/HTTPS e uma fila
de mensagens. Nenhuma imagem térmica é salva no banco relacional — apenas metadados e a
chave do objeto no storage (S3/R2/MinIO). O acesso à imagem é sempre mediado pela API
principal, que decide quem pode ver o quê.

```
                                   ┌─────────────────────┐
                                   │   apps/mobile        │  Paciente
                                   │  (Expo/React Native) │  (BLE simulado no MVP)
                                   └──────────┬───────────┘
                                              │ HTTPS (REST)
                                              ▼
┌───────────────┐   HTTPS/BLE-sim   ┌─────────────────────┐   URLs assinadas   ┌──────────────┐
│ firmware/esp32 │ ────────────────▶│   services/api        │◀──────────────────│  apps/web     │
│ (ESP-IDF, sim) │                  │   (NestJS + Prisma)   │                    │ (React/Vite)  │
└───────────────┘                  └──────────┬────────────┘                    │ Médico/Admin  │
                                              │                                  └──────────────┘
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
            ┌───────────────┐        ┌─────────────────┐        ┌──────────────┐
            │  PostgreSQL   │        │  Redis + BullMQ  │        │  MinIO/S3/R2 │
            │  (metadados)  │        │  (fila de jobs)  │        │  (imagens)   │
            └───────────────┘        └────────┬─────────┘        └──────────────┘
                                              │ job "process-thermal-capture"
                                              ▼
                                   ┌─────────────────────┐
                                   │ services/thermal-    │
                                   │ processor (FastAPI)  │
                                   │ NumPy/OpenCV/Pillow   │
                                   └─────────────────────┘
```

## 2. Componentes

| Componente | Stack | Responsabilidade |
|---|---|---|
| `services/api` | NestJS + Prisma + PostgreSQL | Única fonte de verdade para autenticação, autorização, regras de negócio e controle de acesso a imagens (URLs assinadas). |
| `services/thermal-processor` | Python + FastAPI + NumPy/OpenCV/Pillow | Recebe matriz térmica bruta, gera heatmap PNG, calcula min/max/média. **Não** faz diagnóstico. |
| `services/device-simulator` | Node.js/TypeScript | Simula um ESP32 enviando capturas térmicas para a API, para testes sem hardware. |
| `apps/web` | React + Vite + Tailwind + shadcn/ui | Painel médico (vê imagens de pacientes vinculadas) e painel admin (gerencia cadastros, não vê imagens). |
| `apps/mobile` | Expo (React Native) + TypeScript | App da paciente: login, sintomas, histórico de exames (sem imagem), pareamento BLE (simulado). |
| `firmware/esp32` | ESP-IDF (C/C++) | Firmware real do dispositivo: BLE para provisionamento Wi-Fi, HTTPS para envio de dados térmicos. |
| `infra/docker` | Docker Compose | Orquestra Postgres, Redis, MinIO, API, thermal-processor, Nginx para desenvolvimento local. |

## 3. Fluxo de um exame (ponta a ponta)

1. Paciente inicia captura pelo app (ou dispositivo físico é acionado diretamente).
2. Dispositivo (real ou simulador) autentica com `deviceId` + `deviceSecret` e envia
   `POST /devices/:id/captures` com a matriz térmica bruta (JSON) para a API.
3. API valida dispositivo, valida paciente vinculada ao dispositivo, cria `Examination`
   (status `RECEIVED`) e `ThermalCapture` com os dados brutos, e enfileira um job
   `process-thermal-capture` no BullMQ (Redis).
4. Um worker (dentro do próprio `services/api`, processo separado) consome o job, chama
   `services/thermal-processor` via HTTP passando a matriz.
5. `thermal-processor` gera o heatmap (PNG) e retorna metadados (min/max/média, dimensões).
6. Worker salva o PNG no storage (MinIO/S3/R2) sob uma chave privada, grava a chave e os
   metadados no Postgres, atualiza `Examination.status` para `PROCESSED` (ou `FAILED`).
7. Médico vinculado acessa o painel web, solicita visualização → API gera uma URL assinada
   de curta duração para o objeto no storage e grava um `AuditLog` de acesso.
8. Paciente vê no app apenas: data, status, médico responsável, observação médica liberada —
   nunca a imagem, nunca a matriz bruta.

## 4. Modelo de controle de acesso (resumo)

- **PATIENT**: CRUD dos próprios dados/sintomas; leitura do próprio histórico (sem imagem/matriz).
- **DOCTOR**: leitura de pacientes com vínculo ativo (`DoctorPatientLink.status = ACTIVE`);
  leitura de imagens dessas pacientes; escrita de `MedicalObservation`.
- **ADMIN**: CRUD de usuários, dispositivos, vínculos; leitura de `AuditLog`; **sem** acesso
  a imagens térmicas por padrão (endpoint de imagem sempre exige role DOCTOR + vínculo, ou
  uma futura permissão explícita de auditoria técnica sem visualização de imagem).
- **TECHNICIAN**: suporte a dispositivos (troubleshooting), sem acesso a dados clínicos.

Todo acesso de leitura a `Examination`, `ThermalCapture`/imagem gera uma linha em `AuditLog`
com `userId`, `action`, `resourceType`, `resourceId`, `timestamp`, `ip`, `metadata`.

## 5. Armazenamento

- PostgreSQL guarda: usuários, perfis, vínculos, exames (metadados), matriz bruta (JSON —
  opcionalmente movida para storage também, ver `docs/DECISIONS.md`), observações, sintomas,
  logs de auditoria, consentimentos.
- MinIO/S3/R2 guarda: apenas arquivos binários (PNG do heatmap). Chave do objeto
  (`storageKey`) e bucket ficam no Postgres; o conteúdo nunca.
- Acesso a arquivos é sempre via URL assinada com expiração curta (ex.: 5 minutos), gerada
  sob demanda pela API após checar autorização.

## 6. Fora de escopo neste MVP

IA/diagnóstico automático, chat com paciente, comunidade/fórum, pagamentos, integração com
prontuário externo — ver `docs/FUTURE.md`.
