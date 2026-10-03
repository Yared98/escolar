import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'child_process';
import { pathToFileURL } from 'node:url';

/**
 * Normaliza uma linha removendo espaços excedentes e fazendo trim.
 * @param {string} line
 * @returns {string}
 */
export function normalizeLine(line) {
  return line.trim().replace(/\s+/g, ' ');
}

/**
 * Retorna true se a linha for considerada "encanamento permitido" (boilerplate de refactor).
 * Regexes no topo para ignorar linhas de import/export de componente, declaração de função/componente extraído,
 * interface de props boilerplate, membros dentro de interface de props e linhas de fechamento.
 * @param {string} rawLine
 * @returns {boolean}
 */
export function isAllowedPlumbing(rawLine) {
  const line = normalizeLine(rawLine);
  if (!line) return true;

  // Linhas de fechamento / pontuação isolada / JSX tags simples de fechamento ou abertura estrutural simples
  if (/^(?:[\}\)\;]|[\}\)]\;|\}\)\;?|\/\>|\<\/\>|\<\>|\{\/\*.*?\*\/\})$/.test(line)) return true;
  if (/^\<\/?(?:div|span|section|main|header|footer|article|form|ul|ol|li)\s*\>$/.test(line)) return true;
  if (/^(?:\}\s*else\s*\{|\}\s*catch\s*\(.*?\)\s*\{|\}\s*finally\s*\{)$/.test(line)) return true;

  // Imports / Exports de re-export
  if (/^import\s+/.test(line)) return true;
  if (/^export\s+\*\s+from\s+/.test(line)) return true;
  if (/^export\s+\{[\s\S]*?\}\s+from\s+/.test(line)) return true;
  if (/^export\s+default\s+/.test(line)) return true;

  // Declaração do componente extraído ou função exportada
  // Ex: export function Nome( ou export function Nome({ ou const Componente = ...
  if (/^export\s+(?:default\s+)?function\s+[A-Za-z0-9_]+\s*\(/.test(line)) return true;
  if (/^export\s+const\s+[A-Za-z0-9_]+\s*:\s*React\.FC/.test(line)) return true;
  if (/^export\s+const\s+[A-Za-z0-9_]+\s*=\s*\(/.test(line)) return true;

  // Interface/Type de props (cabeçalho e membros de props)
  // Ex: interface NomeProps { ou export interface NomeProps { ou type NomeProps = {
  if (/^(?:export\s+)?interface\s+[A-Za-z0-9_]+Props\s*\{?$/.test(line)) return true;
  if (/^(?:export\s+)?type\s+[A-Za-z0-9_]+Props\s*=\s*\{?$/.test(line)) return true;
  // Membros dentro de interfaces ou tipos de Props: p.ex. "nome: string;", "setBusca: (v: string) => void;"
  if (/^[a-zA-Z0-9_]+\??\s*:\s*[^;{}]+;?$/.test(line)) return true;

  // Desestruturação de props (multilinha ou linha única)
  // Ex: }: NomeProps) { ou } : Props) { ou ) { ou a, b,
  if (/^\}\s*:\s*[A-Za-z0-9_]+Props\s*\)\s*\{?$/.test(line)) return true;
  if (/^\)\s*:\s*JSX\.Element\s*\{?$/.test(line)) return true;
  if (/^\)\s*\{?$/.test(line)) return true;
  if (/^[a-zA-Z0-9_]+,$/.test(line)) return true;

  // Retorno de JSX ou hooks
  if (/^return\s*\(?$/.test(line)) return true;
  if (/^return\s+\<[A-Z][A-Za-z0-9_]*/.test(line)) return true;

  // Uso do componente no Section (chamadas JSX de componentes extraídos e props multilinha simples com o mesmo identificador: x={x})
  // Ex: <NomeComponente prop={prop} /> ou prop={prop}
  if (/^\<[A-Z][A-Za-z0-9_]*(?:\s+([a-zA-Z0-9_]+)=\{\1\})*\s*\/?\>?$/.test(line)) return true;
  if (/^([a-zA-Z0-9_]+)=\{\1\},?(?:\s*\/?\>)?$/.test(line)) return true;

  return false;
}

/**
 * Normaliza corpo de interface/type para comparação
 * @param {string} bodyStr
 * @returns {string}
 */
export function normalizeTypeBody(bodyStr) {
  return bodyStr
    .split('\n')
    .map(l => normalizeLine(l))
    .filter(Boolean)
    .join('\n');
}

/**
 * Extrai bloco balanceado por chaves { ... } a partir de uma posição.
 */
function extractBalancedBlock(code, startIndex) {
  let depth = 0;
  let started = false;
  let endIndex = -1;

  for (let i = startIndex; i < code.length; i++) {
    const char = code[i];
    if (char === '{') {
      depth++;
      started = true;
    } else if (char === '}') {
      depth--;
      if (started && depth === 0) {
        endIndex = i;
        break;
      }
    }
  }

  if (endIndex !== -1) {
    return code.substring(startIndex, endIndex + 1);
  }
  return null;
}

/**
 * Extrai os pares (nome, corpo_normalizado) de interface e type em um código fonte TS/TSX.
 * Ignores interfaces/types terminando com 'Props'.
 * @param {string} code
 * @returns {Array<{name: string, body: string, fields: string[]}>}
 */
export function extractTypesFromCode(code) {
  const types = [];

  // Regex para interface X
  const interfaceRegex = /(?:export\s+)?interface\s+([A-Za-z0-9_]+)(?:\s+extends\s+[^{]+)?\s*\{/g;
  let match;
  while ((match = interfaceRegex.exec(code)) !== null) {
    const name = match[1];
    if (name.endsWith('Props')) continue; // Tipos de props de componentes extraídos não entram na comparação de pares

    const braceIndex = match.index + match[0].length - 1;
    const block = extractBalancedBlock(code, braceIndex);
    if (block) {
      const rawBody = block.substring(1, block.length - 1);
      const body = normalizeTypeBody(rawBody);
      const fields = rawBody
        .split('\n')
        .map(l => normalizeLine(l))
        .filter(l => l && !l.startsWith('//') && !l.startsWith('/*'))
        .sort();
      types.push({ name, body, fields, rawBody });
    }
  }

  // Regex para type X = { ... } ou type X = Y | Z
  const typeHeaderRegex = /(?:export\s+)?type\s+([A-Za-z0-9_]+)\s*=\s*/g;
  while ((match = typeHeaderRegex.exec(code)) !== null) {
    const name = match[1];
    if (name.endsWith('Props')) continue;

    const afterEqualsIndex = match.index + match[0].length;
    const rest = code.substring(afterEqualsIndex);

    let rawBody = '';
    if (rest.trimStart().startsWith('{')) {
      const braceOffset = rest.indexOf('{');
      const block = extractBalancedBlock(rest, braceOffset);
      if (block) {
        rawBody = block;
      } else {
        const semiIndex = rest.indexOf(';');
        rawBody = semiIndex !== -1 ? rest.substring(0, semiIndex) : rest;
      }
    } else {
      const semiIndex = rest.indexOf(';');
      rawBody = semiIndex !== -1 ? rest.substring(0, semiIndex) : rest;
    }

    const body = normalizeTypeBody(rawBody);
    const fields = rawBody
      .split('\n')
      .map(l => normalizeLine(l))
      .filter(l => l && !l.startsWith('//') && !l.startsWith('/*'))
      .sort();
    types.push({ name, body, fields, rawBody });
  }

  return types;
}

/**
 * Extrai o conjunto de literais de abas e verifica se todas as abas registradas no menu (tabKey)
 * possuem correspondência de tratamento nas telas (activeTab, activeSubTab, tabParam).
 * @param {string} code
 * @returns {Set<string>}
 */
export function extractTabIdsFromCode(code) {
  const tabIds = new Set();
  const patterns = [
    /tabParam\s*===\s*['"]([^'"]+)['"]/g,
    /activeTab\s*===\s*['"]([^'"]+)['"]/g,
    /activeSubTab\s*===\s*['"]([^'"]+)['"]/g,
    /tabKey\s*:\s*['"]([^'"]+)['"]/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      tabIds.add(match[1]);
    }
  }

  return tabIds;
}

/**
 * Extrai separadamente as abas declaradas no menu (tabKey) e as abas tratadas nas telas (activeTab, tabParam, activeSubTab).
 * Retorna as abas de menu que não possuem nenhuma tela que as trate.
 */
export function extractHandledAndMenuTabs(fileMap) {
  const menuTabs = new Set();
  const handledTabs = new Set();

  const menuPattern = /tabKey\s*:\s*['"]([^'"]+)['"]/g;
  const handledPatterns = [
    /tabParam\s*===\s*['"]([^'"]+)['"]/g,
    /activeTab\s*===\s*['"]([^'"]+)['"]/g,
    /activeSubTab\s*===\s*['"]([^'"]+)['"]/g,
    /activeTab\s*==\s*['"]([^'"]+)['"]/g,
  ];

  for (const content of fileMap.values()) {
    let match;
    while ((match = menuPattern.exec(content)) !== null) {
      if (match[1] !== 'envios') { // envios is a subtab/filter key in agenda
        menuTabs.add(match[1]);
      }
    }
    for (const pattern of handledPatterns) {
      while ((match = pattern.exec(content)) !== null) {
        handledTabs.add(match[1]);
      }
    }
  }

  const unhandledMenuTabs = [];
  for (const menuTab of menuTabs) {
    if (!handledTabs.has(menuTab)) {
      unhandledMenuTabs.push(menuTab);
    }
  }

  return { menuTabs, handledTabs, unhandledMenuTabs };
}

/**
 * Le o estado dos arquivos em frontend/src a partir de um git ref ou do working tree.
 * @param {string} rootDir
 * @param {string|null} ref - null para working tree/HEAD
 * @returns {Map<string, string>} map de relativePath -> content
 */
export function getFrontendFiles(rootDir, ref = null) {
  const fileMap = new Map();
  if (ref) {
    const stdout = execSync(`git ls-tree -r --name-only ${ref} frontend/src`, {
      cwd: rootDir,
      encoding: 'utf-8',
    });
    const files = stdout.split('\n').map(f => f.trim()).filter(Boolean);
    for (const relPath of files) {
      if (/\.(ts|tsx)$/.test(relPath)) {
        try {
          const content = execSync(`git show ${ref}:${relPath}`, {
            cwd: rootDir,
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024,
          });
          fileMap.set(relPath, content);
        } catch (e) {
          // arquivo pode ter sido removido ou erro de git
        }
      }
    }
  } else {
    const frontendSrc = path.join(rootDir, 'frontend', 'src');
    if (fs.existsSync(frontendSrc)) {
      const walk = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (/\.(ts|tsx)$/.test(entry.name)) {
            const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
            const content = fs.readFileSync(fullPath, 'utf-8');
            fileMap.set(relPath, content);
          }
        }
      };
      walk(frontendSrc);
    }
  }
  return fileMap;
}

/**
 * Obtem as linhas adicionadas e removidas no diff entre ref e working tree.
 * @param {string} rootDir
 * @param {string} baseRef
 * @returns {{ added: Array<{file: string, lineNum: number, line: string}>, removed: string[] }}
 */
export function getGitDiffLines(rootDir, baseRef) {
  let diffOutput = execSync(`git diff ${baseRef} -- "frontend/src"`, {
    cwd: rootDir,
    encoding: 'utf-8',
    maxBuffer: 20 * 1024 * 1024,
  });

  try {
    const untracked = execSync('git ls-files --others --exclude-standard frontend/src', {
      cwd: rootDir,
      encoding: 'utf-8',
    }).split('\n').map(f => f.trim()).filter(Boolean);

    for (const uFile of untracked) {
      try {
        execSync(`git diff --no-index /dev/null "${uFile}"`, { cwd: rootDir, encoding: 'utf-8' });
      } catch (err) {
        if (err.stdout) diffOutput += '\n' + err.stdout;
      }
    }
  } catch (e) {
    // Ignore
  }

  const added = [];
  const removed = [];

  let currentFile = '';
  let currentLineNum = 0;

  const lines = diffOutput.split('\n');
  for (const line of lines) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.substring(6);
      continue;
    }
    if (line.startsWith('@@ ')) {
      // Suporta @@ -a,b +c,d @@ e @@ -a +b @@
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        currentLineNum = parseInt(match[1], 10) - 1;
      }
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      currentLineNum++;
      const lineContent = line.substring(1);
      added.push({ file: currentFile, lineNum: currentLineNum, line: lineContent });
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      const lineContent = line.substring(1);
      removed.push(lineContent);
    } else if (!line.startsWith('\\')) {
      currentLineNum++;
    }
  }

  return { added, removed };
}

