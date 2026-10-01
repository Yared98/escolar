// Test harness for proposed solutions to Defect 3 and Defect 4
// Author: m1_fix_explorer_3

const assert = require('assert');

// 1. Proposed isRouteAuthorized helper
const isRouteAuthorized = (route, role) => {
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

const VALID_ROUTES = MENU_ITEMS.map((m) => m.id);

// 2. Proposed findRouteByTab implementation
const findRouteByTab = (tabKey, role, currentRoute) => {
  if (!tabKey) return undefined;

  // Collect all matching routes
  const matchingRoutes = [];
  for (const item of MENU_ITEMS) {
    if (item.subItems && item.subItems.some((sub) => sub.tabKey === tabKey)) {
      matchingRoutes.push(item.id);
    }
  }

  if (matchingRoutes.length === 0) return undefined;
  if (matchingRoutes.length === 1) return matchingRoutes[0];

  // Disambiguation Signal 1: Parent Context (currentRoute)
  if (currentRoute && matchingRoutes.includes(currentRoute)) {
    if (!role || isRouteAuthorized(currentRoute, role)) {
      return currentRoute;
    }
  }

  // Disambiguation Signal 2: User Role / Authorization Filter
  if (role) {
    const authorizedRoutes = matchingRoutes.filter((route) => isRouteAuthorized(route, role));
    if (authorizedRoutes.length === 1) {
      return authorizedRoutes[0];
    }
    if (authorizedRoutes.length > 1) {
      // Preference when both are authorized:
      if (role === 'responsavel' && authorizedRoutes.includes('portal_aluno')) {
        return 'portal_aluno';
      }
      if (role !== 'responsavel' && authorizedRoutes.includes('agenda')) {
        return 'agenda';
      }
      return authorizedRoutes[0];
    }
    return undefined;
  }

  // Fallback: first match in MENU_ITEMS
  return matchingRoutes[0];
};

// 3. Proposed page.tsx state & useEffect simulation
class PageSimulation {
  constructor(initialQuery = '', role = 'admin') {
    this.role = role;
    this.pathname = '/';
    this.searchParams = new URLSearchParams(initialQuery);
    this.history = [this.getCurrentUrl()];

    // Initial state matching proposed page.tsx useState
    const initialRoute = this.searchParams.get('route');
    if (initialRoute && VALID_ROUTES.includes(initialRoute)) {
      this.activeRoute = initialRoute;
    } else {
      const initialTab = this.searchParams.get('tab');
      const matched = initialTab ? findRouteByTab(initialTab, this.role) : undefined;
      this.activeRoute = matched || (this.role === 'responsavel' ? 'portal_aluno' : 'overview');
    }
  }

  getCurrentUrl() {
    const q = this.searchParams.toString();
    return q ? `${this.pathname}?${q}` : this.pathname;
  }

  push(url) {
    this.history.push(url);
    const parsed = new URL(url, 'http://localhost');
    this.searchParams = new URLSearchParams(parsed.search);
    this.runEffect();
  }

  back() {
    if (this.history.length <= 1) return;
    this.history.pop();
    const prev = this.history[this.history.length - 1];
    const parsed = new URL(prev, 'http://localhost');
    this.searchParams = new URLSearchParams(parsed.search);
    this.runEffect();
  }

  // Proposed useEffect in page.tsx
  runEffect() {
    const defaultRoute = this.role === 'responsavel' ? 'portal_aluno' : 'overview';

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
      if (matched) {
        if (matched !== this.activeRoute) {
          this.activeRoute = matched;
        }
        return;
      }
    }

    // Defect 3 Fallback: query params cleared or absent
    if (this.activeRoute !== defaultRoute) {
      this.activeRoute = defaultRoute;
    }
  }
}

// -----------------------------------------------------------------------------
// TESTS EXECUTION
// -----------------------------------------------------------------------------

console.log('=== RUNNING TESTS FOR DEFECT 3 & 4 FIXES ===\n');

// Test Suite A: Defect 4 findRouteByTab disambiguation
console.log('--- Suite A: findRouteByTab Collisions & Disambiguation ---');

// Backward compatibility (no role, no currentRoute)
assert.strictEqual(findRouteByTab('comunicacao'), 'agenda');
assert.strictEqual(findRouteByTab('boletim'), 'portal_aluno');
assert.strictEqual(findRouteByTab('rotina'), 'portal_aluno', 'rotina defaults to first match');
assert.strictEqual(findRouteByTab('turmas'), 'secretaria', 'turmas defaults to first match');
assert.strictEqual(findRouteByTab('non_existent'), undefined);
assert.strictEqual(findRouteByTab(''), undefined);
console.log('  [PASS] Backward compatibility with 0 arguments maintained');

