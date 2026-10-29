# Thermal Health — contexto para o Claude

App de saúde feminina ligado a um aparelho (ESP32 + sensor térmico MLX90640). O aparelho captura uma
matriz de temperaturas; o servidor gera o mapa de calor; **só o médico vê a imagem**.
Idioma de trabalho: **português**. Dados de saúde: tratar como sensíveis (LGPD).

## Regras de produto (não quebrar sem o dono pedir)
- A **paciente não vê nem baixa a imagem térmica** (só status do exame e observação liberada).
- O **admin não vê imagens**. Médico só vê pacientes com vínculo ativo. Toda visualização de imagem gera `AuditLog`.
- O ESP32 **só envia números** (768 temperaturas). A imagem nasce no servidor (`thermal-processor`).
- Sem IA, diagnóstico ou classificação de risco nesta fase (ver `docs/FUTURE.md`).
- A API é a única que decide acesso a imagens (URL assinada de 5 min, bucket privado).

## Mapa do repositório
| Pasta | O que é |
|---|---|
| `services/api` | NestJS + Prisma + Postgres. Auth JWT (Argon2), roles, vínculo médico-paciente (`common/access-control.service.ts`), fila BullMQ, worker em `src/workers/` |
| `services/thermal-processor` | FastAPI + NumPy/OpenCV: matriz → PNG + mín/máx/média. Sem diagnóstico |
| `services/device-simulator` | Simula um ESP32 enviando captura |
| `apps/web` | Painel médico/admin (React + Vite + Tailwind) |
| `apps/mobile` | App da paciente (Expo/React Native). BLE real em `src/services/BleDeviceService.ts` |
| `firmware/esp32` | ESP-IDF 5.2+: sensor, BLE (NimBLE), Wi-Fi, envio HTTPS. ESP32 comum **e** ESP32-S3 |
| `docs/` | `ARCHITECTURE`, `DECISIONS`, `FUTURE`, `DEMO` (rodada de testes), `DEVICE_SETUP` (captura real), `BLE_PROTOCOL` |

Leia `docs/DECISIONS.md` antes de mexer em segurança e `docs/BLE_PROTOCOL.md` antes de mexer em BLE
(app e firmware precisam concordar nos bytes; `apps/mobile/src/services/ble/protocol.ts` ↔ `firmware/esp32/main/ble_protocol.c`).

## Como rodar localmente
```bash
cp .env.example .env            # e também apps/web/.env.example e apps/mobile/.env.example
docker compose up -d --build    # postgres, redis, minio, api, worker, thermal-processor, nginx
docker compose exec api npm run seed     # cria admin@thermal-health.local
cd apps/web && npm install && npm run dev        # painel em :5173
cd apps/mobile && npm install && npm run web     # app no navegador em :8081
```
Portas (só em 127.0.0.1): API 3000, Postgres **5433**, nginx **8088**, MinIO 9000/9001, processor 8000.
(5432/8080 são de outros projetos desta máquina.) O worker **é** um serviço do compose; sem ele os exames ficam em `RECEIVED`.

## Flags de ambiente que importam (em `.env`, nunca versionado)
- `ALLOW_DEV_LOGIN` — login sem senha. **Nunca `true` com a API exposta.** (também há `EXPO_PUBLIC_ALLOW_DEV_LOGIN`, `VITE_ALLOW_DEV_LOGIN`)
- `ALLOW_DEMO_CAPTURE` — liga `POST /examinations/demo` (captura falsa, 10 por paciente) + botão "Simular captura" no app.
- `TRUST_PROXY=1` — atrás de túnel/proxy. `SEED_ADMIN_PASSWORD` — **obrigatório fora do PC local** (a senha padrão está no repositório, que é **público**).
- `MINIO_PUBLIC_URL` — host que o navegador usa para abrir as URLs assinadas.
- App: `EXPO_PUBLIC_TEST_MODE`, `EXPO_PUBLIC_DEVICE_MODE=ble|simulated`. Perfis EAS em `apps/mobile/eas.json`: `preview` (testadores, simulado) e `device` (BLE real).

## Estado atual (honesto)
**Funciona e foi testado de ponta a ponta no PC:** cadastro/login, vínculo médico-paciente (paciente pede, médico aceita no painel),
captura simulada → fila → worker → processor → MinIO → imagem no painel, auditoria, bloqueio de acesso, limite de tentativas no login,
app em modo web, túnel Cloudflare para teste em celular (`docs/DEMO.md`).

**Escrito e só conferido no PC (nunca rodou em hardware):**
- Firmware: leitura do MLX90640, BLE NimBLE, SNTP, HTTPS verificado. **Nunca compilado com o ESP-IDF real**; o BLE foi checado contra cabeçalhos aproximados feitos à mão.
- App: `BleDeviceService` (react-native-ble-plx). Os bytes que ele gera foram aceitos pelo parser C do firmware; nunca falou com um aparelho.
- A placa do projeto é provavelmente um **ESP32 comum** (houve confusão com S3): confirmar lendo a tampa do módulo.

**Pendente / ideias:** APK `device` com Bluetooth (`eas build --profile device`); testar firmware na bancada; LGPD (consentimento não é gravado em
nenhum fluxo; sem exclusão/exportação); botão "concluir revisão" (nada move o exame para `REVIEWED`); paginação; recuperação de senha;
aprovação de médico por CRM (hoje qualquer um cria conta de médico); remover `dev-login`/auto-login antes de produção; testes automatizados
(há zero) e CI; HTTPS/segredos/deploy reais; senha de pareamento BLE por aparelho; ícone/splash finais (a logo é um SVG recriado, falta o arquivo original).

## Pessoas e fluxo de trabalho
- O dono do projeto não é de firmware; **uma equipe de duas pessoas, leigas no assunto,** programa o ESP32 num repositório próprio
  (`elettratech/MLX90640`). Foram avisadas: `MLX90640_API.c` comitado vazio, aviso de licença Apache da Melexis removido,
  pinos 22/23 (válidos só no ESP32 comum). Mensagens para elas devem ser **curtas e sem jargão**.
- O dono pede para **confirmar antes de comitar/enviar**; "pode commitar" é a autorização. Commits em português, sem segredos, `.env` fora do Git.
- Prefere respostas **diretas e curtas**; diga claramente o que foi testado e o que não foi.

## Armadilhas já encontradas neste ambiente (Windows)
- Docker Hub bloqueia `minio/*`: o compose usa `quay.io/minio/*`.
- Prisma no Alpine precisa de `openssl`; o `tsconfig` da API deve limitar o build a `src/` (senão a saída vai para `dist/src/`).
- Disco C: apertado; o disco virtual do Docker só encolhe com `Optimize-VHD` (admin). Não usar "Clean/Purge data" do Docker Desktop (apaga outros projetos).
- Túnel `cloudflared` rápido: o endereço **muda** a cada reinício; no app há "Servidor (teste)" para colar o novo. Nunca deixe `ALLOW_DEV_LOGIN=true` com o túnel aberto.
- Python no Windows não entende caminhos `/c/...` do Git Bash; para testes de C no PC usei containers `alpine` + `gcc` (sem ESP-IDF instalado).
- Expo Go não serve para BLE; o SDK do app é o 51 (o EAS pode recusar versões antigas no futuro).
