# Especificação de Negócio: Regulatório & LGPD (`openspec/modules/regulatorio_lgpd.md`)

## 0. Estado real do produto (leitura obrigatória)

O módulo cobre a **conformidade com o Censo Escolar (Educacenso INEP)**, a **governança de privacidade e consentimento de menores (LGPD Art. 14)** e o **controle de acesso perimetral físico**.
A emissão de diplomas opera em modo cadastral interno com hash de integridade SHA-256 local e validação via QR Code.

| Capacidade | Status |
|---|---|
| Educacenso INEP (Exportação dos 5 módulos oficiais) | Implementado (Gera layout de arquivo; upload ao sistema INEP é manual) |
| Pré-validação de inconsistências cadastrais para o Censo | Implementado |
| Consentimento de Menores (LGPD Art. 14) com hash indelével | Implementado |
| Trilha de Auditoria em banco (`audit_logs`) | Implementado |
| Controle Perimetral Não-Invasivo (RFID / QR Code) | Implementado |
| Registro e Consulta Interna de Certificação de Conclusão | Implementado (Hash SHA-256 local + QR Code) |
| Assinatura Digital ICP-Brasil A3 / HSM | **Fora de escopo MVP** (substituído por hash SHA-256 de integridade interna) |
| Carimbo do Tempo oficial RFC 3161 (TSP externo) | **Fora de escopo MVP** |
| Integração direta via Web Service com MEC / Validador Nacional | **Fora de escopo MVP** |

---

## 1. Censo Escolar (Educacenso / INEP)
- **Extração Unificada dos 5 Módulos Oficiais**:
  - `00` Cabeçalho: Versão layout INEP (`2026.1`), código INEP da escola, dados da mantenedora e timestamp.
  - `10` Entidade/Escola: Código INEP, razão social, CNPJ, localização (Urbana/Rural) e dependência administrativa.
  - `20` Gestor: Nome completo, e-mail institucional e cargo de liderança.
  - `30` Turmas: Identificador, nome da turma, ano letivo, sala física vinculada e modalidade.
  - `40` Alunos: Identificador único, nome, CPF, data de nascimento e turma vinculada.
  - `50` Profissionais Escolares: Identificador, nome, CPF/NIS e cargo/atribuição.
  - `99` Rodapé / Trailer: Totalização de registros por tipo e soma geral de linhas.
- **Pré-validação de Inconsistências**: Verificação em tempo real de estudantes sem CPF ou sem turma, turmas sem sala de aula física cadastrada e docentes sem NIS/CPF válido.
- **Auditoria Indelével**: Cada solicitação de exportação gera log indelével em `audit_logs` (`EXPORTAR_EDUCACENSO`) registrando gestor autenticado, total de alunos, turmas, docentes e quantidade de inconsistências.
- **Contrato REST**: `GET /api/v1/regulatorio/educacenso/exportar` (RBAC: `admin`, `gestor`, `secretaria`).

---

## 2. Certidão Acadêmica & Registro de Conclusão (Diploma Digital MVP)
- **Registro Cadastral de Conclusão**:
  - Armazena histórico de disciplinas, notas e período de integralização.
  - Gera hash SHA-256 indelével (`hash_integridade`) baseado nos dados do estudante, curso e data de colação/conclusão para verificação de adulterações.
- **Código de Verificação & QR Code**:
  - Geração de código de verificação único (ex: `CERT-2026-XXXXXXXX`).
  - Endpoint público de validação: `GET /api/v1/regulatorio/diploma-digital/validar/:codigo` (sem autenticação, retornando dados básicos do concluinte para checagem rápida).
- **Contratos de API REST**:
  - `POST /api/v1/regulatorio/diploma-digital/emitir/:aluno_id` (RBAC: `admin`, `gestor`, `secretaria`): Emite o registro de conclusão com hash de integridade.
  - `GET /api/v1/regulatorio/diploma-digital/:aluno_id` (RBAC: `admin`, `gestor`, `secretaria`, `responsavel`): Consulta os dados do certificado.

---

## 3. LGPD & Controle Perimetral Não-Invasivo

### 3.1. Gestão de Consentimento de Menores (Art. 14 da Lei 13.709/2018)
- **Rota:** `POST /api/v1/regulatorio/lgpd/consentimento`
- **Permissão (RBAC):** `responsavel`, `admin`, `gestor`, `secretaria` (com validação estrita de dependente se perfil for responsável).
- **Integridade Criptográfica (ANPD):**
  - Armazena IP do subscritor extraído de headers proxy (`X-Forwarded-For` / `X-Real-IP`).
  - Geração de hash SHA-256 indelével do aceite combinando tenant, aluno, responsável, versão do termo e timestamp RFC 3339.
  - Registro em `lgpd_termos` e trilha de auditoria em `audit_logs` (`REGISTRAR_CONSENTIMENTO_LGPD`).

### 3.2. Controle Perimetral de Acesso Não-Invasivo (Catracas / Portarias)
- **Privacidade por Design:** Substituição do reconhecimento facial obrigatório por tecnologias não-invasivas (cartões/tags RFID ou QR Code dinâmico no PWA).
- **Rota de Validação:** `POST /api/v1/regulatorio/perimetro/validar-acesso`
- **Contrato:**
  - Payload: `{ "tipo_identificador": "rfid_ou_qrcode", "codigo": "ABC-12345", "direcao": "entrada"|"saida", "ponto_acesso": "Portaria Principal" }`
  - Response 200 OK: `{ "acesso_permitido": true, "nome_aluno": "Ana Clara Souza", "turma": "1º Ano A" }`
- **Automação de Notificação aos Responsáveis:**
  - A cada validação com sucesso, o sistema dispara imediatamente uma notificação de prioridade `'alta'` na tabela `notificacoes_sistema` para todos os responsáveis legais vinculados ao aluno.
  - Log indelével de passagem gravado em `perimetro_acessos_logs`.

---

## 4. OpenSec Security Engine & Hardening OWASP
- **Tabela de Regras (`opensec_security_rules`)**: Armazenamento no PostgreSQL de políticas ativas (Isolamento Multi-Tenant SEC-001, Claims RBAC SEC-002, Headers OWASP SEC-003, LGPD Imutável SEC-004 e Parameterized Query Shield SEC-005).
- **Security Middleware (Axum)**: Injeção obrigatória de cabeçalhos HSTS, X-Frame-Options DENY, X-Content-Type nosniff e X-OpenSec-Protection-Status.

---

## 5. Central Gerencial de Registro de Envios Auditáveis
- **Auditoria Multicanal Isolada**: Tela restrita a Administradores/Emissores registrando data/hora, aluno vinculado, responsável destinatário, emissor, canal e status de entrega/leitura.
