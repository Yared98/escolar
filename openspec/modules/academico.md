# Especificação de Negócio: Módulo Gestão Acadêmica (`openspec/modules/academico.md`)

## 0. Estado real do produto (leitura obrigatória)

O módulo cobre o **Diário de Classe Digital PWA (offline-first)**, o **Boletim Avaliativo Bimestral/Trimestral**, a **Matriz Curricular BNCC** e o **Controle de Horários Semanal Anti-Choque**.
O processo avaliativo opera pelo lançamento de notas por período letivo e faltas.

**Código típico (backend):** `backend/src/handlers/academico/**` (diário, boletim, TRI, matriz curricular, horários e infantil), `backend/src/handlers/professor.rs` (Meu dia e notas).

| Capacidade | Status |
|---|---|
| Diário de Classe PWA Offline-First (Dexie.js / IndexedDB) | Implementado |
| Sincronização automática com fila Outbox (`pending_sync`) | Implementado |
| Consulta e Lançamento do Dia (Presenças P/F/J, Conteúdo, Observação) | Implementado |
| Boletim Consolidado (Médias bimestrais, faltas e frequência LDB 75%) | Implementado |
| Catálogo BNCC com auto-seed dinâmico | Implementado |
| Matriz Curricular da Turma & Atribuição Docente | Implementado |
| Grade Horária Semanal Anti-Choque Triplo (Turma, Docente, Sala) | Implementado |
| Tela "Meu dia" do professor (aulas de hoje + atalhos) | Implementado |
| Lançamento de notas por turma/disciplina/período no celular | Implementado |
| Fechamento de bimestre/trimestre e bloqueio 409 no lançamento de notas | Implementado |
| Conselho de classe (parecer e encaminhamento por aluno/período) | Implementado |
| Planejamento semanal de aulas com BNCC e comentário da coordenação | Implementado |
| Navegação inferior mobile para todos os perfis | Implementado |
| Simulados TRI (cadastro de itens a/b/c + apuração de gabarito via API/UI) | **Parcial** — endpoints e aba em `PedagocioNutricaoSection`; sem leitora física |
| Leitora Ótica de Gabaritos Físicos (hardware/scan) | **Fora de escopo MVP** |
| Banco TRI “produção ENEM” / calibração estatística avançada | **Fora de escopo MVP** (parâmetros a/b/c manuais no cadastro do simulado) |

---

## 1. Diário de Classe Digital PWA (Offline-First)
- **Modo Offline**: Permitir lançamento de faltas e conteúdo ministrado no PWA sem conexão via Dexie.js e IndexedDB local (`sync_events` com status `pending_sync`). A fila sincroniza automaticamente ao reconectar.
- **Sincronização Assíncrona**: Envio do lote com remoção por UUID após confirmação do servidor. Escrita canônica: `POST /api/v1/academico/diario/sync` (upsert por `tenant_id + turma_id + data_aula + disciplina_id`).
  - Request Body:
  ```json
  {
    "turma_id": "UUID",
    "data_aula": "YYYY-MM-DD",
    "disciplina_id": "UUID (opcional — diário da aula; sem ele, diário do dia inteiro)",
    "horario_id": "UUID (opcional — referência do horário da grade)",
    "conteudo_ministrado": "String",
    "observacao": "String (até 4000 caracteres)",
    "presencas": [
      { "aluno_id": "UUID", "status": "presente" | "falta" | "justificada" }
    ]
  }
  ```
  - **Chave do upsert**: com `disciplina_id`, a chave é `turma + data + disciplina` — cada professor grava a chamada da própria disciplina sem sobrescrever a dos colegas. Sem `disciplina_id`, a chave é `turma + data` com `disciplina_id IS NULL` (diário do dia inteiro, usado pela Educação Infantil e Fundamental I).
  - **Regra de atribuição**: professor só grava diário com `disciplina_id` se tiver atribuição em `turma_professores` para aquela turma+disciplina; gestor e admin estão livres.
