import './globals.css';
import React from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { BrandingProvider } from '@/context/BrandingContext';
import { Header } from '@/components/Header';

export const metadata = {
  title: 'Escolar - Gestão escolar',
  description: 'Sistema de gestão escolar humanizado com acesso pelo celular e computador',
  manifest: '/manifest.json',
};

const antiFlashScript = `try{var t=localStorage.getItem('escolar_theme');if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.classList.remove('light');}else if(t==='light'){document.documentElement.classList.add('light');document.documentElement.classList.remove('dark');}var v=localStorage.getItem('escolar_branding_vars');if(v){var vars=JSON.parse(v);for(var k in vars){document.documentElement.style.setProperty(k,vars[k]);}}}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: antiFlashScript }} />
      </head>
      <body className="bg-canvas dark:bg-canvas-dark text-ink dark:text-salvia-50 min-h-screen flex flex-col font-sans selection:bg-salvia-600 selection:text-white transition-colors duration-200 antialiased">
        <ThemeProvider>
          <AuthProvider>
            <BrandingProvider>
              <Header />
              <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">{children}</main>
            </BrandingProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
