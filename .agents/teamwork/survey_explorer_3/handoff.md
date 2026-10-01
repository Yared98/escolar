# Handoff Report: Section Components & Tab Navigations Survey

**Author**: `survey_explorer_3` (Section Components & Tab Navigations Explorer)  
**Date**: 2026-09-28T13:02:30Z  
**Target Milestone**: Phase 0 (Survey & Discovery) -> Phase 1 (Milestones 1, 2, 3)

---

## 1. Observation

A full codebase search and line-by-line inspection across `d:/Projetos/escolar/frontend/src/components` identified **9 section components** and 3 auxiliary layout/dashboard components.

Among these, exactly **7 section components** manage in-page submenu tabs via local `useState` hooks and render top horizontal tab button bars. The remaining 2 sections (`CalendarioEscolarSection.tsx` and `CrmSection.tsx`) and `PainelEvasao.tsx` / `OverviewDashboard.tsx` have no in-page tab switching.

### Complete Inventory of Tabbed Section Components

```
+------------------------------------+--------------------------+-----------------------+------------------+
| Component File Path                | State Hook & Variable    | Default Value         | Tab Count / Keys |
+------------------------------------+--------------------------+-----------------------+------------------+
| AgendaDigitalSection.tsx           | activeTab / setActiveTab | 'comunicacao'         | 3 tabs           |
| SecretariaSection.tsx              | activeTab / setActiveTab | 'alunos'              | 2 tabs (+action) |
| PedagocioNutricaoSection.tsx       | activeTab / setActiveTab | 'disciplinas_matriz'  | 6 tabs           |
| FinanceiroSection.tsx              | activeSubTab/setActive...| 'ar'                  | 4 tabs           |
| AdministrativoSection.tsx          | subTab / setSubTab       | 'envios'              | 4 tabs           |
| PortalAlunoSection.tsx             | activeTab / setActiveTab | 'boletim'             | 4 tabs           |
| AcademicoSection.tsx               | viewMode / setViewMode   | 'fundamental'         | 2 tabs           |
+------------------------------------+--------------------------+-----------------------+------------------+
```

---

### Deep Dive Catalog by Component

#### 1. `frontend/src/components/AgendaDigitalSection.tsx`
- **File Path**: `frontend/src/components/AgendaDigitalSection.tsx`
- **Current Tab State Hook**:
  - Line 45: `const [activeTab, setActiveTab] = useState<'comunicacao' | 'rotina' | 'whatsapp'>('comunicacao');`
  - Hook name: `activeTab` / `setActiveTab`
  - Default value: `'comunicacao'`
- **Internal Tab Options**:
  1. Key: `'comunicacao'` | Label: `"Mensagens & Mural"` | Icon: `MessageSquare`
  2. Key: `'rotina'` | Label: `"Resumo de Rotina"` | Icon: `HeartPulse`
  3. Key: `'whatsapp'` | Label: `"WhatsApp (Transbordo)"` | Icon: `MessageCircle`
