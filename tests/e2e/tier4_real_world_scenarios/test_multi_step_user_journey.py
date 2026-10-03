#!/usr/bin/env python3
"""
Tier 4: Real-World Application Scenarios — Multi-Step Navigation User Journeys
Validates end-to-end user flows including admin daily operations, secretary student enrollment,
mobile parent portal access, teacher attendance-to-agenda transitions, and browser reloads.
"""

from ..harness.test_framework import (
    runner, assert_equal, assert_true, assert_false, assert_in, assert_not_in
)
from ..harness.navigation_engine import AppNavigationRouter
from ..tier2_boundary_corner.test_modal_tabs_preservation import MockSecretariaModalState

TIER = "Tier 4: Real-World Application Scenarios"

@runner.register(tier=TIER, name="test_admin_daily_management_journey",
                 description="End-to-end journey: Overview -> Agenda (comunicacao->rotina) -> Secretaria (alunos->turmas) -> Financeiro (ar->nfse)")
def test_admin_daily_management_journey():
    router = AppNavigationRouter("/")
    assert_equal(router.active_route, "overview")

    # Step 1: Admin clicks Agenda
    router.on_parent_click("agenda")
    assert_equal(router.active_route, "agenda")
    assert_equal(router.search_params.get("tab"), "comunicacao")
    assert_equal(router.resolve_agenda_active_tab(), "comunicacao")

    # Step 2: Admin checks daily routines
    router.on_sub_item_click("agenda", "rotina")
    assert_equal(router.search_params.get("tab"), "rotina")
    assert_equal(router.resolve_agenda_active_tab(), "rotina")

    # Step 3: Admin navigates to Secretaria
    router.on_parent_click("secretaria")
    assert_equal(router.active_route, "secretaria")
    assert_equal(router.search_params.get("tab"), "alunos")
    assert_equal(router.resolve_secretaria_active_tab(), "alunos")

    # Step 4: Admin views Turmas in Secretaria
    router.on_sub_item_click("secretaria", "turmas")
    assert_equal(router.search_params.get("tab"), "turmas")
    assert_equal(router.resolve_secretaria_active_tab(), "turmas")

    # Step 5: Admin switches to Financeiro
    router.on_parent_click("financeiro")
    assert_equal(router.active_route, "financeiro")
    assert_equal(router.search_params.get("tab"), "ar")
    assert_equal(router.resolve_financeiro_active_tab(), "ar")

    # Step 6: Admin switches to NFS-e
    router.on_sub_item_click("financeiro", "nfse")
    assert_equal(router.search_params.get("tab"), "nfse")
    assert_equal(router.resolve_financeiro_active_tab(), "nfse")

@runner.register(tier=TIER, name="test_secretary_student_enrollment_workflow",
                 description="Secretary workflow: opens Secretaria, launches enrollment modal, steps through modal tabs, closes, switches to turmas")
def test_secretary_student_enrollment_workflow():
    router = AppNavigationRouter("/")
    modal = MockSecretariaModalState()

    # Navigate to Secretaria
    router.on_parent_click("secretaria")
    assert_equal(router.resolve_secretaria_active_tab(), "alunos")

    # Open enrollment modal
    modal.open_matricula_modal()
    assert_true(modal.show_modal)
    assert_equal(modal.modal_tab, "dados_aluno")
    assert_equal(router.search_params.get("tab"), "alunos")

    # Step through multi-tab modal form
    modal.switch_modal_tab("responsaveis")
    assert_equal(modal.modal_tab, "responsaveis")

    modal.switch_modal_tab("endereco_contato")
    assert_equal(modal.modal_tab, "endereco_contato")

    modal.switch_modal_tab("prontuario")
    assert_equal(modal.modal_tab, "prontuario")

    # Save and close modal
    modal.close_matricula_modal()
    assert_false(modal.show_modal)
    assert_equal(router.search_params.get("tab"), "alunos")

    # Switch to turmas via Sidebar
    router.on_sub_item_click("secretaria", "turmas")
    assert_equal(router.resolve_secretaria_active_tab(), "turmas")
    assert_equal(router.search_params.get("tab"), "turmas")

