# Decisões de design (e por quê)

- **Cadastro de médico é auto-serviço, sem aprovação de admin no MVP.** Simplifica o
  fluxo de teste, mas é um risco real (qualquer pessoa pode se cadastrar como DOCTOR e
  solicitar vínculo). Antes de produção: adicionar um passo de verificação de CRM e
  aprovação manual pelo Admin antes de `isActive = true` para médicos.
- **Vínculo médico-paciente tem 3 estados** (`PENDING`, `ACTIVE`, `REVOKED`). A paciente
  solicita, o médico aceita. O Admin pode criar vínculos `ACTIVE` diretamente (uso
  administrativo/suporte). Só vínculo `ACTIVE` dá acesso a dados clínicos.
- **`patientId` no payload do dispositivo é validado contra `Device.ownerPatientId`.**
  O dispositivo só aceita capturas para a paciente à qual foi explicitamente vinculado
  pelo Admin — mesmo que o payload tente informar outro `patientId`, a API rejeita.
- **Matriz térmica bruta fica no Postgres (campo JSON), não no storage.** Facilita o
  reprocessamento (ex.: gerar outro tipo de heatmap depois) sem precisar buscar em dois
  lugares. Se o volume crescer muito, mover para o storage também é uma migração futura
  natural — a chave já está isolada em `ThermalCapture`.
- **ADMIN nunca acessa endpoints de exame/imagem** (`ExaminationsModule`,
  `ThermalImagesModule`) — apenas `PatientsModule` (cadastro) e `AuditLogsModule`
  (metadados). Isso é reforçado em código por dois métodos distintos em
  `AccessControlService`: `assertCanAccessPatientRecord` (clínico, sem ADMIN) e
  `assertCanAccessPatientProfile` (cadastro, com ADMIN).
- **URLs assinadas expiram em 5 minutos por padrão** (`SIGNED_URL_EXPIRES_IN_SECONDS`).
  Web panel busca uma nova a cada clique em "Ver imagem térmica" — não há cache client-side.
- **Refresh tokens são rotacionados e guardados como hash (SHA-256) no banco**, não em
  texto puro — um vazamento do banco não expõe tokens utilizáveis diretamente.
