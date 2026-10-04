import React from 'react';
import { Shield, CheckSquare, Square, FileText } from 'lucide-react';
import { formatCpf, formatPhone } from '@/lib/formatters';

export interface ResponsaveisTabProps {
  nomeResponsavel: string;
  setNomeResponsavel: (v: string) => void;
  parentescoResponsavelLegal: string;
  setParentescoResponsavelLegal: (v: string) => void;
  cpfResponsavelLegal: string;
  setCpfResponsavelLegal: (v: string) => void;
  telefoneResponsavel: string;
  setTelefoneResponsavel: (v: string) => void;
  emailResponsavel: string;
  setEmailResponsavel: (v: string) => void;
  responsavelFinanceiroIgualLegal: boolean;
  setResponsavelFinanceiroIgualLegal: (v: boolean) => void;
  nomeResponsavelFinanceiro: string;
  setNomeResponsavelFinanceiro: (v: string) => void;
  parentescoResponsavelFinanceiro: string;
  setParentescoResponsavelFinanceiro: (v: string) => void;
  cpfResponsavelFinanceiro: string;
  setCpfResponsavelFinanceiro: (v: string) => void;
  telefoneResponsavelFinanceiro: string;
  setTelefoneResponsavelFinanceiro: (v: string) => void;
  emailResponsavelFinanceiro: string;
  setEmailResponsavelFinanceiro: (v: string) => void;
  setModalTab: (v: 'dados_aluno' | 'responsaveis' | 'endereco_contato' | 'prontuario') => void;
}

