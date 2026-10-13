'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import dynamic from 'next/dynamic';
import { Sidebar, NavRoute, MENU_ITEMS, findRouteByTab, isRouteAllowed, isRouteAuthorized } from '@/components/Sidebar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { perfilAmigavel } from '@/lib/perfis';
import { KeyRound, Building2, UserPlus, LogIn, Lock } from 'lucide-react';
import { TrocarSenha } from '@/components/TrocarSenha';

// Contas da escola-modelo (seed demo, senha documentada em openspec/CORE_SPEC.md).
const DEMO_ESCOLA = 'escola-modelo';
const DEMO_SENHA = 'SenhaSegura2026!';
const DEMO_CONTAS = [
  { email: 'gestor@escolamodelo.com.br', perfil: 'Gestão' },
  { email: 'professor@escolamodelo.com.br', perfil: 'Professor(a)' },
  { email: 'secretaria@escolamodelo.com.br', perfil: 'Secretaria' },
  { email: 'financeiro@escolamodelo.com.br', perfil: 'Financeiro' },
  { email: 'nutri@escolamodelo.com.br', perfil: 'Nutrição' },
  { email: 'familia@escolamodelo.com.br', perfil: 'Família' },
];

const VALID_ROUTES: NavRoute[] = [
  'overview',
  'secretaria',
  'financeiro',
  'pedagogico',
  'academico',
  'nutricao',
  'pessoas',
  'conformidade',
  'agenda',
  'portal_aluno',
  'calendario',
  'crm',
  'ia_evasao',
  'professor',
];

const SectionSkeleton = () => (
  <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-6 sm:p-8 space-y-6 animate-pulse shadow-sm">
    <div className="flex items-center justify-between border-b border-salvia-100 dark:border-salvia-800 pb-4">
      <div className="space-y-2">
        <div className="h-6 bg-salvia-200 dark:bg-salvia-800 rounded-lg w-48"></div>
        <div className="h-3.5 bg-salvia-100 dark:bg-salvia-800/60 rounded-md w-72"></div>
      </div>
      <div className="h-9 bg-salvia-200 dark:bg-salvia-800 rounded-xl w-32"></div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-24 bg-salvia-50 dark:bg-salvia-950/60 border border-salvia-100 dark:border-salvia-800/60 rounded-xl p-4 space-y-3">
          <div className="h-4 bg-salvia-200 dark:bg-salvia-800 rounded w-1/3"></div>
          <div className="h-6 bg-salvia-300 dark:bg-salvia-700 rounded w-2/3"></div>
        </div>
      ))}
    </div>
    <div className="h-72 bg-salvia-50 dark:bg-salvia-950/40 border border-salvia-100 dark:border-salvia-800/40 rounded-xl"></div>
  </div>
);

const OverviewDashboard = dynamic(() => import('@/components/OverviewDashboard').then(m => m.OverviewDashboard), {
  loading: () => <SectionSkeleton />,
  ssr: false,
});
const SecretariaSection = dynamic(() => import('@/components/SecretariaSection').then(m => m.SecretariaSection), {
  loading: () => <SectionSkeleton />,
  ssr: false,
});
const FinanceiroSection = dynamic(() => import('@/components/FinanceiroSection').then(m => m.FinanceiroSection), {
  loading: () => <SectionSkeleton />,
  ssr: false,
});
const PedagocioNutricaoSection = dynamic(() => import('@/components/PedagocioNutricaoSection').then(m => m.PedagocioNutricaoSection), {
  loading: () => <SectionSkeleton />,
  ssr: false,
});
const AdministrativoSection = dynamic(() => import('@/components/AdministrativoSection').then(m => m.AdministrativoSection), {
  loading: () => <SectionSkeleton />,
  ssr: false,
});
const AgendaDigitalSection = dynamic(() => import('@/components/AgendaDigitalSection').then(m => m.AgendaDigitalSection), {
  loading: () => <SectionSkeleton />,
  ssr: false,
});
const AcademicoSection = dynamic(() => import('@/components/AcademicoSection').then(m => m.AcademicoSection), {
  loading: () => <SectionSkeleton />,
  ssr: false,
});
const PortalAlunoSection = dynamic(() => import('@/components/PortalAlunoSection').then(m => m.PortalAlunoSection), {
  loading: () => <SectionSkeleton />,
  ssr: false,
});
const CalendarioEscolarSection = dynamic(() => import('@/components/CalendarioEscolarSection').then(m => m.CalendarioEscolarSection), {
  loading: () => <SectionSkeleton />,
  ssr: false,
});
const CrmSection = dynamic(() => import('@/components/CrmSection').then(m => m.CrmSection), {
  loading: () => <SectionSkeleton />,
  ssr: false,
});
const PainelEvasao = dynamic(() => import('@/components/PainelEvasao').then(m => m.PainelEvasao), {
  loading: () => <SectionSkeleton />,
  ssr: false,
});
const ProfessorSection = dynamic(() => import('@/components/ProfessorSection').then(m => m.ProfessorSection), {
  loading: () => <SectionSkeleton />,
  ssr: false,
});

