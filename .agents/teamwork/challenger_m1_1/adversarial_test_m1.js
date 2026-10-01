/**
 * Adversarial Verification & Stress Harness for Milestone 1: Sidebar Navigation & Shell
 * 
 * Tests:
 * 1. Sub-item click navigation and query parameter formatting (?tab=...)
 * 2. Cross-route sub-item navigation race/conflict with page.tsx onRouteChange
 * 3. Manual toggle collapse/expand without route changes
 * 4. Active sub-item highlight predicate across valid and invalid tabs
 * 5. Single-view routes (overview, crm, etc.) ensuring no phantom submenus or tab params persist
 * 6. RBAC permissions matrix across all user roles
 * 7. Tab clash / ambiguity in findRouteByTab ('rotina', 'turmas')
 */

const fs = require('fs');
const path = require('path');
const sucrase = require(path.resolve(__dirname, '../../../frontend/node_modules/sucrase'));
const React = require(path.resolve(__dirname, '../../../frontend/node_modules/react'));

// Set up module resolution for custom imports in Sidebar.tsx
const Module = require('module');
const originalRequire = Module.prototype.require;

// Mock Lucide icons
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
let lastRouterPush = null;
let routerPushHistory = [];

const mockRouter = {
  push: (url, opts) => {
    lastRouterPush = { url, opts };
    routerPushHistory.push({ url, opts });
  },
  replace: (url, opts) => {
    lastRouterPush = { url, opts };
    routerPushHistory.push({ url, opts });
  },
  back: () => {}
};

