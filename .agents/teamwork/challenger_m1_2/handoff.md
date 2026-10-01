# Adversarial Empirical Verification Report — Milestone 1

**Author**: challenger_m1_2 (Adversarial Verifier for Milestone 1)  
**Date**: 2026-09-28T13:18:00Z  
**Target Scope**: `frontend/src/app/page.tsx` & `frontend/src/components/Sidebar.tsx`  
**Verdict**: **REQUEST_CHANGES**  

---

## Challenge Summary

**Overall risk assessment**: **CRITICAL**

While the static prerendering under Next.js 14 `<Suspense>` compiles successfully and deep-linking with explicit `?route=...&tab=...` resolves properly on initial mount, adversarial runtime stress-testing of component transitions, history navigation, and event-handler interactions revealed **three critical state desynchronization defects** that degrade the user experience and break core navigation contracts.

---

## 1. Observation

### 1.1 Static Prerendering & Build Execution
- **Command**: `npm run build` in `d:/Projetos/escolar/frontend`
- **Result**: Exit code 0.
- **Output**:
  ```text
  ▲ Next.js 14.2.35
  ✓ Compiled successfully
  ✓ Generating static pages (4/4)
  Route (app)                              Size     First Load JS
  ┌ ○ /                                    12.2 kB        99.7 kB
  └ ○ /_not-found                          873 B          88.5 kB
  ○  (Static)  prerendered as static content
  ```
- **Code Inspection** (`frontend/src/app/page.tsx` lines 486–492):
  ```typescript
  export default function HomePage() {
    return (
      <Suspense fallback={<SectionSkeleton />}>
        <DashboardContent />
      </Suspense>
    );
  }
  ```
- **Observation**: Suspense wrapper around `DashboardContent` successfully satisfies Next.js 14 static generation prerendering requirements.

---

### 1.2 Defect 1: Redundant Duplicate `router.push` on Parent Route Navigation
- **File**: `frontend/src/components/Sidebar.tsx` lines 256–272:
  ```typescript
  // Parent item click handler
  const handleParentClick = (item: NavItem, onClickCallback?: () => void) => {
    const hasSubItems = item.subItems && item.subItems.length > 0;

    if (activeRoute !== item.id) {
      onRouteChange(item.id);
      setExpandedRoutes((prev) => ({ ...prev, [item.id]: true }));

      const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
      params.set('route', item.id);
      if (hasSubItems && item.defaultTab) {
        params.set('tab', item.defaultTab);
      } else {
        params.delete('tab');
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });

      if (onClickCallback) onClickCallback();
  ```
- **File**: `frontend/src/app/page.tsx` lines 156–170 (`onRouteChange` implementation):
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
- **Observation**: When a user clicks a parent navigation item in the Sidebar, `handleParentClick` calls `onRouteChange(item.id)` (which invokes `router.push`), and immediately afterwards calls `router.push` AGAIN with the exact same URL.
- **Empirical Execution**: `node verify_stress_url_state.mjs`
  ```text
  router.push call count during handleParentClick: 2
    Call #1: /?route=secretaria&tab=alunos
    Call #2: /?route=secretaria&tab=alunos
  [FAIL] Contract: handleParentClick must execute router.push EXACTLY ONCE
  ```

---

### 1.3 Defect 2: Cross-Route Sub-Item Click Overwritten by `defaultTab`
- **File**: `frontend/src/components/Sidebar.tsx` lines 284–297:
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
- **Observation**: If a user is on `overview` (or any other route) and clicks a non-default sub-item of another section (for example, clicking `Turmas` in `Secretaria`, whose default tab is `alunos`):
  1. `handleSubItemClick` pushes `/?route=secretaria&tab=turmas`.
  2. Because `activeRoute !== parentRoute`, it calls `onRouteChange('secretaria')`.
  3. `onRouteChange` (`handleRouteChange` in `page.tsx`) executes with the search parameters of the current render frame (where `route` is not yet `'secretaria'`). It evaluates `params.get('route') !== newRoute` as true, sets `params.set('tab', menuItem.defaultTab)` (`'alunos'`), and issues a SECOND `router.push('/?route=secretaria&tab=alunos')`.
  4. The selected sub-item `turmas` is instantly overwritten by `alunos`.
