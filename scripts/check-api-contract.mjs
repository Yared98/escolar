import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Calculates Levenshtein distance between two strings for route suggestion
 */
export function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Finds closest route path in known backend routes
 */
export function findClosestRoute(targetPath, knownRoutes) {
  let minDistance = Infinity;
  let closest = null;
  for (const routePath of knownRoutes.keys()) {
    const dist = levenshteinDistance(targetPath, routePath);
    if (dist < minDistance) {
      minDistance = dist;
      closest = routePath;
    }
  }
  return closest;
}

/**
 * Parses backend routes from Axum routes.rs code
 * Returns Map<normalizedPath, Set<methods>>
 */
export function parseBackendRoutes(code) {
  const routes = new Map();

  let pos = 0;
  while (pos < code.length) {
    const routeIndex = code.indexOf('.route(', pos);
    if (routeIndex === -1) break;

    let parenStart = routeIndex + '.route('.length - 1;
    let parenDepth = 1;
    let inString = null;
    let i = parenStart + 1;

    while (i < code.length && parenDepth > 0) {
      const char = code[i];
      if (inString) {
        if (char === inString && code[i - 1] !== '\\') {
          inString = null;
        }
      } else {
        if (char === '"' || char === "'") {
          inString = char;
        } else if (char === '(') {
          parenDepth++;
        } else if (char === ')') {
          parenDepth--;
        }
      }
      i++;
    }

    if (parenDepth === 0) {
      const routeContent = code.substring(parenStart + 1, i - 1);
      const pathMatch = routeContent.match(/^\s*["']([^"']+)["']\s*,\s*([\s\S]*)$/);
      if (pathMatch) {
        const rawPath = pathMatch[1];
        const handlersStr = pathMatch[2];

        // Normalize parameter segments :param_name to {}
        let normPath = rawPath.replace(/:[a-zA-Z0-9_]+/g, '{}');

        // Strip leading /api/v1 if present
        if (normPath.startsWith('/api/v1')) {
          normPath = normPath.substring('/api/v1'.length);
        }
        if (!normPath.startsWith('/')) {
          normPath = '/' + normPath;
        }

        const methods = new Set();
        const methodRegex = /\b(get|post|put|delete|patch)\s*\(/g;
        let mMatch;
        while ((mMatch = methodRegex.exec(handlersStr)) !== null) {
          methods.add(mMatch[1].toUpperCase());
        }

        if (!routes.has(normPath)) {
          routes.set(normPath, new Set());
        }
        for (const m of methods) {
          routes.get(normPath).add(m);
        }
      }
      pos = i;
    } else {
      pos = routeIndex + '.route('.length;
    }
  }

  return routes;
}

/**
 * Parses apiFetch and fetch calls from TypeScript code
 */
export function parseFrontendCalls(code, filePath = '') {
  const calls = [];
  let pos = 0;
  while (pos < code.length) {
    const apiFetchMatch = code
      .substring(pos)
      .search(/(?<!function\s+)(?<!async\s+function\s+)\b(apiFetch|fetch)\s*(?:<[\s\S]*?>)?\s*\(/);
    if (apiFetchMatch === -1) break;

    const callStart = pos + apiFetchMatch;
    const matchStr = code.substring(callStart).match(/\b(apiFetch|fetch)\b/);
    const fnName = matchStr[1];

    let parenStart = callStart + fnName.length;
    while (parenStart < code.length && code[parenStart] !== '(') {
      parenStart++;
    }
    if (parenStart >= code.length) break;

    let parenDepth = 1;
    let inString = null;
    let i = parenStart + 1;
    let arg1End = -1;
    let callEnd = -1;

    while (i < code.length && parenDepth > 0) {
      const char = code[i];
      if (inString) {
        if (char === inString && code[i - 1] !== '\\') {
          inString = null;
        }
      } else {
        if (char === '"' || char === "'" || char === '`') {
          inString = char;
        } else if (char === '(' || char === '{' || char === '[') {
          parenDepth++;
        } else if (char === ')' || char === '}' || char === ']') {
          parenDepth--;
          if (parenDepth === 0) {
            callEnd = i;
            if (arg1End === -1) arg1End = i;
          }
        } else if (char === ',' && parenDepth === 1 && arg1End === -1) {
          arg1End = i;
        }
      }
      i++;
    }

    if (callEnd !== -1) {
      const arg1Text = code.substring(parenStart + 1, arg1End).trim();
      const restText = code.substring(arg1End, callEnd).trim();
      const lineNum = code.substring(0, callStart).split('\n').length;

      calls.push({
        file: filePath.replace(/\\/g, '/'),
        line: lineNum,
        fnName,
        arg1: arg1Text,
        rest: restText,
      });
      pos = callEnd + 1;
    } else {
      pos = callStart + fnName.length;
    }
  }
  return calls;
}

/**
 * Normalizes frontend path argument.
 * Returns { isDynamic: boolean, path?: string }
 */
export function normalizeFrontendPath(arg1Text) {
  let text = arg1Text.trim();

  // Strip leading ${API_BASE}, ${apiBase}, ${API_URL} inside template literal
  text = text.replace(/^`\$\{(?:API_BASE|apiBase|API_URL)\}/, '`');

  let isLiteral = false;
  let normalized = '';

  // Check top-level '+' for string concatenation outside quotes
  let hasTopLevelPlus = false;
  let inQuote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === inQuote && text[i - 1] !== '\\') inQuote = null;
    } else {
      if (ch === '"' || ch === "'" || ch === '`') inQuote = ch;
      else if (ch === '+') {
        hasTopLevelPlus = true;
        break;
      }
    }
  }

  if (hasTopLevelPlus && (text.startsWith("'") || text.startsWith('"') || text.startsWith('`'))) {
    const parts = [];
    let current = '';
    let inStr = null;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inStr) {
        current += ch;
        if (ch === inStr && text[i - 1] !== '\\') inStr = null;
      } else {
        if (ch === '"' || ch === "'" || ch === '`') {
          inStr = ch;
          current += ch;
        } else if (ch === '+') {
          parts.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    if (current.trim()) parts.push(current.trim());

    if (parts.length > 0 && (parts[0].startsWith("'") || parts[0].startsWith('"') || parts[0].startsWith('`'))) {
      isLiteral = true;
      let combined = '';
      for (const p of parts) {
        if ((p.startsWith("'") && p.endsWith("'")) || (p.startsWith('"') && p.endsWith('"'))) {
          combined += p.slice(1, -1);
        } else if (p.startsWith('`') && p.endsWith('`')) {
          combined += p.slice(1, -1).replace(/\$\{[\s\S]*?\}/g, '{}');
        } else {
          combined += '{}';
        }
      }
      normalized = combined;
    }
  } else if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"'))) {
    isLiteral = true;
    normalized = text.slice(1, -1);
  } else if (text.startsWith('`') && text.endsWith('`')) {
    isLiteral = true;
    const raw = text.slice(1, -1);
    normalized = raw.replace(/\$\{[\s\S]*?\}/g, '{}');
  }

  if (!isLiteral) {
    return { isDynamic: true };
  }

  // Strip query parameters
  if (normalized.includes('?')) {
    normalized = normalized.split('?')[0];
  }

  // Strip optional leading /api/v1
  if (normalized.startsWith('/api/v1')) {
    normalized = normalized.substring('/api/v1'.length);
  }

  // Ensure leading slash
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  return { isDynamic: false, path: normalized };
}

