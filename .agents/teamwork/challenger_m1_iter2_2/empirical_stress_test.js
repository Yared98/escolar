/**
 * Empirical Adversarial Stress Test Suite — Milestone 1 Iteration 2
 * 
 * Verifies:
 * 1. Rapid cross-section sub-item switching & single router.push contract
 * 2. Full browser history navigation stack & root URL ('/') default route restoration
 * 3. Role-based resolution of collided tabs ('rotina', 'turmas') ensuring ZERO 403 lockouts
 * 4. Standalone Sidebar fallback behavior
 * 5. Fuzzing / Stress random user navigation harness (200 actions)
 */

const fs = require('fs');
const path = require('path');

// Resolve dependencies from frontend/node_modules
const frontendDir = path.resolve(__dirname, '../../../frontend');
const sucrase = require(path.join(frontendDir, 'node_modules/sucrase'));
const React = require(path.join(frontendDir, 'node_modules/react'));

// Set up module resolution for custom imports in Sidebar.tsx
const Module = require('module');
const originalRequire = Module.prototype.require;

const iconProxy = new Proxy({}, {
  get: (target, prop) => {
    return function MockIcon(props) {
      return React.createElement('svg', { 'data-icon': prop, ...props });
    };
  }
});

let mockCurrentRole = 'admin';
let mockSearchParams = new URLSearchParams('');
let mockPathname = '/';
let routerPushLog = [];

const mockRouter = {
  push: (url, opts) => {
    routerPushLog.push({ action: 'push', url, opts });
  },
  replace: (url, opts) => {
    routerPushLog.push({ action: 'replace', url, opts });
  },
  back: () => {},
  forward: () => {}
};

Module.prototype.require = function (id) {
  if (id === 'react') {
    return React;
  }
  if (id === 'lucide-react') {
    return iconProxy;
  }
  if (id === 'next/navigation') {
    return {
      useRouter: () => mockRouter,
      useSearchParams: () => mockSearchParams,
      usePathname: () => mockPathname,
    };
  }
  if (id === '@/context/AuthContext') {
    return {
      useAuth: () => ({
        user: { id: 'usr-1', name: 'Tester', role: mockCurrentRole },
        login: () => {},
        logout: () => {},
      })
    };
  }
  return originalRequire.apply(this, arguments);
};

// Load and transpile Sidebar.tsx directly
const sidebarPath = path.join(frontendDir, 'src/components/Sidebar.tsx');
const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');
const transformedSidebar = sucrase.transform(sidebarCode, {
  transforms: ['typescript', 'jsx', 'imports'],
  jsxRuntime: 'classic',
});

const sidebarModule = { exports: {} };
const fnSidebar = new Function('module', 'exports', 'require', transformedSidebar.code);
fnSidebar(sidebarModule, sidebarModule.exports, (id) => require(id));

const {
  MENU_ITEMS,
  findRouteByTab,
  isRouteAllowed,
  isRouteAuthorized,
  Sidebar
} = sidebarModule.exports;

// Test framework utilities
let passedCount = 0;
let failedCount = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function test(name, fn) {
  try {
    fn();
    passedCount++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failedCount++;
    failures.push({ name, error: err });
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
  }
}

