'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { Plus, CalendarDays, Clock, Users, Trash2, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface EventoCalendario {
  id: string;
  tenant_id: string;
  turma_id: string | null;
  titulo: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string;
  tipo: string;
  visibilidade: string;
  exige_confirmacao: boolean;
  criado_por: string;
  created_at: string;
}

const campo =
  'w-full bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600';

export function CalendarioEscolarSection() {
  const { user } = useAuth();
  const role = user?.role || 'admin';
  const isStaff = ['admin', 'gestor', 'secretaria'].includes(role);

  const [eventos, setEventos] = useState<EventoCalendario[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    turma_id: null as string | null,
    titulo: '',
    descricao: '',
    data_inicio: '',
    data_fim: '',
    tipo: 'outro',
    visibilidade: 'todos',
    exige_confirmacao: false,
  });

  const loadEventos = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await apiFetch<EventoCalendario[]>('/agenda/calendario');
      setEventos(data || []);
    } catch (err) {
      console.error(err);
      setEventos([]);
      setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar o calendário.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEventos();
  }, [loadEventos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/agenda/calendario', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setShowModal(false);
      setFormData({
        turma_id: null,
        titulo: '',
        descricao: '',
        data_inicio: '',
        data_fim: '',
        tipo: 'outro',
        visibilidade: 'todos',
        exige_confirmacao: false,
      });
      loadEventos();
      setAviso('Evento publicado no calendário.');
    } catch (err) {
      console.error(err);
      setAviso(err instanceof Error ? err.message : 'Não foi possível criar o evento.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este evento?')) return;
    try {
      await apiFetch(`/agenda/calendario/${id}`, { method: 'DELETE' });
      loadEventos();
    } catch (err) {
      console.error(err);
      setAviso(err instanceof Error ? err.message : 'Não foi possível excluir o evento.');
    }
  };

  const tipoCores: Record<string, string> = {
    feriado: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800',
    ferias: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    reuniao_pais: 'bg-salvia-100 text-salvia-900 border-salvia-300 dark:bg-salvia-800 dark:text-salvia-100 dark:border-salvia-700',
    festa: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    prova: 'bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800',
    outro: 'bg-salvia-50 text-salvia-800 border-salvia-200 dark:bg-salvia-950 dark:text-salvia-200 dark:border-salvia-700',
  };

  const tipoRotulo: Record<string, string> = {
    feriado: 'Feriado',
    ferias: 'Férias',
    reuniao_pais: 'Reunião de pais',
    festa: 'Festa',
    prova: 'Avaliação',
    outro: 'Outro',
  };

  const visibilidadeRotulo: Record<string, string> = {
    todos: 'Todos',
    funcionarios: 'Funcionários',
    responsaveis: 'Responsáveis',
  };

  const formatarData = (valor: string) => {
    const dia = valor.slice(0, 10);
    const [ano, mes, data] = dia.split('-');
    if (!ano || !mes || !data) return valor;
    return `${data}/${mes}/${ano}`;
  };

  return (
    <section
      id="calendario"
      className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-4 sm:p-6 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-salvia-100 dark:border-salvia-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-salvia-50 flex items-center space-x-2">
            <CalendarDays className="w-5 h-5 text-salvia-600 dark:text-salvia-400" />
            <span>Calendário Escolar</span>
          </h2>
          <p className="text-xs text-salvia-600 dark:text-salvia-400 mt-0.5">
            Eventos, feriados e reuniões publicados para a escola.
          </p>
        </div>
        {isStaff && (
          <button
            onClick={() => setShowModal(true)}
            className="bg-salvia-700 dark:bg-salvia-600 hover:bg-salvia-800 dark:hover:bg-salvia-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Evento</span>
          </button>
        )}
      </div>

      {loadError && (
        <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-200 text-xs rounded-xl font-semibold">
          {loadError}
        </div>
      )}
      {aviso && (
        <div className="mb-4 p-3 bg-salvia-100 dark:bg-salvia-800 border border-salvia-300 dark:border-salvia-700 text-salvia-900 dark:text-salvia-100 text-xs rounded-xl font-semibold">
          {aviso}
        </div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-24 bg-salvia-100 dark:bg-salvia-800 rounded-xl" />
          <div className="h-24 bg-salvia-100 dark:bg-salvia-800 rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {eventos.length === 0 && (
            <p className="md:col-span-2 text-xs text-salvia-700 dark:text-salvia-300 bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-xl p-6">
              Nenhum evento publicado para este perfil.
            </p>
          )}
          {eventos.map((ev) => (
            <article
              key={ev.id}
              className="bg-salvia-50/60 dark:bg-salvia-950/50 p-4 rounded-xl border border-salvia-200 dark:border-salvia-800 flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${tipoCores[ev.tipo] || tipoCores.outro}`}>
                    {tipoRotulo[ev.tipo] || ev.tipo}
                  </span>
                  {isStaff && (
                    <button
                      onClick={() => handleDelete(ev.id)}
                      className="text-salvia-500 hover:text-rose-600 dark:hover:text-rose-300 transition-colors"
                      aria-label={`Excluir ${ev.titulo}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50 mt-3">{ev.titulo}</h3>
                {ev.descricao && (
                  <p className="text-salvia-700 dark:text-salvia-300 text-xs mt-1 line-clamp-2">{ev.descricao}</p>
                )}
                {ev.exige_confirmacao && (
                  <span className="mt-2 inline-flex px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-bold border border-amber-200 dark:border-amber-800">
                    Confirmação de presença
                  </span>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-salvia-200 dark:border-salvia-800 flex flex-wrap items-center gap-4 text-[11px] font-semibold text-salvia-700 dark:text-salvia-300">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {ev.data_inicio.slice(0, 10) === ev.data_fim.slice(0, 10)
                    ? formatarData(ev.data_inicio)
                    : `${formatarData(ev.data_inicio)} até ${formatarData(ev.data_fim)}`}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {visibilidadeRotulo[ev.visibilidade] || ev.visibilidade}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-salvia-100 dark:border-salvia-800 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">Novo evento</h3>
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
                <label className="block text-[11px] font-bold text-salvia-700 dark:text-salvia-300 mb-1">Título do evento</label>
                <input
                  type="text"
                  required
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  className={campo}
                  placeholder="Ex: Reunião de pais"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-salvia-700 dark:text-salvia-300 mb-1">Data início</label>
                  <input
                    type="date"
                    required
                    value={formData.data_inicio}
                    onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                    className={campo}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-salvia-700 dark:text-salvia-300 mb-1">Data fim</label>
                  <input
                    type="date"
                    required
                    value={formData.data_fim}
                    onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                    className={campo}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-salvia-700 dark:text-salvia-300 mb-1">Tipo</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    className={campo}
                  >
                    <option value="feriado">Feriado</option>
                    <option value="ferias">Férias</option>
                    <option value="reuniao_pais">Reunião de pais</option>
                    <option value="festa">Festa</option>
                    <option value="prova">Avaliação</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-salvia-700 dark:text-salvia-300 mb-1">Visibilidade</label>
                  <select
                    value={formData.visibilidade}
                    onChange={(e) => setFormData({ ...formData, visibilidade: e.target.value })}
                    className={campo}
                  >
                    <option value="todos">Todos</option>
                    <option value="funcionarios">Funcionários</option>
                    <option value="responsaveis">Responsáveis</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-salvia-700 dark:text-salvia-300 mb-1">Descrição</label>
                <textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  className={`${campo} h-20 resize-none`}
                  placeholder="Detalhes do evento"
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-salvia-100">
                <input
                  type="checkbox"
                  checked={formData.exige_confirmacao}
                  onChange={(e) => setFormData({ ...formData, exige_confirmacao: e.target.checked })}
                  className="rounded border-salvia-300 text-salvia-700 focus:ring-salvia-600"
                />
                Exige confirmação de presença
              </label>
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
                  Salvar evento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
