import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinanceiroSection } from '../FinanceiroSection';
import * as apiModule from '@/lib/api';
import * as authModule from '@/context/AuthContext';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

const mockFatura: any = {
  id: 'fat-101',
  descricao: 'Mensalidade Maio/2026',
  valor: 900.0,
  data_vencimento: '2099-05-10',
  metodo_pagamento: 'pix',
  status: 'pendente',
  gateway_name: null,
};

const mockStatusAtivo = {
  itau: {
    modo: 'production',
    ativo: true,
  },
  cora: {
    modo: 'sandbox',
    disponivel: true,
  },
};

const mockStatusMock = {
  itau: {
    modo: 'mock',
    ativo: false,
  },
  cora: {
    modo: 'mock',
    disponivel: false,
  },
};

describe('FinanceiroSection - Status de Integrações e Emissão Itaú', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('papel financeiro com itau.ativo=true vê o botão "Emitir boleto Itaú"', async () => {
    vi.spyOn(authModule, 'useAuth').mockReturnValue({
      user: { id: 'usr-fin', tenant_id: 't-1', name: 'Operador Financeiro', email: 'fin@escola.com', role: 'financeiro' },
      token: 'tok-123',
      tenant: { id: 't-1', name: 'Escola Teste', slug: 'escola', status: 'ativo' },
      isOnline: true,
      login: vi.fn(),
      logout: vi.fn(),
      setTenantId: vi.fn(),
      switchRole: vi.fn(),
      setUser: vi.fn(),
    });

    vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint: string) => {
      if (endpoint === '/financeiro/faturas') return Promise.resolve([mockFatura]);
      if (endpoint === '/financeiro/integracoes/status') return Promise.resolve(mockStatusAtivo);
      return Promise.resolve([] as any);
    });

    render(<FinanceiroSection />);

    await waitFor(() => {
      expect(screen.getByText('Emitir boleto Itaú')).toBeInTheDocument();
    });
  });

  it('com falha na consulta de status não vê o botão do Itaú e não quebra a tela', async () => {
    vi.spyOn(authModule, 'useAuth').mockReturnValue({
      user: { id: 'usr-fin', tenant_id: 't-1', name: 'Operador Financeiro', email: 'fin@escola.com', role: 'financeiro' },
      token: 'tok-123',
      tenant: { id: 't-1', name: 'Escola Teste', slug: 'escola', status: 'ativo' },
      isOnline: true,
      login: vi.fn(),
      logout: vi.fn(),
      setTenantId: vi.fn(),
      switchRole: vi.fn(),
      setUser: vi.fn(),
    });

    vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint: string) => {
      if (endpoint === '/financeiro/faturas') return Promise.resolve([mockFatura]);
      if (endpoint === '/financeiro/integracoes/status') return Promise.reject(new Error('Falha de rede'));
      return Promise.resolve([] as any);
    });

    render(<FinanceiroSection />);

    await waitFor(() => {
      expect(screen.getByText('Mensalidade Maio/2026')).toBeInTheDocument();
    });

    expect(screen.queryByText('Emitir boleto Itaú')).not.toBeInTheDocument();
  });

  it('em modo mock (itau.modo = "mock") o botão também fica habilitado', async () => {
    vi.spyOn(authModule, 'useAuth').mockReturnValue({
      user: { id: 'usr-fin', tenant_id: 't-1', name: 'Operador Financeiro', email: 'fin@escola.com', role: 'financeiro' },
      token: 'tok-123',
      tenant: { id: 't-1', name: 'Escola Teste', slug: 'escola', status: 'ativo' },
      isOnline: true,
      login: vi.fn(),
      logout: vi.fn(),
      setTenantId: vi.fn(),
      switchRole: vi.fn(),
      setUser: vi.fn(),
    });

    vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint: string) => {
      if (endpoint === '/financeiro/faturas') return Promise.resolve([mockFatura]);
      if (endpoint === '/financeiro/integracoes/status') return Promise.resolve(mockStatusMock);
      return Promise.resolve([] as any);
    });

    render(<FinanceiroSection />);

    await waitFor(() => {
      expect(screen.getByText('Emitir boleto Itaú')).toBeInTheDocument();
    });
  });

  it('trata resposta 202 ("emissão em andamento") exibindo aviso apropriado', async () => {
    vi.spyOn(authModule, 'useAuth').mockReturnValue({
      user: { id: 'usr-1', tenant_id: 't-1', name: 'Admin', email: 'admin@escola.com', role: 'admin' },
      token: 'tok-123',
      tenant: { id: 't-1', name: 'Escola Teste', slug: 'escola', status: 'ativo' },
      isOnline: true,
      login: vi.fn(),
      logout: vi.fn(),
      setTenantId: vi.fn(),
      switchRole: vi.fn(),
      setUser: vi.fn(),
    });

    vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint: string, options?: any) => {
      if (endpoint === '/financeiro/faturas') return Promise.resolve([mockFatura]);
      if (endpoint === '/financeiro/integracoes/status') return Promise.resolve(mockStatusMock);
      if (endpoint.includes('/itau') && options?.method === 'POST') {
        // Backend responde 202 com status: 'pendente'
        return Promise.resolve({
          status: 'pendente',
          mensagem: 'emissão em andamento',
          nosso_numero: '00000001',
        });
      }
      return Promise.resolve([] as any);
    });

    render(<FinanceiroSection />);

    await waitFor(() => {
      expect(screen.getByText('Emitir boleto Itaú')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Emitir boleto Itaú'));

    await waitFor(() => {
      expect(
        screen.getByText(/Emissão em andamento; tente de novo em instantes/i)
      ).toBeInTheDocument();
    });
  });

  it('abre modal com linha digitável e Pix quando emissão retorna 200 OK', async () => {
    vi.spyOn(authModule, 'useAuth').mockReturnValue({
      user: { id: 'usr-1', tenant_id: 't-1', name: 'Admin', email: 'admin@escola.com', role: 'admin' },
      token: 'tok-123',
      tenant: { id: 't-1', name: 'Escola Teste', slug: 'escola', status: 'ativo' },
      isOnline: true,
      login: vi.fn(),
      logout: vi.fn(),
      setTenantId: vi.fn(),
      switchRole: vi.fn(),
      setUser: vi.fn(),
    });

    vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint: string, options?: any) => {
      if (endpoint === '/financeiro/faturas') return Promise.resolve([mockFatura]);
      if (endpoint === '/financeiro/integracoes/status') return Promise.resolve(mockStatusMock);
      if (endpoint.includes('/itau') && options?.method === 'POST') {
        return Promise.resolve({
          ...mockFatura,
          gateway_name: 'itau',
          gateway_invoice_id: 'itau-inv-123',
          gateway_digitable_line: '34191.00000 12345.678901 23456.789012 3 99990000090000',
          gateway_pix_code: '00020126580014br.gov.bcb.pix0136...itaupix',
          codigo_barras: '34191999900000900001090000000123456789012345',
          simulado: true,
        });
      }
      return Promise.resolve([] as any);
    });

    render(<FinanceiroSection />);

    await waitFor(() => {
      expect(screen.getByText('Emitir boleto Itaú')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Emitir boleto Itaú'));

    await waitFor(() => {
      expect(screen.getByText('Bolecode Itaú')).toBeInTheDocument();
      expect(screen.getByDisplayValue('34191.00000 12345.678901 23456.789012 3 99990000090000')).toBeInTheDocument();
      expect(screen.getByDisplayValue('00020126580014br.gov.bcb.pix0136...itaupix')).toBeInTheDocument();
    });
  });
});
