'use client';

import React, { useState, useEffect } from 'react';
import {
  PreviaViradaData,
  PreviaTurmaVirada,
  PreviaAlunoVirada,
  ExecutarViradaPayload,
  ExecutarViradaResultado,
  TurmaViradaPayload,
  AlunoViradaPayload,
} from './types';
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  RotateCcw,
  BookOpen,
  Users,
  Shield,
  FileText,
  UserCheck,
  UserX,
  ArrowRight,
  Sparkles,
  Info,
  Loader2,
} from 'lucide-react';

interface RematriculaPanelProps {
  anoOrigem: number;
  setAnoOrigem: (ano: number) => void;
  anoDestino: number;
  setAnoDestino: (ano: number) => void;
  copiarProfessores: boolean;
  setCopiarProfessores: (val: boolean) => void;
  gerarContratos: boolean;
  setGerarContratos: (val: boolean) => void;
  previaData: PreviaViradaData | null;
  loadingPrevia: boolean;
  errorPrevia: string | null;
  onCarregarPrevia: (origem: number, destino: number) => Promise<void>;
  executando: boolean;
  resultadoExecucao: ExecutarViradaResultado | null;
  errorExecucao: string | null;
  onExecutarVirada: (payload: ExecutarViradaPayload) => Promise<void>;
  onReiniciar: () => void;
}

