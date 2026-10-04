import React from 'react';
import { HeartPulse, CheckCircle2 } from 'lucide-react';

export interface ProntuarioInicialTabProps {
  tipoSanguineo: string;
  setTipoSanguineo: (v: string) => void;
  alergias: string;
  setAlergias: (v: string) => void;
  restricoesAlimentares: string;
  setRestricoesAlimentares: (v: string) => void;
  medicamentosContinuos: string;
  setMedicamentosContinuos: (v: string) => void;
  cuidadosEspeciais: string;
  setCuidadosEspeciais: (v: string) => void;
  historicoObservacoes: string;
  setHistoricoObservacoes: (v: string) => void;
  setModalTab: (v: 'dados_aluno' | 'responsaveis' | 'endereco_contato' | 'prontuario') => void;
  setShowModal: (v: boolean) => void;
}

export function ProntuarioInicialTab({
  tipoSanguineo,
  setTipoSanguineo,
  alergias,
  setAlergias,
  restricoesAlimentares,
  setRestricoesAlimentares,
  medicamentosContinuos,
  setMedicamentosContinuos,
  cuidadosEspeciais,
  setCuidadosEspeciais,
  historicoObservacoes,
  setHistoricoObservacoes,
  setModalTab,
  setShowModal,
}: ProntuarioInicialTabProps) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl space-y-3">
        <h4 className="text-xs font-bold text-rose-900 dark:text-rose-300 flex items-center space-x-1.5">
          <HeartPulse className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          <span>Ficha Médica & Prontuário de Cuidado Clínico</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tipo Sanguíneo
            </label>
            <select
              value={tipoSanguineo}
              onChange={(e) => setTipoSanguineo(e.target.value)}
              className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-semibold"
            >
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
              <option value="Não informado">Não informado</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Alergias Conhecidas (Medicamentosa, Insetos, etc.)
            </label>
            <input
              type="text"
              value={alergias}
              onChange={(e) => setAlergias(e.target.value)}
              placeholder="Ex: Dipirona, picada de abelha, pólen..."
              className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Restrições Alimentares (Glúten, Lactose...)
            </label>
            <input
              type="text"
              value={restricoesAlimentares}
              onChange={(e) => setRestricoesAlimentares(e.target.value)}
              placeholder="Ex: Intolerância à lactose severa"
              className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Medicamentos de Uso Contínuo
            </label>
            <input
              type="text"
              value={medicamentosContinuos}
              onChange={(e) => setMedicamentosContinuos(e.target.value)}
              placeholder="Ex: Bombinha para asma se necessário"
              className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Cuidados Especiais & Recomendações Clínicas
          </label>
          <input
            type="text"
            value={cuidadosEspeciais}
            onChange={(e) => setCuidadosEspeciais(e.target.value)}
            placeholder="Ex: Usar óculos em sala de aula, evitar sol direto..."
            className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Histórico Pedagógico & Observações Comportamentais
          </label>
          <textarea
            rows={2}
            value={historicoObservacoes}
            onChange={(e) => setHistoricoObservacoes(e.target.value)}
            placeholder="Observações comportamentais, necessidades pedagógicas adaptadas ou histórico anterior."
            className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 resize-none"
          />
        </div>
      </div>

      <div className="pt-2 flex justify-between items-center">
        <button
          type="button"
          onClick={() => setModalTab('endereco_contato')}
          className="text-xs text-slate-600 dark:text-slate-400 font-bold hover:underline"
        >
          ← Voltar para Endereço
        </button>
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => setShowModal(false)}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2 bg-salvia-700 dark:bg-salvia-600 hover:bg-salvia-800 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirmar Matrícula Integral</span>
          </button>
        </div>
      </div>
    </div>
  );
}
