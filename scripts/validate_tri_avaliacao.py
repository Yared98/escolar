#!/usr/bin/env python3
"""
Validador e Benchmark: Apuração Avaliativa e Leitura Ótica de Gabaritos (TRI)
Demonstra o Modelo Logístico de 3 Parâmetros (3PL) com EAP e diagnóstico psicométrico de coerência.
"""

import math
import time

def probabilidade_tri_3pl(theta: float, a: float, b: float, c: float) -> float:
    d = 1.7
    exponent = -d * a * (theta - b)
    if exponent > 50:
        logit = 0.0
    elif exponent < -50:
        logit = 1.0
    else:
        logit = 1.0 / (1.0 + math.exp(exponent))
    return c + (1.0 - c) * logit

def estimar_proficiencia_eap(itens):
    """
    itens: lista de tuplas (a, b, c, acertou: bool)
    """
    n_quad = 41
    x_min = -4.0
    x_max = 4.0
    step = (x_max - x_min) / (n_quad - 1)

    num = 0.0
    den = 0.0

    for k in range(n_quad):
        x_k = x_min + k * step
        prior = math.exp(-0.5 * x_k * x_k)

        likelihood = 1.0
        for a, b, c, acertou in itens:
            p = max(1e-6, min(1.0 - 1e-6, probabilidade_tri_3pl(x_k, a, b, c)))
            likelihood *= p if acertou else (1.0 - p)

        w = likelihood * prior
        num += x_k * w
        den += w

    theta_hat = num / den if den > 1e-12 else 0.0
    escala_enem = max(200.0, min(1000.0, 500.0 + theta_hat * 100.0))

    # Diagnóstico Psicométrico de Inversão de Dificuldade
    acertos = [b for a, b, c, u in itens if u]
    erros = [b for a, b, c, u in itens if not u]

    if acertos and erros:
        media_b_acertos = sum(acertos) / len(acertos)
        media_b_erros = sum(erros) / len(erros)
        inversao = media_b_acertos - media_b_erros
        if inversao > 0.5:
            coerencia = max(0.2, min(0.75, 1.0 - inversao * 0.3))
        else:
            coerencia = max(0.85, min(1.0, 1.0 - max(0.0, inversao) * 0.2))
    else:
        coerencia = 1.0

    if coerencia >= 0.85:
        status = "coerente"
    elif coerencia >= 0.60:
        status = "moderado"
    else:
        status = "incoerente_chute_provavel"

    return theta_hat, escala_enem, coerencia, status

def test_tri_engine():
    print("================================================================================")
    print("BENCHMARK & VALIDAÇÃO: TEORIA DE RESPOSTA AO ITEM (TRI 3PL - EAP)")
    print("================================================================================")

    # 45 itens simulados (padrão ENEM por caderno)
    gabarito_prova = []
    for i in range(45):
        a = 0.8 + (i % 15) * 0.1  # 0.8 a 2.2
        b = -2.0 + (i / 44.0) * 4.0 # -2.0 a +2.0
        c = 0.20
        gabarito_prova.append((a, b, c))

    # Aluno 1: Proficiência alta consistente (acertou os 35 primeiros itens, errou 10 mais difíceis)
    aluno_alto = [(a, b, c, idx < 35) for idx, (a, b, c) in enumerate(gabarito_prova)]
    
    # Aluno 2: Chutador aleatório (errou itens fáceis e acertou itens difíceis no final)
    aluno_chute = [(a, b, c, (idx >= 30 or idx % 3 == 0) and idx > 15) for idx, (a, b, c) in enumerate(gabarito_prova)]

    start = time.perf_counter()
    theta1, enem1, coer1, status1 = estimar_proficiencia_eap(aluno_alto)
    lat1 = time.perf_counter() - start

    start = time.perf_counter()
    theta2, enem2, coer2, status2 = estimar_proficiencia_eap(aluno_chute)
    lat2 = time.perf_counter() - start

    print(f"Aluno Consistente (35 acertos):")
    print(f"  Theta: {theta1:+.3f} | Escala ENEM: {enem1:.1f} | Coerência: {coer1*100:.1f}% ({status1}) | Latência: {lat1*1000:.3f} ms")
    assert status1 == "coerente", f"Esperado coerente, obteve {status1}"
    assert enem1 > 600.0, f"Esperado ENEM > 600, obteve {enem1}"

    print(f"\nAluno Incoerente / Chute:")
    print(f"  Theta: {theta2:+.3f} | Escala ENEM: {enem2:.1f} | Coerência: {coer2*100:.1f}% ({status2}) | Latência: {lat2*1000:.3f} ms")
    assert status2 in ["incoerente_chute_provavel", "moderado"]

    # Benchmark de 1000 apurações
    n_sim = 1000
    start = time.perf_counter()
    for _ in range(n_sim):
        estimar_proficiencia_eap(aluno_alto)
    total_time = time.perf_counter() - start

    print(f"\nBenchmark de Desempenho (Zero-Cost In-Process):")
    print(f"  {n_sim} provas apuradas em {total_time:.3f}s ({n_sim/total_time:.0f} provas/s)")
    print(f"  Latência média: {(total_time/n_sim)*1000:.4f} ms por avaliação")
    print("================================================================================")
    print("STATUS: SUCESSO - Motor TRI validado psicometricamente com coerência pedagógica.")
    print("================================================================================")

if __name__ == "__main__":
    test_tri_engine()
