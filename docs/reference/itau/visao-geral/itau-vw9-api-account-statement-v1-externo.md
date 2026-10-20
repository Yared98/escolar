# API ACCOUNT STATEMENT (v1.27.0)

Fonte: https://devportal.itau.com.br/nossas-apis/itau-vw9-api-account-statement-v1-externo (aba visão geral, atualizada em 2026-09-30T01:11:33.000Z)
Sandbox: https://sandbox.devportal.itau.com.br/itau-vw9-api-account-statement-v1-externo/v1
Spec: ../openapi/itau-vw9-api-account-statement-v1-externo.json

---



## **sobre a API**

ACCOUNT STATEMENT API
Bem-vindo a documentação da API do Extrato de Contas.
Aqui você irá encontrar os guias de utilização dos serviços para consultar as movimentações financeiras de sua conta.
Em caso de problemas com estas APIs, entre em contato: implantacaotecnica@itau-unibanco.com.br

## **para quem é esta API?**

Esta API é destinada à utilização pelos clientes do Banco Itaú e parceiros comerciais habilitados e permissionados a consultar extrato, saldo de suas contas e informações sobre seus rendimentos de aplicações automáticas.

## **restrições de uso**

- A aplicação consumidora precisa estar cadastrada no **Itaú for Developers (Developer Portal)**, com o produto **Account Statement** habilitado e o **certificado dinâmico ativo**.
- Todas as chamadas usam **HTTPS com mTLS** (certificado emitido no portal) e **token OAuth 2.0**.
- SLA, SLO, TPS e demais limites são definidos em contrato e no termo de adesão. Consulte seu gerente de conta.

## **conhecimentos técnicos necessários**
Conhecimentos prévios necessários:

`HTTP` `JSON` `OAuth 2.0 (client_credentials)` `mTLS / certificado digital` `Postman ou cURL`

## **quais necessidades que essa API ajuda a resolver?**

| preciso... | use |
| --- | --- |
| Conciliar lançamentos de suas movimentações financeiras, com filtros, agrupamentos e paginação | `GET /statements/{statementId}` |
| Saber o saldo atual das contas de forma rápida | `GET /balances` |
| Obter detalhes dos seus rendimentos em aplicações automáticas | `GET /statements/{statementId}/interest-bearing-accounts` |
| Consultar bloqueios judiciais da conta | `GET /statements/{statementId}/judicial-orders` |
| Consultar a posição de investimentos da conta | `GET /statements/{statementId}/investment-balances` |

## **tempo aproximado para integração**
**1 dia:** essa é a média de tempo que um desenvolvedor pode levar para preparar toda a integração com essa API. Isso pode variar de acordo com o tamanho do time e experiência dos desenvolvedores envolvidos.

## **como funciona a integração**

```text
   sua aplicação                     Itaú
        |                              |
        |  1. POST /api/oauth/token    |   credencial (Client ID + Client Secret)
        |----------------------------->|   + certificado (mTLS)
        |  <---- access_token -------- |
        |                              |
        |  2. GET /account-statement/v1/...   Authorization: Bearer <token>
        |----------------------------->|      x-itau-correlationid: <uuid>
        |  <---- 200 / 206 / erro ---- |
```

Resumindo: você **gera um token** com a credencial da sua aplicação e o certificado, e usa esse token em cada chamada da API.

## **antes de começar: acessos no Itaú for Developers**

A integração só funciona depois que a sua empresa configurou os acessos no portal. Esse passo é feito uma única vez, por pessoas com perfis específicos:

| perfil | quem é | o que faz |
| --- | --- | --- |
| **Owner** | Representante legal ou pessoa delegada da empresa | Configura os primeiros acessos pelo Internet Banking PJ/BBA e aprova ações sensíveis (dupla alçada) |
| **Admin** | Responsável técnico | Cria aplicações, gera credenciais, solicita certificados e convida usuários |
| **Developer** | Pessoa desenvolvedora | Acesso de leitura: consulta aplicações, credenciais e documentação |

**Passo a passo (feito uma vez pela sua empresa):**

1. **Owner** acessa o Internet Banking PJ/BBA em *Início > Conta Corrente > Configurar Produtos e Serviços > Integrações e Acessos a APIs* e convida as pessoas com perfil **Admin** ou **Developer** (CPF, nome completo, e-mail, celular e perfil).
2. A pessoa convidada recebe um e-mail com senha temporária, acessa o portal, informa e-mail e CPF e cria a senha definitiva. Nos acessos seguintes, o login pede e-mail, CPF, senha e um código de verificação enviado por e-mail.
3. **Admin** cria a **aplicação**, seleciona o produto **Account Statement** e, se desejar, restringe os IPs de origem.
4. **Admin** cria a **credencial** e guarda o **Client ID** e o **Client Secret** em local seguro — o Client Secret é exibido apenas uma vez.
5. **Admin** solicita a aprovação do **Owner** (dupla alçada, feita pelo Internet Banking) e então emite o **certificado**. Os certificados têm validade de 365 dias e podem ser renovados a partir de 30 dias antes do vencimento.

Com Client ID, Client Secret e certificado em mãos, você já pode fazer a primeira chamada.

## **URLs**
Para garantir uma integração segura, as funcionalidades da API estão disponíveis nas seguintes URLs:

Endpoints da API:

| ambiente    | endpoint                                                        |
| ----------- | --------------------------------------------------------------- |
| homologação | https://account-statement.api.hom.itau.com/account-statement/v1 |
| produção    | https://account-statement.api.itau.com/account-statement/v1     |

Geração do token de autorização:

| ambiente    | endpoint                                 |
| ----------- | ---------------------------------------- |
| homologação | https://sts.rdhi.com.br/api/oauth/token  |
| produção    | https://sts.itau.com.br/api/oauth/token  |

## **Tutorial**

Confira o passo a passo para realizar as requisições:

1. **Setup no portal:** sua empresa cria a aplicação, habilita o produto Account Statement, gera a credencial e emite o certificado (veja *antes de começar*);
2. **Autenticação:** gere o token OAuth 2.0 no endpoint de token do ambiente que você vai usar;
3. **Monte o `statementId`:** agência + conta + DAC identificam a conta consultada;
4. **Faça a chamada:** envie o token e o `x-itau-correlationid` em todas as requisições;
5. **Percorra as páginas:** use `pagination.links` para consultar períodos com muitos lançamentos;
6. **Trate erros e respostas parciais:** interprete os códigos HTTP e o `206 Partial Content`.

## **Autenticação**

O acesso à API usa **OAuth 2.0 com `client_credentials`** e **mTLS**: a chamada ao endpoint de token é feita com o certificado emitido no Itaú for Developers e com a credencial (Client ID e Client Secret) da aplicação. O token retornado autoriza apenas os produtos habilitados para aquela aplicação. Os endpoints de extrato, rendimentos, ordens judiciais e saldos usam o escopo `account-statement-account-statement.read`; o endpoint de posição de investimentos usa `account-statement.investment.read`.

### Oauth2

| ambiente    | endpoint de token                        |
| ----------- | ---------------------------------------- |
| homologação | https://sts.rdhi.com.br/api/oauth/token  |
| produção    | https://sts.itau.com.br/api/oauth/token  |

**[POST] ../api/oauth/token**

Entrada:

