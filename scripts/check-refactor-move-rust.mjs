import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Tokenizador nativo Node.js para Rust.
 * Ignora comentários (//, ///, //!, /* *\/ aninhados), strings ("..."),
 * raw strings (r#"..."#), e diferencia char literals ('a', '\n', '}', '\'')
 * de lifetimes ('a, 'static).
 *
 * @param {string} code
 * @returns {Array<{ type: string, value: string, start: number, end: number }>}
 */
export function tokenizeRust(rawCode) {
  const code = rawCode.replace(/\r\n/g, '\n');
  const tokens = [];
  let i = 0;
  const len = code.length;

  while (i < len) {
    const ch = code[i];

    // Comentário de linha //, ///, //!
    if (ch === '/' && code[i + 1] === '/') {
      const start = i;
      i += 2;
      while (i < len && code[i] !== '\n') {
        i++;
      }
      tokens.push({ type: 'COMMENT', value: code.slice(start, i), start, end: i });
      continue;
    }

    // Comentário de bloco /* ... */ (com suporte a aninhamento!)
    if (ch === '/' && code[i + 1] === '*') {
      const start = i;
      i += 2;
      let depth = 1;
      while (i < len && depth > 0) {
        if (code[i] === '/' && code[i + 1] === '*') {
          depth++;
          i += 2;
        } else if (code[i] === '*' && code[i + 1] === '/') {
          depth--;
          i += 2;
        } else {
          i++;
        }
      }
      tokens.push({ type: 'COMMENT', value: code.slice(start, i), start, end: i });
      continue;
    }

    // Raw string r#"..."# ou br#"..."# ou r"..."
    if (
      (ch === 'r' || (ch === 'b' && code[i + 1] === 'r')) &&
      (code[i] === 'r'
        ? code[i + 1] === '#' || code[i + 1] === '"'
        : code[i + 2] === '#' || code[i + 2] === '"')
    ) {
      const start = i;
      if (ch === 'b') i++; // ignora 'b'
      i++; // ignora 'r'
      let pounds = 0;
      while (i < len && code[i] === '#') {
        pounds++;
        i++;
      }
      if (i < len && code[i] === '"') {
        i++; // ignora '\"' de abertura
        let matched = false;
        while (i < len) {
          if (code[i] === '"') {
            let p = 0;
            while (i + 1 + p < len && code[i + 1 + p] === '#' && p < pounds) {
              p++;
            }
            if (p === pounds) {
              i += 1 + pounds;
              matched = true;
              break;
            }
          }
          i++;
        }
        if (matched) {
          tokens.push({ type: 'STRING', value: code.slice(start, i), start, end: i });
          continue;
        }
      }
      // Se não fechou como raw string, restaura i
      i = start;
    }

    // String "..." ou b"..."
    if (ch === '"' || (ch === 'b' && code[i + 1] === '"')) {
      const start = i;
      if (ch === 'b') i++;
      i++; // ignora '"' de abertura
      while (i < len) {
        if (code[i] === '\\') {
          i += 2; // pula caractere de escape
        } else if (code[i] === '"') {
          i++; // ignora '"' de fechamento
          break;
        } else {
          i++;
        }
      }
      tokens.push({ type: 'STRING', value: code.slice(start, i), start, end: i });
      continue;
    }

    // Char literal vs Lifetime: inicia com '\'' ou b'\''
    if (ch === '\'' || (ch === 'b' && code[i + 1] === '\'')) {
      const start = i;
      if (ch === 'b') i++;
      i++; // ignora '\''

      // 1) Char literal com escape: '\'', '\\', '\n', '\x7F', '\u{1F600}'
      if (code[i] === '\\') {
        i++;
        if (code[i] === 'u' && code[i + 1] === '{') {
          while (i < len && code[i] !== '}') i++;
          if (i < len) i++;
        } else if (code[i] === 'x') {
          i += 3;
        } else {
          i++;
        }
        if (i < len && code[i] === '\'') i++;
        tokens.push({ type: 'CHAR', value: code.slice(start, i), start, end: i });
        continue;
      }
      // 2) Char literal simples de 1 caractere: 'x', '}', '{', ';', ' ' onde o seguinte é '\''
      else if (i + 1 < len && code[i + 1] === '\'' && code[i] !== '\'' && code[i] !== '\n') {
        i += 2; // avança o caractere e a aspa de fechamento
        tokens.push({ type: 'CHAR', value: code.slice(start, i), start, end: i });
        continue;
      }
      // 3) Lifetime: 'a, 'static, 'b
      else if (/[a-zA-Z0-9_]/.test(code[i])) {
        while (i < len && /[a-zA-Z0-9_]/.test(code[i])) i++;
        tokens.push({ type: 'LIFETIME', value: code.slice(start, i), start, end: i });
        continue;
      } else {
        // Aspa simples isolada
        tokens.push({ type: 'PUNCT', value: '\'', start, end: i + 1 });
        i++;
        continue;
      }
    }

    // Espaços / Quebras de linha
    if (/\s/.test(ch)) {
      const start = i;
      while (i < len && /\s/.test(code[i])) i++;
      tokens.push({ type: 'WS', value: code.slice(start, i), start, end: i });
      continue;
    }

    // Identificadores / Palavras-chave
    if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      while (i < len && /[a-zA-Z0-9_]/.test(code[i])) i++;
      tokens.push({ type: 'IDENT', value: code.slice(start, i), start, end: i });
      continue;
    }

    // Números
    if (/[0-9]/.test(ch)) {
      const start = i;
      while (i < len && /[0-9a-zA-Z_.]/.test(code[i])) i++;
      tokens.push({ type: 'NUMBER', value: code.slice(start, i), start, end: i });
      continue;
    }

    // Pontuação
    const start = i;
    tokens.push({ type: 'PUNCT', value: ch, start, end: i + 1 });
    i++;
  }

  return tokens;
}

/**
 * Normaliza o corpo de um item para comparação.
 * Remove comentários, colapsa espaços e remove vírgulas finais antes de ), ] ou }.
 *
 * @param {string} rawCode
 * @returns {string}
 */
export function normalizeBody(rawCode) {
  const tokens = tokenizeRust(rawCode);
  
  // Filtra comentários e espaços
  const filtered = tokens.filter(t => t.type !== 'COMMENT' && t.type !== 'WS');
  if (filtered.length === 0) return '';

  // Identifica e remove o prefixo de visibilidade do cabeçalho do item para comparar o corpo
  // (a visibilidade é comparada separadamente)
  let startIdx = 0;
  // Avança atributos iniciais #[...]
  while (startIdx < filtered.length && filtered[startIdx].value === '#') {
    startIdx++;
    if (startIdx < filtered.length && filtered[startIdx].value === '[') {
      let bracketDepth = 1;
      startIdx++;
      while (startIdx < filtered.length && bracketDepth > 0) {
        if (filtered[startIdx].value === '[') bracketDepth++;
        else if (filtered[startIdx].value === ']') bracketDepth--;
        startIdx++;
      }
    }
  }

  // Se houver modificador de visibilidade (pub, pub(crate), pub(super), pub(in ...))
  if (startIdx < filtered.length && filtered[startIdx].value === 'pub') {
    startIdx++;
    if (startIdx < filtered.length && filtered[startIdx].value === '(') {
      let parenDepth = 1;
      startIdx++;
      while (startIdx < filtered.length && parenDepth > 0) {
        if (filtered[startIdx].value === '(') parenDepth++;
        else if (filtered[startIdx].value === ')') parenDepth--;
        startIdx++;
      }
    }
  }

  // Reconstrói a lista de tokens sem a visibilidade do topo
  const bodyTokens = [...filtered.slice(0, startIdx < filtered.length && filtered[0].value === '#' ? startIdx - (filtered.slice(0, startIdx).filter(t => t.value === 'pub' || t.value === '(' || t.value === ')').length) : 0), ...filtered.slice(startIdx)];
  
  // Rejunta com espaço simples
  let str = bodyTokens.map(t => t.value).join(' ');

  // Remove vírgulas finais antes de ), ] ou } repetidamente
  let prevStr = '';
  while (str !== prevStr) {
    prevStr = str;
    str = str.replace(/,\s*([\}\]\)])/g, '$1');
  }

  return str.trim();
}

