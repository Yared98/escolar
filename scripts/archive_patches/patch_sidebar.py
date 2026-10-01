import os

with open('frontend/src/components/Sidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

bad_nav = '        <nav className="space-y-1">'
good_nav = '        <nav className="flex flex-row lg:flex-col gap-2 lg:gap-0 lg:space-y-1 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">'

content = content.replace(bad_nav, good_nav)

bad_btn = """                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${"""
good_btn = """                className={`w-auto lg:w-full shrink-0 flex items-center justify-between px-4 lg:px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${"""

content = content.replace(bad_btn, good_btn)

bad_h4 = """          <h4 className="text-[10px] font-bold uppercase tracking-wider text-salvia-500 dark:text-salvia-400 px-2 pb-1">
            Menu Principal
          </h4>"""
good_h4 = """          <h4 className="hidden lg:block text-[10px] font-bold uppercase tracking-wider text-salvia-500 dark:text-salvia-400 px-2 pb-1">
            Menu Principal
          </h4>"""

content = content.replace(bad_h4, good_h4)

# Ensure chevron is hidden on mobile inside the nav buttons
bad_chevron = "{isActive && <ChevronRight className=\"w-4 h-4\" />}"
good_chevron = "{isActive && <ChevronRight className=\"hidden lg:block w-4 h-4 ml-2\" />}"

content = content.replace(bad_chevron, good_chevron)

with open('frontend/src/components/Sidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
