-- Migration: Cora Config and Invoices

CREATE TABLE IF NOT EXISTS tenant_cora_config (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    client_id VARCHAR(255) NOT NULL,
    client_secret VARCHAR(255) NOT NULL,
    webhook_secret VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE faturas ADD COLUMN IF NOT EXISTS cora_invoice_id VARCHAR(255);
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS cora_invoice_url TEXT;

