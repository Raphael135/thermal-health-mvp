# Fora do escopo do MVP (roadmap futuro)

Estes itens foram intencionalmente **não implementados** nesta fase. A arquitetura foi
pensada para não bloquear a adição deles depois:

- Chat / assistente de IA para perguntas da paciente (módulo `AiModule` separado, futuro).
- Diagnóstico automático ou classificação de risco a partir da imagem térmica.
- Comunidade pública, feed social, fórum, comentários entre pacientes.
- Comparação pública de exames.
- Marketplace médico completo / integração com hospitais e prontuários externos.
- Pagamentos e planos de assinatura.
- BLE real no app mobile (MVP usa `DeviceService` com implementação simulada atrás de uma
  interface — trocar a implementação depois não deve exigir mudança de tela).
- Validar no aparelho a leitura do sensor MLX90640 no firmware (o driver está escrito e
  conferido em simulação, mas nunca rodou em um ESP32-S3 de verdade; ver `firmware/esp32/README.md`).

## Onde a IA entraria depois

- Um novo microsserviço (`services/ai-assistant`) consumindo os mesmos dados de
  `Examination`/`SymptomReport` via API interna, nunca acesso direto ao banco.
- Um novo módulo `AiModule` no `services/api` expondo endpoints específicos, com o mesmo
  controle de acesso por role/vínculo já existente.
- Nenhuma tabela ou campo atual precisa mudar para isso — `Examination.processedMetadata`
  (JSON) já guarda o que o processor gera, e pode ser consumido por um pipeline de IA futuro.