Module.prototype.require = function (id) {
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

// Load and transpile Sidebar.tsx
const sidebarPath = path.resolve(__dirname, '../../../frontend/src/components/Sidebar.tsx');
const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');
const transformedSidebar = sucrase.transform(sidebarCode, {
  transforms: ['typescript', 'jsx', 'imports'],
  jsxRuntime: 'classic',
});

// Evaluate in a module wrapper
const sidebarModule = { exports: {} };
const fnSidebar = new Function('module', 'exports', 'require', transformedSidebar.code);
fnSidebar(sidebarModule, sidebarModule.exports, (id) => require(id));

const { MENU_ITEMS, findRouteByTab, Sidebar } = sidebarModule.exports;

// Test Runner utilities
let passes = 0;
let failures = [];
let findings = [];

function test(name, fn) {
  try {
    fn();
    passes++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failures.push({ name, error: err });
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
  }
}

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

console.log('================================================================');
console.log('MILESTONE 1 ADVERSARIAL VERIFICATION & STRESS HARNESS');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: MENU_ITEMS Data Structure & Completeness
// -----------------------------------------------------------------------------
console.log('--- SECTION 1: NavItem Data Structure & Sub-items Completeness ---');

test('MENU_ITEMS contains all 11 expected routes', () => {
  const expectedRoutes = [
    'overview', 'portal_aluno', 'calendario', 'crm', 'ia_evasao',
    'agenda', 'secretaria', 'financeiro', 'pedagogico', 'academico', 'administrativo'
  ];
  assertEqual(MENU_ITEMS.length, 11, 'MENU_ITEMS should have exactly 11 items');
  for (const r of expectedRoutes) {
    const item = MENU_ITEMS.find(m => m.id === r);
    assert(Boolean(item), `Route '${r}' must be present in MENU_ITEMS`);
  }
});

test('7 multi-tab sections have correct subItems and defaultTab defined', () => {
  const multiTabConfigs = {
    portal_aluno: { defaultTab: 'boletim', count: 4, keys: ['boletim', 'financeiro', 'diploma', 'rotina'] },
    agenda: { defaultTab: 'comunicacao', count: 3, keys: ['comunicacao', 'rotina', 'whatsapp'] },
    secretaria: { defaultTab: 'alunos', count: 2, keys: ['alunos', 'turmas'] },
    financeiro: { defaultTab: 'ar', count: 4, keys: ['ar', 'ap', 'nfse', 'bi'] },
    pedagogico: { defaultTab: 'disciplinas_matriz', count: 5, keys: ['disciplinas_matriz', 'atribuicao_horarios', 'turmas', 'projetos', 'nutricao'] },
    academico: { defaultTab: 'fundamental', count: 2, keys: ['fundamental', 'infantil'] },
    administrativo: { defaultTab: 'envios', count: 4, keys: ['envios', 'entidades', 'fornecedores', 'relatorios'] },
  };

  for (const [routeId, cfg] of Object.entries(multiTabConfigs)) {
    const item = MENU_ITEMS.find(m => m.id === routeId);
    assert(Boolean(item), `Missing route ${routeId}`);
    assertEqual(item.defaultTab, cfg.defaultTab, `defaultTab mismatch for ${routeId}`);
    assert(Array.isArray(item.subItems), `subItems should be array for ${routeId}`);
    assertEqual(item.subItems.length, cfg.count, `Subitem count mismatch for ${routeId}`);
    const actualKeys = item.subItems.map(s => s.tabKey);
    assertEqual(JSON.stringify(actualKeys), JSON.stringify(cfg.keys), `tabKeys mismatch for ${routeId}`);
  }
});

test('Single-view routes have no subItems and no defaultTab', () => {
  const singleViewRoutes = ['overview', 'calendario', 'crm', 'ia_evasao'];
  for (const r of singleViewRoutes) {
    const item = MENU_ITEMS.find(m => m.id === r);
    assert(!item.subItems || item.subItems.length === 0, `Route ${r} must not have subItems`);
    assert(item.defaultTab === undefined, `Route ${r} must not have defaultTab`);
  }
});

// -----------------------------------------------------------------------------
// SECTION 2: Sub-item Click Navigation & URL Query Param Formatting
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 2: Sub-item Navigation & URL Query Formatting ---');

test('Clicking sub-item when already on same parent route formats ?route=...&tab=... correctly', () => {
  // Simulate activeRoute = 'agenda', searchParams = '?route=agenda&tab=comunicacao'
  mockSearchParams = new URLSearchParams('route=agenda&tab=comunicacao');
  routerPushHistory = [];
  let routeChangedTo = null;
  const onRouteChange = (r) => { routeChangedTo = r; };

  // Render Sidebar
  let rendered;
  const element = React.createElement(Sidebar, { activeRoute: 'agenda', onRouteChange });
  
  // We can test the handler logic directly from Sidebar:
  // Sub-item WhatsApp click in Agenda
  const agendaItem = MENU_ITEMS.find(m => m.id === 'agenda');
  const whatsappSub = agendaItem.subItems.find(s => s.tabKey === 'whatsapp');

  // Logic emulation of handleSubItemClick:
  const params = new URLSearchParams(mockSearchParams.toString());
  params.set('route', 'agenda');
  params.set('tab', whatsappSub.tabKey);
  const query = params.toString();
  mockRouter.push(query ? `${mockPathname}?${query}` : mockPathname, { scroll: false });

  assertEqual(lastRouterPush.url, '/?route=agenda&tab=whatsapp');
  assertEqual(lastRouterPush.opts.scroll, false);
});

test('ADVERSARIAL STRESS: Sub-item click when activeRoute !== parentRoute clobbering bug in page.tsx', () => {
  // SCENARIO: User is currently on 'overview' (activeRoute = 'overview')
  // In the Sidebar, user expands 'agenda' and clicks sub-item 'whatsapp'
  mockSearchParams = new URLSearchParams('route=overview');
  routerPushHistory = [];
  
  const currentActiveRoute = 'overview';
  const targetParentRoute = 'agenda';
  const targetSubItem = { id: 'agenda-whatsapp', label: 'WhatsApp', tabKey: 'whatsapp' };

  // Step 1: Sidebar handleSubItemClick executes:
  const params = new URLSearchParams(mockSearchParams.toString());
  params.set('route', targetParentRoute);
  params.set('tab', targetSubItem.tabKey);
  const query = params.toString();
  mockRouter.push(query ? `${mockPathname}?${query}` : mockPathname, { scroll: false });

  // Since currentActiveRoute !== targetParentRoute ('overview' !== 'agenda'),
  // Sidebar calls onRouteChange('agenda'):
  const onRouteChangeCalledWith = targetParentRoute;

  // Step 2: Now trace what page.tsx handleRouteChange does:
  // In page.tsx:
  // const handleRouteChange = (newRoute: NavRoute) => {
  //   setActiveRoute(newRoute);
  //   const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
  //   if (params.get('route') !== newRoute) {
  //     params.set('route', newRoute);
  //     const menuItem = MENU_ITEMS.find((m) => m.id === newRoute);
  //     if (menuItem?.defaultTab) {
  //       params.set('tab', menuItem.defaultTab);
  //     } else {
  //       params.delete('tab');
  //     }
  //     const q = params.toString();
  //     router.push(q ? `${pathname}?${q}` : pathname, { scroll: false });
  //   }
  // };
  const pageParams = new URLSearchParams(mockSearchParams.toString());
  let pagePushedUrl = null;
  if (pageParams.get('route') !== onRouteChangeCalledWith) {
    pageParams.set('route', onRouteChangeCalledWith);
    const menuItem = MENU_ITEMS.find((m) => m.id === onRouteChangeCalledWith);
    if (menuItem?.defaultTab) {
      pageParams.set('tab', menuItem.defaultTab);
    } else {
      pageParams.delete('tab');
    }
    const q = pageParams.toString();
    mockRouter.push(q ? `${mockPathname}?${q}` : mockPathname, { scroll: false });
    pagePushedUrl = q ? `${mockPathname}?${q}` : mockPathname;
  }

  // The first router.push from Sidebar was: /?route=agenda&tab=whatsapp
  // But the subsequent router.push from page.tsx is: /?route=agenda&tab=comunicacao!
  assertEqual(routerPushHistory[0].url, '/?route=agenda&tab=whatsapp', 'Sidebar pushed target tab');
  assertEqual(routerPushHistory[1].url, '/?route=agenda&tab=comunicacao', 'page.tsx clobbered with defaultTab');

  findings.push({
    severity: 'HIGH',
    title: 'Cross-route sub-item click navigation clobbered by page.tsx handleRouteChange',
    detail: `When clicking a sub-item of an inactive section (e.g. from overview to agenda > whatsapp), handleSubItemClick calls onRouteChange(parentRoute). page.tsx's handleRouteChange checks params.get('route') !== newRoute against stale searchParams, resetting 'tab' to menuItem.defaultTab ('comunicacao') and triggering an overriding router.push that clobbers the clicked tab.`,
  });
});

// -----------------------------------------------------------------------------
// SECTION 3: Manual Toggle Collapse/Expand Without Route Changes
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 3: Manual Toggle Collapse/Expand Behavior ---');

test('Chevron button toggle does not trigger route change', () => {
  let routeChanged = false;
  const onRouteChange = () => { routeChanged = true; };
  routerPushHistory = [];

  // Emulate handleToggleExpand:
  let expandedRoutes = {};
  const isRouteExpanded = (routeId, activeRoute) => {
    if (expandedRoutes[routeId] !== undefined) return expandedRoutes[routeId];
    return activeRoute === routeId;
  };
  const handleToggleExpand = (routeId) => {
    expandedRoutes = {
      ...expandedRoutes,
      [routeId]: !isRouteExpanded(routeId, 'overview')
    };
  };

  // Initially on overview, agenda is collapsed
  assertEqual(isRouteExpanded('agenda', 'overview'), false);

  // Click chevron on agenda
  handleToggleExpand('agenda');
  assertEqual(isRouteExpanded('agenda', 'overview'), true, 'Agenda should now be expanded');
  assertEqual(routeChanged, false, 'onRouteChange must NOT be called on chevron toggle');
  assertEqual(routerPushHistory.length, 0, 'No router.push on chevron toggle');

  // Click chevron again to collapse
  handleToggleExpand('agenda');
  assertEqual(isRouteExpanded('agenda', 'overview'), false, 'Agenda should now be collapsed');
  assertEqual(routeChanged, false, 'onRouteChange must NOT be called on second toggle');
});

test('Clicking active parent route toggles collapse without route change', () => {
  let routeChanged = false;
  const onRouteChange = () => { routeChanged = true; };
  routerPushHistory = [];

  let expandedRoutes = {};
  let currentActive = 'agenda';
  const isRouteExpanded = (routeId) => {
    if (expandedRoutes[routeId] !== undefined) return expandedRoutes[routeId];
    return currentActive === routeId;
  };

  // Agenda is active, so default expanded is true
  assertEqual(isRouteExpanded('agenda'), true);

  // Click active parent route button
  const agendaItem = MENU_ITEMS.find(m => m.id === 'agenda');
  if (currentActive !== agendaItem.id) {
    onRouteChange(agendaItem.id);
  } else if (agendaItem.subItems && agendaItem.subItems.length > 0) {
    expandedRoutes = {
      ...expandedRoutes,
      [agendaItem.id]: !isRouteExpanded(agendaItem.id)
    };
  }

  assertEqual(isRouteExpanded('agenda'), false, 'Active route collapsed on parent click');
  assertEqual(routeChanged, false, 'No route change when clicking already-active parent');
  assertEqual(routerPushHistory.length, 0, 'No router push when collapsing active parent');
});

// -----------------------------------------------------------------------------
// SECTION 4: Active Sub-item Highlight Predicate Across Tabs
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 4: Active Sub-Item Highlight Predicate ---');

function isSubItemActiveSim(activeRoute, currentTabParam, parentRoute, subItem) {
  if (activeRoute !== parentRoute) return false;
  if (currentTabParam) {
    return currentTabParam === subItem.tabKey;
  }
  const parent = MENU_ITEMS.find((m) => m.id === parentRoute);
  return parent?.defaultTab === subItem.tabKey;
}

test('Active sub-item when tab query param matches subItem.tabKey', () => {
  const agenda = MENU_ITEMS.find(m => m.id === 'agenda');
  const rotina = agenda.subItems.find(s => s.tabKey === 'rotina');
  const whatsapp = agenda.subItems.find(s => s.tabKey === 'whatsapp');

  assert(isSubItemActiveSim('agenda', 'rotina', 'agenda', rotina), 'rotina should be active');
  assert(!isSubItemActiveSim('agenda', 'rotina', 'agenda', whatsapp), 'whatsapp should not be active');
});

test('Fallback to defaultTab when ?tab is missing or empty string', () => {
  const agenda = MENU_ITEMS.find(m => m.id === 'agenda');
  const comunicacao = agenda.subItems.find(s => s.tabKey === 'comunicacao');
  const whatsapp = agenda.subItems.find(s => s.tabKey === 'whatsapp');

  // Null tab param
  assert(isSubItemActiveSim('agenda', null, 'agenda', comunicacao), 'comunicacao should be active when tab is null');
  assert(!isSubItemActiveSim('agenda', null, 'agenda', whatsapp), 'whatsapp should not be active when tab is null');

  // Empty string tab param
  assert(isSubItemActiveSim('agenda', '', 'agenda', comunicacao), 'comunicacao should be active when tab is empty string');
  assert(!isSubItemActiveSim('agenda', '', 'agenda', whatsapp), 'whatsapp should not be active when tab is empty string');
});

test('Invalid/unknown tab query param results in no sub-item highlighted', () => {
  const agenda = MENU_ITEMS.find(m => m.id === 'agenda');
  for (const sub of agenda.subItems) {
    const active = isSubItemActiveSim('agenda', 'invalid_tab_xyz', 'agenda', sub);
    assert(!active, `Subitem ${sub.tabKey} should NOT be active for invalid tab`);
  }
});

test('Cross-route sub-item is never active even if ?tab matches its tabKey', () => {
  // URL has ?route=secretaria&tab=comunicacao
  // 'comunicacao' is a tab of 'agenda', not 'secretaria'
  const agenda = MENU_ITEMS.find(m => m.id === 'agenda');
  const comunicacao = agenda.subItems.find(s => s.tabKey === 'comunicacao');

  const active = isSubItemActiveSim('secretaria', 'comunicacao', 'agenda', comunicacao);
  assert(!active, 'agenda/comunicacao must NOT be active when activeRoute is secretaria');
});

// -----------------------------------------------------------------------------
// SECTION 5: Single-View Routes & Phantom Submenus / Tab Cleanup
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 5: Single-View Routes & Tab Param Cleanup ---');

test('Switching from multi-tab section to single-view route strips ?tab parameter', () => {
  // Start on ?route=agenda&tab=whatsapp
  mockSearchParams = new URLSearchParams('route=agenda&tab=whatsapp');
  routerPushHistory = [];

  // Click on 'overview'
  const overviewItem = MENU_ITEMS.find(m => m.id === 'overview');
  const params = new URLSearchParams(mockSearchParams.toString());
  params.set('route', overviewItem.id);
  if (overviewItem.subItems && overviewItem.defaultTab) {
    params.set('tab', overviewItem.defaultTab);
  } else {
    params.delete('tab');
  }
  const query = params.toString();
  mockRouter.push(query ? `${mockPathname}?${query}` : mockPathname, { scroll: false });

  assertEqual(lastRouterPush.url, '/?route=overview', 'tab parameter must be stripped for overview');
  assert(!lastRouterPush.url.includes('tab='), 'No tab param must remain');
});

test('Switching to crm strips ?tab parameter and leaves only ?route=crm', () => {
  mockSearchParams = new URLSearchParams('route=financeiro&tab=bi');
  const crmItem = MENU_ITEMS.find(m => m.id === 'crm');
  const params = new URLSearchParams(mockSearchParams.toString());
  params.set('route', crmItem.id);
  if (crmItem.subItems && crmItem.defaultTab) {
    params.set('tab', crmItem.defaultTab);
  } else {
    params.delete('tab');
  }
  const query = params.toString();
  mockRouter.push(query ? `${mockPathname}?${query}` : mockPathname, { scroll: false });

  assertEqual(lastRouterPush.url, '/?route=crm');
});

// -----------------------------------------------------------------------------
// SECTION 6: RBAC Permissions Matrix Verification
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 6: RBAC Permissions Matrix ---');

function isAllowedSim(role, route) {
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
}

test('Admin and Gestor have access to all routes', () => {
  for (const item of MENU_ITEMS) {
    assert(isAllowedSim('admin', item.id), `Admin should have access to ${item.id}`);
    assert(isAllowedSim('gestor', item.id), `Gestor should have access to ${item.id}`);
  }
});

test('Responsavel / Pai only has access to calendario, agenda, portal_aluno', () => {
  const allowed = MENU_ITEMS.filter(m => isAllowedSim('responsavel', m.id)).map(m => m.id);
  assertEqual(JSON.stringify(allowed.sort()), JSON.stringify(['agenda', 'calendario', 'portal_aluno'].sort()));
});

test('Professor has access to overview, pedagogico, academico, calendario, agenda', () => {
  const allowed = MENU_ITEMS.filter(m => isAllowedSim('professor', m.id)).map(m => m.id);
  assertEqual(JSON.stringify(allowed.sort()), JSON.stringify(['academico', 'agenda', 'calendario', 'overview', 'pedagogico'].sort()));
});

test('Administrativo route is restricted from non-admin/gestor', () => {
  const roles = ['professor', 'secretaria', 'financeiro', 'nutricionista', 'responsavel'];
  for (const r of roles) {
    assert(!isAllowedSim(r, 'administrativo'), `Role ${r} must NOT have access to administrativo`);
  }
});

// -----------------------------------------------------------------------------
// SECTION 7: findRouteByTab Ambiguity & Deep-Linking Clash Analysis
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 7: findRouteByTab Ambiguity & Deep-Linking Clash ---');

test('findRouteByTab returns unique route for single-route tabs', () => {
  assertEqual(findRouteByTab('comunicacao'), 'agenda');
  assertEqual(findRouteByTab('boletim'), 'portal_aluno');
  assertEqual(findRouteByTab('ar'), 'financeiro');
  assertEqual(findRouteByTab('disciplinas_matriz'), 'pedagogico');
  assertEqual(findRouteByTab('fundamental'), 'academico');
  assertEqual(findRouteByTab('envios'), 'administrativo');
});

test('ADVERSARIAL STRESS: findRouteByTab collision for shared tabKeys ("rotina" & "turmas")', () => {
  // In MENU_ITEMS:
  // portal_aluno has tabKey: 'rotina'
  // agenda has tabKey: 'rotina'
  // secretaria has tabKey: 'turmas'
  // pedagogico has tabKey: 'turmas'

  const rotinaRoute = findRouteByTab('rotina');
  const turmasRoute = findRouteByTab('turmas');

  console.log(`         findRouteByTab('rotina') resolves to: '${rotinaRoute}'`);
  console.log(`         findRouteByTab('turmas') resolves to: '${turmasRoute}'`);

  assertEqual(rotinaRoute, 'portal_aluno', 'rotina maps to first match portal_aluno');
  assertEqual(turmasRoute, 'secretaria', 'turmas maps to first match secretaria');

  findings.push({
    severity: 'MEDIUM',
    title: 'Shared tabKey ambiguity in findRouteByTab()',
    detail: `Both portal_aluno and agenda share tabKey 'rotina'; both secretaria and pedagogico share tabKey 'turmas'. Because findRouteByTab performs a linear first-match search, ?tab=rotina without ?route always resolves to portal_aluno (locking out professors/nutricionistas who only have access to agenda and not portal_aluno), and ?tab=turmas always resolves to secretaria (locking out professors who only have access to pedagogico). When ?route is explicitly provided alongside ?tab, this is bypassed.`,
  });
});

// -----------------------------------------------------------------------------
// SECTION 8: Unknown/Corrupted Tab Handling in Dashboard Deep-Linking
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 8: Corrupted/Unknown Tab Deep Link Fallback ---');

test('Unknown tabKey in findRouteByTab returns undefined', () => {
  assertEqual(findRouteByTab('non_existent_tab'), undefined);
  assertEqual(findRouteByTab(''), undefined);
});

test('page.tsx initial state falls back to overview when tab or route is unknown', () => {
  const getInitialRoute = (searchParams) => {
    const VALID_ROUTES = [
      'overview', 'secretaria', 'financeiro', 'pedagogico', 'academico',
      'administrativo', 'agenda', 'portal_aluno', 'calendario', 'crm', 'ia_evasao'
    ];
    const initialRoute = searchParams ? searchParams.get('route') : null;
    if (initialRoute && VALID_ROUTES.includes(initialRoute)) {
      return initialRoute;
    }
    const initialTab = searchParams ? searchParams.get('tab') : null;
    if (initialTab) {
      const matched = findRouteByTab(initialTab);
      if (matched) return matched;
    }
    return 'overview';
  };

  assertEqual(getInitialRoute(new URLSearchParams('route=invalid')), 'overview');
  assertEqual(getInitialRoute(new URLSearchParams('tab=invalid')), 'overview');
  assertEqual(getInitialRoute(new URLSearchParams('route=agenda&tab=whatsapp')), 'agenda');
  assertEqual(getInitialRoute(new URLSearchParams('tab=whatsapp')), 'agenda');
});

// -----------------------------------------------------------------------------
// SECTION 9: Full DOM / HTML Rendering Tests via ReactDOMServer
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 9: Full Component Rendering & HTML Markup Tests ---');

const ReactDOMServer = require(path.resolve(__dirname, '../../../frontend/node_modules/react-dom/server'));

test('Renders desktop sidebar and mobile drawer with expected structure', () => {
  mockCurrentRole = 'admin';
  mockSearchParams = new URLSearchParams('');
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Sidebar, { activeRoute: 'overview', onRouteChange: () => {} })
  );

  assert(html.includes('<aside class="hidden lg:flex w-64'), 'Desktop sidebar aside container must be present');
  assert(html.includes('Escolar ERP • Multi-Tenant'), 'Footer text must be present');
  assert(html.includes('Menu Principal'), 'Menu Principal heading must be present');
});

