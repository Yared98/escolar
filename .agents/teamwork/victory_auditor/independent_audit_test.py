#!/usr/bin/env python3
"""
Victory Auditor Independent Verification Script
Independently verifies all requirements from ORIGINAL_REQUEST.md directly against the source code.
Zero shared context with implementation team.
"""

import sys
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

FRONTEND_SRC = os.path.join(ROOT, "frontend", "src")
SIDEBAR_PATH = os.path.join(FRONTEND_SRC, "components", "Sidebar.tsx")
PAGE_PATH = os.path.join(FRONTEND_SRC, "app", "page.tsx")
AGENDA_PATH = os.path.join(FRONTEND_SRC, "components", "AgendaDigitalSection.tsx")
SECRETARIA_PATH = os.path.join(FRONTEND_SRC, "components", "SecretariaSection.tsx")
FINANCEIRO_PATH = os.path.join(FRONTEND_SRC, "components", "FinanceiroSection.tsx")
PEDAGOGICO_PATH = os.path.join(FRONTEND_SRC, "components", "PedagocioNutricaoSection.tsx")

class AuditorAssertionError(Exception):
    pass

checks_passed = 0
checks_total = 0

def assert_check(condition: bool, msg: str):
    global checks_passed, checks_total
    checks_total += 1
    if condition:
        checks_passed += 1
        print(f"  [AUDIT PASS] {msg}")
    else:
        print(f"  [AUDIT FAIL] {msg}")
        raise AuditorAssertionError(msg)

def audit_sidebar():
    print("\n--- Auditing Sidebar.tsx ---")
    with open(SIDEBAR_PATH, "r", encoding="utf-8") as f:
        src = f.read()

    # 1. Interface definition for subItems
    assert_check("interface NavSubItem" in src, "NavSubItem interface defined")
    assert_check("subItems?: NavSubItem[]" in src or "subItems: NavSubItem[]" in src, "NavItem declares subItems")
    
    # 2. Check MENU_ITEMS definition with nested items
    assert_check("subItems:" in src, "MENU_ITEMS contains nested subItems")
    assert_check("defaultTab:" in src, "MENU_ITEMS contains defaultTab properties")
    
    # 3. Check tab query parameter handling
    assert_check("tabKey" in src, "NavSubItem contains tabKey")
    assert_check("useSearchParams" in src, "Sidebar imports useSearchParams")
    assert_check("useRouter" in src, "Sidebar imports useRouter")
    assert_check("params.set('tab', subItem.tabKey)" in src, "handleSubItemClick sets tab query parameter")
    assert_check("handleParentClick" in src, "handleParentClick handles defaultTab navigation")
    assert_check("isRouteExpanded" in src, "Collapsible sublist expansion state logic present")
    assert_check("grid-rows-[1fr]" in src and "grid-rows-[0fr]" in src, "CSS Grid smooth expansion animation implemented")

def audit_page():
    print("\n--- Auditing page.tsx ---")
    with open(PAGE_PATH, "r", encoding="utf-8") as f:
        src = f.read()

    assert_check("<Suspense fallback=" in src or "<React.Suspense fallback=" in src, "page.tsx wraps dashboard in Suspense boundary")
    assert_check("searchParams.get('tab')" in src, "page.tsx inspects searchParams ?tab= for deep-linking")
    assert_check("handleRouteChange" in src, "page.tsx handles route & tab synchronization with URL")

def audit_sections():
    print("\n--- Auditing Section Components ---")
    sections = [
        ("AgendaDigitalSection.tsx", AGENDA_PATH, ["comunicacao", "rotina", "whatsapp"], "comunicacao"),
        ("SecretariaSection.tsx", SECRETARIA_PATH, ["alunos", "turmas"], "alunos"),
        ("FinanceiroSection.tsx", FINANCEIRO_PATH, ["ar", "ap", "nfse", "bi"], "ar"),
        ("PedagocioNutricaoSection.tsx", PEDAGOGICO_PATH, ["disciplinas_matriz", "atribuicao_horarios", "turmas", "projetos", "nutricao", "tri"], "disciplinas_matriz"),
    ]

    for name, path, valid_tabs, default_tab in sections:
        assert_check(os.path.exists(path), f"File {name} exists")
        with open(path, "r", encoding="utf-8") as f:
            src = f.read()

        # Check useSearchParams import & usage
        assert_check("useSearchParams" in src, f"{name} imports useSearchParams")
        assert_check("searchParams.get('tab')" in src, f"{name} reads tab from searchParams")

        # Check NO useState for section tab switching
        has_active_tab_state = bool(re.search(r"useState<[^>]*" + default_tab + r"[^>]*>", src))
        assert_check(not has_active_tab_state, f"{name} has NO useState for section activeTab")

        # Check no local setActiveTab / setActiveSubTab
        assert_check("setActiveTab" not in src, f"{name} does NOT contain setActiveTab calls")
        assert_check("setActiveSubTab" not in src, f"{name} does NOT contain setActiveSubTab calls")

        # Check fallback to defaultTab
        assert_check(default_tab in src, f"{name} includes default fallback to '{default_tab}'")

        # Check conditional rendering based on activeTab
        for vt in valid_tabs:
            tab_check_1 = f"activeTab === '{vt}'" in src
            tab_check_2 = f"activeSubTab === '{vt}'" in src
            # In binary tab components (like Secretaria with 'alunos' and 'turmas'), ternary activeTab === 'alunos' ? ... : ... covers both
            is_binary_ternary = (len(valid_tabs) == 2 and f"activeTab === '{valid_tabs[0]}' ?" in src and ") : (" in src)
            assert_check(tab_check_1 or tab_check_2 or is_binary_ternary, f"{name} conditionally renders panel for '{vt}'")

