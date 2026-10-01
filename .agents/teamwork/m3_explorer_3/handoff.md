# Handoff Report: Milestone 3 AST Scanner & PedagogicoNutricaoSection Investigation

## 1. Observation

### 1.1 AST Codebase Scanner (`tests/e2e/harness/ast_codebase_scanner.py`)
In `tests/e2e/harness/ast_codebase_scanner.py`, lines 61-77 define the section component scanner:
```python
61: def scan_section_file(file_path: str, default_tab: str, valid_tabs: List[str]) -> Dict[str, Any]:
62:     if not os.path.exists(file_path):
63:         return {"exists": False}
64:     with open(file_path, "r", encoding="utf-8") as f:
65:         content = f.read()
66: 
67:     uses_use_search_params = bool(re.search(r"\buseSearchParams\b", content))
68:     reads_tab_param = bool(re.search(r"searchParams(?:\.get|\?\.get)\(['\"]tab['\"]\)", content))
69:     has_local_tab_state = bool(re.search(r"useState<[^>]*" + default_tab + r"[^>]*>", content))
70: 
71:     return {
72:         "exists": True,
73:         "uses_use_search_params": uses_use_search_params,
74:         "reads_tab_param": reads_tab_param,
75:         "has_local_tab_state": has_local_tab_state,
76:         "is_refactored": uses_use_search_params and reads_tab_param and not has_local_tab_state
77:     }
```
Direct analysis of the four regex checks:
- **`uses_use_search_params`** (`r"\buseSearchParams\b"`): Matches word boundary for `useSearchParams`, verifying import and/or hook execution from `'next/navigation'`.
- **`reads_tab_param`** (`r"searchParams(?:\.get|\?\.get)\(['\"]tab['\"]\)"`): Matches method call or optional chaining retrieving query parameter `'tab'` or `"tab"`.
- **`has_local_tab_state`** (`r"useState<[^>]*" + default_tab + r"[^>]*>"`): Matches a React generic `useState<...>` declaration where the type argument contains the `default_tab` literal. If found, local state for tabs is considered still present.
- **`is_refactored`**: Logical conjunction `uses_use_search_params and reads_tab_param and not has_local_tab_state`. True if and only if searchParams is used, `'tab'` is read, and no local useState holding the default tab exists.

### 1.2 Master Test Runner Progressive Audit (`tests/e2e/run_all.py`)
In `tests/e2e/run_all.py`, lines 51-89 define `run_codebase_scan()`:
```python
51: def run_codebase_scan():
52:     print("\n" + "=" * 80)
53:     print("[SCAN] CODEBASE STATIC CONTRACT & AST SCANNER (PROGRESSIVE AUDIT)")
54:     print("=" * 80)
55:     sidebar_path = os.path.join(PROJECT_ROOT, "frontend", "src", "components", "Sidebar.tsx")
56:     page_path = os.path.join(PROJECT_ROOT, "frontend", "src", "app", "page.tsx")
57:     agenda_path = os.path.join(PROJECT_ROOT, "frontend", "src", "components", "AgendaDigitalSection.tsx")
58:     secretaria_path = os.path.join(PROJECT_ROOT, "frontend", "src", "components", "SecretariaSection.tsx")
...
65:     print(f"1. Sidebar.tsx:")
...
72:     print(f"\n2. page.tsx:")
...
77:     print(f"\n3. AgendaDigitalSection.tsx:")
...
83:     print(f"\n4. SecretariaSection.tsx:")
...
88:     print("=" * 80 + "\n")
```
When executed via `python tests/e2e/run_all.py --scan-codebase`, items 1 to 4 are audited. `FinanceiroSection.tsx` and `PedagocioNutricaoSection.tsx` are not currently wired into `run_codebase_scan()`.

