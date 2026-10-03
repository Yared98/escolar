# Project: Escolares Navigation Refactoring & Collapsible Sublists

## Architecture
The application is a Next.js 14.2 App Router single-page dashboard (`frontend/src/app/page.tsx`) styled with Tailwind CSS and Lucide icons.
The navigation architecture is being upgraded from flat menu items with in-page section tabs into a unified, URL-driven navigation system:
1. **Navigation Shell (`Sidebar.tsx`)**:
   - Data structure upgraded to hierarchical `NavItem` with optional `subItems: NavSubItem[]`.
   - Collapsible sublists with smooth animated transitions (CSS Grid / Tailwind).
   - Active sub-item detection based on active route and URL query param `?tab=`.
   - Clicking a sub-item synchronizes the URL search parameters (`?tab=...`) via `useRouter` and `useSearchParams`.
2. **Dashboard Shell (`page.tsx`)**:
   - Wrapped in `<React.Suspense fallback={<SectionSkeleton />}>` to support `useSearchParams` during Next.js static prerendering.
   - Synchronizes `activeRoute` with URL query parameters for deep-linking.
3. **Section Components (`*Section.tsx`)**:
   - Internal tab state migrated from local `useState` to URL search params (`useSearchParams().get('tab')`).
   - Invariant whitelist fallback for absent or invalid `?tab=` values.
   - Horizontal tab switcher buttons removed from headers.
   - In-page action buttons (e.g., `+ Nova Matrícula Completa` in `SecretariaSection`) strictly preserved.

## Code Layout
- `frontend/src/components/Sidebar.tsx`: Navigation menu definitions, collapsible sublists, URL search param updater.
- `frontend/src/app/page.tsx`: Main dashboard router, Suspense wrapper, active route state synchronization.
- `frontend/src/components/AgendaDigitalSection.tsx`: Core section component (migrated to URL tabs, tab bar removed).
- `frontend/src/components/SecretariaSection.tsx`: Core section component (migrated to URL tabs, tab bar removed, action buttons preserved).
- `frontend/src/components/FinanceiroSection.tsx`: Core section component (migrated to URL tabs, tab bar removed).
- `frontend/src/components/PedagocioNutricaoSection.tsx`: Extended section component (migrated to URL tabs, tab bar removed).
- `tests/e2e/`: Automated E2E verification test suite validating AST, static build, and navigation behavior.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Hierarchical NavItem Data Structure | Add `subItems` with `tabKey`, `label`, `icon` to `Sidebar.tsx` | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Collapsible Sublist UI & Animations | Smooth expand/collapse sublists in Sidebar with chevron indicators | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Sidebar URL Query Param Sync | Clicking sub-items updates URL with `?tab=...` via Next.js router | M1 | ORIGINAL_REQUEST §R2 |
| 4 | Suspense Wrapper in Dashboard Shell | Wrap `page.tsx` content in `<React.Suspense>` for `useSearchParams` build compatibility | M1 | Survey Findings |
| 5 | Deep-Linking Route Synchronization | Allow URL params (`?route=...&tab=...`) to initialize dashboard view | M1 | Survey Findings |
| 6 | AgendaDigitalSection URL Tab State | Replace local `useState` with `useSearchParams().get('tab')` | M2 | ORIGINAL_REQUEST §R2 |
| 7 | AgendaDigitalSection Tab Bar Removal | Remove horizontal buttons for 'comunicacao', 'rotina', 'whatsapp' | M2 | ORIGINAL_REQUEST §R3 |
| 8 | SecretariaSection URL Tab State | Replace local `useState` with `useSearchParams().get('tab')` | M2 | ORIGINAL_REQUEST §R2 |
| 9 | SecretariaSection Tab Bar Removal | Remove horizontal buttons for 'alunos', 'turmas', preserving action buttons | M2 | ORIGINAL_REQUEST §R3 |
| 10 | FinanceiroSection URL Tab State | Replace local `useState` with `useSearchParams().get('tab')` | M3 | ORIGINAL_REQUEST §R2 |
| 11 | FinanceiroSection Tab Bar Removal | Remove horizontal buttons for 'ar', 'ap', 'nfse', 'bi' | M3 | ORIGINAL_REQUEST §R3 |
| 12 | PedagocioNutricaoSection URL Tab State | Replace local `useState` with `useSearchParams().get('tab')` | M3 | ORIGINAL_REQUEST §R2 |
| 13 | PedagocioNutricaoSection Tab Bar Removal | Remove horizontal buttons for matriz, horários, turmas, projetos, nutrição | M3 | ORIGINAL_REQUEST §R3 |
| 14 | E2E Testing Suite (Tiers 1-4) | Comprehensive test suite validating AST, URL params, build, and requirements | E2E Track | ORIGINAL_REQUEST Rubric |
| 15 | Adversarial Coverage Hardening | Tier 5 white-box stress testing and boundary validation | Final M4 | Dual Track Methodology |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Track | Automated test suite (Tiers 1-4) covering all features and acceptance criteria | none | DONE (71/71 tests PASS) |
| M1 | Sidebar Navigation & Shell | `Sidebar.tsx` collapsible sublists, URL `?tab=` updater, `page.tsx` Suspense | none | DONE (Gate PASS) |
| M2 | Core Sections Refactoring | `AgendaDigitalSection.tsx` and `SecretariaSection.tsx` tab migration | M1 | DONE (Validated) |
| M3 | Extended Sections Refactoring | `FinanceiroSection.tsx` and `PedagocioNutricaoSection.tsx` tab migration | M1 | DONE (Validated) |
| M4 | Final E2E Gate & Hardening | 100% E2E test pass + Tier 5 Adversarial Coverage Hardening | E2E, M2, M3 | DONE (114/114 PASS) |

## Interface Contracts
### Sidebar.tsx ↔ URL & Page Shell
- Types:
  ```typescript
  export interface NavSubItem {
    id: string;
    label: string;
    tabKey: string;
    icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  }
  export interface NavItem {
    id: NavRoute;
    label: string;
    icon: LucideIcon | React.ComponentType<{ className?: string }>;
    defaultTab?: string;
    subItems?: NavSubItem[];
  }
  ```
- URL Search Parameter: `?tab=<tabKey>`
  - Default tab key when clicking parent route: `item.defaultTab`
  - Clicking sub-item: sets `?tab=${subItem.tabKey}` without page reload (`router.push(..., { scroll: false })`)
- Active Sub-item predicate:
  `isSubActive = activeRoute === parentRoute && (searchParams.get('tab') === subItem.tabKey || (!searchParams.get('tab') && subItem.tabKey === item.defaultTab))`

### Section Components ↔ URL Contract
- Sections read:
  `const searchParams = useSearchParams();`
  `const tab = searchParams.get('tab');`
  `const activeTab = (tab && validTabs.includes(tab)) ? tab : defaultTab;`
- Sections MUST NOT manage tab switching via `useState`.
- Sections MUST NOT render buttons whose sole purpose is switching the local tab.
