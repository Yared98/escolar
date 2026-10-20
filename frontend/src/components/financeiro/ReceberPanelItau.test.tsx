import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReceberPanel } from './ReceberPanel';
import { Fatura } from './types';

const defaultStats = {
  r0_30: { count: 1, total: 500 },
  r31_60: { count: 0, total: 0 },
  r60Plus: { count: 0, total: 0 },
  totalEmAberto: 500,
  countEmAberto: 1,
};

const faturaAberta: Fatura = {
  id: 'fat-1',
  descricao: 'Mensalidade Abril',
  valor: 500.0,
  data_vencimento: '2026-04-10',
  metodo_pagamento: 'pix',
  status: 'pendente',
  gateway_name: null,
};

const faturaItau: Fatura = {
  id: 'fat-2',
  descricao: 'Mensalidade Maio',
  valor: 600.0,
  data_vencimento: '2026-05-10',
  metodo_pagamento: 'boleto_pix',
  status: 'pendente',
  gateway_name: 'itau',
  gateway_digitable_line: '34191.00000 11111.222222 33333.444444 5 99990000060000',
  gateway_pix_code: '00020126...6304ABCD',
};

describe('ReceberPanel - Integração Itaú', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exibe botão "Emitir boleto Itaú" quando itauHabilitado = true e fatura em aberto', () => {
    const handleEmitirItau = vi.fn();
    render(
      <ReceberPanel
        agingFilter={null}
        setAgingFilter={vi.fn()}
        handleToggleAgingFilter={vi.fn()}
        agingStats={defaultStats}
        statusFilter="todos"
        setStatusFilter={vi.fn()}
        searchQuery=""
        setSearchQuery={vi.fn()}
        setShowNovaFaturaModal={vi.fn()}
        faturasFiltradas={[faturaAberta]}
        calcularDiasAtrasoFatura={vi.fn().mockReturnValue(0)}
        handleBaixaManual={vi.fn()}
        setPixModalFatura={vi.fn()}
        handleEmitirNfse={vi.fn()}
        bankingMode="mock"
        bankingLoaded={true}
        podeUsarCora={false}
        handleEmitirCora={vi.fn()}
        handleSimularPagamentoCora={vi.fn()}
        itauHabilitado={true}
        handleEmitirItau={handleEmitirItau}
        handleAbrirBoletoItau={vi.fn()}
      />
    );

    const btnEmitir = screen.getByText('Emitir boleto Itaú');
    expect(btnEmitir).toBeInTheDocument();
    fireEvent.click(btnEmitir);
    expect(handleEmitirItau).toHaveBeenCalledWith(faturaAberta);
  });

  it('exibe botão "Ver boleto Itaú" quando a fatura já foi emitida no Itaú (gateway_name === "itau")', () => {
    const handleAbrirBoletoItau = vi.fn();
    render(
      <ReceberPanel
        agingFilter={null}
        setAgingFilter={vi.fn()}
        handleToggleAgingFilter={vi.fn()}
        agingStats={defaultStats}
        statusFilter="todos"
        setStatusFilter={vi.fn()}
        searchQuery=""
        setSearchQuery={vi.fn()}
        setShowNovaFaturaModal={vi.fn()}
        faturasFiltradas={[faturaItau]}
        calcularDiasAtrasoFatura={vi.fn().mockReturnValue(0)}
        handleBaixaManual={vi.fn()}
        setPixModalFatura={vi.fn()}
        handleEmitirNfse={vi.fn()}
        bankingMode="mock"
        bankingLoaded={true}
        podeUsarCora={false}
        handleEmitirCora={vi.fn()}
        handleSimularPagamentoCora={vi.fn()}
        itauHabilitado={true}
        handleEmitirItau={vi.fn()}
        handleAbrirBoletoItau={handleAbrirBoletoItau}
      />
    );

    const btnVer = screen.getByText('Ver boleto Itaú');
    expect(btnVer).toBeInTheDocument();
    fireEvent.click(btnVer);
    expect(handleAbrirBoletoItau).toHaveBeenCalledWith(faturaItau);
  });
});