// Role-based disambiguation for Professor
assert.strictEqual(findRouteByTab('rotina', 'professor'), 'agenda', 'Professor accessing rotina resolves to agenda');
assert.strictEqual(isRouteAuthorized(findRouteByTab('rotina', 'professor'), 'professor'), true, 'Professor is authorized for resolved route');
assert.strictEqual(findRouteByTab('turmas', 'professor'), 'pedagogico', 'Professor accessing turmas resolves to pedagogico');
assert.strictEqual(isRouteAuthorized(findRouteByTab('turmas', 'professor'), 'professor'), true, 'Professor is authorized for resolved route');
console.log('  [PASS] Professor disambiguates rotina -> agenda and turmas -> pedagogico (NO 403!)');

// Role-based disambiguation for Nutricionista
assert.strictEqual(findRouteByTab('rotina', 'nutricionista'), 'agenda');
assert.strictEqual(findRouteByTab('turmas', 'nutricionista'), 'pedagogico');
console.log('  [PASS] Nutricionista disambiguates correctly');

// Role-based disambiguation for Secretaria & Financeiro
assert.strictEqual(findRouteByTab('turmas', 'secretaria'), 'secretaria');
assert.strictEqual(findRouteByTab('turmas', 'financeiro'), 'secretaria');
console.log('  [PASS] Secretaria and Financeiro disambiguate turmas -> secretaria');

// Role-based disambiguation for Responsavel
assert.strictEqual(findRouteByTab('rotina', 'responsavel'), 'portal_aluno', 'Responsavel defaults to portal_aluno for rotina');
assert.strictEqual(findRouteByTab('turmas', 'responsavel'), undefined, 'Responsavel is unauthorized for turmas routes');
console.log('  [PASS] Responsavel disambiguates rotina -> portal_aluno');

// Parent context disambiguation
assert.strictEqual(findRouteByTab('rotina', 'responsavel', 'agenda'), 'agenda', 'Parent context in agenda preserves agenda for responsavel');
assert.strictEqual(findRouteByTab('turmas', 'admin', 'pedagogico'), 'pedagogico', 'Parent context pedagogico preserved for admin');
assert.strictEqual(findRouteByTab('turmas', 'admin', 'secretaria'), 'secretaria', 'Parent context secretaria preserved for admin');
console.log('  [PASS] Parent context (currentRoute) correctly preserves active section during tab switches');

// Test Suite B: Defect 3 History Back to Root URL
console.log('\n--- Suite B: Defect 3 History Back to Root URL ---');

// Standard user (admin)
const pageAdmin = new PageSimulation('', 'admin');
assert.strictEqual(pageAdmin.activeRoute, 'overview', 'Initial route is overview');
pageAdmin.push('/?route=secretaria&tab=alunos');
assert.strictEqual(pageAdmin.activeRoute, 'secretaria', 'Navigated to secretaria');
pageAdmin.back();
assert.strictEqual(pageAdmin.getCurrentUrl(), '/', 'Returned to root /');
assert.strictEqual(pageAdmin.activeRoute, 'overview', 'activeRoute restored to overview on root /');
console.log('  [PASS] Admin history back to / restores activeRoute to overview');

// Multiple navigation steps and back to root
pageAdmin.push('/?route=financeiro&tab=ar');
pageAdmin.push('/?route=pedagogico&tab=turmas');
pageAdmin.back();
assert.strictEqual(pageAdmin.activeRoute, 'financeiro');
pageAdmin.back();
assert.strictEqual(pageAdmin.getCurrentUrl(), '/');
assert.strictEqual(pageAdmin.activeRoute, 'overview');
console.log('  [PASS] Multi-step navigation back to / restores activeRoute to overview');

// Responsavel user
const pageResp = new PageSimulation('', 'responsavel');
assert.strictEqual(pageResp.activeRoute, 'portal_aluno', 'Initial route for responsavel is portal_aluno');
pageResp.push('/?route=agenda&tab=whatsapp');
assert.strictEqual(pageResp.activeRoute, 'agenda');
pageResp.back();
assert.strictEqual(pageResp.getCurrentUrl(), '/');
assert.strictEqual(pageResp.activeRoute, 'portal_aluno', 'activeRoute restored to portal_aluno for responsavel');
console.log('  [PASS] Responsavel history back to / restores activeRoute to portal_aluno');

// Deep link with bare ?tab=turmas for teacher
const pageProf = new PageSimulation('tab=turmas', 'professor');
assert.strictEqual(pageProf.activeRoute, 'pedagogico', 'Direct deep-link ?tab=turmas initializes activeRoute=pedagogico for teacher');
pageProf.back(); // no prior history
console.log('  [PASS] Teacher deep-linking ?tab=turmas initializes activeRoute=pedagogico');

console.log('\n=================================================');
console.log('ALL TESTS PASSED! Solutions verified completely.');
console.log('=================================================');
