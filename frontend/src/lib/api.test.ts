import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { apiFetch } from './api';

describe('apiFetch', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('injeta Authorization e X-Tenant-ID dos dados do localStorage', async () => {
    localStorage.setItem('escolar_jwt_token', 'token-123');
    localStorage.setItem('escolar_tenant_id', 'tenant-abc');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await apiFetch<{ success: boolean }>('/alunos');
    expect(res).toEqual({ success: true });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('/alunos');
    expect(init.headers['Authorization']).toBe('Bearer token-123');
    expect(init.headers['X-Tenant-ID']).toBe('tenant-abc');
  });

  it('deduplica refresh em caso de múltiplas requisições simultâneas com 401', async () => {
    localStorage.setItem('escolar_jwt_token', 'token-antigo');
    localStorage.setItem('escolar_refresh_token', 'refresh-valido');

    let refreshCallCount = 0;

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        refreshCallCount++;
        // Simula pequena latência para garantir concorrência
        await new Promise((r) => setTimeout(r, 10));
        return {
          ok: true,
          status: 200,
          json: async () => ({ token: 'token-renovado', refresh_token: 'refresh-novo' }),
        };
      }

      if (url.includes('/endpoint-')) {
        // Se ainda for token antigo, responde 401
        // Se for token renovado, responde 200
        const isOld = mockFetch.mock.calls.some(
          (c) => c[0] === url && c[1]?.headers?.['Authorization'] === 'Bearer token-renovado'
        );
        if (isOld) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: url }),
          };
        }
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: 'Unauthorized' }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      };
    });

    vi.stubGlobal('fetch', mockFetch);

    // 3 requisições simultâneas que tomam 401
    const p1 = apiFetch('/endpoint-1');
    const p2 = apiFetch('/endpoint-2');
    const p3 = apiFetch('/endpoint-3');

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(r1).toEqual({ data: 'http://localhost:8000/api/v1/endpoint-1' });
    expect(r2).toEqual({ data: 'http://localhost:8000/api/v1/endpoint-2' });
    expect(r3).toEqual({ data: 'http://localhost:8000/api/v1/endpoint-3' });

    // CRÍTICO: Exatamente 1 chamada de refresh deve ocorrer devido ao refreshInFlight
    expect(refreshCallCount).toBe(1);
    expect(localStorage.getItem('escolar_jwt_token')).toBe('token-renovado');
    expect(localStorage.getItem('escolar_refresh_token')).toBe('refresh-novo');
  });

  it('quando o refresh falha, limpa sessão e dispara evento auth_error sem entrar em loop', async () => {
    localStorage.setItem('escolar_jwt_token', 'token-invalido');
    localStorage.setItem('escolar_refresh_token', 'refresh-expirado');

    const authErrorHandler = vi.fn();
    window.addEventListener('auth_error', authErrorHandler);

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: 'Refresh token expired' }),
        };
      }
      return {
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      };
    });

    vi.stubGlobal('fetch', mockFetch);

    await expect(apiFetch('/alunos')).rejects.toThrow();

    expect(authErrorHandler).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('escolar_jwt_token')).toBeNull();
    expect(localStorage.getItem('escolar_refresh_token')).toBeNull();

    window.removeEventListener('auth_error', authErrorHandler);
  });

  it('endpoint de /auth/refresh nunca dispara refresh de si mesmo em 401', async () => {
    localStorage.setItem('escolar_refresh_token', 'token-qualquer');

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: 'Invalid refresh token' }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    vi.stubGlobal('fetch', mockFetch);

    await expect(
      apiFetch('/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token: '123' }) })
    ).rejects.toThrow('Invalid refresh token');

    // Foi chamado apenas 1 vez (não entrou em loop tentando dar refresh de si mesmo)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
