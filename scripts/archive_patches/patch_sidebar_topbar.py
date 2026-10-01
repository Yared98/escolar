import os
import re

with open('frontend/src/components/Sidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add useEffect to imports
content = content.replace("import React, { useState } from 'react';", "import React, { useState, useEffect } from 'react';")

# Add useEffect hook right after useState
bad_hook = "  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);"
good_hook = """  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleOpenMenu = () => setIsMobileMenuOpen(true);
    window.addEventListener('open-mobile-menu', handleOpenMenu);
    return () => window.removeEventListener('open-mobile-menu', handleOpenMenu);
  }, []);"""
content = content.replace(bad_hook, good_hook)

# Remove the old mobile top bar
bad_top_bar = """      {/* Mobile Top Bar */}
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
      </div>"""
content = content.replace(bad_top_bar, "")

with open('frontend/src/components/Sidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
