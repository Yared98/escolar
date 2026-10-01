# Architectural Investigation & Design Report: Sidebar Collapsible Sublists & URL Tab State Navigation

**Author**: survey_explorer_2 (Sidebar Navigation Explorer)  
**Date**: 2026-09-28  
**Scope**: `Sidebar.tsx`, Navigation Architecture, URL Tab State Management, and In-Page Tab Migration across `d:/Projetos/escolar/frontend`

---

## 1. Observation

### 1.1 Existing Navigation & Architecture Structure
- **Framework & Dependencies**:
  - `next`: `^14.2.0` (App Router structure: `frontend/src/app/layout.tsx`, `page.tsx`, `globals.css`).
  - `react`: `^18.3.0`, `lucide-react`: `^0.378.0`, `clsx`: `^2.1.1`, `tailwind-merge`: `^2.3.0`.
  - Next.js build verification: `npm run build` succeeds (`next build` output showed `Route (app) / (Static) prerendered as static content`).
- **Main Shell & Sidebar Placement**:
  - `frontend/src/app/page.tsx` (lines 79–241):
    ```tsx
    const [activeRoute, setActiveRoute] = useState<NavRoute>('overview');
    ...
    <Sidebar activeRoute={activeRoute} onRouteChange={setActiveRoute} />
    ```
  - `frontend/src/components/Sidebar.tsx` (lines 24–40):
    ```tsx
    export type NavRoute =
      | 'overview'
      | 'secretaria'
      | 'financeiro'
      | 'pedagogico'
      | 'academico'
      | 'administrativo'
      | 'agenda'
      | 'portal_aluno'
      | 'calendario'
      | 'crm'
      | 'ia_evasao';

    interface SidebarProps {
      activeRoute: NavRoute;
      onRouteChange: (route: NavRoute) => void;
    }
    ```
- **Current `Sidebar.tsx` Item Data Structure & Rendering**:
  - `Sidebar.tsx` lines 77–89 defines an array of flat items:
    ```tsx
    const menuItems = [
      { id: 'overview' as NavRoute, label: 'Visão Geral', icon: LayoutDashboard },
      { id: 'portal_aluno' as NavRoute, label: 'Portal do Aluno (Central da Família)', icon: GraduationCap },
      { id: 'calendario' as NavRoute, label: 'Planner & Calendário Escolar', icon: CalendarDays },
      { id: 'crm' as NavRoute, label: 'CRM & Captação', icon: Megaphone },
      { id: 'ia_evasao' as NavRoute, label: 'IA Anti-Evasão (EWS)', icon: Brain },
      { id: 'agenda' as NavRoute, label: 'Comunicados & Caixa de Mensagens', icon: Smartphone },
      { id: 'secretaria' as NavRoute, label: 'Secretaria & Prontuários', icon: Users },
      { id: 'financeiro' as NavRoute, label: 'Financeiro & Boletos (AP/AR)', icon: DollarSign },
      { id: 'pedagogico' as NavRoute, label: 'Pedagógico & Nutrição', icon: BookOpen },
      { id: 'academico' as NavRoute, label: 'Diário PWA (Professora)', icon: Sparkles },
      { id: 'administrativo' as NavRoute, label: 'Administrativo & RH', icon: Building2 },
    ];
    ```
  - Filtering by RBAC permissions via `isAllowed(item.id)` (lines 47–75).
  - Rendering in `NavLinks` (lines 101–143):
    - `isActive = activeRoute === item.id`
    - When active: `bg-salvia-700 text-white dark:bg-salvia-500 shadow-sm` with trailing `<ChevronRight className="w-4 h-4" />`.
    - When inactive: `text-slate-800 dark:text-salvia-200 hover:bg-salvia-100 dark:hover:bg-salvia-800/60`.
    - Click handler: `onRouteChange(item.id)` + `onClickCallback()` for mobile drawer.
  - Dual rendering targets:
    - Mobile off-canvas drawer (lines 165–198): triggered by `'open-mobile-menu'` custom window event.
    - Desktop sidebar (lines 201–209): `hidden lg:flex w-64 ... sticky top-6`.