console.log('================================================================================');
console.log('EMPIRICAL ADVERSARIAL STRESS SUITE: MILESTONE 1 ITERATION 2');
console.log('================================================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: Exact page.tsx Navigation Engine Model
// -----------------------------------------------------------------------------
console.log('SECTION 1: Export & Signature Verification');

test('Sidebar.tsx exports isRouteAllowed and isRouteAuthorized', () => {
  assert(typeof isRouteAllowed === 'function', 'isRouteAllowed is not a function');
  assert(typeof isRouteAuthorized === 'function', 'isRouteAuthorized is not a function');
  assertEqual(isRouteAllowed, isRouteAuthorized, 'isRouteAuthorized should be an alias of isRouteAllowed');
});

test('Sidebar.tsx exports findRouteByTab with role & currentRoute support', () => {
  assert(typeof findRouteByTab === 'function', 'findRouteByTab is not a function');
  // Check that findRouteByTab accepts up to 3 arguments
  assertEqual(findRouteByTab.length >= 1, true, 'findRouteByTab must accept arguments');
});

test('MENU_ITEMS contains all 11 canonical routes with sub-items structure', () => {
  assertEqual(MENU_ITEMS.length, 11, 'Expected 11 canonical menu items');
  const multiTab = MENU_ITEMS.filter(m => m.subItems && m.subItems.length > 0);
  assertEqual(multiTab.length, 7, 'Expected 7 multi-tab sections');
});

// Helper class simulating the exact page.tsx + Sidebar.tsx runtime interaction
class DashboardNavigationRuntime {
  constructor(initialUrl = '/', role = 'admin') {
    this.role = role;
    this.pathname = '/';
    this.activeRoute = 'overview';
    this.historyStack = [initialUrl];
    this.historyIndex = 0;
    this.searchParams = new URLSearchParams('');
    this.expandedRoutes = {};
    this.pushLog = [];

    // Parse initial URL
    this.applyUrl(initialUrl, false);
    // Initial mount route resolution (page.tsx lines 100-110)
    this.activeRoute = this.computeInitialRoute();
  }

  computeInitialRoute() {
    const routeParam = this.searchParams.get('route');
    const VALID_ROUTES = [
      'overview', 'secretaria', 'financeiro', 'pedagogico',
      'academico', 'administrativo', 'agenda', 'portal_aluno',
      'calendario', 'crm', 'ia_evasao'
    ];
    if (routeParam && VALID_ROUTES.includes(routeParam)) {
      return routeParam;
    }
    const tabParam = this.searchParams.get('tab');
    if (tabParam) {
      const matched = findRouteByTab(tabParam, this.role);
      if (matched) return matched;
    }
    return this.role === 'responsavel' ? 'portal_aluno' : 'overview';
  }

  applyUrl(url, triggerEffect = true) {
    const parsed = new URL(`http://localhost${url}`);
    this.pathname = parsed.pathname;
    this.searchParams = parsed.searchParams;
    mockSearchParams = this.searchParams;
    mockPathname = this.pathname;

    if (triggerEffect) {
      this.runPageUseEffect();
    }
  }

  // Exact reproduction of page.tsx useEffect (lines 129-153)
  runPageUseEffect() {
    const VALID_ROUTES = [
      'overview', 'secretaria', 'financeiro', 'pedagogico',
      'academico', 'administrativo', 'agenda', 'portal_aluno',
      'calendario', 'crm', 'ia_evasao'
    ];
    const routeParam = this.searchParams ? this.searchParams.get('route') : null;
    if (routeParam && VALID_ROUTES.includes(routeParam)) {
      if (routeParam !== this.activeRoute) {
        this.activeRoute = routeParam;
      }
      return;
    }

    const tabParam = this.searchParams ? this.searchParams.get('tab') : null;
    if (tabParam && !routeParam) {
      const matched = findRouteByTab(tabParam, this.role, this.activeRoute);
      if (matched && matched !== this.activeRoute) {
        this.activeRoute = matched;
      }
      return;
    }

    // Fallback for empty query parameters on browser Back to root /
    const defaultRoute = this.role === 'responsavel' ? 'portal_aluno' : 'overview';
    if (this.activeRoute !== defaultRoute) {
      this.activeRoute = defaultRoute;
    }
  }

  // Exact reproduction of page.tsx handleRouteChange (lines 163-188)
  handleRouteChange(newRoute, targetTab) {
    this.activeRoute = newRoute;
    const params = new URLSearchParams(this.searchParams ? this.searchParams.toString() : '');
    params.set('route', newRoute);
    if (targetTab !== undefined) {
      if (targetTab) {
        params.set('tab', targetTab);
      } else {
        params.delete('tab');
      }
    } else {
      const menuItem = MENU_ITEMS.find((m) => m.id === newRoute);
      if (menuItem?.defaultTab) {
        params.set('tab', menuItem.defaultTab);
      } else {
        params.delete('tab');
      }
    }
    const q = params.toString();
    const targetUrl = q ? `${this.pathname}?${q}` : this.pathname;
    const currentQuery = this.searchParams ? this.searchParams.toString() : '';
    const currentUrl = currentQuery ? `${this.pathname}?${currentQuery}` : this.pathname;
    if (targetUrl !== currentUrl) {
      this.routerPush(targetUrl);
    }
  }

  // Sidebar.tsx handleParentClick (lines 299-326)
  handleParentClick(item, withCallback = false) {
    const hasSubItems = item.subItems && item.subItems.length > 0;

    if (this.activeRoute !== item.id) {
      this.expandedRoutes[item.id] = true;
      // When onRouteChange is provided:
      this.handleRouteChange(item.id, hasSubItems ? item.defaultTab : undefined);
    } else if (hasSubItems) {
      // Toggle collapse
      this.expandedRoutes[item.id] = !this.isRouteExpanded(item.id);
    }
  }

  // Sidebar.tsx handleSubItemClick (lines 329-342)
  handleSubItemClick(parentRoute, subItem) {
    this.expandedRoutes[parentRoute] = true;
    // When onRouteChange is provided:
    this.handleRouteChange(parentRoute, subItem.tabKey);
  }

  // Standalone Sidebar fallback (without onRouteChange)
  handleParentClickStandalone(item) {
    const hasSubItems = item.subItems && item.subItems.length > 0;
    if (this.activeRoute !== item.id) {
      this.expandedRoutes[item.id] = true;
      const params = new URLSearchParams(this.searchParams ? this.searchParams.toString() : '');
      params.set('route', item.id);
      if (hasSubItems && item.defaultTab) {
        params.set('tab', item.defaultTab);
      } else {
        params.delete('tab');
      }
      const query = params.toString();
      this.routerPush(query ? `${this.pathname}?${query}` : this.pathname);
    } else if (hasSubItems) {
      this.expandedRoutes[item.id] = !this.isRouteExpanded(item.id);
    }
  }

  handleSubItemClickStandalone(parentRoute, subItem) {
    this.expandedRoutes[parentRoute] = true;
    const params = new URLSearchParams(this.searchParams ? this.searchParams.toString() : '');
    params.set('route', parentRoute);
    params.set('tab', subItem.tabKey);
    const query = params.toString();
    this.routerPush(query ? `${this.pathname}?${query}` : this.pathname);
  }

  isRouteExpanded(routeId) {
    if (this.expandedRoutes[routeId] !== undefined) {
      return this.expandedRoutes[routeId];
    }
    return this.activeRoute === routeId;
  }

  isSubItemActive(parentRoute, subItem) {
    if (this.activeRoute !== parentRoute) return false;
    const currentTab = this.searchParams ? this.searchParams.get('tab') : null;
    if (currentTab) {
      return currentTab === subItem.tabKey;
    }
    const menuItem = MENU_ITEMS.find((m) => m.id === parentRoute);
    return subItem.tabKey === menuItem?.defaultTab;
  }

  routerPush(url) {
    this.pushLog.push(url);
    // Truncate any forward history and append new URL
    this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
    this.historyStack.push(url);
    this.historyIndex = this.historyStack.length - 1;
    this.applyUrl(url, true);
  }

  browserBack() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const targetUrl = this.historyStack[this.historyIndex];
      this.applyUrl(targetUrl, true);
    }
  }

  browserForward() {
    if (this.historyIndex < this.historyStack.length - 1) {
      this.historyIndex++;
      const targetUrl = this.historyStack[this.historyIndex];
      this.applyUrl(targetUrl, true);
    }
  }

  getCurrentUrl() {
    const q = this.searchParams ? this.searchParams.toString() : '';
    return q ? `${this.pathname}?${q}` : this.pathname;
  }
}