/**
 * Extrai os itens de topo de um arquivo Rust.
 *
 * @param {string} code
 * @param {string} filePath
 * @returns {{ items: Map<string, { key: string, body: string, normalizedBody: string, vis: string, file: string }>, pubUses: Array<{ text: string, file: string }>, poolCount: number }}
 */
export function extractRustItems(rawCode, filePath) {
  const code = rawCode.replace(/\r\n/g, '\n');
  const items = new Map();
  const pubUses = [];
  const poolMatches = code.match(/state\.pool/g);
  const poolCount = poolMatches ? poolMatches.length : 0;

  const tokens = tokenizeRust(code);
  const nonWs = tokens.filter(t => t.type !== 'WS');

  let i = 0;
  const len = nonWs.length;

  let braceDepth = 0;
  let inTestMod = false;
  let testModDepth = -1;

  while (i < len) {
    const token = nonWs[i];

    // Atualiza profundidade se for pontuação isolada fora de item
    if (token.value === '{') {
      braceDepth++;
      i++;
      continue;
    } else if (token.value === '}') {
      if (inTestMod && braceDepth === testModDepth) {
        inTestMod = false;
        testModDepth = -1;
      }
      braceDepth--;
      i++;
      continue;
    }

    // Coleta de atributos #[...] antes do item
    const attrStartTokenIdx = i;
    const itemAttrs = [];

    while (i < len && nonWs[i].value === '#') {
      const attrStart = nonWs[i].start;
      i++; // pula '#'
      if (i < len && nonWs[i].value === '[') {
        let bracketDepth = 1;
        i++; // pula '['
        while (i < len && bracketDepth > 0) {
          if (nonWs[i].value === '[') bracketDepth++;
          else if (nonWs[i].value === ']') bracketDepth--;
          i++;
        }
        const attrEnd = nonWs[i - 1].end;
        itemAttrs.push(code.slice(attrStart, attrEnd));
      }
    }

    if (i >= len) break;

    const itemStartTokenIdx = i;
    const firstTok = nonWs[i];

    // Trata visibilidade (pub, pub(crate), pub(super), pub(in ...))
    let vis = 'private';
    let visEndTokenIdx = i;
    if (nonWs[i].value === 'pub') {
      vis = 'pub';
      i++; // pula 'pub'
      if (i < len && nonWs[i].value === '(') {
        let parenDepth = 1;
        let visPath = '';
        i++; // pula '('
        while (i < len && parenDepth > 0) {
          if (nonWs[i].value === '(') parenDepth++;
          else if (nonWs[i].value === ')') parenDepth--;
          else visPath += nonWs[i].value;
          i++;
        }
        vis = `pub(${visPath.trim()})`;
      }
      visEndTokenIdx = i;
    }

    if (i >= len) break;

    // Modificadores extras como async, unsafe, extern
    while (i < len && (nonWs[i].value === 'async' || nonWs[i].value === 'unsafe' || nonWs[i].value === 'extern')) {
      i++;
    }

    if (i >= len) break;

    const kwTok = nonWs[i];
    const kw = kwTok.value;

    // Declarações use / pub use
    if (kw === 'use') {
      const uStart = nonWs[attrStartTokenIdx].start;
      while (i < len && nonWs[i].value !== ';') {
        i++;
      }
      if (i < len && nonWs[i].value === ';') i++;
      const uEnd = nonWs[i - 1].end;
      const useStmt = code.slice(uStart, uEnd).trim();
      if (vis.startsWith('pub')) {
        pubUses.push({ text: useStmt, file: filePath });
      }
      continue;
    }

    // Módulo mod ...
    if (kw === 'mod') {
      i++; // pula 'mod'
      const modName = i < len ? nonWs[i].value : '';
      const isTestMod = itemAttrs.some(a => a.includes('cfg(test)')) || modName === 'tests';

      while (i < len && nonWs[i].value !== ';' && nonWs[i].value !== '{') {
        i++;
      }
      if (i < len && nonWs[i].value === ';') {
        i++; // mod <nome>;
        continue;
      }
      if (i < len && nonWs[i].value === '{') {
        braceDepth++;
        i++;
        if (isTestMod) {
          inTestMod = true;
          testModDepth = braceDepth;
        }
        continue;
      }
    }

    // Bloco impl
    if (kw === 'impl') {
      const implStartIdx = nonWs[attrStartTokenIdx].start;
      i++; // pula 'impl'
      let implHeaderTokens = [];
      while (i < len && nonWs[i].value !== '{') {
        implHeaderTokens.push(nonWs[i].value);
        i++;
      }
      const implHeader = 'impl ' + implHeaderTokens.join(' ').replace(/\s*<\s*/g, '<').replace(/\s*>\s*/g, '>').replace(/\s*::\s*/g, '::');
      
      if (i < len && nonWs[i].value === '{') {
        const implDepth = braceDepth + 1;
        braceDepth++;
        i++; // pula '{' do impl

        // Varre itens dentro do impl at implDepth
        while (i < len && braceDepth >= implDepth) {
          if (nonWs[i].value === '}') {
            braceDepth--;
            i++;
            if (braceDepth < implDepth) break;
            continue;
          }

          // Atributos de método/item no impl
          const methodAttrStartIdx = i;
          while (i < len && nonWs[i].value === '#') {
            i++;
            if (i < len && nonWs[i].value === '[') {
              let bDepth = 1;
              i++;
              while (i < len && bDepth > 0) {
                if (nonWs[i].value === '[') bDepth++;
                else if (nonWs[i].value === ']') bDepth--;
                i++;
              }
            }
          }
          if (i >= len || braceDepth < implDepth) break;

          let methodVis = 'private';
          if (nonWs[i].value === 'pub') {
            methodVis = 'pub';
            i++;
            if (i < len && nonWs[i].value === '(') {
              let pDepth = 1;
              let vPath = '';
              i++;
              while (i < len && pDepth > 0) {
                if (nonWs[i].value === '(') pDepth++;
                else if (nonWs[i].value === ')') pDepth--;
                else vPath += nonWs[i].value;
                i++;
              }
              methodVis = `pub(${vPath.trim()})`;
            }
          }

          while (i < len && (nonWs[i].value === 'async' || nonWs[i].value === 'unsafe' || nonWs[i].value === 'const')) {
            i++;
          }
          if (i >= len || braceDepth < implDepth) break;

          const methodKw = nonWs[i].value;
          if (methodKw === 'fn' || methodKw === 'const' || methodKw === 'type') {
            const mStart = nonWs[methodAttrStartIdx].start;
            i++; // pula kw
            const itemName = i < len ? nonWs[i].value : 'unnamed';

            // Coleta até fechar o bloco do método ou ';'
            let mBraceDepth = 0;
            let startedBrace = false;
            while (i < len) {
              if (nonWs[i].value === '{') {
                mBraceDepth++;
                startedBrace = true;
              } else if (nonWs[i].value === '}') {
                mBraceDepth--;
                if (startedBrace && mBraceDepth === 0) {
                  i++;
                  break;
                }
              } else if (nonWs[i].value === ';' && !startedBrace && mBraceDepth === 0) {
                i++;
                break;
              }
              i++;
            }
            const mEnd = nonWs[i - 1].end;
            const itemCode = code.slice(mStart, mEnd);
            const key = `${implHeader}::${itemName}`;

            items.set(key, {
              key,
              body: itemCode,
              normalizedBody: normalizeBody(itemCode),
              vis: methodVis,
              file: filePath,
            });
          } else {
            i++;
          }
        }
      }
      continue;
    }

    // Itens de topo: fn, struct, enum, const, static, type, trait, macro_rules
    if (['fn', 'struct', 'enum', 'const', 'static', 'type', 'trait', 'macro_rules'].includes(kw)) {
      const itemStart = nonWs[attrStartTokenIdx].start;
      i++; // pula kw
      if (kw === 'macro_rules' && i < len && nonWs[i].value === '!') {
        i++; // pula '!' de macro_rules!
      }
      const name = i < len ? nonWs[i].value : 'unnamed';

      let itemBraceDepth = 0;
      let startedBrace = false;

      while (i < len) {
        if (nonWs[i].value === '{') {
          itemBraceDepth++;
          startedBrace = true;
        } else if (nonWs[i].value === '}') {
          itemBraceDepth--;
          if (startedBrace && itemBraceDepth === 0) {
            i++;
            break;
          }
        } else if (nonWs[i].value === ';' && !startedBrace && itemBraceDepth === 0) {
          i++;
          break;
        }
        i++;
      }

      const itemEnd = nonWs[i - 1].end;
      const itemCode = code.slice(itemStart, itemEnd);

      let key = `${kw} ${name}`;
      if (kw === 'macro_rules') key = `macro_rules! ${name}`;
      if (inTestMod && kw === 'fn') key = `tests::${name}`;

      items.set(key, {
        key,
        body: itemCode,
        normalizedBody: normalizeBody(itemCode),
        vis,
        file: filePath,
      });
      continue;
    }

    // Se nenhum item foi reconhecido, avança o token
    i++;
  }

  return { items, pubUses, poolCount };
}

