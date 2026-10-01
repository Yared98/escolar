-- Migration: Generic Bank Integrations

CREATE TABLE IF NOT EXISTS tenant_bank_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    gateway_name VARCHAR(50) NOT NULL, -- 'cora', 'asaas', 'pagarme'
    client_id VARCHAR(255) NOT NULL,
    client_secret VARCHAR(255) NOT NULL,
    webhook_secret VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, gateway_name)
);

ALTER TABLE faturas RENAME COLUMN cora_invoice_id TO gateway_invoice_id;
ALTER TABLE faturas RENAME COLUMN cora_invoice_url TO gateway_invoice_url;
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS gateway_name VARCHAR(50);

-- Enable the module_bank_api for the MVP tenant so we can see the screen
INSERT INTO tenant_feature_flags (tenant_id, feature_name, is_enabled)
SELECT id, 'module_bank_api', true FROM tenants
ON CONFLICT (tenant_id, feature_name) DO UPDATE SET is_enabled = true;

