# Execution Plan: Milestone 3 & Milestone 4

## Objective
Refactor the 3rd section component (`FinanceiroSection.tsx` and optionally `PedagocioNutricaoSection.tsx`) to migrate from local `useState` tab state to URL query parameter (`?tab=...`), remove horizontal tab switcher buttons, and preserve action buttons. Then execute Milestone 4 / Final Verification (E2E test suite, AST scan, and production build) to verify all acceptance criteria and claim victory.

---

## Phase 1: Milestone 3 Investigation (Explorers)
- **Goal**: Analyze `FinanceiroSection.tsx` (and `PedagocioNutricaoSection.tsx`), exact line numbers for `useState`, `activeSubTab`/`activeTab`, `setActiveSubTab`, the horizontal tab bar markup, any action buttons that must be preserved, and the exact replacement code structure.
- **Workers**: 3 parallel Explorers:
  - `m3_explorer_1`: Focus on `FinanceiroSection.tsx` state migration, `useSearchParams().get('tab')` integration, fallback whitelist (`'ar'`, `'ap'`, `'nfse'`, `'bi'`), and removal of horizontal tab buttons.
  - `m3_explorer_2`: Focus on action buttons / in-page controls preservation, modals, form interactions, and import cleanliness in `FinanceiroSection.tsx`.
  - `m3_explorer_3`: Focus on `PedagocioNutricaoSection.tsx` state migration and overall AST compatibility across all section components.

## Phase 2: Milestone 3 Implementation (Worker)
- **Goal**: Implement refactoring in `FinanceiroSection.tsx` (and `PedagocioNutricaoSection.tsx`), run TypeScript checks, production build, AST scan, and E2E tests.
- **Worker**: 1 Worker (`worker_m3`) with domain expertise, exclusive write ownership.

## Phase 3: Milestone 3 Verification & Gate
- **Goal**: Rigorous multi-agent review and integrity audit.
- **Workers**:
  - 2 Reviewers (`reviewer_m3_1`, `reviewer_m3_2`): Code quality, regression prevention, spec conformance.
  - 2 Challengers (`challenger_m3_1`, `challenger_m3_2`): Dynamic URL testing, edge cases, invalid tab fallbacks.
  - 1 Forensic Auditor (`auditor_m3_1`): Zero tolerance static/runtime check for shortcuts, hardcoded mocks, or facade implementations.

## Phase 4: Milestone 4 / Final Gate & Acceptance Criteria Verification
- **Goal**: Execute master E2E test suite (`python tests/e2e/run_all.py --scan-codebase`), `npm run build`, and confirm all 4 user acceptance criteria:
  1. `Sidebar.tsx` contains nested navigation items appending `?tab=` query parameters.
  2. At least 3 section components (`AgendaDigitalSection.tsx`, `SecretariaSection.tsx`, `FinanceiroSection.tsx`) contain NO local `useState` for tab switching.
  3. All refactored `*Section.tsx` read active tab from URL via `useSearchParams`.
  4. Old horizontal tab UI elements are completely removed.
- **Workers**: Challenger Tier 5 adversarial verification.

## Phase 5: Synthesis & Victory Report
- Write final handoff and victory report back to parent.
