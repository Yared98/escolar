import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'child_process';
import { analyzeRefactorMove } from './check-refactor-move.mjs';

function createTempGitRepo() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-refactor-move-'));
  execSync('git init', { cwd: tempDir });
  execSync('git config user.name "Test User"', { cwd: tempDir });
  execSync('git config user.email "test@example.com"', { cwd: tempDir });

  // Criar estrutura frontend/src
  fs.mkdirSync(path.join(tempDir, 'frontend', 'src', 'components'), { recursive: true });

  return tempDir;
}

function cleanupTempGitRepo(tempDir) {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup errors on Windows
  }
}

test('Refactor Move Suite', async (t) => {

  await t.test('(a) mover um bloco JSX para um componente novo com props = 0 linhas novas', () => {
    const dir = createTempGitRepo();
    try {
      const compPath = path.join(dir, 'frontend', 'src', 'components', 'Section.tsx');
      fs.writeFileSync(compPath, `
export function Section() {
  return (
    <div>
      <h1>Titulo Principal</h1>
      <p>Conteudo do bloco que sera movido</p>
    </div>
  );
}
      `.trim());

      execSync('git add . && git commit -m "initial"', { cwd: dir });
      execSync('git branch base-ref', { cwd: dir });

      // Mover bloco para NovoComponente.tsx
      const subCompPath = path.join(dir, 'frontend', 'src', 'components', 'NovoComponente.tsx');
      fs.writeFileSync(subCompPath, `
export function NovoComponente() {
  return (
    <div>
      <h1>Titulo Principal</h1>
      <p>Conteudo do bloco que sera movido</p>
    </div>
  );
}
      `.trim());

      fs.writeFileSync(compPath, `
import { NovoComponente } from './NovoComponente';

export function Section() {
  return (
    <div>
      <NovoComponente />
    </div>
  );
}
      `.trim());

      const res = analyzeRefactorMove(dir, 'base-ref', 0);
      assert.equal(res.newLines.length, 0, 'Deveria ter 0 linhas novas');
      assert.equal(res.typeDivergences.length, 0, 'Deveria ter 0 divergencias de tipos');
      assert.equal(res.tabIds.missing.length, 0, 'Deveria ter 0 abas ausentes');
    } finally {
      cleanupTempGitRepo(dir);
    }
  });

  await t.test('(b) mudar um texto ou uma classe dentro do bloco movido = acusa 1 linha', () => {
    const dir = createTempGitRepo();
    try {
      const compPath = path.join(dir, 'frontend', 'src', 'components', 'Section.tsx');
      fs.writeFileSync(compPath, `
export function Section() {
  return (
    <div>
      <p className="text-red-500">Texto Original</p>
    </div>
  );
}
      `.trim());

      execSync('git add . && git commit -m "initial"', { cwd: dir });
      execSync('git branch base-ref', { cwd: dir });

      // Mover alterando o texto
      const subCompPath = path.join(dir, 'frontend', 'src', 'components', 'NovoComponente.tsx');
      fs.writeFileSync(subCompPath, `
export function NovoComponente() {
  return (
    <div>
      <p className="text-blue-500">Texto Alterado</p>
    </div>
  );
}
      `.trim());

      fs.writeFileSync(compPath, `
import { NovoComponente } from './NovoComponente';

export function Section() {
  return (
    <div>
      <NovoComponente />
    </div>
  );
}
      `.trim());

      const res = analyzeRefactorMove(dir, 'base-ref', 0);
      const foundText = res.newLines.some(l => l.line.includes('Texto Alterado') || l.line.includes('text-blue-500'));
      assert.equal(res.newLines.length >= 1, true, 'Deveria acusar pelo menos 1 linha nova');
      assert.equal(foundText, true, 'Deveria conter a linha com o texto/classe alterado');
    } finally {
      cleanupTempGitRepo(dir);
    }
  });

  await t.test('(c) renomear um campo de interface = acusa tipo divergente', () => {
    const dir = createTempGitRepo();
    try {
      const typesPath = path.join(dir, 'frontend', 'src', 'types.ts');
      fs.writeFileSync(typesPath, `
export interface Usuario {
  id: string;
  nomeCompleto: string;
}
      `.trim());

      execSync('git add . && git commit -m "initial"', { cwd: dir });
      execSync('git branch base-ref', { cwd: dir });

      // Modificar nomeCompleto para nome
      fs.writeFileSync(typesPath, `
export interface Usuario {
  id: string;
  nome: string;
}
      `.trim());

      const res = analyzeRefactorMove(dir, 'base-ref', 0);
      assert.equal(res.typeDivergences.length, 1, 'Deveria acusar 1 tipo divergente');
      assert.equal(res.typeDivergences[0].name, 'Usuario');
    } finally {
      cleanupTempGitRepo(dir);
    }
  });

  await t.test('(d) trocar \'portal_rotina\' por \'portal_diario\' = acusa id de aba', () => {
    const dir = createTempGitRepo();
    try {
      const compPath = path.join(dir, 'frontend', 'src', 'components', 'Portal.tsx');
      fs.writeFileSync(compPath, `
export function Portal({ activeTab }) {
  if (activeTab === 'portal_rotina') {
    return <div>Rotina</div>;
  }
  return null;
}
      `.trim());

      execSync('git add . && git commit -m "initial"', { cwd: dir });
      execSync('git branch base-ref', { cwd: dir });

      // Trocar portal_rotina por portal_diario
      fs.writeFileSync(compPath, `
export function Portal({ activeTab }) {
  if (activeTab === 'portal_diario') {
    return <div>Rotina</div>;
  }
  return null;
}
      `.trim());

      const res = analyzeRefactorMove(dir, 'base-ref', 0);
      assert.deepEqual(res.tabIds.missing, ['portal_rotina']);
      assert.deepEqual(res.tabIds.added, ['portal_diario']);
    } finally {
      cleanupTempGitRepo(dir);
    }
  });

  await t.test('(e) chamada apiFetch com URL alterada = acusa linha nova', () => {
    const dir = createTempGitRepo();
    try {
      const compPath = path.join(dir, 'frontend', 'src', 'components', 'Api.tsx');
      fs.writeFileSync(compPath, `
export async function carregarDados() {
  const res = await apiFetch('/api/v1/alunos');
  return res;
}
      `.trim());

      execSync('git add . && git commit -m "initial"', { cwd: dir });
      execSync('git branch base-ref', { cwd: dir });

      // Alterar URL da chamada apiFetch
      fs.writeFileSync(compPath, `
export async function carregarDados() {
  const res = await apiFetch('/api/v1/alunos/detalhes');
  return res;
}
      `.trim());

      const res = analyzeRefactorMove(dir, 'base-ref', 0);
      assert.equal(res.newLines.length, 1, 'Deveria acusar 1 linha nova');
      assert.match(res.newLines[0].line, /\/api\/v1\/alunos\/detalhes/);
    } finally {
      cleanupTempGitRepo(dir);
    }
  });

  await t.test('(f) mover helper com export adicionado = 0 linhas novas', () => {
    const dir = createTempGitRepo();
    try {
      const helperPath = path.join(dir, 'frontend', 'src', 'utils.ts');
      fs.writeFileSync(helperPath, `
const rotuloCanal = (tipo: string) => {
  return tipo === 'escola' ? 'Escola' : 'Outro';
};
      `.trim());

      execSync('git add . && git commit -m "initial"', { cwd: dir });
      execSync('git branch base-ref', { cwd: dir });

      // Adicionar export ao helper
      fs.writeFileSync(helperPath, `
export const rotuloCanal = (tipo: string) => {
  return tipo === 'escola' ? 'Escola' : 'Outro';
};
      `.trim());

      const res = analyzeRefactorMove(dir, 'base-ref', 0);
      assert.equal(res.newLines.length, 0, 'Deveria ter 0 linhas novas ao adicionar export');
    } finally {
      cleanupTempGitRepo(dir);
    }
  });

  await t.test('(g) mesmo nome de interface com corpos diferentes em dois arquivos, ambos sem mudança = sem divergência', () => {
    const dir = createTempGitRepo();
    try {
      const file1Path = path.join(dir, 'frontend', 'src', 'mod1.ts');
      const file2Path = path.join(dir, 'frontend', 'src', 'mod2.ts');

      fs.writeFileSync(file1Path, `
export interface TurmaOpcao {
  id: string;
  nome: string;
}
      `.trim());

      fs.writeFileSync(file2Path, `
export interface TurmaOpcao {
  id: string;
  codigo: string;
  descricao: string;
}
      `.trim());

      execSync('git add . && git commit -m "initial"', { cwd: dir });
      execSync('git branch base-ref', { cwd: dir });

      // Mover mod2.ts de lugar sem alterar conteudo
      const newFile2Path = path.join(dir, 'frontend', 'src', 'sub', 'mod2.ts');
      fs.mkdirSync(path.join(dir, 'frontend', 'src', 'sub'), { recursive: true });
      fs.unlinkSync(file2Path);
      fs.writeFileSync(newFile2Path, `
export interface TurmaOpcao {
  id: string;
  codigo: string;
  descricao: string;
}
      `.trim());

      const res = analyzeRefactorMove(dir, 'base-ref', 0);
      assert.equal(res.typeDivergences.length, 0, 'Deveria ter 0 divergencias de tipos');
    } finally {
      cleanupTempGitRepo(dir);
    }
  });

  await t.test('(h) extração realista com props multilinha + interface de props + desestruturação multilinha = 0 linhas novas e 0 divergências', () => {
    const dir = createTempGitRepo();
    try {
      const compPath = path.join(dir, 'frontend', 'src', 'components', 'AgendaDigitalSection.tsx');
      fs.writeFileSync(compPath, `
export function AgendaDigitalSection() {
  const busca = '';
  return (
    <div>
      <p>Resultado da busca: {busca}</p>
    </div>
  );
}
      `.trim());

      execSync('git add . && git commit -m "initial"', { cwd: dir });
      execSync('git branch base-ref', { cwd: dir });

      const subCompPath = path.join(dir, 'frontend', 'src', 'components', 'BuscaPanel.tsx');
      fs.writeFileSync(subCompPath, `
export interface BuscaPanelProps {
  busca: string;
}

export function BuscaPanel({
  busca,
}: BuscaPanelProps) {
  return (
    <div>
      <p>Resultado da busca: {busca}</p>
    </div>
  );
}
      `.trim());

      fs.writeFileSync(compPath, `
import { BuscaPanel } from './BuscaPanel';

export function AgendaDigitalSection() {
  const busca = '';
  return (
    <div>
      <BuscaPanel
        busca={busca}
      />
    </div>
  );
}
      `.trim());

      const res = analyzeRefactorMove(dir, 'base-ref', 0);
      assert.equal(res.newLines.length, 0, 'Deveria ter 0 linhas novas em extracao realista');
      assert.equal(res.typeDivergences.length, 0, 'Deveria ter 0 divergencias de tipos');
    } finally {
      cleanupTempGitRepo(dir);
    }
  });

  await t.test('(i) tipo-objeto type X = { a: string; b: number } com b alterado = divergência', () => {
    const dir = createTempGitRepo();
    try {
      const typesPath = path.join(dir, 'frontend', 'src', 'types.ts');
      fs.writeFileSync(typesPath, `
export type ConfigObj = {
  a: string;
  b: number;
};
      `.trim());

      execSync('git add . && git commit -m "initial"', { cwd: dir });
      execSync('git branch base-ref', { cwd: dir });

      fs.writeFileSync(typesPath, `
export type ConfigObj = {
  a: string;
  b: string;
};
      `.trim());

      const res = analyzeRefactorMove(dir, 'base-ref', 0);
      assert.equal(res.typeDivergences.length, 1, 'Deveria acusar 1 tipo divergente');
      assert.equal(res.typeDivergences[0].name, 'ConfigObj');
    } finally {
      cleanupTempGitRepo(dir);
    }
  });

  await t.test('(j) Sidebar com tabKey: \'x\' e nenhuma tela tratando \'x\' = acusa ausência', () => {
    const dir = createTempGitRepo();
    try {
      const sidebarPath = path.join(dir, 'frontend', 'src', 'components', 'Sidebar.tsx');
      const mainPath = path.join(dir, 'frontend', 'src', 'components', 'Main.tsx');

      fs.writeFileSync(sidebarPath, `
const menu = [
  { tabKey: 'portal_rotina' }
];
      `.trim());

      fs.writeFileSync(mainPath, `
export function Main({ activeTab }) {
  if (activeTab === 'portal_rotina') return <div>Rotina</div>;
  return null;
}
      `.trim());

      execSync('git add . && git commit -m "initial"', { cwd: dir });
      execSync('git branch base-ref', { cwd: dir });

      // Remover o tratamento na tela
      fs.writeFileSync(mainPath, `
export function Main({ activeTab }) {
  return null;
}
      `.trim());

      const res = analyzeRefactorMove(dir, 'base-ref', 0);
      assert.equal(res.tabIds.missing.some(id => id.includes('portal_rotina')), true, 'Deveria acusar portal_rotina sem tela');
    } finally {
      cleanupTempGitRepo(dir);
    }
  });

  await t.test('(k) extração com remover={arquivar} acusa essa linha', () => {
    const dir = createTempGitRepo();
    try {
      const compPath = path.join(dir, 'frontend', 'src', 'components', 'Section.tsx');
      fs.writeFileSync(compPath, `
export function Section() {
  const remover = (id: string) => {};
  const arquivar = (id: string) => {};
  return (
    <div>
      <button onClick={() => remover('1')}>Remover</button>
    </div>
  );
}
      `.trim());

      execSync('git add . && git commit -m "initial"', { cwd: dir });
      execSync('git branch base-ref', { cwd: dir });

      const subCompPath = path.join(dir, 'frontend', 'src', 'components', 'ItemActions.tsx');
      fs.writeFileSync(subCompPath, `
export interface ItemActionsProps {
  remover: (id: string) => void;
}

export function ItemActions({
  remover,
}: ItemActionsProps) {
  return (
    <div>
      <button onClick={() => remover('1')}>Remover</button>
    </div>
  );
}
      `.trim());

      fs.writeFileSync(compPath, `
import { ItemActions } from './ItemActions';

export function Section() {
  const remover = (id: string) => {};
  const arquivar = (id: string) => {};
  return (
    <div>
      <ItemActions
        remover={arquivar}
      />
    </div>
  );
}
      `.trim());

      const res = analyzeRefactorMove(dir, 'base-ref', 0);
      assert.equal(res.newLines.length, 1, 'Deveria acusar exatamente 1 linha nova');
      assert.equal(res.newLines[0].line.includes('remover={arquivar}'), true, 'Deveria acusar a linha com remover={arquivar}');
    } finally {
      cleanupTempGitRepo(dir);
    }
  });

  await t.test('(l) a mesma extração com remover={remover} tem 0 linhas novas', () => {
    const dir = createTempGitRepo();
    try {
      const compPath = path.join(dir, 'frontend', 'src', 'components', 'Section.tsx');
      fs.writeFileSync(compPath, `
export function Section() {
  const remover = (id: string) => {};
  const arquivar = (id: string) => {};
  return (
    <div>
      <button onClick={() => remover('1')}>Remover</button>
    </div>
  );
}
      `.trim());

      execSync('git add . && git commit -m "initial"', { cwd: dir });
      execSync('git branch base-ref', { cwd: dir });

      const subCompPath = path.join(dir, 'frontend', 'src', 'components', 'ItemActions.tsx');
      fs.writeFileSync(subCompPath, `
export interface ItemActionsProps {
  remover: (id: string) => void;
}

export function ItemActions({
  remover,
}: ItemActionsProps) {
  return (
    <div>
      <button onClick={() => remover('1')}>Remover</button>
    </div>
  );
}
      `.trim());

      fs.writeFileSync(compPath, `
import { ItemActions } from './ItemActions';

export function Section() {
  const remover = (id: string) => {};
  const arquivar = (id: string) => {};
  return (
    <div>
      <ItemActions
        remover={remover}
      />
    </div>
  );
}
      `.trim());

      const res = analyzeRefactorMove(dir, 'base-ref', 0);
      assert.equal(res.newLines.length, 0, 'Deveria ter 0 linhas novas com remover={remover}');
      assert.equal(res.typeDivergences.length, 0, 'Deveria ter 0 divergencias de tipos');
    } finally {
      cleanupTempGitRepo(dir);
    }
  });

});

