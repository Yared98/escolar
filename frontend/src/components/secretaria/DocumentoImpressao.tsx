'use client';

import React from 'react';
import { Printer, X } from 'lucide-react';
import { formatDateExtenso } from '@/lib/formatters';

export interface DocumentoEscola {
  nome: string;
  cnpj: string | null;
  endereco: string | null;
}

export interface TurmaDocumento {
  id: string;
  nome: string;
  codigo: string | null;
  etapa_ensino: string | null;
  serie: string | null;
  turno: string | null;
  ano_letivo: number;
}

export interface AlunoDocumento {
  id: string;
  nome: string;
  data_nascimento: string;
  cpf: string | null;
  matricula: string | null;
}

export interface FrequenciaDocumento {
  total_aulas: number;
  presencas: number;
  percentual: number;
}

export interface NotaHistorico {
  disciplina: string;
  periodo: string;
  nota: number;
}

export interface DisciplinaHistorico {
  disciplina: string;
  notas: NotaHistorico[];
  media: number;
}

export interface DocumentoSecretaria {
  tipo: string;
  escola: DocumentoEscola;
  aluno: AlunoDocumento;
  turma: TurmaDocumento | null;
  situacao_matricula: string;
  frequencia: FrequenciaDocumento | null;
  historico: DisciplinaHistorico[] | null;
  emitido_em: string;
  codigo_verificacao: string;
}

export interface DocumentoImpressaoProps {
  documento: DocumentoSecretaria;
  onClose: () => void;
}

const tipoTitulo: Record<string, string> = {
  declaracao_matricula: 'Declaração de Matrícula',
  declaracao_frequencia: 'Declaração de Frequência',
  historico: 'Histórico Escolar',
};

function cnjpOuBranco(valor: string | null): string {
  return valor ? valor : '________________________________';
}

function cpfOuBranco(valor: string | null): string {
  return valor ? valor : '____________________';
}

function turmaTexto(doc: DocumentoSecretaria): string {
  if (!doc.turma) return 'turma não informada';
  const codigo = doc.turma.codigo ? `${doc.turma.codigo} - ` : '';
  const serie = doc.turma.serie ? ` (${doc.turma.serie})` : '';
  return `${codigo}${doc.turma.nome}${serie}`;
}

function periodoAmigavel(periodo: string): string {
  return periodo.replace(/_/g, ' ');
}

export function DocumentoImpressao({ documento, onClose }: DocumentoImpressaoProps) {
  const titulo = tipoTitulo[documento.tipo] || 'Documento Escolar';
  const anoLetivo = documento.turma?.ano_letivo ?? new Date(documento.emitido_em).getFullYear();
  const dataEmissao = formatDateExtenso(documento.emitido_em);
  const nasc = formatDateExtenso(documento.aluno.data_nascimento);

  let corpo: React.ReactNode = null;
  if (documento.tipo === 'declaracao_matricula') {
    corpo = (
      <p>
        Declaramos, para os devidos fins, que <strong>{documento.aluno.nome}</strong>, nascido(a) em {nasc},
        portador(a) do CPF {cpfOuBranco(documento.aluno.cpf)}, está regularmente matriculado(a) no{' '}
        <strong>{turmaTexto(documento)}</strong> desta instituição de ensino, no ano letivo de {anoLetivo},
        encontrando-se com situação de matrícula: <strong>{documento.situacao_matricula}</strong>.
      </p>
    );
  } else if (documento.tipo === 'declaracao_frequencia') {
    const f = documento.frequencia;
    corpo = (
      <>
        <p>
          Declaramos, para os devidos fins, que <strong>{documento.aluno.nome}</strong>, nascido(a) em {nasc},
          portador(a) do CPF {cpfOuBranco(documento.aluno.cpf)}, está regularmente matriculado(a) no{' '}
          <strong>{turmaTexto(documento)}</strong> desta instituição de ensino, no ano letivo de {anoLetivo}, e
          apresentou frequência escolar de <strong>{f?.presencas ?? 0}</strong> presenças em{' '}
          <strong>{f?.total_aulas ?? 0}</strong> aulas registradas, correspondendo a{' '}
          <strong>{f?.percentual ?? 0}%</strong> de frequência no período.
        </p>
        {f && f.total_aulas === 0 && (
          <p className="text-sm text-amber-700">
            Não há registros de aulas para o ano letivo informado; preencha à mão se necessário.
          </p>
        )}
      </>
    );
  } else if (documento.tipo === 'historico') {
    corpo = (
      <>
        <p>
          Histórico escolar de <strong>{documento.aluno.nome}</strong>, nascido(a) em {nasc}, portador(a) do CPF{' '}
          {cpfOuBranco(documento.aluno.cpf)}, matriculado(a) no <strong>{turmaTexto(documento)}</strong>, no ano
          letivo de {anoLetivo}.
        </p>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-2 py-1 text-left">Disciplina</th>
                <th className="border border-slate-300 px-2 py-1 text-left">Período</th>
                <th className="border border-slate-300 px-2 py-1 text-right">Nota</th>
                <th className="border border-slate-300 px-2 py-1 text-right">Média</th>
              </tr>
            </thead>
            <tbody>
              {(documento.historico || []).flatMap((disc) =>
                disc.notas.map((nota, idx) => (
                  <tr key={`${disc.disciplina}-${nota.periodo}`}>
                    <td className="border border-slate-300 px-2 py-1">{idx === 0 ? disc.disciplina : ''}</td>
                    <td className="border border-slate-300 px-2 py-1">{periodoAmigavel(nota.periodo)}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right">{nota.nota.toFixed(1)}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right">
                      {idx === disc.notas.length - 1 ? disc.media.toFixed(1) : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {(!documento.historico || documento.historico.length === 0) && (
          <p className="text-sm text-slate-600 mt-4">Sem notas registradas para o período.</p>
        )}
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 overflow-auto">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
      <div className="no-print sticky top-0 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{titulo}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-salvia-700 px-4 py-2 text-sm font-bold text-white min-h-[44px]"
          >
            <Printer className="h-4 w-4" />
            Imprimir / Salvar PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold min-h-[44px]"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-8 text-slate-900 dark:text-slate-100 text-base space-y-6 leading-relaxed">
        <header className="text-center space-y-1 border-b border-slate-300 pb-4">
          <h1 className="text-xl font-bold">{documento.escola.nome}</h1>
          <p className="text-sm">{cnjpOuBranco(documento.escola.endereco)}</p>
          <p className="text-sm">CNPJ: {cnjpOuBranco(documento.escola.cnpj)}</p>
        </header>

        <h2 className="text-center text-lg font-bold uppercase">{titulo}</h2>

        <div>{corpo}</div>

        <p className="mt-6">
          Por ser verdade, firmamos a presente declaração.
        </p>

        <p>
          Local e data: ____________________, {dataEmissao}.
        </p>

        <div className="mt-12 flex flex-col items-center">
          <div className="w-64 border-t border-slate-400" />
          <p className="mt-2 text-sm">Assinatura da Secretaria</p>
        </div>

        <footer className="mt-8 border-t border-slate-200 pt-3 text-xs text-slate-500 flex items-center justify-between">
          <span>Código de verificação: {documento.codigo_verificacao}</span>
          <span>Emissão: {dataEmissao}</span>
        </footer>
      </div>
    </div>
  );
}
