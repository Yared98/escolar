# AGENTS.md — Protocolo obrigatório (Escolar ERP)

Este arquivo é a **porta de entrada** para Cursor, Antigravity/Gemini e demais agentes.
Detalhes de domínio ficam em `openspec/`. Regras de sessão ficam em `.cursor/rules/` e `.gemini/rules/`.

## Antes de codar

1. Ler `openspec/BUSINESS_RULES.md` (índice) e o módulo em `openspec/modules/<area>.md`.
2. Ler a seção **Estado real / Limitações MVP** do módulo (se existir). Não inventar maturidade.
3. Para multi-tenant/auth: `openspec/CORE_SPEC.md`.
4. Checklist de entrega: `openspec/DELIVERY_CHECKLIST.md`.

## Durante a implementação

- Stack fixa: **Rust/Axum + SQLx + Postgres RLS** | **Next.js 14 PWA + Tailwind**.
- Handlers de negócio: usar `TenantDb` — nunca pool global de `AppState` em rota tenant.
- Sem dados dummy em UI quando a API falha (empty + erro).
- Stub externo (PSP, NFS-e, WhatsApp, Cora): Adapter + env flag **ou** documentar como MVP stub no OpenSpec **e** na UI (sem copy de “produção pronta”).
- Não alterar stack/arquitetura sem aprovação explícita do usuário.

## Antes de declarar “concluído”

1. Atualizar OpenSpec do módulo tocado (`openspec/modules/*.md` e, se preciso, `CORE_SPEC.md` / `BUSINESS_RULES.md`).
2. Se a feature for parcial, escrever **Limitações MVP** honestas (não marketing).
3. Compilar/typecheck o que mudou (`cargo check` e/ou `npx tsc --noEmit`).
4. Rodar gate local: `node scripts/check-agent-gates.mjs`.
5. Percorrer `openspec/DELIVERY_CHECKLIST.md` mentalmente — se algum item falhar, a tarefa **não** está concluída.

## Mapa rápido módulo → código

| Área | Spec | Código típico |
|---|---|---|
| Secretaria | `openspec/modules/secretaria.md` | `backend/src/handlers/secretaria.rs`, `frontend/src/components/SecretariaSection.tsx` |
| Financeiro | `openspec/modules/financeiro.md` | `backend/src/handlers/financeiro.rs`, `frontend/src/components/FinanceiroSection.tsx` |
| Acadêmico | `openspec/modules/academico.md` | `backend/src/handlers/academico.rs`, `frontend/src/components/academico/`, `PedagocioNutricaoSection.tsx` (TRI) |
| Nutrição | `openspec/modules/nutricao.md` | `backend/src/handlers/nutricao.rs`, `frontend/src/components/nutricao/CardapioPlanner.tsx` |
| Agenda & Calendário | `openspec/modules/agenda_calendario.md` | `backend/src/handlers/agenda_admin.rs`, `AgendaDigitalSection.tsx`, `CalendarioEscolarSection.tsx` |
| CRM | `openspec/modules/crm_atendimento.md` | `backend/src/handlers/crm_lms.rs`, `frontend/src/components/CrmSection.tsx` |
| IA Evasão | `openspec/modules/ia_preditiva.md` | `backend/src/handlers/regulatorio_ia.rs` (score), `PainelEvasao.tsx` |
| Regulatório & LGPD | `openspec/modules/regulatorio_lgpd.md` | `backend/src/handlers/regulatorio_ia.rs`, `AdministrativoSection.tsx` (conformidade) |
| LMS / SSO | `openspec/modules/lms_integracao.md` | `backend/src/handlers/crm_lms.rs` + auth OIDC — **sem UI dedicada no MVP** |

Kanban (contexto humano): `https://kanban.yared.com.br/boards/n8ig1mf0v4u9`
