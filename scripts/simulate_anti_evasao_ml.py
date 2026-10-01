#!/usr/bin/env python3
"""
Motor de Simulação e Validação Analítica - IA Anti-Evasão Escolar
Padrão: Early Warning System (EWS)
Pesos calibrados: Faltas 40%, Inadimplência 35%, Queda de Notas 25%

Uso:
  python3 scripts/simulate_anti_evasao_ml.py --benchmark
  python3 scripts/simulate_anti_evasao_ml.py --aluno-id <UUID> --token <JWT> --tenant-id <UUID>
"""

import argparse
import json
import math
import sys
from typing import Dict, Any, Tuple


def calcular_score_anti_evasao(
    faturas_atrasadas: int,
    frequencia_pct: float,
    media_disciplinas: float,
) -> Dict[str, Any]:
    # 1. Risco de Faltas (40%)
    if frequencia_pct >= 90.0:
        risk_faltas = (100.0 - frequencia_pct) * 1.5
    elif frequencia_pct >= 75.0:
        risk_faltas = 15.0 + ((90.0 - frequencia_pct) / 15.0) * 35.0
    else:
        risk_faltas = 50.0 + ((75.0 - frequencia_pct) / 75.0) * 50.0
    risk_faltas = max(0.0, min(100.0, risk_faltas))

    # 2. Risco de Inadimplência (35%)
    if faturas_atrasadas == 0:
        risk_inadimplencia = 0.0
    elif faturas_atrasadas == 1:
        risk_inadimplencia = 50.0
    elif faturas_atrasadas == 2:
        risk_inadimplencia = 90.0
    else:
        risk_inadimplencia = 100.0

    # 3. Risco de Notas (25%)
    if media_disciplinas >= 7.0:
        risk_notas = 0.0
    elif media_disciplinas >= 5.0:
        risk_notas = ((7.0 - media_disciplinas) / 2.0) * 55.0
    else:
        risk_notas = 55.0 + ((5.0 - media_disciplinas) / 5.0) * 45.0
    risk_notas = max(0.0, min(100.0, risk_notas))

    # Contribuições ponderadas
    contrib_faltas = risk_faltas * 0.40
    contrib_inadimplencia = risk_inadimplencia * 0.35
    contrib_notas = risk_notas * 0.25

    score_base = contrib_faltas + contrib_inadimplencia + contrib_notas

    # Sinergia de múltiplos alertas (Compound risk)
    if risk_inadimplencia >= 50.0 and risk_faltas >= 40.0:
        multiplier = 1.30
    elif risk_inadimplencia >= 50.0 or risk_faltas >= 50.0:
        multiplier = 1.10
    else:
        multiplier = 1.0

    score_final = round(min(100.0, score_base * multiplier), 1)

    # Fator principal explicável
    if score_final < 15.0:
        fator_principal = "nenhum"
    elif contrib_inadimplencia >= contrib_faltas and contrib_inadimplencia >= contrib_notas:
        fator_principal = "inadimplencia"
    elif contrib_faltas >= contrib_inadimplencia and contrib_faltas >= contrib_notas:
        fator_principal = "faltas_reiteradas"
    else:
        fator_principal = "queda_desempenho"

    # Nível de urgência
    if score_final >= 75.0:
        nivel_urgencia = "alta"
    elif score_final >= 40.0:
        nivel_urgencia = "moderada"
    else:
        nivel_urgencia = "baixa"

    return {
        "score_risco_evasao": score_final,
        "nivel_urgencia": nivel_urgencia,
        "fator_principal": fator_principal,
        "alerta_gestor_prioritario": score_final >= 75.0,
        "detalhes": {
            "faturas_atrasadas": faturas_atrasadas,
            "frequencia_ultimos_30_dias": frequencia_pct,
            "media_disciplinas": media_disciplinas,
        },
    }


def run_benchmark():
    print("=" * 70)
    print("  SIMULAÇÃO DE COORTE ANALÍTICA - MODELO IA ANTI-EVASÃO ESCOLAR")
    print("=" * 70)

    casos_de_teste = [
        ("Aluno Modelo Regular", 0, 98.0, 9.2, "baixa", "nenhum"),
        ("Inadimplência Isolada 1 fatura", 1, 95.0, 7.8, "baixa", "inadimplencia"),
        ("Inadimplência Severa 3 faturas", 3, 90.0, 7.0, "moderada", "inadimplencia"),
        ("Infração LDB Frequência 60%", 0, 60.0, 7.5, "baixa", "faltas_reiteradas"),
        ("Queda Crítica de Rendimento 3.5", 0, 92.0, 3.5, "baixa", "queda_desempenho"),
        ("Cenário DoD Card (Composto Crítico)", 2, 72.0, 6.1, "alta", "inadimplencia"),
        ("Abandono Iminente Multidimensional", 3, 45.0, 4.0, "alta", "inadimplencia"),
    ]

    print(f"{'Cenário':<35} | {'Score':<6} | {'Urgência':<9} | {'Fator':<18} | {'Alerta':<6}")
    print("-" * 85)

    all_passed = True
    for nome, faturas, freq, notas, urg_esperada, fator_esperado in casos_de_teste:
        res = calcular_score_anti_evasao(faturas, freq, notas)
        alerta_str = "SIM" if res["alerta_gestor_prioritario"] else "NÃO"
        print(f"{nome:<35} | {res['score_risco_evasao']:<6.1f} | {res['nivel_urgencia']:<9} | {res['fator_principal']:<18} | {alerta_str:<6}")

        if res["nivel_urgencia"] != urg_esperada or res["fator_principal"] != fator_esperado:
            all_passed = False
            print(f"  [FALHA] Esperado ({urg_esperada}, {fator_esperado}) -> Obtido ({res['nivel_urgencia']}, {res['fator_principal']})")

    print("-" * 85)
    if all_passed:
        print("[SUCESSO] 100% dos cenários de teste atenderam rigorosamente às regras de negócio e ao DoD do Card.")
    else:
        print("[AVISO] Divergência em alguns cenários.")
    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(description="Tooling de Validação e Simulação IA Anti-Evasão")
    parser.add_argument("--benchmark", action="store_true", help="Executa suíte de validação sintética de coortes")
    parser.add_argument("--aluno-id", type=str, help="UUID do Aluno para consulta remota na API")
    parser.add_argument("--token", type=str, help="Token JWT de autenticação")
    parser.add_argument("--tenant-id", type=str, help="UUID do Tenant Escolar")
    parser.add_argument("--url", type=str, default="http://localhost:8000", help="URL base da API Gateway")

    args = parser.parse_args()

    if args.benchmark or len(sys.argv) == 1:
        run_benchmark()
        return

    if args.aluno_id and args.token and args.tenant_id:
        import urllib.request

        req_url = f"{args.url}/api/v1/ia/evasao/predizer/{args.aluno_id}"
        req = urllib.request.Request(
            req_url,
            headers={
                "Authorization": f"Bearer {args.token}",
                "X-Tenant-ID": args.tenant_id,
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req) as response:
                payload = json.loads(response.read().decode())
                print(json.dumps(payload, indent=2, ensure_ascii=False))
        except Exception as e:
            print(f"Erro na requisição: {e}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
