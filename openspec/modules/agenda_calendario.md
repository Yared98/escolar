# Especificação de Negócio: Agenda Digital, Calendário & Eventos (`openspec/modules/agenda_calendario.md`)

## 0. Estado real do produto (leitura obrigatória)

O módulo cobre o **Calendário Letivo com RSVP de Eventos**, a **Rotina Diária da Educação Infantil** e os **Recados e Comunicados Familiares**.

| Capacidade | Status |
|---|---|
| Calendário Escolar e Feriados | Implementado |
| Eventos com Confirmação de Presença (RSVP) e Acompanhantes | Implementado |
| Rotina Diária Infantil (alimentação, sesta, fraldas, ocorrências) | Implementado |
| Portfólio Pedagógico de Evidências BNCC | Implementado |
| Mensageria Escolar e Mural da Turma | Implementado |
| Push Notifications Web VAPID | Implementado via adapter (requer `VAPID_*` no ambiente; sem chaves roda em modo simulado) |
| Calendário de avaliações por turma (provas, trabalhos e atividades) | Implementado (professor marca; família consulta no portal) |
| Ocorrências e observações do aluno (Educação Infantil e Fundamental) | Implementado (registro pela escola; leitura da família no portal) |
| Disparo de WhatsApp ativo para lembretes de RSVP / comunicados | **Stub** (simulado via `processWhatsAppWebhook`; sem envio real via Meta Cloud API) |

### Limitações MVP / Detalhes de Arquitetura
- **Web Push**: Implementado com padrão Adapter (`SimulatedPushAdapter` default, `VapidPushAdapter` ativo sob `PUSH_MODE=vapid`). O backend fornece a chave pública via `GET /api/v1/notificacoes/push/vapid-public-key` lendo `VAPID_PUBLIC_KEY` do ambiente; quando não configurada, retorna HTTP 503 ("VAPID public key not configured"). Em modo `vapid`, subscriptions inválidas ou expiradas (HTTP 404/410) são removidas da tabela `push_subscriptions`. Após tentativa de envio pelo worker, a função SQL `atualizar_log_disparo` atualiza `notificacoes_disparos_logs.status_envio` para `enviado` (quando entregue via `delivered`), `simulado` (em modo simulado) ou `falhou` (após falha definitiva na 3ª tentativa).
- **WhatsApp**: Permanece em modo **Stub** (`{ status: 'simulated', provider: null }`), sem envio externo e sem custos de telefonia.
- **Calendário de avaliações**: a avaliação é gravada como evento do calendário (`eventos_calendario`) com `tipo` em `prova`, `trabalho` ou `atividade` e `visibilidade = 'todos'`. O vínculo com a disciplina usa `eventos_calendario.disciplina_id` (adicionado na migration `20261014200000_avaliacoes_turma.sql`, `ON DELETE SET NULL`); eventos criados pela gestão antes dessa coluna ficam com `disciplina_id` nulo e aparecem no calendário sem disciplina. Somente a aba "Avaliações" do professor e a aba "Provas e trabalhos" do portal da família consomem esses registros — o calendário geral da gestão continua tratando os tipos históricos (`feriado`, `ferias`, `reuniao_pais`, `festa`, `prova`).
- **Sem aviso automático**: marcar uma avaliação **não** dispara notificação automática (push, e-mail ou WhatsApp) para a família. O responsável vê a data ao abrir o portal; a escola comunica pelos canais existentes (Comunicados, WhatsApp em modo simulado). Não há lembrete agendado no worker.
- **Ocorrências sem notificação ativa**: registrar uma ocorrência/observação **não** dispara push, e-mail ou WhatsApp para a família. `notificado_responsavel` é apenas o registro de que a escola assume aquele aviso; a família lê a observação quando abre o Portal da família. Não há marcação de "lido" pela família (a coluna `lido_pelo_responsavel` existe no banco, mas não há rota para marcá-la) e não há aviso de ocorrência no worker.
- **Worker e Multi-tenancy**: O background worker Node.js (`worker/src/index.js`) consome notificações pendentes com usuário de sistema no banco (`escolar_runtime`), definindo `app.current_tenant` ao processar cada notificação. A função SQL `atualizar_log_disparo(p_tenant, p_notificacao, p_canal, p_status)` confia no parâmetro `p_tenant` fornecido pelo chamador (pois o worker executa como `escolar_runtime` sob isolamento por tenant e define `app.current_tenant`). No worker, a chamada a `atualizar_log_disparo` é envolvida em um bloco `try/catch` dedicado para garantir que uma falha ao atualizar o log de disparo nunca impeça a execução de `concluir_notificacao(id, tenant_id, status)`. A fila `JobQueue` opera em memória no processo do worker.

