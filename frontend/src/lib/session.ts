// Sessão do navegador.
//
// O token de acesso (curto, 15 min) fica SÓ na memória desta aba. O refresh token vive num cookie
// HttpOnly que o servidor grava e que o JavaScript da página não consegue ler. Ao recarregar a
// página, o token de acesso é pedido de novo ao servidor pelo cookie. Em localStorage ficam apenas
// dados de exibição (usuário e escola), nunca credenciais.

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

/** Pede ao servidor o modo "cookie" (refresh token fora do alcance do JavaScript). */
export const CABECALHO_MODO_COOKIE = { 'X-Auth-Mode': 'cookie' } as const;

const CHAVES_EXIBICAO = ['escolar_user', 'escolar_tenant', 'escolar_tenant_id'];
// Chaves de versões antigas, que guardavam credenciais no navegador: são apagadas.
const CHAVES_LEGADAS = ['escolar_jwt_token', 'escolar_refresh_token'];

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Há uma sessão que vale tentar retomar? (só um indício: usuário salvo para exibição) */
export function temSessaoSalva(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!localStorage.getItem('escolar_user');
  } catch {
    return false;
  }
}

export function removerCredenciaisLegadas(): void {
  if (typeof window === 'undefined') return;
  for (const chave of CHAVES_LEGADAS) {
    try {
      localStorage.removeItem(chave);
    } catch {
      // armazenamento indisponível
    }
  }
}

/** Apaga a sessão desta aba e avisa a aplicação (volta para a tela de entrada). */
export function limparSessaoLocal(): void {
  accessToken = null;
  if (typeof window === 'undefined') return;
  removerCredenciaisLegadas();
  for (const chave of CHAVES_EXIBICAO) {
    try {
      localStorage.removeItem(chave);
    } catch {
      // armazenamento indisponível
    }
  }
  window.dispatchEvent(new Event('auth_error'));
}

export type ResultadoRenovacao = 'ok' | 'expirada' | 'rede';

let renovacaoEmAndamento: Promise<ResultadoRenovacao> | null = null;

async function renovarAgora(): Promise<ResultadoRenovacao> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...CABECALHO_MODO_COOKIE },
      body: '{}',
    });
    if (res.status === 401 || res.status === 403) return 'expirada';
    if (!res.ok) return 'rede';
    const data = (await res.json().catch(() => null)) as { token?: string } | null;
    if (!data?.token) return 'rede';
    accessToken = data.token;
    return 'ok';
  } catch {
    // sem internet ou servidor fora do ar: a sessão pode continuar válida
    return 'rede';
  }
}

/** Renova o token de acesso pelo cookie. Chamadas simultâneas compartilham uma só renovação. */
export function renovarSessao(): Promise<ResultadoRenovacao> {
  if (!renovacaoEmAndamento) {
    renovacaoEmAndamento = renovarAgora().finally(() => {
      renovacaoEmAndamento = null;
    });
  }
  return renovacaoEmAndamento;
}

/**
 * Token de acesso atual. Se a aba foi recarregada (token só em memória) e há sessão salva,
 * renova primeiro. Devolve null quando não há sessão ou a renovação não foi possível.
 */
export async function garantirTokenDeAcesso(): Promise<string | null> {
  if (accessToken) return accessToken;
  if (!temSessaoSalva()) return null;
  await renovarSessao();
  return accessToken;
}

/** Encerra a sessão no servidor (revoga os tokens e apaga o cookie) e depois na aba. */
export async function encerrarSessao(): Promise<void> {
  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('escolar_tenant_id') : null;
  try {
    const token = await garantirTokenDeAcesso();
    if (token && tenantId) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json',
          ...CABECALHO_MODO_COOKIE,
        },
        body: '{}',
      });
    }
  } catch {
    // sem rede: a sessão local é encerrada mesmo assim
  }
  accessToken = null;
}
