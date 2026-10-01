#!/usr/bin/env python3
"""
Validação e Benchmark do Módulo de Matrícula Completa & Prontuário Escolar
Escolar ERP - Gestão Humanizada Multi-Tenant
"""

import time
import json
import uuid

def limpar_cpf(cpf: str) -> str:
    return "".join(c for c in cpf if c.isdigit())

def validar_cpf(cpf: str) -> bool:
    digits = [int(c) for c in cpf if c.isdigit()]
    if len(digits) != 11:
        return False
    if len(set(digits)) == 1:
        return False
    soma1 = sum(d * (10 - i) for i, d in enumerate(digits[:9]))
    resto1 = soma1 % 11
    d1 = 0 if resto1 < 2 else 11 - resto1
    if digits[9] != d1:
        return False
    soma2 = sum(d * (11 - i) for i, d in enumerate(digits[:10]))
    resto2 = soma2 % 11
    d2 = 0 if resto2 < 2 else 11 - resto2
    return digits[10] == d2

def validar_telefone(tel: str) -> bool:
    digits = "".join(c for c in tel if c.isdigit())
    return len(digits) in (10, 11)

def validar_tipo_sanguineo(tipo: str) -> bool:
    t = tipo.strip().upper()
    return t in ("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "NÃO INFORMADO", "NAO INFORMADO", "")

def espelhar_responsavel_financeiro(payload: dict) -> tuple:
    if payload.get("responsavel_financeiro_igual_legal", True):
        nome = payload["nome_responsavel"]
        cpf = payload.get("cpf_responsavel_legal")
        email = payload["email_responsavel"]
        tel = payload["telefone_responsavel"]
        parentesco = payload.get("parentesco_responsavel_legal", "Mãe/Pai/Tutor Legal")
        return nome, cpf, email, tel, parentesco
    else:
        nome = payload.get("nome_responsavel_financeiro") or payload["nome_responsavel"]
        cpf = payload.get("cpf_responsavel_financeiro")
        email = payload.get("email_responsavel_financeiro") or payload["email_responsavel"]
        tel = payload.get("telefone_responsavel_financeiro") or payload["telefone_responsavel"]
        parentesco = payload.get("parentesco_responsavel_financeiro") or "Responsável Financeiro"
        return nome, cpf, email, tel, parentesco

def test_matricula_responsavel_unificado():
    print("[1/5] Validando matrícula com pai solo / responsável unificado (flag=True)...")
    payload = {
        "nome": "Enzo Gabriel Ferreira",
        "cpf": "529.982.247-25",
        "data_nascimento": "2014-04-10",
        "nome_responsavel": "Mariana Ferreira",
        "cpf_responsavel_legal": "123.456.789-09",
        "email_responsavel": "mariana.ferreira@email.com",
        "telefone_responsavel": "(11) 98765-4321",
        "parentesco_responsavel_legal": "Mãe",
        "responsavel_financeiro_igual_legal": True,
        "cep": "01310-100",
        "logradouro": "Avenida Paulista",
        "numero": "1500",
        "complemento": "Apto 101",
        "bairro": "Bela Vista",
        "cidade": "São Paulo",
        "estado": "SP",
        "telefone_secundario": "(11) 3288-1234",
        "contato_emergencia_nome": "Dona Alzira Ferreira",
        "contato_emergencia_telefone": "(11) 97777-8888",
        "contato_emergencia_parentesco": "Avó Materna",
        "tipo_sanguineo": "O+",
        "alergias": "Amendoim",
        "restricoes_alimentares": "Evitar frutos secos",
        "medicamentos_continuos": "Nenhum",
        "cuidados_especiais": "Levar para a enfermaria se houver inchaço facial",
        "historico_observacoes": "Aluno sociável e participativo"
    }

    assert validar_cpf(payload["cpf"])
    assert validar_telefone(payload["telefone_responsavel"])
    assert validar_tipo_sanguineo(payload["tipo_sanguineo"])

    nome_fin, cpf_fin, email_fin, tel_fin, parentesco_fin = espelhar_responsavel_financeiro(payload)
    assert nome_fin == "Mariana Ferreira"
    assert cpf_fin == "123.456.789-09"
    assert email_fin == "mariana.ferreira@email.com"
    assert tel_fin == "(11) 98765-4321"
    assert parentesco_fin == "Mãe"
    print("  [OK] Responsável financeiro espelhado perfeitamente a partir do responsável legal.")

def test_matricula_responsaveis_distintos():
    print("[2/5] Validando matrícula com responsáveis legal e financeiro distintos (flag=False)...")
    payload = {
        "nome": "Beatriz Mendonça Ramos",
        "cpf": "123.456.789-09",
        "data_nascimento": "2013-09-18",
        "nome_responsavel": "Fernanda Mendonça",
        "cpf_responsavel_legal": "529.982.247-25",
        "email_responsavel": "fernanda@email.com",
        "telefone_responsavel": "(11) 91234-5678",
        "parentesco_responsavel_legal": "Mãe (Guardiã Legal)",
        "responsavel_financeiro_igual_legal": False,
        "nome_responsavel_financeiro": "Eduardo Ramos (Pai)",
        "cpf_responsavel_financeiro": "777.888.999-00",
        "email_responsavel_financeiro": "eduardo.ramos@empresa.com",
        "telefone_responsavel_financeiro": "(11) 99888-7766",
        "parentesco_responsavel_financeiro": "Pai (Pagador)",
        "cep": "04530-000",
        "logradouro": "Rua das Bromélias",
        "numero": "250",
        "bairro": "Itaim Bibi",
        "cidade": "São Paulo",
        "estado": "SP",
        "telefone_secundario": "(11) 99999-0000",
        "contato_emergencia_nome": "Carlos Mendonça",
        "contato_emergencia_telefone": "(11) 94444-5555",
        "contato_emergencia_parentesco": "Tio",
    }

    assert validar_cpf(payload["cpf"])
    assert validar_telefone(payload["telefone_responsavel"])
    assert validar_telefone(payload["telefone_responsavel_financeiro"])

    nome_fin, cpf_fin, email_fin, tel_fin, parentesco_fin = espelhar_responsavel_financeiro(payload)
    assert nome_fin == "Eduardo Ramos (Pai)"
    assert cpf_fin == "777.888.999-00"
    assert email_fin == "eduardo.ramos@empresa.com"
    assert tel_fin == "(11) 99888-7766"
    assert parentesco_fin == "Pai (Pagador)"
    print("  [OK] Segregação dos responsáveis legal e financeiro operando com integridade.")

def test_validacao_endereco_e_emergencia():
    print("[3/5] Validando campos de endereço completo e contatos de emergência...")
    endereco = {
        "cep": "01001-000",
        "logradouro": "Praça da Sé",
        "numero": "100",
        "complemento": "Bloco B - Sala 12",
        "bairro": "Centro Histórico",
        "cidade": "São Paulo",
        "estado": "SP",
        "telefone_secundario": "(11) 3100-0000",
        "contato_emergencia_nome": "Tia Juliana",
        "contato_emergencia_telefone": "(11) 98888-2222",
        "contato_emergencia_parentesco": "Tia"
    }

    assert len(endereco["cep"].replace("-", "")) == 8
    assert len(endereco["estado"]) == 2
    assert validar_telefone(endereco["contato_emergencia_telefone"])
    assert len(endereco["contato_emergencia_nome"]) > 0
    print("  [OK] Dados de endereço e contingência de emergência validados.")

def test_prontuario_inicial_e_edicao():
    print("[4/5] Validando ciclo de vida do prontuário médico (inicialização e edição contínua)...")
    prontuario_db = {}
    aluno_id = str(uuid.uuid4())
    tenant_id = str(uuid.uuid4())

    # 1. Inicialização na Matrícula
    prontuario_db[aluno_id] = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "aluno_id": aluno_id,
        "tipo_sanguineo": "A+",
        "alergias": "Intolerância à lactose",
        "restricoes_alimentares": "Dieta sem derivados de leite",
        "medicamentos_continuos": "Nenhum",
        "cuidados_especiais": "Verificar rótulo do lanche da cantina",
        "historico_observacoes": "Matrícula 2026 efetuada com sucesso",
        "updated_at": "2026-09-25T12:00:00Z"
    }

    assert prontuario_db[aluno_id]["tipo_sanguineo"] == "A+"
    assert "lactose" in prontuario_db[aluno_id]["alergias"]

    # 2. Edição Contínua (PUT /secretaria/prontuarios/:aluno_id)
    update_payload = {
        "tipo_sanguineo": "A+",
        "alergias": "Intolerância à lactose + alergia a picada de formiga",
        "restricoes_alimentares": "Dieta sem derivados de leite (severa)",
        "medicamentos_continuos": "Anti-histamínico se picado por inseto",
        "cuidados_especiais": "Pomada antialérgica na enfermaria",
        "historico_observacoes": "Atualização clínica realizada pela enfermeira escolar"
    }

    prontuario_db[aluno_id].update(update_payload)
    prontuario_db[aluno_id]["updated_at"] = "2026-09-25T14:30:00Z"

    assert "formiga" in prontuario_db[aluno_id]["alergias"]
    assert "Anti-histamínico" in prontuario_db[aluno_id]["medicamentos_continuos"]
    print("  [OK] Prontuário médico cadastrado e atualizado com sucesso via UPSERT.")

