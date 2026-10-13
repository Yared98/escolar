'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import type { AlunoChamada, MinhaTurma, TurmaOpcao } from '@/lib/types/academico';

export function useTurmaAlunos(preferredRole?: string) {
  const { user } = useAuth();
  const role = preferredRole || user?.role || 'admin';
  const [turmasOpcoes, setTurmasOpcoes] = useState<TurmaOpcao[]>([]);
  const [turmaId, setTurmaId] = useState('');
  const [turmaNome, setTurmaNome] = useState('');
  const [alunos, setAlunos] = useState<AlunoChamada[]>([]);
  const [selectedAlunoId, setSelectedAlunoId] = useState('');
  const [listaErro, setListaErro] = useState<string | null>(null);
  const [loadingTurmas, setLoadingTurmas] = useState(true);
  const [loadingAlunos, setLoadingAlunos] = useState(false);

  const isProfessor = role === 'professor';

  useEffect(() => {
    let ativo = true;
    async function carregarTurmas() {
      setLoadingTurmas(true);
      try {
        let lista: TurmaOpcao[] = [];
        if (isProfessor) {
          const data = await apiFetch<MinhaTurma[]>('/professor/minhas-turmas');
          lista = (data || []).map((t) => ({
            id: t.turma_id,
            nome: t.turma_nome,
            etapa_ensino: t.etapa_ensino,
          }));
        } else {
          const data = await apiFetch<TurmaOpcao[]>('/secretaria/turmas');
          lista = data || [];
        }
        if (!ativo) return;
        setTurmasOpcoes(lista);
        setListaErro(null);
        if (lista.length > 0) {
          setTurmaId(lista[0].id);
          setTurmaNome(lista[0].nome);
        }
      } catch (err: unknown) {
        if (!ativo) return;
        setTurmasOpcoes([]);
        setListaErro(err instanceof Error ? err.message : 'Não foi possível carregar as turmas.');
      } finally {
        if (ativo) setLoadingTurmas(false);
      }
    }
    carregarTurmas();
    return () => {
      ativo = false;
    };
  }, [isProfessor]);

  const selecionarTurma = useCallback(
    (id: string) => {
      setTurmaId(id);
      const found = turmasOpcoes.find((t) => t.id === id);
      setTurmaNome(found?.nome || '');
    },
    [turmasOpcoes]
  );

  useEffect(() => {
    if (!turmaId) {
      setAlunos([]);
      setSelectedAlunoId('');
      return;
    }
    let ativo = true;
    setAlunos([]);
    setSelectedAlunoId('');
    async function carregarAlunos() {
      setLoadingAlunos(true);
      try {
        const data = await apiFetch<
          { aluno_id: string; nome: string; status?: string }[]
        >(`/secretaria/turmas/${turmaId}/alunos`);
        if (!ativo) return;
        // API já devolve só vínculo ativo + aluno ativo; filtro local é defesa em profundidade.
        const mapped = (data || [])
          .filter((aluno) => !aluno.status || aluno.status === 'ativo')
          .map((aluno) => ({
            id: aluno.aluno_id,
            nome: aluno.nome,
            status: 'presente' as const,
          }));
        setAlunos(mapped);
        setListaErro(null);
        setSelectedAlunoId(mapped[0]?.id || '');
      } catch (err: unknown) {
        if (!ativo) return;
        setAlunos([]);
        setSelectedAlunoId('');
        setListaErro(err instanceof Error ? err.message : 'Não foi possível carregar a chamada.');
      } finally {
        if (ativo) setLoadingAlunos(false);
      }
    }
    carregarAlunos();
    return () => {
      ativo = false;
    };
  }, [turmaId]);

  const turmaSelecionada = turmasOpcoes.find((t) => t.id === turmaId) || null;

  return {
    turmasOpcoes,
    turmaId,
    turmaNome,
    turmaSelecionada,
    selecionarTurma,
    alunos,
    setAlunos,
    selectedAlunoId,
    setSelectedAlunoId,
    listaErro,
    setListaErro,
    loadingTurmas,
    loadingAlunos,
  };
}
