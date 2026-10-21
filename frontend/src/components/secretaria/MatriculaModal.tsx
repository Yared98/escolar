import React from 'react';
import { UserCheck, X, Users, Shield, MapPin, HeartPulse, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { DadosAlunoTab } from './matricula/DadosAlunoTab';
import { ResponsaveisTab } from './matricula/ResponsaveisTab';
import { EnderecoContatosTab } from './matricula/EnderecoContatosTab';
import { ProntuarioInicialTab } from './matricula/ProntuarioInicialTab';

export interface MatriculaModalProps {
  setShowModal: (v: boolean) => void;
  modalTab: 'dados_aluno' | 'responsaveis' | 'endereco_contato' | 'prontuario';
  setModalTab: (v: 'dados_aluno' | 'responsaveis' | 'endereco_contato' | 'prontuario') => void;
  formError: string | null;
  formSuccess: string | null;
  origemCrm: boolean;
  handleMatricular: (e: React.FormEvent) => void | Promise<void>;
  nome: string;
  setNome: (v: string) => void;
  cpf: string;
  setCpf: (v: string) => void;
  dataNascimento: string;
  setDataNascimento: (v: string) => void;
  statusInicialMatricula: 'ativo' | 'pre_matricula';
  setStatusInicialMatricula: (v: 'ativo' | 'pre_matricula') => void;
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
}

export function MatriculaModal({
  setShowModal,
  modalTab,
  setModalTab,
  formError,
  formSuccess,
  origemCrm,
  handleMatricular,
  nome,
  setNome,
  cpf,
  setCpf,
  dataNascimento,
  setDataNascimento,
  statusInicialMatricula,
  setStatusInicialMatricula,
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
}: MatriculaModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 max-w-2xl sm:max-w-3xl w-full shadow-2xl my-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <UserCheck className="w-5 h-5 text-salvia-700 dark:text-salvia-400" />
              <span>Nova Matrícula & Cadastro Integral do Aluno</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Cadastre o aluno, responsáveis (legal/financeiro), endereço residencial e prontuário médico inicial.
            </p>
          </div>
          <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs inside Modal */}
        <div className="flex overflow-x-auto space-x-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl mb-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setModalTab('dados_aluno')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center space-x-1 whitespace-nowrap ${
              modalTab === 'dados_aluno'
                ? 'bg-salvia-700 text-white dark:bg-salvia-600 shadow-sm font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>1. Aluno</span>
          </button>
          <button
            type="button"
            onClick={() => setModalTab('responsaveis')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center space-x-1 whitespace-nowrap ${
              modalTab === 'responsaveis'
                ? 'bg-salvia-700 text-white dark:bg-salvia-600 shadow-sm font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>2. Responsáveis</span>
          </button>
          <button
            type="button"
            onClick={() => setModalTab('endereco_contato')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center space-x-1 whitespace-nowrap ${
              modalTab === 'endereco_contato'
                ? 'bg-salvia-700 text-white dark:bg-salvia-600 shadow-sm font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>3. Endereço & Emergência</span>
          </button>
          <button
            type="button"
            onClick={() => setModalTab('prontuario')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center space-x-1 whitespace-nowrap ${
              modalTab === 'prontuario'
                ? 'bg-salvia-700 text-white dark:bg-salvia-600 shadow-sm font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60'
            }`}
          >
            <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
            <span>4. Prontuário Médico</span>
          </button>
        </div>

        {formError && (
          <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center space-x-2 text-rose-800 dark:text-rose-200 text-xs font-medium">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{formError}</span>
          </div>
        )}

        {formSuccess && (
          <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center space-x-2 text-emerald-800 dark:text-emerald-200 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{formSuccess}</span>
          </div>
        )}

        {origemCrm && (
          <div className="mb-4 p-3 bg-salvia-50 dark:bg-salvia-950/60 border border-salvia-300 dark:border-salvia-700/80 rounded-xl flex items-center space-x-2 text-salvia-800 dark:text-salvia-200 text-xs font-medium">
            <UserCheck className="w-4 h-4 shrink-0 text-salvia-600 dark:text-salvia-400" />
            <span>Dados importados do lead do CRM. Complete as informações para finalizar a matrícula.</span>
          </div>
        )}

        <form onSubmit={handleMatricular} className="space-y-4">
          {/* TAB 1: DADOS DO ALUNO */}
          {modalTab === 'dados_aluno' && (
            <DadosAlunoTab
              nome={nome}
              setNome={setNome}
              cpf={cpf}
              setCpf={setCpf}
              dataNascimento={dataNascimento}
              setDataNascimento={setDataNascimento}
              statusInicialMatricula={statusInicialMatricula}
              setStatusInicialMatricula={setStatusInicialMatricula}
              setModalTab={setModalTab}
            />
          )}

          {/* TAB 2: RESPONSÁVEL LEGAL & FINANCEIRO */}
          {modalTab === 'responsaveis' && (
            <ResponsaveisTab
              nomeResponsavel={nomeResponsavel}
              setNomeResponsavel={setNomeResponsavel}
              parentescoResponsavelLegal={parentescoResponsavelLegal}
              setParentescoResponsavelLegal={setParentescoResponsavelLegal}
              cpfResponsavelLegal={cpfResponsavelLegal}
              setCpfResponsavelLegal={setCpfResponsavelLegal}
              telefoneResponsavel={telefoneResponsavel}
              setTelefoneResponsavel={setTelefoneResponsavel}
              emailResponsavel={emailResponsavel}
              setEmailResponsavel={setEmailResponsavel}
              responsavelFinanceiroIgualLegal={responsavelFinanceiroIgualLegal}
              setResponsavelFinanceiroIgualLegal={setResponsavelFinanceiroIgualLegal}
              nomeResponsavelFinanceiro={nomeResponsavelFinanceiro}
              setNomeResponsavelFinanceiro={setNomeResponsavelFinanceiro}
              parentescoResponsavelFinanceiro={parentescoResponsavelFinanceiro}
              setParentescoResponsavelFinanceiro={setParentescoResponsavelFinanceiro}
              cpfResponsavelFinanceiro={cpfResponsavelFinanceiro}
              setCpfResponsavelFinanceiro={setCpfResponsavelFinanceiro}
              telefoneResponsavelFinanceiro={telefoneResponsavelFinanceiro}
              setTelefoneResponsavelFinanceiro={setTelefoneResponsavelFinanceiro}
              emailResponsavelFinanceiro={emailResponsavelFinanceiro}
              setEmailResponsavelFinanceiro={setEmailResponsavelFinanceiro}
              setModalTab={setModalTab}
            />
          )}

          {/* TAB 3: ENDEREÇO & CONTATOS DE EMERGÊNCIA */}
          {modalTab === 'endereco_contato' && (
            <EnderecoContatosTab
              cep={cep}
              setCep={setCep}
              logradouro={logradouro}
              setLogradouro={setLogradouro}
              numero={numero}
              setNumero={setNumero}
              complemento={complemento}
              setComplemento={setComplemento}
              bairro={bairro}
              setBairro={setBairro}
              cidade={cidade}
              setCidade={setCidade}
              estado={estado}
              setEstado={setEstado}
              telefoneSecundario={telefoneSecundario}
              setTelefoneSecundario={setTelefoneSecundario}
              contatoEmergenciaNome={contatoEmergenciaNome}
              setContatoEmergenciaNome={setContatoEmergenciaNome}
              contatoEmergenciaTelefone={contatoEmergenciaTelefone}
              setContatoEmergenciaTelefone={setContatoEmergenciaTelefone}
              contatoEmergenciaParentesco={contatoEmergenciaParentesco}
              setContatoEmergenciaParentesco={setContatoEmergenciaParentesco}
              setModalTab={setModalTab}
            />
          )}

          {/* TAB 4: PRONTUÁRIO MÉDICO INICIAL */}
          {modalTab === 'prontuario' && (
            <ProntuarioInicialTab
              tipoSanguineo={tipoSanguineo}
              setTipoSanguineo={setTipoSanguineo}
              alergias={alergias}
              setAlergias={setAlergias}
              restricoesAlimentares={restricoesAlimentares}
              setRestricoesAlimentares={setRestricoesAlimentares}
              medicamentosContinuos={medicamentosContinuos}
              setMedicamentosContinuos={setMedicamentosContinuos}
              cuidadosEspeciais={cuidadosEspeciais}
              setCuidadosEspeciais={setCuidadosEspeciais}
              historicoObservacoes={historicoObservacoes}
              setHistoricoObservacoes={setHistoricoObservacoes}
              setModalTab={setModalTab}
              setShowModal={setShowModal}
            />
          )}
        </form>
      </div>
    </div>
  );
}
