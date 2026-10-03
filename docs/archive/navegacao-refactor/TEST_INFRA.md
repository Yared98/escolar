# Test Infrastructure Architecture: Escolar Navigation E2E Suite

## 1. Overview & Objective
This test suite provides automated, comprehensive, requirement-driven end-to-end (E2E) verification for the Escolar navigation refactoring. It validates the migration of in-page section tabs into collapsible sublists within the main `Sidebar.tsx`, URL search parameter state management (`?tab=...`), removal of redundant horizontal tab bars, boundary handling, RBAC role filtering, and shareable deep-linking.

The test infrastructure is designed to execute on Windows and cross-platform environments using standard Python 3.13 (or Node.js 22 proxy) with zero external dependency requirements and sub-second execution speeds.

---

## 2. Four-Tier Test Architecture

```
+--------------------------------------------------------------------------------------------------+
|                                  Escolar E2E Test Suite                                          |
+-----------------------------------+----------------------------------+---------------------------+
| Tier 1: Feature Coverage          | Tier 2: Boundary & Corner Cases  | Tier 3: Cross-Feature     |
| - Sidebar submenus (6 tests)      | - Missing ?tab= fallback (6 t)   | - RBAC role matrix (6 t)  |
| - URL query params (6 tests)      | - Invalid ?tab= handling (6 t)   | - Mobile drawer (6 tests) |
| - Section URL reading (6 tests)   | - Route transitions (6 tests)    |                           |
| - Tab bar removal (6 tests)       | - Modal tabs isolation (6 tests) |                           |
+-----------------------------------+----------------------------------+---------------------------+
|                               Tier 4: Real-World Scenarios                                       |
|                               - Shareable deep-linking (6 tests)                                 |
|                               - Multi-step user journeys (5 tests)                               |
+--------------------------------------------------------------------------------------------------+
```

### Tier 1: Feature Coverage (24 Tests)
- **Sidebar Submenus (`test_sidebar_submenus.py`)**: Hierarchical `NavItem` data structure with `subItems`, auto-expansion on active route, manual chevron expand/collapse toggle without route switching, active sub-item highlight predicate, and single-view routes.
- **URL Query Parameters (`test_url_query_parameters.py`)**: Sub-item clicks appending `?tab=...`, parent route clicks setting `defaultTab`, single-view route navigation clearing `tab` parameter, in-section parameter replacement, and preservation of auxiliary parameters (`tenant`, `theme`).
- **Section URL Reading (`test_section_url_reading.py`)**: Reactive resolution of active tabs directly from `useSearchParams()` for `AgendaDigitalSection`, `SecretariaSection`, `FinanceiroSection`, `PedagocioNutricaoSection`, `PortalAlunoSection`, and `AcademicoSection`.
- **Horizontal Tab Bar Removal (`test_tab_bar_removal.py`)**: Verifies removal specifications for horizontal tab switcher buttons across sections, strict preservation of contextual header action buttons (`+ Nova Matrícula Completa`, `Criar Nova Turma`), and Sidebar as the sole source of navigation.

### Tier 2: Boundary & Corner Cases (24 Tests)
- **Missing `?tab=` Fallback (`test_missing_tab_fallback.py`)**: Graceful fallback to `defaultTab` (`comunicacao`, `alunos`, `ar`, `disciplinas_matriz`, `boletim`) when `?tab=` is absent or empty, and default sub-item highlighting in Sidebar.
- **Invalid `?tab=` Values (`test_invalid_tab_handling.py`)**: Whitelist validation against non-existent tabs, unrecognized query values, cross-section tabs, and adversarial injection strings (`<script>`, SQL fragments, path traversals).
- **Route Transitions (`test_route_transitions.py`)**: Active route switching, replacement of tab parameters on route changes, cross-section direct sub-item clicking, single-view transition tab clearance, and browser back/forward history traversal.
- **Modal Tabs Preservation (`test_modal_tabs_preservation.py`)**: Strict isolation between top-level section navigation tabs (`?tab=alunos|turmas`) and temporary modal dialog tabs (`modalTab: dados_aluno, responsaveis, endereco_contato, prontuario`), preventing URL pollution and preserving modal form lifecycles.

