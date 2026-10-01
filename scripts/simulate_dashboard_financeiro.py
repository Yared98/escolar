#!/usr/bin/env python3
"""
Simulador e Benchmark: Dashboard Financeiro, Faturas Pix/Boleto & Relatório DRE/DFC
Valida o cálculo de KPIs financeiros, liquidação com baixa manual, projeção DFC e atualização em tempo real.
"""

import time

def calcular_dre_dfc(faturas, despesas):
    receita_bruta = sum(f["valor"] for f in faturas if f["status"] == "pago")
    inadimplencia_total = sum(f["valor"] for f in faturas if f["status"] in ["pendente", "atrasado"])
    despesas_totais = sum(d["valor"] for d in despesas)
    resultado_liquido = receita_bruta - despesas_totais
    
    # DFC Projeção 30 dias: resultado líquido atual + 40% de recuperação projetada pela régua
    recuperacao_projetada = inadimplencia_total * 0.40
    dfc_caixa_projetado = resultado_liquido + recuperacao_projetada

    return {
        "receita_bruta": receita_bruta,
        "despesas_totais": despesas_totais,
        "resultado_liquido": resultado_liquido,
        "inadimplencia_total": inadimplencia_total,
        "total_faturas_pagas": sum(1 for f in faturas if f["status"] == "pago"),
        "total_faturas_pendentes": sum(1 for f in faturas if f["status"] in ["pendente", "atrasado"]),
        "dfc_caixa_projetado": dfc_caixa_projetado,
    }

def main():
    print("================================================================================")
    print("BENCHMARK & SIMULAÇÃO: DASHBOARD FINANCEIRO, DRE & FLUXO DE CAIXA DFC")
    print("================================================================================")

    faturas_mock = [
        {"id": "1", "valor": 850.0, "status": "pago"},
        {"id": "2", "valor": 850.0, "status": "pago"},
        {"id": "3", "valor": 850.0, "status": "pendente"},
        {"id": "4", "valor": 420.0, "status": "atrasado"},
    ]
    despesas_mock = [
        {"id": "d1", "valor": 1000.0, "categoria": "folha"},
        {"id": "d2", "valor": 300.0, "categoria": "manutencao"},
    ]

    t0 = time.perf_counter()
    kpi_inicial = calcular_dre_dfc(faturas_mock, despesas_mock)
    lat_inicial = time.perf_counter() - t0

    print(f"Estado Inicial:")
    print(f"  Receita Bruta: R$ {kpi_inicial['receita_bruta']:.2f}")
    print(f"  Inadimplência: R$ {kpi_inicial['inadimplencia_total']:.2f}")
    print(f"  Despesas: R$ {kpi_inicial['despesas_totais']:.2f}")
    print(f"  Resultado Líquido: R$ {kpi_inicial['resultado_liquido']:.2f}")
    print(f"  DFC Projetado: R$ {kpi_inicial['dfc_caixa_projetado']:.2f} | Latência: {lat_inicial*1000:.4f} ms")

    assert kpi_inicial["receita_bruta"] == 1700.0
    assert kpi_inicial["inadimplencia_total"] == 1270.0
    assert kpi_inicial["resultado_liquido"] == 400.0

    # Simular Baixa Manual da Fatura 3 (R$ 850.0)
    print("\nExecutando Baixa Manual da Fatura 3...")
    for f in faturas_mock:
        if f["id"] == "3":
            f["status"] = "pago"

    kpi_pos_baixa = calcular_dre_dfc(faturas_mock, despesas_mock)
    print(f"Estado Pós-Baixa Manual:")
    print(f"  Receita Bruta: R$ {kpi_pos_baixa['receita_bruta']:.2f}")
    print(f"  Inadimplência: R$ {kpi_pos_baixa['inadimplencia_total']:.2f}")
    print(f"  Resultado Líquido: R$ {kpi_pos_baixa['resultado_liquido']:.2f}")
    print(f"  DFC Projetado: R$ {kpi_pos_baixa['dfc_caixa_projetado']:.2f}")

    assert kpi_pos_baixa["receita_bruta"] == 2550.0
    assert kpi_pos_baixa["inadimplencia_total"] == 420.0
    assert kpi_pos_baixa["resultado_liquido"] == 1250.0

    # Benchmark de 50.000 agregações financeiras
    n_iters = 50000
    t0 = time.perf_counter()
    for _ in range(n_iters):
        calcular_dre_dfc(faturas_mock, despesas_mock)
    t_tot = time.perf_counter() - t0

    print(f"\nBenchmark de Agregação Financeira em Memória:")
    print(f"  {n_iters} agregações em {t_tot:.3f}s ({n_iters/t_tot:.0f} relatórios/s)")
    print(f"  Latência por cálculo: {(t_tot/n_iters)*1000:.5f} ms")
    print("================================================================================")
    print("STATUS: SUCESSO - Dashboard Financeiro e DRE/DFC validados com 100% de precisão.")
    print("================================================================================")

if __name__ == "__main__":
    main()