- **Empirical Execution**: `node verify_stress_url_state.mjs`
  ```text
  Pushes executed during handleSubItemClick:
    Call #1: /?route=secretaria&tab=turmas
    Call #2: /?route=secretaria&tab=alunos
  Final active search params: ?route=secretaria&tab=alunos
  [FAIL] Contract: Clicking sub-item must preserve selected tabKey ("turmas")
  ```

---

### 1.4 Defect 3: Failure to Restore `activeRoute` on History Back to Root URL (`/`)
- **File**: `frontend/src/app/page.tsx` lines 129–146:
  ```typescript
  // Synchronize activeRoute smoothly with URL search parameters (deep-linking)
  useEffect(() => {
    if (!searchParams) return;
    const routeParam = searchParams.get('route') as NavRoute | null;
    if (routeParam && VALID_ROUTES.includes(routeParam)) {
      if (routeParam !== activeRoute) {
        setActiveRoute(routeParam);
      }
      return;
    }

    const tabParam = searchParams.get('tab');
    if (tabParam && !routeParam) {
      const matched = findRouteByTab(tabParam);
      if (matched && matched !== activeRoute) {
        setActiveRoute(matched);
      }
    }
  }, [searchParams, activeRoute]);
  ```
- **Observation**: When a user navigates from the root `/` to `/?route=secretaria&tab=alunos`, and then hits the browser Back button until returning to `/`, `searchParams` contains neither `route` nor `tab`.
- Because `useEffect` only contains `if (routeParam ...)` and `if (tabParam ...)`, neither branch executes.
- `activeRoute` is never reset to `'overview'`. The address bar displays `/`, but the dashboard remains stuck on `secretaria`.
- **Empirical Execution**: `node verify_stress_url_state.mjs`
  ```text
  Current URL after browser back: /
  activeRoute after browser back: secretaria
  [FAIL] Contract: activeRoute must restore to "overview" when returning to root URL ("/") via browser back
  ```

---

### 1.5 Defect 4: Route Inference Collisions & RBAC 403 Side Effects
- **File**: `frontend/src/components/Sidebar.tsx` lines 89, 114, 125, 148, 177–184:
  - Tab `rotina` exists in `portal_aluno` (line 89) and in `agenda` (line 114).
  - Tab `turmas` exists in `secretaria` (line 125) and in `pedagogico` (line 148).
  - `findRouteByTab` searches `MENU_ITEMS` linearly:
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
- **Observation**:
  - `findRouteByTab('rotina')` ALWAYS resolves to `portal_aluno`, completely shadowing `agenda`.
  - For role `professor` (or `gestor`/`admin`), access to `portal_aluno` is denied by `isAuthorized` (`page.tsx` line 261):
    ```typescript
    case 'portal_aluno':
      return role === 'responsavel';
    ```
  - Therefore, if a teacher or administrator opens a deep-link with `/?tab=rotina` (expecting the agenda routine), the application infers `portal_aluno` and displays a `403 Forbidden` error screen, even though teachers are fully authorized for `agenda`.
  - Similarly, `findRouteByTab('turmas')` always resolves to `secretaria`, never `pedagogico`.

---

## 2. Logic Chain