### 1.3 Direct AST Scan Evaluation of All Multi-Tab Components
Executing `scan_section_file` directly against all target components via Python:
```
AgendaDigitalSection:     is_refactored=True,  uses_use_search_params=True,  reads_tab_param=True,  has_local_tab_state=False
SecretariaSection:        is_refactored=True,  uses_use_search_params=True,  reads_tab_param=True,  has_local_tab_state=False
FinanceiroSection:        is_refactored=True,  uses_use_search_params=True,  reads_tab_param=True,  has_local_tab_state=False
PedagocioNutricaoSection: is_refactored=False, uses_use_search_params=False, reads_tab_param=False, has_local_tab_state=True
```

### 1.4 State of `FinanceiroSection.tsx` (`frontend/src/components/FinanceiroSection.tsx`)
1. Import of `useSearchParams` on line 4:
   ```tsx
   import { useSearchParams } from 'next/navigation';
   ```
2. Reactive URL tab reading on lines 58-60:
   ```tsx
   58:   const searchParams = useSearchParams();
   59:   const tabParam = searchParams ? searchParams.get('tab') : null;
   60:   const activeSubTab = tabParam === 'ap' || tabParam === 'nfse' || tabParam === 'bi' || tabParam === 'conciliacao' ? tabParam : 'ar';
   ```
3. No local tab `useState`: lines 61-85 manage data (`faturas`, `despesas`, `dre`, `pixModalFatura`, `novaDespesa`), without any local tab switching state.
4. Horizontal tab bar removed: no header buttons for `'Faturas & Mensalidades (AR)'`, `'Despesas & Fornecedores (AP)'`, etc. Content conditionally renders based on `activeSubTab` (lines 416, 530, 591, 609).

### 1.5 State of `PedagocioNutricaoSection.tsx` (`frontend/src/components/PedagocioNutricaoSection.tsx`)
1. Missing `useSearchParams` import on line 3:
   ```tsx
   import React, { useState, useEffect, useCallback } from 'react';
   ```
2. Local tab state hook on lines 124-126:
   ```tsx
   124:   const [activeTab, setActiveTab] = useState<
   125:     'disciplinas_matriz' | 'atribuicao_horarios' | 'turmas' | 'projetos' | 'nutricao' | 'tri'
   126:   >('disciplinas_matriz');
   ```
3. Header and horizontal tab bar container on lines 546-620:
   ```tsx
   546:       {/* Header com Tabs */}
   547:       <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
   548:         <div>
   549:           <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
   550:             <BookOpen className="w-5 h-5 text-salvia-700 dark:text-salvia-400" />
   551:             <span>Gestão Pedagógica, Matriz Curricular & Lotação</span>
   552:           </h2>
   553:           <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
   554:             Cadastro de Componentes Curriculares (BNCC), Matrizes por Turma, Atribuição Docente e Grade Semanal sem Choques.
   555:           </p>
   556:         </div>
   557: 
   558:         {/* Navigation Tabs */}
   559:         <div className="flex flex-wrap gap-1.5">
   560:           <button onClick={() => setActiveTab('disciplinas_matriz')} ...>Disciplinas & Matriz</button>
   572:           <button onClick={() => setActiveTab('atribuicao_horarios')} ...>Atribuição & Horários</button>
   584:           <button onClick={() => setActiveTab('turmas')} ...>Visão das Turmas ({turmas.length})</button>
   596:           <button onClick={() => setActiveTab('projetos')} ...>Projetos BNCC</button>
   608:           <button onClick={() => setActiveTab('nutricao')} ...>Planner de Nutrição</button>
   619:         </div>
   620:       </div>
   ```
4. Tab content sections conditioned on `activeTab`:
   - Line 650: `{activeTab === 'tri' && (`
   - Line 703: `{activeTab === 'disciplinas_matriz' && (`
   - Line 869: `{activeTab === 'atribuicao_horarios' && (`
   - Line 995: `{activeTab === 'turmas' && (`
   - Line 1050: `{activeTab === 'projetos' && (`
   - Line 1089: `{activeTab === 'nutricao' && (`
5. Internal modals (must be preserved):
   - `showModalSimulado` (line 141)
   - `showModalDisciplina` (line 156)
   - `showModalAdicionarMatriz` (line 157)
   - `showModalAtribuirProf` (line 158)
   - `showModalHorario` (line 159)
   - `showModalCardapio` (line 160)

