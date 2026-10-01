import os

with open('frontend/src/components/Header.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

bad_logout_btn = """            <button
              onClick={logout}
              title="Sair do sistema"
              className="p-2 text-salvia-500 hover:text-rose-600 dark:text-salvia-400 dark:hover:text-rose-400 hover:bg-salvia-100 dark:hover:bg-salvia-800 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>"""

content = content.replace(bad_logout_btn, "")

with open('frontend/src/components/Header.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
