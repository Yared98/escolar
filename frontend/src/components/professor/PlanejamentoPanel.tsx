'use client';

import React, { useEffect, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Save,
  MessageSquare,
  AlertCircle,
  Tag,
  BookOpen,
} from 'lucide-react';
import type { MinhaTurma, MinhaTurmaDisciplina, PlanoAula } from '@/lib/types/academico';

interface PlanejamentoPanelProps {
  minhasTurmas: MinhaTurma[];
  turmaId: string;
  onChangeTurma: (id: string) => void;
  disciplinas: MinhaTurmaDisciplina[];
  disciplinaId: string;
  onChangeDisciplina: (id: string) => void;
  semana: string;
  rotuloSemana: string;
  onVoltarSemana: () => void;
  onAvancarSemana: () => void;
  onHoje: () => void;
  plano: PlanoAula | null;
  loading: boolean;
  erro: string | null;
  onTentarNovamente: () => void;
  onSalvar: (dados: {
    objetivos: string;
    conteudos: string;
    habilidades_bncc: string[];
    atividades: string;
    avaliacao: string;
  }) => Promise<void>;
  salvando: boolean;
}

export function PlanejamentoPanel({
  minhasTurmas,
  turmaId,
  onChangeTurma,
  disciplinas,
  disciplinaId,
  onChangeDisciplina,
  rotuloSemana,
  onVoltarSemana,
  onAvancarSemana,
  onHoje,
  plano,
  loading,
  erro,
  onTentarNovamente,
  onSalvar,
  salvando,
}: PlanejamentoPanelProps) {
  const [objetivos, setObjetivos] = useState('');
  const [conteudos, setConteudos] = useState('');
  const [habilidadesInput, setHabilidadesInput] = useState('');
  const [atividades, setAtividades] = useState('');
  const [avaliacao, setAvaliacao] = useState('');

  // Atualiza os campos do formulário quando o plano do backend for carregado ou trocado
  useEffect(() => {
    if (plano) {
      setObjetivos(plano.objetivos || '');
      setConteudos(plano.conteudos || '');
      setHabilidadesInput(
        Array.isArray(plano.habilidades_bncc) ? plano.habilidades_bncc.join(', ') : ''
      );
      setAtividades(plano.atividades || '');
      setAvaliacao(plano.avaliacao || '');
    } else {
      setObjetivos('');
      setConteudos('');
      setHabilidadesInput('');
      setAtividades('');
      setAvaliacao('');
    }
  }, [plano]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const habilidades = habilidadesInput
      .split(',')
      .map((h) => h.trim())
      .filter((h) => h.length > 0);

    await onSalvar({
      objetivos,
      conteudos,
      habilidades_bncc: habilidades,
      atividades,
      avaliacao,
    });
  };

  const chipsHabilidades = habilidadesInput
    .split(',')
    .map((h) => h.trim())
    .filter((h) => h.length > 0);

  return (
    <div className="space-y-6">
      {/* SELETORES: Turma e Disciplina */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-salvia-800 dark:text-salvia-200 mb-1.5">
            Turma
          </label>
          <select
            value={turmaId}
            onChange={(e) => onChangeTurma(e.target.value)}
            className="w-full h-11 px-3 bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-700 rounded-xl text-xs font-bold text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-2 focus:ring-salvia-500"
          >
            {minhasTurmas.map((t) => (
              <option key={t.turma_id} value={t.turma_id}>
                {t.turma_nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-salvia-800 dark:text-salvia-200 mb-1.5">
            Disciplina
          </label>
          <select
            value={disciplinaId}
            onChange={(e) => onChangeDisciplina(e.target.value)}
            className="w-full h-11 px-3 bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-700 rounded-xl text-xs font-bold text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-2 focus:ring-salvia-500"
          >
            {disciplinas.map((d) => (
              <option key={d.disciplina_id} value={d.disciplina_id}>
                {d.disciplina_nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* NAVEGAÇÃO DE SEMANA */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-salvia-50/70 dark:bg-salvia-950/40 border border-salvia-200 dark:border-salvia-800">
        <button
          type="button"
          onClick={onVoltarSemana}
          aria-label="Semana anterior"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 rounded-xl bg-salvia-100 dark:bg-salvia-800 text-salvia-700 dark:text-salvia-300 hover:bg-salvia-200 dark:hover:bg-salvia-700 transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center px-2">
          <div className="flex items-center justify-center space-x-1.5 text-slate-900 dark:text-salvia-50">
            <CalendarDays className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
            <h3 className="text-xs sm:text-sm font-bold">{rotuloSemana}</h3>
          </div>
          <button
            type="button"
            onClick={onHoje}
            className="text-[11px] font-bold text-salvia-600 dark:text-salvia-400 hover:text-salvia-800 dark:hover:text-salvia-200 underline underline-offset-2 mt-0.5"
          >
            Semana atual
          </button>
        </div>

        <button
          type="button"
          onClick={onAvancarSemana}
          aria-label="Próxima semana"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 rounded-xl bg-salvia-100 dark:bg-salvia-800 text-salvia-700 dark:text-salvia-300 hover:bg-salvia-200 dark:hover:bg-salvia-700 transition-all"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* MENSAGEM DE ERRO SE HOUVER */}
      {erro && (
        <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 text-xs space-y-2">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{erro}</span>
          </div>
          <button
            type="button"
            onClick={onTentarNovamente}
            className="flex items-center space-x-1.5 text-[11px] font-bold underline underline-offset-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Tentar de novo</span>
          </button>
        </div>
      )}

      {/* COMENTÁRIO DA COORDENAÇÃO (se existir) */}
      {plano?.comentario_coordenacao && (
        <div className="p-4 rounded-2xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 space-y-1.5">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Comentário da Coordenação Pedagógica
            </h4>
          </div>
          <p className="text-xs leading-relaxed whitespace-pre-wrap pl-6">
            {plano.comentario_coordenacao}
          </p>
        </div>
      )}

      {/* FORMULÁRIO DO PLANO */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 bg-salvia-100 dark:bg-salvia-800/60 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-salvia-800 dark:text-salvia-200 mb-1.5">
              Objetivos de Aprendizagem *
            </label>
            <textarea
              required
              rows={3}
              value={objetivos}
              onChange={(e) => setObjetivos(e.target.value)}
              placeholder="Descreva o que os alunos devem compreender e alcançar nesta semana..."
              className="w-full p-3 bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-700 rounded-xl text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-2 focus:ring-salvia-500 leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-salvia-800 dark:text-salvia-200 mb-1.5">
              Conteúdos Curriculares *
            </label>
            <textarea
              required
              rows={3}
              value={conteudos}
              onChange={(e) => setConteudos(e.target.value)}
              placeholder="Tópicos e conceitos que serão abordados nas aulas..."
              className="w-full p-3 bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-700 rounded-xl text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-2 focus:ring-salvia-500 leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-salvia-800 dark:text-salvia-200 mb-1.5">
              Habilidades BNCC (códigos separados por vírgula)
            </label>
            <div className="relative">
              <input
                type="text"
                value={habilidadesInput}
                onChange={(e) => setHabilidadesInput(e.target.value)}
                placeholder="Ex: EF06MA07, EF06MA08, EF06MA09"
                className="w-full h-11 px-3 bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-700 rounded-xl text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-2 focus:ring-salvia-500"
              />
            </div>
            {chipsHabilidades.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {chipsHabilidades.map((h, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-salvia-100 text-salvia-800 dark:bg-salvia-800 dark:text-salvia-200 border border-salvia-200 dark:border-salvia-700"
                  >
                    <Tag className="w-3 h-3 text-salvia-500" />
                    <span>{h}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-salvia-800 dark:text-salvia-200 mb-1.5">
              Atividades e Metodologia *
            </label>
            <textarea
              required
              rows={3}
              value={atividades}
              onChange={(e) => setAtividades(e.target.value)}
              placeholder="Dinâmicas, exercícios, leitura, recursos didáticos e atividades em grupo..."
              className="w-full p-3 bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-700 rounded-xl text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-2 focus:ring-salvia-500 leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-salvia-800 dark:text-salvia-200 mb-1.5">
              Critérios de Avaliação (opcional)
            </label>
            <textarea
              rows={2}
              value={avaliacao}
              onChange={(e) => setAvaliacao(e.target.value)}
              placeholder="Como será verificada a aprendizagem (participação, rubrica, entrega, etc.)..."
              className="w-full p-3 bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-700 rounded-xl text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-2 focus:ring-salvia-500 leading-relaxed"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={salvando}
              className="w-full sm:w-auto min-h-[44px] bg-salvia-700 hover:bg-salvia-800 text-white dark:bg-salvia-600 dark:hover:bg-salvia-500 px-6 py-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all disabled:opacity-60 shadow-sm"
            >
              {salvando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Salvando plano...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar plano de aula</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
