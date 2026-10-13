'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';

export function TrocarSenha() {
  const { user, setUser } = useAuth();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (novaSenha.length < 8) {
      setErro('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem.');
      return;
    }
    if (novaSenha === senhaAtual) {
      setErro('A nova senha deve ser diferente da senha atual.');
      return;
    }

    setLoading(true);
    try {
      await apiFetch<{ status: string; mensagem: string }>('/auth/alterar-senha', {
        method: 'POST',
        body: JSON.stringify({ senha_atual: senhaAtual, nova_senha: novaSenha }),
      });

      if (user) {
        const atualizado = { ...user, deve_trocar_senha: false };
        setUser(atualizado);
        localStorage.setItem('escolar_user', JSON.stringify(atualizado));
      }
      setSucesso(true);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Não foi possível alterar a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-6 sm:p-8 shadow-md">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-salvia-100 dark:bg-salvia-800 text-salvia-700 dark:text-salvia-300 mb-3">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-salvia-50">Crie sua nova senha</h1>
        <p className="text-xs text-salvia-600 dark:text-salvia-400 mt-1">
          Sua conta foi criada com uma senha temporária. Escolha uma senha pessoal para continuar.
        </p>
      </div>

      {sucesso ? (
        <div className="space-y-4 text-center">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            Senha alterada com sucesso!
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 dark:hover:bg-salvia-600 text-white py-3 rounded-xl font-bold text-xs transition-all shadow-sm"
          >
            Entrar no sistema
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {erro && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs rounded-xl font-medium">
              {erro}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-salvia-800 dark:text-salvia-200 mb-1">
              Senha atual (temporária)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-salvia-400 absolute left-3 top-3" />
              <input
                type={mostrarSenha ? 'text' : 'password'}
                required
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl pl-9 pr-10 py-2.5 text-sm text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 font-medium placeholder-salvia-400"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                className="absolute right-3 top-3 text-salvia-400 hover:text-salvia-600 dark:hover:text-salvia-300"
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-salvia-800 dark:text-salvia-200 mb-1">
              Nova senha
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 font-medium placeholder-salvia-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-salvia-800 dark:text-salvia-200 mb-1">
              Confirmar nova senha
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 font-medium placeholder-salvia-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 dark:hover:bg-salvia-600 text-white py-3 rounded-xl font-bold text-sm transition-all shadow-sm disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      )}
    </div>
  );
}
