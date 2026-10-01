#!/usr/bin/env python3
"""
Simulador e Benchmark: Régua de Cobrança Automatizada Omnicanal (WhatsApp/SMS/Email)
Valida a classificação temporal (D-5 Lembrete, D-0 Vencimento Hoje, D+N Cobrança Ativa),
composição de mensagens com Pix Copia e Cola e gravação do log de auditoria.
"""

import time
import uuid
from datetime import date, timedelta

def classificar_evento_regua(dias_ate_vencimento: int):
    if 0 < dias_ate_vencimento <= 5:
        return "lembrete_preventivo"
    elif dias_ate_vencimento == 0:
        return "aviso_vencimento"
    elif dias_ate_vencimento < 0:
        return "cobranca_ativa"
    return None

def processar_regua_cobranca(faturas):
    hoje = date.today()
    logs = []
    contadores = {
        "lembretes_preventivos": 0,
        "avisos_vencimento_hoje": 0,
        "cobrancas_ativas": 0,
    }

    t0 = time.perf_counter()
    for f in faturas:
        dias = (f["data_vencimento"] - hoje).days
        evento = classificar_evento_regua(dias)
        if not evento:
            continue

        if evento == "lembrete_preventivo":
            contadores["lembretes_preventivos"] += 1
        elif evento == "aviso_vencimento":
            contadores["avisos_vencimento_hoje"] += 1
        elif evento == "cobranca_ativa":
            contadores["cobrancas_ativas"] += 1

        pix_code = f.get("qr_code_pix", "00020126580014br.gov.bcb.pix0136mensalidade520400005303986540500.005802BR5913EscolaModelo6008SAOPAULO62070503***6304")
        msg = (
            f"Olá! Informamos que a mensalidade de R$ {f['valor']:.2f} do(a) aluno(a) {f['aluno_nome']} "
            f"referente a '{f['descricao']}' vence em {f['data_vencimento'].strftime('%d/%m/%Y')}. "
            f"Código Pix Copia e Cola: {pix_code}. Pague instantaneamente sem juros."
        )

        for canal in ["whatsapp", "email"]:
            logs.append({
                "id": str(uuid.uuid4()),
                "fatura_id": f["id"],
                "canal": canal,
                "tipo_evento": evento,
                "status_envio": "enviado",
                "mensagem_corpo": msg
            })

    elapsed = time.perf_counter() - t0
    return {
        "status": "sucesso",
        "disparos_executados": len(logs),
        "mensagens": contadores,
        "logs": logs
    }, elapsed

def main():
    print("================================================================================")
    print("BENCHMARK & SIMULAÇÃO: RÉGUA DE COBRANÇA AUTOMATIZADA OMNICANAL")
    print("================================================================================")

    hoje = date.today()
    mock_faturas = [
        # D-5 Lembrete
        {"id": str(uuid.uuid4()), "aluno_nome": "Lucas Silveira", "descricao": "Mensalidade Abril", "valor": 850.0, "data_vencimento": hoje + timedelta(days=5)},
        # D-2 Lembrete
        {"id": str(uuid.uuid4()), "aluno_nome": "Mariana Costa", "descricao": "Mensalidade Abril", "valor": 920.0, "data_vencimento": hoje + timedelta(days=2)},
        # D-0 Hoje
        {"id": str(uuid.uuid4()), "aluno_nome": "Pedro Henrique", "descricao": "Mensalidade Março", "valor": 850.0, "data_vencimento": hoje},
        # D+3 Atrasada
        {"id": str(uuid.uuid4()), "aluno_nome": "Beatriz Lima", "descricao": "Mensalidade Fevereiro", "valor": 780.0, "data_vencimento": hoje - timedelta(days=3)},
        # D+15 Atrasada
        {"id": str(uuid.uuid4()), "aluno_nome": "Gabriel Alves", "descricao": "Material Didático", "valor": 340.0, "data_vencimento": hoje - timedelta(days=15)},
        # D-15 Futura distante (não elegível na régua)
        {"id": str(uuid.uuid4()), "aluno_nome": "Juliana Rocha", "descricao": "Mensalidade Maio", "valor": 850.0, "data_vencimento": hoje + timedelta(days=15)},
    ]

    res, lat = processar_regua_cobranca(mock_faturas)
    print(f"Execução da Régua em {len(mock_faturas)} faturas:")
    print(f"  Status: {res['status']}")
    print(f"  Disparos Executados (Omnicanal WhatsApp + E-mail): {res['disparos_executados']}")
    print(f"  Lembretes Preventivos (D-5 a D-1): {res['mensagens']['lembretes_preventivos']}")
    print(f"  Avisos de Vencimento Hoje (D-0): {res['mensagens']['avisos_vencimento_hoje']}")
    print(f"  Cobranças Ativas (Atrasadas): {res['mensagens']['cobrancas_ativas']}")
    print(f"  Tempo de Processamento: {lat*1000:.3f} ms")

    assert res["mensagens"]["lembretes_preventivos"] == 2
    assert res["mensagens"]["avisos_vencimento_hoje"] == 1
    assert res["mensagens"]["cobrancas_ativas"] == 2
    assert res["disparos_executados"] == 10 # 5 faturas elegíveis * 2 canais

    # Teste de Mensagem Formatada
    exemplo_msg = res["logs"][0]["mensagem_corpo"]
    print(f"\nExemplo de Notificação Formatada:")
    print(f"  '{exemplo_msg[:120]}...'")
    assert "Pix Copia e Cola" in exemplo_msg
    assert "vence em" in exemplo_msg

    # Benchmark de Desempenho
    n_faturas = 10000
    lote_massivo = [
        {
            "id": str(uuid.uuid4()),
            "aluno_nome": f"Estudante {i}",
            "descricao": "Mensalidade Escolar",
            "valor": 750.0 + (i % 200),
            "data_vencimento": hoje + timedelta(days=(i % 15 - 5))
        }
        for i in range(n_faturas)
    ]

    _, bench_lat = processar_regua_cobranca(lote_massivo)
    print(f"\nBenchmark de Régua de Cobrança em Massa:")
    print(f"  {n_faturas} faturas processadas e notificadas em {bench_lat:.3f}s")
    print(f"  Vazão: {n_faturas/bench_lat:.0f} faturas/s")
    print(f"  Latência média: {(bench_lat/n_faturas)*1000:.5f} ms/fatura")
    print("================================================================================")
    print("STATUS: SUCESSO - Régua de Cobrança Omnicanal validada com 100% de conformidade.")
    print("================================================================================")

if __name__ == "__main__":
    main()
