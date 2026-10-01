import os
import re

with open('frontend/src/components/Sidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix imports
content = content.replace("import React from 'react';", "import React, { useState } from 'react';")
content = content.replace("ShieldCheck,", "ShieldCheck,\n  Menu,\n  X,")

# Identify render block
render_start = content.find("  return (")
if render_start == -1:
    print("Could not find render start")
    exit(1)

new_render = """  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const NavLinks = ({ onClickCallback }: { onClickCallback?: () => void }) => (
    <nav className="flex flex-col space-y-1">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-salvia-500 dark:text-salvia-400 px-2 pb-1">
        Menu Principal
      </h4>
      {filteredItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeRoute === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              onRouteChange(item.id);
              if (onClickCallback) onClickCallback();
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
              isActive
                ? 'bg-salvia-700 text-white dark:bg-salvia-500 shadow-sm'
                : 'text-slate-800 dark:text-salvia-200 hover:bg-salvia-100 dark:hover:bg-salvia-800/60'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-salvia-600 dark:text-salvia-400'}`} />
              <span>{item.label}</span>
            </div>
            {isActive && <ChevronRight className="w-4 h-4" />}
          </button>
        );
      })}
    </nav>
  );

  const UserBadge = () => (
    <div className="p-3 bg-salvia-50/70 dark:bg-salvia-950/60 border border-salvia-200 dark:border-salvia-800 rounded-xl flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <ShieldCheck className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
        <div className="flex flex-col text-left">
          <span className="text-xs font-bold text-slate-900 dark:text-salvia-50">{user?.name || 'Usuário'}</span>
          <span className="text-[10px] text-salvia-600 dark:text-salvia-400 capitalize font-medium">{role}</span>
        </div>
      </div>
      <span className="text-[10px] uppercase font-mono font-bold bg-salvia-700 text-white px-2 py-0.5 rounded-full">
        {role}
      </span>
    </div>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden w-full bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex items-center space-x-2 text-salvia-700 dark:text-salvia-300 bg-salvia-50 dark:bg-salvia-950 px-3 py-2 rounded-xl border border-salvia-200 dark:border-salvia-800"
        >
          <Menu className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider">Navegação</span>
        </button>
        
        <div className="flex-1 ml-4">
          <UserBadge />
        </div>
      </div>

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
            
            <div className="pt-6 mt-6 border-t border-salvia-100 dark:border-salvia-800 text-[10px] font-mono text-salvia-500 dark:text-salvia-400 text-center">
              Escolar ERP • Multi-Tenant
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-4 shadow-sm flex-col justify-between shrink-0 h-[calc(100vh-120px)] sticky top-6 overflow-y-auto">
        <div className="space-y-6">
          <UserBadge />
          <NavLinks />
        </div>

        <div className="pt-3 mt-4 border-t border-salvia-100 dark:border-salvia-800 text-[10px] font-mono text-salvia-500 dark:text-salvia-400 text-center">
          Escolar ERP • Multi-Tenant
        </div>
      </aside>
    </>
  );
}
"""

content = content[:render_start] + new_render

with open('frontend/src/components/Sidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
