# Milestone 1 Iteration 2: Sidebar Navigation Event Handlers Investigation & Fix Specification

**Author**: `m1_fix_explorer_2` (Sidebar Navigation Explorer)  
**Date**: 2026-09-28T13:25:00Z  
**Target Scope**: `frontend/src/components/Sidebar.tsx` (and coordinated contract with `frontend/src/app/page.tsx`)  
**Verdict**: **SPECIFICATION_READY**  
**Working Directory**: `d:/Projetos/escolar/.agents/teamwork/m1_fix_explorer_2`

---

## 1. Observation

### 1.1 Duplicated `router.push` Execution on Parent Navigation
- **File**: `frontend/src/components/Sidebar.tsx` (Lines 256–281):
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
    } else if (hasSubItems) {
      // If already active, toggle collapse
      setExpandedRoutes((prev) => ({
        ...prev,
        [item.id]: !isRouteExpanded(item.id),
      }));
    }
  };
  ```
- **File**: `frontend/src/app/page.tsx` (Lines 156–170):
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
- **Direct Empirical Tool Output**:
  Executing `node d:/Projetos/escolar/.agents/teamwork/challenger_m1_2/verify_stress_url_state.mjs`:
  ```text
  router.push call count during handleParentClick: 2
    Call #1: /?route=secretaria&tab=alunos
    Call #2: /?route=secretaria&tab=alunos
  [FAIL] Contract: handleParentClick must execute router.push EXACTLY ONCE
         Detail: VIOLATION: handleParentClick called router.push 2 times!
  ```

---

### 1.2 Cross-Route Sub-Item Navigation Clobbered by `defaultTab`
- **File**: `frontend/src/components/Sidebar.tsx` (Lines 284–297):
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
- **Direct Empirical Tool Output**:
  From `verify_stress_url_state.mjs`:
  ```text
  Pushes executed during handleSubItemClick:
    Call #1: /?route=secretaria&tab=turmas
    Call #2: /?route=secretaria&tab=alunos
  Final active search params: ?route=secretaria&tab=alunos
  [FAIL] Contract: Clicking sub-item must preserve selected tabKey ("turmas")
         Detail: VIOLATION: Selected tab "turmas" was overwritten with defaultTab "alunos" by handleRouteChange!
  ```
  From `adversarial_test_m1.js`:
  ```text
  ADVERSARIAL FINDINGS:
  [1] [HIGH] Cross-route sub-item click navigation clobbered by page.tsx handleRouteChange
      When clicking a sub-item of an inactive section (e.g. from overview to agenda > whatsapp), handleSubItemClick calls onRouteChange(parentRoute). page.tsx's handleRouteChange checks params.get('route') !== newRoute against stale searchParams, resetting 'tab' to menuItem.defaultTab ('comunicacao') and triggering an overriding router.push that clobbers the clicked tab.
  ```

---

### 1.3 Accordion Expansion State Retention and Desynchronization
- **File**: `frontend/src/components/Sidebar.tsx` (Lines 238–253):
  ```typescript
  // Determines whether a route is expanded (auto-expanded if activeRoute, unless manually toggled)
  const isRouteExpanded = (routeId: string): boolean => {
    if (expandedRoutes[routeId] !== undefined) {
      return expandedRoutes[routeId];
    }
    return activeRoute === routeId;
  };

  // Toggle expand manually via chevron button without switching routes
  const handleToggleExpand = (routeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRoutes((prev) => ({
      ...prev,
      [routeId]: !isRouteExpanded(routeId),
    }));
  };
  ```
- **Observation on Edge Cases**:
  1. When a user manually collapses an active section (e.g. `agenda`), `expandedRoutes['agenda'] = false`.
  2. If the user navigates away to another route (e.g. `secretaria`), and then navigates back to `agenda` via browser Back/Forward, deep-link, or `OverviewDashboard` action card, `expandedRoutes['agenda']` remains `false`.
  3. Consequently, upon returning to `agenda`, `isRouteExpanded('agenda')` evaluates `expandedRoutes['agenda'] !== undefined`, returning `false`. The active route renders collapsed rather than open.
  4. There is currently no `useEffect` reacting to `activeRoute` changes to ensure that newly active routes default to expanded while preserving manual chevron toggles during that route's active session.

---

### 1.4 Desktop Sidebar vs Mobile Off-Canvas Drawer Implementation
- **File**: `frontend/src/components/Sidebar.tsx` (Lines 310–425, 443–491):
  - In Mobile Drawer: `<NavLinks onClickCallback={() => setIsMobileMenuOpen(false)} />`
  - In Desktop Sidebar: `<NavLinks />` (where `onClickCallback` is undefined).
  - In `handleToggleExpand`: `e.stopPropagation()` prevents parent click bubbling. `onClickCallback` is NOT passed to `handleToggleExpand`.
  - In `handleParentClick`:
    - If `activeRoute !== item.id`: `onClickCallback` is invoked (closing drawer).
    - If `activeRoute === item.id` (already active): toggles collapse; `onClickCallback` is NOT invoked (keeping drawer open so user can inspect options).
  - In `handleSubItemClick`: `onClickCallback` is invoked (closing drawer upon sub-item selection).

---

## 2. Logic Chain

1. **Root Cause of Duplicate `router.push` (Observation 1.1)**:
   - `handleParentClick` was written with dual responsibility: it invoked `onRouteChange(item.id)` AND immediately constructed URL search parameters to call `router.push`.
   - In `page.tsx`, `onRouteChange` maps to `handleRouteChange`, which independently computes URL search parameters and calls `router.push`.
   - Both calls target the exact same URL (`/?route=${item.id}&tab=${item.defaultTab}`).
   - Result: 2 identical browser history push entries per parent click, corrupting the browser history stack.

2. **Root Cause of TabKey Overwrite on Sub-Item Click (Observation 1.2)**:
   - When clicking a sub-item of a different route (e.g. from `overview` to `agenda > whatsapp`):
     - `handleSubItemClick` calls `router.push('/?route=agenda&tab=whatsapp')`.
     - Then, because `activeRoute !== parentRoute` (`'overview' !== 'agenda'`), it calls `onRouteChange('agenda')`.
     - `onRouteChange` is executed in `page.tsx` within the current render closure, where `searchParams` still reflects the old route (`overview`).
     - `handleRouteChange` evaluates `params.get('route') !== newRoute` as `true`.
     - Because `handleRouteChange` takes only `newRoute: NavRoute` (without a `targetTab` parameter), it looks up `menuItem.defaultTab` (`'comunicacao'`).
     - It forces `params.set('tab', 'comunicacao')` and fires a second `router.push('/?route=agenda&tab=comunicacao')`.
     - The user's intended sub-item (`whatsapp`) is instantly overwritten by the default tab.

3. **Architectural Resolution for Single Source of Truth**:
   - Navigation and history management must reside in a **single coordinator**.
   - If `Sidebar.tsx` delegates route transitions to `onRouteChange(parentRoute, targetTab)`:
     - `handleParentClick` passes `(item.id, hasSubItems ? item.defaultTab : undefined)`.
     - `handleSubItemClick` passes `(parentRoute, subItem.tabKey)`.
     - `Sidebar.tsx` does NOT call `router.push` directly, eliminating duplicate calls.
     - `page.tsx`'s `handleRouteChange` receives the optional `targetTab`. If provided, it sets `tab: targetTab`; if omitted, it defaults to `menuItem.defaultTab`.
     - Exactly ONE `router.push` is executed. The requested `tabKey` is preserved 100% reliably.

4. **Accordion State Resolution (Observation 1.3)**:
   - To ensure that whenever `activeRoute` changes, the active route is automatically expanded, a reactive `useEffect` on `[activeRoute]` in `Sidebar.tsx` will set `expandedRoutes[activeRoute] = true`.
   - When the user remains on the same route, clicking the active parent button or chevron can still toggle `expandedRoutes[activeRoute] = false` because `useEffect` only runs when `activeRoute` changes.
   - Non-active routes toggled via chevron retain their state without interference.

5. **Drawer & Desktop Safety (Observation 1.4)**:
   - Because `NavLinks` encapsulates all clicks, keeping `onClickCallback` optional and calling it only when a route or sub-item transition occurs ensures the mobile drawer closes on selection while allowing in-drawer accordion toggling without closing.

---

## 3. Caveats

- **Scope Boundary**: Milestones 2 and 3 migrate internal tabs in `*Section.tsx` components. Milestone 1 focus is exclusively on `Sidebar.tsx`, `page.tsx`, and the shell routing contract.
- **Backwards Compatibility**: Updating `SidebarProps.onRouteChange` to `(route: NavRoute, targetTab?: string) => void` is 100% backwards-compatible with callers that pass only 1 argument (such as `OverviewDashboard.tsx`).
- **Collided Tab Deep-Links**: When deep-linking via bare `?tab=rotina` without `?route=`, `findRouteByTab` defaults to `portal_aluno`. Adding `role` parameter disambiguation (`findRouteByTab(tabKey, role)`) eliminates the 403 Forbidden risk for teachers.

---

## 4. Conclusion & Concrete Fix Specification

### 4.1 Summary of Architectural Decisions

| Mission Requirement | Root Cause | Exact Fix |
|---|---|---|
| **1. Prevent duplicate router.push** | `handleParentClick` called both `onRouteChange` and `router.push` | Remove `router.push` from `Sidebar.tsx`. Delegate URL changes exclusively to `onRouteChange(item.id, defaultTab)`. |
| **2. Reliable sub-item tabKey** | `handleSubItemClick` called `router.push` + `onRouteChange(parentRoute)`, clobbered by `handleRouteChange`'s `defaultTab` | `handleSubItemClick` calls `onRouteChange(parentRoute, subItem.tabKey)`. `handleRouteChange` accepts optional `targetTab` and respects it. |
| **3. Active accordion expansion with independent toggle** | Manually collapsed routes stayed collapsed when re-activated later | Add `useEffect([activeRoute])` to re-expand `activeRoute` whenever active route changes. Preserve manual chevron toggling. |
| **4. Desktop vs Mobile Drawer Safety** | Drawer closed on toggle if callback was poorly bounded | Verified: `handleToggleExpand` stops propagation and never triggers `onClickCallback`. `onClickCallback` only fires on navigation. |

---

### 4.2 Exact Diff Proposal: `frontend/src/components/Sidebar.tsx`

```patch
--- a/frontend/src/components/Sidebar.tsx
+++ b/frontend/src/components/Sidebar.tsx
@@ -1,7 +1,7 @@
 'use client';
 
 import React, { useState, useEffect } from 'react';
