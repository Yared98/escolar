'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface User {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: string;
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
  login: (token: string, tenant: Tenant, user: User, refreshToken?: string) => void;
  logout: () => void;
  setTenantId: (tenantId: string) => void;
  switchRole: (newRole: string) => void;
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
      localStorage.removeItem('escolar_refresh_token');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('auth_error', handleAuthError);

    const savedToken = localStorage.getItem('escolar_jwt_token');
    const savedUser = localStorage.getItem('escolar_user');
    const savedTenant = localStorage.getItem('escolar_tenant');

    if (savedToken && savedUser && savedTenant) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      setTenant(JSON.parse(savedTenant));
      void import('@/lib/push').then((m) => m.ensurePushReady()).catch(() => undefined);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('auth_error', handleAuthError);
    };
  }, []);

  const login = (newToken: string, newTenant: Tenant, newUser: User, refreshToken?: string) => {
    setToken(newToken);
    setTenant(newTenant);
    setUser(newUser);

    localStorage.setItem('escolar_jwt_token', newToken);
    localStorage.setItem('escolar_tenant_id', newTenant.id);
    localStorage.setItem('escolar_tenant', JSON.stringify(newTenant));
    localStorage.setItem('escolar_user', JSON.stringify(newUser));
    if (refreshToken) {
      localStorage.setItem('escolar_refresh_token', refreshToken);
    }
    void import('@/lib/push').then((m) => m.ensurePushReady()).catch(() => undefined);
  };

  const logout = () => {
    const currentToken = localStorage.getItem('escolar_jwt_token');
    const refreshToken = localStorage.getItem('escolar_refresh_token');
    const tenantId = localStorage.getItem('escolar_tenant_id');
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

    if (currentToken && tenantId) {
      void fetch(`${apiBase}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${currentToken}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => undefined);
    }

    setToken(null);
    setUser(null);
    setTenant(null);

    localStorage.removeItem('escolar_jwt_token');
    localStorage.removeItem('escolar_refresh_token');
    localStorage.removeItem('escolar_tenant_id');
    localStorage.removeItem('escolar_tenant');
    localStorage.removeItem('escolar_user');
  };

  const setTenantId = (tenantId: string) => {
    localStorage.setItem('escolar_tenant_id', tenantId);
  };

  const switchRole = (newRole: string) => {
    if (user) {
      const updatedUser = { ...user, role: newRole };
      setUser(updatedUser);
      localStorage.setItem('escolar_user', JSON.stringify(updatedUser));
    }
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
