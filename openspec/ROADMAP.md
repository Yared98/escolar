# Roadmap — do demo ao uso real na escola

Planejamento das funções ausentes ou incompletas, levantado na revisão ponta a ponta de 2026-10-13 (branch `onda-c/base`).
Fonte de verdade do que JÁ existe continua sendo cada `openspec/modules/*.md` (seção "Estado real"). Este arquivo só ordena o que falta.

Critério de prioridade: **P0** impede uma escola de usar o sistema no dia a dia; **P1** a escola sente falta no primeiro bimestre; **P2** melhora, mas tem alternativa manual.

## Onda C — em execução (cards no Kanbn)

| Card | O que entrega | Por que é P0 |
|---|---|---|
| C1 | API do professor: minhas turmas, aulas do dia, consulta e lançamento de notas em lote | A spec previa `POST /academico/notas/lote`, mas a rota não existia: o professor não tinha como lançar nota |
| C2 | Tela "Meu dia" do professor no celular, lançamento de notas, chamada sem campos falsos, barra de navegação inferior para todos os perfis | O professor usa o celular entre aulas; antes caía num painel de gestão e via todas as turmas da escola |
| C3 | Linguagem de escola (sem "RBAC", "slug", "403 Forbidden", "Offline-First"…) e painel inicial por perfil | Termos de TI confundem gestor, professor e família; o painel pedia dados financeiros para perfis sem acesso |
| C4 | Usuários e acessos: a gestão cria contas (professor, secretaria, financeiro, nutrição, família), desativa e redefine senha; troca obrigatória no primeiro acesso | Só o seed e o "Cadastrar Escola" criavam usuários |
| C5 | Implantação no homelab: compose de produção, proxy na mesma origem, segredos em `.env`, backup diário | O compose atual é de desenvolvimento e o frontend apontava para `localhost:8000` |
| D2 | Números honestos: inadimplência só de vencidas, nome do aluno no risco de evasão, "sem chamadas" em vez de 0% | Números errados destroem a confiança na demonstração |

## Próximas ondas (planejado, ainda sem card executável)

### P1 — antes da primeira escola real
1. **Diário por aula/disciplina** (Fundamental II e Médio). Hoje o diário é único por turma e dia (`diarios_classe`: `tenant_id + turma_id + data_aula`); com vários professores na mesma turma e dia, a última chamada salva prevalece. Exige migration (vínculo com `horarios_turma`/disciplina) e ajuste do boletim (frequência por disciplina).
2. **Fechamento de período e conselho de classe.** Travar lançamento de notas após o fechamento do bimestre, registrar recuperação e parecer do conselho, e liberar o boletim para a família só depois do fechamento.
3. **Ocorrências e observações no Fundamental.** O backend tem `POST /agenda/ocorrencias`, mas a tela só existe na rotina da Educação Infantil. Levar para o Diário (por aluno, com aviso opcional à família).
4. **Documentos da secretaria.** Declaração de matrícula, declaração de frequência e histórico escolar em PDF com dados reais da escola.
5. **Recuperação de senha por e-mail.** Hoje (C4) a escola gera senha temporária e entrega em mãos. Exige provedor de e-mail via Adapter + variável de ambiente (simulado por padrão).
6. **Calendário de avaliações por turma**, visível para professor e família (hoje o calendário é geral da escola).

### P2 — melhorias com alternativa manual
7. **Planejamento de aulas** do professor (plano semanal ligado às habilidades BNCC já catalogadas).
8. **Relatórios de frequência** por turma e mês, com exportação (CSV/PDF), e alerta de alunos abaixo de 75% (LDB).
9. **Rematrícula e virada de ano letivo** (copiar turmas, promover alunos, novo contrato).
10. **Recado do professor para a família de um aluno específico** direto da chamada (hoje passa pelo módulo Comunicados).
11. **Integrações reais** (Pix/boleto Cora, NFS-e, WhatsApp, push com VAPID em produção): todas existem em modo simulado e dependem de credencial e custo da escola.

### Dívida técnica que não bloqueia o uso
- **B13 (dividir handlers grandes em módulos)**: pausado durante a Onda C para não conflitar com C1, C4 e D2, que mexem em `academico.rs`, `auth.rs`, `financeiro.rs` e `regulatorio_ia.rs`. Retomar depois que a Onda C entrar na `main`.
- `cargo clippy --all-targets` ainda falha em código de teste (o CI usa sem `--all-targets`).
- B10 (tokens em cookie HttpOnly) aguarda decisão do dono do projeto.

### Fora de escopo por enquanto
Biblioteca, transporte escolar, portaria/catraca, leitora ótica de gabaritos, reconhecimento facial (proibido como obrigatório para frequência, ver `AGENTS.md`).
