import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RematriculaPanel } from './RematriculaPanel';
import { PreviaViradaData } from './types';

describe('RematriculaPanel', () => {
  const dummyPrevia: PreviaViradaData = {
    ano_origem: 2026,
    ano_destino: 2027,
    ja_executada: false,
    turmas: [
      {
        turma_origem_id: 'turma-1',
        turma_origem_nome: '1º Ano A',
        etapa_ensino: 'fundamental_1',
        serie: '1º Ano',
        turno: 'matutino',
        capacidade_maxima: 30,
        sugestao_proxima_serie: '2º Ano',
        sugestao_proxima_etapa: 'fundamental_1',
        sugestao_nome_turma: '2º Ano A',
        total_alunos: 2,
        alunos: [
          {
            aluno_id: 'aluno-1',
            nome: 'Alice Silva',
            numero_chamada: 1,
            status_boletim: 'Aprovado',
            acao_sugerida: 'promover',
            media_geral: 8.5,
            frequencia_pct: 95.0,
          },
          {
            aluno_id: 'aluno-2',
            nome: 'Beto Souza',
            numero_chamada: 2,
            status_boletim: 'Reprovado',
            acao_sugerida: 'reter',
            media_geral: 3.5,
            frequencia_pct: 80.0,
          },
        ],
      },
    ],
  };

  it('renderiza o Passo 1 com campos de anos e opções', () => {
    const onCarregarPrevia = vi.fn();
    render(
      <RematriculaPanel
        anoOrigem={2026}
        setAnoOrigem={vi.fn()}
        anoDestino={2027}
        setAnoDestino={vi.fn()}
        copiarProfessores={true}
        setCopiarProfessores={vi.fn()}
        gerarContratos={true}
        setGerarContratos={vi.fn()}
        previaData={null}
        loadingPrevia={false}
        errorPrevia={null}
        onCarregarPrevia={onCarregarPrevia}
        executando={false}
        resultadoExecucao={null}
        errorExecucao={null}
        onExecutarVirada={vi.fn()}
        onReiniciar={vi.fn()}
      />
    );

    expect(screen.getByText('Configuração da Virada de Ano Letivo')).toBeInTheDocument();
    expect(screen.getByText('Carregar prévia da virada')).toBeInTheDocument();
  });

  it('exibe dados da prévia no Passo 2 e permite avançar para Passo 3', async () => {
    const onExecutarVirada = vi.fn();

    render(
      <RematriculaPanel
        anoOrigem={2026}
        setAnoOrigem={vi.fn()}
        anoDestino={2027}
        setAnoDestino={vi.fn()}
        copiarProfessores={true}
        setCopiarProfessores={vi.fn()}
        gerarContratos={true}
        setGerarContratos={vi.fn()}
        previaData={dummyPrevia}
        loadingPrevia={false}
        errorPrevia={null}
        onCarregarPrevia={vi.fn()}
        executando={false}
        resultadoExecucao={null}
        errorExecucao={null}
        onExecutarVirada={onExecutarVirada}
        onReiniciar={vi.fn()}
      />
    );

    // Carregar prévia disparando o submit
    const carregarBtn = screen.getByText('Carregar prévia da virada');
    fireEvent.click(carregarBtn);

    // Passo 2
    expect(await screen.findByText(/Revisão de Turmas e Alunos/i)).toBeInTheDocument();
    expect(screen.getByText(/Alice Silva/)).toBeInTheDocument();
    expect(screen.getByText(/Beto Souza/)).toBeInTheDocument();

    // Avançar para Passo 3
    const avancarBtns = screen.getAllByText('Avançar para confirmação');
    fireEvent.click(avancarBtns[0]);

    // Passo 3
    expect(await screen.findByText('Resumo e Confirmação da Virada')).toBeInTheDocument();
    expect(screen.getByText('Confirmar e Executar Virada')).toBeInTheDocument();
    expect(screen.getByText(/Garantia de Preservação dos Dados Históricos/i)).toBeInTheDocument();

    // Confirmar execução
    const confirmarBtn = screen.getByText('Confirmar e Executar Virada');
    fireEvent.click(confirmarBtn);

    expect(onExecutarVirada).toHaveBeenCalledTimes(1);
  });
});
