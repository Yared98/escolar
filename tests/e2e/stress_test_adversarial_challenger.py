#!/usr/bin/env python3
"""
Adversarial Challenger Empirical Stress Test Suite (Milestone 3 Verification)
Author: challenger_m3_2 (Empirical Adversarial Verifier)
Target: Cross-section navigation, deep linking, browser history push/pop, and 4-section AST invariants.
"""

import sys
import os
import re
from typing import List, Dict, Any

# Ensure repo root is on path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from tests.e2e.harness.navigation_engine import AppNavigationRouter, CANONICAL_MENU_ITEMS
from tests.e2e.harness.ast_codebase_scanner import scan_sidebar_file, scan_page_file, scan_section_file
from tests.e2e.harness.dom_contract_oracle import SECTION_TAB_REMOVAL_SPECS

class StressTestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors: List[str] = []

    def check(self, condition: bool, description: str):
        if condition:
            self.passed += 1
            print(f"  [PASS] {description}")
        else:
            self.failed += 1
            err_msg = f"  [FAIL] {description}"
            print(err_msg)
            self.errors.append(err_msg)

result = StressTestResult()

def print_header(title: str):
    print("\n" + "=" * 80)
    print(f"[TEST CATEGORY] {title}")
    print("=" * 80)

# ==============================================================================
# SECTION 1: Deep Linking Across All 4 Refactored Sections
# ==============================================================================
print_header("1. Deep Linking Scenarios Across All 4 Sections")

# Scenario 1.1: Direct navigation to /?route=financeiro&tab=bi
r1 = AppNavigationRouter("/?route=financeiro&tab=bi")
result.check(r1.active_route == "financeiro", "1.1: Direct link /?route=financeiro&tab=bi resolves active_route='financeiro'")
result.check(r1.search_params.get("tab") == "bi", "1.1: search_params.get('tab') == 'bi'")
result.check(r1.resolve_financeiro_active_tab() == "bi", "1.1: resolve_financeiro_active_tab() == 'bi'")
result.check(r1.is_sub_item_active("financeiro", "bi"), "1.1: Sidebar sub-item 'fin-bi' is active")
result.check(not r1.is_sub_item_active("financeiro", "ar"), "1.1: Sub-item 'fin-ar' is inactive")
result.check(not r1.is_sub_item_active("financeiro", "ap"), "1.1: Sub-item 'fin-ap' is inactive")
result.check(not r1.is_sub_item_active("financeiro", "nfse"), "1.1: Sub-item 'fin-nfse' is inactive")

# Scenario 1.2: Direct navigation to /?route=pedagogico&tab=nutricao
r2 = AppNavigationRouter("/?route=pedagogico&tab=nutricao")
result.check(r2.active_route == "pedagogico", "1.2: Direct link /?route=pedagogico&tab=nutricao resolves active_route='pedagogico'")
result.check(r2.search_params.get("tab") == "nutricao", "1.2: search_params.get('tab') == 'nutricao'")
result.check(r2.resolve_pedagogico_active_tab() == "nutricao", "1.2: resolve_pedagogico_active_tab() == 'nutricao'")
result.check(r2.is_sub_item_active("pedagogico", "nutricao"), "1.2: Sidebar sub-item 'ped-nutricao' is active")
result.check(not r2.is_sub_item_active("pedagogico", "disciplinas_matriz"), "1.2: Sub-item 'ped-matriz' is inactive")
result.check(not r2.is_sub_item_active("pedagogico", "projetos"), "1.2: Sub-item 'ped-projetos' is inactive")

# Scenario 1.3: Direct navigation to /?route=secretaria&tab=turmas
r3 = AppNavigationRouter("/?route=secretaria&tab=turmas")
result.check(r3.active_route == "secretaria", "1.3: Direct link /?route=secretaria&tab=turmas resolves active_route='secretaria'")
result.check(r3.search_params.get("tab") == "turmas", "1.3: search_params.get('tab') == 'turmas'")
result.check(r3.resolve_secretaria_active_tab() == "turmas", "1.3: resolve_secretaria_active_tab() == 'turmas'")
result.check(r3.is_sub_item_active("secretaria", "turmas"), "1.3: Sidebar sub-item 'sec-turmas' is active")
result.check(not r3.is_sub_item_active("secretaria", "alunos"), "1.3: Sub-item 'sec-alunos' is inactive")