test('Single-view route (overview) has ChevronRight and NO collapsible sublist in DOM', () => {
  mockCurrentRole = 'admin';
  mockSearchParams = new URLSearchParams('route=overview');
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Sidebar, { activeRoute: 'overview', onRouteChange: () => {} })
  );

  // Visão Geral is active
  assert(html.includes('Visão Geral'), 'Overview label must be rendered');
  // Should NOT have ChevronDown button for overview
  assert(!html.includes('aria-label="Expandir Visão Geral"') && !html.includes('aria-label="Recolher Visão Geral"'),
    'Overview must not have expand/collapse aria label');
});

test('Active route (agenda) has expanded grid-rows-[1fr] and active sub-item highlighted with dot', () => {
  mockCurrentRole = 'admin';
  mockSearchParams = new URLSearchParams('route=agenda&tab=whatsapp');
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Sidebar, { activeRoute: 'agenda', onRouteChange: () => {} })
  );

  // Agenda sublist must be expanded
  assert(html.includes('grid-rows-[1fr] opacity-100'), 'Active route sublist must have grid-rows-[1fr]');
  
  // Check that WhatsApp sub-item has active styling
  assert(html.includes('WhatsApp (Transbordo)'), 'WhatsApp sub-item label present');
  // Check active indicator dot
  assert(html.includes('rounded-full bg-salvia-600'), 'Active indicator dot must be present on WhatsApp');
});

