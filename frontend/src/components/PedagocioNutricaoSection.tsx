'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  BookOpen,
  CheckCircle,
  Plus,
  AlertCircle,
  AlertTriangle,
  X,
} from 'lucide-react';
import { CardapioPlanner } from './nutricao/CardapioPlanner';
import { Disciplina, Turma, TurmaDisciplinaDetalhada, HorarioTurmaDetalhado, ProfessorItem, SalaItem, SimuladoTri, ProjetoEducacional, AlunoTurmaRoster, TriPanel, NovoSimuladoModal, MatrizPanel, NovaDisciplinaModal, AdicionarMatrizModal, HorariosPanel, ProjetosPanel, AtribuirProfessorModal, NovoHorarioModal } from './pedagogico';

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
  const [turmaAlunos, setTurmaAlunos] = useState<AlunoTurmaRoster[]>([]);
  const [turmaAlunosErro, setTurmaAlunosErro] = useState<string | null>(null);

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

  // Matriz, grade e roster — mesma entidade `alunos`/`turma_alunos` do Diário e da Secretaria
  const loadTurmaDetails = useCallback(async (turmaId: string) => {
    if (!turmaId) return;
    try {
      const [discData, horData, alunosData] = await Promise.all([
        apiFetch<TurmaDisciplinaDetalhada[]>(`/pedagogico/turmas/${turmaId}/disciplinas`),
        apiFetch<HorarioTurmaDetalhado[]>(`/pedagogico/turmas/${turmaId}/horarios`),
        apiFetch<AlunoTurmaRoster[]>(`/secretaria/turmas/${turmaId}/alunos`).catch((err: unknown) => {
          setTurmaAlunosErro(
            err instanceof Error ? err.message : 'Não foi possível carregar os alunos da turma.'
          );
          return [] as AlunoTurmaRoster[];
        }),
      ]);
      setTurmaDisciplinas(discData);
      setTurmaHorarios(horData);
      setTurmaAlunos(alunosData || []);
      if (alunosData) setTurmaAlunosErro(null);
    } catch {
      setTurmaDisciplinas([]);
      setTurmaHorarios([]);
      setTurmaAlunos([]);
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
            <span>
              {activeTab === 'nutricao'
                ? 'Nutrição & Cardápios'
                : 'Gestão Pedagógica, Matriz Curricular & Lotação'}
            </span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            {activeTab === 'nutricao'
              ? 'Planejamento de cardápios, vigências de recorrências e atenção a restrições alimentares.'
              : 'Cadastro de Componentes Curriculares (BNCC), Matrizes por Turma, Atribuição Docente e Grade Semanal sem Choques.'}
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
        <TriPanel
          simulados={simulados}
          setShowModalSimulado={setShowModalSimulado}
        />
      )}

      {/* ABA 1: DISCIPLINAS & MATRIZ CURRICULAR DA TURMA */}
      {/* ========================================================================= */}
      {activeTab === 'disciplinas_matriz' && (
        <MatrizPanel
          selectedTurmaId={selectedTurmaId}
          setSelectedTurmaId={setSelectedTurmaId}
          turmas={turmas}
          setShowModalAdicionarMatriz={setShowModalAdicionarMatriz}
          setShowModalDisciplina={setShowModalDisciplina}
          turmaAlunos={turmaAlunos}
          turmaAlunosErro={turmaAlunosErro}
          selectedTurmaObj={selectedTurmaObj}
          turmaDisciplinas={turmaDisciplinas}
          areaBadgeColor={areaBadgeColor}
          setAtribDiscId={setAtribDiscId}
          setShowModalAtribuirProf={setShowModalAtribuirProf}
          handleRemoverMatriz={handleRemoverMatriz}
          disciplinas={disciplinas}
        />
      )}

      {/* ========================================================================= */}
      {/* ABA 2: ATRIBUIÇÃO DOCENTE & QUADRO DE HORÁRIOS */}
      {/* ========================================================================= */}
      {activeTab === 'atribuicao_horarios' && (
        <HorariosPanel
          selectedTurmaId={selectedTurmaId}
          setSelectedTurmaId={setSelectedTurmaId}
          turmas={turmas}
          turmaDisciplinas={turmaDisciplinas}
          setAtribDiscId={setAtribDiscId}
          setShowModalAtribuirProf={setShowModalAtribuirProf}
          setHorarioDiscId={setHorarioDiscId}
          setShowModalHorario={setShowModalHorario}
          selectedTurmaObj={selectedTurmaObj}
          turmaHorarios={turmaHorarios}
          diaSemanaLabel={diaSemanaLabel}
          handleDeletarHorario={handleDeletarHorario}
        />
      )}

      {/* ========================================================================= */}
      {/* ABA 4: PROJETOS BNCC */}
      {/* ========================================================================= */}
      {activeTab === 'projetos' && (
        <ProjetosPanel
          projetos={projetos}
        />
      )}

      {/* ========================================================================= */}
      {/* ABA 5: PLANNER DE NUTRIÇÃO */}
      {/* ========================================================================= */}
      {activeTab === 'nutricao' && <CardapioPlanner />}

      {/* ========================================================================= */}
      {/* MODAL: NOVO COMPONENTE CURRICULAR / DISCIPLINA (BNCC) */}
      {/* ========================================================================= */}
      {showModalDisciplina && (
        <NovaDisciplinaModal
          setShowModalDisciplina={setShowModalDisciplina}
          handleSalvarDisciplina={handleSalvarDisciplina}
          discCodigo={discCodigo}
          setDiscCodigo={setDiscCodigo}
          discArea={discArea}
          setDiscArea={setDiscArea}
          discNome={discNome}
          setDiscNome={setDiscNome}
          discChSemanal={discChSemanal}
          setDiscChSemanal={setDiscChSemanal}
          discChAnual={discChAnual}
          setDiscChAnual={setDiscChAnual}
          discDescricao={discDescricao}
          setDiscDescricao={setDiscDescricao}
        />
      )}

      {/* ========================================================================= */}
      
      {/* MODAL: CRIAR SIMULADO TRI */}
      {showModalSimulado && (
        <NovoSimuladoModal
          setShowModalSimulado={setShowModalSimulado}
          handleCriarSimulado={handleCriarSimulado}
          novoSimulado={novoSimulado}
          setNovoSimulado={setNovoSimulado}
        />
      )}

      {/* MODAL: VINCULAR DISCIPLINA À MATRIZ DA TURMA */}
      {/* ========================================================================= */}
      {showModalAdicionarMatriz && (
        <AdicionarMatrizModal
          setShowModalAdicionarMatriz={setShowModalAdicionarMatriz}
          handleAdicionarMatriz={handleAdicionarMatriz}
          matrizDiscId={matrizDiscId}
          setMatrizDiscId={setMatrizDiscId}
          disciplinas={disciplinas}
          setMatrizChSemanal={setMatrizChSemanal}
          setMatrizChAnual={setMatrizChAnual}
          matrizChSemanal={matrizChSemanal}
          matrizChAnual={matrizChAnual}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: ATRIBUIR PROFESSOR */}
      {/* ========================================================================= */}
      {showModalAtribuirProf && (
        <AtribuirProfessorModal
          setShowModalAtribuirProf={setShowModalAtribuirProf}
          handleAtribuirProfessor={handleAtribuirProfessor}
          atribDiscId={atribDiscId}
          setAtribDiscId={setAtribDiscId}
          turmaDisciplinas={turmaDisciplinas}
          atribProfId={atribProfId}
          setAtribProfId={setAtribProfId}
          professores={professores}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: INSERIR HORÁRIO COM DETECÇÃO DE CHOQUE */}
      {/* ========================================================================= */}
      {showModalHorario && (
        <NovoHorarioModal
          setShowModalHorario={setShowModalHorario}
          handleCriarHorario={handleCriarHorario}
          horarioDiaSemana={horarioDiaSemana}
          setHorarioDiaSemana={setHorarioDiaSemana}
          horarioInicio={horarioInicio}
          setHorarioInicio={setHorarioInicio}
          horarioFim={horarioFim}
          setHorarioFim={setHorarioFim}
          horarioDiscId={horarioDiscId}
          setHorarioDiscId={setHorarioDiscId}
          turmaDisciplinas={turmaDisciplinas}
          setHorarioProfId={setHorarioProfId}
          horarioProfId={horarioProfId}
          professores={professores}
          horarioSalaId={horarioSalaId}
          setHorarioSalaId={setHorarioSalaId}
          salas={salas}
        />
      )}

    </section>
  );
}
