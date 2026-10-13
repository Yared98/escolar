# Especificação Técnica e Funcional: Módulo Secretaria & Prontuário Escolar (`openspec/modules/secretaria.md`)

## 0. Estado real do produto (leitura obrigatória)

O módulo cobre o **ciclo de vida completo do estudante** (matrícula com duplo responsável, validação CPF Mod11, prontuário clínico com log LGPD, enturmação, renumeração alfabética e gestão de salas).

| Capacidade | Status |
|---|---|
| Matrícula Online atômica com transação PostgreSQL | Implementado |
| Duplo Responsável (Legal e Financeiro) | Implementado |
| Integração com CRM (pré-preenchimento de matrícula via deep-link) | Implementado |
| Validação estrita de CPF (Módulo 11) e telefone | Implementado |
| Prontuário Médico e Clínico com log LGPD Art. 11/14 | Implementado |
| Contrato (minuta, listagem, assinatura digital SHA-256 e parcelamento 12x) | Implementado |
| Gestão de Turmas, Salas e Controle de Lotação | Implementado |
| Renumeração Alfabética do Livro de Chamada (1..N) | Implementado |
| Transferência Atômica entre turmas com vaga | Implementado |
| Transferência inter-escolas / inter-tenants automática | **Fora de escopo MVP** (requer nova matrícula manual) |
| Assinatura com certificado digital ICP-Brasil A1/A3 nos contratos | **Fora de escopo MVP** (utiliza assinatura eletrônica MP 2.200-2/2001 via SHA-256) |

---

- **Design System Sálvia Edition**: Estilização biofílica acolhedora com paleta Sálvia (`#52C27E` / `#2D5940`), cantos arredondados (`rounded-2xl` - 16px), modo claro/escuro sem flicker e total acessibilidade visual.
- **Navegação Modular Interna**:
  - `Alunos & Matrículas`: Visualização em tabela responsiva de alunos ativos, responsáveis (legal e financeiro), endereços, contatos de emergência e ações rápidas.
  - `Turmas & Ensalamento`: Visualização analítica da taxa de ocupação das salas (`Vagas: X / Y`), barra de progresso visual de lotação e modal de ensalamento interativo.
  - `Contratos & Parcelas`: Gestão integral de contratos educacionais, geração de minutas, assinatura eletrônica com digest SHA-256 (MP 2.200-2) e visualização das 12 parcelas Pix geradas no faturamento.
- **Barra de Ferramentas, Filtros e Ciclo de Vida**:
  - Busca server-side por nome, CPF, responsável legal/financeiro ou cidade (`GET /secretaria/alunos?q=`).
  - Filtros por status do ciclo de vida (`pre_matricula`, `ativo`, `trancado`, `transferido`, `inativo`), turma, ano letivo e “somente sem turma”.
  - Paginação (`page`/`limit`) com envelope `{ items, total, page, page_size, contagem_status }` e coluna de turma atual.
  - Ações de ciclo de vida na UI (ativar, trancar, transferir, inativar/reativar) via `PUT /secretaria/alunos/:id` com status validado.
  - Criação com situação inicial `ativo` ou `pre_matricula`.
  - Filtros server-side e UX reativa na aba Turmas: endpoint `GET /secretaria/turmas?q=&ano_letivo=&turno=&status=` suporta busca textual (`q` ou `busca` cobrindo nome, código, série e etapa de ensino), filtro por ano letivo (`ano_letivo`), filtro por turno (`turno`) e status, com ordenação por ano letivo decrescente e nome alfabético. No frontend, interface padrão Sálvia com busca debounced (350ms), dropdowns de ano letivo e turno, indicador de status de busca no servidor, contador de turmas encontradas, botão para redefinir filtros e estados de lista vazia diferenciados (com ou sem filtros ativos).

## 2. Nova Matrícula Online & Cadastro Integral do Estudante
- **Validações Documentais & Anti-Fraude**:
  - Validação estrita de CPF brasileiro no backend (`validar_cpf_brasileiro`) calculando os 2 dígitos verificadores via Módulo 11 oficial da Receita Federal.
  - Validação de formato telefônico/WhatsApp com DDD (`validar_telefone_brasileiro`).
  - Prevenção ativa de duplicidade de CPF por tenant: verificação preliminar retornando HTTP 409 Conflict (`UserAlreadyExists`) sem gerar inconsistência no banco de dados.
- **Duplo Responsável (Legal & Financeiro)**:
  - **Responsável Legal**: Nome, CPF, e-mail, telefone/WhatsApp e parentesco (pátrio poder e representação perante a instituição).
  - **Responsável Financeiro**: Nome, CPF, e-mail, telefone e parentesco (responsável financeiro por faturas, boletos e NFS-e).
  - **Flag `responsavel_financeiro_igual_legal`**:
    - Quando ativa (`true`), espelha automaticamente os dados do responsável legal no financeiro (cenário de pai solo, mãe solo ou responsável único).
    - Quando desativada (`false`), permite cadastro e gestão segregada para pais separados, tutores ou patrocinadores terceiros.
