import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenizeRust,
  normalizeBody,
  extractRustItems,
  extractRoutes,
  compareRustCodebase,
} from './check-refactor-move-rust.mjs';

test('(a) Mover função entre arquivos -> passa', () => {
  const baseFilesMap = new Map([
    ['backend/src/handlers/nutricao.rs', 'pub fn fn_a() { 1 + 1 } pub fn fn_b() { 2 + 2 }'],
  ]);
  const currentFilesMap = new Map([
    ['backend/src/handlers/nutricao/mod.rs', 'pub fn fn_a() { 1 + 1 }'],
    ['backend/src/handlers/nutricao/sub.rs', 'pub fn fn_b() { 2 + 2 }'],
  ]);

  const res = compareRustCodebase(baseFilesMap, currentFilesMap);
  assert.equal(res.success, true);
  assert.equal(res.failures.length, 0);
  assert.equal(res.summary.movedItems.length, 2);
});

test('(b) Alterar uma linha do corpo -> falha', () => {
  const baseFilesMap = new Map([
    ['backend/src/handlers/nutricao.rs', 'pub fn fn_a() { let x = 1; }'],
  ]);
  const currentFilesMap = new Map([
    ['backend/src/handlers/nutricao.rs', 'pub fn fn_a() { let x = 2; }'],
  ]);

  const res = compareRustCodebase(baseFilesMap, currentFilesMap);
  assert.equal(res.success, false);
  assert.ok(res.failures.some(f => f.includes('Item modificado: fn fn_a')));
});

test('(c) Apagar função -> falha', () => {
  const baseFilesMap = new Map([
    ['backend/src/handlers/nutricao.rs', 'pub fn fn_a() {} pub fn fn_b() {}'],
  ]);
  const currentFilesMap = new Map([
    ['backend/src/handlers/nutricao.rs', 'pub fn fn_a() {}'],
  ]);

  const res = compareRustCodebase(baseFilesMap, currentFilesMap);
  assert.equal(res.success, false);
  assert.ok(res.failures.some(f => f.includes('Item removido: fn fn_b')));
});

test('(d) Adicionar função -> falha', () => {
  const baseFilesMap = new Map([
    ['backend/src/handlers/nutricao.rs', 'pub fn fn_a() {}'],
  ]);
  const currentFilesMap = new Map([
    ['backend/src/handlers/nutricao.rs', 'pub fn fn_a() {} pub fn fn_c() {}'],
  ]);

  const res = compareRustCodebase(baseFilesMap, currentFilesMap);
  assert.equal(res.success, false);
  assert.ok(res.failures.some(f => f.includes('Item adicionado: fn fn_c')));
});

test('(e) Duplicar função em dois arquivos -> falha', () => {
  const baseFilesMap = new Map([
    ['backend/src/handlers/nutricao.rs', 'pub fn fn_a() { 1 }'],
  ]);
  const currentFilesMap = new Map([
    ['backend/src/handlers/nutricao/mod.rs', 'pub fn fn_a() { 1 }'],
    ['backend/src/handlers/nutricao/sub.rs', 'pub fn fn_a() { 1 }'],
  ]);

  const res = compareRustCodebase(baseFilesMap, currentFilesMap);
  assert.equal(res.success, false);
  assert.ok(res.failures.some(f => f.includes('Item duplicado: fn fn_a')));
});

test('(f) Mudar #[derive] -> falha', () => {
  const baseFilesMap = new Map([
    ['backend/src/handlers/nutricao.rs', '#[derive(Debug)] pub struct Prato { id: u64 }'],
  ]);
  const currentFilesMap = new Map([
    ['backend/src/handlers/nutricao.rs', '#[derive(Debug, Clone)] pub struct Prato { id: u64 }'],
  ]);

  const res = compareRustCodebase(baseFilesMap, currentFilesMap);
  assert.equal(res.success, false);
  assert.ok(res.failures.some(f => f.includes('Item modificado: struct Prato')));
});

