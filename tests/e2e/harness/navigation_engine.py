#!/usr/bin/env python3
"""
Navigation Engine & State Machine Simulator
Faithfully simulates Next.js 14 App Router, URL searchParams, Sidebar hierarchical submenus,
and Section component reactive URL parameter bindings according to PROJECT.md specifications.
"""

from typing import Dict, List, Optional, Any, Tuple
from urllib.parse import urlparse, parse_qs, urlencode

class NavSubItem:
    def __init__(self, id: str, label: str, tab_key: str, icon: str = ""):
        self.id = id
        self.label = label
        self.tab_key = tab_key
        self.icon = icon

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "label": self.label,
            "tabKey": self.tab_key,
            "icon": self.icon
        }

class NavItem:
    def __init__(self, id: str, label: str, icon: str = "", default_tab: Optional[str] = None, sub_items: Optional[List[NavSubItem]] = None):
        self.id = id
        self.label = label
        self.icon = icon
        self.default_tab = default_tab
        self.sub_items = sub_items or []

    @property
    def has_sub_items(self) -> bool:
        return len(self.sub_items) > 0

# Authoritative Canonical Menu Hierarchy defined in PROJECT.md and survey findings
CANONICAL_MENU_ITEMS: List[NavItem] = [
    NavItem(id="overview", label="Visão Geral", icon="LayoutDashboard"),
    NavItem(
        id="portal_aluno",
        label="Portal do Aluno (Central da Família)",
        icon="GraduationCap",
        default_tab="boletim",
        sub_items=[
            NavSubItem(id="portal-boletim", label="Boletim & Desempenho", tab_key="boletim", icon="FileText"),
            NavSubItem(id="portal-financeiro", label="Mensalidades Pix", tab_key="financeiro", icon="DollarSign"),
            NavSubItem(id="portal-diploma", label="Documentos & Diploma MEC", tab_key="diploma", icon="Award"),
            NavSubItem(id="portal-rotina", label="Rotina & Diário Escolar", tab_key="rotina", icon="Baby"),
        ]
    ),
    NavItem(id="calendario", label="Planner & Calendário Escolar", icon="CalendarDays"),
    NavItem(id="crm", label="CRM & Captação", icon="Megaphone"),
    NavItem(id="ia_evasao", label="IA Anti-Evasão (EWS)", icon="Brain"),
    NavItem(
        id="agenda",
        label="Comunicados & Caixa de Mensagens",
        icon="Smartphone",
        default_tab="comunicacao",
        sub_items=[
            NavSubItem(id="agenda-comunicacao", label="Mensagens & Mural", tab_key="comunicacao", icon="MessageSquare"),
            NavSubItem(id="agenda-rotina", label="Resumo de Rotina", tab_key="rotina", icon="HeartPulse"),
            NavSubItem(id="agenda-whatsapp", label="WhatsApp (Transbordo)", tab_key="whatsapp", icon="MessageCircle"),
        ]
    ),
    NavItem(
        id="secretaria",
        label="Secretaria & Prontuários",
        icon="Users",
        default_tab="alunos",
        sub_items=[
            NavSubItem(id="sec-alunos", label="Alunos & Matrículas", tab_key="alunos", icon="Users"),
            NavSubItem(id="sec-turmas", label="Turmas & Ensalamento", tab_key="turmas", icon="BookOpen"),
        ]
    ),
    NavItem(
        id="financeiro",
        label="Financeiro & Boletos (AP/AR)",
        icon="DollarSign",
        default_tab="ar",
        sub_items=[
            NavSubItem(id="fin-ar", label="Faturas & Mensalidades (AR)", tab_key="ar", icon="ArrowDownLeft"),
            NavSubItem(id="fin-ap", label="Despesas & Fornecedores (AP)", tab_key="ap", icon="ArrowUpRight"),
            NavSubItem(id="fin-nfse", label="NFS-e Automatizada", tab_key="nfse", icon="FileText"),
            NavSubItem(id="fin-bi", label="Demonstrativo DRE & DFC", tab_key="bi", icon="PieChart"),
        ]
    ),
    NavItem(
        id="pedagogico",
        label="Pedagógico & Nutrição",
        icon="BookOpen",
        default_tab="disciplinas_matriz",
        sub_items=[
            NavSubItem(id="ped-matriz", label="Disciplinas & Matriz", tab_key="disciplinas_matriz", icon="Layers"),
            NavSubItem(id="ped-horarios", label="Atribuição & Horários", tab_key="atribuicao_horarios", icon="Clock"),
            NavSubItem(id="ped-turmas", label="Visão das Turmas", tab_key="turmas", icon="Users"),
            NavSubItem(id="ped-projetos", label="Projetos BNCC", tab_key="projetos", icon="Sparkles"),
            NavSubItem(id="ped-nutricao", label="Planner de Nutrição", tab_key="nutricao", icon="Utensils"),
        ]
    ),
    NavItem(
        id="academico",
        label="Diário PWA (Professora)",
        icon="Sparkles",
        default_tab="fundamental",
        sub_items=[
            NavSubItem(id="acad-fundamental", label="Chamada Touch (Fundamental)", tab_key="fundamental", icon="Smartphone"),
            NavSubItem(id="acad-infantil", label="Rotina (Educação Infantil)", tab_key="infantil", icon="Baby"),
        ]
    ),
    NavItem(
        id="administrativo",
        label="Administrativo & RH",
        icon="Building2",
        default_tab="envios",
        sub_items=[
            NavSubItem(id="adm-envios", label="Registro de Envios (Audit)", tab_key="envios", icon="Send"),
            NavSubItem(id="adm-entidades", label="Corpo Docente & RH", tab_key="entidades", icon="UserCheck"),
            NavSubItem(id="adm-fornecedores", label="Fornecedores", tab_key="fornecedores", icon="Truck"),
            NavSubItem(id="adm-relatorios", label="Auditoria LGPD", tab_key="relatorios", icon="ShieldCheck"),
        ]
    ),
]