- **Integração CRM → Matrícula (Deep-link & Pré-preenchimento)**:
  - Detecção automática de query parameters (`route=secretaria&tab=alunos&nova_matricula=1`).
  - Pré-população imediata dos campos de identificação do Aluno (`lead_aluno` ou `lead_nome`) e Responsável Legal (`lead_nome`, `lead_telefone`, `lead_email`), espelhando para o financeiro quando a unificação estiver ativa.
  - Exibição de banner contextual informando a importação direta a partir do pipeline comercial de captação.
- **Endereço Residencial Completo**:
  - Armazenamento estruturado de CEP, logradouro, número, complemento, bairro, cidade e UF do estudante.
- **Contatos Adicionais & Emergência**:
  - Telefone secundário/recado e cadastro de pessoa de emergência (`contato_emergencia_nome`, `contato_emergencia_telefone`, `contato_emergencia_parentesco`) para acionamento imediato pela equipe pedagógica e de primeiros socorros.
- **Persistência Atômica & Auditoria**:
  - Operação sob transação única PostgreSQL (`sqlx::Transaction`): grava a entidade `alunos`, inicializa o registro na tabela `prontuarios` e cria o vínculo em `responsaveis_alunos` de forma indivisível (`tx.commit().await?`).
  - Rastreabilidade de auditoria: emissão de log `CRIAR_MATRICULA` vinculando usuário operador, tenant, identificador do aluno e metadados.

## 3. Prontuário Médico & Cuidado Clínico Estruturado
- **Repositório Unificado & Conformidade LGPD**:
  - Consulta protegida por RBAC e Ownership Guard (`GET /api/v1/secretaria/prontuarios/:aluno_id`): bloqueia acessos IDOR com HTTP 403 Forbidden caso o responsável requisitante não possua tutela legal ativa sobre o aluno.
  - Rastreabilidade mandatória (Art. 11 e 14 LGPD): registro de cada consulta de dados sensíveis na tabela `audit_logs` (`CONSULTAR_PRONTUARIO`).
- **Campos Clínicos Estruturados**:
  - `tipo_sanguineo`: Tipo sanguíneo normatizado (A+, A-, B+, B-, AB+, AB-, O+, O-, Não informado).
  - `alergias`: Histórico de alergias medicamentosas, alimentares e sazonais.
  - `restricoes_alimentares`: Diretrizes de restrição para integração com a cantina e equipe de nutrição.
  - `medicamentos_continuos`: Relação de fármacos de uso diário.
  - `cuidados_especiais`: Recomendações pedagógicas e clínicas personalizadas.
  - `historico_observacoes`: Registro comportamental, laudos e ocorrências.
- **Edição & Atualização Contínua do Prontuário**:
  - Endpoint `PUT /api/v1/secretaria/prontuarios/:aluno_id`: permite à secretaria, equipe médica e nutricionistas atualizar o prontuário em tempo real via UPSERT idempotente com log de auditoria `ATUALIZAR_PRONTUARIO`.
  - No frontend: interface visual modal acolhedora com modo visualização e modo edição inline (`Save`/`Edit3`), exibindo cartões de alerta destacado (`AlertTriangle`) em caso de riscos clínicos.

## 4. Contratos com Assinatura Eletrônica (MP 2.200-2/2001) & Automação Financeira
- **Geração, Consulta e Assinatura Digital**:
  - Geração de minuta (`POST /secretaria/contratos` ou `/api/v1/secretaria/contratos`) vinculada a tenant, aluno, ano letivo e anuidade total com status inicial `pendente_assinatura`.
  - Listagem de contratos (`GET /secretaria/contratos?aluno_id=`): lista contratos ordenados por data decrescente com dados do estudante (`aluno_nome`, `aluno_cpf`) e contagem de faturas associadas (`total_parcelas`).
  - Consulta detalhada (`GET /secretaria/contratos/:contrato_id`): retorna os dados completos do contrato acompanhados do conjunto de parcelas/faturas geradas.
  - Assinatura digital com aceite formal dos termos (`POST /secretaria/contratos/:contrato_id/assinar`), gerando digest SHA-256 inalterável combinando identificadores, carimbo de tempo UTC e termos de prestação de serviços, transitando para status `assinado` com valor executivo extrajudicial.
  - Automação de parcelamento: ao assinar, emite automaticamente até 12 faturas Pix mensais com vencimento dia 10 (aplicando desconto de grupo familiar se houver).
