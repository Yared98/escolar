#!/usr/bin/env python3
"""
Tier 2: Boundary & Corner Cases — Invalid ?tab= Handling
Validates adversarial, malformed, non-existent, and cross-section ?tab= parameters,
ensuring strict whitelist validation and safe fallback to defaultTab without crashing or rendering blank views.
"""

from ..harness.test_framework import (
    runner, assert_equal, assert_true, assert_false
)
from ..harness.navigation_engine import AppNavigationRouter

TIER = "Tier 2: Boundary & Corner Cases"

@runner.register(tier=TIER, name="test_agenda_invalid_tab_falls_back_to_default",
                 description="Verifies non-existent tabs in Agenda (?tab=unknown, ?tab=123) fall back to 'comunicacao'")
def test_agenda_invalid_tab_falls_back_to_default():
    router = AppNavigationRouter("/")
    for bad_tab in ["unknown", "123", "alunos", "null", "undefined"]:
        router.push(f"/?tab={bad_tab}")
        assert_equal(router.resolve_agenda_active_tab(), "comunicacao",
                     f"Agenda must fall back to comunicacao for {bad_tab}")

@runner.register(tier=TIER, name="test_secretaria_invalid_tab_falls_back_to_default",
                 description="Verifies non-existent tabs in Secretaria fall back to 'alunos'")
def test_secretaria_invalid_tab_falls_back_to_default():
    router = AppNavigationRouter("/")
    for bad_tab in ["ar", "rotina", "xyz", "educacenso_invalid"]:
        router.push(f"/?tab={bad_tab}")
        assert_equal(router.resolve_secretaria_active_tab(), "alunos",
                     f"Secretaria must fall back to alunos for {bad_tab}")

@runner.register(tier=TIER, name="test_financeiro_invalid_tab_falls_back_to_default",
                 description="Verifies non-existent tabs in Financeiro fall back to 'ar'")
def test_financeiro_invalid_tab_falls_back_to_default():
    router = AppNavigationRouter("/")
    for bad_tab in ["alunos", "comunicacao", "fake_tab"]:
        router.push(f"/?tab={bad_tab}")
        assert_equal(router.resolve_financeiro_active_tab(), "ar",
                     f"Financeiro must fall back to ar for {bad_tab}")

@runner.register(tier=TIER, name="test_pedagogico_invalid_tab_falls_back_to_default",
                 description="Verifies non-existent tabs in Pedagógico fall back to 'disciplinas_matriz'")
def test_pedagogico_invalid_tab_falls_back_to_default():
    router = AppNavigationRouter("/")
    for bad_tab in ["invalid", "boletim", "envios"]:
        router.push(f"/?tab={bad_tab}")
        assert_equal(router.resolve_pedagogico_active_tab(), "disciplinas_matriz",
                     f"Pedagógico must fall back to disciplinas_matriz for {bad_tab}")

@runner.register(tier=TIER, name="test_sidebar_subitem_active_with_invalid_tab",
                 description="Verifies no sub-item is marked active when an unrecognized ?tab= is supplied")
def test_sidebar_subitem_active_with_invalid_tab():
    router = AppNavigationRouter("/?tab=non_existent_tab")
    router.active_route = "agenda"
    # When explicit tab is provided but invalid, none of the subitems match
    assert_false(router.is_sub_item_active("agenda", "comunicacao"))
    assert_false(router.is_sub_item_active("agenda", "rotina"))
    assert_false(router.is_sub_item_active("agenda", "whatsapp"))

@runner.register(tier=TIER, name="test_special_characters_and_encoding_in_tab",
                 description="Verifies adversarial injection characters in ?tab= are sanitized by whitelist validation")
def test_special_characters_and_encoding_in_tab():
    router = AppNavigationRouter("/")
    adversarial_inputs = [
        "<script>alert(1)</script>",
        "../../etc/passwd",
        "%00%20%0D%0A",
        "comunicacao' OR '1'='1",
        "tab%20with%20spaces"
    ]
    for adv in adversarial_inputs:
        router.push(f"/?tab={adv}")
        assert_equal(router.resolve_agenda_active_tab(), "comunicacao")
        assert_equal(router.resolve_secretaria_active_tab(), "alunos")
        assert_equal(router.resolve_financeiro_active_tab(), "ar")
