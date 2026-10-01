# Guia operacional OpenSpec (legado → ver raiz)

> **Fonte operacional canônica para agents:** [`/AGENTS.md`](../AGENTS.md)  
> Checklist: [`DELIVERY_CHECKLIST.md`](./DELIVERY_CHECKLIST.md)  
> Gate: `node scripts/check-agent-gates.mjs`

Este arquivo mantém o histórico do protocolo; novas sessões devem seguir a **raiz**.

---

## 1. Fluxo de trabalho

1. Consultar `BUSINESS_RULES.md` + módulo em `modules/` + `CORE_SPEC.md` (tenant/auth).
2. Implementar sem drift de stack (Rust/Axum + Next.js PWA).
3. Validar com compile/typecheck + agent gates.
4. **OpenSpec Sync Mandate**: atualizar specs tocadas antes de concluir.

## 2. Princípios

- Sem drift arquitetural sem aprovação.
- `openspec/` é fonte de verdade de **negócio**; deve acompanhar o código (e admitir MVP).
- Handlers tenant: `TenantDb` obrigatório.
- Contratos API: retrocompatíveis ou versionados em `/api/v1/...`.
