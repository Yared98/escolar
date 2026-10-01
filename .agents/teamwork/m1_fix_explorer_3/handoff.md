# Deep-Linking & History Explorer Report — Milestone 1 Iteration 2

**Author**: m1_fix_explorer_3 (Deep-Linking & History Explorer)  
**Date**: 2026-09-28T13:26:00Z  
**Working Directory**: `d:/Projetos/escolar/.agents/teamwork/m1_fix_explorer_3`  
**Target Files**: `frontend/src/app/page.tsx` & `frontend/src/components/Sidebar.tsx`  
**Mission**: Resolve Defect 3 (History Back to Root URL `/`) and Defect 4 (Shared `tabKey` Collisions in `findRouteByTab`).

---

## 1. Observation

### 1.1 Defect 3: Failure to Restore `activeRoute` on History Back to Root URL (`/`)

1. **`frontend/src/app/page.tsx` (Lines 129–146)**:
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
2. **`frontend/src/app/page.tsx` (Lines 99–110)**:
   ```typescript
   const [activeRoute, setActiveRoute] = useState<NavRoute>(() => {
     const initialRoute = searchParams ? (searchParams.get('route') as NavRoute | null) : null;
     if (initialRoute && VALID_ROUTES.includes(initialRoute)) {
       return initialRoute;
     }
     const initialTab = searchParams ? searchParams.get('tab') : null;
     if (initialTab) {
       const matched = findRouteByTab(initialTab);
       if (matched) return matched;
     }
     return 'overview';
   });
   ```
3. **`frontend/src/app/page.tsx` (Lines 148–153)**:
   ```typescript
   // Automatically adjust default route when role changes to Responsavel / Pai
   useEffect(() => {
     if (role === 'responsavel' && activeRoute !== 'portal_aluno' && activeRoute !== 'agenda') {
       setActiveRoute('portal_aluno');
     }
   }, [role, activeRoute]);
   ```
4. **Empirical Failure Output (`verify_stress_url_state.mjs` lines 461–479)**:
   ```text
   --- Test 4.3: History Restoration when navigating Back to Root URL ("/") ---
     [PASS] Initial route is overview
   Current URL after browser back: /
   activeRoute after browser back: secretaria
     [FAIL] Contract: activeRoute must restore to "overview" when returning to root URL ("/") via browser back
            Detail: VIOLATION: activeRoute stayed on "secretaria" instead of restoring to "overview"! (useEffect lacks fallback for empty searchParams)
   ```
   When returning to `/`, `searchParams.get('route')` is `null` and `searchParams.get('tab')` is `null`. Neither `if (routeParam ...)` nor `if (tabParam ...)` executes. `activeRoute` remains unchanged on `'secretaria'`, leaving the UI desynchronized with the address bar (`/`).

---

### 1.2 Defect 4: Shared `tabKey` Collisions in `findRouteByTab` & RBAC 403 Lockout

1. **`frontend/src/components/Sidebar.tsx` (Lines 89, 114, 125, 148, 177–184)**:
   - Route `portal_aluno`:
     `{ id: 'portal-rotina', label: 'Rotina & Diário Escolar', tabKey: 'rotina', icon: Baby }` (line 89)
   - Route `agenda`:
     `{ id: 'agenda-rotina', label: 'Resumo de Rotina', tabKey: 'rotina', icon: HeartPulse }` (line 114)
   - Route `secretaria`:
     `{ id: 'sec-turmas', label: 'Turmas & Ensalamento', tabKey: 'turmas', icon: BookOpen }` (line 125)
   - Route `pedagogico`:
     `{ id: 'ped-turmas', label: 'Visão das Turmas', tabKey: 'turmas', icon: Users }` (line 148)
   - `findRouteByTab` implementation:
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
2. **Tab Usage in Section Components**:
   - `AgendaDigitalSection.tsx` (line 45): `useState<'comunicacao' | 'rotina' | 'whatsapp'>('comunicacao')`
   - `PortalAlunoSection.tsx` (line 97): `useState<'boletim' | 'financeiro' | 'diploma' | 'rotina' | 'portfolio'>('boletim')`
   - `SecretariaSection.tsx` (line 48): `useState<'alunos' | 'turmas' | 'educacenso'>('alunos')`
   - `PedagocioNutricaoSection.tsx` (line 125): `useState<'disciplinas_matriz' | 'atribuicao_horarios' | 'turmas' | 'projetos' | 'nutricao' | 'tri'>`
   *Observation*: Section components depend directly on `'rotina'` and `'turmas'`. Renaming `tabKey` values would break section tab bindings.
