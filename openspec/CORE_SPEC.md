# Especificação Técnica do Core (OpenSpec / Escolar ERP)

> **Agents:** protocolo em [`AGENTS.md`](../AGENTS.md). Índice de negócio: [`BUSINESS_RULES.md`](./BUSINESS_RULES.md).

## 1. Visão Geral da Arquitetura

O ecossistema é construído como um SaaS Educacional Multi-Tenant com Backend em Rust e Frontend Web/Mobile PWA em Next.js.

```
┌────────────────────────────────────────────────────────┐
│               Next.js PWA (Offline-First)              │
│       Service Workers + IndexedDB Local Storage        │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / WSS / REST API
┌───────────────────────────▼────────────────────────────┐
│                 Rust Backend (Axum / Tokio)            │
│  ├── Multi-Tenant Middleware (Tenant Extractor)        │
│  ├── Auth & RBAC Engine (JWT / OAuth2 / Argon2)        │
│  └── REST / GraphQL / Event Services                   │
└───────────────────────────┬────────────────────────────┘
                            │ SQLx Connection Pool
┌───────────────────────────▼────────────────────────────┐
│            PostgreSQL (Multi-Tenant Database)          │
│   (Isolated Schemas per Tenant or RLS by tenant_id)    │
└────────────────────────────────────────────────────────┘
```

---

## 2. Especificação de Multi-Tenancy (Rust + PostgreSQL)

- **Extração de Tenant**: O middleware Rust lê o header `X-Tenant-ID` ou extrai o subdomínio da requisição (`escolaA.sistemaescolar.com.br`) e insere na extensão `ActiveTenant`.
- **Isolamento de Dados Estrito (TenantDb Extractor)**:
  - Toda tabela relacional de negócio possui `tenant_id: Uuid`.
  - O acesso ao banco em Handlers protegidos é restrito ao Axum Extractor `TenantDb`, que valida a existência do `ActiveTenant`, adquire uma `PoolConnection` isolada e grava `app.current_tenant` com `set_config(..., false)`.
  - O valor permanece na conexão durante as várias consultas autocontidas do SQLx. `SET LOCAL` não serviria, porque cada comando confirma a própria transação. Antes de a conexão voltar ao pool, `after_release` limpa `app.current_tenant`.
  - As políticas RLS são fail-closed: `tenant_id = get_current_tenant()`, com `FORCE ROW LEVEL SECURITY`. O pool de execução usa `SET ROLE escolar_runtime`, papel sem superusuário e sem `BYPASSRLS`.
  - É expressamente proibido injetar `State<AppState>` para acessar o pool global diretamente em rotas restritas a um tenant. Rotas públicas que já resolveram o tenant usam o helper `acquire_tenant`.

---

## 3. Autenticação & Autorização (RBAC)

- **Tokens**: JWT assinados com Ed25519 (`EdDSA`), access token de 15 minutos e refresh token opaco de 7 dias. Apenas o hash SHA-256 do refresh token é persistido em PostgreSQL. `POST /api/v1/auth/refresh` rotaciona o refresh token. `POST /api/v1/auth/logout` revoga os refresh tokens do usuário. Tokens HS256 não são aceitos. O JWKS em `/api/v1/.well-known/jwks.json` publica a chave pública real (`OKP` / `Ed25519`). PKCE aceita somente `S256`.
- **Funções de Usuário (Roles)**:
  - `SuperAdmin` / `admin`: Administração da plataforma SaaS e provisionamento de novos tenants.
  - `GestorEscolar` / `gestor`: Acesso total à unidade da escola (Acadêmico, Financeiro, Secretaria, CRM).
  - `Secretaria`: Operações de prontuário, matrículas, turmas e ensalamento.
  - `Tesouraria / Financeiro` / `financeiro`: Gestão de boletos, Pix, cobranças, despesas e conciliação.
  - `Professor` / `professor`: Acesso ao Diário de Classe PWA para suas turmas atribuídas.
  - `Nutricionista` / `nutricionista`: Gestão de cardápios, pratos, recorrências e restrições alimentares.
  - `Aluno / Responsável` / `responsavel`: Portal da família para boletim, chamadas, rotina infantil, 2ª via Pix e mensagens.

---

## 4. Padrão de Comunicação Offline-First (PWA)

- **Service Worker**: Cacheia assets estáticos e rotas do Next.js.
- **IndexedDB**: Armazena localmente o banco do Diário de Classe (listas de alunos, aulas planejadas, chamadas pendentes).
- **Fila de Sincronização (Outbox Pattern)**:
  - Quando offline, alterações de chamada, rotina infantil e portfólio são salvas com status `pending_sync`. Registros antigos com status `pending` são migrados para `pending_sync`.
  - Com rede, o salvamento envia na hora e só tira o evento da fila depois do sucesso. Sem rede, a fila sai sozinha ao reconectar, ao abrir o Diário já online e ao voltar para a aba. O botão de sincronizar repete o envio manualmente e não avisa quando a fila automática está vazia. Cada evento sai pelo UUID e só é removido após o sucesso. O diário usa `POST /api/v1/academico/diario/sync`. A rotina usa `POST /api/v1/agenda/rotina` (upsert por aluno+data). O portfólio usa `POST /api/v1/pedagogico/portfolio`. Leitura do dia: `GET /api/v1/academico/diario?turma_id=&data_aula=`. Histórico da turma: `GET /api/v1/academico/diario/recentes?turma_id=`.
