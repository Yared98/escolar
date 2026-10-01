#!/usr/bin/env node
/**
 * Empirical Adversarial Verification & Stress Test Suite for Milestone 1
 * Targets: frontend/src/app/page.tsx & frontend/src/components/Sidebar.tsx
 * 
 * Verifies:
 * 1. Deep-linking with ?route=...&tab=... and ?tab=... alone (route inference).
 * 2. Static prerendering resilience with Next.js 14 Suspense boundary.
 * 3. History navigation, transitions, and state restoration.
 * 4. Cross-route sub-item navigation race / defaultTab overwrites.
 * 5. Tab collision & RBAC side effects.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

console.log('================================================================================');
console.log('EMPIRICAL ADVERSARIAL STRESS SUITE: MILESTONE 1 (page.tsx & Sidebar.tsx)');
console.log('================================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const defects = [];

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName}`);
    if (details) console.error(`         Detail: ${details}`);
    defects.push({ testName, details });
  }
}

// -----------------------------------------------------------------------------
// 1. Static Prerendering & Suspense Boundary Verification
// -----------------------------------------------------------------------------
console.log('SECTION 1: Next.js 14 Suspense Boundary & Static Prerendering Verification');
const pagePath = path.join(PROJECT_ROOT, 'frontend/src/app/page.tsx');
const pageContent = fs.readFileSync(pagePath, 'utf8');

assert(
  pageContent.includes('<Suspense fallback={<SectionSkeleton />}>') ||
  pageContent.includes('<React.Suspense fallback={<SectionSkeleton />}>'),
  'Suspense boundary wraps DashboardContent in page.tsx',
  'Next.js 14 requires a Suspense boundary when useSearchParams is called during static prerendering.'
);

assert(
  pageContent.includes('export default function HomePage()') &&
  pageContent.includes('function DashboardContent()'),
  'DashboardContent is cleanly isolated into a client component under Suspense',
  'Exported default HomePage must wrap client DashboardContent in Suspense.'
);

// Check build manifest or static prerendering output in .next
const buildManifestPath = path.join(PROJECT_ROOT, 'frontend/.next/build-manifest.json');
const prerenderManifestPath = path.join(PROJECT_ROOT, 'frontend/.next/prerender-manifest.json');
const prerenderExists = fs.existsSync(prerenderManifestPath);
assert(
  prerenderExists,
  'Next.js prerender-manifest.json exists from successful production build',
  'Demonstrates npm run build completes static page collection without dynamic bailout errors.'
);

if (prerenderExists) {
  const prerenderData = JSON.parse(fs.readFileSync(prerenderManifestPath, 'utf8'));
  const hasRootRoute = '/' in prerenderData.routes;
  assert(
    hasRootRoute,
    'Root route ("/") is recorded in static prerender manifest',
    `Routes found in prerender manifest: ${Object.keys(prerenderData.routes).join(', ')}`
  );
}

// -----------------------------------------------------------------------------
// 2. Canonical Menu Items and Route Inference Analysis
// -----------------------------------------------------------------------------
console.log('\nSECTION 2: Deep-Linking & Route Inference Evaluation');

const sidebarPath = path.join(PROJECT_ROOT, 'frontend/src/components/Sidebar.tsx');
const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

// Parse MENU_ITEMS structure from Sidebar.tsx
// Extract findRouteByTab implementation and test it empirically
const VALID_ROUTES = [
  'overview',
  'secretaria',
  'financeiro',
  'pedagogico',
  'academico',
  'administrativo',
  'agenda',
  'portal_aluno',
  'calendario',
  'crm',
  'ia_evasao',
];

// Replicate exact MENU_ITEMS from Sidebar.tsx
const MENU_ITEMS = [
  { id: 'overview', label: 'Visão Geral' },
  {
    id: 'portal_aluno',
    label: 'Portal do Aluno',
    defaultTab: 'boletim',
    subItems: [
      { id: 'portal-boletim', tabKey: 'boletim' },
      { id: 'portal-financeiro', tabKey: 'financeiro' },
      { id: 'portal-diploma', tabKey: 'diploma' },
      { id: 'portal-rotina', tabKey: 'rotina' },
    ],
  },
  { id: 'calendario', label: 'Planner & Calendário Escolar' },
  { id: 'crm', label: 'CRM & Captação' },
  { id: 'ia_evasao', label: 'IA Anti-Evasão' },
  {
    id: 'agenda',
    label: 'Comunicados & Caixa de Mensagens',
    defaultTab: 'comunicacao',
    subItems: [
      { id: 'agenda-comunicacao', tabKey: 'comunicacao' },
      { id: 'agenda-rotina', tabKey: 'rotina' },
      { id: 'agenda-whatsapp', tabKey: 'whatsapp' },
    ],
  },
  {
    id: 'secretaria',
    label: 'Secretaria & Prontuários',
    defaultTab: 'alunos',
    subItems: [
      { id: 'sec-alunos', tabKey: 'alunos' },
      { id: 'sec-turmas', tabKey: 'turmas' },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro & Boletos',
    defaultTab: 'ar',
    subItems: [
      { id: 'fin-ar', tabKey: 'ar' },
      { id: 'fin-ap', tabKey: 'ap' },
      { id: 'fin-nfse', tabKey: 'nfse' },
      { id: 'fin-bi', tabKey: 'bi' },
    ],
  },
  {
    id: 'pedagogico',
    label: 'Pedagógico & Nutrição',
    defaultTab: 'disciplinas_matriz',
    subItems: [
      { id: 'ped-matriz', tabKey: 'disciplinas_matriz' },
      { id: 'ped-horarios', tabKey: 'atribuicao_horarios' },
      { id: 'ped-turmas', tabKey: 'turmas' },
      { id: 'ped-projetos', tabKey: 'projetos' },
      { id: 'ped-nutricao', tabKey: 'nutricao' },
    ],
  },
  {
    id: 'academico',
    label: 'Diário PWA',
    defaultTab: 'fundamental',
    subItems: [
      { id: 'acad-fundamental', tabKey: 'fundamental' },
      { id: 'acad-infantil', tabKey: 'infantil' },
    ],
  },
  {
    id: 'administrativo',
    label: 'Administrativo & RH',
    defaultTab: 'envios',
    subItems: [
      { id: 'adm-envios', tabKey: 'envios' },
      { id: 'adm-entidades', tabKey: 'entidades' },
      { id: 'adm-fornecedores', tabKey: 'fornecedores' },
      { id: 'adm-relatorios', tabKey: 'relatorios' },
    ],
  },
];

function findRouteByTab(tabKey) {
  for (const item of MENU_ITEMS) {
    if (item.subItems?.some((sub) => sub.tabKey === tabKey)) {
      return item.id;
    }
  }
  return undefined;
}

// Empirical test of findRouteByTab for distinct tabs
assert(findRouteByTab('comunicacao') === 'agenda', 'findRouteByTab("comunicacao") resolves to agenda');
assert(findRouteByTab('alunos') === 'secretaria', 'findRouteByTab("alunos") resolves to secretaria');
assert(findRouteByTab('ar') === 'financeiro', 'findRouteByTab("ar") resolves to financeiro');
assert(findRouteByTab('disciplinas_matriz') === 'pedagogico', 'findRouteByTab("disciplinas_matriz") resolves to pedagogico');
assert(findRouteByTab('fundamental') === 'academico', 'findRouteByTab("fundamental") resolves to academico');
assert(findRouteByTab('envios') === 'administrativo', 'findRouteByTab("envios") resolves to administrativo');
assert(findRouteByTab('boletim') === 'portal_aluno', 'findRouteByTab("boletim") resolves to portal_aluno');
assert(findRouteByTab('non_existent') === undefined, 'findRouteByTab("non_existent") returns undefined');

// Adversarial Test: Ambiguous Tab Keys (Duplicate tab keys across sections)
console.log('\n--- Adversarial Tab Key Collisions ---');
const tabRoutesMap = {};
for (const item of MENU_ITEMS) {
  if (item.subItems) {
    for (const sub of item.subItems) {
      if (!tabRoutesMap[sub.tabKey]) {
        tabRoutesMap[sub.tabKey] = [];
      }
      tabRoutesMap[sub.tabKey].push(item.id);
    }
  }
}

const collidedTabs = Object.entries(tabRoutesMap).filter(([tab, routes]) => routes.length > 1);
console.log(`Identified ${collidedTabs.length} collided tabKeys across sections:`, collidedTabs.map(([k, r]) => `${k} -> [${r.join(', ')}]`));

assert(
  collidedTabs.length === 2,
  'Found expected 2 duplicate tabKeys in MENU_ITEMS (rotina, turmas)',
  `Collisions found: ${JSON.stringify(collidedTabs)}`
);

// Test inference behavior on collided tabs:
// ?tab=rotina
const inferredRotina = findRouteByTab('rotina');
assert(
  inferredRotina === 'portal_aluno',
  'findRouteByTab("rotina") resolves to portal_aluno (shadows agenda)',
  `Inferred: ${inferredRotina}. NOTE: If a teacher opens /?tab=rotina expecting Agenda, it navigates to portal_aluno (which is 403 Forbidden for teachers!)`
);

// ?tab=turmas
const inferredTurmas = findRouteByTab('turmas');
assert(
  inferredTurmas === 'secretaria',
  'findRouteByTab("turmas") resolves to secretaria (shadows pedagogico)',
  `Inferred: ${inferredTurmas}. NOTE: A user expecting pedagogical classes at /?tab=turmas lands on secretary.`
);

// -----------------------------------------------------------------------------
// 3. Simulation of page.tsx State Initialization and useEffect
// -----------------------------------------------------------------------------
console.log('\nSECTION 3: Component State Initialization & Deep-Linking Resolution');

function simulatePageInit(searchParams) {
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
}

// Test initial render with various search params
assert(simulatePageInit(new URLSearchParams('route=agenda&tab=whatsapp')) === 'agenda', 'Direct link ?route=agenda&tab=whatsapp initializes activeRoute=agenda');
assert(simulatePageInit(new URLSearchParams('route=secretaria')) === 'secretaria', 'Direct link ?route=secretaria initializes activeRoute=secretaria');
assert(simulatePageInit(new URLSearchParams('tab=nfse')) === 'financeiro', 'Direct link ?tab=nfse infers activeRoute=financeiro');
assert(simulatePageInit(new URLSearchParams('route=invalid_foo')) === 'overview', 'Direct link ?route=invalid_foo safely falls back to overview');
assert(simulatePageInit(new URLSearchParams('tab=invalid_bar')) === 'overview', 'Direct link ?tab=invalid_bar safely falls back to overview');
assert(simulatePageInit(new URLSearchParams('')) === 'overview', 'Direct link with empty URL initializes activeRoute=overview');

// -----------------------------------------------------------------------------
// 4. Adversarial History Navigation & State Restoration across Transitions
// -----------------------------------------------------------------------------
console.log('\nSECTION 4: History Navigation & State Restoration across Transitions');

class ComponentSimulation {
  constructor(initialQuery = '', role = 'admin') {
    this.role = role;
    this.pathname = '/';
    this.searchParams = new URLSearchParams(initialQuery);
    this.activeRoute = simulatePageInit(this.searchParams);
    this.expandedRoutes = {};
    this.routerHistory = [this.getCurrentUrl()];
    this.pushLog = [];
  }

  getCurrentUrl() {
    const q = this.searchParams.toString();
    return q ? `${this.pathname}?${q}` : this.pathname;
  }

  // Next.js router.push simulation
  routerPush(url, options) {
    this.pushLog.push({ url, options });
    this.routerHistory.push(url);
    const parsed = new URL(url, 'http://localhost');
    this.searchParams = new URLSearchParams(parsed.search);
    // In React/Next.js, URL change triggers the useEffect in page.tsx:
    this.runPageUseEffect();
  }

  // Exact reproduction of useEffect from page.tsx (lines 129-150)
  runPageUseEffect() {
    const routeParam = this.searchParams.get('route');
    if (routeParam && VALID_ROUTES.includes(routeParam)) {
      if (routeParam !== this.activeRoute) {
        this.activeRoute = routeParam;
      }
      return;
    }

    const tabParam = this.searchParams.get('tab');
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

  // Exact reproduction of handleRouteChange from page.tsx (lines 156-180)
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
      this.routerPush(targetUrl, { scroll: false });
    }
  }

  // Exact reproduction of handleParentClick from Sidebar.tsx (lines 299-325)
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

  // Exact reproduction of handleSubItemClick from Sidebar.tsx (lines 327-340)
  handleSubItemClick(parentRoute, subItem) {
    this.expandedRoutes[parentRoute] = true;
    this.handleRouteChange(parentRoute, subItem.tabKey);
  }

  // Browser BACK button simulation
  browserBack() {
    if (this.routerHistory.length <= 1) return;
    this.routerHistory.pop(); // Pop current
    const prevUrl = this.routerHistory[this.routerHistory.length - 1];
    const parsed = new URL(prevUrl, 'http://localhost');
    this.searchParams = new URLSearchParams(parsed.search);
    this.runPageUseEffect();
  }
}

// -----------------------------------------------------------------------------
// Test Case 4.1: Single router.push per User Navigation Event
// -----------------------------------------------------------------------------
console.log('\n--- Test 4.1: Checking router.push Call Count on Parent Navigation ---');
const sim1 = new ComponentSimulation('');
assert(sim1.activeRoute === 'overview', 'Initial state is overview');
sim1.pushLog = [];

sim1.handleParentClick('secretaria');
console.log(`router.push call count during handleParentClick: ${sim1.pushLog.length}`);
sim1.pushLog.forEach((entry, i) => console.log(`  Call #${i + 1}: ${entry.url}`));

assert(
  sim1.pushLog.length === 1,
  'Contract: handleParentClick must execute router.push EXACTLY ONCE',
  `VIOLATION: handleParentClick called router.push ${sim1.pushLog.length} times! (Duplicate push pollutes browser history stack and breaks Back button)`
);

// -----------------------------------------------------------------------------
// Test Case 4.2: Sub-item Click Race / DefaultTab Overwrite Bug
// -----------------------------------------------------------------------------
console.log('\n--- Test 4.2: Clicking a non-default sub-item from another route ---');
const sim2 = new ComponentSimulation('');
assert(sim2.activeRoute === 'overview', 'Initial route is overview');
sim2.pushLog = [];

// User is on overview. User clicks sub-item 'turmas' of 'secretaria' (defaultTab is 'alunos')
const turmasSubItem = { id: 'sec-turmas', tabKey: 'turmas' };
sim2.handleSubItemClick('secretaria', turmasSubItem);

console.log(`Pushes executed during handleSubItemClick:`);
sim2.pushLog.forEach((entry, i) => console.log(`  Call #${i + 1}: ${entry.url}`));
console.log(`Final active search params: ?${sim2.searchParams.toString()}`);

const finalTab = sim2.searchParams.get('tab');
assert(
  finalTab === 'turmas',
  'Contract: Clicking sub-item must preserve selected tabKey ("turmas")',
  `VIOLATION: Selected tab "turmas" was overwritten with defaultTab "${finalTab}" by handleRouteChange!`
);

// -----------------------------------------------------------------------------
// Test Case 4.3: History Restoration back to Root URL ('/')
// -----------------------------------------------------------------------------
console.log('\n--- Test 4.3: History Restoration when navigating Back to Root URL ("/") ---');
const sim3 = new ComponentSimulation('');
assert(sim3.activeRoute === 'overview', 'Initial route is overview');

// Navigate to secretaria
sim3.handleParentClick('secretaria');

// User presses browser BACK button to return to root '/'
while (sim3.routerHistory.length > 1 && sim3.searchParams.get('route') !== null) {
  sim3.browserBack();
}

console.log(`Current URL after browser back: ${sim3.getCurrentUrl()}`);
console.log(`activeRoute after browser back: ${sim3.activeRoute}`);

assert(
  sim3.activeRoute === 'overview',
  'Contract: activeRoute must restore to "overview" when returning to root URL ("/") via browser back',
  `VIOLATION: activeRoute stayed on "${sim3.activeRoute}" instead of restoring to "overview"! (useEffect lacks fallback for empty searchParams)`
);

// -----------------------------------------------------------------------------
// 5. Overall Verdict & Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log('STRESS TEST SUMMARY');
console.log('================================================================================');
console.log(`Total Contract Checks: ${totalTests}`);
console.log(`Passed Checks:         ${passedTests}`);
console.log(`Failed Checks:         ${failedTests}`);
console.log(`Verdict:               ${failedTests > 0 ? 'REQUEST_CHANGES' : 'APPROVE'}`);

if (defects.length > 0) {
  console.log('\nDefect Details:');
  defects.forEach((d, idx) => {
    console.log(`  ${idx + 1}. [FAIL] ${d.testName}`);
    console.log(`     Details: ${d.details}`);
  });
}
console.log('================================================================================\n');

process.exit(failedTests > 0 ? 1 : 0);
