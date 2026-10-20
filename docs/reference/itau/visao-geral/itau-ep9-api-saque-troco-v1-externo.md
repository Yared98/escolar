# Saque Troco (v1.0.7)

Fonte: https://devportal.itau.com.br/nossas-apis/itau-ep9-api-saque-troco-v1-externo (aba visão geral, atualizada em 2025-12-11T01:09:37.000Z)
Sandbox: https://sandbox.devportal.itau.com.br/itau-ep9-api-saque-troco-v1-externo/v1
Spec: ../openapi/itau-ep9-api-saque-troco-v1-externo.json

---



## **sobre a API**

A API Saque Troco é responsável pela gestão dos estabelecimentos comerciais do cliente, permitindo a realização de saque e devolução de troco em dinheiro em espécie. Através dela, é possível cadastrar, consultar, alterar e excluir estabelecimentos comerciais que oferecem o serviço de Pix Saque e Pix Troco. Essa API facilita a integração com sistemas que necessitam gerenciar pontos de atendimento para serviços financeiros.

## **para quem é esta API?**

Esta API é destinada a empresas e desenvolvedores que necessitam integrar funcionalidades de gestão de pontos de atendimento para serviços de saque e troco em dinheiro, como bancos, fintechs e estabelecimentos comerciais que desejam oferecer o serviço de Pix Saque e Pix Troco.

## **restrições de uso**

Para utilizar esta API, é necessário possuir permissões específicas para leitura e escrita dos dados de estabelecimentos comerciais. Além disso, o usuário deve estar autenticado via token válido e ter certificados ativos para garantir a segurança da integração.

## **conhecimentos técnicos necessários**
Conhecimentos prévios necessários:

`HTTP` `JSON` `Postman`

Os verbos disponíveis para uso da API são `GET`, `POST`, `PATCH`, e `DELETE`. O usuário deve estar familiarizado com requisições HTTP e manipulação de dados em formato JSON.

## **quais necessidades que essa API ajuda a resolver?**

A API resolve problemas relacionados à gestão de pontos de atendimento para serviços financeiros, como cadastro, consulta, atualização e exclusão de estabelecimentos comerciais que oferecem Pix Saque e Pix Troco. Ela também facilita a integração com sistemas externos.

## **regras de negócio**

Os usuários devem garantir que os dados enviados nos endpoints estejam em conformidade com os padrões definidos, como formatos de horário, valores monetários e identificadores únicos. Além disso, os horários de funcionamento do serviço devem ser configurados corretamente para cada ponto de atendimento.

## **tempo aproximado para integração**
**5 dias:** essa é a média de tempo que um desenvolvedor pode levar para preparar toda a integração com essa API. Isso pode variar de acordo com o tamanho do time e experiência dos desenvolvedores envolvidos.

## **endpoints**

A API oferece funcionalidades para gerenciar pontos de atendimento, incluindo cadastro, consulta, atualização e exclusão. Cada endpoint possui parâmetros específicos que devem ser enviados na requisição. Abaixo estão os principais endpoints:

### **URLs**

Para garantir uma integração segura, as funcionalidades da API estão disponíveis nas seguintes URLs:

| ambiente    | endpoint                                                      |
| ---------   | ------------------------------------------------------------- |                    
| sandbox     | https://pix-pj.sandbox/saque-troco/v1 |
| homologação | https://pix-pj.homolog/saque-troco/v1   | 
| produção    | https://pix-pj.prod/saque-troco/v1 |

### **Endpoints principais**
- **GET /pontos-atendimento**: Recupera os dados dos pontos de atendimento. Parâmetros opcionais: `pontoAtendimentoId`, `page`, `pageSize`.
- **POST /pontos-atendimento**: Cadastra novos pontos de atendimento. Requer corpo da requisição com informações detalhadas.
- **PATCH /pontos-atendimento/{pontoAtendimentoId}**: Atualiza informações de um ponto de atendimento específico.
- **DELETE /pontos-atendimento/{pontoAtendimentoId}**: Remove um ponto de atendimento específico.
- **GET /remuneracao-analiticos**: Operação responsável por retornar o detalhe da remuneração de um Saque Pix por conta e período.
- **GET /remuneracao-consolidados**: Operação responsável por retornar o detalhe da remuneração consolidada de um Saque Pix por conta e período.

