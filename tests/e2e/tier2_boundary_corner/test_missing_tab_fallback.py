#!/usr/bin/env python3
"""
Tier 2: Boundary & Corner Cases — Missing ?tab= Fallback
Validates that when the URL query parameter ?tab= is absent, null, or empty,
each section component and the Sidebar active sub-item state gracefully fall back to the canonical defaultTab.
"""

from ..harness.test_framework import (
    runner, assert_equal, assert_true, assert_false
)
from ..harness.navigation_engine import AppNavigationRouter

TIER = "Tier 2: Boundary & Corner Cases"

@runner.register(tier=TIER, name="test_agenda_missing_tab_fallback",
                 description="Verifies AgendaDigitalSection defaults to 'comunicacao' when ?tab= is omitted or empty")
def test_agenda_missing_tab_fallback():
    # Absent ?tab=
    router = AppNavigationRouter("/")
    assert_equal(router.resolve_agenda_active_tab(), "comunicacao")

    # Empty string ?tab=
    router.push("/?tab=")
    assert_equal(router.resolve_agenda_active_tab(), "comunicacao")

@runner.register(tier=TIER, name="test_secretaria_missing_tab_fallback",
                 description="Verifies SecretariaSection defaults to 'alunos' when ?tab= is omitted or empty")
def test_secretaria_missing_tab_fallback():
    router = AppNavigationRouter("/")
    assert_equal(router.resolve_secretaria_active_tab(), "alunos")

    router.push("/?tab=")
    assert_equal(router.resolve_secretaria_active_tab(), "alunos")

@runner.register(tier=TIER, name="test_financeiro_missing_tab_fallback",
                 description="Verifies FinanceiroSection defaults to 'ar' when ?tab= is omitted or empty")
def test_financeiro_missing_tab_fallback():
    router = AppNavigationRouter("/")
    assert_equal(router.resolve_financeiro_active_tab(), "ar")

    router.push("/?tab=")
    assert_equal(router.resolve_financeiro_active_tab(), "ar")

@runner.register(tier=TIER, name="test_pedagogico_missing_tab_fallback",
                 description="Verifies PedagocioNutricaoSection defaults to 'disciplinas_matriz' when ?tab= is omitted")
def test_pedagogico_missing_tab_fallback():
    router = AppNavigationRouter("/")
    assert_equal(router.resolve_pedagogico_active_tab(), "disciplinas_matriz")

    router.push("/?tab=")
    assert_equal(router.resolve_pedagogico_active_tab(), "disciplinas_matriz")

@runner.register(tier=TIER, name="test_portal_aluno_missing_tab_fallback",
                 description="Verifies PortalAlunoSection defaults to 'boletim' when ?tab= is omitted")
def test_portal_aluno_missing_tab_fallback():
    router = AppNavigationRouter("/")
    assert_equal(router.resolve_portal_aluno_active_tab(), "boletim")

    router.push("/?tab=")
    assert_equal(router.resolve_portal_aluno_active_tab(), "boletim")

@runner.register(tier=TIER, name="test_sidebar_highlights_default_tab_when_tab_param_omitted",
                 description="Verifies Sidebar sublist highlights defaultTab when on active route without ?tab= in URL")
def test_sidebar_highlights_default_tab_when_tab_param_omitted():
    # User on agenda route with clean URL / (no ?tab=)
    router = AppNavigationRouter("/")
    router.active_route = "agenda"
    # Even without ?tab=, comunicacao is highlighted
    assert_true(router.is_sub_item_active("agenda", "comunicacao"))
    assert_false(router.is_sub_item_active("agenda", "rotina"))
    assert_false(router.is_sub_item_active("agenda", "whatsapp"))
