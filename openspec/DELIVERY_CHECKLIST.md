# Checklist de entrega (agents)

Use antes de declarar a tarefa concluída. Se algum item aplicável falhar → **não** concluir.

## Spec

- [ ] Li o módulo OpenSpec da área tocada
- [ ] Atualizei `openspec/modules/<área>.md` (e índice/`CORE_SPEC` se necessário)
- [ ] Limitações MVP estão honestas (sem copy de produto pronto para stubs)

## Código

- [ ] `TenantDb` / RBAC respeitados em handlers novos ou alterados
- [ ] Sem dados fictícios na UI em caso de erro de API
- [ ] Stubs externos explícitos (env/adapter **ou** doc+UI)

## Verificação

- [ ] `cargo check` (se backend mudou)
- [ ] `npx tsc --noEmit` (se frontend mudou)
- [ ] `node scripts/check-agent-gates.mjs` passou

## Escopo

- [ ] Não redefine o pedido do usuário para um subconjunto mais fácil sem avisar
- [ ] Não altera stack/arquitetura sem aprovação