| Parâmetro       | Tipo de parâmetro | Tipo de dado | Obrigatório | Descrição |
| --------------- | ----------------- | ------------ | ----------- | --------- |
| `Content-Type`  | header            | string       | sim         | `application/x-www-form-urlencoded` |
| `grant_type`    | body              | string       | sim         | `client_credentials` |
| `client_id`     | body              | string       | sim         | Client ID da credencial criada no portal |
| `client_secret` | body              | string       | sim         | Client Secret da credencial (exibido apenas uma vez na criação) |

Saída:

| Parâmetro      | Tipo de dado | Descrição |
| -------------- | ------------ | --------- |
| `access_token` | string       | Token a ser enviado no header `Authorization` das chamadas da API |
| `token_type`   | string       | Tipo do token (`Bearer`) |
| `expires_in`   | number       | Tempo de vida do token, em segundos |

cURL de exemplo:

```bash
curl -X POST "https://sts.itau.com.br/api/oauth/token" \
  --cert certificado.crt --key certificado.key \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=SEU_CLIENT_ID" \
  -d "client_secret=SEU_CLIENT_SECRET"
```

Exemplo de saída:

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 300
}
```

Boas práticas:

- Você pode reutilizar o token até a expiração (`expires_in`), em vez de gerar um novo a cada chamada;
- Nunca versione Client Secret, certificado ou token no seu repositório.

## **Montando o `statementId`**

O `statementId` identifica a conta e é formado por **agência (4 dígitos) + conta (7 dígitos) + DAC (1 dígito)**, sem separadores:

```text
Ag. 1500  +  CC. 0123456  +  DAC 7   =>   statementId = 150001234567
```

## **Fazendo a primeira chamada**

Consulta do extrato de um período:

```bash
curl -X GET \
  "https://account-statement.api.itau.com/account-statement/v1/statements/150001234567?type=current_account&start_date=2024-04-01&end_date=2024-04-30&page=1&page_size=8000" \
  --cert certificado.crt --key certificado.key \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "x-itau-correlationid: 0c33344a-7d1c-41c8-8a0d-80e791f69cf8"
```

Dois cabeçalhos são obrigatórios em **todos** os endpoints:

| cabeçalho | descrição |
| --- | --- |
| `Authorization` | `Bearer <access_token>` obtido na autenticação |
| `x-itau-correlationid` | UUID **gerado por você a cada requisição**; é a chave usada pelo suporte para rastrear a chamada. Guarde-o nos seus logs |

Deu certo? Você recebeu um `200` com a lista de lançamentos. A partir daqui, use a referência abaixo para explorar filtros, paginação e os demais endpoints.

## **Paginação**

O extrato e as ordens judiciais são paginados. No endpoint de extrato, use `page` e `page_size`; para períodos com muitos lançamentos, prefira `page_size=8000`, o valor máximo permitido. Isso reduz a quantidade de requisições: uma consulta com 9.109 lançamentos gera 92 páginas com `page_size=100`, 46 páginas com `page_size=200` e apenas 2 páginas com `page_size=8000`.

Use sempre os links retornados em `pagination.links` (`first`, `previous`, `next`, `last`) para avançar. Encerre a consulta quando `next` vier vazio ou quando `page` for igual a `total_pages`. **Nunca solicite uma página maior que `total_pages`**: se a resposta informar 5 páginas, não consulte a página 6, pois a API responderá `422 Unprocessable Entity`.

```json
"pagination": {
  "links": {
    "first": "/statements/150000999999?end_date=2026-06-26&page=1&type=current_account&start_date=2023-01-01&page_size=8000",
    "last": "/statements/150000999999?end_date=2026-06-26&page=2&type=current_account&start_date=2023-01-01&page_size=8000",
    "previous": "",
    "next": "/statements/150000999999?end_date=2026-06-26&page=2&type=current_account&start_date=2023-01-01&page_size=8000"
  },
  "page": 1,
  "total_pages": 2,
  "total_elements": 9109,
  "page_size": 8000
}
```

## **Endpoints**

A seguir estão listados os endpoints disponíveis na Account Statement API, com suas respectivas finalidades, parâmetros de entrada, exemplos de requisição e respostas esperadas. Cada endpoint deve ser chamado com o token de autenticação obtido no fluxo OAuth2 e o identificador de correlação para rastreabilidade.

### **[GET] /statements/{statementId}**

Retorna os lançamentos do período, os saldos do dia e, opcionalmente, os lançamentos pendentes. Endpoint indicado para quem deseja consultar a movimentação financeira detalhada de uma conta corrente ou poupança dentro de um intervalo de datas específico.

Entrada:

| Parâmetro              | Tipo de parâmetro | Tipo de dado  | Obrigatório | Padrão     | Descrição |
|------------------------| ----------------- | ------------- | ----------- | ---------- | --------- |
| `Authorization`        | header            | string        | sim         |            | Token Bearer obtido no fluxo de autorização |
| `x-itau-correlationid` | header            | string (UUID) | sim         |            | Identificador único aleátorio gerado pelo cliente para cada transação que permite referenciar uma transação ou cadeia de eventos. Exemplo: `0c33344a-7d1c-41c8-8a0d-80e791f69cf8` |
| `Accept-Encoding`      | header            | string        | não         |            | O cabeçalho de requisição HTTP Accept-Encoding indica qual codificação de conteúdo, usualmente um algoritmo de compressão, o cliente está apto a entender. Exemplo: `gzip` |
| `statementId`          | path              | string        | sim         |            | Número da conta para obter o extrato. Exemplo: statementsId = Agência(4 dígitos) + Conta Corrente(7 dígitos) + DAC(1 dígito) -> 1500(Ag) + 0123456(CC) + 7(DAC) = `150001234567` |
| `type`                 | query             | string        | sim         |            | Tipo de conta: `current_account` ou `savings_account` |
| `start_date`           | query             | string        | sim         |            | Data inicial da consulta (`yyyy-MM-dd`) |
| `end_date`             | query             | string        | não         | data atual | Data final da consulta (`yyyy-MM-dd`) |
| `page`                 | query             | number        | não         | 1          | Número da página |
| `page_size`            | query             | number        | não         | 10         | Quantidade de itens por página (máximo: `8000`; recomendado para grandes períodos) |
| `filter_by`            | query             | string        | não         |            | Filtro por campos permitidos do conteúdo. Exemplo: `[{"property":"literal.complete","operand":"in","value":"PIX"}]` |
| `show_pending_events`  | query             | boolean       | não         | false      | Habilita o retorno dos lançamentos pendentes |

cURL de exemplo:

```bash
curl --request GET \
  --url 'https://account-statement.api.itau.com/account-statement/v1/statements/150001234567?type=current_account&start_date=2024-04-01&end_date=2024-04-30&page=1&page_size=8000&show_pending_events=true' \
  --cert certificado.crt --key certificado.key \
  --header 'Authorization: Bearer {token}' \
  --header 'x-itau-correlationid: 0c33344a-7d1c-41c8-8a0d-80e791f69cf8'
