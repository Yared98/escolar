import os

with open('src/app/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add dynamic import
new_import = """const CrmSection = dynamic(() => import('@/components/CrmSection').then(m => m.CrmSection), {
  loading: () => <SectionSkeleton />,
  ssr: false,
});
"""

content = content.replace(
    "const CalendarioEscolarSection = dynamic(() => import('@/components/CalendarioEscolarSection').then(m => m.CalendarioEscolarSection), {\n  loading: () => <SectionSkeleton />,\n  ssr: false,\n});",
    "const CalendarioEscolarSection = dynamic(() => import('@/components/CalendarioEscolarSection').then(m => m.CalendarioEscolarSection), {\n  loading: () => <SectionSkeleton />,\n  ssr: false,\n});\n" + new_import
)

# Add route rendering
route_render = """
                  {activeRoute === 'crm' && <CrmSection />}"""

content = content.replace(
    "{activeRoute === 'calendario' && <CalendarioEscolarSection />}",
    "{activeRoute === 'calendario' && <CalendarioEscolarSection />}" + route_render
)

with open('src/app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
