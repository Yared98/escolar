'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { perfilAmigavel } from '@/lib/perfis';
import {
  LucideIcon,
  LayoutDashboard,
  Users,
  DollarSign,
  BookOpen,
  Smartphone,
  Megaphone,
  Brain,
  CalendarDays,
  CalendarCheck,
  GraduationCap,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  LogOut,
  X,
  FileText,
  Award,
  Baby,
  MessageSquare,
  MessageCircle,
  ArrowDownLeft,
  ArrowUpRight,
  PieChart,
  Layers,
  Clock,
  Utensils,
  Send,
  UserCheck,
  Truck,
  Building,
  ClipboardList,
  Lock,
} from 'lucide-react';

export type NavRoute =
  | 'overview'
  | 'secretaria'
  | 'financeiro'
  | 'pedagogico'
  | 'academico'
  | 'nutricao'
  | 'pessoas'
  | 'conformidade'
  | 'agenda'
  | 'portal_aluno'
  | 'calendario'
  | 'crm'
  | 'ia_evasao'
  | 'professor';

export interface NavSubItem {
  id: string;
  label: string;
  tabKey: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
}

export interface NavItem {
  id: NavRoute;
  label: string;
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  defaultTab?: string;
  subItems?: NavSubItem[];
}

export interface SidebarProps {
  activeRoute: NavRoute;
  onRouteChange?: (route: NavRoute, targetTab?: string) => void;
}

export const MENU_ITEMS: NavItem[] = [
  {
    id: 'professor',
    label: 'Meu dia',
    icon: CalendarCheck,
    defaultTab: 'hoje',
    subItems: [
      { id: 'prof-hoje', label: 'Aulas de hoje', tabKey: 'hoje', icon: CalendarCheck },
      { id: 'prof-planejamento', label: 'Planejamento', tabKey: 'planejamento', icon: CalendarDays },
      { id: 'prof-notas', label: 'Lançar notas', tabKey: 'notas', icon: BookOpen },
      { id: 'prof-avaliacoes', label: 'Avaliações', tabKey: 'avaliacoes', icon: ClipboardList },
    ],
  },
  {
    id: 'overview',
    label: 'Visão Geral',
    icon: LayoutDashboard,
  },
  {
    id: 'crm',
    label: 'Captação de alunos',
    icon: Megaphone,
  },
  {
    id: 'secretaria',
    label: 'Secretaria',
    icon: Users,
    defaultTab: 'alunos',
    subItems: [
      { id: 'sec-alunos', label: 'Alunos e matrículas', tabKey: 'alunos', icon: Users },
      { id: 'sec-turmas', label: 'Turmas', tabKey: 'turmas', icon: BookOpen },
      { id: 'sec-contratos', label: 'Contratos e parcelas', tabKey: 'contratos', icon: FileText },
    ],
  },
  {
    id: 'pedagogico',
    label: 'Pedagógico',
    icon: BookOpen,
    defaultTab: 'disciplinas_matriz',
    subItems: [
      { id: 'ped-matriz', label: 'Disciplinas e matriz', tabKey: 'disciplinas_matriz', icon: Layers },
      { id: 'ped-horarios', label: 'Professores e horários', tabKey: 'atribuicao_horarios', icon: Clock },
      { id: 'ped-planos-aula', label: 'Planos de aula', tabKey: 'planos_aula', icon: CalendarDays },
      { id: 'ped-projetos', label: 'Projetos BNCC', tabKey: 'projetos', icon: Sparkles },
      { id: 'ped-fechamento', label: 'Fechamento e conselho', tabKey: 'fechamento', icon: Lock },
    ],
  },
  {
    id: 'academico',
    label: 'Diário',
    icon: Sparkles,
  },
  {
    id: 'nutricao',
    label: 'Nutrição',
    icon: Utensils,
    defaultTab: 'nutricao',
    subItems: [
      { id: 'nutri-planner', label: 'Cardápio', tabKey: 'nutricao', icon: Utensils },
    ],
  },
  {
    id: 'agenda',
    label: 'Recados',
    icon: Smartphone,
    defaultTab: 'comunicacao',
    subItems: [
      { id: 'agenda-comunicacao', label: 'Mensagens e mural', tabKey: 'comunicacao', icon: MessageSquare },
      { id: 'agenda-whatsapp', label: 'WhatsApp', tabKey: 'whatsapp', icon: MessageCircle },
    ],
  },
  {
    id: 'calendario',
    label: 'Calendário',
    icon: CalendarDays,
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    icon: DollarSign,
    defaultTab: 'ar',
    subItems: [
      { id: 'fin-ar', label: 'Faturas', tabKey: 'ar', icon: ArrowDownLeft },
      { id: 'fin-ap', label: 'Despesas', tabKey: 'ap', icon: ArrowUpRight },
      { id: 'fin-cobranca', label: 'Cobrança', tabKey: 'cobranca', icon: Send },
      { id: 'fin-fornecedores', label: 'Fornecedores', tabKey: 'fornecedores', icon: Truck },
      { id: 'fin-nfse', label: 'NFS-e', tabKey: 'nfse', icon: FileText },
      { id: 'fin-bi', label: 'Relatórios', tabKey: 'bi', icon: PieChart },
      { id: 'fin-banking', label: 'Integrações', tabKey: 'banking', icon: Building },
    ],
  },
  {
    id: 'pessoas',
    label: 'Pessoas',
    icon: UserCheck,
    defaultTab: 'entidades',
    subItems: [
      { id: 'pessoas-rh', label: 'Funcionários', tabKey: 'entidades', icon: UserCheck },
      { id: 'pessoas-usuarios', label: 'Usuários e acessos', tabKey: 'usuarios', icon: ShieldCheck },
    ],
  },
  {
    id: 'conformidade',
    label: 'Conformidade',
    icon: ShieldCheck,
    defaultTab: 'envios',
    subItems: [
      { id: 'conf-envios', label: 'Registro de envios', tabKey: 'envios', icon: Send },
      { id: 'conf-lgpd', label: 'Auditoria LGPD', tabKey: 'relatorios', icon: ShieldCheck },
    ],
  },
  {
    id: 'ia_evasao',
    label: 'Risco de evasão',
    icon: Brain,
  },
  {
    id: 'portal_aluno',
    label: 'Portal da família',
    icon: GraduationCap,
    defaultTab: 'portal_boletim',
    subItems: [
      { id: 'portal-boletim', label: 'Boletim', tabKey: 'portal_boletim', icon: FileText },
      { id: 'portal-financeiro', label: 'Mensalidades', tabKey: 'portal_financeiro', icon: DollarSign },
      { id: 'portal-diploma', label: 'Documentos', tabKey: 'portal_diploma', icon: Award },
      { id: 'portal-rotina', label: 'Rotina', tabKey: 'portal_rotina', icon: Baby },
      {
        id: 'portal-avaliacoes',
        label: 'Provas e trabalhos',
        tabKey: 'portal_avaliacoes',
        icon: ClipboardList,
      },
      {
        id: 'portal-ocorrencias',
        label: 'Observações',
        tabKey: 'portal_ocorrencias',
        icon: ClipboardList,
      },
    ],
  },
];

