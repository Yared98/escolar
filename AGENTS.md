# AGENTS.md — Protocolo obrigatório (Escolar ERP)

**Fonte única de regras** para Claude, Gemini/Antigravity, Cursor e demais agentes. `CLAUDE.md` e `GEMINI.md` só importam este arquivo; `.cursor/rules/` e `.gemini/rules/` são ponteiros curtos. Detalhes de domínio ficam em `openspec/`.

## Antes de codar

1. Ler `openspec/BUSINESS_RULES.md` (índice) e o módulo em `openspec/modules/<area>.md`.
2. Ler a seção **Estado real / Limitações MVP** do módulo (se existir). Não inventar maturidade.
3. Para multi-tenant/auth: `openspec/CORE_SPEC.md`.
4. Checklist de entrega: `openspec/DELIVERY_CHECKLIST.md`.

## Durante a implementação

- Stack fixa: **Rust/Axum + SQLx + Postgres RLS** | **Next.js 14 PWA + Tailwind**.
- Handlers de negócio: usar `TenantDb` — nunca o pool global de `AppState` em rota tenant.
  - **Exceções legítimas** (rotas públicas, sem usuário logado): resolver o tenant e abrir a conexão com `crate::db::acquire_tenant(&state.pool, tenant_id)`, nunca query direta. Hoje: `auth/` (login/sessão), `webhooks_cora.rs`, `crm_lms.rs` (`capturar_lead_publico`, `whatsapp_webhook`) e `regulatorio_ia.rs::validar_diploma_digital_publico` (única que consulta `state.pool` direto, via função SQL `validar_diploma_publico`). Qualquer outro `state.pool` em rota autenticada é bug.
- **Migrations** (`backend/migrations/`): nunca editar nem renomear uma migration já aplicada (o sqlx guarda checksum e `migrate().run` quebra). Mudança de schema = arquivo novo `YYYYMMDDHHMMSS_descricao.sql`. Tabela nova com `tenant_id` exige RLS (`ENABLE` + `FORCE` + política `tenant_id = get_current_tenant()`, como em `20260929000000_security_foundation.sql`).
- Contratos de API: retrocompatíveis ou versionados em `/api/v1/...`.
- Erros: `Result<T, AppError>`; sem `unwrap()`/`expect()` em caminho de produção.
- Sem dados dummy em UI quando a API falha (empty + erro).
- Stub externo (PSP, NFS-e, WhatsApp, Cora): Adapter + env flag **ou** documentar como MVP stub no OpenSpec **e** na UI (sem copy de "produção pronta").
- Nunca logar segredos (`DATABASE_URL`, PEM, tokens).
- Segurança & LGPD: dados de menores exigem consentimento do responsável (Art. 14); prontuário e financeiro sensível geram `audit_logs` (tenant, usuário, ação, timestamp); sem biometria facial obrigatória para frequência.
- Visual: seguir `DESIGN.md` (Sálvia) e os componentes existentes; não criar design system novo sem pedido.
- Não alterar stack/arquitetura sem aprovação explícita do usuário.

## Comandos (verificados no repositório)

| Para | Comando |
|---|---|
| Backend compila | `cd backend && cargo check` |
| Backend testes | `cd backend && cargo test` (os de integração, `tests/tenant_isolation.rs`, exigem `ESCOLAR_TEST_DATABASE_URL`: URL admin de um Postgres; o teste cria e derruba bancos próprios) |
| Frontend | `cd frontend && npm run typecheck`, `npm run lint`, `npm test`, `npm run build` |
| Worker | `cd worker && npm test` |
| Contrato de API | `node scripts/check-api-contract.mjs --compare-snapshot --strict-allowlist` (usar `--snapshot` para atualizar o snapshot) |
| Testes do contrato | `node --test scripts/check-api-contract.test.mjs` |
| Verificador de Refactor | `node scripts/check-refactor-move.mjs --base <ref>` (compara `<ref>` com a branch/working tree) |
| Testes do verificador | `node --test scripts/check-refactor-move.test.mjs` |
| Verificador de Refactor Rust | `node scripts/check-refactor-move-rust.mjs --base <ref> [--area <nome>]` (compara `<ref>` com a branch/working tree do backend Rust) |
| Testes do verificador Rust | `node --test scripts/check-refactor-move-rust.test.mjs` |
| Gate de spec | `node scripts/check-agent-gates.mjs` (modo diff local) ou `--base origin/main` (CI/PR) |
| Testes do gate | `node --test scripts/check-agent-gates.test.mjs` |
| Execução manual de seeds demo | `node scripts/seed-demo.mjs` (aplica as migrations de seed demo no DB) |
| CI (GitHub Actions) | `.github/workflows/ci.yml` — replica backend (clippy/test com postgres), frontend (typecheck/lint/test/contrato de api/build), worker e navegação em push/PR |
| Stack local | `docker compose up -d postgres` (5432); backend na 8000; frontend na 3000 |
| `tests/e2e/` | `node tests/e2e/run_all.mjs` — é Python e analisa estaticamente a **navegação do frontend**; **não** exercita API nem banco |

## Pare e pergunte ao usuário antes de

- trocar stack/arquitetura ou mudar o contrato de autenticação/sessão (tokens, cookies);
- editar/renomear migration aplicada ou apagar dados;
- integrar serviço externo real (credencial, certificado, custo): entregue em modo simulado via Adapter + env;
- fazer refactor grande com `git status` contendo mudanças que não são suas: peça para commitar/estabilizar antes;
- reduzir o escopo pedido: avise explicitamente.

## Git

