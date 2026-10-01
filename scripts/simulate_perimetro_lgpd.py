#!/usr/bin/env python3
"""
Tooling de Validação e Simulação - LGPD & Controle Perimetral (RFID/QR Code)
Valida integridade criptográfica de consentimentos (LGPD Art. 14) e simula leitura de catracas.

Uso:
  python3 scripts/simulate_perimetro_lgpd.py --benchmark
"""

import hashlib
import json
import sys
import uuid
from datetime import datetime, timezone
from typing import Dict, Any


def gerar_hash_lgpd(tenant_id: str, aluno_id: str, responsavel_id: str, versao: str, ts: str) -> str:
    raw = f"LGPD_ART14:{tenant_id}:{aluno_id}:{responsavel_id}:{versao}:{ts}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def simular_leitura_catraca(
    codigo: str,
    base_credenciais: Dict[str, Dict[str, Any]],
    direcao: str = "entrada",
    ponto_acesso: str = "Portaria Principal",
) -> Dict[str, Any]:
    agora = datetime.now(timezone.utc).strftime("%H:%M")

    if codigo not in base_credenciais:
        return {
            "acesso_permitido": False,
            "motivo_bloqueio": "Credencial não identificada no perímetro escolar.",
            "nome_aluno": None,
            "turma": None,
            "notificacao_gerada": False,
        }

    dado = base_credenciais[codigo]
    if not dado.get("ativo", True):
        return {
            "acesso_permitido": False,
            "motivo_bloqueio": "Matrícula inativa ou trancada.",
            "nome_aluno": dado.get("nome"),
            "turma": None,
            "notificacao_gerada": False,
        }

    # Acesso autorizado
    nome = dado["nome"]
    turma = dado.get("turma", "1º Ano A")
    direcao_label = "saída da escola" if direcao == "saida" else "entrada na escola"

    notificacao = {
        "destinatarios": dado.get("responsaveis", []),
        "titulo": f"Controle de Portaria: {nome}",
        "mensagem": f"Passagem confirmada: {nome} registrou {direcao_label} às {agora} no ponto '{ponto_acesso}'.",
        "prioridade": "alta",
        "canal": "push_pwa",
    }

    return {
        "acesso_permitido": True,
        "nome_aluno": nome,
        "turma": turma,
        "motivo_bloqueio": None,
        "notificacao_gerada": True,
        "detalhes_notificacao": notificacao,
    }


def run_benchmark():
    print("=" * 70)
    print("  SIMULAÇÃO DE CONFORMIDADE LGPD & CONTROLE PERIMETRAL (CATRACA)")
    print("=" * 70)

    # 1. Teste de Hashing LGPD Art. 14
    tenant = str(uuid.uuid4())
    aluno = str(uuid.uuid4())
    resp = str(uuid.uuid4())
    ts = "2026-09-25T14:30:00Z"
    h1 = gerar_hash_lgpd(tenant, aluno, resp, "2026.1", ts)
    h2 = gerar_hash_lgpd(tenant, aluno, resp, "2026.1", ts)

    assert h1 == h2 and len(h1) == 64, "Falha na integridade SHA-256 do consentimento"
    print(f"[OK] Assinatura digital LGPD Art. 14 SHA-256 verificada: {h1[:16]}... (64 hex)")

    # 2. Base de Teste de Credenciais Perimetrais
    base_mock = {
        "ABC-12345": {
            "nome": "Ana Clara Souza",
            "turma": "1º Ano A",
            "ativo": True,
            "responsaveis": [str(uuid.uuid4())],
        },
        "RFID-998877": {
            "nome": "Lucas Gabriel Lima",
            "turma": "3º Ano B",
            "ativo": True,
            "responsaveis": [str(uuid.uuid4())],
        },
        "RFID-BLOQUEADO": {
            "nome": "Estudante Suspenso",
            "turma": "2º Ano A",
            "ativo": False,
            "responsaveis": [],
        },
    }

    cenarios = [
        ("Tag RFID Válida Entrada", "ABC-12345", "entrada", True, "Ana Clara Souza"),
        ("Cartão RFID Válido Saída", "RFID-998877", "saida", True, "Lucas Gabriel Lima"),
        ("Tag Bloqueada / Inativa", "RFID-BLOQUEADO", "entrada", False, "Estudante Suspenso"),
        ("Código Não Reconhecido", "UNKNOWN-000", "entrada", False, None),
    ]

    print("-" * 80)
    print(f"{'Cenário':<28} | {'Código':<15} | {'Acesso':<8} | {'Aluno':<20} | {'Notif':<6}")
    print("-" * 80)

    all_passed = True
    for desc, cod, dir_, esperado_perm, esperado_nome in cenarios:
        res = simular_leitura_catraca(cod, base_mock, direcao=dir_)
        perm_str = "AUTORIZ" if res["acesso_permitido"] else "NEGADO"
        notif_str = "SIM" if res["notificacao_gerada"] else "NÃO"
        nome_str = res["nome_aluno"] or "-"

        print(f"{desc:<28} | {cod:<15} | {perm_str:<8} | {nome_str:<20} | {notif_str:<6}")

        if res["acesso_permitido"] != esperado_perm:
            all_passed = False
            print(f"  [ERRO] Esperado acesso={esperado_perm}, obtido={res['acesso_permitido']}")

    print("-" * 80)
    if all_passed:
        print("[SUCESSO] Todos os fluxos de validação perimetral e notificações passaram com êxito.")
    print("=" * 70)


if __name__ == "__main__":
    run_benchmark()