/**
 * Extrai as chamadas de rota de backend/src/routes.rs.
 *
 * @param {string} routesCode
 * @returns {string[]}
 */
export function extractRoutes(routesCode) {
  const routes = [];
  let pos = 0;

  while ((pos = routesCode.indexOf('.route(', pos)) !== -1) {
    const start = pos + 7;
    let depth = 1;
    let i = start;
    let inString = false;
    let stringChar = '';

    while (i < routesCode.length && depth > 0) {
      const ch = routesCode[i];
      if (inString) {
        if (ch === '\\') i++;
        else if (ch === stringChar) inString = false;
      } else if (ch === '"' || ch === '\'') {
        inString = true;
        stringChar = ch;
      } else if (ch === '(') {
        depth++;
      } else if (ch === ')') {
        depth--;
      }
      i++;
    }

    const inside = routesCode.slice(start, i - 1);
    pos = i;

    // Separa o primeiro argumento (path) dos handlers pelo primeiro vírgula fora de sub-parênteses
    let commaIdx = -1;
    let pDepth = 0;
    let sIn = false;
    let sChar = '';

    for (let k = 0; k < inside.length; k++) {
      const c = inside[k];
      if (sIn) {
        if (c === '\\') k++;
        else if (c === sChar) sIn = false;
      } else if (c === '"' || c === '\'') {
        sIn = true;
        sChar = c;
      } else if (c === '(' || c === '{' || c === '[') {
        pDepth++;
      } else if (c === ')' || c === '}' || c === ']') {
        pDepth--;
      } else if (c === ',' && pDepth === 0) {
        commaIdx = k;
        break;
      }
    }

    if (commaIdx === -1) continue;

    const rawPath = inside.slice(0, commaIdx).trim();
    const rawHandlers = inside.slice(commaIdx + 1).trim();

    const pathMatch = rawPath.match(/^"([^"]+)"$/);
    const pathStr = pathMatch ? pathMatch[1] : rawPath;

    const methodRegex = /\b(get|post|put|delete|patch|head|options|trace)\s*\(\s*([^()]+?)\s*\)/gi;
    let m;
    while ((m = methodRegex.exec(rawHandlers)) !== null) {
      const httpMethod = m[1].toUpperCase();
      const rawHandler = m[2].trim();
      const handlerName = rawHandler.includes('::') ? rawHandler.split('::').pop().trim() : rawHandler;
      routes.push(`${httpMethod} ${pathStr} -> ${handlerName}`);
    }
  }

  return routes.sort();
}

