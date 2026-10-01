# Handoff Report: Architecture & Routing Survey

## 1. Observation

### 1.1 Project Structure & Build Configuration
- **Root directory layout**: `d:/Projetos/escolar` contains `backend/` (Rust application with `Cargo.toml`), `frontend/` (React/Next.js application), and `scripts/` (Python simulation/validation scripts).
- **Frontend package definition (`d:/Projetos/escolar/frontend/package.json`)**:
  - Name: `"escolar-frontend-pwa"`, version `"0.1.0"`.
  - Dependencies: `"next": "^14.2.0"`, `"react": "^18.3.0"`, `"react-dom": "^18.3.0"`, `"lucide-react": "^0.378.0"`, `"clsx": "^2.1.1"`, `"tailwind-merge": "^2.3.0"`, `"dexie": "^4.0.0"`, `"next-pwa": "^5.6.0"`.
  - DevDependencies: `"typescript": "^5.4.5"`, `"tailwindcss": "^3.4.3"`, `"postcss": "^8.4.38"`, `"autoprefixer": "^10.4.19"`, `"@types/react": "^18.3.0"`.
  - Scripts:
    ```json
    "scripts": {
      "dev": "next dev",
      "build": "next build",
      "start": "next start",
      "lint": "next lint"
    }
    ```
- **Discrepancy with Initial Request**: The user request hypothesized Vite, React Router, `App.tsx`, and `main.tsx`. In reality, the project is a **Next.js 14 App Router** application. There is **no Vite, no React Router, no `App.tsx`, and no `main.tsx`**.
- **TypeScript & Build Verification**:
  - Command: `npx tsc --noEmit` inside `frontend/` runs without errors (exit code 0).
  - Command: `npm run build` (`next build 14.2.35`) succeeds (exit code 0), prerendering `/` and `/_not-found` statically.
  - Command: `npm run lint` prompts interactively because no `.eslintrc.json` file is present in `frontend/`.

### 1.2 Layout & Sidebar Mounting
- **Root Layout (`d:/Projetos/escolar/frontend/src/app/layout.tsx`)**:
  - Lines 18-28:
    ```tsx
    export default function RootLayout({ children }: { children: React.ReactNode }) {
      return (
        <html lang="pt-BR" className="light">
          <body className="...">
            <ThemeProvider>
              <AuthProvider>
                <Header />
                <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">{children}</main>
              </AuthProvider>
            </ThemeProvider>
          </body>
        </html>
      );
    }
    ```
  - The `Sidebar` component is **not** mounted in `RootLayout`.
- **Page & Dashboard Entry Point (`d:/Projetos/escolar/frontend/src/app/page.tsx`)**:
  - `HomePage` is a client component (`'use client'`).
  - Lines 82: `const [activeRoute, setActiveRoute] = useState<NavRoute>('overview');`
  - Lines 198-204:
    ```tsx
    {user ? (
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Sidebar Navigation */}
        <Sidebar activeRoute={activeRoute} onRouteChange={setActiveRoute} />

        {/* Main Content Area */}
        <div className="flex-1 w-full space-y-6">
    ```
  - Lines 226-239: Active section is rendered conditionally based on `activeRoute`:
    ```tsx
    {activeRoute === 'overview' && <OverviewDashboard onRouteChange={setActiveRoute} />}
    {activeRoute === 'secretaria' && <SecretariaSection />}
    {activeRoute === 'financeiro' && <FinanceiroSection />}
    {activeRoute === 'pedagogico' && <PedagocioNutricaoSection />}
    {activeRoute === 'academico' && <AcademicoSection />}
    {activeRoute === 'administrativo' && <AdministrativoSection />}
    {activeRoute === 'agenda' && <AgendaDigitalSection />}
    {activeRoute === 'portal_aluno' && <PortalAlunoSection />}
    {activeRoute === 'calendario' && <CalendarioEscolarSection />}
    {activeRoute === 'crm' && <CrmSection />}
    {activeRoute === 'ia_evasao' && <PainelEvasao />}
    ```