### 1.2 In-Page Local Tab State Inventory across Section Components
Direct inspection revealed multiple section components maintaining their own local `useState` for internal tab switching:

1. **`AgendaDigitalSection.tsx`**:
   - Line 45: `const [activeTab, setActiveTab] = useState<'comunicacao' | 'rotina' | 'whatsapp'>('comunicacao');`
   - Lines 148–184: Horizontal tab buttons for `'comunicacao'` (Mensagens & Mural), `'rotina'` (Resumo de Rotina), `'whatsapp'` (WhatsApp Transbordo).
2. **`SecretariaSection.tsx`**:
   - Line 48: `const [activeTab, setActiveTab] = useState<'alunos' | 'turmas' | 'educacenso'>('alunos');`
   - Lines 730–754: Horizontal tab buttons for `'alunos'` (Alunos & Matrículas), `'turmas'` (Turmas & Ensalamento).
3. **`FinanceiroSection.tsx`**:
   - Line 57: `const [activeSubTab, setActiveSubTab] = useState<'ar' | 'ap' | 'nfse' | 'bi' | 'conciliacao'>('ar');`
   - Lines 412–459: Horizontal sub-tab buttons for `'ar'` (Faturas & Mensalidades), `'ap'` (Despesas & Fornecedores), `'nfse'` (NFS-e Automatizada), `'bi'` (Demonstrativo DRE & DFC).
4. **`PedagocioNutricaoSection.tsx`**:
   - Line 124: `const [activeTab, setActiveTab] = useState<'disciplinas_matriz' | 'atribuicao_horarios' | 'turmas' | 'projetos' | 'nutricao'>('disciplinas_matriz');`
   - Lines 558–619: Horizontal tab buttons for `'disciplinas_matriz'`, `'atribuicao_horarios'`, `'turmas'`, `'projetos'`, `'nutricao'`.
5. **`AdministrativoSection.tsx`**:
   - Line 40: `const [subTab, setSubTab] = useState<'entidades' | 'fornecedores' | 'relatorios' | 'envios' | 'lms_config'>('envios');`
   - Lines 195–242: Horizontal tab buttons for `'envios'`, `'entidades'`, `'fornecedores'`, `'relatorios'`.
6. **`PortalAlunoSection.tsx`**:
   - Line 97: `const [activeTab, setActiveTab] = useState<'boletim' | 'financeiro' | 'diploma' | 'rotina' | 'portfolio'>('boletim');`
   - Lines 293–340: Horizontal tab buttons for `'boletim'`, `'financeiro'`, `'diploma'`, `'rotina'`.
7. **`AcademicoSection.tsx`**:
   - Line 49: `const [viewMode, setViewMode] = useState<'fundamental' | 'infantil'>('fundamental');`
   - Lines 461–485: Mode selector for `'fundamental'` (Chamada Touch) vs `'infantil'` (Rotina Infantil).

---

## 2. Logic Chain

```
[Observation: Sidebar.tsx has flat list without sub-items]
                           │
                           ▼
[Observation: Multiple sections use local useState for internal tabs]
                           │
                           ▼
[Logic Step 1: User Experience Fragmentation & Inability to deep-link]
Internal tabs are hidden until user enters the section; URLs cannot be bookmarked or shared
with direct tab context (e.g., sharing a direct link to ?tab=whatsapp or ?tab=turmas).
                           │
                           ▼
[Logic Step 2: Next.js App Router (14.2) Client Navigation Architecture]
useSearchParams() from 'next/navigation' provides reactive search parameters. When
router.push('?tab=...') is invoked with { scroll: false }, components reading useSearchParams()
re-render reactively without page reload.
                           │
                           ▼
[Logic Step 3: Collapsible Sublist Data Structure]
Each NavItem can declare optional subItems: Array<NavSubItem> with tabKey, label, and icon.
Parent items declare defaultTab for instant navigation when clicked.
                           │
                           ▼
[Logic Step 4: Expand/Collapse & Active State Synchronization]
- When parent route is active, its sublist is expanded by default.
- Users can toggle expand/collapse manually via chevron button without switching routes.
- Sub-item is marked active if activeRoute === parent.id AND (searchParams.get('tab') === subItem.tabKey || (!searchParams.get('tab') && subItem.tabKey === parent.defaultTab)).
                           │
                           ▼
[Logic Step 5: Redundant UI Removal in Section Components]
Section components replace local useState<TabType> with useSearchParams().get('tab') || defaultTab.
Horizontal tab bars are removed from Section headers, making Sidebar the sole single source of truth.
```

