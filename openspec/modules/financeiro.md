# Especificação de Negócio: Módulo Financeiro & Cobrança (`openspec/modules/financeiro.md`)

## 0. Estado real do produto (leitura obrigatória)

O módulo cobre **tesouraria escolar gerencial** (AR/AP, DRE/DFC, portal Pix, fornecedores, régua com auditoria).  
Não é, ainda, um ERP de cobrança bancária/fiscal completo.

| Capacidade | Status |
|---|---|
| Faturas AR (CRUD, Pix EMVCo local, boleto sintético) | Implementado |
| Parcelas na assinatura do contrato (12× + desconto grupo familiar) | Implementado |
| Contas a pagar + fornecedores + estorno de despesa | Implementado |
| Régua D-5 / D-0 / D+ com multa/juros calculados e logs | Implementado (sem WhatsApp/e-mail reais) |
| DRE / DFC gerencial | Implementado |
| 2ª via Pix no portal da família | Implementado (chips Abertas/Pagas/Todas, EMVCo local, sem botão Pix em pagas) |
| Aging operacional AR (0–30 / 31–60 / 60+ dias) | Implementado (visão operacional de tesouraria; não contábil) |
| Conciliação com matching por valor/data (OFX upload na UI) | Parcial |
| NFS-e | Stub (número/URL simulados; sem ABRASF/prefeitura) |
| Gateway Cora / Asaas / Pagar.me | Adapter BankGateway com CORA_MODE=mock\|sandbox\|production (apenas mock funcional no MVP; sandbox/production retornam 503); webhook Cora; exibição de modo_gateway e selo "Simulado (modo mock)" na UI |
| Gateway Itaú (Bolecode + Pix + webhooks) | **Em implementação, não operacional**: segredos cifrados (ITAU-A), API do assistente de conexão (ITAU-B), emissão de Bolecode e baixa no cancelamento (ITAU-C), webhooks de boleto e Pix com fila assíncrona (ITAU-D, ITAU-E) e telas (ITAU-F) implementados, testados só contra simulador local e em modo simulado; sem teste com credenciais reais do Itaú (§8) |
| Boleto registrado Febraban / cartão recorrente | Não operacional |
| CNAB 240/400 | Ausente |
| Plano de contas | Schema apenas |

## 1. Faturamento & meios de pagamento

- **Parcelamento na matrícula**: ao assinar contrato (`POST /secretaria/contratos/:id/assinar`), gera até 12 faturas Pix com vencimento dia 10, aplicando `grupos_familiares.desconto_percentual` quando houver. Reexecução bloqueada se o contrato já tiver parcelas. Também disponível via `POST /financeiro/faturas/gerar-parcelas`.
- **Fatura avulsa**: `POST /financeiro/faturas` com desconto, multa (% padrão 2) e juros ao mês (% padrão 1).
- **Pix**: payload EMVCo + CRC16 local (`gerar_pix_emvco`). Chave sintética do tenant — **não** é cobrança de PSP.
- **Boleto**: linha digitável sintética Febraban para demonstração — **não** registrada em banco.
- **Cartão recorrente**: apenas valor de enum; sem gateway.
- **Integração Bancária / Gateway Cora (`CORA_MODE`)**: o backend provê o trait `BankGateway` com o factory `gateway_for(config)`. O modo é configurado via variável de ambiente `CORA_MODE` (`mock` [padrão], `sandbox`, `production`). No modo `mock`, as faturas continuam com Pix EMVCo local e boleto sintético. Nos modos `sandbox`/`production`, quando as credenciais de servidor (`CORA_CLIENT_ID`, `CORA_CERT_FILE`, `CORA_KEY_FILE`) estiverem presentes — ou quando `CORA_BASE_URL` for explicitamente `http://` para testes locais —, o backend emite cobranças reais na Cora via mTLS. Sem credenciais, o backend sobe normalmente e responde `ServiceUnavailable` com mensagem simples. O endpoint `GET /api/tenant/integrations/banking` expõe `modo_gateway` ("mock" | "sandbox" | "production") e `has_server_credentials` no DTO JSON; a UI exibe "Simulado", "Teste (Stage)" ou "Produção", e se as credenciais estão presentes (sim/não, nunca o valor).
- **Webhook Gateway Cora**: `/webhooks/cora/:tenant_id` e `/api/webhooks/cora/:tenant_id`. Idempotência e anti-replay via tabela `webhook_events` com RLS por tenant (`UNIQUE (tenant_id, gateway_name, event_id)`). Todo o processamento (registro em `webhook_events`, baixa da fatura e `audit_logs`) é executado em uma única transação SQL atômica com RLS configurado (`set_config('app.current_tenant', ...)`). Na conversão de valores, apenas campos com unidade explicitamente conhecida (`paid_amount` em reais, `amount_cents` em centavos) realizam conversão de unidade; campos ambíguos (`amount`/`value`) são tratados estritamente como reais (sem divisão automática por 100) e, em caso de divergência com o valor cadastrado da fatura, acionam a sinalização em `audit_logs` (`acao = 'webhook_valor_divergente'`) sem baixar a fatura.
  - **Autenticação do webhook**: a documentação oficial da Cora (até a data desta escrita) não descreve mecanismo de assinatura. O backend aceita o header legado `Cora-Signature` (HMAC-SHA256, com validação de timestamp quando `CORA_WEBHOOK_SIGNATURE_FORMAT=t_v1`) como compatibilidade, e, quando esse header não está presente, exige um token secreto na query `token` ou no header `X-Cora-Webhook-Token`, comparado em tempo constante com `tenant_bank_integrations.webhook_secret`. Esse token deve ser configurado manualmente na URL de webhook registrada na Cora.
  - **Formato do evento**: a Cora documenta os headers `webhook-event-id`, `webhook-event-type` (ex.: `invoice.paid`) e `webhook-resource-id` (o `gateway_invoice_id`). O backend reconhece esses headers. Payloads JSON antigos continuam suportados.
  - **Confirmação na Cora antes da baixa (sandbox/production):** como a autenticação é só um token e o corpo pode vir vazio, um aviso `invoice.paid`/`invoice.settled` NÃO dá baixa sozinho: o backend consulta `GET /v2/invoices/{id}` na Cora e só segue se `status = PAID`; o `total_paid` (centavos) informado pela Cora é o valor usado na conferência com a fatura. Aviso não confirmado responde `not_confirmed` e não é registrado em `webhook_events`, para que um novo aviso posterior ainda seja processado. Em `mock` não há consulta.