3. **RBAC Rules in `page.tsx` (Lines 237–265) and `Sidebar.tsx` (Lines 198–226)**:
   - For `role === 'professor'`:
     - Authorized for `agenda`: `true`
     - Authorized for `portal_aluno`: `false`
     - Authorized for `pedagogico`: `true`
     - Authorized for `secretaria`: `false`
   - Because `findRouteByTab('rotina')` linearly matches `portal_aluno` (first in `MENU_ITEMS`), a teacher opening `/?tab=rotina` gets routed to `portal_aluno`, triggering `!isAuthorized(activeRoute)` -> **403 Forbidden Lock Screen**!
   - Because `findRouteByTab('turmas')` linearly matches `secretaria`, a teacher opening `/?tab=turmas` gets routed to `secretaria`, triggering `!isAuthorized(activeRoute)` -> **403 Forbidden Lock Screen**!

---

## 2. Logic Chain

1. **Step 1 (Root URL Desynchronization)**: In Next.js App Router, browser Back/Forward navigation triggers `searchParams` updates. When navigating back to root `/`, `searchParams` contains no `route` or `tab` keys. Because `page.tsx`'s `useEffect` only executes when `routeParam` or `tabParam` is truthy, the absence of an `else` / default fallback leaves `activeRoute` pinned to the previous route (Observation 1.1.1, 1.1.4).
2. **Step 2 (Role-Aware Default Route)**: The default landing route for standard roles (`admin`, `gestor`, `professor`, `secretaria`, `financeiro`, `nutricionista`) is `'overview'`. For `role === 'responsavel'` (parents/guardians), `'overview'` is unauthorized (`isAuthorized('overview') === false`), and the default route is `'portal_aluno'`. Therefore, the empty-URL fallback must evaluate:
   `const defaultRoute: NavRoute = role === 'responsavel' ? 'portal_aluno' : 'overview';`
   and update `if (activeRoute !== defaultRoute) setActiveRoute(defaultRoute);`.
3. **Step 3 (TabKey Collisions Cannot Be Solved by Renaming)**: Observation 1.2.2 shows that `AgendaDigitalSection.tsx`, `PortalAlunoSection.tsx`, `SecretariaSection.tsx`, and `PedagocioNutricaoSection.tsx` have internal states and render conditions keyed directly to `'rotina'` and `'turmas'`. Renaming tabKeys in `MENU_ITEMS` violates backward compatibility and the milestone scope. Disambiguation must occur at route inference time in `findRouteByTab`.
4. **Step 4 (Route Inference Disambiguation Order)**:
   When `tabKey` matches multiple routes (`['portal_aluno', 'agenda']` or `['secretaria', 'pedagogico']`):
   - **Signal 1 — Parent Context (`currentRoute`)**: If the user is already on one of the candidate routes (e.g. `currentRoute === 'pedagogico'`) and the tab changes to `turmas`, keeping `pedagogico` is the user's unambiguous intent (in-section tab switch).
   - **Signal 2 — Role RBAC Authorization**: If `currentRoute` does not resolve the conflict (e.g. user opens a fresh deep link `/?tab=turmas` from outside or from `overview`), filter candidate routes by user authorization:
     - For `role === 'professor'`: candidate `secretaria` is unauthorized; `pedagogico` is authorized -> resolves to `'pedagogico'`.
     - For `role === 'professor'`: candidate `portal_aluno` is unauthorized; `agenda` is authorized -> resolves to `'agenda'`.
     - For `role === 'secretaria'`: candidate `pedagogico` is unauthorized; `secretaria` is authorized -> resolves to `'secretaria'`.
     - For `role === 'responsavel'`: both `portal_aluno` and `agenda` are authorized, but `portal_aluno` is the primary family portal -> resolves to `'portal_aluno'`.
   - **Signal 3 — Fallback**: If called without `role` or `currentRoute` (as in existing unit tests), return the first matching item in `MENU_ITEMS` (`portal_aluno` for `rotina`, `secretaria` for `turmas`) for 100% backward compatibility.
5. **Step 5 (Code Duplication Elimination)**: `page.tsx` (`isAuthorized`) and `Sidebar.tsx` (`isAllowed`) maintain duplicate 30-line RBAC switch statements. Extracting and exporting `isRouteAuthorized(route: NavRoute, role?: string): boolean` from `Sidebar.tsx` centralizes permissions into a single source of truth used by `Sidebar`, `page.tsx`, and `findRouteByTab`.

---

## 3. Caveats

