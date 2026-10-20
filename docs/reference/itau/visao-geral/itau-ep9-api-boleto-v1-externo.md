# API Boletos (v1.16.0)

Fonte: https://devportal.itau.com.br/nossas-apis/itau-ep9-api-boleto-v1-externo (aba visão geral, atualizada em 2026-08-11T04:02:38.000Z)
Sandbox: https://sandbox.devportal.itau.com.br/itau-ep9-api-boleto-v1-externo/v1
Spec: ../openapi/itau-ep9-api-boleto-v1-externo.json

---



## **sobre a API**
Esta documentação descreve os endpoints da consulta listagem de boletos do Itaú.

Com as novas APIs de Boletos do Itaú, sua empresa terá agilidade e segurança máximas para consultar o status de seus boletos.

Aqui, apresentamos um guia passo a passo para o desenvolvimento dessa solução, que tornará o processo de consulta às informações dos boletos mais eficiente para sua empresa.

O passo a passo a seguir demonstra como consultar boletos de cobrança utilizando essa solução.

## **para quem é esta API?**
Esta API é destinada a clientes que desejam consultar as informações de seus boletos de cobrança registrados no Banco Itaú.

## **restrições de uso**
Para começar a sua jornada de desenvolvimento é importante que o ambiente esteja preparado e configurado para realizar os testes e suportar o desenvolvimento da aplicação de maneira segura. Nosso modelo de comunicação atual requer a autenticação do parceiro através do fluxo **OAuth 2.0**.

**Fluxo de autenticação – OAuth 2.0 (Private KeyJWT e Mutual-TLS Client Authentication)**

Os fluxos de autenticação do OAuth 2.0 são baseados em obtenção de *access_tokens* que permitem a autenticação e autorização das APIs. O método previsto para as APIS do Itaú é o *Private Key JWT Client Authentication (private_key_jwt)* que consiste em autenticação no fluxo *client_credentials* baseada em chaves (privada e pública).

Ambas as chaves são criadas pelo desenvolvedor que irá integrar com as APIs do Itaú. A chave privada, deve ser criada e armazenada de maneira segura dentro do ambiente da aplicação que consumirá as APIs e é utilizada para assinar todas as obtenções de *access_tokens*. A chave pública deve ser exposta em um terminal de configuração descoberta *(well-known endpoint)* em uma sessão específica conhecida como *jwks_uri  (JSON Web Key Sets – URI)*.   A *jwks_uri* deve ser informada para o agente comercial Itaú no momento da contratação. Saiba mais em https://auth0.com/docs/tokens/json-web-tokens/json-web-key-sets.

