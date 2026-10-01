#!/usr/bin/env python3
"""
Tier 4: Real-World Application Scenarios — Shareable Deep-Linking
Validates that URLs copied, shared, or bookmarked across sessions faithfully restore both
the active section and its active submenu tab without loss of auxiliary query filters.
"""

from ..harness.test_framework import (
    runner, assert_equal, assert_true, assert_false, assert_in
)
from ..harness.navigation_engine import AppNavigationRouter

TIER = "Tier 4: Real-World Application Scenarios"

@runner.register(tier=TIER, name="test_direct_deep_link_with_route_and_tab",
                 description="Verifies direct URL entry /?route=secretaria&tab=turmas initializes exact view state")
def test_direct_deep_link_with_route_and_tab():
    router = AppNavigationRouter("/?route=secretaria&tab=turmas")
    assert_equal(router.active_route, "secretaria")
    assert_equal(router.search_params.get("tab"), "turmas")
    assert_equal(router.resolve_secretaria_active_tab(), "turmas")
    assert_true(router.is_sub_item_active("secretaria", "turmas"))
    assert_false(router.is_sub_item_active("secretaria", "alunos"))

@runner.register(tier=TIER, name="test_direct_deep_link_with_only_tab",
                 description="Verifies direct entry with only /?tab=whatsapp correctly infers parent route agenda")
def test_direct_deep_link_with_only_tab():
    router = AppNavigationRouter("/?tab=whatsapp")
    assert_equal(router.active_route, "agenda", "Router should infer agenda as parent for tab=whatsapp")
    assert_equal(router.search_params.get("tab"), "whatsapp")
    assert_equal(router.resolve_agenda_active_tab(), "whatsapp")
    assert_true(router.is_sub_item_active("agenda", "whatsapp"))

@runner.register(tier=TIER, name="test_direct_deep_link_with_financeiro_tab",
                 description="Verifies direct entry with /?tab=nfse infers financeiro route and resolves active tab")
def test_direct_deep_link_with_financeiro_tab():
    router = AppNavigationRouter("/?tab=nfse")
    assert_equal(router.active_route, "financeiro")
    assert_equal(router.search_params.get("tab"), "nfse")
    assert_equal(router.resolve_financeiro_active_tab(), "nfse")
    assert_true(router.is_sub_item_active("financeiro", "nfse"))

@runner.register(tier=TIER, name="test_direct_deep_link_with_pedagogico_tab",
                 description="Verifies direct entry with /?tab=nutricao infers pedagogico and resolves active tab")
def test_direct_deep_link_with_pedagogico_tab():
    router = AppNavigationRouter("/?tab=nutricao")
    assert_equal(router.active_route, "pedagogico")
    assert_equal(router.search_params.get("tab"), "nutricao")
    assert_equal(router.resolve_pedagogico_active_tab(), "nutricao")
    assert_true(router.is_sub_item_active("pedagogico", "nutricao"))

@runner.register(tier=TIER, name="test_deep_link_preserves_additional_filter_params",
                 description="Verifies deep link with auxiliary search and pagination filters preserves all parameters")
def test_deep_link_preserves_additional_filter_params():
    deep_link = "/?route=secretaria&tab=alunos&search=Lucas&status=ativo&page=2"
    router = AppNavigationRouter(deep_link)

    assert_equal(router.active_route, "secretaria")
    assert_equal(router.search_params.get("tab"), "alunos")
    assert_equal(router.search_params.get("search"), "Lucas")
    assert_equal(router.search_params.get("status"), "ativo")
    assert_equal(router.search_params.get("page"), "2")

@runner.register(tier=TIER, name="test_copy_paste_shareable_url_consistency",
                 description="Verifies roundtrip: state -> generated URL -> new session matches initial state")
def test_copy_paste_shareable_url_consistency():
    session1 = AppNavigationRouter("/")
    session1.on_parent_click("portal_aluno")
    session1.on_sub_item_click("portal_aluno", "diploma")

    shareable_url = session1.current_url
    assert_in("tab=diploma", shareable_url)

    # Session 2 opens the shared link
    session2 = AppNavigationRouter(shareable_url)
    assert_equal(session2.active_route, "portal_aluno")
    assert_equal(session2.resolve_portal_aluno_active_tab(), "diploma")
    assert_true(session2.is_sub_item_active("portal_aluno", "diploma"))
