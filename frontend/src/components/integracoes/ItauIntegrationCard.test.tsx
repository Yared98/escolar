import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ItauIntegrationCard } from './ItauIntegrationCard';
import * as apiModule from '@/lib/api';

const mockEstadoOk = {
  modo: 'production',
  ativo: true,
  agencia: '0057',
  conta: '1234567',
  dac: '8',
  id_beneficiario: '005712345678',
  chave_pix: 'escola@exemplo.com.br',
  especie_padrao: '04',
  multa_padrao_percentual: 2.0,
  juros_padrao_percentual: 1.0,
  ultimo_teste_ok_em: '2026-10-15T12:00:00Z',
  has_client_id: true,
  client_id_mascarado: 'cli_***_123',
  has_client_secret: true,
  has_certificado: true,
  certificado_valido_ate: '2027-10-15T12:00:00Z',
  pode_renovar: false,
  has_chave_transporte: true,
  chave_cifragem_configurada: true,
};

describe('ItauIntegrationCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza o estado da integração com selo, client_id mascarado e certificado', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue(mockEstadoOk);

    render(<ItauIntegrationCard userRole="admin" />);

    await waitFor(() => {
      expect(screen.getByText('Banco Itaú')).toBeInTheDocument();
      expect(screen.getByText('Produção')).toBeInTheDocument();
      expect(screen.getByText('cli_***_123')).toBeInTheDocument();
      expect(screen.getByText('Ativa')).toBeInTheDocument();
    });
  });

  it('mostra o assistente para a gestão com a grafia do seed (GestorEscolar)', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue(mockEstadoOk);

    render(<ItauIntegrationCard userRole="GestorEscolar" />);

    await waitFor(() => {
      expect(screen.getByText('Assistente de Conexão com o Itaú')).toBeInTheDocument();
    });
    expect(
      screen.queryByText('Só a gestão da escola pode editar credenciais e chaves do assistente de conexão.')
    ).not.toBeInTheDocument();
  });

  it('esconde edição e passos do assistente para papel fora da gestão (somente leitura)', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue(mockEstadoOk);

    render(<ItauIntegrationCard userRole="secretaria" />);

    await waitFor(() => {
      expect(screen.getByText('Dados configurados da cobrança')).toBeInTheDocument();
      expect(
        screen.getByText('Só a gestão da escola pode editar credenciais e chaves do assistente de conexão.')
      ).toBeInTheDocument();
    });

    // Passos do assistente não devem ser exibidos
    expect(screen.queryByText('Assistente de Conexão com o Itaú')).not.toBeInTheDocument();
    expect(screen.queryByText('Salvar dados da cobrança')).not.toBeInTheDocument();
  });

  it('exibe passos do assistente para o papel admin', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue(mockEstadoOk);

    render(<ItauIntegrationCard userRole="admin" />);

    await waitFor(() => {
      expect(screen.getByText('Assistente de Conexão com o Itaú')).toBeInTheDocument();
      expect(screen.getByText('Salvar dados da cobrança')).toBeInTheDocument();
      expect(screen.getByText('Testar conexão')).toBeInTheDocument();
    });
  });

  it('exibe mensagem de erro sem dados inventados quando a API falha', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockRejectedValue(new Error('Falha de rede ao consultar Itaú'));

    render(<ItauIntegrationCard userRole="admin" />);

    await waitFor(() => {
      expect(screen.getByText('Falha de rede ao consultar Itaú')).toBeInTheDocument();
      expect(screen.getByText('Erro ao carregar integração Itaú')).toBeInTheDocument();
    });

    // Não deve inventar dados
    expect(screen.queryByText('cli_***_123')).not.toBeInTheDocument();
    expect(screen.queryByText('Assistente de Conexão com o Itaú')).not.toBeInTheDocument();
  });

  it('modo mock exibe selo Simulado e aviso de que nada é enviado ao banco', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
      ...mockEstadoOk,
      modo: 'mock',
      ativo: false,
    });

    render(<ItauIntegrationCard userRole="admin" />);

    await waitFor(() => {
      expect(screen.getByText('Simulado')).toBeInTheDocument();
      expect(screen.getByText(/nada é enviado ao banco/i)).toBeInTheDocument();
    });
  });

  it('avisa quando a chave de cifragem não está configurada no servidor e desabilita passos', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
      ...mockEstadoOk,
      chave_cifragem_configurada: false,
    });

    render(<ItauIntegrationCard userRole="admin" />);

    await waitFor(() => {
      expect(screen.getByText('Chave de cifragem não configurada no servidor')).toBeInTheDocument();
      const salvarBtn = screen.getByText('Salvar dados da cobrança');
      expect(salvarBtn).toBeDisabled();
    });
  });

  it('exibe botão de renovação quando pode_renovar é true', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
      ...mockEstadoOk,
      pode_renovar: true,
    });

    render(<ItauIntegrationCard userRole="admin" />);

    await waitFor(() => {
      expect(screen.getByText('Pode renovar')).toBeInTheDocument();
      expect(screen.getByText('Renovar certificado')).toBeInTheDocument();
    });
  });

  it('exibe alerta de falha quando há renovacao_ultimo_erro e status da renovação automática', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
      ...mockEstadoOk,
      renovacao_automatica_ligada: true,
      renovacao_ultimo_erro: 'STS recusou a requisição (status 502)',
    });

    render(<ItauIntegrationCard userRole="admin" />);

    await waitFor(() => {
      expect(
        screen.getByText(/A renovação automática falhou: STS recusou a requisição \(status 502\)\. Renove pelo botão abaixo antes do vencimento\./i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Renovação automática:/i)).toBeInTheDocument();
      expect(screen.getByText('ligada')).toBeInTheDocument();
    });
  });
});