// -----------------------------------------------------------------------------
// SECTION 2: Rapid Cross-Section Sub-Item Clicking & Single Push Invariant
// -----------------------------------------------------------------------------
console.log('\nSECTION 2: Rapid Cross-Section Sub-Item Clicking & Single router.push');

test('Sub-item click from overview to secretaria > turmas executes exactly 1 push and sets tab=turmas', () => {
  const runtime = new DashboardNavigationRuntime('/', 'admin');
  assertEqual(runtime.activeRoute, 'overview');
  assertEqual(runtime.getCurrentUrl(), '/');

  const secItem = MENU_ITEMS.find(m => m.id === 'secretaria');
  const turmasSub = secItem.subItems.find(s => s.tabKey === 'turmas');

  runtime.handleSubItemClick('secretaria', turmasSub);

  assertEqual(runtime.pushLog.length, 1, 'Must execute exactly 1 router.push');
  assertEqual(runtime.pushLog[0], '/?route=secretaria&tab=turmas');
  assertEqual(runtime.activeRoute, 'secretaria');
  assertEqual(runtime.searchParams.get('route'), 'secretaria');
  assertEqual(runtime.searchParams.get('tab'), 'turmas');
  assert(runtime.isSubItemActive('secretaria', turmasSub), 'turmas sub-item must be active');
});

