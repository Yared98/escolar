#!/usr/bin/env python3
"""
Validacao e Benchmark: Prontuario Eletronico e Contratos com Assinatura Eletronica (MP 2.200-2/2001)
Valida:
1. Gerador in-process de hash SHA-256 para contratos educacionais.
2. Deteccao de violacao de integridade contratual (alteracao de valores/datas).
3. Regra de Ownership Guard (RBAC) com bloqueio 403 para terceiros nao vinculados.
4. Benchmark de alta volumetria (100.000 hashes calculados).
"""

import hashlib
import time
import uuid

def gerar_hash_contrato(tenant_id: str, contrato_id: str, aluno_id: str, ano_letivo: int, valor_total: float, assinado_em_iso: str) -> str:
    raw = f"CONTRATO_EDUCACIONAL_MP2200:T:{tenant_id}:C:{contrato_id}:A:{aluno_id}:ANO:{ano_letivo}:VALOR:{valor_total:.2f}:TS:{assinado_em_iso}"
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()

def check_ownership_guard(user_id: str, aluno_id: str, vinculos_db: dict[str, list[str]]) -> bool:
    """Simula a guarda de propriedade: responsavel soh acessa alunos sob sua guarda"""
    alunos_do_responsavel = vinculos_db.get(user_id, [])
    return aluno_id in alunos_do_responsavel

def test_contratos_assinatura():
    print("=== INICIANDO VALIDACAO: PRONTUARIO & ASSINATURA DE CONTRATOS ===")

    tenant_id = str(uuid.uuid4())
    contrato_id = str(uuid.uuid4())
    aluno_id = str(uuid.uuid4())
    ts = "2026-09-25T12:00:00Z"
    valor = 18000.00

    # 1. Determinismo e Integridade Criptografica
    hash1 = gerar_hash_contrato(tenant_id, contrato_id, aluno_id, 2026, valor, ts)
    hash2 = gerar_hash_contrato(tenant_id, contrato_id, aluno_id, 2026, valor, ts)
    assert hash1 == hash2, "Hashes de contrato com mesmos parametros devem ser identicos"
    assert len(hash1) == 64, "Hash SHA-256 deve ter 64 caracteres hexadecimais"

    hash_adulterado = gerar_hash_contrato(tenant_id, contrato_id, aluno_id, 2026, 18000.01, ts)
    assert hash1 != hash_adulterado, "Qualquer adulteracao no valor deve alterar o digest"
    print("[OK] [1/3] Hashing SHA-256 de contratos (MP 2.200-2/2001) validado.")

    # 2. Teste de Ownership Guard (RBAC)
    resp_pai = "resp-pai-1"
    resp_estranho = "resp-estranho-2"
    vinculos = {
        resp_pai: [aluno_id]
    }
    assert check_ownership_guard(resp_pai, aluno_id, vinculos), "Responsavel vinculado deve ter acesso"
    assert not check_ownership_guard(resp_estranho, aluno_id, vinculos), "Responsavel estranho deve receber 403 Forbidden"
    print("[OK] [2/3] Guarda de propriedade e isolamento de dependentes validada.")

    # 3. Benchmark de Alta Volumetria
    start = time.perf_counter()
    n = 100000
    for i in range(n):
        gerar_hash_contrato(tenant_id, contrato_id, aluno_id, 2026, valor + (i % 100), ts)

    elapsed = time.perf_counter() - start
    taxa = n / elapsed
    print(f"[OK] [3/3] Benchmark de {n} assinaturas calculado em {elapsed*1000:.2f}ms (~{taxa:.0f} hashes/s).")
    print("=== TODOS OS TESTES DE CONTRATOS E PRONTUARIO FORAM APROVADOS! ===")

if __name__ == "__main__":
    test_contratos_assinatura()
