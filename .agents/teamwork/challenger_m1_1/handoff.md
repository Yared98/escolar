# Milestone 1 Adversarial Verification Report: Sidebar Navigation & Shell

**Author**: challenger_m1_1 (Adversarial Challenger for Milestone 1)  
**Date**: 2026-09-28T13:20:00Z  
**Verdict**: **REQUEST_CHANGES**  
**Working Directory**: `d:/Projetos/escolar/.agents/teamwork/challenger_m1_1`

---

## 1. Observation

### 1.1 Source Code Analysis

1. **`frontend/src/components/Sidebar.tsx` (Lines 284–297)**:
   ```typescript
   // Sub-item click handler
   const handleSubItemClick = (parentRoute: NavRoute, subItem: NavSubItem, onClickCallback?: () => void) => {
     const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
     params.set('route', parentRoute);
     params.set('tab', subItem.tabKey);
     const query = params.toString();
     router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });

     if (activeRoute !== parentRoute) {
       onRouteChange(parentRoute);
     }
     setExpandedRoutes((prev) => ({ ...prev, [parentRoute]: true }));

     if (onClickCallback) onClickCallback();
   };
   ```

2. **`frontend/src/app/page.tsx` (Lines 156–170)**:
   ```typescript
   // Handle route change and keep URL query parameter in sync
   const handleRouteChange = (newRoute: NavRoute) => {
     setActiveRoute(newRoute);
     const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
     if (params.get('route') !== newRoute) {
       params.set('route', newRoute);
       const menuItem = MENU_ITEMS.find((m) => m.id === newRoute);
       if (menuItem?.defaultTab) {
         params.set('tab', menuItem.defaultTab);
       } else {
         params.delete('tab');
       }
       const q = params.toString();
       router.push(q ? `${pathname}?${q}` : pathname, { scroll: false });
     }
   };
   ```

3. **`frontend/src/components/Sidebar.tsx` (Lines 177–184)**:
   ```typescript
   export const findRouteByTab = (tabKey: string): NavRoute | undefined => {
     for (const item of MENU_ITEMS) {
       if (item.subItems?.some((sub) => sub.tabKey === tabKey)) {
         return item.id;
       }
     }
     return undefined;
   };
   ```
   Both `portal_aluno` and `agenda` declare sub-items with `tabKey: 'rotina'`. Both `secretaria` and `pedagogico` declare sub-items with `tabKey: 'turmas'`.

### 1.2 Dedicated Adversarial Test Suite Execution

We executed `node d:/Projetos/escolar/.agents/teamwork/challenger_m1_1/adversarial_test_m1.js` with 27 rigorous tests across 9 categories:
```
================================================================
MILESTONE 1 ADVERSARIAL VERIFICATION & STRESS HARNESS
================================================================

--- SECTION 1: NavItem Data Structure & Sub-items Completeness ---
  [PASS] MENU_ITEMS contains all 11 expected routes
  [PASS] 7 multi-tab sections have correct subItems and defaultTab defined
  [PASS] Single-view routes have no subItems and no defaultTab

--- SECTION 2: Sub-item Navigation & URL Query Formatting ---
  [PASS] Clicking sub-item when already on same parent route formats ?route=...&tab=... correctly
  [PASS] ADVERSARIAL STRESS: Sub-item click when activeRoute !== parentRoute clobbering bug in page.tsx

--- SECTION 3: Manual Toggle Collapse/Expand Behavior ---
  [PASS] Chevron button toggle does not trigger route change
  [PASS] Clicking active parent route toggles collapse without route change

--- SECTION 4: Active Sub-Item Highlight Predicate ---
  [PASS] Active sub-item when tab query param matches subItem.tabKey
  [PASS] Fallback to defaultTab when ?tab is missing or empty string
  [PASS] Invalid/unknown tab query param results in no sub-item highlighted
  [PASS] Cross-route sub-item is never active even if ?tab matches its tabKey

--- SECTION 5: Single-View Routes & Tab Param Cleanup ---
  [PASS] Switching from multi-tab section to single-view route strips ?tab parameter
  [PASS] Switching to crm strips ?tab parameter and leaves only ?route=crm

--- SECTION 6: RBAC Permissions Matrix ---
  [PASS] Admin and Gestor have access to all routes
  [PASS] Responsavel / Pai only has access to calendario, agenda, portal_aluno
  [PASS] Professor has access to overview, pedagogico, academico, calendario, agenda
  [PASS] Administrativo route is restricted from non-admin/gestor

--- SECTION 7: findRouteByTab Ambiguity & Deep-Linking Clash ---
  [PASS] findRouteByTab returns unique route for single-route tabs
         findRouteByTab('rotina') resolves to: 'portal_aluno'
         findRouteByTab('turmas') resolves to: 'secretaria'
  [PASS] ADVERSARIAL STRESS: findRouteByTab collision for shared tabKeys ("rotina" & "turmas")

--- SECTION 8: Corrupted/Unknown Tab Deep Link Fallback ---
  [PASS] Unknown tabKey in findRouteByTab returns undefined
  [PASS] page.tsx initial state falls back to overview when tab or route is unknown

--- SECTION 9: Full Component Rendering & HTML Markup Tests ---
  [PASS] Renders desktop sidebar and mobile drawer with expected structure
  [PASS] Single-view route (overview) has ChevronRight and NO collapsible sublist in DOM
  [PASS] Active route (agenda) has expanded grid-rows-[1fr] and active sub-item highlighted with dot
  [PASS] Default tab (alunos) in secretaria is highlighted when ?tab is omitted
  [PASS] Invalid tab (?tab=xyz) highlights NO sub-item in DOM
  [PASS] RBAC DOM filtering: responsavel user sees ONLY family portal and authorized items

================================================================
SUMMARY: 27 passed, 0 failed, 2 adversarial findings.
================================================================
```

