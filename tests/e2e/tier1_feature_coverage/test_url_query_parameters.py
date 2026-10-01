#!/usr/bin/env python3
"""
Tier 1: Feature Coverage — URL Query Parameters (?tab=...)
Validates that clicking sub-items and parent routes appends, updates, or clears ?tab= query parameters,
preserves auxiliary search params, and synchronizes URL state via Next.js router.
"""

from ..harness.test_framework import (
    runner, assert_equal, assert_true, assert_false, assert_in, assert_not_in
)
from ..harness.navigation_engine import AppNavigationRouter

TIER = "Tier 1: Feature Coverage"

@runner.register(tier=TIER, name="test_subitem_click_appends_tab_query_param",
                 description="Verifies clicking sub-item directly updates URL search param ?tab=...")
def test_subitem_click_appends_tab_query_param():
    router = AppNavigationRouter("/")
    router.on_sub_item_click("agenda", "rotina")
    assert_equal(router.search_params.get("tab"), "rotina")
    assert_in("tab=rotina", router.current_url)

    router.on_sub_item_click("secretaria", "turmas")
    assert_equal(router.search_params.get("tab"), "turmas")
    assert_in("tab=turmas", router.current_url)

@runner.register(tier=TIER, name="test_parent_click_appends_default_tab",
                 description="Verifies clicking parent route appends its canonical defaultTab to URL")
def test_parent_click_appends_default_tab():
    router = AppNavigationRouter("/")
    router.on_parent_click("financeiro")
    assert_equal(router.active_route, "financeiro")
    assert_equal(router.search_params.get("tab"), "ar")
    assert_in("tab=ar", router.current_url)

    router.on_parent_click("portal_aluno")
    assert_equal(router.active_route, "portal_aluno")
    assert_equal(router.search_params.get("tab"), "boletim")
    assert_in("tab=boletim", router.current_url)

@runner.register(tier=TIER, name="test_single_view_parent_click_clears_tab_param",
                 description="Verifies navigating to single-view routes removes any previous ?tab= parameter")
def test_single_view_parent_click_clears_tab_param():
    router = AppNavigationRouter("/?tab=rotina")
    assert_equal(router.search_params.get("tab"), "rotina")

    # Navigate to overview
    router.on_parent_click("overview")
    assert_equal(router.active_route, "overview")
    assert_false(router.search_params.has("tab"), "tab parameter must be removed for overview")
    assert_not_in("tab=", router.current_url)

    # Navigate to agenda then calendario
    router.on_parent_click("agenda")
    assert_equal(router.search_params.get("tab"), "comunicacao")
    router.on_parent_click("calendario")
    assert_false(router.search_params.has("tab"), "tab parameter must be removed for calendario")

@runner.register(tier=TIER, name="test_subitem_switching_within_same_section_replaces_param",
                 description="Verifies switching sub-items replaces parameter cleanly without accumulation")
def test_subitem_switching_within_same_section_replaces_param():
    router = AppNavigationRouter("/")
    router.on_sub_item_click("agenda", "comunicacao")
    assert_equal(router.search_params.get("tab"), "comunicacao")

    router.on_sub_item_click("agenda", "whatsapp")
    assert_equal(router.search_params.get("tab"), "whatsapp")
    assert_equal(router.current_url.count("tab="), 1, "Should only have one tab parameter in URL")

    router.on_sub_item_click("agenda", "rotina")
    assert_equal(router.search_params.get("tab"), "rotina")
    assert_equal(router.current_url.count("tab="), 1)

@runner.register(tier=TIER, name="test_url_preserves_external_query_parameters",
                 description="Verifies existing query parameters (tenant, theme, debug) are preserved when updating ?tab=")
def test_url_preserves_external_query_parameters():
    router = AppNavigationRouter("/?tenant=salvia-saber&theme=dark")
    assert_equal(router.search_params.get("tenant"), "salvia-saber")
    assert_equal(router.search_params.get("theme"), "dark")

    router.on_sub_item_click("secretaria", "turmas")
    assert_equal(router.search_params.get("tab"), "turmas")
    assert_equal(router.search_params.get("tenant"), "salvia-saber", "tenant parameter must be preserved")
    assert_equal(router.search_params.get("theme"), "dark", "theme parameter must be preserved")

@runner.register(tier=TIER, name="test_history_stack_records_tab_navigation",
                 description="Verifies each tab change registers a new URL entry in navigation history")
def test_history_stack_records_tab_navigation():
    router = AppNavigationRouter("/")
    initial_history_len = len(router.history)

    router.on_sub_item_click("agenda", "comunicacao")
    router.on_sub_item_click("agenda", "rotina")
    router.on_sub_item_click("agenda", "whatsapp")

    assert_equal(len(router.history), initial_history_len + 3)
    assert_in("tab=comunicacao", router.history[-3])
    assert_in("tab=rotina", router.history[-2])
    assert_in("tab=whatsapp", router.history[-1])