1. **Step 1 (Duplicated Responsibility)**: Observation 1.2 demonstrates that both `Sidebar.handleParentClick` and `page.handleRouteChange` construct URL search parameters and invoke `router.push`. When `handleParentClick` calls `onRouteChange`, `handleRouteChange` pushes the URL. Immediately thereafter, `handleParentClick` pushes the URL again. This guarantees duplicate history entries on every parent click.
2. **Step 2 (Asynchronous State Desync & Overwrites)**: Observation 1.3 shows that `Sidebar.handleSubItemClick` sets `tab: subItem.tabKey` in the URL, but then immediately delegates to `onRouteChange(parentRoute)`. Because `onRouteChange` has a stale `searchParams` reference from its current render closure, it assumes the route change has not occurred yet and forces `params.set('tab', menuItem.defaultTab)`. This overwrites any non-default sub-item selection during cross-route navigation.
3. **Step 3 (Missing Empty Fallback)**: Observation 1.4 confirms that `page.tsx`'s `useEffect` only listens for truthy `routeParam` or `tabParam`. When browser back navigation clears the query parameters back to `/`, the absence of an `else` branch leaves `activeRoute` unchanged, resulting in a persistent state desynchronization between the browser URL and the UI.
4. **Step 4 (Colliding Inference Logic)**: Observation 1.5 shows that `tabKey` values are not globally unique across sections (`rotina` and `turmas`). Because `findRouteByTab` is route-agnostic and RBAC-unaware, it always selects the first matching route in `MENU_ITEMS`. For role-restricted routes like `portal_aluno`, this directly produces unauthorized 403 errors on valid user deep-links.

---

## 3. Caveats

- In Milestone 1, section components (`AgendaDigitalSection`, `SecretariaSection`, etc.) have not yet migrated their internal tabs; that is scoped for Milestones 2 and 3.
- The defects identified reside entirely in the Milestone 1 deliverables (`frontend/src/components/Sidebar.tsx` and `frontend/src/app/page.tsx`).
- These bugs are fully reproducible in standard Next.js 14 App Router client environments without requiring live database access.

---

## 4. Conclusion

**Verdict**: **REQUEST_CHANGES**

Milestone 1 CANNOT be approved in its current state. While the build and TypeScript checks pass, the navigation engine suffers from three major defects:
1. Double `router.push` on every parent item navigation polluting browser history.
2. Sub-item navigation race condition where clicking non-default sub-items across sections is overwritten by `defaultTab`.
3. Inability to restore dashboard state back to `overview` when navigating back to the root URL `/`.
4. Role-based 403 Forbidden errors when deep-linking via collided tabs (`?tab=rotina`).

### Recommended Mitigations for Worker M1

1. **Unify URL Synchronization in One Place**:
   - In `Sidebar.tsx`, let `Sidebar` manage the URL push OR let `onRouteChange` manage it — do NOT do both.
   - Recommended: In `Sidebar.tsx`:
     - In `handleParentClick`: Call `onRouteChange(item.id)` and do NOT call `router.push` again.
     - In `handleSubItemClick`: Call `router.push(...)` and set `activeRoute` without calling `onRouteChange` with defaultTab overwrite, OR update `onRouteChange` to accept an optional `tabKey` parameter: `onRouteChange(parentRoute, subItem.tabKey)`.
2. **Add Root URL Fallback to `useEffect` in `page.tsx`**:
   - In `page.tsx` lines 129–146, add a fallback when neither `routeParam` nor `tabParam` is present:
     ```typescript
     const defaultRoute = role === 'responsavel' ? 'portal_aluno' : 'overview';
     if (activeRoute !== defaultRoute) {
       setActiveRoute(defaultRoute);
     }
     ```
3. **Disambiguate or Role-Filter `findRouteByTab`**:
   - Pass the user's `role` into `findRouteByTab(tabKey, role)` to select accessible routes first, or prefix tabKeys where collisions exist.

---

## 5. Verification Method

To independently verify all observations and reproduce the failures:

1. **Run the Empirical Adversarial Stress Suite**:
   ```bash
   node d:/Projetos/escolar/.agents/teamwork/challenger_m1_2/verify_stress_url_state.mjs
   ```
   *Expected Result*: Exits with code 1, displaying 3 contract failures:
   - `[FAIL] Contract: handleParentClick must execute router.push EXACTLY ONCE`
   - `[FAIL] Contract: Clicking sub-item must preserve selected tabKey ("turmas")`
   - `[FAIL] Contract: activeRoute must restore to "overview" when returning to root URL ("/") via browser back`

2. **Run Production Build Verification**:
   ```bash
   cd d:/Projetos/escolar/frontend
   npm run build
   ```
   *Expected Result*: Exit code 0, confirms static prerendering under Suspense is valid.
