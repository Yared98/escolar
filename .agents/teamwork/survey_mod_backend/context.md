# Task Assignment: Backend Architecture Survey

## Objective
Map the full backend Rust architecture and enumerate all features, models, endpoints, and data flows across the core modules:
1. Secretaria & Prontuário (matrículas, turmas, ensalamento, contratos digitais)
2. Financeiro & Cobrança (faturas, despesas, conciliação bancária/OFX/Cora, réguas de cobrança)
3. Gestão Acadêmica & Nutrição (diário de classe, boletim, simulados TRI, cardápios)
4. CRM, LMS & Regulatório (leads, integração LTI/SCORM, Educacenso, Diploma Digital MEC)

## Inputs
- `d:/Projetos/escolar/.agents/teamwork/ORIGINAL_REQUEST.md` (see section ## 2026-09-29T05:25:37Z)
- Project Root: `d:/Projetos/escolar`

## Working Directory
`d:/Projetos/escolar/.agents/teamwork/survey_mod_backend`

## Deliverable
Write your findings to `d:/Projetos/escolar/.agents/teamwork/survey_mod_backend/handoff.md`.
Include:
- Exact crate/folder layout and entry points
- Exhaustive inventory of endpoints, structs, and database tables for each of the 4 domains
- Identified discrepancies, missing logic, stubs, or errors in backend flows
- Recommendations for milestone decomposition and testability
Send completion message when done.
