import { describe, it, expect } from 'vitest';
import { isRouteAllowed } from './Sidebar';

describe('isRouteAllowed', () => {
  it('permite professor em professor, mas não em overview', () => {
    expect(isRouteAllowed('professor', 'professor')).toBe(true);
    expect(isRouteAllowed('overview', 'professor')).toBe(false);
  });

  it('não permite secretaria em professor', () => {
    expect(isRouteAllowed('professor', 'secretaria')).toBe(false);
  });

  it('permite gestor/admin em qualquer rota, incluindo professor', () => {
    expect(isRouteAllowed('professor', 'admin')).toBe(true);
    expect(isRouteAllowed('professor', 'gestor')).toBe(true);
    expect(isRouteAllowed('overview', 'gestor')).toBe(true);
  });

  it('mantém permissões dos demais perfis', () => {
    expect(isRouteAllowed('financeiro', 'financeiro')).toBe(true);
    expect(isRouteAllowed('secretaria', 'secretaria')).toBe(true);
    expect(isRouteAllowed('portal_aluno', 'responsavel')).toBe(true);
    expect(isRouteAllowed('overview', 'responsavel')).toBe(false);
    expect(isRouteAllowed('nutricao', 'nutricionista')).toBe(true);
  });
});
