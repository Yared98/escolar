# Especificação de Negócio & Arquitetura: IA Preditiva Anti-Evasão (`openspec/modules/ia_preditiva.md`)

## 0. Estado real do produto (leitura obrigatória)

O módulo opera como um **Sistema de Alerta Antecipado (Early Warning System - EWS)** baseado em **heurística estatística ponderada in-process** executada nativamente em Rust sobre o PostgreSQL multi-tenant.

| Capacidade | Status |
|---|---|
| Score de Risco de Evasão (0% a 100%) | Implementado (Heurística determinística ponderada) |
| Fator Composto de Sinergia (1.30x) | Implementado |
| Detecção de Faltas (janela 30 dias, LDB 75%) | Implementado |
| Detecção de Inadimplência (Faturas atrasadas) | Implementado |
| Detecção de Desempenho (Média das notas) | Implementado |
| Notificações Urgentes automáticas (score > 75%) | Implementado |
| Painel Visual de Evasão no Frontend | Implementado (`PainelEvasao.tsx`) |
| Machine Learning (Random Forest / LightGBM) | **Não aplicável no MVP** (substituído por heurística determinística in-process) |
| Treinamento de modelos externos em Python/ONNX | **Fora de escopo MVP** |

---

## 1. Visão Geral & Modelo Analítico
O motor analítico de mitigação proativa do risco de evasão escolar (Early Warning System - EWS) calcula em tempo real o Score de Risco de Evasão (0.00% a 100.00%) combinando dados multidimensionais extraídos diretamente do banco PostgreSQL multi-tenant através de pesos determinísticos calibrados.

### Pesos Analíticos Calibrados
1. **Faltas Escolares e Assiduidade (40% de peso)**:
   - Amostragem: Últimos 30 dias na tabela `presencas` vinculada a `diarios_classe`.
   - Limiar legal LDB (Lei 9.394/96, art. 24, VI): Frequência mínima obrigatória de 75%.
   - Curva de risco: Frequência ≥ 90% (risco 0% - 15%); entre 75% e 90% (risco 15% - 50%); < 75% (infração grave, risco 50% - 100%).
2. **Inadimplência Financeira (35% de peso)**:
   - Amostragem: Faturas em aberto com vencimento expirado (`faturas`).
   - Escala: 0 faturas (0% risco); 1 fatura (50% risco); 2 faturas (90% risco); ≥ 3 faturas (100% risco).
3. **Queda de Desempenho / Notas (25% de peso)**:
   - Amostragem: Média das notas do estudante (`notas`).
   - Escala: Média ≥ 7.0 (0% risco); entre 5.0 e 7.0 (0% - 55% risco); < 5.0 (55% - 100% risco).

### Sinergia de Múltiplos Fatores (Compound Risk Multiplier)
Quando múltiplos gatilhos críticos ocorrem simultaneamente (inadimplência e faltas severas), aplica-se multiplicador de sinergia de 1.30x (efeito composto de abandono iminente), com teto estrito em 100.0%.

---

## 2. Contrato de API REST

- **Rota:** `GET /api/v1/ia/evasao/predizer/:aluno_id`
- **Permissão (RBAC):** `admin`, `gestor`, `secretaria`
- **Headers:** `Authorization: Bearer <JWT>`, `X-Tenant-ID: <UUID>`
- **Response 200 OK:**
```json
{
  "aluno_id": "b1234567-89ab-cdef-0123-456789abcdef",
  "score_risco_evasao": 85.5,
  "nivel_urgencia": "alta",
  "fator_principal": "inadimplencia",
  "detalhes": {
    "faturas_atrasadas": 2,
    "frequencia_ultimos_30_dias": 72.0,
    "media_disciplinas": 6.1
  },
  "recomendacao": "Agendar reunião de acolhimento pedagógico e oferecer plano de parcelamento financeiro."
}
```
- **Response 404 Not Found:** `{ "error": "Aluno não encontrado", "status": 404 }`
- **Response 403 Forbidden:** `{ "error": "Acesso não autorizado ao aluno solicitado", "status": 403 }`

---

## 3. Governança, Notificações & Auditoria

1. **Alerta Automático Prioritário**:
   - Caso `score_risco_evasao > 75.0%`, o sistema insere imediatamente uma notificação de prioridade `'urgente'` na tabela `notificacoes_sistema` vinculada ao módulo `'ia_evasao'`.
2. **Histórico Indelével**:
   - Todo cálculo executado é persistido na tabela `analise_evasao_logs(tenant_id, aluno_id, score_risco_evasao, fator_principal, calculado_em)` indexado por `(tenant_id, score_risco_evasao DESC)`.
3. **Trilha de Auditoria**:
   - Operação registrada com código `PREDIZER_RISCO_EVASAO` na tabela `audit_logs` contendo o ID do operador.
