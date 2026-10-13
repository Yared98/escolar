'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { perfilAmigavel } from '@/lib/perfis';
import {
  DollarSign,
  QrCode,
  Send,
  PieChart,
  CheckCircle2,
  AlertTriangle,
  X,
  FileText,
  ArrowUpRight,
  ArrowDownLeft,
  Building,
  Check,
  Search,
  Plus,
  Copy,
  Upload,
  RotateCcw,
  CalendarClock,
  Clock,
  Filter,
  RefreshCw,
  Mail,
  MessageSquare,
  Info,
  BellRing,
} from 'lucide-react';
import { BankingIntegrations } from './BankingIntegrations';

import { Fatura, Despesa, Fornecedor, DreReport, AlunoOpcao, NfseItem, ReguaLog, AgingRange } from './financeiro/types';
export { type AgingRange } from './financeiro/types';
import { NovoFornecedorModal } from './financeiro/NovoFornecedorModal';
import { NovaFaturaModal } from './financeiro/NovaFaturaModal';
import { PixModal } from './financeiro/PixModal';
import { NovaDespesaModal } from './financeiro/NovaDespesaModal';
import { ReceberPanel } from './financeiro/ReceberPanel';
import { PagarPanel } from './financeiro/PagarPanel';
import { FornecedoresPanel } from './financeiro/FornecedoresPanel';
import { CobrancaPanel } from './financeiro/CobrancaPanel';
import { NfsePanel } from './financeiro/NfsePanel';
import { BiPanel } from './financeiro/BiPanel';

export const FATOR_RECUPERACAO_INADIMPLENCIA = 0.4; // estimativa de recuperação de inadimplência (MVP)

export const calcularDiasAtrasoFatura = (dataVencimentoStr: string): number => {
  if (!dataVencimentoStr) return 0;
  const parts = dataVencimentoStr.split('-');
  if (parts.length < 3) return 0;
  const ano = parseInt(parts[0], 10);
  const mes = parseInt(parts[1], 10) - 1;
  const dia = parseInt(parts[2], 10);
  const venc = new Date(ano, mes, dia);
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const diffMs = hoje.getTime() - venc.getTime();
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDias);
};

export const classificarFaixaAging = (fat: Fatura): '0-30' | '31-60' | '60+' | null => {
  if (fat.status === 'pago') return null;
  const dias = calcularDiasAtrasoFatura(fat.data_vencimento);
  if (dias <= 30) return '0-30';
  if (dias <= 60) return '31-60';
  return '60+';
};