function DashboardContent() {
  const { user, login } = useAuth();
  const role = user?.role || 'admin';

  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [activeRoute, setActiveRoute] = useState<NavRoute>(() => {
    const initialRoute = searchParams ? (searchParams.get('route') as NavRoute | null) : null;
    if (initialRoute && VALID_ROUTES.includes(initialRoute)) {
      return initialRoute;
    }
    const initialTab = searchParams ? searchParams.get('tab') : null;
    if (initialTab) {
      const matched = findRouteByTab(initialTab, role);
      if (matched) return matched;
    }
    if (role === 'responsavel') return 'portal_aluno';
    if (role === 'professor') return 'professor';
    return 'overview';
  });

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const permitirCadastroEscola = process.env.NEXT_PUBLIC_PERMITIR_CADASTRO_ESCOLA === 'true';

  // Login form state. A escola-modelo (seed demo) só vem preenchida em demonstração ou desenvolvimento;
  // numa instalação real os campos começam vazios.
  const modoDemo =
    process.env.NEXT_PUBLIC_MODO_DEMO === 'true' || process.env.NODE_ENV === 'development';
  const [tenantSlug, setTenantSlug] = useState(modoDemo ? DEMO_ESCOLA : '');
  const [email, setEmail] = useState(modoDemo ? DEMO_CONTAS[0].email : '');
  const [password, setPassword] = useState(modoDemo ? DEMO_SENHA : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Register form state
  const [schoolName, setSchoolName] = useState('');
  const [newSchoolSlug, setNewSchoolSlug] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // URL → state only. Must NOT depend on activeRoute: handleRouteChange updates
  // state optimistically before router.push commits, and a stale searchParams
  // read would snap the route back (Secretaria unmount → lista de alunos vazia).
  useEffect(() => {
    if (!searchParams) return;
    const routeParam = searchParams.get('route') as NavRoute | null;
    if (routeParam && VALID_ROUTES.includes(routeParam)) {
      if (!isRouteAllowed(routeParam, role)) {
        return;
      }
      setActiveRoute((prev) => (prev === routeParam ? prev : routeParam));
      return;
    }

    const tabParam = searchParams.get('tab');
    if (tabParam && !routeParam) {
      setActiveRoute((prev) => {
        const matched = findRouteByTab(tabParam, role, prev);
        return matched && matched !== prev ? matched : prev;
      });
      return;
    }

    // Fallback for empty query parameters on browser Back to root /
    const defaultRoute: NavRoute =
      role === 'responsavel' ? 'portal_aluno' : role === 'professor' ? 'professor' : 'overview';
    setActiveRoute((prev) => (prev === defaultRoute ? prev : defaultRoute));
  }, [searchParams, role]);

  // Keep the open route inside what this profile may see, and update the URL
  // together with the state. Changing only the state fights the URL sync above
  // and the screen alternates forever (Calendário ↔ Portal da família).
  useEffect(() => {
    if (!user) return;
    if (isRouteAllowed(activeRoute, role)) return;

    const fallback: NavRoute = isRouteAllowed('overview', role)
      ? 'overview'
      : role === 'professor'
        ? 'professor'
        : 'portal_aluno';
    if (activeRoute === fallback) return;

    const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
    params.set('route', fallback);
    const menuItem = MENU_ITEMS.find((m) => m.id === fallback);
    if (menuItem?.defaultTab) {
      params.set('tab', menuItem.defaultTab);
    } else {
      params.delete('tab');
    }
    setActiveRoute(fallback);
    const q = params.toString();
    const targetUrl = q ? `${pathname}?${q}` : pathname;
    const currentQuery = searchParams ? searchParams.toString() : '';
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;
    if (targetUrl !== currentUrl) {
      router.replace(targetUrl, { scroll: false });
    }
  }, [user, role, activeRoute, searchParams, pathname, router]);

  // Handle route change and keep URL query parameter in sync
  const handleRouteChange = (newRoute: NavRoute, targetTab?: string) => {
    setActiveRoute(newRoute);
    const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
    params.set('route', newRoute);
    if (targetTab !== undefined) {
      if (targetTab) {
        params.set('tab', targetTab);
      } else {
        params.delete('tab');
      }
    } else {
      const menuItem = MENU_ITEMS.find((m) => m.id === newRoute);
      if (menuItem?.defaultTab) {
        params.set('tab', menuItem.defaultTab);
      } else {
        params.delete('tab');
      }
    }
    const q = params.toString();
    const targetUrl = q ? `${pathname}?${q}` : pathname;
    const currentQuery = searchParams ? searchParams.toString() : '';
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;
    if (targetUrl !== currentUrl) {
      router.push(targetUrl, { scroll: false });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<{
        token: string;
        refresh_token?: string;
        tenant: { id: string; name: string; slug: string; status: string };
        user: { id: string; tenant_id: string; name: string; email: string; role: string; deve_trocar_senha?: boolean };
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          email,
          password,
        }),
      });

      login(data.token, data.tenant, data.user, data.refresh_token);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro ao efetuar login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<{
        token: string;
        refresh_token?: string;
        tenant: { id: string; name: string; slug: string; status: string };
        user: { id: string; tenant_id: string; name: string; email: string; role: string };
      }>('/auth/register-tenant', {
        method: 'POST',
        body: JSON.stringify({
          school_name: schoolName,
          school_slug: newSchoolSlug,
          admin_name: adminName,
          admin_email: adminEmail,
          password: newPassword,
        }),
      });

      login(data.token, data.tenant, data.user, data.refresh_token);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro ao cadastrar escola');
      }
    } finally {
      setLoading(false);
    }
  };

  // Frontend RBAC Claims Security Verification
  const isAuthorized = (route: NavRoute): boolean => isRouteAllowed(route, role);

  return (
    <div className="py-2">
      {user?.deve_trocar_senha ? (
        <TrocarSenha />
      ) : user ? (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Sidebar Navigation */}
          <Sidebar activeRoute={activeRoute} onRouteChange={handleRouteChange} />

          {/* Main Content Area */}
          <div className="flex-1 w-full space-y-6 pb-28 lg:pb-0">
            {!isAuthorized(activeRoute) ? (
              <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 p-8 rounded-2xl text-center space-y-4 shadow-sm">
                <div className="inline-block p-4 bg-rose-100 dark:bg-rose-900/60 rounded-full text-rose-700 dark:text-rose-300">
                  <Lock className="w-8 h-8" />
                </div>
                <h2 className="text-lg font-bold text-rose-900 dark:text-rose-200">
                  Você não tem acesso a esta área
                </h2>
                <p className="text-xs text-rose-800 dark:text-rose-300 max-w-md mx-auto">
                  Seu perfil não inclui esta parte do sistema. Se precisar, fale com a gestão da escola.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => handleRouteChange(role === 'responsavel' ? 'portal_aluno' : 'overview')}
                    className="bg-rose-700 hover:bg-rose-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
                  >
                    Voltar ao início
                  </button>
                </div>
              </div>
            ) : (
              <>
                {activeRoute === 'overview' && <OverviewDashboard onRouteChange={handleRouteChange} />}
                {activeRoute === 'secretaria' && <SecretariaSection />}
                {activeRoute === 'financeiro' && <FinanceiroSection />}
                {activeRoute === 'pedagogico' && <PedagocioNutricaoSection />}
                {activeRoute === 'nutricao' && <PedagocioNutricaoSection />}
                {activeRoute === 'academico' && <AcademicoSection />}
                {(activeRoute === 'pessoas' || activeRoute === 'conformidade') && <AdministrativoSection />}
                {activeRoute === 'agenda' && <AgendaDigitalSection />}
                {activeRoute === 'portal_aluno' && <PortalAlunoSection />}
                {activeRoute === 'calendario' && <CalendarioEscolarSection />}
                {activeRoute === 'crm' && <CrmSection />}
                {activeRoute === 'ia_evasao' && <PainelEvasao />}
                {activeRoute === 'professor' && <ProfessorSection onRouteChange={handleRouteChange} />}
              </>
            )}
          </div>
          <MobileBottomNav activeRoute={activeRoute} onRouteChange={handleRouteChange} />
        </div>
      ) : (
        <div className="w-full max-w-md mx-auto bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-6 sm:p-8 shadow-md">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-slate-900 dark:text-salvia-50">Entrar</h1>
            <p className="text-xs text-salvia-600 dark:text-salvia-400 mt-1">
              Acesse com o código da sua escola, seu e-mail e senha.
            </p>
          </div>

          {/* Abas só existem quando o cadastro de escola está liberado; sem ele, o formulário de login basta. */}
          {permitirCadastroEscola && (
          <div className="flex bg-salvia-100 dark:bg-salvia-800 p-1 rounded-xl mb-6">
            <button
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                activeTab === 'login'
                  ? 'bg-salvia-700 dark:bg-salvia-500 text-white shadow-sm'
                  : 'text-salvia-700 dark:text-salvia-300 hover:text-slate-900 dark:hover:text-salvia-50'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Entrar</span>
            </button>
            <button
              onClick={() => setActiveTab('register')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                activeTab === 'register'
                  ? 'bg-salvia-700 dark:bg-salvia-500 text-white shadow-sm'
                  : 'text-salvia-700 dark:text-salvia-300 hover:text-slate-900 dark:hover:text-salvia-50'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Cadastrar Escola</span>
            </button>
          </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          {activeTab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-salvia-800 dark:text-salvia-200 mb-1">
                  Código da escola
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-salvia-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={tenantSlug}
                    onChange={(e) => setTenantSlug(e.target.value)}
                    placeholder="ex: escola-modelo"
                    className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 font-medium placeholder-salvia-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-salvia-800 dark:text-salvia-200 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="gestor@escola.com.br"
                  className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 font-medium placeholder-salvia-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-salvia-800 dark:text-salvia-200 mb-1">Senha</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-salvia-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 font-medium placeholder-salvia-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 dark:hover:bg-salvia-600 text-white py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm disabled:opacity-50 mt-2"
              >
                {loading ? 'Autenticando...' : 'Entrar'}
              </button>

              {modoDemo && (
                <div className="pt-4 mt-2 border-t border-salvia-100 dark:border-salvia-800">
                  <p className="text-xs font-semibold text-salvia-800 dark:text-salvia-200 mb-2">
                    Demonstração: entre como
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {DEMO_CONTAS.map((conta) => (
                      <button
                        key={conta.email}
                        type="button"
                        onClick={() => {
                          setTenantSlug(DEMO_ESCOLA);
                          setEmail(conta.email);
                          setPassword(DEMO_SENHA);
                        }}
                        className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                          email === conta.email
                            ? 'bg-salvia-100 dark:bg-salvia-800 border-salvia-500 text-salvia-900 dark:text-salvia-50'
                            : 'border-salvia-200 dark:border-salvia-700 text-salvia-700 dark:text-salvia-300 hover:bg-salvia-50 dark:hover:bg-salvia-900'
                        }`}
                      >
                        {conta.perfil}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-salvia-800 dark:text-salvia-200 mb-1">Nome da Escola</label>
                <input
                  type="text"
                  required
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="Escola Futuro"
                  className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 font-medium placeholder-salvia-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-salvia-800 dark:text-salvia-200 mb-1">Código da escola na URL</label>
                <input
                  type="text"
                  required
                  value={newSchoolSlug}
                  onChange={(e) => setNewSchoolSlug(e.target.value)}
                  placeholder="escola-futuro"
                  className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 font-medium placeholder-salvia-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-salvia-800 dark:text-salvia-200 mb-1">Nome do Gestor</label>
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Carlos Silva"
                  className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 font-medium placeholder-salvia-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-salvia-800 dark:text-salvia-200 mb-1">E-mail do Gestor</label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="carlos@escolafuturo.com.br"
                  className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 font-medium placeholder-salvia-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-salvia-800 dark:text-salvia-200 mb-1">Senha Principal</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 font-medium placeholder-salvia-400"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 dark:hover:bg-salvia-600 text-white py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm disabled:opacity-50 mt-2 flex items-center justify-center space-x-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>{loading ? 'Cadastrando...' : 'Criar Unidade & Acessar'}</span>
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
