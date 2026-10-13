const ETAPAS: Record<string, string> = {
  educacao_infantil: 'Educação Infantil',
  infantil: 'Educação Infantil',
  fundamental_1: 'Ensino Fundamental I',
  fundamental_2: 'Ensino Fundamental II',
  medio: 'Ensino Médio',
  ensino_medio: 'Ensino Médio',
};

/** Nome da etapa de ensino para exibir na tela, a partir do código salvo na turma. */
export function etapaEnsinoLabel(codigo?: string | null): string {
  if (!codigo) return 'Etapa não informada';
  return ETAPAS[codigo.toLowerCase()] ?? codigo.replace(/_/g, ' ');
}
