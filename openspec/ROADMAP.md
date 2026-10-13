# Roadmap — do demo ao uso real na escola

Planejamento das funções ausentes ou incompletas, levantado na revisão ponta a ponta de 2026-10-13 e atualizado ao fim da Onda C (main `8615c34`).
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

## Próximas funções (P2 — com cards no Backlog do Kanbn)

| Card Kanbn | Função | Observação |
|---|---|---|
| `rk9zvjjo3ijk` | Relatórios de frequência por turma/mês, exportação e alerta abaixo de 75% (LDB) | Devolve ao painel o cartão "Frequência hoje" com número real |
| `0nf4uvw9j7nj` | Planejamento de aulas do professor (plano semanal com BNCC) | Aparece em "Meu dia" junto da aula |
| `vpxi1u9dsmwp` | Rematrícula e virada de ano letivo | Usa o resultado final do boletim (C9) |
| `wtdcvuku3k5s` | Recado do professor para a família de um aluno direto da chamada | Abre conversa privada nos Recados (C12) |
| `zb4kwwrz2mkx` | Integrações reais por adapter: SMTP, push VAPID, Cora, NFS-e, WhatsApp | Exigem credencial e custo da escola; confirmar com o dono do projeto |

## Dívida técnica que não bloqueia o uso
- Três arquivos de handler acima de ~700 linhas (boa parte é teste): `auth/mod.rs`, `professor.rs`, `regulatorio_ia/evasao/mod.rs`.
- `cargo clippy --all-targets` ainda falha em código de teste (o CI usa sem `--all-targets`).
- B10 (tokens em cookie HttpOnly) aguarda decisão do dono do projeto.

## Fora de escopo por enquanto
Biblioteca, transporte escolar, portaria/catraca, leitora ótica de gabaritos, reconhecimento facial (proibido como obrigatório para frequência, ver `AGENTS.md`).
