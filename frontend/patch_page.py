import os

with open('src/app/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add dynamic import
new_import = """const CalendarioEscolarSection = dynamic(() => import('@/components/CalendarioEscolarSection').then(m => m.CalendarioEscolarSection), {
  loading: () => <SectionSkeleton />,
  ssr: false,
});
"""

content = content.replace(
    "const PortalAlunoSection = dynamic(() => import('@/components/PortalAlunoSection').then(m => m.PortalAlunoSection), {\n  loading: () => <SectionSkeleton />,\n  ssr: false,\n});",
    "const PortalAlunoSection = dynamic(() => import('@/components/PortalAlunoSection').then(m => m.PortalAlunoSection), {\n  loading: () => <SectionSkeleton />,\n  ssr: false,\n});\n" + new_import
)

# Add route rendering
route_render = """
                  {activeRoute === 'calendario' && <CalendarioEscolarSection />}"""

content = content.replace(
    "{activeRoute === 'portal_aluno' && <PortalAlunoSection />}",
    "{activeRoute === 'portal_aluno' && <PortalAlunoSection />}" + route_render
)

with open('src/app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
