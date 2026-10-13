use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use serde_json::{json, Value};
use sqlx::Acquire;
use uuid::Uuid;

use crate::{
    config::AppState,
    db::TenantDb,
    error::AppError,
    middleware::{
        auth::AuthUser,
        rbac::{check_roles, log_audit},
        tenant::ActiveTenant,
    },
    models::financeiro::{
        ConciliacaoBancaria, CreateDespesaDto, CreateFaturaDto, Despesa, DreReportDto, Fatura,
        GerarParcelasContratoDto, MensagensReguaContadores, NfseEmissao, ProcessarConciliacaoDto,
        ReguaCobrancaLog, ReguaExecucaoResultDto, UpdateDespesaDto, UpdateFaturaDto,
    },
    services::cora_api::{
        gateway_for, CoraAddress, CoraCreateInvoiceRequest, CoraCustomer, CoraDocument, CoraFine,
        CoraInterest, CoraPaymentTerms, CoraService,
    },
    services::faturamento::{
        gerar_parcelas_contrato, inserir_fatura, tenant_nome, valor_atualizado_com_encargos,
        NovaFaturaParams,
    },
};

mod conciliacao_regua;
mod despesas;
mod dre;
mod faturas;

pub use conciliacao_regua::*;
pub use despesas::*;
pub use dre::*;
pub use faturas::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_despesa_liquidada_nao_pode_ser_excluida() {
        assert!(despesa_liquidada("pago"));
        assert!(despesa_liquidada("liquidado"));
        assert!(despesa_liquidada("conciliado"));
        assert!(despesa_liquidada("estornada"));
        assert!(!despesa_liquidada("pendente"));
        assert!(!despesa_liquidada("atrasado"));
    }

    #[test]
    fn test_classificar_evento_regua_preventivo() {
        assert_eq!(classificar_evento_regua(5), Some("lembrete_preventivo"));
        assert_eq!(classificar_evento_regua(1), Some("lembrete_preventivo"));
    }

    #[test]
    fn test_classificar_evento_regua_hoje() {
        assert_eq!(classificar_evento_regua(0), Some("aviso_vencimento"));
    }

    #[test]
    fn test_classificar_evento_regua_cobranca_ativa() {
        assert_eq!(classificar_evento_regua(-1), Some("cobranca_ativa"));
        assert_eq!(classificar_evento_regua(-15), Some("cobranca_ativa"));
    }

    #[test]
    fn test_classificar_evento_regua_futuro_distante() {
        assert_eq!(classificar_evento_regua(10), None);
        assert_eq!(classificar_evento_regua(30), None);
    }

    #[test]
    fn test_calculo_dre_inadimplencia_expirada() {
        let hoje = chrono::Utc::now().date_naive();
        let fatura_paga_valor = 1000.0;
        let fatura_atrasada_valor = 500.0;
        let fatura_pendente_expirada_valor = 300.0;
        let despesas_valor = 600.0;

        let receita_bruta = fatura_paga_valor;
        let mut inadimplencia = fatura_atrasada_valor;
        // Simulação de fatura pendente expirada (vencimento ontem)
        let vencimento_passado = hoje - chrono::Duration::days(2);
        if vencimento_passado < hoje {
            inadimplencia += fatura_pendente_expirada_valor;
        }

        let resultado_liquido = receita_bruta - despesas_valor;
        let dfc_projetado = resultado_liquido + (inadimplencia * 0.4);

        assert_eq!(receita_bruta, 1000.0);
        assert_eq!(inadimplencia, 800.0);
        assert_eq!(resultado_liquido, 400.0);
        assert_eq!(dfc_projetado, 720.0);
    }

    #[test]
    fn test_gerar_pix_emvco_valido() {
        let pix = gerar_pix_emvco(
            "financeiro@escola.com.br",
            "ESCOLA MODERNA",
            "SAO PAULO",
            850.00,
            "FATURA123",
        );
        assert!(pix.starts_with("000201010212"));
        assert!(pix.contains("br.gov.bcb.pix"));
        assert!(pix.contains("5303986")); // Moeda BRL
        assert!(pix.contains("850.00"));
        assert!(pix.contains("6304")); // Tag CRC16
        assert_eq!(pix.len(), pix.find("6304").unwrap() + 8); // 6304 + 4 hex digits
    }

    #[test]
    fn test_gerar_linha_digitavel_febraban() {
        let linha = gerar_linha_digitavel_febraban("itau", 850.00, 12345678);
        assert!(linha.starts_with("3419"));
        assert!(linha.contains(" 1 "));
        assert!(linha.ends_with("0000085000")); // 850.00 em centavos com padding
    }

    fn fatura_teste(status: &str, vencimento: chrono::NaiveDate, valor: f64) -> Fatura {
        Fatura {
            id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            aluno_id: Uuid::new_v4(),
            descricao: "Teste".to_string(),
            valor,
            data_vencimento: vencimento,
            metodo_pagamento: "pix".to_string(),
            status: status.to_string(),
            linha_digitavel: None,
            qr_code_pix: None,
            gateway_invoice_id: None,
            gateway_invoice_url: None,
            gateway_pix_code: None,
            gateway_digitable_line: None,
            gateway_name: None,
            contrato_id: None,
            parcela_numero: None,
            parcela_total: None,
            valor_original: Some(valor),
            desconto_percentual: 0.0,
            multa_percentual: 2.0,
            juros_mora_mes_percentual: 1.0,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        }
    }

    #[test]
    fn test_calcular_inadimplencia_regra() {
        let hoje = chrono::Utc::now().date_naive();
        let faturas = vec![
            fatura_teste("pago", hoje - chrono::Duration::days(5), 100.0),
            fatura_teste("atrasado", hoje - chrono::Duration::days(5), 250.0),
            fatura_teste("pendente", hoje - chrono::Duration::days(1), 125.0),
            fatura_teste("pendente", hoje + chrono::Duration::days(5), 300.0),
            fatura_teste("cancelado", hoje - chrono::Duration::days(10), 50.0),
        ];

        let (total, count) = calcular_inadimplencia(&faturas, hoje);

        // A vencer (R$ 300) e paga/cancelada não entram; atrasada + pendente vencida entram.
        assert_eq!(count, 2);
        assert!((total - 375.0).abs() < 0.001, "total={}", total);
    }
}