### **[GET] /remuneracao-analiticos**
Operação responsável por retornar o detalhe da remuneração de um Saque Pix por conta e período.

#### Exemplo de Sandbox:
```json
{
  "idConta": "12345678901",
  "dataLancamento": "2023-01-01,2023-01-31",
  "cnpj": "12345678000199",
  "page": 1,
  "pageSize": 10
}
```

Entrada:

| Parâmetro	             | Tipo Parâmetro | Tipo Dado | Obrigatório  | Descrição                                                                      |
|------------------------|----------------| --------- |--------------|-----------------------------------------------------------------------------------|
| `idConta`              | query          |string| sim          | Chave constituída por agência (4 dígitos) + conta (7 dígitos) da conta corrente do cliente, com 11 dígitos    |
| `dataLancamento`       | query          |string| sim          | Data início e fim da consulta separado por vírgula YYYY-MM-DD,YYYY-MM-DD                               |
| `cnpj`                 | query          |string| sim          | Documento                                                                                                        |
| `page`                 | query          |string| não          | Página.                                                                                                          |
| `pageSize`             | query          |string| não          | Número de registros por página.                                                                              |
| `x-itau-apikey`        | header         |string| não          | Chave da API utilizada para autorizar o consumo de uma aplicação requisitante                          |
| `x-itau-correlationID` | header         |string| não          | Identificador de correlação que serve como um agrupador dentro da estrutura de audit trail      |

---

### **[GET] /remuneracao-consolidados**
Operação responsável por retornar o detalhe da remuneração consolidada de um Saque Pix por conta e período.

#### Exemplo de Sandbox:
```json
{
  "idConta": "12345678901",
  "dataLancamento": "2023-01-01,2023-01-31",
  "cnpj": "12345678000199",
  "page": 1,
  "pageSize": 10
}
```

Entrada:

| Parâmetro	| Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| --------- | -------------- | --------- | ----------- | --------- |
|`idConta`|query|string|sim|Chave constituída por agência (4 dígitos) + conta (7 dígitos) da conta corrente do cliente, com 11 dígitos|
|`dataLancamento`|query|string|sim|Data início e fim da consulta separado por vírgula YYYY-MM-DD,YYYY-MM-DD|
|`cnpj`|query|string|sim|Documento|
|`page`|query|string|não|Página.|
|`pageSize`|query|string|não|Número de registros por página.|
|`x-itau-apikey`|header|string|não|Chave da API utilizada para autorizar o consumo de uma aplicação requisitante|
|`x-itau-correlationID`|header|string|não|Identificador de correlação que serve como um agrupador dentro da estrutura de audit trail|

## **padrões de erros**

Essa API retorna códigos de status HTTP para indicar sucesso ou falhas das requisições.

Códigos **2xx** indicam sucesso.

Códigos **4xx** indicam falhas causadas pelas informações enviadas pelo cliente ou pelo estado atual das entidades.

Códigos **5xx** indicam problemas no serviço no lado da API.

As respostas de erro incluem no corpo detalhes do erro e o campo type identifica o tipo de erro.

Abaixo estão listados os tipos de erro que podem ser retornados por quaisquer endpoints listados nessa documentação.

| HTTP Status Code | Descrição | Significado
| -------- | -------- | -------- |
| 400 Bad Request  | Bad Request | Requisição contém dados inválidos
| 404 Not Found    | Not Found   | Recurso não encontrado
| 500 Internal Server Error | Internal Server Error | Erro interno no servidor

