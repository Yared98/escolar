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
 * Extracts HTTP method from rest options argument
 */
export function extractMethod(restText) {
  const methodMatch = restText.match(/method\s*:\s*['"`](GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)['"`]/i);
  if (methodMatch) {
    return methodMatch[1].toUpperCase();
  }
  return 'GET';
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
  let totalCalls = 0;

  for (const call of allCalls) {
    // Ignore internal fetch implementation in lib/api.ts line 64: fetch(`${API_BASE}${endpoint}`)
    if (call.file === 'frontend/src/lib/api.ts' && call.line === 64) {
      continue;
    }

    totalCalls++;
    const norm = normalizeFrontendPath(call.arg1);
    const method = extractMethod(call.rest);

    if (norm.isDynamic) {
      // Check allowlist
      const allowed = allowlist.find(item => {
        const itemFile = item.file.replace(/\\/g, '/');
        const fileMatches = call.file === itemFile || call.file.endsWith(itemFile);
        const lineMatches = item.line === undefined || item.line === call.line;
        return fileMatches && lineMatches && !!item.motivo;
      });

      if (!allowed) {
        const errMsg = `${call.file}:${call.line} -> Chamada dinâmica de API sem entrada na allowlist (arg: "${call.arg1}")`;
        console.error(`[ERRO] ${errMsg}`);
        errors.push(errMsg);
      } else {
        dynamics.push({ file: call.file, line: call.line, arg1: call.arg1, motivo: allowed.motivo });
      }
    } else {
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
  const result = checkApiContract();
  if (!result.success) {
    process.exit(1);
  }
}
