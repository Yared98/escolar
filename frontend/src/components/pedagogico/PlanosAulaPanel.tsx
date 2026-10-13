'use client';

import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  User,
  MessageSquare,
  Save,
  RotateCcw,
  AlertCircle,
  Tag,
  Clock,
} from 'lucide-react';
import type { Turma } from './types';
import type { PlanoAula } from '@/lib/types/academico';

export interface PlanosAulaPanelProps {
  turmas: Turma[];
  selectedTurmaId: string;
  onChangeTurma: (turmaId: string) => void;
  semana: string;
  rotuloSemana: string;
  onVoltarSemana: () => void;
  onAvancarSemana: () => void;
  onHoje: () => void;
  planos: PlanoAula[];
  loading: boolean;
  erro: string | null;
  onTentarNovamente: () => void;
  onSalvarComentario: (planoId: string, comentario: string) => Promise<void>;
  salvandoComentarioId: string | null;
}

export function PlanosAulaPanel({
  turmas,
  selectedTurmaId,
  onChangeTurma,
  rotuloSemana,
  onVoltarSemana,
  onAvancarSemana,
  onHoje,
  planos,
  loading,
  erro,
  onTentarNovamente,
  onSalvarComentario,
  salvandoComentarioId,
}: PlanosAulaPanelProps) {
  // Estado local para armazenar comentários editados por plano
  const [comentarios, setComentarios] = useState<Record<string, string>>({});

  useEffect(() => {
    const mapa: Record<string, string> = {};
    for (const p of planos) {
      mapa[p.id] = p.comentario_coordenacao || '';
    }
    setComentarios(mapa);
  }, [planos]);

  return (
    <div className="space-y-6">
      {/* CABEÇALHO: Seletor de turma e navegação semanal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1 max-w-xs">
          <label className="block text-xs font-bold text-salvia-800 dark:text-salvia-200 mb-1.5">
            Turma
          </label>
          <select
            value={selectedTurmaId}
            onChange={(e) => onChangeTurma(e.target.value)}
            className="w-full h-11 px-3 bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-700 rounded-xl text-xs font-bold text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-2 focus:ring-salvia-500"
          >
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </div>

        {/* NAVEGAÇÃO DE SEMANA */}
        <div className="flex items-center space-x-2 p-2 rounded-2xl bg-salvia-50/70 dark:bg-salvia-950/40 border border-salvia-200 dark:border-salvia-800">
          <button
            type="button"
            onClick={onVoltarSemana}
            aria-label="Semana anterior"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl bg-salvia-100 dark:bg-salvia-800 text-salvia-700 dark:text-salvia-300 hover:bg-salvia-200 dark:hover:bg-salvia-700 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center px-3">
            <div className="flex items-center justify-center space-x-1.5 text-slate-900 dark:text-salvia-50">
              <CalendarDays className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
              <h3 className="text-xs sm:text-sm font-bold">{rotuloSemana}</h3>
            </div>
            <button
              type="button"
              onClick={onHoje}
              className="text-[11px] font-bold text-salvia-600 dark:text-salvia-400 hover:text-salvia-800 dark:hover:text-salvia-200 underline underline-offset-2"
            >
              Semana atual
            </button>
          </div>

          <button
            type="button"
            onClick={onAvancarSemana}
            aria-label="Próxima semana"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl bg-salvia-100 dark:bg-salvia-800 text-salvia-700 dark:text-salvia-300 hover:bg-salvia-200 dark:hover:bg-salvia-700 transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
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

      {/* LISTAGEM DE PLANOS */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-40 bg-salvia-100 dark:bg-salvia-800/60 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : planos.length === 0 ? (
        <div className="p-8 rounded-2xl border border-salvia-200 dark:border-salvia-800 bg-salvia-50/40 dark:bg-salvia-950/30 text-center space-y-2">
          <BookOpen className="w-8 h-8 mx-auto text-salvia-400 mb-1" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-salvia-50">
            Nenhum plano de aula cadastrado para esta semana.
          </h4>
          <p className="text-xs text-salvia-600 dark:text-salvia-400 max-w-md mx-auto">
            Os professores lançam o planejamento semanal diretamente pela aba de Planejamento em &quot;Meu dia&quot;.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {planos.map((plano) => {
            const salvando = salvandoComentarioId === plano.id;
            const comentarioAtual = comentarios[plano.id] ?? '';

            return (
              <div
                key={plano.id}
                className="p-5 rounded-2xl border border-salvia-200 dark:border-salvia-800 bg-white dark:bg-salvia-900/60 space-y-4 shadow-sm"
              >
                {/* TOPO DO CARD: Disciplina e Professor */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-salvia-100 dark:border-salvia-800">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <BookOpen className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
                      <h4 className="text-base font-bold text-slate-900 dark:text-salvia-50">
                        {plano.disciplina_nome || 'Disciplina'}
                      </h4>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-salvia-600 dark:text-salvia-400">
                      <User className="w-3.5 h-3.5" />
                      <span>{plano.professor_nome || 'Professor'}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 text-[11px] text-salvia-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      Atualizado em{' '}
                      {new Date(plano.updated_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                {/* CONTEÚDO PEDAGÓGICO */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="font-bold text-salvia-800 dark:text-salvia-200">
                      Objetivos de Aprendizagem
                    </span>
                    <p className="text-slate-800 dark:text-salvia-100 leading-relaxed whitespace-pre-wrap bg-salvia-50/50 dark:bg-salvia-950/40 p-3 rounded-xl border border-salvia-100 dark:border-salvia-800">
                      {plano.objetivos}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="font-bold text-salvia-800 dark:text-salvia-200">
                      Conteúdos Curriculares
                    </span>
                    <p className="text-slate-800 dark:text-salvia-100 leading-relaxed whitespace-pre-wrap bg-salvia-50/50 dark:bg-salvia-950/40 p-3 rounded-xl border border-salvia-100 dark:border-salvia-800">
                      {plano.conteudos}
                    </p>
                  </div>
                </div>

                {/* HABILIDADES BNCC */}
                {plano.habilidades_bncc && plano.habilidades_bncc.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-salvia-800 dark:text-salvia-200">
                      Habilidades BNCC
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {plano.habilidades_bncc.map((hab, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-salvia-100 text-salvia-800 dark:bg-salvia-800 dark:text-salvia-200 border border-salvia-200 dark:border-salvia-700"
                        >
                          <Tag className="w-3 h-3 text-salvia-500" />
                          <span>{hab}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* ATIVIDADES E AVALIAÇÃO */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="font-bold text-salvia-800 dark:text-salvia-200">
                      Atividades e Metodologia
                    </span>
                    <p className="text-slate-800 dark:text-salvia-100 leading-relaxed whitespace-pre-wrap bg-salvia-50/50 dark:bg-salvia-950/40 p-3 rounded-xl border border-salvia-100 dark:border-salvia-800">
                      {plano.atividades}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="font-bold text-salvia-800 dark:text-salvia-200">
                      Critérios de Avaliação
                    </span>
                    <p className="text-slate-800 dark:text-salvia-100 leading-relaxed whitespace-pre-wrap bg-salvia-50/50 dark:bg-salvia-950/40 p-3 rounded-xl border border-salvia-100 dark:border-salvia-800">
                      {plano.avaliacao || 'Não informado'}
                    </p>
                  </div>
                </div>

                {/* COMENTÁRIO DA COORDENAÇÃO (Edição / Envio) */}
                <div className="pt-2 border-t border-salvia-100 dark:border-salvia-800 space-y-2">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
                    <label className="text-xs font-bold text-salvia-900 dark:text-salvia-100">
                      Comentário da Coordenação Pedagógica
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    value={comentarioAtual}
                    onChange={(e) =>
                      setComentarios({
                        ...comentarios,
                        [plano.id]: e.target.value,
                      })
                    }
                    placeholder="Deixe orientações, sugestões ou validação pedagógica para o professor..."
                    className="w-full p-3 bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-700 rounded-xl text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-2 focus:ring-salvia-500 leading-relaxed"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() => onSalvarComentario(plano.id, comentarioAtual)}
                      className="min-h-[44px] bg-salvia-700 hover:bg-salvia-800 text-white dark:bg-salvia-600 dark:hover:bg-salvia-500 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all disabled:opacity-60 shadow-sm"
                    >
                      {salvando ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Salvando comentário...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Salvar comentário</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