- **Consulta do dia**: `GET /api/v1/academico/diario?turma_id=&data_aula=&disciplina_id=` devolve `{ encontrado: bool, conteudo_ministrado, observacao, presencas, disciplina_id, disciplina_nome, hora_inicio, hora_fim }`. `disciplina_id` é opcional; sem ela, busca o diário do dia inteiro.
- **Histórico da turma**: `GET /api/v1/academico/diario/recentes?turma_id=&disciplina_id=&limit=` lista os últimos diários da turma, com `disciplina_id`/`disciplina_nome` em cada item. Com `disciplina_id`, filtra apenas os diários daquela disciplina.
- **Diferenciação por Etapa**: Turmas da Educação Infantil abrem a visão integrada com rotina infantil; turmas do Fundamental/Médio abrem a pauta de frequência e conteúdo.
- **Roster canônico**: a lista de alunos do Diário vem de `GET /secretaria/turmas/:turma_id/alunos` (vínculo ativo + aluno `ativo`) — **não** há entidade paralela. O Pedagógico usa o mesmo endpoint para exibir alunos enturmados; cadastro, ciclo de vida e prontuário ficam na Secretaria.
- **Celular / professor**: o Diário pode ser aberto diretamente a partir da tela "Meu dia" (`route=academico&turma=<id>&data=<YYYY-MM-DD>`). A lista de turmas do professor no Diário vem de `GET /api/v1/professor/minhas-turmas`; gestores/administradores continuam usando `GET /api/v1/secretaria/turmas`.
- **Conteúdo da aula**: o campo "Conteúdo Ministrado" aceita string vazia. O seletor falso de "Horário (referência local)" foi removido; o histórico mostra "Conteúdo não informado" quando nenhum conteúdo foi preenchido.

---

## 2. Apuração Avaliativa & Boletim Consolidado

- **Boletim Consolidado Multi-Período (`GET /api/v1/academico/boletim/:aluno_id`)**:
  - Consolida notas dos bimestres/trimestres por disciplina, calcula média aritmética/ponderada e apura a frequência presencial consolidada (LDB 75%).
  - **Situação (`status_aprovacao`)**: o resultado final (`Aprovado` com média ≥ 7 e frequência ≥ 75%, `Em Recuperação` com média ≥ 5, senão `Reprovado`) só é calculado quando todas as disciplinas têm os quatro bimestres lançados. Antes disso a API devolve `Em andamento` ou `Em andamento (precisa de atenção)` (abaixo da média ou da frequência), e `Sem notas lançadas` quando não há nota. O portal da família mostra os quatro bimestres e, por disciplina, "Na média" / "Abaixo da média".
  - **Frequência por disciplina**: `frequencia_pct` de cada disciplina usa as presenças dos diários lançados com `disciplina_id` daquela disciplina; disciplinas sem diário próprio (ex: Fundamental I, que usa o diário do dia inteiro) mantêm a frequência geral.
  - Retorna status de aproveitamento ("Aprovado", "Em Recuperação", "Reprovado").
  - Guarda de propriedade estrita: aluno ou responsável só acessam seus próprios registros (`check_aluno_ownership`).
  - Response 200 OK:
  ```json
  {
    "aluno_id": "UUID",
    "ano_letivo": 2026,
    "frequencia_global_percentual": 92.5,
    "situacao_final": "Aprovado",
    "disciplinas": [
      {
        "disciplina_id": "UUID",
        "nome": "Matemática",
        "notas": { "1_bimestre": 8.5, "2_bimestre": 7.0, "3_bimestre": 9.0, "4_bimestre": 8.0 },
        "media_final": 8.1,
        "faltas_total": 4
      }
    ]
  }
  ```
