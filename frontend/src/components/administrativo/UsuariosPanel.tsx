'use client';

import React, { useState, useMemo } from 'react';
import { Search, Plus, Edit2, RefreshCw, Power, PowerOff, Copy, X, Check, Users, UserCheck } from 'lucide-react';
import { perfilAmigavel } from '@/lib/perfis';

export interface AlunoOption {
  id: string;
  nome: string;
}

export interface AlunoVinculado {
  aluno_id: string;
  aluno_nome: string;
}

export interface UsuarioItem {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  ativo: boolean;
  deve_trocar_senha: boolean;
  criado_em: string;
  alunos_vinculados: AlunoVinculado[];
}

export interface CriarUsuarioDto {
  nome: string;
  email: string;
  perfil: string;
  aluno_ids?: string[];
  parentesco?: string;
}

export interface AtualizarUsuarioDto {
  nome?: string;
  perfil?: string;
  ativo?: boolean;
  aluno_ids?: string[];
}

interface UsuariosPanelProps {
  usuarios: UsuarioItem[];
  alunos: AlunoOption[];
  loading: boolean;
  error: string | null;
  onRecarregar: () => void;
  onCriar: (dto: CriarUsuarioDto) => Promise<{ id: string; senha_temporaria: string }>;
  onAtualizar: (id: string, dto: AtualizarUsuarioDto) => Promise<void>;
  onRedefinirSenha: (id: string) => Promise<{ senha_temporaria: string }>;
}

const PERFIS: { value: string; label: string }[] = [
  { value: 'gestor', label: 'Gestão' },
  { value: 'secretaria', label: 'Secretaria' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'professor', label: 'Professor(a)' },
  { value: 'nutricionista', label: 'Nutrição' },
  { value: 'responsavel', label: 'Família' },
];

