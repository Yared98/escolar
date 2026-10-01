## 2026-09-28T13:26:37Z
You are worker_m1_fix, an Implementation Worker for Milestone 1 Iteration 2.
Your working directory is: d:/Projetos/escolar/.agents/teamwork/worker_m1_fix
Read the original user request at: d:/Projetos/escolar/.agents/teamwork/ORIGINAL_REQUEST.md
Read the project specifications at: d:/Projetos/escolar/PROJECT.md
Read the challenger handoff reports:
- d:/Projetos/escolar/.agents/teamwork/challenger_m1_1/handoff.md
- d:/Projetos/escolar/.agents/teamwork/challenger_m1_2/handoff.md
Read the explorer consensus reports:
- d:/Projetos/escolar/.agents/teamwork/m1_fix_explorer_1/handoff.md
- d:/Projetos/escolar/.agents/teamwork/m1_fix_explorer_2/handoff.md
- d:/Projetos/escolar/.agents/teamwork/m1_fix_explorer_3/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Exclusive write ownership:
- You own: `d:/Projetos/escolar/frontend/src/components/Sidebar.tsx`
- You own: `d:/Projetos/escolar/frontend/src/app/page.tsx`
- You MUST NOT edit `*Section.tsx` files.

Your mission:
Apply the agreed-upon fixes in `Sidebar.tsx` and `page.tsx`:
1. `Sidebar.tsx`:
   - Update `SidebarProps`: `onRouteChange?: (route: NavRoute, targetTab?: string) => void;`.
   - Export shared `isRouteAuthorized` (or `isRouteAllowed`) and export role-aware `findRouteByTab(tabKey, role?, currentRoute?)` so colliding tabs ('rotina', 'turmas') resolve without 403 Forbidden lockouts.
   - In `handleParentClick`: delegate URL and state update to `onRouteChange(item.id, hasSubItems ? item.defaultTab : undefined)`. Remove the duplicate `router.push`.
   - In `handleSubItemClick`: delegate to `onRouteChange(parentRoute, subItem.tabKey)`. Remove the duplicate `router.push` that was clobbering the sub-item.
   - Retain accordion expansion logic and `useRouter` import for AST compliance.
2. `page.tsx`:
   - Update `handleRouteChange`: accept optional `targetTab?: string`. If supplied, set `tab: targetTab`; otherwise default to `menuItem.defaultTab`. Issue exactly ONE `router.push`.
   - In `useEffect`: add fallback for empty query parameters on browser Back to root `/`, restoring `activeRoute` to `role === 'responsavel' ? 'portal_aluno' : 'overview'`.
   - In `activeRoute` initial state: use role-aware default (`role === 'responsavel' ? 'portal_aluno' : 'overview'`) and role-aware `findRouteByTab`.
   - De-duplicate `isAuthorized` using the exported `isRouteAuthorized` from `Sidebar.tsx`.
3. Verification:
   - Run `node d:/Projetos/escolar/.agents/teamwork/challenger_m1_2/verify_stress_url_state.mjs` (must pass all contracts).
   - Run `python tests/e2e/run_all.py` (must pass 71/71).
   - Run `npx tsc --noEmit` and `npm run build` in `frontend/` (must exit 0 with 4/4 static pages).
4. Write handoff report in:
   `d:/Projetos/escolar/.agents/teamwork/worker_m1_fix/handoff.md`
Notify the orchestrator via send_message when complete.
