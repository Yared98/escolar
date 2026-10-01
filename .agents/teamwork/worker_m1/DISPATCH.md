## 2026-09-28T13:05:01Z

You are worker_m1, an Implementation Worker for Milestone 1: Sidebar Navigation & Shell.
Your working directory is: d:/Projetos/escolar/.agents/teamwork/worker_m1
Read the original user request at: d:/Projetos/escolar/.agents/teamwork/ORIGINAL_REQUEST.md
Read the project specifications at: d:/Projetos/escolar/PROJECT.md
Read the survey handoff reports:
- d:/Projetos/escolar/.agents/teamwork/survey_explorer_1/handoff.md
- d:/Projetos/escolar/.agents/teamwork/survey_explorer_2/handoff.md
- d:/Projetos/escolar/.agents/teamwork/survey_explorer_3/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Exclusive write ownership:
- You own: `d:/Projetos/escolar/frontend/src/components/Sidebar.tsx`
- You own: `d:/Projetos/escolar/frontend/src/app/page.tsx`
- You MUST NOT edit `*Section.tsx` files (those belong to Milestones 2 and 3).

Your mission:
1. Refactor `Sidebar.tsx`:
   - Upgrade menu item structure to include nested `subItems` with `tabKey`, `label`, `icon`, and `defaultTab` for routes:
     - `portal_aluno`: boletim, financeiro, diploma, rotina
     - `agenda`: comunicacao, rotina, whatsapp
     - `secretaria`: alunos, turmas
     - `financeiro`: ar, ap, nfse, bi
     - `pedagogico`: disciplinas_matriz, atribuicao_horarios, turmas, projetos, nutricao
     - `academico`: fundamental, infantil
     - `administrativo`: envios, entidades, fornecedores, relatorios
   - Implement collapsible sublists with smooth animations/styling (Tailwind CSS Grid rows transition: `grid-rows-[1fr]` vs `grid-rows-[0fr]`).
   - Implement auto-expansion when parent route is active, plus manual toggle capability via chevron button without switching routes.
   - Synchronize sub-item clicks with URL query parameter `?tab=...` via Next.js `useRouter`, `useSearchParams`, and `usePathname` from `next/navigation`.
   - Update both desktop sidebar and mobile off-canvas drawer (`NavLinks`).
   - Retain full RBAC filtering (`isAllowed`).
2. Update `page.tsx`:
   - Wrap dashboard content/components inside `<React.Suspense fallback={<SectionSkeleton />}>` so that `useSearchParams()` complies with Next.js 14 static generation during `next build`.
   - Ensure `activeRoute` synchronizes smoothly when URL query parameters change (e.g. supporting direct deep links with `?route=...&tab=...`).
3. Verification:
   - Run `npm run build` inside `frontend/` to verify typecheck and production build pass with exit code 0.
   - Verify no build errors or Suspense bailout warnings.
4. Write your completion report in:
   `d:/Projetos/escolar/.agents/teamwork/worker_m1/handoff.md`
Following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
When finished, notify the orchestrator via send_message.
