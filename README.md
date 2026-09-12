# Thermal Health — MVP

Aplicativo de saúde feminina conectado a um dispositivo ESP32 com sensor térmico.
Ver arquitetura completa em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), decisões de
design em [`docs/DECISIONS.md`](docs/DECISIONS.md) e itens fora do escopo em
[`docs/FUTURE.md`](docs/FUTURE.md).

## Estrutura

```
apps/mobile        App da paciente (Expo/React Native/TypeScript)
apps/web           Painel médico/admin (React/Vite/TypeScript/Tailwind)
services/api       Backend principal (NestJS/Prisma/PostgreSQL)
services/thermal-processor  Processamento de imagem térmica (Python/FastAPI)
services/device-simulator   Simula um ESP32 enviando capturas (Node/TS)
firmware/esp32     Firmware real do dispositivo (ESP-IDF/C)
infra/             Docker Compose, Nginx
docs/              Arquitetura, decisões, roadmap futuro
```

## Rodando tudo localmente (backend + infra)

1. Copie o `.env.example` para `.env` na raiz:

```bash
cp .env.example .env
```

2. Suba a infraestrutura + backend + processador:

```bash
docker compose up --build
```

Isso sobe: PostgreSQL (5432), Redis (6379), MinIO (9000/console 9001), o serviço
Python de processamento térmico (8000), a API NestJS (3000) e um Nginx (8080)
na frente da API.

3. Rode as migrations e o seed (cria um usuário ADMIN) — em outro terminal:

```bash
cd services/api
npm install
npx prisma migrate dev --name init
npm run seed
```

Admin criado pelo seed: `admin@thermal-health.local` / `Admin@12345` (troque em produção).

4. Suba o worker de processamento (processo separado da API HTTP):

```bash
cd services/api
npm run worker:dev
```

## Testando o fluxo ponta a ponta (sem hardware)

1. **Cadastrar paciente e médico** (via `curl` ou pelo app/painel):

```bash
curl -X POST http://localhost:3000/auth/register/patient \
  -H "Content-Type: application/json" \
  -d '{"email":"paciente@teste.com","password":"Senha@123","fullName":"Paciente Teste"}'

curl -X POST http://localhost:3000/auth/register/doctor \
  -H "Content-Type: application/json" \
  -d '{"email":"medica@teste.com","password":"Senha@123","fullName":"Dra. Teste","crm":"12345-SP"}'
```

2. **Login como admin**, criar um dispositivo e vinculá-lo à paciente, e criar o
   vínculo médico-paciente (use o painel web em `http://localhost:5173` — mais fácil —
   ou os endpoints `/admin/devices` e `/admin/doctor-patient-links` diretamente).

3. **Simular uma captura do dispositivo:**

```bash
cd services/device-simulator
npm install
API_URL=http://localhost:3000 \
DEVICE_ID=ESP32-001 \
DEVICE_SECRET=<segredo retornado ao cadastrar o dispositivo> \
PATIENT_ID=<uuid do PatientProfile> \
npm run simulate
```

4. Acompanhe o worker processando o job (log no terminal do `worker:dev`), depois
   entre no painel web como a médica vinculada e veja o exame em "Minhas pacientes"
   → clique na paciente → "Ver imagem térmica".

5. Confira que a paciente **não** consegue ver a imagem: logue no app mobile (ou
   `GET /examinations/:id` com o token da paciente) e note que a resposta não inclui
   nenhum campo de imagem, matriz ou temperatura.

6. Confira o log de auditoria: `GET /audit-logs` (como ADMIN) deve ter um registro
   `THERMAL_IMAGE_VIEW` para o acesso do passo 4.

## Painel web

```bash
cd apps/web
npm install
cp .env.example .env
npm run dev
```

Abre em `http://localhost:5173`.

## App mobile

Hoje o app não usa nenhuma lib nativa de verdade (o BLE é só simulado em JS —
ver `docs/FUTURE.md`), então dá pra rodar de três jeitos:

**No celular físico, com Expo Go:**

```bash
cd apps/mobile
npm install
npx expo start
```

Instale o app "Expo Go" na loja do seu celular, escaneie o QR code do terminal.
Celular e PC precisam estar na mesma rede Wi-Fi. Se o app não conseguir falar
com a API, troque `EXPO_PUBLIC_API_URL` (num `.env` em `apps/mobile/`) de
`localhost` para o IP da sua máquina na rede local (ex.: `192.168.0.15`).

**Num emulador Android/iOS:** `npm run android` ou `npm run ios` (requer
Android Studio / Xcode instalados).

**Em modo web, para extensões tipo MobileView (VS Code) ou o próprio navegador:**

```bash
cd apps/mobile
npm install
cp .env.example .env   # EXPO_PUBLIC_API_URL=http://localhost:3000 já funciona aqui
npm run web
```

Abre em `http://localhost:8081` — aponte a extensão de preview mobile pra essa URL.
Importante: como isso roda dentro de um navegador de verdade, a API precisa liberar
essa origem em `CORS_ORIGIN` (o `.env.example` da raiz já inclui `:8081` e `:19006`
por padrão — se mudar a porta, adicione-a lá também e reinicie a API).

## Firmware ESP32

Ver [`firmware/esp32/README.md`](firmware/esp32/README.md).

## Critérios de aceite do MVP

- [x] Paciente cria conta e faz login (`POST /auth/register/patient`, `/auth/login`).
- [x] Médico cria conta e faz login (`POST /auth/register/doctor`).
- [x] Admin cria vínculos médico-paciente (`POST /admin/doctor-patient-links`).
- [x] Dispositivo (simulador) envia uma captura (`POST /device-captures`).
- [x] Backend cria um exame (`ExaminationsService.createFromDeviceCapture`).
- [x] Worker processa os dados térmicos (`src/workers/thermal-processing.worker.ts`).
- [x] Imagem térmica é salva em storage privado (MinIO, bucket sem acesso anônimo).
- [x] Médico autorizado visualiza a imagem via URL assinada de curta duração.
- [x] Paciente vê o exame no histórico sem acessar a imagem (campos filtrados no backend).
- [x] Toda visualização de imagem gera log de auditoria (`AuditLogService`).
- [x] Usuários não autorizados são bloqueados (guards de role + vínculo em todas as rotas sensíveis).
- [x] Projeto roda localmente via Docker Compose (backend + infra).