- **Lançamento de Notas por Turma/Disciplina**:
  - `GET /api/v1/academico/notas?turma_id=&disciplina_id=&periodo=`
    - Papéis: `professor` (só se atribuído à turma+disciplina em `turma_professores`), `gestor`, `admin`, `secretaria`.
    - Retorna os alunos ativos enturmados, com `numero_chamada` e a nota do período na disciplina (chave canônica é `disciplinas.nome`).
    - Response 200 OK: `[{ aluno_id, aluno_nome, numero_chamada, nota }]`, ordenado por número de chamada e nome.
  - `POST /api/v1/academico/notas/lote`
    - Papéis: `professor` (mesma regra de atribuição), `gestor`, `admin`.
    - Request Body:
    ```json
    {
      "turma_id": "UUID",
      "disciplina_id": "UUID",
      "periodo": "1_bimestre",
      "notas": [
        { "aluno_id": "UUID", "nota": 8.5 }
      ]
    }
    ```
    - Validações: `periodo` deve estar na lista (`1_bimestre`, `2_bimestre`, `3_bimestre`, `4_bimestre`, `1_trimestre`, `2_trimestre`, `3_trimestre`, `recuperacao`); nota entre 0 e 10 (arredondada para 2 casas); aluno enturmado na turma; lista não vazia e máximo 200 itens; `nota: null` ignora o aluno.
    - Upsert por `tenant_id + aluno_id + disciplina_nome + periodo`; se houver duplicatas antigas, todas são atualizadas.
    - **Bloqueio 409**: se o período estiver fechado para a turma (`fechamentos_periodo`), o endpoint retorna `409 Conflict` com a mensagem "O {período} desta turma está fechado. Peça à coordenação para reabrir.". Gestores e administradores também são bloqueados — precisam reabrir o período antes de alterar notas.
    - Response 200 OK: `{ gravadas: n, ignoradas: m }`.
    - Gera `audit_logs` com ação `NOTAS_LOTE`.

- **Fechamento de Período e Conselho de Classe**:
  - `GET /api/v1/academico/fechamentos?turma_id=` → lista todos os períodos válidos indicando se estão fechados, quem fechou e quando. Papéis: `gestor`, `admin`, `secretaria`, `professor` (leitura).
  - `POST /api/v1/academico/fechamentos` `{ turma_id, periodo }` → fecha o período para a turma. Papéis: `gestor`, `admin`, `secretaria`. Gera `audit_logs` (`FECHAMENTO_PERIODO`).
  - `DELETE /api/v1/academico/fechamentos/:id` → reabre o período. Papéis: `gestor`, `admin`, `secretaria`. Gera `audit_logs` (`REABERTURA_PERIODO`).
  - `GET /api/v1/academico/conselho?turma_id=&periodo=` → alunos ativos da turma com média do período (média aritmética das notas lançadas) e parecer existente. Papéis: `gestor`, `admin`, `secretaria`, `professor` (desde que atribuído à turma em qualquer disciplina).
  - `PUT /api/v1/academico/conselho` `{ turma_id, periodo, aluno_id, parecer, encaminhamento? }` → salva ou atualiza o parecer do conselho para o aluno no período. `parecer` é obrigatório e aceita até 2000 caracteres; `encaminhamento` é opcional e deve ser `recuperacao`, `acompanhamento` ou `sem_pendencias`. Papéis: `gestor`, `admin`, `secretaria`, `professor` (desde que atribuído à turma em qualquer disciplina).
  - O boletim (`GET /api/v1/academico/boletim/:aluno_id`) passa a incluir `periodos_fechados: [..]` e `pareceres: [{periodo, parecer, encaminhamento}]`, permitindo que a família veja a situação de cada período e os pareceres registrados.
  - A UI do Pedagógico ganha a aba "Fechamento e conselho" (`tabKey: 'fechamento'`) para escolher turma, fechar/reabrir períodos e registrar pareceres por aluno. A tela de lançamento de notas mostra aviso e desabilita o salvamento quando o período selecionado está fechado.

