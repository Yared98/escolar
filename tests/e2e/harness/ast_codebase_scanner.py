#!/usr/bin/env python3
"""
AST & Codebase Source Scanner
Performs static analysis and contract inspection on frontend files to verify
refactoring compliance without breaking during progressive milestone execution.
"""

import os
import re
from typing import Dict, Any, List

def scan_sidebar_file(file_path: str) -> Dict[str, Any]:
    if not os.path.exists(file_path):
        return {"exists": False}
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    has_subitems_interface = bool(re.search(r"interface\s+NavSubItem", content))
    has_subitems_in_navitem = bool(re.search(r"subItems\??\s*:\s*NavSubItem\[\]", content))
    uses_next_navigation = bool(re.search(r"from\s+['\"]next/navigation['\"]", content))
    uses_use_router = bool(re.search(r"\buseRouter\b", content))
    uses_use_search_params = bool(re.search(r"\buseSearchParams\b", content))
    has_collapsible_css_grid = bool(re.search(r"grid-rows-\[1fr\]", content) and re.search(r"grid-rows-\[0fr\]", content))
    has_tab_param_sync = bool(re.search(r"['\"]tab['\"]", content))

    return {
        "exists": True,
        "has_subitems_interface": has_subitems_interface,
        "has_subitems_in_navitem": has_subitems_in_navitem,
        "uses_next_navigation": uses_next_navigation,
        "uses_use_router": uses_use_router,
        "uses_use_search_params": uses_use_search_params,
        "has_collapsible_css_grid": has_collapsible_css_grid,
        "has_tab_param_sync": has_tab_param_sync,
        "is_m1_compliant": all([
            has_subitems_interface,
            has_subitems_in_navitem,
            uses_next_navigation,
            uses_use_search_params,
            has_collapsible_css_grid,
            has_tab_param_sync
        ])
    }

def scan_page_file(file_path: str) -> Dict[str, Any]:
    if not os.path.exists(file_path):
        return {"exists": False}
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    has_suspense = bool(re.search(r"<(?:\w+\.)?Suspense\b", content))
    has_use_search_params = bool(re.search(r"\buseSearchParams\b", content))

    return {
        "exists": True,
        "has_suspense": has_suspense,
        "has_use_search_params": has_use_search_params,
        "is_m1_compliant": has_suspense
    }

def scan_section_file(file_path: str, default_tab: str, valid_tabs: List[str]) -> Dict[str, Any]:
    if not os.path.exists(file_path):
        return {"exists": False}
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    uses_use_search_params = bool(re.search(r"\buseSearchParams\b", content))
    reads_tab_param = bool(re.search(r"searchParams(?:\.get|\?\.get)\(['\"]tab['\"]\)", content))
    has_local_tab_state = bool(re.search(r"useState<[^>]*" + default_tab + r"[^>]*>", content))

    return {
        "exists": True,
        "uses_use_search_params": uses_use_search_params,
        "reads_tab_param": reads_tab_param,
        "has_local_tab_state": has_local_tab_state,
        "is_refactored": uses_use_search_params and reads_tab_param and not has_local_tab_state
    }
