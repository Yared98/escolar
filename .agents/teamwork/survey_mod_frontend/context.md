# Task Assignment: Frontend UI Lifecycle & Dynamic State Survey

## Objective
Survey all frontend Next.js PWA screens, components, stores, and data lifecycles to ensure:
- Complete dynamic CRUD functionality across all modules (Secretaria, Financeiro, Acadêmico/Nutrição, CRM/LMS/Regulatório)
- Identification of any broken components, runtime errors, hardcoded mocks, or stale legacy data
- Real-time/reactive state updates (creating a student, invoice, grade, lead reflects immediately across UI)

## Inputs
- `d:/Projetos/escolar/.agents/teamwork/ORIGINAL_REQUEST.md` (see section ## 2026-09-29T05:25:37Z)
- Project Root: `d:/Projetos/escolar/frontend`

## Working Directory
`d:/Projetos/escolar/.agents/teamwork/survey_mod_frontend`

## Deliverable
Write your findings to `d:/Projetos/escolar/.agents/teamwork/survey_mod_frontend/handoff.md`.
Include:
- Frontend architecture (App Router, state management, stores, API clients)
- Audit of each section/screen:
  - Secretaria (Alunos, Turmas, Ensalamento, Contratos)
  - Financeiro (Faturas, Despesas, Conciliação, Régua)
  - Acadêmico & Nutrição (Diário, Boletim, TRI, Cardápios)
  - CRM, LMS & Regulatório (Leads, LTI/SCORM, Educacenso, Diploma)
- List of components with mock data vs dynamic data, broken handlers, missing CRUD operations
- Recommendations for refactoring and UI lifecycle fixes
Send completion message when done.