test('Rapid clicking across 6 different sections executes 1 push per click and never clobbers tab', () => {
  const runtime = new DashboardNavigationRuntime('/', 'admin');

  const sequence = [
    { route: 'pedagogico', tab: 'nutricao' },
    { route: 'agenda', tab: 'whatsapp' },
    { route: 'financeiro', tab: 'bi' },
    { route: 'academico', tab: 'infantil' },
    { route: 'administrativo', tab: 'fornecedores' },
    { route: 'secretaria', tab: 'turmas' },
  ];

  let expectedPushes = 0;
  for (const step of sequence) {
    const parent = MENU_ITEMS.find(m => m.id === step.route);
    const sub = parent.subItems.find(s => s.tabKey === step.tab);
    
    runtime.handleSubItemClick(step.route, sub);
    expectedPushes++;

    assertEqual(runtime.pushLog.length, expectedPushes, `Step ${step.route}>${step.tab} must execute exactly 1 push`);
    assertEqual(runtime.activeRoute, step.route);
    assertEqual(runtime.searchParams.get('route'), step.route);
    assertEqual(runtime.searchParams.get('tab'), step.tab, `Tab must not be overwritten by defaultTab`);
    assert(runtime.isSubItemActive(step.route, sub), `Sub-item ${step.tab} must be active`);
  }
});

test('Clicking the currently active sub-item again does NOT issue duplicate router.push', () => {
  const runtime = new DashboardNavigationRuntime('/', 'admin');
  const finItem = MENU_ITEMS.find(m => m.id === 'financeiro');
  const nfseSub = finItem.subItems.find(s => s.tabKey === 'nfse');

  runtime.handleSubItemClick('financeiro', nfseSub);
  assertEqual(runtime.pushLog.length, 1);

  // Click again
  runtime.handleSubItemClick('financeiro', nfseSub);
  assertEqual(runtime.pushLog.length, 1, 'Duplicate click must not trigger an additional router.push');
  assertEqual(runtime.activeRoute, 'financeiro');
  assertEqual(runtime.searchParams.get('tab'), 'nfse');
});

test('Clicking active parent route toggles accordion collapse without issuing router.push', () => {
  const runtime = new DashboardNavigationRuntime('/?route=secretaria&tab=alunos', 'admin');
  runtime.activeRoute = 'secretaria';
  const secItem = MENU_ITEMS.find(m => m.id === 'secretaria');

  assertEqual(runtime.pushLog.length, 0);
  assert(runtime.isRouteExpanded('secretaria'), 'Active route starts expanded');

  // Click active parent: toggles collapse
  runtime.handleParentClick(secItem);
  assertEqual(runtime.pushLog.length, 0, 'No router.push should be issued when toggling active parent');
  assertEqual(runtime.isRouteExpanded('secretaria'), false, 'Route should be collapsed');

  // Click active parent again: re-expands
  runtime.handleParentClick(secItem);
  assertEqual(runtime.pushLog.length, 0, 'No router.push on second toggle');
  assertEqual(runtime.isRouteExpanded('secretaria'), true, 'Route should be expanded');
});

test('Clicking inactive parent route switches route and applies defaultTab in exactly 1 push', () => {
  const runtime = new DashboardNavigationRuntime('/', 'admin');
  const pedItem = MENU_ITEMS.find(m => m.id === 'pedagogico');

  runtime.handleParentClick(pedItem);
  assertEqual(runtime.pushLog.length, 1, 'Expected exactly 1 router.push');
  assertEqual(runtime.pushLog[0], '/?route=pedagogico&tab=disciplinas_matriz');
  assertEqual(runtime.activeRoute, 'pedagogico');
  assertEqual(runtime.searchParams.get('tab'), 'disciplinas_matriz');
});

test('Transition to single-view route strips tab parameter and issues exactly 1 push', () => {
  const runtime = new DashboardNavigationRuntime('/?route=secretaria&tab=turmas', 'admin');
  runtime.activeRoute = 'secretaria';
  const crmItem = MENU_ITEMS.find(m => m.id === 'crm');

  runtime.handleParentClick(crmItem);
  assertEqual(runtime.pushLog.length, 1);
  assertEqual(runtime.pushLog[0], '/?route=crm');
  assertEqual(runtime.activeRoute, 'crm');
  assertEqual(runtime.searchParams.get('tab'), null, 'tab parameter must be stripped for single-view');
});

// -----------------------------------------------------------------------------
// SECTION 3: Browser History Navigation Stack & Root URL Restoration
// -----------------------------------------------------------------------------
console.log('\nSECTION 3: Browser History Navigation & Root URL Restoration');