export function ResponsaveisTab({
  nomeResponsavel,
  setNomeResponsavel,
  parentescoResponsavelLegal,
  setParentescoResponsavelLegal,
  cpfResponsavelLegal,
  setCpfResponsavelLegal,
  telefoneResponsavel,
  setTelefoneResponsavel,
  emailResponsavel,
  setEmailResponsavel,
  responsavelFinanceiroIgualLegal,
  setResponsavelFinanceiroIgualLegal,
  nomeResponsavelFinanceiro,
  setNomeResponsavelFinanceiro,
  parentescoResponsavelFinanceiro,
  setParentescoResponsavelFinanceiro,
  cpfResponsavelFinanceiro,
  setCpfResponsavelFinanceiro,
  telefoneResponsavelFinanceiro,
  setTelefoneResponsavelFinanceiro,
  emailResponsavelFinanceiro,
  setEmailResponsavelFinanceiro,
  setModalTab,
}: ResponsaveisTabProps) {
  return (
    <div className="space-y-4">
      {/* Responsável Legal */}
      <div className="p-3 bg-salvia-50/60 dark:bg-salvia-950/30 border border-salvia-200 dark:border-salvia-800/80 rounded-xl space-y-3">
        <h4 className="text-xs font-bold text-salvia-900 dark:text-salvia-300 flex items-center space-x-1.5">
          <Shield className="w-3.5 h-3.5" />
          <span>Responsável Legal (Pátrio Poder / Guarda)</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nome do Responsável Legal *
            </label>
            <input
              type="text"
              required
              value={nomeResponsavel}
              onChange={(e) => setNomeResponsavel(e.target.value)}
              placeholder="Ex: Mariana Souza"
              className="w-full bg-white dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-salvia-600 font-medium"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Parentesco
            </label>
            <select
              value={parentescoResponsavelLegal}
              onChange={(e) => setParentescoResponsavelLegal(e.target.value)}
              className="w-full bg-white dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-salvia-600"
            >
              <option value="Mãe">Mãe</option>
              <option value="Pai">Pai</option>
              <option value="Tutor Legal">Tutor Legal</option>
              <option value="Avó/Avô">Avó/Avô</option>
              <option value="Outro">Outro</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              CPF Responsável Legal
            </label>
            <input
              type="text"
              maxLength={14}
              value={cpfResponsavelLegal}
              onChange={(e) => setCpfResponsavelLegal(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              className="w-full bg-white dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Telefone / WhatsApp *
            </label>
            <input
              type="text"
              required
              value={telefoneResponsavel}
              onChange={(e) => setTelefoneResponsavel(formatPhone(e.target.value))}
              placeholder="(11) 98765-4321"
              className="w-full bg-white dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              E-mail *
            </label>
            <input
              type="email"
              required
              value={emailResponsavel}
              onChange={(e) => setEmailResponsavel(e.target.value)}
              placeholder="responsavel@email.com"
              className="w-full bg-white dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Flag de Unificação de Responsável */}
      <div
        onClick={() => setResponsavelFinanceiroIgualLegal(!responsavelFinanceiroIgualLegal)}
        className="p-3 bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl flex items-center space-x-3 cursor-pointer hover:border-salvia-500 transition-all select-none"
      >
        <div className="text-salvia-700 dark:text-salvia-400">
          {responsavelFinanceiroIgualLegal ? (
            <CheckSquare className="w-5 h-5" />
          ) : (
            <Square className="w-5 h-5 text-slate-400" />
          )}
        </div>
        <div>
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
            Responsável financeiro é a mesma pessoa que o responsável legal
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Marque esta opção caso um único pai/mãe ou tutor assuma tanto a representação legal quanto o pagamento das mensalidades.
          </span>
        </div>
      </div>

      {/* Responsável Financeiro Distinto (se flag for falsa) */}
      {!responsavelFinanceiroIgualLegal && (
        <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700/60 rounded-xl space-y-3 animate-fadeIn">
          <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center space-x-1.5">
            <FileText className="w-3.5 h-3.5" />
            <span>Responsável Financeiro (Pagador / Emissão de Boletos e NFS-e)</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nome do Responsável Financeiro *
              </label>
              <input
                type="text"
                required={!responsavelFinanceiroIgualLegal}
                value={nomeResponsavelFinanceiro}
                onChange={(e) => setNomeResponsavelFinanceiro(e.target.value)}
                placeholder="Ex: Carlos Roberto Silva"
                className="w-full bg-white dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-salvia-600 font-medium"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Parentesco
              </label>
              <select
                value={parentescoResponsavelFinanceiro}
                onChange={(e) => setParentescoResponsavelFinanceiro(e.target.value)}
                className="w-full bg-white dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="Pai">Pai</option>
                <option value="Mãe">Mãe</option>
                <option value="Padrasto/Madrasta">Padrasto/Madrasta</option>
                <option value="Avó/Avô">Avó/Avô</option>
                <option value="Outro Patrocinador">Outro Patrocinador</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                CPF Responsável Financeiro
              </label>
              <input
                type="text"
                maxLength={14}
                value={cpfResponsavelFinanceiro}
                onChange={(e) => setCpfResponsavelFinanceiro(formatCpf(e.target.value))}
                placeholder="000.000.000-00"
                className="w-full bg-white dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Telefone / WhatsApp Financeiro
              </label>
              <input
                type="text"
                value={telefoneResponsavelFinanceiro}
                onChange={(e) => setTelefoneResponsavelFinanceiro(formatPhone(e.target.value))}
                placeholder="(11) 99999-8888"
                className="w-full bg-white dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                E-mail Financeiro (Faturas & DRE)
              </label>
              <input
                type="email"
                value={emailResponsavelFinanceiro}
                onChange={(e) => setEmailResponsavelFinanceiro(e.target.value)}
                placeholder="financeiro.aluno@email.com"
                className="w-full bg-white dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </div>
      )}

      <div className="pt-2 flex justify-between">
        <button
          type="button"
          onClick={() => setModalTab('dados_aluno')}
          className="text-xs text-slate-600 dark:text-slate-400 font-bold hover:underline"
        >
          ← Voltar para Aluno
        </button>
        <button
          type="button"
          onClick={() => setModalTab('endereco_contato')}
          className="bg-salvia-700 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-salvia-800"
        >
          Avançar para Endereço →
        </button>
      </div>
    </div>
  );
}