/**
 * true quando o primeiro argumento literal de apiFetch já começa com /api/v1.
 */
export function comecaComPrefixoApi(arg1Text) {
  return /^[`'"]\/api\/v1(\/|[`'"?])/.test((arg1Text || '').trim());
}

/**
 * Extracts HTTP method information from rest arguments (options parameter).
 * Returns { isDynamic: boolean, method?: string }
 */
export function extractMethodInfo(restText) {
  let text = restText.trim();
  if (!text) {
    return { isDynamic: false, method: 'GET' };
  }

  if (text.startsWith(',')) {
    text = text.substring(1).trim();
  }

  if (!text) {
    return { isDynamic: false, method: 'GET' };
  }

  // Extract first argument after comma (the options argument)
  let optionsArg = text;
  let depthParen = 0, depthBrace = 0, depthBracket = 0, inStr = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (ch === inStr && text[i - 1] !== '\\') inStr = null;
    } else {
      if (ch === '"' || ch === "'" || ch === '`') inStr = ch;
      else if (ch === '(') depthParen++;
      else if (ch === ')') depthParen--;
      else if (ch === '{') depthBrace++;
      else if (ch === '}') depthBrace--;
      else if (ch === '[') depthBracket++;
      else if (ch === ']') depthBracket--;
      else if (ch === ',' && depthParen === 0 && depthBrace === 0 && depthBracket === 0) {
        optionsArg = text.substring(0, i).trim();
        break;
      }
    }
  }

  if (!optionsArg.startsWith('{') || !optionsArg.endsWith('}')) {
    return { isDynamic: true };
  }

  const inner = optionsArg.slice(1, -1).trim();
  if (!inner) {
    return { isDynamic: false, method: 'GET' };
  }

  let hasTopLevelSpread = false;
  let methodValStr = null;

  const props = [];
  let propStart = 0;
  depthParen = 0; depthBrace = 0; depthBracket = 0; inStr = null;

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (inStr) {
      if (ch === inStr && inner[i - 1] !== '\\') inStr = null;
    } else {
      if (ch === '"' || ch === "'" || ch === '`') inStr = ch;
      else if (ch === '(') depthParen++;
      else if (ch === ')') depthParen--;
      else if (ch === '{') depthBrace++;
      else if (ch === '}') depthBrace--;
      else if (ch === '[') depthBracket++;
      else if (ch === ']') depthBracket--;
      else if (ch === ',' && depthParen === 0 && depthBrace === 0 && depthBracket === 0) {
        props.push(inner.substring(propStart, i).trim());
        propStart = i + 1;
      }
    }
  }
  const lastProp = inner.substring(propStart).trim();
  if (lastProp) props.push(lastProp);

  for (const prop of props) {
    if (prop.startsWith('...')) {
      hasTopLevelSpread = true;
    } else {
      const m = prop.match(/^method\s*:\s*([\s\S]*)$/i);
      if (m) {
        methodValStr = m[1].trim();
      }
    }
  }

  if (hasTopLevelSpread) {
    return { isDynamic: true };
  }

  if (methodValStr === null) {
    return { isDynamic: false, method: 'GET' };
  }

  const stringLiteralMatch = methodValStr.match(/^(['"`])(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\1$/i);
  if (stringLiteralMatch) {
    return { isDynamic: false, method: stringLiteralMatch[2].toUpperCase() };
  }

  return { isDynamic: true };
}

/**
 * Legacy extractMethod for backwards compatibility.
 * Returns method string if literal, or 'GET' otherwise.
 */
export function extractMethod(restText) {
  const info = extractMethodInfo(restText);
  return info.isDynamic ? 'GET' : info.method;
}

function walkDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(full));
    } else if (
      (full.endsWith('.ts') || full.endsWith('.tsx')) &&
      !full.includes('.test.') &&
      !full.includes('.spec.')
    ) {
      results.push(full);
    }
  });
  return results;
}

