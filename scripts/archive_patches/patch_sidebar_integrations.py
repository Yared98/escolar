import os

with open('frontend/src/components/Sidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '{canViewCrm && (\n          <li \n            className={`p-2 rounded cursor-pointer ${activeMenu === \'crm\' ? \'bg-blue-800\' : \'hover:bg-blue-700\'}`}\n            onClick={() => setActiveMenu(\'crm\')}\n          >\n            <a className="flex items-center gap-2"><div className="w-4 h-4 bg-purple-400 rounded-full" /> CRM (Matrículas)</a>\n          </li>\n        )}',
    '{canViewCrm && (\n          <li \n            className={`p-2 rounded cursor-pointer ${activeMenu === \'crm\' ? \'bg-blue-800\' : \'hover:bg-blue-700\'}`}\n            onClick={() => setActiveMenu(\'crm\')}\n          >\n            <a className="flex items-center gap-2"><div className="w-4 h-4 bg-purple-400 rounded-full" /> CRM (Matrículas)</a>\n          </li>\n        )}\n\n        {hasFeature(\'module_bank_api\') && (\n          <li \n            className={`p-2 rounded cursor-pointer ${activeMenu === \'integracoes\' ? \'bg-blue-800\' : \'hover:bg-blue-700\'}`}\n            onClick={() => setActiveMenu(\'integracoes\')}\n          >\n            <a className="flex items-center gap-2"><div className="w-4 h-4 bg-green-500 rounded-full" /> Integrações</a>\n          </li>\n        )}'
)

with open('frontend/src/components/Sidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
