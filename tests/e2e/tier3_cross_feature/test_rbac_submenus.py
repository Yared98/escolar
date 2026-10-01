#!/usr/bin/env python3
"""
Tier 3: Cross-Feature Combinations — RBAC Role Filtering with Submenus
Validates role-based access control cascading across parent menu items and their nested sublists
for all 7 roles: admin, gestor, financeiro, secretaria, professor, nutricionista, responsavel.
"""

from ..harness.test_framework import (
    runner, assert_equal, assert_true, assert_false, assert_in, assert_not_in
)
from ..harness.rbac_simulator import (
    VALID_ROLES, is_route_allowed, get_allowed_routes_for_role,
    get_allowed_subitems_for_role, is_tab_accessible
)
from ..harness.navigation_engine import CANONICAL_MENU_ITEMS

TIER = "Tier 3: Cross-Feature Combinations"

@runner.register(tier=TIER, name="test_admin_and_gestor_roles_see_all_submenus",
                 description="Verifies admin and gestor roles have access to all routes and sub-items")
def test_admin_and_gestor_roles_see_all_submenus():
    for role in ["admin", "gestor"]:
        allowed_routes = get_allowed_routes_for_role(role)
        for item in CANONICAL_MENU_ITEMS:
            assert_in(item.id, allowed_routes, f"Admin/Gestor must have access to {item.id}")
            for sub in item.sub_items:
                assert_true(is_tab_accessible(item.id, sub.tab_key, role),
                            f"Admin/Gestor must have access to {item.id} -> {sub.tab_key}")

@runner.register(tier=TIER, name="test_financeiro_role_submenus_filtering",
                 description="Verifies financeiro role sees financeiro and secretaria submenus, but not pedagogico")
def test_financeiro_role_submenus_filtering():
    role = "financeiro"
    allowed_routes = get_allowed_routes_for_role(role)
    assert_in("financeiro", allowed_routes)
    assert_in("secretaria", allowed_routes)
    assert_not_in("pedagogico", allowed_routes)
    assert_not_in("academico", allowed_routes)
    assert_not_in("portal_aluno", allowed_routes)

    # Subitem check
    assert_true(is_tab_accessible("financeiro", "ar", role))
    assert_true(is_tab_accessible("financeiro", "ap", role))
    assert_true(is_tab_accessible("secretaria", "alunos", role))
    assert_false(is_tab_accessible("pedagogico", "disciplinas_matriz", role))

@runner.register(tier=TIER, name="test_professor_and_nutricionista_roles_submenus_filtering",
                 description="Verifies professor and nutricionista see pedagogico, academico, and agenda submenus")
def test_professor_and_nutricionista_roles_submenus_filtering():
    for role in ["professor", "nutricionista"]:
        assert_true(is_route_allowed("pedagogico", role))
        assert_true(is_route_allowed("academico", role))
        assert_true(is_route_allowed("agenda", role))
        assert_false(is_route_allowed("financeiro", role))
        assert_false(is_route_allowed("portal_aluno", role))

        assert_true(is_tab_accessible("pedagogico", "nutricao", role))
        assert_true(is_tab_accessible("academico", "fundamental", role))
        assert_false(is_tab_accessible("financeiro", "bi", role))

@runner.register(tier=TIER, name="test_responsavel_role_submenus_filtering",
                 description="Verifies responsavel sees portal_aluno and agenda, and is denied overview/financeiro")
def test_responsavel_role_submenus_filtering():
    role = "responsavel"
    assert_true(is_route_allowed("portal_aluno", role))
    assert_true(is_route_allowed("agenda", role))
    assert_false(is_route_allowed("overview", role), "Responsavel must not have access to overview")
    assert_false(is_route_allowed("financeiro", role))
    assert_false(is_route_allowed("secretaria", role))

    # Accessible subitems
    assert_true(is_tab_accessible("portal_aluno", "boletim", role))
    assert_true(is_tab_accessible("portal_aluno", "financeiro", role))
    assert_true(is_tab_accessible("agenda", "comunicacao", role))
    assert_false(is_tab_accessible("secretaria", "turmas", role))

@runner.register(tier=TIER, name="test_parent_permission_denial_cascades_to_all_subitems",
                 description="Verifies that when a parent route is disallowed, all of its sub-items are inaccessible")
def test_parent_permission_denial_cascades_to_all_subitems():
    role = "secretaria"
    # Secretaria cannot access financeiro
    assert_false(is_route_allowed("financeiro", role))
    for tab in ["ar", "ap", "nfse", "bi"]:
        assert_false(is_tab_accessible("financeiro", tab, role),
                     f"Subitem {tab} must be inaccessible when parent financeiro is denied")

@runner.register(tier=TIER, name="test_secretaria_role_submenus_filtering",
                 description="Verifies secretaria role sees secretaria and crm, but not academico")
def test_secretaria_role_submenus_filtering():
    role = "secretaria"
    assert_true(is_route_allowed("secretaria", role))
    assert_true(is_route_allowed("crm", role))
    assert_false(is_route_allowed("academico", role))

    assert_true(is_tab_accessible("secretaria", "alunos", role))
    assert_true(is_tab_accessible("secretaria", "turmas", role))
    assert_false(is_tab_accessible("academico", "infantil", role))