- **API do Professor (mobile)**:
  - `GET /api/v1/professor/minhas-turmas`
    - Papéis: `professor`, `gestor`, `admin`, `secretaria`.
    - Professor: turmas em que possui atribuição em `turma_professores`, com as disciplinas dele.
    - Gestor/admin/secretaria: todas as turmas ativas, com toda a matriz curricular (`turma_disciplinas`).
    - Response 200 OK: `[{ turma_id, turma_nome, etapa_ensino, total_alunos, disciplinas: [{ disciplina_id, disciplina_nome }] }]`, ordenado por nome da turma.
  - `GET /api/v1/professor/aulas?data=YYYY-MM-DD`
    - Papéis: `professor`, `gestor`, `admin`.
    - Data opcional; padrão = hoje no fuso `America/Sao_Paulo`.
    - Aulas da grade (`horarios_turma`) no dia da semana correspondente (1=segunda … 6=sábado; domingo retorna lista vazia).
    - Professor logado vê apenas suas aulas; gestor/admin podem filtrar por `professor_id` opcional; sem o parâmetro, veem todas as aulas do dia.
    - `chamada_registrada` considera a disciplina da aula: existe chamada se houver diário com aquele `disciplina_id` na turma e data, ou diário do dia (sem disciplina) — assim a aula de Matemática não é marcada como feita pela chamada de Português.
    - Response 200 OK: `[{ horario_id, turma_id, turma_nome, disciplina_id, disciplina_nome, sala_nome, hora_inicio, hora_fim, chamada_registrada }]`, ordenado por `hora_inicio`.

- **UI do Professor (`ProfessorSection.tsx`)**:
  - Orquestra as abas "Aulas de hoje" e "Lançar notas".
  - "Aulas de hoje" consome `GET /api/v1/professor/aulas?data=` e mostra cartões por aula com horário, turma, disciplina, sala e selo de chamada feita/pendente. O botão "Fazer chamada" abre o Diário com `route=academico&turma=&data=&disciplina=&horario=`, levando a aula (disciplina e horário da grade).
  - "Minhas turmas" consome `GET /api/v1/professor/minhas-turmas` e oferece atalhos para chamada (diário do dia inteiro) e notas.
  - "Lançar notas" consome `GET /api/v1/academico/notas` e envia alterações via `POST /api/v1/academico/notas/lote`; valida notas entre 0 e 10, aceita vírgula como separador decimal e pede confirmação ao trocar turma/disciplina/período com alterações não salvas.
- **Diário por aula/disciplina (`ChamadaPanel.tsx`)**:
  - Com `disciplina_id` na URL, o cabeçalho mostra "Turma · Disciplina · horário" e o painel grava/carrega o diário daquela disciplina (inclusive na fila offline, que já salva o payload inteiro).
  - Sem disciplina na URL, o comportamento é o de sempre: diário do dia inteiro da turma. A troca manual de turma no Diário sai do contexto da aula.
  - Turmas de Educação Infantil não mudam: seguem no diário do dia integrado com rotina infantil.
  - **Observação do aluno**: no Fundamental, cada aluno tem o botão "Observação" (44px de altura no celular), que abre o modal de registro. O botão mostra um contador quando o aluno já tem observação registrada na data do diário. A chamada de API (`POST /agenda/ocorrencias` e a contagem por turma/data) fica em `AcademicoSection.tsx`; `ChamadaPanel.tsx` e `OcorrenciaModal.tsx` só exibem e recebem callbacks por props. Regras e contrato completo em `openspec/modules/agenda_calendario.md`.

- **Simulados TRI (parcial)**:
  - `POST/GET /api/v1/academico/simulados`: cria/lista simulados com itens e parâmetros a/b/c manuais.
  - `POST /api/v1/academico/apuracao-gabarito`: apura respostas e estima theta/escala ENEM in-process.
  - `GET /api/v1/academico/simulados/:id/resultados/:aluno_id`: consulta resultado.
  - UI: aba de motor TRI em `PedagocioNutricaoSection` (sem integração com leitora ótica física).

