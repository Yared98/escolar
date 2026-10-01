# Regras de Negócio Globais & Índice Modular (OpenSpec / Escolar ERP)

> **Agents:** comece por [`AGENTS.md`](../AGENTS.md) na raiz. Entrega: [`DELIVERY_CHECKLIST.md`](./DELIVERY_CHECKLIST.md). Gate: `node scripts/check-agent-gates.mjs`.

Este documento é o índice das regras de negócio. Subdocumentos em `openspec/modules/` detalham cada domínio. Specs devem declarar compulsoriamente **estado real / Limitações MVP** quando houver stubs ou recursos fora de escopo.

---

## Estrutura de Módulos de Negócio (`openspec/modules/`)

| Módulo | Arquivo de Especificação | Escopo Principal | Estado MVP |
| :--- | :--- | :--- | :--- |
| **Secretaria & Prontuário** | [`secretaria.md`](./modules/secretaria.md) | Matrícula online, prontuário clínico com log LGPD, contratos digitais e motor de ensalamento. | Implementado |
| **Financeiro & Cobrança** | [`financeiro.md`](./modules/financeiro.md) | Tesouraria gerencial (AR/AP, parcelas na assinatura, Pix local, régua com multa/juros e logs, DRE). | Implementado (Stubs: NFS-e/PSP) |
| **Gestão Acadêmica** | [`academico.md`](./modules/academico.md) | Diário PWA offline-first, boletim, BNCC/grade; simulados TRI parciais (API/UI, sem leitora física). | Implementado (TRI parcial) |
| **Nutrição & Cardápios** | [`nutricao.md`](./modules/nutricao.md) | Pratos, cardápios e recorrências (até 180 dias). Sem CRUD completo de pratos nem cruzamento automático com prontuário. | Implementado |
| **Agenda & Calendário** | [`agenda_calendario.md`](./modules/agenda_calendario.md) | Calendário letivo com RSVP de eventos e acompanhantes, rotina infantil diária e comunicados. | Implementado |
| **CRM & Atendimento** | [`crm_atendimento.md`](./modules/crm_atendimento.md) | Funil comercial de captação de alunos, cálculo de CAC e protocolos internos de atendimento/transbordo. | Implementado (Atendimento interno; sem WhatsApp API ativa) |
| **IA Preditiva Anti-Evasão** | [`ia_preditiva.md`](./modules/ia_preditiva.md) | Sistema de Alerta Antecipado (EWS) com cálculo de score de risco por heurística ponderada in-process (40/35/25). | Implementado (Heurística determinística in-process) |
| **Regulatório & LGPD** | [`regulatorio_lgpd.md`](./modules/regulatorio_lgpd.md) | Educacenso/INEP (5 módulos), consentimento LGPD Art. 14, controle perimetral RFID/QR e registro de certificados. | Implementado (Sem ICP-Brasil A3 externo) |
| **Interoperabilidade LMS** | [`lms_integracao.md`](./modules/lms_integracao.md) | Single Sign-On (SSO) OIDC Core 1.0 com PKCE S256 e contratos de dados LTI 1.3 / SCORM. | Implementado (Backend API-only; sem UI) |

---

## Princípios Transversais de Negócio

1. **Integridade de Dados e Imutabilidade**:
   - Transações financeiras liquidadas não podem ser excluídas; exigem lançamentos de estorno com audit trail. Despesas em aberto são canceladas logicamente. Despesas `pago`, `liquidado` ou `conciliado` só mudam por `POST /api/v1/financeiro/despesas/:id/estornar`, que grava o lançamento de estorno e marca a origem como `estornada`. Credenciais bancárias não são devolvidas pela API de leitura.
   - Pautas acadêmicas encerradas pelo docente requerem autorização da Coordenação Pedagógica para reabertura de edição.

2. **Privacidade e Proteção do Menor (Art. 14 LGPD)**:
   - Toda coleta de dados sensíveis de alunos menores de idade exige consentimento expresso do responsável legal cadastrado.