test('(g) Só comentário/espaço/quebra de linha mudou -> passa', () => {
  const baseFilesMap = new Map([
    [
      'backend/src/handlers/nutricao.rs',
      '/// Doc prato\npub async fn criar_prato(\n    nome: String,\n) -> Result<()> {\n    // linha comment\n    Ok(())\n}',
    ],
  ]);
  const currentFilesMap = new Map([
    [
      'backend/src/handlers/nutricao.rs',
      '/* Outro comentário */\npub  async  fn  criar_prato(nome: String) -> Result<()> {\n    Ok(())\n}',
    ],
  ]);

  const res = compareRustCodebase(baseFilesMap, currentFilesMap);
  assert.equal(res.success, true);
  assert.equal(res.failures.length, 0);
});

test('(h) } ou // dentro de string, raw string r#"}"#, char \'}\' e lifetime \'a não quebram extração', () => {
  const code = `
    pub fn complexa<'a>(s: &'a str) -> &'a str {
      let string_with_brace = "hello } world // not comment";
      let raw_string = r#"raw } content // here"#;
      let char_brace = '}';
      let escaped_char = '\\'';
      s
    }
  `;

  const { items } = extractRustItems(code, 'complex.rs');
  assert.ok(items.has('fn complexa'));
  const item = items.get('fn complexa');
  assert.ok(item.body.includes('char_brace'));

  const baseFilesMap = new Map([['backend/src/handlers/complex.rs', code]]);
  const currentFilesMap = new Map([['backend/src/handlers/sub/complex.rs', code]]);
  const res = compareRustCodebase(baseFilesMap, currentFilesMap);
  assert.equal(res.success, true);
});

test('(i) impl dividido em dois arquivos -> passa', () => {
  const baseFilesMap = new Map([
    [
      'backend/src/handlers/nutricao.rs',
      'impl CardapioHandler {\n  pub fn m1() { 1 }\n  pub fn m2() { 2 }\n}',
    ],
  ]);
  const currentFilesMap = new Map([
    ['backend/src/handlers/nutricao/mod.rs', 'impl CardapioHandler {\n  pub fn m1() { 1 }\n}'],
    ['backend/src/handlers/nutricao/sub.rs', 'impl CardapioHandler {\n  pub fn m2() { 2 }\n}'],
  ]);

  const res = compareRustCodebase(baseFilesMap, currentFilesMap);
  assert.equal(res.success, true);
  assert.equal(res.summary.movedItems.length, 2);
});

test('(j) Teste #[cfg(test)] movido -> passa, teste alterado -> falha', () => {
  const baseCode = `
    #[cfg(test)]
    mod tests {
      #[test]
      fn test_nutricao() {
        assert_eq!(1, 1);
      }
    }
  `;

  const movedCode = `
    #[cfg(test)]
    mod tests {
      #[test]
      fn test_nutricao() {
        assert_eq!(1, 1);
      }
    }
  `;

  const alteredCode = `
    #[cfg(test)]
    mod tests {
      #[test]
      fn test_nutricao() {
        assert_eq!(1, 2);
      }
    }
  `;

  // Movido para subarquivo -> passa
  const baseMap = new Map([['backend/src/handlers/nutricao.rs', baseCode]]);
  const movedMap = new Map([['backend/src/handlers/nutricao/tests.rs', movedCode]]);
  const resMoved = compareRustCodebase(baseMap, movedMap);
  assert.equal(resMoved.success, true);

  // Alterado -> falha
  const alteredMap = new Map([['backend/src/handlers/nutricao.rs', alteredCode]]);
  const resAltered = compareRustCodebase(baseMap, alteredMap);
  assert.equal(resAltered.success, false);
  assert.ok(resAltered.failures.some(f => f.includes('Item modificado: tests::test_nutricao')));
});