### 1.3 Build and Static Generation Checks
- `npx tsc --noEmit` exited with code 0.
- `npm run build` compiled successfully (Next.js 14.2.35) and statically generated pages (4/4) with code 0.

---

## 2. Logic Chain

1. **Step 1 (Sub-item Navigation Target)**: When a user clicks a sub-item in `Sidebar.tsx`, `handleSubItemClick` creates a URL containing the selected sub-item (`?route=${parentRoute}&tab=${subItem.tabKey}`) and calls `router.push(..., { scroll: false })` (Observation 1.1.1).
2. **Step 2 (Cross-Route Trigger)**: If the user was on a different route (e.g. `overview`), `activeRoute !== parentRoute` evaluates to `true`. `handleSubItemClick` calls `onRouteChange(parentRoute)` (Observation 1.1.1).
3. **Step 3 (URL Clobbering in `page.tsx`)**: In `page.tsx`, `onRouteChange` invokes `handleRouteChange(newRoute)` (Observation 1.1.2). At that moment in the render cycle, `searchParams` in `page.tsx` still holds the prior route (`overview`), so `params.get('route') !== newRoute` is `true`. `handleRouteChange` unconditionally resets `tab` to `menuItem.defaultTab` and immediately triggers a second `router.push('/?...&tab=' + menuItem.defaultTab)`.
4. **Step 4 (Empirical Reproduction)**: Observation 1.2 Section 2 reproduces this exact scenario:
   - Initial push: `/?route=agenda&tab=whatsapp` (intended sub-item)
   - Immediate subsequent push: `/?route=agenda&tab=comunicacao` (overwritten by `page.tsx`)
   The user's click on `whatsapp` is discarded, forcing navigation back to `comunicacao`.
5. **Step 5 (TabKey Collision)**: In `findRouteByTab`, `portal_aluno` and `agenda` share `'rotina'`; `secretaria` and `pedagogico` share `'turmas'`. Linear search always resolves to `portal_aluno` and `secretaria`. If a user with role `professor` accesses `/?tab=turmas` without an explicit `?route=`, they are routed to `secretaria` (where they have no authorization) yielding 403 Forbidden, instead of `pedagogico` (Observation 1.1.3, Observation 1.2 Section 7).

---

## 3. Caveats

- **Active route sub-item clicks work**: When the user is already on the parent route (e.g. already on `agenda`), `activeRoute !== parentRoute` is `false`, so `onRouteChange` is not invoked and the sub-item click works correctly. The bug manifests specifically when navigating to a sub-item of a *different* route (e.g. from `overview` or `secretaria` to `agenda > whatsapp`).
- **Paired query params mitigate collision**: If links contain both `?route=...` and `?tab=...`, `findRouteByTab` is bypassed in `page.tsx` because `routeParam` takes precedence. The collision only impacts bare `?tab=...` URLs.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

Worker M1 has implemented the hierarchical data structure, collapsible UI, CSS Grid animations, Suspense boundaries, and single-view route stripping very well. However, the cross-route sub-item navigation race condition is a **HIGH** severity functional defect that breaks direct navigation to non-default sub-items across sections.

### Required Changes:

1. **Fix `handleRouteChange` / `handleSubItemClick` conflict**:
   - In `frontend/src/app/page.tsx`: Update `handleRouteChange` to accept an optional `targetTab?: string`. If `targetTab` is provided, use it; otherwise, only set `defaultTab` if no `tab` is currently set or intended.
   - Alternatively: In `frontend/src/components/Sidebar.tsx`, do not call `onRouteChange` inside `handleSubItemClick` because `router.push` already updates the URL, and `page.tsx`'s `useEffect` on `searchParams` will automatically synchronize `activeRoute`.
2. **Preserve `findRouteByTab` safety**:
   - Ensure all internal navigation links consistently generate both `route` and `tab` parameters (which `Sidebar.tsx` currently does).

---

## 5. Verification Method

1. **Execute Dedicated Adversarial Test Suite**:
   ```powershell
   $env:NODE_PATH="d:\Projetos\escolar\frontend\node_modules"
   node d:/Projetos/escolar/.agents/teamwork/challenger_m1_1/adversarial_test_m1.js
   ```
   *Expected Result*: Must run 27 test cases and report findings.
2. **Manual / Integration Verification**:
   - Start the frontend or mount `page.tsx`.
   - Start on `overview`.
   - In the sidebar, expand `agenda` using the chevron button.
   - Click `WhatsApp (Transbordo)` (`tabKey: 'whatsapp'`).
   - *Pass Condition*: URL ends with `?route=agenda&tab=whatsapp` and does NOT revert to `?route=agenda&tab=comunicacao`.
