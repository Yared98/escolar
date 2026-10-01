#!/usr/bin/env python3
"""
Master CLI Test Runner for Escolar Navigation Refactoring E2E Suite
Executes all 4 Tiers of automated test cases, outputs comprehensive pass/fail metrics,
and exits with code 0 on complete test suite success.
"""

import sys
import os
import argparse

# Ensure UTF-8 stdout if supported
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure repository root is in sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Import harness runner and all tiered test modules to trigger registration
from tests.e2e.harness.test_framework import runner
from tests.e2e.harness.ast_codebase_scanner import (
    scan_sidebar_file, scan_page_file, scan_section_file
)

# Register Tier 1 Tests
import tests.e2e.tier1_feature_coverage.test_sidebar_submenus
import tests.e2e.tier1_feature_coverage.test_url_query_parameters
import tests.e2e.tier1_feature_coverage.test_section_url_reading
import tests.e2e.tier1_feature_coverage.test_tab_bar_removal

# Register Tier 2 Tests
import tests.e2e.tier2_boundary_corner.test_missing_tab_fallback
import tests.e2e.tier2_boundary_corner.test_invalid_tab_handling
import tests.e2e.tier2_boundary_corner.test_route_transitions
import tests.e2e.tier2_boundary_corner.test_modal_tabs_preservation

# Register Tier 3 Tests
import tests.e2e.tier3_cross_feature.test_rbac_submenus
import tests.e2e.tier3_cross_feature.test_mobile_drawer_navigation

# Register Tier 4 Tests
import tests.e2e.tier4_real_world_scenarios.test_shareable_deep_linking
import tests.e2e.tier4_real_world_scenarios.test_multi_step_user_journey

def run_codebase_scan():
    print("\n" + "=" * 80)
    print("[SCAN] CODEBASE STATIC CONTRACT & AST SCANNER (PROGRESSIVE AUDIT)")
    print("=" * 80)
    sidebar_path = os.path.join(PROJECT_ROOT, "frontend", "src", "components", "Sidebar.tsx")
    page_path = os.path.join(PROJECT_ROOT, "frontend", "src", "app", "page.tsx")
    agenda_path = os.path.join(PROJECT_ROOT, "frontend", "src", "components", "AgendaDigitalSection.tsx")
    secretaria_path = os.path.join(PROJECT_ROOT, "frontend", "src", "components", "SecretariaSection.tsx")
    financeiro_path = os.path.join(PROJECT_ROOT, "frontend", "src", "components", "FinanceiroSection.tsx")
    pedagogico_path = os.path.join(PROJECT_ROOT, "frontend", "src", "components", "PedagocioNutricaoSection.tsx")

    sidebar_res = scan_sidebar_file(sidebar_path)
    page_res = scan_page_file(page_path)
    agenda_res = scan_section_file(agenda_path, "comunicacao", ["comunicacao", "rotina", "whatsapp"])
    secretaria_res = scan_section_file(secretaria_path, "alunos", ["alunos", "turmas"])
    financeiro_res = scan_section_file(financeiro_path, "ar", ["ar", "ap", "nfse", "bi"])
    pedagogico_res = scan_section_file(pedagogico_path, "disciplinas_matriz", ["disciplinas_matriz", "atribuicao_horarios", "turmas", "projetos", "nutricao", "tri"])

    print(f"1. Sidebar.tsx:")
    print(f"   - File exists: {sidebar_res.get('exists')}")
    print(f"   - NavSubItem & subItems defined: {sidebar_res.get('has_subitems_in_navitem')}")
    print(f"   - uses next/navigation (useRouter/useSearchParams): {sidebar_res.get('uses_use_search_params')}")
    print(f"   - CSS Grid collapsible animation: {sidebar_res.get('has_collapsible_css_grid')}")
    print(f"   - Milestone 1 Status: {'COMPLIANT' if sidebar_res.get('is_m1_compliant') else 'IN PROGRESS / PENDING M1 WORKER'}")

    print(f"\n2. page.tsx:")
    print(f"   - File exists: {page_res.get('exists')}")
    print(f"   - React.Suspense boundary present: {page_res.get('has_suspense')}")
    print(f"   - Milestone 1 Shell Status: {'COMPLIANT' if page_res.get('is_m1_compliant') else 'IN PROGRESS / PENDING M1 WORKER'}")

    print(f"\n3. AgendaDigitalSection.tsx:")
    print(f"   - File exists: {agenda_res.get('exists')}")
    print(f"   - useSearchParams tab binding: {agenda_res.get('reads_tab_param')}")
    print(f"   - Local useState removed: {not agenda_res.get('has_local_tab_state')}")
    print(f"   - Milestone 2 Status: {'COMPLIANT' if agenda_res.get('is_refactored') else 'PENDING M2 WORKER'}")

    print(f"\n4. SecretariaSection.tsx:")
    print(f"   - File exists: {secretaria_res.get('exists')}")
    print(f"   - useSearchParams tab binding: {secretaria_res.get('reads_tab_param')}")
    print(f"   - Local useState removed: {not secretaria_res.get('has_local_tab_state')}")
    print(f"   - Milestone 2 Status: {'COMPLIANT' if secretaria_res.get('is_refactored') else 'PENDING M2 WORKER'}")

    print(f"\n5. FinanceiroSection.tsx:")
    print(f"   - File exists: {financeiro_res.get('exists')}")
    print(f"   - useSearchParams tab binding: {financeiro_res.get('reads_tab_param')}")
    print(f"   - Local useState removed: {not financeiro_res.get('has_local_tab_state')}")
    print(f"   - Milestone 3 Status: {'COMPLIANT' if financeiro_res.get('is_refactored') else 'PENDING M3 WORKER'}")

    print(f"\n6. PedagocioNutricaoSection.tsx:")
    print(f"   - File exists: {pedagogico_res.get('exists')}")
    print(f"   - useSearchParams tab binding: {pedagogico_res.get('reads_tab_param')}")
    print(f"   - Local useState removed: {not pedagogico_res.get('has_local_tab_state')}")
    print(f"   - Milestone 3 Status: {'COMPLIANT' if pedagogico_res.get('is_refactored') else 'PENDING M3 WORKER'}")
    print("=" * 80 + "\n")

def main():
    parser = argparse.ArgumentParser(description="Escolar Navigation E2E Master Test Runner")
    parser.add_argument("--tier", type=str, default=None,
                        help="Filter execution by tier name (e.g. '1', 'Tier 1', 'Boundary', 'Cross', 'Real')")
    parser.add_argument("--scan-codebase", action="store_true",
                        help="Run static AST codebase audit on physical frontend source files")
    args = parser.parse_args()

    if args.scan_codebase:
        run_codebase_scan()

    exit_code = runner.run_all(filter_tier=args.tier)
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
