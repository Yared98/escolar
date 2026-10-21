import React, { useState, useEffect } from 'react';
import {
  HeartPulse,
  X,
  CheckCircle2,
  Shield,
  MapPin,
  AlertTriangle,
  Edit3,
  Save,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Aluno, ProntuarioData } from './types';

interface ProntuarioModalProps {
  data: {
    aluno: Aluno;
    prontuario: ProntuarioData;
  } | null;
  onClose: () => void;
  onSaved?: (updated: ProntuarioData) => void;
}

export function ProntuarioModal({ data, onClose, onSaved }: ProntuarioModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [editTipoSanguineo, setEditTipoSanguineo] = useState('Não informado');
  const [editAlergias, setEditAlergias] = useState('');
  const [editRestricoes, setEditRestricoes] = useState('');
  const [editMedicamentos, setEditMedicamentos] = useState('');
  const [editCuidados, setEditCuidados] = useState('');
  const [editHistorico, setEditHistorico] = useState('');

  useEffect(() => {
    if (data?.prontuario) {
      setEditTipoSanguineo(data.prontuario.tipo_sanguineo || 'Não informado');
      setEditAlergias(data.prontuario.alergias || '');
      setEditRestricoes(data.prontuario.restricoes_alimentares || '');
      setEditMedicamentos(data.prontuario.medicamentos_continuos || '');
      setEditCuidados(data.prontuario.cuidados_especiais || '');
      setEditHistorico(data.prontuario.historico_observacoes || '');
    }
    setIsEditing(false);
    setSuccessMsg(null);
  }, [data]);

  if (!data) return null;

  const { aluno, prontuario } = data;

  const temAlertaMedico = (text?: string) => {
    if (!text) return false;
    const lower = text.toLowerCase();
    return (
      lower.includes('alergia') ||
      lower.includes('grave') ||
      lower.includes('severa') ||
      lower.includes('anafilaxia') ||
      lower.includes('diabetes') ||
      lower.includes('intolerância') ||
      lower.includes('celíac')
    );
  };

  const handleSalvarProntuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    try {
      const payload: ProntuarioData = {
        tipo_sanguineo: editTipoSanguineo,
        alergias: editAlergias,
        restricoes_alimentares: editRestricoes,
        medicamentos_continuos: editMedicamentos,
        cuidados_especiais: editCuidados,
        historico_observacoes: editHistorico,
      };

      const res = await apiFetch<ProntuarioData>(`/secretaria/prontuarios/${aluno.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setSuccessMsg('Prontuário médico e orientações atualizados com sucesso!');
      setIsEditing(false);
      if (onSaved) {
        onSaved(res || payload);
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar prontuário.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl my-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <HeartPulse className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              <span>Prontuário Médico & Cuidado do Estudante</span>
            </h3>
            <p className="text-xs text-salvia-700 dark:text-salvia-400 font-semibold">
              {aluno.nome} — CPF: {aluno.cpf}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center space-x-2 text-emerald-800 dark:text-emerald-200 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {!isEditing ? (
          <div className="space-y-4 text-xs">
            {/* Cartão de Identificação de Responsáveis & Contato */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 p-3 rounded-xl space-y-1.5">
                <h5 className="font-bold text-salvia-800 dark:text-salvia-300 text-[11px] uppercase tracking-wider flex items-center space-x-1">
                  <Shield className="w-3 h-3" />
                  <span>Responsáveis Registrados</span>
                </h5>
                <p className="text-slate-600 dark:text-slate-400">
                  Legal: <strong className="text-slate-900 dark:text-slate-100">{aluno.nome_responsavel}</strong>
                  <span className="text-[10px] text-salvia-600"> ({aluno.parentesco_responsavel_legal || 'Guardião'})</span>
                </p>
                <p className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                  WhatsApp: {aluno.telefone_responsavel}
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  Financeiro:{' '}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {aluno.responsavel_financeiro_igual_legal
                      ? 'Mesmo que o responsável legal'
                      : aluno.nome_responsavel_financeiro || aluno.nome_responsavel}
                  </strong>
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 p-3 rounded-xl space-y-1.5">
                <h5 className="font-bold text-salvia-800 dark:text-salvia-300 text-[11px] uppercase tracking-wider flex items-center space-x-1">
                  <MapPin className="w-3 h-3" />
                  <span>Endereço & Emergência</span>
                </h5>
                <p className="text-slate-600 dark:text-slate-400">
                  {aluno.logradouro
                    ? `${aluno.logradouro}, ${aluno.numero || 'S/N'} - ${aluno.bairro || ''} (${aluno.cidade || ''}/${aluno.estado || ''})`
                    : 'Endereço não preenchido na matrícula.'}
                </p>
                <div className="pt-1 border-t border-slate-200/60 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400">Em caso de emergência ligar para: </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {aluno.contato_emergencia_nome || aluno.nome_responsavel}
                  </span>{' '}
                  <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                    ({aluno.contato_emergencia_telefone || aluno.telefone_responsavel})
                  </span>
                </div>
              </div>
            </div>

            {/* Alerta Clínico se houver restrição */}
            {temAlertaMedico(prontuario.alergias || prontuario.restricoes_alimentares) && (
              <div className="p-3.5 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-700/60 rounded-xl flex items-start space-x-2.5 text-rose-900 dark:text-rose-200 shadow-sm">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <div>
                  <h5 className="font-bold text-[11px] uppercase tracking-wide">
                    Alerta Crítico: Alergia ou Restrição Alimentar Detectada
                  </h5>
                  <p className="mt-0.5 leading-relaxed font-medium">
                    {prontuario.alergias && `Alergias: ${prontuario.alergias}. `}
                    {prontuario.restricoes_alimentares &&
                      `Restrições: ${prontuario.restricoes_alimentares}.`}
                  </p>
                </div>
              </div>
            )}

            {/* Ficha Clínica Detalhada */}
            <div className="p-4 bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-slate-600 dark:text-slate-400 font-semibold">Tipo Sanguíneo:</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-bold font-mono text-xs">
                    {prontuario.tipo_sanguineo || 'Não informado'}
                  </span>
                </div>
                {prontuario.updated_at && (
                  <span className="text-[10px] text-slate-400">
                    Última atualização: {new Date(prontuario.updated_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <h5 className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] mb-0.5">Alergias Conhecidas:</h5>
                  <p className="p-2.5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300">
                    {prontuario.alergias || 'Nenhuma alergia informada.'}
                  </p>
                </div>
                <div>
                  <h5 className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] mb-0.5">Restrições Alimentares:</h5>
                  <p className="p-2.5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300">
                    {prontuario.restricoes_alimentares || 'Sem restrições alimentares.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <h5 className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] mb-0.5">Medicamentos Contínuos:</h5>
                  <p className="p-2.5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300">
                    {prontuario.medicamentos_continuos || 'Nenhum medicamento contínuo.'}
                  </p>
                </div>
                <div>
                  <h5 className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] mb-0.5">Cuidados Especiais:</h5>
                  <p className="p-2.5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300">
                    {prontuario.cuidados_especiais || 'Sem recomendações especiais cadastradas.'}
                  </p>
                </div>
              </div>

              <div>
                <h5 className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] mb-0.5">
                  Histórico Pedagógico & Ocorrências:
                </h5>
                <p className="p-2.5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 leading-relaxed">
                  {prontuario.historico_observacoes || 'Aluno sem ocorrências disciplinares registradas.'}
                </p>
              </div>
            </div>

            <div className="pt-3 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-salvia-50 dark:bg-salvia-950 border border-salvia-300 dark:border-salvia-700 hover:bg-salvia-100 text-salvia-800 dark:text-salvia-200 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5"
              >
                <Edit3 className="w-3.5 h-3.5 text-salvia-700 dark:text-salvia-400" />
                <span>Editar Informações do Prontuário</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSalvarProntuario} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tipo Sanguíneo
                </label>
                <select
                  value={editTipoSanguineo}
                  onChange={(e) => setEditTipoSanguineo(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-semibold"
                >
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="Não informado">Não informado</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Alergias Clínicas / Medicamentosas
                </label>
                <input
                  type="text"
                  value={editAlergias}
                  onChange={(e) => setEditAlergias(e.target.value)}
                  placeholder="Ex: Alergia a Amoxicilina, picada de abelha..."
                  className="w-full bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Restrições Alimentares (Nutrição & Cantina)
                </label>
                <input
                  type="text"
                  value={editRestricoes}
                  onChange={(e) => setEditRestricoes(e.target.value)}
                  placeholder="Ex: Intolerância severa a lactose, celíaco..."
                  className="w-full bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Medicamentos de Uso Contínuo
                </label>
                <input
                  type="text"
                  value={editMedicamentos}
                  onChange={(e) => setEditMedicamentos(e.target.value)}
                  placeholder="Ex: Insulina, Ritalina, Aerolin..."
                  className="w-full bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Cuidados Especiais & Recomendações
              </label>
              <input
                type="text"
                value={editCuidados}
                onChange={(e) => setEditCuidados(e.target.value)}
                placeholder="Ex: Sentar nas primeiras carteiras, cuidados na recreação..."
                className="w-full bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Histórico Pedagógico & Observações Comportamentais
              </label>
              <textarea
                rows={3}
                value={editHistorico}
                onChange={(e) => setEditHistorico(e.target.value)}
                placeholder="Histórico pedagógico, laudos ou observações de desenvolvimento do aluno."
                className="w-full bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 resize-none"
              />
            </div>

            <div className="pt-3 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs text-slate-600 dark:text-slate-400 font-bold hover:underline"
              >
                ← Cancelar Edição
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-salvia-700 dark:bg-salvia-600 hover:bg-salvia-800 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-1.5 disabled:opacity-60"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Salvando...' : 'Salvar Alterações do Prontuário'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
