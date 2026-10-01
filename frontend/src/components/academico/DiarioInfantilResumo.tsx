'use client';

import React from 'react';
import {
  STATUS_REFEICAO_LABEL,
  type DiarioInfantilDia,
  type StatusRefeicao,
} from '@/lib/types/academico';

interface DiarioInfantilResumoProps {
  alunoNome?: string;
  turmaNome?: string;
  data: string;
  dia: DiarioInfantilDia | null;
}

const ICONE_REFEICAO: Record<StatusRefeicao, string> = {
  tudo: '⭐⭐⭐',
  metade: '⭐⭐',
  pouco: '⭐',
  recusou: '✖',
};

const HUMOR_LABEL: Record<string, string> = {
  alegre: 'Alegre',
  tranquilo: 'Tranquilo',
  agitado: 'Agitado',
  choroso: 'Choroso',
};

const formatarData = (iso: string): string => {
  const [ano, mes, diaMes] = iso.split('-').map(Number);
  if (!ano || !mes || !diaMes) return iso;
  const data = new Date(ano, mes - 1, diaMes);
  const semana = data.toLocaleDateString('pt-BR', { weekday: 'long' });
  const texto = data.toLocaleDateString('pt-BR');
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${texto}`;
};

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h5 className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{titulo}</h5>
      {children}
    </div>
  );
}

function Item({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-800 dark:text-salvia-100">{rotulo}</p>
      <p className="text-xs text-slate-700 dark:text-salvia-300 uppercase">{valor}</p>
    </div>
  );
}

export function DiarioInfantilResumo({ alunoNome, turmaNome, data, dia }: DiarioInfantilResumoProps) {
  const presenca = dia?.presenca ?? 'sem_registro';
  const rotina = dia?.rotina ?? null;
  const cardapio = dia?.cardapio ?? [];

  return (
    <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="space-y-0.5">
        {alunoNome && (
          <p className="text-[10px] uppercase tracking-wider font-bold text-salvia-500">{alunoNome}</p>
        )}
        <h4 className="text-sm font-bold uppercase text-slate-900 dark:text-salvia-50">{turmaNome || 'Turma'}</h4>
        <p className="text-xs font-bold text-slate-600 dark:text-salvia-300">{formatarData(data)}</p>
      </div>

      <Secao titulo="Presença">
        <p
          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
            presenca === 'presente'
              ? 'bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
              : presenca === 'falta'
                ? 'bg-rose-100 border-rose-300 text-rose-900 dark:bg-rose-950 dark:text-rose-300'
                : presenca === 'justificada'
                  ? 'bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-salvia-100 border-salvia-300 text-salvia-800 dark:bg-salvia-800 dark:text-salvia-200'
          }`}
        >
          {presenca === 'presente'
            ? 'Presente'
            : presenca === 'falta'
              ? 'Ausente (falta)'
              : presenca === 'justificada'
                ? 'Ausente (falta justificada)'
                : 'Chamada não lançada'}
        </p>
        {presenca === 'justificada' && dia?.justificativa && (
          <p className="text-xs text-amber-800 dark:text-amber-300">Motivo: {dia.justificativa}</p>
        )}
      </Secao>

      {presenca !== 'falta' && presenca !== 'justificada' && (
        <Secao titulo="Refeições">
          {rotina && rotina.refeicoes.length > 0 ? (
            rotina.refeicoes.map((r) => (
              <Item
                key={r.tipo_refeicao}
                rotulo={r.tipo_refeicao}
                valor={`${ICONE_REFEICAO[r.status] || ''} ${STATUS_REFEICAO_LABEL[r.status] || r.status}`}
              />
            ))
          ) : rotina ? (
            <Item rotulo="Alimentação" valor={rotina.refeicao_status} />
          ) : (
            <p className="text-xs text-salvia-600 dark:text-salvia-400">Rotina ainda não lançada.</p>
          )}
        </Secao>
      )}

      <Secao titulo="Cardápio">
        {cardapio.length === 0 ? (
          <p className="text-xs text-salvia-600 dark:text-salvia-400">Nenhum cardápio cadastrado para esta data.</p>
        ) : (
          cardapio.map((c, idx) => (
            <Item
              key={`${c.tipo_refeicao}-${idx}`}
              rotulo={c.tipo_refeicao}
              valor={c.descricao_ingredientes || c.titulo_menu}
            />
          ))
        )}
      </Secao>

      {rotina && presenca !== 'falta' && presenca !== 'justificada' && (
        <Secao titulo="Rotina">
          <div className="grid grid-cols-3 gap-2">
            <Item rotulo="Soneca" valor={`${rotina.sono_minutos} min`} />
            <Item rotulo="Fraldas" valor={`${rotina.fraldas_trocas}x`} />
            <Item rotulo="Humor" valor={HUMOR_LABEL[rotina.humor] || rotina.humor} />
          </div>
          {rotina.medicamento_ministrado && (
            <Item rotulo="Medicamento" valor={rotina.medicamento_ministrado} />
          )}
          {rotina.observacao_pedagogica && (
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-salvia-100">Observação</p>
              <p className="text-xs text-slate-700 dark:text-salvia-300">{rotina.observacao_pedagogica}</p>
            </div>
          )}
        </Secao>
      )}
    </div>
  );
}
