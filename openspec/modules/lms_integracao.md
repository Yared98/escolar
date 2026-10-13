# Especificação de Negócio: Interoperabilidade LMS & SSO Acadêmico (`openspec/modules/lms_integracao.md`)

## 0. Estado real do produto (leitura obrigatória)

O módulo fornece **infraestrutura backend de autenticação federada (Single Sign-On OIDC com PKCE)** e contratos de dados para interoperabilidade de notas e trilhas educacionais.
Os endpoints existem no backend, sem painel de administração visual na interface web atual.

| Capacidade | Status |
|---|---|
| Single Sign-On (SSO) OIDC Core 1.0 com PKCE S256 | Implementado (Backend) |
| Discovery Endpoint (`/.well-known/openid-configuration`) | Implementado (Backend) |
| JWKS Endpoint (`/.well-known/jwks.json`) com chaves Ed25519 | Implementado (Backend) |
| Endpoints LTI 1.3 Launch e Grade Sync (AGS) | Implementado (Backend) |
| Rastreamento SCORM 1.2 / 2004 CMI Data Model | Implementado (Backend) |
| Interface visual (UI) para gestão de LMS no Frontend | **Ausente no MVP** (operação via API) |
| Sincronização automática ativa com instâncias Moodle/Canvas de terceiros | **Fora de escopo MVP** (requer credenciamento de plataforma externa) |

---

## 1. Single Sign-On (SSO) Acadêmico OIDC & OAuth 2.0 PKCE
- **Padrão de Identidade**: OpenID Connect Core 1.0 e RFC 7636 (Proof Key for Code Exchange - PKCE).
- **Discovery Endpoint**: `GET /.well-known/openid-configuration` fornecendo metadados canônicos de autorização, tokens, userinfo e algoritmo de assinatura (`S256`).
- **JWKS Endpoint**: `GET /.well-known/jwks.json` com distribuição transparente das chaves públicas ativas para validação assimétrica das plataformas parceiras.
- **Autorização com PKCE**:
  - `POST /api/v1/auth/oauth/authorize`: Recebe `client_id`, `redirect_uri`, `response_type=code`, `code_challenge` (SHA-256 base64url sem padding) e `code_challenge_method=S256`.
  - Persiste autorização com expiração de 10 minutos na tabela `oauth_authorization_codes`.
- **Troca de Token (Token Exchange)**:
  - `POST /api/v1/auth/oauth/token`: Valida `grant_type=authorization_code`, confere `code_verifier` aplicando SHA-256 in-process e emitindo `access_token` e `id_token` JWT.
- **Claims Estruturadas do ID Token**:
  - `iss`: Identificador do provedor de identidade (`https://auth.escola.edu.br`).
  - `sub`: UUID do usuário autenticado no ERP.
  - `aud`: Client ID do LMS requisitante.
  - `tenant_id`: Isolamento lógico da unidade escolar.
  - `role`: Perfil acadêmico (`aluno`, `professor`, `gestor`, `responsavel`).
  - `email`: Endereço institucional do titular.
  - `exp`: Prazo de validade estrito (24 horas).
- **Logout Seguro e Revogação Global**:
  - `POST /api/v1/auth/logout`: Registra o token revogado na tabela `revoked_tokens`.

---

## 2. Protocolo LTI 1.3 Advantage & SCORM (Backend API)

> **Nota de arquitetura (B13.4):** O handler `backend/src/handlers/crm_lms.rs` foi dividido em `crm_lms/lms.rs` (LTI/SCORM), `crm_lms/crm.rs` (funil comercial) e `crm_lms/whatsapp.rs` (chatbot e protocolos). O comportamento e os contratos de API permanecem idênticos.
- **Configuração Multi-Tenant por LMS**:
  - `POST /api/v1/lms/config`: Cadastro e atualização atômica de credenciais (`lms_type`, `client_id`, `platform_url`, `lti_version`).
  - `GET /api/v1/lms/config`: Listagem de provedores configurados para o tenant ativo.
- **LTI 1.3 Launch Endpoint**:
  - `GET /api/v1/lms/lti/launch`: Valida perfil (`admin`, `gestor`, `professor`, `aluno`), gera `state_token` seguro e emite URLs canônicas de redirecionamento (`launch_url` e `jwt_target_link`).
- **Assignment and Grade Services (AGS)**:
  - `POST /api/v1/lms/grades/sync`: Sincronização de notas. Normaliza notas em escala 0-100 para 0-10, faz clamping seguro (0.00 a 10.00) e reconcilia atomicamente com a tabela `notas` do ERP escolar por período (`1_bimestre`, etc.), além de alimentar `lms_grade_sync_logs`.
- **Rastreamento SCORM 1.2 / 2004 (CMI Data Model)**:
  - `POST /api/v1/lms/scorm/track`: Atualização de status de lição (`passed`, `completed`, `failed`, `incomplete`, `browsed`), pontuação (`score_raw`, `score_min`, `score_max`), tempo de sessão e dados de suspensão (`suspend_data`).
  - `GET /api/v1/lms/scorm/track/:package_id/:aluno_id`: Consulta do histórico e progresso do estudante.
