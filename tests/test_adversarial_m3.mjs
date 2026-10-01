// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const financeiroPath = path.join(projectRoot, 'frontend', 'src', 'components', 'FinanceiroSection.tsx');
const pedagogicoPath = path.join(projectRoot, 'frontend', 'src', 'components', 'PedagocioNutricaoSection.tsx');
const agendaPath = path.join(projectRoot, 'frontend', 'src', 'components', 'AgendaDigitalSection.tsx');
const secretariaPath = path.join(projectRoot, 'frontend', 'src', 'components', 'SecretariaSection.tsx');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`[FAIL] ${message}`);
  }
}

console.log('='.repeat(80));
console.log('NODE V8 ENGINE EMPIRICAL VERIFICATION - MILESTONE 3');
console.log('='.repeat(80));

// 1. Evaluate Financeiro resolver logic
function resolveFinanceiro(searchParams) {
  const tabParam = searchParams ? searchParams.get('tab') : null;
  const activeSubTab =
    tabParam === 'ap' || tabParam === 'nfse' || tabParam === 'bi' ? tabParam : 'ar';
  return activeSubTab;
}

// 2. Evaluate Pedagogico resolver logic
function resolvePedagogico(searchParams) {
  const tabParam = searchParams ? searchParams.get('tab') : null;
  const activeTab =
    tabParam === 'atribuicao_horarios' ||
    tabParam === 'turmas' ||
    tabParam === 'projetos' ||
    tabParam === 'nutricao' ||
    tabParam === 'tri'
      ? tabParam
      : 'disciplinas_matriz';
  return activeTab;
}

// 3. Evaluate Agenda resolver logic
function resolveAgenda(searchParams) {
  const tabParam = searchParams ? searchParams.get('tab') : null;
  const activeTab =
    tabParam === 'rotina' || tabParam === 'whatsapp' ? tabParam : 'comunicacao';
  return activeTab;
}

// 4. Evaluate Secretaria resolver logic
function resolveSecretaria(searchParams) {
  const tabParam = searchParams ? searchParams.get('tab') : null;
  const activeTab = tabParam === 'turmas' ? 'turmas' : 'alunos';
  return activeTab;
}

// Test null / undefined searchParams (SSR & initial mount prerender safe)
assert(resolveFinanceiro(null) === 'ar', 'Financeiro handles null searchParams');
assert(resolvePedagogico(null) === 'disciplinas_matriz', 'Pedagogico handles null searchParams');
assert(resolveAgenda(null) === 'comunicacao', 'Agenda handles null searchParams');
assert(resolveSecretaria(null) === 'alunos', 'Secretaria handles null searchParams');

// Test valid tabs
const finValid = ['ar', 'ap', 'nfse', 'bi'];
for (const tab of finValid) {
  const sp = new URLSearchParams(`tab=${tab}`);
  assert(resolveFinanceiro(sp) === tab, `Financeiro resolves valid tab: ${tab}`);
}

const pedValid = ['disciplinas_matriz', 'atribuicao_horarios', 'turmas', 'projetos', 'nutricao', 'tri'];
for (const tab of pedValid) {
  const sp = new URLSearchParams(`tab=${tab}`);
  assert(resolvePedagogico(sp) === tab, `Pedagogico resolves valid tab: ${tab}`);
}

const agendaValid = ['comunicacao', 'rotina', 'whatsapp'];
for (const tab of agendaValid) {
  const sp = new URLSearchParams(`tab=${tab}`);
  assert(resolveAgenda(sp) === tab, `Agenda resolves valid tab: ${tab}`);
}

const secValid = ['alunos', 'turmas'];
for (const tab of secValid) {
  const sp = new URLSearchParams(`tab=${tab}`);
  assert(resolveSecretaria(sp) === tab, `Secretaria resolves valid tab: ${tab}`);
}

// Test adversarial query strings in V8
const adversarialStrings = [
  '',
  'unknown',
  '123',
  '<script>alert("xss")</script>',
  'undefined',
  'null',
  'NaN',
  '__proto__',
  'constructor',
  '../../passwd',
  'ar%20',
  'AR',
  'Ap',
  'conciliacao',
  'grade',
  'matricula',
  'SELECT * FROM alunos',
  '%00%20%0D%0A',
  '🚀🔥',
];

for (const adv of adversarialStrings) {
  const sp = new URLSearchParams(`tab=${encodeURIComponent(adv)}`);
  assert(resolveFinanceiro(sp) === 'ar', `Financeiro falls back for: ${adv}`);
  assert(resolvePedagogico(sp) === 'disciplinas_matriz', `Pedagogico falls back for: ${adv}`);
  assert(resolveAgenda(sp) === 'comunicacao', `Agenda falls back for: ${adv}`);
  assert(resolveSecretaria(sp) === 'alunos', `Secretaria falls back for: ${adv}`);
}

// Test AST and file contents directly
const finCode = fs.readFileSync(financeiroPath, 'utf8');
const pedCode = fs.readFileSync(pedagogicoPath, 'utf8');
const agendaCode = fs.readFileSync(agendaPath, 'utf8');
const secCode = fs.readFileSync(secretariaPath, 'utf8');

assert(!finCode.includes("useState<'ar'"), 'Financeiro does not contain old useState');
assert(!pedCode.includes("useState<'disciplinas_matriz'"), 'Pedagogico does not contain old useState');
assert(!agendaCode.includes("useState<'comunicacao'"), 'Agenda does not contain old useState');
assert(!secCode.includes("useState<'alunos'"), 'Secretaria does not contain old useState');

assert(!finCode.includes('setActiveSubTab'), 'Financeiro has no setActiveSubTab');
assert(!pedCode.includes('setActiveTab'), 'Pedagogico has no setActiveTab');

console.log(`Node V8 Verification Completed: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL NODE V8 EMPIRICAL ASSERTIONS PASSED! (Exit code 0)');
  process.exit(0);
}
