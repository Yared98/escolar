'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarPlus,
  ClipboardList,
  Loader2,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AvaliacaoCalendario,
  MinhaTurma,
  MinhaTurmaDisciplina,
  NovaAvaliacaoPayload,
  TipoAvaliacao,
} from '@/lib/types/academico';
import { TIPOS_AVALIACAO } from '@/lib/types/academico';

const dataLocalHoje = () => {
  const agora = new Date();
  const offset = agora.getTimezoneOffset() * 60000;
  return new Date(agora.getTime() - offset).toISOString().split('T')[0];
};

const rotuloTipo = (tipo: string) =>
  TIPOS_AVALIACAO.find((t) => t.value === tipo)?.label ?? tipo;

const formatarDiaMes = (data: string) => {
  const valor = new Date(data + 'T00:00:00');
  if (Number.isNaN(valor.getTime())) return data;
  return valor.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const formatarDataCompleta = (data: string) => {
  const valor = new Date(data + 'T00:00:00');
  if (Number.isNaN(valor.getTime())) return data;
  return valor.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
};

interface AvaliacoesPanelProps {
  avaliacoes: AvaliacaoCalendario[];
  loading: boolean;
  erro: string | null;
  onTentarNovamente: () => void;
  minhasTurmas: MinhaTurma[];
  criando: boolean;
  onCriar: (payload: NovaAvaliacaoPayload) => void;
  onRemover: (id: string) => void;
  removendoId: string | null;
}

export function AvaliacoesPanel({
  avaliacoes,
  loading,
  erro,
  onTentarNovamente,
  minhasTurmas,
  criando,
  onCriar,
  onRemover,
  removendoId,
}: AvaliacoesPanelProps) {
  const [formAberto, setFormAberto] = useState(false);
  const [turmaId, setTurmaId] = useState('');
  const [disciplinaId, setDisciplinaId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(dataLocalHoje);
  const [tipo, setTipo] = useState<TipoAvaliacao>('prova');
  const [erroForm, setErroForm] = useState<string | null>(null);

  const disciplinasDaTurma: MinhaTurmaDisciplina[] = useMemo(() => {
    const turma = minhasTurmas.find((t) => t.turma_id === turmaId);
    return turma?.disciplinas || [];
  }, [minhasTurmas, turmaId]);

  const abrirFormulario = () => {
    const primeira = minhasTurmas[0];
    setTurmaId(primeira?.turma_id || '');
    setDisciplinaId(primeira?.disciplinas[0]?.disciplina_id || '');
    setTitulo('');
    setDescricao('');
    setData(dataLocalHoje());
    setTipo('prova');
    setErroForm(null);
    setFormAberto(true);
  };

  const validarESalvar = () => {
    const tituloLimpo = titulo.trim();
    if (tituloLimpo.length < 3 || tituloLimpo.length > 120) {
      setErroForm('O título deve ter entre 3 e 120 caracteres.');
      return;
    }
    if (!turmaId || !disciplinaId) {
      setErroForm('Escolha a turma e a disciplina da avaliação.');
      return;
    }
    if (!data) {
      setErroForm('Escolha a data da avaliação.');
      return;
    }
    if (data < dataLocalHoje()) {
      setErroForm('A data da avaliação não pode estar no passado.');
      return;
    }
    setErroForm(null);
    onCriar({
      turma_id: turmaId,
      disciplina_id: disciplinaId,
      titulo: tituloLimpo,
      descricao: descricao.trim() ? descricao.trim() : null,
      data,
      tipo,
    });
  };

  const fecharFormulario = () => {
    setFormAberto(false);
    setErroForm(null);
  };

  return (
    <div className="space-y-4 pb-24 lg:pb-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <ClipboardList className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-salvia-800 dark:text-salvia-200">
            Próximas avaliações
          </h3>
        </div>
        <button
          type="button"
          onClick={abrirFormulario}
          disabled={minhasTurmas.length === 0}
          className="flex items-center justify-center space-x-2 min-h-[44px] px-4 bg-salvia-700 hover:bg-salvia-800 disabled:opacity-50 text-white dark:bg-salvia-600 dark:hover:bg-salvia-500 rounded-xl text-xs font-bold transition-all"
        >
          <CalendarPlus className="w-4 h-4" />
          <span>Nova avaliação</span>
        </button>
      </div>

      {formAberto && (
        <div className="p-4 rounded-2xl border border-salvia-300 dark:border-salvia-700 bg-salvia-50/60 dark:bg-salvia-950/50 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-salvia-50">
              Nova avaliação
            </h4>
            <button
              type="button"
              onClick={fecharFormulario}
              aria-label="Fechar formulário"
              className="p-2 rounded-xl text-salvia-700 dark:text-salvia-300 hover:bg-salvia-100 dark:hover:bg-salvia-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="avaliacao-turma"
                className="block text-xs font-bold text-salvia-700 dark:text-salvia-300 mb-1"
              >
                Turma
              </label>
              <select
                id="avaliacao-turma"
                value={turmaId}
                onChange={(e) => {
                  const nova = e.target.value;
                  setTurmaId(nova);
                  const turma = minhasTurmas.find((t) => t.turma_id === nova);
                  setDisciplinaId(turma?.disciplinas[0]?.disciplina_id || '');
                }}
                className="w-full bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600"
              >
                {minhasTurmas.map((t) => (
                  <option key={t.turma_id} value={t.turma_id}>
                    {t.turma_nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="avaliacao-disciplina"
                className="block text-xs font-bold text-salvia-700 dark:text-salvia-300 mb-1"
              >
                Disciplina
              </label>
              <select
                id="avaliacao-disciplina"
                value={disciplinaId}
                onChange={(e) => setDisciplinaId(e.target.value)}
                disabled={disciplinasDaTurma.length === 0}
                className="w-full bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 disabled:opacity-60"
              >
                {disciplinasDaTurma.map((d) => (
                  <option key={d.disciplina_id} value={d.disciplina_id}>
                    {d.disciplina_nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="avaliacao-data"
                className="block text-xs font-bold text-salvia-700 dark:text-salvia-300 mb-1"
              >
                Data
              </label>
              <input
                id="avaliacao-data"
                type="date"
                value={data}
                min={dataLocalHoje()}
                onChange={(e) => setData(e.target.value)}
                className="w-full bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600"
              />
            </div>
            <div>
              <label
                htmlFor="avaliacao-tipo"
                className="block text-xs font-bold text-salvia-700 dark:text-salvia-300 mb-1"
              >
                Tipo
              </label>
              <select
                id="avaliacao-tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoAvaliacao)}
                className="w-full bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600"
              >
                {TIPOS_AVALIACAO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="avaliacao-titulo"
              className="block text-xs font-bold text-salvia-700 dark:text-salvia-300 mb-1"
            >
              Título
            </label>
            <input
              id="avaliacao-titulo"
              type="text"
              value={titulo}
              maxLength={120}
              placeholder="Ex.: Prova de Matemática"
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600"
            />
            <p className="text-xs text-salvia-600 dark:text-salvia-400 mt-1">
              Entre 3 e 120 caracteres.
            </p>
          </div>

          <div>
            <label
              htmlFor="avaliacao-descricao"
              className="block text-xs font-bold text-salvia-700 dark:text-salvia-300 mb-1"
            >
              Orientações (opcional)
            </label>
            <textarea
              id="avaliacao-descricao"
              value={descricao}
              rows={3}
              placeholder="Ex.: Capítulos 1 e 2, levar calculadora"
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600"
            />
          </div>

          {erroForm && (
            <div
              role="alert"
              className="p-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 text-xs flex items-start space-x-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{erroForm}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={validarESalvar}
              disabled={criando}
              className="flex-1 flex items-center justify-center space-x-2 min-h-[44px] bg-salvia-700 hover:bg-salvia-800 disabled:opacity-50 text-white dark:bg-salvia-600 dark:hover:bg-salvia-500 rounded-xl text-xs font-bold transition-all"
            >
              {criando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CalendarPlus className="w-4 h-4" />
              )}
              <span>{criando ? 'Salvando...' : 'Salvar avaliação'}</span>
            </button>
            <button
              type="button"
              onClick={fecharFormulario}
              className="flex-1 sm:flex-none flex items-center justify-center min-h-[44px] px-4 bg-salvia-100 hover:bg-salvia-200 dark:bg-salvia-800 dark:hover:bg-salvia-700 text-salvia-900 dark:text-salvia-100 rounded-xl text-xs font-bold transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {erro && (
        <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 text-xs space-y-2">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{erro}</span>
          </div>
          <button
            type="button"
            onClick={onTentarNovamente}
            className="flex items-center space-x-1.5 text-xs font-bold underline underline-offset-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Tentar de novo</span>
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-24 bg-salvia-100 dark:bg-salvia-800/60 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : avaliacoes.length === 0 ? (
        <div className="p-6 rounded-2xl border border-salvia-200 dark:border-salvia-800 bg-salvia-50/50 dark:bg-salvia-950/40 text-center">
          <ClipboardList className="w-8 h-8 mx-auto text-salvia-400 mb-2" />
          <p className="text-sm font-bold text-slate-900 dark:text-salvia-50">
            Nenhuma avaliação marcada nas suas turmas.
          </p>
          <p className="text-xs text-salvia-600 dark:text-salvia-400 mt-1">
            Use &quot;Nova avaliação&quot; para avisar a família sobre provas e trabalhos.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {avaliacoes.map((avaliacao) => (
            <div
              key={avaliacao.id}
              className="p-4 rounded-2xl border border-salvia-200 dark:border-salvia-800 bg-salvia-50/40 dark:bg-salvia-950/30 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="shrink-0 text-center px-3 py-2 rounded-xl bg-salvia-100 dark:bg-salvia-800">
                    <span className="block text-sm font-bold text-salvia-900 dark:text-salvia-50">
                      {formatarDiaMes(avaliacao.data)}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-salvia-50">
                      {avaliacao.titulo}
                    </h4>
                    <p className="text-xs text-salvia-700 dark:text-salvia-300">
                      {avaliacao.turma_nome}
                      {avaliacao.disciplina_nome ? ` · ${avaliacao.disciplina_nome}` : ''}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-salvia-100 text-salvia-800 dark:bg-salvia-800 dark:text-salvia-200">
                  {rotuloTipo(avaliacao.tipo)}
                </span>
              </div>

              <p className="text-xs text-salvia-600 dark:text-salvia-400">
                {formatarDataCompleta(avaliacao.data)}
              </p>

              {avaliacao.descricao && (
                <p className="text-xs text-slate-700 dark:text-salvia-200 whitespace-pre-line">
                  {avaliacao.descricao}
                </p>
              )}

              <button
                type="button"
                onClick={() => {
                  const confirmar = window.confirm(
                    `Remover a avaliação "${avaliacao.titulo}"? A família deixa de ver este aviso.`
                  );
                  if (confirmar) onRemover(avaliacao.id);
                }}
                disabled={removendoId === avaliacao.id}
                className="flex items-center justify-center space-x-2 min-h-[44px] w-full sm:w-auto px-4 bg-salvia-100 hover:bg-salvia-200 dark:bg-salvia-800 dark:hover:bg-salvia-700 text-salvia-900 dark:text-salvia-100 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                {removendoId === avaliacao.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Remover</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
