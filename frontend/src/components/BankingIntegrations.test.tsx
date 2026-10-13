import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BankingIntegrations } from './BankingIntegrations';
import * as apiModule from '@/lib/api';

describe('BankingIntegrations - conformidade B7 (selo e erro sem dados dummy)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exibe o selo "Simulado" quando modo_gateway === "mock"', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue([
      {
        gateway_name: 'cora',
        client_id: 'client_123',
        has_client_secret: true,
        has_webhook_secret: true,
        is_active: true,
        modo_gateway: 'mock',
      },
    ]);

    render(<BankingIntegrations />);

    await waitFor(() => {
      expect(screen.getByText('Simulado')).toBeInTheDocument();
    });
  });

  it('exibe o selo "Modo não suportado ainda" quando modo_gateway !== "mock"', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue([
      {
        gateway_name: 'cora',
        client_id: 'client_123',
        has_client_secret: true,
        has_webhook_secret: true,
        is_active: true,
        modo_gateway: 'sandbox',
      },
    ]);

    render(<BankingIntegrations />);

    await waitFor(() => {
      expect(screen.getByText('Modo não suportado ainda')).toBeInTheDocument();
    });
  });

  it('exibe mensagem de erro e nenhum dado quando a API falha', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockRejectedValue(new Error('Erro de conexão com backend'));

    render(<BankingIntegrations />);

    await waitFor(() => {
      expect(screen.getByText('Erro de conexão com backend')).toBeInTheDocument();
    });
  });
});
