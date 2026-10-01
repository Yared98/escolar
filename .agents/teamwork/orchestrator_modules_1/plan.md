# Plan: ERP Escolar Modules Audit, E2E Validation & Refactoring

## Objectives
Audit, fix, validate, and verify the full E2E operational readiness of all core ERP Escolar modules:
1. Secretaria & Prontuário (matrículas, turmas, ensalamento, contratos digitais)
2. Financeiro & Cobrança (faturas, despesas, conciliação bancária/OFX/Cora, réguas de cobrança)
3. Gestão Acadêmica & Nutrição (diário de classe, boletim, simulados TRI, cardápios)
4. CRM, LMS & Regulatório (leads, integração LTI/SCORM, Educacenso, Diploma Digital MEC)
5. UI Data Lifecycle (Next.js PWA screens reflect full lifecycle dynamic CRUD, no broken components, no stale mock/legacy data)
6. Build & Test Verification (`cargo check`, `cargo test`, Next.js typecheck/build, E2E test suite)

## Phase Breakdown
- **Phase 0: Survey & Codebase Inventory**
  - Dispatch 3 parallel Explorers:
    - Explorer 1: Backend Rust Architecture & Modules (Secretaria, Financeiro, Acadêmico/Nutrição, CRM/LMS/Regulatório)
    - Explorer 2: Frontend Next.js PWA Architecture, Screens, Stores, and Dynamic Data Lifecycles
    - Explorer 3: Existing Tests, Cargo workspace, Next.js build setup, E2E test runner, and current build status
  - Synthesize reports and update `PROJECT.md` with Feature Inventory, Milestones, and Interface Contracts.
- **Phase 1: Dual Track Setup**
  - E2E Testing Track setup (`TEST_INFRA.md`, runner scripts, baseline checks).
- **Phase 2: Milestone Iteration Loops (Explorer -> Worker -> Reviewer -> Challenger -> Auditor Gate)**
  - Milestone 1: Secretaria & Prontuário
  - Milestone 2: Financeiro & Cobrança
  - Milestone 3: Gestão Acadêmica & Nutrição
  - Milestone 4: CRM, LMS & Regulatório
  - Milestone 5: UI Data Lifecycle & Dynamic Screen Audit
- **Phase 3: Final E2E Gate & Hardening**
  - Run `cargo check`, `cargo test`, Next.js build.
  - Run full E2E test suite.
  - Final Auditor integrity check and human reporting to sentinel/user.
