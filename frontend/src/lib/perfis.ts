export type PerfilEscolar =
  | 'admin'
  | 'superadmin'
  | 'gestor'
  | 'gestorescolar'
  | 'secretaria'
  | 'financeiro'
  | 'tesouraria'
  | 'professor'
  | 'nutricionista'
  | 'responsavel'
  | 'aluno'
  | string;

export function perfilAmigavel(role?: PerfilEscolar | null): string {
  if (!role) return 'Visitante';
  const raw = role.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (raw === 'admin' || raw === 'superadmin' || raw === 'gestor' || raw === 'gestorescolar') {
    return 'Gestão';
  }
  if (raw === 'secretaria') return 'Secretaria';
  if (raw === 'financeiro' || raw === 'tesouraria') return 'Financeiro';
  if (raw === 'professor') return 'Professor(a)';
  if (raw === 'nutricionista') return 'Nutrição';
  if (raw === 'responsavel' || raw === 'pai' || raw === 'mae') return 'Família';
  if (raw === 'aluno') return 'Aluno(a)';

  return role.charAt(0).toUpperCase() + role.slice(1);
}