- **Emissão de cobrança na Cora**: `POST /api/v1/financeiro/faturas/:id/cora` (papéis `admin`/`financeiro`). Emite a cobrança oficial com os dados do pagador cadastrados no aluno: nome e CPF/CNPJ do responsável financeiro (ou do responsável legal). Sem nome ou sem CPF/CNPJ válido (11 ou 14 dígitos) a emissão é recusada com orientação e nada é enviado à Cora (nunca há valor inventado); e-mail vai se existir; endereço vai só se o cadastro tiver logradouro, número, bairro, cidade, UF (2 letras) e CEP (8 dígitos), complemento vazio vira "N/A". Valor mínimo R$ 5,00 (regra da Cora, 400 abaixo disso); `Idempotency-Key` estável por fatura (UUID v5 a partir do ID da fatura). Grava `gateway_name='cora'`, `gateway_invoice_id`, `gateway_invoice_url`, `gateway_pix_code` e `gateway_digitable_line`. Se a fatura já foi emitida, retorna a existente; se paga, retorna 409. Em `CORA_MODE=mock` retorna 400 orientando usar o Pix local.
- **Simulação de pagamento (sandbox)**: `POST /api/v1/financeiro/faturas/:id/cora/simular-pagamento` (papéis `admin`/`financeiro`). Só funciona em `CORA_MODE=sandbox`; em outros modos retorna 400.
- **Demais contratos REST** (GET/PUT/DELETE faturas; despesas; estorno; banking settings): mantidos.

Campos relevantes em `faturas`: `contrato_id`, `parcela_numero`/`parcela_total`, `valor_original`, `desconto_percentual`, `multa_percentual`, `juros_mora_mes_percentual`, `gateway_*` (quando houver PSP).

## 2. Régua de cobrança

- `POST /financeiro/cobranca/regua`: classifica D-5…D-1, D-0 e D+; marca `atrasado`; calcula multa + juros pro-rata; grava `regua_cobranca_logs` com `status_envio = registrado`.
- **Limite**: não envia WhatsApp/e-mail reais; worker de fila não está ligado a este endpoint.
- `GET /financeiro/cobranca/logs`: últimos 100 disparos.

## 3. Conciliação, NFS-e e DRE

- **Conciliação** `POST /financeiro/conciliacao/processar`: aceita lote JSON; se `fatura_id`/`despesa_id` omitidos, tenta match por valor (±0,02) e proximidade de vencimento. OFX via upload na UI de DRE. Sem CNAB.
- **NFS-e** `POST /financeiro/nfse/emitir` + `GET /financeiro/nfse`: persistência de emissão **simulada** (não transmite à prefeitura).
- **DRE/DFC** `GET /financeiro/relatorios/dre`: receita de faturas pagas, despesas (exceto cancelado/estornada), inadimplência (atrasado + pendente vencido). O JSON inclui `total_faturas_pendentes` (pendente + atrasado) e `total_faturas_atrasadas` (vencidas e não pagas). O DFC projetado = resultado líquido + (`FATOR_RECUPERACAO_INADIMPLENCIA` × inadimplência). Relatório gerencial, não contábil.
- **Limitação MVP — fator de recuperação**: o DFC utiliza 0,4 (40%) como estimativa de recuperação de inadimplência, materializada na constante `FATOR_RECUPERACAO_INADIMPLENCIA`. Esse valor é uma premissa gerencial de tesouraria para demonstração e deve ser parametrizável antes de uso contábil/fiscal real.

## 4. UI (Financeiro)

Abas: Faturas (com Aging Operacional AR: faixas 0–30, 31–60 e 60+ dias para pendente+atrasado com totais R$, contagem e filtro interativo) | Despesas | Cobrança (régua automatizada D-5/D-0/D+ com cálculo de encargos, histórico e filtros de logs de auditoria) | Fornecedores | NFS-e (emissão simulada) | DRE & DFC | Integrações.  
Portal da família: Mensalidades (2ª via Pix com filtros e confirmação de pagamento).

