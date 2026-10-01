#!/usr/bin/env python3
"""
Verification script for Milestone 1: Sidebar Navigation & Shell
Verifies AST, types, exports, and integrity of Sidebar.tsx and page.tsx.
"""

import sys
import re
from pathlib import Path

def test_sidebar():
    sidebar_path = Path("d:/Projetos/escolar/frontend/src/components/Sidebar.tsx")
    assert sidebar_path.exists(), "Sidebar.tsx does not exist"
    content = sidebar_path.read_text(encoding="utf-8")

    # 1. Check exports
    assert "export type NavRoute =" in content, "NavRoute not exported"
    assert "export interface NavSubItem" in content, "NavSubItem not exported"
    assert "export interface NavItem" in content, "NavItem not exported"
    assert "export interface SidebarProps" in content, "SidebarProps not exported"
    assert "export const MENU_ITEMS" in content, "MENU_ITEMS not exported"
    assert "export const findRouteByTab" in content, "findRouteByTab not exported"
    assert "export function Sidebar" in content, "Sidebar not exported"

    # 2. Check next/navigation hooks
    assert "useRouter" in content, "useRouter missing"
    assert "useSearchParams" in content, "useSearchParams missing"
    assert "usePathname" in content, "usePathname missing"

    # 3. Check CSS Grid transition classes
    assert "grid-rows-[1fr]" in content, "grid-rows-[1fr] missing"
    assert "grid-rows-[0fr]" in content, "grid-rows-[0fr] missing"

    # 4. Check sub-item routes
    expected_routes = [
        "portal_aluno",
        "agenda",
        "secretaria",
        "financeiro",
        "pedagogico",
        "academico",
        "administrativo"
    ]
    for r in expected_routes:
        assert f"id: '{r}'" in content, f"Route {r} missing from MENU_ITEMS"

    # 5. Check specific sub-item tabKeys
    tab_keys = [
        "boletim", "financeiro", "diploma", "rotina",
        "comunicacao", "whatsapp",
        "alunos", "turmas",
        "ar", "ap", "nfse", "bi",
        "disciplinas_matriz", "atribuicao_horarios", "projetos", "nutricao",
        "fundamental", "infantil",
        "envios", "entidades", "fornecedores", "relatorios"
    ]
    for k in tab_keys:
        assert f"tabKey: '{k}'" in content, f"tabKey {k} missing"

    # 6. Check RBAC
    assert "isAllowed" in content, "isAllowed missing"
    assert "role === 'admin' || role === 'gestor'" in content, "Admin/gestor check missing"

    # 7. Check toggle expand and parent click
    assert "handleToggleExpand" in content, "handleToggleExpand missing"
    assert "handleParentClick" in content, "handleParentClick missing"
    assert "handleSubItemClick" in content, "handleSubItemClick missing"
    assert "isRouteExpanded" in content, "isRouteExpanded missing"

    print("[OK] Sidebar.tsx specifications and contracts verified.")

def test_page():
    page_path = Path("d:/Projetos/escolar/frontend/src/app/page.tsx")
    assert page_path.exists(), "page.tsx does not exist"
    content = page_path.read_text(encoding="utf-8")

    # 1. Suspense check
    assert "<Suspense fallback={<SectionSkeleton />}>" in content or "<React.Suspense fallback={<SectionSkeleton />}>" in content, "Suspense boundary missing"

    # 2. useSearchParams check
    assert "useSearchParams" in content, "useSearchParams missing from page.tsx"

    # 3. Route synchronization check
    assert "searchParams.get('route')" in content, "searchParams route lookup missing"
    assert "handleRouteChange" in content, "handleRouteChange missing"
    assert "findRouteByTab" in content, "findRouteByTab lookup missing"

    # 4. Sidebar mounting
    assert "<Sidebar activeRoute={activeRoute} onRouteChange={handleRouteChange} />" in content, "Sidebar mounting with onRouteChange missing"

    print("[OK] page.tsx specifications and contracts verified.")

if __name__ == "__main__":
    test_sidebar()
    test_page()
    print("=== ALL MILESTONE 1 CHECKS PASSED ===")
