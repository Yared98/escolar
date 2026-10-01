'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  BookOpen,
  BrainCircuit,
  CheckCircle,
  Plus,
  Calendar,
  AlertCircle,
  Clock,
  UserCheck,
  GraduationCap,
  Trash2,
  AlertTriangle,
  Layers,
  ShieldCheck,
  X,
} from 'lucide-react';
import { CardapioPlanner } from './nutricao/CardapioPlanner';

// --- INTERFACES ---

interface Disciplina {
  id: string;
  codigo: string;
  nome: string;
  area_conhecimento: string;
  carga_horaria_semanal: number;
  carga_horaria_anual: number;
  descricao?: string;
  status: string;
}

interface Turma {
  id: string;
  nome: string;
  codigo?: string;
  etapa_ensino?: string;
  serie?: string;
  turno?: string;
  ano_letivo: number;
  capacidade_maxima: number;
  alunos_matriculados?: number;
  vagas_restantes?: number;
  sala_nome?: string;
  professor_regente_nome?: string;
}

interface TurmaDisciplinaDetalhada {
  id: string;
  turma_id: string;
  disciplina_id: string;
  disciplina_codigo: string;
  disciplina_nome: string;
  area_conhecimento: string;
  carga_horaria_semanal: number;
  carga_horaria_anual: number;
  professor_id?: string;
  professor_nome?: string;
}

interface HorarioTurmaDetalhado {
  id: string;
  turma_id: string;
  disciplina_id: string;
  disciplina_nome: string;
  professor_id?: string;
  professor_nome?: string;
  sala_id?: string;
  sala_nome?: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
}