---

## 1. Calendário Escolar & Eventos com RSVP
- **Gestão de Eventos**:
  - Eventos categorizados: `feriado`, `ferias`, `reuniao_pais`, `festa`, `prova`.
  - Flag `exige_confirmacao_presenca`: Habilita o ciclo de RSVP para convidados.
- **Confirmação de Presença (RSVP)**:
  - O responsável responde com presença confirmada e declara o número de acompanhantes previstos.
  - Endpoints:
    - `GET /api/v1/agenda/calendario/eventos`
    - `POST /api/v1/agenda/calendario/eventos`
    - `POST /api/v1/agenda/calendario/eventos/:id/rsvp`: `{ "status": "confirmado" | "recusado" | "pendente", "acompanhantes": 2 }`
- **Privacidade da Lista**:
  - Convidado só enxerga o próprio status. Apenas a gestão e coordenação visualizam o painel consolidado com a lista completa de participantes.

---

## 2. Rotina Diária da Educação Infantil
- **Registro Individualizado por Aluno**:
  - Eventos de alimentação (tudo, metade, pouco, recusou), sono, fraldário e ocorrências.
  - Endpoint de gravação: `POST /api/v1/agenda/rotina` (upsert por aluno e data).
  - Bloqueio: Aluno registrado com falta na chamada da turma não recebe rotina (HTTP 400).
- **Consulta da Rotina da Família**:
  - `GET /api/v1/agenda/diario-infantil/:aluno_id?data=YYYY-MM-DD` consolidando presença, cardápio consumido e anotações dos educadores.

## 3. Calendário de Avaliações por Turma

Provas, trabalhos e atividades marcadas por turma, para o professor avisar a família.

- **Onde Vive o Dado**: na própria tabela `eventos_calendario`, com `tipo` em `prova`, `trabalho`, `atividade` e `visibilidade = 'todos'`. A disciplina é vinculada por `eventos_calendario.disciplina_id` (migration `20261014200000_avaliacoes_turma.sql`).
- **Contrato de API** (`/api/v1/avaliacoes`, handler `backend/src/handlers/avaliacoes.rs`):
  - `GET /api/v1/avaliacoes?turma_id=&de=&ate=` devolve, ordenado por data, itens no formato `{ id, titulo, descricao, data (YYYY-MM-DD), tipo, turma_id, turma_nome, disciplina_id, disciplina_nome }`. `turma_id`, `de` e `ate` são filtros opcionais.
  - `POST /api/v1/avaliacoes` recebe `{ turma_id, disciplina_id, titulo, descricao?, data, tipo }` e devolve o item criado. Validações: título entre 3 e 120 caracteres, `tipo` entre `prova`/`trabalho`/`atividade`, data não anterior a hoje (fuso de Brasília) e turma e disciplina ativas no mesmo contexto da escola.
  - `DELETE /api/v1/avaliacoes/:id` devolve `{ "status": "sucesso" }`.
- **Quem vê**:
  - **Professor**: somente as turmas em que tem atribuição (`turma_professores`).
  - **Gestor, administrador e secretaria**: todas as turmas.
  - **Responsável**: somente as turmas dos seus filhos com matrícula ativa (`responsaveis_alunos` / `alunos.responsavel_user_id` + `turma_alunos` ativos).
  - Como toda tabela com `tenant_id`, o resultado também é limitado pelo isolamento por escola (RLS + `TenantDb`).