---

## 3. Recommended Architecture & Implementation Specifications

### 3.1 TypeScript Type Definitions (`Sidebar.tsx`)

```typescript
import React from 'react';
import { LucideIcon } from 'lucide-react';

export type NavRoute =
  | 'overview'
  | 'secretaria'
  | 'financeiro'
  | 'pedagogico'
  | 'academico'
  | 'administrativo'
  | 'agenda'
  | 'portal_aluno'
  | 'calendario'
  | 'crm'
  | 'ia_evasao';

export interface NavSubItem {
  id: string;
  label: string;
  tabKey: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

export interface NavItem {
  id: NavRoute;
  label: string;
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  defaultTab?: string;
  subItems?: NavSubItem[];
  badge?: string | number;
}

export interface SidebarProps {
  activeRoute: NavRoute;
  onRouteChange: (route: NavRoute) => void;
}
```

### 3.2 Canonical Navigation Hierarchy Matrix

```typescript
export const MENU_ITEMS: NavItem[] = [
  {
    id: 'overview',
    label: 'Visão Geral',
    icon: LayoutDashboard,
  },
  {
    id: 'portal_aluno',
    label: 'Portal do Aluno (Família)',
    icon: GraduationCap,
    defaultTab: 'boletim',
    subItems: [
      { id: 'portal-boletim', label: 'Boletim & Desempenho', tabKey: 'boletim', icon: FileText },
      { id: 'portal-financeiro', label: 'Mensalidades Pix', tabKey: 'financeiro', icon: DollarSign },
      { id: 'portal-diploma', label: 'Documentos & Diploma MEC', tabKey: 'diploma', icon: Award },
      { id: 'portal-rotina', label: 'Rotina & Diário Escolar', tabKey: 'rotina', icon: Baby },
    ],
  },
  {
    id: 'agenda',
    label: 'Comunicados & Mensagens',
    icon: Smartphone,
    defaultTab: 'comunicacao',
    subItems: [
      { id: 'agenda-comunicacao', label: 'Mensagens & Mural', tabKey: 'comunicacao', icon: MessageSquare },
      { id: 'agenda-rotina', label: 'Resumo de Rotina', tabKey: 'rotina', icon: HeartPulse },
      { id: 'agenda-whatsapp', label: 'WhatsApp (Transbordo)', tabKey: 'whatsapp', icon: MessageCircle },
    ],
  },
  {
    id: 'secretaria',
    label: 'Secretaria & Prontuários',
    icon: Users,
    defaultTab: 'alunos',
    subItems: [
      { id: 'sec-alunos', label: 'Alunos & Matrículas', tabKey: 'alunos', icon: Users },
      { id: 'sec-turmas', label: 'Turmas & Ensalamento', tabKey: 'turmas', icon: BookOpen },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro & Boletos (AP/AR)',
    icon: DollarSign,
    defaultTab: 'ar',
    subItems: [
      { id: 'fin-ar', label: 'Faturas & Mensalidades (AR)', tabKey: 'ar', icon: ArrowDownLeft },
      { id: 'fin-ap', label: 'Despesas & Fornecedores (AP)', tabKey: 'ap', icon: ArrowUpRight },
      { id: 'fin-nfse', label: 'NFS-e Automatizada', tabKey: 'nfse', icon: FileText },
      { id: 'fin-bi', label: 'Demonstrativo DRE & DFC', tabKey: 'bi', icon: PieChart },
    ],
  },
  {
    id: 'pedagogico',
    label: 'Pedagógico & Nutrição',
    icon: BookOpen,
    defaultTab: 'disciplinas_matriz',
    subItems: [
      { id: 'ped-matriz', label: 'Disciplinas & Matriz', tabKey: 'disciplinas_matriz', icon: Layers },
      { id: 'ped-horarios', label: 'Atribuição & Horários', tabKey: 'atribuicao_horarios', icon: Clock },
      { id: 'ped-turmas', label: 'Visão das Turmas', tabKey: 'turmas', icon: Users },
      { id: 'ped-projetos', label: 'Projetos BNCC', tabKey: 'projetos', icon: Sparkles },
      { id: 'ped-nutricao', label: 'Planner de Nutrição', tabKey: 'nutricao', icon: Utensils },
    ],
  },
  {
    id: 'academico',
    label: 'Diário PWA (Professora)',
    icon: Sparkles,
    defaultTab: 'fundamental',
    subItems: [
      { id: 'acad-fundamental', label: 'Chamada Touch (Fundamental)', tabKey: 'fundamental', icon: Smartphone },
      { id: 'acad-infantil', label: 'Rotina (Educação Infantil)', tabKey: 'infantil', icon: Baby },
    ],
  },
  {
    id: 'administrativo',
    label: 'Administrativo & RH',
    icon: Building2,
    defaultTab: 'envios',
    subItems: [
      { id: 'adm-envios', label: 'Registro de Envios (Audit)', tabKey: 'envios', icon: Send },
      { id: 'adm-entidades', label: 'Corpo Docente & RH', tabKey: 'entidades', icon: UserCheck },
      { id: 'adm-fornecedores', label: 'Fornecedores', tabKey: 'fornecedores', icon: Truck },
      { id: 'adm-relatorios', label: 'Auditoria LGPD', tabKey: 'relatorios', icon: ShieldCheck },
    ],
  },
  {
    id: 'calendario',
    label: 'Planner & Calendário Escolar',
    icon: CalendarDays,
  },
  {
    id: 'crm',
    label: 'CRM & Captação',
    icon: Megaphone,
  },
  {
    id: 'ia_evasao',
    label: 'IA Anti-Evasão (EWS)',
    icon: Brain,
  },
];
```