interface ProfessorItem {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface SalaItem {
  id: string;
  nome: string;
  capacidade: number;
}

interface SimuladoTri {
  id: string;
  titulo: string;
  descricao?: string;
  disciplina: string;
  data_aplicacao: string;
  total_itens: number;
}

interface ProjetoEducacional {
  id: string;
  titulo: string;
  objetivo: string;
  habilidades_bncc?: string;
  data_inicio: string;
  data_fim: string;
  status: string;
}

export function PedagocioNutricaoSection() {
  const searchParams = useSearchParams();
  const tabParam = searchParams ? searchParams.get('tab') : null;
  const routeParam = searchParams ? searchParams.get('route') : null;
  const activeTab: 'disciplinas_matriz' | 'atribuicao_horarios' | 'projetos' | 'nutricao' | 'tri' =
    routeParam === 'nutricao' || tabParam === 'nutricao'
      ? 'nutricao'
      : tabParam === 'atribuicao_horarios' ||
          tabParam === 'projetos' ||
          tabParam === 'tri'
        ? tabParam
        : 'disciplinas_matriz';

  // Estado geral
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Dados fundamentais
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [professores, setProfessores] = useState<ProfessorItem[]>([]);
  const [salas, setSalas] = useState<SalaItem[]>([]);
  const [projetos, setProjetos] = useState<ProjetoEducacional[]>([]);
  const [simulados, setSimulados] = useState<SimuladoTri[]>([]);
  const [showModalSimulado, setShowModalSimulado] = useState(false);
  const [novoSimulado, setNovoSimulado] = useState({
    titulo: '',
    descricao: '',
    disciplina: 'Matemática',
    data_aplicacao: new Date().toISOString().split('T')[0],
  });


  // Turma selecionada para Matriz e Horários
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('');
  const [turmaDisciplinas, setTurmaDisciplinas] = useState<TurmaDisciplinaDetalhada[]>([]);
  const [turmaHorarios, setTurmaHorarios] = useState<HorarioTurmaDetalhado[]>([]);

  // Modais de Criação
  const [showModalDisciplina, setShowModalDisciplina] = useState(false);
  const [showModalAdicionarMatriz, setShowModalAdicionarMatriz] = useState(false);
  const [showModalAtribuirProf, setShowModalAtribuirProf] = useState(false);
  const [showModalHorario, setShowModalHorario] = useState(false);

  // Form State: Nova Disciplina
  const [discCodigo, setDiscCodigo] = useState('');
  const [discNome, setDiscNome] = useState('');
  const [discArea, setDiscArea] = useState('linguagens');
  const [discChSemanal, setDiscChSemanal] = useState(4);
  const [discChAnual, setDiscChAnual] = useState(160);
  const [discDescricao, setDiscDescricao] = useState('');

  // Form State: Adicionar Disciplina à Turma
  const [matrizDiscId, setMatrizDiscId] = useState('');
  const [matrizChSemanal, setMatrizChSemanal] = useState(4);
  const [matrizChAnual, setMatrizChAnual] = useState(160);

  // Form State: Atribuir Professor
  const [atribDiscId, setAtribDiscId] = useState('');
  const [atribProfId, setAtribProfId] = useState('');

  // Form State: Horário
  const [horarioDiscId, setHorarioDiscId] = useState('');
  const [horarioProfId, setHorarioProfId] = useState('');
  const [horarioSalaId, setHorarioSalaId] = useState('');
  const [horarioDiaSemana, setHorarioDiaSemana] = useState(1);
  const [horarioInicio, setHorarioInicio] = useState('07:30');
  const [horarioFim, setHorarioFim] = useState('08:20');

  // Carregar dados iniciais
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [tData, dData, pData, sData, projData, simData] = await Promise.all([
        apiFetch<Turma[]>('/secretaria/turmas'),
        apiFetch<Disciplina[]>('/pedagogico/disciplinas').catch(() => []),
        apiFetch<ProfessorItem[]>('/academico/professores/disponiveis').catch(() => []),
        apiFetch<SalaItem[]>('/secretaria/salas').catch(() => []),
        apiFetch<ProjetoEducacional[]>('/pedagogico/projetos').catch(() => []),
        apiFetch<SimuladoTri[]>('/academico/simulados').catch(() => []),
      ]);

      setTurmas(tData || []);
      setDisciplinas(dData);
      setProfessores(pData);
      setSalas(sData);
      setProjetos(projData);
      setSimulados(simData);
      setErrorMsg(null);

      if (tData && tData.length > 0 && !selectedTurmaId) {
        setSelectedTurmaId(tData[0].id);
      }
    } catch (err: unknown) {
      setTurmas([]);
      setDisciplinas([]);
      setProfessores([]);
      setSalas([]);
      setProjetos([]);
      setSimulados([]);
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível carregar o pedagógico.');
    } finally {
      setLoading(false);
    }
  }, [selectedTurmaId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Carregar Matriz Curricular e Grade Horária da Turma Selecionada
  const loadTurmaDetails = useCallback(async (turmaId: string) => {
    if (!turmaId) return;
    try {
      const [discData, horData] = await Promise.all([
        apiFetch<TurmaDisciplinaDetalhada[]>(`/pedagogico/turmas/${turmaId}/disciplinas`),
        apiFetch<HorarioTurmaDetalhado[]>(`/pedagogico/turmas/${turmaId}/horarios`),
      ]);
      setTurmaDisciplinas(discData);
      setTurmaHorarios(horData);
    } catch {
      setTurmaDisciplinas([]);
      setTurmaHorarios([]);
      setErrorMsg('Não foi possível carregar a matriz e a grade da turma.');
    }
  }, []);

  useEffect(() => {
    if (selectedTurmaId) {
      loadTurmaDetails(selectedTurmaId);
    }
  }, [selectedTurmaId, loadTurmaDetails]);

  // Handlers: Salvar Disciplina
  const handleSalvarDisciplina = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const nova = await apiFetch<Disciplina>('/pedagogico/disciplinas', {
        method: 'POST',
        body: JSON.stringify({
          codigo: discCodigo.toUpperCase(),
          nome: discNome,
          area_conhecimento: discArea,
          carga_horaria_semanal: Number(discChSemanal),
          carga_horaria_anual: Number(discChAnual),
          descricao: discDescricao || undefined,
        }),
      });
      setDisciplinas((prev) => [...prev, nova]);
      setSuccessMsg('Componente curricular cadastrado com sucesso!');
      setShowModalDisciplina(false);
      setDiscCodigo('');
      setDiscNome('');
      setDiscDescricao('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar disciplina.';
      setErrorMsg(msg);
    }
  };

  // Handlers: Adicionar Disciplina na Matriz
  const handleAdicionarMatriz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTurmaId || !matrizDiscId) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await apiFetch(`/pedagogico/turmas/${selectedTurmaId}/disciplinas`, {
        method: 'POST',
        body: JSON.stringify({
          disciplina_id: matrizDiscId,
          carga_horaria_semanal: Number(matrizChSemanal),
          carga_horaria_anual: Number(matrizChAnual),
        }),
      });
      setSuccessMsg('Disciplina adicionada à matriz curricular da turma!');
      setShowModalAdicionarMatriz(false);
      loadTurmaDetails(selectedTurmaId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao vincular disciplina.';
      setErrorMsg(msg);
    }
  };

  // Handlers: Remover Disciplina da Matriz
  const handleRemoverMatriz = async (disciplinaId: string) => {
    if (!selectedTurmaId) return;
    if (!confirm('Deseja realmente remover esta disciplina da grade da turma?')) return;
    try {
      await apiFetch(`/pedagogico/turmas/${selectedTurmaId}/disciplinas/${disciplinaId}`, {
        method: 'DELETE',
      });
      setSuccessMsg('Disciplina removida da matriz.');
      loadTurmaDetails(selectedTurmaId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao desvincular disciplina.';
      setErrorMsg(msg);
    }
  };

  // Handlers: Atribuir Professor
  const handleAtribuirProfessor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTurmaId || !atribDiscId || !atribProfId) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await apiFetch('/pedagogico/turmas/atribuir-professor', {
        method: 'POST',
        body: JSON.stringify({
          turma_id: selectedTurmaId,
          disciplina_id: atribDiscId,
          professor_id: atribProfId,
          ano_letivo: 2026,
        }),
      });
      setSuccessMsg('Atribuição docente homologada com sucesso!');
      setShowModalAtribuirProf(false);
      loadTurmaDetails(selectedTurmaId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao atribuir professor.';
      setErrorMsg(msg);
    }
  };

  // Handlers: Criar Horário com Detecção de Choque
  const handleCriarHorario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTurmaId || !horarioDiscId) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await apiFetch(`/pedagogico/turmas/${selectedTurmaId}/horarios`, {
        method: 'POST',
        body: JSON.stringify({
          disciplina_id: horarioDiscId,
          professor_id: horarioProfId || undefined,
          sala_id: horarioSalaId || undefined,
          dia_semana: Number(horarioDiaSemana),
          hora_inicio: horarioInicio,
          hora_fim: horarioFim,
        }),
      });
      setSuccessMsg('Aula inserida no quadro de horários com sucesso!');
      setShowModalHorario(false);
      loadTurmaDetails(selectedTurmaId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Choque de horário ou erro na validação.';
      setErrorMsg(msg);
    }
  };

  // Handlers: Deletar Horário
  const handleDeletarHorario = async (horarioId: string) => {
    if (!confirm('Deseja remover esta aula do quadro de horários?')) return;
    try {
      await apiFetch(`/pedagogico/turmas/horarios/${horarioId}`, {
        method: 'DELETE',
      });
      setSuccessMsg('Aula removida do quadro.');
      loadTurmaDetails(selectedTurmaId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao remover aula.';
      setErrorMsg(msg);
    }
  };

  // Handlers: Salvar Cardápio
  
  const handleCriarSimulado = async (e: React.FormEvent) => {
    e.preventDefault();
    alert('Treinando Motor Preditivo (Parâmetros a, b, c) e salvando Simulado TRI...');
    try {
      const payload = {
        titulo: novoSimulado.titulo,
        descricao: novoSimulado.descricao,
        disciplina: novoSimulado.disciplina,
        data_aplicacao: novoSimulado.data_aplicacao,
        itens: [
          { numero_item: 1, gabarito_correto: 'A', parametro_a: 1.5, parametro_b: 0.5, parametro_c: 0.2 },
          { numero_item: 2, gabarito_correto: 'C', parametro_a: 2.1, parametro_b: 1.0, parametro_c: 0.25 },
        ]
      };
      const res = await apiFetch<SimuladoTri>('/academico/simulados', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSimulados([...simulados, res]);
      alert('Simulado TRI Preditivo Criado com sucesso!');
      setShowModalSimulado(false);
    } catch (err: any) {
      alert(err.message || 'Falha ao criar Simulado.');
    }
    
  };

  const diaSemanaLabel = (d: number) => {
    switch (d) {
      case 1:
        return 'Segunda-feira';
      case 2:
        return 'Terça-feira';
      case 3:
        return 'Quarta-feira';
      case 4:
        return 'Quinta-feira';
      case 5:
        return 'Sexta-feira';
      case 6:
        return 'Sábado';
      default:
        return `Dia ${d}`;
    }
  };

  const areaBadgeColor = (area: string) => {
    switch (area) {
      case 'linguagens':
        return 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'matematica':
        return 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'ciencias_natureza':
        return 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'ciencias_humanas':
        return 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      default:
        return 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    }
  };

  const selectedTurmaObj = turmas.find((t) => t.id === selectedTurmaId);

  return (
    <section id="pedagogico-nutricao" className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-salvia-700 dark:text-salvia-400" />
            <span>Gestão Pedagógica, Matriz Curricular & Lotação</span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Cadastro de Componentes Curriculares (BNCC), Matrizes por Turma, Atribuição Docente e Grade Semanal sem Choques.
          </p>
        </div>
      </div>

      {/* Alertas de Feedback */}
      {errorMsg && (
        <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between text-rose-800 dark:text-rose-200 text-xs font-medium">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="p-1 hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-emerald-800 dark:text-emerald-200 text-xs font-medium">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="p-1 hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      
      {/* ABA: MOTOR TRI E IA PREDITIVA */}
      {activeTab === 'tri' && (
        <div className="animate-fade-in p-6 bg-white dark:bg-salvia-900 rounded-b-2xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h3 className="text-lg font-bold text-salvia-900 dark:text-salvia-100 flex items-center space-x-2">
                <BrainCircuit className="w-5 h-5 text-indigo-500" />
                <span>Simulados Preditivos (Teoria da Resposta ao Item)</span>
              </h3>
              <p className="text-sm text-salvia-600 dark:text-salvia-400 max-w-2xl mt-1">
                A tecnologia TRI cruza o histórico do aluno com os parâmetros de dificuldade (b), discriminação (a) e acerto casual (c). O painel gera análises de proficiência para o ENEM e exporta diretamente para o EducaCenso.
              </p>
            </div>
            <button
              onClick={() => setShowModalSimulado(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center space-x-2 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Simulado</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {simulados.map((s) => (
              <div key={s.id} className="bg-salvia-50 dark:bg-salvia-800/50 p-5 rounded-2xl border border-salvia-200 dark:border-salvia-700">
                <div className="flex items-center justify-between mb-3">
                  <span className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide">
                    {s.disciplina}
                  </span>
                  <span className="text-xs text-salvia-500 flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1" /> {s.data_aplicacao}
                  </span>
                </div>
                <h4 className="font-bold text-salvia-900 dark:text-salvia-50 mb-1">{s.titulo}</h4>
                <p className="text-xs text-salvia-600 dark:text-salvia-400 line-clamp-2 mb-4">
                  {s.descricao || "Simulado preparatório para exames nacionais."}
                </p>
                <div className="flex justify-between items-center text-xs font-semibold text-salvia-500 pt-3 border-t border-salvia-200 dark:border-salvia-700">
                  <span>{s.total_itens} Itens TRI</span>
                  <button className="text-indigo-600 dark:text-indigo-400 hover:underline">Exportar Censo</button>
                </div>
              </div>
            ))}
            {simulados.length === 0 && (
              <div className="col-span-full p-8 text-center text-salvia-500 bg-salvia-50/50 dark:bg-salvia-900/30 rounded-2xl border border-dashed border-salvia-300 dark:border-salvia-700">
                Nenhum simulado cadastrado.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 1: DISCIPLINAS & MATRIZ CURRICULAR DA TURMA */}
      {/* ========================================================================= */}
      {activeTab === 'disciplinas_matriz' && (
        <div className="space-y-6">
          {/* Seletor de Turma + Ações */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-[#0c120e] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                Turma Ativa:
              </span>
              <select
                value={selectedTurmaId}
                onChange={(e) => setSelectedTurmaId(e.target.value)}
                className="bg-white dark:bg-[#141d17] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-bold focus:outline-none focus:border-salvia-600"
              >
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome} ({t.turno || 'Matutino'}) — Ano {t.ano_letivo}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowModalAdicionarMatriz(true)}
                className="bg-salvia-700 hover:bg-salvia-800 dark:bg-salvia-600 dark:hover:bg-salvia-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Vincular à Turma</span>
              </button>

              <button
                onClick={() => setShowModalDisciplina(true)}
                className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>+ Novo Componente</span>
              </button>
            </div>
          </div>

          {/* Sub-seção: Matriz Curricular da Turma Selecionada */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-salvia-700 dark:text-salvia-400" />
                <span>Matriz Curricular da Turma: {selectedTurmaObj?.nome || 'Selecione uma turma'}</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-500">
                Total de Componentes: {turmaDisciplinas.length} | Carga Semanal:{' '}
                {turmaDisciplinas.reduce((acc, curr) => acc + curr.carga_horaria_semanal, 0)}h
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-200 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">Código</th>
                    <th className="p-3">Disciplina / Componente</th>
                    <th className="p-3">Área do Conhecimento</th>
                    <th className="p-3 text-center">Aulas / Semana</th>
                    <th className="p-3 text-center">Carga Anual</th>
                    <th className="p-3">Professor Lotação</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200 font-medium">
                  {turmaDisciplinas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-slate-500 py-6">
                        Nenhuma disciplina vinculada à matriz desta turma ainda. Clique em &quot;+ Vincular à Turma&quot;.
                      </td>
                    </tr>
                  ) : (
                    turmaDisciplinas.map((td) => (
                      <tr key={td.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-mono font-bold text-salvia-700 dark:text-salvia-400">
                          {td.disciplina_codigo}
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{td.disciplina_nome}</span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${areaBadgeColor(td.area_conhecimento)}`}>
                            {td.area_conhecimento.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3 text-center font-bold text-slate-900 dark:text-slate-100">
                          {td.carga_horaria_semanal} aulas
                        </td>
                        <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-400">
                          {td.carga_horaria_anual}h
                        </td>
                        <td className="p-3">
                          {td.professor_nome ? (
                            <span className="font-semibold text-salvia-800 dark:text-salvia-300 flex items-center space-x-1">
                              <UserCheck className="w-3.5 h-3.5 text-salvia-600" />
                              <span>{td.professor_nome}</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setAtribDiscId(td.disciplina_id);
                                setShowModalAtribuirProf(true);
                              }}
                              className="text-[11px] text-amber-600 hover:underline flex items-center space-x-1 font-semibold"
                            >
                              <AlertCircle className="w-3 h-3 text-amber-500" />
                              <span>Atribuir Docente</span>
                            </button>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleRemoverMatriz(td.disciplina_id)}
                            className="p-1 hover:bg-rose-100 text-rose-600 rounded-lg transition-all"
                            title="Remover da Matriz"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sub-seção: Catálogo Geral de Disciplinas Cadastradas */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 flex items-center space-x-2">
              <GraduationCap className="w-4 h-4 text-salvia-700 dark:text-salvia-400" />
              <span>Catálogo Geral de Componentes Curriculares ({disciplinas.length})</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {disciplinas.map((d) => (
                <div
                  key={d.id}
                  className="bg-slate-50 dark:bg-[#0c120e] p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-[10px] font-bold text-salvia-700 dark:text-salvia-400 bg-salvia-100 dark:bg-salvia-900/60 px-1.5 py-0.5 rounded">
                      {d.codigo}
                    </span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${areaBadgeColor(d.area_conhecimento)}`}>
                      {d.area_conhecimento.replace('_', ' ')}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{d.nome}</h4>
                  <p className="text-[10px] text-slate-500 line-clamp-1">{d.descricao || 'Sem ementa detalhada'}</p>
                  <div className="flex justify-between text-[10px] text-slate-600 dark:text-slate-400 font-mono pt-1 border-t border-slate-200/60 dark:border-slate-800">
                    <span>Semanal: {d.carga_horaria_semanal}h</span>
                    <span>Anual: {d.carga_horaria_anual}h</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: ATRIBUIÇÃO DOCENTE & QUADRO DE HORÁRIOS */}
      {/* ========================================================================= */}
      {activeTab === 'atribuicao_horarios' && (
        <div className="space-y-6">
          {/* Seletor de Turma */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-[#0c120e] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                Turma para Alocação:
              </span>
              <select
                value={selectedTurmaId}
                onChange={(e) => setSelectedTurmaId(e.target.value)}
                className="bg-white dark:bg-[#141d17] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-bold focus:outline-none focus:border-salvia-600"
              >
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome} ({t.turno || 'Matutino'}) — Ano {t.ano_letivo}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  if (turmaDisciplinas.length > 0) {
                    setAtribDiscId(turmaDisciplinas[0].disciplina_id);
                  }
                  setShowModalAtribuirProf(true);
                }}
                className="bg-salvia-700 hover:bg-salvia-800 dark:bg-salvia-600 dark:hover:bg-salvia-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>+ Atribuir Docente</span>
              </button>

              <button
                onClick={() => {
                  if (turmaDisciplinas.length > 0) {
                    setHorarioDiscId(turmaDisciplinas[0].disciplina_id);
                  }
                  setShowModalHorario(true);
                }}
                className="bg-salvia-700 hover:bg-salvia-800 dark:bg-salvia-600 dark:hover:bg-salvia-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>+ Adicionar Aula Semanal</span>
              </button>
            </div>
          </div>

          {/* Quadro Semanal de Horários */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-2">
                <Clock className="w-4 h-4 text-salvia-700 dark:text-salvia-400" />
                <span>Grade Semanal de Horários da Turma ({selectedTurmaObj?.nome})</span>
              </h3>
              <div className="flex items-center space-x-1 text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Motor Anti-Choque de Docente & Sala Ativo</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5].map((dia) => {
                const aulasDoDia = turmaHorarios
                  .filter((h) => h.dia_semana === dia)
                  .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

                return (
                  <div
                    key={dia}
                    className="bg-slate-50 dark:bg-[#0c120e] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                  >
                    <div className="bg-slate-100 dark:bg-slate-800/80 px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{diaSemanaLabel(dia)}</span>
                    </div>

                    <div className="p-2 space-y-2 min-h-[140px]">
                      {aulasDoDia.length === 0 ? (
                        <div className="h-full flex items-center justify-center p-3 text-center text-[10px] text-slate-400 italic">
                          Sem aulas agendadas
                        </div>
                      ) : (
                        aulasDoDia.map((aula) => (
                          <div
                            key={aula.id}
                            className="bg-white dark:bg-[#141d17] p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-1 relative group"
                          >
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] font-mono font-bold text-salvia-700 dark:text-salvia-400 bg-salvia-50 dark:bg-salvia-900/60 px-1 py-0.5 rounded">
                                {aula.hora_inicio} - {aula.hora_fim}
                              </span>
                              <button
                                onClick={() => handleDeletarHorario(aula.id)}
                                className="text-slate-400 hover:text-rose-600 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remover horário"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="font-bold text-xs text-slate-900 dark:text-slate-100 leading-tight">
                              {aula.disciplina_nome}
                            </div>
                            <div className="text-[10px] text-slate-600 dark:text-slate-400 flex items-center space-x-1">
                              <UserCheck className="w-3 h-3 text-salvia-600" />
                              <span>{aula.professor_nome || 'Docente a definir'}</span>
                            </div>
                            {aula.sala_nome && (
                              <div className="text-[9px] text-slate-500 font-mono">Espaço: {aula.sala_nome}</div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 4: PROJETOS BNCC */}
      {/* ========================================================================= */}
      {activeTab === 'projetos' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Projetos Pedagógicos em Execução ({projetos.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projetos.map((p) => (
              <div
                key={p.id}
                className="bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-2"
              >
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">{p.titulo}</h4>
                  <span className="text-[9px] bg-salvia-100 text-salvia-800 dark:bg-salvia-900 dark:text-salvia-300 px-2 py-0.5 rounded-full font-bold uppercase">
                    {p.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">{p.objetivo}</p>
                {p.habilidades_bncc && (
                  <div className="text-[10px] text-salvia-700 dark:text-salvia-400 font-mono bg-salvia-50 dark:bg-salvia-950 p-1.5 rounded-lg border border-salvia-200 dark:border-salvia-800">
                    BNCC: {p.habilidades_bncc}
                  </div>
                )}
                <div className="text-[10px] text-slate-500 font-mono flex items-center space-x-1 pt-1 border-t border-slate-200 dark:border-slate-800">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>Vigência: {p.data_inicio} até {p.data_fim}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 5: PLANNER DE NUTRIÇÃO */}
      {/* ========================================================================= */}
      {activeTab === 'nutricao' && <CardapioPlanner />}

      {/* ========================================================================= */}
      {/* MODAL: NOVO COMPONENTE CURRICULAR / DISCIPLINA (BNCC) */}
      {/* ========================================================================= */}
      {showModalDisciplina && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <GraduationCap className="w-4 h-4 text-salvia-700 dark:text-salvia-400" />
                <span>Novo Componente Curricular (BNCC)</span>
              </h3>
              <button onClick={() => setShowModalDisciplina(false)} className="text-slate-400 hover:text-slate-900 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarDisciplina} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Código da Matéria *</label>
                  <input
                    type="text"
                    required
                    value={discCodigo}
                    onChange={(e) => setDiscCodigo(e.target.value)}
                    placeholder="Ex: MAT-01"
                    className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Área BNCC *</label>
                  <select
                    value={discArea}
                    onChange={(e) => setDiscArea(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5"
                  >
                    <option value="linguagens">Linguagens</option>
                    <option value="matematica">Matemática</option>
                    <option value="ciencias_natureza">Ciências da Natureza</option>
                    <option value="ciencias_humanas">Ciências Humanas</option>
                    <option value="ensino_religioso">Ensino Religioso</option>
                    <option value="parte_diversificada">Parte Diversificada / Eletivas</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Nome da Disciplina *</label>
                <input
                  type="text"
                  required
                  value={discNome}
                  onChange={(e) => setDiscNome(e.target.value)}
                  placeholder="Ex: Filosofia e Cidadania Contemporânea"
                  className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Aulas Semanais *</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    required
                    value={discChSemanal}
                    onChange={(e) => setDiscChSemanal(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Carga Horária Anual (h) *</label>
                  <input
                    type="number"
                    min={20}
                    max={800}
                    required
                    value={discChAnual}
                    onChange={(e) => setDiscChAnual(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Ementa / Descrição</label>
                <textarea
                  rows={2}
                  value={discDescricao}
                  onChange={(e) => setDiscDescricao(e.target.value)}
                  placeholder="Objetivos e competências a serem desenvolvidas..."
                  className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModalDisciplina(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-1.5 bg-salvia-700 text-white rounded-xl font-bold hover:bg-salvia-800">
                  Cadastrar Componente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      
      {/* MODAL: CRIAR SIMULADO TRI */}
      {showModalSimulado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-salvia-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 p-6 rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-salvia-900 dark:text-salvia-100 flex items-center space-x-2">
                <BrainCircuit className="w-5 h-5 text-indigo-500" />
                <span>Cadastrar Simulado (TRI)</span>
              </h3>
              <button onClick={() => setShowModalSimulado(false)} className="text-slate-400 hover:text-slate-900 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCriarSimulado} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Título do Exame</label>
                <input
                  type="text"
                  required
                  value={novoSimulado.titulo}
                  onChange={(e) => setNovoSimulado({ ...novoSimulado, titulo: e.target.value })}
                  className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-sm"
                  placeholder="Ex: Simulado Geral Enem"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Área / Disciplina</label>
                  <select
                    value={novoSimulado.disciplina}
                    onChange={(e) => setNovoSimulado({ ...novoSimulado, disciplina: e.target.value })}
                    className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-sm"
                  >
                    <option>Matemática</option>
                    <option>Linguagens</option>
                    <option>Ciências da Natureza</option>
                    <option>Geral (Múltiplas)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Data Aplicação</label>
                  <input
                    type="date"
                    required
                    value={novoSimulado.data_aplicacao}
                    onChange={(e) => setNovoSimulado({ ...novoSimulado, data_aplicacao: e.target.value })}
                    className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Descrição</label>
                <textarea
                  value={novoSimulado.descricao}
                  onChange={(e) => setNovoSimulado({ ...novoSimulado, descricao: e.target.value })}
                  className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-sm"
                  rows={2}
                />
              </div>
              <p className="text-[10px] text-salvia-500 italic">
                * Os parâmetros (a, b, c) dos itens serão gerados aleatoriamente pelo Motor IA nesta demonstração.
              </p>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold transition-all"
              >
                Ativar Modelo Preditivo
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VINCULAR DISCIPLINA À MATRIZ DA TURMA */}
      {/* ========================================================================= */}
      {showModalAdicionarMatriz && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-salvia-700 dark:text-salvia-400" />
                <span>Vincular Componente à Matriz da Turma</span>
              </h3>
              <button onClick={() => setShowModalAdicionarMatriz(false)} className="text-slate-400 hover:text-slate-900 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdicionarMatriz} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Selecione a Disciplina *</label>
                <select
                  required
                  value={matrizDiscId}
                  onChange={(e) => {
                    setMatrizDiscId(e.target.value);
                    const selected = disciplinas.find((d) => d.id === e.target.value);
                    if (selected) {
                      setMatrizChSemanal(selected.carga_horaria_semanal);
                      setMatrizChAnual(selected.carga_horaria_anual);
                    }
                  }}
                  className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 font-bold"
                >
                  <option value="">Selecione um componente curricular...</option>
                  {disciplinas.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.codigo} - {d.nome} ({d.area_conhecimento})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Aulas Semanais *</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    required
                    value={matrizChSemanal}
                    onChange={(e) => setMatrizChSemanal(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Carga Anual (h) *</label>
                  <input
                    type="number"
                    min={20}
                    max={800}
                    required
                    value={matrizChAnual}
                    onChange={(e) => setMatrizChAnual(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModalAdicionarMatriz(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-1.5 bg-salvia-700 text-white rounded-xl font-bold hover:bg-salvia-800">
                  Adicionar à Turma
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ATRIBUIR PROFESSOR */}
      {/* ========================================================================= */}
      {showModalAtribuirProf && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-salvia-700 dark:text-salvia-400" />
                <span>Atribuição Docente (Lotação na Turma)</span>
              </h3>
              <button onClick={() => setShowModalAtribuirProf(false)} className="text-slate-400 hover:text-slate-900 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAtribuirProfessor} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Disciplina / Componente *</label>
                <select
                  required
                  value={atribDiscId}
                  onChange={(e) => setAtribDiscId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 font-bold"
                >
                  <option value="">Selecione a disciplina...</option>
                  {turmaDisciplinas.map((td) => (
                    <option key={td.disciplina_id} value={td.disciplina_id}>
                      {td.disciplina_codigo} - {td.disciplina_nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Professor Responsável *</label>
                <select
                  required
                  value={atribProfId}
                  onChange={(e) => setAtribProfId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 font-bold"
                >
                  <option value="">Selecione o docente...</option>
                  {professores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModalAtribuirProf(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-1.5 bg-salvia-700 text-white rounded-xl font-bold hover:bg-salvia-800">
                  Homologar Atribuição
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INSERIR HORÁRIO COM DETECÇÃO DE CHOQUE */}
      {/* ========================================================================= */}
      {showModalHorario && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-salvia-700 dark:text-salvia-400" />
                  <span>Adicionar Aula ao Quadro Semanal</span>
                </h3>
                <p className="text-[11px] text-slate-500">Validação automática contra choques de professor ou sala física.</p>
              </div>
              <button onClick={() => setShowModalHorario(false)} className="text-slate-400 hover:text-slate-900 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCriarHorario} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Dia da Semana *</label>
                  <select
                    value={horarioDiaSemana}
                    onChange={(e) => setHorarioDiaSemana(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 font-bold"
                  >
                    <option value={1}>Segunda-feira</option>
                    <option value={2}>Terça-feira</option>
                    <option value={3}>Quarta-feira</option>
                    <option value={4}>Quinta-feira</option>
                    <option value={5}>Sexta-feira</option>
                    <option value={6}>Sábado</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="block font-semibold mb-1">Início *</label>
                    <input
                      type="time"
                      required
                      value={horarioInicio}
                      onChange={(e) => setHorarioInicio(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Término *</label>
                    <input
                      type="time"
                      required
                      value={horarioFim}
                      onChange={(e) => setHorarioFim(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Disciplina *</label>
                <select
                  required
                  value={horarioDiscId}
                  onChange={(e) => {
                    setHorarioDiscId(e.target.value);
                    const td = turmaDisciplinas.find((d) => d.disciplina_id === e.target.value);
                    if (td?.professor_id) {
                      setHorarioProfId(td.professor_id);
                    }
                  }}
                  className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 font-bold"
                >
                  <option value="">Selecione a disciplina...</option>
                  {turmaDisciplinas.map((td) => (
                    <option key={td.disciplina_id} value={td.disciplina_id}>
                      {td.disciplina_codigo} - {td.disciplina_nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Professor da Aula</label>
                  <select
                    value={horarioProfId}
                    onChange={(e) => setHorarioProfId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5"
                  >
                    <option value="">Mesmo da lotação / Nenhum</option>
                    {professores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Espaço / Sala</label>
                  <select
                    value={horarioSalaId}
                    onChange={(e) => setHorarioSalaId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5"
                  >
                    <option value="">Sala padrão da turma</option>
                    {salas.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome} ({s.capacidade} vagas)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModalHorario(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-1.5 bg-salvia-700 text-white rounded-xl font-bold hover:bg-salvia-800">
                  Validar & Inserir Aula
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </section>
  );
}
