'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Utensils,
  Moon,
  Heart,
  Smile,
  AlertTriangle,
  Send,
  MessageSquare,
  Pin,
  Camera,
  Pill,
  UserX,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import {
  STATUS_REFEICAO_LABEL,
  resumoRefeicoes,
  type AlunoChamada,
  type CardapioDia,
  type CreatePortfolioPayload,
  type CreateRotinaPayload,
  type DiarioInfantilDia,
  type RefeicaoRotina,
  type StatusRefeicao,
  type ToastMsg,
} from '@/lib/types/academico';
import { PortfolioModal, type PortfolioFormData } from './PortfolioModal';
import { DiarioInfantilResumo } from './DiarioInfantilResumo';

interface InfantilRotinaPanelProps {
  turmaId: string;
  turmaNome: string;
  dataAula: string;
  alunos: AlunoChamada[];
  selectedAlunoId: string;
  setSelectedAlunoId: (id: string) => void;
  isOnline: boolean;
  tenantId: string | undefined;
  enqueue: (entity: string, payload: Record<string, unknown>) => Promise<string>;
  showToast: (toast: ToastMsg, ms?: number) => void;
  refreshKey: number;
}

const REFEICAO_GERAL = 'Alimentação geral';
const STATUS_REFEICAO: StatusRefeicao[] = ['tudo', 'metade', 'pouco', 'recusou'];

const refeicoesDoCardapio = (cardapio: CardapioDia[], salvas: RefeicaoRotina[]): RefeicaoRotina[] => {
  const tipos = cardapio.length > 0 ? Array.from(new Set(cardapio.map((c) => c.tipo_refeicao))) : [REFEICAO_GERAL];
  const porTipo = new Map(salvas.map((r) => [r.tipo_refeicao, r.status]));
  return tipos.map((tipo) => ({ tipo_refeicao: tipo, status: porTipo.get(tipo) || 'tudo' }));
};

