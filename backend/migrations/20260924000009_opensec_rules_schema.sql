-- Migration: OpenSec Security Rules & Threat Audit Schema

CREATE TABLE IF NOT EXISTS opensec_security_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_code VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL, -- 'auth_rbac', 'sql_injection_defense', 'xss_csp_hardening', 'lgpd_data_privacy', 'multi_tenant_isolation'
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'high', -- 'low', 'medium', 'high', 'critical'
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'enforced', 'audited'
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial OpenSec Security Ruleset
INSERT INTO opensec_security_rules (rule_code, category, title, description, severity, status)
VALUES 
    ('SEC-001', 'multi_tenant_isolation', 'Isolamento Rígido Multi-Tenant', 'Garantir que todas as consultas SQL filtrem estritamente pelo X-Tenant-ID extraído e validado.', 'critical', 'enforced'),
    ('SEC-002', 'auth_rbac', 'RBAC Claims Validation & 403 Forbidden', 'Validar os privilégios do JWT (role) e bloquear tentativas de acesso não autorizadas a rotas de back-office com HTTP 403.', 'critical', 'enforced'),
    ('SEC-003', 'xss_csp_hardening', 'OpenSec Security Headers (OWASP)', 'Injeção obrigatória de cabeçalhos HSTS, X-Frame-Options DENY, X-Content-Type nosniff e X-XSS-Protection.', 'high', 'enforced'),
    ('SEC-004', 'lgpd_data_privacy', 'Auditoria Imutável de Prontuários & Saúde', 'Registrar carimbo de data/hora imutável para acesso a dados médicos e alergias infantis em conformidade LGPD.', 'critical', 'enforced'),
    ('SEC-005', 'sql_injection_defense', 'SQLx Parameterized Query Shield', 'Garantir uso de prepared statements parametrizados no Rust/Axum sem concatenação dinâmica de strings.', 'critical', 'enforced')
ON CONFLICT (rule_code) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW();
