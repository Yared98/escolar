'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { perfilAmigavel } from '@/lib/perfis';
import { apiFetch } from '@/lib/api';
import {
  Wifi,
  WifiOff,
  Sprout,
  User as UserIcon,
  LogOut,
  Menu,
  Sun,
  Moon,
  Bell,
  Shield,
} from 'lucide-react';

interface NotificacaoItem {
  id: string;
  modulo: string;
  titulo: string;
  mensagem: string;
  prioridade: string;
  lida: boolean;
  canal_disparo: string;
  created_at: string;
}

export function Header() {
  const { user, tenant, isOnline, logout, switchRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const role = user?.role || 'admin';

  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const loadNotificacoes = async () => {
    try {
      const items = await apiFetch<NotificacaoItem[]>('/notificacoes');
      setNotificacoes(items);
    } catch {
      setNotificacoes([]);
    }
  };

  useEffect(() => {
    if (user) {
      loadNotificacoes();
    }
  }, [user]);

  useEffect(() => {
    const onMsg = () => {
      void loadNotificacoes();
    };
    window.addEventListener('escolar:mensagem_nova', onMsg);
    return () => window.removeEventListener('escolar:mensagem_nova', onMsg);
  }, []);

  const handleMarcarTodasLidas = async () => {
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
  };

  const unreadCount = notificacoes.filter((n) => !n.lida).length;

  return (
    <header className="bg-white dark:bg-salvia-900 border-b border-salvia-200 dark:border-salvia-800 px-4 sm:px-8 py-3 flex items-center justify-between shadow-sm transition-colors duration-200">
      {/* Brand & Tenant Selector */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-salvia-100 dark:bg-salvia-800 rounded-xl text-salvia-700 dark:text-salvia-300">
            <Sprout className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="leading-tight font-bold text-lg text-slate-900 dark:text-salvia-50 tracking-tight">
              Escolar ERP
            </span>
            <span className="text-[11px] text-salvia-600 dark:text-salvia-400 font-normal leading-none">
              Gestão escolar humanizada
            </span>
          </div>
        </div>

        {tenant && (
          <div className="hidden md:flex items-center bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 px-3 py-1 rounded-lg text-xs">
            <span className="text-salvia-600 dark:text-salvia-400 mr-1.5 font-medium">Unidade:</span>
            <span className="font-semibold text-slate-900 dark:text-salvia-50">{tenant.name}</span>
          </div>
        )}
      </div>

      {/* Actions: RBAC Simulator, Notifications, Theme Switcher & Profile */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Pré-visualização de menu (apenas gestão/admin) */}
        {user && /^(admin|superadmin|gestor|gestorescolar)$/i.test(role) && (
          <div className="hidden md:flex items-center space-x-1.5 bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 px-2.5 py-1 rounded-xl">
            <Shield className="w-3.5 h-3.5 text-salvia-600 dark:text-salvia-400" />
            <span className="text-[11px] font-medium text-salvia-600 dark:text-salvia-400">Pré-visualizar menu de:</span>
            <select
              title="Pré-visualiza o menu deste perfil nesta tela. O acesso no servidor continua o do login."
              value={(() => {
                const known = ['admin', 'financeiro', 'professor', 'nutricionista', 'responsavel'];
                if (known.includes(role)) return role;
                const raw = (role || '').toLowerCase().replace(/[^a-z]/g, '');
                if (raw === 'tesouraria') return 'financeiro';
                if (raw === 'pai' || raw === 'mae') return 'responsavel';
                return 'admin';
              })()}
              onChange={(e) => switchRole(e.target.value)}
              className="bg-transparent text-xs text-slate-900 dark:text-salvia-50 font-bold focus:outline-none cursor-pointer"
            >
              <option value="admin">Gestão</option>
              <option value="financeiro">Financeiro</option>
              <option value="professor">Professor(a)</option>
              <option value="nutricionista">Nutrição</option>
              <option value="responsavel">Família</option>
            </select>
          </div>
        )}

        {/* Central de Notificações Unificada */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="relative p-2 rounded-xl bg-salvia-50 dark:bg-salvia-950 text-salvia-700 dark:text-salvia-300 hover:bg-salvia-100 dark:hover:bg-salvia-800 border border-salvia-200 dark:border-salvia-800 transition-all flex items-center justify-center"
              title="Central de Notificações Unificada"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Popover */}
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl shadow-xl z-50 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-salvia-100 dark:border-salvia-800 pb-2">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-salvia-50 flex items-center space-x-1.5">
                    <Bell className="w-3.5 h-3.5 text-salvia-600 dark:text-salvia-400" />
                    <span>Central de Notificações Unificada</span>
                  </h3>
                  <button
                    onClick={handleMarcarTodasLidas}
                    className="text-[10px] text-salvia-600 dark:text-salvia-400 hover:text-salvia-900 dark:hover:text-salvia-100 font-bold"
                  >
                    Marcar lidas
                  </button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {notificacoes.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border text-xs space-y-1 transition-all ${
                        item.prioridade === 'urgente'
                          ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-500/30 text-rose-900 dark:text-rose-200'
                          : 'bg-salvia-50/60 dark:bg-salvia-950/50 border-salvia-200 dark:border-salvia-800 text-slate-800 dark:text-salvia-200'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span>{item.titulo}</span>
                        {!item.lida && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-salvia-700 dark:text-salvia-300">{item.mensagem}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-salvia-100 dark:border-salvia-800 flex justify-end items-center text-[10px]">
                  <button onClick={() => setShowDropdown(false)} className="text-salvia-500 font-bold">
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Light / Dark Mode Switcher Button */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
          className="px-3 py-1.5 rounded-xl bg-salvia-50 dark:bg-salvia-950 text-salvia-700 dark:text-salvia-300 hover:bg-salvia-100 dark:hover:bg-salvia-800 border border-salvia-200 dark:border-salvia-800 transition-all flex items-center space-x-2 text-xs font-semibold"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Modo Claro</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-salvia-700" />
              <span className="hidden sm:inline">Modo Escuro</span>
            </>
          )}
        </button>

        {/* PWA Connection Badge */}
        <div
          className={`hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
            isOnline
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-300'
              : 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300 animate-pulse'
          }`}
        >
          {isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Sem internet</span>
            </>
          )}
        </div>

        {user ? (
          <div className="flex items-center space-x-3 border-l border-salvia-200 dark:border-salvia-800 pl-3 sm:pl-4">
            <div className="hidden sm:flex flex-col text-right leading-tight">
              <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-salvia-50">{user.name}</span>
              <span className="text-[11px] text-salvia-700 dark:text-salvia-300 font-medium">{perfilAmigavel(role)}</span>
            </div>

            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-mobile-menu'))}
              title="Menu de Navegação"
              className="lg:hidden p-2 text-salvia-500 hover:text-salvia-700 dark:text-salvia-400 dark:hover:text-salvia-200 hover:bg-salvia-100 dark:hover:bg-salvia-800 rounded-xl transition-colors"
            >
              <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-xs text-salvia-500 dark:text-salvia-400">
            <UserIcon className="w-4 h-4" />
            <span>Visitante</span>
          </div>
        )}
      </div>
    </header>
  );
}