const canonicalRole = (role?: string): string => {
  const raw = (role || '').toLowerCase().replace(/[^a-z]/g, '');
  if (raw === 'gestorescolar' || raw === 'superadmin') return 'gestor';
  if (raw === 'tesouraria') return 'financeiro';
  if (raw === 'pai' || raw === 'mae' || raw === 'responsável') return 'responsavel';
  return raw;
};

export const isRouteAllowed = (route: NavRoute, role?: string): boolean => {
  const normalized = canonicalRole(role);
  if (!normalized || normalized === 'admin' || normalized === 'gestor') return true;

  switch (route) {
    case 'overview':
      return normalized !== 'responsavel' && normalized !== 'professor';
    case 'professor':
      return normalized === 'professor' || normalized === 'gestor' || normalized === 'admin';
    case 'secretaria':
      return normalized === 'financeiro' || normalized === 'secretaria';
    case 'financeiro':
      return normalized === 'financeiro';
    case 'pedagogico':
    case 'academico':
      return normalized === 'professor';
    case 'nutricao':
      return normalized === 'nutricionista';
    case 'pessoas':
    case 'conformidade':
      return false;
    case 'calendario':
      return true;
    case 'crm':
      return normalized === 'secretaria';
    case 'ia_evasao':
      return false;
    case 'agenda':
      return normalized === 'professor' || normalized === 'responsavel';
    case 'portal_aluno':
      return normalized === 'responsavel' || normalized === 'aluno';
    default:
      return false;
  }
};

export const isRouteAuthorized = isRouteAllowed;

