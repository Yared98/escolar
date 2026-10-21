'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { API_BASE } from '@/lib/session';
import { gerarTema, temaParaVariaveis } from '@/lib/tema';

export interface BrandingState {
  corPrimaria: string;
  corDestaque: string;
  nomeExibicao: string;
  logoSrc: string | null;
}

export interface BrandingContextType {
  branding: BrandingState | null;
  aplicarBranding: (b: BrandingState) => void;
  recarregarBranding: () => Promise<void>;
}

interface TenantBrandingResponse {
  cor_primaria: string;
  cor_destaque: string;
  nome_exibicao: string;
  tem_logo: boolean;
  logo_url: string | null;
  atualizado_em: string | null;
}

interface PublicBrandingResponse {
  cor_primaria: string;
  cor_destaque: string;
  nome_exibicao: string;
  logo_url: string | null;
}

function resolverLogoUrl(caminho: string): string {
  const base = API_BASE.replace(/\/$/, '');
  const path = caminho.replace(/^\/api\/v1/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { tenant } = useAuth();
  const [branding, setBranding] = useState<BrandingState | null>(null);

  const aplicarBranding = useCallback((b: BrandingState) => {
    try {
      const vars = temaParaVariaveis({ corPrimaria: b.corPrimaria, corDestaque: b.corDestaque });
      const temaGerado = gerarTema({ corPrimaria: b.corPrimaria, corDestaque: b.corDestaque });

      if (typeof document !== 'undefined') {
        for (const [chave, valor] of Object.entries(vars)) {
          document.documentElement.style.setProperty(chave, valor);
        }

        let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
        if (!meta) {
          meta = document.createElement('meta');
          meta.name = 'theme-color';
          document.head.appendChild(meta);
        }
        meta.content = temaGerado.brand[700];

        document.title = `${b.nomeExibicao} - Gestão escolar`;
      }

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('escolar_branding', JSON.stringify(b));
          localStorage.setItem('escolar_branding_vars', JSON.stringify(vars));
        } catch {
          // localStorage indisponível
        }
      }

      setBranding(b);
    } catch (err) {
      // Cor inválida (temaParaVariaveis lança) → ignorar e manter o padrão, sem quebrar.
      console.warn('Cores de branding inválidas:', err);
    }
  }, []);

  // Ao montar: aplicar o cache de escolar_branding, se houver.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const cached = localStorage.getItem('escolar_branding');
      if (cached) {
        const parsed = JSON.parse(cached) as BrandingState;
        if (parsed?.corPrimaria && parsed?.corDestaque) {
          aplicarBranding(parsed);
        }
      }
    } catch {
      // Ignora erro ao ler cache
    }
  }, [aplicarBranding]);

  const recarregarBranding = useCallback(async () => {
    if (tenant?.id) {
      try {
        const res = await apiFetch<TenantBrandingResponse>('/tenant/branding');
        let logoSrc: string | null = null;
        if (res.tem_logo && tenant.slug) {
          const vMatch = res.logo_url?.match(/\?v=[^&]+/);
          const query = vMatch
            ? vMatch[0]
            : res.atualizado_em
              ? `?v=${Math.floor(new Date(res.atualizado_em).getTime() / 1000)}`
              : '';
          const caminho = `/public/branding/${encodeURIComponent(tenant.slug)}/logo${query}`;
          logoSrc = resolverLogoUrl(caminho);
        }
        aplicarBranding({
          corPrimaria: res.cor_primaria,
          corDestaque: res.cor_destaque,
          nomeExibicao: res.nome_exibicao,
          logoSrc,
        });
      } catch (err) {
        console.warn('Falha ao carregar branding do tenant:', err);
      }
    } else {
      const slug = process.env.NEXT_PUBLIC_ESCOLA_SLUG?.trim();
      if (slug) {
        try {
          const res = await fetch(`${API_BASE}/public/branding/${encodeURIComponent(slug)}`);
          if (res.ok) {
            const data = (await res.json()) as PublicBrandingResponse;
            const logoSrc = data.logo_url ? resolverLogoUrl(data.logo_url) : null;
            aplicarBranding({
              corPrimaria: data.cor_primaria,
              corDestaque: data.cor_destaque,
              nomeExibicao: data.nome_exibicao,
              logoSrc,
            });
          } else {
            console.warn(`Branding público não encontrado para slug "${slug}" (HTTP ${res.status})`);
          }
        } catch (err) {
          console.warn('Falha ao carregar branding público:', err);
        }
      }
    }
  }, [tenant?.id, tenant?.slug, aplicarBranding]);

  // Refazer quando tenant?.id mudar
  useEffect(() => {
    void recarregarBranding();
  }, [recarregarBranding]);

  return (
    <BrandingContext.Provider value={{ branding, aplicarBranding, recarregarBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextType {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}
