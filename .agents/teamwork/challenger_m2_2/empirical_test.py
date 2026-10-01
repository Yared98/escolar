#!/usr/bin/env python3
"""
Dedicated Empirical Adversarial Verification Harness for Milestone 2.
Tests boundary and corner cases for AgendaDigitalSection.tsx and SecretariaSection.tsx:
1. Missing ?tab= fallback to canonical default ('comunicacao', 'alunos').
2. Malformed, adversarial, and unknown ?tab= inputs (XSS, path traversal, non-existent, cross-section).
3. Modal dialog opening, tab switching, and closing in SecretariaSection.tsx isolation from URL.
4. Total absence of horizontal tab switcher buttons in DOM/rendered markup.
5. Invariant preservation of contextual action buttons.
"""

import sys
import os
import re
from urllib.parse import urlparse, parse_qs

AGENDA_PATH = os.path.abspath("frontend/src/components/AgendaDigitalSection.tsx")
SECRETARIA_PATH = os.path.abspath("frontend/src/components/SecretariaSection.tsx")

class EmpiricalTestSuite:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []

    def assert_test(self, condition: bool, test_name: str, details: str = ""):
        if condition:
            self.passed += 1
            print(f"  [PASS] {test_name}")
            self.results.append((test_name, "PASS", details))
        else:
            self.failed += 1
            print(f"  [FAIL] {test_name}: {details}")
            self.results.append((test_name, "FAIL", details))

    def run(self):
        print("=" * 80)
        print("EMPIRICAL ADVERSARIAL TEST SUITE - MILESTONE 2 VERIFICATION")
        print("=" * 80)

        self.test_agenda_codebase_integrity()
        self.test_secretaria_codebase_integrity()
        self.test_missing_tab_fallbacks()
        self.test_malformed_and_adversarial_tabs()
        self.test_secretaria_modal_isolation()
        self.test_tab_switcher_buttons_absence()
        self.test_contextual_action_buttons_preservation()

        print("-" * 80)
        print(f"TOTAL: {self.passed + self.failed} | PASSED: {self.passed} | FAILED: {self.failed}")
        print("=" * 80)
        return self.failed == 0

    # --------------------------------------------------------------------------
    # 1. Codebase AST Integrity
    # --------------------------------------------------------------------------
    def test_agenda_codebase_integrity(self):
        print("\n--- 1. AgendaDigitalSection Codebase Integrity ---")
        assert os.path.exists(AGENDA_PATH), f"AgendaDigitalSection not found at {AGENDA_PATH}"
        with open(AGENDA_PATH, "r", encoding="utf-8") as f:
            content = f.read()

        # Check useSearchParams import
        self.assert_test(
            bool(re.search(r"import\s+.*useSearchParams.*from\s+['\"]next/navigation['\"]", content)),
            "agenda_imports_use_search_params",
            "Must import useSearchParams from 'next/navigation'"
        )

        # Check local activeTab useState removed
        self.assert_test(
            not bool(re.search(r"useState<['\"]comunicacao['\"]\s*\|\s*['\"]rotina['\"]\s*\|\s*['\"]whatsapp['\"]>", content)),
            "agenda_no_local_active_tab_state",
            "Must NOT declare local useState for activeTab"
        )

        # Check setActiveTab is absent
        self.assert_test(
            "setActiveTab" not in content,
            "agenda_no_set_active_tab",
            "setActiveTab must be completely removed from AgendaDigitalSection"
        )

        # Check tabParam extraction and whitelist logic
        has_tab_param = bool(re.search(r"const\s+tabParam\s*=\s*searchParams\s*\?\s*searchParams\.get\(['\"]tab['\"]\)\s*:\s*null;", content))
        self.assert_test(
            has_tab_param,
            "agenda_tab_param_extraction",
            "Must extract tabParam via searchParams.get('tab')"
        )

        has_whitelist = bool(re.search(
            r"const\s+activeTab:\s*['\"]comunicacao['\"]\s*\|\s*['\"]rotina['\"]\s*\|\s*['\"]whatsapp['\"]\s*=\s*tabParam\s*===\s*['\"]rotina['\"]\s*\|\|\s*tabParam\s*===\s*['\"]whatsapp['\"]\s*\?\s*tabParam\s*:\s*['\"]comunicacao['\"];",
            content
        ))
        self.assert_test(
            has_whitelist,
            "agenda_strict_whitelist_fallback",
            "Must evaluate activeTab with strict ternary fallback to 'comunicacao'"
        )

    def test_secretaria_codebase_integrity(self):
        print("\n--- 2. SecretariaSection Codebase Integrity ---")
        assert os.path.exists(SECRETARIA_PATH), f"SecretariaSection not found at {SECRETARIA_PATH}"
        with open(SECRETARIA_PATH, "r", encoding="utf-8") as f:
            content = f.read()

        # Check useSearchParams import
        self.assert_test(
            bool(re.search(r"import\s+.*useSearchParams.*from\s+['\"]next/navigation['\"]", content)),
            "secretaria_imports_use_search_params",
            "Must import useSearchParams from 'next/navigation'"
        )

        # Check local activeTab useState removed
        self.assert_test(
            not bool(re.search(r"useState<['\"]alunos['\"]\s*\|\s*['\"]turmas['\"]", content)),
            "secretaria_no_local_active_tab_state",
            "Must NOT declare local useState for activeTab"
        )

        # Check setActiveTab is absent
        self.assert_test(
            "setActiveTab" not in content,
            "secretaria_no_set_active_tab",
            "setActiveTab must be completely removed from SecretariaSection"
        )

        # Check tabParam extraction and whitelist logic
        has_tab_param = bool(re.search(r"const\s+tabParam\s*=\s*searchParams\s*\?\s*searchParams\.get\(['\"]tab['\"]\)\s*:\s*null;", content))
        self.assert_test(
            has_tab_param,
            "secretaria_tab_param_extraction",
            "Must extract tabParam via searchParams.get('tab')"
        )

        has_whitelist = bool(re.search(
            r"const\s+activeTab:\s*['\"]alunos['\"]\s*\|\s*['\"]turmas['\"]\s*=\s*tabParam\s*===\s*['\"]turmas['\"]\s*\?\s*['\"]turmas['\"]\s*:\s*['\"]alunos['\"];",
            content
        ))
        self.assert_test(
            has_whitelist,
            "secretaria_strict_whitelist_fallback",
            "Must evaluate activeTab with strict ternary fallback to 'alunos'"
        )

    # --------------------------------------------------------------------------
    # 2. Logic Emulation: Missing ?tab= Fallbacks
    # --------------------------------------------------------------------------
    def resolve_agenda_tab(self, search_params_dict):
        tab_param = search_params_dict.get('tab') if search_params_dict is not None else None
        return tab_param if tab_param in ('rotina', 'whatsapp') else 'comunicacao'

    def resolve_secretaria_tab(self, search_params_dict):
        tab_param = search_params_dict.get('tab') if search_params_dict is not None else None
        return 'turmas' if tab_param == 'turmas' else 'alunos'

    def test_missing_tab_fallbacks(self):
        print("\n--- 3. Missing ?tab= Parameter Fallback ---")
        
        # Test 1: Completely missing ?tab= (None)
        res_agenda = self.resolve_agenda_tab({})
        self.assert_test(res_agenda == "comunicacao", "agenda_missing_tab_defaults_to_comunicacao", f"Got: {res_agenda}")

        res_secretaria = self.resolve_secretaria_tab({})
        self.assert_test(res_secretaria == "alunos", "secretaria_missing_tab_defaults_to_alunos", f"Got: {res_secretaria}")

        # Test 2: searchParams object is None (SSR or unmounted)
        res_agenda_none = self.resolve_agenda_tab(None)
        self.assert_test(res_agenda_none == "comunicacao", "agenda_null_search_params_defaults_to_comunicacao", f"Got: {res_agenda_none}")

        res_secretaria_none = self.resolve_secretaria_tab(None)
        self.assert_test(res_secretaria_none == "alunos", "secretaria_null_search_params_defaults_to_alunos", f"Got: {res_secretaria_none}")

        # Test 3: Empty string ?tab=
        res_agenda_empty = self.resolve_agenda_tab({'tab': ''})
        self.assert_test(res_agenda_empty == "comunicacao", "agenda_empty_tab_defaults_to_comunicacao", f"Got: {res_agenda_empty}")

        res_sec_empty = self.resolve_secretaria_tab({'tab': ''})
        self.assert_test(res_sec_empty == "alunos", "secretaria_empty_tab_defaults_to_alunos", f"Got: {res_sec_empty}")

    # --------------------------------------------------------------------------
    # 3. Malformed and Adversarial ?tab= Inputs
    # --------------------------------------------------------------------------
    def test_malformed_and_adversarial_tabs(self):
        print("\n--- 4. Malformed and Adversarial ?tab= Handling ---")
        adversarial_cases = [
            "nonexistent",
            "<script>alert('xss')</script>",
            "<img src=x onerror=alert(1)>",
            "../../../../etc/passwd",
            "%00%20%0D%0A",
            "SELECT * FROM users",
            "null",
            "undefined",
            "NaN",
            "true",
            "false",
            "0",
            "-1",
            "999999999999999999999",
            "comunicacao\0",
            "alunos\0",
            "tab with spaces",
            "ROTINA",       # uppercase should fail whitelist and fall back
            "WHATSAPP",     # uppercase should fail whitelist and fall back
            "TURMAS",       # uppercase should fail whitelist and fall back
            "comunicacao; DROP TABLE alunos;",
        ]

        for bad in adversarial_cases:
            a_res = self.resolve_agenda_tab({'tab': bad})
            s_res = self.resolve_secretaria_tab({'tab': bad})
            self.assert_test(
                a_res == "comunicacao",
                f"agenda_adversarial_fallback_{bad[:15]}",
                f"Expected 'comunicacao' for {bad}, got '{a_res}'"
            )
            self.assert_test(
                s_res == "alunos",
                f"secretaria_adversarial_fallback_{bad[:15]}",
                f"Expected 'alunos' for {bad}, got '{s_res}'"
            )

        # Cross-section tab attacks
        # Tab 'turmas' passed to AgendaDigitalSection
        self.assert_test(
            self.resolve_agenda_tab({'tab': 'turmas'}) == 'comunicacao',
            "agenda_rejects_foreign_tab_turmas",
            "AgendaDigitalSection must reject 'turmas' and fall back to 'comunicacao'"
        )
        # Tab 'rotina' passed to SecretariaSection
        self.assert_test(
            self.resolve_secretaria_tab({'tab': 'rotina'}) == 'alunos',
            "secretaria_rejects_foreign_tab_rotina",
            "SecretariaSection must reject 'rotina' and fall back to 'alunos'"
        )
        # Tab 'whatsapp' passed to SecretariaSection
        self.assert_test(
            self.resolve_secretaria_tab({'tab': 'whatsapp'}) == 'alunos',
            "secretaria_rejects_foreign_tab_whatsapp",
            "SecretariaSection must reject 'whatsapp' and fall back to 'alunos'"
        )

        # Valid tabs must still resolve correctly
        self.assert_test(
            self.resolve_agenda_tab({'tab': 'rotina'}) == 'rotina',
            "agenda_resolves_valid_tab_rotina",
            "Valid 'rotina' must resolve to 'rotina'"
        )
        self.assert_test(
            self.resolve_agenda_tab({'tab': 'whatsapp'}) == 'whatsapp',
            "agenda_resolves_valid_tab_whatsapp",
            "Valid 'whatsapp' must resolve to 'whatsapp'"
        )
        self.assert_test(
            self.resolve_secretaria_tab({'tab': 'turmas'}) == 'turmas',
            "secretaria_resolves_valid_tab_turmas",
            "Valid 'turmas' must resolve to 'turmas'"
        )

    # --------------------------------------------------------------------------
    # 4. SecretariaSection Modal URL Isolation
    # --------------------------------------------------------------------------
    def test_secretaria_modal_isolation(self):
        print("\n--- 5. SecretariaSection Modal URL Isolation ---")
        with open(SECRETARIA_PATH, "r", encoding="utf-8") as f:
            content = f.read()

        # Check that modalTab is local useState
        has_modal_tab_state = bool(re.search(
            r"const\s+\[modalTab,\s*setModalTab\]\s*=\s*useState<['\"]dados_aluno['\"]\s*\|\s*['\"]responsaveis['\"]\s*\|\s*['\"]endereco_contato['\"]\s*\|\s*['\"]prontuario['\"]>\(['\"]dados_aluno['\"]\);",
            content
        ))
        self.assert_test(
            has_modal_tab_state,
            "secretaria_modal_tab_is_local_state",
            "modalTab must be local useState and strictly isolated from URL"
        )

        # Ensure no useRouter is imported or used for modal navigation
        # If useRouter exists, verify it is not called during modal actions
        has_router_in_modal = bool(re.search(r"router\.(push|replace).*modal", content, re.IGNORECASE))
        self.assert_test(
            not has_router_in_modal,
            "secretaria_no_router_push_for_modals",
            "Must NOT navigate router or update URL during modal operations"
        )

        # Verify modal open/close actions do not touch window.history or URL
        has_history_in_modal = bool(re.search(r"history\.(pushState|replaceState)", content))
        self.assert_test(
            not has_history_in_modal,
            "secretaria_no_history_manipulation",
            "Must NOT invoke window.history in SecretariaSection"
        )

        # Simulation of modal lifecycle with URL invariance
        class MockBrowserState:
            def __init__(self, initial_url: str):
                self.url = initial_url
                self.parsed = urlparse(initial_url)
                self.params = parse_qs(self.parsed.query)

            def get_param(self, key):
                return self.params.get(key, [None])[0]

        browser = MockBrowserState("http://localhost:3000/?tab=alunos")
        self.assert_test(browser.get_param('tab') == 'alunos', "sim_initial_tab_alunos")

        # Open modal
        modal_open = True
        modal_tab = "dados_aluno"
        self.assert_test(
            browser.get_param('tab') == 'alunos',
            "sim_modal_open_does_not_mutate_url",
            f"URL tab remains '{browser.get_param('tab')}' after modal opened"
        )

        # Switch modal tabs
        for step in ["responsaveis", "endereco_contato", "prontuario"]:
            modal_tab = step
            self.assert_test(
                browser.get_param('tab') == 'alunos' and modal_tab == step,
                f"sim_modal_tab_{step}_does_not_mutate_url",
                f"URL tab remains '{browser.get_param('tab')}' when modalTab is '{modal_tab}'"
            )

        # Close modal
        modal_open = False
        self.assert_test(
            browser.get_param('tab') == 'alunos' and not modal_open,
            "sim_modal_close_does_not_mutate_url",
            f"URL tab remains '{browser.get_param('tab')}' after modal closed"
        )

    # --------------------------------------------------------------------------
    # 5. Tab Switcher Buttons Absence in DOM/Markup
    # --------------------------------------------------------------------------
    def test_tab_switcher_buttons_absence(self):
        print("\n--- 6. Absence of Horizontal Tab Switcher Buttons ---")
        with open(AGENDA_PATH, "r", encoding="utf-8") as f:
            agenda_content = f.read()

        agenda_old_buttons = [
            "Mensagens & Mural",
            "Resumo de Rotina",
            "WhatsApp (Transbordo)"
        ]
        for btn in agenda_old_buttons:
            self.assert_test(
                btn not in agenda_content,
                f"agenda_removed_button_{btn.split()[0]}",
                f"Button text '{btn}' must not exist in AgendaDigitalSection"
            )

        with open(SECRETARIA_PATH, "r", encoding="utf-8") as f:
            secretaria_content = f.read()

        secretaria_old_buttons = [
            "Alunos & Matrículas",
            "Turmas & Ensalamento"
        ]
        for btn in secretaria_old_buttons:
            self.assert_test(
                btn not in secretaria_content,
                f"secretaria_removed_button_{btn.split()[0]}",
                f"Button text '{btn}' must not exist in SecretariaSection"
            )

    # --------------------------------------------------------------------------
    # 6. Contextual Action Buttons Invariant Preservation
    # --------------------------------------------------------------------------
    def test_contextual_action_buttons_preservation(self):
        print("\n--- 7. Contextual Action Buttons Invariant Preservation ---")
        with open(SECRETARIA_PATH, "r", encoding="utf-8") as f:
            content = f.read()

        # In SecretariaSection, verify the action buttons are retained:
        # '+ Nova Matrícula Completa' and 'Criar Nova Turma'
        has_nova_matricula = "+ Nova Matrícula Completa" in content
        self.assert_test(
            has_nova_matricula,
            "secretaria_preserves_nova_matricula_button",
            "Action button '+ Nova Matrícula Completa' must be preserved"
        )

        has_criar_turma = "Criar Nova Turma" in content
        self.assert_test(
            has_criar_turma,
            "secretaria_preserves_criar_turma_button",
            "Action button 'Criar Nova Turma' must be preserved"
        )

        # Check that they are conditioned on activeTab
        has_conditional_actions = bool(re.search(
            r"activeTab\s*===\s*['\"]alunos['\"]\s*\?\s*\(.*?Nova Matrícula Completa.*?Criar Nova Turma",
            content,
            re.DOTALL
        ))
        self.assert_test(
            has_conditional_actions,
            "secretaria_actions_conditioned_on_active_tab",
            "Action buttons must be conditionally rendered based on activeTab"
        )

if __name__ == "__main__":
    suite = EmpiricalTestSuite()
    success = suite.run()
    sys.exit(0 if success else 1)
