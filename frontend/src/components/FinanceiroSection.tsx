'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
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

interface Fatura {
  id: string;
  aluno_id?: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  metodo_pagamento: string;
  status: string;
  qr_code_pix?: string;
  parcela_numero?: number | null;
  parcela_total?: number | null;
  multa_percentual?: number;
  juros_mora_mes_percentual?: number;
}

interface Despesa {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  data_vencimento: string;
  metodo_pagamento?: string;
  status: string;
  tipo: string;
  fornecedor_id?: string;
  fornecedor_nome?: string;
}

interface Fornecedor {
  id: string;
  razao_social: string;
  cnpj: string;
  ramo_atividade?: string;
  email?: string;
  telefone?: string;
  status?: string;
}

interface DreReport {
  receita_bruta: number;
  despesas_totais: number;
  resultado_liquido: number;
  inadimplencia_total: number;
  total_faturas_pagas: number;
  total_faturas_pendentes: number;
  dfc_caixa_projetado: number;
}

interface AlunoOpcao {
  id: string;
  nome: string;
}

interface NfseItem {
  id: string;
  fatura_id: string;
  numero_nfse?: string;
  valor_servico: number;
  status: string;
  created_at?: string;
}

interface ReguaLog {
  id: string;
  fatura_id: string;
  canal: string;
  tipo_evento: string;
  status_envio: string;
  mensagem_corpo?: string;
  enviado_em: string;
}