### Tier 3: Cross-Feature Combinations (12 Tests)
- **RBAC Role Filtering with Submenus (`test_rbac_submenus.py`)**: Validates permission cascading for all 7 application roles (`admin`, `gestor`, `financeiro`, `secretaria`, `professor`, `nutricionista`, `responsavel`). Disallowing a parent route completely hides and denies all its nested sub-items.
- **Mobile Drawer Off-Canvas Navigation (`test_mobile_drawer_navigation.py`)**: Mobile off-canvas drawer open events (`open-mobile-menu`), sub-item and parent item clicks with automated callback closure, backdrop dismissal, and viewport parity.

### Tier 4: Real-World Application Scenarios (11 Tests)
- **Shareable Deep-Linking (`test_shareable_deep_linking.py`)**: Direct URL entry (`/?route=secretaria&tab=turmas`, `/?tab=whatsapp`), parent route inference from tab parameter, query parameter preservation, and copy-paste URL session restoration.
- **Multi-Step User Journeys (`test_multi_step_user_journey.py`)**: Complete end-to-end operational workflows:
  1. Admin daily management journey (Overview -> Agenda -> Secretaria -> Financeiro).
  2. Secretary student enrollment workflow (launching modal, stepping through multi-tab form, closing, switching to turmas).
  3. Parent mobile portal journey (drawer opening, report card inspection, tuition payment).
  4. Teacher attendance-to-agenda workflow.
  5. Multi-tab browser refresh simulation with full state restoration.

---

## 3. Test Harness Architecture & Components

The harness in `tests/e2e/harness/` consists of:

1. **`test_framework.py`**:
   - `TestSuiteRunner` registering tests by tier.
   - Precision sub-millisecond execution timing.
   - ANSI/ASCII Windows CP1252 and UTF-8 safe reporting.
   - Exit code handling (0 on success, 1 on failure).
2. **`navigation_engine.py`**:
   - Simulates Next.js 14 App Router state (`pathname`, `searchParams`, `router.push`).
   - Simulates `Sidebar` collapsible state machine (`expandedRoutes`, `isRouteExpanded`, `toggle_expand`, `on_parent_click`, `on_sub_item_click`, `is_sub_item_active`).
   - Simulates Section reactive tab resolution according to `PROJECT.md` interface contracts.
3. **`rbac_simulator.py`**:
   - Verbatim implementation of the RBAC matrix from `Sidebar.tsx`.
   - Evaluates route and sub-item access per role.
4. **`dom_contract_oracle.py`**:
   - Canonical CSS class signatures, animation transition classes (`grid-rows-[1fr]` vs `grid-rows-[0fr]`).
   - Authoritative list of removed tab buttons and preserved header action buttons.
5. **`ast_codebase_scanner.py`**:
   - Progressive AST and source scanner for physical files (`Sidebar.tsx`, `page.tsx`, `*Section.tsx`).
   - Audits milestone compliance without breaking during parallel worker execution.

---

## 4. Execution Commands

### Full Test Suite (Recommended)
```pwsh
python tests/e2e/run_all.py
```
Or via Node.js:
```pwsh
node tests/e2e/run_all.mjs
```

### Filter by Tier
```pwsh
python tests/e2e/run_all.py --tier 1
python tests/e2e/run_all.py --tier 2
python tests/e2e/run_all.py --tier 3
python tests/e2e/run_all.py --tier 4
```

### Progressive Codebase Audit
```pwsh
python tests/e2e/run_all.py --scan-codebase
```

---

## 5. Verification & Exit Code Contract
- Total tests: **71 test cases**.
- Success criteria: **71 passed, 0 failed**.
- Exit code: **0** on 100% pass, **1** if any test fails.
