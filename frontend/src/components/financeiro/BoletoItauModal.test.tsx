import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoletoItauModal } from './BoletoItauModal';
import { Fatura } from './types';

const mockFatura: Fatura = {
  id: 'fat-123',
  descricao: 'Mensalidade Escolar - Março/2026',
  valor: 1250.0,
  data_vencimento: '2026-03-10',
  metodo_pagamento: 'boleto_pix',
  status: 'pendente',
  gateway_name: 'itau',
  gateway_digitable_line: '34191.09008 00000.123456 78901.234567 1 99990000125000',
  gateway_pix_code: '00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-42661417400052040000530398654071250.005802BR5915Escola Exemplo6009Sao Paulo62070503***6304ABCD',
  codigo_barras: '34191999900001250001090000000123456789012345',
  simulado: false,
};

describe('BoletoItauModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza título, linha digitável, código Pix e aviso de vencimento', () => {
    const onClose = vi.fn();
    render(<BoletoItauModal fatura={mockFatura} onClose={onClose} modo="production" />);

    expect(screen.getByText('Bolecode Itaú')).toBeInTheDocument();
    expect(screen.getByText('Mensalidade Escolar - Março/2026')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.250,00')).toBeInTheDocument();
    expect(screen.getByDisplayValue(mockFatura.gateway_digitable_line!)).toBeInTheDocument();
    expect(screen.getByDisplayValue(mockFatura.gateway_pix_code!)).toBeInTheDocument();
    expect(screen.getByDisplayValue(mockFatura.codigo_barras!)).toBeInTheDocument();
    expect(
      screen.getByText(/Depois do vencimento, pague pelo código de barras/i)
    ).toBeInTheDocument();
  });

  it('exibe o selo "Simulado" quando em modo mock ou fatura.simulado = true', () => {
    const onClose = vi.fn();
    render(<BoletoItauModal fatura={{ ...mockFatura, simulado: true }} onClose={onClose} modo="mock" />);

    expect(screen.getByText('Simulado')).toBeInTheDocument();
  });

  it('permite copiar a linha digitável com feedback visual', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    const onClose = vi.fn();
    render(<BoletoItauModal fatura={mockFatura} onClose={onClose} />);

    const copiarButtons = screen.getAllByText('Copiar');
    fireEvent.click(copiarButtons[0]);

    expect(writeTextMock).toHaveBeenCalledWith(mockFatura.gateway_digitable_line);
  });

  it('chama onClose ao clicar no botão Fechar', () => {
    const onClose = vi.fn();
    render(<BoletoItauModal fatura={mockFatura} onClose={onClose} />);

    fireEvent.click(screen.getByText('Fechar'));
    expect(onClose).toHaveBeenCalled();
  });
});