- **Portal da família (Mensalidades & 2ª via Pix)**:
  - Filtros rápidos por chips: "Abertas" (pendente/atrasado), "Pagas" (pago) e "Todas", com contagem dinâmica por status.
  - Faturas pagas: exibem badge visual de confirmação de quitação (`Pagamento Confirmado`), sem botão ativo de pagamento Pix redundante.
  - Limitações MVP e integridade: notas e disclaimers visíveis explicitam que o QR Code e código Copia e Cola são gerados localmente no padrão EMVCo para emissão de 2ª via e conciliação interna pela tesouraria da escola, sem promessa de conciliação bancária instantânea via PSP no MVP (dependente de credenciais ativas em produção).
- **Aging operacional de faturas AR**: painel com cards resumo calculando totais em R$ e contagem por faixas de vencimento/atraso (0–30 dias, 31–60 dias e 60+ dias) para faturas em aberto (`pendente` + `atrasado`). Permite filtrar interativamente a listagem ao clicar em qualquer faixa e alternar/redefinir o filtro. Relatório estritamente operacional da tesouraria de cobrança, não contábil.
- **Aba Cobrança (`cobranca`)**:
  - Painel de controle e execução da régua (`POST /financeiro/cobranca/regua`) com cálculo automático de multa (2%) e juros de mora pro-rata (1% a.m.), atualização de faturas vencidas para `atrasado` e exibição de contadores por estágio (D-5 preventivo, D-0 vencimento, D+ ativo).
  - Listagem e auditoria de logs (`GET /financeiro/cobranca/logs`) com filtros por canal (WhatsApp, E-mail), por tipo de evento e busca textual por conteúdo da notificação ou ID de fatura, além de cópia de payload para clipboard.
  - Separação completa da aba NFS-e: a aba NFS-e mantém foco estrito em notas fiscais de serviço simuladas, enquanto a régua e seus logs residem exclusivamente na aba Cobrança.
  - Limitação MVP e integridade: disclaimers explícitos indicam que os disparos são registrados localmente no banco para auditoria (`status_envio = registrado`), sem envio omnicanal real a clientes (sem conector WhatsApp/SMTP ativo).

## 5. Limitações MVP (estado real)