export type AgingRange = '0-30' | '31-60' | '60+' | null;

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
          dfc_caixa_projetado: novoResultado + novaInadimp * 0.4,
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
        `Régua executada: ${res.disparos_executados} eventos registrados no banco (D-5: ${res.mensagens.lembretes_preventivos}, D-0: ${res.mensagens.avisos_vencimento_hoje}, D+: ${res.mensagens.cobrancas_ativas}). Status registrado internamente; sem envio real via WhatsApp ou e-mail neste MVP.`
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
          dfc_caixa_projetado: novoResultado + prev.inadimplencia_total * 0.4,
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
            <span>Dashboard Financeiro & Tesouraria Escolar</span>
          </h2>
          <p className="text-xs text-salvia-600 dark:text-salvia-400 mt-0.5">
            Faturamento, Gestão de Inadimplência, Régua de Cobrança Omnicanal e DRE/DFC.
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
            {dre?.total_faturas_pendentes || 0} pendentes de cobrança
          </span>
        </div>

        <div className="bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-salvia-600 dark:text-salvia-400 text-xs mb-1 font-medium">
            <span>Despesas Totais (AP)</span>
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
        <div className="space-y-4">
          {/* Seção Aging Operacional de Contas a Receber (AR) */}
          <div className="bg-salvia-50/50 dark:bg-salvia-950/40 border border-salvia-200 dark:border-salvia-800 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <CalendarClock className="w-4 h-4 text-salvia-700 dark:text-salvia-300" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-salvia-100">
                    Aging de Faturas em Aberto (Contas a Receber)
                  </h3>
                </div>
                <p className="text-[11px] text-salvia-600 dark:text-salvia-400 mt-0.5">
                  Posição operacional de vencimento e atraso para faturas em aberto (pendente + atrasado). Visão operacional da tesouraria, não contábil.
                </p>
              </div>

              {agingFilter && (
                <button
                  type="button"
                  onClick={() => setAgingFilter(null)}
                  className="self-start sm:self-auto text-[11px] font-semibold text-salvia-700 dark:text-salvia-300 hover:text-salvia-900 dark:hover:text-white flex items-center space-x-1 px-2.5 py-1 rounded-lg border border-salvia-300 dark:border-salvia-700 bg-white dark:bg-salvia-900 transition-colors shadow-xs"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Limpar filtro de aging</span>
                </button>
              )}
            </div>

            {/* Grid das Faixas de Aging */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Faixa 0-30 dias */}
              <button
                type="button"
                onClick={() => handleToggleAgingFilter('0-30')}
                className={`p-3.5 rounded-xl border text-left transition-all relative ${
                  agingFilter === '0-30'
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                    : 'bg-white dark:bg-salvia-900/80 border-salvia-200 dark:border-salvia-800 hover:border-salvia-300 dark:hover:border-salvia-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-800 dark:text-salvia-200 flex items-center space-x-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>0–30 dias</span>
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-mono">
                    {agingStats.r0_30.count} {agingStats.r0_30.count === 1 ? 'fatura' : 'faturas'}
                  </span>
                </div>
                <p className="text-base font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                  R$ {agingStats.r0_30.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-salvia-500 dark:text-salvia-400 mt-1">
                  A vencer ou até 30 dias de vencida
                </p>
                {agingFilter === '0-30' && (
                  <div className="absolute top-2 right-2 text-emerald-600 dark:text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </button>

              {/* Faixa 31-60 dias */}
              <button
                type="button"
                onClick={() => handleToggleAgingFilter('31-60')}
                className={`p-3.5 rounded-xl border text-left transition-all relative ${
                  agingFilter === '31-60'
                    ? 'bg-amber-50/80 dark:bg-amber-950/50 border-amber-500 dark:border-amber-500 ring-2 ring-amber-500/20 shadow-sm'
                    : 'bg-white dark:bg-salvia-900/80 border-salvia-200 dark:border-salvia-800 hover:border-salvia-300 dark:hover:border-salvia-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-800 dark:text-salvia-200 flex items-center space-x-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>31–60 dias</span>
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-mono">
                    {agingStats.r31_60.count} {agingStats.r31_60.count === 1 ? 'fatura' : 'faturas'}
                  </span>
                </div>
                <p className="text-base font-bold text-amber-700 dark:text-amber-400 font-mono">
                  R$ {agingStats.r31_60.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-salvia-500 dark:text-salvia-400 mt-1">
                  Atraso de 31 a 60 dias da data limite
                </p>
                {agingFilter === '31-60' && (
                  <div className="absolute top-2 right-2 text-amber-600 dark:text-amber-400">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </button>

              {/* Faixa 60+ dias */}
              <button
                type="button"
                onClick={() => handleToggleAgingFilter('60+')}
                className={`p-3.5 rounded-xl border text-left transition-all relative ${
                  agingFilter === '60+'
                    ? 'bg-rose-50/80 dark:bg-rose-950/50 border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20 shadow-sm'
                    : 'bg-white dark:bg-salvia-900/80 border-salvia-200 dark:border-salvia-800 hover:border-salvia-300 dark:hover:border-salvia-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-800 dark:text-salvia-200 flex items-center space-x-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-rose-500"></span>
                    <span>60+ dias</span>
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 font-mono">
                    {agingStats.r60Plus.count} {agingStats.r60Plus.count === 1 ? 'fatura' : 'faturas'}
                  </span>
                </div>
                <p className="text-base font-bold text-rose-700 dark:text-rose-400 font-mono">
                  R$ {agingStats.r60Plus.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-salvia-500 dark:text-salvia-400 mt-1">
                  Atraso superior a 60 dias (crítico)
                </p>
                {agingFilter === '60+' && (
                  <div className="absolute top-2 right-2 text-rose-600 dark:text-rose-400">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Barra de Filtros e Busca */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(['todos', 'pendente', 'pago', 'atrasado'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                    statusFilter === status
                      ? 'bg-salvia-700 text-white dark:bg-salvia-500 shadow-sm'
                      : 'bg-salvia-100 dark:bg-salvia-800 text-salvia-700 dark:text-salvia-300 hover:bg-salvia-200'
                  }`}
                >
                  {status}
                </button>
              ))}

              {agingFilter && (
                <div className="flex items-center space-x-1 pl-2 border-l border-salvia-200 dark:border-salvia-700">
                  <span className="text-[11px] px-2.5 py-0.5 rounded-lg font-semibold bg-salvia-200 dark:bg-salvia-800 text-salvia-900 dark:text-salvia-100 flex items-center space-x-1.5">
                    <span>Aging: {agingFilter === '0-30' ? '0–30 dias' : agingFilter === '31-60' ? '31–60 dias' : '60+ dias'}</span>
                    <button
                      type="button"
                      onClick={() => setAgingFilter(null)}
                      className="p-0.5 hover:text-rose-600 dark:hover:text-rose-400"
                      title="Remover filtro de aging"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-salvia-400" />
                <input
                  type="text"
                  placeholder="Buscar por descrição..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-56 pl-8 pr-3 py-1.5 text-xs rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-1 focus:ring-salvia-500"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowNovaFaturaModal(true)}
                className="bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-sm whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Fatura</span>
              </button>
            </div>
          </div>

          {/* Tabela de Faturas */}
          <div className="overflow-x-auto rounded-xl border border-salvia-200 dark:border-salvia-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-salvia-100 dark:bg-salvia-800 text-slate-900 dark:text-salvia-100 uppercase font-bold text-[11px] tracking-wider border-b border-salvia-200 dark:border-salvia-800">
                <tr>
                  <th className="p-3">Descrição da Fatura</th>
                  <th className="p-3">Vencimento</th>
                  <th className="p-3">Valor</th>
                  <th className="p-3">Método</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-salvia-100 dark:divide-salvia-800/60 text-slate-800 dark:text-salvia-200 font-medium">
                {faturasFiltradas.length > 0 ? (
                  faturasFiltradas.map((fatura) => (
                    <tr key={fatura.id} className="hover:bg-salvia-50/70 dark:hover:bg-salvia-800/40 transition-colors">
                      <td className="p-3 font-bold text-slate-900 dark:text-salvia-50">{fatura.descricao}</td>
                      <td className="p-3 text-salvia-600 dark:text-salvia-400 font-mono">
                        <div>{fatura.data_vencimento}</div>
                        {fatura.status !== 'pago' && (() => {
                          const dias = calcularDiasAtrasoFatura(fatura.data_vencimento);
                          if (dias > 0) {
                            return (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold font-sans block">
                                {dias}d de atraso
                              </span>
                            );
                          }
                          return (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans block">
                              no prazo
                            </span>
                          );
                        })()}
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-salvia-50 font-mono">
                        R$ {fatura.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 uppercase text-[10px] font-mono text-salvia-600 dark:text-salvia-400 font-bold">
                        {fatura.metodo_pagamento}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            fatura.status === 'pago'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-300'
                              : fatura.status === 'atrasado'
                              ? 'bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-300'
                              : 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300'
                          }`}
                        >
                          {fatura.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                        {fatura.status !== 'pago' && (
                          <button
                            onClick={() => handleBaixaManual(fatura)}
                            title="Dar baixa manual nesta fatura"
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold transition-all inline-flex items-center space-x-1 shadow-xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Baixar</span>
                          </button>
                        )}

                        <button
                          onClick={() => setPixModalFatura(fatura)}
                          className="px-2.5 py-1 bg-salvia-50 dark:bg-salvia-800 border border-salvia-200 dark:border-salvia-700 hover:border-salvia-500 text-salvia-900 dark:text-salvia-100 rounded-lg text-[11px] font-semibold transition-all inline-flex items-center space-x-1"
                        >
                          <QrCode className="w-3.5 h-3.5 text-salvia-600 dark:text-salvia-400" />
                          <span>QR Pix</span>
                        </button>

                        <button
                          onClick={() => handleEmitirNfse(fatura.id)}
                          className="px-2.5 py-1 bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 text-white rounded-lg text-[11px] font-semibold transition-all inline-flex items-center space-x-1"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>NFS-e</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-salvia-500 text-xs">
                      Nenhuma fatura encontrada para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: AP Despesas & Fornecedores */}
      {activeSubTab === 'ap' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 dark:text-salvia-50 uppercase tracking-wider">
              Contas a Pagar & Despesas Operacionais
            </h3>
            <button
              onClick={() => setShowNovaDespesaModal(true)}
              className="bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Despesa</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-salvia-200 dark:border-salvia-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-salvia-100 dark:bg-salvia-800 text-slate-900 dark:text-salvia-100 uppercase font-bold text-[11px] tracking-wider border-b border-salvia-200 dark:border-salvia-800">
                <tr>
                  <th className="p-3">Descrição da Despesa</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Fornecedor</th>
                  <th className="p-3">Vencimento</th>
                  <th className="p-3">Valor</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-salvia-100 dark:divide-salvia-800/60 text-slate-800 dark:text-salvia-200 font-medium">
                {despesas.map((d) => (
                  <tr key={d.id} className="hover:bg-salvia-50/70 dark:hover:bg-salvia-800/40 transition-colors">
                    <td className="p-3 font-bold text-slate-900 dark:text-salvia-50">{d.descricao}</td>
                    <td className="p-3 text-salvia-600 dark:text-salvia-400 capitalize">{d.categoria.replace('_', ' ')}</td>
                    <td className="p-3 font-semibold text-slate-900 dark:text-salvia-50">{d.fornecedor_nome || 'N/A'}</td>
                    <td className="p-3 text-salvia-600 dark:text-salvia-400 font-mono">{d.data_vencimento}</td>
                    <td className="p-3 font-bold text-rose-700 dark:text-rose-400 font-mono">
                      R$ {d.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 uppercase text-[10px] font-mono text-salvia-600 dark:text-salvia-400 font-bold">
                      {d.tipo}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          d.status === 'pago'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-300'
                            : d.status === 'estornada' || d.status === 'cancelado'
                            ? 'bg-slate-200 dark:bg-slate-800 border-slate-300 text-slate-600'
                            : 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {d.status === 'pago' && (
                        <button
                          type="button"
                          onClick={() => void handleEstornarDespesa(d)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-800 px-2 py-1 text-[10px] font-bold text-rose-700 dark:text-rose-300"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Estornar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'fornecedores' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 dark:text-salvia-50 uppercase tracking-wider">
              Cadastro de fornecedores
            </h3>
            <button
              type="button"
              onClick={() => setShowFornecedorModal(true)}
              className="bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo fornecedor</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fornecedores.map((fn) => (
              <div key={fn.id} className="bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl space-y-1.5">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-slate-900 dark:text-salvia-50 text-xs">{fn.razao_social}</h4>
                  <div className="flex items-center space-x-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${fn.status === 'inativo' ? 'bg-slate-200 text-slate-600' : 'bg-salvia-200 dark:bg-salvia-800 text-salvia-800 dark:text-salvia-200'}`}>
                      {fn.status === 'inativo' ? 'inativo' : (fn.ramo_atividade || 'ativo')}
                    </span>
                    {fn.status !== 'inativo' && (
                      <button type="button" onClick={() => handleInativarFornecedor(fn.id)} className="p-1 text-rose-600" title="Inativar fornecedor">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-salvia-600 dark:text-salvia-400 font-mono">CNPJ: {fn.cnpj}</p>
                <div className="flex justify-between text-xs text-salvia-500 pt-1 border-t border-salvia-200 dark:border-salvia-800">
                  <span>{fn.email}</span>
                  <span className="font-mono font-bold">{fn.telefone}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: Cobrança (Régua e Logs) */}
      {activeSubTab === 'cobranca' && (
        <div className="space-y-4">
          {/* Banner de Conformidade e Disclaimer Honesto */}
          <div className="rounded-xl border border-salvia-200 dark:border-salvia-800 bg-salvia-50/70 dark:bg-salvia-950/40 p-4 text-xs text-salvia-800 dark:text-salvia-200 space-y-2">
            <div className="flex items-center space-x-2 font-bold text-slate-900 dark:text-salvia-50">
              <Info className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
              <span>Régua de Cobrança Escolar Automatizada · Modo Simulado (MVP)</span>
            </div>
            <p className="leading-relaxed">
              O motor de régua analisa faturas escolares e processa as regras de régua preventiva (D-5 a D-1), aviso no dia (D-0) e cobrança ativa em atraso (D+ com cálculo automático de multa de 2% e juros pro-rata de 1% a.m.).
            </p>
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 font-medium">
              <strong>Aviso de integridade (MVP stub):</strong> Os disparos são registrados internamente no banco de dados para rastreabilidade e auditoria (<code className="font-mono">regua_cobranca_logs</code> com status <em>registrado</em>). <strong>Não há envio real de mensagens via WhatsApp ou E-mail</strong> para responsáveis ou alunos neste MVP (sem conector omnicanal externo ativo).
            </div>
          </div>

          {/* Cards dos Estágios da Régua */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                  D-5 a D-1 · Preventivo
                </span>
                <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-salvia-50">Lembrete Preventivo</h4>
              <p className="text-[11px] text-salvia-600 dark:text-salvia-400">
                Dispara notificação cordial com antecedência de até 5 dias contendo o Pix Copia e Cola para pagamento sem acréscimos.
              </p>
            </div>

            <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
                  D-0 · Vencimento
                </span>
                <BellRing className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-salvia-50">Vencimento Hoje</h4>
              <p className="text-[11px] text-salvia-600 dark:text-salvia-400">
                Alerta no dia do vencimento da mensalidade escolar para evitar incidência de encargos por esquecimento.
              </p>
            </div>

            <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 rounded-full">
                  D+ · Cobrança Ativa
                </span>
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-salvia-50">Cobrança em Atraso</h4>
              <p className="text-[11px] text-salvia-600 dark:text-salvia-400">
                Altera o status da fatura para <em>atrasado</em> e calcula automaticamente a multa padrão (2%) e juros pro-rata (1% a.m.).
              </p>
            </div>
          </div>

          {/* Painel de Ação de Execução */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-xl">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-salvia-50">Processar Motor de Régua</h4>
              <p className="text-[11px] text-salvia-600 dark:text-salvia-400">
                Dispara o endpoint POST /financeiro/cobranca/regua para classificar faturas e gravar logs no banco.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExecutarRegua}
              disabled={loadingRegua}
              className="bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 dark:hover:bg-salvia-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition-all whitespace-nowrap"
            >
              <Send className={`w-4 h-4 ${loadingRegua ? 'animate-pulse' : ''}`} />
              <span>{loadingRegua ? 'Processando régua...' : 'Executar régua agora'}</span>
            </button>
          </div>

          {/* Resumo da Execução Recente */}
          {reguaResult && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-600/40 rounded-xl text-xs space-y-1 animate-fade-in">
              <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-200 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Última Execução da Régua (Auditada)</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-emerald-900 dark:text-emerald-100 font-mono">
                <div>Total: <strong>{reguaResult.disparos_executados}</strong> eventos</div>
                <div>D-5: <strong>{reguaResult.mensagens.lembretes_preventivos}</strong></div>
                <div>D-0: <strong>{reguaResult.mensagens.avisos_vencimento_hoje}</strong></div>
                <div>D+: <strong>{reguaResult.mensagens.cobrancas_ativas}</strong></div>
              </div>
            </div>
          )}

          {/* Seção de Logs e Filtros */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-salvia-100 dark:border-salvia-800">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-salvia-100 flex items-center space-x-2">
                  <span>Auditoria & Logs de Cobrança ({logsFiltrados.length} de {reguaLogs.length})</span>
                </h3>
                <p className="text-[11px] text-salvia-600 dark:text-salvia-400">
                  Histórico detalhado das notificações geradas localmente com canal, fatura e payload.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRecarregarLogs}
                disabled={loadingLogs}
                className="self-start md:self-auto inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-salvia-300 dark:border-salvia-700 bg-white dark:bg-salvia-900 text-xs font-semibold text-salvia-700 dark:text-salvia-300 hover:bg-salvia-50 dark:hover:bg-salvia-800 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                <span>Atualizar logs</span>
              </button>
            </div>

            {/* Barra de Filtros */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-salvia-400" />
                <input
                  type="text"
                  placeholder="Filtrar por mensagem ou fatura..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-1 focus:ring-salvia-500"
                />
              </div>

              <div className="flex items-center space-x-1.5">
                <Filter className="w-3.5 h-3.5 text-salvia-500" />
                <select
                  value={logCanalFilter}
                  onChange={(e) => setLogCanalFilter(e.target.value as any)}
                  className="w-full py-1.5 px-2.5 text-xs rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50"
                >
                  <option value="todos">Todos os canais</option>
                  <option value="whatsapp">WhatsApp (simulado)</option>
                  <option value="email">E-mail (simulado)</option>
                </select>
              </div>

              <div>
                <select
                  value={logTipoFilter}
                  onChange={(e) => setLogTipoFilter(e.target.value as any)}
                  className="w-full py-1.5 px-2.5 text-xs rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50"
                >
                  <option value="todos">Todos os eventos</option>
                  <option value="lembrete_preventivo">Lembrete preventivo (D-5)</option>
                  <option value="aviso_vencimento">Aviso de vencimento (D-0)</option>
                  <option value="cobranca_ativa">Cobrança ativa (D+)</option>
                </select>
              </div>
            </div>

            {/* Listagem em Tabela */}
            <div className="overflow-x-auto rounded-xl border border-salvia-200 dark:border-salvia-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-salvia-100 dark:bg-salvia-800 text-[11px] uppercase font-bold text-salvia-900 dark:text-salvia-200">
                  <tr>
                    <th className="p-3">Data/Hora</th>
                    <th className="p-3">Canal</th>
                    <th className="p-3">Evento</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Fatura</th>
                    <th className="p-3">Mensagem / Notificação</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-salvia-100 dark:divide-salvia-800">
                  {logsFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500">
                        {reguaLogs.length === 0
                          ? 'Nenhum log registrado ainda. Clique em "Executar régua agora" para processar faturas pendentes.'
                          : 'Nenhum log correspondente aos filtros selecionados.'}
                      </td>
                    </tr>
                  ) : (
                    logsFiltrados.map((log) => (
                      <tr key={log.id} className="hover:bg-salvia-50/50 dark:hover:bg-salvia-950/40 transition-colors">
                        <td className="p-3 font-mono text-[11px] whitespace-nowrap text-salvia-700 dark:text-salvia-300">
                          {new Date(log.enviado_em).toLocaleString('pt-BR')}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="inline-flex items-center space-x-1 font-semibold text-[11px]">
                            {log.canal === 'whatsapp' ? (
                              <>
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>WhatsApp</span>
                              </>
                            ) : (
                              <>
                                <Mail className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                                <span>E-mail</span>
                              </>
                            )}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              log.tipo_evento === 'lembrete_preventivo'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                : log.tipo_evento === 'aviso_vencimento'
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                            }`}
                          >
                            {log.tipo_evento.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold bg-slate-100 dark:bg-salvia-800 text-slate-700 dark:text-salvia-300 border border-slate-200 dark:border-salvia-700">
                            {log.status_envio}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px] whitespace-nowrap text-slate-500">
                          {log.fatura_id.slice(0, 8)}…
                        </td>
                        <td className="p-3 text-[11px] text-slate-700 dark:text-slate-300 max-w-md">
                          <div className="line-clamp-2 hover:line-clamp-none transition-all">
                            {log.mensagem_corpo || '—'}
                          </div>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {log.mensagem_corpo && (
                            <button
                              type="button"
                              onClick={() => handleCopyLogMensagem(log.id, log.mensagem_corpo)}
                              className="p-1 text-salvia-600 dark:text-salvia-400 hover:text-salvia-900 dark:hover:text-salvia-100 transition-colors"
                              title="Copiar mensagem"
                            >
                              {copiedLogId === log.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: NFS-e */}
      {activeSubTab === 'nfse' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-[11px] text-amber-900 dark:text-amber-200">
            Emissões abaixo são <strong>simuladas</strong> (número/URL inventados). Não há transmissão ABRASF/prefeitura neste MVP. Use “NFS-e” nas ações da fatura paga/pendente para registrar.
          </div>
          <div className="overflow-x-auto rounded-xl border border-salvia-200 dark:border-salvia-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-salvia-100 dark:bg-salvia-800 text-[11px] uppercase font-bold">
                <tr>
                  <th className="p-3">Número</th>
                  <th className="p-3">Fatura</th>
                  <th className="p-3">Valor</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-salvia-100 dark:divide-salvia-800">
                {nfseLista.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-500">
                      Nenhuma NFS-e registrada.
                    </td>
                  </tr>
                ) : (
                  nfseLista.map((n) => (
                    <tr key={n.id}>
                      <td className="p-3 font-mono font-bold">{n.numero_nfse || '—'}</td>
                      <td className="p-3 font-mono text-[10px]">{n.fatura_id.slice(0, 8)}…</td>
                      <td className="p-3 font-mono">
                        R$ {n.valor_servico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3">{n.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'banking' && <BankingIntegrations />}

      {/* TAB CONTENT: BI DRE / DFC */}
      {activeSubTab === 'bi' && (
        <div className="p-5 bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50 flex items-center space-x-2">
              <PieChart className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
              <span>Demonstrativo do Resultado (DRE) & DFC Fluxo de Caixa Projetado</span>
            </h3>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-salvia-300 dark:border-salvia-700 bg-white dark:bg-salvia-900 px-3 py-1.5 text-[11px] font-bold text-salvia-800 dark:text-salvia-200">
              <Upload className="w-3.5 h-3.5" />
              Importar OFX
              <input type="file" accept=".ofx,.OFX" className="hidden" onChange={handleOFXUpload} />
            </label>
          </div>
          <p className="text-[11px] text-slate-500">
            Conciliação tenta casar crédito/débito por valor (±R$ 0,02) e data. Relatório gerencial (não contábil).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl space-y-2">
              <span className="font-bold text-slate-900 dark:text-salvia-50 block border-b pb-1">DRE Gerencial Sintético</span>
              <div className="flex justify-between">
                <span>(+) Receita Bruta de Mensalidades:</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                  R$ {(dre?.receita_bruta || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span>(-) Custos e Despesas Operacionais:</span>
                <span className="text-rose-700 dark:text-rose-400 font-bold">
                  R$ {(dre?.despesas_totais || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between border-t pt-1 font-bold">
                <span>(=) Resultado Operacional Líquido:</span>
                <span className="text-slate-900 dark:text-salvia-50">
                  R$ {(dre?.resultado_liquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl space-y-2">
              <span className="font-bold text-slate-900 dark:text-salvia-50 block border-b pb-1">DFC - Fluxo de Caixa Projetado</span>
              <div className="flex justify-between">
                <span>Caixa Atual Disponível:</span>
                <span className="text-slate-900 dark:text-salvia-50 font-bold">
                  R$ {(dre?.resultado_liquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Recuperação Projetada Régua (40% Inadimp.):</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                  + R$ {(((dre?.inadimplencia_total || 0) * 0.4)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between border-t pt-1 font-bold">
                <span>(=) Projeção de Caixa 30 Dias:</span>
                <span className="text-emerald-700 dark:text-emerald-400">
                  R$ {(dre?.dfc_caixa_projetado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pix Modal com Visual Feedback "Copiado!" */}
      {pixModalFatura && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-salvia-100 dark:border-salvia-800 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">Pagamento Pix Instantâneo</h3>
              <button
                onClick={() => setPixModalFatura(null)}
                className="text-salvia-400 hover:text-salvia-900 dark:hover:text-salvia-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white p-4 rounded-xl border border-salvia-200 shadow-sm inline-block mb-3">
              <div className="w-40 h-40 bg-salvia-50 border-2 border-salvia-200 rounded-lg flex items-center justify-center p-2 text-salvia-700">
                <QrCode className="w-24 h-24 text-salvia-700" />
              </div>
            </div>

            <p className="text-xs text-slate-900 dark:text-salvia-50 font-bold">{pixModalFatura.descricao}</p>
            <p className="text-base font-bold text-emerald-700 dark:text-emerald-400 font-mono my-1">
              R$ {pixModalFatura.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>

            <div className="mt-3 bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 p-2 rounded-xl text-[10px] font-mono text-salvia-700 dark:text-salvia-300 break-all select-all font-semibold max-h-24 overflow-y-auto">
              {pixModalFatura.qr_code_pix || '00020126580014br.gov.bcb.pix0136...'}
            </div>

            <button
              onClick={handleCopyPix}
              className={`mt-4 w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                copiedPix
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 text-white'
              }`}
            >
              {copiedPix ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copiado com Sucesso!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar Código Pix Copia e Cola</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {showFornecedorModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCriarFornecedor} className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-6 max-w-md w-full space-y-3 shadow-xl text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-salvia-100 dark:border-salvia-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">Cadastrar fornecedor</h3>
              <button type="button" onClick={() => setShowFornecedorModal(false)} className="text-salvia-400"><X className="w-5 h-5" /></button>
            </div>
            <input required placeholder="Razão social" value={novoFornecedor.razao_social} onChange={(e) => setNovoFornecedor({ ...novoFornecedor, razao_social: e.target.value })} className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950" />
            <div className="grid grid-cols-2 gap-2">
              <input required placeholder="CNPJ" value={novoFornecedor.cnpj} onChange={(e) => setNovoFornecedor({ ...novoFornecedor, cnpj: e.target.value })} className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 font-mono" />
              <input required placeholder="Ramo" value={novoFornecedor.ramo_atividade} onChange={(e) => setNovoFornecedor({ ...novoFornecedor, ramo_atividade: e.target.value })} className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input required type="email" placeholder="E-mail" value={novoFornecedor.email} onChange={(e) => setNovoFornecedor({ ...novoFornecedor, email: e.target.value })} className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950" />
              <input required placeholder="Telefone" value={novoFornecedor.telefone} onChange={(e) => setNovoFornecedor({ ...novoFornecedor, telefone: e.target.value })} className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950" />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button type="button" onClick={() => setShowFornecedorModal(false)} className="px-3 py-1.5 rounded-xl border border-salvia-200 dark:border-salvia-700">Cancelar</button>
              <button type="submit" className="bg-salvia-700 text-white px-4 py-1.5 rounded-xl font-bold">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Nova Fatura */}
      {showNovaFaturaModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-salvia-100 dark:border-salvia-800 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">Nova Fatura / Mensalidade</h3>
              <button type="button" onClick={() => setShowNovaFaturaModal(false)}>
                <X className="w-5 h-5 text-salvia-400" />
              </button>
            </div>
            <form onSubmit={handleCriarFatura} className="space-y-3 text-xs">
              <label className="block font-semibold text-salvia-700 dark:text-salvia-300">
                Aluno
                <select
                  required
                  value={novaFatura.aluno_id}
                  onChange={(e) => setNovaFatura({ ...novaFatura, aluno_id: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 p-2"
                >
                  <option value="">Selecione...</option>
                  {alunosOpcoes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block font-semibold text-salvia-700 dark:text-salvia-300">
                Descrição
                <input
                  required
                  value={novaFatura.descricao}
                  onChange={(e) => setNovaFatura({ ...novaFatura, descricao: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 p-2"
                  placeholder="Mensalidade Março/2026"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block font-semibold text-salvia-700 dark:text-salvia-300">
                  Valor (R$)
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={novaFatura.valor}
                    onChange={(e) => setNovaFatura({ ...novaFatura, valor: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 p-2 font-mono"
                  />
                </label>
                <label className="block font-semibold text-salvia-700 dark:text-salvia-300">
                  Desconto (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={novaFatura.desconto_percentual}
                    onChange={(e) => setNovaFatura({ ...novaFatura, desconto_percentual: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 p-2 font-mono"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block font-semibold text-salvia-700 dark:text-salvia-300">
                  Vencimento
                  <input
                    type="date"
                    required
                    value={novaFatura.data_vencimento}
                    onChange={(e) => setNovaFatura({ ...novaFatura, data_vencimento: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 p-2"
                  />
                </label>
                <label className="block font-semibold text-salvia-700 dark:text-salvia-300">
                  Método
                  <select
                    value={novaFatura.metodo_pagamento}
                    onChange={(e) => setNovaFatura({ ...novaFatura, metodo_pagamento: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 p-2"
                  >
                    <option value="pix">Pix</option>
                    <option value="boleto">Boleto (sintético)</option>
                  </select>
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowNovaFaturaModal(false)} className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold">
                  Cancelar
                </button>
                <button type="submit" className="px-3 py-1.5 rounded-xl bg-salvia-700 text-white font-bold">
                  Gerar fatura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nova Despesa */}
      {showNovaDespesaModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-salvia-100 dark:border-salvia-800 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">Cadastrar Nova Despesa</h3>
              <button
                onClick={() => setShowNovaDespesaModal(false)}
                className="text-salvia-400 hover:text-salvia-900 dark:hover:text-salvia-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCriarDespesa} className="space-y-3 text-xs">
              <div>
                <label className="block text-salvia-700 dark:text-salvia-300 font-semibold mb-1">
                  Descrição da Despesa
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Aquisição de Livros para Biblioteca"
                  value={novaDespesa.descricao}
                  onChange={(e) => setNovaDespesa({ ...novaDespesa, descricao: e.target.value })}
                  className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-1 focus:ring-salvia-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-salvia-700 dark:text-salvia-300 font-semibold mb-1">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={novaDespesa.valor}
                    onChange={(e) => setNovaDespesa({ ...novaDespesa, valor: e.target.value })}
                    className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-1 focus:ring-salvia-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-salvia-700 dark:text-salvia-300 font-semibold mb-1">
                    Data de Vencimento
                  </label>
                  <input
                    type="date"
                    required
                    value={novaDespesa.data_vencimento}
                    onChange={(e) => setNovaDespesa({ ...novaDespesa, data_vencimento: e.target.value })}
                    className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-1 focus:ring-salvia-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-salvia-700 dark:text-salvia-300 font-semibold mb-1">
                    Categoria
                  </label>
                  <select
                    value={novaDespesa.categoria}
                    onChange={(e) => setNovaDespesa({ ...novaDespesa, categoria: e.target.value })}
                    className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-1 focus:ring-salvia-500"
                  >
                    <option value="folha_pagamento">Folha de Pagamento</option>
                    <option value="manutencao">Manutenção Predial</option>
                    <option value="insumos">Insumos & Software</option>
                    <option value="alimentacao">Alimentação Escolar</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-salvia-700 dark:text-salvia-300 font-semibold mb-1">
                    Tipo de Custo
                  </label>
                  <select
                    value={novaDespesa.tipo}
                    onChange={(e) => setNovaDespesa({ ...novaDespesa, tipo: e.target.value })}
                    className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-1 focus:ring-salvia-500"
                  >
                    <option value="fixo">Fixo</option>
                    <option value="variavel">Variável</option>
                    <option value="pontual">Pontual</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-salvia-700 dark:text-salvia-300 font-semibold mb-1">
                  Fornecedor
                </label>
                <select
                  required
                  value={novaDespesa.fornecedor_id}
                  onChange={(e) => setNovaDespesa({ ...novaDespesa, fornecedor_id: e.target.value })}
                  className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-1 focus:ring-salvia-500"
                >
                  <option value="">Selecione um fornecedor</option>
                  {fornecedores.filter((f) => (f.status || 'ativo') === 'ativo').map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.razao_social}
                    </option>
                  ))}
                  <option value="__novo__">+ Cadastrar novo fornecedor</option>
                </select>
              </div>

              {novaDespesa.fornecedor_id === '__novo__' && (
                <div className="space-y-2 rounded-xl border border-salvia-200 dark:border-salvia-700 p-3">
                  <input
                    type="text"
                    required
                    placeholder="Razão social"
                    value={novoFornecedor.razao_social}
                    onChange={(e) => setNovoFornecedor({ ...novoFornecedor, razao_social: e.target.value })}
                    className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="CNPJ"
                      value={novoFornecedor.cnpj}
                      onChange={(e) => setNovoFornecedor({ ...novoFornecedor, cnpj: e.target.value })}
                      className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50 font-mono"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Ramo"
                      value={novoFornecedor.ramo_atividade}
                      onChange={(e) => setNovoFornecedor({ ...novoFornecedor, ramo_atividade: e.target.value })}
                      className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="email"
                      required
                      placeholder="E-mail"
                      value={novoFornecedor.email}
                      onChange={(e) => setNovoFornecedor({ ...novoFornecedor, email: e.target.value })}
                      className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Telefone"
                      value={novoFornecedor.telefone}
                      onChange={(e) => setNovoFornecedor({ ...novoFornecedor, telefone: e.target.value })}
                      className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50"
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowNovaDespesaModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-salvia-200 dark:border-salvia-700 text-salvia-700 dark:text-salvia-300 font-semibold hover:bg-salvia-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 text-white px-4 py-1.5 rounded-xl font-bold"
                >
                  Salvar Despesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