### 1.6 Original Request Acceptance Criteria (`d:/Projetos/escolar/.agents/teamwork/ORIGINAL_REQUEST.md`)
Lines 30-33:
```markdown
- [ ] `Sidebar.tsx` contains nested navigation items that append `?tab=` (or similar) query parameters to the URL.
- [ ] At least 3 section components (e.g., `AgendaDigitalSection.tsx`, `SecretariaSection.tsx`) no longer contain local `useState` for tab switching.
- [ ] The `*Section.tsx` components read the active tab from the URL (via `useSearchParams` or equivalent) to determine what content to render.
- [ ] The old horizontal tab UI elements (buttons changing local tabs) are completely removed from the section components.
```

---

## 2. Logic Chain

### 2.1 Scanner Verification Mechanics
1. **From Observation 1.1**: `scan_section_file` relies on three regex assertions.
2. For any component to be reported as `is_refactored: True`, it must:
   - Match `\buseSearchParams\b`.
   - Match `searchParams(?:\.get|\?\.get)\(['\"]tab['\"]\)`.
   - Fail to match `useState<[^>]*` + default_tab + `[^>]*>`.
3. In `FinanceiroSection.tsx` (Observation 1.4), line 4 imports `useSearchParams`, line 59 calls `searchParams.get('tab')`, and lines 61-85 do not declare `useState<'ar' ...>`. Hence `scan_section_file(financeiro_path, "ar", [...])` evaluates to `is_refactored: True`.
4. In `PedagocioNutricaoSection.tsx` (Observation 1.5), lines 124-126 declare `useState<'disciplinas_matriz' ...>`, no `useSearchParams` exists, and lines 559-619 render interactive tab buttons calling `setActiveTab`. Hence `scan_section_file(pedagogico_path, "disciplinas_matriz", [...])` evaluates to `is_refactored: False`.

### 2.2 Augmenting `run_all.py` for Milestone 3 Reporting
1. **From Observation 1.2**: `run_codebase_scan()` in `run_all.py` currently reports items 1 to 4 (`Sidebar.tsx`, `page.tsx`, `AgendaDigitalSection.tsx`, `SecretariaSection.tsx`).
2. To report Milestone 3 status for `FinanceiroSection.tsx` (and `PedagocioNutricaoSection.tsx`), `run_codebase_scan()` can be augmented by instantiating:
   ```python
   financeiro_path = os.path.join(PROJECT_ROOT, "frontend", "src", "components", "FinanceiroSection.tsx")
   financeiro_res = scan_section_file(financeiro_path, "ar", ["ar", "ap", "nfse", "bi", "conciliacao"])
   ```
   and logging:
   ```python
   print(f"\n5. FinanceiroSection.tsx:")
   print(f"   - File exists: {financeiro_res.get('exists')}")
   print(f"   - useSearchParams tab binding: {financeiro_res.get('reads_tab_param')}")
   print(f"   - Local useState removed: {not financeiro_res.get('has_local_tab_state')}")
   print(f"   - Milestone 3 Status: {'COMPLIANT' if financeiro_res.get('is_refactored') else 'PENDING M3 WORKER'}")
   ```
   Optionally appending item 6 for `PedagocioNutricaoSection.tsx`:
   ```python
   pedagogico_path = os.path.join(PROJECT_ROOT, "frontend", "src", "components", "PedagocioNutricaoSection.tsx")
   pedagogico_res = scan_section_file(pedagogico_path, "disciplinas_matriz", ["disciplinas_matriz", "atribuicao_horarios", "turmas", "projetos", "nutricao", "tri"])
   print(f"\n6. PedagocioNutricaoSection.tsx:")
   print(f"   - File exists: {pedagogico_res.get('exists')}")
   print(f"   - useSearchParams tab binding: {pedagogico_res.get('reads_tab_param')}")
   print(f"   - Local useState removed: {not pedagogico_res.get('has_local_tab_state')}")
   print(f"   - Milestone 3 Status: {'COMPLIANT' if pedagogico_res.get('is_refactored') else 'PENDING M3 WORKER'}")
   ```

