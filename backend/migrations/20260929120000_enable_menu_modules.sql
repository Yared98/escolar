-- Módulos já expostos no menu da escola passam a existir habilitados.
-- TRI permanece desligado até a escola optar pelo módulo.

INSERT INTO tenant_feature_flags (tenant_id, feature_name, is_enabled)
SELECT tenants.id, features.feature_name, true
FROM tenants
CROSS JOIN (VALUES ('module_crm'), ('module_ia')) AS features(feature_name)
ON CONFLICT (tenant_id, feature_name) DO NOTHING;
