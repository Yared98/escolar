#!/usr/bin/env node
/**
 * Gate anti-drift para agents (OpenSpec ↔ Código, Limitações MVP, Overclaims na UI).
 * Uso:
 *   node scripts/check-agent-gates.mjs               (compara HEAD + working tree)
 *   node scripts/check-agent-gates.mjs --base <ref>  (compara com <ref>, ex: origin/main)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRoot = path.resolve(__dirname, '..');

export const DEFAULT_REQUIRED_FILES = [
  'AGENTS.md',
  'openspec/BUSINESS_RULES.md',
  'openspec/CORE_SPEC.md',
  'openspec/DELIVERY_CHECKLIST.md',
  '.cursor/rules/openspec-anti-drift.mdc',
  '.gemini/rules/01-rust-pwa-guidelines.md',
  '.gemini/rules/02-openspec-sync.md',
];

export const DEFAULT_MODULE_FILES = [
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

export const STRICT_DISCLAIMER_REGEX =
  /simulad|stub|MVP|sem envio|não transmite|registrado internamente/i;

/**
 * Tabela de mapeamento rápido Código -> Spec (AGENTS.md + extensões canônicas)
 */
export const DEFAULT_CODE_TO_SPEC_RULES = [
  // Secretaria
  {
    pattern:
      /^(backend\/src\/handlers\/(?:secretaria|documentos)(?:\.rs|\/.*)|frontend\/src\/components\/(?:secretaria\/.*|SecretariaSection\.tsx))$/,
    spec: 'openspec/modules/secretaria.md',
    label: 'Secretaria',
  },
  // Financeiro
  {
    pattern:
      /^(backend\/src\/handlers\/financeiro(?:\.rs|\/.*)|frontend\/src\/components\/(?:financeiro\/.*|FinanceiroSection\.tsx))$/,
    spec: 'openspec/modules/financeiro.md',
    label: 'Financeiro',
  },
  // Acadêmico
  {
    pattern:
      /^(backend\/src\/handlers\/(?:academico|professor|fechamento)(?:\.rs|\/.*)|frontend\/src\/components\/(?:academico\/.*|pedagogico\/.*|portal_aluno\/.*|professor\/.*|PedagocioNutricaoSection\.tsx|ProfessorSection\.tsx|AcademicoSection\.tsx|PortalAlunoSection\.tsx|MobileBottomNav\.tsx))$/,
    spec: 'openspec/modules/academico.md',
    label: 'Acadêmico',
  },
  // Nutrição
  {
    pattern:
      /^(backend\/src\/handlers\/nutricao(?:\.rs|\/.*)|frontend\/src\/components\/nutricao\/.*)$/,
    spec: 'openspec/modules/nutricao.md',
    label: 'Nutrição',
  },
  // Agenda & Calendário / Notificações (inclui worker)
  {
    pattern:
      /^(backend\/src\/handlers\/(?:agenda_admin|avaliacoes)(?:\.rs|\/.*)|frontend\/src\/components\/(?:agenda\/.*|AgendaDigitalSection\.tsx|CalendarioEscolarSection\.tsx)|worker\/.*)$/,
    spec: 'openspec/modules/agenda_calendario.md',
    label: 'Agenda & Calendário / Notificações',
  },
  // CRM
  {
    pattern:
      /^(backend\/src\/handlers\/crm_lms(?:\.rs|\/(?:mod|crm|whatsapp)\.rs)|frontend\/src\/components\/CrmSection\.tsx)$/,
    spec: 'openspec/modules/crm_atendimento.md',
    label: 'CRM',
  },
  // LMS (depois do refactor B13.4 o LMS tem arquivo próprio)
  {
    pattern: /^backend\/src\/handlers\/crm_lms\/lms\.rs$/,
    spec: 'openspec/modules/lms_integracao.md',
    label: 'LMS / SSO',
  },
  // Autenticação e usuários -> CORE_SPEC.md
  {
    pattern: /^backend\/src\/handlers\/(?:auth|usuarios)(?:\.rs|\/.*)$/,
    spec: 'openspec/CORE_SPEC.md',
    label: 'Core / Autenticação e usuários',
  },
  // IA Evasão
  {
    pattern: /^frontend\/src\/components\/PainelEvasao\.tsx$/,
    spec: 'openspec/modules/ia_preditiva.md',
    label: 'IA Evasão',
  },
  // Regulatório & LGPD
  {
    pattern: /^frontend\/src\/components\/AdministrativoSection\.tsx$/,
    spec: 'openspec/modules/regulatorio_lgpd.md',
    label: 'Regulatório & LGPD',
  },
  // backend/src/handlers/regulatorio_ia.rs cobre tanto IA quanto Regulatório (aceita qualquer um dos dois)
  {
    pattern: /^backend\/src\/handlers\/regulatorio_ia(?:\.rs|\/.*)$/,
    spec: ['openspec/modules/ia_preditiva.md', 'openspec/modules/regulatorio_lgpd.md'],
    label: 'Regulatório / IA',
  },
  // Migrations -> CORE_SPEC.md
  {
    pattern: /^backend\/migrations\/.*$/,
    spec: 'openspec/CORE_SPEC.md',
    label: 'Migrations / Core Spec',
  },
];