### 2.3 Refactoring `PedagocioNutricaoSection.tsx` vs `FinanceiroSection.tsx`
1. `FinanceiroSection.tsx` has already completed the full refactoring cycle: URL binding, no local tab state, and horizontal tab bar eliminated.
2. `PedagocioNutricaoSection.tsx` is the sole remaining section component from `PROJECT.md` Feature Inventory (Features 12 and 13) that still retains local tab state and horizontal tab buttons.
3. The refactoring pattern established in `AgendaDigitalSection.tsx`, `SecretariaSection.tsx`, and `FinanceiroSection.tsx` maps directly to `PedagocioNutricaoSection.tsx`:
   - Step A: Add `import { useSearchParams } from 'next/navigation';` at line 4.
   - Step B: Replace lines 124-126 with:
     ```tsx
     const searchParams = useSearchParams();
     const tabParam = searchParams ? searchParams.get('tab') : null;
     const activeTab: 'disciplinas_matriz' | 'atribuicao_horarios' | 'turmas' | 'projetos' | 'nutricao' | 'tri' =
       tabParam === 'atribuicao_horarios' ||
       tabParam === 'turmas' ||
       tabParam === 'projetos' ||
       tabParam === 'nutricao' ||
       tabParam === 'tri'
         ? tabParam
         : 'disciplinas_matriz';
     ```
   - Step C: Remove lines 558 to 619 (`<div className="flex flex-wrap gap-1.5">...</div>`), leaving the header title intact.
   - Step D: Keep all 6 modal dialog states (`showModalSimulado`, `showModalDisciplina`, etc.) and their contextual trigger buttons intact.
4. Refactoring `PedagocioNutricaoSection.tsx` alongside `FinanceiroSection.tsx` yields 100% adherence to `PROJECT.md` M3 scope ("Extended Sections Refactoring: FinanceiroSection.tsx and PedagocioNutricaoSection.tsx tab migration").

### 2.4 Acceptance Criteria Verification
1. **From Observation 1.6**: Acceptance Criteria requires "At least 3 section components (e.g., AgendaDigitalSection.tsx, SecretariaSection.tsx) no longer contain local useState for tab switching."
2. **From Observation 1.3**:
   - `AgendaDigitalSection.tsx` has NO local tab useState and reads URL tab. (Component 1)
   - `SecretariaSection.tsx` has NO local tab useState and reads URL tab. (Component 2)
   - `FinanceiroSection.tsx` has NO local tab useState and reads URL tab. (Component 3)
3. Therefore, exactly 3 components already satisfy the strict threshold of "At least 3 section components".
4. With `PedagocioNutricaoSection.tsx` refactored, exactly 4 components will satisfy the criteria (a 33% super-quota over minimum acceptance threshold), providing maximum codebase consistency.

---

## 3. Caveats

1. **TRI Simulation Tab (`'tri'`) in `PedagocioNutricaoSection.tsx`**:
   - In `Sidebar.tsx`, the subItems for `pedagogico` include 5 tabs: `disciplinas_matriz`, `atribuicao_horarios`, `turmas`, `projetos`, `nutricao`.
   - `'tri'` is not in `Sidebar.tsx`, but it is conditionally rendered in `PedagocioNutricaoSection.tsx` (line 650) and validated in E2E tests (`test_pedagogico_section_reads_tab_from_searchparams`).
   - The refactored `activeTab` union in `PedagocioNutricaoSection.tsx` MUST include `'tri'` so deep links to `/?route=pedagogico&tab=tri` continue to render the TRI simulation panel without regression.
2. **Internal Modal States Preservation**:
   - `PedagocioNutricaoSection.tsx` contains 6 modal dialogs. These are popup workflows, not section tabs. They must NOT be migrated to URL query params or removed, matching the preservation pattern used for `modalTab` in `SecretariaSection.tsx`.
