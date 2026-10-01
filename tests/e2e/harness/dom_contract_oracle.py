#!/usr/bin/env python3
"""
DOM Contract Oracle
Authoritative oracle of expected DOM elements, CSS classes, animation states,
removed horizontal tab bars, and preserved action buttons/modal dialogs.
"""

from typing import Dict, List, Any

# DOM element class signatures
COLLAPSIBLE_EXPANDED_CLASSES = ["grid", "grid-rows-[1fr]", "opacity-100"]
COLLAPSIBLE_COLLAPSED_CLASSES = ["grid", "grid-rows-[0fr]", "opacity-0", "pointer-events-none"]

ACTIVE_SUBITEM_CLASSES = ["bg-salvia-100", "font-bold"]
INACTIVE_SUBITEM_CLASSES = ["font-medium"]

DESKTOP_SIDEBAR_SIGNATURE = ["hidden", "lg:flex", "w-64"]
MOBILE_DRAWER_SIGNATURE = ["fixed", "inset-0", "z-50"]

# Section-specific contract definitions
SECTION_TAB_REMOVAL_SPECS = {
    "AgendaDigitalSection": {
        "file": "frontend/src/components/AgendaDigitalSection.tsx",
        "removed_buttons": [
            "Mensagens & Mural",
            "Resumo de Rotina",
            "WhatsApp (Transbordo)"
        ],
        "state_hook_to_remove": "useState<'comunicacao' | 'rotina' | 'whatsapp'>",
        "preserved_actions": []
    },
    "SecretariaSection": {
        "file": "frontend/src/components/SecretariaSection.tsx",
        "removed_buttons": [
            "Alunos & Matrículas",
            "Turmas & Ensalamento"
        ],
        "state_hook_to_remove": "useState<'alunos' | 'turmas' | 'educacenso'>",
        "preserved_actions": [
            "+ Nova Matrícula Completa",
            "Criar Nova Turma"
        ],
        "preserved_modal_tabs": [
            "dados_aluno",
            "responsaveis",
            "endereco_contato",
            "prontuario"
        ]
    },
    "FinanceiroSection": {
        "file": "frontend/src/components/FinanceiroSection.tsx",
        "removed_buttons": [
            "Faturas & Mensalidades (AR)",
            "Despesas & Fornecedores (AP)",
            "NFS-e Automatizada",
            "Demonstrativo DRE & DFC"
        ],
        "state_hook_to_remove": "useState<'ar' | 'ap' | 'nfse' | 'bi' | 'conciliacao'>",
        "preserved_actions": []
    },
    "PedagocioNutricaoSection": {
        "file": "frontend/src/components/PedagocioNutricaoSection.tsx",
        "removed_buttons": [
            "Disciplinas & Matriz",
            "Atribuição & Horários",
            "Visão das Turmas",
            "Projetos BNCC",
            "Planner de Nutrição"
        ],
        "state_hook_to_remove": "useState<.*disciplinas_matriz.*>",
        "preserved_actions": []
    }
}