test('Step-by-step browser back from deep stack restores route and tab at every step', () => {
  const runtime = new DashboardNavigationRuntime('/', 'admin');

  // Journey: / -> sec:turmas -> fin:bi -> crm -> agenda:whatsapp
  const sec = MENU_ITEMS.find(m => m.id === 'secretaria');
  const fin = MENU_ITEMS.find(m => m.id === 'financeiro');
  const crm = MENU_ITEMS.find(m => m.id === 'crm');
  const agd = MENU_ITEMS.find(m => m.id === 'agenda');

  runtime.handleSubItemClick('secretaria', sec.subItems.find(s => s.tabKey === 'turmas'));
  runtime.handleSubItemClick('financeiro', fin.subItems.find(s => s.tabKey === 'bi'));
  runtime.handleParentClick(crm);
  runtime.handleSubItemClick('agenda', agd.subItems.find(s => s.tabKey === 'whatsapp'));

  assertEqual(runtime.historyStack.length, 5);
  assertEqual(runtime.activeRoute, 'agenda');
  assertEqual(runtime.searchParams.get('tab'), 'whatsapp');

  // Back 1: agenda:whatsapp -> crm
  runtime.browserBack();
  assertEqual(runtime.getCurrentUrl(), '/?route=crm');
  assertEqual(runtime.activeRoute, 'crm');
  assertEqual(runtime.searchParams.get('tab'), null);

  // Back 2: crm -> financeiro:bi
  runtime.browserBack();
  assertEqual(runtime.getCurrentUrl(), '/?route=financeiro&tab=bi');
  assertEqual(runtime.activeRoute, 'financeiro');
  assertEqual(runtime.searchParams.get('tab'), 'bi');

  // Back 3: financeiro:bi -> secretaria:turmas
  runtime.browserBack();
  assertEqual(runtime.getCurrentUrl(), '/?route=secretaria&tab=turmas');
  assertEqual(runtime.activeRoute, 'secretaria');
  assertEqual(runtime.searchParams.get('tab'), 'turmas');

  // Back 4: secretaria:turmas -> / (ROOT URL)
  runtime.browserBack();
  assertEqual(runtime.getCurrentUrl(), '/');
  assertEqual(runtime.activeRoute, 'overview', 'Returning to root URL must restore activeRoute to overview');
  assertEqual(runtime.searchParams.get('route'), null);
  assertEqual(runtime.searchParams.get('tab'), null);
});

test('Browser forward restores forward navigation states seamlessly', () => {
  const runtime = new DashboardNavigationRuntime('/', 'admin');
  const sec = MENU_ITEMS.find(m => m.id === 'secretaria');

  runtime.handleSubItemClick('secretaria', sec.subItems.find(s => s.tabKey === 'turmas'));
  assertEqual(runtime.activeRoute, 'secretaria');

  runtime.browserBack();
  assertEqual(runtime.getCurrentUrl(), '/');
  assertEqual(runtime.activeRoute, 'overview');

  // Step Forward
  runtime.browserForward();
  assertEqual(runtime.getCurrentUrl(), '/?route=secretaria&tab=turmas');
  assertEqual(runtime.activeRoute, 'secretaria');
  assertEqual(runtime.searchParams.get('tab'), 'turmas');
});

test('Role "responsavel" browser back to root "/" restores activeRoute to "portal_aluno"', () => {
  const runtime = new DashboardNavigationRuntime('/', 'responsavel');
  assertEqual(runtime.activeRoute, 'portal_aluno', 'Initial route for responsavel must be portal_aluno');

  const agd = MENU_ITEMS.find(m => m.id === 'agenda');
  runtime.handleSubItemClick('agenda', agd.subItems.find(s => s.tabKey === 'comunicacao'));
  assertEqual(runtime.activeRoute, 'agenda');
  assertEqual(runtime.getCurrentUrl(), '/?route=agenda&tab=comunicacao');

  // Back to root /
  runtime.browserBack();
  assertEqual(runtime.getCurrentUrl(), '/');
  assertEqual(runtime.activeRoute, 'portal_aluno', 'For responsavel, root URL must restore to portal_aluno, NOT overview');
});

// -----------------------------------------------------------------------------
// SECTION 4: Role-Based Collision Disambiguation & Zero 403 Forbidden Lockouts
// -----------------------------------------------------------------------------
console.log('\nSECTION 4: Role-Based Disambiguation of "rotina" & "turmas" (Zero 403 Lockouts)');

const ALL_ROLES = [
  'admin',
  'gestor',
  'financeiro',
  'secretaria',
  'professor',
  'nutricionista',
  'responsavel',
];