@runner.register(tier=TIER, name="test_mobile_parent_portal_journey",
                 description="Parent mobile journey: opens off-canvas drawer, selects report card, switches to tuition payment")
def test_mobile_parent_portal_journey():
    router = AppNavigationRouter("/")

    # Mobile user triggers menu
    router.mobile_menu_open = True

    # Clicks 'Boletim & Desempenho' under Portal do Aluno
    router.on_sub_item_click("portal_aluno", "boletim", is_mobile=True)
    assert_false(router.mobile_menu_open, "Drawer should close automatically")
    assert_equal(router.active_route, "portal_aluno")
    assert_equal(router.search_params.get("tab"), "boletim")
    assert_equal(router.resolve_portal_aluno_active_tab(), "boletim")

    # Reopens drawer to pay tuition
    router.mobile_menu_open = True
    router.on_sub_item_click("portal_aluno", "financeiro", is_mobile=True)
    assert_false(router.mobile_menu_open)
    assert_equal(router.search_params.get("tab"), "financeiro")
    assert_equal(router.resolve_portal_aluno_active_tab(), "financeiro")

@runner.register(tier=TIER, name="test_teacher_daily_attendance_and_agenda_workflow",
                 description="Teacher workflow: Chamada Touch attendance -> broadcast agenda message -> WhatsApp fallback check")
def test_teacher_daily_attendance_and_agenda_workflow():
    router = AppNavigationRouter("/")

    # Teacher opens Academico
    router.on_parent_click("academico")
    assert_equal(router.resolve_academico_active_tab(), "fundamental")

    # Teacher transitions to Agenda to broadcast
    router.on_parent_click("agenda")
    assert_equal(router.resolve_agenda_active_tab(), "comunicacao")

    # Teacher checks WhatsApp transbordo
    router.on_sub_item_click("agenda", "whatsapp")
    assert_equal(router.resolve_agenda_active_tab(), "whatsapp")

@runner.register(tier=TIER, name="test_multitab_browser_refresh_simulation",
                 description="Simulates browser refresh on deep URL /?route=financeiro&tab=bi and verifies 100% restoration")
def test_multitab_browser_refresh_simulation():
    # Initial state
    deep_url = "/?route=financeiro&tab=bi"
    refreshed_router = AppNavigationRouter(deep_url)

    assert_equal(refreshed_router.active_route, "financeiro")
    assert_equal(refreshed_router.search_params.get("tab"), "bi")
    assert_equal(refreshed_router.resolve_financeiro_active_tab(), "bi")
    assert_true(refreshed_router.is_sub_item_active("financeiro", "bi"))
    assert_true(refreshed_router.is_route_expanded("financeiro"))

@runner.register(tier=TIER, name="test_crm_to_secretaria_matricula_prefill_workflow",
                 description="CRM workflow: clicks 'Abrir matrícula' on matriculado lead -> navigates to Secretaria & tab=alunos with prefill params")
def test_crm_to_secretaria_matricula_prefill_workflow():
    router = AppNavigationRouter("/?route=crm")
    assert_equal(router.active_route, "crm")

    # Lead matriculado trigger
    target_url = "/?route=secretaria&tab=alunos&nova_matricula=1&lead_nome=Mariana+Souza&lead_telefone=11987654321&lead_email=mariana@email.com&lead_aluno=Gabriel+Souza"
    router.push(target_url)

    assert_equal(router.active_route, "secretaria")
    assert_equal(router.search_params.get("tab"), "alunos")
    assert_equal(router.search_params.get("nova_matricula"), "1")
    assert_equal(router.search_params.get("lead_nome"), "Mariana Souza")
    assert_equal(router.search_params.get("lead_telefone"), "11987654321")
    assert_equal(router.search_params.get("lead_email"), "mariana@email.com")
    assert_equal(router.search_params.get("lead_aluno"), "Gabriel Souza")
