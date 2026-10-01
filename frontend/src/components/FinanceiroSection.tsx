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

export function FinanceiroSection() {
  const searchParams = useSearchParams();
  const tabParam = searchParams ? searchParams.get('tab') : null;
  const activeSubTab: 'ar' | 'ap' | 'fornecedores' | 'nfse' | 'bi' | 'banking' =
    tabParam === 'ap' ||
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

  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendente' | 'pago' | 'atrasado'>('todos');
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

  // Filtragem e busca de faturas
  const faturasFiltradas = useMemo(() => {
    return faturas.filter((fat) => {
      const matchStatus = statusFilter === 'todos' || fat.status === statusFilter;
      const matchSearch =
        searchQuery.trim() === '' ||
        fat.descricao.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fat.metodo_pagamento.toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [faturas, statusFilter, searchQuery]);

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
    setReguaStatus('Executando régua...');
    try {
      const res = await apiFetch<{
        disparos_executados: number;
        mensagens: { lembretes_preventivos: number; avisos_vencimento_hoje: number; cobrancas_ativas: number };
      }>('/financeiro/cobranca/regua', { method: 'POST' });
      setReguaStatus(
        `Régua registrada: ${res.disparos_executados} eventos (D-5: ${res.mensagens.lembretes_preventivos}, D-0: ${res.mensagens.avisos_vencimento_hoje}, D+: ${res.mensagens.cobrancas_ativas}). Sem envio WhatsApp/e-mail real neste MVP.`
      );
      void loadFinanceiroData();
    } catch (err: unknown) {
      setReguaStatus(err instanceof Error ? err.message : 'Não foi possível executar a régua de cobrança.');
    }
    setTimeout(() => setReguaStatus(null), 6000);
  };

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
                      <td className="p-3 text-salvia-600 dark:text-salvia-400 font-mono">{fatura.data_vencimento}</td>
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

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              Últimos eventos da régua
            </h4>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
              {reguaLogs.length === 0 ? (
                <p className="p-3 text-xs text-slate-500">Sem logs. Execute a régua no cabeçalho.</p>
              ) : (
                reguaLogs.slice(0, 20).map((log) => (
                  <div key={log.id} className="p-3 text-[11px]">
                    <div className="flex justify-between gap-2 font-semibold text-slate-800 dark:text-slate-200">
                      <span>
                        {log.tipo_evento} · {log.canal}
                      </span>
                      <span className="font-mono text-slate-500">{log.status_envio}</span>
                    </div>
                    <p className="mt-1 text-slate-500 line-clamp-2">{log.mensagem_corpo}</p>
                  </div>
                ))
              )}
            </div>
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
