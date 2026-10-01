#!/usr/bin/env python3
"""
Tier 1: Feature Coverage — Sidebar Submenus
Validates hierarchical NavItem data structure, collapsible sublist state transitions,
auto-expansion on active route, manual toggle without route change, and sub-item highlighting.
"""

from ..harness.test_framework import (
    runner, assert_equal, assert_true, assert_false, assert_in, assert_not_in
)
from ..harness.navigation_engine import AppNavigationRouter, CANONICAL_MENU_ITEMS

TIER = "Tier 1: Feature Coverage"

@runner.register(tier=TIER, name="test_canonical_menu_subitems_schema",
                 description="Verifies NavItem hierarchical schema and required subItems on target routes")
def test_canonical_menu_subitems_schema():
    router = AppNavigationRouter("/")
    expected_subitem_routes = {
        "portal_aluno": 4,
        "agenda": 3,
        "secretaria": 2,
        "financeiro": 4,
        "pedagogico": 5,
        "academico": 2,
        "administrativo": 4
    }

    for route_id, expected_count in expected_subitem_routes.items():
        item = router.get_nav_item(route_id)
        assert_true(item is not None, f"Route {route_id} must exist in canonical menu")
        assert_true(item.has_sub_items, f"Route {route_id} must declare subItems")
        assert_equal(len(item.sub_items), expected_count, f"Route {route_id} subItems count mismatch")
        for sub in item.sub_items:
            assert_true(len(sub.id) > 0, "SubItem id must not be empty")
            assert_true(len(sub.label) > 0, "SubItem label must not be empty")
            assert_true(len(sub.tab_key) > 0, "SubItem tabKey must not be empty")

@runner.register(tier=TIER, name="test_sidebar_auto_expansion_on_active_route",
                 description="Verifies sublist automatically expands when parent route becomes active")
def test_sidebar_auto_expansion_on_active_route():
    router = AppNavigationRouter("/")
    assert_equal(router.active_route, "overview")
    assert_false(router.is_route_expanded("agenda"), "Agenda should not be expanded when overview is active")

    # Navigate to agenda
    router.on_parent_click("agenda")
    assert_equal(router.active_route, "agenda")
    assert_true(router.is_route_expanded("agenda"), "Agenda must auto-expand when active")
    assert_false(router.is_route_expanded("secretaria"), "Secretaria must not be expanded")

    # Navigate to secretaria
    router.on_parent_click("secretaria")
    assert_equal(router.active_route, "secretaria")
    assert_true(router.is_route_expanded("secretaria"), "Secretaria must auto-expand when active")

@runner.register(tier=TIER, name="test_sidebar_manual_toggle_expand_without_changing_route",
                 description="Verifies manual toggle via chevron collapses or expands without changing activeRoute")
def test_sidebar_manual_toggle_expand_without_changing_route():
    router = AppNavigationRouter("/")
    router.on_parent_click("agenda")
    assert_equal(router.active_route, "agenda")
    assert_true(router.is_route_expanded("agenda"))

    # Manually collapse agenda without changing route
    router.toggle_expand("agenda")
    assert_false(router.is_route_expanded("agenda"), "Agenda should now be collapsed")
    assert_equal(router.active_route, "agenda", "Active route must remain agenda")

    # Manually expand financeiro while still on agenda
    router.toggle_expand("financeiro")
    assert_true(router.is_route_expanded("financeiro"), "Financeiro should now be expanded")
    assert_equal(router.active_route, "agenda", "Active route must still remain agenda")

@runner.register(tier=TIER, name="test_sidebar_active_subitem_highlight_predicate",
                 description="Verifies is_sub_item_active accurately detects active tab and rejects siblings")
def test_sidebar_active_subitem_highlight_predicate():
    router = AppNavigationRouter("/")
    router.on_parent_click("agenda")
    # On parent click, defaultTab is comunicacao
    assert_true(router.is_sub_item_active("agenda", "comunicacao"), "comunicacao should be active by default")
    assert_false(router.is_sub_item_active("agenda", "rotina"), "rotina should not be active")
    assert_false(router.is_sub_item_active("agenda", "whatsapp"), "whatsapp should not be active")

    # Click rotina sub-item
    router.on_sub_item_click("agenda", "rotina")
    assert_true(router.is_sub_item_active("agenda", "rotina"), "rotina should now be active")
    assert_false(router.is_sub_item_active("agenda", "comunicacao"), "comunicacao should no longer be active")

@runner.register(tier=TIER, name="test_single_view_routes_have_no_subitems",
                 description="Verifies single-view routes (overview, calendario, crm, ia_evasao) have no subItems")
def test_single_view_routes_have_no_subitems():
    router = AppNavigationRouter("/")
    single_views = ["overview", "calendario", "crm", "ia_evasao"]
    for route_id in single_views:
        item = router.get_nav_item(route_id)
        assert_true(item is not None, f"Route {route_id} must exist")
        assert_false(item.has_sub_items, f"Route {route_id} should not declare subItems")
        assert_equal(len(item.sub_items), 0)

@runner.register(tier=TIER, name="test_sidebar_subitems_unique_keys_and_defaults",
                 description="Verifies every tabKey is unique within its parent route and defaultTab is valid")
def test_sidebar_subitems_unique_keys_and_defaults():
    for item in CANONICAL_MENU_ITEMS:
        if item.has_sub_items:
            assert_true(item.default_tab is not None, f"Route {item.id} must declare defaultTab")
            keys = [sub.tab_key for sub in item.sub_items]
            assert_equal(len(keys), len(set(keys)), f"Duplicate tabKey found in route {item.id}")
            assert_in(item.default_tab, keys, f"defaultTab {item.default_tab} must exist in subItems of {item.id}")
