'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Building2, ShieldCheck, CheckCircle2, Plus } from 'lucide-react';
import {
  UsuariosPanel,
  UsuarioItem,
  AlunoOption,
  CriarUsuarioDto,
  AtualizarUsuarioDto,
} from '@/components/administrativo/UsuariosPanel';

interface Funcionario {
  id: string;
  nome: string;
  cpf: string;
  cargo: string;
  departamento: string;
  data_admissao: string;
  salario: number;
  status: string;
}

interface MensagemEnvio {
  id: string;
  canal: string;
  titulo: string;
  conteudo: string;
  lida: boolean;
  created_at: string;
}

interface AuditLogItem {
  id: string;
  acao: string;
  entidade: string;
  entidade_id?: string | null;
  created_at: string;
}

export function AdministrativoSection() {
  const searchParams = useSearchParams();
  const routeParam = searchParams ? searchParams.get('route') : null;
  const tabParam = searchParams ? searchParams.get('tab') : null;
  const subTab: 'entidades' | 'relatorios' | 'envios' | 'usuarios' =
    routeParam === 'pessoas' || tabParam === 'entidades'
      ? 'entidades'
      : tabParam === 'relatorios'
        ? 'relatorios'
        : tabParam === 'usuarios'
          ? 'usuarios'
          : 'envios';

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [mensagens, setMensagens] = useState<MensagemEnvio[]>([]);
  const [logsAuditoria, setLogsAuditoria] = useState<AuditLogItem[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([]);
  const [alunos, setAlunos] = useState<AlunoOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleInativarFuncionario = async (id: string) => {
    if (!confirm('Deseja inativar este funcionário? Sem cardápios vinculados, o cadastro é removido.')) return;
    try {
      const resp = await apiFetch<{ status: string; mensagem: string }>(`/administrativo/funcionarios/${id}`, { method: 'DELETE' });
      if (resp.status === 'inativado') {
        setFuncionarios((prev) => prev.map((f) => (f.id === id ? { ...f, status: 'inativo' } : f)));
        setToastMsg(resp.mensagem);
      } else {
        setFuncionarios((prev) => prev.filter((f) => f.id !== id));
      }
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Não foi possível inativar o funcionário.');
    }
  };

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [funcData, msgData, auditData] = await Promise.all([
        apiFetch<Funcionario[]>('/administrativo/funcionarios'),
        apiFetch<MensagemEnvio[]>('/agenda/mensagens').catch(() => []),
        apiFetch<{ logs_recentes?: AuditLogItem[] }>('/administrativo/auditoria').catch(() => ({ logs_recentes: [] })),
      ]);
      setFuncionarios(Array.isArray(funcData) ? funcData : []);
      setMensagens(Array.isArray(msgData) ? msgData : []);
      setLogsAuditoria(Array.isArray(auditData?.logs_recentes) ? auditData.logs_recentes : []);
      setLoadError(null);
    } catch (err: unknown) {
      setFuncionarios([]);
      setMensagens([]);
      setLogsAuditoria([]);
      setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar o administrativo.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsuariosData = useCallback(async () => {
    setLoading(true);
    try {
      const [usuariosData, alunosData] = await Promise.all([
        apiFetch<UsuarioItem[]>('/administrativo/usuarios'),
        // A rota é paginada ({ items, total }) e aceita até 200 por página.
        apiFetch<{ items: { id: string; nome: string }[] }>('/secretaria/alunos?status=ativo&limit=200').catch(
          () => ({ items: [] })
        ),
      ]);
      setUsuarios(Array.isArray(usuariosData) ? usuariosData : []);
      setAlunos((alunosData?.items ?? []).map((a) => ({ id: a.id, nome: a.nome })));
      setLoadError(null);
    } catch (err: unknown) {
      setUsuarios([]);
      setAlunos([]);
      setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar os usuários.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCriarUsuario = async (dto: CriarUsuarioDto) => {
    return await apiFetch<{ id: string; senha_temporaria: string }>('/administrativo/usuarios', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  };

  const handleAtualizarUsuario = async (id: string, dto: AtualizarUsuarioDto) => {
    await apiFetch<{ id: string }>(`/administrativo/usuarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    });
  };

  const handleRedefinirSenha = async (id: string) => {
    return await apiFetch<{ senha_temporaria: string }>(`/administrativo/usuarios/${id}/redefinir-senha`, {
      method: 'POST',
    });
  };

  useEffect(() => {
    if (subTab === 'usuarios') {
      loadUsuariosData();
    } else {
      loadAdminData();
    }
  }, [subTab, loadAdminData, loadUsuariosData]);

  return (
    <section id="administrativo" className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-salvia-100 dark:border-salvia-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-salvia-50 flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-salvia-600 dark:text-salvia-400" />
            <span>
              {subTab === 'entidades'
                ? 'Pessoas'
                : subTab === 'usuarios'
                  ? 'Usuários e acessos'
                  : 'Conformidade'}
            </span>
          </h2>
          <p className="text-xs text-salvia-600 dark:text-salvia-400 mt-0.5">
            {subTab === 'entidades'
              ? 'Corpo docente e funcionários da escola.'
              : subTab === 'usuarios'
                ? 'Gestão de contas de acesso ao sistema.'
                : 'Registro de envios e auditoria LGPD.'}
          </p>
        </div>
      </div>
      {loadError && (
        <p className="mb-4 text-xs font-medium text-amber-700 dark:text-amber-300">{loadError}</p>
      )}

      {/* TAB 0: REGISTRO DE ENVIOS AUDITÁVEIS (EXCLUSIVO ADMIN / EMISSOR) */}
      {subTab === 'envios' && (
        <div className="space-y-4">
          <div className="p-4 bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-xl space-y-1">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">Central Gerencial de Registro de Envios Auditáveis</h3>
            </div>
            <p className="text-xs text-salvia-600 dark:text-salvia-400">
              Acesso exclusivo a administradores e emissores. Registro imutável de notificações com aluno, responsável, emissor, canal e status.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-salvia-200 dark:border-salvia-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-salvia-100 dark:bg-salvia-800 text-slate-900 dark:text-salvia-100 uppercase font-bold text-[11px] tracking-wider border-b border-salvia-200 dark:border-salvia-800">
                <tr>
                  <th className="p-3">Data / Hora</th>
                  <th className="p-3">Título</th>
                  <th className="p-3">Conteúdo</th>
                  <th className="p-3">Origem</th>
                  <th className="p-3">Canal</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-salvia-100 dark:divide-salvia-800/60 text-slate-800 dark:text-salvia-200 font-medium">
                {mensagens.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-salvia-600 dark:text-salvia-400">Nenhum envio registrado.</td>
                  </tr>
                ) : mensagens.map((reg) => (
                  <tr key={reg.id} className="hover:bg-salvia-50/70 dark:hover:bg-salvia-800/40 transition-colors">
                    <td className="p-3 font-mono text-salvia-600 dark:text-salvia-400">{new Date(reg.created_at).toLocaleString('pt-BR')}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-salvia-50">{reg.titulo}</td>
                    <td className="p-3 text-salvia-700 dark:text-salvia-300">{reg.conteudo}</td>
                    <td className="p-3 font-semibold text-salvia-700 dark:text-salvia-300">Agenda</td>
                    <td className="p-3">
                      <span className="text-[10px] font-mono text-salvia-500 uppercase font-bold">{reg.canal}</span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          reg.lida
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 text-emerald-900 dark:text-emerald-300'
                            : 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 text-amber-900 dark:text-amber-300'
                        }`}
                      >
                        {reg.lida ? 'Lida' : 'Enviada'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: USUÁRIOS E ACESSOS */}
      {subTab === 'usuarios' && (
        <UsuariosPanel
          usuarios={usuarios}
          alunos={alunos}
          loading={loading}
          error={loadError}
          onRecarregar={loadUsuariosData}
          onCriar={handleCriarUsuario}
          onAtualizar={handleAtualizarUsuario}
          onRedefinirSenha={handleRedefinirSenha}
        />
      )}

      {/* TAB 1: CORPO DOCENTE & RH */}
      {subTab === 'entidades' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-salvia-800 dark:text-salvia-200 uppercase tracking-wider">Gestão Unificada de Funcionários e Professores</h3>
            <button className="bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1">
              <Plus className="w-3.5 h-3.5" />
              <span>Admitir Funcionário / Docente</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-salvia-200 dark:border-salvia-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-salvia-100 dark:bg-salvia-800 text-slate-900 dark:text-salvia-100 uppercase font-bold text-[11px] tracking-wider border-b border-salvia-200 dark:border-salvia-800">
                <tr>
                  <th className="p-3">Nome do Colaborador</th>
                  <th className="p-3">CPF</th>
                  <th className="p-3">Cargo / Função</th>
                  <th className="p-3">Departamento</th>
                  <th className="p-3">Admissão</th>
                  <th className="p-3">Status RH</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-salvia-100 dark:divide-salvia-800/60 text-slate-800 dark:text-salvia-200 font-medium">
                {funcionarios.map((f) => (
                  <tr key={f.id} className="hover:bg-salvia-50/70 dark:hover:bg-salvia-800/40 transition-colors">
                    <td className="p-3 font-bold text-slate-900 dark:text-salvia-50">{f.nome}</td>
                    <td className="p-3 font-mono text-salvia-600 dark:text-salvia-400">{f.cpf}</td>
                    <td className="p-3 font-semibold text-salvia-900 dark:text-salvia-100">{f.cargo}</td>
                    <td className="p-3 text-salvia-600 dark:text-salvia-400">{f.departamento}</td>
                    <td className="p-3 font-mono text-salvia-600 dark:text-salvia-400">{f.data_admissao}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          f.status === 'inativo'
                            ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 text-slate-600'
                            : 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-300'
                        }`}>
                          {f.status}
                        </span>
                        {f.status !== 'inativo' && (
                          <button
                            type="button"
                            onClick={() => handleInativarFuncionario(f.id)}
                            className="text-[10px] font-bold text-rose-600 hover:underline"
                          >
                            Inativar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: RELATÓRIOS & AUDITORIA OPENSEC */}
      {subTab === 'relatorios' && (
        <div className="space-y-4">
          <div className="p-5 bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">Auditoria LGPD & Segurança</h3>
              </div>
              <span className="px-3 py-1 bg-salvia-100 dark:bg-salvia-950/80 border border-salvia-300 dark:border-salvia-700 text-salvia-900 dark:text-salvia-300 rounded-full text-xs font-bold font-mono">
                Auditoria de eventos (versão de demonstração)
              </span>
            </div>
            <p className="text-xs text-salvia-600 dark:text-salvia-400">
              Isolamento de tenants no banco, permissões validadas no servidor e trilha de auditoria conforme OpenSpec.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-xl text-xs space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-bold text-salvia-500 block">Isolamento por escola</span>
                <span className="font-bold text-slate-900 dark:text-salvia-50 flex items-center space-x-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Isolamento por escola (RLS) no banco</span>
                </span>
              </div>
              <div className="p-3 bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-xl text-xs space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-bold text-salvia-500 block">Permissões por perfil</span>
                <span className="font-bold text-slate-900 dark:text-salvia-50 flex items-center space-x-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Permissões por perfil validadas no servidor</span>
                </span>
              </div>
              <div className="p-3 bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-xl text-xs space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-bold text-salvia-500 block">Headers OWASP & SQL Shield</span>
                <span className="font-bold text-slate-900 dark:text-salvia-50 flex items-center space-x-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Auditoria de eventos (versão de demonstração)</span>
                </span>
              </div>
            </div>

            {logsAuditoria.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-salvia-200 dark:border-salvia-800">
                <h4 className="text-xs font-bold text-slate-900 dark:text-salvia-100 uppercase tracking-wider">Eventos recentes</h4>
                <div className="overflow-x-auto rounded-xl border border-salvia-200 dark:border-salvia-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-salvia-100 dark:bg-salvia-800 text-slate-900 dark:text-salvia-100 uppercase font-bold text-[10px] tracking-wider">
                      <tr>
                        <th className="p-2.5">Quando</th>
                        <th className="p-2.5">Ação</th>
                        <th className="p-2.5">Entidade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-salvia-100 dark:divide-salvia-800/60 font-medium">
                      {logsAuditoria.map((log) => (
                        <tr key={log.id}>
                          <td className="p-2.5 font-mono">{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                          <td className="p-2.5 font-bold">{log.acao}</td>
                          <td className="p-2.5">{log.entidade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-salvia-200 dark:border-salvia-800">
              <h4 className="text-xs font-bold text-slate-900 dark:text-salvia-100 uppercase tracking-wider">Tabela de Regras de Segurança</h4>
              <div className="overflow-x-auto rounded-xl border border-salvia-200 dark:border-salvia-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-salvia-100 dark:bg-salvia-800 text-slate-900 dark:text-salvia-100 uppercase font-bold text-[10px] tracking-wider">
                    <tr>
                      <th className="p-2.5">Código</th>
                      <th className="p-2.5">Categoria</th>
                      <th className="p-2.5">Título da Regra</th>
                      <th className="p-2.5">Severidade</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-salvia-100 dark:divide-salvia-800/60 font-medium">
                    <tr className="hover:bg-salvia-50 dark:hover:bg-salvia-800/40">
                      <td className="p-2.5 font-mono font-bold text-salvia-700 dark:text-salvia-300">SEC-001</td>
                      <td className="p-2.5 text-salvia-500">multi_tenant_isolation</td>
                      <td className="p-2.5 font-bold text-slate-900 dark:text-salvia-50">Isolamento rígido por escola</td>
                      <td className="p-2.5 font-mono font-bold text-rose-600">CRITICAL</td>
                      <td className="p-2.5"><span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold rounded-full border border-emerald-300">ENFORCED</span></td>
                    </tr>
                    <tr className="hover:bg-salvia-50 dark:hover:bg-salvia-800/40">
                      <td className="p-2.5 font-mono font-bold text-salvia-700 dark:text-salvia-300">SEC-002</td>
                      <td className="p-2.5 text-salvia-500">auth_rbac</td>
                      <td className="p-2.5 font-bold text-slate-900 dark:text-salvia-50">Validação de permissões por perfil</td>
                      <td className="p-2.5 font-mono font-bold text-rose-600">CRITICAL</td>
                      <td className="p-2.5"><span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold rounded-full border border-emerald-300">ENFORCED</span></td>
                    </tr>
                    <tr className="hover:bg-salvia-50 dark:hover:bg-salvia-800/40">
                      <td className="p-2.5 font-mono font-bold text-salvia-700 dark:text-salvia-300">SEC-003</td>
                      <td className="p-2.5 text-salvia-500">xss_csp_hardening</td>
                      <td className="p-2.5 font-bold text-slate-900 dark:text-salvia-50">OpenSec Security Headers (OWASP)</td>
                      <td className="p-2.5 font-mono font-bold text-amber-600">HIGH</td>
                      <td className="p-2.5"><span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold rounded-full border border-emerald-300">ENFORCED</span></td>
                    </tr>
                    <tr className="hover:bg-salvia-50 dark:hover:bg-salvia-800/40">
                      <td className="p-2.5 font-mono font-bold text-salvia-700 dark:text-salvia-300">SEC-004</td>
                      <td className="p-2.5 text-salvia-500">lgpd_data_privacy</td>
                      <td className="p-2.5 font-bold text-slate-900 dark:text-salvia-50">Auditoria Imutável de Prontuários & Saúde</td>
                      <td className="p-2.5 font-mono font-bold text-rose-600">CRITICAL</td>
                      <td className="p-2.5"><span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold rounded-full border border-emerald-300">ENFORCED</span></td>
                    </tr>
                    <tr className="hover:bg-salvia-50 dark:hover:bg-salvia-800/40">
                      <td className="p-2.5 font-mono font-bold text-salvia-700 dark:text-salvia-300">SEC-005</td>
                      <td className="p-2.5 text-salvia-500">sql_injection_defense</td>
                      <td className="p-2.5 font-bold text-slate-900 dark:text-salvia-50">SQLx Parameterized Query Shield</td>
                      <td className="p-2.5 font-mono font-bold text-rose-600">CRITICAL</td>
                      <td className="p-2.5"><span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold rounded-full border border-emerald-300">ENFORCED</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
