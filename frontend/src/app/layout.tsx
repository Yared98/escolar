import './globals.css';
import React from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { Header } from '@/components/Header';

export const metadata = {
  title: 'Escolar ERP - Gestão Educacional & Cuidado Pedagógico',
  description: 'Sistema de gestão escolar humanizado com acesso pelo celular e computador',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="light">
      <body className="bg-[#F4F7F4] dark:bg-[#0C120E] text-[#1A261D] dark:text-salvia-50 min-h-screen flex flex-col font-sans selection:bg-salvia-600 selection:text-white transition-colors duration-200 antialiased">
        <ThemeProvider>
          <AuthProvider>
            <Header />
            <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">{children}</main>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
