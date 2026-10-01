#!/usr/bin/env python3
"""
Tier 1: Feature Coverage — Section URL Reading
Validates that section components (Agenda, Secretaria, Financeiro, Pedagógico, Portal do Aluno, Acadêmico)
read active tab state reactively from useSearchParams() instead of internal useState().
"""

from ..harness.test_framework import (
    runner, assert_equal, assert_true, assert_false, assert_in
)
from ..harness.navigation_engine import AppNavigationRouter

TIER = "Tier 1: Feature Coverage"

@runner.register(tier=TIER, name="test_agenda_section_reads_tab_from_searchparams",
                 description="Verifies AgendaDigitalSection reads 'comunicacao', 'rotina', and 'whatsapp' from URL")
def test_agenda_section_reads_tab_from_searchparams():
    router = AppNavigationRouter("/?tab=comunicacao")
    assert_equal(router.resolve_agenda_active_tab(), "comunicacao")

    router.push("/?tab=rotina")
    assert_equal(router.resolve_agenda_active_tab(), "rotina")

    router.push("/?tab=whatsapp")
    assert_equal(router.resolve_agenda_active_tab(), "whatsapp")

@runner.register(tier=TIER, name="test_secretaria_section_reads_tab_from_searchparams",
                 description="Verifies SecretariaSection reads 'alunos' and 'turmas' from URL")
def test_secretaria_section_reads_tab_from_searchparams():
    router = AppNavigationRouter("/?tab=alunos")
    assert_equal(router.resolve_secretaria_active_tab(), "alunos")

    router.push("/?tab=turmas")
    assert_equal(router.resolve_secretaria_active_tab(), "turmas")

@runner.register(tier=TIER, name="test_financeiro_section_reads_tab_from_searchparams",
                 description="Verifies FinanceiroSection reads 'ar', 'ap', 'nfse', and 'bi' from URL")
def test_financeiro_section_reads_tab_from_searchparams():
    router = AppNavigationRouter("/?tab=ar")
    assert_equal(router.resolve_financeiro_active_tab(), "ar")

    for tab in ["ap", "nfse", "bi"]:
        router.push(f"/?tab={tab}")
        assert_equal(router.resolve_financeiro_active_tab(), tab)

@runner.register(tier=TIER, name="test_pedagogico_section_reads_tab_from_searchparams",
                 description="Verifies PedagocioNutricaoSection reads matriz, horarios, turmas, projetos, nutricao, tri")
def test_pedagogico_section_reads_tab_from_searchparams():
    valid_tabs = ["disciplinas_matriz", "atribuicao_horarios", "turmas", "projetos", "nutricao", "tri"]
    router = AppNavigationRouter("/")
    for tab in valid_tabs:
        router.push(f"/?tab={tab}")
        assert_equal(router.resolve_pedagogico_active_tab(), tab)

@runner.register(tier=TIER, name="test_portal_aluno_section_reads_tab_from_searchparams",
                 description="Verifies PortalAlunoSection reads 'boletim', 'financeiro', 'diploma', 'rotina'")
def test_portal_aluno_section_reads_tab_from_searchparams():
    valid_tabs = ["boletim", "financeiro", "diploma", "rotina"]
    router = AppNavigationRouter("/")
    for tab in valid_tabs:
        router.push(f"/?tab={tab}")
        assert_equal(router.resolve_portal_aluno_active_tab(), tab)

@runner.register(tier=TIER, name="test_reactive_re_render_when_searchparams_change",
                 description="Verifies section tab state updates reactively without local useState across consecutive pushes")
def test_reactive_re_render_when_searchparams_change():
    router = AppNavigationRouter("/")
    # Initial state
    assert_equal(router.resolve_agenda_active_tab(), "comunicacao")
    assert_equal(router.resolve_secretaria_active_tab(), "alunos")

    # Step 1: URL changes to rotina
    router.push("/?tab=rotina")
    assert_equal(router.resolve_agenda_active_tab(), "rotina")

    # Step 2: URL changes to turmas
    router.push("/?tab=turmas")
    assert_equal(router.resolve_secretaria_active_tab(), "turmas")

    # Step 3: URL changes back to comunicacao
    router.push("/?tab=comunicacao")
    assert_equal(router.resolve_agenda_active_tab(), "comunicacao")