test('Collided tabKey "rotina" resolves to agenda for professor and nutricionista (zero 403)', () => {
  for (const role of ['professor', 'nutricionista']) {
    const resolved = findRouteByTab('rotina', role);
    assertEqual(resolved, 'agenda', `For role ${role}, 'rotina' must resolve to 'agenda'`);
    assert(isRouteAllowed(resolved, role), `Role ${role} must be authorized for ${resolved} (Zero 403!)`);
    assert(!isRouteAllowed('portal_aluno', role), `Verification that portal_aluno WOULD have caused 403 for ${role}`);
  }
});

test('Collided tabKey "rotina" resolves to portal_aluno for responsavel (zero 403)', () => {
  const resolved = findRouteByTab('rotina', 'responsavel');
  assertEqual(resolved, 'portal_aluno', `For responsavel, 'rotina' must resolve to 'portal_aluno'`);
  assert(isRouteAllowed(resolved, 'responsavel'), `Responsavel must be authorized for portal_aluno`);
});

test('Collided tabKey "rotina" contextual resolution preserves caller activeRoute for admin/gestor', () => {
  for (const role of ['admin', 'gestor']) {
    // When caller is currently on portal_aluno
    const resFromPortal = findRouteByTab('rotina', role, 'portal_aluno');
    assertEqual(resFromPortal, 'portal_aluno', 'Should preserve portal_aluno if caller is on portal_aluno');

    // When caller is currently on agenda
    const resFromAgenda = findRouteByTab('rotina', role, 'agenda');
    assertEqual(resFromAgenda, 'agenda', 'Should preserve agenda if caller is on agenda');

    // When caller is on neutral route (overview)
    const resNeutral = findRouteByTab('rotina', role, 'overview');
    assertEqual(resNeutral, 'agenda', 'Default preference for admin/gestor without context is agenda');
    assert(isRouteAllowed(resNeutral, role), `Admin/gestor must be authorized for ${resNeutral}`);
  }
});

test('Collided tabKey "turmas" resolves to pedagogico for professor and nutricionista (zero 403)', () => {
  for (const role of ['professor', 'nutricionista']) {
    const resolved = findRouteByTab('turmas', role);
    assertEqual(resolved, 'pedagogico', `For role ${role}, 'turmas' must resolve to 'pedagogico'`);
    assert(isRouteAllowed(resolved, role), `Role ${role} must be authorized for ${resolved} (Zero 403!)`);
    assert(!isRouteAllowed('secretaria', role), `Verification that secretaria WOULD have caused 403 for ${role}`);
  }
});

test('Collided tabKey "turmas" resolves to secretaria for secretaria and financeiro (zero 403)', () => {
  for (const role of ['secretaria', 'financeiro']) {
    const resolved = findRouteByTab('turmas', role);
    assertEqual(resolved, 'secretaria', `For role ${role}, 'turmas' must resolve to 'secretaria'`);
    assert(isRouteAllowed(resolved, role), `Role ${role} must be authorized for ${resolved} (Zero 403!)`);
    assert(!isRouteAllowed('pedagogico', role), `Verification that pedagogico WOULD have caused 403 for ${role}`);
  }
});

test('Collided tabKey "turmas" contextual resolution preserves caller activeRoute for admin/gestor', () => {
  for (const role of ['admin', 'gestor']) {
    // When caller is currently on pedagogico
    const resFromPed = findRouteByTab('turmas', role, 'pedagogico');
    assertEqual(resFromPed, 'pedagogico', 'Should preserve pedagogico if caller is on pedagogico');

    // When caller is currently on secretaria
    const resFromSec = findRouteByTab('turmas', role, 'secretaria');
    assertEqual(resFromSec, 'secretaria', 'Should preserve secretaria if caller is on secretaria');

    // When caller is on neutral route (overview)
    const resNeutral = findRouteByTab('turmas', role, 'overview');
    assertEqual(resNeutral, 'secretaria', 'Default preference for admin/gestor without context is secretaria');
    assert(isRouteAllowed(resNeutral, role), `Admin/gestor must be authorized for ${resNeutral}`);
  }
});

test('Deep link ?tab=rotina matrix across all 7 roles produces ZERO 403 Forbidden states', () => {
  for (const role of ALL_ROLES) {
    const runtime = new DashboardNavigationRuntime('/?tab=rotina', role);
    const activeRoute = runtime.activeRoute;
    const isAuth = isRouteAllowed(activeRoute, role);

    assert(isAuth, `Deep link /?tab=rotina for role ${role} produced unauthorized route ${activeRoute} (403 Forbidden!)`);

    // Verify expected routing
    if (role === 'professor' || role === 'nutricionista') {
      assertEqual(activeRoute, 'agenda');
    } else if (role === 'responsavel') {
      assertEqual(activeRoute, 'portal_aluno');
    } else if (role === 'admin' || role === 'gestor') {
      assertEqual(activeRoute, 'agenda');
    } else if (role === 'secretaria' || role === 'financeiro') {
      // Neither agenda nor portal_aluno is accessible, falls back to overview
      assertEqual(activeRoute, 'overview');
    }
  }
});

