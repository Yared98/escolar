import {
  API_BASE,
  CABECALHO_MODO_COOKIE,
  garantirTokenDeAcesso,
  limparSessaoLocal,
  renovarSessao,
} from './session';

function isSessionEndpoint(endpoint: string): boolean {
  return (
    endpoint.startsWith('/auth/login') ||
    endpoint.startsWith('/auth/refresh') ||
    endpoint.startsWith('/auth/logout') ||
    endpoint.startsWith('/auth/register')
  );
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  retried = false
): Promise<T> {
  const sessionEndpoint = isSessionEndpoint(endpoint);
  const browser = typeof window !== 'undefined';
  // Token só em memória: depois de recarregar a página ele é pedido de novo pelo cookie.
  const token = browser && !sessionEndpoint ? await garantirTokenDeAcesso() : null;
  const tenantId = browser ? localStorage.getItem('escolar_tenant_id') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }

  // Rotas de sessão trocam o refresh token por um cookie HttpOnly (o JavaScript nunca o vê).
  const sessionInit: RequestInit = sessionEndpoint ? { credentials: 'include' } : {};
  if (sessionEndpoint) {
    Object.assign(headers, CABECALHO_MODO_COOKIE);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    ...sessionInit,
    headers,
  });

  if (res.status === 401 && browser && !sessionEndpoint) {
    if (!retried) {
      const renovada = await renovarSessao();
      if (renovada === 'ok') {
        return apiFetch<T>(endpoint, options, true);
      }
      if (renovada === 'rede') {
        // sem conexão com o servidor de sessão: mantém a sessão e informa o erro
        throw new Error('Não foi possível confirmar sua sessão. Verifique a conexão.');
      }
    }
    limparSessaoLocal();
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Erro de comunicação com o servidor' }));
    throw new Error(errorData.error || `Erro de requisição (HTTP ${res.status})`);
  }

  return res.json();
}