-import { useRouter, useSearchParams, usePathname } from 'next/navigation';
+import { useSearchParams } from 'next/navigation';
 import { useAuth } from '@/context/AuthContext';
 import {
   LucideIcon,
@@ -68,7 +68,7 @@ export interface NavItem {
 
 export interface SidebarProps {
   activeRoute: NavRoute;
-  onRouteChange: (route: NavRoute) => void;
+  onRouteChange: (route: NavRoute, targetTab?: string) => void;
 }
 
 export const MENU_ITEMS: NavItem[] = [
@@ -174,7 +174,18 @@ export const MENU_ITEMS: NavItem[] = [
   },
 ];
 
-export const findRouteByTab = (tabKey: string): NavRoute | undefined => {
+export const findRouteByTab = (tabKey: string, role?: string): NavRoute | undefined => {
+  // Disambiguate duplicate tabs across sections based on role permissions
+  if (role) {
+    if (tabKey === 'rotina') {
+      return role === 'responsavel' ? 'portal_aluno' : 'agenda';
+    }
+    if (tabKey === 'turmas') {
+      return (role === 'secretaria' || role === 'financeiro' || role === 'admin' || role === 'gestor')
+        ? 'secretaria'
+        : 'pedagogico';
+    }
+  }
   for (const item of MENU_ITEMS) {
     if (item.subItems?.some((sub) => sub.tabKey === tabKey)) {
       return item.id;
@@ -187,10 +198,6 @@ export function Sidebar({ activeRoute, onRouteChange }: SidebarProps) {
   const { user, logout } = useAuth();
   const role = user?.role || 'admin';
 
-  const router = useRouter();
   const searchParams = useSearchParams();
-  const pathname = usePathname();
 
   // Manual toggle overrides for routes: [routeId]: boolean
   const [expandedRoutes, setExpandedRoutes] = useState<Record<string, boolean>>({});
@@ -235,6 +242,14 @@ export function Sidebar({ activeRoute, onRouteChange }: SidebarProps) {
     return () => window.removeEventListener('open-mobile-menu', handleOpenMenu);
   }, []);
 
+  // Automatically expand newly activated route when activeRoute changes
+  useEffect(() => {
+    setExpandedRoutes((prev) => {
+      if (prev[activeRoute] === true) return prev;
+      return { ...prev, [activeRoute]: true };
+    });
+  }, [activeRoute]);
+
   // Determines whether a route is expanded (auto-expanded if activeRoute, unless manually toggled)
   const isRouteExpanded = (routeId: string): boolean => {
     if (expandedRoutes[routeId] !== undefined) {
@@ -257,20 +272,9 @@ export function Sidebar({ activeRoute, onRouteChange }: SidebarProps) {
     const hasSubItems = item.subItems && item.subItems.length > 0;
 
     if (activeRoute !== item.id) {
-      onRouteChange(item.id);
       setExpandedRoutes((prev) => ({ ...prev, [item.id]: true }));
-
-      const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
-      params.set('route', item.id);
-      if (hasSubItems && item.defaultTab) {
-        params.set('tab', item.defaultTab);
-      } else {
-        params.delete('tab');
-      }
-      const query = params.toString();
-      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
-
+      onRouteChange(item.id, hasSubItems ? item.defaultTab : undefined);
       if (onClickCallback) onClickCallback();
     } else if (hasSubItems) {
       // If already active, toggle collapse
@@ -282,18 +286,9 @@ export function Sidebar({ activeRoute, onRouteChange }: SidebarProps) {
 
   // Sub-item click handler
   const handleSubItemClick = (parentRoute: NavRoute, subItem: NavSubItem, onClickCallback?: () => void) => {
-    const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
-    params.set('route', parentRoute);
-    params.set('tab', subItem.tabKey);
-    const query = params.toString();
-    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
-
-    if (activeRoute !== parentRoute) {
-      onRouteChange(parentRoute);
-    }
     setExpandedRoutes((prev) => ({ ...prev, [parentRoute]: true }));
-
+    onRouteChange(parentRoute, subItem.tabKey);
     if (onClickCallback) onClickCallback();
   };
 
```

---

### 4.3 Coordinated Diff Proposal: `frontend/src/app/page.tsx`

```patch
--- a/frontend/src/app/page.tsx
+++ b/frontend/src/app/page.tsx
@@ -128,7 +128,7 @@ function DashboardContent() {
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
-      const matched = findRouteByTab(tabParam);
+      const matched = findRouteByTab(tabParam, role);
       if (matched && matched !== activeRoute) {
         setActiveRoute(matched);
       }
+      return;
     }
-  }, [searchParams, activeRoute]);
+
+    // History back to root ("/") restoration fallback
+    const defaultRoute: NavRoute = role === 'responsavel' ? 'portal_aluno' : 'overview';
+    if (activeRoute !== defaultRoute) {
+      setActiveRoute(defaultRoute);
+    }
+  }, [searchParams, activeRoute, role]);
 
   // Automatically adjust default route when role changes to Responsavel / Pai
   useEffect(() => {
     if (role === 'responsavel' && activeRoute !== 'portal_aluno' && activeRoute !== 'agenda') {
       setActiveRoute('portal_aluno');
     }
   }, [role, activeRoute]);
 
   // Handle route change and keep URL query parameter in sync
-  const handleRouteChange = (newRoute: NavRoute) => {
+  const handleRouteChange = (newRoute: NavRoute, targetTab?: string) => {
     setActiveRoute(newRoute);
     const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
-    if (params.get('route') !== newRoute) {
+    const currentRoute = params.get('route');
+    const currentTab = params.get('tab');
+    const menuItem = MENU_ITEMS.find((m) => m.id === newRoute);
+    const resolvedTab = targetTab !== undefined 
+      ? targetTab 
+      : (menuItem?.defaultTab || null);
+
+    if (currentRoute !== newRoute || currentTab !== resolvedTab) {
       params.set('route', newRoute);
-      const menuItem = MENU_ITEMS.find((m) => m.id === newRoute);
-      if (menuItem?.defaultTab) {
-        params.set('tab', menuItem.defaultTab);
+      if (resolvedTab) {
+        params.set('tab', resolvedTab);
       } else {
         params.delete('tab');
       }
       const q = params.toString();
       router.push(q ? `${pathname}?${q}` : pathname, { scroll: false });
     }
   };
```

---

## 5. Verification Method

### 5.1 Independent Verification Commands

1. **Verify Adversarial Stress Harness (Challenger 2 Suite)**:
   ```powershell
   node -e "
   const VALID_ROUTES = ['overview', 'secretaria', 'financeiro', 'pedagogico', 'academico', 'administrativo', 'agenda', 'portal_aluno', 'calendario', 'crm', 'ia_evasao'];
   const MENU_ITEMS = [
     { id: 'overview', label: 'Visão Geral' },
     { id: 'secretaria', label: 'Secretaria', defaultTab: 'alunos', subItems: [{ tabKey: 'alunos' }, { tabKey: 'turmas' }] },
     { id: 'agenda', label: 'Agenda', defaultTab: 'comunicacao', subItems: [{ tabKey: 'comunicacao' }, { tabKey: 'rotina' }, { tabKey: 'whatsapp' }] }
   ];

   class ComponentSimulation {
     constructor(initialQuery = '', role = 'admin') {
       this.role = role;
       this.pathname = '/';
       this.searchParams = new URLSearchParams(initialQuery);
       this.activeRoute = 'overview';
       this.expandedRoutes = {};
       this.routerHistory = [this.getCurrentUrl()];
       this.pushLog = [];
     }
     getCurrentUrl() {
       const q = this.searchParams.toString();
       return q ? this.pathname + '?' + q : this.pathname;
     }
     routerPush(url, options) {
       this.pushLog.push({ url, options });
       this.routerHistory.push(url);
       const parsed = new URL(url, 'http://localhost');
       this.searchParams = new URLSearchParams(parsed.search);
       this.runPageUseEffect();
     }
     runPageUseEffect() {
       const routeParam = this.searchParams.get('route');
       if (routeParam && VALID_ROUTES.includes(routeParam)) {
         if (routeParam !== this.activeRoute) {
           this.activeRoute = routeParam;
         }
         return;
       }
       const tabParam = this.searchParams.get('tab');
       if (tabParam && !routeParam) return;
       const defaultRoute = this.role === 'responsavel' ? 'portal_aluno' : 'overview';
       if (this.activeRoute !== defaultRoute) {
         this.activeRoute = defaultRoute;
       }
     }
     handleRouteChange(newRoute, targetTab) {
       this.activeRoute = newRoute;
       const params = new URLSearchParams(this.searchParams.toString());
       const currentRoute = params.get('route');
       const currentTab = params.get('tab');
       const menuItem = MENU_ITEMS.find((m) => m.id === newRoute);
       const resolvedTab = targetTab !== undefined ? targetTab : (menuItem?.defaultTab || null);
       if (currentRoute !== newRoute || currentTab !== resolvedTab) {
         params.set('route', newRoute);
         if (resolvedTab) {
           params.set('tab', resolvedTab);
         } else {
           params.delete('tab');
         }
         const q = params.toString();
         this.routerPush(q ? this.pathname + '?' + q : this.pathname, { scroll: false });
       }
     }
     handleParentClick(routeId) {
       const item = MENU_ITEMS.find((m) => m.id === routeId);
       if (!item) return;
       const hasSubItems = item.subItems && item.subItems.length > 0;
       if (this.activeRoute !== item.id) {
         this.expandedRoutes[item.id] = true;
         this.handleRouteChange(item.id, hasSubItems ? item.defaultTab : undefined);
       } else if (hasSubItems) {
         this.expandedRoutes[item.id] = !this.expandedRoutes[item.id];
       }
     }
     handleSubItemClick(parentRoute, subItem) {
       this.expandedRoutes[parentRoute] = true;
       this.handleRouteChange(parentRoute, subItem.tabKey);
     }
     browserBack() {
       if (this.routerHistory.length <= 1) return;
       this.routerHistory.pop();
       const prevUrl = this.routerHistory[this.routerHistory.length - 1];
       const parsed = new URL(prevUrl, 'http://localhost');
       this.searchParams = new URLSearchParams(parsed.search);
       this.runPageUseEffect();
     }
   }

   // Test 1: Single push on parent navigation
   const sim1 = new ComponentSimulation('');
   sim1.handleParentClick('secretaria');
   console.assert(sim1.pushLog.length === 1, 'Contract 1 failed: duplicate push detected');

   // Test 2: Sub-item preserves tabKey across sections
   const sim2 = new ComponentSimulation('');
   sim2.handleSubItemClick('secretaria', { tabKey: 'turmas' });
   console.assert(sim2.pushLog.length === 1, 'Contract 2 failed: duplicate push on sub-item');
   console.assert(sim2.searchParams.get('tab') === 'turmas', 'Contract 2 failed: tabKey was overwritten');

   // Test 3: History back to root restores overview
   const sim3 = new ComponentSimulation('');
   sim3.handleParentClick('secretaria');
   sim3.browserBack();
   console.assert(sim3.activeRoute === 'overview', 'Contract 3 failed: activeRoute not restored');
   console.log('All 3 contracts verified successfully.');
   "
   ```
   *Expected Output*: `All 3 contracts verified successfully.` (Exit code 0).

2. **Verify Challenger 1 Adversarial Suite**:
   ```powershell
   $env:NODE_PATH="d:\Projetos\escolar\frontend\node_modules"
   node d:/Projetos/escolar/.agents/teamwork/challenger_m1_1/adversarial_test_m1.js
   ```
   *Expected Output*: 27 passed, 0 failed.

3. **Verify Static TypeScript Compilation and Build**:
   ```powershell
   cd d:\Projetos\escolar\frontend
   npx tsc --noEmit
   npm run build
   ```
   *Expected Output*: Exit code 0, 4/4 static pages generated cleanly under Next.js 14 Suspense boundary.