### 1.3 Sidebar Structure (`d:/Projetos/escolar/frontend/src/components/Sidebar.tsx`)
- Lines 24-35: Defines `NavRoute` union:
  `'overview' | 'secretaria' | 'financeiro' | 'pedagogico' | 'academico' | 'administrativo' | 'agenda' | 'portal_aluno' | 'calendario' | 'crm' | 'ia_evasao'`.
- Lines 77-89: Defines flat menu items:
  `menuItems` contains 11 entries without any child sub-items or collapsible nested structures.
- Lines 101-143: `NavLinks` renders a flat list of `<button>` elements calling `onRouteChange(item.id)`.
- Lines 165-198: Mobile off-canvas drawer also renders `<NavLinks />`.
- Lines 201-209: Desktop `<aside className="hidden lg:flex w-64 ...">` renders `<NavLinks />`.

### 1.4 Tab Switch State & Horizontal Tab Bars in Section Components
Across the components in `frontend/src/components/`, seven section components currently maintain local `useState` for tabs and display horizontal tab bars:

1. **`AgendaDigitalSection.tsx`**:
   - Tab state (line 45): `const [activeTab, setActiveTab] = useState<'comunicacao' | 'rotina' | 'whatsapp'>('comunicacao');`
   - Horizontal tab bar (lines 148-184): Buttons for `'comunicacao'` ("Mensagens & Mural"), `'rotina'` ("Resumo de Rotina"), and `'whatsapp'` ("WhatsApp (Transbordo)").
   - Content condition checks: lines 187, 256, 327.
2. **`SecretariaSection.tsx`**:
   - Tab state (line 48): `const [activeTab, setActiveTab] = useState<'alunos' | 'turmas' | 'educacenso'>('alunos');`
   - Horizontal tab bar (lines 730-777): Buttons for `'alunos'` ("Alunos & Matrículas") and `'turmas'` ("Turmas & Ensalamento").
   - Action buttons: In the same container (lines 755-776), `+ Nova Matrícula Completa` and `Criar Nova Turma` are rendered conditionally.
   - Content condition checks: lines 781, 1060.
3. **`FinanceiroSection.tsx`**:
   - Tab state (line 57): `const [activeSubTab, setActiveSubTab] = useState<'ar' | 'ap' | 'nfse' | 'bi' | 'conciliacao'>('ar');`
   - Horizontal tab bar (lines 411-459): Buttons for `'ar'` ("Faturas & Mensalidades (AR)"), `'ap'` ("Despesas & Fornecedores (AP)"), `'nfse'` ("NFS-e Automatizada"), `'bi'` ("Demonstrativo DRE & DFC").
   - Content condition checks: lines 462, 576, 637, 655.
4. **`PedagocioNutricaoSection.tsx`**:
   - Tab state (lines 124-126): `const [activeTab, setActiveTab] = useState<'disciplinas_matriz' | 'atribuicao_horarios' | 'turmas' | 'projetos' | 'nutricao' | 'tri'>('disciplinas_matriz');`
   - Horizontal tab bar (lines 559-619): Buttons for `'disciplinas_matriz'`, `'atribuicao_horarios'`, `'turmas'`, `'projetos'`, `'nutricao'`.
   - Content condition checks: lines 650, 703, 869, 995, 1050, 1089.
5. **`AdministrativoSection.tsx`**:
   - Tab state (line 40): `const [subTab, setSubTab] = useState<'entidades' | 'fornecedores' | 'relatorios' | 'envios' | 'lms_config'>('envios');`
   - Horizontal tab bar (lines 194-242): Buttons for `'envios'`, `'entidades'`, `'fornecedores'`, `'relatorios'`.
   - Content condition checks: lines 246, 306, 350, 391.
6. **`AcademicoSection.tsx`**:
   - Tab state (line 49): `const [viewMode, setViewMode] = useState<'fundamental' | 'infantil'>('fundamental');`
   - Horizontal tab bar (lines 460-488): Buttons for `'fundamental'`, `'infantil'`.
   - Content condition checks: lines 503, 739.
7. **`PortalAlunoSection.tsx`**:
   - Tab state (line 97): `const [activeTab, setActiveTab] = useState<'boletim' | 'financeiro' | 'diploma' | 'rotina' | 'portfolio'>('boletim');`
   - Horizontal tab bar (lines 292-344): Buttons for `'boletim'`, `'financeiro'`, `'diploma'`, `'rotina'`.
   - Content condition checks: lines 359, 483, 615, 687.