- **Dados reais**: falha de API não preenche a interface com pessoas, CPFs, faturas, KPIs ou matrículas fictícias. A tela fica vazia e exibe o erro. Exclusão e matrícula só alteram a lista depois da resposta bem-sucedida.
- **Menu**: cada função tem um submenu único (Secretaria, Pedagógico, Diário, Nutrição, Comunicados, Financeiro, Pessoas, Conformidade, Portal). A barra interna da página não repete esses destinos.
- **Tenant de demonstração (`escola-modelo`)**: o grafo de entidades de demo (salas, turmas, alunos, vínculos, RH, faturas, diário/presenças, rotina infantil, disciplinas BNCC, leads) vive no PostgreSQL via migration idempotente `backend/migrations/20260929180000_seed_demo_escola_modelo.sql`. Contas: `gestor@escolamodelo.com.br` (GestorEscolar), `professor@escolamodelo.com.br` (professor), `nutri@escolamodelo.com.br` (nutricionista), `familia@escolamodelo.com.br` (responsável por Elena Rocha e Felipe Andrade, migration `20260929234000_seed_responsavel_demo.sql`); senha demo `SenhaSegura2026!`. Diário, Secretaria, Pedagógico, Financeiro e Admin leem as mesmas APIs — não há listas hardcoded de turmas/alunos no frontend.

---

## 5. Homologação Ponta a Ponta (E2E) & Arquitetura de Produção

### 5.1 Orquestração Multi-Serviço (`docker-compose.yml`)
- **PostgreSQL 16 Alpine**: Banco relacional multi-inquilino na porta 5432 com healthcheck ativo (`pg_isready -U escolar_app -d escolar_db`). Migrações SQLx aplicadas sequencialmente na inicialização com resiliência de conexão Lazy Pool no backend.
- **Backend Axum 0.7 (Porta 8000)**: Gateway modularizado em Rust com compilação release otimizada (`cargo build --release`), footprint de memória inferior a 30MB e tempo de inicialização < 1.0s.
- **Frontend Next.js 14 App Router (Porta 3000)**: Aplicação PWA compilada com otimização estática e serverless (`npm run build`), integrando design system biofílico Gift Sálvia Edition com chaveamento instantâneo de tema escuro/claro sem flicker.

### 5.2 Segurança e Conformidade OpenSec OWASP
Todas as respostas HTTP do gateway injetam compulsoriamente os 6 cabeçalhos de proteção perimetral:
- `X-Content-Type-Options: nosniff` (Mitigação de ataques de confusão de MIME)
- `X-Frame-Options: DENY` (Proteção contra Clickjacking em iframes de terceiros)
- `X-XSS-Protection: 1; mode=block` (Proteção contra Cross-Site Scripting refletido)
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (Forçamento de HTTPS)
- `Referrer-Policy: strict-origin-when-cross-origin` (Privacidade em transições de origem)
- `X-OpenSec-Protection-Status: Active - Ruleset v2026.4 (OWASP + LGPD)` (Assinatura de conformidade ativa)
- Política de CORS estrita com resposta a requisições `OPTIONS` (Preflight) para origens autorizadas.

---

## 6. Frontend Core UI & Design System (Gift Sálvia Edition)

### 6.1 Identidade Visual Biofílica
- **Paleta Botânica Sálvia:**
  - Cor de Destaque: `#52C27E` (Dark Mode) / `#2D5940` (Light Mode).
  - Dark Mode: Superfície `#18221D`, Canvas `#0F1612`, Bordas orgânicas `#28382F`, Texto `#F2F7F3`.
  - Light Mode: Superfície `#FFFFFF`, Fundo Papel Sálvia `#F4F7F4`, Texto `#1A261D`.
- **Componentação Acolhedora:** Cantos arredondados suaves (`rounded-2xl`), chips de estado em formato de pílula (`rounded-full`) e transições visuais com duração de 200ms.

### 6.2 Gerenciamento de Estado Global & Autenticação Multi-Tenant
- **`AuthContext.tsx`**:
  - Armazena estado reativo: `token`, `user`, `tenant`, `isOnline`.
  - Persistência síncrona em LocalStorage com chaves padronizadas (`escolar_jwt_token`, `escolar_tenant_id`, `escolar_tenant`, `escolar_user`).
  - Simulador de perfil dinâmico (`switchRole`) suportando RBAC nativo para `admin`, `financeiro`, `professor`, `nutricionista` e `responsavel`.
  - Desconexão segura e limpeza de dados sensíveis na ocorrência do evento `auth_error` ou logout voluntário.
