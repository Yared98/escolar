import { describe, it, expect } from 'vitest';
import { getMobileShortcuts } from './MobileBottomNav';

describe('getMobileShortcuts', () => {
  it('professor vê Meu dia, Chamada, Notas e Recados', () => {
    const items = getMobileShortcuts('professor');
    expect(items.map((i) => i.label)).toEqual(['Meu dia', 'Chamada', 'Notas', 'Recados']);
    expect(items.find((i) => i.label === 'Meu dia')?.route).toBe('professor');
    expect(items.find((i) => i.label === 'Chamada')?.route).toBe('academico');
    expect(items.find((i) => i.label === 'Notas')?.route).toBe('professor');
  });

  it('gestor vê Painel, Alunos, Financeiro e Recados', () => {
    const items = getMobileShortcuts('gestor');
    expect(items.map((i) => i.label)).toEqual(['Painel', 'Alunos', 'Financeiro', 'Recados']);
  });

  it('secretaria vê Painel, Alunos, Turmas e Captação', () => {
    const items = getMobileShortcuts('secretaria');
    expect(items.map((i) => i.label)).toEqual(['Painel', 'Alunos', 'Turmas', 'Captação']);
  });

  it('financeiro vê Painel, Faturas, Cobrança e Alunos', () => {
    const items = getMobileShortcuts('financeiro');
    expect(items.map((i) => i.label)).toEqual(['Painel', 'Faturas', 'Cobrança', 'Alunos']);
  });

  it('responsável vê Boletim, Mensalidades, Recados e Rotina', () => {
    const items = getMobileShortcuts('responsavel');
    expect(items.map((i) => i.label)).toEqual(['Boletim', 'Mensalidades', 'Recados', 'Rotina']);
  });

  it('nutricionista vê Painel, Cardápio e Calendário', () => {
    const items = getMobileShortcuts('nutricionista');
    expect(items.map((i) => i.label)).toEqual(['Painel', 'Cardápio', 'Calendário']);
  });
});
