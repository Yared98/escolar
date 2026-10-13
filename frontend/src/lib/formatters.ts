/**
 * Utilitários de formatação e máscaras para documentos brasileiros (CPF, Telefone, CEP, Moeda)
 */

export function cleanDigits(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

export function formatCpf(cpf: string | null | undefined): string {
  if (!cpf) return '';
  const digits = cleanDigits(cpf).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = cleanDigits(phone).slice(0, 11);
  if (digits.length <= 2) return digits.length > 0 ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function formatCep(cep: string | null | undefined): string {
  if (!cep) return '';
  const digits = cleanDigits(cep).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

/** Número com casas fixas ou "-" quando não há valor (ex.: período ainda sem nota). */
export function formatNumero(valor: number | null | undefined, casas: number): string {
  if (valor == null || isNaN(valor)) return '-';
  return valor.toFixed(casas);
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
}

export function formatDateBr(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const parts = dateString.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateString;
  }
}
