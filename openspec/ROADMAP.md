# Roadmap — do demo ao uso real na escola

Planejamento das funções ausentes ou incompletas, levantado na revisão ponta a ponta de 2026-10-13 e atualizado ao fim da Onda C e dos cards P2 (C13–C17).
Fonte de verdade do que JÁ existe continua sendo cada `openspec/modules/*.md` (seção "Estado real"). Este arquivo ordena o que faltava e o que ainda falta.
A evidência da revisão (telas por perfil, varredura de termos, medições no celular, verificações) está em `openspec/REVISAO_ONDA_C.md`.

Critério de prioridade: **P0** impede uma escola de usar o sistema no dia a dia; **P1** a escola sente falta no primeiro bimestre; **P2** melhora, mas tem alternativa manual.

## Entregue na Onda C (cards em Done no Kanbn)

### P0
| Card | O que entrega |
|---|---|
| C1 | API do professor: minhas turmas, aulas do dia, consulta e lançamento de notas em lote (a rota prevista na spec não existia) |
| C2 | "Meu dia" do professor no celular, lançamento de notas, chamada sem campos falsos, barra de navegação inferior para todos os perfis |
| C3 | Linguagem de escola na interface e painel inicial por perfil |
| C4 | Usuários e acessos: a gestão cria contas, desativa (encerra as sessões) e redefine senha; troca obrigatória no primeiro acesso |
| C5 | Implantação no homelab: compose de produção, proxy na mesma origem, segredos em `.env`, backup diário e restauração testada |
| D1–D4 | Textos honestos, números corretos (inadimplência, risco de evasão), sem rolagem lateral no celular, seed de demonstração completo |

### P1
| Card | O que entrega |
|---|---|
| C6 | Diário e chamada por aula/disciplina (Fundamental II e Médio), frequência por disciplina no boletim |
| C7 | Documentos da secretaria: declarações de matrícula e frequência e histórico escolar para imprimir/salvar em PDF |
| C8 | Calendário de avaliações por turma: o professor marca, a família vê |
| C9 | Fechamento de bimestre (trava o lançamento de notas) e conselho de classe com parecer no boletim |
| C10 | Ocorrências e observações de aluno no Fundamental, visíveis no portal da família |
| C11 | "Esqueci minha senha" com link de uso único (e-mail em modo simulado, caixa de saída para a gestão) |
| C12 | Recados no padrão de conversa (estilo WhatsApp), tela cheia no celular |

### Qualidade
- **B13** (dividir handlers grandes em módulos): concluído (B13.1–B13.8), cada área aprovada pelo `check-refactor-move-rust`.
- Gate de spec reconhece os handlers em diretório e os handlers novos.

### P2 (entregue em seguida, workers do Antigravity CLI)
| Card | O que entrega |
|---|---|
| C13 (`rk9zvjjo3ijk`) | Relatório de frequência por turma/mês/disciplina com CSV, alerta abaixo de 75% (LDB) e os cartões "Frequência hoje" e "Alunos abaixo de 75%" no painel |
| C14 (`0nf4uvw9j7nj`) | Planejamento semanal do professor com habilidades BNCC, "Plano da semana: feito/pendente" nas aulas de hoje e comentário da coordenação no Pedagógico |
| C15 (`vpxi1u9dsmwp`) | Rematrícula e virada de ano letivo: prévia pelo boletim, decisão por aluno, turmas do novo ano, contratos pendentes de assinatura, execução única (409 se repetir) e nada do ano anterior é apagado |
| C16 (`wtdcvuku3k5s`) | "Recado à família" direto da chamada, com link para a conversa; o professor só fala com famílias das próprias turmas |
| C17 | Mensagem privada escolhida por turma → aluno, mostrando quem recebe; Financeiro só consulta contratos; termos de TI achados na varredura do texto renderizado |

## Próximas funções

| Card Kanbn | Função | Observação |
|---|---|---|
| `zb4kwwrz2mkx` | Integrações reais por adapter: SMTP, push VAPID, Cora, NFS-e, WhatsApp | Exigem credencial e custo da escola; confirmar com o dono do projeto |
| — | Mensagem privada para todos os responsáveis do aluno (pai e mãe) | Hoje vai para o responsável principal; exige mudar o destinatário único de `mensagens_agenda` |

## Dívida técnica que não bloqueia o uso
- Três arquivos de handler acima de ~700 linhas (boa parte é teste): `auth/mod.rs`, `professor.rs`, `regulatorio_ia/evasao/mod.rs`.
- `cargo clippy --all-targets` ainda falha em código de teste (o CI usa sem `--all-targets`).
- B10 (tokens em cookie HttpOnly) aguarda decisão do dono do projeto.

## Fora de escopo por enquanto
Biblioteca, transporte escolar, portaria/catraca, leitora ótica de gabaritos, reconhecimento facial (proibido como obrigatório para frequência, ver `AGENTS.md`).
