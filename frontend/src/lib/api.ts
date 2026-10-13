const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

let refreshInFlight: Promise<boolean> | null = null;

function isSessionEndpoint(endpoint: string): boolean {
  return (
    endpoint.startsWith('/auth/login') ||
    endpoint.startsWith('/auth/refresh') ||
    endpoint.startsWith('/auth/logout') ||
    endpoint.startsWith('/auth/register')
  );
}

function clearSession(): void {
  localStorage.removeItem('escolar_jwt_token');
  localStorage.removeItem('escolar_refresh_token');
  localStorage.removeItem('escolar_user');
  localStorage.removeItem('escolar_tenant');
  localStorage.removeItem('escolar_tenant_id');
  window.dispatchEvent(new Event('auth_error'));
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem('escolar_refresh_token');
  if (!refreshToken) return false;

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) return false;

  const data = await res.json().catch(() => null) as { token?: string; refresh_token?: string } | null;
  if (!data?.token) return false;
  localStorage.setItem('escolar_jwt_token', data.token);
  if (data.refresh_token) {
    localStorage.setItem('escolar_refresh_token', data.refresh_token);
  }
  return true;
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  retried = false
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('escolar_jwt_token') : null;
  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('escolar_tenant_id') : null;

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

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (
    res.status === 401 &&
    typeof window !== 'undefined' &&
    !retried &&
    !isSessionEndpoint(endpoint) &&
    localStorage.getItem('escolar_refresh_token')
  ) {
    if (!refreshInFlight) {
      refreshInFlight = refreshAccessToken().finally(() => {
        refreshInFlight = null;
      });
    }
    let renewed = false;
    try {
      renewed = await refreshInFlight;
    } catch {
      renewed = false;
    }
    if (renewed) {
      return apiFetch<T>(endpoint, options, true);
    }
    clearSession();
  } else if (res.status === 401 && typeof window !== 'undefined' && !isSessionEndpoint(endpoint)) {
    clearSession();
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Erro de comunicação com o servidor' }));
    throw new Error(errorData.error || `Erro de requisição (HTTP ${res.status})`);
  }

  return res.json();
}