### 3.3 State Management & Collapsible Handling Details

```tsx
// Inside Sidebar component:
const router = useRouter();
const searchParams = useSearchParams();
const pathname = usePathname();

// Tracks manual toggle overrides: [routeId]: boolean
const [expandedRoutes, setExpandedRoutes] = useState<Record<string, boolean>>({});

// Determines whether a route is expanded (auto-expanded if it is activeRoute, unless collapsed by user)
const isRouteExpanded = (routeId: string): boolean => {
  if (expandedRoutes[routeId] !== undefined) {
    return expandedRoutes[routeId];
  }
  return activeRoute === routeId;
};

// Toggle expand without changing route
const handleToggleExpand = (routeId: string, e: React.MouseEvent) => {
  e.stopPropagation();
  setExpandedRoutes((prev) => ({
    ...prev,
    [routeId]: !isRouteExpanded(routeId),
  }));
};

// Parent item click
const handleParentClick = (item: NavItem, onClickCallback?: () => void) => {
  const hasSubItems = item.subItems && item.subItems.length > 0;

  if (activeRoute !== item.id) {
    onRouteChange(item.id);
    setExpandedRoutes((prev) => ({ ...prev, [item.id]: true }));

    // Append ?tab=... to URL if parent has default tab
    if (hasSubItems && item.defaultTab) {
      const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
      params.set('tab', item.defaultTab);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    } else {
      // Clear tab param if navigating to a single-view route
      const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
      if (params.has('tab')) {
        params.delete('tab');
        const q = params.toString();
        router.push(q ? `${pathname}?${q}` : pathname, { scroll: false });
      }
    }
    if (onClickCallback) onClickCallback();
  } else if (hasSubItems) {
    // If already active, toggle collapse
    setExpandedRoutes((prev) => ({
      ...prev,
      [item.id]: !isRouteExpanded(item.id),
    }));
  }
};

// Sub-item click
const handleSubItemClick = (parentRoute: NavRoute, subItem: NavSubItem, onClickCallback?: () => void) => {
  const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
  params.set('tab', subItem.tabKey);
  router.push(`${pathname}?${params.toString()}`, { scroll: false });

  if (activeRoute !== parentRoute) {
    onRouteChange(parentRoute);
  }
  if (onClickCallback) onClickCallback();
};

// Active detection for sub-item
const isSubItemActive = (parentRoute: NavRoute, subItem: NavSubItem): boolean => {
  if (activeRoute !== parentRoute) return false;
  const currentTab = searchParams ? searchParams.get('tab') : null;
  if (currentTab) {
    return currentTab === subItem.tabKey;
  }
  const parent = MENU_ITEMS.find((m) => m.id === parentRoute);
  return parent?.defaultTab === subItem.tabKey;
};
```

