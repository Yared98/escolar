import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrandingProvider, useBranding } from './BrandingContext';
import * as authModule from '@/context/AuthContext';
import * as apiModule from '@/lib/api';
import { temaParaVariaveis } from '@/lib/tema';

function TestConsumer() {
  const { branding, aplicarBranding, recarregarBranding } = useBranding();
  return (
    <div>
      <span data-testid="nome">{branding?.nomeExibicao ?? 'Sem branding'}</span>
      <span data-testid="logo">{branding?.logoSrc ?? 'Sem logo'}</span>
      <button
        onClick={() =>
          aplicarBranding({
            corPrimaria: '#1d4ed8',
            corDestaque: '#ea580c',
            nomeExibicao: 'Manual',
            logoSrc: null,
          })
        }
      >
        Aplicar
      </button>
      <button onClick={() => void recarregarBranding()}>Recarregar</button>
    </div>
  );
}

describe('BrandingContext (TEMA-T4)', () => {
  const originalTitle = document.title;
  const originalEnv = process.env.NEXT_PUBLIC_ESCOLA_SLUG;

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.documentElement.style.cssText = '';
    document.title = 'Escolar - Gestão escolar';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.remove();
    delete process.env.NEXT_PUBLIC_ESCOLA_SLUG;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.documentElement.style.cssText = '';
    document.title = originalTitle;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.remove();
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_ESCOLA_SLUG = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_ESCOLA_SLUG;
    }
  });

  it('com tenant logado e API respondendo Azul & Laranja, aplica variáveis CSS, grava localStorage e atualiza título', async () => {
    vi.spyOn(authModule, 'useAuth').mockReturnValue({
      token: 'mock-token',
      user: { id: 'user-1', tenant_id: 't-1', name: 'Admin', email: 'admin@escola.com', role: 'admin' },
      tenant: { id: 't-1', name: 'Escola Modelo', slug: 'escola-modelo', status: 'active' },
      isOnline: true,
      login: vi.fn(),
      logout: vi.fn(),
      setTenantId: vi.fn(),
      switchRole: vi.fn(),
      setUser: vi.fn(),
    });

    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
      cor_primaria: '#1d4ed8',
      cor_destaque: '#ea580c',
      nome_exibicao: 'Colégio Azul & Laranja',
      tem_logo: true,
      logo_url: '/api/v1/tenant/branding/logo?v=1729000000',
      atualizado_em: '2026-10-21T10:00:00Z',
    });

    render(
      <BrandingProvider>
        <TestConsumer />
      </BrandingProvider>
    );

    const varsEsperadas = temaParaVariaveis({ corPrimaria: '#1d4ed8', corDestaque: '#ea580c' });

    await waitFor(() => {
      const brand700 = document.documentElement.style.getPropertyValue('--brand-700');
      expect(brand700).not.toBe('45 83 56');
      expect(brand700).toBe(varsEsperadas['--brand-700']);
    });

    const varsSalvas = JSON.parse(localStorage.getItem('escolar_branding_vars') || '{}');
    expect(varsSalvas['--brand-700']).toBe(varsEsperadas['--brand-700']);
    expect(document.title).toBe('Colégio Azul & Laranja - Gestão escolar');

    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta).not.toBeNull();
  });

  it('quando a API falha, nenhuma variável --brand-* é aplicada no style e não lança exceção', async () => {
    vi.spyOn(authModule, 'useAuth').mockReturnValue({
      token: 'mock-token',
      user: null,
      tenant: { id: 't-1', name: 'Escola Modelo', slug: 'escola-modelo', status: 'active' },
      isOnline: true,
      login: vi.fn(),
      logout: vi.fn(),
      setTenantId: vi.fn(),
      switchRole: vi.fn(),
      setUser: vi.fn(),
    });

    vi.spyOn(apiModule, 'apiFetch').mockRejectedValue(new Error('Conexão recusada'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <BrandingProvider>
        <TestConsumer />
      </BrandingProvider>
    );

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalled();
    });

    expect(document.documentElement.style.getPropertyValue('--brand-700')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--brand-50')).toBe('');
    expect(localStorage.getItem('escolar_branding_vars')).toBeNull();
  });

  it('aplica cache de localStorage na montagem antes da resposta da API', async () => {
    vi.spyOn(authModule, 'useAuth').mockReturnValue({
      token: 'mock-token',
      user: null,
      tenant: { id: 't-1', name: 'Escola Modelo', slug: 'escola-modelo', status: 'active' },
      isOnline: true,
      login: vi.fn(),
      logout: vi.fn(),
      setTenantId: vi.fn(),
      switchRole: vi.fn(),
      setUser: vi.fn(),
    });

    const cacheBranding = {
      corPrimaria: '#1d4ed8',
      corDestaque: '#ea580c',
      nomeExibicao: 'Escola em Cache',
      logoSrc: null,
    };
    localStorage.setItem('escolar_branding', JSON.stringify(cacheBranding));

    let resolverApi: (val: unknown) => void = () => {};
    const pendentePromise = new Promise((resolve) => {
      resolverApi = resolve;
    });
    vi.spyOn(apiModule, 'apiFetch').mockReturnValue(pendentePromise as any);

    render(
      <BrandingProvider>
        <TestConsumer />
      </BrandingProvider>
    );

    // Imediatamente após render, antes de resolver a API:
    const varsEsperadas = temaParaVariaveis({ corPrimaria: '#1d4ed8', corDestaque: '#ea580c' });
    expect(document.documentElement.style.getPropertyValue('--brand-700')).toBe(varsEsperadas['--brand-700']);
    expect(document.title).toBe('Escola em Cache - Gestão escolar');

    // Limpa a promise pendente com act
    await act(async () => {
      resolverApi({
        cor_primaria: '#1d4ed8',
        cor_destaque: '#ea580c',
        nome_exibicao: 'Escola em Cache',
        tem_logo: false,
        logo_url: null,
        atualizado_em: null,
      });
    });
  });

  it('sem tenant e sem NEXT_PUBLIC_ESCOLA_SLUG, não realiza nenhuma chamada de rede', async () => {
    vi.spyOn(authModule, 'useAuth').mockReturnValue({
      token: null,
      user: null,
      tenant: null,
      isOnline: true,
      login: vi.fn(),
      logout: vi.fn(),
      setTenantId: vi.fn(),
      switchRole: vi.fn(),
      setUser: vi.fn(),
    });

    const apiFetchSpy = vi.spyOn(apiModule, 'apiFetch');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(
      <BrandingProvider>
        <TestConsumer />
      </BrandingProvider>
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(apiFetchSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('nome')).toHaveTextContent('Sem branding');
  });

  it('sem tenant mas com NEXT_PUBLIC_ESCOLA_SLUG, busca branding público via fetch', async () => {
    vi.spyOn(authModule, 'useAuth').mockReturnValue({
      token: null,
      user: null,
      tenant: null,
      isOnline: true,
      login: vi.fn(),
      logout: vi.fn(),
      setTenantId: vi.fn(),
      switchRole: vi.fn(),
      setUser: vi.fn(),
    });

    process.env.NEXT_PUBLIC_ESCOLA_SLUG = 'escola-sol';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        cor_primaria: '#1d4ed8',
        cor_destaque: '#ea580c',
        nome_exibicao: 'Escola do Sol',
        logo_url: '/api/v1/public/branding/escola-sol/logo?v=1',
      }),
    } as any);

    render(
      <BrandingProvider>
        <TestConsumer />
      </BrandingProvider>
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
      expect(document.title).toBe('Escola do Sol - Gestão escolar');
    });

    const varsEsperadas = temaParaVariaveis({ corPrimaria: '#1d4ed8', corDestaque: '#ea580c' });
    expect(document.documentElement.style.getPropertyValue('--brand-700')).toBe(varsEsperadas['--brand-700']);
  });

  it('cores inválidas são ignoradas sem quebrar a aplicação', () => {
    vi.spyOn(authModule, 'useAuth').mockReturnValue({
      token: null,
      user: null,
      tenant: null,
      isOnline: true,
      login: vi.fn(),
      logout: vi.fn(),
      setTenantId: vi.fn(),
      switchRole: vi.fn(),
      setUser: vi.fn(),
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    let contextRef: ReturnType<typeof useBranding> | null = null;
    function Consumer() {
      contextRef = useBranding();
      return null;
    }

    render(
      <BrandingProvider>
        <Consumer />
      </BrandingProvider>
    );

    expect(() => {
      contextRef?.aplicarBranding({
        corPrimaria: 'invalido',
        corDestaque: '#ea580c',
        nomeExibicao: 'Inválido',
        logoSrc: null,
      });
    }).not.toThrow();

    expect(warnSpy).toHaveBeenCalled();
    expect(document.documentElement.style.getPropertyValue('--brand-700')).toBe('');
  });
});