```

Exemplo de saída (`Http Status Code 200 OK`):

```json
{
      "data": [
        {
          "events": [
            {
              "id": "104e2ce6-4b1d-3fba-adf0-694fde806773",
              "type": "lancamento",
              "operation": "C",
              "reversal": false,
              "date": {
                "event": "2024-04-25T02:59:00Z",
                "accounting": "2024-04-24"
              },
              "literal": {
                "code": "9507",
                "shortened": "SISPAG PIX PIX",
                "complete": "SISPAG PIX PIX"
              },
              "amount": {
                "value": 500.00,
                "currency": "BRL"
              },
              "counterpart": {
                "type": "CONTA_CORRENTE",
                "ispb": "00000000",
                "agency": "0001",
                "account": "0123456",
                "digit": "7",
                "name": "BRUNO E. S. FRAUCHES",
                "institution": "BCO DO BRASIL S.A",
                "document": "***.456.789-**",
                "person": "FISICA"
              },
              "origin": {
                "identifier": "E01234567890123456789DY5FWG9GYPM",
                "type": "PIX",
                "operation": "PIX_EMISSAO",
                "channel": "7E",
                "complement": "INFORMED COMPLEMENT"
              }
            }
          ],
          "balances": [
            {
              "type": "saldo_disponivel",
              "date": {
                "event": "2024-06-24T23:59:59.999999999-03:00"
              },
              "literal": {
                "shortened": "SALDO TOTAL DISPONÍVEL DIA",
                "complete": "SALDO TOTAL DISPONÍVEL DIA"
              },
              "amount": {
                "value": 63.97,
                "currency": "BRL"
              }
            }
          ],
          "pending_events": [
            {
              "id": "fc6a592f-8107-3e50-95bd-590e8449dc90",
              "type": "lancamento_pendente",
              "operation": "C",
              "date": {
                "event": "2026-04-30T05:31:14.991Z",
                "accounting": "2026-05-04"
              },
              "literal": {
                "code": "0229",
                "shortened": "RECEBIMENTO CONVENIOS",
                "complete": "RECEBIMENTO CONVENIOS"
              },
              "amount": {
                "value": 550404.49,
                "currency": "BRL"
              }
            },
            {
              "id": "8746d613-b129-30fa-8978-b8fa4979b1c2",
              "type": "lancamento_pendente",
              "operation": "C",
              "date": {
                "event": "2026-04-30T05:29:58.297Z",
                "accounting": "2026-05-04"
              },
              "literal": {
                "code": "0244",
                "shortened": "RECBTO CONVENIOS DEB AUT",
                "complete": "RECBTO CONVENIOS DEB AUT"
              },
              "amount": {
                "value": 590560.01,
                "currency": "BRL"
              }
            }
          ]
        }
      ],
      "pagination": {
        "links": {
          "first": "/statements/150000999999?end_date=2026-06-26&page=1&type=current_account&start_date=2023-01-01&page_size=8000",
          "last": "/statements/150000999999?end_date=2026-06-26&page=2&type=current_account&start_date=2023-01-01&page_size=8000",
          "previous": "",
          "next": "/statements/150000999999?end_date=2026-06-26&page=2&type=current_account&start_date=2023-01-01&page_size=8000"
        },
        "page": 1,
        "total_pages": 2,
        "total_elements": 9109,
        "page_size": 8000
      }
    }
```

Campos principais do lançamento (`events`):

| campo | descrição |
| --- | --- |
| `id` | identificador do lançamento |
| `operation` | `C` para crédito, `D` para débito |
| `reversal` | indica estorno |
| `date.event` / `date.accounting` | data/hora do evento e data contábil |
| `literal` | código e descrição do lançamento (veja a tabela de literais no fim desta página) |
| `amount` | valor e moeda |
| `counterpart` | dados da contraparte, quando disponíveis |
| `origin` | origem do lançamento (ex.: PIX, TED) |

**Comportamento esperado — HTTP 206 Partial Content**

Quando a API de lançamentos pendentes está indisponível, o endpoint retorna o status **206 Partial Content**. Nesse caso, os dados de extrato e saldo são retornados normalmente, mas o campo `pending_events` será preenchido com uma mensagem de erro indicando a indisponibilidade do serviço.

```json
"pending_events": [
  {
    "error": "Service Unavailable"
  }
]
```

### **[GET] /statements/{statementId}/interest-bearing-accounts**

Retorna os detalhes dos rendimentos da aplicação automática (APLIC AUT) da conta no período minimo de d-2. Recurso destinado a consultar o histórico de rendimentos obtidos com a aplicação automática dos recursos disponíveis em conta corrente.

Entrada:

| Parâmetro             | Tipo de parâmetro | Tipo de dado  | Obrigatório | Padrão     | Descrição |
|-----------------------| ----------------- | ------------- | ----------- | ---------- | --------- |
| `Authorization`       | header            | string        | sim         |            | Token de autorização Bearer |
| `x-itau-correlationid` | header            | string (UUID) | sim         |            | Identificador único aleátorio gerado pelo cliente para cada transação que permite referenciar uma transação ou cadeia de eventos.  Exemplo:`0c33344a-7d1c-41c8-8a0d-80e791f69cf8` |
| `statementId`         | path              | string        | sim         |            | Número da conta para obter o extrato. Exemplo: statementsId = Agência(4 dígitos) + Conta Corrente(7 dígitos) + DAC(1 dígito) -> 1500(Ag) + 0123456(CC) + 7(DAC) = `150001234567` |
| `start_date`          | query             | string        | sim         |            | Data inicial (`yyyy-MM-dd`) |
| `end_date`            | query             | string        | não         | data atual | Data final (`yyyy-MM-dd`) |

cURL de exemplo:

```bash
curl --request GET \
  --url 'https://account-statement.api.itau.com/account-statement/v1/statements/150001234567/interest-bearing-accounts?start_date=2024-05-01&end_date=2024-05-31' \
  --cert certificado.crt --key certificado.key \
  --header 'Authorization: Bearer {token}' \
  --header 'x-itau-correlationid: 0c33344a-7d1c-41c8-8a0d-80e791f69cf8'
```

Exemplo de saída (`Http Status Code 200 OK`):

```json
{
  "data": [
    {
      "date": "2024-05-01",
      "grossAmountValue": "22700.62",
      "netAmountValue": "22699.66",
      "grossIncome": "1.83",
      "ir": "0.23",
      "iof": "0.73"
    },
    {
      "date": "2024-05-02",
      "grossAmountValue": "201148.88",
      "netAmountValue": "201063.46",
      "grossIncome": "138.39",
      "ir": "15.24",
      "iof": "70.18"
    }
  ]
}
```

### **[GET] /statements/{statementId}/judicial-orders**

Retorna as ordens judiciais (bloqueios) associadas à conta no período. Endpoint utilizado para consultar as restrições e bloqueios de origem judicial que possam impactar a disponibilidade dos recursos da conta informada no statementId durante o intervalo consultado.

Entrada:

| Parâmetro              | Tipo de parâmetro | Tipo de dado  | Obrigatório | Padrão     | Descrição |
|------------------------| ----------------- | ------------- | ----------- | ---------- | --------- |
| `Authorization`        | header            | string        | sim         |            | Token de autorização Bearer |
| `x-itau-correlationid` | header            | string (UUID) | sim         |            | Identificador único aleátorio gerado pelo cliente para cada transação que permite referenciar uma transação ou cadeia de eventos.  Exemplo:`0c33344a-7d1c-41c8-8a0d-80e791f69cf8` |
| `statementId`          | path              | string        | sim         |            | Número da conta para obter o extrato. Exemplo: statementsId = Agência(4 dígitos) + Conta Corrente(7 dígitos) + DAC(1 dígito) -> 1500(Ag) + 0123456(CC) + 7(DAC) = `150001234567` |
| `start_date`           | query             | string        | sim         |            | Data inicial (`yyyy-MM-dd`) |
| `end_date`             | query             | string        | não         | data atual | Data final (`yyyy-MM-dd`) |
| `page`                 | query             | number        | não         | 1          | Número da página |

Destaques da resposta: `blockOrderValue` é o valor solicitado na ordem e `blockEffectiveValue` é o valor efetivamente bloqueado; `blockStatus` indica a situação da ordem.

cURL de exemplo:

```bash
curl --request GET \
  --url 'https://account-statement.api.itau.com/account-statement/v1/statements/150001234567/judicial-orders?start_date=2026-01-29&end_date=2026-02-04&page=1' \
  --cert certificado.crt --key certificado.key \
  --header 'Authorization: Bearer {token}' \
  --header 'x-itau-correlationid: 0c33344a-7d1c-41c8-8a0d-80e791f69cf8'
