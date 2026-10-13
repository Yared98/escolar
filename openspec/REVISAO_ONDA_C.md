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
| Mensagem privada listava os 200 primeiros alunos da escola, misturando responsáveis | C17 (turma → aluno, com o nome de quem recebe) |
| Sem relatório de frequência, planejamento de aulas, rematrícula e recado direto da chamada | C13, C14, C15, C16 |

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

### 3.1 Varredura do texto renderizado (o que a pessoa realmente vê)

A busca no código não pega texto montado em tempo de execução nem atributos. Então cada tela foi aberta logada em cada perfil (Gestão, Secretaria, Financeiro, Professor(a), Nutrição, Família) num quadro de 375 × 812, cada aba interna foi clicada e foram lidos o `innerText` da página e os atributos `title`, `placeholder`, `aria-label` e `alt`. A expressão procurada foi a da seção 3 mais termos em inglês e de TI (`Planner`, `Lead`, `Score`, `Feed`, `Sync`, `API`, `Token`, `Gateway`, `PSP`, `RLS`, `EMVCo`, `Unificado`, `null`, `undefined`, `NaN` e outros). Também foram registrados largura > 375px e mensagens de erro de carregamento.

| Perfil | Achado | Correção |
|---|---|---|
| Todos | "Central de Notificações Unificada" (título do sino) | "Notificações" |
| Família | Pix com "padrão EMVCo", "webhook bancário", "credenciais PSP" | texto simples: a tesouraria confere o pagamento; a confirmação automática pelo banco ainda não está ligada |
| Gestão / Secretaria | Captação com "lead", "Novos Leads" | "interessado", "Novos interessados" |
| Gestão / Financeiro | Cobrança com "conector omnicanal" e "payload"; Integrações com "gateway" e "PSP" | linguagem de escola, mantendo o aviso de demonstração |
| Gestão | Conformidade com "(RLS)" | "Dados de cada escola separados no banco" |
| Gestão | Menu "Planner de cardápio", "Corpo docente & RH" | "Cardápio", "Funcionários" |
| Gestão | Conversa privada mostrava "Toda a escola" no cabeçalho | só aparece em aviso de mural |
| Financeiro | Atalho "Alunos" abria com "Não foi possível carregar: turmas, salas" (o servidor recusa esses dados ao perfil) | Secretaria do financeiro mostra só "Contratos e parcelas", em consulta |
| Financeiro | "Integrações" mostrava "Acesso negado" (configurar o banco é só da gestão) | aba fora do menu do financeiro; o link mostra uma frase simples |
| Nutrição | Cardápio mostrava "Acesso negado" porque a tela carregava turmas e disciplinas sem precisar | a aba do cardápio não carrega mais esses dados |
| Professor(a) | "Meu dia" com a nova aba Planejamento ficava com 437px de largura | abas em grade 2×2 no celular, botões de 44px |
| Gestão | Cabeçalho do Pedagógico: "Matriz Curricular & Lotação… Grade Semanal sem Choques" | "Pedagógico — Disciplinas, matriz de cada turma, professores e horários da semana" |
| Secretaria | Rematrícula: "Erro de comunicação com o servidor" (chamada com /api/v1 duplicado) | corrigido, e o verificador de contrato passou a acusar esse erro |

A varredura final rodou na versão integrada com os cards P2, em 67 telas (Gestão 32, Secretaria 7, Financeiro 9, Professor(a) 8, Nutrição 3, Família 8, mais as abas internas de cada uma). Depois das correções acima, ela não encontrou termos de TI no texto visível, nenhuma tela passou de 375px de largura e não sobrou erro de carregamento nem tela vazia.

## 4. Fluxos testados ao vivo (navegador + banco)