export const findRouteByTab = (
  tabKey: string,
  role?: string,
  currentRoute?: NavRoute
): NavRoute | undefined => {
  if (!tabKey) return undefined;

  // Collect all matching routes
  const matchingRoutes: NavRoute[] = [];
  for (const item of MENU_ITEMS) {
    if (item.subItems && item.subItems.some((sub) => sub.tabKey === tabKey)) {
      matchingRoutes.push(item.id);
    }
  }

  if (matchingRoutes.length === 0) return undefined;
  if (matchingRoutes.length === 1) return matchingRoutes[0];

  // Disambiguation Signal 1: Parent Context (currentRoute)
  if (currentRoute && matchingRoutes.includes(currentRoute)) {
    if (!role || isRouteAllowed(currentRoute, role)) {
      return currentRoute;
    }
  }

  // Disambiguation Signal 2: User Role / Authorization Filter
  if (role) {
    const authorizedRoutes = matchingRoutes.filter((route) => isRouteAllowed(route, role));
    if (authorizedRoutes.length === 1) {
      return authorizedRoutes[0];
    }
    if (authorizedRoutes.length > 1) {
      // Preference when both are authorized:
      if (role === 'responsavel' && authorizedRoutes.includes('portal_aluno')) {
        return 'portal_aluno';
      }
      if (role !== 'responsavel' && authorizedRoutes.includes('agenda')) {
        return 'agenda';
      }
      return authorizedRoutes[0];
    }
    return undefined;
  }

  // Fallback: first match in MENU_ITEMS (backward compatibility)
  return matchingRoutes[0];
};

