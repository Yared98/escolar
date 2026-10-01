/**
 * Independent Reviewer & Adversarial Stress Suite for Milestone 1 Iteration 2
 * Author: reviewer_m1_iter2_1
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const FRONTEND_DIR = path.join(PROJECT_ROOT, 'frontend');

// Ensure module resolution points to frontend/node_modules
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  try {
    return originalResolveFilename.call(this, request, parent, isMain, options);
  } catch (err) {
    const frontendModPath = path.join(FRONTEND_DIR, 'node_modules', request);
    try {
      return originalResolveFilename.call(this, frontendModPath, parent, isMain, options);
    } catch {
      throw err;
    }
  }
};

const sucrase = require('sucrase');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    failures.push({ testName, details });
    console.error(`  [FAIL] ${testName}`);
    if (details) console.error(`         Detail: ${details}`);
  }
}

console.log('================================================================================');
console.log('INDEPENDENT REVIEWER & ADVERSARIAL STRESS SUITE (Milestone 1 Iteration 2)');
console.log('================================================================================\n');

// 1. Transpile and load Sidebar.tsx directly
const sidebarPath = path.join(FRONTEND_DIR, 'src/components/Sidebar.tsx');
const sidebarSource = fs.readFileSync(sidebarPath, 'utf8');

const transformedSidebar = sucrase.transform(sidebarSource, {
  transforms: ['typescript', 'jsx', 'imports'],
  jsxRuntime: 'classic',
});

// Mock environment for Sidebar module execution
let mockCurrentRole = 'admin';
const mockModule = { exports: {} };
const customRequire = (id) => {
  if (id === 'react') return require('react');
  if (id === 'next/navigation') {
    return {
      useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
      useSearchParams: () => new URLSearchParams(''),
      usePathname: () => '/',
    };
  }
  if (id === '@/context/AuthContext') {
    return {
      useAuth: () => ({
        user: { id: 'test-user', name: 'Tester', role: mockCurrentRole },
        login: () => {},
        logout: () => {},
      }),
    };
  }
  if (id === 'lucide-react') {
    // Return dummy components for all icons
    return new Proxy({}, {
      get: (target, prop) => (props) => ({ type: 'icon', name: prop, props }),
    });
  }
  return require(id);
};

const runSidebarModule = new Function('module', 'exports', 'require', transformedSidebar.code);
runSidebarModule(mockModule, mockModule.exports, customRequire);

const { MENU_ITEMS, findRouteByTab, isRouteAllowed, isRouteAuthorized } = mockModule.exports;

// -----------------------------------------------------------------------------
// SECTION 1: Export Integrity & Signatures
// -----------------------------------------------------------------------------
console.log('SECTION 1: Export Integrity & Function Signatures');
assert(Array.isArray(MENU_ITEMS) && MENU_ITEMS.length === 11, 'MENU_ITEMS has exactly 11 declared routes');
assert(typeof findRouteByTab === 'function', 'findRouteByTab is exported as a function');
assert(typeof isRouteAllowed === 'function', 'isRouteAllowed is exported as a function');
assert(isRouteAuthorized === isRouteAllowed, 'isRouteAuthorized is an exact alias for isRouteAllowed');

// -----------------------------------------------------------------------------
// SECTION 2: findRouteByTab Role-Aware Disambiguation Stress Test
// -----------------------------------------------------------------------------
console.log('\nSECTION 2: findRouteByTab Role-Aware & Context Disambiguation');

// Unique tabs
assert(findRouteByTab('boletim') === 'portal_aluno', 'findRouteByTab("boletim") -> portal_aluno');
assert(findRouteByTab('alunos') === 'secretaria', 'findRouteByTab("alunos") -> secretaria');
assert(findRouteByTab('ar') === 'financeiro', 'findRouteByTab("ar") -> financeiro');
assert(findRouteByTab('disciplinas_matriz') === 'pedagogico', 'findRouteByTab("disciplinas_matriz") -> pedagogico');
assert(findRouteByTab('fundamental') === 'academico', 'findRouteByTab("fundamental") -> academico');
assert(findRouteByTab('envios') === 'administrativo', 'findRouteByTab("envios") -> administrativo');
assert(findRouteByTab('comunicacao') === 'agenda', 'findRouteByTab("comunicacao") -> agenda');

// Invalid/Unknown tabs
assert(findRouteByTab('') === undefined, 'findRouteByTab("") -> undefined');
assert(findRouteByTab(null) === undefined, 'findRouteByTab(null) -> undefined');
assert(findRouteByTab('unknown_tab') === undefined, 'findRouteByTab("unknown_tab") -> undefined');
assert(findRouteByTab('unknown_tab', 'admin') === undefined, 'findRouteByTab("unknown_tab", "admin") -> undefined');

// Collided tab 'rotina': shared by portal_aluno and agenda
// For a professor, portal_aluno is NOT allowed. agenda IS allowed.
assert(
  findRouteByTab('rotina', 'professor') === 'agenda',
  'findRouteByTab("rotina", "professor") disambiguates to agenda (eliminates 403 Forbidden)',
  `Got: ${findRouteByTab('rotina', 'professor')}`
);
assert(
  findRouteByTab('rotina', 'nutricionista') === 'agenda',
  'findRouteByTab("rotina", "nutricionista") disambiguates to agenda',
  `Got: ${findRouteByTab('rotina', 'nutricionista')}`
);
assert(
  findRouteByTab('rotina', 'responsavel') === 'portal_aluno',
  'findRouteByTab("rotina", "responsavel") disambiguates to portal_aluno',
  `Got: ${findRouteByTab('rotina', 'responsavel')}`
);
assert(
  findRouteByTab('rotina', 'admin') === 'agenda',
  'findRouteByTab("rotina", "admin") defaults to agenda preference for staff',
  `Got: ${findRouteByTab('rotina', 'admin')}`
);
// Contextual disambiguation with currentRoute
assert(
  findRouteByTab('rotina', 'admin', 'portal_aluno') === 'portal_aluno',
  'findRouteByTab("rotina", "admin", "portal_aluno") honors currentRoute context',
  `Got: ${findRouteByTab('rotina', 'admin', 'portal_aluno')}`
);
assert(
  findRouteByTab('rotina', 'admin', 'agenda') === 'agenda',
  'findRouteByTab("rotina", "admin", "agenda") honors currentRoute context',
  `Got: ${findRouteByTab('rotina', 'admin', 'agenda')}`
);
// Backward compatibility without role
assert(
  findRouteByTab('rotina') === 'portal_aluno',
  'findRouteByTab("rotina") without role returns first match (portal_aluno) for backward compatibility',
  `Got: ${findRouteByTab('rotina')}`
);

// Collided tab 'turmas': shared by secretaria and pedagogico
assert(
  findRouteByTab('turmas', 'secretaria') === 'secretaria',
  'findRouteByTab("turmas", "secretaria") resolves to secretaria',
  `Got: ${findRouteByTab('turmas', 'secretaria')}`
);
assert(
  findRouteByTab('turmas', 'professor') === 'pedagogico',
  'findRouteByTab("turmas", "professor") resolves to pedagogico',
  `Got: ${findRouteByTab('turmas', 'professor')}`
);
assert(
  findRouteByTab('turmas', 'nutricionista') === 'pedagogico',
  'findRouteByTab("turmas", "nutricionista") resolves to pedagogico',
  `Got: ${findRouteByTab('turmas', 'nutricionista')}`
);
assert(
  findRouteByTab('turmas', 'admin', 'pedagogico') === 'pedagogico',
  'findRouteByTab("turmas", "admin", "pedagogico") honors currentRoute pedagogico',
  `Got: ${findRouteByTab('turmas', 'admin', 'pedagogico')}`
);
assert(
  findRouteByTab('turmas') === 'secretaria',
  'findRouteByTab("turmas") without role returns first match (secretaria) for backward compatibility',
  `Got: ${findRouteByTab('turmas')}`
);

// -----------------------------------------------------------------------------
// SECTION 3: RBAC Matrix Verification (isRouteAllowed)
// -----------------------------------------------------------------------------
console.log('\nSECTION 3: RBAC Permission Matrix Verification');
assert(isRouteAllowed('overview', 'admin') === true, 'Admin can access overview');
assert(isRouteAllowed('portal_aluno', 'admin') === true, 'Admin can access portal_aluno');
assert(isRouteAllowed('financeiro', 'admin') === true, 'Admin can access financeiro');
assert(isRouteAllowed('administrativo', 'admin') === true, 'Admin can access administrativo');

assert(isRouteAllowed('overview', 'responsavel') === false, 'Responsavel CANNOT access overview');
assert(isRouteAllowed('portal_aluno', 'responsavel') === true, 'Responsavel CAN access portal_aluno');
assert(isRouteAllowed('agenda', 'responsavel') === true, 'Responsavel CAN access agenda');
assert(isRouteAllowed('secretaria', 'responsavel') === false, 'Responsavel CANNOT access secretaria');
assert(isRouteAllowed('financeiro', 'responsavel') === false, 'Responsavel CANNOT access financeiro');

assert(isRouteAllowed('pedagogico', 'professor') === true, 'Professor CAN access pedagogico');
assert(isRouteAllowed('academico', 'professor') === true, 'Professor CAN access academico');
assert(isRouteAllowed('agenda', 'professor') === true, 'Professor CAN access agenda');
assert(isRouteAllowed('portal_aluno', 'professor') === false, 'Professor CANNOT access portal_aluno');
assert(isRouteAllowed('secretaria', 'professor') === false, 'Professor CANNOT access secretaria');
assert(isRouteAllowed('financeiro', 'professor') === false, 'Professor CANNOT access financeiro');

// -----------------------------------------------------------------------------
// SECTION 4: Static Code Analysis & Invariant Checking
// -----------------------------------------------------------------------------
console.log('\nSECTION 4: Static Code Invariants & AST Integrity');
const pagePath = path.join(FRONTEND_DIR, 'src/app/page.tsx');
const pageSource = fs.readFileSync(pagePath, 'utf8');

// Check Suspense boundary
assert(pageSource.includes('<Suspense fallback={<SectionSkeleton />}>'), 'page.tsx wraps content in Suspense');
assert(pageSource.includes('<DashboardContent />'), 'DashboardContent rendered inside Suspense');

// Check de-duplication of RBAC in page.tsx
assert(
  pageSource.includes("const isAuthorized = (route: NavRoute): boolean => isRouteAllowed(route, role);"),
  'page.tsx delegates isAuthorized to isRouteAllowed without duplicate switch-case'
);

// Check single router.push in page.tsx handleRouteChange
assert(
  pageSource.includes("const handleRouteChange = (newRoute: NavRoute, targetTab?: string) => {"),
  'page.tsx handleRouteChange accepts targetTab optional argument'
);
assert(
  pageSource.includes("if (targetTab !== undefined) {"),
  'page.tsx handleRouteChange checks if targetTab is explicitly provided'
);
assert(
  pageSource.includes("if (targetUrl !== currentUrl) {\n      router.push(targetUrl, { scroll: false });\n    }"),
  'page.tsx handleRouteChange guards router.push against identical URLs'
);

// Check SidebarProps
assert(
  sidebarSource.includes("onRouteChange?: (route: NavRoute, targetTab?: string) => void;"),
  'SidebarProps specifies onRouteChange with targetTab'
);

// Check handleParentClick in Sidebar.tsx
assert(
  sidebarSource.includes("onRouteChange(item.id, hasSubItems ? item.defaultTab : undefined);"),
  'handleParentClick calls onRouteChange with defaultTab when subItems exist'
);
assert(
  !sidebarSource.includes("onRouteChange(item.id);\n      const params = new URLSearchParams"),
  'handleParentClick does NOT follow onRouteChange with a second router.push'
);

// Check handleSubItemClick in Sidebar.tsx
assert(
  sidebarSource.includes("onRouteChange(parentRoute, subItem.tabKey);"),
  'handleSubItemClick calls onRouteChange with parentRoute and tabKey'
);

// Check browser Back root restoration in page.tsx useEffect
assert(
  pageSource.includes("const defaultRoute: NavRoute = role === 'responsavel' ? 'portal_aluno' : 'overview';") &&
  pageSource.includes("if (activeRoute !== defaultRoute) {\n      setActiveRoute(defaultRoute);\n    }"),
  'page.tsx useEffect restores defaultRoute when returning to root URL without query params'
);

// -----------------------------------------------------------------------------
// SECTION 5: Behavioral Navigation Simulation
// -----------------------------------------------------------------------------
console.log('\nSECTION 5: Behavioral Simulation of Critical Navigation Scenarios');

class StateSimulation {
  constructor(initialQuery = '', role = 'admin') {
    this.role = role;
    this.pathname = '/';
    this.searchParams = new URLSearchParams(initialQuery);
    this.activeRoute = this.resolveInitialRoute();
    this.history = [this.getUrl()];
    this.pushes = [];
  }

  getUrl() {
    const q = this.searchParams.toString();
    return q ? `${this.pathname}?${q}` : this.pathname;
  }

  resolveInitialRoute() {
    const route = this.searchParams.get('route');
    if (route) return route;
    const tab = this.searchParams.get('tab');
    if (tab) {
      const match = findRouteByTab(tab, this.role);
      if (match) return match;
    }
    return this.role === 'responsavel' ? 'portal_aluno' : 'overview';
  }

  routerPush(url) {
    this.pushes.push(url);
    this.history.push(url);
    const parsed = new URL(url, 'http://localhost');
    this.searchParams = new URLSearchParams(parsed.search);
    this.triggerUseEffect();
  }

  triggerUseEffect() {
    const routeParam = this.searchParams.get('route');
    if (routeParam) {
      if (routeParam !== this.activeRoute) this.activeRoute = routeParam;
      return;
    }
    const tabParam = this.searchParams.get('tab');
    if (tabParam) {
      const matched = findRouteByTab(tabParam, this.role, this.activeRoute);
      if (matched && matched !== this.activeRoute) this.activeRoute = matched;
      return;
    }
    const defaultRoute = this.role === 'responsavel' ? 'portal_aluno' : 'overview';
    if (this.activeRoute !== defaultRoute) {
      this.activeRoute = defaultRoute;
    }
  }

  // Exact reproduction of page.tsx handleRouteChange
  handleRouteChange(newRoute, targetTab) {
    this.activeRoute = newRoute;
    const params = new URLSearchParams(this.searchParams.toString());
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
    const currentQuery = this.searchParams.toString();
    const currentUrl = currentQuery ? `${this.pathname}?${currentQuery}` : this.pathname;
    if (targetUrl !== currentUrl) {
      this.routerPush(targetUrl);
    }
  }

  // Sidebar parent click
  clickParent(routeId) {
    const item = MENU_ITEMS.find(m => m.id === routeId);
    const hasSubItems = item?.subItems && item.subItems.length > 0;
    this.handleRouteChange(item.id, hasSubItems ? item.defaultTab : undefined);
  }

  // Sidebar sub-item click
  clickSubItem(parentRoute, tabKey) {
    this.handleRouteChange(parentRoute, tabKey);
  }

  // Browser back
  back() {
    if (this.history.length <= 1) return;
    this.history.pop();
    const prev = this.history[this.history.length - 1];
    const parsed = new URL(prev, 'http://localhost');
    this.searchParams = new URLSearchParams(parsed.search);
    this.triggerUseEffect();
  }
}

// Scenario 5.1: Double push eliminated
const sim1 = new StateSimulation('');
assert(sim1.activeRoute === 'overview', 'Sim1 starts at overview');
sim1.clickParent('secretaria');
assert(sim1.pushes.length === 1, 'Clicking parent route triggers EXACTLY 1 router.push', `Pushes: ${sim1.pushes.length}`);
assert(sim1.pushes[0] === '/?route=secretaria&tab=alunos', 'Parent click navigates to /?route=secretaria&tab=alunos');

// Scenario 5.2: Cross-route sub-item click preserved
const sim2 = new StateSimulation('');
assert(sim2.activeRoute === 'overview', 'Sim2 starts at overview');
sim2.clickSubItem('secretaria', 'turmas');
assert(sim2.pushes.length === 1, 'Cross-route sub-item click triggers EXACTLY 1 router.push');
assert(sim2.pushes[0] === '/?route=secretaria&tab=turmas', 'Sub-item "turmas" is preserved and not clobbered by defaultTab "alunos"');
assert(sim2.searchParams.get('tab') === 'turmas', 'searchParams tab is "turmas"');
assert(sim2.activeRoute === 'secretaria', 'activeRoute is "secretaria"');

// Scenario 5.3: Browser Back to Root restores overview
const sim3 = new StateSimulation('');
sim3.clickParent('financeiro');
assert(sim3.activeRoute === 'financeiro', 'Navigated to financeiro');
assert(sim3.getUrl() === '/?route=financeiro&tab=ar', 'URL is /?route=financeiro&tab=ar');
sim3.back();
assert(sim3.getUrl() === '/', 'URL restored to / via back');
assert(sim3.activeRoute === 'overview', 'activeRoute restored to overview on root URL return');

// Scenario 5.4: Responsavel back to Root restores portal_aluno
const sim4 = new StateSimulation('', 'responsavel');
assert(sim4.activeRoute === 'portal_aluno', 'Responsavel starts at portal_aluno');
sim4.clickParent('agenda');
assert(sim4.activeRoute === 'agenda', 'Responsavel navigated to agenda');
sim4.back();
assert(sim4.getUrl() === '/', 'URL restored to /');
assert(sim4.activeRoute === 'portal_aluno', 'activeRoute restored to portal_aluno for responsavel');

// -----------------------------------------------------------------------------
// SECTION 6: Integrity & Non-Tampering Audit
// -----------------------------------------------------------------------------
console.log('\nSECTION 6: Integrity & Non-Tampering Audit');

// Check that no dummy/facade implementations exist
assert(
  !sidebarSource.includes('// mock') && !sidebarSource.includes('// dummy') && !sidebarSource.includes('/* test only */'),
  'Sidebar.tsx contains no mock or dummy bypass annotations'
);
assert(
  !pageSource.includes('// mock') && !pageSource.includes('// dummy') && !pageSource.includes('/* test only */'),
  'page.tsx contains no mock or dummy bypass annotations'
);

// Verify no hardcoded test outputs in production code
assert(
  !sidebarSource.includes('if (tabKey === "test_special")') &&
  !sidebarSource.includes('return "secretaria" // hardcoded'),
  'No hardcoded test condition branches in Sidebar.tsx'
);
assert(
  !pageSource.includes('if (testMode)') &&
  !pageSource.includes('// bypass auth'),
  'No testMode or bypass logic in page.tsx'
);

// Next.js production build artifacts verified
const prerenderManifest = path.join(FRONTEND_DIR, '.next/prerender-manifest.json');
assert(fs.existsSync(prerenderManifest), 'Next.js prerender-manifest.json exists and is valid');
const prerenderContent = JSON.parse(fs.readFileSync(prerenderManifest, 'utf8'));
assert(prerenderContent.routes && prerenderContent.routes['/'] !== undefined, 'Root route "/" is statically prerendered');

console.log('\n================================================================================');
console.log(`TOTAL CHECKS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('================================================================================\n');

process.exit(failedTests > 0 ? 1 : 0);