# Scenario 1.4: Direct navigation to /?route=agenda&tab=rotina
r4 = AppNavigationRouter("/?route=agenda&tab=rotina")
result.check(r4.active_route == "agenda", "1.4: Direct link /?route=agenda&tab=rotina resolves active_route='agenda'")
result.check(r4.search_params.get("tab") == "rotina", "1.4: search_params.get('tab') == 'rotina'")
result.check(r4.resolve_agenda_active_tab() == "rotina", "1.4: resolve_agenda_active_tab() == 'rotina'")
result.check(r4.is_sub_item_active("agenda", "rotina"), "1.4: Sidebar sub-item 'agenda-rotina' is active")
result.check(not r4.is_sub_item_active("agenda", "comunicacao"), "1.4: Sub-item 'agenda-comunicacao' is inactive")
result.check(not r4.is_sub_item_active("agenda", "whatsapp"), "1.4: Sub-item 'agenda-whatsapp' is inactive")

# ==============================================================================
# SECTION 2: Boundary, Fallbacks, and Invariant Whitelist Verification
# ==============================================================================
print_header("2. Boundary & Malformed Parameter Fallbacks")

# 2.1 Missing tab in route
f_none = AppNavigationRouter("/?route=financeiro")
result.check(f_none.resolve_financeiro_active_tab() == "ar", "2.1: /?route=financeiro defaults to tab='ar'")
result.check(f_none.is_sub_item_active("financeiro", "ar"), "2.1: Sub-item 'fin-ar' highlighted as defaultTab")

p_none = AppNavigationRouter("/?route=pedagogico")
result.check(p_none.resolve_pedagogico_active_tab() == "disciplinas_matriz", "2.1: /?route=pedagogico defaults to tab='disciplinas_matriz'")
result.check(p_none.is_sub_item_active("pedagogico", "disciplinas_matriz"), "2.1: Sub-item 'ped-matriz' highlighted as defaultTab")

s_none = AppNavigationRouter("/?route=secretaria")
result.check(s_none.resolve_secretaria_active_tab() == "alunos", "2.1: /?route=secretaria defaults to tab='alunos'")
result.check(s_none.is_sub_item_active("secretaria", "alunos"), "2.1: Sub-item 'sec-alunos' highlighted as defaultTab")

a_none = AppNavigationRouter("/?route=agenda")
result.check(a_none.resolve_agenda_active_tab() == "comunicacao", "2.1: /?route=agenda defaults to tab='comunicacao'")
result.check(a_none.is_sub_item_active("agenda", "comunicacao"), "2.1: Sub-item 'agenda-comunicacao' highlighted as defaultTab")

# 2.2 Invalid / Malformed / Injection tab values
invalid_cases = [
    ("/?route=financeiro&tab=arbitrary_hack", "financeiro", "ar"),
    ("/?route=pedagogico&tab=<script>alert(1)</script>", "pedagogico", "disciplinas_matriz"),
    ("/?route=secretaria&tab=null", "secretaria", "alunos"),
    ("/?route=agenda&tab=undefined", "agenda", "comunicacao"),
    ("/?route=agenda&tab=../secretaria", "agenda", "comunicacao"),
]
for url, route, expected in invalid_cases:
    router = AppNavigationRouter(url)
    if route == "financeiro":
        res = router.resolve_financeiro_active_tab()
    elif route == "pedagogico":
        res = router.resolve_pedagogico_active_tab()
    elif route == "secretaria":
        res = router.resolve_secretaria_active_tab()
    else:
        res = router.resolve_agenda_active_tab()
    result.check(res == expected, f"2.2: {url} safely sanitized to fallback '{expected}'")
    # Subitem check: when tab param is invalid, no sub-item should be active
    has_active_sub = any(router.is_sub_item_active(route, sub.tab_key) for sub in router.get_nav_item(route).sub_items)
    result.check(not has_active_sub, f"2.2: No sub-item highlighted as active for invalid tab in {url}")

# ==============================================================================
# SECTION 3: Browser History Simulation (Push, Pop, Back to Root Without Tab)
# ==============================================================================
print_header("3. Browser History Simulation (Push, Pop, Back to Root)")

class BrowserHistoryStack:
    def __init__(self, initial_url: str = "/"):
        self.stack: List[str] = [initial_url]
        self.current_index = 0
        self.router = AppNavigationRouter(initial_url)

    def navigate(self, url: str):
        # Truncate any forward history and push new url
        self.stack = self.stack[:self.current_index + 1]
        self.stack.append(url)
        self.current_index += 1
        self.router = AppNavigationRouter(url)

    def back(self):
        if self.current_index > 0:
            self.current_index -= 1
            prev_url = self.stack[self.current_index]
            self.router = AppNavigationRouter(prev_url)

    def forward(self):
        if self.current_index < len(self.stack) - 1:
            self.current_index += 1
            next_url = self.stack[self.current_index]
            self.router = AppNavigationRouter(next_url)

# Execute comprehensive browser history journey
history = BrowserHistoryStack("/")
result.check(history.router.active_route == "overview", "3.1: Initial history root / active_route='overview'")
result.check(not history.router.search_params.has("tab"), "3.1: Initial history root has no tab param")

