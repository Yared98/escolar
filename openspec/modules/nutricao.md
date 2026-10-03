# Especificação de Negócio: Módulo Nutrição & Cardápios (`openspec/modules/nutricao.md`)

## 0. Estado real do produto (leitura obrigatória)

O módulo cobre o **planejamento de cardápios escolares**, o **catálogo de pratos reutilizáveis** e a **geração de recorrências com controle de vigência**.

| Capacidade | Status |
|---|---|
| Catálogo de Pratos (`pratos`) — listar/criar | Implementado |
| Planejamento de cardápios do dia (`cardapios`) | Implementado |
| Edição de cardápio por escopo (dia / deste em diante) | Implementado |
| Recorrências com prévia e vigência até 180 dias | Implementado |
| Encerramento de série (preserva passado, corta futuro) | Implementado |
| UI `CardapioPlanner.tsx` (rota Nutrição / Pedagógico) | Implementado |
| Alérgenos no prato/cardápio (`alergicos_atencao`) | Implementado (campo textual) |
| CRUD completo de pratos (`PUT`/`DELETE /pratos`) | Implementado (edição completa e exclusão com soft-delete seguro para pratos em uso e exclusão física para pratos sem vínculos) |
| Cruzamento automático prato ↔ `prontuarios.restricoes_alimentares` | **Fora de escopo MVP** (prontuário e cardápio são fontes separadas) |
| Cálculo de macros/calorias (tabela TACO) | **Fora de escopo MVP** |

---

## 1. Gestão de Pratos e Cardápios

- **Catálogo de Pratos**:
  - Cadastro com nome, categoria/tipo e `alergicos_atencao` opcional.
  - Endpoints reais:
    - `GET /api/v1/nutricao/pratos`: lista pratos ativos do tenant (`ativo = TRUE`).
    - `POST /api/v1/nutricao/pratos`: cria novo prato no catálogo (com auditoria `CRIAR_PRATO`).
    - `PUT /api/v1/nutricao/pratos/:id`: atualiza dados cadastrais do prato (título, descrição, tipo de refeição, alérgenos) com auditoria `ATUALIZAR_PRATO`.
    - `DELETE /api/v1/nutricao/pratos/:id`: exclusão segura com verificação de vínculos (se houver vínculos a `cardapios` ou `cardapio_recorrencias`, aplica soft-delete `ativo = FALSE` para preservar o histórico; se não houver vínculos, realiza exclusão física permanente; auditoria `EXCLUIR_PRATO`).
  - **Interface no Frontend (`CardapioPlanner.tsx`)**:
    - Aba dedicada "Pratos" com visualização em cards responsivos (estilo Sálvia).
    - Busca em tempo real por título, ingredientes ou alérgenos, além de filtro por tipo de refeição.
    - Modais acessíveis para criação e edição de pratos.
    - Diálogo de confirmação para exclusão com aviso explicativo sobre a preservação de histórico via soft-delete seguro.
    - Acesso rápido à edição de prato selecionado dentro do modal de novo cardápio.
- **Cardápio diário**:
  - `GET /api/v1/nutricao/cardapios`, `POST /api/v1/nutricao/cardapios`.
  - `PUT /api/v1/nutricao/cardapios/:id` — edição com escopo (`dia` | `seguintes`) via `editar_cardapio_escopo`.
  - `DELETE /api/v1/nutricao/cardapios/:id` — exclusão do dia (política de datas futuras conforme handler).

---

## 2. Recorrências e Vigência

- **Prévia**: `POST /api/v1/nutricao/cardapios/recorrencias/previa`
- **Confirmar série**: `POST /api/v1/nutricao/cardapios/recorrencias`
- **Listar**: `GET /api/v1/nutricao/cardapios/recorrencias`
- **Encerrar**: `POST /api/v1/nutricao/cardapios/recorrencias/:id/encerrar` — remove/congela ocorrências futuras; histórico passado permanece.
