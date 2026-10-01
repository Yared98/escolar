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
| Push Notifications Web VAPID | Implementado (`push_subscriptions` e worker) |
| Disparo de WhatsApp ativo para lembretes de RSVP | **Fora de escopo MVP** (notificação via Push/In-App) |

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
