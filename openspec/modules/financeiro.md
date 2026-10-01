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
| 2ª via Pix no portal da família | Implementado |
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

Abas: Faturas | Despesas | Fornecedores | NFS-e | DRE & DFC | Integrações.  
Portal da família: Mensalidades (2ª via Pix).

## 5. Backlog de mercado (não prometido como pronto)

1. Emissão real via PSP (Cora/Asaas) preenchendo `gateway_invoice_id`  
2. Boleto registrado + PDF 2ª via  
3. Disparo omnicanal real da régua  
4. NFS-e ABRASF / provedor municipal  
5. Aging de cobrança e AP, CNAB retorno  
6. Estorno/cancelamento fiscal de fatura paga  
7. Cartão recorrente operacional  
