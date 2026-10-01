#!/usr/bin/env python3
"""
RBAC Permission Simulator
Models and verifies role-based access control across navigation routes and collapsible sublists
for admin, gestor, financeiro, secretaria, professor, nutricionista, and responsavel roles.
"""

from typing import Dict, List, Set
from .navigation_engine import CANONICAL_MENU_ITEMS, NavItem

VALID_ROLES = [
    "admin",
    "gestor",
    "financeiro",
    "secretaria",
    "professor",
    "nutricionista",
    "responsavel"
]

def is_route_allowed(route_id: str, role: str) -> bool:
    """Verbatim implementation of the RBAC matrix from Sidebar.tsx."""
    if role in ("admin", "gestor"):
        return True

    if route_id == "overview":
        return role != "responsavel"
    elif route_id == "secretaria":
        return role in ("financeiro", "secretaria")
    elif route_id == "financeiro":
        return role == "financeiro"
    elif route_id in ("pedagogico", "academico"):
        return role in ("professor", "nutricionista")
    elif route_id == "administrativo":
        return False
    elif route_id == "calendario":
        return True
    elif route_id == "crm":
        return role in ("admin", "gestor", "secretaria")
    elif route_id == "ia_evasao":
        return role in ("admin", "gestor")
    elif route_id == "agenda":
        return role in ("professor", "nutricionista", "responsavel")
    elif route_id == "portal_aluno":
        return role == "responsavel"
    return False

def get_allowed_routes_for_role(role: str) -> List[str]:
    return [item.id for item in CANONICAL_MENU_ITEMS if is_route_allowed(item.id, role)]

def get_allowed_subitems_for_role(role: str) -> Dict[str, List[str]]:
    """Returns accessible subitems mapped by parent route for a given role."""
    result = {}
    for item in CANONICAL_MENU_ITEMS:
        if is_route_allowed(item.id, role):
            result[item.id] = [sub.tab_key for sub in item.sub_items]
    return result

def is_tab_accessible(route_id: str, tab_key: str, role: str) -> bool:
    """A tab is only accessible if the parent route is allowed for the user's role."""
    if not is_route_allowed(route_id, role):
        return False
    for item in CANONICAL_MENU_ITEMS:
        if item.id == route_id:
            return any(sub.tab_key == tab_key for sub in item.sub_items)
    return False
