import os

with open('frontend/src/components/PortalAlunoSection.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

bad = '<div className="border border-salvia-200 dark:border-salvia-800 rounded-2xl overflow-hidden shadow-sm">'
good = '<div className="overflow-x-auto border border-salvia-200 dark:border-salvia-800 rounded-2xl shadow-sm">'
content = content.replace(bad, good)

with open('frontend/src/components/PortalAlunoSection.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