# Push 1: Navigate to Agenda (rotina)
history.navigate("/?route=agenda&tab=rotina")
result.check(history.router.active_route == "agenda" and history.router.resolve_agenda_active_tab() == "rotina",
             "3.2: Pushed /?route=agenda&tab=rotina")

# Push 2: Navigate to Secretaria (turmas)
history.navigate("/?route=secretaria&tab=turmas")
result.check(history.router.active_route == "secretaria" and history.router.resolve_secretaria_active_tab() == "turmas",
             "3.3: Pushed /?route=secretaria&tab=turmas")

# Push 3: Navigate to Financeiro (bi)
history.navigate("/?route=financeiro&tab=bi")
result.check(history.router.active_route == "financeiro" and history.router.resolve_financeiro_active_tab() == "bi",
             "3.4: Pushed /?route=financeiro&tab=bi")

# Push 4: Navigate to Pedagógico (nutricao)
history.navigate("/?route=pedagogico&tab=nutricao")
result.check(history.router.active_route == "pedagogico" and history.router.resolve_pedagogico_active_tab() == "nutricao",
             "3.5: Pushed /?route=pedagogico&tab=nutricao")

# Pop 1: Back to Financeiro (bi)
history.back()
result.check(history.router.active_route == "financeiro" and history.router.resolve_financeiro_active_tab() == "bi",
             "3.6: Pop 1 (Back) successfully restored /?route=financeiro&tab=bi")
result.check(history.router.is_sub_item_active("financeiro", "bi"), "3.6: fin-bi sub-item is active")

# Pop 2: Back to Secretaria (turmas)
history.back()
result.check(history.router.active_route == "secretaria" and history.router.resolve_secretaria_active_tab() == "turmas",
             "3.7: Pop 2 (Back) successfully restored /?route=secretaria&tab=turmas")
result.check(history.router.is_sub_item_active("secretaria", "turmas"), "3.7: sec-turmas sub-item is active")

# Pop 3: Back to Agenda (rotina)
history.back()
result.check(history.router.active_route == "agenda" and history.router.resolve_agenda_active_tab() == "rotina",
             "3.8: Pop 3 (Back) successfully restored /?route=agenda&tab=rotina")
result.check(history.router.is_sub_item_active("agenda", "rotina"), "3.8: agenda-rotina sub-item is active")

# Pop 4: Back to Root (/) without tab param
history.back()
result.check(history.router.active_route == "overview", "3.9: Pop 4 (Back) back to root / resets active_route to 'overview'")
result.check(not history.router.search_params.has("tab"), "3.9: Pop 4 root URL contains no tab param")
result.check(history.router.search_params.get("tab") is None, "3.9: search_params.get('tab') is None")

# Forward 1: Test forward navigation restores Agenda (rotina)
history.forward()
result.check(history.router.active_route == "agenda" and history.router.resolve_agenda_active_tab() == "rotina",
             "3.10: Forward 1 restores /?route=agenda&tab=rotina")

# ==============================================================================
# SECTION 4: Cross-Section In-Page Sub-Item & Parent Click Transitions
# ==============================================================================
print_header("4. Cross-Section Direct Sub-Item & Parent Click Transitions")

sim = AppNavigationRouter("/")

# 4.1 Click parent item 'secretaria' -> should auto-expand, set route=secretaria, tab=alunos
sim.on_parent_click("secretaria")
result.check(sim.active_route == "secretaria", "4.1: on_parent_click('secretaria') sets active_route='secretaria'")
result.check(sim.search_params.get("tab") == "alunos", "4.1: defaultTab 'alunos' appended to query")
result.check(sim.is_route_expanded("secretaria"), "4.1: 'secretaria' is auto-expanded")
result.check(sim.is_sub_item_active("secretaria", "alunos"), "4.1: sub-item 'sec-alunos' is active")

# 4.2 Cross-section click: click sub-item in financeiro while on secretaria
sim.on_sub_item_click("financeiro", "nfse")
result.check(sim.active_route == "financeiro", "4.2: Clicking fin subitem from secretaria switches route to 'financeiro'")
result.check(sim.search_params.get("tab") == "nfse", "4.2: search_params.get('tab') == 'nfse'")
result.check(sim.is_route_expanded("financeiro"), "4.2: 'financeiro' auto-expanded on arrival")
result.check(sim.is_sub_item_active("financeiro", "nfse"), "4.2: sub-item 'fin-nfse' is active")

# 4.3 Cross-section click: click sub-item in pedagogico while on financeiro
sim.on_sub_item_click("pedagogico", "nutricao")
result.check(sim.active_route == "pedagogico", "4.3: Clicking ped subitem switches route to 'pedagogico'")
result.check(sim.search_params.get("tab") == "nutricao", "4.3: search_params.get('tab') == 'nutricao'")
result.check(sim.is_sub_item_active("pedagogico", "nutricao"), "4.3: sub-item 'ped-nutricao' is active")

