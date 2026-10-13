import React, { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChamadaPanel } from './ChamadaPanel';
import type { AlunoChamada } from '@/lib/types/academico';

// Mock apiFetch to avoid real network calls
vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn().mockImplementation(async (url: string) => {
    if (url.includes('recentes')) return [];
    if (url.includes('diario')) return { encontrado: false, presencas: [] };
    return [];
  }),
}));

describe('ChamadaPanel - Recado à família (C16)', () => {
  const alunosMock: AlunoChamada[] = [
    {
      id: 'aluno-1',
      nome: 'Aluno Com Responsável',
      status: 'presente',
      responsavel_user_id: 'user-resp-1',
      responsavel_nome: 'Mãe Teste',
    },
    {
      id: 'aluno-2',
      nome: 'Aluno Sem Responsável',
      status: 'presente',
      responsavel_user_id: null,
      responsavel_nome: '',
    },
  ];

  it('renderiza o botão "Recado à família" com alvos de toque adequados (44px)', async () => {
    await act(async () => {
      render(
        <ChamadaPanel
          modo="fundamental"
          turmaId="turma-1"
          turmaNome="5º Ano A"
          dataAula="2026-10-13"
          onDataAulaChange={vi.fn()}
          alunos={alunosMock}
          setAlunos={vi.fn()}
          isOnline={true}
          tenantId="tenant-1"
          enqueue={vi.fn().mockResolvedValue('uuid')}
          removeByUuid={vi.fn().mockResolvedValue(undefined)}
          showToast={vi.fn()}
          onAbrirOcorrencia={vi.fn()}
          onAbrirRecadoFamilia={vi.fn()}
        />
      );
    });

    const botoesRecado = screen.getAllByRole('button', { name: /recado à família/i });
    expect(botoesRecado).toHaveLength(2);
    for (const btn of botoesRecado) {
      expect(btn.className).toContain('min-h-[44px]');
    }
  });

  it('desabilita o botão para aluno sem responsável com a dica esperada', async () => {
    await act(async () => {
      render(
        <ChamadaPanel
          modo="fundamental"
          turmaId="turma-1"
          turmaNome="5º Ano A"
          dataAula="2026-10-13"
          onDataAulaChange={vi.fn()}
          alunos={alunosMock}
          setAlunos={vi.fn()}
          isOnline={true}
          tenantId="tenant-1"
          enqueue={vi.fn().mockResolvedValue('uuid')}
          removeByUuid={vi.fn().mockResolvedValue(undefined)}
          showToast={vi.fn()}
          onAbrirOcorrencia={vi.fn()}
          onAbrirRecadoFamilia={vi.fn()}
        />
      );
    });

    const botoesRecado = screen.getAllByRole('button', { name: /recado à família/i });
    // aluno-1 tem responsável
    expect(botoesRecado[0]).toHaveProperty('disabled', false);
    expect(botoesRecado[0].getAttribute('title')).toBe('Enviar recado à família');

    // aluno-2 não tem responsável
    expect(botoesRecado[1]).toHaveProperty('disabled', true);
    expect(botoesRecado[1].getAttribute('title')).toBe('Aluno sem responsável cadastrado');
  });

  it('chama onAbrirRecadoFamilia ao clicar no botão habilitado', async () => {
    const onAbrirRecadoMock = vi.fn();
    await act(async () => {
      render(
        <ChamadaPanel
          modo="fundamental"
          turmaId="turma-1"
          turmaNome="5º Ano A"
          dataAula="2026-10-13"
          onDataAulaChange={vi.fn()}
          alunos={alunosMock}
          setAlunos={vi.fn()}
          isOnline={true}
          tenantId="tenant-1"
          enqueue={vi.fn().mockResolvedValue('uuid')}
          removeByUuid={vi.fn().mockResolvedValue(undefined)}
          showToast={vi.fn()}
          onAbrirOcorrencia={vi.fn()}
          onAbrirRecadoFamilia={onAbrirRecadoMock}
        />
      );
    });

    const botoesRecado = screen.getAllByRole('button', { name: /recado à família/i });
    fireEvent.click(botoesRecado[0]);
    expect(onAbrirRecadoMock).toHaveBeenCalledWith(alunosMock[0]);
  });
});
