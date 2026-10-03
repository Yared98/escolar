import React from 'react';
import { Lock, Send, Users, X } from 'lucide-react';
import { AlunoResumo, ContatoEscola, TipoEnvio, TurmaOpcao } from './types';

export interface ComposerModalProps {
  composerAberto: boolean;
  setComposerAberto: (v: boolean) => void;
  handleEnviarMensagem: (e: React.FormEvent) => void;
  tipoEnvio: TipoEnvio;
  setTipoEnvio: (v: TipoEnvio) => void;
  isResponsavel: boolean;
  destinatarioId: string;
  setDestinatarioId: (v: string) => void;
  contatos: ContatoEscola[];
  turmaId: string;
  setTurmaId: (v: string) => void;
  turmas: TurmaOpcao[];
  alunoId: string;
  setAlunoId: (v: string) => void;
  alunosPrivado: AlunoResumo[];
  alunos: AlunoResumo[];
  alunosComResponsavel: AlunoResumo[];
  titulo: string;
  setTitulo: (v: string) => void;
  conteudo: string;
  setConteudo: (v: string) => void;
  enviando: boolean;
  campo: string;
}

export function ComposerModal({
  composerAberto,
  setComposerAberto,
  handleEnviarMensagem,
  tipoEnvio,
  setTipoEnvio,
  isResponsavel,
  destinatarioId,
  setDestinatarioId,
  contatos,
  turmaId,
  setTurmaId,
  turmas,
  alunoId,
  setAlunoId,
  alunosPrivado,
  alunos,
  alunosComResponsavel,
  titulo,
  setTitulo,
  conteudo,
  setConteudo,
  enviando,
  campo,
}: ComposerModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
      <form
        onSubmit={handleEnviarMensagem}
        className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-lg w-full shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {tipoEnvio === 'familia' ? 'Mensagem à escola' : 'Novo comunicado'}
          </h3>
          <button type="button" onClick={() => setComposerAberto(false)} aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isResponsavel && (
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setTipoEnvio('mural')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg inline-flex items-center justify-center gap-1 ${tipoEnvio === 'mural' ? 'bg-salvia-700 text-white' : ''}`}
            >
              <Users className="w-3.5 h-3.5" /> Mural da turma
            </button>
            <button
              type="button"
              onClick={() => setTipoEnvio('privado')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg inline-flex items-center justify-center gap-1 ${tipoEnvio === 'privado' ? 'bg-salvia-700 text-white' : ''}`}
            >
              <Lock className="w-3.5 h-3.5" /> Privada 1:1
            </button>
          </div>
        )}

        {tipoEnvio === 'familia' && (
          <label className="block space-y-1">
            <span className="text-[11px] font-bold text-slate-600">
              Destinatário (professor da turma, gestão ou financeiro)
            </span>
            <select
              value={destinatarioId}
              onChange={(e) => setDestinatarioId(e.target.value)}
              className={campo}
              required
            >
              <option value="">Selecione…</option>
              {contatos.map((c) => {
                const papel = (() => {
                  const r = (c.role || '').toLowerCase().replace(/\s+/g, '');
                  if (r === 'professor') return 'Professor(a) da turma';
                  if (r === 'financeiro') return 'Financeiro';
                  if (r === 'secretaria') return 'Secretaria';
                  if (r === 'gestor' || r === 'gestorescolar') return 'Gestão / Diretoria';
                  if (r === 'admin' || r === 'superadmin') return 'Diretoria';
                  return c.role;
                })();
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} · {papel}
                  </option>
                );
              })}
            </select>
          </label>
        )}
        {tipoEnvio === 'mural' && (
          <label className="block text-[11px] font-bold">Turma
            <select required value={turmaId} onChange={(e) => setTurmaId(e.target.value)} className={`${campo} mt-1`}>
              <option value="">Selecione</option>
              {turmas.map((turma) => (
                <option key={turma.id} value={turma.id}>{turma.nome}</option>
              ))}
            </select>
          </label>
        )}
        {tipoEnvio === 'privado' && (
          <label className="block text-[11px] font-bold">Aluno / responsável
            <select required value={alunoId} onChange={(e) => setAlunoId(e.target.value)} className={`${campo} mt-1`} disabled={alunosPrivado.length === 0}>
              <option value="">{alunosPrivado.length === 0 ? 'Nenhum aluno disponível' : 'Selecione'}</option>
              {alunosPrivado.map((aluno) => (
                <option key={aluno.id} value={aluno.id}>
                  {aluno.nome_responsavel} — {aluno.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        {tipoEnvio === 'privado' && alunos.length > 0 && alunosComResponsavel.length === 0 && (
          <p className="text-[11px] text-amber-800 dark:text-amber-200">
            O envio usa o vínculo do responsável na Secretaria. Se falhar, vincule o responsável ao portal.
          </p>
        )}

        <label className="block text-[11px] font-bold">Título
          <input
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Reunião de pais na sexta"
            className={`${campo} mt-1`}
          />
        </label>

        <label className="block text-[11px] font-bold">Mensagem
          <textarea
            required
            rows={5}
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            placeholder="Escreva o comunicado com clareza. Evite jargão."
            className={`${campo} mt-1`}
          />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setComposerAberto(false)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-salvia-700 text-white inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {enviando ? 'Enviando…' : 'Publicar'}
          </button>
        </div>
      </form>
    </div>
  );
}
