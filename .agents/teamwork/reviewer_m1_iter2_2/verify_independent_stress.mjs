import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from '../../../frontend/node_modules/typescript/lib/typescript.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

console.log('================================================================================');
console.log('REVIEWER_M1_ITER2_2 INDEPENDENT ADVERSARIAL STRESS TEST');
console.log('================================================================================\n');

let total = 0;
let passed = 0;
let failed = 0;

function check(cond, name, msg = '') {
  total++;
  if (cond) {
    passed++;
    console.log(`  [PASS] ${name}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${name} ${msg ? `(${msg})` : ''}`);
  }
}

// 1. Read source code
const sidebarCode = fs.readFileSync(path.join(PROJECT_ROOT, 'frontend/src/components/Sidebar.tsx'), 'utf8');
const pageCode = fs.readFileSync(path.join(PROJECT_ROOT, 'frontend/src/app/page.tsx'), 'utf8');

// Section 1: Integrity Check (Adversarial Critic)
console.log('SECTION 1: Adversarial Integrity Verification');
check(!sidebarCode.includes('// mock') && !sidebarCode.includes('// dummy'), 'No mock/dummy comments in Sidebar.tsx');
check(!pageCode.includes('// mock') && !pageCode.includes('// dummy'), 'No mock/dummy comments in page.tsx');
check(!sidebarCode.includes('window.__MOCK') && !pageCode.includes('window.__MOCK'), 'No mock globals in codebase');
check(!sidebarCode.includes('return true; // bypass') && !pageCode.includes('return true; // bypass'), 'No security bypass facades');

// Section 2: Conformance to Milestone 1 Requirements
console.log('\nSECTION 2: Conformance to Milestone 1 Requirements');
check(sidebarCode.includes('export interface SidebarProps {'), 'SidebarProps interface is exported');
check(sidebarCode.includes('onRouteChange?: (route: NavRoute, targetTab?: string) => void;'), 'SidebarProps has optional onRouteChange with targetTab');
check(sidebarCode.includes('export const isRouteAllowed ='), 'isRouteAllowed is exported');
check(sidebarCode.includes('export const isRouteAuthorized = isRouteAllowed;'), 'isRouteAuthorized alias is exported');
check(sidebarCode.includes('export const findRouteByTab ='), 'findRouteByTab is exported');
check(pageCode.includes('isAuthorized = (route: NavRoute): boolean => isRouteAllowed(route, role)'), 'page.tsx delegates isAuthorized to isRouteAllowed');

// Section 3: Navigation push counts & No Double Push
console.log('\nSECTION 3: Navigation Push Counts & No Double Push');
// Verify handleParentClick calls onRouteChange when provided and does not call router.push
const handleParentClickIdx = sidebarCode.indexOf('const handleParentClick =');
const handleSubItemClickIdx = sidebarCode.indexOf('const handleSubItemClick =');
const isSubItemActiveIdx = sidebarCode.indexOf('const isSubItemActive =');

const handleParentClickBody = sidebarCode.slice(handleParentClickIdx, handleSubItemClickIdx);
const handleSubItemClickBody = sidebarCode.slice(handleSubItemClickIdx, isSubItemActiveIdx);

check(handleParentClickBody.includes('onRouteChange(item.id, hasSubItems ? item.defaultTab : undefined);'), 'handleParentClick delegates to onRouteChange');
check(handleSubItemClickBody.includes('onRouteChange(parentRoute, subItem.tabKey);'), 'handleSubItemClick delegates to onRouteChange');

// Check that if onRouteChange exists, router.push is strictly in the else branch
check(handleParentClickBody.includes('if (onRouteChange) {') && handleParentClickBody.includes('} else {') && handleParentClickBody.includes('router.push('), 'handleParentClick branches onRouteChange vs router.push exclusively');
check(handleSubItemClickBody.includes('if (onRouteChange) {') && handleSubItemClickBody.includes('} else {') && handleSubItemClickBody.includes('router.push('), 'handleSubItemClick branches onRouteChange vs router.push exclusively');

// Section 4: Deep Linking & Route Disambiguation Logic
console.log('\nSECTION 4: Deep Linking & Role-Aware Disambiguation Stress Test');

