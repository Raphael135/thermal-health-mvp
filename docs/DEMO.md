# Rodada de testes com o app no celular (Android)

Roteiro para deixar poucas pessoas testarem o app **sem o aparelho**: o servidor roda no seu PC,
exposto por um túnel temporário, e a captura é simulada. Pensado para um dia, 3 pessoas.

**O que isto não é:** um ambiente de produção. Dados de saúde reais não podem entrar aqui (o
consentimento de LGPD não está implementado). Os testadores devem usar só dados inventados.

## Quem faz o quê

- **Testadores** (celular Android): criam conta, simulam uma captura, acompanham o status, pedem
  vínculo com a médica e registram sintomas.
- **Médica** (você, no PC, em `http://localhost:5173`): aceita o vínculo e vê a imagem da captura.
  Como o painel roda só no seu PC, o link da imagem (MinIO) também fica só local, e por isso não
  é preciso expor mais nada.

## 1. Preparar o servidor (uma vez, antes do dia)

Use um banco limpo para não aproveitar contas e a senha padrão do admin de testes antigos.
`down -v` apaga **só os dados deste projeto** (banco, arquivos de imagem):

```bash
docker compose down -v
```

No `.env` da raiz (copie de `.env.example` se não existir), defina:

```
ALLOW_DEMO_CAPTURE=true
ALLOW_DEV_LOGIN=false
TRUST_PROXY=1
SEED_ADMIN_PASSWORD=<uma senha forte sua>
JWT_ACCESS_SECRET=<texto aleatório de 40+ caracteres>
JWT_REFRESH_SECRET=<outro texto aleatório de 40+ caracteres>
```

`ALLOW_DEV_LOGIN` precisa ficar `false`: com o servidor na internet, `true` deixaria qualquer
pessoa entrar como qualquer usuário, sem senha.

```bash
docker compose up -d --build
docker compose exec api npm run seed        # cria o admin com a senha acima
```

Crie a médica (troque a senha):

```bash
curl -X POST http://localhost:3000/auth/register/doctor -H "Content-Type: application/json" \
  -d '{"email":"medica.demo@teste.com","password":"<senha>","fullName":"Dra. Demo","crm":"99999-SP"}'
```

Painel da médica (outro terminal): `cd apps/web && npm install && npm run dev`.
Confira que o worker está de pé: `docker compose ps` deve listar `worker` como `Up`.

## 2. Abrir o túnel (no dia)

```bash
cloudflared tunnel --url http://localhost:3000
```

Ele imprime um endereço `https://alguma-coisa.trycloudflare.com`. **Esse endereço muda toda vez que
o túnel é reiniciado** e vale enquanto o comando estiver rodando: o PC precisa ficar ligado e sem
suspender o dia todo. Teste de fora: abra `https://<endereço>/auth/login` no navegador do celular
(com dados móveis, não no Wi-Fi de casa). Deve aparecer `{"message":"Cannot GET /auth/login",...}`:
isso é a API respondendo, e o erro é normal porque essa rota só aceita POST. Uma página de erro da
Cloudflare significa que o túnel não está chegando na API.

## 3. Gerar o APK (uma vez)

Pré-requisito: conta gratuita em https://expo.dev.

```bash
cd apps/mobile
npm install
npx eas-cli login
npx eas-cli init                          # liga a pasta ao seu projeto no Expo
npx eas-cli build --platform android --profile preview
```

O perfil `preview` (em `apps/mobile/eas.json`) liga o modo de teste e desliga o login automático.
Ao terminar, o EAS mostra um link/QR para baixar o APK: mande aos testadores. No Android é preciso
permitir "instalar apps de fontes desconhecidas" para o navegador.

Não é preciso gerar outro APK quando o endereço do túnel mudar: veja o próximo passo.
Se o build recusar o SDK 51 do Expo (versões antigas deixam de ser suportadas com o tempo), será
preciso atualizar o SDK do app antes.

## 4. O que os testadores fazem

1. Abrir o app, tocar em **Servidor (teste)**, colar o endereço do túnel e **Salvar servidor**.
2. **Criar conta** (com e-mail e nome inventados).
3. **Vincular médico** → "Dra. Demo" → Solicitar vínculo (você aceita no painel).
4. **Simular captura (teste)** na tela inicial: o histórico mostra "Recebido" e, em alguns segundos,
   "Processado". A paciente nunca vê a imagem, de propósito.
5. **Registrar sintomas**.
6. Tela de dispositivos: continua simulada (sem BLE real).

Você, no painel: aceitar a solicitação (aparece no topo), abrir a paciente, **Ver imagem térmica**,
escrever uma observação e marcar "Liberar para a paciente" (ela aparece no app).

## 5. Depois do teste

1. `Ctrl+C` no `cloudflared` (o endereço deixa de existir na hora).
2. No `.env`: `ALLOW_DEMO_CAPTURE=false` e `docker compose up -d` para recriar a API.
3. Se quiser descartar tudo: `docker compose down -v`.

## Limites que você precisa saber

- O túnel temporário não tem garantia de disponibilidade. Se cair, o app mostra erro de conexão até
  o novo endereço ser colocado em **Servidor (teste)**.
- A API aceita no máximo 10 tentativas por minuto de login/cadastro por IP, e 10 exames de
  demonstração por paciente.
- Qualquer pessoa que saiba o endereço pode **criar conta**, inclusive de médico (não há aprovação).
  Um médico só vê pacientes que aceitou, mas não divulgue o endereço fora do grupo.
- Os testadores do iPhone não conseguem participar (não há build para iOS).
