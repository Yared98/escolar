# API Boletos - Consulta de detalhe do Boleto (v1.3.0)

Fonte: https://devportal.itau.com.br/nossas-apis/itau-ep9-gtw-boletoscash-boletoscash-v2-ext-aws (aba visão geral, atualizada em 2026-10-14T14:16:34.000Z)
Sandbox: https://sandbox.devportal.itau.com.br/itau-ep9-gtw-boletoscash-boletoscash-v2-ext-aws/v1
Spec: ../openapi/itau-ep9-gtw-boletoscash-boletoscash-v2-ext-aws.json

---



## **sobre a API**

Manual das API's de Consultas
A solução de Cobrança Itaú através de API visa reinventar a experiência de recebimento pelas suas vendas e/ou serviços prestados com a emissão de boletos. Ela oferece agilidade operacional, soluções que trazem flexibilidade ao pagador e ferramentas de conciliação que dão rapidez ao processo de identificação e liberação de pedidos.
Nessa documentação, iremos apresentar todo o passo a passo para desenvolvimento dessa solução que ajudará sua empresa a ser mais eficiente no processo de recebimento. 

## **para quem é esta API?**
Com as Novas APIs de Boletos do Itaú, a sua empresa terá o máximo em agilidade e segurança para emitir, comandar instruções e alterações, além de consultar o status de seus boletos. 

## **restrições de uso**
Para começar a sua jornada de desenvolvimento é importante que o ambiente esteja preparado e configurado para realizar os testes e suportar o desenvolvimento da aplicação de maneira segura. Nosso modelo de comunicação atual requer a autenticação do parceiro através do fluxo **OAuth 2.0**, conforme especificado em documentação no portal do desenvolvedor.

## **conhecimentos técnicos necessários**
Conhecimentos prévios necessários:

`HTTP` `JSON` `Postman`

## **quais necessidades que essa API ajuda a resolver?**
O objetivo desta documentação é orientar o desenvolvedor sobre como integrar com a solução de APIs para alteração de dados, comando de instruções e consulta de boletos do Itaú. Apresentaremos no decorrer desse documento as informações necessárias para compreender o fluxo dos dados entre as APIs, dicas que auxiliarão no momento da implantação e exemplos.

O passo a passo descrito abaixo demonstra como é o processo de registro de boletos de cobrança através dessa solução.

| 1 | 2 | 3 |
|---|---|---|
| Registro do boleto | Disponiblização ao pagador |	Pagamento do boleto |
|Sua empresa envia o compromisso (individualmente) ao banco através da API, e o banco registra este na CIP | Banco retorna com informação individual do registro do boleto via API, e sua empresa disponibiliza o boleto ao seu cliente no formato desejado | Seu cliente escolhe o canal mais conveniente para realizar o pagamento |

Após emitir um boleto, é possível alterar alguns dados, comandar uma instrução para o boleto ou consultar os boletos. Os comandos de instruções podem ser realizados pelo beneficiário (contratante do serviço de Cobrança e quem cedeu os boletos de crédito ao Banco para que esse realizasse a sua cobrança). No entanto, este beneficiário deve estar habilitado a realizar o comando de instrução, ou seja, ter a cobrança contratada, não ter pendência de contrato, não ter a conta migrada e nem sustada.

## **tempo aproximado para integração**
**1 dias:** essa é a média de tempo que um desenvolvedor pode levar para preparar toda a integração com essa API. Isso pode variar de acordo com o tamanho do time e experiência dos desenvolvedores envolvidos.

## **endpoints**<itemopcional>

| Ambiente | Endpoint                                                           |    
|----------|--------------------------------------------------------------------| 
| Sandbox  | https://devportal.itau.com.br/sandboxapi/cash_management_ext_v2/v2 |
| Produção | https://secure.api.cloud.itau.com.br/boletoscash/v2/               |

Todas as requisições devem usar o *schema https* por questões de segurança.

**Parâmetros comuns de cabeçalho**
Para consumo das APIs do Itaú, alguns parâmetros de cabeçalho são necessários:

*x-itau-apikey*

O *x-itau-apikey* é um parâmetro que será requerido em todas as chamadas das APIs que contemplam essa solução. A informação que deve ser usada nesse campo é o código gerado através da autenticação OAuth 2.0 para o client_id. Para saber como gerar o client_id ou como recuperar as informações de códigos já gerados basta acessar a etapa de ‘autenticação’ desse tutorial.

*x-itau-flowID*

A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. Recomenda-se mandar um uuid version 4 nesse campo como: b47ec51b-b2a7-4a78-933c-f0b67667e7dc.

*x-itau-correlationID*

A implementação de um correlationID permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes, conseguindo fornecer um mapeamento de ponta-a-ponta. Por exemplo, uma aplicação client gera uma chamada à API, neste momento fornecendo o correlationID gerado pelo consumidor, o qual é repassado em todas as camadas/microserviços que a api precisa para realizar determinada funcionalidade. É importante lembrar que o header x-itau-correlationID deve sempre ser diferente a cada requisição. Recomenda-se mandar um uuid version 4 nesse campo como: a1e64241-7fdb-4d05-a7f6-c44febcdd8d9.

**Body:**
Campos de entrada descritos nas outras seções.

**API Consulta de Detalhes do Boleto**