### 1.5 Test Setup & Scripts
- No Vitest, Jest, or testing libraries are installed in `frontend/package.json`.
- There are no `*.test.tsx` or `*.spec.tsx` files inside `frontend/src`.
- In `scripts/`, `python scripts/validate_frontend_core_ui.py` tests AuthContext, LocalStorage, ThemeContext, apiFetch, offline PWA, and RBAC benchmarking, completing with code 0.

---

## 2. Logic Chain

1. **Routing Mechanism Deduction**:
   - Observation 1.1 & 1.2 show that the frontend is a Next.js 14 App Router application where all views live under route `/` in `src/app/page.tsx`.
   - The active view is currently governed by `activeRoute` in `page.tsx` state rather than path routes (`/secretaria`, `/agenda`).
   - Therefore, URL state management for both routes and tabs must be achieved through **URL search parameters** (e.g. `?route=agenda&tab=rotina` or `?tab=rotina`) using Next.js App Router's `useSearchParams` and `useRouter` from `'next/navigation'`.

2. **Sidebar Submenu Architecture**:
   - Observation 1.3 shows `Sidebar.tsx` renders a single flat list of routes.
   - Observation 1.4 catalogs the 7 sections with distinct internal sub-tabs.
   - To satisfy Requirement R1 ("Migrate local tabs to Sidebar submenus as collapsible nested sublists"), `Sidebar.tsx` must be refactored to associate sub-items with each applicable route:
     - `agenda`: `comunicacao` ("Mensagens & Mural"), `rotina` ("Resumo de Rotina"), `whatsapp` ("WhatsApp (Transbordo)").
     - `secretaria`: `alunos` ("Alunos & Matrículas"), `turmas` ("Turmas & Ensalamento").
     - `financeiro`: `ar` ("Faturas & Mensalidades (AR)"), `ap` ("Despesas & Fornecedores (AP)"), `nfse` ("NFS-e Automatizada"), `bi` ("Demonstrativo DRE & DFC").
     - (And optionally `pedagogico`, `administrativo`, `academico`, `portal_aluno`).
   - A collapsible mechanism (e.g. tracking open parent menus or automatically opening when `activeRoute === item.id`) with visual indicators (`ChevronDown`/`ChevronRight`) will present the sub-items.

3. **URL State Synchronization & Query Parameter Handling**:
   - Observation 1.1 & 1.4 show that section components currently use local `useState` for tabs.
   - When a user clicks a sub-item in `Sidebar`:
     1. It triggers `onRouteChange(item.id)` to ensure the parent section is mounted.
     2. It updates the URL search param `?tab=<subItemId>` using `router.push(`${pathname}?tab=${subItemId}`, { scroll: false })` or `window.history.pushState`.
   - In each section component (e.g., `AgendaDigitalSection`, `SecretariaSection`, `FinanceiroSection`):
     - Replace `useState` with `const searchParams = useSearchParams(); const activeTab = searchParams.get('tab') || '<defaultTab>';`.
     - This satisfies Requirement R2 and removes local tab state.

4. **Next.js 14 Build & Suspense Safety**:
   - In Next.js 14 App Router, static page prerendering (`next build`) analyzes client components that call `useSearchParams()`.
   - If any component uses `useSearchParams()` without a wrapping `<Suspense>` boundary, `next build` fails with `Missing Suspense boundary with useSearchParams`.
   - Therefore, wrapping the dashboard content or `HomePage` in `<React.Suspense fallback={<SectionSkeleton />}>` in `src/app/page.tsx` is required to ensure `npm run build` succeeds cleanly.

5. **UI Cleanup in Section Components**:
   - Observation 1.4 identifies exact lines in the section components where horizontal tab bars are rendered.
   - Removing those horizontal buttons fulfills Requirement R3 ("Remove redundant UI").
   - Crucial detail in `SecretariaSection.tsx`: Action buttons (`+ Nova Matrícula Completa` and `Criar Nova Turma`) share the tab bar container (lines 755-776); these action buttons must be preserved in the header while removing only the tab selection buttons (`alunos` and `turmas`).

