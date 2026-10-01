# Especificação Técnica e Funcional: Módulo Secretaria & Prontuário Escolar (`openspec/modules/secretaria.md`)

## 0. Estado real do produto (leitura obrigatória)

O módulo cobre o **ciclo de vida completo do estudante** (matrícula com duplo responsável, validação CPF Mod11, prontuário clínico com log LGPD, enturmação, renumeração alfabética e gestão de salas).

| Capacidade | Status |
|---|---|
| Matrícula Online atômica com transação PostgreSQL | Implementado |
| Duplo Responsável (Legal e Financeiro) | Implementado |
| Validação estrita de CPF (Módulo 11) e telefone | Implementado |
| Prontuário Médico e Clínico com log LGPD Art. 11/14 | Implementado |
| Contrato com assinatura digital por hash SHA-256 | Implementado |
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
- **Barra de Ferramentas, Filtros e Ciclo de Vida**:
  - Busca server-side por nome, CPF, responsável legal/financeiro ou cidade (`GET /secretaria/alunos?q=`).
  - Filtros por status do ciclo de vida (`pre_matricula`, `ativo`, `trancado`, `transferido`, `inativo`), turma, ano letivo e “somente sem turma”.
  - Paginação (`page`/`limit`) com envelope `{ items, total, page, page_size, contagem_status }` e coluna de turma atual.
  - Ações de ciclo de vida na UI (ativar, trancar, transferir, inativar/reativar) via `PUT /secretaria/alunos/:id` com status validado.
  - Criação com situação inicial `ativo` ou `pre_matricula`.
  - Filtros locais na aba Turmas (texto, ano letivo, turno).

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

## 4. Contratos com Assinatura Eletrônica (MP 2.200-2/2001)
- **Geração e Assinatura Digital**:
  - Geração de minuta (`POST /api/v1/secretaria/contratos`) vinculada a tenant, aluno, ano letivo e anuidade total com status inicial `pendente_assinatura`.
  - Assinatura digital com aceite formal dos termos (`POST /api/v1/secretaria/contratos/:contrato_id/assinar`), gerando digest SHA-256 inalterável combinando identificadores, carimbo de tempo UTC e termos de prestação de serviços, transitando para status `assinado` com valor executivo extrajudicial.

## 5. Gestão de Turmas e Motor de Ensalamento
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
- **Livro de Chamada & Renumeração Alfabética (A-Z, 1..N)**:
  - Consulta do livro de chamada (`GET /api/v1/secretaria/turmas/:turma_id/alunos`): retorna alunos com número de chamada, data de nascimento, CPF, responsável legal e status.
  - Renumeração automática (`POST /api/v1/secretaria/turmas/:turma_id/renumerar-chamada`): executa transação no banco reordenando os estudantes ativos em ordem alfabética (`ORDER BY a.nome ASC`) e atualizando `numero_chamada = 1..N`.
- **Desenturmação e Transferência Atômica entre Turmas**:
  - Desenturmação (`DELETE /api/v1/secretaria/turmas/:turma_id/alunos/:aluno_id`): remove vínculo ativo do estudante da turma, liberando vaga imediatamente.
  - Transferência Atômica (`POST /api/v1/secretaria/turmas/transferir`):
    - Executa sob `sqlx::Transaction`:
    - Verifica se a turma de destino possui vaga disponível (`alunos_matriculados < capacidade_maxima`).
    - Marca o registro na turma de origem como `'transferido'`.
    - Insere ou reativa o registro na turma de destino com o próximo `numero_chamada` disponível.
    - Grava evento de auditoria `TRANSFERIR_ALUNO_TURMA`.
- **Gestão de Salas Físicas (`salas`)**:
  - Endpoints `GET /api/v1/secretaria/salas`, `POST /api/v1/secretaria/salas`, `DELETE /api/v1/secretaria/salas/:sala_id` para catalogação e controle dos espaços escolares com capacidade nominal.
- **UI Secretaria e lotação**: o carregamento de alunos/turmas/salas/professores é independente (`Promise.allSettled`); falha em um recurso não zera os demais. Lotação exibida usa apenas `alunos_matriculados` / `vagas_restantes` da API (sem fallbacks fictícios). Diário e Secretaria compartilham `GET /secretaria/turmas`.
