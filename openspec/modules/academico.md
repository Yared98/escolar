# Especificação de Negócio: Módulo Gestão Acadêmica (`openspec/modules/academico.md`)

## 0. Estado real do produto (leitura obrigatória)

O módulo cobre o **Diário de Classe Digital PWA (offline-first)**, o **Boletim Avaliativo Bimestral/Trimestral**, a **Matriz Curricular BNCC** e o **Controle de Horários Semanal Anti-Choque**.
O processo avaliativo opera pelo lançamento de notas por período letivo e faltas.

| Capacidade | Status |
|---|---|
| Diário de Classe PWA Offline-First (Dexie.js / IndexedDB) | Implementado |
| Sincronização automática com fila Outbox (`pending_sync`) | Implementado |
| Consulta e Lançamento do Dia (Presenças P/F/J, Conteúdo, Observação) | Implementado |
| Boletim Consolidado (Médias bimestrais, faltas e frequência LDB 75%) | Implementado |
| Catálogo BNCC com auto-seed dinâmico | Implementado |
| Matriz Curricular da Turma & Atribuição Docente | Implementado |
| Grade Horária Semanal Anti-Choque Triplo (Turma, Docente, Sala) | Implementado |
| Simulados TRI (cadastro de itens a/b/c + apuração de gabarito via API/UI) | **Parcial** — endpoints e aba em `PedagocioNutricaoSection`; sem leitora física |
| Leitora Ótica de Gabaritos Físicos (hardware/scan) | **Fora de escopo MVP** |
| Banco TRI “produção ENEM” / calibração estatística avançada | **Fora de escopo MVP** (parâmetros a/b/c manuais no cadastro do simulado) |

---

## 1. Diário de Classe Digital PWA (Offline-First)
- **Modo Offline**: Permitir lançamento de faltas e conteúdo ministrado no PWA sem conexão via Dexie.js e IndexedDB local (`sync_events` com status `pending_sync`). A fila sincroniza automaticamente ao reconectar.
- **Sincronização Assíncrona**: Envio do lote com remoção por UUID após confirmação do servidor. Escrita canônica: `POST /api/v1/academico/diario/sync` (upsert por `tenant_id + turma_id + data_aula`).
  - Request Body:
  ```json
  {
    "turma_id": "UUID",
    "data_aula": "YYYY-MM-DD",
    "conteudo_ministrado": "String",
    "observacao": "String (até 4000 caracteres)",
    "presencas": [
      { "aluno_id": "UUID", "status": "presente" | "falta" | "justificada" }
    ]
  }
  ```
- **Consulta do dia**: `GET /api/v1/academico/diario?turma_id=&data_aula=` devolve `{ encontrado: bool, conteudo_ministrado, observacao, presencas }`.
- **Histórico da turma**: `GET /api/v1/academico/diario/recentes?turma_id=&limit=` lista os últimos diários salvos da turma.
- **Diferenciação por Etapa**: Turmas da Educação Infantil abrem a visão integrada com rotina infantil; turmas do Fundamental/Médio abrem a pauta de frequência e conteúdo.

---

## 2. Apuração Avaliativa & Boletim Consolidado

- **Boletim Consolidado Multi-Período (`GET /api/v1/academico/boletim/:aluno_id`)**:
  - Consolida notas dos bimestres/trimestres por disciplina, calcula média aritmética/ponderada e apura a frequência presencial consolidada (LDB 75%).
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
  - `POST /api/v1/academico/notas/lote`: Lançamento das notas do período para os alunos da turma.

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