- **Interface na Secretaria (`ContratosPanel.tsx`)**:
  - Aba dedicada `Contratos & Parcelas` com busca textual (aluno, CPF, ID), filtros por status (`pendente_assinatura`, `assinado`, `cancelado`) e ano letivo.
  - Modal de criação de minuta com seleção de aluno e simulação do valor mensal das 12 parcelas.
  - Modal de assinatura eletrônica com termos contratuais e **copy honesta** esclarecendo a conformidade com a MP 2.200-2/2001 e SHA-256 (com declaração explícita de ausência de certificado ICP-Brasil no MVP).
  - Modal de detalhes com conferência das 12 parcelas geradas, data de vencimento, valores líquidos e botão de cópia de chave Pix EMVCo local.

## 5. Gestão de Turmas e Motor de Ensalamento
- **Listagem e Filtros Server-Side (`GET /secretaria/turmas`)**:
  - Parâmetros opcionais de consulta:
    - `q` / `busca`: Busca textual flexível via `ILIKE` combinando `nome`, `codigo`, `serie` e `etapa_ensino`.
    - `ano_letivo`: Filtro exato por ano letivo (`t.ano_letivo = $ano`).
    - `turno`: Filtro por turno letivo via case-insensitive `ILIKE` (`Matutino`, `Vespertino`, `Noturno`, `Integral`).
    - `status`: Filtro por status (`ativo`, etc.).
  - Retorna `Vec<TurmaDetalhada>` com contagem de alunos matriculados ativos e vagas restantes em tempo real.
- **Controle de Lotação e Sobrecarga**:
  - Verificação in-process de capacidade máxima por turma física/virtual (`validar_capacidade_turma`): bloqueia ensalamento caso o total de alunos ativos seja igual ou superior à `capacidade_maxima`.
  - Ensalamento atômico (`POST /api/v1/secretaria/turmas/matricular`) com cláusula `ON CONFLICT (turma_id, aluno_id) DO UPDATE SET status = 'ativo'` garantindo idempotência e preservação do histórico de matrícula.
- **Detecção de Choques de Horários (Alocação Docente e Salas)**:
  - Algoritmo de cruzamento temporal intervalar `max(inicio_a, inicio_b) < min(fim_a, fim_b)` para detecção instantânea de sobreposição entre aulas no mesmo dia da semana e mesmo ambiente físico ou mesmo docente.
- **Exclusão Segura e Rastreabilidade**:
  - Exclusão de turma com integridade referencial protegida por foreign keys com `ON DELETE CASCADE` controlado e registro de auditoria na tabela `audit_logs` vinculando operador, timestamp UTC e tenant ativo.

## 6. Cadastro Pedagógico de Turmas, Livro de Chamada & Transferências Atômicas
- **Metadados Pedagógicos Estruturados**:
  - `codigo`: Sigla ou código alfanumérico identificador da turma (ex: `1EF-A`, `INF5-B`).
  - `etapa_ensino`: Etapa escolar normatizada (Educação Infantil, Ensino Fundamental I, Ensino Fundamental II, Ensino Médio, EJA).
  - `serie`: Ano ou estágio de desenvolvimento (ex: `1º Ano`, `Maternal II`, `3ª Série`).
  - `turno`: Turno letivo (Matutino, Vespertino, Noturno, Integral).
  - `sala_id`: Vínculo com a sala física da instituição de ensino (`salas`), com capacidade e nome do espaço.
  - `professor_regente_id`: Professor conselheiro ou regente titular da turma (`users`).
  - `capacidade_maxima` e `ano_letivo`: Governança quantitativa de ocupação por período.
- **Entidade canônica do estudante**:
  - Uma única tabela `alunos` + vínculo `turma_alunos` alimenta Diário, Pedagogia (roster), Secretaria e Prontuário.
  - Roster operacional (`GET /secretaria/turmas/:turma_id/alunos`) devolve **apenas** `turma_alunos.status = 'ativo'` **e** `alunos.status = 'ativo'` — mesma regra da lotação (`COUNT … FILTER ativo`) e da chamada do Diário.
  - Ao ensalar (`POST …/turmas/matricular`) ou transferir para destino, aluno em `pre_matricula` (e `transferido` na transferência) é promovido para `ativo`, alinhando o filtro padrão da lista da Secretaria.
  - Leitura do livro de chamada também repara `pre_matricula` com vínculo ativo residual → `ativo` (consistência de ciclo de vida).
  - Prontuário permanece na ficha do aluno (`GET/PUT /secretaria/prontuarios/:aluno_id`); não há cadastro paralelo de estudante no Pedagógico.
- **Livro de Chamada & Renumeração Alfabética (A-Z, 1..N)**:
  - Consulta do livro de chamada (`GET /api/v1/secretaria/turmas/:turma_id/alunos`): retorna alunos operacionais com número de chamada, data de nascimento, CPF, responsável legal e status do vínculo.
  - Renumeração automática (`POST /api/v1/secretaria/turmas/:turma_id/renumerar-chamada`): executa transação no banco reordenando os estudantes ativos em ordem alfabética (`ORDER BY a.nome ASC`) e atualizando `numero_chamada = 1..N`.
