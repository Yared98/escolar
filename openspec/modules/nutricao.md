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
| CRUD completo de pratos (`PUT`/`DELETE /pratos`) | **Ausente no MVP** (só `GET`/`POST`) |
| Cruzamento automático prato ↔ `prontuarios.restricoes_alimentares` | **Fora de escopo MVP** (prontuário e cardápio são fontes separadas) |
| Cálculo de macros/calorias (tabela TACO) | **Fora de escopo MVP** |

---

## 1. Gestão de Pratos e Cardápios

- **Catálogo de Pratos**:
  - Cadastro com nome, categoria/tipo e `alergicos_atencao` opcional.
  - Endpoints reais: `GET /api/v1/nutricao/pratos`, `POST /api/v1/nutricao/pratos`.
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