- **Integração Itaú (Cards ITAU-B a ITAU-E)**: A API do assistente de conexão (ITAU-B), o cliente HTTP com emissão de Bolecode, consulta e pedido de baixa no cancelamento de faturas (ITAU-C), o webhook de boleto com emissor OAuth2, fila `gateway_avisos` e reprocessamento assíncrono (ITAU-D) e o webhook Pix com cadastro e recepção mTLS via fila (ITAU-E) estão implementados no backend. Suporta geração de par de transporte RSA 2048, decifragem de credenciais (RSA PKCS#1 v1.5 + AES-256-CBC IV zero), CSR SHA-512, emissão mTLS com token OAuth2 em cache, reserva sequencial de `nosso_numero`, validação estrita de endereço/pagador, fila de avisos com RLS, processamento assíncrono com conferência via `GET /pix/{e2eid}` e política de tentativas com backoff. O mTLS exige terminação e validação de certificado de cliente no proxy reverso conforme `docs/instalacao-itau-mtls.md`. Todos os fluxos foram testados e validados contra simulador HTTP local e testes de integração. A operação contra os servidores reais do Itaú depende de credenciais concedidas pelo banco e configuração de `ITAU_MODE=production` ou `ITAU_MODE=sandbox`. As telas visuais (ITAU-F) serão entregues no card seguinte.

- **Integração Cora**: a conexão real está implementada e usa mTLS com certificado + chave privada, mas **não foi testada contra a API real da Cora por falta de credenciais**. O token, a emissão, a consulta e a simulação de pagamento foram verificados apenas contra um simulador HTTP local nos testes de integração.
- **Uma conta Cora por instalação**: `CORA_CLIENT_ID`/`CORA_CERT_FILE`/`CORA_KEY_FILE` são variáveis de ambiente do servidor, portanto uma única conta Cora serve a todas as escolas (tenants) da instalação. Suporte a múltiplas contas por tenant exigiria armazenar certificados no banco (fora do escopo deste card).
- **Webhook**: a documentação oficial da Cora não descreve assinatura de webhook. A solução atual aceita um token secreto configurável na URL ou cabeçalho como medida provisória, documentada como Limitação MVP.
- **Emissão de boleto/Pix**: pela documentação da Cora, `customer.address` é opcional (quando enviado, todos os campos são exigidos). O sistema envia o endereço do cadastro do aluno quando completo; a documentação tem divergências (tabela × OpenAPI) sobre campos obrigatórios, a confirmar no primeiro teste com credenciais de Stage.

## 6. Backlog de mercado (não prometido como pronto)

1. Emissão real via PSP (Cora/Asaas/Itaú) preenchendo `gateway_invoice_id` (Itaú especificado na §8)  
2. Boleto registrado + PDF 2ª via  
3. Disparo omnicanal real da régua  
4. NFS-e ABRASF / provedor municipal  
5. Aging de contas a pagar (AP), conciliação bancária automática CNAB retorno (aging AR operacional implementado)  
6. Estorno/cancelamento fiscal de fatura paga  
7. Cartão recorrente operacional  

## 7. Mapa de código (frontend)

Organização após o refactor B12 (só moveu código, sem mudança de regra):

- `frontend/src/components/FinanceiroSection.tsx` orquestra: estado, carregamento, handlers (incluindo `handleOFXUpload`) e abas. Concentra todas as chamadas `apiFetch` do Financeiro.
- `frontend/src/components/financeiro/` só exibe, via props: abas (`ReceberPanel`, `PagarPanel`, `FornecedoresPanel`, `CobrancaPanel`, `NfsePanel`, `BiPanel`), modais (`NovaFaturaModal`, `NovaDespesaModal`, `NovoFornecedorModal`, `PixModal`) e `types.ts`. O `PixModal` do Financeiro é independente do `portal_aluno/PixModal.tsx`.

## 8. Integração Itaú: Bolecode + Pix + webhooks (planejada)

> **Estado: implementado (ITAU-A a F), não operacional.** Backend: assistente de conexão, emissão de Bolecode, cancelamento e webhooks de boleto e Pix com fila assíncrona. Frontend: assistente em Integrações (`ItauIntegrationCard.tsx`), emissão e modal do Bolecode em Contas a Receber (`FinanceiroSection.tsx`, `ReceberPanel.tsx`, `BoletoItauModal.tsx`) e 2ª via no Portal da Família (`FinanceiroTab.tsx`, `PixModal.tsx`). Testado contra simulador HTTP local e em `ITAU_MODE=mock`; homologação com sandbox e produção depende de credenciais reais. Fonte: documentação do Itaú for Developers copiada em `docs/reference/itau/` (specs OpenAPI em `openapi/`, visões gerais em `visao-geral/`, guias em `guias/`), extraída em 2026-10-20. Itens marcados **(a confirmar)** dependem do primeiro teste com credenciais reais ou do gerente Itaú.

### 8.1 Objetivo e escopo

Emitir a cobrança oficial de uma fatura como **Bolecode** (boleto registrado com QR Code Pix na mesma emissão) e dar baixa automática quando a família paga, por código de barras ou por Pix.

- **Dentro**: assistente de configuração na tela com segredos cifrados no banco, autenticação (OAuth2 + mTLS), emissão de Bolecode, consulta do boleto, baixa (cancelamento) do boleto quando a fatura é cancelada, webhook de boleto, webhook Pix e conferência antes da baixa.
- **Fora (fases futuras)**: Pix Automático (`itau-ng7-api-pixautomatico-v1-externo`), Pix avulso `cob`/`cobv` sem boleto, alteração de vencimento/juros/desconto de boleto já emitido, protesto/negativação, conciliação por francesa/extrato, devolução de Pix, SISPAG (contas a pagar), renovação do certificado sem clique.
- **Não usar**: as APIs marcadas "EM DESATIVAÇÃO" no portal (`itau-ep9-gtw-pix-recebimentos-ext-v2`, `itau-ep9-gtw-pix-recebimentos-conciliacoes-v2-ext`). O Pix padrão Bacen é `itau-ep9-api-regulatorio-pix-v2-externo`.

### 8.2 Pré-requisitos fora do sistema (passos manuais da escola)

Sem estes itens o modo `production` não funciona; a UI deve dizer isso, sem copy de "pronto para produção".

1. Conta PJ Itaú com **convênio de cobrança, carteira 109** (`id_beneficiario` = agência 4 + conta 7 + DAC 1, 12 dígitos).
2. **Modalidade Boleto com Pix habilitada** pelo atendimento Itaú (a doc diz que o cliente precisa pedir a inclusão).
3. **Chave Pix** da escola (de preferência o CNPJ) vinculada à conta.
4. **Credenciais de produção**: a escola envia ao Analista de Operações Itaú a chave pública de transporte mostrada pelo assistente (8.3.1) e recebe por e-mail os valores cifrados (chave de sessão, client_id e token temporário), que cola no assistente. O sistema gera o **certificado dinâmico** e recebe o `client_secret`, que o Itaú entrega uma única vez (guia `guias/certificado-dinamico.md`).
5. **URL pública HTTPS** para os webhooks; o webhook Pix exige **mTLS** (o servidor que recebe precisa confiar na CA do Itaú, ver 8.7).

### 8.3 Modos e configuração

- Variável `ITAU_MODE` = `mock` (padrão) | `sandbox` | `production`, independente de `CORA_MODE`. Valor inválido derruba a inicialização com mensagem clara (mesmo padrão da Cora).
- **mock**: nenhuma chamada externa; a emissão devolve dados simulados e a UI mostra o selo "Simulado".
- **sandbox**: usa as URLs de sandbox do portal (ex.: `https://sandbox.devportal.itau.com.br/itau-ep9-api-recebimentos-v1-externo/v1`). O sandbox do Itaú é um serviço virtualizado com respostas de exemplo **(a confirmar se valida regras de negócio)**; serve para testar formato, não para homologar regra.
- **production**: hosts de produção, ex.: Bolecode `https://pix-pj.api.itau.com/recebimentos-pix/v1`, Pix `https://pix-pj.api.itau.com/regulatorio-pix/v2` **(a confirmar o host do Pix: a spec usa `pix-pj.${env}`)**, gestão de boletos `https://api.gateway.itau.com.br/cash_management/v2`.
- **Credenciais do Itaú ficam no banco, cifradas, configuradas pelo assistente da tela** (8.3.1), não em variáveis de ambiente. No servidor fica só a chave mestra de cifragem (`APP_SECRETS_KEY`) e o `ITAU_MODE`. Diferente da Cora, que segue com `CORA_*` no ambiente até migrar para o mesmo modelo.
- Dados por escola (tenant), em `tenant_bank_integrations` com `gateway_name = 'itau'`: `id_beneficiario`, chave Pix, espécie padrão, multa e juros padrão, situação do cadastro dos webhooks e validade do certificado (só a data, para exibir). Os segredos ficam em tabela própria (8.3.1). Exige migration nova com RLS; nunca editar migration aplicada.
- **Adapter**: o trait `BankGateway` atual é tipado para a Cora (`CoraCreateInvoiceRequest`, `CoraMode`). O Itaú entra como adapter próprio (ex.: `services/itau_api.rs`, com mock e cliente real), sem forçar os tipos da Cora; generalizar o trait é refactor à parte.
- **Decisão (2026-10-20, usuário): fase 1 com uma conta Itaú por instalação, e uma escola por servidor/container.** Assim a conta Itaú é, na prática, a da escola. Credenciais e dados da cobrança são configurados pela escola na tela, pelo assistente (8.3.1). O modelo multi-tenant (RLS, `TenantDb`, rotas `:tenant_id`) é mantido, com um único tenant por instalação. Se um dia várias escolas, com contas diferentes, dividirem o mesmo servidor, será preciso guardar certificado + chave privada por tenant (cifrados) ou usar o fluxo de **parceiro homologado Itaú**, em que o Itaú envia ao parceiro `client_id`/`client_secret` da escola quando ela consente nos canais do banco (webhook de "novo consentimento", `visao-geral/itau-ep9-api-recebimentos-v1-externo.md`).

### 8.3.1 Assistente de conexão e guarda de segredos

**Decisão (2026-10-20, usuário):** a escola configura o Itaú por um assistente na tela de Integrações. As chaves privadas são **geradas no servidor e nunca saem dele**; nenhum arquivo de chave passa pelo navegador.

**Passos do assistente** (só a gestão: `admin`/`gestor`, como na Cora; cada passo grava `audit_logs` com tenant, usuário, ação e horário, sem valores secretos):

1. **Dados da cobrança**: agência, conta e DAC (formam o `id_beneficiario`, validado com 12 dígitos), chave Pix, espécie padrão, multa e juros padrão. Pode ser salvo antes das credenciais.
2. **Chave de transporte**: o servidor gera um par RSA 2048 e mostra a **chave pública** (PEM) com botão de copiar e a orientação de enviá-la ao Analista de Operações Itaú. A chave privada de transporte fica cifrada no banco. Gerar de novo invalida a anterior (com confirmação).
3. **Valores do e-mail do Itaú**: o admin cola a chave de sessão cifrada, o client_id cifrado e o token temporário cifrado. O servidor:
   - decifra a chave de sessão com a chave privada de transporte (RSA) e, com ela, o client_id e o token (AES-256-CBC, IV zero, como no guia);
   - gera a **chave do certificado** (RSA 2048) e o CSR SHA-512 com `CN=<client_id>`, `OU=<razão social da escola>`, `L`, `ST` e `C=BR`;
   - chama `POST https://sts.itau.com.br/seguranca/v1/certificado/solicitacao` com `Bearer <token temporário>` e o CSR em `text/plain`;
   - grava, cifrados, o certificado, a chave do certificado, o client_id e o `client_secret` devolvido. O token temporário e a chave de sessão não são guardados; a chave de transporte é apagada depois do sucesso.
   Erro em qualquer etapa não grava nada pela metade e mostra a causa em linguagem simples (ex.: "token temporário expirado: peça um novo ao Itaú").
4. **Testar conexão**: pede um token OAuth com o certificado novo e mostra "Conectado" ou o erro. Só depois disso o botão de ativar fica disponível.
5. **Registrar avisos de pagamento**: cadastra os webhooks de boleto (8.6) e Pix (8.7), gerando as credenciais do webhook de boleto. Mostra a situação de cada um.

**Sandbox**: o portal cria credenciais de sandbox na página "API reference" de cada API. Pelo FAQ do Itaú (`guias/suportefaq.md`), o sandbox **não exige certificado**: basta client_id + client_secret de sandbox e um token (validade 5 min), que só vale para URLs de sandbox. Em `ITAU_MODE=sandbox` o assistente aceita client_id e client_secret colados, sem certificado nem chave de transporte. O endpoint de token do sandbox varia entre as páginas do portal (`sts.rdhi.com.br/api/oauth/token`, `api.itau.com.br/sandbox/api/oauth/token`) **(a confirmar no primeiro teste)**. O sandbox devolve respostas simuladas e não chama nossos webhooks.

**Renovação do certificado**: a partir de 30 dias antes do vencimento a tela mostra "Renovar certificado". O servidor gera chave e CSR novos e chama `POST /seguranca/v1/certificado/renovacao` com o certificado atual (mTLS) e um token válido do STS **(a confirmar qual token o Itaú aceita)**. O certificado antigo só é substituído depois do sucesso. Renovação automática sem clique fica para fase futura.

**Guarda dos segredos:**
- Tabela nova, ex.: `tenant_gateway_secrets` (`tenant_id`, `gateway_name`, `tipo`: `transporte_chave` | `cert` | `cert_chave` | `client_id` | `client_secret` | `webhook_client_secret_hash`, `ciphertext`, `nonce`, `key_version`, `created_at`, `created_by`), com RLS `ENABLE` + `FORCE` + política por `tenant_id`.
- Cifragem **AES-256-GCM** com nonce aleatório por valor e a chave mestra `APP_SECRETS_KEY` (32 bytes em hex, 64 caracteres; gerar com `openssl rand -hex 32`) do ambiente; os dados associados (AAD) da cifra amarram cada valor a `tenant_id` + `gateway_name` + `tipo`, para um valor copiado para outra linha não decifrar; `key_version` permite trocar a chave mestra recifrando os valores. O secret do webhook de boleto é gerado pelo sistema e guardado só como hash.
- Sem `APP_SECRETS_KEY` o backend sobe normalmente, mas o assistente e a emissão Itaú respondem com mensagem clara ("chave de cifragem não configurada no servidor"), nunca guardam segredo em claro.
- Segredos **nunca** voltam em resposta de API, nunca vão para log ou `audit_logs`, e só são decifrados em memória no momento da chamada ao Itaú. A API devolve apenas presença (sim/não), client_id mascarado e a validade do certificado.
- Perder a `APP_SECRETS_KEY` torna os segredos ilegíveis: a escola refaz o assistente. Isso precisa constar no guia de instalação, junto com o backup da chave.

### 8.4 Autenticação no Itaú

- Token: `POST https://sts.itau.com.br/as/token.oauth2`, `grant_type=client_credentials`, com **mTLS** (certificado dinâmico + chave privada). O token vale **300 s**; o cliente guarda em cache e renova antes de vencer (ex.: aos 240 s). **(A confirmar)**: a spec de `cash_management` declara `tokenUrl` `https://sts.itau.com.br/api/oauth/token`; usar o do guia e validar no primeiro teste.
- Toda chamada leva `Authorization: Bearer <token>`, a mesma conexão mTLS e `x-itau-correlationID` (UUID por requisição, gravado no log da operação). Algumas rotas pedem também `x-itau-apikey` = `client_id`.
- Escopos do Bolecode: `cob.write`, `cobv.write`, `payments/pix.read`. Webhook Pix: `webhook.read`/`webhook.write`. Consulta Pix: `pix.read`.
- **Certificado dinâmico**: validade de 365 dias, renovável de 30 dias antes até 1 dia antes do vencimento (`POST https://sts.itau.com.br/seguranca/v1/certificado/renovacao` com novo CSR). A tela mostra a data de expiração lida do certificado, alerta quando faltarem menos de 30 dias e oferece a renovação por clique (8.3.1).
- **Confiança TLS de saída**: o host antigo `secure.api.itau` usa a raiz GlobalSign Root R3; o novo `pix-pj.itau.com` usa Amazon Root CA 1. O cliente HTTP precisa confiar nas duas raízes.

### 8.5 Emissão do Bolecode

`POST /api/v1/financeiro/faturas/:id/itau` (papéis `admin`/`financeiro`), análogo ao endpoint da Cora. Chama `POST /boletos-pix` do Itaú.

**Validação antes de enviar (nada é enviado se falhar; erro 400 com orientação, nunca valor inventado):**
- Pagador: nome (até 100), CPF (11) ou CNPJ (14) do responsável financeiro (ou legal), como na Cora.
- **Endereço completo é obrigatório no Itaú** (diferente da Cora): logradouro com número/complemento (até 150), bairro (100), cidade (100), UF (2 letras maiúsculas), CEP (8 dígitos).
- **Caracteres**: o Itaú recusa colchetes, dois-pontos, `<`, `>`, `&`, `;`, aspas simples e duplas, crase, parênteses, `#`, `*`, `/`, `|` e palavras como `http`/`javascript`. Os campos de texto só aceitam letras (com os acentos listados na spec), números, espaço, `-`, `.` e `,`. O sistema normaliza (remove os proibidos, troca acentos fora da lista) e mostra no erro o campo que não pôde ser corrigido.
- Valor e datas na fatura; vencimento não pode estar no passado.

**Mapeamento fatura → Bolecode:**

| Campo Itaú | Origem |
|---|---|
| `etapa_processo_boleto` | `efetivacao` (o sistema pode usar `simulacao` para validar sem emitir) |
| `beneficiario.id_beneficiario` | configuração da escola |
| `dado_boleto.descricao_instrumento_cobranca` | `boleto_pix` |
| `dado_boleto.tipo_boleto` | `a vista` |
| `dado_boleto.codigo_carteira` | `109` |
| `dado_boleto.codigo_especie` | `04` (ME, Mensalidade Escolar) para parcelas de contrato; avulsa usa o padrão configurado **(a confirmar com o gerente)** |
| `dado_boleto.codigo_tipo_vencimento` | `3` (data informada) |
| `dados_individuais_boleto[0].numero_nosso_numero` | sequência própria por escola, 8 dígitos; não pode repetir enquanto o boleto estiver ativo ou nos 45 dias após baixa/liquidação |
| `dados_individuais_boleto[0].texto_seu_numero` | identificador curto da fatura (até 10, letras/números) |
| `dados_individuais_boleto[0].data_vencimento` / `valor_titulo` | `faturas.data_vencimento` / `faturas.valor` (string `\d+\.\d{2}`) |
| `multa` | `codigo_tipo_multa = 02` + `percentual_multa` = `faturas.multa_percentual` (formato `\d+\.\d{5}`); `03` (isento) se zero |
| `juros` | `codigo_tipo_juros = 90` (percentual mensal) + `percentual_juros` = `faturas.juros_mora_mes_percentual`; `05` (isento) se zero |
| `desconto` | `codigo_tipo_desconto = 00`: o desconto de grupo familiar já vem aplicado no valor da parcela |
| `recebimento_divergente` | `03` (não aceita valor diferente) |
| `dados_qrcode.chave` / `tipo_cobranca` | chave Pix da escola / `cob` |

**Resposta e persistência:**
- `200`: grava `gateway_name='itau'`, `gateway_invoice_id` = `id_boleto_individual`, `gateway_digitable_line` = `numero_linha_digitavel`, `gateway_pix_code` = `dados_qrcode.emv`, e em colunas novas `codigo_barras`, `nosso_numero` e `gateway_txid` = `dados_qrcode.txid` (começa com `BL`). O QR (`base64`) não é guardado; a UI gera a imagem a partir do EMV.
- `202` ("operação em andamento"): a fatura fica com emissão pendente; o sistema consulta o boleto depois (API de detalhe, `itau-ep9-gtw-boletoscash-boletoscash-v2-ext-aws`) até obter linha digitável e EMV, sem emitir de novo.
- `400`/`422`: devolve ao usuário a mensagem do Itaú traduzida por campo; nada é gravado como emitido.
- **Idempotência**: o Itaú não documenta header de idempotência no Bolecode. Repetição é evitada pelo `nosso_numero` único: se a fatura já tem `nosso_numero`, o sistema consulta em vez de emitir; se o Itaú recusar por número duplicado, consulta o existente.
- Fatura já emitida devolve a emissão existente; fatura paga devolve 409; `ITAU_MODE=mock` devolve dados simulados marcados como tal.
- **QR após o vencimento**: o Bolecode usa `cob` (Pix imediato). Pix agendado exige `cobv` e adesão à parte; o comportamento do QR depois do vencimento (expira ou cobra encargos) é **(a confirmar)**. Até lá a UI avisa que, vencido, o pagamento deve ser pelo código de barras.

**Cancelamento**: ao cancelar uma fatura emitida no Itaú, o sistema pede `PATCH /boletos/{id_boleto}/baixa` (`cash_management/v2`). Se o Itaú recusar, a fatura não é cancelada e o erro aparece.

### 8.6 Webhook de boleto (pagamento por código de barras)

Cobre boletos e Bolecodes **pagos pelo código de barras**.

- **Cadastro**: ao ativar a integração, o sistema chama `POST /notificacoes_boletos` (`boletos/v3`) com `webhook_url` = `https://<host>/webhooks/itau/:tenant_id/boletos`, `webhook_oauth_url` = `https://<host>/webhooks/itau/:tenant_id/oauth/token`, `webhook_client_id`/`webhook_client_secret` **gerados pelo sistema** para aquela escola, `valor_minimo = 0.00` e `tipos_notificacoes = [BAIXA_OPERACIONAL, BAIXA_EFETIVA]`.
- **Autenticação**: o Itaú primeiro pede um token OAuth2 (client credentials) no nosso `webhook_oauth_url` e depois chama o `webhook_url` com `Bearer`. O sistema implementa esse emissor de token: guarda só o hash do secret, compara em tempo constante, emite token curto (ex.: 5 min) e responde em JSON (a doc avisa: JSON, não HTML).
- **Payload**: lista `boletos[]`, um evento por chamada, com `idBoleto`, `numeroNossoNumero`, `tipoLiquidacao` (`06` liquidação normal, `95` baixa operacional), `tipoCobranca` (`boleto`/`bolecode`), `valorPagoTotalCobranca`, `valorCreditado`, `dataInclusaoPagamento`, `dataCredito`.
- **Regra de baixa**: `BAIXA_EFETIVA` (liquidação, `06`) dá baixa na fatura, com `valorPagoTotalCobranca` como valor pago. `BAIXA_OPERACIONAL` só registra "pagamento informado" em `webhook_events` e `audit_logs`, sem mudar o status. A fatura é localizada por `gateway_invoice_id`/`nosso_numero` do tenant da rota.

### 8.7 Webhook Pix (Bolecode pago pelo QR)

- **Cadastro**: `PUT /webhook/{chave}` (`regulatorio-pix/v2`) com a chave Pix da escola e `webhookUrl` = `https://<host>/webhooks/itau/:tenant_id`. O Itaú **acrescenta `/pix`**, então a rota recebida é `/webhooks/itau/:tenant_id/pix`. Pix recebido por agência/conta digitada não é notificado.
- **Autenticação**: **mTLS**. O Itaú apresenta certificado de cliente emitido pela CA dele (pacote `ca_cert` no portal); o proxy reverso ou o load balancer que termina o TLS precisa exigir e validar esse certificado. Em AWS o DNS deve ser registro A/AAAA, não CNAME. Isso é requisito de infraestrutura, não do backend.
- **Payload**: lista `pix[]` com `endToEndId`, `txid`, `valor`, `horario` e, em cobrança com vencimento, `componentesValor`. A fatura é localizada pelo `txid` (`BL…`) gravado na emissão **(a confirmar no primeiro teste que o Pix do Bolecode chega por este webhook com esse txid)**.
- **Prazo de resposta**: até **5 s**. O backend grava o aviso e responde 200; a confirmação e a baixa rodam fora da requisição.

### 8.8 Regras comuns aos dois webhooks

- Rotas públicas sem usuário logado: abrem a conexão com `crate::db::acquire_tenant(&state.pool, tenant_id)`, nunca `state.pool` direto. Ao implementar, incluir `webhooks_itau.rs` na lista de exceções do `AGENTS.md`.
- **Nenhum aviso dá baixa sozinho.** Mesmo com OAuth (boleto) ou mTLS (Pix), o sistema confirma no Itaú antes: Pix via `GET /pix/{e2eid}`; boleto via consulta do boleto (situação paga). O valor usado na conferência é o da consulta.
- Idempotência e anti-replay em `webhook_events` com `gateway_name = 'itau'` e `event_id` = `endToEndId` (Pix) ou `idBoleto:tipoLiquidacao:dataInclusaoPagamento` (boleto).
- Como o aviso é confirmado depois de responder, ele fica gravado como pendente e é reprocessado até ser confirmado ou dar erro definitivo. Diferente da Cora, não dá para depender de um novo aviso: o Itaú não reenvia o que já recebeu 200.
- Baixa, registro do evento e `audit_logs` numa única transação com RLS, como no webhook da Cora. Valor divergente gera `audit_logs` (`acao = 'webhook_valor_divergente'`) sem baixar.
- Juros/multa pagos a mais por atraso não são divergência: o valor esperado considera os encargos calculados para a data do pagamento.

### 8.9 UI

- Aba Integrações: cartão "Itaú" com liga/desliga, modo (Simulado / Teste / Produção, vindo do `ITAU_MODE`), o assistente da 8.3.1 em 6 passos, credenciais presentes (sim/não), client_id mascarado, validade do certificado com botão de renovar e situação dos dois webhooks. Ativar só fica disponível depois do teste de conexão bem-sucedido. Em `mock` o cartão avisa que nada é enviado ao banco. A configuração é da gestão (`admin`/`gestor`, mesma regra do `rbac::eh_gestao` e da Cora); os demais papéis não veem a aba Integrações.
- Fatura: botão "Emitir boleto Itaú" (quando ativo) orquestrado no `FinanceiroSection.tsx` (padrão B12), abrindo modal `BoletoItauModal` com linha digitável, Pix copia e cola, QR e código de barras; botão vira "Ver boleto Itaú" quando já emitido; tratamento de 202 com aviso de emissão em andamento e modal com badge "Simulado" em modo mock.
- Portal da família: a 2ª via mostra o Bolecode quando a fatura foi emitida no Itaú (`gateway_name === 'itau'` e linha digitável presente), senão mantém o Pix local com o aviso atual.
- Chamadas novas de API entram no `FinanceiroSection.tsx` (padrão B12).

### 8.10 Testes exigidos na implementação

- Montagem do payload a partir da fatura (multa/juros/isento, formatos `\d+\.\d{2}` e `\d+\.\d{5}`, normalização de caracteres, endereço incompleto recusado).
- Respostas 200, 202 e 422 do Itaú contra um simulador HTTP local, como os testes da Cora.
- Webhooks: token OAuth inválido, evento repetido, aviso não confirmado na consulta, valor divergente, `BAIXA_OPERACIONAL` sem baixa, isolamento entre tenants.
- Assistente e segredos: decifrar valores no formato do guia (chave de sessão RSA + AES-256-CBC, IV zero) com dados de teste gerados no próprio teste; CSR com o `CN` certo; cifra e decifra com AES-256-GCM; nenhum segredo em resposta de API, log ou `audit_logs`; falha no meio do fluxo não grava nada; sem `APP_SECRETS_KEY` a configuração é recusada; papel não admin recebe 403.

### 8.11 Limitações conhecidas (para a seção 5 quando implementar)

- Validado só contra simulador e sandbox até haver credenciais de produção.
- Uma conta Itaú por instalação (decisão da 8.3): o modelo é uma escola por servidor; se mais de uma escola for cadastrada no mesmo servidor, todas recebem na mesma conta.
- Renovação do certificado por clique (365 dias); sem renovação automática.
- Segredos dependem da `APP_SECRETS_KEY`: perdê-la obriga a refazer o assistente.
- **QR Code não é escaneável**: o modal do Bolecode e a 2ª via do portal mostram um ícone de QR, como o Pix local já fazia; o projeto não tem biblioteca de QR. O pagamento por Pix funciona pelo copia e cola. Gerar o QR real a partir do EMV exige uma dependência nova no frontend.
- **Papel `financeiro` não vê o botão do Itaú**: a tela decide pelo estado da integração (`GET /tenant/integrations/itau`), que só a gestão lê; a rota de emissão aceita o financeiro. Mesmo comportamento da Cora.
- O botão de emitir só aparece em fatura pendente e ainda não vencida (o Itaú recusa vencimento no passado).
- Sem conciliação de segurança (francesa/extrato) para avisos perdidos: um webhook que falhar todas as tentativas só é recuperado manualmente.