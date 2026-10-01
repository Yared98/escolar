# Master Plan: Navigation Refactoring & Collapsible Sublists

## Objective
Migrate in-page submenus (tabs) from individual section components into collapsible sublists within the main `Sidebar.tsx`, managing active submenus via URL search parameters (`?tab=...`), removing local `useState` for tabs, and removing redundant horizontal tab bars.

## Phase 0: Survey & Discovery (Current)
- Dispatch 3 parallel Explorers:
  - **Explorer 1 (Routing & App Architecture)**: Analyze App routing, router provider, navigation state, test framework.
  - **Explorer 2 (Sidebar Component Deep Dive)**: Analyze `Sidebar.tsx`, design collapsible sublist architecture with URL query param support.
  - **Explorer 3 (Section Components & In-Page Tabs)**: Inventory all section components (AgendaDigitalSection, SecretariaSection, and others) with local tab state, UI buttons, and tab panels.
- Synthesize findings into `PROJECT.md` (Architecture, Feature Inventory, Milestones, Interface Contracts, Code Layout).

## Phase 1: Dual Track Decomposition & Execution
- **Track A (E2E / Testing Track)**:
  - Test harness setup, Tier 1 (Feature Coverage), Tier 2 (Boundary/Edge cases), Tier 3 (Cross-feature interactions), Tier 4 (Real-world scenarios).
  - Publish `TEST_READY.md`.
- **Track B (Implementation Track)**:
  - Milestone 1: Navigation Infrastructure & Sidebar Collapsible Sublists with URL query param sync (`?tab=...`).
  - Milestone 2: Section Refactoring - AgendaDigitalSection & SecretariaSection migration to URL query params, removal of `useState` and tab bar UI.
  - Milestone 3: Section Refactoring - Additional Section Components (e.g. Pedagógico, Financeiro, or remaining sections).
  - Milestone 4: Integration, Verification, and Final Gate (Tier 1-4 pass + Tier 5 Adversarial Coverage Hardening).

## Quality & Governance Gates
- Every milestone runs Explorer -> Worker -> Reviewers (2) -> Challengers (2) -> Forensic Auditor (`teamwork_preview_auditor`).
- Zero tolerance on integrity violations.
- Full E2E and unit test verification.