- **Paired query params bypass inference**: When URLs contain both `?route=...` and `?tab=...` (which `Sidebar.tsx` generates on link clicks), `page.tsx` lines 132–136 match `routeParam` directly and never invoke `findRouteByTab`. The disambiguation logic specifically guarantees deep-links and manual navigation via `?tab=...` operate safely.
- **Section component migration in Milestones 2 & 3**: As specified in the project roadmap, the actual removal of in-page `useState` tabs inside individual `*Section.tsx` files is scheduled for Milestones 2 and 3. Retaining canonical tabKeys (`rotina`, `turmas`) ensures zero disruption when workers wire URL tabs into those sections.

---

## 4. Conclusion & Concrete Code Solution

### 4.1 Exact Code Implementation for `frontend/src/components/Sidebar.tsx`

#### 1. Export centralized `isRouteAuthorized` and update `findRouteByTab`:
Replace lines 177–227 in `frontend/src/components/Sidebar.tsx` with:

```typescript
// Centralized Route RBAC Authorization Helper
export const isRouteAuthorized = (route: NavRoute, role?: string): boolean => {
  if (!role) return true;
  if (role === 'admin' || role === 'gestor') return true;

  switch (route) {
    case 'overview':
      return role !== 'responsavel';
    case 'secretaria':
      return role === 'financeiro' || role === 'secretaria';
    case 'financeiro':
      return role === 'financeiro';
    case 'pedagogico':
    case 'academico':
      return role === 'professor' || role === 'nutricionista';
    case 'administrativo':
      return false;
    case 'calendario':
      return true;
    case 'crm':
      return role === 'admin' || role === 'gestor' || role === 'secretaria';
    case 'ia_evasao':
      return role === 'admin' || role === 'gestor';
    case 'agenda':
      return role === 'professor' || role === 'nutricionista' || role === 'responsavel';
    case 'portal_aluno':
      return role === 'responsavel';
    default:
      return false;
  }
};

/**
 * Route inference by tabKey with parent context and role-based disambiguation.
 * Solves Defect 4: Shared tabKey collisions ('rotina' in portal_aluno vs agenda; 'turmas' in secretaria vs pedagogico).
 */
export const findRouteByTab = (
  tabKey: string,
  role?: string,
  currentRoute?: NavRoute
): NavRoute | undefined => {
  if (!tabKey) return undefined;

  // 1. Collect all routes containing this tabKey
  const matchingRoutes: NavRoute[] = [];
  for (const item of MENU_ITEMS) {
    if (item.subItems?.some((sub) => sub.tabKey === tabKey)) {
      matchingRoutes.push(item.id);
    }
  }

  if (matchingRoutes.length === 0) return undefined;
  if (matchingRoutes.length === 1) return matchingRoutes[0];

  // 2. Disambiguation Signal 1: Parent Context (currentRoute)
  // If active route already contains this tabKey and user is authorized, keep it
  if (currentRoute && matchingRoutes.includes(currentRoute)) {
    if (!role || isRouteAuthorized(currentRoute, role)) {
      return currentRoute;
    }
  }

  // 3. Disambiguation Signal 2: User Role / Authorization Filter
  if (role) {
    const authorizedRoutes = matchingRoutes.filter((route) => isRouteAuthorized(route, role));
    if (authorizedRoutes.length === 1) {
      return authorizedRoutes[0];
    }
    if (authorizedRoutes.length > 1) {
      // Prioritize portal_aluno for responsavel (family central)
      if (role === 'responsavel' && authorizedRoutes.includes('portal_aluno')) {
        return 'portal_aluno';
      }
      // For staff roles, prioritize digital agenda over family portal
      if (role !== 'responsavel' && authorizedRoutes.includes('agenda')) {
        return 'agenda';
      }
      return authorizedRoutes[0];
    }
    // If not authorized for any candidate route, return undefined so caller falls back safely
    return undefined;
  }

  // 4. Default fallback: first match in MENU_ITEMS (maintains backward compatibility)
  return matchingRoutes[0];
};
```

Inside `Sidebar` component (around line 228), replace the local `isAllowed` function with:
```typescript
  const isAllowed = (route: NavRoute): boolean => isRouteAuthorized(route, role);
```

---

### 4.2 Exact Code Implementation for `frontend/src/app/page.tsx`

#### 1. Update Imports (line 8):
```typescript
import { Sidebar, NavRoute, MENU_ITEMS, findRouteByTab, isRouteAuthorized } from '@/components/Sidebar';
```