export function RematriculaPanel({
  anoOrigem,
  setAnoOrigem,
  anoDestino,
  setAnoDestino,
  copiarProfessores,
  setCopiarProfessores,
  gerarContratos,
  setGerarContratos,
  previaData,
  loadingPrevia,
  errorPrevia,
  onCarregarPrevia,
  executando,
  resultadoExecucao,
  errorExecucao,
  onExecutarVirada,
  onReiniciar,
}: RematriculaPanelProps) {
  const [passo, setPasso] = useState<1 | 2 | 3>(1);

  // Mapeamento editável das turmas: turma_origem_id -> { nome, serie, etapa_ensino, turno }
  const [configTurmas, setConfigTurmas] = useState<
    Record<
      string,
      {
        nome: string;
        serie: string;
        etapa_ensino: string;
        turno: string;
        turma_destino_existente_id?: string;
      }
    >
  >({});

  // Mapeamento editável das decisões dos alunos: aluno_id -> 'promover' | 'reter' | 'nao_rematricular'
  const [acoesAlunos, setAcoesAlunos] = useState<
    Record<string, 'promover' | 'reter' | 'nao_rematricular'>
  >({});

  // Turma selecionada para visualizar alunos no Passo 2
  const [turmaAtivaId, setTurmaAtivaId] = useState<string | null>(null);

  // Inicializar configurações quando a prévia for carregada
  useEffect(() => {
    if (previaData && previaData.turmas.length > 0) {
      const novasTurmas: Record<string, any> = {};
      const novasAcoes: Record<string, 'promover' | 'reter' | 'nao_rematricular'> = {};

      for (const t of previaData.turmas) {
        novasTurmas[t.turma_origem_id] = {
          nome: t.sugestao_nome_turma || `${t.serie || 'Turma'} ${anoDestino}`,
          serie: t.sugestao_proxima_serie || t.serie || '',
          etapa_ensino: t.sugestao_proxima_etapa || t.etapa_ensino || 'fundamental_1',
          turno: t.turno,
          turma_destino_existente_id: t.turma_destino_existente_id || undefined,
        };

        for (const al of t.alunos) {
          // Em andamento, em recuperação ou sem notas: a escola decide (nada vem marcado).
          if (al.acao_sugerida !== 'decidir') novasAcoes[al.aluno_id] = al.acao_sugerida;
        }
      }

      setConfigTurmas(novasTurmas);
      setAcoesAlunos(novasAcoes);
      setTurmaAtivaId(previaData.turmas[0].turma_origem_id);
    }
  }, [previaData, anoDestino]);

  // Contadores globais das ações
  const totalAlunos = previaData
    ? previaData.turmas.reduce((acc, t) => acc + t.alunos.length, 0)
    : 0;
  const countPromover = Object.values(acoesAlunos).filter((a) => a === 'promover').length;
  const countReter = Object.values(acoesAlunos).filter((a) => a === 'reter').length;
  const countNaoRematricular = Object.values(acoesAlunos).filter(
    (a) => a === 'nao_rematricular'
  ).length;
  const countDecidir = Math.max(0, totalAlunos - countPromover - countReter - countNaoRematricular);

  const handleBuscarPrevia = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCarregarPrevia(anoOrigem, anoDestino);
    setPasso(2);
  };

  const handleConfirmarExecucao = async () => {
    if (!previaData) return;

    const turmasPayload: TurmaViradaPayload[] = previaData.turmas.map((t) => {
      const cfg = configTurmas[t.turma_origem_id];
      if (cfg?.turma_destino_existente_id) {
        return {
          turma_origem_id: t.turma_origem_id,
          turma_destino_id: cfg.turma_destino_existente_id,
        };
      }
      return {
        turma_origem_id: t.turma_origem_id,
        nova_turma: {
          nome: cfg?.nome || t.sugestao_nome_turma || `Turma ${anoDestino}`,
          serie: cfg?.serie || t.sugestao_proxima_serie || t.serie || undefined,
          etapa_ensino: cfg?.etapa_ensino || t.sugestao_proxima_etapa || t.etapa_ensino,
          turno: cfg?.turno || t.turno,
        },
      };
    });

    const alunosPayload: AlunoViradaPayload[] = [];
    for (const t of previaData.turmas) {
      for (const al of t.alunos) {
        const acao = acoesAlunos[al.aluno_id];
        if (!acao) continue;
        alunosPayload.push({
          aluno_id: al.aluno_id,
          acao,
        });
      }
    }

    const payload: ExecutarViradaPayload = {
      ano_origem: anoOrigem,
      ano_destino: anoDestino,
      copiar_professores: copiarProfessores,
      gerar_contratos: gerarContratos,
      turmas: turmasPayload,
      alunos: alunosPayload,
    };

    await onExecutarVirada(payload);
  };

  const aplicarSugestoesAutomaticas = () => {
    if (!previaData) return;
    const novasAcoes: Record<string, 'promover' | 'reter' | 'nao_rematricular'> = {};
    for (const t of previaData.turmas) {
      for (const al of t.alunos) {
        // Em andamento, em recuperação ou sem notas: a escola decide (nada vem marcado).
          if (al.acao_sugerida !== 'decidir') novasAcoes[al.aluno_id] = al.acao_sugerida;
      }
    }
    setAcoesAlunos(novasAcoes);
  };

  // Se já concluiu a execução com sucesso
  if (resultadoExecucao) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-salvia-200 dark:border-salvia-900/40 p-6 md:p-8 max-w-3xl mx-auto shadow-sm">
        <div className="flex items-center space-x-3 text-salvia-700 dark:text-salvia-400 mb-4">
          <CheckCircle2 className="w-8 h-8 flex-shrink-0" />
          <h2 className="text-xl md:text-2xl font-bold">Virada de Ano Letivo Concluída!</h2>
        </div>
        <p className="text-slate-600 dark:text-slate-300 text-sm md:text-base mb-6">
          {resultadoExecucao.mensagem}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-salvia-50 dark:bg-salvia-950/40 border border-salvia-200 dark:border-salvia-800/50 rounded-xl p-4 text-center">
            <span className="block text-2xl font-extrabold text-salvia-700 dark:text-salvia-300">
              {resultadoExecucao.turmas_criadas}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Turmas criadas</span>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 text-center">
            <span className="block text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
              {resultadoExecucao.alunos_promovidos}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Alunos promovidos</span>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 text-center">
            <span className="block text-2xl font-extrabold text-amber-700 dark:text-amber-300">
              {resultadoExecucao.alunos_retidos}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Alunos retidos</span>
          </div>
          <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/50 rounded-xl p-4 text-center">
            <span className="block text-2xl font-extrabold text-sky-700 dark:text-sky-300">
              {resultadoExecucao.contratos_gerados}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Contratos gerados</span>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-xs md:text-sm text-slate-600 dark:text-slate-300 space-y-2 mb-6">
          <div className="flex items-center space-x-2 font-medium text-slate-700 dark:text-slate-200">
            <Shield className="w-4 h-4 text-salvia-600" />
            <span>Dados históricos protegidos</span>
          </div>
          <p>
            As enturmações de {resultadoExecucao.ano_origem} foram concluídas sem exclusão de
            dados. Boletins, diários de classe e presenças do ano anterior continuam preservados e
            acessíveis na secretaria e no histórico escolar.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            onReiniciar();
            setPasso(1);
          }}
          className="min-h-[44px] w-full sm:w-auto px-6 bg-salvia-600 hover:bg-salvia-700 text-white font-medium rounded-xl transition-all flex items-center justify-center space-x-2 shadow-sm"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Iniciar nova consulta</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barra de Progresso do Assistente (3 passos) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="grid grid-cols-3 gap-2 text-center text-xs md:text-sm font-medium">
          <div
            className={`flex items-center justify-center space-x-2 py-2 rounded-xl transition-all ${
              passo === 1
                ? 'bg-salvia-50 dark:bg-salvia-950/60 text-salvia-700 dark:text-salvia-300 font-bold border border-salvia-200 dark:border-salvia-800'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <span className="w-6 h-6 rounded-full bg-salvia-600 text-white flex items-center justify-center text-xs">
              1
            </span>
            <span className="hidden sm:inline">Anos letivos</span>
          </div>

          <div
            className={`flex items-center justify-center space-x-2 py-2 rounded-xl transition-all ${
              passo === 2
                ? 'bg-salvia-50 dark:bg-salvia-950/60 text-salvia-700 dark:text-salvia-300 font-bold border border-salvia-200 dark:border-salvia-800'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                passo >= 2 ? 'bg-salvia-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              2
            </span>
            <span className="hidden sm:inline">Revisar turmas e alunos</span>
          </div>

          <div
            className={`flex items-center justify-center space-x-2 py-2 rounded-xl transition-all ${
              passo === 3
                ? 'bg-salvia-50 dark:bg-salvia-950/60 text-salvia-700 dark:text-salvia-300 font-bold border border-salvia-200 dark:border-salvia-800'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                passo === 3 ? 'bg-salvia-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              3
            </span>
            <span className="hidden sm:inline">Confirmar virada</span>
          </div>
        </div>
      </div>

      {/* Erro Geral se houver */}
      {(errorPrevia || errorExecucao) && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-4 text-rose-800 dark:text-rose-200 text-sm flex items-start space-x-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
          <div>
            <span className="font-bold block">Atenção</span>
            <span>{errorPrevia || errorExecucao}</span>
          </div>
        </div>
      )}

      {/* PASSO 1: Seleção de anos letivos e opções */}
      {passo === 1 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm max-w-2xl mx-auto space-y-6">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-salvia-600" />
              <span>Configuração da Virada de Ano Letivo</span>
            </h2>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Selecione o ano letivo de origem para analisar os alunos e o ano letivo de destino para
              criar as novas turmas e contratos.
            </p>
          </div>

          <form onSubmit={handleBuscarPrevia} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ano de Origem
                </label>
                <input
                  type="number"
                  min="2020"
                  max="2040"
                  value={anoOrigem}
                  onChange={(e) => setAnoOrigem(parseInt(e.target.value, 10) || 2026)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold focus:ring-2 focus:ring-salvia-500 outline-none"
                  required
                />
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                  Turmas e boletins atuais
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ano de Destino
                </label>
                <input
                  type="number"
                  min="2020"
                  max="2040"
                  value={anoDestino}
                  onChange={(e) => setAnoDestino(parseInt(e.target.value, 10) || 2027)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold focus:ring-2 focus:ring-salvia-500 outline-none"
                  required
                />
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                  Novas turmas e matrículas
                </span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                Opções Automáticas
              </span>

              <label className="flex items-center space-x-3 cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={copiarProfessores}
                  onChange={(e) => setCopiarProfessores(e.target.checked)}
                  className="w-4 h-4 text-salvia-600 rounded border-slate-300 dark:border-slate-700 focus:ring-salvia-500"
                />
                <span className="text-xs md:text-sm text-slate-700 dark:text-slate-300">
                  Copiar matriz de disciplinas e atribuições de professores para as novas turmas
                </span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={gerarContratos}
                  onChange={(e) => setGerarContratos(e.target.checked)}
                  className="w-4 h-4 text-salvia-600 rounded border-slate-300 dark:border-slate-700 focus:ring-salvia-500"
                />
                <span className="text-xs md:text-sm text-slate-700 dark:text-slate-300">
                  Gerar contratos do novo ano (com mesmo valor do anterior, status &quot;pendente de
                  assinatura&quot;)
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loadingPrevia}
              className="w-full min-h-[44px] bg-salvia-600 hover:bg-salvia-700 disabled:opacity-50 text-white font-medium rounded-xl transition-all flex items-center justify-center space-x-2 shadow-sm text-sm"
            >
              {loadingPrevia ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Carregando dados das turmas e boletins...</span>
                </>
              ) : (
                <>
                  <span>Carregar prévia da virada</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* PASSO 2: Revisar turmas e alunos com sugestão */}
      {passo === 2 && previaData && (
        <div className="space-y-6">
          {/* Barra de Ações Rápidas e Resumo */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 md:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-salvia-600" />
                <span>
                  Revisão de Turmas e Alunos ({anoOrigem} → {anoDestino})
                </span>
              </h2>
              <div className="flex flex-wrap gap-2 text-xs mt-2">
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-300 dark:border-emerald-800">
                  Promover: {countPromover}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold border border-amber-300 dark:border-amber-800">
                  Reter: {countReter}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border border-slate-300 dark:border-slate-700">
                  Não rematricular: {countNaoRematricular}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-salvia-50 dark:bg-salvia-950 text-salvia-700 dark:text-salvia-300 font-bold border border-salvia-300 dark:border-salvia-800">
                  Total: {totalAlunos}
                </span>
                {countDecidir > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-bold border border-rose-300 dark:border-rose-800">
                    A decidir: {countDecidir}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={aplicarSugestoesAutomaticas}
                className="min-h-[44px] px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all flex items-center space-x-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-salvia-600" />
                <span>Reaplicar sugestões do boletim</span>
              </button>
              <button
                type="button"
                onClick={() => setPasso(3)}
                disabled={countDecidir > 0}
                title={countDecidir > 0 ? 'Escolha a situação de todos os alunos para continuar' : undefined}
                className="disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] px-4 py-2 bg-salvia-600 hover:bg-salvia-700 text-white text-xs md:text-sm font-semibold rounded-xl transition-all flex items-center space-x-1.5 shadow-sm"
              >
                <span>Avançar para confirmação</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lista de Turmas (Tabs/Pills para Navegar) */}
          <div className="flex overflow-x-auto gap-2 pb-2">
            {previaData.turmas.map((t) => {
              const cfg = configTurmas[t.turma_origem_id];
              const isAtiva = turmaAtivaId === t.turma_origem_id;
              return (
                <button
                  key={t.turma_origem_id}
                  type="button"
                  onClick={() => setTurmaAtivaId(t.turma_origem_id)}
                  className={`min-h-[44px] px-4 py-2 rounded-xl text-xs md:text-sm font-bold whitespace-nowrap border transition-all flex items-center space-x-2 ${
                    isAtiva
                      ? 'bg-salvia-600 text-white border-salvia-600 shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-salvia-400'
                  }`}
                >
                  <span>{t.turma_origem_nome}</span>
                  <span className="text-xs opacity-75">
                    → {cfg?.nome || t.sugestao_nome_turma || 'Nova'}
                  </span>
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                      isAtiva ? 'bg-salvia-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                    }`}
                  >
                    {t.alunos.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Detalhes da Turma Selecionada */}
          {previaData.turmas
            .filter((t) => t.turma_origem_id === turmaAtivaId)
            .map((turma) => {
              const cfg = configTurmas[turma.turma_origem_id] || {
                nome: turma.sugestao_nome_turma || '',
                serie: turma.sugestao_proxima_serie || turma.serie || '',
                etapa_ensino: turma.sugestao_proxima_etapa || turma.etapa_ensino,
                turno: turma.turno,
              };

              return (
                <div
                  key={turma.turma_origem_id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 md:p-6 shadow-sm space-y-6"
                >
                  {/* Cabeçalho da Turma e Configuração de Destino */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3">
                      Configuração da Turma de Destino em {anoDestino}
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Nome da Nova Turma
                        </label>
                        <input
                          type="text"
                          value={cfg.nome}
                          onChange={(e) =>
                            setConfigTurmas((prev) => ({
                              ...prev,
                              [turma.turma_origem_id]: { ...cfg, nome: e.target.value },
                            }))
                          }
                          className="w-full min-h-[44px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-salvia-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Série / Ano
                        </label>
                        <input
                          type="text"
                          value={cfg.serie}
                          onChange={(e) =>
                            setConfigTurmas((prev) => ({
                              ...prev,
                              [turma.turma_origem_id]: { ...cfg, serie: e.target.value },
                            }))
                          }
                          className="w-full min-h-[44px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-salvia-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Etapa de Ensino
                        </label>
                        <select
                          value={cfg.etapa_ensino}
                          onChange={(e) =>
                            setConfigTurmas((prev) => ({
                              ...prev,
                              [turma.turma_origem_id]: { ...cfg, etapa_ensino: e.target.value },
                            }))
                          }
                          className="w-full min-h-[44px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-salvia-500"
                        >
                          <option value="educacao_infantil">Educação Infantil</option>
                          <option value="fundamental_1">Ensino Fundamental I</option>
                          <option value="fundamental_2">Ensino Fundamental II</option>
                          <option value="medio">Ensino Médio</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Turno
                        </label>
                        <select
                          value={cfg.turno}
                          onChange={(e) =>
                            setConfigTurmas((prev) => ({
                              ...prev,
                              [turma.turma_origem_id]: { ...cfg, turno: e.target.value },
                            }))
                          }
                          className="w-full min-h-[44px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-salvia-500"
                        >
                          <option value="matutino">Matutino</option>
                          <option value="vespertino">Vespertino</option>
                          <option value="noturno">Noturno</option>
                          <option value="integral">Integral</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Lista de Alunos da Turma */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
                      Alunos Matriculados ({turma.alunos.length})
                    </h3>

                    <div className="space-y-3">
                      {turma.alunos.map((aluno) => {
                        const acao = acoesAlunos[aluno.aluno_id];

                        return (
                          <div
                            key={aluno.aluno_id}
                            className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-slate-300 transition-all"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                                  {aluno.numero_chamada ? `${aluno.numero_chamada} · ` : ''}
                                  {aluno.nome}
                                </span>

                                {/* Badge do Boletim C9 */}
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                                    aluno.status_boletim === 'Aprovado'
                                      ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 text-emerald-800 dark:text-emerald-300'
                                      : aluno.status_boletim === 'Reprovado'
                                      ? 'bg-rose-100 dark:bg-rose-950/60 border-rose-300 text-rose-800 dark:text-rose-300'
                                      : 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 text-amber-800 dark:text-amber-300'
                                  }`}
                                >
                                  {aluno.status_boletim}
                                </span>
                              </div>

                              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-3">
                                {!acao && (
                                  <span className="font-bold text-rose-700 dark:text-rose-300">Escolha uma opção</span>
                                )}
                                <span>Média geral: {aluno.status_boletim === 'Sem notas lançadas' ? '—' : aluno.media_geral.toFixed(1)}</span>
                                <span>Frequência: {aluno.frequencia_pct.toFixed(0)}%</span>
                              </div>
                            </div>

                            {/* Seletor de Ação para o Aluno */}
                            <div className="flex items-center space-x-1.5 self-end md:self-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setAcoesAlunos((prev) => ({
                                    ...prev,
                                    [aluno.aluno_id]: 'promover',
                                  }))
                                }
                                className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1 ${
                                  acao === 'promover'
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Promover</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setAcoesAlunos((prev) => ({
                                    ...prev,
                                    [aluno.aluno_id]: 'reter',
                                  }))
                                }
                                className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1 ${
                                  acao === 'reter'
                                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                <span>Reter</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setAcoesAlunos((prev) => ({
                                    ...prev,
                                    [aluno.aluno_id]: 'nao_rematricular',
                                  }))
                                }
                                className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1 ${
                                  acao === 'nao_rematricular'
                                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                <UserX className="w-3.5 h-3.5" />
                                <span>Não rematricular</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

          {/* Rodapé de navegação do passo 2 */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPasso(1)}
              className="min-h-[44px] px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs md:text-sm font-semibold rounded-xl transition-all flex items-center space-x-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Voltar aos anos</span>
            </button>

            <button
              type="button"
              onClick={() => setPasso(3)}
              disabled={countDecidir > 0}
              title={countDecidir > 0 ? 'Escolha a situação de todos os alunos para continuar' : undefined}
              className="disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] px-6 py-2 bg-salvia-600 hover:bg-salvia-700 text-white text-xs md:text-sm font-semibold rounded-xl transition-all flex items-center space-x-1.5 shadow-sm"
            >
              <span>Avançar para confirmação</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PASSO 3: Resumo e Confirmação */}
      {passo === 3 && previaData && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 max-w-2xl mx-auto shadow-sm space-y-6">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
              <Shield className="w-5 h-5 text-salvia-600" />
              <span>Resumo e Confirmação da Virada</span>
            </h2>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Confira os totais abaixo antes de executar a virada do ano letivo.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">
              <span className="block text-xl font-bold text-slate-800 dark:text-slate-100">
                {previaData.turmas.length}
              </span>
              <span className="text-[11px] text-slate-500">Turmas a criar</span>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-3 text-center">
              <span className="block text-xl font-bold text-emerald-700 dark:text-emerald-300">
                {countPromover}
              </span>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                Alunos a promover
              </span>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 text-center">
              <span className="block text-xl font-bold text-amber-700 dark:text-amber-300">
                {countReter}
              </span>
              <span className="text-[11px] text-amber-700 dark:text-amber-400">
                Alunos a reter
              </span>
            </div>

            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 rounded-xl p-3 text-center">
              <span className="block text-xl font-bold text-rose-700 dark:text-rose-300">
                {countNaoRematricular}
              </span>
              <span className="text-[11px] text-rose-700 dark:text-rose-400">
                Não rematricular
              </span>
            </div>

            <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/40 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
              <span className="block text-xl font-bold text-sky-700 dark:text-sky-300">
                {gerarContratos ? countPromover + countReter : 0}
              </span>
              <span className="text-[11px] text-sky-700 dark:text-sky-400">
                Contratos a gerar
              </span>
            </div>
          </div>

          {/* Aviso Obrigatório: Nenhum dado do ano anterior é apagado */}
          <div className="bg-salvia-50 dark:bg-salvia-950/40 border border-salvia-200 dark:border-salvia-900/60 rounded-xl p-4 text-xs md:text-sm text-salvia-900 dark:text-salvia-200 space-y-2">
            <div className="flex items-center space-x-2 font-bold text-salvia-800 dark:text-salvia-300">
              <Shield className="w-4 h-4 flex-shrink-0" />
              <span>Garantia de Preservação dos Dados Históricos</span>
            </div>
            <p>
              • Os dados do ano letivo de <strong>{anoOrigem}</strong> permanecem arquivados e
              acessíveis para consultas, relatórios e histórico escolar.
            </p>
            <p>
              • As enturmações anteriores serão finalizadas como concluídas, sem remoção de nenhum
              registro.
            </p>
            {countReter > 0 && (
              <p>
                • Alunos retidos refazem a mesma série em {anoDestino}: entram numa turma dessa
                série no novo ano (se ainda não existir, ela é criada com o mesmo nome).
              </p>
            )}
            {gerarContratos && (
              <p>
                • Os novos contratos serão gerados como &quot;pendente de assinatura&quot;. Nenhuma
                cobrança financeira é disparada antes da assinatura formal do responsável legal.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setPasso(2)}
              className="min-h-[44px] px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs md:text-sm font-semibold rounded-xl transition-all flex items-center space-x-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Voltar à revisão</span>
            </button>

            <button
              type="button"
              disabled={executando}
              onClick={handleConfirmarExecucao}
              className="min-h-[44px] px-6 py-2 bg-salvia-600 hover:bg-salvia-700 disabled:opacity-50 text-white text-xs md:text-sm font-bold rounded-xl transition-all flex items-center space-x-2 shadow-sm"
            >
              {executando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Executando virada de ano letivo...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar e Executar Virada</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
