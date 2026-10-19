import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { apiFetch } from './api';
import { getAccessToken, setAccessToken } from './session';

const resposta = (status: number, corpo: unknown = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => corpo,
});

describe('apiFetch', () => {
  beforeEach(() => {
    localStorage.clear();
    setAccessToken(null);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('injeta Authorization (token em memória) e X-Tenant-ID', async () => {
    setAccessToken('token-123');
    localStorage.setItem('escolar_tenant_id', 'tenant-abc');

    const mockFetch = vi.fn().mockResolvedValue(resposta(200, { success: true }));
    vi.stubGlobal('fetch', mockFetch);

    const res = await apiFetch<{ success: boolean }>('/alunos');
    expect(res).toEqual({ success: true });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('/alunos');
    expect(init.headers['Authorization']).toBe('Bearer token-123');
    expect(init.headers['X-Tenant-ID']).toBe('tenant-abc');
  });

  it('nunca grava token em localStorage nem sessionStorage', async () => {
    setAccessToken('token-123');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(200, {})));
    await apiFetch('/alunos');
    expect(localStorage.getItem('escolar_jwt_token')).toBeNull();
    expect(localStorage.getItem('escolar_refresh_token')).toBeNull();
    expect(JSON.stringify({ ...localStorage })).not.toContain('token-123');
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('token-123');
  });

  it('rotas de sessão pedem o modo cookie e enviam credenciais, sem Authorization', async () => {
    setAccessToken('token-123');
    const mockFetch = vi.fn().mockResolvedValue(resposta(200, { token: 't' }));
    vi.stubGlobal('fetch', mockFetch);

    await apiFetch('/auth/login', { method: 'POST', body: '{}' });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.credentials).toBe('include');
    expect(init.headers['X-Auth-Mode']).toBe('cookie');
    expect(init.headers['Authorization']).toBeUndefined();
  });

  it('depois de recarregar a página (sem token em memória) renova pelo cookie antes de chamar a API', async () => {
    localStorage.setItem('escolar_user', JSON.stringify({ id: 'u1' }));
    localStorage.setItem('escolar_tenant_id', 'tenant-abc');

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) return resposta(200, { token: 'token-do-cookie' });
      return resposta(200, { ok: true });
    });
    vi.stubGlobal('fetch', mockFetch);

    await apiFetch('/alunos');

    const chamadas = mockFetch.mock.calls.map((c) => c[0] as string);
    expect(chamadas[0]).toContain('/auth/refresh');
    expect(chamadas[1]).toContain('/alunos');
    const [, initRefresh] = mockFetch.mock.calls[0];
    expect(initRefresh.credentials).toBe('include');
    expect(initRefresh.headers['X-Auth-Mode']).toBe('cookie');
    expect(initRefresh.body).toBe('{}');
    expect(mockFetch.mock.calls[1][1].headers['Authorization']).toBe('Bearer token-do-cookie');
    expect(getAccessToken()).toBe('token-do-cookie');
  });

  it('deduplica a renovação quando várias requisições simultâneas tomam 401', async () => {
    setAccessToken('token-antigo');
    localStorage.setItem('escolar_user', JSON.stringify({ id: 'u1' }));

    let renovacoes = 0;
    const mockFetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      if (url.includes('/auth/refresh')) {
        renovacoes++;
        await new Promise((r) => setTimeout(r, 10));
        return resposta(200, { token: 'token-renovado' });
      }
      const auth = (init.headers as Record<string, string>)['Authorization'];
      return auth === 'Bearer token-renovado'
        ? resposta(200, { data: url })
        : resposta(401, { error: 'Unauthorized' });
    });
    vi.stubGlobal('fetch', mockFetch);

    const [r1, r2, r3] = await Promise.all([
      apiFetch('/endpoint-1'),
      apiFetch('/endpoint-2'),
      apiFetch('/endpoint-3'),
    ]);

    expect(r1).toEqual({ data: 'http://localhost:8000/api/v1/endpoint-1' });
    expect(r2).toEqual({ data: 'http://localhost:8000/api/v1/endpoint-2' });
    expect(r3).toEqual({ data: 'http://localhost:8000/api/v1/endpoint-3' });
    expect(renovacoes).toBe(1);
    expect(getAccessToken()).toBe('token-renovado');
  });

  it('quando a renovação é recusada, limpa a sessão e dispara auth_error sem entrar em loop', async () => {
    setAccessToken('token-invalido');
    localStorage.setItem('escolar_user', JSON.stringify({ id: 'u1' }));
    localStorage.setItem('escolar_tenant_id', 'tenant-abc');

    const authErrorHandler = vi.fn();
    window.addEventListener('auth_error', authErrorHandler);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) =>
        url.includes('/auth/refresh') ? resposta(401, { error: 'expirada' }) : resposta(401, { error: 'Unauthorized' })
      )
    );

    await expect(apiFetch('/alunos')).rejects.toThrow();

    expect(authErrorHandler).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
    expect(localStorage.getItem('escolar_user')).toBeNull();
    expect(localStorage.getItem('escolar_tenant_id')).toBeNull();

    window.removeEventListener('auth_error', authErrorHandler);
  });

  it('sem conexão para renovar, mantém a sessão (não desloga) e informa o erro', async () => {
    setAccessToken('token-expirado');
    localStorage.setItem('escolar_user', JSON.stringify({ id: 'u1' }));

    const authErrorHandler = vi.fn();
    window.addEventListener('auth_error', authErrorHandler);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/auth/refresh')) throw new TypeError('Failed to fetch');
        return resposta(401, { error: 'Unauthorized' });
      })
    );

    await expect(apiFetch('/alunos')).rejects.toThrow(/conex/i);

    expect(authErrorHandler).not.toHaveBeenCalled();
    expect(localStorage.getItem('escolar_user')).not.toBeNull();

    window.removeEventListener('auth_error', authErrorHandler);
  });

  it('endpoint de /auth/refresh nunca dispara renovação de si mesmo em 401', async () => {
    const mockFetch = vi.fn().mockResolvedValue(resposta(401, { error: 'Invalid refresh token' }));
    vi.stubGlobal('fetch', mockFetch);

    await expect(apiFetch('/auth/refresh', { method: 'POST', body: '{}' })).rejects.toThrow(
      'Invalid refresh token'
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('senha errada no login (401) não desloga nem tenta renovar', async () => {
    const authErrorHandler = vi.fn();
    window.addEventListener('auth_error', authErrorHandler);
    const mockFetch = vi.fn().mockResolvedValue(resposta(401, { error: 'Credenciais inválidas' }));
    vi.stubGlobal('fetch', mockFetch);

    await expect(apiFetch('/auth/login', { method: 'POST', body: '{}' })).rejects.toThrow(
      'Credenciais inválidas'
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(authErrorHandler).not.toHaveBeenCalled();

    window.removeEventListener('auth_error', authErrorHandler);
  });
});