#### 2. Update `useState` initialization of `activeRoute` (lines 99–110):
```typescript
  const [activeRoute, setActiveRoute] = useState<NavRoute>(() => {
    const initialRoute = searchParams ? (searchParams.get('route') as NavRoute | null) : null;
    if (initialRoute && VALID_ROUTES.includes(initialRoute)) {
      return initialRoute;
    }
    const initialTab = searchParams ? searchParams.get('tab') : null;
    if (initialTab) {
      const matched = findRouteByTab(initialTab, role);
      if (matched) return matched;
    }
    return role === 'responsavel' ? 'portal_aluno' : 'overview';
  });
```

#### 3. Update `useEffect` URL Synchronization for Defect 3 & Defect 4 (lines 129–146):
```typescript
  // Synchronize activeRoute smoothly with URL search parameters (deep-linking & history back)
  useEffect(() => {
    if (!searchParams) return;
    const defaultRoute: NavRoute = role === 'responsavel' ? 'portal_aluno' : 'overview';

    const routeParam = searchParams.get('route') as NavRoute | null;
    if (routeParam && VALID_ROUTES.includes(routeParam)) {
      if (routeParam !== activeRoute) {
        setActiveRoute(routeParam);
      }
      return;
    }

    const tabParam = searchParams.get('tab');
    if (tabParam && !routeParam) {
      const matched = findRouteByTab(tabParam, role, activeRoute);
      if (matched) {
        if (matched !== activeRoute) {
          setActiveRoute(matched);
        }
        return;
      }
    }

    // Defect 3 Fallback: Restore activeRoute when query parameters are absent, cleared, or invalid
    if (activeRoute !== defaultRoute) {
      setActiveRoute(defaultRoute);
    }
  }, [searchParams, activeRoute, role]);
```

#### 4. Update Role Switch `useEffect` (lines 148–153):
```typescript
  // Automatically adjust default route when role changes to Responsavel / Pai
  useEffect(() => {
    if (role === 'responsavel' && !isRouteAuthorized(activeRoute, role)) {
      setActiveRoute('portal_aluno');
    }
  }, [role, activeRoute]);
```

#### 5. Simplify `isAuthorized` in `page.tsx` (lines 237–265):
```typescript
  // Frontend RBAC Claims Security Verification
  const isAuthorized = (route: NavRoute): boolean => isRouteAuthorized(route, role);
```

---

## 5. Verification Method

### 5.1 Verification Test Script (`test_proposed_solution.js`)
We constructed and verified a comprehensive standalone test harness in `d:/Projetos/escolar/.agents/teamwork/m1_fix_explorer_3/test_proposed_solution.js`:

```powershell
node d:/Projetos/escolar/.agents/teamwork/m1_fix_explorer_3/test_proposed_solution.js
```

**Verification Results**:
```text
=== RUNNING TESTS FOR DEFECT 3 & 4 FIXES ===

--- Suite A: findRouteByTab Collisions & Disambiguation ---
  [PASS] Backward compatibility with 0 arguments maintained
  [PASS] Professor disambiguates rotina -> agenda and turmas -> pedagogico (NO 403!)
  [PASS] Nutricionista disambiguates correctly
  [PASS] Secretaria and Financeiro disambiguate turmas -> secretaria
  [PASS] Responsavel disambiguates rotina -> portal_aluno
  [PASS] Parent context (currentRoute) correctly preserves active section during tab switches

--- Suite B: Defect 3 History Back to Root URL ---
  [PASS] Admin history back to / restores activeRoute to overview
  [PASS] Multi-step navigation back to / restores activeRoute to overview
  [PASS] Responsavel history back to / restores activeRoute to portal_aluno
  [PASS] Teacher deep-linking ?tab=turmas initializes activeRoute=pedagogico

=================================================
ALL TESTS PASSED! Solutions verified completely.
=================================================
```

### 5.2 Independent Regression Verification Commands
Once the implementer applies the changes:

1. **Adversarial Test Suite 1**:
   ```powershell
   $env:NODE_PATH="d:\Projetos\escolar\frontend\node_modules"
   node d:/Projetos/escolar/.agents/teamwork/challenger_m1_1/adversarial_test_m1.js
   ```
   *Expected Result*: Exits 0, 27 tests pass.

2. **Empirical Stress Suite 2**:
   ```powershell
   node d:/Projetos/escolar/.agents/teamwork/challenger_m1_2/verify_stress_url_state.mjs
   ```
   *Expected Result*: Defect 3 and Defect 4 checks pass cleanly.

3. **Production Static Prerendering**:
   ```powershell
   cd d:\Projetos\escolar\frontend
   npm run build
   ```
   *Expected Result*: Compiles and statically prerenders all pages with exit code 0.