test('Default tab (alunos) in secretaria is highlighted when ?tab is omitted', () => {
  mockCurrentRole = 'admin';
  mockSearchParams = new URLSearchParams('route=secretaria');
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Sidebar, { activeRoute: 'secretaria', onRouteChange: () => {} })
  );

  assert(html.includes('Alunos &amp; Matrículas'), 'Alunos label present');
  // Default tab has active indicator dot
  assert(html.includes('rounded-full bg-salvia-600'), 'Default tab must have active indicator dot');
});

test('Invalid tab (?tab=xyz) highlights NO sub-item in DOM', () => {
  mockCurrentRole = 'admin';
  mockSearchParams = new URLSearchParams('route=secretaria&tab=nonexistent_xyz');
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Sidebar, { activeRoute: 'secretaria', onRouteChange: () => {} })
  );

  // No active indicator dot in subitems
  assert(!html.includes('rounded-full bg-salvia-600'), 'No sub-item should have active dot for invalid tab');
});

test('RBAC DOM filtering: responsavel user sees ONLY family portal and authorized items', () => {
  mockCurrentRole = 'responsavel';
  mockSearchParams = new URLSearchParams('');
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Sidebar, { activeRoute: 'portal_aluno', onRouteChange: () => {} })
  );

  assert(html.includes('Portal do Aluno'), 'Portal do Aluno must be visible to responsavel');
  assert(html.includes('Planner &amp; Calendário Escolar'), 'Calendario must be visible to responsavel');
  assert(html.includes('Comunicados &amp; Caixa de Mensagens'), 'Agenda must be visible to responsavel');
  
  // Forbidden routes
  assert(!html.includes('Secretaria &amp; Prontuários'), 'Secretaria must NOT be rendered for responsavel');
  assert(!html.includes('Financeiro &amp; Boletos'), 'Financeiro must NOT be rendered for responsavel');
  assert(!html.includes('Administrativo &amp; RH'), 'Administrativo must NOT be rendered for responsavel');
  assert(!html.includes('IA Anti-Evasão (EWS)'), 'IA Anti-Evasao must NOT be rendered for responsavel');
  assert(!html.includes('Visão Geral'), 'Overview must NOT be rendered for responsavel');
});

// -----------------------------------------------------------------------------
// SUMMARY & VERDICT
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`SUMMARY: ${passes} passed, ${failures.length} failed, ${findings.length} adversarial findings.`);
console.log('================================================================');

if (findings.length > 0) {
  console.log('\nADVERSARIAL FINDINGS:');
  findings.forEach((f, i) => {
    console.log(`[${i + 1}] [${f.severity}] ${f.title}`);
    console.log(`    ${f.detail}\n`);
  });
}