- Professora: Meu dia → chamada por disciplina (diário próprio, sem sobrescrever o do dia) → observação de aluno → lançar nota (gravada + `audit_logs`) → criar avaliação.
- Gestão: fechar 1º bimestre (lote de notas desse período recusado com 409, 2º bimestre aceito) → parecer do conselho → criar conta de família com aluna vinculada → senha temporária → troca obrigatória no primeiro acesso.
- Secretaria: emitir declaração de matrícula com código de verificação.
- Família: boletim, provas e trabalhos, observações.
- Recuperação de senha: pedido → e-mail na caixa de saída simulada → link → nova senha → login ok → reuso do link recusado.
- Recados: lista → conversa em tela cheia no celular → enviar mantém a conversa aberta → voltar do aparelho volta à lista.
- Frequência (C13): painel da gestão com "Frequência hoje" 66,7% (2 presentes + 1 justificada) e "Alunos abaixo de 75%"; relatório de outubro do 1º Ano A igual à consulta direta no banco.
- Planejamento (C14): professora salva o plano da semana (gravado + `SALVAR_PLANO_AULA`), "Plano da semana: feito/pendente" nas aulas de hoje, coordenação comenta (`COMENTARIO_PLANO_AULA`).
- Rematrícula (C15): prévia 2026 → 2027, casos "a decidir" exigem escolha, Infantil sugerido como promover; execução: Alice → 2º Ano A/2027, Bruno (retido) → 1º Ano A/2027, Carla encerrada, Elena → Infantil 5, notas de 2026 preservadas.
- Recado da chamada (C16): sem responsável com acesso o botão fica desabilitado com dica; com responsável, "Recado enviado para Marina Andrade" e link para a conversa.
- Mensagem privada por turma (C17): Gestão escolhe Infantil 4 → "Elena Rocha · Marina Andrade" (a mãe de dois filhos aparece uma vez por filho); mensagem chega na conta da família; professora só vê a própria turma.
- Implantação: compose do homelab construído a partir de `git archive`, health/jwks/login pelo proxy, backup diário gerado e restauração testada.

## 5. Verificações automáticas na versão final

- Backend: `cargo fmt --check`, `cargo clippy -- -D warnings` e 20 suítes com 179 testes (unitários e de integração com Postgres, incluindo isolamento entre escolas com 69 tabelas, professor, usuários, diário por aula, documentos, avaliações, fechamento, ocorrências, recuperação de senha, frequência, planos de aula, virada de ano e recado à família). Nenhuma falha.
- Frontend: typecheck, lint, 88 testes Vitest em 15 arquivos, build de produção.
- Contrato de API (0 erros, com a regra nova de prefixo duplicado), gate de spec contra a main, testes dos verificadores (10 + 20 + 13 + 14), suíte de navegação.
- Worker: sem mudanças desde a main (os testes dele não rodaram no worktree de integração por falta de `node_modules`).

## 6. Orquestração

Cards executados por workers do opencode: `opencode-go/kimi-k2.7-code` (o "Kimi 2.5 code" não existe mais na assinatura Go; a versão atual é a 2.7) e, quando a cota Go acabou, os modelos gratuitos do opencode (`step-5-preview-free`, `longcat-2.5-preview-free`, `cat-jam-free`). O Gemini CLI não autentica mais com conta Google pessoal; volta a funcionar com `GEMINI_API_KEY`. Os cards P2 (C13–C16) foram executados em paralelo pelo **Antigravity CLI** (`agy -p ... --model gemini-3.8-flash-high --dangerously-skip-permissions`), um worktree e um Postgres descartável por card. Todos entregaram com verificações verdes, mas a revisão achou defeitos que os testes deles não pegavam: um commit montado sobre a árvore antiga que desfazia correções já integradas (C14), professor lendo planos de turmas alheias (C14), aluno retido mandado para a série seguinte com um teste que reativava a matrícula do ano anterior (C15), prefixo de API duplicado que deixava a rematrícula inutilizável (C15) e casos "a decidir" marcados como promovidos (C15).

Toda entrega passou por revisão do orquestrador (diff, banco, navegador) antes do merge; os defeitos corrigidos na revisão estão nos comentários de cada card no Kanbn.