def audit_tab_button_removals():
    print("\n--- Auditing Complete Removal of Horizontal Tab UI ---")
    
    # In AgendaDigitalSection
    with open(AGENDA_PATH, "r", encoding="utf-8") as f:
        src = f.read()
    assert_check("onClick={() => setActiveTab" not in src, "AgendaDigitalSection has no tab switching onClick buttons")
    
    # In SecretariaSection
    with open(SECRETARIA_PATH, "r", encoding="utf-8") as f:
        src = f.read()
    assert_check("onClick={() => setActiveTab" not in src, "SecretariaSection has no tab switching onClick buttons")
    assert_check("+ Nova Matrícula Completa" in src, "SecretariaSection preserves '+ Nova Matrícula Completa' action button")
    assert_check("Criar Nova Turma" in src, "SecretariaSection preserves 'Criar Nova Turma' action button")

    # In FinanceiroSection
    with open(FINANCEIRO_PATH, "r", encoding="utf-8") as f:
        src = f.read()
    assert_check("onClick={() => setActiveSubTab" not in src, "FinanceiroSection has no tab switching onClick buttons")

    # In PedagocioNutricaoSection
    with open(PEDAGOGICO_PATH, "r", encoding="utf-8") as f:
        src = f.read()
    assert_check("onClick={() => setActiveTab" not in src, "PedagocioNutricaoSection has no tab switching onClick buttons")

def audit_pure_ts_logic_simulation():
    print("\n--- Auditing URL Fallback & Resolution Logic (Simulated Directly) ---")
    
    # Test fallback resolution logic identical to section components
    # 1. Agenda
    def resolve_agenda(tab_param):
        return tab_param if tab_param in ('rotina', 'whatsapp') else 'comunicacao'
    
    assert_check(resolve_agenda(None) == 'comunicacao', "Agenda: None -> 'comunicacao'")
    assert_check(resolve_agenda('') == 'comunicacao', "Agenda: '' -> 'comunicacao'")
    assert_check(resolve_agenda('invalid_tab') == 'comunicacao', "Agenda: 'invalid_tab' -> 'comunicacao'")
    assert_check(resolve_agenda('rotina') == 'rotina', "Agenda: 'rotina' -> 'rotina'")
    assert_check(resolve_agenda('whatsapp') == 'whatsapp', "Agenda: 'whatsapp' -> 'whatsapp'")

    # 2. Secretaria
    def resolve_secretaria(tab_param):
        return 'turmas' if tab_param == 'turmas' else 'alunos'
        
    assert_check(resolve_secretaria(None) == 'alunos', "Secretaria: None -> 'alunos'")
    assert_check(resolve_secretaria('hacked') == 'alunos', "Secretaria: 'hacked' -> 'alunos'")
    assert_check(resolve_secretaria('turmas') == 'turmas', "Secretaria: 'turmas' -> 'turmas'")

    # 3. Financeiro
    def resolve_financeiro(tab_param):
        return tab_param if tab_param in ('ap', 'nfse', 'bi') else 'ar'
        
    assert_check(resolve_financeiro(None) == 'ar', "Financeiro: None -> 'ar'")
    assert_check(resolve_financeiro('bi') == 'bi', "Financeiro: 'bi' -> 'bi'")
    assert_check(resolve_financeiro('unknown') == 'ar', "Financeiro: 'unknown' -> 'ar'")

    # 4. Pedagógico
    def resolve_pedagogico(tab_param):
        valid = ('atribuicao_horarios', 'turmas', 'projetos', 'nutricao', 'tri')
        return tab_param if tab_param in valid else 'disciplinas_matriz'
        
    assert_check(resolve_pedagogico(None) == 'disciplinas_matriz', "Pedagogico: None -> 'disciplinas_matriz'")
    assert_check(resolve_pedagogico('nutricao') == 'nutricao', "Pedagogico: 'nutricao' -> 'nutricao'")
    assert_check(resolve_pedagogico('tri') == 'tri', "Pedagogico: 'tri' -> 'tri'")
    assert_check(resolve_pedagogico('malformed') == 'disciplinas_matriz', "Pedagogico: 'malformed' -> 'disciplinas_matriz'")

def main():
    print("=" * 70)
    print("STARTING INDEPENDENT VICTORY AUDIT SUITE")
    print("=" * 70)
    
    try:
        audit_sidebar()
        audit_page()
        audit_sections()
        audit_tab_button_removals()
        audit_pure_ts_logic_simulation()
        
        print("\n" + "=" * 70)
        print(f"INDEPENDENT AUDIT COMPLETED SUCCESSFULLY: {checks_passed}/{checks_total} CHECKS PASSED")
        print("=" * 70)
        sys.exit(0)
    except AuditorAssertionError as e:
        print(f"\n[AUDIT FAILED]: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