export function FinanceiroSection() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  // Conexão com o banco envolve credenciais: o servidor só permite à gestão.
  const podeConfigurarBanco = perfilAmigavel(user?.role) === 'Gestão';
  const tabParam = searchParams ? searchParams.get('tab') : null;
  const activeSubTab: 'ar' | 'ap' | 'cobranca' | 'fornecedores' | 'nfse' | 'bi' | 'banking' =
    tabParam === 'ap' ||
    tabParam === 'cobranca' ||
    tabParam === 'fornecedores' ||
    tabParam === 'nfse' ||
    tabParam === 'bi' ||
    tabParam === 'banking'
      ? tabParam
      : 'ar';
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [alunosOpcoes, setAlunosOpcoes] = useState<AlunoOpcao[]>([]);
  const [nfseLista, setNfseLista] = useState<NfseItem[]>([]);
  const [reguaLogs, setReguaLogs] = useState<ReguaLog[]>([]);
  const [dre, setDre] = useState<DreReport | null>(null);
  const [_loading, setLoading] = useState(false);
  const [pixModalFatura, setPixModalFatura] = useState<Fatura | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [reguaStatus, setReguaStatus] = useState<string | null>(null);
  const [nfseStatus, setNfseStatus] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Estados específicos da Aba Cobrança (régua e logs)
  const [logCanalFilter, setLogCanalFilter] = useState<'todos' | 'whatsapp' | 'email'>('todos');
  const [logTipoFilter, setLogTipoFilter] = useState<
    'todos' | 'lembrete_preventivo' | 'aviso_vencimento' | 'cobranca_ativa'
  >('todos');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [loadingRegua, setLoadingRegua] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  const [reguaResult, setReguaResult] = useState<{
    disparos_executados: number;
    mensagens: { lembretes_preventivos: number; avisos_vencimento_hoje: number; cobrancas_ativas: number };
  } | null>(null);

  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendente' | 'pago' | 'atrasado'>('todos');
  const [agingFilter, setAgingFilter] = useState<AgingRange>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [showNovaDespesaModal, setShowNovaDespesaModal] = useState(false);
  const [showNovaFaturaModal, setShowNovaFaturaModal] = useState(false);
  const [novaFatura, setNovaFatura] = useState({
    aluno_id: '',
    descricao: '',
    valor: '',
    data_vencimento: new Date().toISOString().split('T')[0],
    metodo_pagamento: 'pix',
    desconto_percentual: '0',
  });
  const [novaDespesa, setNovaDespesa] = useState({
    descricao: '',
    categoria: 'manutencao',
    valor: '',
    data_vencimento: new Date().toISOString().split('T')[0],
    tipo: 'fixo',
    fornecedor_id: '',
  });
  const [novoFornecedor, setNovoFornecedor] = useState({
    razao_social: '',
    cnpj: '',
    ramo_atividade: '',
    email: '',
    telefone: '',
  });
  const [showFornecedorModal, setShowFornecedorModal] = useState(false);

  const loadFinanceiroData = useCallback(async () => {
    setLoading(true);
    try {
      const [faturasData, despesasData, dreData, fornecedoresData, nfseData, logsData, alunosPage] =
        await Promise.all([
          apiFetch<Fatura[]>('/financeiro/faturas'),
          apiFetch<Despesa[]>('/financeiro/despesas'),
          apiFetch<DreReport>('/financeiro/relatorios/dre'),
          apiFetch<Fornecedor[]>('/administrativo/fornecedores').catch(() => []),
          apiFetch<NfseItem[]>('/financeiro/nfse').catch(() => []),
          apiFetch<ReguaLog[]>('/financeiro/cobranca/logs').catch(() => []),
          apiFetch<{ items: AlunoOpcao[] }>('/secretaria/alunos?status=ativo&limit=200').catch(() => ({
            items: [],
          })),
        ]);
      setFaturas(faturasData);
      setDespesas(despesasData);
      setDre(dreData);
      setFornecedores(fornecedoresData);
      setNfseLista(nfseData || []);
      setReguaLogs(logsData || []);
      setAlunosOpcoes(alunosPage.items || []);
    } catch (err: unknown) {
      setFaturas([]);
      setDespesas([]);
      setDre(null);
      setToastMessage(err instanceof Error ? err.message : 'Não foi possível carregar o financeiro.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFinanceiroData();
  }, [loadFinanceiroData]);

  // Métricas agregadas do Aging Operacional de Contas a Receber (AR)
  const agingStats = useMemo(() => {
    let count0_30 = 0;
    let total0_30 = 0;
    let count31_60 = 0;
    let total31_60 = 0;
    let count60Plus = 0;
    let total60Plus = 0;

    for (const fat of faturas) {
      if (fat.status === 'pago') continue;
      const faixa = classificarFaixaAging(fat);
      if (faixa === '0-30') {
        count0_30 += 1;
        total0_30 += fat.valor;
      } else if (faixa === '31-60') {
        count31_60 += 1;
        total31_60 += fat.valor;
      } else if (faixa === '60+') {
        count60Plus += 1;
        total60Plus += fat.valor;
      }
    }

    return {
      r0_30: { count: count0_30, total: total0_30 },
      r31_60: { count: count31_60, total: total31_60 },
      r60Plus: { count: count60Plus, total: total60Plus },
      totalEmAberto: total0_30 + total31_60 + total60Plus,
      countEmAberto: count0_30 + count31_60 + count60Plus,
    };
  }, [faturas]);

  const handleToggleAgingFilter = (faixa: '0-30' | '31-60' | '60+') => {
    setAgingFilter((prev) => {
      const next = prev === faixa ? null : faixa;
      if (next && statusFilter === 'pago') {
        setStatusFilter('todos');
      }
      return next;
    });
  };

  // Filtragem e busca de faturas
  const faturasFiltradas = useMemo(() => {
    return faturas.filter((fat) => {
      if (agingFilter) {
        if (fat.status === 'pago') return false;
        const faixa = classificarFaixaAging(fat);
        if (faixa !== agingFilter) return false;
      }
      const matchStatus = statusFilter === 'todos' || fat.status === statusFilter;
      const matchSearch =
        searchQuery.trim() === '' ||
        fat.descricao.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fat.metodo_pagamento.toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [faturas, statusFilter, searchQuery, agingFilter]);

  // Baixa manual de fatura
  
  const handleOFXUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setToastMessage('Lendo arquivo OFX...');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const transacoes: any[] = [];
      
      // Basic OFX Parser
      const stmts = text.split('<STMTTRN>');
      for (let i = 1; i < stmts.length; i++) {
        const stmt = stmts[i];
        
        const typeMatch = stmt.match(/<TRNTYPE>(.*?)\s*</);
        const dtMatch = stmt.match(/<DTPOSTED>(\d{4})(\d{2})(\d{2})/);
        const amtMatch = stmt.match(/<TRNAMT>(.*?)\s*</);
        const memoMatch = stmt.match(/<MEMO>(.*?)\s*</);
        
        if (dtMatch && amtMatch && memoMatch) {
          const valor = parseFloat(amtMatch[1]);
          transacoes.push({
            banco: 'Upload OFX',
            data_transacao: `${dtMatch[1]}-${dtMatch[2]}-${dtMatch[3]}`,
            descricao: memoMatch[1],
            valor: Math.abs(valor),
            tipo: valor >= 0 ? 'credito' : 'debito'
          });
        }
      }

      if (transacoes.length === 0) {
        setToastMessage('Nenhuma transação encontrada no arquivo OFX.');
        setTimeout(() => setToastMessage(null), 4000);
        return;
      }

      try {
        await apiFetch('/financeiro/conciliacao/processar', {
          method: 'POST',
          body: JSON.stringify({ transacoes }),
        });
        setToastMessage(`Conciliação concluída! ${transacoes.length} transações processadas.`);
      } catch (err: unknown) {
        setToastMessage(err instanceof Error ? err.message : 'Não foi possível processar a conciliação.');
      }
      setTimeout(() => setToastMessage(null), 4000);
    };
    reader.readAsText(file);
  };

  const handleBaixaManual = async (fatura: Fatura) => {
    try {
      await apiFetch(`/financeiro/faturas/${fatura.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'pago' }),
      });
      setFaturas((prev) =>
        prev.map((f) => (f.id === fatura.id ? { ...f, status: 'pago' } : f))
      );
      setDre((prev) => {
        if (!prev) return null;
        const novaReceita = prev.receita_bruta + fatura.valor;
        const novaInadimp = Math.max(0, prev.inadimplencia_total - fatura.valor);
        const novoResultado = novaReceita - prev.despesas_totais;
        return {
          ...prev,
          receita_bruta: novaReceita,
          inadimplencia_total: novaInadimp,
          total_faturas_pagas: prev.total_faturas_pagas + 1,
          total_faturas_pendentes: Math.max(0, prev.total_faturas_pendentes - 1),
          resultado_liquido: novoResultado,
          dfc_caixa_projetado: novoResultado + novaInadimp * FATOR_RECUPERACAO_INADIMPLENCIA,
        };
      });
      setToastMessage(`Fatura "${fatura.descricao}" liquidada com sucesso!`);
    } catch (err: unknown) {
      setToastMessage(err instanceof Error ? err.message : 'Não foi possível liquidar a fatura.');
    }
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleExecutarRegua = async () => {
    setLoadingRegua(true);
    setReguaStatus('Executando régua de cobrança...');
    try {
      const res = await apiFetch<{
        disparos_executados: number;
        mensagens: { lembretes_preventivos: number; avisos_vencimento_hoje: number; cobrancas_ativas: number };
      }>('/financeiro/cobranca/regua', { method: 'POST' });
      setReguaResult(res);
      setReguaStatus(
        `Régua executada: ${res.disparos_executados} eventos registrados no banco (D-5: ${res.mensagens.lembretes_preventivos}, D-0: ${res.mensagens.avisos_vencimento_hoje}, D+: ${res.mensagens.cobrancas_ativas}). Status registrado internamente; sem envio real via WhatsApp ou e-mail nesta versão de demonstração.`
      );
      await loadFinanceiroData();
    } catch (err: unknown) {
      setReguaStatus(err instanceof Error ? err.message : 'Não foi possível executar a régua de cobrança.');
    } finally {
      setLoadingRegua(false);
      setTimeout(() => setReguaStatus(null), 8000);
    }
  };

  const handleRecarregarLogs = async () => {
    setLoadingLogs(true);
    try {
      const logs = await apiFetch<ReguaLog[]>('/financeiro/cobranca/logs');
      setReguaLogs(logs || []);
      setToastMessage('Logs de cobrança atualizados com sucesso.');
    } catch (err: unknown) {
      setToastMessage(err instanceof Error ? err.message : 'Erro ao atualizar logs da régua.');
    } finally {
      setLoadingLogs(false);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const handleCopyLogMensagem = (logId: string, texto?: string) => {
    if (!texto) return;
    navigator.clipboard.writeText(texto);
    setCopiedLogId(logId);
    setTimeout(() => setCopiedLogId(null), 2000);
  };

  const logsFiltrados = useMemo(() => {
    return reguaLogs.filter((log) => {
      const matchCanal = logCanalFilter === 'todos' || log.canal.toLowerCase() === logCanalFilter.toLowerCase();
      const matchTipo = logTipoFilter === 'todos' || log.tipo_evento === logTipoFilter;
      const matchQuery =
        !logSearchQuery.trim() ||
        (log.mensagem_corpo && log.mensagem_corpo.toLowerCase().includes(logSearchQuery.toLowerCase())) ||
        log.fatura_id.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
        log.status_envio.toLowerCase().includes(logSearchQuery.toLowerCase());
      return matchCanal && matchTipo && matchQuery;
    });
  }, [reguaLogs, logCanalFilter, logTipoFilter, logSearchQuery]);

  const handleEmitirNfse = async (faturaId: string) => {
    setNfseStatus('Registrando NFS-e simulada...');
    try {
      await apiFetch('/financeiro/nfse/emitir', {
        method: 'POST',
        body: JSON.stringify({ fatura_id: faturaId }),
      });
      setNfseStatus('NFS-e simulada registrada (sem transmissão à prefeitura).');
      void loadFinanceiroData();
    } catch (err: unknown) {
      setNfseStatus(err instanceof Error ? err.message : 'Não foi possível emitir a NFS-e.');
    }
    setTimeout(() => setNfseStatus(null), 4000);
  };

  const handleCriarFatura = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorNum = parseFloat(novaFatura.valor) || 0;
    if (!novaFatura.aluno_id || !novaFatura.descricao.trim() || valorNum <= 0) return;
    try {
      await apiFetch<Fatura>('/financeiro/faturas', {
        method: 'POST',
        body: JSON.stringify({
          aluno_id: novaFatura.aluno_id,
          descricao: novaFatura.descricao,
          valor: valorNum,
          data_vencimento: novaFatura.data_vencimento,
          metodo_pagamento: novaFatura.metodo_pagamento,
          desconto_percentual: parseFloat(novaFatura.desconto_percentual) || 0,
        }),
      });
      setShowNovaFaturaModal(false);
      setNovaFatura({
        aluno_id: '',
        descricao: '',
        valor: '',
        data_vencimento: new Date().toISOString().split('T')[0],
        metodo_pagamento: 'pix',
        desconto_percentual: '0',
      });
      setToastMessage('Fatura gerada com Pix/boleto local.');
      void loadFinanceiroData();
    } catch (err: unknown) {
      setToastMessage(err instanceof Error ? err.message : 'Não foi possível gerar a fatura.');
    }
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleEstornarDespesa = async (despesa: Despesa) => {
    if (despesa.status !== 'pago') return;
    if (!confirm(`Estornar a despesa “${despesa.descricao}”?`)) return;
    try {
      await apiFetch(`/financeiro/despesas/${despesa.id}/estornar`, { method: 'POST' });
      setToastMessage('Estorno lançado.');
      void loadFinanceiroData();
    } catch (err: unknown) {
      setToastMessage(err instanceof Error ? err.message : 'Não foi possível estornar.');
    }
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCriarFornecedor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const criado = await apiFetch<Fornecedor>('/administrativo/fornecedores', {
        method: 'POST',
        body: JSON.stringify(novoFornecedor),
      });
      setFornecedores((prev) => [...prev, { ...criado, status: criado.status || 'ativo' }].sort((a, b) => a.razao_social.localeCompare(b.razao_social)));
      setShowFornecedorModal(false);
      setNovoFornecedor({ razao_social: '', cnpj: '', ramo_atividade: '', email: '', telefone: '' });
      setToastMessage('Fornecedor cadastrado.');
    } catch (err: unknown) {
      setToastMessage(err instanceof Error ? err.message : 'Não foi possível cadastrar o fornecedor.');
    }
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleInativarFornecedor = async (id: string) => {
    if (!confirm('Deseja remover este fornecedor? Se houver despesas, ele será inativado.')) return;
    try {
      const resp = await apiFetch<{ status: string; mensagem: string }>(`/administrativo/fornecedores/${id}`, { method: 'DELETE' });
      if (resp.status === 'inativado') {
        setFornecedores((prev) => prev.map((f) => (f.id === id ? { ...f, status: 'inativo' } : f)));
      } else {
        setFornecedores((prev) => prev.filter((f) => f.id !== id));
      }
      setToastMessage(resp.mensagem);
    } catch (err: unknown) {
      setToastMessage(err instanceof Error ? err.message : 'Não foi possível remover o fornecedor.');
    }
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Cadastro de Nova Despesa
  const handleCriarDespesa = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorNum = parseFloat(novaDespesa.valor) || 0;
    if (valorNum <= 0 || !novaDespesa.descricao) return;

    try {
      let fornecedorId = novaDespesa.fornecedor_id;
      if (fornecedorId === '__novo__') {
        if (!novoFornecedor.razao_social.trim() || !novoFornecedor.cnpj.trim()) return;
        const criado = await apiFetch<Fornecedor>('/administrativo/fornecedores', {
          method: 'POST',
          body: JSON.stringify(novoFornecedor),
        });
        fornecedorId = criado.id;
        setFornecedores((prev) => [...prev, criado].sort((a, b) => a.razao_social.localeCompare(b.razao_social)));
      }
      if (!fornecedorId) return;

      const criada = await apiFetch<Despesa>('/financeiro/despesas', {
        method: 'POST',
        body: JSON.stringify({
          descricao: novaDespesa.descricao,
          categoria: novaDespesa.categoria,
          valor: valorNum,
          data_vencimento: novaDespesa.data_vencimento,
          tipo: novaDespesa.tipo,
          fornecedor_id: fornecedorId,
        }),
      });
      setDespesas((prev) => [criada, ...prev]);
      setDre((prev) => {
        if (!prev) return null;
        const novasDespesas = prev.despesas_totais + valorNum;
        const novoResultado = prev.receita_bruta - novasDespesas;
        return {
          ...prev,
          despesas_totais: novasDespesas,
          resultado_liquido: novoResultado,
          dfc_caixa_projetado: novoResultado + prev.inadimplencia_total * FATOR_RECUPERACAO_INADIMPLENCIA,
        };
      });
      setShowNovaDespesaModal(false);
      setNovaDespesa({
        descricao: '',
        categoria: 'manutencao',
        valor: '',
        data_vencimento: new Date().toISOString().split('T')[0],
        tipo: 'fixo',
        fornecedor_id: '',
      });
      setNovoFornecedor({ razao_social: '', cnpj: '', ramo_atividade: '', email: '', telefone: '' });
      setToastMessage(`Despesa "${criada.descricao}" registrada com sucesso!`);
    } catch (err: unknown) {
      setToastMessage(err instanceof Error ? err.message : 'Não foi possível registrar a despesa.');
    }
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Copiar código Pix
  const handleCopyPix = () => {
    if (!pixModalFatura?.qr_code_pix) return;
    navigator.clipboard.writeText(pixModalFatura.qr_code_pix);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2000);
  };

  return (
    <section id="financeiro" className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-salvia-100 dark:border-salvia-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-salvia-50 flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-salvia-600 dark:text-salvia-400" />
            <span>Financeiro</span>
          </h2>
          <p className="text-xs text-salvia-600 dark:text-salvia-400 mt-0.5">
            Mensalidades, inadimplência, cobrança e relatórios da escola.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExecutarRegua}
            className="bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 dark:hover:bg-salvia-600 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all shadow-sm"
          >
            <Send className="w-4 h-4" />
            <span>Executar Régua de Cobrança</span>
          </button>
        </div>
      </div>

      {/* Toasts e Alertas */}
      {toastMessage && (
        <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-300 text-xs rounded-xl font-semibold flex items-center space-x-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {reguaStatus && (
        <div className="mb-4 p-3 bg-salvia-100 dark:bg-salvia-800 border border-salvia-300 dark:border-salvia-700 text-salvia-900 dark:text-salvia-100 text-xs rounded-xl font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{reguaStatus}</span>
        </div>
      )}

      {nfseStatus && (
        <div className="mb-4 p-3 bg-salvia-100 dark:bg-salvia-800 border border-salvia-300 dark:border-salvia-700 text-salvia-900 dark:text-salvia-100 text-xs rounded-xl font-semibold flex items-center space-x-2">
          <FileText className="w-4 h-4 text-salvia-700 dark:text-salvia-300" />
          <span>{nfseStatus}</span>
        </div>
      )}

      {/* DRE BI Executive Cards (Design Sálvia Edition) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-salvia-600 dark:text-salvia-400 text-xs mb-1 font-medium">
            <span>Receita Bruta Total</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono">
            R$ {(dre?.receita_bruta || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-salvia-500 font-medium">
            {dre?.total_faturas_pagas || 0} faturas liquidadas
          </span>
        </div>

        <div className="bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-salvia-600 dark:text-salvia-400 text-xs mb-1 font-medium">
            <span>Inadimplência Real</span>
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-xl font-bold text-amber-700 dark:text-amber-400 font-mono">
            R$ {(dre?.inadimplencia_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-salvia-500 font-medium">
            {dre?.total_faturas_atrasadas ?? dre?.total_faturas_pendentes ?? 0} atrasada(s)
          </span>
        </div>

        <div className="bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-salvia-600 dark:text-salvia-400 text-xs mb-1 font-medium">
            <span>Despesas do período</span>
            <ArrowUpRight className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="text-xl font-bold text-rose-700 dark:text-rose-400 font-mono">
            R$ {(dre?.despesas_totais || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-salvia-500 font-medium">Folha + custos fixos</span>
        </div>

        <div className="bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-salvia-600 dark:text-salvia-400 text-xs mb-1 font-medium">
            <span>Resultado Líquido DRE</span>
            <PieChart className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-salvia-50 font-mono">
            R$ {(dre?.resultado_liquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-salvia-500 font-medium">Margem operacional líquida</span>
        </div>
      </div>

      {/* TAB CONTENT: AR Receitas / Faturas */}
      {activeSubTab === 'ar' && (
        <ReceberPanel
          agingFilter={agingFilter}
          setAgingFilter={setAgingFilter}
          handleToggleAgingFilter={handleToggleAgingFilter}
          agingStats={agingStats}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          setShowNovaFaturaModal={setShowNovaFaturaModal}
          faturasFiltradas={faturasFiltradas}
          calcularDiasAtrasoFatura={calcularDiasAtrasoFatura}
          handleBaixaManual={handleBaixaManual}
          setPixModalFatura={setPixModalFatura}
          handleEmitirNfse={handleEmitirNfse}
        />
      )}

      {/* TAB CONTENT: AP Despesas & Fornecedores */}
      {activeSubTab === 'ap' && (
        <PagarPanel
          setShowNovaDespesaModal={setShowNovaDespesaModal}
          despesas={despesas}
          handleEstornarDespesa={handleEstornarDespesa}
        />
      )}

      {activeSubTab === 'fornecedores' && (
        <FornecedoresPanel
          setShowFornecedorModal={setShowFornecedorModal}
          fornecedores={fornecedores}
          handleInativarFornecedor={handleInativarFornecedor}
        />
      )}

      {/* TAB CONTENT: Cobrança (Régua e Logs) */}
      {activeSubTab === 'cobranca' && (
        <CobrancaPanel
          handleExecutarRegua={handleExecutarRegua}
          loadingRegua={loadingRegua}
          reguaResult={reguaResult}
          logsFiltrados={logsFiltrados}
          reguaLogs={reguaLogs}
          handleRecarregarLogs={handleRecarregarLogs}
          loadingLogs={loadingLogs}
          logSearchQuery={logSearchQuery}
          setLogSearchQuery={setLogSearchQuery}
          logCanalFilter={logCanalFilter}
          setLogCanalFilter={setLogCanalFilter}
          logTipoFilter={logTipoFilter}
          setLogTipoFilter={setLogTipoFilter}
          handleCopyLogMensagem={handleCopyLogMensagem}
          copiedLogId={copiedLogId}
        />
      )}

      {/* TAB CONTENT: NFS-e */}
      {activeSubTab === 'nfse' && (
        <NfsePanel
          nfseLista={nfseLista}
        />
      )}

      {activeSubTab === 'banking' &&
        (podeConfigurarBanco ? (
          <BankingIntegrations />
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300 bg-salvia-50 dark:bg-salvia-950/40 border border-salvia-200 dark:border-salvia-800 rounded-xl p-4">
            A conexão com o banco é configurada pela gestão da escola.
          </p>
        ))}

      {/* TAB CONTENT: BI DRE / DFC */}
      {activeSubTab === 'bi' && (
        <BiPanel
          dre={dre}
          handleOFXUpload={handleOFXUpload}
        />
      )}

      {/* Pix Modal com Visual Feedback "Copiado!" */}
      {pixModalFatura && (
        <PixModal
          pixModalFatura={pixModalFatura}
          setPixModalFatura={setPixModalFatura}
          handleCopyPix={handleCopyPix}
          copiedPix={copiedPix}
        />
      )}

      {showFornecedorModal && (
        <NovoFornecedorModal
          setShowFornecedorModal={setShowFornecedorModal}
          handleCriarFornecedor={handleCriarFornecedor}
          novoFornecedor={novoFornecedor}
          setNovoFornecedor={setNovoFornecedor}
        />
      )}

      {/* Modal Nova Fatura */}
      {showNovaFaturaModal && (
        <NovaFaturaModal
          setShowNovaFaturaModal={setShowNovaFaturaModal}
          handleCriarFatura={handleCriarFatura}
          novaFatura={novaFatura}
          setNovaFatura={setNovaFatura}
          alunosOpcoes={alunosOpcoes}
        />
      )}

      {/* Modal Nova Despesa */}
      {showNovaDespesaModal && (
        <NovaDespesaModal
          setShowNovaDespesaModal={setShowNovaDespesaModal}
          handleCriarDespesa={handleCriarDespesa}
          novaDespesa={novaDespesa}
          setNovaDespesa={setNovaDespesa}
          fornecedores={fornecedores}
          novoFornecedor={novoFornecedor}
          setNovoFornecedor={setNovoFornecedor}
        />
      )}
    </section>
  );
}