```

Exemplo de saída (`Http Status Code 200 OK`):

```json
{
  "data": [
    {
      "blockOrderId": "000120263333333001000010000",
      "originCode": 1,
      "protocolNumber": "20263333333001",
      "sequenceCode": 1,
      "reiterationCode": 0,
      "documentNumber": "82557600000110",
      "personType": "F",
      "defendantName": "NOME REU NÃO ENCONTRADO",
      "blockDate": "2026-02-02",
      "officialNumber": "00047462820258260003",
      "processNumber": "00047462820258260003",
      "actionType": "TIPO DE AÇÃO NÃO DEFINIDA",
      "courtCode": 43610,
      "courtName": " ",
      "courtState": " ",
      "courtPhoneNumber": ,
      "districtName": "  -",
      "judgeName": "JOÃO DA SILVA",
      "tribunalName": " ",
      "requestingParty": " ",
      "blockType": "VALOR",
      "blockStatus": "CUMPRIDA",
      "blockOrderValue": 150000.00,
      "blockEffectiveValue": 150000.00,
      "blockObservation": " "
    },
    {
      "blockOrderId": "000120263333333002000010000",
      "originCode": 1,
      "protocolNumber": "20263333333002",
      "sequenceCode": 1,
      "reiterationCode": 0,
      "documentNumber": "82557600000110",
      "personType": "F",
      "defendantName": "NOME REU NÃO ENCONTRADO",
      "blockDate": "2026-02-02",
      "officialNumber": "00047462820258260003",
      "processNumber": "00047462820258260003",
      "actionType": "TIPO DE AÇÃO NÃO DEFINIDA",
      "courtCode": 43610,
      "courtName": " ",
      "courtState": " ",
      "courtPhoneNumber": null,
      "districtName": "  -",
      "judgeName": "JOÃO DA SILVA",
      "tribunalName": " ",
      "requestingParty": " ",
      "blockType": "VALOR",
      "blockStatus": "CUMPRIDA",
      "blockOrderValue": 150000.00,
      "blockEffectiveValue": 150000.00,
      "blockObservation": " "
    }
  ],
  "pagination": {
    "links": {
      "first": "/statements/150000999999/judicial-orders?start_date=2026-01-29&end_date=2026-02-04&page=1",
      "last": "/statements/150000999999/judicial-orders?start_date=2026-01-29&end_date=2026-02-04&page=1",
      "previous": "",
      "next": "/statements/150000999999/judicial-orders?start_date=2026-01-29&end_date=2026-02-04&page=2"
    },
    "page": 1,
    "total_pages": 1,
    "total_elements": 2,
    "page_size": 10
  }
}
```

### **[GET] /balances**

Retorna os saldos das contas às quais a credencial tem acesso. Não recebe parâmetros além dos cabeçalhos obrigatórios. Permite obter, de forma consolidada, os saldos disponíveis das contas relacionadas à credencial de autenticação utilizada na chamada.

Entrada:

| Parâmetro             | Tipo de parâmetro | Tipo de dado  | Obrigatório | Descrição |
|-----------------------| ----------------- | ------------- | ----------- | --------- |
| `Authorization`       | header            | string        | sim         | Token de autorização Bearer |
| `x-itau-correlationid` | header            | string (UUID) | sim         | Identificador único aleátorio gerado pelo cliente para cada transação que permite referenciar uma transação ou cadeia de eventos.  Exemplo:`0c33344a-7d1c-41c8-8a0d-80e791f69cf8` |

Tipos de saldo retornados: `saldo_disponivel`, `saldo_total`, `saldo_bloqueado` e `saldo_aplic_aut`.

cURL de exemplo:

```bash
curl --request GET \
  --url 'https://account-statement.api.itau.com/account-statement/v1/balances' \
  --cert certificado.crt --key certificado.key \
  --header 'Authorization: Bearer {token}' \
  --header 'x-itau-correlationid: 0c33344a-7d1c-41c8-8a0d-80e791f69cf8'
```

Exemplo de saída (`Http Status Code 200 OK`):

```json
{
  "data": [
    {
      "balances": [
        {
          "type": "saldo_disponivel",
          "amount": { "value": 100.00, "currency": "BRL" },
          "date": { "event": "2026-06-12T10:00:33.211-03:00" },
          "literal": { "shortened": "saldo_disponivel", "complete": "SALDO EM CONTA" }
        },
        {
          "type": "saldo_total",
          "amount": { "value": 100.00, "currency": "BRL" },
          "date": { "event": "2026-06-12T10:00:33.211-03:00" },
          "literal": { "shortened": "saldo_total", "complete": "SALDO TOTAL" }
        },
        {
          "type": "saldo_bloqueado",
          "amount": { "value": 0.00, "currency": "BRL" },
          "date": { "event": "2026-06-12T10:00:33.211-03:00" },
          "literal": { "shortened": "saldo_bloqueado", "complete": "SALDO BLOQUEADO" }
        },
        {
          "type": "saldo_aplic_aut",
          "amount": { "value": 0.00, "currency": "BRL" },
          "date": { "event": "2026-06-12T10:00:33.211-03:00" },
          "literal": { "shortened": "saldo_aplic_aut", "complete": "SALDO APLIC. AUT." }
        }
      ],
      "statementId": "150000999999"
    }
  ],
  "summary": [
    {
      "type": "saldo_disponivel",
      "amount": { "value": 100.00, "currency": "BRL" },
      "date": { "event": "2026-06-12T10:00:33.211-03:00" },
      "literal": { "shortened": "saldo_disponivel", "complete": "SALDO EM CONTA" }
    },
		{
			"type": "saldo_total",
			"amount": {"value": 100.00, "currency": "BRL" },
			"date": { "event": "2026-06-12T10:00:33.211-03:00" },
			"literal": { "shortened": "saldo_total", "complete": "SALDO TOTAL" }
		},
		{
			"type": "saldo_bloqueado",
			"amount": {"value": 0.00, "currency": "BRL" },
			"date": { "event": "2026-06-12T10:00:33.211-03:00" },
			"literal": { "shortened": "saldo_bloqueado", "complete": "SALDO BLOQUEADO" }
		},
		{
			"type": "saldo_aplic_aut",
			"amount": { "value": 0.00, "currency": "BRL"},
			"date": { "event": "2026-06-12T10:00:33.211-03:00"},
			"literal": { "shortened": "saldo_aplic_aut", "complete": "SALDO APLIC. AUT."}
		}
	]
}
```

**Comportamento esperado — HTTP 206 Partial Content**

Quando a API de saldos está indisponível ou ocorre um erro ao carregar a informação de alguma conta, o endpoint retorna o status **206 Partial Content**. Nesse caso, os dados de saldo são retornados normalmente, mas a conta com erro será preenchido com uma mensagem indicando a indisponibilidade do serviço.

```json
{
	"data": [
		{
			"error": {
				"error": "Serviço indisponível"
			},
			"statementId": "150000999997"
		},
		{
			"error": {
				"error": "Serviço indisponível"
			},
			"statementId": "150000999998"
		},
		{
			"error": {
				"error": "Serviço indisponível"
			},
			"statementId": "150000999999"
		}
	],
	"summary": []
}
```

### **[GET] /statements/{statementId}/investment-balances**

Retorna a posição de investimentos da conta em uma data. Recurso utilizado para consultar a consolidação dos investimentos e aplicações financeiras vinculadas à conta informada, considerando a posição existente em uma data de referência fornecida na requisição.

Entrada:

| Parâmetro              | Tipo de parâmetro | Tipo de dado  | Obrigatório | Descrição |
| ---------------------- | ----------------- | ------------- | ----------- | --------- |
| `Authorization`        | header            | string        | sim         | Token de autorização Bearer |
| `x-itau-correlationid` | header            | string (UUID) | sim         | Identificador único aleátorio gerado pelo cliente para cada transação que permite referenciar uma transação ou cadeia de eventos.  Exemplo:`0c33344a-7d1c-41c8-8a0d-80e791f69cf8` |
| `statementId`          | path              | string        | sim         | Número da conta para obter o extrato. Exemplo: statementsId = Agência(4 dígitos) + Conta Corrente(7 dígitos) + DAC(1 dígito) -> 1500(Ag) + 0123456(CC) + 7(DAC) = `150001234567` |
| `date`                 | query             | string        | sim         | A data da consulta deve ser de, no mínimo, dois dias úteis atrás (`yyyy-MM-dd`) |

cURL de exemplo:

```bash
curl --request GET \
  --url 'https://account-statement.api.itau.com/account-statement/v1/statements/150001234567/investment-balances?date=2026-05-19' \
  --cert certificado.crt --key certificado.key \
  --header 'Authorization: Bearer {token}' \
  --header 'x-itau-correlationid: 0c33344a-7d1c-41c8-8a0d-80e791f69cf8'
