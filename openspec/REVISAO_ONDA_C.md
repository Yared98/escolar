# Revisão ponta a ponta — Onda C (2026-10-13)

Registro verificável da revisão e da entrega: o que foi olhado, como foi medido e o resultado. Planejamento do que falta em `openspec/ROADMAP.md`.

## 1. Lacunas encontradas na revisão inicial (e onde foram resolvidas)

| Lacuna | Resolvida em |
|---|---|
| Professor não tinha como lançar notas (rota prevista na spec não existia) | C1, C2 |
| Professor caía num painel de gestão e via todas as turmas da escola | C2, C3 |
| Escola não conseguia criar contas de professor, secretaria e família | C4 |
| Desativar uma conta não encerrava a sessão aberta | C4 (revisão) |
| Diário único por turma e dia: dois professores no mesmo dia se sobrescreviam | C6 |
| Notas podiam ser alteradas a qualquer momento, sem fechamento | C9 |
| Boletim da família quebrava a página quando faltava nota e mostrava "Reprovado" no meio do ano | correções na base (75f6445, 2c05dfe) |
| Compose de produção inexistente; frontend apontava para `localhost` | C5 (+ 3 defeitos achados subindo de verdade) |
| Termos de TI em toda a interface | C3 + varreduras finais (seção 3) |
| Números errados no painel e no financeiro | D2 |
| Sem recuperação de senha | C11 |
| Recados: no celular a conversa abria "lá embaixo" da lista | C12 |

## 2. Telas revisadas no celular (375 × 812), logado em cada perfil, build de produção

`document.documentElement.scrollWidth` = 375 (sem rolagem lateral) e nenhum "sem acesso" indevido em todas:

| Perfil | Telas |
|---|---|
| Professor(a) | Meu dia (aulas, notas, avaliações), Diário/chamada, Recados, Calendário |
| Secretaria | Painel, Alunos, Turmas, Contratos, Captação, Calendário |
| Financeiro | Painel, Faturas, Despesas, Cobrança, Fornecedores, NFS-e, Relatórios, Integrações, Alunos |
| Família | Boletim, Mensalidades, Provas e trabalhos, Observações, Rotina, Documentos, Recados, Calendário |
| Gestão | Painel, Fechamento e conselho, Projetos, Usuários e acessos, Funcionários, Conformidade, Risco de evasão, Meu dia, Nutrição, WhatsApp |

Total: 39 telas. Desktop (1440 × 900) conferido nas telas alteradas (Secretaria/Alunos, Recados lado a lado).

## 3. Varredura de termos de TI na interface

Expressão procurada em `frontend/src/**/*.tsx` e `.ts` (texto JSX, `title`, `placeholder`, `aria-label`, `alt`, mensagens de toast/erro e strings em expressões):

```
RBAC|Forbidden|back-office|Multi-Tenant|slug|Offline-First|PWA|IndexedDB|Dexie|KPI|Dashboard|Omnicanal|
DRE/DFC|XAdES|MVP|endpoint|payload|webhook|stub|mock|Early Warning|thread|Slack|tenant|ERP|SHA-256|
MP 2.200|Homologação|Ensalamento|hash
```

Resultado final: **0 ocorrências em texto visível** (as que restam são nomes internos de código, como o componente `OverviewDashboard` ou o campo `thread_id`). Avisos obrigatórios de integração simulada (AGENTS.md) foram mantidos em linguagem simples ("simulado", "versão de demonstração").

## 4. Fluxos testados ao vivo (navegador + banco)

- Professora: Meu dia → chamada por disciplina (diário próprio, sem sobrescrever o do dia) → observação de aluno → lançar nota (gravada + `audit_logs`) → criar avaliação.
- Gestão: fechar 1º bimestre (lote de notas desse período recusado com 409, 2º bimestre aceito) → parecer do conselho → criar conta de família com aluna vinculada → senha temporária → troca obrigatória no primeiro acesso.
- Secretaria: emitir declaração de matrícula com código de verificação.
- Família: boletim, provas e trabalhos, observações.
- Recuperação de senha: pedido → e-mail na caixa de saída simulada → link → nova senha → login ok → reuso do link recusado.
- Recados: lista → conversa em tela cheia no celular → enviar mantém a conversa aberta → voltar do aparelho volta à lista.
- Implantação: compose do homelab construído a partir de `git archive`, health/jwks/login pelo proxy, backup diário gerado e restauração testada.

## 5. Verificações automáticas na versão final

- Backend: `cargo fmt --check`, `cargo clippy -- -D warnings`, 124 testes unitários e todas as suítes de integração com Postgres (inclui isolamento entre escolas, professor, usuários, diário por aula, documentos, avaliações, fechamento, ocorrências, recuperação de senha).
- Frontend: typecheck, lint, 71 testes Vitest, build de produção.
- Contrato de API (0 erros), gate de spec contra a main, testes dos verificadores, suíte de navegação.

## 6. Orquestração

Cards executados por workers do opencode: `opencode-go/kimi-k2.7-code` (o "Kimi 2.5 code" não existe mais na assinatura Go; a versão atual é a 2.7) e, quando a cota Go acabou, os modelos gratuitos do opencode (`step-5-preview-free`, `longcat-2.5-preview-free`, `cat-jam-free`). O Gemini CLI não autentica mais com conta Google pessoal; volta a funcionar com `GEMINI_API_KEY`. Toda entrega passou por revisão do orquestrador (diff, banco, navegador) antes do merge; os defeitos corrigidos na revisão estão nos comentários de cada card no Kanbn.