/**
 * Classifica a visibilidade para comparação de alargamento / redução.
 * @param {string} vis
 * @returns {number}
 */
function visRank(vis) {
  if (vis === 'pub') return 3;
  if (vis === 'pub(crate)') return 2;
  if (vis === 'pub(super)') return 1;
  return 0; // private ou pub(in path)
}

/**
 * Compara a base e a working tree de arquivos Rust do backend.
 *
 * @param {Map<string, string>} baseFilesMap
 * @param {Map<string, string>} currentFilesMap
 * @param {string} [baseRoutesCode]
 * @param {string} [currentRoutesCode]
 * @returns {{ success: boolean, failures: string[], summary: { totalItems: number, movedItems: string[], visibilityChanges: string[], newPubUses: string[], poolCount: number, warnings: string[] } }}
 */
export function compareRustCodebase(baseFilesMap, currentFilesMap, baseRoutesCode, currentRoutesCode) {
  const failures = [];
  const movedItems = [];
  const visibilityChanges = [];
  const newPubUses = [];
  const warnings = [];

  const baseAllItems = new Map();
  const basePubUses = new Set();
  let baseTotalPool = 0;

  for (const [file, code] of baseFilesMap.entries()) {
    const { items, pubUses, poolCount } = extractRustItems(code, file);
    baseTotalPool += poolCount;
    for (const pu of pubUses) basePubUses.add(pu.text);
    for (const [key, item] of items.entries()) {
      baseAllItems.set(key, item);
    }
  }

  const currentAllItemsMap = new Map();
  let currentTotalPool = 0;

  for (const [file, code] of currentFilesMap.entries()) {
    const { items, pubUses, poolCount } = extractRustItems(code, file);
    currentTotalPool += poolCount;

    for (const pu of pubUses) {
      if (!basePubUses.has(pu.text)) {
        newPubUses.push(`Novo pub use: ${pu.text} em ${file}`);
      }
    }

    // Checa tamanho do arquivo novo (> 700 linhas)
    if (!baseFilesMap.has(file)) {
      const lineCount = code.split('\n').length;
      if (lineCount > 700) {
        warnings.push(`AVISO: Arquivo novo ${file} possui ${lineCount} linhas (> 700)`);
      }
    }

    for (const [key, item] of items.entries()) {
      if (!currentAllItemsMap.has(key)) {
        currentAllItemsMap.set(key, []);
      }
      currentAllItemsMap.get(key).push(item);
    }
  }

  // 1. Checa itens duplicados nos arquivos novos
  for (const [key, list] of currentAllItemsMap.entries()) {
    if (list.length > 1) {
      failures.push(`Item duplicado: ${key} em ${list.map(x => x.file).join(', ')}`);
    }
  }

  // 2. Checa itens removidos da base
  for (const [key, baseItem] of baseAllItems.entries()) {
    if (!currentAllItemsMap.has(key)) {
      failures.push(`Item removido: ${key} (estava em ${baseItem.file})`);
    }
  }

  // 3. Checa itens adicionados
  for (const [key, list] of currentAllItemsMap.entries()) {
    if (!baseAllItems.has(key)) {
      failures.push(`Item adicionado: ${key} (em ${list[0].file})`);
    }
  }

  // 4. Checa modificações de corpo, visibilidade e movimentos
  for (const [key, baseItem] of baseAllItems.entries()) {
    const currentList = currentAllItemsMap.get(key);
    if (!currentList || currentList.length !== 1) continue;

    const currentItem = currentList[0];

    // Corpo modificado
    if (baseItem.normalizedBody !== currentItem.normalizedBody) {
      failures.push(`Item modificado: ${key}`);
    }

    // Visibilidade
    const baseRank = visRank(baseItem.vis);
    const currRank = visRank(currentItem.vis);

    if (currRank < baseRank) {
      failures.push(`Visibilidade reduzida: ${key} era ${baseItem.vis} e virou ${currentItem.vis}`);
    } else if (currRank > baseRank) {
      visibilityChanges.push(`Visibilidade ampliada: ${key} (${baseItem.vis} -> ${currentItem.vis})`);
    }

    // Movimento de arquivo
    if (baseItem.file !== currentItem.file) {
      movedItems.push(`Movido: ${key} (de ${baseItem.file} para ${currentItem.file})`);
    }
  }

  // 5. Checa state.pool
  if (baseTotalPool !== currentTotalPool) {
    failures.push(`Contagem de state.pool alterada: era ${baseTotalPool}, agora é ${currentTotalPool}`);
  }

  // 6. Checa rotas se fornecidas
  if (baseRoutesCode !== undefined && currentRoutesCode !== undefined) {
    const baseRoutes = extractRoutes(baseRoutesCode);
    const currentRoutes = extractRoutes(currentRoutesCode);

    const baseSet = new Set(baseRoutes);
    const currSet = new Set(currentRoutes);

    for (const r of baseRoutes) {
      if (!currSet.has(r)) {
        failures.push(`Rota removida ou alterada em routes.rs: ${r}`);
      }
    }
    for (const r of currentRoutes) {
      if (!baseSet.has(r)) {
        failures.push(`Rota adicionada ou alterada em routes.rs: ${r}`);
      }
    }
  }

  const success = failures.length === 0;

  return {
    success,
    failures,
    summary: {
      totalItems: baseAllItems.size,
      movedItems,
      visibilityChanges,
      newPubUses,
      poolCount: currentTotalPool,
      warnings,
    },
  };
}