export function InfantilRotinaPanel({
  turmaId,
  turmaNome,
  dataAula,
  alunos,
  selectedAlunoId,
  setSelectedAlunoId,
  isOnline,
  tenantId,
  enqueue,
  showToast,
  refreshKey,
}: InfantilRotinaPanelProps) {
  const [diaInfantil, setDiaInfantil] = useState<DiarioInfantilDia | null>(null);
  const [refeicoes, setRefeicoes] = useState<RefeicaoRotina[]>([{ tipo_refeicao: REFEICAO_GERAL, status: 'tudo' }]);
  const [sonoMinutos, setSonoMinutos] = useState(90);
  const [fraldasTrocas, setFraldasTrocas] = useState(4);
  const [humor, setHumor] = useState('alegre');
  const [medicamento, setMedicamento] = useState('');
  const [observacao, setObservacao] = useState('');

  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [tipoOcorrencia, setTipoOcorrencia] = useState('febre');
  const [descricaoOcorrencia, setDescricaoOcorrencia] = useState('');

  const [showMensagemModal, setShowMensagemModal] = useState(false);
  const [tipoMensagem, setTipoMensagem] = useState<'turma' | 'aluno'>('turma');
  const [tituloMensagem, setTituloMensagem] = useState('');
  const [conteudoMensagem, setConteudoMensagem] = useState('');
  const [fixarNoMural, setFixarNoMural] = useState(false);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);

  const alunoSelecionado = alunos.find((a) => a.id === selectedAlunoId);
  const alunoAusente = !!alunoSelecionado && alunoSelecionado.status !== 'presente';

  const carregarDiaInfantil = useCallback(async () => {
    if (!selectedAlunoId || !isOnline) {
      setDiaInfantil(null);
      return;
    }
    try {
      const dia = await apiFetch<DiarioInfantilDia>(
        `/agenda/diario-infantil/${selectedAlunoId}?data=${encodeURIComponent(dataAula)}`
      );
      setDiaInfantil(dia);
      const rotina = dia.rotina;
      setRefeicoes(refeicoesDoCardapio(dia.cardapio || [], rotina?.refeicoes || []));
      setSonoMinutos(rotina?.sono_minutos ?? 90);
      setFraldasTrocas(rotina?.fraldas_trocas ?? 4);
      setHumor(rotina?.humor || 'alegre');
      setMedicamento(rotina?.medicamento_ministrado || '');
      setObservacao(rotina?.observacao_pedagogica || '');
    } catch {
      setDiaInfantil(null);
    }
  }, [selectedAlunoId, dataAula, isOnline]);

  useEffect(() => {
    carregarDiaInfantil();
  }, [carregarDiaInfantil, refreshKey]);

  const setStatusRefeicao = (tipo: string, status: StatusRefeicao) => {
    setRefeicoes((prev) => prev.map((r) => (r.tipo_refeicao === tipo ? { ...r, status } : r)));
  };

  const handleSalvarRotina = async () => {
    if (!tenantId) {
      showToast({ text: 'Sua sessão expirou. Entre novamente.', type: 'warn' });
      return;
    }
    if (!selectedAlunoId) {
      showToast({ text: 'Selecione um aluno para registrar a rotina.', type: 'warn' });
      return;
    }
    if (alunoAusente) {
      showToast({ text: 'Aluno ausente nesta data. A rotina não é registrada.', type: 'warn' });
      return;
    }

    const payload: CreateRotinaPayload = {
      aluno_id: selectedAlunoId,
      data: dataAula,
      refeicao_status: resumoRefeicoes(refeicoes),
      refeicoes,
      sono_minutos: sonoMinutos,
      fraldas_trocas: fraldasTrocas,
      humor,
      medicamento_ministrado: medicamento || null,
      observacao_pedagogica: observacao || null,
    };

    if (!isOnline) {
      await enqueue('rotina_infantil', payload as unknown as Record<string, unknown>);
      showToast({
        text: 'Rotina salva neste aparelho. O envio ocorre ao reconectar ou ao voltar para o Diário.',
        type: 'success',
      });
      return;
    }

    try {
      await apiFetch('/agenda/rotina', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast({ text: 'Rotina infantil salva no diário do dia.', type: 'success' });
      await carregarDiaInfantil();
    } catch (err: unknown) {
      if (err instanceof TypeError) {
        await enqueue('rotina_infantil', payload as unknown as Record<string, unknown>);
        showToast({ text: 'Sem conexão com o servidor. Rotina salva na fila offline.', type: 'success' });
        return;
      }
      showToast({
        text: err instanceof Error ? err.message : 'Não foi possível salvar a rotina.',
        type: 'warn',
      });
    }
  };

  const handleSalvarOcorrencia = async () => {
    if (!isOnline) {
      showToast({ text: 'Ocorrência urgente exige conexão. Tente novamente online.', type: 'warn' });
      return;
    }
    if (!selectedAlunoId || !descricaoOcorrencia.trim()) {
      showToast({ text: 'Informe o aluno e a descrição da ocorrência.', type: 'warn' });
      return;
    }
    try {
      await apiFetch('/agenda/ocorrencias', {
        method: 'POST',
        body: JSON.stringify({
          aluno_id: selectedAlunoId,
          turma_id: turmaId || null,
          tipo_ocorrencia: tipoOcorrencia,
          descricao: descricaoOcorrencia,
          prioridade: 'urgente',
        }),
      });
      showToast({ text: 'Ocorrência urgente registrada.', type: 'success' });
      setShowIncidentModal(false);
      setDescricaoOcorrencia('');
    } catch (err: unknown) {
      showToast({
        text: err instanceof Error ? err.message : 'Não foi possível registrar a ocorrência.',
        type: 'warn',
      });
    }
  };

  const handleEnviarMensagem = async () => {
    if (!conteudoMensagem.trim()) return;
    if (!isOnline) {
      showToast({ text: 'Envio de mensagem exige conexão.', type: 'warn' });
      return;
    }
    if (tipoMensagem === 'turma' && !turmaId) {
      showToast({ text: 'Selecione a turma para o mural.', type: 'warn' });
      return;
    }
    if (tipoMensagem === 'aluno' && !selectedAlunoId) {
      showToast({ text: 'Selecione o aluno para mensagem privada.', type: 'warn' });
      return;
    }

    try {
      await apiFetch('/agenda/mensagens', {
        method: 'POST',
        body: JSON.stringify({
          canal: tipoMensagem === 'turma' ? 'mural_turma' : 'professor',
          titulo: fixarNoMural
            ? `📌 ${tituloMensagem || 'Mural da Turma'}`
            : tituloMensagem || 'Comunicado da Professora',
          conteudo: conteudoMensagem,
          turma_id: tipoMensagem === 'turma' ? turmaId : null,
          destinatario_id: tipoMensagem === 'aluno' ? selectedAlunoId : null,
        }),
      });
      showToast({
        text:
          tipoMensagem === 'turma'
            ? 'Comunicado enviado ao mural da turma.'
            : 'Mensagem privada enviada.',
        type: 'success',
      });
      setShowMensagemModal(false);
      setTituloMensagem('');
      setConteudoMensagem('');
    } catch (err: unknown) {
      showToast({
        text: err instanceof Error ? err.message : 'Falha ao enviar a mensagem.',
        type: 'warn',
      });
    }
  };

  const handleSalvarPortfolio = async (form: PortfolioFormData) => {
    if (!tenantId) {
      showToast({ text: 'Sua sessão expirou. Entre novamente.', type: 'warn' });
      return;
    }
    if (!selectedAlunoId || !turmaId) {
      showToast({ text: 'Selecione turma e aluno antes do portfólio.', type: 'warn' });
      return;
    }

    const payload: CreatePortfolioPayload = {
      aluno_id: selectedAlunoId,
      turma_id: turmaId,
      titulo: form.titulo,
      descricao: form.descricao,
      campos_experiencia_bncc: form.campos_bncc,
      midia_url: form.midia_url || null,
      data_registro: dataAula,
    };

    try {
      if (isOnline) {
        await apiFetch('/pedagogico/portfolio', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast({ text: 'Portfólio BNCC salvo.', type: 'success' });
      } else {
        throw new Error('Offline');
      }
    } catch {
      await enqueue('portfolio_infantil', payload as unknown as Record<string, unknown>);
      showToast({ text: 'Portfólio salvo neste aparelho. O envio ocorre ao reconectar ou ao voltar para o Diário.', type: 'success' });
    }
    setShowPortfolioModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-salvia-800 dark:text-salvia-200">
          Rotina por aluno
        </h3>
      </div>

      <div className="p-4 bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-2xl space-y-2">
        <label className="block text-xs font-bold text-slate-900 dark:text-salvia-50">
          Selecione o estudante:
        </label>
        <div className="flex flex-wrap gap-2">
          {alunos.length === 0 && (
            <p className="text-xs text-salvia-600 dark:text-salvia-400">
              Nenhum aluno enturmado para registrar a rotina.
            </p>
          )}
          {alunos.map((aluno) => {
            const ausente = aluno.status !== 'presente';
            return (
              <button
                key={aluno.id}
                onClick={() => setSelectedAlunoId(aluno.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                  selectedAlunoId === aluno.id
                    ? 'bg-salvia-700 text-white border-salvia-700 dark:bg-salvia-500'
                    : ausente
                      ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                      : 'bg-white dark:bg-salvia-900 text-slate-800 dark:text-salvia-200 border-salvia-200 dark:border-salvia-800'
                }`}
              >
                <span>{aluno.nome}</span>
                {ausente && (
                  <span className="text-[9px] font-mono uppercase">
                    {aluno.status === 'justificada' ? 'J' : 'F'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
      <div className="lg:col-span-3 space-y-4">
      {alunoAusente ? (
        <div className="p-4 rounded-2xl border border-rose-300 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/30 flex items-start gap-3">
          <UserX className="w-5 h-5 text-rose-600 shrink-0" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-rose-900 dark:text-rose-200">
              {alunoSelecionado?.nome} está com{' '}
              {alunoSelecionado?.status === 'justificada' ? 'falta justificada' : 'falta'} em{' '}
              {dataAula.split('-').reverse().join('/')}.
            </p>
            {alunoSelecionado?.status === 'justificada' && alunoSelecionado.justificativa && (
              <p className="text-rose-800 dark:text-rose-300">Motivo: {alunoSelecionado.justificativa}</p>
            )}
            <p className="text-rose-700 dark:text-rose-300">
              A rotina do dia não é registrada para aluno ausente. Para lançar a rotina, marque presença e salve a chamada.
            </p>
          </div>
        </div>
      ) : (
      <>
      <div className="bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl space-y-3">
        <div className="flex items-center space-x-2">
          <Utensils className="w-4 h-4 text-salvia-700 dark:text-salvia-300" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-salvia-50">Refeições</h3>
          {diaInfantil && diaInfantil.cardapio.length === 0 && (
            <span className="text-[10px] text-salvia-500">Sem cardápio cadastrado para esta data.</span>
          )}
        </div>
        <div className="space-y-2">
          {refeicoes.map((r) => (
            <div key={r.tipo_refeicao} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-salvia-100">{r.tipo_refeicao}</span>
              <div className="grid grid-cols-4 gap-1.5 text-[11px] font-bold">
                {STATUS_REFEICAO.map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusRefeicao(r.tipo_refeicao, st)}
                    className={`py-1.5 px-2 rounded-lg border text-center transition-all ${
                      r.status === st
                        ? st === 'recusou'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-salvia-700 text-white border-salvia-700 dark:bg-salvia-500'
                        : 'bg-white dark:bg-salvia-900 text-slate-700 dark:text-salvia-300 border-salvia-200'
                    }`}
                  >
                    {STATUS_REFEICAO_LABEL[st]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl space-y-3">
          <div className="flex items-center space-x-2">
            <Moon className="w-4 h-4 text-salvia-700 dark:text-salvia-300" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-salvia-50">Soneca (minutos)</h3>
          </div>
          <input
            type="number"
            value={sonoMinutos}
            onChange={(e) => setSonoMinutos(Number(e.target.value))}
            className="w-full bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-salvia-50 font-bold"
          />
        </div>

        <div className="bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl space-y-3">
          <div className="flex items-center space-x-2">
            <Heart className="w-4 h-4 text-salvia-700 dark:text-salvia-300" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-salvia-50">Trocas de fralda</h3>
          </div>
          <input
            type="number"
            value={fraldasTrocas}
            onChange={(e) => setFraldasTrocas(Number(e.target.value))}
            className="w-full bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-salvia-50 font-bold"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl space-y-3">
          <div className="flex items-center space-x-2">
            <Smile className="w-4 h-4 text-salvia-700 dark:text-salvia-300" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-salvia-50">Humor</h3>
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-[11px] font-bold">
            {['alegre', 'tranquilo', 'agitado', 'choroso'].map((h) => (
              <button
                key={h}
                onClick={() => setHumor(h)}
                className={`py-2 px-1 rounded-lg border text-center capitalize transition-all ${
                  humor === h
                    ? 'bg-salvia-700 text-white border-salvia-700 dark:bg-salvia-500'
                    : 'bg-white dark:bg-salvia-900 text-slate-700 dark:text-salvia-300 border-salvia-200'
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl space-y-2">
          <div className="flex items-center space-x-2 mb-1">
            <Pill className="w-4 h-4 text-salvia-700 dark:text-salvia-300" />
            <label className="block text-xs font-bold text-slate-900 dark:text-salvia-50">
              Medicamento ministrado
            </label>
          </div>
          <input
            type="text"
            value={medicamento}
            onChange={(e) => setMedicamento(e.target.value)}
            placeholder="Ex: Antitérmico 5ml às 14h (autorizado)"
            className="w-full bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-salvia-50 focus:outline-none"
          />
          <label className="block text-xs font-bold text-slate-900 dark:text-salvia-50 pt-2">
            Observação pedagógica
          </label>
          <input
            type="text"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex: Participou da roda de música..."
            className="w-full bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-salvia-50 focus:outline-none"
          />
        </div>
      </div>
      </>
      )}
      </div>

      <div className="lg:col-span-2">
        <DiarioInfantilResumo
          alunoNome={alunoSelecionado?.nome}
          turmaNome={diaInfantil?.turma?.nome || turmaNome}
          data={dataAula}
          dia={diaInfantil}
        />
      </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowIncidentModal(true)}
            disabled={!isOnline}
            title={!isOnline ? 'Disponível apenas online' : undefined}
            className="w-full sm:w-auto bg-rose-700 hover:bg-rose-800 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm disabled:opacity-50"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Ocorrência urgente</span>
          </button>
          <button
            onClick={() => setShowMensagemModal(true)}
            disabled={!isOnline}
            title={!isOnline ? 'Disponível apenas online' : undefined}
            className="w-full sm:w-auto bg-salvia-100 hover:bg-salvia-200 dark:bg-salvia-800 text-salvia-900 dark:text-salvia-100 border border-salvia-300 dark:border-salvia-600 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 disabled:opacity-50"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Comunicado / Mural</span>
          </button>
          <button
            onClick={() => setShowPortfolioModal(true)}
            className="w-full sm:w-auto bg-white dark:bg-salvia-900 hover:bg-salvia-50 border border-salvia-300 dark:border-salvia-700 text-salvia-800 dark:text-salvia-200 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5"
          >
            <Camera className="w-4 h-4" />
            <span>Portfólio BNCC</span>
          </button>
        </div>

        <button
          onClick={handleSalvarRotina}
          disabled={!selectedAlunoId || alunoAusente}
          className="w-full sm:w-auto bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 text-white px-6 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          <span>Salvar rotina do dia</span>
        </button>
      </div>

      {showIncidentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center space-x-2 pb-3 border-b border-salvia-100 dark:border-salvia-800">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">Ocorrência urgente</h3>
            </div>
            <select
              value={tipoOcorrencia}
              onChange={(e) => setTipoOcorrencia(e.target.value)}
              className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-xs font-bold"
            >
              <option value="febre">Febre ou indisposição</option>
              <option value="queda_arranhao">Queda / arranhão</option>
              <option value="atrito_colega">Atrito / desentendimento</option>
              <option value="outro">Outros</option>
            </select>
            <textarea
              rows={3}
              value={descricaoOcorrencia}
              onChange={(e) => setDescricaoOcorrencia(e.target.value)}
              placeholder="Descreva o ocorrido..."
              className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl p-3 text-xs"
            />
            <div className="flex justify-end space-x-2">
              <button onClick={() => setShowIncidentModal(false)} className="px-4 py-2 text-xs font-bold">
                Cancelar
              </button>
              <button
                onClick={handleSalvarOcorrencia}
                className="bg-rose-700 hover:bg-rose-800 text-white px-4 py-2 rounded-xl text-xs font-bold"
              >
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {showMensagemModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center space-x-2 pb-3 border-b border-salvia-100 dark:border-salvia-800">
              <MessageSquare className="w-5 h-5 text-salvia-700" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">Mensagem / Mural</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setTipoMensagem('turma')}
                className={`py-2 px-3 rounded-xl border font-bold ${
                  tipoMensagem === 'turma'
                    ? 'bg-salvia-700 text-white border-salvia-700'
                    : 'bg-salvia-50 dark:bg-salvia-950 border-salvia-200'
                }`}
              >
                Toda a turma
              </button>
              <button
                type="button"
                onClick={() => setTipoMensagem('aluno')}
                className={`py-2 px-3 rounded-xl border font-bold ${
                  tipoMensagem === 'aluno'
                    ? 'bg-salvia-700 text-white border-salvia-700'
                    : 'bg-salvia-50 dark:bg-salvia-950 border-salvia-200'
                }`}
              >
                Aluno selecionado
              </button>
            </div>
            <input
              type="text"
              value={tituloMensagem}
              onChange={(e) => setTituloMensagem(e.target.value)}
              placeholder="Título"
              className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-xs"
            />
            <textarea
              rows={3}
              value={conteudoMensagem}
              onChange={(e) => setConteudoMensagem(e.target.value)}
              placeholder="Conteúdo da mensagem..."
              className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl p-3 text-xs"
            />
            <label className="flex items-center space-x-2 text-xs font-bold text-amber-700 cursor-pointer">
              <input
                type="checkbox"
                checked={fixarNoMural}
                onChange={(e) => setFixarNoMural(e.target.checked)}
                className="accent-salvia-600"
              />
              <Pin className="w-3.5 h-3.5" />
              <span>Fixar no mural</span>
            </label>
            <div className="flex justify-end space-x-2">
              <button onClick={() => setShowMensagemModal(false)} className="px-4 py-2 text-xs font-bold">
                Cancelar
              </button>
              <button
                onClick={handleEnviarMensagem}
                className="bg-salvia-700 hover:bg-salvia-800 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <PortfolioModal
        open={showPortfolioModal}
        alunoNome={alunoSelecionado?.nome}
        onClose={() => setShowPortfolioModal(false)}
        onSave={handleSalvarPortfolio}
      />
    </div>
  );
}
