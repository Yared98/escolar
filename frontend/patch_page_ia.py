import os

with open('src/app/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add dynamic import
new_import = """const PainelEvasao = dynamic(() => import('@/components/PainelEvasao').then(m => m.PainelEvasao), {
  loading: () => <SectionSkeleton />,
  ssr: false,
});
"""

content = content.replace(
    "const CrmSection = dynamic(() => import('@/components/CrmSection').then(m => m.CrmSection), {\n  loading: () => <SectionSkeleton />,\n  ssr: false,\n});",
    "const CrmSection = dynamic(() => import('@/components/CrmSection').then(m => m.CrmSection), {\n  loading: () => <SectionSkeleton />,\n  ssr: false,\n});\n" + new_import
)

# Add route rendering
route_render = """
                  {activeRoute === 'ia_evasao' && <PainelEvasao />}"""

content = content.replace(
    "{activeRoute === 'crm' && <CrmSection />}",
    "{activeRoute === 'crm' && <CrmSection />}" + route_render
)

with open('src/app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