class MockURLSearchParams:
    """Simulates JavaScript URLSearchParams object."""
    def __init__(self, init_dict_or_str: Any = None):
        self._params: Dict[str, str] = {}
        if isinstance(init_dict_or_str, str):
            clean_str = init_dict_or_str.lstrip("?")
            if clean_str:
                parsed = parse_qs(clean_str, keep_blank_values=True)
                for k, v in parsed.items():
                    self._params[k] = v[-1] if v else ""
        elif isinstance(init_dict_or_str, dict):
            for k, v in init_dict_or_str.items():
                self._params[str(k)] = str(v)

    def get(self, key: str) -> Optional[str]:
        return self._params.get(key)

    def set(self, key: str, value: str):
        self._params[key] = str(value)

    def delete(self, key: str):
        self._params.pop(key, None)

    def has(self, key: str) -> bool:
        return key in self._params

    def to_string(self) -> str:
        return urlencode(self._params)

    def clone(self) -> 'MockURLSearchParams':
        cp = MockURLSearchParams()
        cp._params = dict(self._params)
        return cp

    def __repr__(self) -> str:
        return f"MockURLSearchParams({self._params})"

class AppNavigationRouter:
    """
    Simulates the Next.js 14 Navigation Environment for Escolar dashboard:
    Manages activeRoute, URL searchParams, pushState history, Sidebar expansion, and Section rendering.
    """
    def __init__(self, initial_url: str = "/"):
        self.menu_items = CANONICAL_MENU_ITEMS
        self.history: List[str] = []
        self.current_url = initial_url
        self.pathname = "/"
        self.search_params = MockURLSearchParams()
        self.active_route: str = "overview"
        self.expanded_routes: Dict[str, bool] = {}
        self.mobile_menu_open: bool = False
        self.mobile_menu_callbacks_triggered: int = 0

        # Load initial URL
        self._parse_and_apply_url(initial_url)

    def _parse_and_apply_url(self, url: str):
        self.history.append(url)
        self.current_url = url
        parsed = urlparse(url)
        self.pathname = parsed.path or "/"
        self.search_params = MockURLSearchParams(parsed.query)

        # Route deep-linking synchronization
        explicit_route = self.search_params.get("route")
        explicit_tab = self.search_params.get("tab")

        if explicit_route:
            self.active_route = explicit_route
        elif explicit_tab:
            # Map tab to parent route if route is omitted
            inferred = self._find_parent_route_by_tab(explicit_tab)
            if inferred:
                self.active_route = inferred

    def _find_parent_route_by_tab(self, tab: str) -> Optional[str]:
        for item in self.menu_items:
            for sub in item.sub_items:
                if sub.tab_key == tab:
                    return item.id
        return None

    def push(self, url: str, scroll: bool = False):
        """Simulates router.push(url, { scroll: false })"""
        self._parse_and_apply_url(url)

    def get_nav_item(self, route_id: str) -> Optional[NavItem]:
        for item in self.menu_items:
            if item.id == route_id:
                return item
        return None

    # Sidebar State Operations
    def is_route_expanded(self, route_id: str) -> bool:
        if route_id in self.expanded_routes:
            return self.expanded_routes[route_id]
        # Auto-expanded if activeRoute === route_id
        return self.active_route == route_id

    def toggle_expand(self, route_id: str):
        """Simulates clicking chevron expand/collapse icon without switching route."""
        current = self.is_route_expanded(route_id)
        self.expanded_routes[route_id] = not current

    def on_parent_click(self, route_id: str, is_mobile: bool = False):
        """
        Simulates clicking a main item in the Sidebar.
        Follows interface contract in PROJECT.md:
        - If activeRoute !== route_id: switches activeRoute, auto-expands, appends defaultTab if sub-items exist.
        - If activeRoute === route_id and has sub-items: toggles collapse.
        """
        item = self.get_nav_item(route_id)
        if not item:
            return

        if self.active_route != route_id:
            self.active_route = route_id
            self.expanded_routes[route_id] = True

            params = self.search_params.clone()
            if item.has_sub_items and item.default_tab:
                params.set("tab", item.default_tab)
            else:
                params.delete("tab")

            q = params.to_string()
            target_url = f"{self.pathname}?{q}" if q else self.pathname
            self.push(target_url, scroll=False)

            if is_mobile:
                self.mobile_menu_open = False
                self.mobile_menu_callbacks_triggered += 1
        elif item.has_sub_items:
            # Already active, toggle expand/collapse
            self.toggle_expand(route_id)

    def on_sub_item_click(self, parent_route_id: str, tab_key: str, is_mobile: bool = False):
        """
        Simulates clicking a nested sub-item in the Sidebar.
        Sets ?tab=... in URL, sets activeRoute if needed, closes mobile drawer if open.
        """
        params = self.search_params.clone()
        params.set("tab", tab_key)
        q = params.to_string()
        target_url = f"{self.pathname}?{q}" if q else self.pathname
        self.push(target_url, scroll=False)

        if self.active_route != parent_route_id:
            self.active_route = parent_route_id
            self.expanded_routes[parent_route_id] = True

        if is_mobile:
            self.mobile_menu_open = False
            self.mobile_menu_callbacks_triggered += 1

    def is_sub_item_active(self, parent_route_id: str, tab_key: str) -> bool:
        """
        Predicate according to PROJECT.md § Interface Contracts:
        isSubActive = activeRoute === parentRoute && (searchParams.get('tab') === subItem.tabKey || (!searchParams.get('tab') && subItem.tabKey === item.defaultTab))
        """
        if self.active_route != parent_route_id:
            return False

        current_tab = self.search_params.get("tab")
        if current_tab:
            return current_tab == tab_key

        item = self.get_nav_item(parent_route_id)
        if item and item.default_tab:
            return item.default_tab == tab_key

        return False

    # Section Component Reactive Tab Resolvers (Simulating Section Components reading useSearchParams)
    def resolve_agenda_active_tab(self) -> str:
        tab = self.search_params.get("tab")
        valid = ["comunicacao", "rotina", "whatsapp"]
        return tab if (tab and tab in valid) else "comunicacao"

    def resolve_secretaria_active_tab(self) -> str:
        tab = self.search_params.get("tab")
        valid = ["alunos", "turmas"]
        return tab if (tab and tab in valid) else "alunos"

    def resolve_financeiro_active_tab(self) -> str:
        tab = self.search_params.get("tab")
        valid = ["ar", "ap", "nfse", "bi"]
        return tab if (tab and tab in valid) else "ar"

    def resolve_pedagogico_active_tab(self) -> str:
        tab = self.search_params.get("tab")
        valid = ["disciplinas_matriz", "atribuicao_horarios", "turmas", "projetos", "nutricao", "tri"]
        return tab if (tab and tab in valid) else "disciplinas_matriz"

    def resolve_academico_active_tab(self) -> str:
        tab = self.search_params.get("tab")
        valid = ["fundamental", "infantil"]
        return tab if (tab and tab in valid) else "fundamental"

    def resolve_administrativo_active_tab(self) -> str:
        tab = self.search_params.get("tab")
        valid = ["envios", "entidades", "fornecedores", "relatorios"]
        return tab if (tab and tab in valid) else "envios"

    def resolve_portal_aluno_active_tab(self) -> str:
        tab = self.search_params.get("tab")
        valid = ["boletim", "financeiro", "diploma", "rotina"]
        return tab if (tab and tab in valid) else "boletim"
