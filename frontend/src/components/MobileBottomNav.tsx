'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Users,
  DollarSign,
  ArrowDownLeft,
  Send,
  BookOpen,
  Megaphone,
  MessageSquare,
  FileText,
  Baby,
  Utensils,
  CalendarDays,
  CalendarCheck,
  Menu,
  LucideIcon,
} from 'lucide-react';
import type { NavRoute } from '@/components/Sidebar';
import { isRouteAllowed } from '@/components/Sidebar';

export interface MobileShortcut {
  id: string;
  label: string;
  icon: LucideIcon;
  route: NavRoute;
  tab?: string;
}

export const getMobileShortcuts = (role?: string): MobileShortcut[] => {
  const normalized = (role || '').toLowerCase().replace(/[^a-z]/g, '');

  switch (normalized) {
    case 'professor':
      return [
        { id: 'prof-hoje', label: 'Meu dia', icon: CalendarCheck, route: 'professor', tab: 'hoje' },
        { id: 'prof-chamada', label: 'Chamada', icon: BookOpen, route: 'academico' },
        { id: 'prof-notas', label: 'Notas', icon: FileText, route: 'professor', tab: 'notas' },
        { id: 'prof-recados', label: 'Recados', icon: MessageSquare, route: 'agenda', tab: 'comunicacao' },
      ];
    case 'gestor':
    case 'admin':
    case 'superadmin':
    case 'gestorescolar':
      return [
        { id: 'adm-overview', label: 'Painel', icon: LayoutDashboard, route: 'overview' },
        { id: 'adm-alunos', label: 'Alunos', icon: Users, route: 'secretaria', tab: 'alunos' },
        { id: 'adm-financeiro', label: 'Financeiro', icon: DollarSign, route: 'financeiro', tab: 'ar' },
        { id: 'adm-recados', label: 'Recados', icon: MessageSquare, route: 'agenda', tab: 'comunicacao' },
      ];
    case 'secretaria':
      return [
        { id: 'sec-overview', label: 'Painel', icon: LayoutDashboard, route: 'overview' },
        { id: 'sec-alunos', label: 'Alunos', icon: Users, route: 'secretaria', tab: 'alunos' },
        { id: 'sec-turmas', label: 'Turmas', icon: BookOpen, route: 'secretaria', tab: 'turmas' },
        { id: 'sec-crm', label: 'Captação', icon: Megaphone, route: 'crm' },
      ];
    case 'financeiro':
    case 'tesouraria':
      return [
        { id: 'fin-overview', label: 'Painel', icon: LayoutDashboard, route: 'overview' },
        { id: 'fin-ar', label: 'Faturas', icon: ArrowDownLeft, route: 'financeiro', tab: 'ar' },
        { id: 'fin-cobranca', label: 'Cobrança', icon: Send, route: 'financeiro', tab: 'cobranca' },
        { id: 'fin-contratos', label: 'Contratos', icon: FileText, route: 'secretaria', tab: 'contratos' },
      ];
    case 'responsavel':
    case 'pai':
    case 'mae':
      return [
        { id: 'resp-boletim', label: 'Boletim', icon: FileText, route: 'portal_aluno', tab: 'portal_boletim' },
        { id: 'resp-financeiro', label: 'Mensalidades', icon: DollarSign, route: 'portal_aluno', tab: 'portal_financeiro' },
        { id: 'resp-recados', label: 'Recados', icon: MessageSquare, route: 'agenda', tab: 'comunicacao' },
        { id: 'resp-rotina', label: 'Rotina', icon: Baby, route: 'portal_aluno', tab: 'portal_rotina' },
      ];
    case 'nutricionista':
      return [
        { id: 'nut-overview', label: 'Painel', icon: LayoutDashboard, route: 'overview' },
        { id: 'nut-cardapio', label: 'Cardápio', icon: Utensils, route: 'nutricao', tab: 'nutricao' },
        { id: 'nut-calendario', label: 'Calendário', icon: CalendarDays, route: 'calendario' },
      ];
    default:
      return [
        { id: 'default-overview', label: 'Painel', icon: LayoutDashboard, route: 'overview' },
        { id: 'default-recados', label: 'Recados', icon: MessageSquare, route: 'agenda', tab: 'comunicacao' },
      ];
  }
};

interface MobileBottomNavProps {
  activeRoute: NavRoute;
  onRouteChange: (route: NavRoute, targetTab?: string) => void;
}

export function MobileBottomNav({ activeRoute, onRouteChange }: MobileBottomNavProps) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const role = user?.role || 'admin';
  const currentTab = searchParams?.get('tab') || undefined;

  const allShortcuts = getMobileShortcuts(role);
  const shortcuts = allShortcuts.filter((s) => isRouteAllowed(s.route, role));

  const isActive = (s: MobileShortcut) => {
    if (activeRoute !== s.route) return false;
    if (s.tab) return currentTab === s.tab;
    return true;
  };

  const handleOpenMenu = () => {
    window.dispatchEvent(new CustomEvent('open-mobile-menu'));
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-salvia-900/95 border-t border-salvia-200 dark:border-salvia-800 backdrop-blur-sm"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around">
        {shortcuts.map((s) => {
          const Icon = s.icon;
          const active = isActive(s);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onRouteChange(s.route, s.tab)}
              className={`flex-1 flex flex-col items-center justify-center min-h-[48px] py-1.5 transition-all ${
                active
                  ? 'text-salvia-700 dark:text-salvia-300 bg-salvia-100 dark:bg-salvia-800'
                  : 'text-salvia-500 dark:text-salvia-400 hover:bg-salvia-50 dark:hover:bg-salvia-800/60'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5px]' : ''}`} />
              <span className="text-[10px] font-bold mt-0.5 leading-none">{s.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={handleOpenMenu}
          className="flex-1 flex flex-col items-center justify-center min-h-[48px] py-1.5 text-salvia-500 dark:text-salvia-400 hover:bg-salvia-50 dark:hover:bg-salvia-800/60 transition-all"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-0.5 leading-none">Menu</span>
        </button>
      </div>
    </nav>
  );
}