### 3.4 Tailwind CSS Animation & Styling for Sublists

```tsx
<div
  className={`grid transition-all duration-200 ease-in-out ${
    isRouteExpanded(item.id)
      ? 'grid-rows-[1fr] opacity-100 mt-1 mb-1.5'
      : 'grid-rows-[0fr] opacity-0 pointer-events-none'
  }`}
>
  <div className="overflow-hidden">
    <div className="ml-4 pl-3 border-l-2 border-salvia-200 dark:border-salvia-800 space-y-0.5">
      {item.subItems?.map((sub) => {
        const isSubActive = isSubItemActive(item.id, sub);
        const SubIcon = sub.icon;
        return (
          <button
            key={sub.id}
            onClick={() => handleSubItemClick(item.id, sub, onClickCallback)}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all text-left ${
              isSubActive
                ? 'bg-salvia-100 dark:bg-salvia-800 text-salvia-900 dark:text-salvia-100 font-bold shadow-xs'
                : 'text-salvia-700 dark:text-salvia-300 hover:text-slate-900 dark:hover:text-salvia-50 hover:bg-salvia-100/60 dark:hover:bg-salvia-800/40 font-medium'
            }`}
          >
            <div className="flex items-center space-x-2 truncate">
              {SubIcon && (
                <SubIcon
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isSubActive ? 'text-salvia-700 dark:text-salvia-300' : 'text-salvia-500 dark:text-salvia-400'
                  }`}
                />
              )}
              <span className="truncate">{sub.label}</span>
            </div>
            {isSubActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-salvia-600 dark:bg-salvia-400 shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  </div>
</div>
```

### 3.5 Section Component Migration Guide

To fulfill acceptance criteria R2 and R3:

1. **`AgendaDigitalSection.tsx`**:
   - **Remove**:
     ```tsx
     // REMOVE line 45:
     const [activeTab, setActiveTab] = useState<'comunicacao' | 'rotina' | 'whatsapp'>('comunicacao');
     // REMOVE lines 148–184:
     <div className="flex flex-wrap gap-2">
       <button onClick={() => setActiveTab('comunicacao')}>...</button>
       <button onClick={() => setActiveTab('rotina')}>...</button>
       <button onClick={() => setActiveTab('whatsapp')}>...</button>
     </div>
     ```
   - **Add**:
     ```tsx
     import { useSearchParams } from 'next/navigation';
     // Inside AgendaDigitalSection():
     const searchParams = useSearchParams();
     const activeTab = (searchParams?.get('tab') as 'comunicacao' | 'rotina' | 'whatsapp') || 'comunicacao';
     ```

2. **`SecretariaSection.tsx`**:
   - **Remove**:
     ```tsx
     // REMOVE line 48:
     const [activeTab, setActiveTab] = useState<'alunos' | 'turmas' | 'educacenso'>('alunos');
     // REMOVE tab-switching buttons from lines 730–754, KEEP ONLY action buttons (+ Nova Matrícula / Criar Nova Turma)
     ```
   - **Add**:
     ```tsx
     import { useSearchParams } from 'next/navigation';
     // Inside SecretariaSection():
     const searchParams = useSearchParams();
     const activeTab = (searchParams?.get('tab') as 'alunos' | 'turmas') || 'alunos';
     ```

3. **`FinanceiroSection.tsx`**:
   - **Remove**:
     ```tsx
     // REMOVE line 57:
     const [activeSubTab, setActiveSubTab] = useState<'ar' | 'ap' | 'nfse' | 'bi' | 'conciliacao'>('ar');
     // REMOVE lines 411–459 (sub-tab bar).
     ```
   - **Add**:
     ```tsx
     import { useSearchParams } from 'next/navigation';
     // Inside FinanceiroSection():
     const searchParams = useSearchParams();
     const activeSubTab = (searchParams?.get('tab') as 'ar' | 'ap' | 'nfse' | 'bi' | 'conciliacao') || 'ar';
     ```

---

## 4. Caveats

1. **Next.js 14 App Router Suspense Requirement**:
   - When `useSearchParams()` is used in Next.js 14 client components, Next.js requires that the page or component be wrapped in a `<React.Suspense>` boundary during static generation (`next build`).
   - *Recommendation*: Wrap the content in `frontend/src/app/page.tsx` with `<React.Suspense fallback={<SectionSkeleton />}>` or provide safe fallback handling to ensure `next build` continues to pass without CSR bailout warnings.
2. **Backward Compatibility with `activeRoute` in `page.tsx`**:
   - Currently, `page.tsx` stores `activeRoute` in `useState<NavRoute>('overview')`.
   - The refactoring to append `?tab=...` does not disrupt `activeRoute`, but if desired, `page.tsx` can also read `?route=` from the URL for full two-way URL state restoration.
3. **Modal Tabs vs Section Navigation Tabs**:
   - In `SecretariaSection.tsx`, there are internal modal tabs (e.g., `modalTab: 'dados_aluno' | 'responsaveis' | 'endereco_contato' | 'prontuario'`). These belong strictly to the temporary modal dialog lifecycle and must **NOT** be moved to the Sidebar. Only top-level section views (`alunos` vs `turmas`) should be in the Sidebar.

---

## 5. Conclusion

1. **Architectural Viability**: Migrating in-page tabs from individual sections into collapsible nested sublists in `Sidebar.tsx` using `?tab=...` query parameters is completely clean, modular, and idiomatic in Next.js 14 App Router.
2. **RBAC Safety**: The existing `isAllowed(route)` matrix in `Sidebar.tsx` will seamlessly protect both parent items and their nested sub-items.
3. **No Breaking Changes**: The proposed `SidebarProps` remains backwards-compatible with `activeRoute` and `onRouteChange`, while handling URL query strings internally via `next/navigation` hooks (`useRouter`, `useSearchParams`, `usePathname`).
4. **Immediate Implementability**: The provided data structure, CSS Grid height transition, and section refactoring patterns can be directly implemented by the implementation agent.

---

## 6. Verification Method

To independently verify the implementation:

1. **Build & Typecheck Command**:
   ```bash
   cd d:/Projetos/escolar/frontend
   npm run build
   ```
   *Expected result*: Compiles successfully with exit code 0 (`Route (app) / prerendered as static content`).

2. **Component Inspection**:
   - Inspect `d:/Projetos/escolar/frontend/src/components/Sidebar.tsx`:
     - Verify `MENU_ITEMS` has `subItems` with `tabKey`.
     - Verify presence of collapsible nested list with `isRouteExpanded` and `handleSubItemClick`.
     - Verify click triggers `router.push('?tab=...')`.
   - Inspect `d:/Projetos/escolar/frontend/src/components/AgendaDigitalSection.tsx`:
     - Verify `useState` for `activeTab` is removed.
     - Verify `useSearchParams().get('tab')` is used.
     - Verify horizontal tab buttons (lines 148–184) are removed.
   - Inspect `d:/Projetos/escolar/frontend/src/components/SecretariaSection.tsx`:
     - Verify `useState` for `activeTab` is removed.
     - Verify `useSearchParams().get('tab')` is used.
     - Verify horizontal tab buttons (lines 730–754) are removed.
   - Inspect `d:/Projetos/escolar/frontend/src/components/FinanceiroSection.tsx`:
     - Verify `useState` for `activeSubTab` is removed.
     - Verify `useSearchParams().get('tab')` is used.
     - Verify horizontal tab buttons (lines 411–459) are removed.

3. **Runtime Invalidation Conditions**:
   - If any section component still triggers tab switching via internal `useState`.
   - If clicking a sub-item does not update the URL query string with `?tab=...`.
   - If the collapsible sublist does not auto-expand when its parent route is active.
