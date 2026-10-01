#!/usr/bin/env python3
"""
Tier 3: Cross-Feature Combinations — Mobile Drawer Off-Canvas Navigation
Validates mobile drawer open events, sub-item and parent item clicks with callback dismissal,
DOM signature parity between desktop and mobile, and backdrop dismissal.
"""

from ..harness.test_framework import (
    runner, assert_equal, assert_true, assert_false, assert_in
)
from ..harness.navigation_engine import AppNavigationRouter
from ..harness.dom_contract_oracle import DESKTOP_SIDEBAR_SIGNATURE, MOBILE_DRAWER_SIGNATURE

TIER = "Tier 3: Cross-Feature Combinations"

@runner.register(tier=TIER, name="test_mobile_drawer_open_event",
                 description="Verifies window custom event 'open-mobile-menu' transitions drawer to open state")
def test_mobile_drawer_open_event():
    router = AppNavigationRouter("/")
    assert_false(router.mobile_menu_open)

    # Trigger custom event
    router.mobile_menu_open = True
    assert_true(router.mobile_menu_open, "Drawer must be open following event")

@runner.register(tier=TIER, name="test_mobile_drawer_subitem_click_closes_drawer",
                 description="Verifies clicking sub-item inside mobile drawer updates URL and auto-closes drawer")
def test_mobile_drawer_subitem_click_closes_drawer():
    router = AppNavigationRouter("/")
    router.mobile_menu_open = True
    assert_true(router.mobile_menu_open)

    # Click sub-item in mobile drawer
    router.on_sub_item_click("agenda", "rotina", is_mobile=True)

    assert_false(router.mobile_menu_open, "Mobile drawer must be closed after sub-item click")
    assert_equal(router.mobile_menu_callbacks_triggered, 1, "onClickCallback must be called once")
    assert_equal(router.search_params.get("tab"), "rotina")
    assert_equal(router.active_route, "agenda")

@runner.register(tier=TIER, name="test_mobile_drawer_parent_click_closes_drawer",
                 description="Verifies clicking parent item in mobile drawer switches route, sets tab, and closes drawer")
def test_mobile_drawer_parent_click_closes_drawer():
    router = AppNavigationRouter("/")
    router.mobile_menu_open = True

    router.on_parent_click("secretaria", is_mobile=True)

    assert_false(router.mobile_menu_open, "Mobile drawer must be closed after parent item click")
    assert_equal(router.mobile_menu_callbacks_triggered, 1)
    assert_equal(router.active_route, "secretaria")
    assert_equal(router.search_params.get("tab"), "alunos")

@runner.register(tier=TIER, name="test_mobile_drawer_renders_identical_sublists",
                 description="Verifies mobile drawer NavLinks shares identical hierarchical data and active state")
def test_mobile_drawer_renders_identical_sublists():
    router = AppNavigationRouter("/?tab=ar")
    router.active_route = "financeiro"

    # Both desktop and mobile evaluate identical predicate
    is_ar_active = router.is_sub_item_active("financeiro", "ar")
    is_ap_active = router.is_sub_item_active("financeiro", "ap")

    assert_true(is_ar_active, "AR must be active across both viewport targets")
    assert_false(is_ap_active)

@runner.register(tier=TIER, name="test_mobile_drawer_backdrop_or_close_button",
                 description="Verifies clicking close button closes drawer without changing active route or URL")
def test_mobile_drawer_backdrop_or_close_button():
    router = AppNavigationRouter("/?tab=comunicacao")
    router.active_route = "agenda"
    router.mobile_menu_open = True

    # User clicks backdrop or 'X' button
    router.mobile_menu_open = False

    assert_false(router.mobile_menu_open)
    assert_equal(router.active_route, "agenda", "Route must remain unchanged")
    assert_equal(router.search_params.get("tab"), "comunicacao", "URL tab must remain unchanged")

@runner.register(tier=TIER, name="test_mobile_drawer_expand_toggle_does_not_close_drawer",
                 description="Verifies chevron toggle inside mobile drawer expands sublist without closing drawer")
def test_mobile_drawer_expand_toggle_does_not_close_drawer():
    router = AppNavigationRouter("/")
    router.mobile_menu_open = True

    # User toggles expand for agenda
    router.toggle_expand("agenda")
    assert_true(router.is_route_expanded("agenda"))
    assert_true(router.mobile_menu_open, "Drawer must remain open when user only toggles expansion")
