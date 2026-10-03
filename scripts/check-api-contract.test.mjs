import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { checkApiContract } from './check-api-contract.mjs';

const mockRoutesCode = `
pub fn create_router() -> Router {
    let protected_routes = Router::new()
        .route("/secretaria/alunos", get(listar_alunos))
        .route("/secretaria/turmas", post(criar_turma).get(listar_turmas));

    Router::new().nest("/api/v1", protected_routes)
}
`;

test('1. Rota existente e método correto passa', () => {
  const filesMap = {
    'frontend/src/components/TestComp.tsx': `
      import { apiFetch } from '@/lib/api';
      export async function loadAlunos() {
        return apiFetch('/secretaria/alunos');
      }
    `,
  };

  const result = checkApiContract({
    routesCode: mockRoutesCode,
    filesMap,
    allowlist: [],
  });

  assert.equal(result.success, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.totalCalls, 1);
});

test('2. Caminho inexistente falha com mensagem e sugestão', () => {
  const filesMap = {
    'frontend/src/components/TestComp.tsx': `
      import { apiFetch } from '@/lib/api';
      export async function loadAlunos() {
        return apiFetch('/secretaria/aluno_inexistente');
      }
    `,
  };

  const result = checkApiContract({
    routesCode: mockRoutesCode,
    filesMap,
    allowlist: [],
  });

  assert.equal(result.success, false);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /Chamada para rota inexistente \[GET \/secretaria\/aluno_inexistente\]/);
});

test('3. Método errado em rota existente falha', () => {
  const filesMap = {
    'frontend/src/components/TestComp.tsx': `
      import { apiFetch } from '@/lib/api';
      export async function createAluno() {
        return apiFetch('/secretaria/alunos', { method: 'POST' });
      }
    `,
  };

  const result = checkApiContract({
    routesCode: mockRoutesCode,
    filesMap,
    allowlist: [],
  });

  assert.equal(result.success, false);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /Método POST não permitido para rota \/secretaria\/alunos/);
});

test('4. Chamada dinâmica sem allowlist falha', () => {
  const filesMap = {
    'frontend/src/components/TestComp.tsx': `
      import { apiFetch } from '@/lib/api';
      export async function loadDynamic(endpoint: string) {
        return apiFetch(endpoint);
      }
    `,
  };

  const result = checkApiContract({
    routesCode: mockRoutesCode,
    filesMap,
    allowlist: [],
  });

  assert.equal(result.success, false);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /Chamada dinâmica de API sem entrada na allowlist/);
});

test('5. Chamada dinâmica com allowlist por expressao passa', () => {
  const filesMap = {
    'frontend/src/components/TestComp.tsx': `
      import { apiFetch } from '@/lib/api';
      export async function loadDynamic(endpoint: string) {
        return apiFetch(endpoint);
      }
    `,
  };

  const allowlist = [
    {
      file: 'frontend/src/components/TestComp.tsx',
      expressao: 'endpoint',
      motivo: 'Endpoint dinâmico validado em hook de teste',
    },
  ];

  const result = checkApiContract({
    routesCode: mockRoutesCode,
    filesMap,
    allowlist,
  });

  assert.equal(result.success, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.dynamics.length, 1);
  assert.equal(result.dynamics[0].motivo, 'Endpoint dinâmico validado em hook de teste');
});

test('6. Método não literal por variável de opções exige allowlist', () => {
  const filesMap = {
    'frontend/src/components/TestComp.tsx': `
      import { apiFetch } from '@/lib/api';
      export async function sendRequest(opts: any) {
        return apiFetch('/secretaria/alunos', opts);
      }
    `,
  };

  const resultNoAllowlist = checkApiContract({
    routesCode: mockRoutesCode,
    filesMap,
    allowlist: [],
  });

  assert.equal(resultNoAllowlist.success, false);
  assert.match(resultNoAllowlist.errors[0], /Chamada dinâmica de API sem entrada na allowlist/);

  const resultWithAllowlist = checkApiContract({
    routesCode: mockRoutesCode,
    filesMap,
    allowlist: [
      {
        file: 'frontend/src/components/TestComp.tsx',
        expressao: "'/secretaria/alunos'",
        motivo: 'Método passado por variável de opções',
      },
    ],
  });

  assert.equal(resultWithAllowlist.success, true);
});

