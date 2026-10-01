#!/usr/bin/env python3
"""
Validacao e Benchmark: Gestao de Turmas, Ensalamento e Alocacao de Horarios
Valida:
1. Regras de negocio de capacidade maxima de turmas e prevencao de sobrelotacao.
2. Algoritmo in-process de deteccao de choque de horarios (grade curricular / salas / docentes).
3. Teste de alta volumetria (50.000 operacoes de verificacao e ensalamento).
"""

import time

def validar_capacidade_turma(alunos_ativos: int, capacidade_maxima: int) -> tuple[bool, str]:
    if alunos_ativos >= capacidade_maxima:
        return False, "Capacidade maxima da turma atingida. Ensalamento bloqueado para evitar sobrelotacao."
    return True, "OK"

def validar_choque_horario(
    dia_semana_a: int, hora_inicio_a: str, hora_fim_a: str,
    dia_semana_b: int, hora_inicio_b: str, hora_fim_b: str,
) -> bool:
    if dia_semana_a != dia_semana_b:
        return False
    max_inicio = max(hora_inicio_a, hora_inicio_b)
    min_fim = min(hora_fim_a, hora_fim_b)
    return max_inicio < min_fim

def test_ensalamento_e_alocacao():
    print("=== INICIANDO VALIDACAO: GESTAO DE TURMAS, ENSALAMENTO & ALOCACAO ===")

    # 1. Teste de Capacidade
    permitido, _ = validar_capacidade_turma(34, 35)
    assert permitido, "Deveria permitir matricula quando alunos_ativos < capacidade_maxima"

    bloqueado, msg = validar_capacidade_turma(35, 35)
    assert not bloqueado, "Deveria bloquear quando alunos_ativos == capacidade_maxima"
    assert "Capacidade maxima" in msg

    bloqueado_excesso, _ = validar_capacidade_turma(36, 35)
    assert not bloqueado_excesso, "Deveria bloquear quando alunos_ativos > capacidade_maxima"
    print("[OK] [1/3] Regra de controle estrito de lotacao validada.")

    # 2. Teste de Deteccao de Choque de Horarios
    # Segunda-feira: 07:30-09:10 vs 08:20-10:00 (Sobreposicao -> Choque)
    assert validar_choque_horario(1, "07:30", "09:10", 1, "08:20", "10:00")
    # Segunda-feira: 07:30-09:10 vs 09:10-10:50 (Disjuntos / Contiguos -> Sem choque)
    assert not validar_choque_horario(1, "07:30", "09:10", 1, "09:10", "10:50")
    # Dias distintos: Segunda 08:00-10:00 vs Terca 08:00-10:00 -> Sem choque
    assert not validar_choque_horario(1, "08:00", "10:00", 2, "08:00", "10:00")
    print("[OK] [2/3] Algoritmo in-process de deteccao de choques de horario aprovado.")

    # 3. Benchmark de Alta Volumetria
    start = time.perf_counter()
    num_operacoes = 50000
    choques_detectados = 0

    for i in range(num_operacoes):
        h_start = f"{(i % 12) + 7:02d}:00"
        h_end = f"{(i % 12) + 8:02d}:40"
        if validar_choque_horario(1, "09:00", "10:30", 1, h_start, h_end):
            choques_detectados += 1

    elapsed = time.perf_counter() - start
    taxa = num_operacoes / elapsed
    print(f"[OK] [3/3] Benchmark de {num_operacoes} analises executado em {elapsed*1000:.2f}ms (~{taxa:.0f} ops/s).")
    print("=== TODOS OS TESTES DE ENSALAMENTO E ALOCACAO FORAM APROVADOS! ===")

if __name__ == "__main__":
    test_ensalamento_e_alocacao()
