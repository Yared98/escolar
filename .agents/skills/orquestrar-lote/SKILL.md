---
name: orquestrar-lote
description: Orquestra um lote de cards da Onda B do Escolar ERP (Kanban n8ig1mf0v4u9). Use somente quando o usuário pedir "orquestrar lote" e informar a tabela de cards. Abre um worker novo por card, verifica de forma independente, comenta o resultado e move para Code Review.
---

# Orquestrar lote da Onda B

Você é o ORQUESTRADOR. Repositório: D:\Projetos\escolar. Kanban: MCP `kanbn`, board n8ig1mf0v4u9.
Leia `AGENTS.md` (fonte única de regras do projeto) antes de começar. Esta skill só acrescenta o fluxo de orquestração.

## Entrada obrigatória
O usuário informa a tabela do lote: card | ID | branch a criar | "A partir de" | condição.
Se a tabela não vier, PARE e peça. A coluna "A partir de" vale mais que o texto dos cards e que a regra genérica de empilhamento do AGENTS.md.
Não execute card fora da tabela. Ao terminar o último card, PARE e faça o relatório.

## Pré-checagem (se algo falhar, PARE e avise)
1. `git status` limpo e `git worktree list` só com a pasta principal.
2. `git rev-parse --short onda-b/base` (mostre a saída; é a base do lote).
3. `docker ps`: `escolar_postgres` healthy. NUNCA `docker compose down -v`; nunca apague `escolar_db`.
4. `node -e "console.log(!!process.env.ESCOLAR_TEST_DATABASE_URL)"` deve mostrar `true`.

## Regras (não negociáveis)
1. Prova de sabotagem SÓ num `git worktree add --detach <pasta> <branch>` FORA de D:\Projetos\escolar (ex.: D:\Projetos\wt-sab-<card>); rode os testes DE DENTRO do worktree sabotado. Nunca sabote na pasta principal.
2. NUNCA `git add .` nem `git commit -a/-am`. Adicione arquivos pelo nome.
3. Nunca digite um hash: cole a saída de `git rev-parse --short <branch>`.
4. Só afirme o que um comando mostrou; cole o comando e a saída. Não descreva arquivos que não estão em `git diff --name-only`.
5. Testes de backend com banco usam SEMPRE a `ESCOLAR_TEST_DATABASE_URL` do ambiente (nunca escreva nem imprima a URL). PASS exige as linhas `test <nome> ... ok` dos testes de integração (`tenant_isolation_refresh_estorno_e_fila`, `test_logout_revocation_and_session_isolation` e os do card). Se pular em silêncio, NÃO é PASS.
6. Migration: nunca editar existente; nova com timestamp maior que `ls backend/migrations | tail -1`. Tabela nova com `tenant_id`: RLS `ENABLE` + `FORCE` + política `tenant_id = get_current_tenant()` para `escolar_runtime` E uma linha do tenant B no mapa de INSERTs de `backend/tests/tenant_isolation.rs`.
7. Um commit por card, só na branch do card; nunca em main nem em onda-b/base; NUNCA push. Não "consertar" nada fora do card (anote no comentário).

## Por card
1. Crie a branch a partir do "A partir de". Confirme: `git merge-base --is-ancestor <A partir de> <branch> && echo OK`.
2. Abra um worker NOVO que lê o card inteiro (`kanbn_get_card`) e TODOS os comentários (`kanbn_list_comments`), principalmente os de "ATUALIZAÇÃO", que corrigem o texto original.
3. Verifique de forma independente; não confie no relato do worker:
   - Aceite do card, item por item, e as provas de sabotagem descritas no card/comentário.
   - Escopo: `git diff --name-only <A partir de>..<branch>` só com arquivos permitidos.
   - `cd backend && cargo fmt --check && cargo clippy -- -D warnings && cargo test` (regra 5).
   - Se tocou frontend: `cd frontend && npm run typecheck && npm run lint && npm test`. Worker: `cd worker && npm test`.
   - `node scripts/check-agent-gates.mjs --base <A partir de>`, `node --test scripts/check-agent-gates.test.mjs`, `node scripts/check-api-contract.mjs --compare-snapshot --strict-allowlist`.
4. Resultado:
   - PASS: comentário com a SAÍDA REAL de cada comando (resumo e últimas linhas, nunca só "PASSED"), as provas de sabotagem e `git rev-parse --short <branch>`. Marque o checklist (`kanbn_toggle_checklist_item`; se der 404, diga no comentário). Mova para **Code Review**. NUNCA mova para Done.
   - FAIL: devolva ao worker com o motivo exato. Na 2ª falha do mesmo card, mova para **Blocked**, comente o motivo e siga a coluna "A partir de" para o próximo card (card com condição não roda se o anterior falhou).
   - Card que exige "Pare e pergunte" do AGENTS.md: PARE o lote e pergunte ao usuário.

## Ao terminar
Remova todo worktree descartável (`git worktree list` só com a pasta principal).

## Relatório final
Tabela: card | estado no Kanban | branch | hash (saída de `git rev-parse --short`) | testes de integração `ok` (nomes) | provas de sabotagem (ok/falhou) | pendências. Diga quais cards não rodaram e por quê.

## Lições dos lotes anteriores (verifique além dos testes)
- Teste verde não basta. Leia o diff do código novo procurando: configuração que nunca é ligada em `main.rs` (ex.: IP do cliente sem `ConnectInfo`), gravação feita antes de a operação terminar (sem transação), exceção nova que impede passo obrigatório (ex.: concluir a notificação), estrutura em memória que só cresce.
- Para segurança/anti-abuso: prove com 2 clientes diferentes (um não pode afetar o outro) e com a configuração padrão de produção.
- Tabela nova: RLS + linha do tenant B em `tenant_isolation.rs`. Função SQL `SECURITY DEFINER`: `search_path` fixo, `REVOKE` de PUBLIC e `GRANT` só ao `escolar_runtime`.
- Não afirme prova de sabotagem que você não executou neste lote; cole a falha real do teste.
