# BRIEFING — 2026-09-28T13:24:45Z

## Mission
Inspect Sidebar.tsx event handlers and design concrete fix for router.push duplication, sub-item tabKey reliability, accordion expansion, and mobile/desktop safety.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigator, analyzer, synthesizer
- Working directory: d:/Projetos/escolar/.agents/teamwork/m1_fix_explorer_2
- Original parent: a2caeaa5-0586-4ec1-8e62-226efb240f45
- Milestone: Milestone 1 Iteration 2

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Inspect frontend/src/components/Sidebar.tsx
- Design exact code changes and diff proposal in handoff.md

## Current Parent
- Conversation ID: a2caeaa5-0586-4ec1-8e62-226efb240f45
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `frontend/src/components/Sidebar.tsx` (lines 1–493, event handlers, navigation, rendering)
  - `frontend/src/app/page.tsx` (lines 115–210, 260–300, 480–493, route sync, handleRouteChange, useEffect)
  - `frontend/src/components/OverviewDashboard.tsx` (lines 1–125, onRouteChange consumer)
  - `challenger_m1_1/handoff.md` & `challenger_m1_1/adversarial_test_m1.js`
  - `challenger_m1_2/handoff.md` & `challenger_m1_2/verify_stress_url_state.mjs`
- **Key findings**:
  - `Sidebar.handleParentClick` called BOTH `onRouteChange` and `router.push`, causing duplicate push (2 calls per click).
  - `Sidebar.handleSubItemClick` called `router.push` then `onRouteChange(parentRoute)`, which invoked `page.tsx`'s `handleRouteChange` with stale closure searchParams, overriding clicked tabKey with `defaultTab`.
  - Accordion expansion correctly handles chevron toggle and parent toggle, but needs an `activeRoute` reactive effect to re-expand when returning to a previously collapsed route via browser back/forward or external triggers.
  - Mobile drawer and desktop sidebar cleanly share `NavLinks` via optional `onClickCallback`.
  - Tab collisions in `findRouteByTab` ('rotina', 'turmas') can be resolved with optional role parameter.
- **Unexplored areas**: None. Problem boundary fully mapped and verified.

## Key Decisions Made
- Architecture decision: Centralize URL push inside `handleRouteChange(newRoute, targetTab)` in `page.tsx`.
- Update `SidebarProps.onRouteChange` to accept `(route: NavRoute, targetTab?: string) => void`.
- In `Sidebar.tsx`: delegate parent and sub-item clicks exclusively to `onRouteChange`, removing duplicate `router.push` and unused `useRouter`, `usePathname`.
- Add reactive `useEffect([activeRoute])` in `Sidebar.tsx` to ensure newly activated routes auto-expand.
- Add root URL fallback in `page.tsx`'s `useEffect([searchParams, activeRoute, role])` to restore `overview` on history back to `/`.

## Artifact Index
- DISPATCH.md — record of incoming dispatch
- BRIEFING.md — situational awareness
- progress.md — liveness heartbeat
- handoff.md — final analysis, recommendation, and exact diff proposal