---

## 3. Catálogo BNCC, Matriz Curricular & Atribuição Docente

- **Catálogo de Componentes Curriculares da BNCC (`disciplinas`)**:
  - Cadastro de componentes com `codigo` (ex: `BNCC-MAT-01`), `nome`, `area_conhecimento` e cargas horárias.
  - Auto-seed dinâmico das disciplinas base caso a escola ainda não possua registros.
  - Endpoints: `GET /api/v1/academico/disciplinas`, `POST /api/v1/academico/disciplinas`, `PUT /api/v1/academico/disciplinas/:id`, `DELETE /api/v1/academico/disciplinas/:id`.
- **Matriz Curricular por Turma (`turma_disciplinas`)**:
  - Associação de componentes curriculares a turmas.
  - Endpoints: `GET /api/v1/academico/turmas/:turma_id/disciplinas`, `POST /api/v1/academico/turmas/:turma_id/disciplinas`, `DELETE /api/v1/academico/turmas/:turma_id/disciplinas/:disciplina_id`.
  - UI Pedagógico (`PedagocioNutricaoSection`): além da matriz/grade, exibe o roster da turma via `GET /secretaria/turmas/:id/alunos` (sem cadastro duplicado de aluno).
- **Atribuição Docente (`turma_professores`)**:
  - Alocação de professores por turma e componente curricular.
  - Endpoints: `GET /api/v1/academico/turmas/:turma_id/professores`, `POST /api/v1/academico/turmas/:turma_id/professores`, `DELETE /api/v1/academico/turmas/:turma_id/professores/:atribuicao_id`.
- **Grade Horária Semanal Anti-Choque Triplo (`horarios_turma`)**:
  - Grade com dias da semana (1: Segunda a 7: Domingo), hora de início e término (`HH:MM`).
  - Motor de validação intervalar `max(inicio_1, inicio_2) < min(fim_1, fim_2)` contra:
    1. **Choque de Turma**: Duas aulas simultâneas na mesma turma.
    2. **Choque de Docente**: Mesmo professor em duas turmas no mesmo horário.
    3. **Choque de Sala**: Duas turmas ocupando o mesmo espaço físico simultaneamente.
  - Endpoints: `GET /api/v1/academico/turmas/:turma_id/horarios`, `POST /api/v1/academico/turmas/:turma_id/horarios`, `DELETE /api/v1/academico/turmas/:turma_id/horarios/:horario_id`.

---

## 4. Portal do Aluno & Responsáveis (Área Acadêmica)
- **Seletor de Dependentes**: Alternância ágil entre filhos cadastrados via `GET /api/v1/secretaria/alunos/meus`.
- **Boletim & Desempenho**: Exibição das notas, frequência calculada e pareceres bimestrais.
- **Grade de Horários**: Visualização da agenda semanal de aulas do estudante.
- **Provas e Trabalhos**: aba "Provas e trabalhos" (`tabKey: portal_avaliacoes`) lista, em ordem de data, as avaliações das turmas dos filhos, com título, tipo (prova, trabalho ou atividade), turma, disciplina, data e orientações do professor. Somente leitura — criação e remoção são do professor, da gestão ou da administração (contrato em `openspec/modules/agenda_calendario.md`).
- **Observações da escola**: aba "Observações" (`tabKey: portal_ocorrencias`) lista as ocorrências do estudante selecionado, da mais recente para a mais antiga, com tipo amigável (Comportamento, Atraso, Falta de material, Saúde, Elogio, Outros), data/hora e descrição. Disponível para **qualquer etapa** de ensino, não só Educação Infantil. Somente leitura: a família não cria nem edita observações e não há ação de "marcar como lida".

## 5. Planejamento Semanal de Aulas (BNCC & Acompanhamento da Coordenação)