- **Desenturmação e Transferência Atômica entre Turmas**:
  - Desenturmação (`DELETE /api/v1/secretaria/turmas/:turma_id/alunos/:aluno_id`): remove vínculo ativo do estudante da turma, liberando vaga imediatamente.
  - Transferência Atômica (`POST /api/v1/secretaria/turmas/transferir`):
    - Executa sob `sqlx::Transaction`:
    - Verifica se a turma de destino possui vaga disponível (`alunos_matriculados < capacidade_maxima`).
    - Marca o registro na turma de origem como `'transferido'` (some da chamada/Diário da origem).
    - Insere ou reativa o registro na turma de destino com o próximo `numero_chamada` disponível e promove o aluno a `ativo`.
    - Grava evento de auditoria `TRANSFERIR_ALUNO_TURMA`.
- **Gestão de Salas Físicas (`salas`)**:
  - Endpoints `GET /api/v1/secretaria/salas`, `POST /api/v1/secretaria/salas`, `DELETE /api/v1/secretaria/salas/:sala_id` para catalogação e controle dos espaços escolares com capacidade nominal.
- **UI Secretaria e lotação**: o carregamento de alunos/turmas/salas/professores é independente (`Promise.allSettled`); falha em um recurso não zera os demais. Lotação exibida usa apenas `alunos_matriculados` / `vagas_restantes` da API (sem fallbacks fictícios). Diário e Secretaria compartilham `GET /secretaria/turmas`.

## 6.1. Documentos para impressão (declarações e histórico)

- Handlers do módulo: `backend/src/handlers/secretaria/**` (alunos, matrícula, prontuário, turmas, vínculos, salas, contratos e família) e `backend/src/handlers/documentos.rs` (declarações e histórico).
- Endpoint: `GET /api/v1/secretaria/alunos/:aluno_id/documento?tipo=declaracao_matricula|declaracao_frequencia|historico`, papéis `admin`, `gestor`, `secretaria`, handler em `backend/src/handlers/documentos.rs`, `TenantDb`, aluno do próprio tenant (404 se de outro tenant).
- Resposta JSON com escola (nome, CNPJ e endereço quando existirem, senão `null`), aluno (nome, data de nascimento, CPF quando houver, matrícula/RA quando houver), turma atual e ano letivo, situação da matrícula, frequência anual (total de aulas/presenças/percentual) no caso de declaração de frequência, notas por disciplina e período com média no histórico, `emitido_em` e `codigo_verificacao` (SHA-256 curto de tenant+aluno+tipo+data). Registra `log_audit` com ação `DOCUMENTO_EMITIDO`.
- Frontend: em `frontend/src/components/secretaria/AlunosPanel.tsx`, menu de ações do aluno ("⋮") possui opção "Emitir documento" que abre modal de escolha de tipo em `SecretariaSection.tsx` e, na sequência, a visualização para impressão em `secretaria/DocumentoImpressao.tsx` (somente exibição; chamada de API em `SecretariaSection.tsx`). Impressão via `window.print()` (menu, cabeçalho do app e barra inferior ocultos em `@media print`).

### Limitações MVP
- Documento impresso em HTML/PDF pelo navegador, sem assinatura digital ICP-Brasil; assinatura feita à mão na linha de assinatura da secretaria.
- `codigo_verificacao` é de uso interno da escola, não é validado publicamente.
- Se faltarem dados da escola (CNPJ/endereço), os campos ficam em branco para preenchimento manual.
- Não há matrícula/RA persistido no MVP (campo `null` na resposta) nem endereço cadastrado em `tenants` (campo `null`).

## 7. Mapa de código (frontend)

Organização após o refactor B12 (só moveu código, sem mudança de regra):

- `frontend/src/components/SecretariaSection.tsx` orquestra: estado, carregamento (`loadTurmas`, `loadAlunos`, `loadCatalogo`), handlers (matrícula, turma, chamada, transferência, prontuário, status) e abas. Concentra todas as chamadas `apiFetch` da Secretaria.
- `frontend/src/components/secretaria/` só exibe, via props: `AlunosPanel`, `TurmasPanel`, `NovaTurmaModal`, `TurmaAlunosModal`, `MatriculaModal` (moldura). `ContratosPanel`, `EnsalamentoModal` e `ProntuarioModal` já existiam e têm lógica própria.
- `frontend/src/components/secretaria/matricula/`: as 4 abas do formulário de matrícula (`DadosAlunoTab`, `ResponsaveisTab`, `EnderecoContatosTab`, `ProntuarioInicialTab`).