# 4.4 Cross-section click: click sub-item in agenda while on pedagogico
sim.on_sub_item_click("agenda", "rotina")
result.check(sim.active_route == "agenda", "4.4: Clicking agenda subitem switches route to 'agenda'")
result.check(sim.search_params.get("tab") == "rotina", "4.4: search_params.get('tab') == 'rotina'")
result.check(sim.is_sub_item_active("agenda", "rotina"), "4.4: sub-item 'agenda-rotina' is active")

# ==============================================================================
# SECTION 5: AST Codebase Static Contract & "At Least 3 Sections" Criterion
# ==============================================================================
print_header("5. Physical Source Code AST Audit & Section Component Criterion")

sections_under_test = [
    ("AgendaDigitalSection.tsx", "comunicacao", ["comunicacao", "rotina", "whatsapp"]),
    ("SecretariaSection.tsx", "alunos", ["alunos", "turmas"]),
    ("FinanceiroSection.tsx", "ar", ["ar", "ap", "nfse", "bi"]),
    ("PedagocioNutricaoSection.tsx", "disciplinas_matriz", ["disciplinas_matriz", "atribuicao_horarios", "turmas", "projetos", "nutricao", "tri"]),
]

compliant_section_count = 0

for file_name, default_tab, valid_tabs in sections_under_test:
    file_path = os.path.join(PROJECT_ROOT, "frontend", "src", "components", file_name)
    scan = scan_section_file(file_path, default_tab, valid_tabs)
    
    result.check(scan["exists"], f"5.1: File {file_name} exists")
    result.check(scan["uses_use_search_params"], f"5.1: {file_name} imports and uses useSearchParams")
    result.check(scan["reads_tab_param"], f"5.1: {file_name} reads searchParams.get('tab')")
    result.check(not scan["has_local_tab_state"], f"5.1: {file_name} NO LONGER contains useState for active tab")
    result.check(scan["is_refactored"], f"5.1: {file_name} refactoring flag is_refactored == True")
    
    if scan["is_refactored"]:
        compliant_section_count += 1

# Acceptance Criterion Verification: "At least 3 section components no longer contain local useState"
result.check(compliant_section_count >= 3,
             f"5.2: Acceptance criterion: At least 3 sections refactored. (Found {compliant_section_count} compliant sections: Agenda, Secretaria, Financeiro, Pedagogico)")
result.check(compliant_section_count == 4,
             f"5.2: Extended Milestone 3 goal achieved: ALL 4 sections fully refactored (100% of target scope)")

# ==============================================================================
# SECTION 6: Tab Bar Buttons Removal Verification in Target Components
# ==============================================================================
print_header("6. Horizontal Tab Switcher Bar Removal Verification")

for component_name, spec in SECTION_TAB_REMOVAL_SPECS.items():
    file_path = os.path.join(PROJECT_ROOT, spec["file"])
    with open(file_path, "r", encoding="utf-8") as f:
        code = f.read()

    # None of the removed buttons should appear in the section JSX
    for btn in spec["removed_buttons"]:
        # Escape special characters
        escaped_btn = re.escape(btn)
        # Check if button text appears as a rendered button or switcher element
        matches = re.findall(r'<button[^>]*>.*?<b>?' + escaped_btn + r'.*?</button>', code, re.DOTALL)
        result.check(len(matches) == 0, f"6.1: {component_name} does not render removed tab switcher button '{btn}'")

    # Verify preserved action buttons are present
    for preserved in spec.get("preserved_actions", []):
        result.check(preserved in code, f"6.2: {component_name} preserves essential action button '{preserved}'")

    # Verify preserved modal tabs are present (for Secretaria)
    for mtab in spec.get("preserved_modal_tabs", []):
        result.check(mtab in code, f"6.3: {component_name} preserves internal modal tab '{mtab}'")

# ==============================================================================
# SUMMARY & VERDICT
# ==============================================================================
print("\n" + "=" * 80)
print("ADVERSARIAL STRESS TEST EXECUTION SUMMARY")
print("=" * 80)
print(f"Total Tests Executed: {result.passed + result.failed}")
print(f"Total Passed:        {result.passed}")
print(f"Total Failed:        {result.failed}")
if result.failed == 0:
    print("ALL ADVERSARIAL STRESS TESTS PASSED WITH ZERO REGRESSIONS!")
    sys.exit(0)
else:
    print(f"CRITICAL: {result.failed} STRESS TEST(S) FAILED:")
    for err in result.errors:
        print(f"  - {err}")
    sys.exit(1)