```

Exemplo de saída (`Http Status Code 200 OK`):

```json
{
  "data": [
    {
      "balances": [
        {
          "balanceLastUpdateDate": "2026-05-20T03:49:36",
          "balanceReferenceDate": "2026-05-19",
          "operationLockupDate": "2026-04-27",
          "totalAssetQuantity": 126722.000000000000000,
          "incomeTaxRatePercentage": 22.50,
          "assetClassName": "Post-fixed",
          "customerIdentificationCode": "4923-99415-8",
          "operationStartDate": "2026-04-27",
          "assetReferenceDate": "2026-05-19",
          "operationMaturityDate": "2028-04-27",
          "issuerName": "Itau",
          "corporatePlanCompanyName": "Itau Treasury",
          "custodyLocationName": "Itau Treasury",
          "investmentProductName": "CDB-DI",
          "formattedInvestmentProductName": "CDB-DI ITAU CDI 97.00 04/2028",
          "grossProductValue": 1277133.86,
          "financialOperationTaxValue": 2577.60,
          "incomeTaxValue": 1650.65,
          "netValue": 1272905.61,
          "unitPriceValue": 10.07823320,
          "contractedRateValue": 97.00
        }
      ],
      "consolidation": {
        "pricingType": 1,
        "total": {
          "totalGrossValue": 4279446.01,
          "totalFinancialOperationTaxValue": 10024.89,
          "totalIncomeTaxValue": 2767.74,
          "totalNetValue": 4266653.38,
          "totalContractedRateValue": 194.00,
          "availableAssetQuantity": 425712.000000000000000,
          "blockedAssetQuantity": 0.000000000000000,
          "totalAssetQuantity": 425712.000000000000000
        }
      }
    }
  ]
}
```

## **padrões de erros**

Essa API retorna códigos de status HTTP para indicar sucesso ou falhas das requisições.

Códigos **2xx** indicam sucesso.

Códigos **4xx** indicam falhas causadas pelas informações enviadas pelo cliente ou pelo estado atual das entidades.

Códigos **5xx** indicam problemas no serviço no lado da API.

As respostas de erro incluem no corpo detalhes do erro e o campo type identifica o tipo de erro.

Abaixo estão listados os tipos de erro que podem ser retornados por quaisquer endpoints listados nessa documentação.
HTTP Status Code | Descrição | Significado |  O que fazer
-------- | -------- | -------- | ------ |
| 206 | Partial Content | Parte da informação não pôde ser obtida | Use os dados retornados e reconsulte a parte faltante |
| 400 | Bad Request |Requisição contém dados inválidos | Revise parâmetros obrigatórios e formatos de data |
| 401 | Unauthorized | Credencial Inativa ou Token ausente, inválido ou expirado | Verifique se a sua credencial esta ativa e/ou gere um novo token |
| 403 | Forbidden | Acesso proibido | Verifique se a conta que esta tentando acessar esta liberada para esta credencial ou verifique se esta acessando de um IP autorizado |
| 404 | Not Found | Recurso não encontrado | Confira o `statementId` (agência + conta + DAC) |
| 422 | Unprocessable Entity | Erro semântico na requisição | Revise filtros e período e confirme se `page` não ultrapassa `pagination.total_pages` |
| 500 | Internal Server Error | Erro interno | Repita a chamada; se persistir, acione o suporte com o `x-itau-correlationid` |
| 503 | Service Unavailable | Serviço indisponível | Repita a chamada; se persistir, acione o suporte com o `x-itau-correlationid` |

## **Boas práticas**

- gere um `x-itau-correlationid` novo por requisição e registre-o nos seus logs: ele é o que permite ao suporte rastrear a chamada;
- você pode reaproveitar o token até ele expirar;
- em consultas de extrato com muitos lançamentos, use `page_size=8000` para reduzir a quantidade de requisições;
- avance por `pagination.links.next` e interrompa a consulta quando o link vier vazio ou `page` atingir `total_pages`; nunca consulte páginas além desse limite;
- se ainda necessário, divida intervalos muito grandes em períodos menores;
- implemente retentativa com backoff exponencial para `500` e `503`;
- trate o `206` como sucesso parcial, sem descartar os dados recebidos;
- armazene Client Secret e certificado em cofre de segredos, nunca no código.

## **Perguntas frequentes**

**Como monto o `statementId`?** Agência (4 dígitos) + conta (7 dígitos) + DAC (1 dígito), sem separadores. Ex.: Ag. 1500, CC. 0123456, DAC 7 → `150001234567`.

**Recebi 401 mesmo com token válido.** Verifique se está enviando o certificado (mTLS) e se o token foi gerado no mesmo ambiente da chamada (homologação x produção).

**Recebi 403.** O produto pode não estar habilitado para a aplicação, o certificado pode estar vencido ou o IP de origem pode estar fora da lista autorizada no portal.

**Meu extrato está incompleto.** Confira `pagination.total_pages` e percorra as páginas por `pagination.links.next`. Para grandes períodos, use `page_size=8000` para reduzir a quantidade de chamadas.

**Por que recebi 422 ao buscar a próxima página?** Verifique a paginação da última resposta. Se `page` já for igual a `total_pages` ou `pagination.links.next` estiver vazio, a consulta terminou; solicitar uma página posterior gera `422`.

**Como consulto lançamentos ainda não efetivados?** Envie `show_pending_events=true` no endpoint de extrato.

**Como filtro apenas lançamentos PIX?** Use `filter_by`, por exemplo `[{"property":"literal.complete","operand":"in","value":"PIX"}]`.

## **Suporte**

- dúvidas de integração técnica: implantacaotecnica@itau-unibanco.com.br
- contrato, limites e habilitação de produtos: seu gerente de conta
- ao abrir um chamado, informe ambiente, endpoint, horário da chamada e o `x-itau-correlationid`

---

##  **About API**
ACCOUNT STATEMENT API

The Itaú **Account Statement API** lets your application retrieve, in real time, the financial movements (statement), balances, interest-bearing account (APLIC AUT) income and judicial orders of your company's accounts at Itaú.

Questions or problems: implantacaotecnica@itau-unibanco.com.br

## **Who is this API for?**

Banco Itaú corporate customers and commercial partners qualified and permitted to consult statements, balances, interest-bearing account income and judicial orders for the accounts they have access to.

## **Use restrictions**

The consumer application must be registered on the **Itaú for Developers portal**, with the Account Statement product enabled and an active dynamic certificate. All calls use HTTPS with mTLS and an OAuth 2.0 token. SLA, SLO, TPS and other limits are defined in the contract and membership term.

## **Before you start**

Your company configures access once on the Itaú for Developers portal:

1. The **Owner** (legal representative or delegate) invites **Admin** and **Developer** users through Internet Banking PJ/BBA.
2. The **Admin** creates the application, selects the Account Statement product and optionally restricts source IPs.
3. The **Admin** creates the credential (**Client ID** and **Client Secret** — the secret is shown only once).
4. The **Admin** requests **Owner** approval (dual control) and issues the **certificate** (valid for 365 days, renewable from 30 days before expiration).

## **URLs**

| environment | endpoint                                                        |
| ----------- | --------------------------------------------------------------- |
| sandbox     | https://account-statement.api.hom.itau.com/account-statement/v1 |
| production  | https://account-statement.api.itau.com/account-statement/v1     |

Token generation:

| environment | endpoint                                 |
| ----------- | ---------------------------------------- |
| sandbox     | https://sts.rdhi.com.br/api/oauth/token  |
| production  | https://sts.itau.com.br/api/oauth/token  |

## **Step 1 — get an access token**

```bash
curl -X POST "https://sts.itau.com.br/api/oauth/token" \
  --cert certificate.crt --key certificate.key \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"