---

## 3. Caveats

1. **Next.js App Router vs. React Router Assumption**:
   - The original user prompt mentioned `App.tsx`, `main.tsx`, and React Router. As verified, the codebase uses Next.js 14 App Router (`src/app/layout.tsx`, `src/app/page.tsx`). No React Router packages or Vite files exist.
   - All navigation hooks must come from `'next/navigation'` (`useSearchParams`, `useRouter`, `usePathname`), NOT `'react-router-dom'`.
2. **Deep-Linking / Direct URL Access**:
   - If a user directly visits `/?route=secretaria&tab=turmas` or `/?tab=turmas`:
   - If `page.tsx` only initializes `activeRoute` to `'overview'`, visiting `/?tab=turmas` would mount `OverviewDashboard` unless `page.tsx` also initializes or synchronizes `activeRoute` with the route corresponding to the tab (or reads `searchParams.get('route')`).
   - Recommendation: In `page.tsx`, initialize `activeRoute` by checking `searchParams.get('route')` or mapping known tabs to their parent route (e.g. `turmas` -> `secretaria`, `rotina` -> `agenda`), ensuring full shareability of deep links.
3. **RBAC Filtering**:
   - Both `Sidebar.tsx` (`isAllowed`) and `page.tsx` (`isAuthorized`) enforce role permissions.
   - If a user role changes (e.g. via the header role switcher), nested submenu visibility in `Sidebar.tsx` must respect existing RBAC permissions.
4. **Action Buttons in Headers**:
   - In `SecretariaSection.tsx` and `FinanceiroSection.tsx`, top header containers include functional action buttons (`Executar Régua de Cobrança`, `+ Nova Matrícula Completa`). Tab removal must strictly target the tab switcher buttons without dropping functional modals or trigger buttons.

---

## 4. Conclusion

1. **Architecture Confirmed**: The application is a Next.js 14.2 App Router SPA located in `frontend/`.
2. **Primary Refactoring Targets**:
   - `frontend/src/components/Sidebar.tsx`: Add nested submenu data structure, collapsible UI, active sub-item styling, and URL search param appending via `useRouter` / `useSearchParams`.
   - `frontend/src/app/page.tsx`: Wrap dynamic content in `<Suspense>` to ensure `next build` static generation compatibility, and optionally sync `activeRoute` from URL parameters.
   - Section components (`AgendaDigitalSection.tsx`, `SecretariaSection.tsx`, `FinanceiroSection.tsx`, etc.):
     - Remove local `useState` for active tabs.
     - Read active tab from `useSearchParams().get('tab') || '<default>'`.
     - Remove horizontal tab switcher buttons from the top headers.
3. **Preservation Requirements**:
   - Preserve non-tab action buttons (such as modal triggers in `SecretariaSection`).
   - Preserve RBAC route guards (`isAllowed` and `isAuthorized`).
   - Maintain compatibility with mobile off-canvas drawer (`NavLinks`).

---

## 5. Verification Method

To independently verify the architecture and subsequent refactoring:

1. **TypeScript Type Check**:
   ```bash
   cd d:/Projetos/escolar/frontend
   npx tsc --noEmit
   ```
   Must exit with code 0 without any type mismatch or invalid import.

2. **Production Build & Suspense Verification**:
   ```bash
   cd d:/Projetos/escolar/frontend
   npm run build
   ```
   Must compile successfully (exit code 0) without `Missing Suspense boundary with useSearchParams` error.

3. **Core UI Benchmark Validation**:
   ```bash
   cd d:/Projetos/escolar
   python scripts/validate_frontend_core_ui.py
   ```
   Must exit with code 0 confirming AuthContext, ThemeContext, and RBAC operations.

4. **Code Inspection**:
   - Inspect `d:/Projetos/escolar/frontend/src/components/Sidebar.tsx` to verify presence of collapsible nested sublists and URL parameter handling.
   - Inspect `AgendaDigitalSection.tsx`, `SecretariaSection.tsx`, and `FinanceiroSection.tsx` to verify absence of local tab `useState` and absence of horizontal tab switcher elements.