Para estabelecer conexão segura com os API Gateways do Itaú é necessário enviar um *client certificate*. Este certificado é usado para estabelecer o *mTLS (OAuth 2.0 Mutual Transport Layer Security* - https://tools.ietf.org/html/rfc8705):

**1**.	A partir de um *client_id* e <u>token temporário para ativação</u>, ambos fornecidos pelo agente comercial após a contratação, o desenvolvedor gera um arquivo CSR *(Certificate Signing Request)* baseado em um *template* e documentação será fornecida no nosso Portal do Desenvolvedor;

**2**.	O desenvolvedor solicita um certificado assinado pelo Itaú (CRT – *Certificate File*) , através de uma API informando o CSR e token temporário de ativação;

**3**.	O desenvolvedor configura sua aplicação com o arquivo CRT, que será utilizado junto com o *private_key_jwt* para a obtenção de *access_tokens* e junto com o *access_token* para todas as chamadas de APIs.

**4**.	A renovação automática e revogação estão também documentadas no Portal do Desenvolvedor.

## **conhecimentos técnicos necessários**
Conhecimentos prévios necessários:

`HTTP` `JSON` `REST` `OAuth`

## **quais necessidades que essa API ajuda a resolver?**
A API de Consulta de Boletos do Itaú foi desenvolvida para atender diversas necessidades das empresas que lidam com a emissão e gestão de boletos de cobrança. Entre as principais necessidades que essa API ajuda a resolver, destacam-se:

**1. Consulta de Status de Boletos:** Permite consultar dados dos boletos emitidos, proporcionando informações atualizadas e precisas sobre o ciclo de vida, status dos boletos e vencimentos.

**2. Automatização de Processos:** Facilita a integração com sistemas internos da empresa, automatizando a consulta e o acompanhamento dos boletos, o que reduz a necessidade de intervenções manuais e minimiza erros operacionais.

**3. Segurança nas Transações:** Garante a segurança das informações transmitidas, utilizando protocolos de autenticação e autorização robustos, como OAuth, para proteger os dados sensíveis.

**4. Eficiência Operacional:** Aumenta a eficiência no gerenciamento de cobranças, permitindo que a empresa tenha um controle mais rigoroso e ágil sobre os boletos emitidos e pagos.

## **tempo aproximado para integração**
**2 dias:** essa é a média de tempo que um desenvolvedor pode levar para preparar toda a integração com essa API. Isso pode variar de acordo com o tamanho do time e experiência dos desenvolvedores envolvidos.

### Parâmetros comuns de cabeçalho
Para consumo das APIs do Itaú, alguns parâmetros de cabeçalho são necessários:

**x-itau-apikey**

O *x-itau-apikey* é um parâmetro que será requerido em todas as chamadas das APIs que contemplam essa solução. A informação que deve ser usada nesse campo é o código gerado através da autenticação OAuth 2.0 para o client_id. Para saber como gerar o client_id ou como recuperar as informações de códigos já gerados basta acessar a etapa de ‘autenticação’ desse tutorial.

**x-itau-flowID**

A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. Recomenda-se utilizar um uuid version 4 nesse campo como: b47ec51b-b2a7-4a78-933c-f0b67667e7dc.

**x-itau-correlationID**

A implementação de um correlationID permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes, conseguindo fornecer um mapeamento de ponta-a-ponta. Por exemplo, uma aplicação client gera uma chamada à API, neste momento fornecendo o correlationID gerado pelo consumidor, o qual é repassado em todas as camadas/microserviços que a api precisa para realizar determinada funcionalidade. É importante lembrar que o header x-itau-correlationID deve sempre ser diferente a cada requisição. Necessário utilizar um uuid version 4 válido nesse campo como por exemplo: a1e64241-7fdb-4d05-a7f6-c44febcdd8d9.

## **endpoints**
A seguir, você encontrará informações detalhadas sobre os endpoints disponíveis para integração com a solução de consulta de boletos.
Os exemplos de response de erros são demonstrados no tópico **padrões de erros** ao final desta page. Cada endpoint traz uma tabela especificando quais desses retornos aquele serviço retorna. Então, caso haja variação no json retornado, este será demonstrado na explicação do próprio endpoint, se não, deve ser visualizado no tópico citado.

Para garantir uma integração segura, as funcionalidades da API estão disponíveis nas seguintes URLs:

## URLs
Para garantir uma integração segura, as funcionalidades da API estão disponíveis nas seguintes URLs:

| ambiente    | endpoint                               |
| ---------   |----------------------------------------|                    
| produção    | https://boleto.api.itau.com/boleto/v1  |

Todas as requisições devem usar o *schema https* por questões de segurança.
### **Scopes**
Para que o cliente consiga acessar nossa API, no cadastro da aplicação consumidora no portal de certificados de parceiro, é necessário adicionar o scope/funcionalidade: `boletoscash-boleto.read`.

### Parâmetros para a Consulta
| **Parâmetro**           | **Tipo Parâmetro** | **Tipo Dado** | **Obrigatório** | **Descrição**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
|-------------------------|--------------------|---------------|-----------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `x-itau-apikey`         | header | string | sim | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `x-itau-correlationID`  | header | string | sim | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes. `Necessário utilizar um uuid version 4 válido nesse campo como por exemplo: a1e64241-7fdb-4d05-a7f6-c44febcdd8d9`.                                                                                                                                                                                                                                                                                                                                                                                                  |
| `x-itau-flowid`         | header | string | sim | A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. 
| `idBeneficiario`        | param | integer | sim | Dados para identificação do boleto para consulta, sendo composto por:   Código Agência - Obrigatório (4 caracteres), Código Conta - Obrigatório (7 caracteres), DAC - Obrigatório (1 caractere).                                                                                                                                                                                                                                                                                                                                                                                          |
| `nomePagador`           | param | integer | não | Nome do pagador do boleto.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `cnpjPagador`           | param | integer | não | Cnpj do pagador do boleto.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `cpfPagador`            | param | integer | não | Cpf do pagador do boleto                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `nossoNumero`           | param | integer | não | Número de identificação do boleto.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `seuNumero`             | param | integer | não | Número de identificação do boleto (Controle do cliente).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `codigoCarteira`        | param | integer | não | Código da carteira do boleto.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `codigoBarra`           | param | integer | não | Número do código de barra do boleto.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `situacao`              | param | integer | não | Código da situação geral do boleto Ex.: aberto; emPagamento; pago ou cancelado.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `instrumentoCobranca`   | param | integer | não | Código do instrumento de cobrança do boleto Ex.: boleto ou bolecode.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `situacaoVencimento`    | param | integer | não | Código de status de vencimento do boleto Ex.: aVencer ou vencido.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `motivoCancelamento`    | param | integer | não | Código do motivo de cancelamento do boleto Ex.: baixaPorTersidoProtestado, baixaPorTerSidoLiquidado ou baixaSimples.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `dataEntrada`           | param | integer | não | Período de data de entrada para busca dos boletos no formato AAAA-MM-DD,AAAA-MM-DD ou AAAA-MM-DD.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `dataEmissao`           | param | integer | não | Período de data de emissão para busca dos boletos no formato de AAAA-MM-DD,AAAA-MM-DD ou AAAA-MM-DD.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `dataCancelamento`      | param | integer | não | Período de data de cancelamento para busca dos boletos no formato de AAAA-MM-DD,AAAA-MM-DD ou AAAA-MM-DD.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `dataPagamento`         | param | integer | não | Período de data de pagamento para busca dos boletos no formato de AAAA-MM-DD,AAAA-MM-DD ou AAAA-MM-DD.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `dataVencimento`        | param | integer | não | Período de data de vencimento para busca dos boletos no formato de AAAA-MM-DD,AAAA-MM-DD ou AAAA-MM-DD.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `indicadorDescontado`   | param | integer | não | Status de desconto do booleto Ex.: true - boleto descontado ou false - boleto não descontado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `orderBy`               | param | integer | não | Campo de ordenação dos boletos, sendo ordenado por padrão pela 'nossoNumero', podendo ordenar por 'seuNumero', 'nomePagador', 'dataEmissao', 'dataVencimento', 'dataCancelamento', 'dataPagamento' ou 'valorBoleto'.                                                                                                                                                                                                                                                                                                                                                                      |
| `order`                 | param | integer | não | Campo de ordenação dos boletos, podendo ser "asc" para crescente ou "desc" para decrescente.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `page`                  | param | integer | não | Campo referente ao número da página. Seu valor pode ser de 0 à 300.000.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `pageSize`              | param | integer | não | Campo referente à quantidade de boletos por página. Seu valor pode ser de 1 à 100.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### Glossário
*Para consultar os valores possíveis dos campos a seguir, veja as tabelas abaixo.*

| **Campo**             | **Descrição**                                                                                                                                       |
|-----------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|
| `situacao`            | Situações que o boleto pode ter em seu ciclo de vida (ver tabela "Situação Boleto").                                                                |
| `instrumentoCobranca` | Instrumento de cobrança do boleto, podendo ser `boleto` para boleto ou `bolecode` para boleto com QRcode para pagamento via pix.                    |
| `situacaoVencimento`  | Situação do vencimento do boleto, indicando se o mesmo encontra-se `vencido` ou `aVencer`.                                                          |
| `situacaoProtesto`    | Situação do protesto do boleto, indicando se o mesmo encontra-se `emProtesto`, `protestado`, `protestoCancelado` ou `protestoAgendado`.             |
| `situacaoNegativacao` | Situação da negativação do boleto, indicando se o mesmo encontra-se `emNegativacao`, `negativado`, `negativacaoCancelada` ou `negativacaoAgendada`. |
| `motivoCancelamento`  | Motivo de cancelamento do boleto, indicando se o motivo foi `baixaPorTerSidoLiquidado`, `baixaPorTersidoProtestado` ou `baixaSimples`.              |
| `indicadorDescontado` | Indicador de contratação de desconto de duplicatas, indicando se o mesmo encontra-se `true` para descontado ou `false` para não descontado.         |

### Situação Boleto
| **Situação**  | **Descrição**                                                                                                                                                 |
|---------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `aberto`      | Boleto em aberto que não foi pago ou cancelado. O pagador pode efetuar o pagamento do boleto normalmente.                                                     |
| `emPagamento` | Boleto com confirmação de pagamento feito em outra instituição financeira, em que o valor ainda não foi recebido pelo Itaú e transferido para o beneficiário. |
| `pago`        | Boleto pago em seu valor total a ser disponibilizado ao beneficiário de acordo com o floating contratado.                                            	        |
| `cancelado`   | Boleto cancelado e não está mais disponível para pagamento ou alterações.                                                                                     |

### Descrição Instrumento Cobrança
| **Retorno**        | **Descrição**                                                         |
|--------------------|-----------------------------------------------------------------------|
| `boleto`           | Boleto padrão.                                                        |
| `bolecode`         | Boleto com QRcode que permite que o pagamento seja realizado via PIX. |

### Status do vencimento
| **Situação** | **Descrição**                           |
|--------------|-----------------------------------------|
| `aVencer`    | Data de vencimento ainda não atingida.  |
| `vencido`    | Boleto com data de vencimento atingida. |

### Situação Negativação
| **Código**             | **Descrição**                                                                                       |
|------------------------|-----------------------------------------------------------------------------------------------------|
| `emNegativacao`        | Boleto em processo de negativação do pagador por possuir dívida vencida e não paga junto ao Serasa. |
| `negativado`           | Pagador foi negativado por dívida vencida e não paga.                                               |
| `negativacaoCancelada` | Negativação cancelada por solicitação do cliente, por pagamento ou cancelamento do boleto.          |
| `negativacaoAgendada`  | O boleto será enviado para negativação na data agendada, caso não seja pago.                        |

### Situação Protesto
| **Código**          | **Descrição**                                                                               |
|---------------------|---------------------------------------------------------------------------------------------|
| `emProtesto`        | Boleto em processo de protesto no cartório.                                                 |
| `protestado`        | Boleto protestado devido à inadimplência, sem confirmação de pagamento até a data agendada. |
| `protestoCancelado` | Protesto cancelado por pagamento, cancelamento do boleto ou por sustação do cartório.       |
| `protestoAgendado`  | O boleto será enviado para protesto na data agendada, caso não seja pago.                   |

### Motivo do cancelamento
| **Código**                  | **Descrição**                             |
|-----------------------------|-------------------------------------------|
| `baixaPorTerSidoLiquidado`  | Cancelado devido ao pagamento por QRCode. |
| `baixaPorTerSidoProtestado` | Cancelado devido ao protesto em cartório. |
| `baixaSimples`              | Cancelado por solicitação do cliente.     |

### API de Boletos ###

### [GET] ../boletos

API responsável por retornar os dados de ciclo de vida dos boletos, dados do pagador, informações de datas de pagamento e vencimento, valor e situação do boleto.

Exemplo de entrada:

GET ../boletos?idBeneficiario=123456789012&codigoCarteira=123&dataEntrada=2024-10-10,2024-10-15&view=basic

Exemplo de saída:

+ Exemplos de retornos com sucesso (status 200)

<details>
<summary>Boleto pela data de entrada e carteira</summary>

```json
{
	"data": [
		{
			"idBoleto": "5367ffad-f89d-462d-83d2-cf331c6753e3",
			"identificadorBoletoMercado": "00001234567890123456789012345678",
			"instrumentoCobranca": "boleto",
			"pagador": {
				"nomePagador": "ANTOLLY",
				"tipoPessoa": "Física",
				"numeroDocumento": "26556923222"
			},
			"situacaoVencimento": "vencido",
			"indicadorDescontado": false,
			"seuNumero": "000001",
			"dataEntrada": "2024-01-22",
			"dataEmissao": "2024-01-22",
			"dataVencimento": "2023-01-30",
			"valor": "300.00",
			"codigoCarteira": "157",
			"situacao": "aberto",
			"nossoNumero": "70272683",
			"dataLimitePagamento": "2033-01-30"
		},
		{
			"idBoleto": "e877d57f-5368-4584-ade0-3c3d023b743f",
			"identificadorBoletoMercado": "00009876543210987654321098765432",
			"instrumentoCobranca": "boleto",
			"pagador": {
				"nomePagador": "Silva & Silva",
				"tipoPessoa": "Física",
				"numeroDocumento": "26556923222"
			},
			"situacaoVencimento": "vencido",
			"indicadorDescontado": false,
			"dataEntrada": "2024-01-23",
			"dataEmissao": "2024-01-23",
			"dataVencimento": "2024-01-23",
			"valor": "32100.00",
			"codigoCarteira": "157",
			"situacao": "aberto",
			"nossoNumero": "70272692",
			"dataLimitePagamento": "2034-01-23"
		}
	],
	"page": {
		"links": {
			"first": "/boleto/v1/boletos?codigoCarteira=157&dataEntrada=2024-01-22,2024-01-23&idBeneficiario=150000015605&pageSize=20&page=0&orderBy&order",
			"last": "/boleto/v1/boletos?codigoCarteira=157&dataEntrada=2024-01-22,2024-01-23&idBeneficiario=150000015605&pageSize=20&page=0&orderBy&order",
			"previous": "/boleto/v1/boletos?codigoCarteira=157&dataEntrada=2024-01-22,2024-01-23&idBeneficiario=150000015605&pageSize=20&page=0&orderBy&order",
			"next": "/boleto/v1/boletos?codigoCarteira=157&dataEntrada=2024-01-22,2024-01-23&idBeneficiario=150000015605&pageSize=20&page=0&orderBy&order"
		},
		"page": 0,
		"totalPages": 0,
		"totalElements": 9,
		"pageSize": 20
	}
}
```
</details>

<details>
<summary>Boleto aberto</summary>

```json
{
	"data": [
		{
			"idBoleto": "2402a6b4-dddf-49ec-ac00-27672dc74390",
			"identificadorBoletoMercado": "00002222444466668888000022224444",
			"instrumentoCobranca": "boleto",
			"pagador": {
				"nomePagador": "TESTE",
				"tipoPessoa": "Física",
				"numeroDocumento": "05201005225"
			},
			"situacaoVencimento": "vencido",
			"indicadorDescontado": false,
			"dataEntrada": "2022-07-07",
			"dataEmissao": "2022-07-07",
			"dataVencimento": "2022-09-30",
			"valor": "150.00",
			"codigoCarteira": "157",
			"situacao": "aberto",
			"nossoNumero": "1",
			"dataLimitePagamento": "2032-09-30"
		},
		{
			"idBoleto": "af09ee30-0b2b-4382-a15b-22d09033d3fb",
			"identificadorBoletoMercado": "00003333555577779999111133335555",
			"instrumentoCobranca": "boleto",
			"pagador": {
				"nomePagador": "RENATO",
				"tipoPessoa": "Jurídica",
				"numeroDocumento": "81085888000104"
			},
			"situacaoVencimento": "vencido",
			"indicadorDescontado": false,
			"seuNumero": "renan_jun",
			"dataEntrada": "2023-03-21",
			"dataEmissao": "2023-09-27",
			"dataVencimento": "2023-06-20",
			"valor": "3500.80",
			"codigoCarteira": "157",
			"situacao": "aberto",
			"nossoNumero": "1",
			"dataLimitePagamento": "2033-04-20"
		}
	],
	"page": {
		"links": {
			"first": "/boleto/v1/boletos?idBeneficiario=150000015605&situacao=aberto&pageSize=2&page=0&orderBy&order",
			"last": "/boleto/v1/boletos?idBeneficiario=150000015605&situacao=aberto&pageSize=2&page=632331&orderBy&order",
			"previous": "/boleto/v1/boletos?idBeneficiario=150000015605&situacao=aberto&pageSize=2&page=0&orderBy&order",
			"next": "/boleto/v1/boletos?idBeneficiario=150000015605&situacao=aberto&pageSize=2&page=1&orderBy&order"
		},
		"page": 0,
		"totalPages": 632331,
		"totalElements": 1264662,
		"pageSize": 2
	}
}
```
</details>

<details>
<summary>Boleto em pagamento</summary>

```json
{
	"data": [
		{
			"idBoleto": "863757b1-926d-4016-9a26-5ef9afcb2308",
			"identificadorBoletoMercado": "00004444666688880000222244446666",
			"instrumentoCobranca": "boleto",
			"pagador": {
				"nomePagador": "SANTIAGO PEÇAS",
				"tipoPessoa": "Física",
				"numeroDocumento": "26556923333"
			},
			"indicadorDescontado": false,
			"seuNumero": "LATINO",
			"dataEntrada": "2023-06-07",
			"dataEmissao": "2023-09-07",
			"dataVencimento": "2024-09-30",
			"valor": "30.01",
			"codigoCarteira": "109",
			"situacao": "emPagamento",
			"nossoNumero": "40",
			"dataLimitePagamento": "2033-12-30",
			"dataPagamento": "2024-07-29",
			"valorPagoTotal": "60.02"
		},
		{
			"idBoleto": "1c46ef1c-398f-4d09-a2ff-59d0d611a3b6",
			"identificadorBoletoMercado": "00005555777799991111333355557777",
			"instrumentoCobranca": "boleto",
			"pagador": {
				"nomePagador": "XPTO IND. COM. DE BEBIDAS",
				"tipoPessoa": "Jurídica",
				"numeroDocumento": "04680660000222"
			},
			"indicadorDescontado": false,
			"seuNumero": "2580-1",
			"dataEntrada": "2023-04-27",
			"dataEmissao": "2023-06-05",
			"dataVencimento": "2023-05-22",
			"valor": "32875.00",
			"codigoCarteira": "157",
			"situacao": "emPagamento",
			"nossoNumero": "679",
			"dataLimitePagamento": "2033-05-22",
			"dataPagamento": "2024-03-27",
			"valorPagoTotal": "900.00"
		}
	],
	"page": {
		"links": {
			"first": "/boleto/v1/boletos?idBeneficiario=150000015605&situacao=empagamento&pageSize=2&page=0&orderBy&order",
			"last": "/boleto/v1/boletos?idBeneficiario=150000015605&situacao=empagamento&pageSize=2&page=433&orderBy&order",
			"previous": "/boleto/v1/boletos?idBeneficiario=150000015605&situacao=empagamento&pageSize=2&page=0&orderBy&order",
			"next": "/boleto/v1/boletos?idBeneficiario=150000015605&situacao=empagamento&pageSize=2&page=1&orderBy&order"
		},
		"page": 0,
		"totalPages": 433,
		"totalElements": 866,
		"pageSize": 2
	}
}
```
</details>

<details>
<summary>Boleto pago</summary>

```json
{
	"data": [
		{
			"idBoleto": "55faa4ad-8734-43a4-93d6-ca0f12f7f2a5",
			"identificadorBoletoMercado": "00006666888800002222444466668888",
			"instrumentoCobranca": "boleto",
			"pagador": {
				"nomePagador": "Juliana Bertoldo",
				"tipoPessoa": "Física",
				"numeroDocumento": "26556923222"
			},
			"indicadorDescontado": false,
			"seuNumero": "123362",
			"dataEntrada": "2023-03-09",
			"dataEmissao": "2023-03-09",
			"dataVencimento": "2023-01-06",
			"valor": "190.00",
			"codigoCarteira": "109",
			"situacao": "pago",
			"nossoNumero": "2",
			"dataLimitePagamento": "2033-01-06",
			"dataPagamento": "2023-03-09",
			"valorPagoTotal": "190.00"
		},
		{
			"idBoleto": "2590e5ea-3bb2-4dcd-8941-775b80242eee",
			"identificadorBoletoMercado": "00007777999911113333555577779999",
			"instrumentoCobranca": "boleto",
			"pagador": {
				"nomePagador": "ERIVAN VEÍCULOS",
				"tipoPessoa": "Física",
				"numeroDocumento": "26556923444"
			},
			"indicadorDescontado": false,
			"seuNumero": "123362",
			"dataEntrada": "2023-03-09",
			"dataEmissao": "2023-03-09",
			"dataVencimento": "2023-01-06",
			"valor": "190.00",
			"codigoCarteira": "109",
			"situacao": "pago",
			"nossoNumero": "3",
			"dataLimitePagamento": "2033-01-06",
			"dataPagamento": "2023-03-09",
			"valorPagoTotal": "190.00"
		}
	],
	"page": {
		"links": {
			"first": "/boleto/v1/boletos?idBeneficiario=150000015605&situacao=pago&pageSize=2&page=0&orderBy&order",
			"last": "/boleto/v1/boletos?idBeneficiario=150000015605&situacao=pago&pageSize=2&page=849&orderBy&order",
			"previous": "/boleto/v1/boletos?idBeneficiario=150000015605&situacao=pago&pageSize=2&page=0&orderBy&order",
			"next": "/boleto/v1/boletos?idBeneficiario=150000015605&situacao=pago&pageSize=2&page=1&orderBy&order"
		},
		"page": 0,
		"totalPages": 849,
		"totalElements": 1699,
		"pageSize": 2
	}
}
```
</details>

<details>
<summary>Boleto cancelado</summary>

```json
{
	"data": [
		{
			"idBoleto": "6e38556c-ca24-4467-aa5a-cf8d043c935a",
			"identificadorBoletoMercado": "00008888000022224444666688880000",
			"instrumentoCobranca": "boleto",
			"pagador": {
				"nomePagador": "MARIA",
				"tipoPessoa": "Física",
				"numeroDocumento": "26556923222"
			},
			"indicadorDescontado": true,
			"seuNumero": "renan_jun",
			"dataEntrada": "2021-09-10",
			"dataEmissao": "2023-09-27",
			"dataVencimento": "2023-11-25",
			"valor": "100.00",
			"codigoCarteira": "109",
			"situacao": "cancelado",
			"nossoNumero": "1",
			"dataLimitePagamento": "2023-09-10",
			"cancelamento": {
				"motivoCancelamento": "baixaSimples",
				"dataCancelamento": "2023-06-17"
			}
		},
		{
			"idBoleto": "5251ed22-85b7-4d2c-b890-b0fae3e8692a",
			"identificadorBoletoMercado": "00009999111133335555777799991111",
			"instrumentoCobranca": "boleto",
			"pagador": {
				"nomePagador": "RENAN",
				"tipoPessoa": "Física",
				"numeroDocumento": "26556923222"
			},
			"indicadorDescontado": false,
			"seuNumero": "renan_jun",
			"dataEntrada": "2021-09-10",
			"dataEmissao": "2023-09-27",
			"dataVencimento": "2023-11-25",
			"valor": "100.00",
			"codigoCarteira": "109",
			"situacao": "cancelado",
			"nossoNumero": "1",
			"dataLimitePagamento": "2023-09-10",
			"cancelamento": {
				"motivoCancelamento": "baixaSimples",
				"dataCancelamento": "2023-06-17"
			}
		}
	],
	"page": {
		"links": {
			"first": "/boleto/v1/boletos?idBeneficiario=150000015605&situacao=cancelado&pageSize=2&page=0&orderBy&order",
			"last": "/boleto/v1/boletos?idBeneficiario=150000015605&situacao=cancelado&pageSize=2&page=16&orderBy&order",
			"previous": "/boleto/v1/boletos?idBeneficiario=150000015605&situacao=cancelado&pageSize=2&page=0&orderBy&order",
			"next": "/boleto/v1/boletos?idBeneficiario=150000015605&situacao=cancelado&pageSize=2&page=1&orderBy&order"
		},
		"page": 0,
		"totalPages": 16,
		"totalElements": 32,
		"pageSize": 2
	}
}
```
</details>

### [POST] ../boletos
API responsável pela emissão de boletos.

Exemplo de entrada:

POST ../boletos
+ Corpo da requisição (application/json)
<details>
<summary>Exemplo de request body</summary>

```json
{
  "beneficiario": {
    "idBeneficiario": "string",
    "nome": "string",
    "tipoPessoa": "string",
    "numeroDocumento": "string",
    "endereco": {
      "logradouro": "string",
      "numero": "string",
      "complemento": "string",
      "bairro": "string",
      "cidade": "string",
      "uf": "string",
      "cep": "string"
    }
  },
  "etapaProcessoBoleto": "string",
  "codigoOperador": "string",
  "codigoCanalOperacao": "string",
  "instrumentoCobranca": "string",
  "formaEnvio": "string",
  "indicadorDescontado": true,
  "protesto": {
    "isProtesto": true,
    "quantidadeDiasProtesto": "30",
    "nomePraca": "string",
    "numeroCartorio": "string",
    "anuencia": "string",
    "protestoFalimentar": "string"
  },
  "negativacao": {
    "isNegativacao": true,
    "codigoSituacaoNegativacao": 0,
    "quantidadeDiasNegativacao": 0,
    "codigoTipoNegativacao": 0,
    "descricao": "string"
  },
  "pagador": {
    "nomePagador": "string",
    "tipoPessoa": "string",
    "numeroDocumento": "string",
    "pagadorEletronicoDda": "string",
    "endereco": {
      "logradouro": "string",
      "numero": "string",
      "complemento": "string",
      "bairro": "string",
      "cidade": "string",
      "uf": "string",
      "cep": "string"
    },
    "telefone": {
      "ddd": "11",
      "numero": "987654321"
    }
  },
  "email": {
    "endereco": "string",
    "assunto": "string",
    "mensagem": "string"
  },
  "beneficiarioFinal": {
    "nomeBeneficiario": "string",
    "tipoPessoa": "string",
    "numeroDocumento": "string",
    "endereco": {
      "logradouro": "string",
      "numero": "string",
      "complemento": "string",
      "bairro": "string",
      "cidade": "string",
      "uf": "string",
      "cep": "string"
    }
  },
  "tipoVencimento": {
    "codigoTipoVencimento": "string",
    "descricaoTipoVencimento": "string"
  },
  "situacaoVencimento": "string",
  "codigoBarras": "string",
  "linhaDigitavel": "string",
  "especie": {
    "codigoEspecie": "string",
    "descricaoEspecie": "string"
  },
  "pagamentoParcial": "string",
  "quantidadeMaximaPagamentoParcial": "string",
  "valorAbatimento": "string",
  "juros": {
    "codigoTipoJuros": "string",
    "quantidadeDiasJuros": 0,
    "valorJuros": "string",
    "percentualJuros": "string"
  },
  "multa": {
    "codigoTipoMulta": "string",
    "quantidadeDiasMulta": 0,
    "valorMulta": "string",
    "percentualMulta": "string"
  },
  "desconto": {
    "descricaoDesconto": "string"
  },
  "recebimentoDivergente": {
    "codigoTipoAutorizacao": "string",
    "codigoTipoRecebimento": "string",
    "valorMinimo": "string",
    "percentualMinimo": "string",
    "valorMaximo": "string",
    "percentualMaximo": "string"
  },
  "codigoMoeda": "string",
  "usoEmpresa": "string",
  "indicadorRateioCredito": "string",
  "rateioCredito": {
    "agencia": "string",
    "contaCorrente": "string",
    "digitoContaCorrente": "string",
    "valorRateio": "string",
    "percentualRateio": "string",
    "rateioCreditoPercentual": "string",
    "rateioCreditoValorLiquido": "string"
  },
  "indicadorDiaUtilInstrucao": "string",
  "indicadorBloqueio": "string",
  "seuNumero": "string",
  "dataEntrada": "2025-12-04",
  "dataEmissao": "2025-12-04",
  "dataVencimento": "2025-12-04",
  "dataPagamento": "2025-12-04",
  "valor": 0,
  "codigoCarteira": "str",
  "situacao": "string",
  "nossoNumero": "string",
  "dataLimitePagamento": "2025-12-04",
  "valorPagoTotal": 0,
  "cancelamento": {
    "motivoCancelamento": "string"
  },
  "dadosQrcode": {
    "chave": "string",
    "idLocation": "string",
    "tipoCobranca": "string"
  }
}
```

</details>

Exemplo de saída:
+ Resposta 200 (application/json)

<details>
<summary>Exemplo de response body</summary>

```json
{
  "data": {
    "idBoleto": "string",
    "beneficiario": {
      "idBeneficiario": "string",
      "nome": "string",
      "tipoPessoa": "string",
      "numeroDocumento": "string",
      "endereco": {
        "logradouro": "string",
        "numero": "string",
        "complemento": "string",
        "bairro": "string",
        "cidade": "string",
        "uf": "string",
        "cep": "string"
      }
    },
    "etapaProcessoBoleto": "string",
    "codigoOperador": "string",
    "codigoCanalOperacao": "string",
    "instrumentoCobranca": "string",
    "formaEnvio": "string",
    "indicadorDescontado": true,
    "protesto": {
      "isProtesto": true,
      "quantidadeDiasProtesto": "30",
      "nomePraca": "string",
      "numeroCartorio": "string",
      "anuencia": "string",
      "protestoFalimentar": "string"
    },
    "negativacao": {
      "isNegativacao": true,
      "codigoSituacaoNegativacao": 0,
      "quantidadeDiasNegativacao": 0,
      "codigoTipoNegativacao": 0,
      "descricao": "string"
    },
    "pagador": {
      "nomePagador": "string",
      "tipoPessoa": "string",
      "numeroDocumento": "string",
      "pagadorEletronicoDda": "string",
      "endereco": {
        "logradouro": "string",
        "numero": "string",
        "complemento": "string",
        "bairro": "string",
        "cidade": "string",
        "uf": "string",
        "cep": "string"
      },
      "telefone": {
        "ddd": "11",
        "numero": "987654321"
      }
    },
    "email": {
      "endereco": "string",
      "assunto": "string",
      "mensagem": "string"
    },
    "beneficiarioFinal": {
      "nomeBeneficiario": "string",
      "tipoPessoa": "string",
      "numeroDocumento": "string",
      "endereco": {
        "logradouro": "string",
        "numero": "string",
        "complemento": "string",
        "bairro": "string",
        "cidade": "string",
        "uf": "string",
        "cep": "string"
      }
    },
    "tipoVencimento": {
      "codigoTipoVencimento": "string",
      "descricaoTipoVencimento": "string"
    },
    "situacaoVencimento": "string",
    "codigoBarras": "string",
    "linhaDigitavel": "string",
    "especie": {
      "codigoEspecie": "string",
      "descricaoEspecie": "string"
    },
    "pagamentoParcial": "string",
    "quantidadeMaximaPagamentoParcial": "string",
    "valorAbatimento": "string",
    "juros": {
      "codigoTipoJuros": "string",
      "quantidadeDiasJuros": 0,
      "valorJuros": "string",
      "percentualJuros": "string"
    },
    "multa": {
      "codigoTipoMulta": "string",
      "quantidadeDiasMulta": 0,
      "valorMulta": "string",
      "percentualMulta": "string"
    },
    "desconto": {
      "descricaoDesconto": "string"
    },
    "recebimentoDivergente": {
      "codigoTipoAutorizacao": "string",
      "codigoTipoRecebimento": "string",
      "valorMinimo": "string",
      "percentualMinimo": "string",
      "valorMaximo": "string",
      "percentualMaximo": "string"
    },
    "codigoMoeda": "string",
    "usoEmpresa": "string",
    "indicadorRateioCredito": "string",
    "rateioCredito": {
      "agencia": "string",
      "contaCorrente": "string",
      "digitoContaCorrente": "string",
      "valorRateio": "string",
      "percentualRateio": "string",
      "rateioCreditoPercentual": "string",
      "rateioCreditoValorLiquido": "string"
    },
    "indicadorDiaUtilInstrucao": "string",
    "indicadorBloqueio": "string",
    "seuNumero": "string",
    "dataEntrada": "2025-12-04",
    "dataEmissao": "2025-12-04",
    "dataVencimento": "2025-12-04",
    "dataPagamento": "2025-12-04",
    "valor": 0,
    "codigoCarteira": "str",
    "situacao": "string",
    "nossoNumero": "string",
    "dataLimitePagamento": "2025-12-04",
    "valorPagoTotal": 0,
    "cancelamento": {
      "motivoCancelamento": "string"
    },
    "dadosQrcode": {
      "chave": "string",
      "idLocation": "string",
      "tipoCobranca": "string"
    }
  }
}
```

</details>

### [GET] ../requisicoes-boletos-negociados/{requisicaoBoletoNegociadoId}

API responsável por retornar dados dos boletos negociados.

- Neste  fluxo para os acesso envolve uma requisição inicial do cliente para instruir um boleto, que é validada.
- Se válida, o cliente recebe um link para consultar o estado da requisição.
- Em seguida, uma segunda requisição é feita para este gateway, que também valida a requisição e busca as informações solicitadas.

| Parâmetro              | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição                                                                                                                                                                                                                                                                                      |
|------------------------|----------------|-----------|-------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `x-itau-apikey`        | header         | string    | sim         | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante.                                                                                                                                                                                     |
| `x-itau-correlationID` | header         | string    | sim         | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes. `Recomenda-se utilizar um uuid version 4 nesse campo. Exemplo: a1e64241-7fdb-4d05-a7f6-c44febcdd8d9`. |
| `Authorization`        | header         | string    | sim         | Bearer Token                                                                                                                                                                                                                                                                                   |

### Glossário
*Para consultar os valores possíveis dos campos a seguir, veja as tabelas abaixo.*

| **Campo**                     | **Descrição**                                                                         |
|-------------------------------|---------------------------------------------------------------------------------------|
| `requisicaoBoletoNegociadoId` | Identificador único da requisição solicitada.                                         |
| `situacaoRequisicao`          | Situações que o processamento da requisição estão (ver tabela "Situação Requisição"). |
| `valorNominal   `             | Valor nominal do boleto.                                                              |
| `dataVencimento `             | Data de vencimento do boleto .                                                        |
| `valorAbatimento `            | Valor já pago do boleto.                                                              |
| `codigoInstrucao `            | Situações do tipo de instrução comando (ver tabela "Tipo Instrução Comando").         |
| `idBoleto`                    | Identificador único do boleto.                                                        |
| `erros`                       | Possiveis erros encontrado durante o processamento da requisição.                     |

### Situação Requisição
| **Situação**               | **Descrição**                                                                                  |
|----------------------------|------------------------------------------------------------------------------------------------|
| `VALIDACAO_POR_ATIVOS`     | A validação está em andamento por ativos.                                                      |
| `VALIDACAO_POR_FALHAS`     | Houve erros durante a validação da requisição.                                                 |
| `PROCESSAMENTO_BOLETO`     | Está em andamento o processamento da requisição do boleto.                                   	 |
| `PROCESSAMENTO_POR_FALHA`  | Houve erros durante o processamento da requisição.                                             |
| `PROCESSAMENTO_FINALIZADO` | Processamento foi finalizado com sucesso.                                                      |

### Tipo Instrução Comando
| **Nome**                        | **Descrição**                                         |
|---------------------------------|-------------------------------------------------------|
| `ABATIMENTO`                    | Abatimento                                            |
| `BAIXA`                         | Baixa Imediata                                        |
| `JUROS`                         | Juros                                                 |
| `MULTA`                         | Multa                                                 |
| `VALOR_NOMINAL`                 | Valor Nominal                                         |
| `DATA_VENCIMENTO`               | Data Vencimento                                       |
| `PROTESTAR`                     | Protestar                                             |
| `NAO_PROTESTAR`                 | Não Protestar                                         |
| `SUSTAR_PROTESTO`               | Sustar Protesto                                       |
| `NEGATIVAR`                     | Negativar                                             |
| `NAO_NEGATIVAR`                 | Não Negativar                                         |
| `CANCELAR_NEGATIVACAO`          | Cancelar Negativação                                  |
| `DESCONTO_FIXO`                 | Desconto Fixo                                         |
| `DESCONTO_PROPORCIONAL`         | Desconto Proporcional                                 |
| `DADOS_PAGADOR`                 | Dados do Pagador                                      |
| `ESPECIE`                       | Espécie                                               |
| `DADOS_BENEFICIARIO`            | Dados do Beneficiário                                 |
| `DATA_LIMITE_PAGAMENTO`         | Data Limite Pagamento                                 |
| `SEU_NUMERO`                    | Seu Número                                            |
| `DADOS_COBRANCA`                | Dados de uma Cobrança                                 |
| `RECEBIMENTO_DIVERGENTE`        | Recebimento divergente                                |
| `BAIXA_PROGRAMADA`              | Baixa Programada                                      |
| `USO_EMPRESA`                   | Uso Empresa ou Texto Beneficiario Cobrança            |
| `TRANSFERENCIA`                 | Transferencia efetiva boletos                         |
| `QR_CODE`                       | Dados de QR Code                                      |
| `OUTROS_DADOS`                  | Alteração de Outros dados do Boleto                   |
| `ATUALIZACAO_MOEDA_ESTRANGEIRA` | Atualização de valor para Boleto de moeda estrangeira |
| `SUSTAR_NAO_PROTESTO `          | Sustar Não Protestar                                  |

Exemplo de entrada:

GET ../requisicoes-boletos-negociados/123e4567-e89b-12d3-a456-426614174000

Exemplo de saída:

+ Exemplos de retornos com sucesso (status 200)

<details>
<summary>Retorno de boleto processado</summary>

```json
{
  "data": [
    {
      "requisicaoBoletoNegociadoId": "123e4567-e89b-12d3-a456-426614174000",
      "situacaoRequisicao": "PROCESSAMENTO_FINALIZADO",
      "valorNominal": 10,
      "dataVencimento": "2025-09-13",
      "valorAbatimento": 10,
      "codigoInstrucao": "BAIXA",
      "idBoleto": "354b4acc-d350-4d60-a10e-a85f42070be6",
      "erros": []
    }
  ]
}

```
</details>

<details>
<summary>Retorno de boleto com validacao de ativos</summary>

```json
{
  "data": [
    {
      "requisicaoBoletoNegociadoId": "123e4567-e89b-12d3-a456-426614174000",
      "situacaoRequisicao": "VALIDACAO_POR_ATIVOS",
      "valorNominal": 10,
      "dataVencimento": "2025-09-13",
      "valorAbatimento": 10,
      "codigoInstrucao": "BAIXA",
      "idBoleto": "354b4acc-d350-4d60-a10e-a85f42070be6",
      "erros": [
        {
          "campo": "abatimento.valorAbatimento",
          "mensagem": "O campo deve estar em um formato válido.",
          "valor": "12,90"
        }
      ]
    }
  ]
}

```
</details>

## **Padrões de erros**
Essa API retorna códigos de status HTTP para indicar sucesso ou falhas das requisições.

Códigos **2xx** indicam sucesso.

Códigos **4xx** indicam falhas causadas pelas informações enviadas pelo cliente ou pelo estado atual das entidades.

Códigos **5xx** indicam problemas no serviço no lado da API.

As respostas de erro incluem no corpo detalhes do erro e o campo type identifica o tipo de erro.

Abaixo estão listados os tipos de erro que podem ser retornados por quaisquer endpoints listados nessa documentação.

| HTTP Status Code           | Descrição                          | Significado                                                                                                              |
|----------------------------|------------------------------------|--------------------------------------------------------------------------------------------------------------------------|                     
| 400 Bad Request            | RequisicaoInvalida                 | requisição inválida                                                                                                      |
| 401 Unauthorized           | NaoAutorizado                      | requisição requer autenticação do usuário                                                                                |
| 405 Method Not Allowed     | MetodoNaoPermitido                 | método HTTP não é permitido para o recurso solicitado                                                                    |
| 403 Forbidden              | AcessoNegado                       | requisição de participante autenticado que viola alguma regra de autorização                                             |
| 404 Not Found	             | NaoEncontrado                      | entidade não encontrada                                                                                                  |
| 410 Gone                   | PermanentementeRemovido            | indica que a entidade existia, mas foi permanentemente removida                                                          |
| 422 Unprocessable Entity   | EntidadeNaoProcessavel             | a requisição está bem formada, mas não pode ser processada devido a erros semânticos                                     |
| 428 Precondition Required  | PreCondicaoRequerida               | o servidor requer que a requisição seja condicional                                                                      |
| 500 Internal Server Error  | ErroInternoDoServidor              | condição inesperada ao processar requisição                                                                              |
| 501 Not Implemented        | NaoImplementado                    | o servidor não suporta a funcionalidade requerida para processar a requisição                                            |
| 503 Service Unavailable    | ServicoIndisponivel                | serviço não está disponível no momento. Serviço solicitado pode estar em manutenção ou fora da janela de funcionamento   |
| 504 Gateway Timeout        | IndisponibilidadePorTempoEsgotado  | indica que o serviço demorou além do esperado para retornar                                                              |

### [GET] ../ativos-financeiros

API responsável por consultar a **coleção** de ativos financeiros vinculados aos boletos de um
cliente de cobrança (beneficiário), combinando as bases interna e externa.

- O parâmetro `numeroIdentificacaoClienteCobranca` é **obrigatório**; os demais filtros são opcionais.
- A requisição é validada e, se válida, retorna os ativos financeiros vinculados ao cliente informado.

> **Paginação (Governança de APIs 2.1 — regra `api-design-guide-033`)**
> - O parâmetro de tamanho de página é `page-size` (kebab-case) e a primeira página é `1`.
> - Quando a coleção completa cabe em uma única resposta, o retorno é `200 OK` **sem** o objeto `pagination`.
> - Quando a coleção não cabe em uma única resposta, o retorno é `206 Partial Content` **com** o objeto `pagination`.
> - Em `pagination.links`, `previous` não é enviado na primeira página e `next` não é enviado na última.
> - Filtros e paginação são aplicados de forma independente.

Entrada(Query)

| Parâmetro | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
|-----------|----------------|-----------|-------------|-----------|
| `numeroIdentificacaoClienteCobranca` | query parameter | UUID | sim | Identificação do cliente de cobrança (beneficiário) dono dos boletos. |
| `numeroIdentificacaoBoleto` | query parameter | UUID | não | Filtra por um boleto específico. Quando informado, a base externa não é consultada. |
| `codigoIdentificacaoBoletoMercado` | query parameter | string | não | Filtra pela identificação do boleto no mercado (Nuclea). |
| `tipoAtivoFinanceiro` | query parameter | string | não | Filtra pelo tipo do ativo financeiro. |
| `ativoFinanceiroId` | query parameter | string | não | Filtra por um ativo financeiro específico. |
| `page` | query parameter | integer | não | Número da página requisitada. A primeira página é `1`. Valor padrão: `1`. |
| `page-size` | query parameter | integer | não | Quantidade total de registros por página. Valor padrão: `25`. Máximo: `100`. |

| Parâmetro              | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição                                                                                                                                                                                                                                                                                      |
|------------------------|----------------|-----------|-------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `x-itau-apikey`        | header         | string    | sim         | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante.                                                                                                                                                                                     |
| `x-itau-correlationID` | header         | string    | sim         | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes. `Recomenda-se utilizar um uuid version 4 nesse campo. Exemplo: a1e64241-7fdb-4d05-a7f6-c44febcdd8d9`. |
| `Authorization`        | header         | string    | sim         | Bearer Token                                                                                                                                                                                                                                                                                   |

### Glossário
*Para consultar os valores possíveis dos campos a seguir, veja as tabelas abaixo.*

| **Campo**                     | **Descrição**                                                                         |
|-------------------------------|---------------------------------------------------------------------------------------|
| `requisicaoBoletoNegociadoId` | Identificador único da requisição solicitada.                                         |
| `situacaoRequisicao`          | Situações que o processamento da requisição estão (ver tabela "Situação Requisição"). |
| `valorNominal   `             | Valor nominal do boleto.                                                              |
| `dataVencimento `             | Data de vencimento do boleto .                                                        |
| `valorAbatimento `            | Valor já pago do boleto.                                                              |
| `codigoInstrucao `            | Situações do tipo de instrução comando (ver tabela "Tipo Instrução Comando").         |
| `idBoleto`                    | Identificador único do boleto.                                                        |
| `erros`                       | Possiveis erros encontrado durante o processamento da requisição.                     |

### Situação Requisição
| **Situação**               | **Descrição**                                                                                  |
|----------------------------|------------------------------------------------------------------------------------------------|
| `VALIDACAO_POR_ATIVOS`     | A validação está em andamento por ativos.                                                      |
| `VALIDACAO_POR_FALHAS`     | Houve erros durante a validação da requisição.                                                 |
| `PROCESSAMENTO_BOLETO`     | Está em andamento o processamento da requisição do boleto.                                   	 |
| `PROCESSAMENTO_POR_FALHA`  | Houve erros durante o processamento da requisição.                                             |
| `PROCESSAMENTO_FINALIZADO` | Processamento foi finalizado com sucesso.                                                      |

### Tipo Instrução Comando
| **Nome**                        | **Descrição**                                         |
|---------------------------------|-------------------------------------------------------|
| `ABATIMENTO`                    | Abatimento                                            |
| `BAIXA`                         | Baixa Imediata                                        |
| `JUROS`                         | Juros                                                 |
| `MULTA`                         | Multa                                                 |
| `VALOR_NOMINAL`                 | Valor Nominal                                         |
| `DATA_VENCIMENTO`               | Data Vencimento                                       |
| `PROTESTAR`                     | Protestar                                             |
| `NAO_PROTESTAR`                 | Não Protestar                                         |
| `SUSTAR_PROTESTO`               | Sustar Protesto                                       |
| `NEGATIVAR`                     | Negativar                                             |
| `NAO_NEGATIVAR`                 | Não Negativar                                         |
| `CANCELAR_NEGATIVACAO`          | Cancelar Negativação                                  |
| `DESCONTO_FIXO`                 | Desconto Fixo                                         |
| `DESCONTO_PROPORCIONAL`         | Desconto Proporcional                                 |
| `DADOS_PAGADOR`                 | Dados do Pagador                                      |
| `ESPECIE`                       | Espécie                                               |
| `DADOS_BENEFICIARIO`            | Dados do Beneficiário                                 |
| `DATA_LIMITE_PAGAMENTO`         | Data Limite Pagamento                                 |
| `SEU_NUMERO`                    | Seu Número                                            |
| `DADOS_COBRANCA`                | Dados de uma Cobrança                                 |
| `RECEBIMENTO_DIVERGENTE`        | Recebimento divergente                                |
| `BAIXA_PROGRAMADA`              | Baixa Programada                                      |
| `USO_EMPRESA`                   | Uso Empresa ou Texto Beneficiario Cobrança            |
| `TRANSFERENCIA`                 | Transferencia efetiva boletos                         |
| `QR_CODE`                       | Dados de QR Code                                      |
| `OUTROS_DADOS`                  | Alteração de Outros dados do Boleto                   |
| `ATUALIZACAO_MOEDA_ESTRANGEIRA` | Atualização de valor para Boleto de moeda estrangeira |
| `SUSTAR_NAO_PROTESTO `          | Sustar Não Protestar                                  |

Exemplo de entrada:

GET ../ativos-financeiros?numeroIdentificacaoClienteCobranca=6de1b913-431c-40aa-a68d-b3ab527511d5&page=1&page-size=25

Exemplo de saída:

+ Exemplos de retornos com sucesso (status 200 quando a coleção completa cabe na resposta;
  status 206 Partial Content quando a coleção é paginada)

<details>
<summary>Retorno paginado (status 206 Partial Content)</summary>

```json
{
  "data": [
    {
      "numeroIdentificacaoBoleto": "ff74625f-9630-4035-9db6-db8e58de0631",
      "ativoFinanceiro": {
        "numeroIdentificacaoAtivoFinanceiro": "ATIV001",
        "tipoAtivoFinanceiro": "DUPLICATA",
        "tipoNegociacao": "CESSAO",
        "codigoEscrituradora": "EC01",
        "dataHoraSituacao": "2024-06-01T10:00:00",
        "pessoaTitular": {
          "codigoIspb": "12345678",
          "tipo": "F",
          "cpfCnpj": "12345678901",
          "razaoSocial": "Empresa A",
          "nomeFantasia": "Fantasia A",
          "enderecoTitular": {
            "logradouro": "Rua A",
            "cidade": "Cidade A",
            "uf": "SP",
            "cep": "87654321"
          },
          "agencia": "101",
          "conta": "10001"
        }
      },
      "situacaoBoleto": "PAGO",
      "codigoIdentificacaoBoletoMercado": "BOLC003",
      "indicadorBoletoDinamico": true,
      "dataHoraBaixa": "2024-06-03T12:10:00",
      "numeroIdentificacaoClienteCobranca": "6de1b913-431c-40aa-a68d-b3ab527511d5"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalRecords": 60,
    "pageSize": 25,
    "hasNext": true,
    "hasPrevious": false,
    "links": {
      "self": "/boleto/v1/ativos-financeiros?numeroIdentificacaoClienteCobranca=6de1b913-431c-40aa-a68d-b3ab527511d5&page=1&page-size=25",
      "first": "/boleto/v1/ativos-financeiros?numeroIdentificacaoClienteCobranca=6de1b913-431c-40aa-a68d-b3ab527511d5&page=1&page-size=25",
      "last": "/boleto/v1/ativos-financeiros?numeroIdentificacaoClienteCobranca=6de1b913-431c-40aa-a68d-b3ab527511d5&page=3&page-size=25",
      "next": "/boleto/v1/ativos-financeiros?numeroIdentificacaoClienteCobranca=6de1b913-431c-40aa-a68d-b3ab527511d5&page=2&page-size=25"
    }
  }
}
```

</details>

**Erros deste recurso**

As respostas de erro deste recurso seguem o formato **Problem Details (RFC 9457)**, com
`Content-Type: application/problem+json`. O campo `detail` sempre explica o motivo real do erro.

| HTTPStatus | `type` | Quando ocorre |
|------------|--------|---------------|
| 400 | `BAD_REQUEST` | Parâmetro obrigatório ausente ou com valor/tipo inválido. O campo `detail` nomeia o parâmetro e `errors` detalha campo a campo. |
| 401 | `UNAUTHORIZED` | Token de autenticação ausente, inválido ou expirado. |
| 403 | `INSUFFICIENT_PERMISSIONS` | A credencial não tem permissão sobre o cliente de cobrança informado. |
| 404 | `RESOURCE_NOT_FOUND` | Não existe cliente de cobrança (beneficiário) para o `numeroIdentificacaoClienteCobranca` informado. |
| 405 | `METHOD_NOT_ALLOWED` | Método HTTP não permitido para o recurso. |
| 500 | `INTERNAL_ERROR` | Erro interno. Nenhum detalhe interno é exposto ao cliente. |

Exemplo de erro — parâmetro obrigatório ausente:
* HTTPStatus - 400

```json
{
  "type": "https://developer.itau.com.br/docs/errors/BAD_REQUEST",
  "title": "Requisição inválida",
  "status": 400,
  "detail": "O parâmetro obrigatório 'numeroIdentificacaoClienteCobranca' não foi informado na requisição.",
  "instance": "/boleto/v1/ativos-financeiros",
  "traceId": "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
  "errors": [
    {
      "field": "numeroIdentificacaoClienteCobranca",
      "message": "O parâmetro 'numeroIdentificacaoClienteCobranca' é obrigatório."
    }
  ]
}
```

Exemplo de erro — cliente de cobrança inexistente:
* HTTPStatus - 404

```json
{
  "type": "https://developer.itau.com.br/docs/errors/RESOURCE_NOT_FOUND",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Não foi encontrado cliente de cobrança (beneficiário) para o numeroIdentificacaoClienteCobranca informado.",
  "instance": "/boleto/v1/ativos-financeiros",
  "traceId": "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
  "errors": [
    {
      "field": "numeroIdentificacaoClienteCobranca",
      "message": "Não foi encontrado cliente de cobrança (beneficiário) para o numeroIdentificacaoClienteCobranca informado.",
      "value": "6de1b913-431c-40aa-a68d-b3ab527511d5"
    }
  ]
}
```

<details>
<summary>Retorno de boleto processado</summary>

```json
{
  "data": [
    {
      "numeroIdentificacaoBoleto": "ff74625f-9630-4035-9db6-db8e58de0631",
      "ativoFinanceiro": {
        "numeroIdentificacaoAtivoFinanceiro": "ATIV001",
        "tipoAtivoFinanceiro": "DUPLICATA",
        "tipoNegociacao": "CESSAO",
        "codigoEscrituradora": "EC01",
        "dataHoraSituacao": "2024-06-01T10:00:00",
        "pessoaTitular": {
          "codigoIspb": "12345678",
          "tipo": "F",
          "cpfCnpj": "12345678901",
          "razaoSocial": "Empresa A",
          "nomeFantasia": "Fantasia A",
          "enderecoTitular": {
            "logradouro": "Rua A",
            "cidade": "Cidade A",
            "uf": "SP",
            "cep": "87654321"
          },
          "agencia": "101",
          "conta": "10001",
          "tipoContaTitularDireito": "CC",
          "digitoContaTitularDireito": "5"
        }
      },
      "situacaoBoleto": "PAGO",
      "codigoIdentificacaoBoletoMercado": "BOLC003",
      "indicadorBoletoDinamico": true,
      "dataHoraBaixa": "2024-06-03T12:10:00",
      "numeroIdentificacaoClienteCobranca": "bf959426-3e5f-4346-bdb0-1034a0876930"
    }
  ]
}

```
</details>

## **Padrões de erros**
Essa API retorna códigos de status HTTP para indicar sucesso ou falhas das requisições.

Códigos **2xx** indicam sucesso.

Códigos **4xx** indicam falhas causadas pelas informações enviadas pelo cliente ou pelo estado atual das entidades.

Códigos **5xx** indicam problemas no serviço no lado da API.

As respostas de erro incluem no corpo detalhes do erro e o campo type identifica o tipo de erro.

Abaixo estão listados os tipos de erro que podem ser retornados por quaisquer endpoints listados nessa documentação.

| HTTP Status Code           | Descrição                          | Significado                                                                                                              |
|----------------------------|------------------------------------|--------------------------------------------------------------------------------------------------------------------------|                     
| 400 Bad Request            | RequisicaoInvalida                 | requisição inválida                                                                                                      |
| 401 Unauthorized           | NaoAutorizado                      | requisição requer autenticação do usuário                                                                                |
| 405 Method Not Allowed     | MetodoNaoPermitido                 | método HTTP não é permitido para o recurso solicitado                                                                    |
| 403 Forbidden              | AcessoNegado                       | requisição de participante autenticado que viola alguma regra de autorização                                             |
| 404 Not Found	             | NaoEncontrado                      | entidade não encontrada                                                                                                  |
| 410 Gone                   | PermanentementeRemovido            | indica que a entidade existia, mas foi permanentemente removida                                                          |
| 422 Unprocessable Entity   | EntidadeNaoProcessavel             | a requisição está bem formada, mas não pode ser processada devido a erros semânticos                                     |
| 428 Precondition Required  | PreCondicaoRequerida               | o servidor requer que a requisição seja condicional                                                                      |
| 500 Internal Server Error  | ErroInternoDoServidor              | condição inesperada ao processar requisição                                                                              |
| 501 Not Implemented        | NaoImplementado                    | o servidor não suporta a funcionalidade requerida para processar a requisição                                            |
| 503 Service Unavailable    | ServicoIndisponivel                | serviço não está disponível no momento. Serviço solicitado pode estar em manutenção ou fora da janela de funcionamento   |
| 504 Gateway Timeout        | IndisponibilidadePorTempoEsgotado  | indica que o serviço demorou além do esperado para retornar                                                              |

