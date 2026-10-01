# Orchestrator Soft Handoff: Escolar Navigation Refactoring

## Milestone State
- **Phase 0: Survey & Discovery**: DONE. Three parallel explorers inspected the codebase and produced comprehensive reports. Full architecture, feature inventory, code layout, interface contracts, and milestone breakdown documented in `d:/Projetos/escolar/PROJECT.md`.
- **E2E Testing Track**: DONE. 4-tier automated test suite containing 71 tests (24 Tier 1, 24 Tier 2, 12 Tier 3, 11 Tier 4) implemented and verified passing 71/71 tests via `python tests/e2e/run_all.py` and `node tests/e2e/run_all.mjs`. `TEST_INFRA.md` and `TEST_READY.md` published at project root.
- **Milestone 1 (Sidebar Navigation & Shell)**: DONE.
  - `Sidebar.tsx`: Hierarchical `NavItem`/`NavSubItem` structure across all 7 multi-tab sections, CSS Grid animated collapsible sublists (`grid-rows-[1fr]`/`grid-rows-[0fr]`), auto-expansion on active route, manual chevron toggle without route changes, URL parameter synchronization via Next.js router hooks (`onRouteChange(route, targetTab)`), mobile off-canvas drawer parity, and preserved RBAC filtering (`isRouteAllowed`).
  - `page.tsx`: Wrapped in `<React.Suspense fallback={<SectionSkeleton />}>` for Next.js 14 App Router static generation compatibility. `activeRoute` synchronizes bidirectionally with URL parameters (`?route=...&tab=...`), restoring default route on browser Back to `/`. `findRouteByTab` is role-aware and parent-context-aware, avoiding 403 collisions for shared tabs (`rotina`, `turmas`).
  - Gate Status: PASSED (Reviewers: APPROVE, Challengers: APPROVE, Forensic Auditor: CLEAN, 0 integrity violations, production build and typecheck pass with exit code 0).
- **Milestone 2 (Core Sections Refactoring: AgendaDigitalSection.tsx & SecretariaSection.tsx)**: PLANNED / NEXT UP.
- **Milestone 3 (Extended Sections Refactoring: FinanceiroSection.tsx & PedagocioNutricaoSection.tsx)**: PLANNED.
- **Milestone 4 (Final E2E Gate & Tier 5 Adversarial Coverage Hardening)**: PLANNED.

## Active Subagents
- None. All 19 subagents have finished and delivered their handoffs.

## Pending Decisions & Critical Context
- In `SecretariaSection.tsx`: Remember to preserve the action buttons (`+ Nova Matrícula Completa` / `Criar Nova Turma`) inside the header container while removing the tab switching buttons (`alunos` and `turmas`).
- In `AgendaDigitalSection.tsx`: Replace `useState<'comunicacao' | 'rotina' | 'whatsapp'>` with `useSearchParams().get('tab') || 'comunicacao'`, and remove the horizontal tab bar (former lines 148–184).
- In `FinanceiroSection.tsx` and `PedagocioNutricaoSection.tsx`: Replace local tab `useState` with `useSearchParams` and remove redundant horizontal tab bars.

## Remaining Work for Successor
1. Launch Milestone 2 (Core Sections Refactoring):
   - Dispatch Worker to migrate `AgendaDigitalSection.tsx` and `SecretariaSection.tsx` to read `useSearchParams().get('tab')` and remove horizontal tab buttons.
   - Run Milestone 2 Gate: Reviewers (2), Challengers (2), Forensic Auditor (1).
2. Launch Milestone 3 (Extended Sections Refactoring):
   - Dispatch Worker to migrate `FinanceiroSection.tsx` and `PedagocioNutricaoSection.tsx` to read `useSearchParams().get('tab')` and remove horizontal tab buttons.
   - Run Milestone 3 Gate: Reviewers (2), Challengers (2), Forensic Auditor (1).
3. Final Milestone 4 (E2E Verification & Tier 5 Adversarial Hardening):
   - Execute the 71-test E2E suite via `python tests/e2e/run_all.py --scan-codebase` to verify 100% compliance across all 4 tiers and AST scanner.
   - Dispatch Challengers for Tier 5 white-box coverage hardening.
   - Issue final victory claim and human report to user/parent.

## Key Artifacts
- `d:/Projetos/escolar/PROJECT.md` — Global architecture, feature inventory, code layout, interface contracts, and milestones.
- `d:/Projetos/escolar/TEST_INFRA.md` — E2E test infrastructure specification.
- `d:/Projetos/escolar/TEST_READY.md` — E2E test runner and 71-test checklist.
- `d:/Projetos/escolar/.agents/teamwork/orchestrator/GATE_STATUS.md` — Gate results log (M1 PASS).
- `d:/Projetos/escolar/.agents/teamwork/orchestrator/BRIEFING.md` — Persistent briefing.
- `d:/Projetos/escolar/.agents/teamwork/orchestrator/progress.md` — Liveness and progress tracker.
- `d:/Projetos/escolar/.agents/teamwork/survey_explorer_3/handoff.md` — Detailed migration guides and exact line numbers for each section component.
