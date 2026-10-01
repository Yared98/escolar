#!/usr/bin/env python3
"""
Validador e Benchmark: Conciliação Bancária & Relatórios Gerenciais (DRE/DFC)
Valida a liquidação automática de títulos via extrato bancário (OFX/CNAB),
o cálculo exato do DRE e a detecção de faturas pendentes expiradas na inadimplência.
"""

import time
import uuid
from datetime import date, timedelta

def processar_conciliacao_extrato(faturas, despesas, transacoes_extrato):
    faturas_liquidadas = 0
    despesas_liquidadas = 0
    conciliacoes = []

    t0 = time.perf_counter()
    for tr in transacoes_extrato:
        tipo = tr["tipo"]
        if tipo == "credito" and tr.get("fatura_id"):
            for f in faturas:
                if f["id"] == tr["fatura_id"]:
                    f["status"] = "pago"
                    faturas_liquidadas += 1
        elif tipo == "debito" and tr.get("despesa_id"):
            for d in despesas:
                if d["id"] == tr["despesa_id"]:
                    d["status"] = "pago"
                    d["data_pagamento"] = tr["data_transacao"]
                    despesas_liquidadas += 1

        conciliacoes.append({
            "id": str(uuid.uuid4()),
            "banco": tr["banco"],
            "data_transacao": tr["data_transacao"],
            "descricao": tr["descricao"],
            "valor": tr["valor"],
            "tipo": tipo,
            "fatura_id": tr.get("fatura_id"),
            "despesa_id": tr.get("despesa_id"),
            "status_conciliacao": "conciliado"
        })

    elapsed = time.perf_counter() - t0
    return {
        "status": "sucesso",
        "faturas_liquidadas": faturas_liquidadas,
        "despesas_liquidadas": despesas_liquidadas,
        "total_conciliado": len(conciliacoes)
    }, elapsed

def calcular_dre_consolidado(faturas, despesas, data_referencia=None):
    if data_referencia is None:
        data_referencia = date.today()

    receita_bruta = 0.0
    inadimplencia_total = 0.0
    total_pagas = 0
    total_pendentes = 0

    t0 = time.perf_counter()
    for f in faturas:
        st = f["status"]
        if st == "pago":
            receita_bruta += f["valor"]
            total_pagas += 1
        elif st == "atrasado":
            inadimplencia_total += f["valor"]
            total_pendentes += 1
        elif st == "pendente":
            # Fatura pendente que já venceu conta como inadimplência
            if f["data_vencimento"] < data_referencia:
                inadimplencia_total += f["valor"]
            total_pendentes += 1

    despesas_totais = sum(d["valor"] for d in despesas)
    resultado_liquido = round(receita_bruta - despesas_totais, 2)
    dfc_caixa_projetado = round(resultado_liquido + (inadimplencia_total * 0.40), 2)

    elapsed = time.perf_counter() - t0
    return {
        "receita_bruta": round(receita_bruta, 2),
        "despesas_totais": round(despesas_totais, 2),
        "resultado_liquido": resultado_liquido,
        "inadimplencia_total": round(inadimplencia_total, 2),
        "total_faturas_pagas": total_pagas,
        "total_faturas_pendentes": total_pendentes,
        "dfc_caixa_projetado": dfc_caixa_projetado,
    }, elapsed