3. **Read-Only Scope**:
   - As an explorer agent (`m3_explorer_3`), no source code modifications were made. All edits to `PedagocioNutricaoSection.tsx` or `run_all.py` are scoped as actionable instructions for implementation workers.

---

## 4. Conclusion

1. **AST Scanner Evaluation**: `tests/e2e/harness/ast_codebase_scanner.py` uses 3 straightforward regex patterns (`\buseSearchParams\b`, `searchParams.get('tab')`, `useState<.*default_tab.*>`).
2. **Current Milestone 3 Compliance**:
   - `FinanceiroSection.tsx` is already 100% compliant with M3 requirements and passes `scan_section_file` with `is_refactored: True`.
   - `PedagocioNutricaoSection.tsx` currently fails `scan_section_file` (`is_refactored: False`) due to local `useState` at lines 124-126 and horizontal tab buttons at lines 558-619.
3. **Acceptance Criteria**:
   - The criterion "At least 3 section components no longer contain local useState for tab switching" is **already satisfied** by `AgendaDigitalSection`, `SecretariaSection`, and `FinanceiroSection`.
   - Refactoring `PedagocioNutricaoSection.tsx` will increase compliant components from 3 to 4, completing 100% of Milestone 3 features as specified in `PROJECT.md`.
4. **Augmenting `run_all.py`**:
   - Adding `scan_section_file` checks for `FinanceiroSection.tsx` (and `PedagocioNutricaoSection.tsx`) into `run_codebase_scan()` in `tests/e2e/run_all.py` allows continuous static verification of Milestone 3 status via `python tests/e2e/run_all.py --scan-codebase`.

---

## 5. Verification Method

### 5.1 Independent Codebase Scan Verification
Run the following python command from repository root (`d:/Projetos/escolar`):
```bash
python -c "import os; from tests.e2e.harness.ast_codebase_scanner import scan_section_file; [print(f'{name:25}: is_refactored={r[\"is_refactored\"]}, sp={r[\"uses_use_search_params\"]}, reads_tab={r[\"reads_tab_param\"]}, local_tab={r[\"has_local_tab_state\"]}') for name, r in [('AgendaDigitalSection', scan_section_file('frontend/src/components/AgendaDigitalSection.tsx', 'comunicacao', [])), ('SecretariaSection', scan_section_file('frontend/src/components/SecretariaSection.tsx', 'alunos', [])), ('FinanceiroSection', scan_section_file('frontend/src/components/FinanceiroSection.tsx', 'ar', [])), ('PedagocioNutricaoSection', scan_section_file('frontend/src/components/PedagocioNutricaoSection.tsx', 'disciplinas_matriz', []))]]"
```
**Expected Output**:
```
AgendaDigitalSection     : is_refactored=True, sp=True, reads_tab=True, local_tab=False
SecretariaSection        : is_refactored=True, sp=True, reads_tab=True, local_tab=False
FinanceiroSection        : is_refactored=True, sp=True, reads_tab=True, local_tab=False
PedagocioNutricaoSection : is_refactored=False, sp=False, reads_tab=False, local_tab=True
```

### 5.2 TypeScript Build & Typecheck Verification
In `frontend/`:
```bash
npx tsc --noEmit
```
**Expected Output**: Clean exit with code 0 and zero errors.

### 5.3 Automated E2E Navigation Suite
In repository root:
```bash
python tests/e2e/run_all.py
```
**Expected Output**:
`Total Tests Executed: 71, Total Passed: 71, Total Failed: 0` with exit code 0.

### 5.4 Invalidation Conditions
- Any introduction of `useState<...ar...>` in `FinanceiroSection.tsx`.
- Removing `useSearchParams` from `FinanceiroSection.tsx`.
- Refactoring `PedagocioNutricaoSection.tsx` without maintaining fallback to `'disciplinas_matriz'` or omitting `'tri'`.
- Deleting contextual modal states in `PedagocioNutricaoSection.tsx`.