- **Consulta e Normalização Semanal**: `GET /api/v1/planos-aula?turma_id=&disciplina_id=&semana=YYYY-MM-DD`.
  - Normaliza qualquer data enviada no parâmetro `semana` para a **segunda-feira** da respectiva semana (`normalizar_para_segunda_feira`).
  - Se `disciplina_id` for informado, retorna o plano da disciplina específica naquela semana (0 ou 1 item).
  - Se omitido (usado pela Coordenação no Pedagógico), retorna todos os planos lançados para aquela turma na semana.
  - Papéis autorizados: `professor`, `gestor`, `admin`, `secretaria`.
- **Lançamento e Upsert**: `PUT /api/v1/planos-aula`
  - Upsert atômico indexado por `(tenant_id, turma_id, disciplina_id, semana_inicio)`.
  - Regra de atribuição: usuários com perfil `professor` só podem lançar planos para turmas e disciplinas onde possuem atribuição ativa em `turma_professores` (validado via `professor_pode_lancar`), retornando `403 Forbidden` caso contrário. Gestores e administradores podem salvar planos livremente.
  - Campos do formulário:
    - `objetivos`: texto obrigatório (máx 5000 caracteres);
    - `conteudos`: texto obrigatório (máx 5000 caracteres);
    - `habilidades_bncc`: lista de códigos BNCC (máx 50 itens de até 50 caracteres cada);
    - `atividades`: metodologia e atividades da semana (máx 5000 caracteres);
    - `avaliacao`: critérios de avaliação (opcional, máx 2000 caracteres).
  - Preservação de comentários: o upsert do professor preserva o `comentario_coordenacao` previamente registrado.
- **Comentário Pedagógico da Coordenação**: `PUT /api/v1/planos-aula/:id/comentario`
  - Permissão restrita: apenas `gestor`, `admin` e `secretaria` (`check_roles`). Tentativa de professor resulta em `403 Forbidden`.
  - Validação: campo `comentario` obrigatório com até 2000 caracteres.
  - Gera registro de auditoria (`log_audit` com ação `COMENTARIO_PLANO_AULA`).
- **Indicador no Meu Dia do Professor**:
  - Os cartões de "Aulas de hoje" (`/api/v1/professor/aulas`) incluem o campo `plano_semana_feito: bool`.
  - A interface exibe selos informativos lado a lado: status da chamada e "Plano da semana: feito/pendente".
- **Painel de Gestão Pedagógica**:
  - Aba "Planos de aula" em `PedagocioNutricaoSection.tsx` (`pedagogico/PlanosAulaPanel.tsx`), permitindo que a coordenação filtre por turma e navegue pelas semanas (‹ anterior / próxima ›) para ler os planos e registrar seus comentários de acompanhamento.

---

## 6. Mapa de código (frontend)

Organização após o refactor B12 (só moveu código, sem mudança de regra):

- `PedagocioNutricaoSection.tsx` orquestra o Pedagógico (estado, carregamento, handlers, abas); `frontend/src/components/pedagogico/` só exibe, via props: `MatrizPanel`, `HorariosPanel`, `TriPanel`, `ProjetosPanel`, `FechamentoPanel`, `PlanosAulaPanel` e os modais `NovaDisciplinaModal`, `AdicionarMatrizModal`, `AtribuirProfessorModal`, `NovoHorarioModal`, `NovoSimuladoModal`.
- `PortalAlunoSection.tsx` orquestra o Portal do Aluno; `frontend/src/components/portal_aluno/` só exibe: `BoletimTab`, `DiplomaTab`, `FinanceiroTab`, `RotinaTab`, `AvaliacoesTab`, `OcorrenciasTab` e `PixModal` (separado do Pix do Financeiro).
- `ProfessorSection.tsx` orquestra a área do professor ("Meu dia"); `frontend/src/components/professor/` só exibe: `AulasHojePanel`, `PlanejamentoPanel`, `LancarNotasPanel` e `AvaliacoesPanel`.
- `MobileBottomNav.tsx` exibe a barra de navegação inferior no celular para todos os perfis.
- O gate de spec (`scripts/check-agent-gates.mjs`) associa `pedagogico/**`, `portal_aluno/**`, `ProfessorSection.tsx`, `MobileBottomNav.tsx`, `academico/ChamadaPanel.tsx` e `academico/useTurmaAlunos.ts` a este módulo.
- Observações do aluno: `AcademicoSection.tsx` orquestra a chamada de API e a contagem por aluno; `academico/OcorrenciaModal.tsx` e `academico/ChamadaPanel.tsx` só exibem (props e callbacks). Tipos amigáveis e o mapeamento de prioridade ficam em `frontend/src/lib/types/academico.ts`.