```

## **Step 2 — build the `statementId`**

Branch (4 digits) + account (7 digits) + check digit (1 digit), with no separators: branch 1500, account 0123456, check digit 7 → `150001234567`.

## **Step 3 — make your first call**

```bash
curl -X GET \
  "https://account-statement.api.itau.com/account-statement/v1/statements/150001234567?type=current_account&start_date=2024-04-01&end_date=2024-04-30&page=1&page_size=8000" \
  --cert certificate.crt --key certificate.key \
  -H "Authorization: Bearer <access_token>" \
  -H "x-itau-correlationid: 0c33344a-7d1c-41c8-8a0d-80e791f69cf8"
```

`Authorization` and `x-itau-correlationid` (a UUID you generate per request) are required on every endpoint.

## **Pagination**

For statement queries with many transactions, use `page_size=8000`, the maximum allowed value, to reduce the number of requests. For example, 9,109 transactions require 92 pages with `page_size=100`, 46 with `page_size=200`, but only 2 with `page_size=8000`.

Follow `pagination.links.next` and stop when it is empty or when `page` equals `total_pages`. Never request a page greater than `total_pages`: if the response reports 5 pages, requesting page 6 results in `422 Unprocessable Entity`.

## **Endpoints**

| endpoint | description | main parameters |
| --- | --- | --- |
| `GET /statements/{statementId}` | account statement with events, balances and optional pending events | `type` (required), `start_date` (required), `end_date`, `page`, `page_size`, `statement_type`, `filter_by`, `show_pending_events` |
| `GET /statements/{statementId}/interest-bearing-accounts` | interest-bearing account (APLIC AUT) income | `start_date` (required), `end_date` |
| `GET /statements/{statementId}/judicial-orders` | judicial orders (blocks) on the account | `start_date` (required), `end_date`, `page` |
| `GET /balances` | current balances for the accounts the credential can access | — |
| `GET /statements/{statementId}/investment-balances` | investment position of the account on a given date | `date` (required) |

Response payloads are identical to the Portuguese examples above.

## **Expected behavior — HTTP 206 Partial Content**

When part of the information cannot be retrieved (pending events or the balance of a given account), the API answers **206 Partial Content**: the available data is returned and the missing part carries an `error` field. Treat `206` as a partial success and re-query only what is missing.

## **Error patterns**

| HTTP Status | Meaning | What to do |
| --- | --- | --- |
| 206 Partial Content | Part of the data is unavailable | Use the returned data and re-query the missing part |
| 400 Bad Request | Request contains invalid data | Check required parameters and date formats |
| 401 Unauthorized | 
Inactive credential or missing, invalid or expired token | Check if your credential is active and/or generate a new token |
| 403 Forbidden | Access denied | Check if the account you are trying to access is authorized for this credential or verify if you are accessing from an authorized IP address. |
| 404 Not Found | Resource not found | Check the `statementId` |
| 422 Unprocessable Entity | Semantic error | Review filters and period, and confirm that `page` does not exceed `pagination.total_pages` |
| 500 Internal Server Error | Internal error | Retry; if it persists, contact support with the `x-itau-correlationid` |
| 503 Service Unavailable | Service unavailable | Retry with exponential backoff |

## **Best practices**

- Generate a new `x-itau-correlationid` per request and log it.
- You may reuse the token until it expires.
- For statement queries with many transactions, use `page_size=8000` to reduce the number of requests.
- Advance through `pagination.links.next` and stop when it is empty or `page` reaches `total_pages`; never request pages beyond that limit.
- If still necessary, split very large date ranges into smaller periods.
- Retry `500`/`503` with exponential backoff.
- Keep the Client Secret and certificate in a secrets vault.

---

## **Literais / Literals**

Tabela de códigos (`literal.code`) e suas descrições, usados nos lançamentos do extrato.

<details>
  <summary>ver tabela completa de literais</summary>

| Code   | Shortened                     | Complete                      |
|--------|-------------------------------|-------------------------------|
| 7549   | SISPAG FORNECEDORES           | SISPAG FORNECEDORES           |
| 9575   | TED                           | TED                           |
| 980    | SISPAG                        | SISPAG                        |
| 4330   | LIQUIDACAO SELIC              | LIQUIDACAO SELIC              |
| 7694   | SISPAG TRANSF TITUL TED       | SISPAG TRANSF TITUL TED       |
| 8512   | APL APLIC AUT MAIS            | APL APLIC AUT MAIS            |
| 8516   | RES APLIC AUT MAIS            | RES APLIC AUT MAIS            |
| 7707   | SISPAG FORNECEDORES TED       | SISPAG FORNECEDORES TED       |
| 9508   | PIX TRANSF                    | PIX TRANSF                    |
| 9592   | APLICACAO COMPROMISSADA       | APLICACAO COMPROMISSADA       |
| 7833   | MOV TIT COB DISP              | MOV TIT COB DISP              |
| 7538   | TED                           | TED                           |
| 5383   | RESGATE                       | RESGATE                       |
| 8990   | COBR IBBA                     | COBR IBBA                     |
| 3738   | SISPAG TRANSF TITULARID       | SISPAG TRANSF TITULARID       |
| 9593   | RESGATE COMPROMISSADA         | RESGATE COMPROMISSADA         |
| 7480   | SISPAG TRIBUTOS               | SISPAG TRIBUTOS               |
| 7089   | FT                            | FT                            |
| 5382   | APLICACAO                     | APLICACAO                     |
| 9688   | VENCIMENTO COMPROMISSADA      | VENCIMENTO COMPROMISSADA      |
| 2044   | TRFCCC                        | TRFCCC                        |
| 1480   | RESGATE CDB                   | RESGATE CDB                   |
| 9576   | TED                           | TED                           |
| 1479   | APLICACAO CDB                 | APLICACAO CDB                 |
| 8918   | REDE                          | REDE                          |
| 3435   | SISPAG SALARIOS               | SISPAG SALARIOS               |
| 9676   | PIX                           | PIX                           |
| 7548   | SISPAG DIVERSOS               | SISPAG DIVERSOS               |
| 7494   | LIQ EXPORT                    | LIQ EXPORT                    |
| 9489   | PIX QRS                       | PIX QRS                       |
| 1447   | AG. TEF                       | AG. TEF                       |
| 7685   | SISPAG TED                    | SISPAG TED                    |
| 7489   | FIN COMPRA                    | FIN COMPRA                    |
| 6918   | FT                            | FT                            |
| 8282   | TRANSF                        | TRANSF                        |
| 9678   | BOLETO                        | BOLETO                        |
| 9541   | TEG EX GAR                    | TEG EX GAR                    |
| 5015   | SISCOMEX PROT                 | SISCOMEX PROT                 |
| 8250   | TRANSF P/ APLICACAO           | TRANSF P/ APLICACAO           |
| 6992   | COLETA DIN                    | COLETA DIN                    |
| 3927   | DEP ETV DIN                   | DEP ETV DIN                   |
| 8917   | TBI                           | TBI                           |
| 9174   | CIELO                         | CIELO                         |
| 7535   | SISPAG                        | SISPAG                        |
| 9677   | DEV TED                       | DEV TED                       |
| 8955   | TED                           | TED                           |
| 9498   | APLIC LETRA FINANCEIRA        | APLIC LETRA FINANCEIRA        |
| 9522   | DEV PIX                       | DEV PIX                       |
| 8774   | PIX TRANSF                    | PIX TRANSF                    |
| 1707   | MOV TIT COBRANCA              | MOV TIT COBRANCA              |
| 9114   | PAGTO                         | PAGTO                         |
| 7706   | PARCELA GIRO                  | PARCELA GIRO                  |
| 7531   | SISPAG DIVERSOS TED           | SISPAG DIVERSOS TED           |
| 7690   | TED                           | TED                           |
| 2297   | PG TED                        | PG TED                        |
| 7556   | CAMBIO                        | CAMBIO                        |
| 9366   | TED                           | TED                           |
| 8082   | PAGSEG                        | PAGSEG                        |
| 3583   | DA                            | DA                            |
| 3585   | MOV TIT P/                    | MOV TIT P/                    |
| 3584   | MOV TIT DE                    | MOV TIT DE                    |
| 9309   | MOV TIT DE                    | MOV TIT DE                    |
| 9109   | GETNET                        | GETNET                        |
| 9372   | EMPREST CAPITAL DE GIRO       | EMPREST CAPITAL DE GIRO       |
| 3582   | STONE                         | STONE                         |
| 7536   | MOV TIT P/                    | MOV TIT P/                    |
| 364    | DEV TED                       | DEV TED                       |
| 7304   | DEP DIN CX AG                 | DEP DIN CX AG                 |
| 7651   | TEC DEPOSITO DINHEIRO         | TEC DEPOSITO DINHEIRO         |
| 1733   | DEP DIN CAIXA AG              | DEP DIN CAIXA AG              |
| 9427   | FIN VEIC                      | FIN VEIC                      |
| 3650   | SISPAG                        | SISPAG                        |
| 8903   | FIN RURAL                     | FIN RURAL                     |
| 9409   | DEBITO CHEQUE                 | DEBITO CHEQUE                 |
| 8145   | SAQ DIN AG                    | SAQ DIN AG                    |
| 8034   | PARC FINAME                   | PARC FINAME                   |
| 895    | COMPROR FLOOR PLAN            | COMPROR FLOOR PLAN            |
| 758    | CEI DEP DINH IMEDIATO         | CEI DEP DINH IMEDIATO         |
| 7529   | DEP DINHEIRO ATM              | DEP DINHEIRO ATM              |
| 960    | CREDITO CONSIGNADO            | CREDITO CONSIGNADO            |
| 8356   | CH COMPENSADO                 | CH COMPENSADO                 |
| 8355   | GIRO PARCELADO                | GIRO PARCELADO                |
| 4620   | COMPRA TITULOS                | COMPRA TITULOS                |
| 365    | TED D                         | TED D                         |
| 1080   | GIRO PARCELADO                | GIRO PARCELADO                |
| 3652   | DESBLOQUEIO JUDICIAL          | DESBLOQUEIO JUDICIAL          |
| 2532   | BLOQUEIO JUDICIAL             | BLOQUEIO JUDICIAL             |
| 60     | LIQUIDACAO CREDITO RURAL      | LIQUIDACAO CREDITO RURAL      |
| 7600   | TEC DEP CHEQUE                | TEC DEP CHEQUE                |
| 1048   | DEP CHEQUE CAIXA AG           | DEP CHEQUE CAIXA AG           |
| 9457   | AMORTIZACAO FINANC IMOB       | AMORTIZACAO FINANC IMOB       |
| 1076   | LIBERACAO FINAME              | LIBERACAO FINAME              |
| 6790   | PARCELA CREDITO RURAL         | PARCELA CREDITO RURAL         |
| 9445   | DEP DIN CX AG                 | DEP DIN CX AG                 |
| 7164   | DEPOSITO DINHEIRO             | DEPOSITO DINHEIRO             |
| 774    | CEI DINHEIRO                  | CEI DINHEIRO                  |
| 599    | LIBER FINANC IMOBILIARIO      | LIBER FINANC IMOBILIARIO      |
| 5331   | IFOOD                         | IFOOD                         |
| 8136   | TRANSFERENCIA SALDO           | TRANSFERENCIA SALDO           |
| 8021   | MOVIMENT TITULO               | MOVIMENT TITULO               |
| 71     | DEPOSITO VIA DEB CAIXA        | DEPOSITO VIA DEB CAIXA        |
| 1731   | DEP DISP CX AG                | DEP DISP CX AG                |
| 372    | DEP CHEQUE CUSTODIADO         | DEP CHEQUE CUSTODIADO         |
| 8793   | RESGATE CDB                   | RESGATE CDB                   |
| 8640   | PARCELA FIN IMOBILIARIO       | PARCELA FIN IMOBILIARIO       |
| 3778   | DESC DP BAIXA                 | DESC DP BAIXA                 |
| 8348   | CH COMPENSADO                 | CH COMPENSADO                 |
| 1930   | CH COMPENSADO                 | CH COMPENSADO                 |
| 9524   | DEPOSITO CHEQUE               | DEPOSITO CHEQUE               |
| 7893   | JUROS                         | JUROS                         |
| 7532   | DEV CH DEP                    | DEV CH DEP                    |
| 9401   | TRANSF BLOQUEIO JUDICIAL      | TRANSF BLOQUEIO JUDICIAL      |
| 8929   | IOF CAMBIO                    | IOF CAMBIO                    |
| 8264   | TAR/CUSTAS COBRANCA           | TAR/CUSTAS COBRANCA           |
| 8179   | TEF                           | TEF                           |
| 9554   | SABESP                        | SABESP                        |
| 9087   | FIANCA                        | FIANCA                        |
| 3673   | CONTRB                        | CONTRB                        |
| 7206   | TED                           | TED                           |
| 711    | TBI                           | TBI                           |
| 786    | MOBILE                        | MOBILE                        |
| 2845   | TRANSF                        | TRANSF                        |
| 8043   | DEV CH                        | DEV CH                        |
| 6993   | PIX SAQUE                     | PIX SAQUE                     |
| 8005   | REND PAGO APLIC AUT MAIS      | REND PAGO APLIC AUT MAIS      |
| 7182   | LIBERACAO FIN AGRICOLA        | LIBERACAO FIN AGRICOLA        |
| 1608   | TAR COBRANCA MENSAL           | TAR COBRANCA MENSAL           |
| 1209   | IOF                           | IOF                           |
| 9517   | PAGTO FORNECEDOR              | PAGTO FORNECEDOR              |
| 7104   | DIVIDENDOS ACOES              | DIVIDENDOS ACOES              |
| 7678   | LIQUIDACAO FINANC IMOB        | LIQUIDACAO FINANC IMOB        |
| 8252   | COLETA CHQ                    | COLETA CHQ                    |
| 8253   | GO                            | GO                            |
| 7630   | PARCELA BNDES AGRICOLA        | PARCELA BNDES AGRICOLA        |
| 7208   | CXE SAQUE                     | CXE SAQUE                     |
| 2105   | IOF                           | IOF                           |
| 841    | TAR PIX QR CODE LIQUIDA       | TAR PIX QR CODE LIQUIDA       |
| 8046   | PREMIO RISC SACADO            | PREMIO RISC SACADO            |
| 9549   | PAGAMENTO AUTORIZADO TED      | PAGAMENTO AUTORIZADO TED      |
| 4802   | TRANSF P/ APLICACAO           | TRANSF P/ APLICACAO           |
| 9548   | TRANSF P/ APLICACAO           | TRANSF P/ APLICACAO           |
| 903    | TAR TED SISPAG                | TAR TED SISPAG                |
| 9499   | TRF TAR DE                    | TRF TAR DE                    |
| 877    | RSHOP                         | RSHOP                         |
| 630    | TAR C/C SISPAG                | TAR C/C SISPAG                |
| 9550   | VENDOR BAIXA                  | VENDOR BAIXA                  |
| 9246   | DESBLOQUEIO PIX               | DESBLOQUEIO PIX               |
| 9509   | DEBITO AUTORIZADO             | DEBITO AUTORIZADO             |
| 9166   | BLOQUEIO PIX                  | BLOQUEIO PIX                  |
| 9513   | REDE                          | REDE                          |
| 9081   | TAR PIX PGTO TRANSF           | TAR PIX PGTO TRANSF           |
| 7530   | TAR SISDEB/DAI                | TAR SISDEB/DAI                |
| 7784   | IOF                           | IOF                           |
| 9080   | DEV PIX SISTEMICO             | DEV PIX SISTEMICO             |
| 9519   | LIQ/AMORT SDO DEVEDOR         | LIQ/AMORT SDO DEVEDOR         |
| 9547   | TAR PIXQR LIQ MAQUININHA      | TAR PIXQR LIQ MAQUININHA      |
| 9082   | TAR NEGAT ENT                 | TAR NEGAT ENT                 |
| 9079   | TAR PIX QR LIQ BOLECODE       | TAR PIX QR LIQ BOLECODE       |
| 7982   | TAR CONTA CERTA               | TAR CONTA CERTA               |
| 9096   | TED D                         | TED D                         |
| 7817   | TAR IMOB VISTORIA OBRA        | TAR IMOB VISTORIA OBRA        |
| 4470   | TAR CONTA CERTA               | TAR CONTA CERTA               |
| 8502   | TAR PIX QR LIQ ESTATICO       | TAR PIX QR LIQ ESTATICO       |
| 839    | DEV PIX CONTESTADA            | DEV PIX CONTESTADA            |
| 7820   | TAR CONTA CERTA               | TAR CONTA CERTA               |
| 7733   | TAR CONTA CERTA               | TAR CONTA CERTA               |
| 2109   | TED D                         | TED D                         |
| 3782   | TAR TED                       | TAR TED                       |
| 9165   | LIQ/AMORT SDO DEVEDOR         | LIQ/AMORT SDO DEVEDOR         |
| 1562   | PAGTO CREDITO LIQUIDACAO      | PAGTO CREDITO LIQUIDACAO      |
| 3780   | TAR DEMONSTRATIVO PAGTO       | TAR DEMONSTRATIVO PAGTO       |
| 7998   | TAR ORDEM PAGTO SISPAG        | TAR ORDEM PAGTO SISPAG        |
| 7783   | TAR CH VALOR SUP              | TAR CH VALOR SUP              |
| 9167   | TED                           | TED                           |
| 9097   | CXE                           | CXE                           |
| 9164   | TAR/CUST P/                   | TAR/CUST P/                   |
| 8850   | TAR NEGAT LIQ                 | TAR NEGAT LIQ                 |
| 4307   | TAR CHEQUE PERSONALIZADO      | TAR CHEQUE PERSONALIZADO      |
| 312    | TAR/CUST DE                   | TAR/CUST DE                   |
| 4003   | TED                           | TED                           |
| 7353   | TAR IMOB ESTUDO VIAB TEC      | TAR IMOB ESTUDO VIAB TEC      |
| 8730   | TAR NEGAT CAN                 | TAR NEGAT CAN                 |
| 7786   | TAR DEPOSITO CHQ              | TAR DEPOSITO CHQ              |
| 837    | TAR NEGAT EXC                 | TAR NEGAT EXC                 |
| 7534   | TAR AGENTE EMPREEND           | TAR AGENTE EMPREEND           |
| 9515   | AG. TEF                       | AG. TEF                       |
| 1523   | TAR DEV CHQ                   | TAR DEV CHQ                   |
| 8354   | TAR CHEQUE EMITIDO            | TAR CHEQUE EMITIDO            |
| 8047   | TAR SISPAG CONCESSION         | TAR SISPAG CONCESSION         |
| 8863   | TAR MAXICONTA MENS            | TAR MAXICONTA MENS            |
| 9219   | TAR IMOB ADITIVO CONTRAT      | TAR IMOB ADITIVO CONTRAT      |
| 7533   | TAR SISPAG CATEGORIA 306      | TAR SISPAG CATEGORIA 306      |
| 842    | TAR TED                       | TAR TED                       |
| 9379   | PIX QRS                       | PIX QRS                       |
| 2333   | TAR SISPAG SALARIO            | TAR SISPAG SALARIO            |
| 9181   | TAR COMPROR HOT               | TAR COMPROR HOT               |
| 8941   | TAR MOV CONTA CONTRATUAL      | TAR MOV CONTA CONTRATUAL      |
| 840    | TAR ALTER CRONOG ORCAMEN      | TAR ALTER CRONOG ORCAMEN      |
| 8310   | TAR CHEQUE EMITIDO            | TAR CHEQUE EMITIDO            |
| 997    | TAR TED                       | TAR TED                       |
| 229    | RECEBIMENTO CONVENIOS         | RECEBIMENTO CONVENIOS         |
| 244    | RECBTO CONVENIOS DEB AUT      | RECBTO CONVENIOS DEB AUT      |

</details>

