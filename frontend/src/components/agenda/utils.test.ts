import { describe, it, expect } from 'vitest';
import {
  formatarHorarioCurto,
  agruparMensagensPorDia,
  mensagemEhMinha,
  iniciaisNome,
  opcoesAlunoPrivado,
} from './utils';
import { AlunoResumo, MensagemAgenda } from './types';

describe('opcoesAlunoPrivado', () => {
  const alunos: AlunoResumo[] = [
    { id: '2', nome: 'Bruno Lima', nome_responsavel: 'Carla Lima', responsavel_user_id: 'u1' },
    { id: '1', nome: 'Ana Souza', nome_responsavel: '', responsavel_user_id: null },
  ];

  it('ordena por aluno e mostra o responsável ao lado', () => {
    expect(opcoesAlunoPrivado(alunos)).toEqual([
      { id: '1', rotulo: 'Ana Souza · responsável não informado' },
      { id: '2', rotulo: 'Bruno Lima · Carla Lima' },
    ]);
  });

  it('filtra pelo nome do aluno ou do responsável', () => {
    expect(opcoesAlunoPrivado(alunos, 'carla').map((o) => o.id)).toEqual(['2']);
    expect(opcoesAlunoPrivado(alunos, 'ana').map((o) => o.id)).toEqual(['1']);
  });
});

const criarData = (ano: number, mes: number, dia: number, hora = 0, minuto = 0) =>
  new Date(ano, mes - 1, dia, hora, minuto);

const base = criarData(2026, 10, 13, 14, 32);

const msg = (
  id: string,
  iso: string,
  overrides?: Partial<MensagemAgenda>,
): MensagemAgenda => ({
  id,
  canal: 'professor',
  titulo: 'Título',
  conteudo: 'Conteúdo',
  lida: false,
  created_at: iso,
  ...overrides,
});

describe('formatarHorarioCurto', () => {
  it('retorna o horário quando é hoje', () => {
    const hoje14h32 = criarData(base.getFullYear(), base.getMonth() + 1, base.getDate(), 14, 32);
    expect(formatarHorarioCurto(hoje14h32.toISOString(), base)).toBe('14:32');
  });

  it('retorna "Ontem" para o dia anterior', () => {
    const ontem = criarData(base.getFullYear(), base.getMonth() + 1, base.getDate() - 1, 9, 15);
    expect(formatarHorarioCurto(ontem.toISOString(), base)).toBe('Ontem');
  });

  it('retorna o dia da semana abreviado para dias desta semana', () => {
    // 13/10/2026 é terça-feira; 7 dias antes é 6/10 (terça), diff=7 → data no formato
    const estaSemana = criarData(base.getFullYear(), base.getMonth() + 1, base.getDate() - 5, 10, 0);
    expect(formatarHorarioCurto(estaSemana.toISOString(), base)).toBe('Qui');
  });

  it('retorna dd/MM para datas mais antigas', () => {
    const antiga = criarData(base.getFullYear(), base.getMonth() + 1, 1, 8, 0);
    expect(formatarHorarioCurto(antiga.toISOString(), base)).toBe('01/10');
  });

  it('retorna string vazia para data inválida', () => {
    expect(formatarHorarioCurto('invalid')).toBe('');
  });
});

describe('agruparMensagensPorDia', () => {
  it('agrupa mensagens por dia em ordem cronológica', () => {
    const mensagens = [
      msg('1', criarData(2026, 10, 12, 10, 0).toISOString()),
      msg('2', criarData(2026, 10, 13, 8, 0).toISOString()),
      msg('3', criarData(2026, 10, 13, 14, 0).toISOString()),
      msg('4', criarData(2026, 10, 11, 18, 0).toISOString()),
    ];

    const grupos = agruparMensagensPorDia(mensagens, base);
    expect(grupos).toHaveLength(3);
    expect(grupos[0].label).toBe('11 de outubro');
    expect(grupos[0].mensagens.map((m) => m.id)).toEqual(['4']);
    expect(grupos[1].label).toBe('Ontem');
    expect(grupos[1].mensagens.map((m) => m.id)).toEqual(['1']);
    expect(grupos[2].label).toBe('Hoje');
    expect(grupos[2].mensagens.map((m) => m.id)).toEqual(['2', '3']);
  });

  it('usa "Ontem" para o dia anterior', () => {
    const mensagens = [
      msg('1', criarData(2026, 10, 12, 10, 0).toISOString()),
    ];
    const grupos = agruparMensagensPorDia(mensagens, base);
    expect(grupos[0].label).toBe('Ontem');
  });

  it('retorna array vazio quando não há mensagens', () => {
    expect(agruparMensagensPorDia([], base)).toEqual([]);
  });
});

describe('mensagemEhMinha', () => {
  it('retorna true quando remetente_id é igual ao userId', () => {
    const m = msg('1', new Date().toISOString(), { remetente_id: 'user-123' });
    expect(mensagemEhMinha(m, 'user-123')).toBe(true);
  });

  it('retorna false quando remetente_id é diferente', () => {
    const m = msg('1', new Date().toISOString(), { remetente_id: 'user-123' });
    expect(mensagemEhMinha(m, 'user-456')).toBe(false);
  });

  it('retorna false quando não há userId', () => {
    const m = msg('1', new Date().toISOString(), { remetente_id: 'user-123' });
    expect(mensagemEhMinha(m, '')).toBe(false);
    expect(mensagemEhMinha(m, null)).toBe(false);
    expect(mensagemEhMinha(m, undefined)).toBe(false);
  });
});

describe('iniciaisNome', () => {
  it('retorna as duas primeiras letras quando há apenas um nome', () => {
    expect(iniciaisNome('Ana')).toBe('AN');
  });

  it('retorna a primeira letra do primeiro e último nome', () => {
    expect(iniciaisNome('Carlos Silva')).toBe('CS');
    expect(iniciaisNome('Maria das Graças Souza')).toBe('MS');
  });

  it('retorna interrogação para nome vazio ou nulo', () => {
    expect(iniciaisNome('')).toBe('?');
    expect(iniciaisNome(null)).toBe('?');
    expect(iniciaisNome(undefined)).toBe('?');
  });
});
