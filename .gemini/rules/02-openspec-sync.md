# OpenSpec Sync & Anti-Drift (Antigravity / Gemini)

Aplique em **toda** sessão neste repositório. Complementa `01-rust-pwa-guidelines.md`.

## Porta de entrada

1. Ler **`AGENTS.md` na raiz** (não só `openspec/AGENTS.md`).
2. Ler o módulo em `openspec/modules/` da área da tarefa.
3. Antes de concluir: `openspec/DELIVERY_CHECKLIST.md` + `node scripts/check-agent-gates.mjs`.

## Sync Mandate (inegociável)

Toda mudança de endpoint, regra de negócio, fluxo de UI, status de entidade ou schema **deve** atualizar o OpenSpec correspondente **antes** de declarar done.

- Spec otimista demais = drift. Prefira seção **Limitações MVP** a copy de marketing.
- UI e toasts não podem afirmar envio real (prefeitura, WhatsApp, boleto registrado, PSP) se o backend só simula/registra log.

## Stubs

- Proibido stub silencioso que parece produção.
- Permitido: Adapter + variável de ambiente, **ou** stub documentado no OpenSpec + aviso explícito na UI.

## Verificação mínima

- Backend tocado → `cargo check`
- Frontend tocado → `npx tsc --noEmit -p frontend/tsconfig.json` (ou cwd frontend)
- Sempre → `node scripts/check-agent-gates.mjs`
