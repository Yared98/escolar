# Especificação de Negócio: Agenda Digital, Calendário & Eventos (`openspec/modules/agenda_calendario.md`)

## 0. Estado real do produto (leitura obrigatória)

O módulo cobre o **Calendário Letivo com RSVP de Eventos**, a **Rotina Diária da Educação Infantil** e os **Recados e Comunicados Familiares**.

| Capacidade | Status |
|---|---|
| Calendário Escolar e Feriados | Implementado |
| Eventos com Confirmação de Presença (RSVP) e Acompanhantes | Implementado |
| Rotina Diária Infantil (alimentação, sesta, fraldas, ocorrências) | Implementado |
| Portfólio Pedagógico de Evidências BNCC | Implementado |
| Mensageria Escolar e Mural da Turma | Implementado |
| Push Notifications Web VAPID | Implementado via adapter (requer `VAPID_*` no ambiente; sem chaves roda em modo simulado) |
| Disparo de WhatsApp ativo para lembretes de RSVP / comunicados | **Stub** (simulado via `processWhatsAppWebhook`; sem envio real via Meta Cloud API) |

### Limitações MVP / Detalhes de Arquitetura
- **Web Push**: Implementado com padrão Adapter (`SimulatedPushAdapter` default, `VapidPushAdapter` ativo sob `PUSH_MODE=vapid`). O backend fornece a chave pública via `GET /api/v1/notificacoes/push/vapid-public-key` lendo `VAPID_PUBLIC_KEY` do ambiente; quando não configurada, retorna HTTP 503 ("VAPID public key not configured"). Em modo `vapid`, subscriptions inválidas ou expiradas (HTTP 404/410) são removidas da tabela `push_subscriptions`. Sem envio real confirmado, nenhum disparo recebe status `enviado` ou `delivered`, sendo registrado como `simulado`.
- **WhatsApp**: Permanece em modo **Stub** (`{ status: 'simulated', provider: null }`), sem envio externo e sem custos de telefonia.
- **Worker e Multi-tenancy**: O background worker Node.js (`worker/src/index.js`) consome notificações pendentes com usuário de sistema no banco, definindo `app.current_tenant` ao processar cada notificação. A fila `JobQueue` opera em memória no processo do worker.

---

## 1. Calendário Escolar & Eventos com RSVP
- **Gestão de Eventos**:
  - Eventos categorizados: `feriado`, `ferias`, `reuniao_pais`, `festa`, `prova`.
  - Flag `exige_confirmacao_presenca`: Habilita o ciclo de RSVP para convidados.
- **Confirmação de Presença (RSVP)**:
  - O responsável responde com presença confirmada e declara o número de acompanhantes previstos.
  - Endpoints:
    - `GET /api/v1/agenda/calendario/eventos`
    - `POST /api/v1/agenda/calendario/eventos`
    - `POST /api/v1/agenda/calendario/eventos/:id/rsvp`: `{ "status": "confirmado" | "recusado" | "pendente", "acompanhantes": 2 }`
- **Privacidade da Lista**:
  - Convidado só enxerga o próprio status. Apenas a gestão e coordenação visualizam o painel consolidado com a lista completa de participantes.

---

## 2. Rotina Diária da Educação Infantil
- **Registro Individualizado por Aluno**:
  - Eventos de alimentação (tudo, metade, pouco, recusou), sono, fraldário e ocorrências.
  - Endpoint de gravação: `POST /api/v1/agenda/rotina` (upsert por aluno e data).
  - Bloqueio: Aluno registrado com falta na chamada da turma não recebe rotina (HTTP 400).
- **Consulta da Rotina da Família**:
  - `GET /api/v1/agenda/diario-infantil/:aluno_id?data=YYYY-MM-DD` consolidando presença, cardápio consumido e anotações dos educadores.

## 3. Mapa de código (frontend)

Organização após o refactor B12 (só moveu código, sem mudança de regra):

- `AgendaDigitalSection.tsx` orquestra: estado, carregamento, tempo real (`useMensagensRealtime`) e abas.
- `frontend/src/components/agenda/` só exibe, via props: `ComunicacaoPanel`, `WhatsappPanel`, `ComposerModal`, além de `types.ts` e `utils.ts`.
- O gate de spec associa `agenda/**` a este módulo.