import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PainelEvasao } from './PainelEvasao';
import * as apiModule from '@/lib/api';

describe('PainelEvasao - conformidade AGENTS.md (sem dados dummy em erro)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exibe mensagem de erro e nenhum dado fictício/card quando a API falha', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockRejectedValue(new Error('Falha de conexão com a API de IA'));

    render(<PainelEvasao />);

    // Aguarda o estado de erro aparecer
    await waitFor(() => {
      expect(screen.getByText('Falha de conexão com a API de IA')).toBeInTheDocument();
    });

    // Garante que nenhum dado fictício/card de aluno foi renderizado
    expect(screen.queryByText(/ID:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Frequência/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Média Geral/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Faturas Atr\./i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nenhum alerta crítico!/i)).not.toBeInTheDocument();
  });

  it('renderiza os dados reais retornados pela API quando há sucesso', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue([
      {
        aluno_id: 'aluno-uuid-12345678',
        score_risco_evasao: 88.5,
        nivel_urgencia: 'alta',
        fator_principal: 'faltas_reiteradas',
        recomendacao: 'Contatar os pais urgentemente devido a faltas',
        detalhes: {
          faturas_atrasadas: 2,
          frequencia_ultimos_30_dias: 62.0,
          media_disciplinas: 5.2,
        },
      },
    ]);

    render(<PainelEvasao />);

    await waitFor(() => {
      expect(screen.getByText(/ID:\s*aluno/i)).toBeInTheDocument();
    });

    expect(screen.getByText('88.5')).toBeInTheDocument();
    expect(screen.getByText(/Contatar os pais urgentemente/i)).toBeInTheDocument();
    expect(screen.getByText('62%')).toBeInTheDocument();
    expect(screen.getByText('5.2')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
