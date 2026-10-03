# OpenSpec sync & anti-drift

Conteúdo consolidado em **`AGENTS.md` (raiz)**: seções "Antes de codar", "Antes de declarar concluído" e "Durante a implementação". Este arquivo é só um ponteiro; o gate `scripts/check-agent-gates.mjs` exige que ele exista.

Regra central: toda mudança de endpoint, regra de negócio, fluxo de UI, status ou schema atualiza o OpenSpec do módulo **antes** de declarar done. Stub que parece produção é proibido.