## 7. Limitações MVP

- O cálculo de "hoje" para `/api/v1/professor/aulas` usa UTC-3 fixo (`America/Sao_Paulo` sem biblioteca de timezone), o que pode divergir em 1h durante o horário de verão brasileiro.
- A tabela `notas` é indexada pelo **nome** da disciplina (campo `disciplina_nome`), não pelo `disciplina_id`; renomear uma disciplina após lançamentos pode desvincular histórico. Ajustar a chave para `disciplina_id` é melhoria futura.
- O lançamento em lote não valida se a disciplina faz parte da matriz da turma; apenas exige atribuição docente (para professores) ou permissão de gestão.
- O diário sem `disciplina_id` continua sendo por **turma e dia** (`disciplina_id IS NULL`): é o registro do dia inteiro usado pela Educação Infantil e Fundamental I, e nele a última chamada salva prevalece sobre as anteriores.
- **Planejamento de aulas e catálogo BNCC**: caso a escola não possua componentes cadastrados na BNCC centralizada, os códigos de habilidades são informados manualmente separados por vírgula (ex: EF06MA07, EF06MA08). O comentário da coordenação não dispara notificações em tempo real (push/e-mail) para o professor; o feedback é visualizado ao abrir a semana correspondente no painel de planejamento.
- **Avaliações no calendário**: a disciplina da prova/trabalho mora em `eventos_calendario.disciplina_id`. Eventos criados antes dessa coluna (ou pela gestão, que não a preenche) ficam com disciplina nula e a família vê a avaliação sem o nome da disciplina. Marcar uma avaliação não avisa ninguém automaticamente: não há push, e-mail ou WhatsApp disparados, apenas a listagem no portal. Regras e contrato completos em `openspec/modules/agenda_calendario.md`.
- **Observações do aluno (ocorrências)**: o professor só registra observação para aluno de turma em que tem atribuição (`turma_professores`) ou da qual é regente (`turmas.professor_regente_id`); sem vínculo a API devolve 403. Um professor regente sem linha em `turma_professores` enxerga e registra as ocorrências da turma, mas continua sem acesso ao restante do diário de outros professores.
- **Prioridade não é escolhida por quem registra**: no Diário do Fundamental a prioridade é derivada do tipo (elogio → baixa; atraso e falta de material → média; comportamento e saúde → alta). A rotina da Educação Infantil continua gravando `urgente`, como antes.
- **Sem aviso automático à família**: a observação não dispara push, e-mail ou WhatsApp; `notificado_responsavel` apenas registra a intenção do aviso. A coluna `lido_pelo_responsavel` existe no banco, mas não há rota para a família marcar a leitura — o portal não mostra selo de "lido".
- **Ocorrências no celular sem internet**: o registro de observação exige conexão (não entra na fila offline do diário); se falhar, o modal mostra o erro e nada é gravado.
- **Fechamento e conselho**: a reabertura exige o `id` do registro de `fechamentos_periodo`; a UI lista os fechamentos e descobre o id automaticamente. A média do conselho é a média aritmética simples das notas do período (não ponderada por carga horária). Não há notificação automática para a família quando um parecer é registrado.

