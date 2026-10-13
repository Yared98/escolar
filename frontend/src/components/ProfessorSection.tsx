'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import type { NavRoute } from '@/components/Sidebar';
import {
  CalendarCheck,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import type {
  AulaDia,
  AvaliacaoCalendario,
  MinhaTurma,
  NovaAvaliacaoPayload,
  NotaAluno,
  PeriodoNota,
  ToastMsg,
} from '@/lib/types/academico';
import { PERIODOS_NOTA } from '@/lib/types/academico';
import { parseNotaInput } from '@/lib/notas';
import { AulasHojePanel } from './professor/AulasHojePanel';
import { AvaliacoesPanel } from './professor/AvaliacoesPanel';
import { LancarNotasPanel } from './professor/LancarNotasPanel';

const hojeLocal = () => {
  const agora = new Date();
  const offset = agora.getTimezoneOffset() * 60000;
  return new Date(agora.getTime() - offset).toISOString().split('T')[0];
};

const adicionarDias = (data: string, dias: number) => {
  const d = new Date(data + 'T00:00:00');
  d.setDate(d.getDate() + dias);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

const formatarDataCabecalho = (data: string) => {
  const hoje = hojeLocal();
  const ontem = adicionarDias(hoje, -1);
  const amanha = adicionarDias(hoje, 1);

  let rotulo = new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  if (data === hoje) rotulo = `Hoje · ${rotulo}`;
  else if (data === ontem) rotulo = `Ontem · ${rotulo}`;
  else if (data === amanha) rotulo = `Amanhã · ${rotulo}`;

  return rotulo.charAt(0).toUpperCase() + rotulo.slice(1);
};

interface ProfessorSectionProps {
  onRouteChange?: (route: NavRoute, targetTab?: string) => void;
}

export function ProfessorSection({ onRouteChange }: ProfessorSectionProps) {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabInicial = searchParams?.get('tab') as 'hoje' | 'notas' | 'avaliacoes' | null;
  const [activeTab, setActiveTab] = useState<'hoje' | 'notas' | 'avaliacoes'>(
    tabInicial === 'notas' || tabInicial === 'avaliacoes' ? tabInicial : 'hoje'
  );

  // A barra inferior e o menu trocam a aba pela URL com a seção já aberta: acompanhar o parâmetro.
  useEffect(() => {
    setActiveTab(
      tabInicial === 'notas' || tabInicial === 'avaliacoes' ? tabInicial : 'hoje'
    );
  }, [tabInicial]);

  const [dataAula, setDataAula] = useState(hojeLocal);
  const [aulas, setAulas] = useState<AulaDia[]>([]);
  const [loadingAulas, setLoadingAulas] = useState(false);
  const [erroAulas, setErroAulas] = useState<string | null>(null);

  const [minhasTurmas, setMinhasTurmas] = useState<MinhaTurma[]>([]);
  const [loadingTurmas, setLoadingTurmas] = useState(false);
  const [erroTurmas, setErroTurmas] = useState<string | null>(null);

  const [turmaId, setTurmaId] = useState('');
  const [disciplinaId, setDisciplinaId] = useState('');
  const [periodo, setPeriodo] = useState<PeriodoNota>('1_bimestre');

  const [alunos, setAlunos] = useState<NotaAluno[]>([]);
  const [loadingAlunos, setLoadingAlunos] = useState(false);
  const [erroAlunos, setErroAlunos] = useState<string | null>(null);

  const [alteracoes, setAlteracoes] = useState<Record<string, number | null>>({});
  const [errosNota, setErrosNota] = useState<Record<string, string | null>>({});
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<ToastMsg | null>(null);

  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoCalendario[]>([]);
  const [loadingAvaliacoes, setLoadingAvaliacoes] = useState(false);
  const [erroAvaliacoes, setErroAvaliacoes] = useState<string | null>(null);
  const [criandoAvaliacao, setCriandoAvaliacao] = useState(false);
  const [removendoAvaliacaoId, setRemovendoAvaliacaoId] = useState<string | null>(null);

  const disciplinasDaTurma = useMemo(() => {
    const turma = minhasTurmas.find((t) => t.turma_id === turmaId);
    return turma?.disciplinas || [];
  }, [minhasTurmas, turmaId]);

  const showToast = useCallback((toast: ToastMsg) => {
    setMensagem(toast);
    setTimeout(() => setMensagem(null), 4000);
  }, []);

  const carregarMinhasTurmas = useCallback(async () => {
    setLoadingTurmas(true);
    setErroTurmas(null);
    try {
      const data = await apiFetch<MinhaTurma[]>('/professor/minhas-turmas');
      const lista = data || [];
      setMinhasTurmas(lista);
      if (lista.length > 0 && !turmaId) {
        setTurmaId(lista[0].turma_id);
        if (lista[0].disciplinas.length > 0) {
          setDisciplinaId(lista[0].disciplinas[0].disciplina_id);
        }
      }
    } catch (err: unknown) {
      setErroTurmas(err instanceof Error ? err.message : 'Não foi possível carregar suas turmas.');
      setMinhasTurmas([]);
    } finally {
      setLoadingTurmas(false);
    }
  }, [turmaId]);

  const carregarAulas = useCallback(async () => {
    setLoadingAulas(true);
    setErroAulas(null);
    try {
      const data = await apiFetch<AulaDia[]>(`/professor/aulas?data=${encodeURIComponent(dataAula)}`);
      setAulas(data || []);
    } catch (err: unknown) {
      setErroAulas(err instanceof Error ? err.message : 'Não foi possível carregar as aulas do dia.');
      setAulas([]);
    } finally {
      setLoadingAulas(false);
    }
  }, [dataAula]);

  const carregarNotas = useCallback(async () => {
    if (!turmaId || !disciplinaId) {
      setAlunos([]);
      return;
    }
    setLoadingAlunos(true);
    setErroAlunos(null);
    try {
      const data = await apiFetch<NotaAluno[]>(
        `/academico/notas?turma_id=${encodeURIComponent(turmaId)}&disciplina_id=${encodeURIComponent(
          disciplinaId
        )}&periodo=${encodeURIComponent(periodo)}`
      );
      const lista = data || [];
      setAlunos(lista);
      setAlteracoes({});
      setErrosNota({});
    } catch (err: unknown) {
      setErroAlunos(err instanceof Error ? err.message : 'Não foi possível carregar as notas.');
      setAlunos([]);
    } finally {
      setLoadingAlunos(false);
    }
  }, [turmaId, disciplinaId, periodo]);

  const carregarAvaliacoes = useCallback(async () => {
    setLoadingAvaliacoes(true);
    setErroAvaliacoes(null);
    try {
      const data = await apiFetch<AvaliacaoCalendario[]>(
        `/avaliacoes?de=${encodeURIComponent(hojeLocal())}`
      );
      setAvaliacoes(data || []);
    } catch (err: unknown) {
      setErroAvaliacoes(
        err instanceof Error ? err.message : 'Não foi possível carregar as avaliações.'
      );
      setAvaliacoes([]);
    } finally {
      setLoadingAvaliacoes(false);
    }
  }, []);

  useEffect(() => {
    void carregarMinhasTurmas();
  }, [carregarMinhasTurmas]);

  useEffect(() => {
    void carregarAulas();
  }, [carregarAulas]);

  useEffect(() => {
    void carregarNotas();
  }, [carregarNotas]);

  useEffect(() => {
    if (activeTab === 'avaliacoes') {
      void carregarAvaliacoes();
    }
  }, [activeTab, carregarAvaliacoes]);

  useEffect(() => {
    const turma = minhasTurmas.find((t) => t.turma_id === turmaId);
    if (turma && disciplinaId) {
      const aindaExiste = turma.disciplinas.some((d) => d.disciplina_id === disciplinaId);
      if (!aindaExiste) {
        setDisciplinaId(turma.disciplinas[0]?.disciplina_id || '');
      }
    }
  }, [minhasTurmas, turmaId, disciplinaId]);

  const aoMudarTurma = (novoTurmaId: string) => {
    if (Object.keys(alteracoes).length > 0) {
      const confirmar = window.confirm(
        'Você tem notas não salvas nesta turma. Deseja trocar de turma e descartar as alterações?'
      );
      if (!confirmar) return;
    }
    setTurmaId(novoTurmaId);
    const turma = minhasTurmas.find((t) => t.turma_id === novoTurmaId);
    setDisciplinaId(turma?.disciplinas[0]?.disciplina_id || '');
  };

  const aoMudarDisciplina = (novoDisciplinaId: string) => {
    if (Object.keys(alteracoes).length > 0) {
      const confirmar = window.confirm(
        'Você tem notas não salvas. Deseja trocar de disciplina e descartar as alterações?'
      );
      if (!confirmar) return;
    }
    setDisciplinaId(novoDisciplinaId);
  };

  const aoMudarPeriodo = (novoPeriodo: PeriodoNota) => {
    if (Object.keys(alteracoes).length > 0) {
      const confirmar = window.confirm(
        'Você tem notas não salvas. Deseja trocar de período e descartar as alterações?'
      );
      if (!confirmar) return;
    }
    setPeriodo(novoPeriodo);
  };

  const aoAlterarNota = (alunoId: string, valor: string) => {
    const original = alunos.find((a) => a.aluno_id === alunoId)?.nota ?? null;
    const resultado = parseNotaInput(valor, original);

    if (resultado.erro) {
      setErrosNota((prev): Record<string, string | null> => ({ ...prev, [alunoId]: resultado.erro! }));
      return;
    }

    setErrosNota((prev) => ({ ...prev, [alunoId]: null }));
    setAlteracoes((prev) => {
      const next = { ...prev };
      if (resultado.nota === original || (resultado.nota === null && original === null)) {
        delete next[alunoId];
      } else {
        next[alunoId] = resultado.nota ?? null;
      }
      return next;
    });
  };

  const salvarNotas = async () => {
    if (!turmaId || !disciplinaId) return;
    if (Object.keys(alteracoes).length === 0) return;
    if (Object.values(errosNota).some((e) => e)) return;

    setSalvando(true);
    try {
      const notas = Object.entries(alteracoes).map(([aluno_id, nota]) => ({
        aluno_id,
        nota,
      }));
      const res = await apiFetch<{ gravadas: number; ignoradas: number }>('/academico/notas/lote', {
        method: 'POST',
        body: JSON.stringify({
          turma_id: turmaId,
          disciplina_id: disciplinaId,
          periodo,
          notas,
        }),
      });
      showToast({
        text: `${res.gravadas} nota${res.gravadas === 1 ? '' : 's'} salva${res.gravadas === 1 ? '' : 's'}`,
        type: 'success',
      });
      await carregarNotas();
    } catch (err: unknown) {
      showToast({
        text: err instanceof Error ? err.message : 'Não foi possível salvar as notas.',
        type: 'warn',
      });
    } finally {
      setSalvando(false);
    }
  };

  const irParaChamada = (turmaIdDestino: string, dataDestino: string) => {
    const params = new URLSearchParams();
    params.set('route', 'academico');
    params.set('turma', turmaIdDestino);
    params.set('data', dataDestino);
    router.push(`/?${params.toString()}`, { scroll: false });
  };

  const criarAvaliacao = async (payload: NovaAvaliacaoPayload) => {
    setCriandoAvaliacao(true);
    try {
      const criada = await apiFetch<AvaliacaoCalendario>('/avaliacoes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast({ text: 'Avaliação marcada no calendário.', type: 'success' });
      setAvaliacoes((prev) =>
        [...prev, criada].sort(
          (a, b) => a.data.localeCompare(b.data) || a.titulo.localeCompare(b.titulo)
        )
      );
    } catch (err: unknown) {
      showToast({
        text: err instanceof Error ? err.message : 'Não foi possível marcar a avaliação.',
        type: 'warn',
      });
    } finally {
      setCriandoAvaliacao(false);
    }
  };

  const removerAvaliacao = async (id: string) => {
    setRemovendoAvaliacaoId(id);
    try {
      await apiFetch(`/avaliacoes/${id}`, { method: 'DELETE' });
      setAvaliacoes((prev) => prev.filter((a) => a.id !== id));
      showToast({ text: 'Avaliação removida do calendário.', type: 'success' });
    } catch (err: unknown) {
      showToast({
        text: err instanceof Error ? err.message : 'Não foi possível remover a avaliação.',
        type: 'warn',
      });
    } finally {
      setRemovendoAvaliacaoId(null);
    }
  };

  const aoTrocarAba = (tab: 'hoje' | 'notas' | 'avaliacoes') => {
    setActiveTab(tab);
    if (onRouteChange) {
      onRouteChange('professor', tab);
    } else {
      const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
      params.set('route', 'professor');
      params.set('tab', tab);
      router.push(`/?${params.toString()}`, { scroll: false });
    }
  };

  return (
    <section
      id="professor"
      className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-4 sm:p-6 shadow-sm relative transition-all"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-salvia-100 dark:border-salvia-800">
        <div>
          <div className="flex items-center space-x-2">
            <CalendarCheck className="w-5 h-5 text-salvia-600 dark:text-salvia-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-salvia-50">Meu dia</h2>
          </div>
          <p className="text-xs text-salvia-600 dark:text-salvia-400 mt-0.5">
            Aulas e notas do(a) professor(a) {user?.name || ''}
          </p>
        </div>
        <div className="flex items-center space-x-1 bg-salvia-100 dark:bg-salvia-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => aoTrocarAba('hoje')}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'hoje'
                ? 'bg-white dark:bg-salvia-700 text-salvia-900 dark:text-salvia-50 shadow-sm'
                : 'text-salvia-700 dark:text-salvia-300 hover:text-slate-900 dark:hover:text-salvia-50'
            }`}
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>Aulas de hoje</span>
          </button>
          <button
            type="button"
            onClick={() => aoTrocarAba('notas')}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'notas'
                ? 'bg-white dark:bg-salvia-700 text-salvia-900 dark:text-salvia-50 shadow-sm'
                : 'text-salvia-700 dark:text-salvia-300 hover:text-slate-900 dark:hover:text-salvia-50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Lançar notas</span>
          </button>
          <button
            type="button"
            onClick={() => aoTrocarAba('avaliacoes')}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'avaliacoes'
                ? 'bg-white dark:bg-salvia-700 text-salvia-900 dark:text-salvia-50 shadow-sm'
                : 'text-salvia-700 dark:text-salvia-300 hover:text-slate-900 dark:hover:text-salvia-50'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Avaliações</span>
          </button>
        </div>
      </div>

      {mensagem && (
        <div
          className={`mb-4 p-3.5 rounded-xl border text-xs font-bold flex items-center space-x-2 transition-all ${
            mensagem.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
              : 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{mensagem.text}</span>
        </div>
      )}

      {activeTab === 'hoje' ? (
        <AulasHojePanel
          dataAula={dataAula}
          tituloData={formatarDataCabecalho(dataAula)}
          onVoltarDia={() => setDataAula((d) => adicionarDias(d, -1))}
          onAvancarDia={() => setDataAula((d) => adicionarDias(d, 1))}
          onHoje={() => setDataAula(hojeLocal)}
          aulas={aulas}
          loadingAulas={loadingAulas}
          erroAulas={erroAulas}
          onTentarAulas={carregarAulas}
          minhasTurmas={minhasTurmas}
          loadingTurmas={loadingTurmas}
          erroTurmas={erroTurmas}
          onTentarTurmas={carregarMinhasTurmas}
          onIrParaChamada={irParaChamada}
        />
      ) : activeTab === 'avaliacoes' ? (
        <AvaliacoesPanel
          avaliacoes={avaliacoes}
          loading={loadingAvaliacoes}
          erro={erroAvaliacoes}
          onTentarNovamente={carregarAvaliacoes}
          minhasTurmas={minhasTurmas}
          criando={criandoAvaliacao}
          onCriar={criarAvaliacao}
          onRemover={removerAvaliacao}
          removendoId={removendoAvaliacaoId}
        />
      ) : (
        <LancarNotasPanel
          minhasTurmas={minhasTurmas}
          turmaId={turmaId}
          onChangeTurma={aoMudarTurma}
          disciplinas={disciplinasDaTurma}
          disciplinaId={disciplinaId}
          onChangeDisciplina={aoMudarDisciplina}
          periodo={periodo}
          onChangePeriodo={aoMudarPeriodo}
          periodos={PERIODOS_NOTA}
          alunos={alunos}
          loadingAlunos={loadingAlunos}
          erroAlunos={erroAlunos}
          alteracoes={alteracoes}
          errosNota={errosNota}
          onAlterarNota={aoAlterarNota}
          onSalvar={salvarNotas}
          salvando={salvando}
        />
      )}
    </section>
  );
}
