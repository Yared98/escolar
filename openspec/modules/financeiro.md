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
| Gateway Cora / Asaas / Pagar.me | Config + webhook Cora; emissão via API mock / desconectada |
| Boleto registrado Febraban / cartão recorrente | Não operacional |
| CNAB 240/400 | Ausente |
| Plano de contas | Schema apenas |

## 1. Faturamento & meios de pagamento

- **Parcelamento na matrícula**: ao assinar contrato (`POST /secretaria/contratos/:id/assinar`), gera até 12 faturas Pix com vencimento dia 10, aplicando `grupos_familiares.desconto_percentual` quando houver. Reexecução bloqueada se o contrato já tiver parcelas. Também disponível via `POST /financeiro/faturas/gerar-parcelas`.
- **Fatura avulsa**: `POST /financeiro/faturas` com desconto, multa (% padrão 2) e juros ao mês (% padrão 1).
- **Pix**: payload EMVCo + CRC16 local (`gerar_pix_emvco`). Chave sintética do tenant — **não** é cobrança de PSP.
- **Boleto**: linha digitável sintética Febraban para demonstração — **não** registrada em banco.
- **Cartão recorrente**: apenas valor de enum; sem gateway.
- **Webhook Gateway Cora**: `/webhooks/cora/:tenant_id` e `/api/webhooks/cora/:tenant_id`. Validação de assinatura HMAC-SHA256 em tempo constante (`subtle::ConstantTimeEq`), tolerância de timestamp (5 min em modo `t_v1`), idempotência e anti-replay via tabela `webhook_events` com RLS por tenant (`UNIQUE (tenant_id, gateway_name, event_id)`), e validação do valor pago com criação de registro em `audit_logs` (`acao = 'webhook_valor_divergente'`) em caso de divergência sem baixar a fatura. Formato da assinatura configurável via `CORA_WEBHOOK_SIGNATURE_FORMAT=hex|t_v1` (padrão `hex`, pendente de confirmação final na documentação oficial da Cora: https://developers.cora.com.br).
- **Demais contratos REST** (GET/PUT/DELETE faturas; despesas; estorno; banking settings): mantidos.

Campos relevantes em `faturas`: `contrato_id`, `parcela_numero`/`parcela_total`, `valor_original`, `desconto_percentual`, `multa_percentual`, `juros_mora_mes_percentual`, `gateway_*` (quando houver PSP).

## 2. Régua de cobrança

- `POST /financeiro/cobranca/regua`: classifica D-5…D-1, D-0 e D+; marca `atrasado`; calcula multa + juros pro-rata; grava `regua_cobranca_logs` com `status_envio = registrado`.
- **Limite**: não envia WhatsApp/e-mail reais; worker de fila não está ligado a este endpoint.
- `GET /financeiro/cobranca/logs`: últimos 100 disparos.

## 3. Conciliação, NFS-e e DRE

- **Conciliação** `POST /financeiro/conciliacao/processar`: aceita lote JSON; se `fatura_id`/`despesa_id` omitidos, tenta match por valor (±0,02) e proximidade de vencimento. OFX via upload na UI de DRE. Sem CNAB.
- **NFS-e** `POST /financeiro/nfse/emitir` + `GET /financeiro/nfse`: persistência de emissão **simulada** (não transmite à prefeitura).
- **DRE/DFC** `GET /financeiro/relatorios/dre`: receita de faturas pagas, despesas (exceto cancelado/estornada), inadimplência (atrasado + pendente vencido), DFC = resultado + 40% da inadimplência. Relatório gerencial, não contábil.

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

## 5. Backlog de mercado (não prometido como pronto)

1. Emissão real via PSP (Cora/Asaas) preenchendo `gateway_invoice_id`  
2. Boleto registrado + PDF 2ª via  
3. Disparo omnicanal real da régua  
4. NFS-e ABRASF / provedor municipal  
5. Aging de contas a pagar (AP), conciliação bancária automática CNAB retorno (aging AR operacional implementado)  
6. Estorno/cancelamento fiscal de fatura paga  
7. Cartão recorrente operacional  

## 6. Mapa de código (frontend)

Organização após o refactor B12 (só moveu código, sem mudança de regra):

- `frontend/src/components/FinanceiroSection.tsx` orquestra: estado, carregamento, handlers (incluindo `handleOFXUpload`) e abas. Concentra todas as chamadas `apiFetch` do Financeiro.
- `frontend/src/components/financeiro/` só exibe, via props: abas (`ReceberPanel`, `PagarPanel`, `FornecedoresPanel`, `CobrancaPanel`, `NfsePanel`, `BiPanel`), modais (`NovaFaturaModal`, `NovaDespesaModal`, `NovoFornecedorModal`, `PixModal`) e `types.ts`. O `PixModal` do Financeiro é independente do `portal_aluno/PixModal.tsx`.