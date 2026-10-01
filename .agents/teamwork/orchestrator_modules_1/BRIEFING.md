# BRIEFING — 2026-09-29T05:28:00Z

## Mission
Audit, validate E2E, and actively refactor/fix core modules of ERP Escolar across backend Rust and frontend Next.js PWA.

## 🔒 My Identity
- Archetype: orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: d:/Projetos/escolar/.agents/teamwork/orchestrator_modules_1
- Original parent: parent
- Original parent conversation ID: b9526998-b527-42bb-aae2-9dd39d619639

## 🔒 My Workflow
- **Pattern**: Project Pattern (Dual Track: Implementation Track + E2E Testing Track)
- **Scope document**: d:/Projetos/escolar/PROJECT.md
1. **Decompose**: Survey full scope across 5 core functional areas (Secretaria, Financeiro, Acadêmico/Nutrição, CRM/LMS/Regulatório, UI Data Lifecycle & E2E Validation).
2. **Dispatch & Execute**: Direct or sub-orchestrators for milestones, Explorer -> Worker -> Reviewer -> Challenger -> Auditor gate.
3. **On failure**: Retry -> Replace -> Skip -> Redistribute -> Redesign -> Escalate.
4. **Succession**: At 16 spawns, write handoff.md, spawn successor.
- **Work items**:
  1. Survey & Scope Mapping [in-progress]
  2. Test Infrastructure & Dual Track Setup [pending]
  3. M1: Secretaria & Prontuário E2E & Refactoring [pending]
  4. M2: Financeiro & Cobrança E2E & Refactoring [pending]
  5. M3: Gestão Acadêmica & Nutrição E2E & Refactoring [pending]
  6. M4: CRM, LMS & Regulatório E2E & Refactoring [pending]
  7. M5: UI Data Lifecycle & Dynamic Screen Audit [pending]
  8. M6: Final Verification (Cargo Check, Cargo Test, Next.js Build) & E2E 100% Pass [pending]
- **Current phase**: 0 (Survey)
- **Current focus**: Awaiting reports from 3 Survey Explorers

## 🔒 Key Constraints
- NEVER write, modify, or create source code files directly.
- NEVER run build/test commands yourself — require workers to do so.
- NEVER investigate or explore the problem at the code level — dispatch Explorers for technical investigation.
- You MAY use file-editing tools ONLY for metadata/state files (.md) in your .agents/teamwork/ folder.
- Always include path to ORIGINAL_REQUEST.md in subagent dispatches.
- Auditor is NON-SKIPPABLE; binary veto on integrity violation.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.

## Current Parent
- Conversation ID: b9526998-b527-42bb-aae2-9dd39d619639
- Updated: not yet

## Key Decisions Made
- Initiated fresh audit & refactoring project for ERP Escolar modules.
- Dispatched 3 parallel survey explorers for backend, frontend UI lifecycle, and tests/infrastructure.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| survey_mod_backend | teamwork_preview_explorer | Survey Backend Architecture & Modules | in-progress | ea5dfd56-54a7-411d-b22f-b2bfd6562dcf |
| survey_mod_frontend | teamwork_preview_explorer | Survey Frontend UI Lifecycle & Dynamic State | in-progress | c68d62bb-5665-412f-ab47-ecd88be77732 |
| survey_mod_qa | teamwork_preview_explorer | Survey Testing & Build Infrastructure | in-progress | 7ef33e6b-780e-4945-92e2-2e1370a2fc81 |

## Succession Status
- Succession required: no
- Spawn count: 3 / 16
- Pending subagents: ea5dfd56-54a7-411d-b22f-b2bfd6562dcf, c68d62bb-5665-412f-ab47-ecd88be77732, 7ef33e6b-780e-4945-92e2-2e1370a2fc81
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: 1b2d32bb-aae2-4f0f-aec7-eee4f7899443/task-20
- Safety timer: none

## Artifact Index
- d:/Projetos/escolar/.agents/teamwork/ORIGINAL_REQUEST.md — Original User Requests
- d:/Projetos/escolar/.agents/teamwork/orchestrator_modules_1/DISPATCH.md — Dispatch log
- d:/Projetos/escolar/.agents/teamwork/orchestrator_modules_1/BRIEFING.md — Working memory
- d:/Projetos/escolar/.agents/teamwork/orchestrator_modules_1/plan.md — Detailed plan
- d:/Projetos/escolar/.agents/teamwork/orchestrator_modules_1/progress.md — Liveness & progress tracking
