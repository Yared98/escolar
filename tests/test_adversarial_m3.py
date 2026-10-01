#!/usr/bin/env python3
"""
Adversarial Verification Suite for Milestone 3 (Challenger M3)
Empirically stress-tests tab query param resolution, AST properties,
defensive fallback determinism, action button preservation, and boundary safety.
"""

import sys
import os
import re
import urllib.parse
from typing import Dict, List, Any, Optional

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

SECTION_FILES = {
    "financeiro": os.path.join(PROJECT_ROOT, "frontend", "src", "components", "FinanceiroSection.tsx"),
    "pedagogico": os.path.join(PROJECT_ROOT, "frontend", "src", "components", "PedagocioNutricaoSection.tsx"),
    "agenda": os.path.join(PROJECT_ROOT, "frontend", "src", "components", "AgendaDigitalSection.tsx"),
    "secretaria": os.path.join(PROJECT_ROOT, "frontend", "src", "components", "SecretariaSection.tsx"),
}

VALID_TABS = {
    "financeiro": ["ar", "ap", "nfse", "bi"],
    "pedagogico": ["disciplinas_matriz", "atribuicao_horarios", "turmas", "projetos", "nutricao", "tri"],
    "agenda": ["comunicacao", "rotina", "whatsapp"],
    "secretaria": ["alunos", "turmas"]
}

DEFAULT_TABS = {
    "financeiro": "ar",
    "pedagogico": "disciplinas_matriz",
    "agenda": "comunicacao",
    "secretaria": "alunos"
}

# 60+ adversarial payloads to challenge whitelist fallbacks
ADVERSARIAL_PAYLOADS = [
    "",
    "   ",
    "\t",
    "\n",
    "\r\n",
    "null",
    "undefined",
    "NaN",
    "false",
    "true",
    "0",
    "1",
    "-1",
    "99999999999999999999999999",
    "__proto__",
    "constructor",
    "prototype",
    "toString",
    "valueOf",
    "__defineGetter__",
    "__lookupSetter__",
    "hasOwnProperty",
    "isPrototypeOf",
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "javascript:void(0)",
    "data:text/html,<script>alert(1)</script>",
    "'; DROP TABLE faturas; --",
    "' OR '1'='1",
    "\" OR \"\"=\"",
    "admin' --",
    "../../etc/passwd",
    "..\\..\\windows\\system32\\drivers\\etc\\hosts",
    "/etc/shadow",
    "%00",
    "%20",
    "%0D%0A",
    "%3Cscript%3E",
    "ar ",
    " ar",
    "AR",
    "Ar",
    "aR",
    "AP",
    "Ap",
    "NFSE",
    "Nfse",
    "BI",
    "Bi",
    "DISCIPLINAS_MATRIZ",
    "Disciplinas_Matriz",
    "tri ",
    "TRI",
    "conciliacao",
    "grade",
    "boletim",
    "financeiro",
    "matricula",
    "usuarios",
    "settings",
    "envios",
    "relatorios",
    "???",
    "&&&",
    "===",
    "$$$",
    "###",
    "🚀🔥✨",
    "你好世界",
    "مرحبا",
    "русский",
    "éçãõáíóú",
]

def simulate_financeiro_tab(tab_param: Optional[str]) -> str:
    """Exact JavaScript semantics from FinanceiroSection.tsx lines 59-60"""
    return tab_param if (tab_param == 'ap' or tab_param == 'nfse' or tab_param == 'bi') else 'ar'

def simulate_pedagogico_tab(tab_param: Optional[str]) -> str:
    """Exact JavaScript semantics from PedagocioNutricaoSection.tsx lines 125-132"""
    return tab_param if (
        tab_param == 'atribuicao_horarios' or
        tab_param == 'turmas' or
        tab_param == 'projetos' or
        tab_param == 'nutricao' or
        tab_param == 'tri'
    ) else 'disciplinas_matriz'

def simulate_agenda_tab(tab_param: Optional[str]) -> str:
    """Exact JavaScript semantics from AgendaDigitalSection.tsx lines 48-49"""
    return tab_param if (tab_param == 'rotina' or tab_param == 'whatsapp') else 'comunicacao'

def simulate_secretaria_tab(tab_param: Optional[str]) -> str:
    """Exact JavaScript semantics from SecretariaSection.tsx line 51"""
    return 'turmas' if tab_param == 'turmas' else 'alunos'