/**
 * Analisa as diferencas entre a base e o estado atual.
 */
export function analyzeRefactorMove(rootDir, baseRef, maxNovas = 0) {
  const diff = getGitDiffLines(rootDir, baseRef);

  // 1. Linhas novas & Multiconjunto
  const removedBag = new Map();
  for (const rem of diff.removed) {
    const norm = normalizeLine(rem);
    if (!norm) continue;
    removedBag.set(norm, (removedBag.get(norm) || 0) + 1);
  }

  const newLines = [];
  for (const add of diff.added) {
    const norm = normalizeLine(add.line);
    if (!norm) continue;

    let matchedKey = null;
    if (removedBag.has(norm) && removedBag.get(norm) > 0) {
      matchedKey = norm;
    } else if (norm.startsWith('export ')) {
      const withoutExport = normalizeLine(norm.substring(7));
      if (withoutExport && removedBag.has(withoutExport) && removedBag.get(withoutExport) > 0) {
        matchedKey = withoutExport;
      }
    } else {
      const withExport = normalizeLine('export ' + norm);
      if (removedBag.has(withExport) && removedBag.get(withExport) > 0) {
        matchedKey = withExport;
      }
    }

    if (matchedKey) {
      removedBag.set(matchedKey, removedBag.get(matchedKey) - 1);
      continue;
    }

    if (isAllowedPlumbing(add.line)) {
      continue;
    }

    newLines.push(add);
  }

  // 2. Extrair Tipos (Base vs Branch)
  const baseFiles = getFrontendFiles(rootDir, baseRef);
  const currentFiles = getFrontendFiles(rootDir, null);

  const extractAllTypes = (fileMap) => {
    const list = [];
    for (const [file, content] of fileMap.entries()) {
      const fileTypes = extractTypesFromCode(content);
      for (const t of fileTypes) {
        list.push({ ...t, file });
      }
    }
    return list;
  };

  const baseTypes = extractAllTypes(baseFiles);
  const currentTypes = extractAllTypes(currentFiles);

  const baseTypePairs = new Map();
  for (const t of baseTypes) {
    const key = `${t.name}::${t.body}`;
    if (!baseTypePairs.has(key)) baseTypePairs.set(key, { ...t, count: 0 });
    baseTypePairs.get(key).count++;
  }

  const currentTypePairs = new Map();
  for (const t of currentTypes) {
    const key = `${t.name}::${t.body}`;
    if (!currentTypePairs.has(key)) currentTypePairs.set(key, { ...t, count: 0 });
    currentTypePairs.get(key).count++;
  }

  const typeDivergences = [];

  for (const [key, bType] of baseTypePairs.entries()) {
    if (!currentTypePairs.has(key)) {
      const matchesName = currentTypes.filter(ct => ct.name === bType.name);
      if (matchesName.length > 0) {
        typeDivergences.push({
          name: bType.name,
          reason: `Tipo '${bType.name}' foi alterado`,
          baseFields: bType.fields,
          currentFields: matchesName[0].fields,
        });
      } else {
        typeDivergences.push({
          name: bType.name,
          reason: `Tipo '${bType.name}' foi removido`,
        });
      }
    }
  }

  for (const [key, cType] of currentTypePairs.entries()) {
    if (!baseTypePairs.has(key)) {
      const matchesName = baseTypes.filter(bt => bt.name === cType.name);
      if (matchesName.length === 0) {
        typeDivergences.push({
          name: cType.name,
          reason: `Tipo '${cType.name}' foi criado na branch`,
        });
      }
    }
  }

  const uniqueTypeDivergencesMap = new Map();
  for (const div of typeDivergences) {
    if (!uniqueTypeDivergencesMap.has(div.name)) {
      uniqueTypeDivergencesMap.set(div.name, div);
    }
  }
  const typeDivergencesUnique = Array.from(uniqueTypeDivergencesMap.values());

  // 3. Extrair Ids de Aba
  const baseTabIds = new Set();
  for (const content of baseFiles.values()) {
    for (const tabId of extractTabIdsFromCode(content)) {
      baseTabIds.add(tabId);
    }
  }

  const currentTabIds = new Set();
  for (const content of currentFiles.values()) {
    for (const tabId of extractTabIdsFromCode(content)) {
      currentTabIds.add(tabId);
    }
  }

  const missingTabIds = Array.from(baseTabIds).filter(id => !currentTabIds.has(id));
  const newTabIds = Array.from(currentTabIds).filter(id => !baseTabIds.has(id));

  // Verificar abas de menu sem tela correspondente (ex: portal_rotina)
  const currentTabHandling = extractHandledAndMenuTabs(currentFiles);
  for (const unhandled of currentTabHandling.unhandledMenuTabs) {
    if (!missingTabIds.includes(unhandled)) {
      missingTabIds.push(`${unhandled} (menu sem tela)`);
    }
  }

  return {
    newLines,
    typeDivergences: typeDivergencesUnique,
    tabIds: {
      missing: missingTabIds,
      added: newTabIds,
    },
    maxNovas,
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const args = process.argv.slice(2);
  let baseRef = null;
  let maxNovas = 0;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base' && i + 1 < args.length) {
      baseRef = args[i + 1];
      i++;
    } else if (args[i] === '--max-novas' && i + 1 < args.length) {
      maxNovas = parseInt(args[i + 1], 10);
      i++;
    }
  }

  if (!baseRef) {
    console.error('Uso: node scripts/check-refactor-move.mjs --base <ref> [--max-novas N]');
    process.exit(1);
  }

  const rootDir = process.cwd();
  const result = analyzeRefactorMove(rootDir, baseRef, maxNovas);

  let hasError = false;

  console.log('=== RESULTADO DA VERIFICAÇÃO DE REFACTOR ===\n');

  if (result.newLines.length > 0) {
    console.log(`[!] Linhas novas encontradas (${result.newLines.length} > ${result.maxNovas}):`);
    for (const line of result.newLines) {
      console.log(`  ${line.file}:${line.lineNum}  ${line.line.trim()}`);
    }
    if (result.newLines.length > result.maxNovas) {
      hasError = true;
    }
  } else {
    console.log('[✓] Nenhuma linha nova encontrada.');
  }

  if (result.typeDivergences.length > 0) {
    console.log('\n[!] Divergências em Tipos (interface / type):');
    for (const div of result.typeDivergences) {
      console.log(`  - ${div.name}: ${div.reason}`);
      if (div.baseFields && div.currentFields) {
        console.log(`    Base fields:    [${div.baseFields.join(', ')}]`);
        console.log(`    Current fields: [${div.currentFields.join(', ')}]`);
      }
    }
    hasError = true;
  } else {
    console.log('[✓] Tipos idênticos.');
  }

  if (result.tabIds.missing.length > 0 || result.tabIds.added.length > 0) {
    console.log('\n[!] Divergências em IDs de aba:');
    if (result.tabIds.missing.length > 0) {
      console.log(`  - Ausentes (sumiram): ${result.tabIds.missing.join(', ')}`);
    }
    if (result.tabIds.added.length > 0) {
      console.log(`  - Novos (apareceram): ${result.tabIds.added.join(', ')}`);
    }
    hasError = true;
  } else {
    console.log('[✓] IDs de aba idênticos.');
  }

  console.log('\n=============================================');

  if (hasError) {
    console.error('FALHA: Foram encontradas divergências no refactor.');
    process.exit(1);
  } else {
    console.log('SUCESSO: O refactor apenas moveu código sem divergências.');
    process.exit(0);
  }
}