- **Quem cria e quem remove**:
  - **Cria**: professor com atribuição na turma **e** na disciplina (reaproveita `professor_pode_lancar` de `handlers/professor.rs`); gestor e administrador criam em qualquer turma.
  - **Remove**: quem criou a avaliação, gestor ou administrador.
  - A secretaria **consulta**, mas não cria nem remove por este contrato.
- **Auditoria**: criar e remover gravam `audit_logs` (`CRIAR_AVALIACAO` / `DELETAR_AVALIACAO`).
- **Interface**:
  - Professor: terceira aba "Avaliações" de "Meu dia" (`ProfessorSection.tsx` orquestra; `professor/AvaliacoesPanel.tsx` exibe), com a lista das próximas avaliações das turmas dele e o formulário "Nova avaliação" (turma, disciplina, data, tipo, título e orientações, todos vindos de `/professor/minhas-turmas`).
  - Família: aba "Provas e trabalhos" do Portal da família (`PortalAlunoSection.tsx` orquestra; `portal_aluno/AvaliacoesTab.tsx` exibe), apenas leitura.

---

## 4. Ocorrências e Observações do Aluno

Registro de ocorrências individuais (tabela `ocorrencias_aluno`), usado pela rotina da Educação Infantil e, a partir desta entrega, também pelo Diário do Fundamental.

- **Tipos aceitos** (`POST /api/v1/agenda/ocorrencias`):
  - Fundamentais: `comportamento`, `atraso`, `falta_material`, `saude`, `elogio`, `outros`.
  - Educação Infantil (histórico): `febre`, `indisposicao`, `queda_arranhao`, `atrito_colega`, `outros` (e a grafia antiga `outro`).
  - O tipo é normalizado para minúsculas; tipo fora da lista devolve HTTP 400.
- **Contrato de API** (handlers `backend/src/handlers/agenda_admin/**`):
  - `POST /api/v1/agenda/ocorrencias` recebe `{ aluno_id, turma_id?, tipo_ocorrencia, descricao, prioridade?, notificado_responsavel? }` e devolve a ocorrência criada. A descrição é obrigatória (até 1000 caracteres após remover espaços) e o aluno precisa existir na escola (404 caso contrário).
  - `GET /api/v1/agenda/ocorrencias/:aluno_id` devolve as ocorrências do aluno, da mais recente para a mais antiga.
  - `GET /api/v1/agenda/ocorrencias?turma_id=&data=` devolve as ocorrências de uma turma, opcionalmente de um único dia (`data` no formato `YYYY-MM-DD`, fuso de Brasília). Serve ao Diário do Fundamental para sinalizar os alunos com observação no dia.
- **Quem registra**: `admin`, `gestor`, `secretaria` e `professor`. O professor só registra para aluno de turma em que tem atribuição (`turma_professores`) ou da qual é regente (`turmas.professor_regente_id`); sem vínculo, HTTP 403. Gestor e secretaria registram em qualquer turma da escola.
- **Quem consulta**: `admin`, `gestor`, `secretaria` e `professor` (mesma regra de vínculo) em `/agenda/ocorrencias/:aluno_id` e `/agenda/ocorrencias`. O `responsavel` consulta apenas as ocorrências dos próprios filhos (guarda `check_aluno_ownership`); outro aluno da mesma escola devolve 403. Como toda tabela com `tenant_id`, o resultado também é limitado pelo isolamento por escola (RLS + `TenantDb`).
- **Aviso à família**: `notificado_responsavel` vem do corpo da requisição, com padrão `true`. `elogio` e `saude` **sempre** avisam, mesmo que quem registre desmarque a opção. O aviso é registrado no banco — não há envio automático (ver limitações).
- **Auditoria**: criar grava `audit_logs` (`REGISTRAR_OCORRENCIA`) com aluno, turma, tipo e o aviso à família.
- **Interface**:
  - Professor: em cada aluno do Diário do Fundamental (`academico/ChamadaPanel.tsx`), o botão "Observação" abre `academico/OcorrenciaModal.tsx` (tipo, descrição obrigatória até 1000 caracteres e "Avisar a família" marcado por padrão). A chamada de API e a contagem por aluno ficam em `AcademicoSection.tsx`; o aluno com observação no dia aparece com um contador no botão. A prioridade é definida pelo tipo (elogio → baixa, atraso/falta de material → média, comportamento/saúde → alta) — o professor não escolhe prioridade.
  - Família: aba "Observações" do Portal da família (`PortalAlunoSection.tsx` orquestra; `portal_aluno/OcorrenciasTab.tsx` exibe), disponível para **qualquer etapa** (não só Educação Infantil), em ordem do mais recente para o mais antigo, com tipo amigável, data/hora e descrição.
  - A rotina da Educação Infantil mantém o fluxo próprio de "Ocorrência urgente" (`academico/InfantilRotinaPanel.tsx`), agora com os mesmos tipos aceitos pelo backend.

