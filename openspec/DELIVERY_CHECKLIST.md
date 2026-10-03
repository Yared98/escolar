# Checklist de entrega (agents)

Use antes de declarar a tarefa concluída. Se algum item aplicável falhar → **não** concluir.

## Spec

- [ ] Li o módulo OpenSpec da área tocada
- [ ] Atualizei `openspec/modules/<área>.md` (e índice/`CORE_SPEC` se necessário) em conjunto com o código tocado (Sync Mandate)
- [ ] Caso a alteração de código não toque regras de negócio nem exija alteração de spec, incluído escape explícito `Spec-Sync: n/a <motivo>` no commit
- [ ] Limitações MVP estão honestas (seção `## Estado real / Limitações MVP` preenchida com tabela de status ou >= 3 linhas, sem copy de produto pronto para stubs)

## Código

- [ ] `TenantDb` / RBAC respeitados em handlers novos ou alterados
- [ ] Sem dados fictícios na UI em caso de erro de API
- [ ] Stubs externos explícitos (env/adapter **ou** doc+UI), sem overclaims em `.tsx` (sem alegações de envio à prefeitura, WhatsApp oficial ou produção PSP sem disclaimer estrito)

## Verificação

- [ ] `cargo check` (se backend mudou)
- [ ] `npx tsc --noEmit` (se frontend mudou)
- [ ] `npm test` no frontend (se alterou `lib/` ou hooks)
- [ ] `node scripts/check-api-contract.mjs` passou
- [ ] `node --test scripts/check-api-contract.test.mjs` passou
- [ ] `node --test scripts/check-agent-gates.test.mjs` passou
- [ ] `node scripts/check-agent-gates.mjs` passou (modo diff local ou `--base <ref>`)
- [ ] CI (`.github/workflows/ci.yml` e `agent-gates.yml`): todos os jobs aplicáveis (backend, frontend, worker, navigation e gates) devem passar em push/PR


## Escopo

- [ ] Não redefine o pedido do usuário para um subconjunto mais fácil sem avisar
- [ ] Não altera stack/arquitetura sem aprovação
