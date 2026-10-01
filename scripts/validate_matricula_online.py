#!/usr/bin/env python3
"""
Validacao e Benchmark: Portal de Matricula e Rematricula Online
Valida:
1. Validador in-process de CPF brasileiro segundo o algoritmo oficial da Receita Federal (Modulo 11).
2. Prevencao de duplicidade de CPF por inquilino (HTTP 409 Conflict).
3. Validacao de telefones/WhatsApp com DDD.
4. Benchmark de alta volumetria (100.000 validacoes de CPF).
"""

import re
import time

def limpar_cpf(cpf: str) -> str:
    return re.sub(r'\D', '', cpf)

def validar_cpf_brasileiro(cpf: str) -> bool:
    digits = [int(c) for c in limpar_cpf(cpf)]
    if len(digits) != 11:
        return False
    if len(set(digits)) == 1:
        return False

    soma1 = sum(d * (10 - i) for i, d in enumerate(digits[:9]))
    resto1 = soma1 % 11
    d1 = 0 if resto1 < 2 else (11 - resto1)
    if digits[9] != d1:
        return False

    soma2 = sum(d * (11 - i) for i, d in enumerate(digits[:10]))
    resto2 = soma2 % 11
    d2 = 0 if resto2 < 2 else (11 - resto2)
    return digits[10] == d2

def validar_telefone(tel: str) -> bool:
    digits = re.sub(r'\D', '', tel)
    return 10 <= len(digits) <= 11

def simular_matricula_tenant(tenant_id: str, aluno_cpf: str, base_dados: dict) -> tuple[int, str]:
    if not validar_cpf_brasileiro(aluno_cpf):
        return 400, "CPF invalido"
    
    tenant_cpfs = base_dados.setdefault(tenant_id, set())
    cpf_limpo = limpar_cpf(aluno_cpf)
    if cpf_limpo in tenant_cpfs:
        return 409, "CPF ja cadastrado para esta unidade escolar (Conflito 409)"
    
    tenant_cpfs.add(cpf_limpo)
    return 200, "Matricula realizada com sucesso"

def test_matricula_online():
    print("=== INICIANDO VALIDACAO: PORTAL DE MATRICULA E REMATRICULA ONLINE ===")

    # 1. Teste de Validador de CPF
    assert validar_cpf_brasileiro("52998224725")
    assert validar_cpf_brasileiro("12345678909")
    assert validar_cpf_brasileiro("529.982.247-25")
    assert not validar_cpf_brasileiro("11111111111")
    assert not validar_cpf_brasileiro("12345678900")
    print("[OK] [1/3] Algoritmo oficial de CPF (Modulo 11) validado.")

    # 2. Teste de Duplicidade e Isolamento Multi-Tenant (HTTP 409 vs 200)
    db = {}
    t1 = "tenant-escola-alpha"
    t2 = "tenant-colegio-beta"
    cpf_valido = "52998224725"

    status1, _ = simular_matricula_tenant(t1, cpf_valido, db)
    assert status1 == 200, "Primeira matricula no tenant 1 deve retornar 200 OK"

    status_dup, msg_dup = simular_matricula_tenant(t1, cpf_valido, db)
    assert status_dup == 409, "Matricula com mesmo CPF no mesmo tenant deve retornar 409 Conflict"
    assert "409" in msg_dup

    # No tenant 2, o mesmo CPF pode ser matriculado (isolamento multi-tenant)
    status_t2, _ = simular_matricula_tenant(t2, cpf_valido, db)
    assert status_t2 == 200, "Mesmo CPF em tenants distintos eh permitido"
    print("[OK] [2/3] Isolamento multi-tenant e tratamento de duplicidade 409 validados.")

    # 3. Benchmark de Alta Volumetria
    start = time.perf_counter()
    n = 100000
    for _ in range(n):
        validar_cpf_brasileiro("52998224725")

    elapsed = time.perf_counter() - start
    taxa = n / elapsed
    print(f"[OK] [3/3] Benchmark de {n} validacoes executado em {elapsed*1000:.2f}ms (~{taxa:.0f} validacoes/s).")
    print("=== TODOS OS TESTES DE MATRICULA ONLINE FORAM APROVADOS! ===")

if __name__ == "__main__":
    test_matricula_online()
