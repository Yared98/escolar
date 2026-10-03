import test from 'node:test';
import assert from 'node:assert/strict';
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

test('5. Chamada dinâmica com allowlist passa', () => {
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
      line: 4,
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