test('7. Método não literal por ternário exige allowlist', () => {
  const filesMap = {
    'frontend/src/components/TestComp.tsx': `
      import { apiFetch } from '@/lib/api';
      export async function toggleAluno(isPost: boolean) {
        return apiFetch('/secretaria/alunos', { method: isPost ? 'POST' : 'GET' });
      }
    `,
  };

  const resultNoAllowlist = checkApiContract({
    routesCode: mockRoutesCode,
    filesMap,
    allowlist: [],
  });

  assert.equal(resultNoAllowlist.success, false);
  assert.match(resultNoAllowlist.errors[0], /Chamada dinâmica de API sem entrada na allowlist/);

  const resultWithAllowlist = checkApiContract({
    routesCode: mockRoutesCode,
    filesMap,
    allowlist: [
      {
        file: 'frontend/src/components/TestComp.tsx',
        expressao: "'/secretaria/alunos'",
        motivo: 'Método dinâmico por ternário',
      },
    ],
  });

  assert.equal(resultWithAllowlist.success, true);
});

test('8. Entrada obsoleta na allowlist com strictAllowlist falha', () => {
  const filesMap = {
    'frontend/src/components/TestComp.tsx': `
      import { apiFetch } from '@/lib/api';
      export async function loadAlunos() {
        return apiFetch('/secretaria/alunos');
      }
    `,
  };

  const allowlist = [
    {
      file: 'frontend/src/components/TestComp.tsx',
      expressao: 'endpointInexistente',
      motivo: 'Entrada antiga que não existe mais',
    },
  ];

  const resultNonStrict = checkApiContract({
    routesCode: mockRoutesCode,
    filesMap,
    allowlist,
    strictAllowlist: false,
  });
  assert.equal(resultNonStrict.success, true);

  const resultStrict = checkApiContract({
    routesCode: mockRoutesCode,
    filesMap,
    allowlist,
    strictAllowlist: true,
  });
  assert.equal(resultStrict.success, false);
  assert.match(resultStrict.errors[0], /Entrada obsoleta na allowlist/);
});

test('9. Compare snapshot detecta chamadas removidas (AUSENTE) e novas (NOVA)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contract-snap-test-'));
  const snapshotFile = path.join(tmpDir, 'api-calls.snapshot.json');

  const initialFilesMap = {
    'frontend/src/components/CompA.tsx': `
      import { apiFetch } from '@/lib/api';
      export async function load() {
        await apiFetch('/secretaria/alunos');
        await apiFetch('/secretaria/turmas', { method: 'POST' });
      }
    `,
  };

  // 1. Generate snapshot
  const snapResult = checkApiContract({
    routesCode: mockRoutesCode,
    filesMap: initialFilesMap,
    allowlist: [],
    snapshot: true,
    snapshotFile,
  });
  assert.equal(snapResult.success, true);
  assert.equal(fs.existsSync(snapshotFile), true);

  // 2. Compare against identical code -> passes
  const compareSame = checkApiContract({
    routesCode: mockRoutesCode,
    filesMap: initialFilesMap,
    allowlist: [],
    compareSnapshot: true,
    snapshotFile,
  });
  assert.equal(compareSame.success, true);

  // 3. Code removed POST /secretaria/turmas and added GET /secretaria/turmas
  const modifiedFilesMap = {
    'frontend/src/components/CompA.tsx': `
      import { apiFetch } from '@/lib/api';
      export async function load() {
        await apiFetch('/secretaria/alunos');
        await apiFetch('/secretaria/turmas');
      }
    `,
  };

  const compareModified = checkApiContract({
    routesCode: mockRoutesCode,
    filesMap: modifiedFilesMap,
    allowlist: [],
    compareSnapshot: true,
    snapshotFile,
  });

  assert.equal(compareModified.success, false);
  assert.equal(compareModified.errors.length, 2);
  assert.match(compareModified.errors.find(e => e.includes('AUSENTE')), /Snapshot mismatch: chamada AUSENTE \[POST \/secretaria\/turmas\]/);
  assert.match(compareModified.errors.find(e => e.includes('NOVA')), /Snapshot mismatch: chamada NOVA \[GET \/secretaria\/turmas\]/);

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