/**
 * Execução CLI
 */
function runCli() {
  const args = process.argv.slice(2);
  let baseRef = null;
  let area = null;

  for (let idx = 0; idx < args.length; idx++) {
    if (args[idx] === '--base' && idx + 1 < args.length) {
      baseRef = args[idx + 1];
      idx++;
    } else if (args[idx] === '--area' && idx + 1 < args.length) {
      area = args[idx + 1];
      idx++;
    }
  }

  if (!baseRef) {
    console.error('Uso: node scripts/check-refactor-move-rust.mjs --base <ref> [--area <nome>]');
    process.exit(1);
  }

  const rootDir = process.cwd();
  const handlersDir = path.posix.join('backend', 'src', 'handlers');

  function gitExec(gitArgs) {
    return execFileSync('git', gitArgs, { cwd: rootDir, encoding: 'utf8', shell: false }).trim();
  }

  // Obtém lista de arquivos na base
  let baseFileListRaw = '';
  try {
    baseFileListRaw = gitExec(['ls-tree', '-r', '--name-only', baseRef, handlersDir]);
  } catch (err) {
    console.error(`Erro ao listar arquivos da base '${baseRef}':`, err.message);
    process.exit(1);
  }

  const baseFiles = baseFileListRaw
    .split('\n')
    .map(f => f.trim().replace(/\\/g, '/'))
    .filter(f => f.endsWith('.rs'))
    .filter(f => {
      if (!area) return true;
      return f === `backend/src/handlers/${area}.rs` || f.startsWith(`backend/src/handlers/${area}/`);
    });

  const baseFilesMap = new Map();
  for (const posixPath of baseFiles) {
    try {
      const content = gitExec(['show', `${baseRef}:${posixPath}`]);
      baseFilesMap.set(posixPath, content);
    } catch (err) {
      console.error(`Erro ao ler arquivo da base ${posixPath}:`, err.message);
      process.exit(1);
    }
  }

  // Obtém lista de arquivos na working tree atual
  function scanDir(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(scanDir(fullPath));
      } else if (file.endsWith('.rs')) {
        results.push(fullPath.replace(/\\/g, '/'));
      }
    }
    return results;
  }

  const currentFiles = scanDir(handlersDir).filter(f => {
    if (!area) return true;
    return f === `backend/src/handlers/${area}.rs` || f.startsWith(`backend/src/handlers/${area}/`);
  });

  const currentFilesMap = new Map();
  for (const posixPath of currentFiles) {
    const content = fs.readFileSync(posixPath, 'utf8');
    currentFilesMap.set(posixPath, content);
  }

  // Lê routes.rs na base e atual
  let baseRoutesCode = '';
  let currentRoutesCode = '';
  const routesPath = 'backend/src/routes.rs';

  try {
    baseRoutesCode = gitExec(['show', `${baseRef}:${routesPath}`]);
  } catch (e) {
    baseRoutesCode = '';
  }

  if (fs.existsSync(routesPath)) {
    currentRoutesCode = fs.readFileSync(routesPath, 'utf8');
  }

  const result = compareRustCodebase(baseFilesMap, currentFilesMap, baseRoutesCode, currentRoutesCode);

  if (!result.success) {
    console.error('❌ Refactor move Rust FALHOU. Modificações não permitidas encontradas:');
    for (const f of result.failures) {
      console.error(`  - ${f}`);
    }
    process.exit(1);
  }

  console.log('✅ Verificação de refactor move Rust passou com SUCESSO!');
  console.log(`- Total de itens verificados: ${result.summary.totalItems}`);
  console.log(`- Contagem de state.pool em handlers/: ${result.summary.poolCount}`);

  if (result.summary.movedItems.length > 0) {
    console.log(`- Itens movidos (${result.summary.movedItems.length}):`);
    for (const m of result.summary.movedItems) console.log(`  - ${m}`);
  }

  if (result.summary.visibilityChanges.length > 0) {
    console.log(`- Mudanças de visibilidade (${result.summary.visibilityChanges.length}):`);
    for (const v of result.summary.visibilityChanges) console.log(`  - ${v}`);
  }

  if (result.summary.newPubUses.length > 0) {
    console.log(`- Novos pub use (${result.summary.newPubUses.length}):`);
    for (const pu of result.summary.newPubUses) console.log(`  - ${pu}`);
  }

  if (result.summary.warnings.length > 0) {
    for (const w of result.summary.warnings) console.log(`- ${w}`);
  }

  process.exit(0);
}

// Se executado diretamente pela CLI
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runCli();
}