- **Horizontal Tab Bar UI Markup (Lines 148-184)**:
  ```tsx
  <div className="flex flex-wrap gap-2">
    <button
      onClick={() => setActiveTab('comunicacao')}
      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
        activeTab === 'comunicacao'
          ? 'bg-salvia-700 text-white dark:bg-salvia-500'
          : 'bg-salvia-50 dark:bg-salvia-950 text-salvia-800 dark:text-salvia-200 hover:bg-salvia-100'
      }`}
    >
      <MessageSquare className="w-3.5 h-3.5" />
      <span>Mensagens & Mural</span>
    </button>

    <button
      onClick={() => setActiveTab('rotina')}
      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
        activeTab === 'rotina'
          ? 'bg-salvia-700 text-white dark:bg-salvia-500'
          : 'bg-salvia-50 dark:bg-salvia-950 text-salvia-800 dark:text-salvia-200 hover:bg-salvia-100'
      }`}
    >
      <HeartPulse className="w-3.5 h-3.5" />
      <span>Resumo de Rotina</span>
    </button>

    <button
      onClick={() => setActiveTab('whatsapp')}
      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
        activeTab === 'whatsapp'
          ? 'bg-salvia-700 text-white dark:bg-salvia-500'
          : 'bg-salvia-50 dark:bg-salvia-950 text-salvia-800 dark:text-salvia-200 hover:bg-salvia-100'
      }`}
    >
      <MessageCircle className="w-3.5 h-3.5" />
      <span>WhatsApp (Transbordo)</span>
    </button>
  </div>
  ```
- **Conditional Content Rendering**:
  - Line 187: `{activeTab === 'rotina' && rotina && (` -> Visualização familiar de rotina infantil (alimentação, soneca, fraldas, humor, observação pedagógica).
  - Line 231: `{activeTab === 'comunicacao' && (` -> Mural da turma, mensagens 1:1, canais auditáveis e formulário de broadcast.
  - Line 363: `{activeTab === 'whatsapp' && (` -> Transbordo humano do chatbot WhatsApp, protocolos e respostas.

---

#### 2. `frontend/src/components/SecretariaSection.tsx`
- **File Path**: `frontend/src/components/SecretariaSection.tsx`
- **Current Tab State Hook**:
  - Line 48: `const [activeTab, setActiveTab] = useState<'alunos' | 'turmas' | 'educacenso'>('alunos');`
  - Hook name: `activeTab` / `setActiveTab`
  - Default value: `'alunos'`
- **Internal Tab Options**:
  1. Key: `'alunos'` | Label: `"Alunos & Matrículas ({alunos.length})"` | Icon: `Users`
  2. Key: `'turmas'` | Label: `"Turmas & Ensalamento ({turmas.length})"` | Icon: `BookOpen`
  *(Note: `'educacenso'` exists only as an unrendered union type member).*
- **Horizontal Tab Bar UI Markup (Lines 730-777)**:
  ```tsx
  <div className="flex flex-wrap gap-2">
    <button
      onClick={() => setActiveTab('alunos')}
      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
        activeTab === 'alunos'
          ? 'bg-salvia-700 text-white dark:bg-salvia-500'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200'
      }`}
    >
      <Users className="w-3.5 h-3.5" />
      <span>Alunos & Matrículas ({alunos.length})</span>
    </button>

    <button
      onClick={() => setActiveTab('turmas')}
      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
        activeTab === 'turmas'
          ? 'bg-salvia-700 text-white dark:bg-salvia-500'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200'
      }`}
    >
      <BookOpen className="w-3.5 h-3.5" />
      <span>Turmas & Ensalamento ({turmas.length})</span>
    </button>

    {activeTab === 'alunos' ? (
      <button
        onClick={() => {
          setFormError(null);
          setFormSuccess(null);
          setModalTab('dados_aluno');
          setShowModal(true);
        }}
        className="bg-salvia-700 dark:bg-salvia-600 hover:bg-salvia-800 dark:hover:bg-salvia-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-sm"
      >
        <PlusCircle className="w-4 h-4" />
        <span>+ Nova Matrícula Completa</span>
      </button>
    ) : (
      <button
        onClick={() => setShowTurmaModal(true)}
        className="bg-salvia-700 dark:bg-salvia-600 hover:bg-salvia-800 dark:hover:bg-salvia-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-sm"
      >
        <PlusCircle className="w-4 h-4" />
        <span>Criar Nova Turma</span>
      </button>
    )}
  </div>
  ```
- **Conditional Content Rendering**:
  - Line 755: Contextual action button rendered inside header container (`+ Nova Matrícula Completa` vs `Criar Nova Turma`).
  - Line 781: `{activeTab === 'alunos' ? (` -> Alunos search input, master data table (CPF, Legal/Fin guardians, contact, emergency, actions).
  - Line 899: `) : (` -> Turmas cards, capacity metrics, visual occupancy progress bar, "Ver Alunos & Chamada", "Enturmar", "Excluir".

---

#### 3. `frontend/src/components/PedagocioNutricaoSection.tsx`
- **File Path**: `frontend/src/components/PedagocioNutricaoSection.tsx`
- **Current Tab State Hook**:
  - Lines 124-126:
    ```tsx
    const [activeTab, setActiveTab] = useState<
      'disciplinas_matriz' | 'atribuicao_horarios' | 'turmas' | 'projetos' | 'nutricao' | 'tri'
    >('disciplinas_matriz');
    ```
  - Hook name: `activeTab` / `setActiveTab`
  - Default value: `'disciplinas_matriz'`
- **Internal Tab Options**:
  1. Key: `'disciplinas_matriz'` | Label: `"Disciplinas & Matriz"` | Icon: `Layers`
  2. Key: `'atribuicao_horarios'` | Label: `"Atribuição & Horários"` | Icon: `Clock`
  3. Key: `'turmas'` | Label: `"Visão das Turmas ({turmas.length})"` | Icon: `Users`
  4. Key: `'projetos'` | Label: `"Projetos BNCC"` | Icon: `Sparkles`
  5. Key: `'nutricao'` | Label: `"Planner de Nutrição"` | Icon: `Utensils`
  6. Key: `'tri'` | Label: `"Simulados TRI (IA Preditiva)"` | Icon: `BrainCircuit` (Rendered view panel at line 650)
- **Horizontal Tab Bar UI Markup (Lines 559-619)**:
  ```tsx
  <div className="flex flex-wrap gap-1.5">
    <button
      onClick={() => setActiveTab('disciplinas_matriz')}
      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
        activeTab === 'disciplinas_matriz'
          ? 'bg-salvia-700 text-white dark:bg-salvia-500 shadow-sm'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200'
      }`}
    >
      <Layers className="w-3.5 h-3.5" />
      <span>Disciplinas & Matriz</span>
    </button>
    {/* Buttons for atribuicao_horarios, turmas, projetos, nutricao */}
  </div>
  ```
- **Conditional Content Rendering**:
  - Line 650: `{activeTab === 'tri' && (` -> Simulados Preditivos TRI & IA Preditiva.
  - Line 703: `{activeTab === 'disciplinas_matriz' && (` -> Matriz Curricular & BNCC.
  - Line 869: `{activeTab === 'atribuicao_horarios' && (` -> Grade Horária e Atribuição Docente.
  - Line 995: `{activeTab === 'turmas' && (` -> Visão das Turmas Pedagógicas.
  - Line 1050: `{activeTab === 'projetos' && (` -> Projetos Integradores BNCC.
  - Line 1089: `{activeTab === 'nutricao' && (` -> Cardápios e Restrições Alimentares.

---

#### 4. `frontend/src/components/FinanceiroSection.tsx`
- **File Path**: `frontend/src/components/FinanceiroSection.tsx`
- **Current Tab State Hook**:
  - Line 57: `const [activeSubTab, setActiveSubTab] = useState<'ar' | 'ap' | 'nfse' | 'bi' | 'conciliacao'>('ar');`
  - Hook name: `activeSubTab` / `setActiveSubTab`
  - Default value: `'ar'`
- **Internal Tab Options**:
  1. Key: `'ar'` | Label: `"Faturas & Mensalidades (AR)"` | Icon: `ArrowDownLeft`
  2. Key: `'ap'` | Label: `"Despesas & Fornecedores (AP)"` | Icon: `ArrowUpRight`
  3. Key: `'nfse'` | Label: `"NFS-e Automatizada"` | Icon: `FileText`
  4. Key: `'bi'` | Label: `"Demonstrativo DRE & DFC"` | Icon: `PieChart`
- **Horizontal Tab Bar UI Markup (Lines 411-459)**:
  ```tsx
  <div className="flex flex-wrap gap-2 mb-6 border-b border-salvia-200 dark:border-salvia-800 pb-2">
    <button onClick={() => setActiveSubTab('ar')} className={`...`}>
      <ArrowDownLeft className="w-3.5 h-3.5" />
      <span>Faturas & Mensalidades (AR)</span>
    </button>
    <button onClick={() => setActiveSubTab('ap')} className={`...`}>
      <ArrowUpRight className="w-3.5 h-3.5" />
      <span>Despesas & Fornecedores (AP)</span>
    </button>
    <button onClick={() => setActiveSubTab('nfse')} className={`...`}>
      <FileText className="w-3.5 h-3.5" />
      <span>NFS-e Automatizada</span>
    </button>
    <button onClick={() => setActiveSubTab('bi')} className={`...`}>
      <PieChart className="w-3.5 h-3.5" />
      <span>Demonstrativo DRE & DFC</span>
    </button>
  </div>
  ```
- **Conditional Content Rendering**:
  - Line 462: `{activeSubTab === 'ar' && (` -> Contas a Receber, faturas e conciliação bancária Pix.
  - Line 576: `{activeSubTab === 'ap' && (` -> Contas a Pagar, boletos de fornecedores.
  - Line 637: `{activeSubTab === 'nfse' && (` -> Lotes de emissão de NFS-e.
  - Line 655: `{activeSubTab === 'bi' && (` -> Demonstrativo do Resultado (DRE) e Fluxo de Caixa (DFC).

---

#### 5. `frontend/src/components/AdministrativoSection.tsx`
- **File Path**: `frontend/src/components/AdministrativoSection.tsx`
- **Current Tab State Hook**:
  - Line 40: `const [subTab, setSubTab] = useState<'entidades' | 'fornecedores' | 'relatorios' | 'envios' | 'lms_config'>('envios');`
  - Hook name: `subTab` / `setSubTab`
  - Default value: `'envios'`
- **Internal Tab Options**:
  1. Key: `'envios'` | Label: `"Registro de Envios (Audit)"` | Icon: `Send`
  2. Key: `'entidades'` | Label: `"Corpo Docente & RH"` | Icon: `UserCheck`
  3. Key: `'fornecedores'` | Label: `"Fornecedores"` | Icon: `Truck`
  4. Key: `'relatorios'` | Label: `"Auditoria LGPD"` | Icon: `ShieldCheck`
- **Horizontal Tab Bar UI Markup (Lines 194-242)**:
  Container `<div className="flex flex-wrap gap-2">` with 4 `<button>` elements.
- **Conditional Content Rendering**:
  - Line 246: `{subTab === 'envios' && (` -> Tabela de envios e despachos auditáveis.
  - Line 306: `{subTab === 'entidades' && (` -> Tabela de funcionários e gestão de RH.
  - Line 350: `{subTab === 'fornecedores' && (` -> Fornecedores homologados e contratos.
  - Line 391: `{subTab === 'relatorios' && (` -> Logs e auditoria de conformidade LGPD.

---

#### 6. `frontend/src/components/PortalAlunoSection.tsx`
- **File Path**: `frontend/src/components/PortalAlunoSection.tsx`
- **Current Tab State Hook**:
  - Line 97: `const [activeTab, setActiveTab] = useState<'boletim' | 'financeiro' | 'diploma' | 'rotina' | 'portfolio'>('boletim');`
  - Hook name: `activeTab` / `setActiveTab`
  - Default value: `'boletim'`
- **Internal Tab Options**:
  1. Key: `'boletim'` | Label: `"Boletim & Desempenho"` | Icon: `FileText`
  2. Key: `'financeiro'` | Label: `"Financeiro & Mensalidades Pix"` | Icon: `CreditCard`
  3. Key: `'diploma'` | Label: `"Documentos & Diploma MEC"` | Icon: `Award`
  4. Key: `'rotina'` | Label: `"Rotina & Diário Escolar"` | Icon: `Baby`
- **Horizontal Tab Bar UI Markup (Lines 293-341)**:
  Container `<div className="flex border-b border-salvia-200 dark:border-salvia-800 overflow-x-auto gap-2 pb-1">` with 4 buttons.
- **Conditional Content Rendering & Data Fetching**:
  - Lines 152-225: `loadTabData` depends directly on `[selectedAlunoId, activeTab]` in its `useCallback` dependency array. As `activeTab` changes, `loadTabData` automatically fetches the corresponding tab sub-resource!
  - Line 359: `{activeTab === 'boletim' && (` -> Boletim escolar bimestral.
  - Line 483: `{activeTab === 'financeiro' && (` -> Faturas e boletos familiares.
  - Line 615: `{activeTab === 'diploma' && (` -> Diploma digital MEC com QR code e assinatura ICP-Brasil.
  - Line 687: `{activeTab === 'rotina' && (` -> Diário do dia da criança.

---

#### 7. `frontend/src/components/AcademicoSection.tsx`
- **File Path**: `frontend/src/components/AcademicoSection.tsx`
- **Current Tab State Hook**:
  - Line 49: `const [viewMode, setViewMode] = useState<'fundamental' | 'infantil'>('fundamental');`
  - Hook name: `viewMode` / `setViewMode`
  - Default value: `'fundamental'`
- **Internal Tab / ViewMode Options**:
  1. Key: `'fundamental'` | Label: `"Chamada Touch (Fundamental/Médio)"` | Icon: `Smartphone`
  2. Key: `'infantil'` | Label: `"Rotina (Educação Infantil)"` | Icon: `Baby`
- **Horizontal Tab Bar UI Markup (Lines 460-486)**:
  Container `<div className="flex bg-salvia-100 dark:bg-salvia-800 p-1 rounded-xl shrink-0">` with 2 buttons.
- **Conditional Content Rendering**:
  - Line 503: `{viewMode === 'fundamental' && (` -> Grade de chamada com suporte offline via IndexedDB.
  - Line 739: `{viewMode === 'infantil' && (` -> Painel de diário infantil da professora.

---

## 2. Logic Chain

1. **Acceptance Criteria Requirement (R2 & Rubric)**:
   - "At least 3 section components (e.g., AgendaDigitalSection.tsx, SecretariaSection.tsx) no longer contain local useState for tab switching."
   - "The *Section.tsx components read the active tab from the URL (via useSearchParams or equivalent) to determine what content to render."
   - "The old horizontal tab UI elements (buttons changing local tabs) are completely removed from the section components."

2. **From Observation to Replacement Strategy**:
   - In Next.js 14 App Router, `useSearchParams` is imported from `'next/navigation'`.
   - Every section component is rendered dynamically in `app/page.tsx` with `ssr: false`, ensuring pure client-side execution.
   - For any component, reading `const searchParams = useSearchParams();` and extracting `const activeTab = searchParams.get('tab') || '<default_tab>';` gives immediate URL-synchronized reactive state.
   - When the URL changes to `?tab=rotina`, React re-renders the component with the new parameter value.

3. **Safe Fallback & Whitelist Invariant**:
   - If `?tab=` is absent from the URL (e.g., navigating directly to the section), each component must fall back to its canonical default (e.g., `comunicacao` in Agenda, `alunos` in Secretaria, `disciplinas_matriz` in Pedagógico).
   - If an unrecognized query param is passed (e.g., `?tab=invalid`), using a fallback or whitelist prevents rendering blank content.

4. **Preservation of Contextual Header Actions**:
   - In `SecretariaSection.tsx`, the tab container holds both the 2 tab buttons and a modal action button (`+ Nova Matrícula Completa` or `Criar Nova Turma`).
   - Removing the whole `div` would mistakenly eliminate the student enrollment / turma creation buttons!
   - Therefore, the migration plan isolates and preserves the action buttons while removing only the tab switching buttons.

5. **Pruning Unused Imports**:
   - In components where tab icons are only used on the removed buttons (e.g., `MessageSquare` and `HeartPulse` in `AgendaDigitalSection.tsx`), they should be cleanly removed from the `lucide-react` import statement to prevent lint warnings.

---

## 3. Caveats

1. **Next.js `useSearchParams()` Suspense Boundary**:
   - In Next.js App Router, components calling `useSearchParams()` during SSR must be wrapped in a `<Suspense>` boundary. Because `app/page.tsx` loads sections with `dynamic(..., { ssr: false })`, SSR hydration mismatch is avoided. However, ensuring `app/page.tsx` contains a `<Suspense fallback={<SectionSkeleton />}>` around `<Sidebar>` and the main content area is recommended best practice.
2. **Synchronizing Route and Tab**:
   - When navigating between different main sections (e.g., from `secretaria` to `agenda`), the URL query param `?tab=` should be set to the target section's default tab (e.g., `?tab=comunicacao`) or cleared to avoid carrying over a non-matching `?tab=alunos` into Agenda.
3. **Modal Tabs vs Section Tabs**:
   - In `SecretariaSection.tsx`, `modalTab` (`dados_aluno`, `responsaveis`, `endereco_contato`, `prontuario`) is an internal dialog state, NOT a page submenu. It must remain local `useState` within the modal and not be touched.

---

## 4. Conclusion & Actionable Migration Plan

### Section Qualification Summary
There are **7 qualified section components** available for migration. This far exceeds the acceptance requirement of at least 3 components.

We recommend decomposing the migration across implementation milestones:
- **Milestone 2 (Core Priority)**: `AgendaDigitalSection.tsx` and `SecretariaSection.tsx`.
- **Milestone 3 (Extended Sections)**: `PedagocioNutricaoSection.tsx` and `FinanceiroSection.tsx` (optionally followed by `AdministrativoSection.tsx`, `PortalAlunoSection.tsx`, and `AcademicoSection.tsx`).

---

### Concrete Code Transformations

#### Component A: `AgendaDigitalSection.tsx`
1. **Import adjustment**:
   ```diff
   - import React, { useState, useEffect, useCallback } from 'react';
   + import React, { useState, useEffect, useCallback } from 'react';
   + import { useSearchParams } from 'next/navigation';
   - import { Smartphone, MessageSquare, HeartPulse, Send, CheckCircle2, Clock, ShieldCheck, Plus, Smile, MessageCircle } from 'lucide-react';
   + import { Smartphone, Send, CheckCircle2, Clock, ShieldCheck, Plus, Smile, MessageCircle } from 'lucide-react';
   ```

2. **State replacement**:
   ```diff
   - const [activeTab, setActiveTab] = useState<'comunicacao' | 'rotina' | 'whatsapp'>('comunicacao');
   + const searchParams = useSearchParams();
   + const tabParam = searchParams.get('tab');
   + const activeTab: 'comunicacao' | 'rotina' | 'whatsapp' = 
   +   tabParam === 'rotina' || tabParam === 'whatsapp' ? tabParam : 'comunicacao';
   ```

3. **Header tab bar removal**:
   Remove lines 148-184 entirely.

---

#### Component B: `SecretariaSection.tsx`
1. **Import adjustment**:
   ```diff
   - import React, { useState, useEffect, useCallback } from 'react';
   + import React, { useState, useEffect, useCallback } from 'react';
   + import { useSearchParams } from 'next/navigation';
   ```

2. **State replacement**:
   ```diff
   - const [activeTab, setActiveTab] = useState<'alunos' | 'turmas' | 'educacenso'>('alunos');
   + const searchParams = useSearchParams();
   + const tabParam = searchParams.get('tab');
   + const activeTab: 'alunos' | 'turmas' = tabParam === 'turmas' ? 'turmas' : 'alunos';
   ```

3. **Tab bar transformation (Preserving Action Buttons)**:
   ```diff
   - <div className="flex flex-wrap gap-2">
   -   <button onClick={() => setActiveTab('alunos')} className={`...`}>
   -     <Users className="w-3.5 h-3.5" />
   -     <span>Alunos & Matrículas ({alunos.length})</span>
   -   </button>
   -   <button onClick={() => setActiveTab('turmas')} className={`...`}>
   -     <BookOpen className="w-3.5 h-3.5" />
   -     <span>Turmas & Ensalamento ({turmas.length})</span>
   -   </button>
   + <div className="flex flex-wrap gap-2">
       {activeTab === 'alunos' ? (
         <button
           onClick={() => {
             setFormError(null);
             setFormSuccess(null);
             setModalTab('dados_aluno');
             setShowModal(true);
           }}
           className="bg-salvia-700 dark:bg-salvia-600 hover:bg-salvia-800 dark:hover:bg-salvia-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-sm"
         >
           <PlusCircle className="w-4 h-4" />
           <span>+ Nova Matrícula Completa</span>
         </button>
       ) : (
         <button
           onClick={() => setShowTurmaModal(true)}
           className="bg-salvia-700 dark:bg-salvia-600 hover:bg-salvia-800 dark:hover:bg-salvia-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-sm"
         >
           <PlusCircle className="w-4 h-4" />
           <span>Criar Nova Turma</span>
         </button>
       )}
     </div>
   ```

---

#### Component C: `PedagocioNutricaoSection.tsx`
1. **Import & State replacement**:
   ```diff
   + import { useSearchParams } from 'next/navigation';
   ...
   - const [activeTab, setActiveTab] = useState<
   -   'disciplinas_matriz' | 'atribuicao_horarios' | 'turmas' | 'projetos' | 'nutricao' | 'tri'
   - >('disciplinas_matriz');
   + const searchParams = useSearchParams();
   + const tabParam = searchParams.get('tab');
   + const validTabs = ['disciplinas_matriz', 'atribuicao_horarios', 'turmas', 'projetos', 'nutricao', 'tri'] as const;
   + const activeTab = (validTabs.includes(tabParam as any) ? tabParam : 'disciplinas_matriz') as typeof validTabs[number];
   ```

2. **Tab bar removal**:
   Remove lines 559-619 (`<div className="flex flex-wrap gap-1.5">...</div>`).

---

#### Component D: `FinanceiroSection.tsx`
1. **Import & State replacement**:
   ```diff
   + import { useSearchParams } from 'next/navigation';
   ...
   - const [activeSubTab, setActiveSubTab] = useState<'ar' | 'ap' | 'nfse' | 'bi' | 'conciliacao'>('ar');
   + const searchParams = useSearchParams();
   + const tabParam = searchParams.get('tab');
   + const validSubTabs = ['ar', 'ap', 'nfse', 'bi'] as const;
   + const activeSubTab = (validSubTabs.includes(tabParam as any) ? tabParam : 'ar') as typeof validSubTabs[number];
   ```

2. **Tab bar removal**:
   Remove lines 411-459 (`<div className="flex flex-wrap gap-2 mb-6 border-b border-salvia-200 dark:border-salvia-800 pb-2">...</div>`).

---

## 5. Verification Method

To independently verify this inventory and validate the future refactoring:

1. **Verify Tab State Presence**:
   Inspect line numbers in the target files:
   - `frontend/src/components/AgendaDigitalSection.tsx`: lines 45, 148-184.
   - `frontend/src/components/SecretariaSection.tsx`: lines 48, 730-777.
   - `frontend/src/components/PedagocioNutricaoSection.tsx`: lines 124-126, 559-619.
   - `frontend/src/components/FinanceiroSection.tsx`: lines 57, 411-459.

2. **Verification Command (Automated Grep Inspection)**:
   Run via terminal:
   ```pwsh
   Get-ChildItem -Path "frontend/src/components" -Filter "*Section.tsx" | Select-String -Pattern "const \[(activeTab|subTab|activeSubTab|viewMode)"
   ```
   Ensures all tab hooks are tracked and confirms their eventual replacement by `useSearchParams`.

3. **Frontend Build & Lint Verification**:
   ```pwsh
   cd frontend
   npm run lint
   npm run build
   ```
   Confirms TypeScript compilation, absence of unused variables, and Next.js App Router query parameter compatibility.

4. **Invalidation Conditions**:
   - If Next.js App Router complains about `useSearchParams()` without a `<Suspense>` boundary during `npm run build`, wrap the section dynamic imports in `app/page.tsx` within `<React.Suspense>`.
   - If an action button disappears from `SecretariaSection.tsx`, verify line 755 was retained in the header container.
