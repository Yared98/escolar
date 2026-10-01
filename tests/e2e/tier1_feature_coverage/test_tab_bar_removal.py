#!/usr/bin/env python3
"""
Tier 1: Feature Coverage — Horizontal Tab Bar Removal
Validates the removal of redundant horizontal tab switcher buttons from section headers
and the preservation of contextual action buttons (+ Nova Matrícula Completa, Criar Nova Turma).
"""

from ..harness.test_framework import (
    runner, assert_equal, assert_true, assert_false, assert_in, assert_not_in
)
from ..harness.dom_contract_oracle import SECTION_TAB_REMOVAL_SPECS

TIER = "Tier 1: Feature Coverage"

@runner.register(tier=TIER, name="test_tab_removal_specification_agenda",
                 description="Verifies specification targets removal of horizontal tab buttons in AgendaDigitalSection")
def test_tab_removal_specification_agenda():
    spec = SECTION_TAB_REMOVAL_SPECS["AgendaDigitalSection"]
    assert_in("Mensagens & Mural", spec["removed_buttons"])
    assert_in("Resumo de Rotina", spec["removed_buttons"])
    assert_in("WhatsApp (Transbordo)", spec["removed_buttons"])
    assert_equal(len(spec["removed_buttons"]), 3)

@runner.register(tier=TIER, name="test_tab_removal_specification_secretaria",
                 description="Verifies specification targets removal of horizontal tab buttons in SecretariaSection")
def test_tab_removal_specification_secretaria():
    spec = SECTION_TAB_REMOVAL_SPECS["SecretariaSection"]
    assert_in("Alunos & Matrículas", spec["removed_buttons"])
    assert_in("Turmas & Ensalamento", spec["removed_buttons"])
    assert_equal(len(spec["removed_buttons"]), 2)

@runner.register(tier=TIER, name="test_tab_removal_specification_financeiro",
                 description="Verifies specification targets removal of horizontal tab bar in FinanceiroSection")
def test_tab_removal_specification_financeiro():
    spec = SECTION_TAB_REMOVAL_SPECS["FinanceiroSection"]
    assert_in("Faturas & Mensalidades (AR)", spec["removed_buttons"])
    assert_in("Despesas & Fornecedores (AP)", spec["removed_buttons"])
    assert_in("NFS-e Automatizada", spec["removed_buttons"])
    assert_in("Demonstrativo DRE & DFC", spec["removed_buttons"])
    assert_equal(len(spec["removed_buttons"]), 4)

@runner.register(tier=TIER, name="test_tab_removal_specification_pedagogico",
                 description="Verifies specification targets removal of horizontal tab buttons in PedagocioNutricaoSection")
def test_tab_removal_specification_pedagogico():
    spec = SECTION_TAB_REMOVAL_SPECS["PedagocioNutricaoSection"]
    assert_in("Disciplinas & Matriz", spec["removed_buttons"])
    assert_in("Atribuição & Horários", spec["removed_buttons"])
    assert_in("Visão das Turmas", spec["removed_buttons"])
    assert_in("Projetos BNCC", spec["removed_buttons"])
    assert_in("Planner de Nutrição", spec["removed_buttons"])
    assert_equal(len(spec["removed_buttons"]), 5)

@runner.register(tier=TIER, name="test_preserved_action_buttons_invariant_in_secretaria",
                 description="Verifies header action buttons (+ Nova Matrícula Completa, Criar Nova Turma) are strictly preserved")
def test_preserved_action_buttons_invariant_in_secretaria():
    spec = SECTION_TAB_REMOVAL_SPECS["SecretariaSection"]
    assert_in("+ Nova Matrícula Completa", spec["preserved_actions"])
    assert_in("Criar Nova Turma", spec["preserved_actions"])
    # Action buttons must not be inside removed_buttons list
    for action in spec["preserved_actions"]:
        assert_not_in(action, spec["removed_buttons"])

@runner.register(tier=TIER, name="test_sole_source_of_navigation_contract",
                 description="Verifies Sidebar is designated as the sole single source of truth for navigation")
def test_sole_source_of_navigation_contract():
    # Sections must not maintain duplicate tab navigators
    for section_name, spec in SECTION_TAB_REMOVAL_SPECS.items():
        assert_true(len(spec["removed_buttons"]) >= 2, f"{section_name} must target removal of tab bar buttons")
        assert_true(len(spec["state_hook_to_remove"]) > 0, f"{section_name} must target removal of useState")