// Transpile Sidebar.tsx using TypeScript transpileModule
const startSlice = sidebarCode.indexOf('export const MENU_ITEMS: NavItem[] = [');
const endSlice = sidebarCode.indexOf('export function Sidebar(');
let dataLogicCode = sidebarCode.slice(startSlice, endSlice);

// Replace icon imports with dummy placeholder so icons are defined
const iconMock = 'const LayoutDashboard = "icon"; const GraduationCap = "icon"; const FileText = "icon"; const DollarSign = "icon"; const Award = "icon"; const Baby = "icon"; const CalendarDays = "icon"; const Megaphone = "icon"; const Brain = "icon"; const Smartphone = "icon"; const MessageSquare = "icon"; const HeartPulse = "icon"; const MessageCircle = "icon"; const Users = "icon"; const BookOpen = "icon"; const ArrowDownLeft = "icon"; const ArrowUpRight = "icon"; const PieChart = "icon"; const Layers = "icon"; const Clock = "icon"; const Sparkles = "icon"; const Utensils = "icon"; const Building2 = "icon"; const Send = "icon"; const UserCheck = "icon"; const Truck = "icon"; const ShieldCheck = "icon";';

const transpiled = ts.transpileModule(iconMock + '\n' + dataLogicCode, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

const sandboxFn = new Function(`
  const exports = {};
  ${transpiled}
  return exports;
`);

const { MENU_ITEMS, isRouteAllowed, isRouteAuthorized, findRouteByTab } = sandboxFn();

check(typeof isRouteAllowed === 'function', 'isRouteAllowed is a function');
check(isRouteAuthorized === isRouteAllowed, 'isRouteAuthorized is identical to isRouteAllowed');
check(Array.isArray(MENU_ITEMS) && MENU_ITEMS.length === 11, 'MENU_ITEMS has exactly 11 routes');

// Stress-test RBAC matrix
const allRoutes = MENU_ITEMS.map(i => i.id);

// Admin & Gestor
check(allRoutes.every(r => isRouteAllowed(r, 'admin')), 'Admin has access to all 11 routes');
check(allRoutes.every(r => isRouteAllowed(r, 'gestor')), 'Gestor has access to all 11 routes');
check(allRoutes.every(r => isRouteAllowed(r, undefined)), 'Undefined role defaults to full access');

// Responsavel
const respAllowed = allRoutes.filter(r => isRouteAllowed(r, 'responsavel'));
check(respAllowed.length === 3 && respAllowed.includes('portal_aluno') && respAllowed.includes('agenda') && respAllowed.includes('calendario'), 'Responsavel access strictly limited to portal_aluno, agenda, calendario');

// Professor
const profAllowed = allRoutes.filter(r => isRouteAllowed(r, 'professor'));
check(profAllowed.includes('pedagogico') && profAllowed.includes('academico') && profAllowed.includes('agenda') && profAllowed.includes('calendario') && profAllowed.includes('overview'), 'Professor has correct authorized modules');
check(!profAllowed.includes('secretaria') && !profAllowed.includes('financeiro') && !profAllowed.includes('portal_aluno') && !profAllowed.includes('administrativo'), 'Professor cannot access back-office secretaria, financeiro, portal_aluno, administrativo');

// Nutricionista
const nutriAllowed = allRoutes.filter(r => isRouteAllowed(r, 'nutricionista'));
check(nutriAllowed.includes('pedagogico') && nutriAllowed.includes('academico') && nutriAllowed.includes('agenda'), 'Nutricionista has pedagogico, academico, agenda');
check(!nutriAllowed.includes('secretaria') && !nutriAllowed.includes('financeiro') && !nutriAllowed.includes('portal_aluno'), 'Nutricionista cannot access unauthorized back-office modules');

// Secretaria
const secAllowed = allRoutes.filter(r => isRouteAllowed(r, 'secretaria'));
check(secAllowed.includes('secretaria') && secAllowed.includes('crm') && secAllowed.includes('overview') && secAllowed.includes('calendario'), 'Secretaria has secretaria, crm, overview, calendario');
check(!secAllowed.includes('pedagogico') && !secAllowed.includes('academico') && !secAllowed.includes('financeiro'), 'Secretaria cannot access pedagogico, academico, financeiro');

// Financeiro
const finAllowed = allRoutes.filter(r => isRouteAllowed(r, 'financeiro'));
check(finAllowed.includes('financeiro') && finAllowed.includes('secretaria') && finAllowed.includes('overview'), 'Financeiro has financeiro, secretaria, overview');
check(!finAllowed.includes('pedagogico') && !finAllowed.includes('academico') && !finAllowed.includes('crm'), 'Financeiro cannot access pedagogico, academico, crm');

// Unknown / Malicious role
check(allRoutes.filter(r => isRouteAllowed(r, 'attacker_role')).every(r => r === 'overview' || r === 'calendario'), 'Unknown role only has fallback overview and public calendario');

// Stress-test findRouteByTab
// Single match
check(findRouteByTab('boletim') === 'portal_aluno', 'Single match boletim -> portal_aluno');
check(findRouteByTab('alunos') === 'secretaria', 'Single match alunos -> secretaria');
check(findRouteByTab('ar') === 'financeiro', 'Single match ar -> financeiro');
check(findRouteByTab('disciplinas_matriz') === 'pedagogico', 'Single match disciplinas_matriz -> pedagogico');
check(findRouteByTab('fundamental') === 'academico', 'Single match fundamental -> academico');
check(findRouteByTab('envios') === 'administrativo', 'Single match envios -> administrativo');
check(findRouteByTab('comunicacao') === 'agenda', 'Single match comunicacao -> agenda');

// Non-existent & malicious
check(findRouteByTab('') === undefined, 'Empty string returns undefined');
check(findRouteByTab(null) === undefined, 'Null returns undefined');
check(findRouteByTab(undefined) === undefined, 'Undefined returns undefined');
check(findRouteByTab('__proto__') === undefined, 'Prototype pollution returns undefined');
check(findRouteByTab('toString') === undefined, 'toString returns undefined');

// Adversarial Collisions: 'rotina' (portal_aluno vs agenda)
// Teacher requesting rotina MUST resolve to agenda (not portal_aluno which is 403)
check(findRouteByTab('rotina', 'professor') === 'agenda', 'Teacher requesting rotina resolves to agenda (avoids 403)');
check(findRouteByTab('rotina', 'nutricionista') === 'agenda', 'Nutricionista requesting rotina resolves to agenda (avoids 403)');
check(findRouteByTab('rotina', 'responsavel') === 'portal_aluno', 'Responsavel requesting rotina resolves to portal_aluno');
check(findRouteByTab('rotina', 'admin') === 'agenda', 'Admin requesting rotina resolves to agenda by default');
check(findRouteByTab('rotina', 'admin', 'portal_aluno') === 'portal_aluno', 'Admin with currentRoute=portal_aluno retains portal_aluno');
check(findRouteByTab('rotina', 'admin', 'agenda') === 'agenda', 'Admin with currentRoute=agenda retains agenda');

// Adversarial Collisions: 'turmas' (secretaria vs pedagogico)
// Teacher requesting turmas MUST resolve to pedagogico (not secretaria which is 403)
check(findRouteByTab('turmas', 'professor') === 'pedagogico', 'Teacher requesting turmas resolves to pedagogico (avoids 403)');
check(findRouteByTab('turmas', 'nutricionista') === 'pedagogico', 'Nutricionista requesting turmas resolves to pedagogico (avoids 403)');
check(findRouteByTab('turmas', 'secretaria') === 'secretaria', 'Secretaria requesting turmas resolves to secretaria');
check(findRouteByTab('turmas', 'financeiro') === 'secretaria', 'Financeiro requesting turmas resolves to secretaria');
check(findRouteByTab('turmas', 'admin') === 'secretaria', 'Admin requesting turmas resolves to secretaria by default');
check(findRouteByTab('turmas', 'admin', 'pedagogico') === 'pedagogico', 'Admin with currentRoute=pedagogico retains pedagogico');
check(findRouteByTab('turmas', 'admin', 'secretaria') === 'secretaria', 'Admin with currentRoute=secretaria retains secretaria');

console.log('\n================================================================================');
console.log(`TOTAL CHECKS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('================================================================================');

process.exit(failed > 0 ? 1 : 0);
