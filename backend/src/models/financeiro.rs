use chrono::{NaiveDate, DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Fatura {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub aluno_id: Uuid,
    pub descricao: String,
    pub valor: f64,
    pub data_vencimento: NaiveDate,
    pub metodo_pagamento: String,
    pub status: String,
    pub linha_digitavel: Option<String>,
    pub qr_code_pix: Option<String>,
    pub gateway_invoice_id: Option<String>,
    pub gateway_invoice_url: Option<String>,
    pub gateway_name: Option<String>,
    pub contrato_id: Option<Uuid>,
    pub parcela_numero: Option<i32>,
    pub parcela_total: Option<i32>,
    pub valor_original: Option<f64>,
    pub desconto_percentual: f64,
    pub multa_percentual: f64,
    pub juros_mora_mes_percentual: f64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateFaturaDto {
    pub aluno_id: Uuid,
    pub descricao: String,
    pub valor: f64,
    pub data_vencimento: NaiveDate,
    pub metodo_pagamento: String,
    pub contrato_id: Option<Uuid>,
    pub desconto_percentual: Option<f64>,
    pub multa_percentual: Option<f64>,
    pub juros_mora_mes_percentual: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct GerarParcelasContratoDto {
    pub contrato_id: Uuid,
    /// Padrão: 12
    pub numero_parcelas: Option<i32>,
    /// pix | boleto — padrão pix
    pub metodo_pagamento: Option<String>,
    /// Dia do mês (1–28). Padrão: 10
    pub dia_vencimento: Option<u32>,
    pub desconto_percentual: Option<f64>,
    pub multa_percentual: Option<f64>,
    pub juros_mora_mes_percentual: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateFaturaDto {
    pub descricao: Option<String>,
    pub valor: Option<f64>,
    pub data_vencimento: Option<NaiveDate>,
    pub metodo_pagamento: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Despesa {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub descricao: String,
    pub categoria: String,
    pub valor: f64,
    pub data_vencimento: NaiveDate,
    pub data_pagamento: Option<NaiveDate>,
    pub metodo_pagamento: Option<String>,
    pub status: String,
    pub tipo: String,
    pub fornecedor_id: Option<Uuid>,
    pub fornecedor_nome: Option<String>,
    #[serde(default)]
    pub estorno_de: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDespesaDto {
    pub descricao: String,
    pub categoria: String,
    pub valor: f64,
    pub data_vencimento: NaiveDate,
    pub metodo_pagamento: Option<String>,
    pub tipo: Option<String>,
    pub fornecedor_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDespesaDto {
    pub descricao: Option<String>,
    pub categoria: Option<String>,
    pub valor: Option<f64>,
    pub data_vencimento: Option<NaiveDate>,
    pub metodo_pagamento: Option<String>,
    pub status: Option<String>,
    pub fornecedor_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct NfseEmissao {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub fatura_id: Uuid,
    pub numero_nfse: Option<String>,
    pub codigo_verificacao: Option<String>,
    pub valor_servico: f64,
    pub aliquota_iss: f64,
    pub status: String,
    pub xml_url: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ConciliacaoBancaria {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub banco: String,
    pub data_transacao: NaiveDate,
    pub descricao: String,
    pub valor: f64,
    pub tipo: String,
    pub fatura_id: Option<Uuid>,
    pub despesa_id: Option<Uuid>,
    pub status_conciliacao: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ProcessarConciliacaoItemDto {
    pub banco: String,
    pub data_transacao: NaiveDate,
    pub descricao: String,
    pub valor: f64,
    pub tipo: String, // 'credito', 'debito'
    pub fatura_id: Option<Uuid>,
    pub despesa_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct ProcessarConciliacaoDto {
    pub transacoes: Vec<ProcessarConciliacaoItemDto>,
}

#[derive(Debug, Serialize)]
pub struct DreReportDto {
    pub receita_bruta: f64,
    pub despesas_totais: f64,
    pub resultado_liquido: f64,
    pub inadimplencia_total: f64,
    pub total_faturas_pagas: i64,
    pub total_faturas_pendentes: i64,
    pub dfc_caixa_projetado: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ReguaCobrancaLog {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub fatura_id: Uuid,
    pub canal: String,
    pub tipo_evento: String,
    pub status_envio: String,
    pub mensagem_corpo: Option<String>,
    pub enviado_em: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MensagensReguaContadores {
    pub lembretes_preventivos: usize,
    pub avisos_vencimento_hoje: usize,
    pub cobrancas_ativas: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReguaExecucaoResultDto {
    pub status: String,
    pub disparos_executados: usize,
    pub mensagens: MensagensReguaContadores,
}