- **`ThemeContext.tsx`**:
  - Chaveamento instantâneo entre modos Claro e Escuro sem quebra de contraste.
  - Sincronização direta com a classe `.dark` da tag raiz `<html>` e persistência da preferência do usuário.

### 6.3 Cliente HTTP Resiliente (`lib/api.ts`)
- Wrapper `apiFetch<T>` com injeção automática de cabeçalhos multi-tenant:
  - `Authorization: Bearer <token>`
  - `X-Tenant-ID: <tenantId>`
  - `Content-Type: application/json`
- Interceptador de sessão: um HTTP 401, quando existe `escolar_refresh_token` e a chamada não é login, refresh ou logout, dispara uma única renovação concorrente em `POST /api/v1/auth/refresh`. Os novos tokens substituem `escolar_jwt_token` e `escolar_refresh_token`, e a requisição original é repetida uma vez. Falha do refresh remove os tokens e despacha `window.dispatchEvent(new Event('auth_error'))`.

### 6.4 Header Integrado & Telemetria PWA
- **Seletor de Perfil (Role Switcher):** Troca dinâmica de visão operacional para validação de fluxos RBAC.
- **Badge de Conectividade:** Monitoramento do evento de rede `navigator.onLine` com badge pulsante "Offline PWA" em contingência e "Online" em tempo de execução normal.
- **Central de Notificações Unificada:** Painel popover com alertas emergenciais, disparos da régua financeira e publicações pedagógicas.

---

## 7. API Gateway & Serviços RESTful em Rust (Axum 0.7)

### 7.1 Arquitetura do Gateway Modular
- **Roteador Central:** Modularização sob o prefixo `/api/v1` com divisão estrita entre `public_routes` e `protected_routes`.
  - **Rotas Públicas:** `/health`, `/auth/register-tenant`, `/auth/login`, `/auth/refresh`, `/auth/oauth/token`, endpoints OIDC Discovery (`/api/v1/.well-known/*`), webhook Cora em `/api/v1/webhooks/cora/:tenant_id` (o caminho antigo `/api/v1/api/webhooks/cora/:tenant_id` permanece como alias), webhooks de atendimento e validação pública de diplomas MEC. Calendário e RSVP são rotas protegidas. `/health` degradado não devolve a mensagem interna do banco.
  - **Rotas Protegidas:** Exigem encadeamento dos middlewares `tenant_middleware` e `auth_middleware`. Cobrem Secretaria, Financeiro, Acadêmico, Administrativo, Agenda, Notificações, OpenSec, CRM, LMS, Regulatório e IA Anti-Evasão.
- **Tratamento Semântico Unificado (`AppError`):**
  - Implementação padronizada de `IntoResponse` para `AppError` mapeando erros para payloads JSON `{ "error": String, "status": u16 }`.
  - Proteção contra vazamento de dados sensíveis e strings de conexão em falhas internas (logs estruturados via `tracing::error!` e mensagem genérica em produção).
- **Resiliência e Inicialização Instantânea:**
  - PgPool com migrações automáticas em `backend/migrations/`.
  - Fallback automático para `connect_lazy` na eventualidade do banco reiniciar, garantindo prontidão do Gateway HTTP sem crash de container.
  - Inicialização < 1.0s e consumo de memória < 30MB em modo Release.



---
## 8. Planner & Calendário Escolar (Eventos e RSVPs)
A gestão de calendário escolar e engajamento familiar suporta confirmação de presença (RSVP), permitindo que a escola planeje com precisão reuniões de pais, formaturas e festividades. Detalhes completos em [`openspec/modules/agenda_calendario.md`](./modules/agenda_calendario.md).

### 8.1 Gestão de Eventos
- O calendário escolar permite criar eventos categorizados (`feriado`, `ferias`, `reuniao_pais`, `festa`, `prova`).
- Funcionalidade `exige_confirmacao_presenca`: Flag que ativa o ciclo de RSVP para o evento. Quando ativada, os usuários convidados recebem alertas e o evento rastreia presenças.

### 8.2 Confirmação de Presença (RSVP) e Acompanhantes
- Ao responder, o responsável não envia apenas um `Sim/Não`. Se for um evento aplicável, o sistema registra a **Quantidade de Acompanhantes** que o responsável trará para dimensionar espaços e assentos.

### 8.3 Notificações e Lembretes (Responder Depois)
- Se o usuário não quiser responder no ato, ele pode sinalizar `Pendente / Responder Depois`.
- Notificações automáticas cobram resposta final de confirmações pendentes antes do evento, registrando o histórico na tabela `notificacoes_sistema`.

### 8.4 Privacidade das Listas
- **Acesso Estrito**: Convidado só vê sua própria resposta. Apenas a Gestão Escolar (Administração, Secretaria, Professores) tem acesso ao dashboard consolidado do evento para ver os nomes e os acompanhantes por questões de LGPD.

