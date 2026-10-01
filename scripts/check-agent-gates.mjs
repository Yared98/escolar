#!/usr/bin/env node
/**
 * Gate leve anti-drift para agents.
 * Uso: node scripts/check-agent-gates.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
let failed = false;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  failed = true;
}

function ok(msg) {
  console.log(`OK: ${msg}`);
}

const requiredFiles = [
  'AGENTS.md',
  'openspec/BUSINESS_RULES.md',
  'openspec/CORE_SPEC.md',
  'openspec/DELIVERY_CHECKLIST.md',
  '.cursor/rules/openspec-anti-drift.mdc',
  '.gemini/rules/01-rust-pwa-guidelines.md',
  '.gemini/rules/02-openspec-sync.md',
];

const moduleFiles = [
  'openspec/modules/secretaria.md',
  'openspec/modules/financeiro.md',
  'openspec/modules/academico.md',
  'openspec/modules/nutricao.md',
  'openspec/modules/agenda_calendario.md',
  'openspec/modules/crm_atendimento.md',
  'openspec/modules/ia_preditiva.md',
  'openspec/modules/regulatorio_lgpd.md',
  'openspec/modules/lms_integracao.md',
];

// 1. Checagem de existência dos arquivos estruturais e módulos
for (const rel of [...requiredFiles, ...moduleFiles]) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    fail(`arquivo obrigatório ausente: ${rel}`);
  } else {
    ok(`presente ${rel}`);
  }
}

// 2. Checagem de seção "Estado real / Limitações MVP" em TODOS os módulos
for (const modRel of moduleFiles) {
  const p = path.join(root, modRel);
  if (!fs.existsSync(p)) continue;
  const content = fs.readFileSync(p, 'utf8');
  if (!/Limitações MVP|Estado real/i.test(content)) {
    fail(`${modRel} deve conter seção "Estado real" ou "Limitações MVP"`);
  } else {
    ok(`${path.basename(modRel)} declara estado real / limitações`);
  }
}

// 3. Checagem de Overclaims na UI sem disclaimer
const overclaims = [
  {
    file: 'frontend/src/components/FinanceiroSection.tsx',
    pattern: /Assinada e enviada para a prefeitura/i,
    label: 'NFS-e como se fosse prefeitura real',
  },
  {
    file: 'frontend/src/components/FinanceiroSection.tsx',
    pattern: /Notificações D-5.*enviadas via WhatsApp/i,
    label: 'régua como WhatsApp real enviado',
  },
  {
    file: 'frontend/src/components/CrmSection.tsx',
    pattern: /WhatsApp oficial conectado|Mensagem enviada via Meta Graph/i,
    label: 'CRM prometendo WhatsApp oficial ativo sem disclaimer',
  },
];

function hasNearbyDisclaimer(lines, idx) {
  const window = lines.slice(Math.max(0, idx - 3), Math.min(lines.length, idx + 4)).join('\n');
  return /simulat|MVP|stub|não transmite|sem transmissão|sem envio|registrado internamente|demonstrativ|local/i.test(
    window
  );
}

for (const rule of overclaims) {
  const full = path.join(root, rule.file);
  if (!fs.existsSync(full)) {
    continue;
  }
  const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
  let hits = 0;
  lines.forEach((line, i) => {
    if (rule.pattern.test(line) && !hasNearbyDisclaimer(lines, i)) {
      hits += 1;
      fail(
        `${rule.file}:${i + 1} overclaim sem disclaimer (${rule.label}): ${line.trim().slice(0, 120)}`
      );
    }
  });
  if (hits === 0) ok(`sem overclaim sem disclaimer: ${rule.label}`);
}

// 4. Integridade das referências canônicas no AGENTS.md
const agents = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
if (!/openspec\/BUSINESS_RULES\.md/.test(agents) || !/DELIVERY_CHECKLIST/.test(agents)) {
  fail('AGENTS.md raiz deve referenciar BUSINESS_RULES e DELIVERY_CHECKLIST');
} else {
  ok('AGENTS.md raiz referencia openspec');
}

if (failed) {
  console.error('\nAgent gates FAILED. Atualize OpenSpec/UI ou remova overclaims.');
  process.exit(1);
}
console.log('\nAgent gates PASSED.');
