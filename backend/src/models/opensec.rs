use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OpenSecRule {
    pub id: Uuid,
    pub rule_code: String,
    pub category: String,
    pub title: String,
    pub description: String,
    pub severity: String,
    pub status: String,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct OpenSecAuditStatusDto {
    pub system_status: String,
    pub opensec_version: String,
    pub active_rules_count: i64,
    pub compliance_score: f64,
    pub owasp_top10_hardened: bool,
    pub lgpd_compliance_active: bool,
    pub rbac_enforcement_active: bool,
    pub rules: Vec<OpenSecRule>,
}
