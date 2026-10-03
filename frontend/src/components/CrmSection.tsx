'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Users, Phone, Mail, Plus, AlertCircle, X, UserPlus } from 'lucide-react';

interface Lead {
  id: string;
  tenant_id: string;
  nome: string;
  telefone: string;
  email: string;
  estagio_funil: string;
  canal_aquisicao: string | null;
  observacoes: string | null;
  created_at: string;
}

interface FunilRelatorio {
  total_leads: number;
  taxa_conversao_pct: number;
  cac_medio: number;
  novo_lead: number;
  visita_agendada: number;
  proposta_enviada: number;
  matriculado: number;
  perdido: number;
}

export function CrmSection() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [relatorio, setRelatorio] = useState<FunilRelatorio | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const emptyForm = {
    nome: '',
    nome_aluno: '',
    telefone: '',
    email: '',
    serie_interesse: 'Infantil 3',
    origem: 'site',
  };
  const [formData, setFormData] = useState(emptyForm);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [leadsData, funilData] = await Promise.all([
        apiFetch<Lead[]>('/crm/leads'),
        apiFetch<FunilRelatorio>('/crm/relatorios/funil')
      ]);
      setLeads(leadsData || []);
      setRelatorio(funilData);
      setErro(null);
    } catch (err) {
      console.error('Erro ao carregar dados do CRM:', err);
      setLeads([]);
      setRelatorio(null);
      setErro(err instanceof Error ? err.message : 'Não foi possível carregar o CRM.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const observacoes = [
        formData.nome_aluno ? `Aluno: ${formData.nome_aluno}` : '',
        formData.serie_interesse ? `Série: ${formData.serie_interesse}` : '',
      ].filter(Boolean).join(' · ');
      await apiFetch('/crm/leads', {
        method: 'POST',
        body: JSON.stringify({
          nome: formData.nome,
          email: formData.email,
          telefone: formData.telefone,
          estagio_funil: 'novo_lead',
          canal_aquisicao: formData.origem,
          observacoes: observacoes || null,
        }),
      });
      setShowModal(false);
      setFormData(emptyForm);
      setAviso('Lead registrado no funil.');
      loadData();
    } catch (err) {
      console.error(err);
      setAviso(err instanceof Error ? err.message : 'Não foi possível criar o lead.');
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      await apiFetch(`/crm/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify({ estagio_funil: newStatus }),
      });
      loadData();
    } catch (err) {
      console.error(err);
      setAviso(err instanceof Error ? err.message : 'Não foi possível atualizar o estágio.');
    }
  };

  const handleAbrirMatricula = (lead: Lead) => {
    let alunoNome = '';
    if (lead.observacoes) {
      const match = lead.observacoes.match(/Aluno:\s*([^·\n]+)/);
      if (match) {
        alunoNome = match[1].trim();
      }
    }

    const params = new URLSearchParams();
    params.set('route', 'secretaria');
    params.set('tab', 'alunos');
    params.set('nova_matricula', '1');
    if (lead.nome) params.set('lead_nome', lead.nome);
    if (lead.telefone) params.set('lead_telefone', lead.telefone);
    if (lead.email) params.set('lead_email', lead.email);
    if (alunoNome) params.set('lead_aluno', alunoNome);

    router.push(`/?${params.toString()}`, { scroll: false });
  };

  const campo =
    'w-full bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600';

  const colunas = [
    { id: 'novo_lead', title: 'Novos Leads' },
    { id: 'visita_agendada', title: 'Visita Agendada' },
    { id: 'proposta_enviada', title: 'Proposta Enviada' },
    { id: 'matriculado', title: 'Matrícula' },
    { id: 'perdido', title: 'Perdido' },
  ];

  return (
    <section
      id="crm"
      className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-4 sm:p-6 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-salvia-100 dark:border-salvia-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-salvia-50 flex items-center space-x-2">
            <Users className="w-5 h-5 text-salvia-600 dark:text-salvia-400" />
            <span>CRM & Captação</span>
          </h2>
          <p className="text-xs text-salvia-600 dark:text-salvia-400 mt-0.5">
            Funil de matrículas e acompanhamento dos interessados.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-salvia-700 dark:bg-salvia-600 hover:bg-salvia-800 dark:hover:bg-salvia-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Novo lead</span>
        </button>
      </div>

      {relatorio && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl">
            <p className="text-salvia-600 dark:text-salvia-400 text-xs font-medium">Leads ativos</p>
            <p className="text-xl font-bold text-slate-900 dark:text-salvia-50 mt-1 font-mono">{relatorio.total_leads}</p>
          </div>
          <div className="bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl">
            <p className="text-salvia-600 dark:text-salvia-400 text-xs font-medium">Conversão geral</p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1 font-mono">
              {Number(relatorio.taxa_conversao_pct || 0).toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {erro && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/60 p-3 text-xs font-semibold text-rose-900 dark:text-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{erro}</p>
        </div>
      )}
      {aviso && (
        <div className="mb-4 p-3 bg-salvia-100 dark:bg-salvia-800 border border-salvia-300 dark:border-salvia-700 text-salvia-900 dark:text-salvia-100 text-xs rounded-xl font-semibold">
          {aviso}
        </div>
      )}

      {/* Kanban Board */}
      {loading ? (
        <div className="h-64 flex items-center justify-center bg-salvia-50/60 dark:bg-salvia-950/50 rounded-xl border border-salvia-200 dark:border-salvia-800">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-salvia-600" />
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 items-start">
          {colunas.map((col) => (
            <div
              key={col.id}
              className="min-w-[280px] max-w-[280px] bg-salvia-50/60 dark:bg-salvia-950/50 rounded-xl p-3 flex flex-col max-h-[640px] border border-salvia-200 dark:border-salvia-800"
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-xs font-bold text-salvia-800 dark:text-salvia-100">{col.title}</h3>
                <span className="bg-salvia-200 dark:bg-salvia-800 text-salvia-800 dark:text-salvia-100 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {leads.filter((l) => l.estagio_funil === col.id).length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {leads.filter((l) => l.estagio_funil === col.id).length === 0 && (
                  <p className="text-[11px] text-salvia-600 dark:text-salvia-400 px-1">Nenhum lead neste estágio.</p>
                )}
                {leads.filter((l) => l.estagio_funil === col.id).map((lead) => (
                  <article
                    key={lead.id}
                    className="bg-white dark:bg-salvia-900 p-3 rounded-xl border border-salvia-200 dark:border-salvia-700"
                  >
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-salvia-100 text-salvia-900 border-salvia-300 dark:bg-salvia-800 dark:text-salvia-100 dark:border-salvia-700">
                        {lead.canal_aquisicao || 'sem canal'}
                      </span>
                      <span className="text-[10px] text-salvia-500 font-mono">
                        {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-salvia-50 text-sm">{lead.nome}</h4>
                    <p className="text-salvia-600 dark:text-salvia-400 text-xs mb-3">{lead.observacoes || 'Sem observações'}</p>
                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-center gap-2 text-xs text-salvia-800 dark:text-salvia-200">
                        <Phone className="w-3.5 h-3.5 text-salvia-500" />
                        {lead.telefone}
                      </div>
                      {lead.email && (
                        <div className="flex items-center gap-2 text-xs text-salvia-800 dark:text-salvia-200 truncate">
                          <Mail className="w-3.5 h-3.5 text-salvia-500" />
                          {lead.email}
                        </div>
                      )}
                    </div>
                    <div className="pt-3 border-t border-salvia-100 dark:border-salvia-800">
                      <label className="sr-only" htmlFor={`estagio-${lead.id}`}>Estágio de {lead.nome}</label>
                      <select
                        id={`estagio-${lead.id}`}
                        value={lead.estagio_funil}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                        className={campo}
                      >
                        {colunas.map((c) => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                    {lead.estagio_funil === 'matriculado' && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => handleAbrirMatricula(lead)}
                          className="w-full bg-salvia-700 hover:bg-salvia-800 dark:bg-salvia-600 dark:hover:bg-salvia-500 text-white text-xs font-bold py-1.5 px-3 rounded-xl flex items-center justify-center space-x-1.5 transition-all shadow-sm"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Abrir matrícula</span>
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Lead Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-salvia-100 dark:border-salvia-800 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">Novo lead</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-salvia-500 hover:text-slate-900 dark:hover:text-salvia-50"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-salvia-700 dark:text-salvia-300 mb-1">Nome do responsável</label>
                <input type="text" required value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} className={campo} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-salvia-700 dark:text-salvia-300 mb-1">Telefone</label>
                  <input type="text" required value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} className={campo} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-salvia-700 dark:text-salvia-300 mb-1">E-mail</label>
                  <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={campo} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-salvia-700 dark:text-salvia-300 mb-1">Nome do aluno</label>
                  <input type="text" value={formData.nome_aluno} onChange={(e) => setFormData({ ...formData, nome_aluno: e.target.value })} className={campo} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-salvia-700 dark:text-salvia-300 mb-1">Série de interesse</label>
                  <input type="text" value={formData.serie_interesse} onChange={(e) => setFormData({ ...formData, serie_interesse: e.target.value })} className={campo} />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-salvia-100 dark:bg-salvia-800 text-salvia-800 dark:text-salvia-100 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-salvia-700 dark:bg-salvia-600 hover:bg-salvia-800 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  Salvar lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