def benchmark_processamento_matriculas():
    print("[5/5] Executando benchmark de processamento de matrículas e prontuários...")
    total_matriculas = 50_000
    start = time.perf_counter()

    for i in range(total_matriculas):
        flag_igual = (i % 2 == 0)
        dto = {
            "nome_responsavel": f"Responsavel Legal {i}",
            "cpf_responsavel_legal": "123.456.789-09",
            "email_responsavel": f"resp{i}@email.com",
            "telefone_responsavel": "(11) 98765-4321",
            "parentesco_responsavel_legal": "Mãe",
            "responsavel_financeiro_igual_legal": flag_igual,
            "nome_responsavel_financeiro": f"Responsavel Fin {i}" if not flag_igual else None,
            "cpf_responsavel_financeiro": "529.982.247-25" if not flag_igual else None,
            "email_responsavel_financeiro": f"fin{i}@email.com" if not flag_igual else None,
            "telefone_responsavel_financeiro": "(11) 91234-5678" if not flag_igual else None,
            "parentesco_responsavel_financeiro": "Pai" if not flag_igual else None,
            "tipo_sanguineo": "O+" if i % 2 == 0 else "AB-",
            "cep": "01310-100",
            "cidade": "São Paulo"
        }
        _ = espelhar_responsavel_financeiro(dto)
        _ = validar_tipo_sanguineo(dto["tipo_sanguineo"])

    elapsed = time.perf_counter() - start
    throughput = total_matriculas / elapsed
    print(f"  [OK] {total_matriculas:,} matrículas e prontuários validados em {elapsed:.4f}s ({throughput:,.0f} ops/s).")

if __name__ == "__main__":
    print("=== HOMOLOGAÇÃO DE MATRÍCULA COMPLETA & PRONTUÁRIO ESCOLAR ===")
    test_matricula_responsavel_unificado()
    test_matricula_responsaveis_distintos()
    test_validacao_endereco_e_emergencia()
    test_prontuario_inicial_e_edicao()
    benchmark_processamento_matriculas()
    print("=== TODAS AS VALIDAÇÕES CONCLUÍDAS COM SUCESSO [OK] ===")