export function Sidebar({ activeRoute, onRouteChange }: SidebarProps) {
  const { user, logout } = useAuth();
  const role = user?.role || 'admin';

  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Manual toggle overrides for routes: [routeId]: boolean
  const [expandedRoutes, setExpandedRoutes] = useState<Record<string, boolean>>({});

  // Route permissions matrix
  const isAllowed = (route: NavRoute): boolean => isRouteAllowed(route, role);

  // Financeiro entra na Secretaria só para consultar contratos (o backend recusa alunos e turmas).
  const somenteContratos = canonicalRole(role) === 'financeiro';
  const filteredItems = MENU_ITEMS.filter((item) => isAllowed(item.id)).map((item) =>
    item.id === 'secretaria' && somenteContratos
      ? {
          ...item,
          defaultTab: 'contratos',
          subItems: item.subItems?.filter((sub) => sub.tabKey === 'contratos'),
        }
      : item,
  );

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleOpenMenu = () => setIsMobileMenuOpen(true);
    window.addEventListener('open-mobile-menu', handleOpenMenu);
    return () => window.removeEventListener('open-mobile-menu', handleOpenMenu);
  }, []);

  // Determines whether a route is expanded (auto-expanded if activeRoute, unless manually toggled)
  const isRouteExpanded = (routeId: string): boolean => {
    if (expandedRoutes[routeId] !== undefined) {
      return expandedRoutes[routeId];
    }
    return activeRoute === routeId;
  };

  // Toggle expand manually via chevron button without switching routes
  const handleToggleExpand = (routeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRoutes((prev) => ({
      ...prev,
      [routeId]: !isRouteExpanded(routeId),
    }));
  };

  // Parent item click handler
  const handleParentClick = (item: NavItem, onClickCallback?: () => void) => {
    const hasSubItems = item.subItems && item.subItems.length > 0;

    if (activeRoute !== item.id) {
      setExpandedRoutes((prev) => ({ ...prev, [item.id]: true }));
      if (onRouteChange) {
        onRouteChange(item.id, hasSubItems ? item.defaultTab : undefined);
      } else {
        const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
        params.set('route', item.id);
        if (hasSubItems && item.defaultTab) {
          params.set('tab', item.defaultTab);
        } else {
          params.delete('tab');
        }
        const query = params.toString();
        router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
      }

      if (onClickCallback) onClickCallback();
    } else if (hasSubItems) {
      // If already active, toggle collapse
      setExpandedRoutes((prev) => ({
        ...prev,
        [item.id]: !isRouteExpanded(item.id),
      }));
    }
  };

  // Sub-item click handler
  const handleSubItemClick = (parentRoute: NavRoute, subItem: NavSubItem, onClickCallback?: () => void) => {
    setExpandedRoutes((prev) => ({ ...prev, [parentRoute]: true }));
    if (onRouteChange) {
      onRouteChange(parentRoute, subItem.tabKey);
    } else {
      const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
      params.set('route', parentRoute);
      params.set('tab', subItem.tabKey);
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }

    if (onClickCallback) onClickCallback();
  };

  // Active check for sub-items
  const isSubItemActive = (parentRoute: NavRoute, subItem: NavSubItem): boolean => {
    if (activeRoute !== parentRoute) return false;
    const currentTab = searchParams ? searchParams.get('tab') : null;
    if (currentTab) {
      return currentTab === subItem.tabKey;
    }
    const parent = MENU_ITEMS.find((m) => m.id === parentRoute);
    return parent?.defaultTab === subItem.tabKey;
  };

  const NavLinks = ({ onClickCallback }: { onClickCallback?: () => void }) => (
    <nav className="flex flex-col space-y-1">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-salvia-500 dark:text-salvia-400 px-2 pb-1">
        Menu Principal
      </h4>
      {filteredItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeRoute === item.id;
        const hasSubItems = Boolean(item.subItems && item.subItems.length > 0);
        const isExpanded = isRouteExpanded(item.id);

        return (
          <div key={item.id} className="flex flex-col">
            {/* Parent Route Item */}
            <div
              className={`w-full flex items-center justify-between rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-salvia-700 text-white dark:bg-salvia-500 shadow-sm'
                  : 'text-slate-800 dark:text-salvia-200 hover:bg-salvia-100 dark:hover:bg-salvia-800/60'
              }`}
            >
              <button
                type="button"
                onClick={() => handleParentClick(item, onClickCallback)}
                className="flex-1 flex items-center space-x-2.5 px-3 py-2.5 text-left truncate"
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-salvia-600 dark:text-salvia-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>

              {hasSubItems ? (
                <button
                  type="button"
                  aria-label={isExpanded ? `Recolher ${item.label}` : `Expandir ${item.label}`}
                  onClick={(e) => handleToggleExpand(item.id, e)}
                  className={`p-2 mr-1 rounded-lg transition-colors hover:bg-black/10 dark:hover:bg-white/10 ${
                    isActive ? 'text-white' : 'text-salvia-500 dark:text-salvia-400'
                  }`}
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isExpanded ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </button>
              ) : (
                isActive && (
                  <div className="pr-3">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                )
              )}
            </div>

            {/* Collapsible Sublist with smooth CSS Grid rows animation */}
            {hasSubItems && (
              <div
                className={`grid transition-all duration-200 ease-in-out ${
                  isExpanded
                    ? 'grid-rows-[1fr] opacity-100 mt-1 mb-1.5'
                    : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="ml-4 pl-3 border-l-2 border-salvia-200 dark:border-salvia-800 space-y-0.5">
                    {item.subItems!.map((sub) => {
                      const isSubActive = isSubItemActive(item.id, sub);
                      const SubIcon = sub.icon;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleSubItemClick(item.id, sub, onClickCallback)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all text-left ${
                            isSubActive
                              ? 'bg-salvia-100 dark:bg-salvia-800 text-salvia-900 dark:text-salvia-100 font-bold shadow-xs'
                              : 'text-salvia-700 dark:text-salvia-300 hover:text-slate-900 dark:hover:text-salvia-50 hover:bg-salvia-100/60 dark:hover:bg-salvia-800/40 font-medium'
                          }`}
                        >
                          <div className="flex items-center space-x-2 truncate">
                            {SubIcon && (
                              <SubIcon
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  isSubActive ? 'text-salvia-700 dark:text-salvia-300' : 'text-salvia-500 dark:text-salvia-400'
                                }`}
                              />
                            )}
                            <span className="truncate">{sub.label}</span>
                          </div>
                          {isSubActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-salvia-600 dark:bg-salvia-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="pt-2 mt-2 border-t border-salvia-100 dark:border-salvia-800">
        <button
          onClick={logout}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50"
        >
          <div className="flex items-center space-x-2.5">
            <LogOut className="w-4 h-4" />
            <span>Sair do Sistema</span>
          </div>
        </button>
      </div>
    </nav>
  );

  const UserBadge = () => (
    <div className="p-3 bg-salvia-50/70 dark:bg-salvia-950/60 border border-salvia-200 dark:border-salvia-800 rounded-xl flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <ShieldCheck className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
        <div className="flex flex-col text-left">
          <span className="text-xs font-bold text-slate-900 dark:text-salvia-50">{user?.name || 'Usuário'}</span>
          <span className="text-[10px] text-salvia-600 dark:text-salvia-400 font-medium">{perfilAmigavel(role)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Off-Canvas Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Overlay Background */}
          <div
            className="fixed inset-0 bg-salvia-900/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[80vw] h-full bg-white dark:bg-salvia-900 shadow-2xl flex flex-col p-4 animate-slide-in-left overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm font-bold text-salvia-800 dark:text-salvia-200">Menu</span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 bg-salvia-100 dark:bg-salvia-800 text-salvia-600 dark:text-salvia-400 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <UserBadge />
            </div>

            <div className="flex-1">
              <NavLinks onClickCallback={() => setIsMobileMenuOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-4 shadow-sm flex-col shrink-0 sticky top-6">
        <div className="space-y-6">
          <NavLinks />
        </div>
      </aside>
    </>
  );
}