test('Deep link ?tab=turmas matrix across all 7 roles produces ZERO 403 Forbidden states', () => {
  for (const role of ALL_ROLES) {
    const runtime = new DashboardNavigationRuntime('/?tab=turmas', role);
    const activeRoute = runtime.activeRoute;
    const isAuth = isRouteAllowed(activeRoute, role);

    assert(isAuth, `Deep link /?tab=turmas for role ${role} produced unauthorized route ${activeRoute} (403 Forbidden!)`);

    // Verify expected routing
    if (role === 'professor' || role === 'nutricionista') {
      assertEqual(activeRoute, 'pedagogico');
    } else if (role === 'secretaria' || role === 'financeiro') {
      assertEqual(activeRoute, 'secretaria');
    } else if (role === 'admin' || role === 'gestor') {
      assertEqual(activeRoute, 'secretaria');
    } else if (role === 'responsavel') {
      // Neither secretaria nor pedagogico is accessible, falls back to portal_aluno
      assertEqual(activeRoute, 'portal_aluno');
    }
  }
});

test('Backward compatibility: findRouteByTab without role parameter returns first match', () => {
  assertEqual(findRouteByTab('rotina'), 'portal_aluno');
  assertEqual(findRouteByTab('turmas'), 'secretaria');
  assertEqual(findRouteByTab('whatsapp'), 'agenda');
  assertEqual(findRouteByTab('unknown_tab_xyz'), undefined);
});

// -----------------------------------------------------------------------------
// SECTION 5: Standalone Sidebar Fallback Mode
// -----------------------------------------------------------------------------
console.log('\nSECTION 5: Standalone Sidebar Fallback Mode (without onRouteChange)');

test('Standalone Sidebar handleParentClick executes exactly 1 router.push', () => {
  const runtime = new DashboardNavigationRuntime('/', 'admin');
  const sec = MENU_ITEMS.find(m => m.id === 'secretaria');

  runtime.handleParentClickStandalone(sec);
  assertEqual(runtime.pushLog.length, 1);
  assertEqual(runtime.pushLog[0], '/?route=secretaria&tab=alunos');
});

test('Standalone Sidebar handleSubItemClick executes exactly 1 router.push', () => {
  const runtime = new DashboardNavigationRuntime('/', 'admin');
  const sec = MENU_ITEMS.find(m => m.id === 'secretaria');
  const turmas = sec.subItems.find(s => s.tabKey === 'turmas');

  runtime.handleSubItemClickStandalone('secretaria', turmas);
  assertEqual(runtime.pushLog.length, 1);
  assertEqual(runtime.pushLog[0], '/?route=secretaria&tab=turmas');
});

// -----------------------------------------------------------------------------
// SECTION 6: High-Volume Fuzzing & Invariant Stress Harness (200 random actions)
// -----------------------------------------------------------------------------
console.log('\nSECTION 6: High-Volume Fuzzing & Invariant Stress Harness (200 actions)');