test('(k) Alargar visibilidade -> passa e é listado, reduzir pub -> falha', () => {
  const baseFilesMap = new Map([
    [
      'backend/src/handlers/nutricao.rs',
      'fn fn_priv() { 1 }\npub fn fn_pub() { 2 }',
    ],
  ]);

  // Alargar de private para pub(crate) -> passa
  const widenedMap = new Map([
    [
      'backend/src/handlers/nutricao.rs',
      'pub(crate) fn fn_priv() { 1 }\npub fn fn_pub() { 2 }',
    ],
  ]);
  const resWidened = compareRustCodebase(baseFilesMap, widenedMap);
  assert.equal(resWidened.success, true);
  assert.ok(resWidened.summary.visibilityChanges.some(v => v.includes('fn fn_priv (private -> pub(crate))')));

  // Reduzir pub para pub(crate) -> falha
  const reducedMap = new Map([
    [
      'backend/src/handlers/nutricao.rs',
      'fn fn_priv() { 1 }\npub(crate) fn fn_pub() { 2 }',
    ],
  ]);
  const resReduced = compareRustCodebase(baseFilesMap, reducedMap);
  assert.equal(resReduced.success, false);
  assert.ok(resReduced.failures.some(f => f.includes('Visibilidade reduzida: fn fn_pub era pub e virou pub(crate)')));
});

test('(l) Rota alterada em routes.rs -> falha, só prefixo de caminho do handler mudou -> passa', () => {
  const baseRoutes = `
    Router::new()
      .route("/nutricao/pratos", get(crate::handlers::nutricao::listar_pratos))
      .route("/nutricao/pratos/:id", put(atualizar_prato));
  `;

  // Só prefixo mudou -> passa
  const currentRoutesPrefixChanged = `
    Router::new()
      .route("/nutricao/pratos", get(crate::handlers::nutricao::sub::listar_pratos))
      .route("/nutricao/pratos/:id", put(atualizar_prato));
  `;
  const resPass = compareRustCodebase(new Map(), new Map(), baseRoutes, currentRoutesPrefixChanged);
  assert.equal(resPass.success, true);

  // Rota alterada (/nutricao/pratos -> /nutricao/pratos/todos) -> falha
  const currentRoutesPathChanged = `
    Router::new()
      .route("/nutricao/pratos/todos", get(crate::handlers::nutricao::listar_pratos))
      .route("/nutricao/pratos/:id", put(atualizar_prato));
  `;
  const resFail = compareRustCodebase(new Map(), new Map(), baseRoutes, currentRoutesPathChanged);
  assert.equal(resFail.success, false);
  assert.ok(resFail.failures.some(f => f.includes('Rota removida ou alterada em routes.rs')));
});

test('(m) state.pool introduzido numa função movida -> falha', () => {
  const baseFilesMap = new Map([
    ['backend/src/handlers/nutricao.rs', 'pub fn fn_a(state: AppState) { let x = 1; }'],
  ]);
  const currentFilesMap = new Map([
    ['backend/src/handlers/nutricao/sub.rs', 'pub fn fn_a(state: AppState) { let pool = &state.pool; }'],
  ]);

  const res = compareRustCodebase(baseFilesMap, currentFilesMap);
  assert.equal(res.success, false);
  assert.ok(res.failures.some(f => f.includes('Item modificado: fn fn_a')));
  assert.ok(res.failures.some(f => f.includes('Contagem de state.pool alterada')));
});

test('(n) mod.rs com pub use novo -> passa e é listado', () => {
  const baseFilesMap = new Map([
    ['backend/src/handlers/nutricao/mod.rs', 'pub use old_module::*;'],
  ]);
  const currentFilesMap = new Map([
    ['backend/src/handlers/nutricao/mod.rs', 'pub use old_module::*; pub use new_sub::*;'],
  ]);

  const res = compareRustCodebase(baseFilesMap, currentFilesMap);
  assert.equal(res.success, true);
  assert.ok(res.summary.newPubUses.some(pu => pu.includes('pub use new_sub::*;')));
});