def main():
    print("================================================================================")
    print("BENCHMARK & VALIDAÇÃO: CONCILIAÇÃO BANCÁRIA & RELATÓRIOS GERENCIAIS (DRE)")
    print("================================================================================")

    hoje = date.today()
    fat1_id = str(uuid.uuid4())
    fat2_id = str(uuid.uuid4())
    desp1_id = str(uuid.uuid4())

    faturas = [
        {"id": fat1_id, "valor": 850.0, "status": "pendente", "data_vencimento": hoje + timedelta(days=5)}, # pendente futuro
        {"id": fat2_id, "valor": 920.0, "status": "pendente", "data_vencimento": hoje - timedelta(days=2)}, # pendente expirado (inadimplente)
        {"id": str(uuid.uuid4()), "valor": 450.0, "status": "atrasado", "data_vencimento": hoje - timedelta(days=10)}, # atrasado
        {"id": str(uuid.uuid4()), "valor": 1200.0, "status": "pago", "data_vencimento": hoje - timedelta(days=20)}, # já pago
    ]

    despesas = [
        {"id": desp1_id, "valor": 500.0, "status": "pendente", "data_vencimento": hoje + timedelta(days=3)},
        {"id": str(uuid.uuid4()), "valor": 300.0, "status": "pago", "data_vencimento": hoje - timedelta(days=5)},
    ]

    # DRE Inicial
    dre_ini, _ = calcular_dre_consolidado(faturas, despesas, hoje)
    print("1. DRE Inicial:")
    print(f"  Receita Bruta (Faturas Pagas): R$ {dre_ini['receita_bruta']:.2f}")
    print(f"  Inadimplência (Atrasado + Pendente Expirado R$ 920 + 450): R$ {dre_ini['inadimplencia_total']:.2f}")
    print(f"  Despesas Totais: R$ {dre_ini['despesas_totais']:.2f}")
    print(f"  Resultado Líquido: R$ {dre_ini['resultado_liquido']:.2f}")
    print(f"  DFC Caixa Projetado: R$ {dre_ini['dfc_caixa_projetado']:.2f}")

    assert dre_ini["receita_bruta"] == 1200.0
    assert dre_ini["inadimplencia_total"] == 1370.0 # 920 + 450
    assert dre_ini["despesas_totais"] == 800.0
    assert dre_ini["resultado_liquido"] == 400.0

    # 2. Processar Conciliação de Retorno Bancário (OFX/CNAB)
    print("\n2. Processando Extrato Bancário:")
    transacoes = [
        {"banco": "Banco Itaú", "data_transacao": hoje, "descricao": "PIX RECEBIDO - FATURA ESC", "valor": 850.0, "tipo": "credito", "fatura_id": fat1_id},
        {"banco": "Banco Itaú", "data_transacao": hoje, "descricao": "TED ENERGIA ELETRICA", "valor": 500.0, "tipo": "debito", "despesa_id": desp1_id},
    ]

    conc_res, conc_lat = processar_conciliacao_extrato(faturas, despesas, transacoes)
    print(f"  Status: {conc_res['status']} | Faturas Liquidadas: {conc_res['faturas_liquidadas']} | Despesas Liquidadas: {conc_res['despesas_liquidadas']} | Latência: {conc_lat*1000:.3f} ms")
    assert conc_res["faturas_liquidadas"] == 1
    assert conc_res["despesas_liquidadas"] == 1

    # DRE Após Conciliação
    dre_pos, _ = calcular_dre_consolidado(faturas, despesas, hoje)
    print("\n3. DRE Pós-Conciliação:")
    print(f"  Receita Bruta Atualizada: R$ {dre_pos['receita_bruta']:.2f}")
    print(f"  Resultado Líquido: R$ {dre_pos['resultado_liquido']:.2f}")
    assert dre_pos["receita_bruta"] == 2050.0 # 1200 + 850

    # 4. Benchmark de Cálculo de DRE Massivo (50.000 iterações)
    n_iters = 50000
    t0 = time.perf_counter()
    for _ in range(n_iters):
        calcular_dre_consolidado(faturas, despesas, hoje)
    total_time = time.perf_counter() - t0

    print(f"\n4. Benchmark de Desempenho (Zero-Cost In-Process):")
    print(f"  {n_iters} cálculos de DRE executados em {total_time:.3f}s ({n_iters/total_time:.0f} DREs/s)")
    print(f"  Latência por apuração contábil: {(total_time/n_iters)*1000:.5f} ms")
    print("================================================================================")
    print("STATUS: SUCESSO - Conciliação Bancária e DRE validados com 100% de conformidade.")
    print("================================================================================")

if __name__ == "__main__":
    main()
