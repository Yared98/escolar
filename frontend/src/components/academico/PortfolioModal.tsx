'use client';

import React, { useState } from 'react';
import { Camera } from 'lucide-react';

export interface PortfolioFormData {
  titulo: string;
  descricao: string;
  campos_bncc: string;
  midia_url: string;
}

interface PortfolioModalProps {
  open: boolean;
  alunoNome?: string;
  onClose: () => void;
  onSave: (data: PortfolioFormData) => Promise<void> | void;
}

const EMPTY: PortfolioFormData = {
  titulo: '',
  descricao: '',
  campos_bncc: 'Eu, o outro e o nós',
  midia_url: '',
};

export function PortfolioModal({ open, alunoNome, onClose, onSave }: PortfolioModalProps) {
  const [form, setForm] = useState<PortfolioFormData>(EMPTY);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.descricao.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
      setForm(EMPTY);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl"
      >
        <div className="flex items-center space-x-2 pb-3 border-b border-salvia-100 dark:border-salvia-800">
          <Camera className="w-5 h-5 text-salvia-700 dark:text-salvia-300" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">Portfólio Infantil (BNCC)</h3>
            {alunoNome && (
              <p className="text-[11px] text-salvia-600 dark:text-salvia-400">Aluno: {alunoNome}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-800 dark:text-salvia-200 mb-1">Título *</label>
          <input
            required
            type="text"
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-salvia-50"
            placeholder="Ex: Pintura na horta"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-800 dark:text-salvia-200 mb-1">Descrição *</label>
          <textarea
            required
            rows={3}
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl p-3 text-xs text-slate-900 dark:text-salvia-50"
            placeholder="Descreva a experiência e a observação pedagógica..."
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-800 dark:text-salvia-200 mb-1">Campo de experiência BNCC</label>
          <select
            value={form.campos_bncc}
            onChange={(e) => setForm({ ...form, campos_bncc: e.target.value })}
            className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-salvia-50"
          >
            <option>Eu, o outro e o nós</option>
            <option>Corpo, gestos e movimentos</option>
            <option>Traços, sons, cores e formas</option>
            <option>Escuta, fala, pensamento e imaginação</option>
            <option>Espaços, tempos, quantidades, relações e transformações</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-800 dark:text-salvia-200 mb-1">URL da mídia (opcional)</label>
          <input
            type="url"
            value={form.midia_url}
            onChange={(e) => setForm({ ...form, midia_url: e.target.value })}
            className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-salvia-50"
            placeholder="https://..."
          />
        </div>

        <div className="flex justify-end space-x-2 pt-2">
          <button
            type="button"
            onClick={() => {
              setForm(EMPTY);
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold text-salvia-700 dark:text-salvia-300 hover:bg-salvia-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-salvia-700 hover:bg-salvia-800 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar Portfólio'}
          </button>
        </div>
      </form>
    </div>
  );
}