---

## 5. Mapa de código (frontend)

Organização após o refactor B12 (só moveu código, sem mudança de regra) e o redesenho C12 (apenas visual, sem nova regra de negócio):

- `AgendaDigitalSection.tsx` orquestra: estado, carregamento, tempo real (`useMensagensRealtime`), abas e a conversa aberta sincronizada com a URL (`&conversa=<id>`). Também detecta viewport para decidir o layout mobile/desktop.
- `frontend/src/components/agenda/` só exibe, via props:
  - `ComunicacaoPanel`: monta o layout lista + chat, com lista (`ConversasLista`) e chat (`ConversaChat`) lado a lado no desktop e uma tela por vez no celular.
  - `ConversasLista`: lista estilo WhatsApp com busca, filtros em chips, avatar, prévia, horário curto e contador de não lidas.
  - `ConversaChat`: cabeçalho fixo, balões (`BolhaMensagem`), separadores de data, caixa de envio fixa com textarea que cresce e envio por Enter no desktop.
  - `BolhaMensagem`: mensagens do usuário à direita (verde-sálvia) e dos outros à esquerda (branco), com nome, perfil amigável e horário.
  - `WhatsappPanel`: fila de atendimento WhatsApp (sem alteração no C12).
  - `ComposerModal`: criação de novo comunicado/mensagem privada. A mensagem privada (gestão, secretaria, professor) é escolhida em dois passos: **1. turma → 2. aluno · responsável** (C17). A lista de alunos vem de `GET /secretaria/alunos?status=ativo&turma_id=` só depois de escolher a turma (antes carregava os 200 primeiros alunos da escola, o que escondia famílias em escolas grandes). Turma com mais de 12 alunos mostra busca por aluno ou responsável. O professor só vê as próprias turmas (`GET /professor/minhas-turmas`).
  - Irmãos: a conversa é ligada ao aluno (`aluno_id`). Um responsável com dois filhos aparece uma vez em cada turma e recebe uma conversa por filho, o que mantém o assunto de cada criança separado.
  - **Limitação MVP:** o backend entrega ao responsável principal do aluno (`alunos.responsavel_user_id` ou o primeiro de `responsaveis_alunos`); quando pai e mãe têm acesso, só um recebe a mensagem privada. Mandar para todos os responsáveis exige mudar o modelo de destinatário único de `mensagens_agenda`.
  - `types.ts` e `utils.ts`: funções puras de formatação de horário, agrupamento por dia, detecção de mensagem própria e iniciais do nome (com testes Vitest).
- O gate de spec associa `agenda/**` a este módulo.
- As avaliações usam código próprio: `backend/src/handlers/avaliacoes.rs` no backend e `frontend/src/components/professor/AvaliacoesPanel.tsx` (orquestrado por `ProfessorSection.tsx`). A aba da família fica em `portal_aluno/AvaliacoesTab.tsx` (ver `academico.md`).