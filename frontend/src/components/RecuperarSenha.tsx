'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Lock, Mail, Building2, ArrowLeft, ShieldCheck, Eye, EyeOff } from 'lucide-react';

interface RecuperarSenhaProps {
  modoInicial?: 'esqueci' | 'redefinir';
  tokenInicial?: string | null;
  escolaInicial?: string | null;
  onVoltar: () => void;
  /** Chamado depois de redefinir: a tela volta ao login (e o token sai da URL). */
  onRedefinida?: () => void;
}

export function RecuperarSenha({
  modoInicial = 'esqueci',
  tokenInicial = null,
  escolaInicial = null,
  onVoltar,
  onRedefinida,
}: RecuperarSenhaProps) {
  const [modo, setModo] = useState<'esqueci' | 'redefinir'>(modoInicial);
  const [tenantSlug, setTenantSlug] = useState(escolaInicial || '');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState(tokenInicial || '');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  useEffect(() => {
    if (modoInicial) setModo(modoInicial);
    if (tokenInicial) setToken(tokenInicial);
    if (escolaInicial) setTenantSlug(escolaInicial);
  }, [modoInicial, tokenInicial, escolaInicial]);

  const handleEsqueci = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setLoading(true);

    try {
      await apiFetch<{ mensagem: string }>('/auth/esqueci-senha', {
        method: 'POST',
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          email: email.trim(),
        }),
      });
      setSucesso('Se o e-mail estiver cadastrado, enviaremos as instruções.');
      setEmail('');
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Não foi possível enviar a solicitação.');
    } finally {
      setLoading(false);
    }
  };

  const handleRedefinir = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    if (novaSenha.length < 8) {
      setErro('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      await apiFetch<{ status: string; mensagem: string }>('/auth/redefinir-senha', {
        method: 'POST',
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          token,
          nova_senha: novaSenha,
        }),
      });
      setNovaSenha('');
      setConfirmarSenha('');
      if (onRedefinida) {
        onRedefinida();
      } else {
        setSucesso('Senha redefinida com sucesso. Faça login com a nova senha.');
        setModo('esqueci');
      }
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Não foi possível redefinir a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-6 sm:p-8 shadow-md">
      <button
        type="button"
        onClick={onVoltar}
        className="flex items-center space-x-1 text-xs font-semibold text-salvia-600 dark:text-salvia-400 hover:text-salvia-800 dark:hover:text-salvia-200 mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Voltar ao login</span>
      </button>

      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-salvia-100 dark:bg-salvia-800 text-salvia-700 dark:text-salvia-300 mb-3">
          {modo === 'redefinir' ? <ShieldCheck className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-salvia-50">
          {modo === 'redefinir' ? 'Crie uma nova senha' : 'Esqueci minha senha'}
        </h1>
        <p className="text-xs text-salvia-600 dark:text-salvia-400 mt-1">
          {modo === 'redefinir'
            ? 'Escolha uma senha segura para acessar o sistema.'
            : 'Informe o código da escola e o e-mail cadastrado.'}
        </p>
      </div>

      {erro && (
        <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs rounded-xl font-medium">
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl font-medium">
          {sucesso}
        </div>
      )}

      {modo === 'esqueci' ? (
        <form onSubmit={handleEsqueci} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-salvia-800 dark:text-salvia-200 mb-1">
              Código da escola
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-salvia-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                placeholder="ex: escola-modelo"
                className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 font-medium placeholder-salvia-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-salvia-800 dark:text-salvia-200 mb-1">
              E-mail
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-salvia-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="gestor@escola.com.br"
                className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 font-medium placeholder-salvia-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 dark:hover:bg-salvia-600 text-white py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'Enviar instruções'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleRedefinir} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-salvia-800 dark:text-salvia-200 mb-1">
              Nova senha
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-salvia-400 absolute left-3 top-2.5" />
              <input
                type={mostrarSenha ? 'text' : 'password'}
                required
                minLength={8}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl pl-9 pr-10 py-2 text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 font-medium placeholder-salvia-400"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                className="absolute right-3 top-2.5 text-salvia-400 hover:text-salvia-600 dark:hover:text-salvia-300"
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-salvia-800 dark:text-salvia-200 mb-1">
              Confirmar nova senha
            </label>
            <input
              type={mostrarSenha ? 'text' : 'password'}
              required
              minLength={8}
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 font-medium placeholder-salvia-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 dark:hover:bg-salvia-600 text-white py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      )}
    </div>
  );
}
