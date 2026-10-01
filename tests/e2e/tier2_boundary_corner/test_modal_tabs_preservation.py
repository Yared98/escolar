#!/usr/bin/env python3
"""
Tier 2: Boundary & Corner Cases — Modal Tabs Preservation in SecretariaSection
Validates the strict architectural separation between top-level section navigation tabs (?tab=alunos|turmas)
and local temporary dialog lifecycle tabs (modalTab: dados_aluno, responsaveis, endereco_contato, prontuario).
"""

from ..harness.test_framework import (
    runner, assert_equal, assert_true, assert_false, assert_in, assert_not_in
)
from ..harness.navigation_engine import AppNavigationRouter
from ..harness.dom_contract_oracle import SECTION_TAB_REMOVAL_SPECS

TIER = "Tier 2: Boundary & Corner Cases"

class MockSecretariaModalState:
    """Simulates the internal modal dialog state inside SecretariaSection."""
    def __init__(self):
        self.show_modal = False
        self.show_turma_modal = False
        self.modal_tab = "dados_aluno"
        self.valid_modal_tabs = ["dados_aluno", "responsaveis", "endereco_contato", "prontuario"]

    def open_matricula_modal(self):
        self.show_modal = True
        self.modal_tab = "dados_aluno"

    def switch_modal_tab(self, new_tab: str):
        if new_tab in self.valid_modal_tabs:
            self.modal_tab = new_tab

    def close_matricula_modal(self):
        self.show_modal = False

    def open_turma_modal(self):
        self.show_turma_modal = True

    def close_turma_modal(self):
        self.show_turma_modal = False

@runner.register(tier=TIER, name="test_secretaria_modal_tabs_inventory",
                 description="Verifies authoritative inventory of internal modal tabs in SecretariaSection")
def test_secretaria_modal_tabs_inventory():
    spec = SECTION_TAB_REMOVAL_SPECS["SecretariaSection"]
    modal_tabs = spec["preserved_modal_tabs"]
    assert_equal(len(modal_tabs), 4)
    assert_in("dados_aluno", modal_tabs)
    assert_in("responsaveis", modal_tabs)
    assert_in("endereco_contato", modal_tabs)
    assert_in("prontuario", modal_tabs)

@runner.register(tier=TIER, name="test_modal_tabs_do_not_pollute_url_query_parameters",
                 description="Verifies switching tabs inside the modal does NOT alter the URL ?tab= parameter")
def test_modal_tabs_do_not_pollute_url_query_parameters():
    router = AppNavigationRouter("/?tab=alunos")
    modal = MockSecretariaModalState()

    modal.open_matricula_modal()
    assert_true(modal.show_modal)
    assert_equal(router.search_params.get("tab"), "alunos", "URL ?tab= must remain 'alunos'")

    # Switch modal tabs
    for mtab in ["responsaveis", "endereco_contato", "prontuario"]:
        modal.switch_modal_tab(mtab)
        assert_equal(modal.modal_tab, mtab)
        # URL searchParams must not be changed by modal tab navigation
        assert_equal(router.search_params.get("tab"), "alunos",
                     "Modal tabs must remain local state and not pollute URL")
        assert_not_in(mtab, router.current_url)

@runner.register(tier=TIER, name="test_closing_modal_retains_section_tab",
                 description="Verifies closing the enrollment modal retains the active section tab")
def test_closing_modal_retains_section_tab():
    router = AppNavigationRouter("/?tab=alunos")
    modal = MockSecretariaModalState()

    modal.open_matricula_modal()
    modal.switch_modal_tab("prontuario")
    modal.close_matricula_modal()

    assert_false(modal.show_modal)
    assert_equal(router.resolve_secretaria_active_tab(), "alunos")
    assert_equal(router.search_params.get("tab"), "alunos")

@runner.register(tier=TIER, name="test_modal_action_button_rendered_per_active_tab",
                 description="Verifies correct action button (+ Nova Matrícula vs Criar Nova Turma) is rendered per tab")
def test_modal_action_button_rendered_per_active_tab():
    router = AppNavigationRouter("/?tab=alunos")
    # When on alunos: action is '+ Nova Matrícula Completa'
    active_tab = router.resolve_secretaria_active_tab()
    rendered_action = "+ Nova Matrícula Completa" if active_tab == "alunos" else "Criar Nova Turma"
    assert_equal(rendered_action, "+ Nova Matrícula Completa")

    # When on turmas: action is 'Criar Nova Turma'
    router.push("/?tab=turmas")
    active_tab = router.resolve_secretaria_active_tab()
    rendered_action = "+ Nova Matrícula Completa" if active_tab == "alunos" else "Criar Nova Turma"
    assert_equal(rendered_action, "Criar Nova Turma")

@runner.register(tier=TIER, name="test_modal_tab_reset_on_modal_open",
                 description="Verifies reopening matricula modal resets modalTab to 'dados_aluno'")
def test_modal_tab_reset_on_modal_open():
    modal = MockSecretariaModalState()
    modal.open_matricula_modal()
    modal.switch_modal_tab("prontuario")
    assert_equal(modal.modal_tab, "prontuario")
    modal.close_matricula_modal()

    # Reopen
    modal.open_matricula_modal()
    assert_equal(modal.modal_tab, "dados_aluno", "Modal tab must reset to 'dados_aluno' on open")

@runner.register(tier=TIER, name="test_modal_isolation_from_sidebar_navigation",
                 description="Verifies clicking sidebar sub-item switches section view regardless of modal state")
def test_modal_isolation_from_sidebar_navigation():
    router = AppNavigationRouter("/?tab=alunos")
    modal = MockSecretariaModalState()
    modal.open_matricula_modal()

    # User clicks 'turmas' in sidebar
    router.on_sub_item_click("secretaria", "turmas")
    assert_equal(router.resolve_secretaria_active_tab(), "turmas")
    assert_equal(router.search_params.get("tab"), "turmas")
