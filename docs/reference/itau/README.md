# Referência Itaú for Developers

Cópia local da documentação do devportal do Itaú, extraída em 2026-10-20 para planejar a integração de boleto/Pix no módulo Financeiro. **Não é fonte de verdade do projeto** (essa é `openspec/modules/financeiro.md`); serve para consulta ao escrever a spec e o adapter.

- `openapi/<slug>.json`: spec OpenAPI 3.0 oficial de cada API (CDN público do Itaú). `openapi/_index.json` lista título, versão, servidores e rotas.
- `visao-geral/<slug>.md`: aba "visão geral" de cada API (exige login no portal; exportada com `exportar-visoes-gerais.console.js`).
- `guias/*.md`: guias públicos de conexão (certificado dinâmico, credenciais, primeira chamada, expiração de certificados, FAQ).

## APIs por uso no Escolar

| Uso | Slug |
|---|---|
| Emissão principal: boleto + QR Pix (Bolecode) | `itau-ep9-api-recebimentos-v1-externo` |
| Instruções no boleto (vencimento, desconto, baixa) e consulta | `itau-ep9-gtw-cash-management-ext-v2` |
| Francesa e notificações de boleto | `itau-ep9-gtw-boletos-boletos-v3-ext-aws` |
| Ciclo de vida de boletos (alternativa nova) | `itau-ep9-api-boleto-v1-externo` |
| Detalhe do boleto | `itau-ep9-gtw-boletoscash-boletoscash-v2-ext-aws` |
| Extrato/conciliação da carteira de cobrança | `itau-ep9-api-extrato-v1-externo` |
| Pix padrão Bacen (cob, cobv, webhook, devolução) | `itau-ep9-api-regulatorio-pix-v2-externo` |
| Consulta de lançamentos Pix | `itau-ep9-api-conciliacao-v1-externo` |
| Pix Automático (recorrência) | `itau-ng7-api-pixautomatico-v1-externo`, `itau-ep9-api-qrcode-pix-automatico-v1-externo` |
| Extrato da conta corrente | `itau-vw9-api-account-statement-v1-externo` |
| Pagamentos (SISPAG), só para contas a pagar | `itau-ep9-gtw-sispag-ext` |
| **Não usar** (em desativação) | `itau-ep9-gtw-pix-recebimentos-ext-v2`, `itau-ep9-gtw-pix-recebimentos-conciliacoes-v2-ext` |
| Fora do escopo | `itau-ep9-api-saque-troco-v1-externo` |

## Atualizar

1. Specs e guias: os links do CDN mudam a cada versão. Pegue o `openApiDownloadLink` de cada API na página logada e baixe de novo.
2. Visões gerais: no Chrome, logado, abra qualquer página `nossas-apis/...`, cole `exportar-visoes-gerais.console.js` no console e converta o JSON baixado.

Os `client_secret`/`access_token` que aparecem nos textos são exemplos da própria documentação; nunca coloque credenciais reais nesta pasta.
