'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  encerrarSessao,
  getAccessToken,
  removerCredenciaisLegadas,
  renovarSessao,
  setAccessToken,
} from '@/lib/session';

interface User {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: string;
  /** Indica que o usuário ainda não trocou a senha temporária. */
  deve_trocar_senha?: boolean;
  /** Perfil do login, guardado quando a gestão pré-visualiza o menu de outro perfil. */
  role_original?: string;
  features?: string[];
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  tenant: Tenant | null;
  isOnline: boolean;
  login: (token: string, tenant: Tenant, user: User) => void;
  logout: () => void;
  setTenantId: (tenantId: string) => void;
  switchRole: (newRole: string) => void;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    const handleAuthError = () => {
      setToken(null);
      setUser(null);
      setTenant(null);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('auth_error', handleAuthError);

    // Versões antigas guardavam o token no navegador: apaga e pede novo login uma única vez.
    removerCredenciaisLegadas();

    const savedUser = localStorage.getItem('escolar_user');
    const savedTenant = localStorage.getItem('escolar_tenant');

    if (savedUser && savedTenant) {
      // Dados de exibição aparecem na hora; o token de acesso (só em memória) vem do cookie.
      setUser(JSON.parse(savedUser));
      setTenant(JSON.parse(savedTenant));
      void (async () => {
        const resultado = getAccessToken() ? 'ok' : await renovarSessao();
        if (resultado === 'ok') {
          setToken(getAccessToken());
          void import('@/lib/push').then((m) => m.ensurePushReady()).catch(() => undefined);
        } else if (resultado === 'expirada') {
          window.dispatchEvent(new Event('auth_error'));
          ['escolar_user', 'escolar_tenant', 'escolar_tenant_id'].forEach((k) => localStorage.removeItem(k));
        }
        // 'rede': sem conexão. Mantém o usuário (o Diário offline continua) e renova ao voltar.
      })();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('auth_error', handleAuthError);
    };
  }, []);

  const login = (newToken: string, newTenant: Tenant, newUser: User) => {
    setAccessToken(newToken);
    setToken(newToken);
    setTenant(newTenant);
    setUser(newUser);

    localStorage.setItem('escolar_tenant_id', newTenant.id);
    localStorage.setItem('escolar_tenant', JSON.stringify(newTenant));
    localStorage.setItem('escolar_user', JSON.stringify(newUser));
    void import('@/lib/push').then((m) => m.ensurePushReady()).catch(() => undefined);
  };

  const logout = () => {
    // Revoga a sessão no servidor e apaga o cookie; a aba é limpa sem esperar a resposta.
    void encerrarSessao();

    setToken(null);
    setUser(null);
    setTenant(null);

    localStorage.removeItem('escolar_tenant_id');
    localStorage.removeItem('escolar_tenant');
    localStorage.removeItem('escolar_user');
  };

  const setTenantId = (tenantId: string) => {
    localStorage.setItem('escolar_tenant_id', tenantId);
  };

  const switchRole = (newRole: string) => {
    if (user) {
      const updatedUser = { ...user, role: newRole, role_original: user.role_original ?? user.role };
      setUser(updatedUser);
      localStorage.setItem('escolar_user', JSON.stringify(updatedUser));
    }
  };

  const setUserValue = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('escolar_user', JSON.stringify(newUser));
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        tenant,
        isOnline,
        login,
        logout,
        setTenantId,
        switchRole,
        setUser: setUserValue,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
