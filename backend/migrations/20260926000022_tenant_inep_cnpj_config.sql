-- Migration: 20260926000022_tenant_inep_cnpj_config.sql
-- Parametrização oficial de Código INEP e CNPJ por Tenant escolar

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS codigo_inep VARCHAR(20) DEFAULT '19842001',
ADD COLUMN IF NOT EXISTS cnpj VARCHAR(20) DEFAULT '12.345.678/0001-90';
