import React from 'react';
import { BookOpen, X } from 'lucide-react';
import { Sala, ProfessorItem } from './types';

export interface NovaTurmaModalProps {
  setShowTurmaModal: (v: boolean) => void;
  resetTurmaForm: () => void;
  handleCriarTurma: (e: React.FormEvent) => void;
  nomeTurma: string;
  setNomeTurma: (v: string) => void;
  codigoTurma: string;
  setCodigoTurma: (v: string) => void;
  etapaEnsinoTurma: string;
  setEtapaEnsinoTurma: (v: string) => void;
  serieTurma: string;
  setSerieTurma: (v: string) => void;
  turnoTurma: string;
  setTurnoTurma: (v: string) => void;
  anoLetivoTurma: number;
  setAnoLetivoTurma: (v: number) => void;
  capacidadeTurma: number;
  setCapacidadeTurma: (v: number) => void;
  salaIdTurma: string;
  setSalaIdTurma: (v: string) => void;
  salas: Sala[];
  professorRegenteIdTurma: string;
  setProfessorRegenteIdTurma: (v: string) => void;
  professores: ProfessorItem[];
}

export function NovaTurmaModal({
  setShowTurmaModal,
  resetTurmaForm,
  handleCriarTurma,
  nomeTurma,
  setNomeTurma,
  codigoTurma,
  setCodigoTurma,
  etapaEnsinoTurma,
  setEtapaEnsinoTurma,
  serieTurma,
  setSerieTurma,
  turnoTurma,
  setTurnoTurma,
  anoLetivoTurma,
  setAnoLetivoTurma,
  capacidadeTurma,
  setCapacidadeTurma,
  salaIdTurma,
  setSalaIdTurma,
  salas,
  professorRegenteIdTurma,
  setProfessorRegenteIdTurma,
  professores,
}: NovaTurmaModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl my-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-salvia-700 dark:text-salvia-400" />
              <span>Criar Nova Turma Pedagógica</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Defina parâmetros de etapa, série, turno, sala física e professor regente.
            </p>
          </div>
          <button
            onClick={() => {
              setShowTurmaModal(false);
              resetTurmaForm();
            }}
            className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCriarTurma} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nome da Turma *
              </label>
              <input
                type="text"
                required
                value={nomeTurma}
                onChange={(e) => setNomeTurma(e.target.value)}
                placeholder="Ex: 1º Ano A - Matutino"
                className="w-full bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-salvia-600 font-semibold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Código / Sigla
              </label>
              <input
                type="text"
                value={codigoTurma}
                onChange={(e) => setCodigoTurma(e.target.value)}
                placeholder="Ex: 1EF-A"
                className="w-full bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none font-mono uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Etapa de Ensino
              </label>
              <select
                value={etapaEnsinoTurma}
                onChange={(e) => setEtapaEnsinoTurma(e.target.value)}
                className="w-full bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none font-medium"
              >
                <option value="Educacao Infantil">Educação Infantil</option>
                <option value="Ensino Fundamental I">Ensino Fundamental I (1º ao 5º)</option>
                <option value="Ensino Fundamental II">Ensino Fundamental II (6º ao 9º)</option>
                <option value="Ensino Medio">Ensino Médio</option>
                <option value="EJA">EJA (Educação de Jovens e Adultos)</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Série / Ano
              </label>
              <input
                type="text"
                value={serieTurma}
                onChange={(e) => setSerieTurma(e.target.value)}
                placeholder="Ex: 1º Ano, Maternal II, 3ª Série..."
                className="w-full bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Turno
              </label>
              <select
                value={turnoTurma}
                onChange={(e) => setTurnoTurma(e.target.value)}
                className="w-full bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none font-medium"
              >
                <option value="Matutino">Matutino</option>
                <option value="Vespertino">Vespertino</option>
                <option value="Noturno">Noturno</option>
                <option value="Integral">Integral</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ano Letivo
              </label>
              <input
                type="number"
                required
                value={anoLetivoTurma}
                onChange={(e) => setAnoLetivoTurma(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Capacidade
              </label>
              <input
                type="number"
                required
                min={1}
                max={100}
                value={capacidadeTurma}
                onChange={(e) => setCapacidadeTurma(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Sala Física Alocada
              </label>
              <select
                value={salaIdTurma}
                onChange={(e) => setSalaIdTurma(e.target.value)}
                className="w-full bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none"
              >
                <option value="">Nenhuma / A definir</option>
                {salas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome} (Cap: {s.capacidade})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Professor(a) Regente
              </label>
              <select
                value={professorRegenteIdTurma}
                onChange={(e) => setProfessorRegenteIdTurma(e.target.value)}
                className="w-full bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none"
              >
                <option value="">Nenhum / A definir</option>
                {professores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setShowTurmaModal(false);
                resetTurmaForm();
              }}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-salvia-700 dark:bg-salvia-600 hover:bg-salvia-800 text-white rounded-xl font-bold transition-all shadow-md"
            >
              Salvar Turma
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