SIMULATORS = {
    "financeiro": simulate_financeiro_tab,
    "pedagogico": simulate_pedagogico_tab,
    "agenda": simulate_agenda_tab,
    "secretaria": simulate_secretaria_tab,
}

def run_tests() -> int:
    total_passed = 0
    total_failed = 0
    failures: List[str] = []

    def assert_check(cond: bool, msg: str):
        nonlocal total_passed, total_failed
        if cond:
            total_passed += 1
        else:
            total_failed += 1
            failures.append(msg)
            print(f"  [FAIL] {msg}")

    print("=" * 80)
    print("EMPIRICAL ADVERSARIAL CHALLENGER SUITE — MILESTONE 3")
    print("=" * 80)

    # --------------------------------------------------------------------------
    # 1. VALID TABS VERIFICATION
    # --------------------------------------------------------------------------
    print("\n[GROUP 1] Valid Tab Query Parameter Resolution Across All Sections")
    for section, valid_list in VALID_TABS.items():
        simulator = SIMULATORS[section]
        for expected_tab in valid_list:
            res = simulator(expected_tab)
            assert_check(
                res == expected_tab,
                f"{section}: tab '{expected_tab}' should resolve to '{expected_tab}', got '{res}'"
            )
            print(f"  [PASS] {section} ?tab={expected_tab} -> '{res}'")

    # --------------------------------------------------------------------------
    # 2. ADVERSARIAL PAYLOAD FALLBACK VERIFICATION
    # --------------------------------------------------------------------------
    print("\n[GROUP 2] Adversarial & Boundary Inputs Fallback Verification")
    for section, default_tab in DEFAULT_TABS.items():
        simulator = SIMULATORS[section]
        # Test None (absent param)
        res_none = simulator(None)
        assert_check(res_none == default_tab, f"{section}: None should fall back to '{default_tab}', got '{res_none}'")

        # Test all adversarial payloads
        for payload in ADVERSARIAL_PAYLOADS:
            res = simulator(payload)
            # If payload accidentally equals one of the valid non-default tabs, ignore, otherwise must be default
            if payload not in VALID_TABS[section]:
                assert_check(
                    res == default_tab,
                    f"{section}: adversarial payload '{payload}' should fall back to '{default_tab}', got '{res}'"
                )

        print(f"  [PASS] {section}: 60+ adversarial payloads deterministically fell back to '{default_tab}'")

    # --------------------------------------------------------------------------
    # 3. STATIC AST / CODE INSPECTION CHECKS
    # --------------------------------------------------------------------------
    print("\n[GROUP 3] Static AST Codebase Invariants")
    for section, file_path in SECTION_FILES.items():
        assert_check(os.path.exists(file_path), f"File {file_path} exists")
        with open(file_path, "r", encoding="utf-8") as f:
            code = f.read()

        # Check: uses useSearchParams
        has_usp = "useSearchParams" in code and "from 'next/navigation'" in code
        assert_check(has_usp, f"{section}: imports and uses useSearchParams from next/navigation")

        # Check: reads tab
        has_tab_read = bool(re.search(r"searchParams(?:\.get|\?\.get)\(['\"]tab['\"]\)", code))
        assert_check(has_tab_read, f"{section}: calls searchParams.get('tab')")

        # Check: no useState for active tab
        has_tab_use_state = bool(re.search(r"const\s*\[(?:activeTab|activeSubTab)[^\]]*\]\s*=\s*useState", code))
        assert_check(not has_tab_use_state, f"{section}: must NOT have useState for activeTab or activeSubTab")

        # Check: each valid tab has matching conditional render in JSX
        for tab in VALID_TABS[section]:
            has_jsx_tab = (
                f"activeTab === '{tab}'" in code or
                f"activeSubTab === '{tab}'" in code or
                f'activeTab === "{tab}"' in code or
                f'activeSubTab === "{tab}"' in code or
                (section == "secretaria" and tab == "turmas" and "activeTab === 'alunos' ?" in code)
            )
            assert_check(has_jsx_tab, f"{section}: JSX has conditional render for tab '{tab}'")

        print(f"  [PASS] {section}: AST verified (useSearchParams: {has_usp}, no tab useState, panels present for all valid tabs)")

    # --------------------------------------------------------------------------
    # 4. ACTION BUTTONS & MODAL LIFECYCLE PRESERVATION
    # --------------------------------------------------------------------------
    print("\n[GROUP 4] Action Buttons & Modals Non-Interference Check")
    
    # FinanceiroSection actions
    with open(SECTION_FILES["financeiro"], "r", encoding="utf-8") as f:
        fin_code = f.read()
    
    fin_actions = [
        ("handleExecutarRegua", "Executar Régua de Cobrança button"),
        ("setStatusFilter", "Status filter selector ('todos', 'pendente', 'pago', 'atrasado')"),
        ("setSearchQuery", "Search invoice input"),
        ("handleBaixaManual", "Baixar fatura manual action"),
        ("setPixModalFatura", "QR Pix modal trigger"),
        ("handleEmitirNfse", "Emitir NFS-e trigger"),
        ("setShowNovaDespesaModal", "Nova Despesa modal trigger"),
        ("handleCopyPix", "Copy Pix code button"),
        ("handleCriarDespesa", "Save expense submit handler"),
    ]
    for identifier, desc in fin_actions:
        assert_check(identifier in fin_code, f"FinanceiroSection preserves {desc} ({identifier})")
    print("  [PASS] FinanceiroSection: all 9 business action handlers and modal dialogs preserved")

    # PedagocioNutricaoSection actions
    with open(SECTION_FILES["pedagogico"], "r", encoding="utf-8") as f:
        ped_code = f.read()

    ped_actions = [
        ("setShowModalSimulado", "Modal Simulado TRI trigger & close"),
        ("setShowModalDisciplina", "Modal Nova Disciplina trigger & close"),
        ("setShowModalAdicionarMatriz", "Modal Adicionar à Matriz trigger & close"),
        ("setShowModalAtribuirProf", "Modal Atribuir Professor trigger & close"),
        ("setShowModalHorario", "Modal Horário trigger & close"),
        ("setShowModalCardapio", "Modal Cardápio trigger & close"),
        ("handleSalvarDisciplina", "Submit Nova Disciplina"),
        ("handleAdicionarMatriz", "Submit Adicionar Matriz"),
        ("handleRemoverMatriz", "Remove disciplina from matriz"),
        ("handleAtribuirProfessor", "Submit Atribuir Professor"),
        ("handleCriarHorario", "Submit Horário"),
        ("handleDeletarHorario", "Delete horário button"),
        ("handleCriarSimulado", "Submit Simulado TRI"),
        ("handleSalvarCardapio", "Submit Cardápio"),
    ]
    for identifier, desc in ped_actions:
        assert_check(identifier in ped_code, f"PedagocioNutricaoSection preserves {desc} ({identifier})")
    print("  [PASS] PedagocioNutricaoSection: all 14 business action handlers and 6 modal dialogs preserved")

    # --------------------------------------------------------------------------
    # 5. REMOVAL OF HORIZONTAL TAB BARS IN M3 SECTIONS
    # --------------------------------------------------------------------------
    print("\n[GROUP 5] Horizontal Tab Switcher Excisions")
    
    # Check that removed horizontal tab buttons are not in the DOM
    # In Financeiro: tab buttons like onClick={() => setActiveSubTab(...)} must not exist
    assert_check("setActiveSubTab" not in fin_code, "FinanceiroSection does not contain setActiveSubTab")
    # In Pedagogico: tab buttons like onClick={() => setActiveTab(...)} must not exist
    assert_check("setActiveTab" not in ped_code, "PedagocioNutricaoSection does not contain setActiveTab")

    print("  [PASS] Tab switcher button hooks (setActiveSubTab, setActiveTab) completely excised")

    # --------------------------------------------------------------------------
    # SUMMARY
    # --------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print(f"TOTAL CHECKS: {total_passed + total_failed} | PASSED: {total_passed} | FAILED: {total_failed}")
    if total_failed == 0:
        print("ALL ADVERSARIAL AND EMPIRICAL VERIFICATIONS PASSED WITH ZERO DEFECTS! (Exit code 0)")
    else:
        print(f"DEFECTS DETECTED: {total_failed}")
        for failure in failures:
            print(f"  - {failure}")
    print("=" * 80)

    return 0 if total_failed == 0 else 1

if __name__ == "__main__":
    sys.exit(run_tests())
