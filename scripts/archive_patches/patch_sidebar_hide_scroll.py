import os

with open('frontend/src/components/Sidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

bad = 'className="hidden lg:flex w-64 bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-4 shadow-sm flex-col justify-between shrink-0 h-[calc(100vh-120px)] sticky top-6 overflow-y-auto"'
good = 'className="hidden lg:flex w-64 bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-4 shadow-sm flex-col justify-between shrink-0 h-[calc(100vh-120px)] sticky top-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:\'none\'] [scrollbar-width:\'none\']"'

content = content.replace(bad, good)

with open('frontend/src/components/Sidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
