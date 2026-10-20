'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  Landmark,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Key,
  Shield,
  HelpCircle,
} from 'lucide-react';

export interface ItauEstadoView {
  modo: string; // 'mock' | 'sandbox' | 'production'
  ativo: boolean;
  agencia: string | null;
  conta: string | null;
  dac: string | null;
  id_beneficiario: string | null;
  chave_pix: string | null;
  especie_padrao: string;
  multa_padrao_percentual: number;
  juros_padrao_percentual: number;
  ultimo_teste_ok_em: string | null;
  has_client_id: boolean;
  client_id_mascarado: string | null;
  has_client_secret: boolean;
  has_certificado: boolean;
  certificado_valido_ate: string | null;
  pode_renovar: boolean;
  has_chave_transporte: boolean;
  chave_cifragem_configurada: boolean;
}

export interface ItauIntegrationCardProps {
  userRole?: string;
}

function useSafeRole(overrideRole?: string): string | undefined {
  try {
    const auth = useAuth();
    return overrideRole ?? auth.user?.role;
  } catch {
    return overrideRole;
  }
}

export function ItauIntegrationCard({ userRole }: ItauIntegrationCardProps) {
  const currentRole = useSafeRole(userRole);
  const isAdmin = currentRole === 'admin' || currentRole === 'superadmin';

  const [estado, setEstado] = useState<ItauEstadoView | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Passo 1: Dados de cobrança
  const [agencia, setAgencia] = useState('');
  const [conta, setConta] = useState('');
  const [dac, setDac] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [especiePadrao, setEspeciePadrao] = useState('04');
  const [multa, setMulta] = useState(2.0);
  const [juros, setJuros] = useState(1.0);
  const [salvandoDados, setSalvandoDados] = useState(false);
  const [dadosStatus, setDadosStatus] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // Passo 2: Chave de transporte
  const [gerandoTransporte, setGerandoTransporte] = useState(false);
  const [chavePublicaPem, setChavePublicaPem] = useState<string | null>(null);
  const [copiouChavePublica, setCopiouChavePublica] = useState(false);
  const [transporteStatus, setTransporteStatus] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // Passo 3: Credenciais de produção
  const [chaveSessaoCifrada, setChaveSessaoCifrada] = useState('');
  const [clientIdCifrado, setClientIdCifrado] = useState('');
  const [tokenTemporarioCifrado, setTokenTemporarioCifrado] = useState('');
  const [salvandoCredenciais, setSalvandoCredenciais] = useState(false);
  const [credenciaisStatus, setCredenciaisStatus] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // Passo 3 (Sandbox): Credenciais sandbox
  const [sandboxClientId, setSandboxClientId] = useState('');
  const [sandboxClientSecret, setSandboxClientSecret] = useState('');
  const [salvandoSandbox, setSalvandoSandbox] = useState(false);
  const [sandboxStatus, setSandboxStatus] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // Passo 4: Teste de conexão
  const [testando, setTestando] = useState(false);
  const [testeStatus, setTesteStatus] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // Passo 5: Ativar / Desativar
  const [ativando, setAtivando] = useState(false);
  const [ativarStatus, setAtivarStatus] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // Passo 6: Renovar certificado
  const [renovando, setRenovando] = useState(false);
  const [renovarStatus, setRenovarStatus] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const carregarEstado = () => {
    setLoading(true);
    apiFetch<ItauEstadoView>('/tenant/integrations/itau')
      .then((data) => {
        setEstado(data);
        setErrorMsg(null);
        if (data) {
          setAgencia(data.agencia || '');
          setConta(data.conta || '');
          setDac(data.dac || '');
          setChavePix(data.chave_pix || '');
          setEspeciePadrao(data.especie_padrao || '04');
          setMulta(data.multa_padrao_percentual ?? 2.0);
          setJuros(data.juros_padrao_percentual ?? 1.0);
        }
      })
      .catch((err: unknown) => {
        setErrorMsg(err instanceof Error ? err.message : 'Não foi possível carregar a integração Itaú.');
        setEstado(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    carregarEstado();
  }, []);

  const handleSalvarDados = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoDados(true);
    setDadosStatus(null);
    try {
      await apiFetch('/tenant/integrations/itau/dados', {
        method: 'PUT',
        body: JSON.stringify({
          agencia,
          conta,
          dac,
          chave_pix: chavePix,
          especie_padrao: especiePadrao,
          multa_padrao_percentual: Number(multa),
          juros_padrao_percentual: Number(juros),
        }),
      });
      setDadosStatus({ tipo: 'ok', texto: 'Dados de cobrança salvos com sucesso.' });
      carregarEstado();
    } catch (err: unknown) {
      setDadosStatus({
        tipo: 'erro',
        texto: err instanceof Error ? err.message : 'Erro ao salvar dados de cobrança.',
      });
    } finally {
      setSalvandoDados(false);
    }
  };

  const handleGerarChaveTransporte = async (substituir = false) => {
    if (substituir && !confirm('Deseja gerar nova chave de transporte? A chave anterior será invalidada.')) {
      return;
    }
    setGerandoTransporte(true);
    setTransporteStatus(null);
    try {
      const resp = await apiFetch<{ chave_publica_pem: string }>('/tenant/integrations/itau/chave-transporte', {
        method: 'POST',
        body: JSON.stringify({ substituir }),
      });
      setChavePublicaPem(resp.chave_publica_pem);
      setTransporteStatus({
        tipo: 'ok',
        texto: 'Chave de transporte gerada com sucesso. Copie e envie ao Analista de Operações do Itaú.',
      });
      carregarEstado();
    } catch (err: unknown) {
      setTransporteStatus({
        tipo: 'erro',
        texto: err instanceof Error ? err.message : 'Erro ao gerar chave de transporte.',
      });
    } finally {
      setGerandoTransporte(false);
    }
  };

  const handleCopiarChavePublica = () => {
    if (!chavePublicaPem) return;
    navigator.clipboard.writeText(chavePublicaPem);
    setCopiouChavePublica(true);
    setTimeout(() => setCopiouChavePublica(false), 2000);
  };

  const handleSalvarCredenciaisProducao = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoCredenciais(true);
    setCredenciaisStatus(null);
    try {
      await apiFetch('/tenant/integrations/itau/credenciais', {
        method: 'POST',
        body: JSON.stringify({
          chave_sessao_cifrada: chaveSessaoCifrada,
          client_id_cifrado: clientIdCifrado,
          token_temporario_cifrado: tokenTemporarioCifrado,
        }),
      });
      setCredenciaisStatus({ tipo: 'ok', texto: 'Credenciais de produção configuradas com sucesso.' });
      // Limpa campos sensíveis imediatamente da memória e nunca salva em localStorage
      setChaveSessaoCifrada('');
      setClientIdCifrado('');
      setTokenTemporarioCifrado('');
      carregarEstado();
    } catch (err: unknown) {
      setCredenciaisStatus({
        tipo: 'erro',
        texto: err instanceof Error ? err.message : 'Erro ao configurar credenciais de produção.',
      });
    } finally {
      setSalvandoCredenciais(false);
    }
  };

  const handleSalvarCredenciaisSandbox = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoSandbox(true);
    setSandboxStatus(null);
    try {
      await apiFetch('/tenant/integrations/itau/credenciais-sandbox', {
        method: 'POST',
        body: JSON.stringify({
          client_id: sandboxClientId,
          client_secret: sandboxClientSecret,
        }),
      });
      setSandboxStatus({ tipo: 'ok', texto: 'Credenciais de sandbox configuradas com sucesso.' });
      setSandboxClientId('');
      setSandboxClientSecret('');
      carregarEstado();
    } catch (err: unknown) {
      setSandboxStatus({
        tipo: 'erro',
        texto: err instanceof Error ? err.message : 'Erro ao salvar credenciais de sandbox.',
      });
    } finally {
      setSalvandoSandbox(false);
    }
  };

  const handleTestarConexao = async () => {
    setTestando(true);
    setTesteStatus(null);
    try {
      await apiFetch('/tenant/integrations/itau/testar', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setTesteStatus({ tipo: 'ok', texto: 'Conexão com o Itaú testada com sucesso!' });
      carregarEstado();
    } catch (err: unknown) {
      setTesteStatus({
        tipo: 'erro',
        texto: err instanceof Error ? err.message : 'Falha no teste de conexão com o Itaú.',
      });
    } finally {
      setTestando(false);
    }
  };

  const handleAlternarAtivacao = async () => {
    if (!estado) return;
    const novoStatus = !estado.ativo;
    setAtivando(true);
    setAtivarStatus(null);
    try {
      await apiFetch('/tenant/integrations/itau/ativar', {
        method: 'POST',
        body: JSON.stringify({ ativo: novoStatus }),
      });
      setAtivarStatus({
        tipo: 'ok',
        texto: novoStatus ? 'Integração ativada com sucesso.' : 'Integração desativada.',
      });
      carregarEstado();
    } catch (err: unknown) {
      setAtivarStatus({
        tipo: 'erro',
        texto: err instanceof Error ? err.message : 'Não foi possível alterar a ativação.',
      });
    } finally {
      setAtivando(false);
    }
  };

  const handleRenovarCertificado = async () => {
    setRenovando(true);
    setRenovarStatus(null);
    try {
      await apiFetch('/tenant/integrations/itau/renovar', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setRenovarStatus({ tipo: 'ok', texto: 'Certificado renovado com sucesso!' });
      carregarEstado();
    } catch (err: unknown) {
      setRenovarStatus({
        tipo: 'erro',
        texto: err instanceof Error ? err.message : 'Erro ao renovar certificado.',
      });
    } finally {
      setRenovando(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500 p-4">Carregando integração Itaú...</p>;
  }

  if (errorMsg && !estado) {
    return (
      <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-4 text-xs text-rose-800 dark:text-rose-200 space-y-2">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          <span>Erro ao carregar integração Itaú</span>
        </div>
        <p>{errorMsg}</p>
      </div>
    );
  }

  if (!estado) return null;

  const isMock = estado.modo === 'mock';
  const isSandbox = estado.modo === 'sandbox';
  const isProduction = estado.modo === 'production';
  const modoLabel = isMock ? 'Simulado' : isSandbox ? 'Teste (Stage)' : 'Produção';

  const passosDesabilitados = !estado.chave_cifragem_configurada;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141d17] p-4 space-y-5">
      {/* Header do Cartão Itaú */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-salvia-100 dark:bg-salvia-900 rounded-lg">
            <Landmark className="w-5 h-5 text-salvia-700 dark:text-salvia-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Banco Itaú</h3>
            <p className="text-[11px] text-slate-500">
              Emissão de Bolecode (boleto com QR Code Pix integrado).
            </p>
          </div>
        </div>
        <div>
          <button
            onClick={carregarEstado}
            title="Recarregar status"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grid de Estado da Conexão */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Modo de operação */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c120e] border border-slate-100 dark:border-slate-800">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">
            Modo de operação
          </span>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {modoLabel}
            </span>
            {isMock ? (
              <span className="inline-flex items-center rounded-md bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200">
                Demonstração
              </span>
            ) : isSandbox ? (
              <span className="inline-flex items-center rounded-md bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:text-blue-200">
                Teste
              </span>
            ) : (
              <span className="inline-flex items-center rounded-md bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-200">
                Ativo
              </span>
            )}
          </div>
        </div>

        {/* Situação da Integração */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c120e] border border-slate-100 dark:border-slate-800">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">
            Situação da integração
          </span>
          <div className="mt-1 flex items-center gap-2">
            {estado.ativo ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Ativa</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Inativa</span>
              </>
            )}
          </div>
        </div>

        {/* Client ID mascarado */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c120e] border border-slate-100 dark:border-slate-800">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">
            Client ID
          </span>
          <div className="mt-1">
            <span className="text-xs font-mono font-semibold text-slate-900 dark:text-slate-100">
              {estado.client_id_mascarado || (estado.has_client_id ? 'Configurado' : 'Não configurado')}
            </span>
          </div>
        </div>

        {/* Certificado Válido Até */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c120e] border border-slate-100 dark:border-slate-800">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">
            Certificado digital mTLS
          </span>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              {estado.certificado_valido_ate
                ? new Date(estado.certificado_valido_ate).toLocaleDateString('pt-BR')
                : estado.has_certificado
                ? 'Emitido'
                : 'Não emitido'}
            </span>
            {estado.pode_renovar && (
              <span className="inline-flex items-center rounded-md bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800 dark:text-amber-200">
                Pode renovar
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Avisos Estruturais */}
      {!estado.chave_cifragem_configurada && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Chave de cifragem não configurada no servidor</span>
            <p className="mt-0.5 text-[11px] leading-relaxed">
              A variável de ambiente APP_SECRETS_KEY não está configurada no servidor. Solicite ao administrador da infraestrutura para configurá-la antes de salvar segredos ou credenciais do Itaú.
            </p>
          </div>
        </div>
      )}

      {isMock && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>Modo simulado:</strong> nada é enviado ao banco. O sistema gera dados simulados para validação das regras de negócio e telas.
          </span>
        </div>
      )}

      {estado.pode_renovar && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>O certificado mTLS expira em menos de 30 dias e já pode ser renovado junto ao Itaú.</span>
          </div>
          {isAdmin && (
            <button
              onClick={handleRenovarCertificado}
              disabled={renovando || passosDesabilitados || isMock}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-all disabled:opacity-50 shrink-0"
            >
              {renovando ? 'Renovando...' : 'Renovar certificado'}
            </button>
          )}
        </div>
      )}

      {renovarStatus && (
        <div
          className={`p-2.5 rounded-lg text-xs font-semibold ${
            renovarStatus.tipo === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200'
          }`}
        >
          {renovarStatus.texto}
        </div>
      )}

      {/* SEÇÃO SOMENTE LEITURA PARA GESTOR */}
      {!isAdmin && (
        <div className="rounded-xl border border-salvia-200 dark:border-salvia-800 bg-salvia-50/50 dark:bg-salvia-950/30 p-4 space-y-3">
          <div className="flex items-center gap-2 text-salvia-800 dark:text-salvia-200">
            <Shield className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider">Dados configurados da cobrança</h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 font-semibold block">Agência / Conta / DAC</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {estado.agencia || '----'} / {estado.conta || '-------'} - {estado.dac || '-'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-semibold block">ID Beneficiário</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {estado.id_beneficiario || 'Não gerado'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-semibold block">Chave Pix</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate block">
                {estado.chave_pix || 'Não cadastrada'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-semibold block">Multa / Juros padrão</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {estado.multa_padrao_percentual}% / {estado.juros_padrao_percentual}% a.m.
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 italic mt-2">
            Apenas administradores podem editar credenciais e chaves do assistente de conexão.
          </p>
        </div>
      )}

      {/* ASSISTENTE DE CONEXÃO — APENAS PARA ADMIN */}
      {isAdmin && (
        <div className="space-y-4 pt-2">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Assistente de Conexão com o Itaú
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Siga os passos abaixo para autorizar o sistema a emitir boletos e receber avisos de liquidação.
            </p>
          </div>

          {/* Passo 1: Dados da cobrança */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c120e] space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-salvia-700 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                1
              </span>
              <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Dados da Cobrança (Conta & Beneficiário)
              </h5>
            </div>

            <form onSubmit={handleSalvarDados} className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Agência (4)
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={agencia}
                    onChange={(e) => setAgencia(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ex: 0057"
                    disabled={passosDesabilitados}
                    className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:border-salvia-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Conta (7)
                  </label>
                  <input
                    type="text"
                    maxLength={7}
                    value={conta}
                    onChange={(e) => setConta(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ex: 1234567"
                    disabled={passosDesabilitados}
                    className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:border-salvia-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    DAC (1)
                  </label>
                  <input
                    type="text"
                    maxLength={1}
                    value={dac}
                    onChange={(e) => setDac(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ex: 8"
                    disabled={passosDesabilitados}
                    className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:border-salvia-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Espécie (padrão 04)
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={especiePadrao}
                    onChange={(e) => setEspeciePadrao(e.target.value.replace(/\D/g, ''))}
                    placeholder="04"
                    disabled={passosDesabilitados}
                    className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:border-salvia-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-1">
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Chave Pix da Escola
                  </label>
                  <input
                    type="text"
                    value={chavePix}
                    onChange={(e) => setChavePix(e.target.value)}
                    placeholder="CNPJ, e-mail, telefone..."
                    disabled={passosDesabilitados}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:border-salvia-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Multa padrão (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={multa}
                    onChange={(e) => setMulta(parseFloat(e.target.value) || 0)}
                    disabled={passosDesabilitados}
                    className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:border-salvia-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Juros mora/mês (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={juros}
                    onChange={(e) => setJuros(parseFloat(e.target.value) || 0)}
                    disabled={passosDesabilitados}
                    className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:border-salvia-500 disabled:opacity-50"
                  />
                </div>
              </div>

              {dadosStatus && (
                <div
                  className={`p-2 rounded-lg text-xs font-semibold ${
                    dadosStatus.tipo === 'ok'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200'
                  }`}
                >
                  {dadosStatus.texto}
                </div>
              )}

              <button
                type="submit"
                disabled={salvandoDados || passosDesabilitados}
                className="px-3.5 py-2 rounded-xl bg-salvia-700 hover:bg-salvia-800 text-white font-semibold text-xs transition-all disabled:opacity-50 shadow-xs"
              >
                {salvandoDados ? 'Salvando...' : 'Salvar dados da cobrança'}
              </button>
            </form>
          </div>

          {/* Passo 2: Produção - Chave de transporte */}
          {isProduction && (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c120e] space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-salvia-700 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Chave de Transporte RSA (Produção)
                </h5>
              </div>

              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Gere o par de transporte seguro no servidor. A chave privada permanece cifrada no banco; envie apenas a chave pública ao Analista de Operações do Itaú.
              </p>

              {chavePublicaPem ? (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Chave pública de transporte (PEM)
                  </label>
                  <textarea
                    readOnly
                    rows={6}
                    value={chavePublicaPem}
                    className="w-full font-mono text-[10px] p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                  <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-[11px] text-blue-900 dark:text-blue-200 font-semibold">
                    Envie esta chave ao Analista de Operações do Itaú
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCopiarChavePublica}
                      className="px-3 py-1.5 rounded-lg bg-salvia-700 hover:bg-salvia-800 text-white font-semibold text-xs transition-all flex items-center gap-1.5"
                    >
                      {copiouChavePublica ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiouChavePublica ? 'Copiada!' : 'Copiar chave pública'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGerarChaveTransporte(true)}
                      disabled={gerandoTransporte || passosDesabilitados}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 font-semibold text-xs transition-all disabled:opacity-50"
                    >
                      {gerandoTransporte ? 'Gerando...' : 'Gerar nova chave'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {estado.has_chave_transporte ? (
                    <div className="space-y-2">
                      <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Chave de transporte já gerada e gravada com segurança no banco.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleGerarChaveTransporte(true)}
                        disabled={gerandoTransporte || passosDesabilitados}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 font-semibold text-xs transition-all disabled:opacity-50"
                      >
                        {gerandoTransporte ? 'Gerando...' : 'Gerar nova chave'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleGerarChaveTransporte(false)}
                      disabled={gerandoTransporte || passosDesabilitados}
                      className="px-3.5 py-2 rounded-xl bg-salvia-700 hover:bg-salvia-800 text-white font-semibold text-xs transition-all disabled:opacity-50 shadow-xs flex items-center gap-1.5"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>{gerandoTransporte ? 'Gerando...' : 'Gerar chave de transporte'}</span>
                    </button>
                  )}
                </div>
              )}

              {transporteStatus && (
                <div
                  className={`p-2 rounded-lg text-xs font-semibold ${
                    transporteStatus.tipo === 'ok'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200'
                  }`}
                >
                  {transporteStatus.texto}
                </div>
              )}
            </div>
          )}

          {/* Passo 3: Configurar Credenciais */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c120e] space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-salvia-700 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                3
              </span>
              <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {isSandbox ? 'Credenciais de Sandbox' : 'Credenciais Recebidas do Itaú por E-mail'}
              </h5>
            </div>

            {isProduction && (
              <form onSubmit={handleSalvarCredenciaisProducao} className="space-y-3">
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Cole abaixo os três valores cifrados recebidos no e-mail do Itaú. O servidor decifrará os dados com a chave de transporte e solicitará o certificado digital dinâmico. Os valores em claro são descartados da memória.
                </p>

                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Chave de sessão cifrada
                  </label>
                  <textarea
                    rows={2}
                    value={chaveSessaoCifrada}
                    onChange={(e) => setChaveSessaoCifrada(e.target.value)}
                    placeholder="Cole a chave de sessão cifrada..."
                    disabled={passosDesabilitados || isMock}
                    className="w-full text-xs font-mono p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:border-salvia-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Client ID cifrado
                  </label>
                  <textarea
                    rows={2}
                    value={clientIdCifrado}
                    onChange={(e) => setClientIdCifrado(e.target.value)}
                    placeholder="Cole o client ID cifrado..."
                    disabled={passosDesabilitados || isMock}
                    className="w-full text-xs font-mono p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:border-salvia-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Token temporário cifrado
                  </label>
                  <textarea
                    rows={2}
                    value={tokenTemporarioCifrado}
                    onChange={(e) => setTokenTemporarioCifrado(e.target.value)}
                    placeholder="Cole o token temporário cifrado..."
                    disabled={passosDesabilitados || isMock}
                    className="w-full text-xs font-mono p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:border-salvia-500 disabled:opacity-50"
                  />
                </div>

                {credenciaisStatus && (
                  <div
                    className={`p-2 rounded-lg text-xs font-semibold ${
                      credenciaisStatus.tipo === 'ok'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200'
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200'
                    }`}
                  >
                    {credenciaisStatus.texto}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={salvandoCredenciais || passosDesabilitados || isMock}
                  className="px-3.5 py-2 rounded-xl bg-salvia-700 hover:bg-salvia-800 text-white font-semibold text-xs transition-all disabled:opacity-50 shadow-xs"
                >
                  {salvandoCredenciais ? 'Configurando certificado e credenciais...' : 'Solicitar certificado e salvar credenciais'}
                </button>
              </form>
            )}

            {isSandbox && (
              <form onSubmit={handleSalvarCredenciaisSandbox} className="space-y-3">
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Informe o Client ID e Client Secret obtidos no portal do desenvolvedor do Itaú para o ambiente de testes (Sandbox).
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Client ID
                    </label>
                    <input
                      type="text"
                      value={sandboxClientId}
                      onChange={(e) => setSandboxClientId(e.target.value)}
                      placeholder="client_id do portal Itaú"
                      disabled={passosDesabilitados || isMock}
                      className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:border-salvia-500 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Client Secret
                    </label>
                    <input
                      type="password"
                      value={sandboxClientSecret}
                      onChange={(e) => setSandboxClientSecret(e.target.value)}
                      placeholder="client_secret (oculto)"
                      disabled={passosDesabilitados || isMock}
                      className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:border-salvia-500 disabled:opacity-50"
                    />
                  </div>
                </div>

                {sandboxStatus && (
                  <div
                    className={`p-2 rounded-lg text-xs font-semibold ${
                      sandboxStatus.tipo === 'ok'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200'
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200'
                    }`}
                  >
                    {sandboxStatus.texto}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={salvandoSandbox || passosDesabilitados || isMock}
                  className="px-3.5 py-2 rounded-xl bg-salvia-700 hover:bg-salvia-800 text-white font-semibold text-xs transition-all disabled:opacity-50 shadow-xs"
                >
                  {salvandoSandbox ? 'Salvando...' : 'Salvar credenciais de sandbox'}
                </button>
              </form>
            )}

            {isMock && (
              <p className="text-[11px] text-slate-500 italic">
                Em modo simulado não é necessário configurar credenciais bancárias.
              </p>
            )}
          </div>

          {/* Passo 4: Testar Conexão */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c120e] space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-salvia-700 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                4
              </span>
              <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">Testar Conexão OAuth</h5>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Verifique se as credenciais e o certificado mTLS conseguem obter um token de acesso válido nos servidores do Itaú.
            </p>

            {estado.ultimo_teste_ok_em && (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                Último teste com sucesso em: {new Date(estado.ultimo_teste_ok_em).toLocaleString('pt-BR')}
              </p>
            )}

            {testeStatus && (
              <div
                className={`p-2 rounded-lg text-xs font-semibold ${
                  testeStatus.tipo === 'ok'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200'
                }`}
              >
                {testeStatus.texto}
              </div>
            )}

            <button
              type="button"
              onClick={handleTestarConexao}
              disabled={testando || passosDesabilitados || isMock}
              className="px-3.5 py-2 rounded-xl bg-salvia-700 hover:bg-salvia-800 text-white font-semibold text-xs transition-all disabled:opacity-50 shadow-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testando ? 'animate-spin' : ''}`} />
              <span>{testando ? 'Testando conexão...' : 'Testar conexão'}</span>
            </button>
          </div>

          {/* Passo 5: Ativar Integração */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c120e] space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-salvia-700 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                5
              </span>
              <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">Ativação da Integração</h5>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              A ativação só pode ser ligada após a realização de um teste de conexão bem-sucedido.
            </p>

            {ativarStatus && (
              <div
                className={`p-2 rounded-lg text-xs font-semibold ${
                  ativarStatus.tipo === 'ok'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200'
                }`}
              >
                {ativarStatus.texto}
              </div>
            )}

            <button
              type="button"
              onClick={handleAlternarAtivacao}
              disabled={ativando || passosDesabilitados || isMock || !estado.ultimo_teste_ok_em}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-xs ${
                estado.ativo
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {ativando
                ? 'Atualizando...'
                : estado.ativo
                ? 'Desativar integração Itaú'
                : 'Ativar integração Itaú'}
            </button>

            {!estado.ultimo_teste_ok_em && !isMock && (
              <span className="text-[10px] text-amber-700 dark:text-amber-400 block font-semibold">
                * Realize o teste de conexão com sucesso para habilitar a ativação.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