- Commit/push só quando o usuário pedir. Um assunto por commit. Rode `git status` antes e não inclua mudanças pendentes que não sejam suas. Não pule hooks.
- **Exceção autorizada: execução orquestrada de cards da Onda B.** O orquestrador cria uma branch `onda-b/<Bn>` e o worker pode commitar nela ao fim do card. As branches são **empilhadas**: a do primeiro card nasce de `onda-b/base` e cada seguinte nasce da branch do último card aprovado, para que quem depende de outro card enxergue o código dele. Nunca commitar direto em `main` nem em `onda-b/base`; nunca fazer push. Se a tentativa falhar, a branch é descartada. Fora desse fluxo vale a regra acima.

## Kanban

Board: `https://kanban.yared.com.br/boards/n8ig1mf0v4u9` (workspace Escolar, MCP `kanbn`).

- Card = 1ª linha `**Resumo:**`, depois `**Depende de:**` e `**Arquivos:**`. Os critérios ficam em "Aceite" no texto **e** no checklist **Definition of Done**. O `get_card` devolve o checklist com o `id` de cada item: marque com `kanbn_toggle_checklist_item` ao concluir cada critério (o texto continua sendo a referência se houver divergência).
- Respeite "Depende de". Ao começar, mova para *In Progress*; ao terminar, para *Code Review* (a coluna *Done* é do usuário).
- Registre em comentário do card decisões, o que ficou pendente e passos manuais (ex.: o que depende de credencial).

## Antes de declarar "concluído"

1. Atualizar OpenSpec do módulo tocado (`openspec/modules/*.md` e, se preciso, `CORE_SPEC.md` / `BUSINESS_RULES.md`).
2. Se a feature for parcial, escrever **Limitações MVP** honestas (não marketing).
3. Compilar/typecheck o que mudou (`cargo check` e/ou `npx tsc --noEmit`).
4. Rodar gate local: `node scripts/check-agent-gates.mjs` (ou `node scripts/check-agent-gates.mjs --base <ref>` para modo diff contra uma branch). Se alterar código mapeado na tabela sem alterar a respectiva spec, o gate falhará em modo diff. Escape auditável: no commit (modo `--base`) adicione `Spec-Sync: n/a <módulo>: <motivo>` (onde `<módulo>` é uma chave da tabela abaixo, ex: `financeiro`, e `<motivo>` tem >= 10 caracteres) para liberar apenas aquele módulo quando a alteração não tocar regras de negócio. No modo local (sem `--base`), use a variável de ambiente `SPEC_SYNC_SKIP="<módulo>: <motivo>"`.
5. Garantir que os passos do CI (`.github/workflows/ci.yml`: backend, frontend, worker, navegação e `.github/workflows/agent-gates.yml`) continuam válidos e verdes.
6. Percorrer `openspec/DELIVERY_CHECKLIST.md` mentalmente — se algum item falhar, a tarefa **não** está concluída.

## Docs que NÃO são fonte de verdade

A fonte de verdade é `openspec/`. Estes arquivos são histórico ou referência genérica:
- `docs/archive/navegacao-refactor/` (`PROJECT.md`, `TEST_INFRA.md`, `TEST_READY.md`): sobre o refactor antigo de navegação e sua suíte de testes.
- `docs/reference/Funcoes_De_Gestao_Escolar.md` (~90 KB): pesquisa de mercado genérica sobre ERPs escolares. Não carregue inteiro; busque por trecho se precisar.

## Mapa rápido módulo → código

| Área | Spec | Código típico |
|---|---|---|
| Secretaria | `openspec/modules/secretaria.md` | `backend/src/handlers/secretaria.rs`, `frontend/src/components/SecretariaSection.tsx` (orquestra), `frontend/src/components/secretaria/**` (inclui `secretaria/matricula/**`) |
| Financeiro | `openspec/modules/financeiro.md` | `backend/src/handlers/financeiro.rs`, `frontend/src/components/FinanceiroSection.tsx` (orquestra), `frontend/src/components/financeiro/**` |
| Acadêmico | `openspec/modules/academico.md` | `backend/src/handlers/academico.rs`, `frontend/src/components/academico/**`, `PedagocioNutricaoSection.tsx` (orquestra; TRI) + `frontend/src/components/pedagogico/**`, `PortalAlunoSection.tsx` (orquestra) + `frontend/src/components/portal_aluno/**` |
| Nutrição | `openspec/modules/nutricao.md` | `backend/src/handlers/nutricao/**`, `frontend/src/components/nutricao/**` |
| Agenda & Calendário | `openspec/modules/agenda_calendario.md` | `backend/src/handlers/agenda_admin.rs`, `AgendaDigitalSection.tsx` (orquestra) + `frontend/src/components/agenda/**`, `CalendarioEscolarSection.tsx`, `worker/**` |
| CRM | `openspec/modules/crm_atendimento.md` | `backend/src/handlers/crm_lms.rs`, `frontend/src/components/CrmSection.tsx` |
| IA Evasão | `openspec/modules/ia_preditiva.md` | `backend/src/handlers/regulatorio_ia.rs` (score), `PainelEvasao.tsx` |
| Regulatório & LGPD | `openspec/modules/regulatorio_lgpd.md` | `backend/src/handlers/regulatorio_ia.rs`, `AdministrativoSection.tsx` (conformidade) |
| LMS / SSO | `openspec/modules/lms_integracao.md` | `backend/src/handlers/crm_lms.rs` + auth OIDC — **sem UI dedicada no MVP** |
| Core / Banco | `openspec/CORE_SPEC.md` | `backend/migrations/**` |

**Padrão do frontend (B12):** o `*Section.tsx` orquestra (estado, carregamento, tempo real, abas e handlers); os painéis, modais e abas das pastas acima só exibem, recebem tudo por props e não chamam `apiFetch`. Chamada de API nova entra no `*Section.tsx` (o contrato de API é checado por `scripts/check-api-contract.mjs`).