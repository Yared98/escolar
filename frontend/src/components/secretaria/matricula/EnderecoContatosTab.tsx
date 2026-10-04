import React from 'react';
import { MapPin, Phone } from 'lucide-react';
import { formatCep, formatPhone } from '@/lib/formatters';

export interface EnderecoContatosTabProps {
  cep: string;
  setCep: (v: string) => void;
  logradouro: string;
  setLogradouro: (v: string) => void;
  numero: string;
  setNumero: (v: string) => void;
  complemento: string;
  setComplemento: (v: string) => void;
  bairro: string;
  setBairro: (v: string) => void;
  cidade: string;
  setCidade: (v: string) => void;
  estado: string;
  setEstado: (v: string) => void;
  telefoneSecundario: string;
  setTelefoneSecundario: (v: string) => void;
  contatoEmergenciaNome: string;
  setContatoEmergenciaNome: (v: string) => void;
  contatoEmergenciaTelefone: string;
  setContatoEmergenciaTelefone: (v: string) => void;
  contatoEmergenciaParentesco: string;
  setContatoEmergenciaParentesco: (v: string) => void;
  setModalTab: (v: 'dados_aluno' | 'responsaveis' | 'endereco_contato' | 'prontuario') => void;
}

export function EnderecoContatosTab({
  cep,
  setCep,
  logradouro,
  setLogradouro,
  numero,
  setNumero,
  complemento,
  setComplemento,
  bairro,
  setBairro,
  cidade,
  setCidade,
  estado,
  setEstado,
  telefoneSecundario,
  setTelefoneSecundario,
  contatoEmergenciaNome,
  setContatoEmergenciaNome,
  contatoEmergenciaTelefone,
  setContatoEmergenciaTelefone,
  contatoEmergenciaParentesco,
  setContatoEmergenciaParentesco,
  setModalTab,
}: EnderecoContatosTabProps) {
  return (
    <div className="space-y-4">
      {/* Endereço Residencial */}
      <div className="p-3 bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
          <MapPin className="w-3.5 h-3.5 text-salvia-700 dark:text-salvia-400" />
          <span>Endereço Residencial</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              CEP
            </label>
            <input
              type="text"
              maxLength={9}
              value={cep}
              onChange={(e) => setCep(formatCep(e.target.value))}
              placeholder="00000-000"
              className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Logradouro (Rua, Avenida...)
            </label>
            <input
              type="text"
              value={logradouro}
              onChange={(e) => setLogradouro(e.target.value)}
              placeholder="Ex: Av. Paulista"
              className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Número
            </label>
            <input
              type="text"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ex: 1000"
              className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Complemento
            </label>
            <input
              type="text"
              value={complemento}
              onChange={(e) => setComplemento(e.target.value)}
              placeholder="Apto, Bloco..."
              className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Bairro
            </label>
            <input
              type="text"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              placeholder="Bairro"
              className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Cidade
            </label>
            <input
              type="text"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Cidade"
              className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Estado (UF)
            </label>
            <input
              type="text"
              maxLength={2}
              value={estado}
              onChange={(e) => setEstado(e.target.value.toUpperCase())}
              placeholder="SP"
              className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono uppercase"
            />
          </div>
        </div>
      </div>

      {/* Telefones de Contato & Emergência */}
      <div className="p-3 bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
          <Phone className="w-3.5 h-3.5 text-salvia-700 dark:text-salvia-400" />
          <span>Telefones Adicionais & Contato de Emergência</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Telefone Secundário / Recado
            </label>
            <input
              type="text"
              value={telefoneSecundario}
              onChange={(e) => setTelefoneSecundario(formatPhone(e.target.value))}
              placeholder="(11) 3333-4444"
              className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Contato de Emergência (Nome)
            </label>
            <input
              type="text"
              value={contatoEmergenciaNome}
              onChange={(e) => setContatoEmergenciaNome(e.target.value)}
              placeholder="Ex: Vovó Helena"
              className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Telefone Emergência
            </label>
            <input
              type="text"
              value={contatoEmergenciaTelefone}
              onChange={(e) => setContatoEmergenciaTelefone(formatPhone(e.target.value))}
              placeholder="(11) 91111-2222"
              className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Parentesco
            </label>
            <input
              type="text"
              value={contatoEmergenciaParentesco}
              onChange={(e) => setContatoEmergenciaParentesco(e.target.value)}
              placeholder="Ex: Avó"
              className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      <div className="pt-2 flex justify-between">
        <button
          type="button"
          onClick={() => setModalTab('responsaveis')}
          className="text-xs text-slate-600 dark:text-slate-400 font-bold hover:underline"
        >
          ← Voltar para Responsáveis
        </button>
        <button
          type="button"
          onClick={() => setModalTab('prontuario')}
          className="bg-salvia-700 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-salvia-800"
        >
          Avançar para Prontuário Médico →
        </button>
      </div>
    </div>
  );
}
