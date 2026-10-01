# Diretrizes de Código e Arquitetura para LLMs (Sistema Escolar)

Complemento obrigatório: **`AGENTS.md` (raiz)** e **`.gemini/rules/02-openspec-sync.md`**.

---

## 1. Stack Tecnológica Obrigatória

* **Backend**: Rust (Axum, SQLx, Tokio) — sem trocar framework sem aprovação do usuário.
  - PostgreSQL multi-tenant com `tenant_id` + RLS; handlers de negócio usam `TenantDb`.
  - Erros via `Result<T, AppError>`. Evitar `unwrap()`/`expect()` em produção.
* **Frontend**: Next.js App Router / React + Tailwind + PWA offline-first (Diário).
* **APIs**: REST JSON. Realtime onde já existir (SSE mensagens); não inventar GraphQL sem pedido.

---

## 2. Regras Anti-Drift

1. **OpenSpec**: ler módulo antes; atualizar módulo ao concluir. Ver `02-openspec-sync.md`.
2. **Sem overclaim**: não afirmar na UI “enviado à prefeitura / WhatsApp enviado / boleto registrado” sem integração real. Usar “simulado”, “registrado”, “local”.
3. **Sem dummy em erro de API**: empty state + mensagem; sem CPF/aluno inventado.
4. **Stubs externos**: Adapter + env **ou** documentar Limitações MVP no OpenSpec + aviso na UI.
5. **Verificação**: `cargo check` / `npx tsc --noEmit` conforme escopo + `node scripts/check-agent-gates.mjs`.
6. **Checklist**: `openspec/DELIVERY_CHECKLIST.md` antes de done.

---

## 3. Segurança & LGPD

- Dados de menores: consentimento do responsável (Art. 14).
- Prontuário/financeiro sensível: `audit_logs` com tenant, user, ação, timestamp.
- Sem biometria facial obrigatória para frequência.

---

## 4. Visual

- Seguir padrões já usados no app (Sálvia / componentes existentes). Não reinventar design system sem pedido.