/**
 * Main checking function
 */
export function checkApiContract(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const routesFile = options.routesFile || path.join(rootDir, 'backend', 'src', 'routes.rs');
  const frontendDir = options.frontendDir || path.join(rootDir, 'frontend', 'src');
  const allowlistFile = options.allowlistFile || path.join(rootDir, 'scripts', 'api-contract-allowlist.json');
  const snapshotFile = options.snapshotFile || path.join(rootDir, 'scripts', 'api-calls.snapshot.json');

  let backendRoutes;
  if (options.routesCode) {
    backendRoutes = parseBackendRoutes(options.routesCode);
  } else {
    if (!fs.existsSync(routesFile)) {
      console.error(`[ERRO] Arquivo de rotas do backend não encontrado: ${routesFile}`);
      return { success: false, errors: [`Arquivo de rotas não encontrado: ${routesFile}`] };
    }
    backendRoutes = parseBackendRoutes(fs.readFileSync(routesFile, 'utf8'));
  }

  let allowlist = [];
  if (options.allowlist) {
    allowlist = options.allowlist;
  } else if (fs.existsSync(allowlistFile)) {
    try {
      allowlist = JSON.parse(fs.readFileSync(allowlistFile, 'utf8'));
    } catch (e) {
      console.error(`[ERRO] Falha ao ler a allowlist (${allowlistFile}): ${e.message}`);
      return { success: false, errors: [`Falha ao ler allowlist: ${e.message}`] };
    }
  }

  let allCalls = [];
  if (options.filesMap) {
    for (const [filePath, code] of Object.entries(options.filesMap)) {
      allCalls.push(...parseFrontendCalls(code, filePath));
    }
  } else {
    if (!fs.existsSync(frontendDir)) {
      console.error(`[ERRO] Diretório do frontend não encontrado: ${frontendDir}`);
      return { success: false, errors: [`Diretório não encontrado: ${frontendDir}`] };
    }
    const files = walkDir(frontendDir);
    for (const f of files) {
      const code = fs.readFileSync(f, 'utf8');
      const relPath = path.relative(rootDir, f).replace(/\\/g, '/');
      allCalls.push(...parseFrontendCalls(code, relPath));
    }
  }

  const errors = [];
  const dynamics = [];
  const usedAllowlistIndexes = new Set();
  const currentSnapshotMap = new Map();
  let totalCalls = 0;

  for (const call of allCalls) {
    // Ignore internal fetch implementation in lib/api.ts line 64: fetch(`${API_BASE}${endpoint}`)
    if ((call.file === 'frontend/src/lib/api.ts' || call.file.endsWith('lib/api.ts')) && call.arg1.includes('API_BASE')) {
      continue;
    }

    totalCalls++;
    const norm = normalizeFrontendPath(call.arg1);
    const methodInfo = extractMethodInfo(call.rest);

    const isDynamic = norm.isDynamic || methodInfo.isDynamic;

    if (isDynamic) {
      // Check allowlist using file + expressao (or legacy line)
      let matchedIndex = -1;
      const allowed = allowlist.find((item, idx) => {
        const itemFile = item.file.replace(/\\/g, '/');
        const fileMatches = call.file === itemFile || call.file.endsWith(itemFile);
        const exprMatches = item.expressao === undefined || item.expressao === call.arg1;
        const lineMatches = item.line === undefined || item.line === call.line;
        const matched = fileMatches && exprMatches && lineMatches && !!item.motivo;
        if (matched) matchedIndex = idx;
        return matched;
      });

      if (!allowed) {
        const reasonDetail = norm.isDynamic
          ? `(arg: "${call.arg1}")`
          : `(método não literal: "${call.arg1}")`;
        const errMsg = `${call.file}:${call.line} -> Chamada dinâmica de API sem entrada na allowlist ${reasonDetail}`;
        console.error(`[ERRO] ${errMsg}`);
        errors.push(errMsg);
      } else {
        usedAllowlistIndexes.add(matchedIndex);
        dynamics.push({ file: call.file, line: call.line, arg1: call.arg1, motivo: allowed.motivo });
      }
    } else {
      const method = methodInfo.method;
      const key = `${method} ${norm.path}`;

      // apiFetch já acrescenta /api/v1 (API_BASE): um caminho que começa com /api/v1 vira /api/v1/api/v1 e dá 404.
      if (comecaComPrefixoApi(call.arg1)) {
        const errMsg = `${call.file}:${call.line} -> Caminho começa com /api/v1, mas apiFetch já acrescenta esse prefixo (a chamada vira /api/v1/api/v1${norm.path}).`;
        console.error(`[ERRO] ${errMsg}`);
        errors.push(errMsg);
      }
      currentSnapshotMap.set(key, (currentSnapshotMap.get(key) || 0) + 1);

      const allowedMethods = backendRoutes.get(norm.path);
      if (!allowedMethods) {
        const closest = findClosestRoute(norm.path, backendRoutes);
        const suggestion = closest ? ` Rota mais parecida: ${closest}` : '';
        const errMsg = `${call.file}:${call.line} -> Chamada para rota inexistente [${method} ${norm.path}].${suggestion}`;
        console.error(`[ERRO] ${errMsg}`);
        errors.push(errMsg);
      } else if (!allowedMethods.has(method)) {
        const errMsg = `${call.file}:${call.line} -> Método ${method} não permitido para rota ${norm.path}. Métodos registrados: [${Array.from(allowedMethods).join(', ')}]`;
        console.error(`[ERRO] ${errMsg}`);
        errors.push(errMsg);
      }
    }
  }

  // Check obsolete allowlist entries
  for (let i = 0; i < allowlist.length; i++) {
    if (!usedAllowlistIndexes.has(i)) {
      const item = allowlist[i];
      const detail = item.expressao ? `expressao: "${item.expressao}"` : `linha: ${item.line}`;
      const msg = `Entrada obsoleta na allowlist: ${item.file} (${detail})`;
      console.warn(`[AVISO] ${msg}`);
      if (options.strictAllowlist) {
        errors.push(msg);
        console.error(`[ERRO] ${msg}`);
      }
    }
  }

  // Snapshot generation
  if (options.snapshot) {
    const snapshotObj = {};
    const sortedKeys = Array.from(currentSnapshotMap.keys()).sort();
    for (const key of sortedKeys) {
      snapshotObj[key] = currentSnapshotMap.get(key);
    }
    fs.writeFileSync(snapshotFile, JSON.stringify(snapshotObj, null, 2) + '\n', 'utf8');
    console.log(`[OK] Snapshot de chamadas de API salvo em: ${snapshotFile}`);
  }

  // Snapshot comparison
  if (options.compareSnapshot) {
    if (!fs.existsSync(snapshotFile)) {
      const errMsg = `Arquivo de snapshot não encontrado: ${snapshotFile}. Execute com --snapshot para gerar.`;
      console.error(`[ERRO] ${errMsg}`);
      errors.push(errMsg);
    } else {
      let snapshotCounts = {};
      try {
        snapshotCounts = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
      } catch (e) {
        const errMsg = `Falha ao ler snapshot file (${snapshotFile}): ${e.message}`;
        console.error(`[ERRO] ${errMsg}`);
        errors.push(errMsg);
      }

      const allKeys = new Set([...Object.keys(snapshotCounts), ...currentSnapshotMap.keys()]);
      const sortedKeys = Array.from(allKeys).sort();

      for (const key of sortedKeys) {
        const expected = snapshotCounts[key] || 0;
        const actual = currentSnapshotMap.get(key) || 0;
        if (expected > actual) {
          const errMsg = `Snapshot mismatch: chamada AUSENTE [${key}] (esperado: ${expected}, encontrado: ${actual})`;
          console.error(`[ERRO] ${errMsg}`);
          errors.push(errMsg);
        } else if (actual > expected) {
          const errMsg = `Snapshot mismatch: chamada NOVA [${key}] (esperado: ${expected}, encontrado: ${actual})`;
          console.error(`[ERRO] ${errMsg}`);
          errors.push(errMsg);
        }
      }
    }
  }

  console.log(`\nVerificação de Contrato de API concluída:`);
  console.log(`- Total de chamadas analisadas: ${totalCalls}`);
  console.log(`- Chamadas dinâmicas permitidas (allowlist): ${dynamics.length}`);
  console.log(`- Erros de contrato encontrados: ${errors.length}`);

  return {
    success: errors.length === 0,
    totalCalls,
    errors,
    dynamics,
  };
}

// Execute if run directly
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const args = process.argv.slice(2);
  const snapshot = args.includes('--snapshot');
  const compareSnapshot = args.includes('--compare-snapshot');
  const strictAllowlist = args.includes('--strict-allowlist');

  const result = checkApiContract({ snapshot, compareSnapshot, strictAllowlist });
  if (!result.success) {
    process.exit(1);
  }
}
