import os

with open('frontend/src/components/Header.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add Menu to lucide imports
content = content.replace('LogOut,', 'LogOut,\n  Menu,')

# Add Menu button next to LogOut
bad_logout = """            <button
              onClick={logout}
              title="Sair do sistema"
              className="p-2 text-salvia-500 hover:text-rose-600 dark:text-salvia-400 dark:hover:text-rose-400 hover:bg-salvia-100 dark:hover:bg-salvia-800 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>"""
            
good_logout = """            <button
              onClick={logout}
              title="Sair do sistema"
              className="p-2 text-salvia-500 hover:text-rose-600 dark:text-salvia-400 dark:hover:text-rose-400 hover:bg-salvia-100 dark:hover:bg-salvia-800 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-mobile-menu'))}
              title="Menu de Navegação"
              className="lg:hidden p-2 text-salvia-500 hover:text-salvia-700 dark:text-salvia-400 dark:hover:text-salvia-200 hover:bg-salvia-100 dark:hover:bg-salvia-800 rounded-xl transition-colors"
            >
              <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>"""

content = content.replace(bad_logout, good_logout)

with open('frontend/src/components/Header.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
