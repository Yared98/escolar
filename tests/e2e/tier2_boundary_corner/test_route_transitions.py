#!/usr/bin/env python3
"""
Tier 2: Boundary & Corner Cases — Route Transitions
Validates state synchronization, tab clearing/replacing, auto-expansion, and history integrity
during inter-route transitions across sections and single-view destinations.
"""

from ..harness.test_framework import (
    runner, assert_equal, assert_true, assert_false, assert_in, assert_not_in
)
from ..harness.navigation_engine import AppNavigationRouter

TIER = "Tier 2: Boundary & Corner Cases"

@runner.register(tier=TIER, name="test_route_transition_updates_active_route_and_default_tab",
                 description="Verifies navigating from Agenda to Secretaria updates activeRoute and sets ?tab=alunos")
def test_route_transition_updates_active_route_and_default_tab():
    router = AppNavigationRouter("/")
    router.on_parent_click("agenda")
    assert_equal(router.active_route, "agenda")
    assert_equal(router.search_params.get("tab"), "comunicacao")

    # Transition to secretaria
    router.on_parent_click("secretaria")
    assert_equal(router.active_route, "secretaria")
    assert_equal(router.search_params.get("tab"), "alunos")
    assert_equal(router.resolve_secretaria_active_tab(), "alunos")

@runner.register(tier=TIER, name="test_cross_section_subitem_direct_click",
                 description="Verifies directly clicking sub-item in another section switches route, sets tab, and auto-expands")
def test_cross_section_subitem_direct_click():
    router = AppNavigationRouter("/")
    router.on_parent_click("agenda")
    assert_equal(router.active_route, "agenda")

    # Directly click sub-item in financeiro
    router.on_sub_item_click("financeiro", "nfse")
    assert_equal(router.active_route, "financeiro", "Active route must switch to financeiro")
    assert_equal(router.search_params.get("tab"), "nfse")
    assert_true(router.is_route_expanded("financeiro"), "Financeiro must be expanded")
    assert_true(router.is_sub_item_active("financeiro", "nfse"))

@runner.register(tier=TIER, name="test_route_transition_to_single_view_clears_tab",
                 description="Verifies transition from multi-tab section to single-view route clears ?tab= parameter")
def test_route_transition_to_single_view_clears_tab():
    router = AppNavigationRouter("/")
    router.on_sub_item_click("financeiro", "bi")
    assert_equal(router.search_params.get("tab"), "bi")

    router.on_parent_click("crm")
    assert_equal(router.active_route, "crm")
    assert_false(router.search_params.has("tab"), "?tab= must be deleted when entering CRM")
    assert_not_in("tab=", router.current_url)

@runner.register(tier=TIER, name="test_route_transition_preserves_collapse_state_or_expands_target",
                 description="Verifies destination route is expanded upon arrival and previous routes retain state")
def test_route_transition_preserves_collapse_state_or_expands_target():
    router = AppNavigationRouter("/")
    router.on_parent_click("pedagogico")
    assert_true(router.is_route_expanded("pedagogico"))

    router.on_parent_click("portal_aluno")
    assert_true(router.is_route_expanded("portal_aluno"))

@runner.register(tier=TIER, name="test_rapid_route_cycling_consistency",
                 description="Verifies rapid multi-hop transitions maintain exact URL and state consistency")
def test_rapid_route_cycling_consistency():
    router = AppNavigationRouter("/")
    hops = [
        ("agenda", "comunicacao"),
        ("secretaria", "alunos"),
        ("financeiro", "ar"),
        ("pedagogico", "disciplinas_matriz"),
        ("portal_aluno", "boletim"),
        ("overview", None),
        ("agenda", "comunicacao"),
    ]

    for target_route, expected_tab in hops:
        router.on_parent_click(target_route)
        assert_equal(router.active_route, target_route)
        if expected_tab:
            assert_equal(router.search_params.get("tab"), expected_tab)
        else:
            assert_false(router.search_params.has("tab"))

@runner.register(tier=TIER, name="test_route_transition_with_browser_back_simulation",
                 description="Verifies browser back navigation through history stack restores proper states")
def test_route_transition_with_browser_back_simulation():
    router = AppNavigationRouter("/")
    router.on_parent_click("agenda")
    router.on_sub_item_click("agenda", "whatsapp")
    router.on_parent_click("secretaria")

    assert_equal(router.active_route, "secretaria")
    assert_equal(router.search_params.get("tab"), "alunos")

    # Simulate pop/back to previous URL
    prev_url = router.history[-2]  # was ?tab=whatsapp
    router.push(prev_url)
    assert_equal(router.active_route, "agenda")
    assert_equal(router.search_params.get("tab"), "whatsapp")
    assert_equal(router.resolve_agenda_active_tab(), "whatsapp")