**Guia de Implementação da Solução**
A empresa parceira que utilizará a API Consulta de Detalhes do Boleto do Banco Itaú, deverá previamente ser cadastrada pelo Banco no Sistema Autorizador interno. Ao realizar este cadastro, o Banco retornará ao cliente três parâmetros para uso do autorizador (client_id, client_secret e grant_type). Estes três parâmetros servirão para que o STS, ao recebê-los via método POST (*Endpoint* https://sts.itau.com.br/api/oauth/token, retorne ao usuário um *Token*  de acesso que deverá ser validado pela API. Confira abaixo: 

*Tecnicamente, todas as requisições ao Endpoint do STS devem ser realizadas por usuários que estejam previamente cadastrados no Banco. A autenticação deve ser feita via header no POST.*

**Consulta Detalhes do Boleto**
**[GET] /boletos**

API responsável por retornar os detalhes do boleto, tais como: dados do pagador, beneficiário, beneficiário final, dados de pagamentos, histórico.

Os status dos boletos elegíveis para serem consultados são:
* Em Aberto;
* Aguardando Confirmação de Pagamento;
* Paga;
* Baixada;

Para boletos baixados:
Quando o motivo da baixa for “baixa por ter sido liquidado”, o boleto foi pago por meio de um Qr Code

**Scopes**
Para que o cliente consiga acessar nossa API de consulta de boletos, na hora do cadastro da aplicação consumidora no portal de certificados de parceiro, deve ser adicionado o scope/funcionalidade: **boletoscash-boletos-consulta_titulo**

**Parâmetros para a Consulta**
| **Parâmetro**          | **Tipo Parâmetro** | **Tipo Dado** | **Obrigatório** | **Descrição**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
|------------------------|--------------------|---------------|-----------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `x-itau-apikey`        | header             | string        | sim             | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `x-itau-correlationID` | header             | string        | sim             | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes.                                                                                                                                                                                                                                                                                                                                                                                                 |
| `x-itau-flowID`        | header             | string        | sim             | A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. 
| `id_beneficiario`      | param              | integer       | sim             | Dados para identificação do boleto para consulta, sendo composto por:   Código Agência - Obrigatório (4 caracteres), Código Conta - Obrigatório (7 caracteres), DAC - Obrigatório (1 caractere)                                                                                                                                                                                                                                                                                                                                                                                          |
| `codigo_carteira`      | param              | integer       | sim             | Código da carteira do boleto                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `nosso_numero`         | param              | integer       | sim             | Número de identificação do boleto                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `motivo_baixa`         | param              | string        | não             | Código numérico do motivo da baixa realizada no boleto. Combinado com `situacao_boleto=8` (baixado), diferencia os boletos pagos por QR Code: `3` (baixa por ter sido liquidado) retorna somente os pagos por QR Code (com valor total pago) e `10` retorna todos os baixados exceto os pagos por QR Code.                                                                                                                                                                                                                                                                                 |

**URLs Gateway de Parceiros Externos**

| **Ambiente** | **URL**                      | **Exemplo**                                                                                                                                                             |
|--------------|------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Produção     | secure.api.cloud.itau.com.br | https://secure.api.cloud.itau.com.br/boletoscash/v2/boletos?id_beneficiario={id_beneficiario}&codigo_carteira={codigo_carteira}&nosso_numero={nosso_numero}&view={view} |

**Exemplo de Entrada**

+ **GET ../boletos?id_beneficiario=123456789012&codigo_carteira=123&nosso_numero=1234567890123456&view=specific**

## **padrões de erros**
Essa API retorna códigos de status HTTP para indicar sucesso ou falhas das requisições.

Códigos **2xx** indicam sucesso.

Códigos **4xx** indicam falhas causadas pelas informações enviadas pelo cliente ou pelo estado atual das entidades.

Códigos **5xx** indicam problemas no serviço no lado da API.

As respostas de erro incluem no corpo detalhes do erro e o campo type identifica o tipo de erro.

Abaixo estão listados os tipos de erro que podem ser retornados por quaisquer endpoints listados nessa documentação.

| HTTP Status Code | Descrição  | Significado|
|------------------| -----------|------------|                     
| 400 Bad Request  | RequisicaoInvalida | Parâmetros incorretos |
| 401 Unauthorized | NaoAutorizado | requisição de participante não autenticado |
| 403 Forbidden  | AcessoNegado | requisição de participante autenticado que viola alguma regra de autorização |
| 404 Not Found	  | NaoEncontrado | Recurso inexistente |
| 405 Method Not Allowed | MetodoNaoPermitido | Método não permitido |
| 422 Unprocessable Entity | EntidadeNaoProcessavel | Dados informados estão fora do escopo definido para o campo |
| 428 Precondition Required | PrecondicaoNecessaria | Condição necessária para a requisição não foi atendida |
| 429 Rate Limit | ErroInternoDoServidor | Limite de requisições excedido (Too Many Requests). Recomendamos realizar nova chamada. ** |
| 500 Internal Server Error | ErroInternoDoServidor | condição inesperada ao processar requisição |
| 501 Not Implemented | NaoImplementado | Método não implementado |
| 503 Service Unavailable | ServicoIndisponivel | serviço não está disponível no momento. Serviço solicitado pode estar em manutenção ou fora da janela de funcionamento |

  **  *O limite de requisições para esta API é de 1200 chamadas por período definido (simultâneas). Esse controle é implementado para garantir a estabilidade e a disponibilidade do serviço para todos os usuários. Caso o limite seja excedido, novas requisições serão temporariamente bloqueadas até que o período seja renovado.*

**Glossário**
*Para verificar possiveis valores para os seguintes campos verificar tabelas abaixo*

| **Campo**                        | **Descrição**                                                                                                                                                                             |
|----------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `codigo_tipo_pessoa`             | Código de identificação do tipo de pessoa, podendo ser `F` para pessoa física ou `J` para pessoa jurídica                                                                                 |
| `descricao_instrumento_cobranca` | Tipo de instrumento de cobrança                                                                                                                                                           |
| `forma_envio`                    | Forma do qual o boleto será enviado para o cliente                                                                                                                                        |
| `tipo_boleto`                    | Identificador de tipo do boleto                                                                                                                                                           |
| `situacao_geral_boleto`          | Situações que o boleto pode ter em seu ciclo de vida                                                                                                                                      |
| `status_vencimento`              | Situação de vencimento do boleto, podendo ser `a vencer` para boletos em aberto ou `vencida` para boletos vencidos                                                                        |
| `codigo_especie`                 | Código da espécie do boleto                                                                                                                                                               |
| `descricao_especie`              | Descrição da espécie do boleto                                                                                                                                                            |
| `codigo_aceite`                  | Código que indica se a duplicata mercantil que originou o boleto possui aceite do Pagador, podendo ser `S` para aceito e `N`para não aceito                                               |
| `codigo_tipo_protesto`           | Código que indica a situação atual de protesto do boleto                                                                                                                                  |
| `codigo_tipo_vencimento`         | Código que indica o tipo de vencimento do boleto, podendo ser `1` para vencimento do boleto no mesmo dia de sua emissão ou `3` para vencimento do boleto na data determinada pelo cliente |
| `indicador_bloqueio`             | Código que indica se existe bloqueio de pagamento do boleto, podendo ser `S` para pagamento com bloqueio e `N`para pagamento sem bloqueio                                                 |

**Situação Boleto / Situação Geral Boleto**

| **Código** | **Situação**                        | **Descrição**                                                                                                                                                    |
|------------|-------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `1`        | Em Aberto                           | Boleto em aberto que não foi pago ou baixado. O pagador pode efetuar o pagamento do boleto normalmente                                                           |
| `2`        | Aguardando Confirmação de Pagamento | Boleto com confirmação de pagamento realizado em outra instituição financeira, em que o valor ainda não foi recebido pelo Itaú e transferido para o beneficiário |
| `4`        | Paga                                | Boleto pago em seu valor total a ser disponibilizado ao beneficiário de acordo com o floating contratado.                                            	           |
| `8`        | Baixada                             | Boleto cancelado: boleto foi baixado por solicitação do cliente ou por decurso de prazo (baixa automática pelo sistema).                                         |

**Descrição Instrumento Cobrança**

| **Retorno**        | **Descrição**                                                     |
|--------------------|-------------------------------------------------------------------|
| `boleto`           | Boleto padrão                                                     |
| `bolecode`         | Boleto com QR code que permite que o pagamento seja feito via PIX |

**Forma Envio**

| **Retorno** | **Descrição**                                                         |
|-------------|-----------------------------------------------------------------------|
| `impressão` | Boleto disponibilizado para o pagador por meio de arquivo pdf na tela |
| `postagem`  | Boleto enviado para o pagador em sua residencia via correspondencia   |
| `email`     | Boleto enviado para o pagador via email                               |

**Tipo Boleto**

| **Retorno** | **Descrição**                                   |
|-------------|-------------------------------------------------|
| `a vista`   | Boleto emitido à vista                          |
| `parcelado` | Boleto emitido em parcelas                      |
| `proposta`  | Boleto emitido com oferta de produto ou serviço |

**Código Espécie e Descrição Espécie**

| **Código** | **Descrição Espécie**                                                            |
|------------|----------------------------------------------------------------------------------|
| `01`       | DM - Duplicata Mercantil                                                         |
| `02`       | NP - Nota Promissória                                                            |
| `03`       | NS Nota de Seguro                                                                |
| `04`       | ME - Mensalidade Escolar                                                         |
| `05`       | RC Recibo                                                                        |
| `06`       | CT - Contrato                                                                    |
| `07`       | Cosseguros                                                                       |
| `08`       | DS - Duplicata de Serviço                                                        |
| `09`       | LC - Letra de Câmbio                                                             |
| `13`       | Nota de débitos                                                                  |
| `14`       | CBI - Cédula de crédito Bancário por Indicação                                   |
| `15`       | DD - Documento de Dívida                                                         |
| `16`       | EC - Encargos condominiais                                                       |
| `17`       | FS - Prestação de Serviços                                                       |
| `18`       | BDP - Boleto proposta                                                            |
| `88`       | CBI - Cédula de crédito Bancário por Indicação                                   |
| `89`       | CC - Contrato de Câmbio                                                          |
| `90`       | CCB - Cédula de Crédito Bancário                                                 |
| `91`       | CD - Confissão de Dívida apenas para falência uma declaração do devedor          |
| `92`       | CH - Cheque                                                                      |
| `93`       | CM - Contrato de Mútuo                                                           |
| `94`       | CPS - Conta de Prestação de Serv. de prof. liberal ou declaração do profissional |
| `95`       | DMI - Duplicata de venda Mercantil por Indicação                                 |
| `96`       | DSI - Duplicata de prestação de Serviços por Indicação de comprovante            |
| `97`       | RA - Recibo de Aluguel para pessoa jurídica (contrato aluguel e recibo)          |
| `98`       | TA - Termo de Acordo                                                             |
| `33`       | BOLETO APORTE                                                                    |
| `99`       | DV - Diversos                                                                    |

**Código Tipo Protesto**

| **Código** | **Descrição**                                                                                                                   |
|------------|---------------------------------------------------------------------------------------------------------------------------------|
| `1`        | Protesto Agendado, o boleto será enviado para protesto quando estiver vencido pela quantidade de dias estabelecida pelo cliente |
| `3`        | Protesto Falimentar, Protesto solicitado para fins falimentares                                                                 |
| `4`        | Não Protestar, cancela o status `1` de protesto agendado, boleto não será enviado para protesto                                 |

**Código Tipo Vencimento**

| **Código** | **Situação**                                          |
|------------|-------------------------------------------------------|
| `1`        | Vencimento do boleto no mesmo dia de sua emissão      |
| `3`        | Vencimento do boleto na data determinada pelo cliente |

**Código canal pagamento**

| **Código** | **Descrição**     	    |
|------------|------------------------------|
| `1`        | Agência      	 	    |
| `2`        | Terminal de caixa 	    |
| `3`        | Internet          	    |
| `4`        | Não identificado  	    |
| `5`        | Correspondente bancário      |
| `6`        | Bankfone 		    |
| `7`        | Arquivo      		    |
| `8`        | DDA 			    |
| `9`        | Corban digital      	    |

**Código Meio pagamento**

| **Código** | **Descrição**           |
|------------|-------------------------|
| `1`        | Espécie      	       |
| `2`        | Débito em conta         |
| `3`        | Cartão de crédito       |
| `4`        | Cheque      	       |
| `5`        | Não identificado        |

**Código Tipo Recebimento**

| **Código** | **Descrição**           |
|------------|-------------------------|
| `V`        | Valor      	       |
| `P`        | Percentual              |

**Código Tipo Autorização**

| **Código** | **Descrição**           									|
|------------|------------------------------------------------------------------------------------------|
| `01`        | Quando o título aceita qualquer valor divergente ao da cobrança      	       		|
| `02`        | Quando o título contém uma faixa de valores aceitos para recebimentos divergentes       |
| `03`        | Quando o título não deve aceitar pagamentos de valores divergentes ao da cobrança       |
| `04`        | Quando o título aceitar pagamentos de valores superiores ao mínimo definido      	|

Chamada da API
```
/boletos
```

**Exemplo de Saída**

+ Possíveis retornos quando a solicitação for retornada com sucesso (status 200)

<details>
<summary>Boleto Emitido</summary>

```json
{
  "data": [
    {
      "id_boleto": "abc25217-c383-4655-b44f-1087a2d2b80f",
      "beneficiario": {
        "id_beneficiario": "150000011091",
        "nome_cobranca": "Nome Completo Beneficiario Teste",
        "tipo_pessoa": {
          "codigo_tipo_pessoa": "J",
          "numero_cadastro_nacional_pessoa_juridica": "04210525000102"
        },
        "endereco": {
          "nome_logradouro": "RUA TESTE TESTE, 546",
          "nome_bairro": "BAIRRO TESTE",
          "nome_cidade": "CIDADE TESTE",
          "sigla_UF": "PE",
          "numero_CEP": "51170580"
        }
      },
      "dado_boleto": {
        "descricao_instrumento_cobranca": "BoleCode",
        "forma_envio": "email",
        "tipo_boleto": "a vista",
        "quantidade_parcelas": 0,
        "pagador": {
          "pessoa": {
            "nome_pessoa": "Nome Pagador Teste",
            "tipo_pessoa": {
              "codigo_tipo_pessoa": "F",
              "numero_cadastro_pessoa_fisica": "53379284815"
            }
          },
          "endereco": {
            "nome_logradouro": "R PARA TESTE, TESTE",
            "nome_bairro": "BAIRRO TESTE TESTE",
            "nome_cidade": "CIDADE TESTE TESTE",
            "sigla_UF": "RJ",
            "numero_CEP": "05069010"
          },
          "email": "teste@teste.teste",
          "pagador_eletronico_DDA": true,
          "praca_protesto": true
        },
        "codigo_carteira": "157",
        "dados_individuais_boleto": [
          {
            "situacao_geral_boleto": "Em Aberto",
            "status_vencimento": "A vencer",
            "numero_nosso_numero": "47001",
            "data_vencimento": "2024-10-05",
            "valor_titulo": "100.00",
            "texto_seu_numero": "024081/01",
            "dac_titulo": 2,
            "codigo_barras": "34191973800014313911570004776121500640800000",
            "numero_linha_digitavel": "34191570070477612722972968650001197380001400000",
            "data_limite_pagamento": "2034-06-05"
          }
        ],
        "codigo_especie": "01",
        "descricao_especie": "DM - Duplicata Mercantil",
        "codigo_aceite": "S",
        "data_emissao": "2024-05-28",
        "pagamento_parcial": false,
        "quantidade_maximo_parcial": 0,
        "negativacao": {
        },
        "codigo_tipo_vencimento": 3,
        "historico": [
          {
            "data": "2024-05-28",
            "operacao": "ENTRADA TITULO",
            "comandado_por": "150001109",
            "canal_origem": "BKL"
          }
        ],
        "recebimento_divergente": {
          "codigo_tipo_autorizacao": "02",
          "codigo_tipo_recebimento": "P",
          "valor_minimo": "0.00",
          "percentual_minimo": "95.00000",
          "valor_maximo": "0.00",
          "percentual_maximo": "105.00000"
        },
        "indicador_bloqueio": "N"
      },
      "acoes_permitidas": {
        "emitir_segunda_via": true,
        "comandar_instrucao_alterar_dados_cobranca": true
      }
    }
  ],
  "page": {
    "links": {
      "first": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste&nosso_numero=00047001&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC",
      "last": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste&nosso_numero=00047001&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC",
      "previous": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste&nosso_numero=00047001&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC",
      "next": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste&nosso_numero=00047001&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC"
    },
    "page": 0,
    "total_pages": 0,
    "total_elements": 1,
    "page_size": 20
  }
}
```

</details>

<details>
<summary>Boleto Liquidado/Pago</summary>

```json
{
	"data": [
		{
			"id_boleto": "abc25217-c383-4655-b44f-1087a2d2b80f",
			"beneficiario": {
				"id_beneficiario": "150000011091",
				"nome_cobranca": "Nome Completo Beneficiario Teste",
				"tipo_pessoa": {
					"codigo_tipo_pessoa": "J",
					"numero_cadastro_nacional_pessoa_juridica": "04210525000102"
				},
				"endereco": {
					"nome_logradouro": "RUA TESTE TESTE, 546",
					"nome_bairro": "BAIRRO TESTE",
					"nome_cidade": "CIDADE TESTE",
					"sigla_UF": "PE",
					"numero_CEP": "51170580"
				}
			},
			"dado_boleto": {
				"descricao_instrumento_cobranca": "BoleCode",
				"forma_envio": "email",
				"tipo_boleto": "a vista",
				"quantidade_parcelas": 0,
				"pagador": {
					"pessoa": {
						"nome_pessoa": "Nome Pagador Teste",
						"tipo_pessoa": {
							"codigo_tipo_pessoa": "F",
							"numero_cadastro_pessoa_fisica": "53379284815"
						}
					},
					"endereco": {
						"nome_logradouro": "R PARA TESTE, TESTE",
						"nome_bairro": "BAIRRO TESTE TESTE",
						"nome_cidade": "CIDADE TESTE TESTE",
						"sigla_UF": "RJ",
						"numero_CEP": "05069010"
					},
					"email": "teste@teste.teste",
					"pagador_eletronico_DDA": true,
					"praca_protesto": true
				},
				"codigo_carteira": "157",
				"dados_individuais_boleto": [
					{
						"situacao_geral_boleto": "Paga",
						"status_vencimento": "A vencer",
						"numero_nosso_numero": "47001",
						"data_vencimento": "2024-10-05",
						"valor_titulo": "100.00",
						"texto_seu_numero": "024081/01",
						"dac_titulo": 2,
						"codigo_barras": "34191973800014313911570004776121500640800000",
						"numero_linha_digitavel": "34191570070477612722972968650001197380001400000",
						"data_limite_pagamento": "2034-06-05"
					}
				],
				"codigo_especie": "01",
				"descricao_especie": "DM - Duplicata Mercantil",
				"codigo_aceite": "S",
				"data_emissao": "2024-05-28",
				"pagamento_parcial": false,
				"quantidade_maximo_parcial": 0,
				"negativacao": {
				},
				"codigo_tipo_vencimento": 3,
				"pagamentos_cobranca": [
					{
						"numero_agencia_recebedora": "4320",
						"data_inclusao_pagamento": "2024-05-29T00:00:00",
						"valor_pago_total_cobranca": "100.00",
						"codigo_instituicao_financeira_pagamento": "212",
						"descricao_canal_pagamento": "4",
						"descricao_meio_pagamento": "5"
					}
				],
				"historico": [
					{
						"data": "2024-05-29",
						"operacao": "TITULO LIQUIDADO",
						"comandado_por": "SISTEMA",
						"canal_origem": "SIS"
					},
					{
						"data": "2024-05-28",
						"operacao": "ENTRADA TITULO",
						"comandado_por": "150001109",
						"canal_origem": "BKL"
					}
				],
				"recebimento_divergente": {
					"codigo_tipo_autorizacao": "02",
					"codigo_tipo_recebimento": "P",
					"valor_minimo": "0.00",
					"percentual_minimo": "95.00000",
					"valor_maximo": "0.00",
					"percentual_maximo": "105.00000"
				},
				"indicador_bloqueio": "N"
			},
			"acoes_permitidas": {
				"emitir_segunda_via": false,
				"comandar_instrucao_alterar_dados_cobranca": false
			}
		}
	],
	"page": {
		"links": {
			"first": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste&nosso_numero=00047001&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC",
			"last": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste&nosso_numero=00047001&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC",
			"previous": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste&nosso_numero=00047001&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC",
			"next": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste&nosso_numero=00047001&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC"
		},
		"page": 0,
		"total_pages": 0,
		"total_elements": 1,
		"page_size": 20
	}
}
```

</details>

<details>
<summary>Boleto Baixado</summary>

```json
{
	"data": [
		{
			"id_boleto": "98219b2f-f9f3-431b-a806-6f6599419f28",
			"beneficiario": {
				"id_beneficiario": "150000011091",
				"nome_cobranca": "Nome Completo Beneficiario Teste",
				"tipo_pessoa": {
					"codigo_tipo_pessoa": "J",
					"numero_cadastro_nacional_pessoa_juridica": "04210525000102"
				},
				"endereco": {
					"nome_logradouro": "RUA TESTE TESTE, 546",
					"nome_bairro": "BAIRRO TESTE",
					"nome_cidade": "CIDADE TESTE",
					"sigla_UF": "PE",
					"numero_CEP": "51170580"
				}
			},
			"dado_boleto": {
				"descricao_instrumento_cobranca": "BoleCode",
				"forma_envio": "email",
				"tipo_boleto": "a vista",
				"quantidade_parcelas": 0,
				"pagador": {
					"pessoa": {
						"nome_pessoa": "Nome Pagador Teste",
						"tipo_pessoa": {
							"codigo_tipo_pessoa": "F",
							"numero_cadastro_pessoa_fisica": "53379284815"
						}
					},
					"endereco": {
						"nome_logradouro": "R PARA TESTE, TESTE",
						"nome_bairro": "BAIRRO TESTE TESTE",
						"nome_cidade": "CIDADE TESTE TESTE",
						"sigla_UF": "RJ",
						"numero_CEP": "05069010"
					},
					"email": "teste@teste.teste",
					"pagador_eletronico_DDA": true,
					"praca_protesto": true
				},
				"codigo_carteira": "157",
				"dados_individuais_boleto": [
					{
						"situacao_geral_boleto": "Baixada",
						"status_vencimento": "A vencer",
						"numero_nosso_numero": "47002",
						"data_vencimento": "2024-10-05",
						"valor_titulo": "100.00",
						"texto_seu_numero": "024081/01",
						"dac_titulo": 2,
						"codigo_barras": "34191973800014313911570004776121500640800000",
						"numero_linha_digitavel": "34191570070477612722972968650001197380001400000",
						"data_limite_pagamento": "2034-06-05"
					}
				],
				"codigo_especie": "01",
				"descricao_especie": "DM - Duplicata Mercantil",
				"codigo_aceite": "S",
				"data_emissao": "2024-05-28",
				"pagamento_parcial": false,
				"quantidade_maximo_parcial": 0,
				"negativacao": {
				},
				"codigo_tipo_vencimento": 3,
				"baixa": {
					"data_inclusao_alteracao_baixa": "2024-08-29T00:00:00",
					"motivo_baixa": "Baixa simples"
				},
				"historico": [
					{
						"data": "2024-08-29",
						"operacao": "BAIXAR E DEVOLVER",
						"comandado_por": "331118960"
					},
					{
						"data": "2024-05-28",
						"operacao": "ENTRADA TITULO",
						"comandado_por": "150001109",
						"canal_origem": "BKL"
					}
				],
				"recebimento_divergente": {
					"codigo_tipo_autorizacao": "02",
					"codigo_tipo_recebimento": "P",
					"valor_minimo": "0.00",
					"percentual_minimo": "95.00000",
					"valor_maximo": "0.00",
					"percentual_maximo": "105.00000"
				},
				"indicador_bloqueio": "N"
			},
			"acoes_permitidas": {
				"emitir_segunda_via": false,
				"comandar_instrucao_alterar_dados_cobranca": false
			}
		}
	],
	"page": {
		"links": {
			"first": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste&nosso_numero=00047002&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC",
			"last": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste&nosso_numero=00047002&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC",
			"previous": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste&nosso_numero=00047002&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC",
			"next": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste&nosso_numero=00047002&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC"
		},
		"page": 0,
		"total_pages": 0,
		"total_elements": 1,
		"page_size": 20
	}
}
```

</details>

<details>
<summary>Protesto Agendado</summary>

```json
{
	"data": [
		{
			"id_boleto": "2532efea-107b-49be-8653-882e00f32eeb",
			"beneficiario": {
				"id_beneficiario": "150000011091",
				"nome_cobranca": "Nome Completo Beneficiario Teste",
				"tipo_pessoa": {
					"codigo_tipo_pessoa": "J",
					"numero_cadastro_nacional_pessoa_juridica": "04210525000102"
				},
				"endereco": {
					"nome_logradouro": "RUA TESTE TESTE, 546",
					"nome_bairro": "BAIRRO TESTE",
					"nome_cidade": "CIDADE TESTE",
					"sigla_UF": "PE",
					"numero_CEP": "51170580"
				}
			},
			"dado_boleto": {
				"descricao_instrumento_cobranca": "BoleCode",
				"forma_envio": "email",
				"tipo_boleto": "a vista",
				"quantidade_parcelas": 0,
				"pagador": {
					"pessoa": {
						"nome_pessoa": "Nome Pagador Teste",
						"tipo_pessoa": {
							"codigo_tipo_pessoa": "F",
							"numero_cadastro_pessoa_fisica": "53379284815"
						}
					},
					"endereco": {
						"nome_logradouro": "R PARA TESTE, TESTE",
						"nome_bairro": "BAIRRO TESTE TESTE",
						"nome_cidade": "CIDADE TESTE TESTE",
						"sigla_UF": "RJ",
						"numero_CEP": "05069010"
					},
					"email": "teste@teste.teste",
					"pagador_eletronico_DDA": true,
					"praca_protesto": true
				},
				"codigo_carteira": "157",
				"dados_individuais_boleto": [
					{
						"situacao_geral_boleto": "Em Aberto",
						"status_vencimento": "A vencer",
						"numero_nosso_numero": "47003",
						"data_vencimento": "2024-10-05",
						"valor_titulo": "100.00",
						"texto_seu_numero": "024081/01",
						"dac_titulo": 2,
						"codigo_barras": "34191973800014313911570004776121500640800000",
						"numero_linha_digitavel": "34191570070477612722972968650001197380001400000",
						"data_limite_pagamento": "2034-06-05",
						"mensagens_cobranca": [
							{
								"mensagem": "PROTESTAR APÓS 1 DIA DO VENCIMENTO"
							}
						]
					}
				],
				"codigo_especie": "01",
				"descricao_especie": "DM - Duplicata Mercantil",
				"codigo_aceite": "S",
				"data_emissao": "2024-05-28",
				"pagamento_parcial": false,
				"quantidade_maximo_parcial": 0,
				"protesto": {
					"quantidade_dias_protesto": 1,
					"protesto_falimentar": false,
					"codigo_tipo_protesto": 1,
					"descricao": "Protesto agendado"
				},
				"negativacao": {
				},
				"codigo_tipo_vencimento": 3,
				"historico": [
					{
						"data": "2024-08-27",
						"operacao": "INSTRUCAO DE PROTESTO CADASTRADA",
						"comandado_por": "0",
						"conteudo_anterior": "0",
						"conteudo_atual": "1"
					},
					{
						"data": "2024-05-28",
						"operacao": "ENTRADA TITULO",
						"comandado_por": "150001109",
						"canal_origem": "BKL"
					}
				],
				"instrucao_cobranca": [
					{
						"codigo_instrucao_cobranca": 1,
						"quantidade_dias_instrucao_cobranca": 1
					}
				],
				"recebimento_divergente": {
					"codigo_tipo_autorizacao": "02",
					"codigo_tipo_recebimento": "P",
					"valor_minimo": "0.00",
					"percentual_minimo": "95.00000",
					"valor_maximo": "0.00",
					"percentual_maximo": "105.00000"
				},
				"indicador_bloqueio": "N"
			},
			"acoes_permitidas": {
				"emitir_segunda_via": true,
				"comandar_instrucao_alterar_dados_cobranca": true
			}
		}
	],
	"page": {
		"links": {
			"first": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste&nosso_numero=00047003&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC",
			"last": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste&nosso_numero=00047003&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC",
			"previous": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste&nosso_numero=00047003&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC",
			"next": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste&nosso_numero=00047003&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC"
		},
		"page": 0,
		"total_pages": 0,
		"total_elements": 1,
		"page_size": 20
	}
}
```

</details>

<details>
<summary>Boleto Pago via QRCode Pix</summary>

```json
{
	"data": [
		{
			"id_boleto": "e39ceac2-4210-4001-a31a-7bfaa794ead5",
			"beneficiario": {
				"id_beneficiario": "150000011091",
				"nome_cobranca": "Nome Completo Beneficiario Teste",
				"tipo_pessoa": {
					"codigo_tipo_pessoa": "J",
					"numero_cadastro_nacional_pessoa_juridica": "04210525000102"
				},
				"endereco": {
					"nome_logradouro": "RUA TESTE TESTE, 546",
					"nome_bairro": "BAIRRO TESTE",
					"nome_cidade": "CIDADE TESTE",
					"sigla_UF": "PE",
					"numero_CEP": "51170580"
				}
			},
			"dado_boleto": {
				"descricao_instrumento_cobranca": "BoleCode",
				"forma_envio": "email",
				"tipo_boleto": "a vista",
				"quantidade_parcelas": 0,
				"pagador": {
					"pessoa": {
						"nome_pessoa": "Nome Pagador Teste 001",
						"tipo_pessoa": {
							"codigo_tipo_pessoa": "F",
							"numero_cadastro_pessoa_fisica": "53379284815"
						}
					},
					"endereco": {
						"nome_logradouro": "R PARA TESTE, TESTE",
						"nome_bairro": "BAIRRO TESTE TESTE",
						"nome_cidade": "CIDADE TESTE TESTE",
						"sigla_UF": "RJ",
						"numero_CEP": "05069010"
					},
					"email": "teste@teste.teste",
					"pagador_eletronico_DDA": true,
					"praca_protesto": true
				},
				"codigo_carteira": "157",
				"dados_individuais_boleto": [
					{
						"situacao_geral_boleto": "Baixada",
						"status_vencimento": "A vencer",
						"numero_nosso_numero": "47005",
						"data_vencimento": "2024-10-05",
						"valor_titulo": "100.00",
						"texto_seu_numero": "024081/01",
						"dac_titulo": 2,
						"codigo_barras": "34191973800014313911570004776121500640800000",
						"numero_linha_digitavel": "34191570070477612722972968650001197380001400000",
						"data_limite_pagamento": "2034-06-05"
					}
				],
				"codigo_especie": "01",
				"descricao_especie": "DM - Duplicata Mercantil",
				"codigo_aceite": "S",
				"data_emissao": "2024-05-28",
				"pagamento_parcial": false,
				"quantidade_maximo_parcial": 0,
				"negativacao": {
				},
				"codigo_tipo_vencimento": 3,
				"baixa": {
					"data_inclusao_alteracao_baixa": "2024-08-29T00:00:00",
					"motivo_baixa": "Baixa por ter sido liquidado"
				},
				"historico": [
					{
						"data": "2024-08-29",
						"operacao": "BAIXAR E DEVOLVER",
						"comandado_por": "331118960"
					},
					{
						"data": "2024-05-28",
						"operacao": "ENTRADA TITULO",
						"comandado_por": "150001109",
						"canal_origem": "BKL"
					}
				],
				"recebimento_divergente": {
					"codigo_tipo_autorizacao": "02",
					"codigo_tipo_recebimento": "P",
					"valor_minimo": "0.00",
					"percentual_minimo": "95.00000",
					"valor_maximo": "0.00",
					"percentual_maximo": "105.00000"
				},
				"indicador_bloqueio": "N",
				"qrcode_pix": {
					"imagem_base64": "iVBORw0KGgoAAAANSUhEUgAAAPoAAAD6AQAAAACgl2eQAAACx0lEQVR4Xu2XS44cIRAF4SJw/1v4KHARcERSmq7pxciL6fSmmFZ/ssLS08sfLvvn86e8R97OA5zzAOc8wDn/BoxS6qqrtL76an2OVngjmAhMXgTrHq3O1VofdVSDmQA/V4VRIuHrp0wqMInhWJ97la5n/wHgMQoXGfJBWJcL8MIePALDL9TWCCYC1ud8P+9V/f78lwGPqaJv8AizSFe/4lnAIEMoWuRp2MZaNBoNlAggrJsv3ol3P5E7UgG96dQLLYNM4hQsrt2KNgHwD1HNJK1wbfVR2lfBZACrIWoaVOP5ue2ePICZRY6GXjFFVOi/uiUrAWBczXjiFI1cdZ7ekpUARLr0qS4X2nSM7RjseQC7tCqvOru0ZznUHK55gN9omrPXT9ei+DZAEoBQpTOaZL1OLWt3Jz8OxPRciuy8MKt77bolKwHYMcRCJ1+urN2bNwOwaB0jaGSSldA6zmLLAtQWY3PFFzUauzv5cYCVSoAydan6TuHWEJ4HMLyJEBjRtEuvTiQPuO54pat2RqGotqs/C7hahw9K13Khi69IGrBU5+2iWKqYta1Y7EsEaNUppLauaxRvrLhEAH07/hPKQ16M8eYUfTVvBhB54coHEsMkSPQmAn5R06BYongd7L4lArQItXLdcqoG+dw+zgO2a11nnCS0sQCjrPVEAEvc5jG+XSlsk/I9m58H9MUSCdSyYY59a94EQD2mKtyJrKl3vpKVAFi18yhlhqwQ+P2y93nACiU92zpdpojuqeNWtBkAQ4xgbNMSa60hs4mmAd4momu87cRGBSw3kQmAx6J1cvhn4qpKE4FQZK8MP3XN7SqbB1gimzpdYRN2sdf0KxUYSIp6Va6kaaNskwF7Fa+KVeOD6YZLBmbss2mW3HI6pU95wKVpTgWq186NUZIGRNFGpXrrReCZoq9kJQA/nQc45wHOeYBzfgH4C0PFaFVF5GOnAAAAAElFTkSuQmCC",
					"emv": "00020101021226910014BR.GOV.BCB.PIX2569spi-h.itau.com.br/pix/qr/v2/cobv/2e7e1219-e8df-4aa6-b1ca-d19d524d337b5204000053039865802BR5912EMPRESA 65266009SAO HSEER2070503***1234"
				},
				"tx_id": "BL15000003512137000000000000539"
			},
			"acoes_permitidas": {
				"emitir_segunda_via": false,
				"comandar_instrucao_alterar_dados_cobranca": false
			}
		}
	],
	"page": {
		"links": {
			"first": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste+001&nosso_numero=00047005&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC",
			"last": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste+001&nosso_numero=00047005&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC",
			"previous": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste+001&nosso_numero=00047005&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC",
			"next": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste+001&nosso_numero=00047005&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC"
		},
		"page": 0,
		"total_pages": 0,
		"total_elements": 1,
		"page_size": 20
	}
}
```

</details>

<details>
<summary>Boleto Negativado</summary>

```json
{
	"data": [
		{
			"id_boleto": "e0dfffb8-1404-42f9-9703-1e3b53c05a6b",
			"beneficiario": {
				"id_beneficiario": "150000011091",
				"nome_cobranca": "Nome Completo Beneficiario Teste",
				"tipo_pessoa": {
					"codigo_tipo_pessoa": "J",
					"numero_cadastro_nacional_pessoa_juridica": "04210525000102"
				},
				"endereco": {
					"nome_logradouro": "RUA TESTE TESTE, 546",
					"nome_bairro": "BAIRRO TESTE",
					"nome_cidade": "CIDADE TESTE",
					"sigla_UF": "PE",
					"numero_CEP": "51170580"
				}
			},
			"dado_boleto": {
				"descricao_instrumento_cobranca": "BoleCode",
				"forma_envio": "email",
				"tipo_boleto": "a vista",
				"quantidade_parcelas": 0,
				"pagador": {
					"pessoa": {
						"nome_pessoa": "Nome Pagador Teste 005",
						"tipo_pessoa": {
							"codigo_tipo_pessoa": "F",
							"numero_cadastro_pessoa_fisica": "53379284815",
							"numero_cadastro_nacional_pessoa_juridica": "00000000000000"
						}
					},
					"endereco": {
						"nome_logradouro": "R PARA TESTE, TESTE",
						"nome_bairro": "BAIRRO TESTE TESTE",
						"nome_cidade": "CIDADE TESTE TESTE",
						"sigla_UF": "RJ",
						"numero_CEP": "05069010"
					},
					"email": "teste@teste.teste",
					"pagador_eletronico_DDA": true,
					"praca_protesto": true
				},
				"codigo_carteira": "157",
				"dados_individuais_boleto": [
					{
						"situacao_geral_boleto": "Em Aberto",
						"status_vencimento": "A vencer",
						"numero_nosso_numero": "47005",
						"data_vencimento": "2024-10-05",
						"valor_titulo": "100.00",
						"texto_seu_numero": "024081/01",
						"dac_titulo": 2,
						"codigo_barras": "34191973800014313911570004776121500640800000",
						"numero_linha_digitavel": "34191570070477612722972968650001197380001400000",
						"data_limite_pagamento": "2034-06-05"
					}
				],
				"codigo_especie": "01",
				"descricao_especie": "DM - Duplicata Mercantil",
				"codigo_aceite": "S",
				"data_emissao": "2024-05-28",
				"pagamento_parcial": false,
				"quantidade_maximo_parcial": 0,
				"negativacao": {
					"codigo_situacao_negativacao": 2,
					"descricao": "Negativado"
				},
				"codigo_tipo_vencimento": 3,
				"historico": [
					{
						"data": "2024-05-28",
						"operacao": "ENTRADA TITULO",
						"comandado_por": "150001109",
						"canal_origem": "BKL"
					}
				],
				"recebimento_divergente": {
					"codigo_tipo_autorizacao": "02",
					"codigo_tipo_recebimento": "P",
					"valor_minimo": "0.00",
					"percentual_minimo": "95.00000",
					"valor_maximo": "0.00",
					"percentual_maximo": "105.00000"
				},
				"indicador_bloqueio": "N"
			},
			"acoes_permitidas": {
				"emitir_segunda_via": false,
				"comandar_instrucao_alterar_dados_cobranca": true
			}
		}
	],
	"page": {
		"links": {
			"first": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste+005&nosso_numero=00047005&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC",
			"last": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste+005&nosso_numero=00047005&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC",
			"previous": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste+005&nosso_numero=00047005&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC",
			"next": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste+005&nosso_numero=00047005&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC"
		},
		"page": 0,
		"total_pages": 0,
		"total_elements": 1,
		"page_size": 20
	}
}
```

</details>

<details>
<summary>Boleto Descontado</summary>

```json
{
	"data": [
		{
			"id_boleto": "64ae5aca-6ad2-4089-9884-990d32e0db91",
			"beneficiario": {
				"id_beneficiario": "150000011091",
				"nome_cobranca": "Nome Completo Beneficiario Teste",
				"tipo_pessoa": {
					"codigo_tipo_pessoa": "J",
					"numero_cadastro_nacional_pessoa_juridica": "04210525000102"
				},
				"endereco": {
					"nome_logradouro": "RUA TESTE TESTE, 546",
					"nome_bairro": "BAIRRO TESTE",
					"nome_cidade": "CIDADE TESTE",
					"sigla_UF": "PE",
					"numero_CEP": "51170580"
				}
			},
			"dado_boleto": {
				"descricao_instrumento_cobranca": "BoleCode",
				"forma_envio": "email",
				"tipo_boleto": "a vista",
				"quantidade_parcelas": 0,
				"pagador": {
					"pessoa": {
						"nome_pessoa": "Nome Pagador Teste 003",
						"tipo_pessoa": {
							"codigo_tipo_pessoa": "F",
							"numero_cadastro_pessoa_fisica": "53379284815"
						}
					},
					"endereco": {
						"nome_logradouro": "R PARA TESTE, TESTE",
						"nome_bairro": "BAIRRO TESTE TESTE",
						"nome_cidade": "CIDADE TESTE TESTE",
						"sigla_UF": "RJ",
						"numero_CEP": "05069010"
					},
					"email": "teste@teste.teste",
					"pagador_eletronico_DDA": true,
					"praca_protesto": true
				},
				"codigo_carteira": "157",
				"dados_individuais_boleto": [
					{
						"situacao_geral_boleto": "Em Aberto",
						"status_vencimento": "A vencer",
						"numero_nosso_numero": "47005",
						"data_vencimento": "2024-10-05",
						"valor_titulo": "100.00",
						"texto_seu_numero": "024081/01",
						"dac_titulo": 2,
						"codigo_barras": "34191973800014313911570004776121500640800000",
						"numero_linha_digitavel": "34191570070477612722972968650001197380001400000",
						"data_limite_pagamento": "2034-06-05"
					}
				],
				"codigo_especie": "01",
				"descricao_especie": "DM - Duplicata Mercantil",
				"codigo_aceite": "S",
				"data_emissao": "2024-05-28",
				"pagamento_parcial": false,
				"quantidade_maximo_parcial": 0,
				"negativacao": {
				},
				"codigo_tipo_vencimento": 3,
				"historico": [
					{
						"data": "2024-06-01",
						"operacao": "BOLETO ENVIADO PARA PROCESSO DE DESCONTO",
						"comandado_por": "SISTEMA",
						"canal_origem": "SIS"
					},
					{
						"data": "2024-05-28",
						"operacao": "ENTRADA TITULO",
						"comandado_por": "150001109",
						"canal_origem": "BKL"
					}
				],
				"recebimento_divergente": {
					"codigo_tipo_autorizacao": "02",
					"codigo_tipo_recebimento": "P",
					"valor_minimo": "0.00",
					"percentual_minimo": "95.00000",
					"valor_maximo": "0.00",
					"percentual_maximo": "105.00000"
				},
				"indicador_bloqueio": "N"
			},
			"acoes_permitidas": {
				"emitir_segunda_via": true,
				"comandar_instrucao_alterar_dados_cobranca": true
			}
		}
	],
	"page": {
		"links": {
			"first": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste+003&nosso_numero=00047005&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC",
			"last": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste+003&nosso_numero=00047005&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC",
			"previous": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste+003&nosso_numero=00047005&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC",
			"next": "/dev/boletoscash/v2/boletos_search?codigo_carteira=157&id_beneficiario=150000011091&nome_pagador=Nome+Pagador+Teste+003&nosso_numero=00047005&view=specific&page_size=20&page=0&order_by=data_vencimento&order=ASC"
		},
		"page": 0,
		"total_pages": 0,
		"total_elements": 1,
		"page_size": 20
	}
}
```

</details>