export function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    base: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--base' && i + 1 < argv.length) {
      options.base = argv[++i];
    } else if (arg.startsWith('--base=')) {
      options.base = arg.slice('--base='.length);
    }
  }
  return options;
}

export function findFilesRecursively(dir, filterFn) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findFilesRecursively(fullPath, filterFn));
    } else if (entry.isFile() && (!filterFn || filterFn(fullPath))) {
      results.push(fullPath);
    }
  }
  return results;
}

export function getGitDiffFiles({ base, cwd = defaultRoot } = {}) {
  try {
    let diffOutput = '';
    if (base) {
      diffOutput = execSync(`git diff --name-only ${base}`, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } else {
      diffOutput = execSync('git diff --name-only HEAD', {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    }
    let untrackedOutput = '';
    try {
      untrackedOutput = execSync('git status --porcelain', {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      // ignore
    }

    const diffFiles = diffOutput
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const untrackedFiles = untrackedOutput
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith('?? '))
      .map((l) => l.slice(3).trim())
      .filter(Boolean);

    const set = new Set([...diffFiles, ...untrackedFiles]);
    return Array.from(set).map((f) => f.replace(/\\/g, '/'));
  } catch {
    return [];
  }
}

export const VALID_MODULE_KEYS = {
  secretaria: 'openspec/modules/secretaria.md',
  financeiro: 'openspec/modules/financeiro.md',
  academico: 'openspec/modules/academico.md',
  nutricao: 'openspec/modules/nutricao.md',
  agenda_calendario: 'openspec/modules/agenda_calendario.md',
  crm_atendimento: 'openspec/modules/crm_atendimento.md',
  ia_preditiva: 'openspec/modules/ia_preditiva.md',
  regulatorio_lgpd: 'openspec/modules/regulatorio_lgpd.md',
  lms_integracao: 'openspec/modules/lms_integracao.md',
  core: 'openspec/CORE_SPEC.md',
};

export function parseEscapeLine(line) {
  const trimmed = (line || '').trim();
  if (!trimmed) return null;

  let rawContent = trimmed;
  if (/^Spec-Sync:/i.test(trimmed)) {
    rawContent = trimmed.replace(/^Spec-Sync:\s*/i, '');
  } else if (/^SPEC_SYNC_SKIP=/i.test(trimmed)) {
    rawContent = trimmed.replace(/^SPEC_SYNC_SKIP=\s*/i, '');
  }

  rawContent = rawContent.replace(/^["']|["']$/g, '').trim();
  const body = rawContent.replace(/^n\/a\s*[:\-]?\s*/i, '').trim();

  const expectedFormatMsg =
    'Formato esperado: Spec-Sync: n/a <módulo>: <motivo> (onde <módulo> é uma chave da área do AGENTS.md e <motivo> tem pelo menos 10 caracteres)';

  if (!body) {
    return {
      valid: false,
      raw: trimmed,
      error: `Formato de escape inválido em "${trimmed}". ${expectedFormatMsg}`,
    };
  }

  const colonIdx = body.indexOf(':');
  if (colonIdx === -1) {
    return {
      valid: false,
      raw: trimmed,
      error: `Formato de escape inválido (faltou ":" separando módulo e motivo) em "${trimmed}". ${expectedFormatMsg}`,
    };
  }

  const moduleKey = body.slice(0, colonIdx).trim().toLowerCase();
  const reason = body.slice(colonIdx + 1).trim();

  if (!Object.prototype.hasOwnProperty.call(VALID_MODULE_KEYS, moduleKey)) {
    const validKeys = Object.keys(VALID_MODULE_KEYS).join(', ');
    return {
      valid: false,
      raw: trimmed,
      error: `Formato de escape inválido: módulo "${moduleKey}" é desconhecido. Módulos válidos: ${validKeys}. ${expectedFormatMsg}`,
    };
  }

  if (reason.length < 10) {
    return {
      valid: false,
      raw: trimmed,
      error: `Formato de escape inválido: motivo para módulo "${moduleKey}" deve ter pelo menos 10 caracteres (recebido ${reason.length} caracteres: "${reason}"). ${expectedFormatMsg}`,
    };
  }

  return {
    valid: true,
    raw: trimmed,
    module: moduleKey,
    specPath: VALID_MODULE_KEYS[moduleKey],
    reason,
  };
}

export function getCommitMessages({ base, cwd = defaultRoot } = {}) {
  const messages = [];
  if (process.env.SPEC_SYNC_OVERRIDE) {
    messages.push(process.env.SPEC_SYNC_OVERRIDE);
  }
  try {
    if (base) {
      try {
        const out = execSync(`git log ${base}..HEAD --pretty=%B`, {
          cwd,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        if (out) messages.push(out);
      } catch {
        // fallback ignore
      }
    }
    // No modo local (sem --base), NÃO lemos mensagens de commit nem HEAD.
  } catch {
    // ignore
  }
  return messages.filter(Boolean);
}

export function checkSpecSync({
  changedFiles = [],
  commitMessages = [],
  specSyncSkip = process.env.SPEC_SYNC_SKIP,
  codeToSpecRules = DEFAULT_CODE_TO_SPEC_RULES,
}) {
  const escapeLines = [];

  for (const msg of commitMessages) {
    const lines = msg.split(/\r?\n/);
    for (const l of lines) {
      if (/^Spec-Sync:/i.test(l.trim())) {
        escapeLines.push(l.trim());
      }
    }
  }

  if (specSyncSkip) {
    const lines = specSyncSkip.split(/\r?\n/);
    for (const l of lines) {
      if (l.trim()) {
        escapeLines.push(l.trim());
      }
    }
  }

  const validEscapes = [];
  const invalidEscapes = [];

  for (const line of escapeLines) {
    const parsed = parseEscapeLine(line);
    if (parsed) {
      if (parsed.valid) {
        validEscapes.push(parsed);
      } else {
        invalidEscapes.push(parsed);
      }
    }
  }

  if (invalidEscapes.length > 0) {
    return {
      passed: false,
      escaped: false,
      validEscapes: [],
      invalidEscapes,
      violations: [],
    };
  }

  const escapedSpecPaths = new Set(validEscapes.map((e) => e.specPath));
  const escapedModuleKeys = new Set(validEscapes.map((e) => e.module));

  const normalizedChanges = new Set(
    changedFiles.map((f) => f.replace(/\\/g, '/').replace(/^\.\//, ''))
  );

  const violations = [];

  for (const changedFile of normalizedChanges) {
    for (const rule of codeToSpecRules) {
      if (rule.pattern.test(changedFile)) {
        const requiredSpecs = Array.isArray(rule.spec) ? rule.spec : [rule.spec];
        const satisfied = requiredSpecs.some((spec) => {
          const normSpec = spec.replace(/\\/g, '/');
          return normalizedChanges.has(normSpec) || escapedSpecPaths.has(normSpec);
        });

        if (!satisfied) {
          violations.push({
            codeFile: changedFile,
            expectedSpec: Array.isArray(rule.spec) ? rule.spec.join(' ou ') : rule.spec,
            label: rule.label,
          });
        }
      }
    }
  }

  return {
    passed: violations.length === 0,
    escaped: validEscapes.length > 0,
    validEscapes,
    invalidEscapes: [],
    violations,
  };
}

export function checkModuleLimitations(content, modRel = 'module.md') {
  const headerMatch = content.match(/^##\s+.*(?:Estado real|Limitações MVP).*$/im);
  if (!headerMatch) {
    return {
      passed: false,
      error: `${modRel}: deve conter título nível 2 (## ...) com "Estado real" ou "Limitações MVP"`,
    };
  }

  const idx = headerMatch.index;
  const afterHeader = content.slice(idx + headerMatch[0].length);
  const nextHeaderMatch = afterHeader.match(/^##?\s+/m);
  const sectionContent = nextHeaderMatch
    ? afterHeader.slice(0, nextHeaderMatch.index)
    : afterHeader;

  const rawLines = sectionContent.split(/\r?\n/).map((l) => l.trim());
  const contentLines = rawLines.filter((l) => l.length > 0 && l !== '---');

  const hasTable = contentLines.some(
    (l) => l.startsWith('|') && l.endsWith('|') && l.includes('|')
  );

  const textLines = contentLines.filter(
    (l) => !l.startsWith('|') && /[a-zA-Z0-9À-ÿ]/.test(l)
  );

  if (!hasTable && textLines.length < 3) {
    return {
      passed: false,
      error: `${modRel}: seção "Estado real / Limitações MVP" vazia ou insuficiente (exige ao menos uma linha de tabela de status ou >= 3 linhas de texto sob '## ...')`,
    };
  }

  return { passed: true };
}

export function checkOverclaimsInFile(filePath, fileContent, rules = []) {
  const lines = fileContent.split(/\r?\n/);
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of rules) {
      const regex =
        rule.pattern instanceof RegExp
          ? rule.pattern
          : new RegExp(rule.pattern, 'i');

      if (regex.test(line)) {
        const window = lines
          .slice(Math.max(0, i - 3), Math.min(lines.length, i + 4))
          .join('\n');

        if (!STRICT_DISCLAIMER_REGEX.test(window)) {
          violations.push({
            file: filePath.replace(/\\/g, '/'),
            line: i + 1,
            label: rule.label,
            snippet: line.trim().slice(0, 120),
          });
        }
      }
    }
  }

  return violations;
}

export function runGates(options = {}) {
  const root = options.root || defaultRoot;
  const base = options.base ?? null;
  let failed = false;
  const logs = [];

  const silent = !!options.silent;

  function fail(msg) {
    logs.push({ type: 'FAIL', msg });
    if (!silent) console.error(`FAIL: ${msg}`);
    failed = true;
  }

  function ok(msg) {
    logs.push({ type: 'OK', msg });
    if (!silent) console.log(`OK: ${msg}`);
  }

  function warn(msg) {
    logs.push({ type: 'WARN', msg });
    if (!silent) console.warn(`AVISO: ${msg}`);
  }

  // 1. Checagem de existência dos arquivos estruturais e módulos
  const requiredFiles = options.requiredFiles || DEFAULT_REQUIRED_FILES;
  const moduleFiles = options.moduleFiles || DEFAULT_MODULE_FILES;

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
    const result = checkModuleLimitations(content, modRel);
    if (!result.passed) {
      fail(result.error);
    } else {
      ok(`${path.basename(modRel)} declara estado real / limitações com conteúdo válido`);
    }
  }

  // 3. Checagem de Overclaims na UI varrendo frontend/src/**/*.tsx
  let overclaimRules = options.overclaimRules;
  if (!overclaimRules) {
    const rulesPath = path.join(root, 'scripts/overclaim-rules.json');
    if (fs.existsSync(rulesPath)) {
      try {
        overclaimRules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
      } catch (err) {
        fail(`Falha ao ler scripts/overclaim-rules.json: ${err.message}`);
        overclaimRules = [];
      }
    } else {
      overclaimRules = [];
    }
  }

  const frontendDir = path.join(root, 'frontend/src');
  const tsxFiles = options.tsxFiles || findFilesRecursively(frontendDir, (p) => p.endsWith('.tsx'));
  let totalOverclaimViolations = 0;

  for (const tsxPath of tsxFiles) {
    const rel = path.relative(root, tsxPath).replace(/\\/g, '/');
    let content = '';
    if (typeof options.readFile === 'function') {
      content = options.readFile(tsxPath);
    } else {
      content = fs.readFileSync(tsxPath, 'utf8');
    }

    const violations = checkOverclaimsInFile(rel, content, overclaimRules);
    for (const v of violations) {
      totalOverclaimViolations++;
      fail(`${v.file}:${v.line} overclaim sem disclaimer (${v.label}): ${v.snippet}`);
    }
  }

  if (totalOverclaimViolations === 0) {
    ok(`sem overclaims sem disclaimer em ${tsxFiles.length} arquivos .tsx inspecionados`);
  }

  // 4. Integridade das referências canônicas no AGENTS.md
  const agentsPath = path.join(root, 'AGENTS.md');
  if (fs.existsSync(agentsPath)) {
    const agents = fs.readFileSync(agentsPath, 'utf8');
    if (
      !/openspec\/BUSINESS_RULES\.md/.test(agents) ||
      !/DELIVERY_CHECKLIST/.test(agents)
    ) {
      fail('AGENTS.md raiz deve referenciar BUSINESS_RULES e DELIVERY_CHECKLIST');
    } else {
      ok('AGENTS.md raiz referencia openspec');
    }
  }

  // 5. Modo diff (verificação de sincronia Spec ↔ Código)
  const changedFiles =
    options.changedFiles !== undefined
      ? options.changedFiles
      : getGitDiffFiles({ base, cwd: root });

  const commitMessages =
    options.commitMessages !== undefined
      ? options.commitMessages
      : getCommitMessages({ base, cwd: root });

  const syncResult = checkSpecSync({
    changedFiles,
    commitMessages,
    codeToSpecRules: options.codeToSpecRules || DEFAULT_CODE_TO_SPEC_RULES,
  });

  if (syncResult.invalidEscapes && syncResult.invalidEscapes.length > 0) {
    for (const inv of syncResult.invalidEscapes) {
      fail(inv.error);
    }
  } else {
    if (syncResult.escaped) {
      for (const esc of syncResult.validEscapes) {
        warn(
          `Spec-Sync: n/a detectado para o módulo "${esc.module}" ("${esc.reason}"). Par de código ↔ spec liberado.`
        );
      }
      ok('Spec-Sync: liberação auditável ativa por mensagem de commit ou env');
    }

    if (!syncResult.passed) {
      for (const violation of syncResult.violations) {
        fail(
          `diff contém ${violation.codeFile} (${violation.label}) mas ${violation.expectedSpec} não foi alterado`
        );
      }
    } else {
      ok(`Spec-Sync: ${changedFiles.length} arquivos alterados no diff conferidos com sucesso`);
    }
  }

  return { success: !failed, logs };
}

// Execução direta via CLI
const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectExecution) {
  const args = parseArgs(process.argv.slice(2));
  const result = runGates({ base: args.base });
  if (!result.success) {
    console.error('\nAgent gates FAILED. Atualize OpenSpec/UI ou remova overclaims.');
    process.exit(1);
  }
  console.log('\nAgent gates PASSED.');
}
