import { describe, it, expect } from 'vitest';
import { perfilAmigavel } from './perfis';

describe('perfilAmigavel', () => {
  it('retorna nomes amigáveis para perfis administrativos', () => {
    expect(perfilAmigavel('admin')).toBe('Gestão');
    expect(perfilAmigavel('superadmin')).toBe('Gestão');
    expect(perfilAmigavel('gestor')).toBe('Gestão');
    expect(perfilAmigavel('GestorEscolar')).toBe('Gestão');
  });

  it('retorna nomes amigáveis para perfis operacionais', () => {
    expect(perfilAmigavel('secretaria')).toBe('Secretaria');
    expect(perfilAmigavel('financeiro')).toBe('Financeiro');
    expect(perfilAmigavel('tesouraria')).toBe('Financeiro');
    expect(perfilAmigavel('professor')).toBe('Professor(a)');
    expect(perfilAmigavel('nutricionista')).toBe('Nutrição');
    expect(perfilAmigavel('responsavel')).toBe('Família');
    expect(perfilAmigavel('aluno')).toBe('Aluno(a)');
  });

  it('normaliza variações comuns de responsável', () => {
    expect(perfilAmigavel('pai')).toBe('Família');
    expect(perfilAmigavel('mae')).toBe('Família');
  });

  it('retorna Visitante quando não há perfil', () => {
    expect(perfilAmigavel('')).toBe('Visitante');
    expect(perfilAmigavel(null)).toBe('Visitante');
    expect(perfilAmigavel(undefined)).toBe('Visitante');
  });

  it('capitaliza perfis desconhecidos', () => {
    expect(perfilAmigavel('coordenador')).toBe('Coordenador');
  });
});
