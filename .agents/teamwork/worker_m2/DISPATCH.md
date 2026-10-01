## 2026-09-28T13:46:13Z
You are worker_m2, an Implementation Worker for Milestone 2 (Core Sections Refactoring).
Your working directory is: d:/Projetos/escolar/.agents/teamwork/worker_m2
Read the original user request at: d:/Projetos/escolar/.agents/teamwork/ORIGINAL_REQUEST.md
Read the project specifications at: d:/Projetos/escolar/PROJECT.md
Read the section survey report at: d:/Projetos/escolar/.agents/teamwork/survey_explorer_3/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Exclusive write ownership:
- You own: `d:/Projetos/escolar/frontend/src/components/AgendaDigitalSection.tsx`
- You own: `d:/Projetos/escolar/frontend/src/components/SecretariaSection.tsx`
- You MUST NOT edit `Sidebar.tsx`, `page.tsx`, or any other section components.

Your mission:
1. Refactor `AgendaDigitalSection.tsx`:
   - Import `useSearchParams` from `'next/navigation'`.
   - Remove the local `useState` for `activeTab`:
     `const [activeTab, setActiveTab] = useState<'comunicacao' | 'rotina' | 'whatsapp'>('comunicacao');`
   - Read `activeTab` from URL search parameters with fallback to `'comunicacao'`:
     ```typescript
     const searchParams = useSearchParams();
     const tabParam = searchParams ? searchParams.get('tab') : null;
     const activeTab: 'comunicacao' | 'rotina' | 'whatsapp' =
       tabParam === 'rotina' || tabParam === 'whatsapp' ? tabParam : 'comunicacao';
     ```
   - Completely remove the horizontal tab bar (lines 148–184) containing buttons for `comunicacao`, `rotina`, and `whatsapp`.
   - Clean up any unused imports.
2. Refactor `SecretariaSection.tsx`:
   - Import `useSearchParams` from `'next/navigation'`.
   - Remove the local `useState` for `activeTab`:
     `const [activeTab, setActiveTab] = useState<'alunos' | 'turmas' | 'educacenso'>('alunos');`
   - Read `activeTab` from URL search parameters with fallback to `'alunos'`:
     ```typescript
     const searchParams = useSearchParams();
     const tabParam = searchParams ? searchParams.get('tab') : null;
     const activeTab: 'alunos' | 'turmas' = tabParam === 'turmas' ? 'turmas' : 'alunos';
     ```
   - Remove the tab switching buttons (`alunos` and `turmas`) from the top header container (lines 730–754).
   - CRITICAL PRESERVATION INVARIANT: You MUST preserve the contextual action buttons (`+ Nova Matrícula Completa` and `Criar Nova Turma`) rendered inside the header container!
   - Modal internal state (`modalTab`: `dados_aluno`, `responsaveis`, etc.) belongs to the modal dialog lifecycle and must remain unchanged.
3. Verification:
   - Run `npx tsc --noEmit` and `npm run build` inside `frontend/` (both must exit with code 0).
   - Run `python tests/e2e/run_all.py --scan-codebase` to verify AST and test suite pass.
4. Write your completion report in:
   `d:/Projetos/escolar/.agents/teamwork/worker_m2/handoff.md`
Following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
When finished, notify the orchestrator via send_message.