test('200 pseudo-random transitions maintain 100% URL, history, and state invariants', () => {
  const roles = ['admin', 'gestor', 'professor', 'responsavel'];
  let totalActions = 0;

  for (const role of roles) {
    const runtime = new DashboardNavigationRuntime('/', role);
    const allowedItems = MENU_ITEMS.filter(m => isRouteAllowed(m.id, role));

    // Simple deterministic pseudo-random generator
    let seed = 42;
    function pseudoRand() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    }

    for (let i = 0; i < 50; i++) {
      totalActions++;
      const actionType = Math.floor(pseudoRand() * 4);

      if (actionType === 0) {
        // Click random parent
        const parent = allowedItems[Math.floor(pseudoRand() * allowedItems.length)];
        const prevPushCount = runtime.pushLog.length;
        const wasActive = runtime.activeRoute === parent.id;
        runtime.handleParentClick(parent);

        if (wasActive) {
          assertEqual(runtime.pushLog.length, prevPushCount, 'No push when clicking active parent');
        } else {
          assertEqual(runtime.pushLog.length, prevPushCount + 1, 'Exactly 1 push when clicking new parent');
        }
      } else if (actionType === 1) {
        // Click random sub-item
        const multiTabItems = allowedItems.filter(m => m.subItems && m.subItems.length > 0);
        if (multiTabItems.length > 0) {
          const parent = multiTabItems[Math.floor(pseudoRand() * multiTabItems.length)];
          const sub = parent.subItems[Math.floor(pseudoRand() * parent.subItems.length)];
          const prevPushCount = runtime.pushLog.length;
          const wasSame = runtime.activeRoute === parent.id && runtime.searchParams.get('tab') === sub.tabKey;

          runtime.handleSubItemClick(parent.id, sub);

          if (wasSame) {
            assertEqual(runtime.pushLog.length, prevPushCount, 'No duplicate push on same sub-item');
          } else {
            assertEqual(runtime.pushLog.length, prevPushCount + 1, 'Exactly 1 push on sub-item transition');
          }
        }
      } else if (actionType === 2) {
        // Browser back
        runtime.browserBack();
      } else {
        // Browser forward
        runtime.browserForward();
      }

      // Assert Invariants at EVERY step:
      assert(isRouteAllowed(runtime.activeRoute, role), `Active route ${runtime.activeRoute} must be authorized for ${role}`);
      
      const routeParam = runtime.searchParams.get('route');
      const tabParam = runtime.searchParams.get('tab');
      if (routeParam) {
        assertEqual(runtime.activeRoute, routeParam, 'activeRoute must match routeParam in URL');
      } else if (!tabParam) {
        // Root URL
        const expectedDefault = role === 'responsavel' ? 'portal_aluno' : 'overview';
        assertEqual(runtime.activeRoute, expectedDefault, 'Root URL must match default role route');
      }

      if (tabParam) {
        const currentItem = MENU_ITEMS.find(m => m.id === runtime.activeRoute);
        if (currentItem?.subItems) {
          const validTabs = currentItem.subItems.map(s => s.tabKey);
          assert(validTabs.includes(tabParam), `tabParam ${tabParam} must belong to ${runtime.activeRoute}`);
        }
      }
    }
  }

  assertEqual(totalActions, 200, 'Executed 200 fuzz actions across multiple roles');
});

// -----------------------------------------------------------------------------
// SECTION 7: Malformed Inputs, Injection & Boundary Resilience
// -----------------------------------------------------------------------------
console.log('\nSECTION 7: Malformed Inputs, Injection & Boundary Resilience');

test('findRouteByTab handles null, undefined, empty, and non-existent keys gracefully', () => {
  assertEqual(findRouteByTab(null), undefined);
  assertEqual(findRouteByTab(undefined), undefined);
  assertEqual(findRouteByTab(''), undefined);
  assertEqual(findRouteByTab('__proto__'), undefined);
  assertEqual(findRouteByTab('<script>alert(1)</script>'), undefined);
  assertEqual(findRouteByTab('../../etc/passwd'), undefined);
  assertEqual(findRouteByTab('   '), undefined);
});

test('isRouteAllowed handles invalid routes and unknown roles safely', () => {
  assertEqual(isRouteAllowed('invalid_route', 'admin'), true); // admin has global bypass
  assertEqual(isRouteAllowed('invalid_route', 'professor'), false);
  assertEqual(isRouteAllowed('invalid_route', 'unknown_role'), false);
  assertEqual(isRouteAllowed('secretaria', 'unknown_role'), false);
  assertEqual(isRouteAllowed('overview', 'unknown_role'), true); // only responsavel is denied overview
});

test('Dashboard runtime with malformed ?route and ?tab parameters safely falls back to default', () => {
  const malformedUrls = [
    '/?route=__proto__',
    '/?route=null&tab=undefined',
    '/?tab=<script>alert(1)</script>',
    '/?route=evil_dashboard',
    '/?route=&tab=',
    '/?route=overview&tab=nonexistent_tab'
  ];

  for (const url of malformedUrls) {
    const runtime = new DashboardNavigationRuntime(url, 'professor');
    assert(isRouteAllowed(runtime.activeRoute, 'professor'), `Route ${runtime.activeRoute} from url ${url} must be allowed for professor`);
  }
});

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log('STRESS TEST SUMMARY');
console.log('================================================================================');
console.log(`Total Checks Executed: ${passedCount + failedCount}`);
console.log(`Passed Checks:         ${passedCount}`);
console.log(`Failed Checks:         ${failedCount}`);
console.log(`Verdict:               ${failedCount === 0 ? 'APPROVE' : 'REQUEST_CHANGES'}`);
console.log('================================================================================\n');

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