export function UsuariosPanel({
  usuarios,
  alunos,
  loading,
  error,
  onRecarregar,
  onCriar,
  onAtualizar,
  onRedefinirSenha,
}: UsuariosPanelProps) {
  const [busca, setBusca] = useState('');
  const [perfilFiltro, setPerfilFiltro] = useState('');
  const [modalCriar, setModalCriar] = useState(false);
  const [modalEditar, setModalEditar] = useState<UsuarioItem | null>(null);
  const [modalSenha, setModalSenha] = useState<{ nome: string; senha: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return usuarios.filter((u) => {
      const combinaBusca =
        !b || u.nome.toLowerCase().includes(b) || u.email.toLowerCase().includes(b);
      const combinaPerfil = !perfilFiltro || u.perfil === perfilFiltro;
      return combinaBusca && combinaPerfil;
    });
  }, [usuarios, busca, perfilFiltro]);

  const handleSubmitCriar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const perfil = formData.get('perfil') as string;
    const dto: CriarUsuarioDto = {
      nome: (formData.get('nome') as string).trim(),
      email: (formData.get('email') as string).trim(),
      perfil,
    };

    if (perfil === 'responsavel') {
      const selecionados = Array.from(formData.getAll('aluno_ids') as string[]).filter(Boolean);
      if (selecionados.length === 0) {
        alert('Selecione pelo menos um aluno para o perfil família.');
        return;
      }
      dto.aluno_ids = selecionados;
      dto.parentesco = (formData.get('parentesco') as string) || undefined;
    }

    setSubmitting(true);
    try {
      const res = await onCriar(dto);
      setModalCriar(false);
      form.reset();
      setModalSenha({ nome: dto.nome, senha: res.senha_temporaria });
      onRecarregar();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao criar usuário');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitEditar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!modalEditar || submitting) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const perfil = (formData.get('perfil') as string) || undefined;
    const dto: AtualizarUsuarioDto = {
      nome: (formData.get('nome') as string).trim() || undefined,
      perfil,
    };

    if (perfil === 'responsavel') {
      const selecionados = Array.from(formData.getAll('aluno_ids') as string[]).filter(Boolean);
      dto.aluno_ids = selecionados;
    }

    setSubmitting(true);
    try {
      await onAtualizar(modalEditar.id, dto);
      setModalEditar(null);
      onRecarregar();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao atualizar usuário');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAtivo = async (u: UsuarioItem) => {
    const mensagem = u.ativo
      ? `Deseja desativar ${u.nome}? A pessoa não poderá mais entrar.`
      : `Deseja reativar ${u.nome}?`;
    if (!confirm(mensagem)) return;
    try {
      await onAtualizar(u.id, { ativo: !u.ativo });
      onRecarregar();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao alterar status');
    }
  };

  const handleRedefinir = async (u: UsuarioItem) => {
    if (!confirm(`Redefinir a senha de ${u.nome}? A senha atual vai parar de funcionar.`)) return;
    try {
      const res = await onRedefinirSenha(u.id);
      setModalSenha({ nome: u.nome, senha: res.senha_temporaria });
      onRecarregar();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao redefinir senha');
    }
  };

  const copiarSenha = async () => {
    if (!modalSenha) return;
    try {
      await navigator.clipboard.writeText(modalSenha.senha);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // fallback silencioso
    }
  };

  const renderLinha = (u: UsuarioItem) => (
    <div
      key={u.id}
      className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-xl p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-slate-900 dark:text-salvia-50 truncate">{u.nome}</p>
          <p className="text-xs text-salvia-600 dark:text-salvia-400 truncate">{u.email}</p>
        </div>
        <span
          className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
            u.ativo
              ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 text-emerald-900 dark:text-emerald-300'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-300 text-slate-600 dark:text-slate-400'
          }`}
        >
          {u.ativo ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="px-2 py-1 rounded-lg bg-salvia-100 dark:bg-salvia-800 text-salvia-800 dark:text-salvia-200 font-medium">
          {perfilAmigavel(u.perfil)}
        </span>
        {u.deve_trocar_senha && (
          <span className="px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-medium">
            Senha temporária
          </span>
        )}
      </div>

      {u.perfil === 'responsavel' && u.alunos_vinculados.length > 0 && (
        <div className="text-xs text-salvia-600 dark:text-salvia-400">
          <span className="font-semibold">Vínculos:</span>{' '}
          {u.alunos_vinculados.map((a) => a.aluno_nome).join(', ')}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={() => setModalEditar(u)}
          className="flex-1 sm:flex-none min-h-[44px] inline-flex items-center justify-center space-x-1 px-3 py-2 rounded-xl bg-salvia-100 dark:bg-salvia-800 text-salvia-800 dark:text-salvia-200 text-xs font-bold hover:bg-salvia-200 dark:hover:bg-salvia-700 transition-colors"
        >
          <Edit2 className="w-3.5 h-3.5" />
          <span>Editar</span>
        </button>
        <button
          onClick={() => handleToggleAtivo(u)}
          className={`flex-1 sm:flex-none min-h-[44px] inline-flex items-center justify-center space-x-1 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
            u.ativo
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-salvia-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60'
          }`}
        >
          {u.ativo ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
          <span>{u.ativo ? 'Desativar' : 'Ativar'}</span>
        </button>
        <button
          onClick={() => handleRedefinir(u)}
          className="flex-1 sm:flex-none min-h-[44px] inline-flex items-center justify-center space-x-1 px-3 py-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-bold hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Redefinir senha</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-salvia-400 absolute left-3 top-3" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
            aria-label="Buscar usuário por nome ou e-mail"
            className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 font-medium placeholder-salvia-400"
          />
        </div>
        <select
          aria-label="Filtrar por perfil"
          value={perfilFiltro}
          onChange={(e) => setPerfilFiltro(e.target.value)}
          className="bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 font-medium"
        >
          <option value="">Todos os perfis</option>
          {PERFIS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => setModalCriar(true)}
          className="min-h-[44px] inline-flex items-center justify-center space-x-1.5 bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 dark:hover:bg-salvia-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Novo usuário</span>
        </button>
      </div>

      {error && (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{error}</p>
      )}

      {loading ? (
        <p className="text-xs text-salvia-600 dark:text-salvia-400">Carregando usuários...</p>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-10 bg-salvia-50/50 dark:bg-salvia-950/50 border border-dashed border-salvia-200 dark:border-salvia-800 rounded-2xl">
          <Users className="w-8 h-8 text-salvia-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-salvia-700 dark:text-salvia-300">
            Nenhum usuário encontrado.
          </p>
        </div>
      ) : (
        <div className="space-y-3 sm:hidden">{filtrados.map(renderLinha)}</div>
      )}

      {!loading && filtrados.length > 0 && (
        <div className="hidden sm:block overflow-x-auto rounded-xl border border-salvia-200 dark:border-salvia-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-salvia-100 dark:bg-salvia-800 text-slate-900 dark:text-salvia-100 uppercase font-bold text-[11px] tracking-wider border-b border-salvia-200 dark:border-salvia-800">
              <tr>
                <th className="p-3">Nome</th>
                <th className="p-3">E-mail</th>
                <th className="p-3">Perfil</th>
                <th className="p-3">Status</th>
                <th className="p-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-salvia-100 dark:divide-salvia-800/60 text-slate-800 dark:text-salvia-200 font-medium">
              {filtrados.map((u) => (
                <tr key={u.id} className="hover:bg-salvia-50/70 dark:hover:bg-salvia-800/40 transition-colors">
                  <td className="p-3">
                    <p className="font-bold text-slate-900 dark:text-salvia-50">{u.nome}</p>
                    {u.perfil === 'responsavel' && u.alunos_vinculados.length > 0 && (
                      <p className="text-[10px] text-salvia-500 mt-0.5">
                        {u.alunos_vinculados.map((a) => a.aluno_nome).join(', ')}
                      </p>
                    )}
                  </td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{perfilAmigavel(u.perfil)}</td>
                  <td className="p-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        u.ativo
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 text-emerald-900 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-300 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                    {u.deve_trocar_senha && (
                      <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-100 dark:bg-amber-950/60 border-amber-300 text-amber-900 dark:text-amber-300">
                        Temporária
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setModalEditar(u)}
                        className="p-2 rounded-lg bg-salvia-100 dark:bg-salvia-800 text-salvia-700 dark:text-salvia-300 hover:bg-salvia-200 dark:hover:bg-salvia-700"
                        title="Editar"
                        aria-label={`Editar ${u.nome}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleAtivo(u)}
                        className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-salvia-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                        title={u.ativo ? 'Desativar' : 'Ativar'}
                        aria-label={`${u.ativo ? 'Desativar' : 'Ativar'} ${u.nome}`}
                      >
                        {u.ativo ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleRedefinir(u)}
                        className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60"
                        title="Redefinir senha"
                        aria-label={`Redefinir senha de ${u.nome}`}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalCriar && (
        <UsuarioFormModal
          titulo="Novo usuário"
          alunos={alunos}
          onFechar={() => setModalCriar(false)}
          onSubmit={handleSubmitCriar}
          submitting={submitting}
        />
      )}

      {modalEditar && (
        <UsuarioFormModal
          titulo="Editar usuário"
          usuario={modalEditar}
          alunos={alunos}
          onFechar={() => setModalEditar(null)}
          onSubmit={handleSubmitEditar}
          submitting={submitting}
        />
      )}

      {modalSenha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-salvia-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">Senha temporária</h3>
              <button
                onClick={() => setModalSenha(null)}
                aria-label="Fechar"
                className="p-1.5 rounded-lg hover:bg-salvia-100 dark:hover:bg-salvia-800 text-salvia-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-salvia-600 dark:text-salvia-400">
              Anote e entregue a senha para <strong>{modalSenha.nome}</strong>; ela vai trocar no primeiro acesso.
            </p>
            <div className="flex items-center gap-2 p-3 bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl">
              <code className="flex-1 text-sm font-mono text-slate-900 dark:text-salvia-50 break-all">
                {modalSenha.senha}
              </code>
              <button
                onClick={copiarSenha}
                className="shrink-0 p-2 rounded-lg bg-salvia-200 dark:bg-salvia-800 text-salvia-800 dark:text-salvia-200 hover:bg-salvia-300 dark:hover:bg-salvia-700"
                title="Copiar"
                aria-label="Copiar senha"
              >
                {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={() => setModalSenha(null)}
              className="w-full min-h-[44px] bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 dark:hover:bg-salvia-600 text-white py-2.5 rounded-xl font-bold text-xs transition-all"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface UsuarioFormModalProps {
  titulo: string;
  usuario?: UsuarioItem;
  alunos: AlunoOption[];
  onFechar: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  submitting: boolean;
}

function UsuarioFormModal({ titulo, usuario, alunos, onFechar, onSubmit, submitting }: UsuarioFormModalProps) {
  const [perfil, setPerfil] = useState(usuario?.perfil || '');
  const vinculados = useMemo(
    () => new Set(usuario?.alunos_vinculados.map((a) => a.aluno_id) || []),
    [usuario]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-salvia-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-xl my-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">{titulo}</h3>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="p-1.5 rounded-lg hover:bg-salvia-100 dark:hover:bg-salvia-800 text-salvia-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-salvia-800 dark:text-salvia-200 mb-1" htmlFor="usuario-nome">Nome</label>
            <input
              id="usuario-nome"
              name="nome"
              type="text"
              required
              defaultValue={usuario?.nome}
              className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-salvia-800 dark:text-salvia-200 mb-1" htmlFor="usuario-email">E-mail</label>
            <input
              id="usuario-email"
              name="email"
              type="email"
              required
              disabled={!!usuario}
              defaultValue={usuario?.email}
              className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 font-medium disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-salvia-800 dark:text-salvia-200 mb-1" htmlFor="usuario-perfil">Perfil</label>
            <select
              id="usuario-perfil"
              name="perfil"
              required
              value={perfil}
              disabled={!!usuario}
              onChange={(e) => setPerfil(e.target.value)}
              className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 font-medium disabled:opacity-60"
            >
              <option value="">Selecione</option>
              {PERFIS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {perfil === 'responsavel' && (
            <>
              <div>
                <p className="block text-xs font-semibold text-salvia-800 dark:text-salvia-200 mb-1">
                  Alunos vinculados
                </p>
                <div className="max-h-40 overflow-y-auto bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl p-2 space-y-1">
                  {alunos.length === 0 ? (
                    <p className="text-xs text-salvia-500 px-2 py-1">Nenhum aluno cadastrado.</p>
                  ) : (
                    alunos.map((a) => (
                      <label
                        key={a.id}
                        className="flex items-center space-x-2 px-2 py-1.5 rounded-lg hover:bg-salvia-100 dark:hover:bg-salvia-800/60 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          name="aluno_ids"
                          value={a.id}
                          defaultChecked={vinculados.has(a.id)}
                          className="w-4 h-4 rounded border-salvia-300 text-salvia-700 focus:ring-salvia-600"
                        />
                        <span className="text-sm text-slate-900 dark:text-salvia-50">{a.nome}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              {!usuario && (
                <div>
                  <label className="block text-xs font-semibold text-salvia-800 dark:text-salvia-200 mb-1" htmlFor="usuario-parentesco">
                    Parentesco
                  </label>
                  <input
                    id="usuario-parentesco"
                    name="parentesco"
                    type="text"
                    placeholder="ex: Mãe, Pai, Responsável"
                    className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 font-medium"
                  />
                </div>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[44px] bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 dark:hover:bg-salvia-600 text-white py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm disabled:opacity-50"
          >
            {submitting ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      </div>
    </div>
  );
}
