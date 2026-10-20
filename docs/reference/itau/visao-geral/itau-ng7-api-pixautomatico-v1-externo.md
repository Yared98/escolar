# API Pixautomatico (v1.45.10)

Fonte: https://devportal.itau.com.br/nossas-apis/itau-ng7-api-pixautomatico-v1-externo (aba visão geral, atualizada em 2026-10-14T21:06:36.000Z)
Sandbox: https://sandbox.devportal.itau.com.br/itau-ng7-api-pixautomatico-v1-externo/v1
Spec: ../openapi/itau-ng7-api-pixautomatico-v1-externo.json

---



## **sobre a API**


As APIs do Pix Automático são responsáveis pelo serviço de recorrência do ecossistema Pix, onde a empresa recebedora poderá integrar e oferecer a forma de pagamento recorrente aos seus clientes pagadores.
Suas funcionalidades são:
•	Criação de recorrência
•	Solicitação de aceite da recorrência 
•	Agendamentos   
•	Cancelamentos
•	Fluxo de notificação - Webhook


## **para quem é esta API?**


As APIs do Pix Automático são indicadas para empresas que precisam receber pagamentos recorrentes 

## **restrições de uso**


Para utilizar a API o parceiro precisa estar habilitado no Portal Itau for Developers e ter o certificado dinâmico ativado.

Documentação para autorização: https://devportal.itau.com.br/autenticacao-documentacao

## **conhecimentos técnicos necessários** 


Conhecimentos prévios necessários:

`API REST/Restful` `HTTP/HTTPS` `JSON` `Postman/Insomnia` `OAUTH2`

## **quais necessidades que essa API ajuda a resolver?**


Promover uma melhor experiência ao cliente na gestão dos contratos e agendamentos de recorrência.

Com as **APIs do Pix Automático** o cliente pode solicitar, alterar, cancelar e consultar todos os seus contratos de recebimentos recorrentes por PIX.

## **tempo aproximado para integração**
**10 dias:** essa é a média de tempo que um desenvolvedor pode levar para preparar toda a integração com essa API. Isso pode variar de acordo com o tamanho do time e experiência dos desenvolvedores envolvidos.


## **endpoints**

Nosso objetivo é deixar claro tudo que você precisa fazer para integrar às APIs do pix automático recebimentos. Para isso, todas as informações e exemplos necessários estão reunidos aqui. 

Os exemplos de response de erros são demonstrados no tópico **padrões de erros** ao final desta page. Cada endpoint traz uma tabela especificando quais desses retornos aquele serviço retorna. Então, caso haja variação no json retornado, este será demonstrado na explicação do próprio endpoint, se não, deve ser visualizado no tópico citado. 

## URLs
Para garantir uma integração segura, as funcionalidades da API estão disponíveis nas seguintes URLs:

| ambiente        | endpoint                                            |    
| ----------------|---------------------------------------------------  |  
| Desenvolvimento | https://pixautomatico-recebimentos.api.dev.itau.com |
| Homologação     | https://pixautomatico-recebimentos.api.hom.itau.com |
| Produção        | https://pixautomatico-recebimentos.api.itau.com     |


### Recorrência
### [GET] /rec/{idRec}
- Consultar recorrência.

**header e path variable**

| Parâmetro	             | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição                                                                             |
|------------------------|----------------|-----------|-------------|---------------------------------------------------------------------------------------|
| `idRec`                | path           | string    | Sim         | Identificador da Recorrência.                                                         |
| `txid`                 | query          | string    | Não         | Identificador da Transação.                                                           |
| `Authorization`        | header         | string    | Sim         | Token de acesso à API. Obtido através do endpoint de autorização.                     |
| `x-itau-correlationid` | header         | string    | Sim         | UUID que identifica a requisição, para propósitos de rastreamento.                    |
| `x-itau-apikey`        | header         | string    | Sim         | Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso. |

**Exemplo de saída:**

Exemplo de Recorrência Completa Jornada 1
~~~json
{
  "idRec": "RR7784567820240528123defgh775",
  "status": "CRIADA",
  "valor": {
    "valorRec": "250.00"
  },
  "vinculo": {
    "contrato": "9612389",
    "devedor": {
      "cpf": "45832633800",
      "nome": "Alfredo Tavares"
    },
    "objeto": "Serviços Esportivos"
  },
  "calendario": {
    "dataFinal": "2028-09-01",
    "dataInicial": "2024-02-01",
    "periodicidade": "MENSAL"
  },
  "politicaRetentativa": "PERMITE_3R_7D",
  "pagador": {
    "codMun": "1509873",
    "cpf": "45832633800",
    "ispbParticipante": "52780028"
  },
  "recebedor": {
    "cnpj": "56958712500811",
    "nome": "Academia Saúde",
    "convenio": "1234567890"
  },
  "atualizacao": [
    {
      "data": "2024-01-03T08:30:02.050Z",
      "nome": "CRIADA"
    }
  ]
}
~~~

Exemplo de Recorrência Completa com Dados QR Jornada 2
~~~json
{
  "idRec": "RN1234567820240115abcdefghijk",
  "status": "APROVADA",
  "valor": {
    "valorRec": "300.00"
  },
  "vinculo": {
    "contrato": "98625023",
    "devedor": {
      "cpf": "87734514122",
      "nome": "Fulano de Tal"
    },
    "objeto": "Serviços de Gestão de Imóveis"
  },
  "calendario": {
    "dataFinal": "2028-09-01",
    "dataInicial": "2024-02-01",
    "periodicidade": "MENSAL"
  },
  "politicaRetentativa": "NAO_PERMITE",
  "loc": {
    "criacao": "2023-12-19T12:28:05.230Z",
    "id": 5100,
    "location": "pix.example.com/qr/v2/rec/2353c790eefb11eaadc10242ac120002",
    "idRec": "RN1234567820240115abcdefghijk"
  },
  "pagador": {
    "codMun": "2673833",
    "cpf": "75633122216",
    "ispbParticipante": "81102623"
  },
  "recebedor": {
    "cnpj": "92221288310574",
    "nome": "Imobiliária Bom Sucesso",
    "convenio": "9876543210"
  },
  "atualizacao": [
    {
      "data": "2024-01-03T08:30:02.050Z",
      "nome": "CRIADA"
    },
    {
      "data": "2024-01-04T09:40:42.210Z",
      "nome": "APROVADA"
    }
  ],
  "dadosQR": {
    "jornada": "JORNADA_2",
    "pixCopiaECola": "00020126180014br.gov.bcb.pix5204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***80800014br.gov.bcb.pix2558pix.example.com/qr/v2/rec/2353c790eefb11eaadc10242ac120002630462C9"
  }
}
~~~

Exemplo de Recorrência Completa com Dados QR Jornada 3
~~~json
{
  "idRec": "RN1234567820241203fghijkabcde",
  "status": "CRIADA",
  "valor": {
    "valorRec": "150.00"
  },
  "vinculo": {
    "contrato": "5582610",
    "devedor": {
      "cpf": "45164632481",
      "nome": "Fulano de Tal"
    },
    "objeto": "Serviços de Gestão de Imóveis"
  },
  "calendario": {
    "dataFinal": "2028-09-01",
    "dataInicial": "2025-02-01",
    "periodicidade": "MENSAL"
  },
  "politicaRetentativa": "NAO_PERMITE",
  "loc": {
    "criacao": "2024-10-01T10:15:01.115Z",
    "id": 2726,
    "location": "pix.example.com/qr/v2/rec/94ed2badcbc04c15b0bb7fa353194890",
    "idRec": "RN1234567820241203fghijkabcde"
  },
  "recebedor": {
    "cnpj": "12345678000195",
    "nome": "Empresa de Serviços SA"
  },
  "atualizacao": [
    {
      "data": "2024-12-03T08:30:02.050Z",
      "nome": "CRIADA"
    }
  ],
  "dadosQR": {
    "jornada": "JORNADA_3",
    "pixCopiaECola": "00020101021226760014br.gov.bcb.pix2554pix.example.com/qr/v2/8b3da2f39a4140d1a91abd93113bd4415204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***80800014br.gov.bcb.pix2558pix.example.com/qr/v2/rec/94ed2badcbc04c15b0bb7fa35319489063047741"
  }
}
~~~

Exemplo de Recorrência Completa com Dados QR Jornada 4
~~~json
{
  "idRec": "RN1234567820241130lkwdefghijk",
  "status": "CRIADA",
  "valor": {
    "valorRec": "210.00"
  },
  "vinculo": {
    "contrato": "11750023",
    "devedor": {
      "cpf": "75633122216",
      "nome": "Francisco da Silva"
    },
    "objeto": "Assinatura de Serviços de Transporte"
  },
  "calendario": {
    "dataFinal": "2026-12-01",
    "dataInicial": "2025-03-01",
    "periodicidade": "MENSAL"
  },
  "politicaRetentativa": "NAO_PERMITE",
  "loc": {
    "criacao": "2024-05-19T10:28:05.230Z",
    "id": 6153,
    "location": "pix.example.com/qr/v2/rec/3ffa640fa4f14080adccb949fa2dc0d0",
    "idRec": "RN1234567820241130lkwdefghijk"
  },
  "recebedor": {
    "cnpj": "56989000019533",
    "nome": "Empresa de Logística SA"
  },
  "atualizacao": [
    {
      "data": "2024-11-30T08:30:02.050Z",
      "nome": "CRIADA"
    }
  ],
  "dadosQR": {
    "jornada": "JORNADA_4",
    "pixCopiaECola": "00020101021226810014br.gov.bcb.pix2559pix.example.com/qr/v2/cobv/1e6c54d3ec9449b7a7fc53b6b0f998e75204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***80800014br.gov.bcb.pix2558pix.example.com/qr/v2/rec/3ffa640fa4f14080adccb949fa2dc0d06304A441"
  }
}
~~~

### [PATCH] /rec/{idRec}
- Revisar recorrência.

Endpoint que permite cancelar o contrato de recorrência criado pelo usuário recebedor. Esse endpoint também possibilita: Alterar data de início da recorrência, adicionar Txid para jornada 3 de adesão e alterar o usuário pagador

**header e path variable**

| Parâmetro	           | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| ---------            | -------------- | --------- | ----------- | --------- |
| `idRec`              |path           | string     |Sim          |Identificador da Recorrência.|
|`Authorization`       |header          |string     |Sim          |Token de acesso à API. Obtido através do endpoint de autorização.|
|`x-itau-correlationid`|header          |string     |Sim          |UUID que identifica a requisição, para propósitos de rastreamento.|
|`x-itau-apikey`       |header          |string     |Sim          |Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso.|

**Exemplo de entrada:**
~~~json
{
  "loc": 108,
  "vinculo": {
    "devedor": {
      "nome": "Fulano de Tal"
    }
  },
  "calendario": {
    "dataInicial": "2024-04-01"
  },
  "ativacao": {
    "dadosJornada": {
      "txid": "33beb661beda44a8928fef47dbeb2dc5"
    }
  }
}
~~~

**Exemplo de entrada (cancelamento):**
~~~json
{
  "status": "CANCELADA"
}
~~~

**Exemplo de saída:**
~~~json
{
  "idRec": "RN1234567820240115abcdefghijk",
  "vinculo": {
    "contrato": "63100862",
    "devedor": {
      "cpf": "45164632481",
      "nome": "Fulano de Tal"
    },
    "objeto": "Serviço de Streamming de Música."
  },
  "calendario": {
    "dataFinal": "2025-04-01",
    "dataInicial": "2024-04-01",
    "periodicidade": "MENSAL"
  },
  "politicaRetentativa": "NAO_PERMITE",
  "recebedor": {
    "cnpj": "01602606113708",
    "nome": "Empresa de Serviços SA"
  },
  "valor": {
    "valorRec": "35.00"
  },
  "status": "CRIADA",
  "loc": {
    "criacao": "2023-12-10T07:10:05.115Z",
    "id": 108,
    "location": "pix.example.com/qr/v2/rec/2353c790eefb11eaadc10242ac120002",
    "idRec": "RN1234567820240115abcdefghijk"
  },
  "ativacao": {
    "dadosJornada": {
      "tipoJornada": "JORNADA_3",
      "txid": "33beb661beda44a8928fef47dbeb2dc5"
    }
  },
  "atualizacao": [
    {
      "data": "2023-12-19T12:28:05.230Z",
      "nome": "CRIADA"
    }
  ]
}
~~~

**Exemplo de saída (cancelamento):**
~~~json
{
  "idRec": "RN6070119020260929lI4Cyx4SJHE",
  "vinculo": {
    "contrato": "63100866",
    "devedor": {
      "nome": "Fulano de Tal",
      "cpf": "04937499696"
    },
    "objeto": "Serviço de academia."
  },
  "calendario": {
    "dataFinal": "2027-02-20",
    "dataInicial": "2026-11-06",
    "periodicidade": "MENSAL"
  },
  "politicaRetentativa": "NAO_PERMITE",
  "recebedor": {
    "cnpj": "00011098000182",
    "nome": "PMD IEGLOGLO SERVICOS LTD"
  },
  "valor": {
    "valorRec": "100.00"
  },
  "status": "CANCELADA",
  "ativacao": {
    "tipoJornada": "AGUARDANDO_DEFINICAO",
    "dadosJornada": {}
  },
  "atualizacao": [
    {
      "nome": "CRIADA",
      "data": "2026-09-29T17:34:06.686Z"
    },
    {
      "nome": "CANCELADA",
      "data": "2026-09-29T17:34:35.612Z"
    }
  ]
}
~~~



### [GET] /rec/{idRec}/dados-pagador
- Consultar dados do pagador da recorrência.

**header e path variable**

| Parâmetro              | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição                                                                             |
|------------------------|----------------|-----------|-------------|---------------------------------------------------------------------------------------|
| `idRec`                | path           | string    | Sim         | Identificador da Recorrência.                                                         |
| `Authorization`        | header         | string    | Sim         | Token de acesso à API. Obtido através do endpoint de autorização.                     |
| `x-itau-correlationid` | header         | string    | Sim         | UUID que identifica a requisição, para propósitos de rastreamento.                    |
| `x-itau-apikey`        | header         | string    | Sim         | Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso. |

**Exemplo de saída:**

~~~json
{
  "idRec": "RN1234567820240115abcdefghijk",
  "status": "APROVADA",
  "pagador": {
    "agencia": "4595",
    "conta": "275940664",
    "ispbParticipante": "81102623",
    "codMun": "2673833",
    "cpf": "75633122216"
  }
}
~~~


### [GET] /rec
- Consultar lista de recorrências.

Retorna todos os contratos de recorrência de forma paginada a partir das informações do pagador.

**header e path variable**

| Parâmetro	                | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| ---------            | -------------- | --------- | ----------- | --------- |
|`inicio`                   |query           |string     |Sim          |Data inicial utilizada na consulta. Respeita RFC 3339.|
|`fim`                      |query           |string     |Sim          |Data de fim utilizada na consulta. Respeita RFC 3339.|
|`cpf`                      |query           |string     |Não          |Filtro pelo CPF do devedor. Não pode ser utilizado ao mesmo tempo que o CNPJ.|
|`cnpj`                     |query           |string     |Não          |Filtro pelo CNPJ do devedor. Não pode ser utilizado ao mesmo tempo que o CPF.|
|`locationPresente`         |query           |boolean    |Não          |Filtro pela existência de location vinculada.|
|`status`                   |query           |string     |Não          |Filtro pelo status das recorrências.|
|`paginacao.paginaAtual`    |query           |integer    |Não          |Número da página recuperada.|
|`paginacao.itensPorPagina` |query           |integer    |Não          |Quantidade de registros retornado na página.|
|`Authorization`            |header          |string     |Sim          |Token de acesso à API. Obtido através do endpoint de autorização.|
|`x-itau-correlationid`     |header          |string     |Sim          |UUID que identifica a requisição, para propósitos de rastreamento.|
|`x-itau-apikey`            |header          |string     |Sim          |Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso.|

**Exemplo de saída:**

~~~json
{
  "parametros": {
    "inicio": "2024-04-01T00:00:00Z",
    "fim": "2024-04-01T23:59:59Z",
    "paginacao": {
      "paginaAtual": 0,
      "itensPorPagina": 100,
      "quantidadeDePaginas": 1,
      "quantidadeTotalDeItens": 1
    }
  },
  "recs": [
    {
      "idRec": "RN1234567820240115abcdefghijk",
      "status": "APROVADA",
      "valor": {
        "valorRec": "300.00"
      },
      "vinculo": {
        "contrato": "98625023",
        "devedor": {
          "cpf": "87734514122",
          "nome": "Fulano de Tal"
        },
        "objeto": "Serviços de Gestão de Imóveis"
      },
      "calendario": {
        "dataFinal": "2028-09-01",
        "dataInicial": "2024-02-01",
        "periodicidade": "MENSAL"
      },
      "politicaRetentativa": "NAO_PERMITE",
      "loc": {
        "criacao": "2023-12-19T12:28:05.230Z",
        "id": 5100,
        "location": "pix.example.com/qr/v2/rec/2353c790eefb11eaadc10242ac120002",
        "idRec": "RN1234567820240115abcdefghijk"
      },
      "pagador": {
        "codMun": "2673833",
        "cpf": "75633122216",
        "ispbParticipante": "81102623"
      },
      "recebedor": {
        "cnpj": "92221288310574",
        "nome": "Imobiliária Bom Sucesso"
      },
      "atualizacao": [
        {
          "data": "2024-01-03T08:30:02.050Z",
          "nome": "CRIADA"
        },
        {
          "data": "2024-01-04T09:40:42.210Z",
          "nome": "APROVADA"
        }
      ]
    }
  ]
}
~~~

### [POST] /rec
- Criar recorrência

Cadastro de um novo contrato de pagamentos recorrentes para o pix automático.

No contexto do produto, é pré-requisito a criação de um contrato de recorrência para o envio de solicitações de pagamento para clientes pagadores, nela deve conter as informações do recebedor, o objeto do débito recorrente, periodicidade e a data de início das cobranças. Será criado um identificador da recorrência tratada (idRec).

**header e path variable**

| Parâmetro	           | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| ---------            | -------------- | --------- | ----------- | --------- |
|`Authorization`       |header          |string     |Sim          |Token de acesso à API. Obtido através do endpoint de autorização.|
|`x-itau-correlationid`|header          |string     |Sim          |UUID que identifica a requisição, para propósitos de rastreamento.|
|`x-itau-apikey`       |header          |string     |Sim          |Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso.|

**Exemplo de entrada:**

Exemplo de recorrência 1
~~~json
{
  "vinculo": {
    "contrato": "63100862",
    "devedor": {
      "cpf": "45164632481",
      "nome": "Fulano de Tal"
    },
    "objeto": "Serviço de Streamming de Música."
  },
  "calendario": {
    "dataFinal": "2025-04-01",
    "dataInicial": "2024-04-01",
    "periodicidade": "MENSAL"
  },
  "valor": {
    "valorRec": "35.00"
  },
  "politicaRetentativa": "NAO_PERMITE",
  "loc": 108,
  "ativacao": {
    "dadosJornada": {
      "txid": "33beb661beda44a8928fef47dbeb2dc5"
    }
  }
}
~~~

Exemplo de recorrência 2
~~~json
{
  "idRec": "RR1234567820240115abcdefghijk",
  "vinculo": {
    "contrato": "998782003",
    "devedor": {
      "cpf": "02989131415",
      "nome": "Beltrano da Silva"
    },
    "objeto": "Serviço de Plano de Saúde."
  },
  "calendario": {
    "dataInicial": "2024-10-10",
    "periodicidade": "ANUAL"
  },
  "politicaRetentativa": "PERMITE_3R_7D",
  "valor": {
    "valorMinimoRecebedor": "5000.00"
  },
  "status": "CRIADA",
  "atualizacao": [
    {
      "data": "2024-01-11T10:27:01.280Z",
      "nome": "CRIADA"
    }
  ]
}
~~~

**Exemplo de saída:**

Exemplo de recorrência 1
~~~json
{
  "idRec": "RN1234567820240115abcdefghijk",
  "vinculo": {
    "contrato": "63100862",
    "devedor": {
      "cpf": "45164632481",
      "nome": "Fulano de Tal"
    },
    "objeto": "Serviço de Streamming de Música."
  },
  "calendario": {
    "dataFinal": "2025-04-01",
    "dataInicial": "2024-04-01",
    "periodicidade": "MENSAL"
  },
  "politicaRetentativa": "NAO_PERMITE",
  "recebedor": {
    "cnpj": "01602606113708",
    "nome": "Empresa de Serviços SA"
  },
  "valor": {
    "valorRec": "35.00"
  },
  "status": "CRIADA",
  "loc": {
    "criacao": "2023-12-10T07:10:05.115Z",
    "id": 108,
    "location": "pix.example.com/qr/v2/rec/2353c790eefb11eaadc10242ac120002",
    "idRec": "RN1234567820240115abcdefghijk"
  },
  "ativacao": {
    "dadosJornada": {
      "tipoJornada": "JORNADA_3",
      "txid": "33beb661beda44a8928fef47dbeb2dc5"
    }
  },
  "atualizacao": [
    {
      "data": "2023-12-19T12:28:05.230Z",
      "nome": "CRIADA"
    }
  ]
}
~~~

Exemplo de recorrência 2
~~~json
{
  "idRec": "RR1234567820240115abcdefghijk",
  "vinculo": {
    "contrato": "998782003",
    "devedor": {
      "cpf": "02989131415",
      "nome": "Beltrano da Silva"
    },
    "objeto": "Serviço de Plano de Saúde."
  },
  "calendario": {
    "dataInicial": "2024-10-10",
    "periodicidade": "ANUAL"
  },
  "politicaRetentativa": "PERMITE_3R_7D",
  "recebedor": {
    "cnpj": "09172302153900",
    "nome": "Empresa de Serviços de Saúde SA"
  },
  "valor": {
    "valorMinimoRecebedor": "5000.00"
  },
  "status": "CRIADA",
  "atualizacao": [
    {
      "data": "2024-01-11T10:27:01.280Z",
      "nome": "CRIADA"
    }
  ]
}
~~~

### [GET] /rec/{recUrlAccessToken}

- Recuperar o payload JSON que representa a configuração da recorrência

Endpoint (location) que serve um payload que representa uma recorrência.
No momento em que o usuário pagador efetua a leitura de um QR Code composto gerado pelo recebedor, esta URL será acessada e seu conteúdo consiste em uma estrutura JWS. As informações sobre a segurança no acesso às urls encontram-se no Manual de Segurança do Pix disponível nesse [link](https://www.bcb.gov.br/estabilidadefinanceira/comunicacaodados).


**header e path variable**

| Parâmetro	           | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| ---------            | -------------- | --------- | ----------- | --------- |
|`recUrlAccessToken`   |path            |string     |Sim          |Token gerado após leitura do QR Code composto.|
|`Authorization`       |header          |string     |Sim          |Token de acesso à API. Obtido através do endpoint de autorização.|
|`x-itau-correlationid`|header          |string     |Sim          |UUID que identifica a requisição, para propósitos de rastreamento.|
|`x-itau-apikey`       |header          |string     |Sim          |Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso.|

**Exemplo de saída:**

O retorno desse endpoint é um objeto que apresenta estrutura JWS, conforme especificado no manual de segurança. Segue um exemplo:

~~~json
eyJ4NXQjUzI1NiI6IkJOVkdUamZsRTVBaUplWGhHbTZSaGtGUXkwQ25pejJXSlF5cTZhQ0pnTFkiLCJqa3UiOiJodHRwczpcL1wvcXItaC5zYW5kYm94LnBpeC5iY2IuZ292LmJyXC9yZXN0XC9qd2tzLmpzb24iLCJraWQiOiJOMjROSVg5R3Z3bm4ycGktV09IOG9RQ2JkSGlaSFdpbnJvWllxZGhxMlYwUENJIiwiYWxnIjoiUlMyNTYifQ.eyJpZFJlYyI6IlJOMTIzNDU2NzgyMDI0MDExNTc3ODI1NDQ1NjEyIiwidmluY3VsbyI6eyJjb250cmF0byI6IjU1ODI2MTAiLCJkZXZlZG9yIjp7ImNwZiI6IjQ1MTY0NjMyNDgxIiwibm9tZSI6IkZ1bGFubyBkZSBUYWwifSwib2JqZXRvIjoiU2VydmnDp28gZGUgU3RyZWFtbWluZyBkZSBNw7pzaWNhLiJ9LCJjYWxlbmRhcmlvIjp7ImRhdGFGaW5hbCI6IjIwMjUtMDQtMDEiLCJkYXRhSW5pY2lhbCI6IjIwMjQtMDQtMDEiLCJwZXJpZGlvY2lkYWRlIjoiTUVOU0FMIn0sInBvbGl0aWNhUmV0ZW50YXRpdmEiOiJOQU9fUEVSTUlURSIsInZhbG9yIjp7InZhbG9yUmVjIjoiMzUuMDAifSwicmVjZWJlZG9yIjp7ImNucGoiOiIyODc2NTAwNzgwMjM3MSIsIm5vbWUiOiJTdGFydHVwIE11c2ljYWwiLCJpc3BiUGFydGljaXBhbnRlIjoiMTIzNDU2NzgifSwiYXR1YWxpemFjYW8iOlt7InN0YXR1cyI6IkNSSUFEQSIsImRhdGEiOiIyMDI0LTAzLTIwVDEwOjEyOjA3LjU2N1oifV19.JQ3nwpN75M7ADuFQD1lAYRU_3QIkU34OCGXcqmn0dmmvl_JYQggZDY-2cN9waqZtf0duJkDs9EcRu-pNZQZlNMjI7DCYCNfXOgiiofdQqMikDh-D6Zq82EkiUqS7cuTg1-GWylCTF9gH6-p_D-dhYPvf-s4FinbjZNwhkX8Sn-OhlLMS8roIWSMjo_J1hN4DdL-Q5zgZBb7Hbt4OZ3CnD1GNbnsdUUyPyy2GfmIUWZEnQ2rY7gVuI7chUAksYeZVaJiH34saBw4Ou8RjHbSGmeWFLmjiTSQYisyQEyotStu6GnHLS36ElNDVlZWOUnb87N3H5FAccWaIQhit3C4wmA
~~~

Este objeto JWS assinado deve ser validado pelo devedor. Maiores detalhes técnicos a respeito da especificação
de segurança encontram-se no __[Manual de Segurança do Pix](https://www.bcb.gov.br/estabilidadefinanceira/pix)__.

Conforme pode-se verificar no exemplo acima, o objeto JWS apresenta três fragmentos separados pelo caractere `.` (ponto). São eles: `header`, `payload` e `signature`.

Em termos de funcionalidade, o fragmento que interessa ao devedor é o `payload`, que apresenta estrutura conforme especificada pelo `schema` do presente endpoint, contendo detalhes concernentes à cobrança.

~~~json
{
  "idRec": "RN123456782024011577825445612",
  "vinculo": {
    "contrato": "5582610",
    "devedor": {
      "cpf": "45164632481",
      "nome": "Fulano de Tal"
    },
    "objeto": "Serviço de Streamming de Música."
  },
  "calendario": {
    "dataFinal": "2025-04-01",
    "dataInicial": "2024-04-01",
    "periodicidade": "MENSAL"
  },
  "politicaRetentativa": "NAO_PERMITE",
  "valor": {
    "valorRec": "35.00"
  },
  "recebedor": {
    "cnpj": "28765007802371",
    "nome": "Startup Musical",
    "ispbParticipante": "12345678"
  },
  "atualizacao": [
    {
      "status": "CRIADA",
      "data": "2024-03-20T10:12:07.567Z"
    }
  ]
}
~~~

## Solicitação de Recorrência

### [POST] /solicrec
- Criar solicitação de confirmação de recorrência.

**header e path variable**

| Parâmetro	           | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| ---------            | -------------- | --------- | ----------- | --------- |
|`Authorization`       |header          |string     |Sim          |Token de acesso à API. Obtido através do endpoint de autorização.|
|`x-itau-correlationid`|header          |string     |Sim          |UUID que identifica a requisição, para propósitos de rastreamento.|
|`x-itau-apikey`       |header          |string     |Sim          |Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso.|

**Exemplo de entrada:**

~~~json
{
  "idRec": "RN123456782024011577825445612",
  "calendario": {
    "dataExpiracaoSolicitacao": "2023-12-20T12:17:11.926Z"
  },
  "destinatario": {
    "agencia": "2569",
    "conta": "550689",
    "cpf": "15231470190",
    "ispbParticipante": "91193552"
  }
}
~~~

**Exemplo de saída:**

~~~json
{
  "idSolicRec": "SC876456782024021577825445312",
  "idRec": "RN123456782024011577825445612",
  "calendario": {
    "dataExpiracaoSolicitacao": "2023-12-20T12:17:11.926Z"
  },
  "status": "CRIADA",
  "destinatario": {
    "agencia": "2569",
    "conta": "550689",
    "cpf": "15231470190",
    "ispbParticipante": "91193552"
  },
  "atualizacao": [
    {
      "data": "2023-12-20T12:18:18.618Z",
      "status": "CRIADA"
    }
  ],
  "recPayload": {
    "idRec": "RN123456782024011577825445612",
    "vinculo": {
      "contrato": "561238008",
      "devedor": {
        "cpf": "15231470190",
        "nome": "Fulano de Tal"
      },
      "objeto": "Serviços de Telecomunicações"
    },
    "calendario": {
      "dataFinal": "2023-12-01",
      "dataInicial": "2024-04-01",
      "periodicidade": "MENSAL"
    },
    "recebedor": {
      "cnpj": "94370926517368",
      "nome": "Empresa de Serviços SA"
    },
    "valor": {
      "valorRec": "1200.09"
    },
    "atualizacao": [
      {
        "data": "2023-12-15T08:30:07.115Z",
        "status": "CRIADA"
      }
    ]
  }
}
~~~

### [GET] /solicrec/{idSolicRec}
- Consultar solicitação.

**header e path variable**

| Parâmetro	           | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| ---------            | -------------- | --------- | ----------- | --------- |
|`idSolicRec`          |path            |string     |Sim          |Identificador da Solicitação da Recorrência.|
|`Authorization`       |header          |string     |Sim          |Token de acesso à API. Obtido através do endpoint de autorização.|
|`x-itau-correlationid`|header          |string     |Sim          |UUID que identifica a requisição, para propósitos de rastreamento.|
|`x-itau-apikey`       |header          |string     |Sim          |Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso.|

**Exemplo de saída:**

Exemplo de solicitação de confirmação de recorrência 1
~~~json
{
  "idSolicRec": "SC876456782024021577825445312",
  "idRec": "RN123456782024011577825445612",
  "calendario": {
    "dataExpiracaoSolicitacao": "2023-12-20T12:17:11.926Z"
  },
  "status": "CRIADA",
  "destinatario": {
    "agencia": "2569",
    "conta": "550689",
    "cpf": "15231470190",
    "ispbParticipante": "91193552"
  },
  "atualizacao": [
    {
      "data": "2023-12-20T12:18:18.618Z",
      "status": "CRIADA"
    }
  ],
  "recPayload": {
    "idRec": "RN123456782024011577825445612",
    "vinculo": {
      "contrato": "561238008",
      "devedor": {
        "cpf": "15231470190",
        "nome": "Fulano de Tal"
      },
      "objeto": "Serviços de Telecomunicações"
    },
    "calendario": {
      "dataFinal": "2023-12-01",
      "dataInicial": "2024-04-01",
      "periodicidade": "MENSAL"
    },
    "recebedor": {
      "cnpj": "94370926517368",
      "nome": "Empresa de Serviços SA"
    },
    "valor": {
      "valorRec": "1200.09"
    },
    "atualizacao": [
      {
        "data": "2023-12-15T08:30:07.115Z",
        "status": "CRIADA"
      }
    ]
  }
}
~~~

Exemplo de solicitação de confirmação de recorrência 2
~~~json
{
  "idSolicRec": "SC875116782024021577820565312",
  "idRec": "RR692350012024051502650081069",
  "calendario": {
    "dataExpiracaoSolicitacao": "2024-12-15T12:17:11.926Z"
  },
  "status": "REJEITADA",
  "encerramento": {
    "rejeicao": {
      "motivo": "DADOS_BANCARIOS_INVALIDOS"
    }
  },
  "destinatario": {
    "agencia": "1179",
    "conta": "73851",
    "cpf": "07031470825",
    "ispbParticipante": "91193552"
  },
  "atualizacao": [
    {
      "data": "2024-12-15T12:18:18.618Z",
      "status": "CRIADA"
    },
    {
      "data": "2024-12-15T16:18:18.618Z",
      "status": "ENVIADA"
    },
    {
      "data": "2024-12-16T08:50:18.268Z",
      "status": "REJEITADA"
    }
  ],
  "recPayload": {
    "idRec": "RR692350012024051502650081069",
    "vinculo": {
      "contrato": "Assinatura Individual",
      "devedor": {
        "cpf": "07031470825",
        "nome": "Sebastião Silva"
      },
      "objeto": "Serviços de Entrega de Alimentos"
    },
    "valor": {
      "valorMinimoRecebedor": "300.00"
    },
    "calendario": {
      "dataFinal": "2025-05-01",
      "dataInicial": "2024-12-01",
      "periodicidade": "MENSAL"
    },
    "recebedor": {
      "cnpj": "25603926517008",
      "nome": "Empresa de Produtos Alimentícios SA"
    },
    "atualizacao": [
      {
        "data": "2023-12-08T16:24:35.233Z",
        "status": "CRIADA"
      }
    ]
  }
}
~~~

### [PATCH] /solicrec/{idSolicRec}
- Revisar solicitação de confirmação de recorrência.

**header e path variable**

| Parâmetro	           | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| ---------            | -------------- | --------- | ----------- | --------- |
|`idSolicRec`          |path            |string     |Sim          |Identificador da Solicitação da Recorrência.|
|`Authorization`       |header          |string     |Sim          |Token de acesso à API. Obtido através do endpoint de autorização.|
|`x-itau-correlationid`|header          |string     |Sim          |UUID que identifica a requisição, para propósitos de rastreamento.|
|`x-itau-apikey`       |header          |string     |Sim          |Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso.|

**Exemplo de entrada:**

~~~json
{
  "status": "CANCELADA"
}
~~~

**Exemplo de saída:**

~~~json
{
  "idSolicRec": "SC876456782024021577825445312",
  "idRec": "RN123456782024011577825445612",
  "calendario": {
    "dataExpiracaoSolicitacao": "2024-06-11T07:17:11.008Z"
  },
  "status": "CANCELADA",
  "destinatario": {
    "agencia": "2569",
    "conta": "550689",
    "cpf": "15231470190",
    "ispbParticipante": "91193552"
  },
  "atualizacao": [
    {
      "data": "2024-05-16T17:01:06.781Z",
      "status": "CRIADA"
    },
    {
      "data": "2024-05-30T10:18:18.618Z",
      "status": "CANCELADA"
    }
  ],
  "recPayload": {
    "idRec": "RN123456782024011577825445612",
    "vinculo": {
      "contrato": "Banda Larga Fibra Ótica",
      "devedor": {
        "cpf": "15231470190",
        "nome": "Fulano de Tal"
      },
      "objeto": "Serviços de Telecomunicações"
    },
    "valor": {
      "valorRec": "1200.09"
    },
    "calendario": {
      "dataFinal": "2025-05-01",
      "dataInicial": "2024-05-01",
      "periodicidade": "MENSAL"
    },
    "recebedor": {
      "cnpj": "94370926517368",
      "nome": "Empresa de Serviços SA"
    },
    "atualizacao": [
      {
        "data": "2023-12-08T16:24:35.233Z",
        "status": "CRIADA"
      }
    ]
  }
}
~~~

### Agendamento

### [PUT] /cobr/{txId}
- Endpoint para criar uma cobrança recorrente.

**header e path variable**

| Parâmetro	           | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| ---------            | -------------- | --------- | ----------- | --------- |
|`txId`                |path            |string     |Sim          |Identificador da Transação.|
|`Authorization`       |header          |string     |Sim          |Token de acesso à API. Obtido através do endpoint de autorização.|
|`x-itau-correlationid`|header          |string     |Sim          |UUID que identifica a requisição, para propósitos de rastreamento.|
|`x-itau-apikey`       |header          |string     |Sim          |Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso.|

**Exemplo de entrada:**

~~~json
{
  "idRec": "RR1234567820240115abcdefghijk",
  "infoAdicional": "Serviços de Streamming de Música e Filmes.",
  "calendario": {
    "dataDeVencimento": "2024-04-15"
  },
  "valor": {
    "original": "106.07"
  },
  "ajusteDiaUtil": true,
  "devedor": {
    "cep": "89256140",
    "cidade": "Uberlândia",
    "email": "sebastiao.tavares@mail.com",
    "logradouro": "Alameda Franco 1056",
    "uf": "MG"
  },
  "recebedor": {
    "agencia": "9708",
    "conta": "012682",
    "tipoConta": "CORRENTE"
  }
}
~~~

**Exemplo de saída:**

~~~json
{
  "idRec": "RR1234567820240115abcdefghijk",
  "txid": "3136957d93134f2184b369e8f1c0729d",
  "infoAdicional": "Serviços de Streamming de Música e Filmes.",
  "calendario": {
    "criacao": "2024-04-01",
    "dataDeVencimento": "2024-04-15"
  },
  "valor": {
    "original": "106.07"
  },
  "status": "CRIADA",
  "politicaRetentativa": "PERMITE_3R_7D",
  "ajusteDiaUtil": true,
  "devedor": {
    "cep": "89256140",
    "cidade": "Uberlândia",
    "email": "sebastiao.tavares@mail.com",
    "logradouro": "Alameda Franco 1056",
    "uf": "MG"
  },
  "recebedor": {
    "agencia": "9708",
    "conta": "012682",
    "tipoConta": "CORRENTE"
  },
  "atualizacao": [
    {
      "data": "2024-04-01T14:47:29.470Z",
      "status": "CRIADA"
    }
  ]
}
~~~

**Comportamento idempotente (204 No Content):**

Quando o `txId` informado já possui um agendamento realizado previamente para o mesmo ciclo de cobrança, o endpoint retorna o status **204**, sem corpo de resposta, em vez de um erro. Essa situação pode ocorrer quando a mesma solicitação é reenviada — por exemplo, em cenários de timeout na comunicação entre o recebedor e o Itaú — evitando que uma chamada repetida seja interpretada como falha.

~~~json
204 NO CONTENT
~~~

### [PATCH] /cobr/{txId}
- Revisar cobrança recorrente.

**header e path variable**

| Parâmetro	           | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| ---------            | -------------- | --------- | ----------- | --------- |
|`txId`                |path            |string     |Sim          |Identificador da Transação.|
|`Authorization`       |header          |string     |Sim          |Token de acesso à API. Obtido através do endpoint de autorização.|
|`x-itau-correlationid`|header          |string     |Sim          |UUID que identifica a requisição, para propósitos de rastreamento.|
|`x-itau-apikey`       |header          |string     |Sim          |Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso.|

**Exemplo de entrada:**

~~~json
{
  "status": "CANCELADA"
}
~~~

**Exemplo de saída:**

~~~json
{
  "idRec": "RN985156112024071999000566354",
  "txid": "517bd858b59d458a841280b0f0a60bfa",
  "calendario": {
    "criacao": "2024-05-20",
    "dataDeVencimento": "2024-06-20"
  },
  "valor": {
    "original": "210.00"
  },
  "status": "CANCELADA",
  "politicaRetentativa": "NAO_PERMITE",
  "ajusteDiaUtil": true,
  "devedor": {
    "cep": "26901340",
    "cidade": "São Luís",
    "email": "fulano.tal@mail.com",
    "logradouro": "Alameda Cardoso 1007",
    "uf": "MA"
  },
  "recebedor": {
    "cnpj": "31166575201770",
    "conta": "107262",
    "nome": "Empresa de Telecomunicações SA",
    "tipoConta": "POUPANÇA"
  },
  "tentativas": [
    {
      "dataLiquidacao": "2024-06-20",
      "tipo": "AGND",
      "endToEndId": "E12345678202406201221abcdef12345",
      "status": "CANCELADA"
    }
  ],
  "encerramento": {
    "cancelamento": {
      "solicitante": "USUARIO_RECEBEDOR",
      "codigo": "SLCR",
      "descricao": "Cancelamento de agendamento solicitado pelo usuário recebedor"
    }
  },
  "atualizacao": [
    {
      "data": "2024-05-20T14:47:29.470Z",
      "status": "CRIADA"
    },
    {
      "data": "2024-05-21T10:18:20.120Z",
      "status": "ATIVA"
    },
    {
      "data": "2024-05-26T10:18:20.120Z",
      "status": "CANCELADA"
    }
  ]
}
~~~

### [GET] /cobr/{txId}
Endpoint para consultar uma cobrança recorrente através de um determinado txid.

**header e path variable**

| Parâmetro	           | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| ---------            | -------------- | --------- | ----------- | --------- |
|`txId`                |path            |string     |Sim          |Identificador da Transação.|
|`Authorization`       |header          |string     |Sim          |Token de acesso à API. Obtido através do endpoint de autorização.|
|`x-itau-correlationid`|header          |string     |Sim          |UUID que identifica a requisição, para propósitos de rastreamento.|
|`x-itau-apikey`       |header          |string     |Sim          |Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso.|


**Exemplo de saída:**

Exemplo de cobrança recorrente 1
~~~json
{
  "idRec": "RR1234567820240115abcdefghijk",
  "txid": "3136957d93134f2184b369e8f1c0729d",
  "infoAdicional": "Serviços de Streamming de Música e Filmes.",
  "calendario": {
    "criacao": "2024-04-01",
    "dataDeVencimento": "2024-04-15"
  },
  "valor": {
    "original": "106.07"
  },
  "status": "CRIADA",
  "politicaRetentativa": "PERMITE_3R_7D",
  "ajusteDiaUtil": true,
  "devedor": {
    "cep": "89256140",
    "cidade": "Uberlândia",
    "email": "sebastiao.tavares@mail.com",
    "logradouro": "Alameda Franco 1056",
    "uf": "MG"
  },
  "recebedor": {
    "agencia": "9708",
    "conta": "012682",
    "tipoConta": "CORRENTE"
  },
  "atualizacao": [
    {
      "data": "2024-04-01T14:47:29.470Z",
      "status": "CRIADA"
    }
  ]
}
~~~

Exemplo de cobrança recorrente 2
~~~json
{
  "idRec": "RR123456782024061999000566354",
  "txid": "7f733863543b4a16b516d839bd4bc34e",
  "calendario": {
    "criacao": "2024-05-20",
    "dataDeVencimento": "2024-06-20"
  },
  "valor": {
    "original": "50.33"
  },
  "status": "ATIVA",
  "politicaRetentativa": "PERMITE_3R_7D",
  "ajusteDiaUtil": true,
  "devedor": {
    "cep": "63259740",
    "cidade": "Campinas",
    "email": "beltrano.silva@mail.com",
    "logradouro": "Rua Gonçalves Dias 605",
    "uf": "SP"
  },
  "recebedor": {
    "cnpj": "58966551101210",
    "conta": "997182",
    "tipoConta": "CORRENTE"
  },
  "tentativas": [
    {
      "dataLiquidacao": "2024-06-22",
      "tipo": "AGND",
      "endToEndId": "E12345678202406201221abcdef12345",
      "status": "EXPIRADA"
    },
    {
      "dataLiquidacao": "2024-06-24",
      "tipo": "NTAG",
      "endToEndId": "E12345678202406201221abcdef12345",
      "status": "AGENDADA"
    }
  ],
  "atualizacao": [
    {
      "data": "2024-05-20T14:47:29.470Z",
      "status": "CRIADA"
    },
    {
      "data": "2024-05-21T10:18:20.120Z",
      "status": "ATIVA"
    }
  ]
}
~~~

Exemplo de cobrança recorrente 3
~~~json
{
  "idRec": "RN985156112024071999000566354",
  "txid": "517bd858b59d458a841280b0f0a60bfa",
  "calendario": {
    "criacao": "2024-05-20",
    "dataDeVencimento": "2024-06-20"
  },
  "valor": {
    "original": "210.00"
  },
  "status": "CANCELADA",
  "politicaRetentativa": "NAO_PERMITE",
  "ajusteDiaUtil": true,
  "devedor": {
    "cep": "26901340",
    "cidade": "São Luís",
    "email": "fulano.tal@mail.com",
    "logradouro": "Alameda Cardoso 1007",
    "uf": "MA"
  },
  "recebedor": {
    "cnpj": "31166575201770",
    "conta": "107262",
    "nome": "Empresa de Telecomunicações SA",
    "tipoConta": "POUPANÇA"
  },
  "tentativas": [
    {
      "dataLiquidacao": "2024-06-20",
      "tipo": "AGND",
      "endToEndId": "E12345678202406201221abcdef12345",
      "status": "CANCELADA"
    }
  ],
  "encerramento": {
    "cancelamento": {
      "solicitante": "USUARIO_RECEBEDOR",
      "codigo": "SLCR",
      "descricao": "Cancelamento de agendamento solicitado pelo usuário recebedor"
    }
  },
  "atualizacao": [
    {
      "data": "2024-05-20T14:47:29.470Z",
      "status": "CRIADA"
    },
    {
      "data": "2024-05-21T10:18:20.120Z",
      "status": "ATIVA"
    },
    {
      "data": "2024-05-26T10:18:20.120Z",
      "status": "CANCELADA"
    }
  ]
}
~~~

### [POST] /cobr
Criar cobrança recorrente.

**header e path variable**

| Parâmetro	           | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| ---------            | -------------- | --------- | ----------- | --------- |
|`Authorization`       |header          |string     |Sim          |Token de acesso à API. Obtido através do endpoint de autorização.|
|`x-itau-correlationid`|header          |string     |Sim          |UUID que identifica a requisição, para propósitos de rastreamento.|
|`x-itau-apikey`       |header          |string     |Sim          |Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso.|

**Exemplo de entrada:**
~~~json
{
  "idRec": "RR1234567820240115abcdefghijk",
  "infoAdicional": "Serviços de Streamming de Música e Filmes.",
  "calendario": {
    "dataDeVencimento": "2024-04-15"
  },
  "valor": {
    "original": "106.07"
  },
  "ajusteDiaUtil": true,
  "devedor": {
    "cep": "89256140",
    "cidade": "Uberlândia",
    "email": "sebastiao.tavares@mail.com",
    "logradouro": "Alameda Franco 1056",
    "uf": "MG"
  },
  "recebedor": {
    "agencia": "9708",
    "conta": "012682",
    "tipoConta": "CORRENTE"
  }
}
~~~

**Exemplo de saída:**
~~~json
{
  "idRec": "RR1234567820240115abcdefghijk",
  "txid": "3136957d93134f2184b369e8f1c0729d",
  "infoAdicional": "Serviços de Streamming de Música e Filmes.",
  "calendario": {
    "criacao": "2024-04-01",
    "dataDeVencimento": "2024-04-15"
  },
  "status": "CRIADA",
  "valor": {
    "original": "106.07"
  },
  "politicaRetentativa": "PERMITE_3R_7D",
  "ajusteDiaUtil": true,
  "devedor": {
    "cep": "89256140",
    "cidade": "Uberlândia",
    "email": "sebastiao.tavares@mail.com",
    "logradouro": "Alameda Franco 1056",
    "uf": "MG"
  },
  "recebedor": {
    "agencia": "9708",
    "conta": "012682",
    "tipoConta": "CORRENTE"
  },
  "atualizacao": [
    {
      "data": "2024-04-01T14:47:29.470Z",
      "status": "CRIADA"
    }
  ]
}
~~~

### [GET] /cobr
Endpoint para consultar cobranças recorrentes através de parâmetros como início, fim, idRec, cpf, cnpj e status.

**header e path variable**

| Parâmetro	                | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| ------------------------- | -------------- | --------- | ----------- | --------- |
|`inicio`                   |query           |string     |Sim          |Data inicial utilizada na consulta. Respeita RFC 3339.|
|`fim`                      |query           |string     |Sim          |Data de fim utilizada na consulta. Respeita RFC 3339.|
|`idRec`                    |query           |string     |Sim          |Identificador da Recorrência.|
|`cpf`                      |query           |string     |Não          |Filtro pelo CPF do devedor. Não pode ser utilizado ao mesmo tempo que o CNPJ.|
|`cnpj`                     |query           |string     |Não          |Filtro pelo CNPJ do devedor. Não pode ser utilizado ao mesmo tempo que o CPF.|
|`status`                   |query           |string     |Não          |Filtro pelo status das cobranças.|
|`paginacao.paginaAtual`    |query           |integer    |Não          |Número da página recuperada.|
|`paginacao.itensPorPagina` |query           |integer    |Não          |Quantidade de registros retornado na página.|
|`Authorization`            |header          |string     |Sim          |Token de acesso à API. Obtido através do endpoint de autorização.|
|`x-itau-correlationid`     |header          |string     |Sim          |UUID que identifica a requisição, para propósitos de rastreamento.|
|`x-itau-apikey`            |header          |string     |Sim          |Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso.|


**Exemplo de saída:**

~~~json
{
  "parametros": {
    "inicio": "2024-04-01T00:00:00Z",
    "fim": "2024-12-01T23:59:59Z",
    "paginacao": {
      "paginaAtual": 0,
      "itensPorPagina": 100,
      "quantidadeDePaginas": 1,
      "quantidadeTotalDeItens": 1
    }
  },
  "cobsr": [
    {
      "idRec": "RR123456782024061999000566354",
      "txid": "7f733863543b4a16b516d839bd4bc34e",
      "calendario": {
        "criacao": "2024-05-20",
        "dataDeVencimento": "2024-06-20"
      },
      "valor": {
        "original": "50.33"
      },
      "status": "ATIVA",
      "ajusteDiaUtil": false,
      "politicaRetentativa": "PERMITE_3R_7D",
      "devedor": {
        "cep": "63259740",
        "cidade": "Campinas",
        "email": "beltrano.silva@mail.com",
        "logradouro": "Rua Gonçalves Dias 605",
        "uf": "SP"
      },
      "recebedor": {
        "conta": "997182",
        "tipoConta": "CORRENTE"
      },
      "tentativas": [
        {
          "dataLiquidacao": "2024-06-20",
          "tipo": "AGND",
          "status": "AGENDADA",
          "endToEndId": "E12345678202406201221abcdef12345",
          "atualizacao": [
            {
              "data": "2024-05-21T10:40:16.730Z",
              "status": "SOLICITADA"
            },
            {
              "data": "2024-05-21T17:08:00.520Z",
              "status": "AGENDADA"
            }
          ]
        }
      ],
      "atualizacao": [
        {
          "data": "2024-05-20T14:47:29.470Z",
          "status": "CRIADA"
        },
        {
          "data": "2024-05-21T10:18:20.120Z",
          "status": "ATIVA"
        }
      ]
    }
  ]
}
~~~

### [POST] /cobr/{txId}/retentativa/{data}
Endpoint para solicitar retentativa de uma cobrança recorrente.

**header e path variable**

| Parâmetro	           | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| ---------            | -------------- | --------- | ----------- | --------- |
|`txId`                |path            |string     |Sim          |Identificador da Transação.|
|`data`                |path            |string     |Sim          |Data prevista para liquidação da ordem de pagamento correspondente. Trata-se de uma data, no formato `YYYY-MM-DD`, segundo ISO 8601.|
|`Authorization`       |header          |string     |Sim          |Token de acesso à API. Obtido através do endpoint de autorização.|
|`x-itau-correlationid`|header          |string     |Sim          |UUID que identifica a requisição, para propósitos de rastreamento.|
|`x-itau-apikey`       |header          |string     |Sim          |Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso.|

**Exemplo de saída:**

~~~json
{
  "idRec": "RR123456782024061999000566354",
  "txid": "7f733863543b4a16b516d839bd4bc34e",
  "calendario": {
    "criacao": "2024-05-20",
    "dataDeVencimento": "2024-06-20"
  },
  "valor": {
    "original": "50.33"
  },
  "status": "ATIVA",
  "politicaRetentativa": "PERMITE_3R_7D",
  "ajusteDiaUtil": true,
  "devedor": {
    "cep": "63259740",
    "cidade": "Campinas",
    "email": "beltrano.silva@mail.com",
    "logradouro": "Rua Gonçalves Dias 605",
    "uf": "SP"
  },
  "recebedor": {
    "cnpj": "58966551101210",
    "conta": "997182",
    "tipoConta": "CORRENTE"
  },
  "tentativas": [
    {
      "dataLiquidacao": "2024-06-22",
      "tipo": "AGND",
      "endToEndId": "E12345678202406201221abcdef12345",
      "status": "EXPIRADA"
    },
    {
      "dataLiquidacao": "2024-06-24",
      "tipo": "NTAG",
      "endToEndId": "E12345678202406201221abcdef12345",
      "status": "AGENDADA"
    }
  ],
  "atualizacao": [
    {
      "data": "2024-05-20T14:47:29.470Z",
      "status": "CRIADA"
    },
    {
      "data": "2024-05-21T10:18:20.120Z",
      "status": "ATIVA"
    }
  ]
}
~~~


### Location Recorrência

Reune endpoints destinados a lidar com configuração e remoção de locations para uso dos payloads de recorrências.

### [POST] /locrec
- Criar location do payload

**header e path variable**

| Parâmetro	           | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| ---------            | -------------- | --------- | ----------- | --------- |
|`Authorization`       |header          |string     |Sim          |Token de acesso à API. Obtido através do endpoint de autorização.|
|`x-itau-correlationid`|header          |string     |Sim          |UUID que identifica a requisição, para propósitos de rastreamento.|
|`x-itau-apikey`       |header          |string     |Sim          |Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso.|

**Exemplo de saída:**

~~~json
{
  "id": 12069,
  "location": "pix.example.com/qr/v2/rec/2353c790eefb11eaadc10242ac120002",
  "criacao": "2023-12-20T12:38:28.774Z"
}
~~~

### [GET] /locrec
- Consultar locations cadastradas

**header e path variable**

| Parâmetro	           | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| ---------            | -------------- | --------- | ----------- | --------- |
|`inicio`              |query           |string     |Sim          |Data inicial utilizada na consulta. Respeita RFC 3339.|
|`fim`                 |query           |string     |Sim          |Data de fim utilizada na consulta. Respeita RFC 3339.|
|`idRecPresente`       |query           |boolean    |Não          |Filtro pela existência de id da recorrência.|
|`paginacao.paginaAtual`    |query      |integer    |Não          |Número da página recuperada.|
|`paginacao.itensPorPagina` |query      |integer    |Não          |Quantidade de registros retornado na página.|
|`Authorization`       |header          |string     |Sim          |Token de acesso à API. Obtido através do endpoint de autorização.|
|`x-itau-correlationid`|header          |string     |Sim          |UUID que identifica a requisição, para propósitos de rastreamento.|
|`x-itau-apikey`       |header          |string     |Sim          |Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso.|

**Exemplo de saída:**

~~~json
{
  "parametros": {
    "inicio": "2020-01-01T00:00:00Z",
    "fim": "2020-12-01T17:00:00Z",
    "idRecPresente": true,
    "paginacao": {
      "paginaAtual": 0,
      "itensPorPagina": 1,
      "quantidadeDePaginas": 1,
      "quantidadeTotalDeItens": 0
    }
  },
  "loc": [
    {
      "id": 0,
      "location": "pix.example.com/qr/v2/rec/2353c790eefb11eaadc10242ac120002",
      "criacao": "2024-10-24T19:16:37.752Z",
      "idRec": "RR1234567820240115abcdefghijk"
    }
  ]
}
~~~

### [GET] /locrec/{Id}
- Recuperar location do payload

**header e path variable**

| Parâmetro	           | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| ---------            | -------------- | --------- | ----------- | --------- |
|`id`                  |path            |string     |Sim          |Identificador da location de recorrência|
|`Authorization`       |header          |string     |Sim          |Token de acesso à API. Obtido através do endpoint de autorização.|
|`x-itau-correlationid`|header          |string     |Sim          |UUID que identifica a requisição, para propósitos de rastreamento.|
|`x-itau-apikey`       |header          |string     |Sim          |Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso.|


**Exemplo de saída:**

~~~json
{
  "id": 12069,
  "location": "pix.example.com/qr/v2/rec/2353c790eefb11eaadc10242ac120002",
  "criacao": "2023-12-20T12:38:28.774Z",
  "idRec": "RR123456782024011510056892226"
}
~~~

### [DELETE] /locrec/{Id}/{idRec}
- Desvincular uma recorrência de uma location

Endpoint utilizado para desvincular uma recorrência de uma location.

Se executado com sucesso, a entidade `loc` não apresentará mais uma recorrência, se apresentava anteriormente à chamada. Adicionalmente, a entidade associada ao recurso desvinculado também passará a não mais apresentar um location. Esta operação não altera o `status` do recurso em questão.

**header e path variable**

| Parâmetro	           | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| ---------            | -------------- | --------- | ----------- | --------- |
|`id`                  |path            |string     |Sim          |Identificador da location de recorrência|
|`Authorization`       |header          |string     |Sim          |Token de acesso à API. Obtido através do endpoint de autorização.|
|`x-itau-correlationid`|header          |string     |Sim          |UUID que identifica a requisição, para propósitos de rastreamento.|
|`x-itau-apikey`       |header          |string     |Sim          |Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso.|

**Exemplo de saída:**

~~~json
{
  "id": 12069,
  "location": "pix.example.com/qr/v2/rec/2353c790eefb11eaadc10242ac120002",
  "criacao": "2023-12-20T12:38:28.774Z"
}
~~~

### Webhook Recorrência


### [PUT] /webhookrec
- Configurar Webhook

Endpoint opcional para configuração do serviço de notificações acerca de recorrências. 

Para que o usuário recebedor possa receber notificações acerca do status de uma cobrança, é necessário que o usuário recebedor crie e proveja sua própria API de recebimento de notificações, de acordo com as especificações do Bacen e conforme a aba "Callback" abaixo, para acionamento.

Este endpoint, PUT /webhookcobr, deve ser chamado para cadastrar a URL completa da API do usuário recebedor nos nossos sistemas. O cadastro pode ser feito em qualquer momento após o onboarding, mas o usuário recebedor só passa a receber as notificações das cobranças correntes após o cadastro com este endpoint.

#### Pré-requisitos:
É necessário que o usuário recebedor tenha feito o processo de onboarding e ativado o produto Pix Automático.

#### Quanto ao disparo de notificações:
Os sistemas do Itaú se comunicam com a API cadastrada neste endpoint, na ocorrência de notificação, via mTLS. O Itaú faz o papel do cliente, enquanto a API parceira faz o papel de servidor nessa conexão. Para garantir que a conexão será fechada, o parceiro deve observar, quanto aos certificados:

**C.A do Cliente (Itaú):** Para fluxo mTLS, o Itaú utiliza sua própria Chave Pública (CA). Portanto, para que o servidor do parceiro valide a autenticidade da chamada executada pelo Itaú em sua URL de webhook, é necessário realizar o trust da CA do Itaú. Mais informações e a CA do Itaú para download podem ser encontradas [neste link](https://devportal.itau.com.br/autenticacao-documentacao), em "Fluxos de autenticação Webhook".

**C.A do do Webhook (API do parceiro):** Para que o Itaú consiga estabelecer comunicação TLS/SSL na chamada do webhook, é necessário que o parceiro verifique se a CA usada pelo servidor de domínios consta na seguinte relação:
- Amazon
- DigiCert
- GlobalSign
- Comodo
- Entrust
- GeoTrust
- Thawte
- VeriSign
- GoDaddy

Caso a CA não esteja na relação acima, o parceiro deve entrar em contato com o time de implantação técnica do Itaú para habilitação da CA na plataforma.

**header e path variable**

| Parâmetro	           | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| ---------            | -------------- | --------- | ----------- | --------- |
|`Authorization`       |header          |string     |Sim          |Token de acesso à API. Obtido através do endpoint de autorização.|
|`x-itau-correlationid`|header          |string     |Sim          |UUID que identifica a requisição, para propósitos de rastreamento.|
|`x-itau-apikey`       |header          |string     |Sim          |Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso.|

**Exemplo de entrada:**

~~~json
{
  "webhookUrl": "https://usuario.recebedor.com/api/webhookrec/"
}
~~~

**Exemplo de saída:**

~~~json
200 OK
~~~

#### Callbacks
#### [POST] {$request.body#/webhookUrl/rec}

**Exemplo de entrada:**

~~~json
{
  "recs": [
    {
      "idRec": "RR1026652320240821lab77511abf",
      "status": "APROVADA",
      "atualizacao": [
        {
          "status": "CRIADA",
          "data": "2024-08-20T10:12:07.567Z"
        },
        {
          "status": "APROVADA",
          "data": "2024-08-22T12:43:53.337Z"
        }
      ],
      "ativacao": {
        "tipoJornada": "JORNADA_3",
        "dadosJornada": {
          "txid": "r9eFIFmwcZ55Nm4RsKZAAtIvvCrlcNN6"
        }
      }
    }
  ]
}
~~~

**Exemplo de saída:**

~~~json
200 OK
~~~


### [GET] /webhookrec
- Exibir informações acerca do Webhook

Endpoint para recuperação de informações sobre o Webhook.
Neste endpoint, obtenha informações sobre qual URL foi cadastrada pelo parceiro para recebimento de notificações e data de criação.


**header e path variable**

| Parâmetro	           | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| ---------            | -------------- | --------- | ----------- | --------- |
|`Authorization`       |header          |string     |Sim          |Token de acesso à API. Obtido através do endpoint de autorização.|
|`x-itau-correlationid`|header          |string     |Sim          |UUID que identifica a requisição, para propósitos de rastreamento.|
|`x-itau-apikey`       |header          |string     |Sim          |Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso.|


**Exemplo de saída:**

~~~json
{
  "webhookUrl": "https://usuario.recebedor.com/api/webhookrec/",
  "criacao": "2023-12-20T12:51:16.485Z"
}
~~~

### [DELETE] /webhookrec
- Cancelar o webhook

Endpoint para cancelamento do webhook. Não é a única forma pela qual um webhook pode ser removido.

Caso o parceiro queira parar de receber notificações sobre recorrência, pode utilizar este endpoint. O parceiro pode reativar o recebimento de notificações a qualquer momento por meio do enpoint PUT.

**header e path variable**

| Parâmetro	           | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| ---------            | -------------- | --------- | ----------- | --------- |
|`Authorization`       |header          |string     |Sim          |Token de acesso à API. Obtido através do endpoint de autorização.|
|`x-itau-correlationid`|header          |string     |Sim          |UUID que identifica a requisição, para propósitos de rastreamento.|
|`x-itau-apikey`       |header          |string     |Sim          |Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso.|

**Exemplo de saída:**

~~~json
204 NO CONTENT
~~~

### Webhook Agendamento

### [PUT] /webhookcobr
- Configurar Webhook

Endpoint opcional para configuração do serviço de notificações acerca de cobranças recorrentes. Somente cobranças recorrentes associadas ao usuário recebedor serão notificadas.

Para que o usuário recebedor possa receber notificações acerca do status de uma cobrança, é necessário que o usuário recebedor crie e proveja sua própria API de recebimento de notificações, de acordo com as especificações do Bacen e conforme a aba "Callback" abaixo, para acionamento.

Este endpoint, PUT /webhookcobr, deve ser chamado para cadastrar a URL completa da API do usuário recebedor nos nossos sistemas. O cadastro pode ser feito em qualquer momento após o onboarding, mas o usuário recebedor só passa a receber as notificações das cobranças correntes após o cadastro com este endpoint.

#### Pré-requisitos:
É necessário que o usuário recebedor tenha feito o processo de onboarding e ativado o produto Pix Automático.

#### Quanto ao disparo de notificações:
Os sistemas do Itaú se comunicam com a API cadastrada neste endpoint, na ocorrência de notificação, via mTLS. O Itaú faz o papel do cliente, enquanto a API parceira faz o papel de servidor nessa conexão. Para garantir que a conexão será fechada, o parceiro deve observar, quanto aos certificados:

**C.A do Cliente (Itaú):** Para fluxo mTLS, o Itaú utiliza sua própria Chave Pública (CA). Portanto, para que o servidor do parceiro valide a autenticidade da chamada executada pelo Itaú em sua URL de webhook, é necessário realizar o trust da CA do Itaú. Mais informações e a CA do Itaú para download podem ser encontradas [neste link](https://devportal.itau.com.br/autenticacao-documentacao), em "Fluxos de autenticação Webhook".

**C.A do do Webhook (API do parceiro):** Para que o Itaú consiga estabelecer comunicação TLS/SSL na chamada do webhook, é necessário que o parceiro verifique se a CA usada pelo servidor de domínios consta na seguinte relação:
- Amazon
- DigiCert
- GlobalSign
- Comodo
- Entrust
- GeoTrust
- Thawte
- VeriSign
- GoDaddy

Caso a CA não esteja na relação acima, o parceiro deve entrar em contato com o time de implantação técnica do Itaú para habilitação da CA na plataforma.

**header e path variable**

| Parâmetro	           | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| ---------            | -------------- | --------- | ----------- | --------- |
|`Authorization`       |header          |string     |Sim          |Token de acesso à API. Obtido através do endpoint de autorização.|
|`x-itau-correlationid`|header          |string     |Sim          |UUID que identifica a requisição, para propósitos de rastreamento.|
|`x-itau-apikey`       |header          |string     |Sim          |Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso.|

**Exemplo de entrada:**

~~~json
{
  "webhookUrl": "https://usuario.recebedor.com/api/webhookcobr/"
}
~~~

**Exemplo de saída:**

~~~json
200 OK
~~~

#### Callbacks
#### [POST] {$request.body#/webhookUrl/cobr}

**Exemplo de entrada:**

Exemplo de cobrança recorrente ATIVA:
~~~json
{
  "cobsr": [
    {
      "idRec": "RR1234567820240115abcdefghijk",
      "txid": "3136957d93134f2184b369e8f1c0729d",
      "status": "ATIVA",
      "atualizacao": [
        {
          "status": "ATIVA",
          "data": "2024-08-20T12:34:21.300Z"
        }
      ],
      "tentativas": [
        {
          "dataLiquidacao": "2024-12-08",
          "tipo": "AGND",
          "status": "SOLICITADA",
          "endToEndId": "E12345678202406201221abcdef12345"
        }
      ]
    }
  ]
}
~~~

Exemplo de cobrança recorrente CONCLUIDA:
~~~json
{
  "cobsr": [
    {
      "idRec": "RR1234567820240115abcdefghijk",
      "txid": "3136957d93134f2184b369e8f1c0729d",
      "status": "CONCLUIDA",
      "atualizacao": [
        {
          "status": "CONCLUIDA",
          "data": "2020-09-09T20:16:00.358Z"
        }
      ],
      "tentativas": [
        {
          "dataLiquidacao": "2024-09-09",
          "tipo": "AGND",
          "status": "PAGA",
          "endToEndId": "E12345678202409091221abcdef12345"
        }
      ],
      "pix": [
        {
          "endToEndId": "E12345678202409091221abcdef12345",
          "txid": "3136957d93134f2184b369e8f1c0729d",
          "valor": "1000.00",
          "horario": "2020-09-09T20:15:00.358Z",
          "infoPagador": "0123456789"
        }
      ]
    }
  ]
}
~~~

**Exemplo de saída:**

~~~json
200 OK
~~~

### [GET] /webhookcobr
- Exibir informações acerca do Webhook

Endpoint para recuperação de informações sobre o Webhook.
Neste endpoint, obtenha informações sobre qual URL foi cadastrada pelo parceiro para recebimento de notificações e data de criação.

**header e path variable**

| Parâmetro	           | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| ---------            | -------------- | --------- | ----------- | --------- |
|`Authorization`       |header          |string     |Sim          |Token de acesso à API. Obtido através do endpoint de autorização.|
|`x-itau-correlationid`|header          |string     |Sim          |UUID que identifica a requisição, para propósitos de rastreamento.|
|`x-itau-apikey`       |header          |string     |Sim          |Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso.|

**Exemplo de saída:**

~~~json
{
  "webhookUrl": "https://usuario.recebedor.com/api/webhookcobr/",
  "criacao": "2023-12-20T12:51:16.485Z"
}
~~~

### [DELETE] /webhookcobr
- Cancelar o webhook

Endpoint para cancelamento do webhook. Não é a única forma pela qual um webhook pode ser removido.

Caso o parceiro queira parar de receber notificações sobre recorrência, pode utilizar este endpoint. O parceiro pode reativar o recebimento de notificações a qualquer momento por meio do enpoint PUT.

**header e path variable**

| Parâmetro	           | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| ---------            | -------------- | --------- | ----------- | --------- |
|`Authorization`       |header          |string     |Sim          |Token de acesso à API. Obtido através do endpoint de autorização.|
|`x-itau-correlationid`|header          |string     |Sim          |UUID que identifica a requisição, para propósitos de rastreamento.|
|`x-itau-apikey`       |header          |string     |Sim          |Chave que identifica o chamador. Mesma credencial usada para gerar o token de acesso.|

**Exemplo de saída:**

~~~json
204 NO CONTENT
~~~


## Padrões de erros
Essa API retorna códigos de status HTTP para indicar sucesso ou falhas das requisições.

Códigos **2xx** indicam sucesso.

Códigos **4xx** indicam falhas causadas pelas informações enviadas pelo cliente ou pelo estado atual das entidades.

Códigos **5xx** indicam problemas no serviço no lado da API.

As respostas de erro incluem no corpo detalhes do erro e o campo type identifica o tipo de erro.

Abaixo estão listados os tipos de erro que podem ser retornados por quaisquer endpoints listados nessa documentação.

| HTTP Status Code          | Descrição             | Significado |
| ------------------------- | --------              | ----------- |
| 204 No Content            | AgendamentoExistente  | retorno idempotente do `PUT /cobr/{txId}`, sem corpo de resposta: o txid informado já possui um agendamento realizado previamente para o mesmo ciclo de cobrança |
| 400 Bad Request           | RequisicaoInvalida    | requisição inválida |
| 401 Unauthorized          | TokenExpirado         | token de acesso expirado. Solicite um novo token de autenticação |
| 403 Forbidden             | AcessoNegado          | requisição de participante autenticado que viola alguma regra de autorização |
| 403 Forbidden             | ChaveAPIInvalida      | a chave de API fornecida é inválida ou não possui permissão para acessar este recurso |
| 404 Not Found             | NaoEncontrado         | entidade não encontrada |
| 410 Gone                  | PermanentementeRemovido | Indica que a entidade existia, mas foi permanentemente removida. |
| 500 INTERNAL Server Error | ErroInternoDoServidor | condição inesperada ao processar requisição |
| 503 Service Unavailable   | ServicoIndisponivel   | serviço não está disponível no momento. Serviço solicitado pode estar em manutenção ou fora da janela de funcionamento |
| 504 Gateway Timeout       | IndisponibilidadePorTempoEsgotado	 | indica que o serviço demorou além do esperado para retornar |

O campo `type` identifica o tipo de erro e na API Pix segue o padrão:

`https://pix.bcb.gov.br/api/v2/error/<TipoErro>`

O padrão acima listado, referente ao campo `type`, não consiste, necessariamente, em uma
URL que apresentará uma página web válida, ou um endpoint válido, embora possa, futuramente,
ser exatamente o caso. O objetivo primário é apenas e tão somente identificar o tipo de erro.

Convém reforçar que a API Pix contempla uma lista de produtos e respectivas funcionalidades ofertadas pelo PSP recebedor. 
Cabendo à relação contratual com cada usuário recebedor a concessão da totalidade ou de um subconjunto de acessos
relacionados aos produtos ofertados. Por exemplo, o usuário recebedor, ao acessar uma funcionalidade não contemplada 
no seu escopo contratual, receberá o erro geral `AcessoNegado` descrito na próxima seção.

Abaixo estão listados os tipos de erro e possíveis violações da API Pix.

## Gerais

Abaixo estão listados os tipos de erro que podem ser retornados por quaisquer endpoints listados nessa documentação.

### `RequisicaoInvalida`

    * __Significado__: Requisição inválida ou não pode ser processada.
    * __HTTP Status Code__: [400 Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1).
    * __Possíveis Causas__:
        - Parâmetros da requisição inválidos ou ausentes
        - Corpo da requisição malformado ou não respeita o schema
        - Problemas de autenticação (token ausente ou inválido)
        - Problemas de autorização (sem permissão para o recurso)
        - Recurso solicitado não existe 
        - Tipo de mídia (Content-Type) não suportado
    * __Ação Recomendada__: Verifique o campo `detail` na resposta JSON para identificar a causa específica do erro.

### `AcessoNegado`

    * __Significado__: Requisição de participante autenticado que viola alguma regra de autorização ou possui token expirado.
    * __HTTP Status Code__: [403 Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3) ou [401 Unauthorized](https://tools.ietf.org/html/rfc7231#section-6.5.1).
    * __Causas Comuns__: Token OAuth expirado/ausente,  usuário sem permissão, assinatura AWS incorreta, ou bloqueio de segurança (WAF).
    * __Ação Recomendada__: Renove o token OAuth se expirado, verifique o header `x-itau-apikey`, confirme suas permissões e consulte o campo `detail` na resposta.


### `NaoEncontrado`

    * __Significado__: Entidade não encontrada.
    * __HTTP Status Code__: [404 Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4).

### `PermanentementeRemovido`

    * __Significado__: Indica que a entidade existia, mas foi permanentemente removida.
    * __HTTP Status Code__: [410 Gone](https://tools.ietf.org/html/rfc7231#section-6.5.9).

### `ErroInternoDoServidor`

    * __Significado__: Condição inesperada ao processar requisição.
    * __HTTP Status Code__: [500 Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1).

### `ServicoIndisponivel`

    * __Significado__: Serviço não está disponível no momento. Serviço solicitado pode estar em manutenção ou fora da janela de funcionamento.
    * __HTTP Status Code__: [503 Service Unavailable](https://tools.ietf.org/html/rfc7231#section-6.6.4).

### `IndisponibilidadePorTempoEsgotado`

    * __Significado__: Indica que o serviço demorou além do esperado para retornar.
    * __HTTP Status Code__: [504 Gateway Timeout](https://tools.ietf.org/html/rfc7231#section-6.6.5).

### Tag Rec

Esta seção reúne erros retornados pelos endpoints organizados sob a tag `Rec`.
Esses erros indicam problemas no gerenciamento de uma recorrência.

#### `RecNaoEncontrada`

* __Significado__: Recorrência não encontrada para o idRec informado.
* __HTTP Status Code__: [404](https://tools.ietf.org/html/rfc7231#section-6.5.4).
* __endpoints__: `[GET|PATCH] /rec/{idRec}`. 

#### `RecOperacaoInvalida`

* __Significado__: a requisição que busca alterar ou criar uma recorrência não respeita o _schema_ ou está semanticamente errada.
* __HTTP Status Code__: [400](https://tools.ietf.org/html/rfc7231#section-6.5.1).
* __endpoints__: `POST /rec` e `PATCH /rec/{idRec}`.


__Violações__ para o endpoint `POST /rec`:
    - O objeto `rec.vinculo` não respeita o _schema_.
    - O campo `rec.calendario.dataInicial` é anterior à data de criação da recorrência.
    - O campo `rec.calendario.dataFinal` é anterior ao campo `rec.calendario.dataInicial`.
    - O campo `rec.calendario.periodicidade` não respeita o _schema_.
    - O objeto `rec.valor` não respeita o _schema_.
    - O campo `rec.valor.valorRec` não respeita o _schema_.
    - O campo `rec.valor.valorMinimoRecebedor` não respeita o _schema_.
    - Ambos os campos `rec.valor.valorRec` e `rec.valor.valorMinimoRecebedor` estão preenchidos.
    - O objeto `rec.recebedor` não respeita o _schema_.
    - O campo `rec.politicaRetentativa` não respeita o _schema_.
    - O location referenciado por `rec.loc` inexiste.
    - O location referenciado por `rec.loc` já está sendo utilizado por outra recorrência.
    - O valor do campo `rec.recebedor.convenio` não é aceito pelo PSP Recebedor.
    - o recebedor da cobrança identificado pelo campo `rec.dadosJornada.txid` não corresponde ao recebedor associado à recorrência.


__Violações__ para o endpoint `PATCH /rec/{idRec}`:

    - O campo `rec.calendario.dataInicial` é anterior à data de criação da recorrência.
    - O location referenciado por `rec.loc` inexiste.
    - O location referenciado por `rec.loc` já está sendo utilizado por outra recorrência.
    - O campo `rec.status` não respeita o _schema_.
    - A recorrência encontra-se expirada, cancelada ou rejeitada.
    - O campo `rec.loc` somente pode ser alterado quando a recorrência apresentar-se com o status CRIADA.
    - O campo `rec.calendario.dataInicial` somente pode ser alterado quando a recorrência apresentar-se com o status CRIADA.
    - O campo `rec.vinculo.devedor.nome` somente pode ser alterado quando a recorrência apresentar-se com o status CRIADA.
    - O campo `rec.dadosJornada.txid` não pode ser alterado quando a recorrência apresentar-se com o status REJEITADA ou CANCELADA.
    - O recebedor da cobrança identificado pelo campo `rec.dadosJornada.txid` não corresponde ao recebedor associado à recorrência.

#### `RecConsultaInvalida`

* __Significado__: os parâmetros de consulta à lista de recorrências que não respeitam o schema
ou não fazem sentido semanticamente.
* __HTTP Status Code__: [400](https://tools.ietf.org/html/rfc7231#section-6.5.1).
* __endpoints__: `GET /rec` e `GET /rec/{idRec}`.

__Violações__ específicas para o endpoint `GET /rec`:
    - o parâmetro `txid` não corresponde a uma cobrança compatível com o campo `ativacao.tipoJornada`. (_Exemplo: `txid` correspondente a uma CobV e `ativação.tipoJornada` igual a JORNADA_3._)
    - o parâmetro `txid` corresponde a uma cobrança imediata diferente da informada no campo `ativação.dadosJornada.txid`. Esta violação não ocorre caso o parâmetro txid corresponda a uma cobrança com vencimento.
    - algum dos parâmetros informados para a consulta não respeita o _schema_.
    - o _timestamp_ representado pelo parâmetro `fim` é anterior ao timestamp
    representado pelo parâmetro `inicio`.
    - ambos os parâmetros `cpf` e `cnpj` estão preenchidos.
    - o parâmetro `paginacao.paginaAtual` é negativo.
    - o parâmetro `paginacao.itensPorPagina` é negativo.

__Violações__ específicas para o endpoint `GET /rec/{idRec}`:
    - o parâmetro `txid` não corresponde a uma cobrança compatível com o campo `ativacao.tipoJornada`. (_Exemplo: `txid` correspondente a uma CobV e `ativação.tipoJornada` igual a JORNADA_3._)
    - o parâmetro `txid` corresponde a uma cobrança imediata diferente da informada no campo `ativação.dadosJornada.txid`. Esta violação não ocorre caso o parâmetro txid corresponda a uma cobrança com vencimento.
    - o recebedor da cobrança identificada pelo parâmetro `txid` não corresponde ao recebedor associado à recorrência.

### Tag RecPayload 

Esta seção reúne erros retornados pelos endpoints organizados sob a tag `RecPayload`.
Estes erros indicam problemas na tentativa de recuperação, via _location_, do Payload JSON que representa a recorrência.

#### `RecPayloadNaoEncontrado`

* __Significado__: a recorrência em questão não foi encontrada para a location requisitada.
* __HTTP Status Code__: [404](https://tools.ietf.org/html/rfc7231#section-6.5.4) ou [410](https://tools.ietf.org/html/rfc7231#section-6.5.9).
* __endpoint__: `GET /rec/{recUrlAccessToken}`.

Se a presente location exibia uma recorrência, mas não a exibirá mais de maneira permanentemente,
pode-se aplicar o HTTP status code [410](https://tools.ietf.org/html/rfc7231#section-6.5.9). Se a presente location não
está exibindo nenhuma recorrência, pode-se utilizar o HTTP status code [404](https://tools.ietf.org/html/rfc7231#section-6.5.4).

Uma recorrência pode estar expirada, rejeitada ou cancelada, nesses casos, é uma liberalidade
do PSP recebedor retornar o presente código de erro ou optar por servir o payload de qualquer maneira,
objetivando fornecer uma informação adicional ao usuário pagador final a respeito da recorrência.

#### `RecPayloadOperacaoInvalida`

* __Significado__: a recorrência em questão encontra-se em expirada, rejeitada ou cancelada para a location requisitada.
* __HTTP Status Code__: [400](https://tools.ietf.org/html/rfc7231#section-6.5.1).
* __endpoint__: `GET /rec/{recUrlAccessToken}`.

__Violações__ para o endpoint `GET /rec/{recUrlAccessToken}`:
- O campo `recUrlAccessToken` referencia uma recorrência expirada, rejeitada ou cancelada.

### Tag SolicRec

Esta seção reúne erros retornados pelos endpoints organizados sob a tag `SolicRec`.
Esses erros indicam problemas no gerenciamento de uma solicitação de confirmação de recorrência.

#### `SolicRecNaoEncontrada`

* __Significado__: Solicitação de recorrência não encontrada para o idSolicRec informado.
* __HTTP Status Code__: [404](https://tools.ietf.org/html/rfc7231#section-6.5.4).
* __endpoints__: `[GET] /solicrec/{idSolicRec}`.

#### `SolicRecOperacaoInvalida`

* __Significado__: a requisição que busca criar ou alterar uma solicitação de confirmação de recorrência não respeita o _schema_ ou está semanticamente errada.
* __HTTP Status Code__: [400](https://tools.ietf.org/html/rfc7231#section-6.5.1).
* __endpoints__: `[POST] /solicrec` e `PATCH /solicrec/{idSolicRec}`.

__Violações__ para o endpoint `POST /solicrec`:
    - O objeto `solicrec.calendario` não respeita o _schema_.
    - O campo `solicrec.calendario.dataExpiracaoSolicitacao` é anterior à data de criação da solicitação da recorrência.
    - O objeto `solicrec.destinatario` não respeita o _schema_.
    - Existe uma solicitação ativa referente ao mesmo `solicrec.idRec`.
    - Não é possível criar uma solicitação para uma recorrência que já foi confirmada ou está pendente de confirmação pelo usuário pagador.

__Violações__ para o endpoint `PATCH /solicrec/{idSolicRec}`:

   - Não é possível cancelar uma solicitação de recorrência com o status diferente de CRIADA, ENVIADA ou RECEBIDA.


#### Tag CobR

Esta seção reúne erros retornados pelos endpoints organizados sob a tag `CobR`.
Esses erros indicam problemas no gerenciamento de uma cobrança recorrente.

#### `CobRNaoEncontrado`

* __Significado__: Cobrança não encontrada para o txid informado.
* __HTTP Status Code__: [404](https://tools.ietf.org/html/rfc7231#section-6.5.4).
* __endpoints__: `[GET|PATCH] /cobr/{txid}` e  `[POST] /cobr/{txid}/retentativa/{data}`.

#### `CobROperacaoInvalida`

* __Significado__: a requisição que busca alterar ou criar uma cobrança recorrente não respeita o _schema_ ou está semanticamente errada.
* __HTTP Status Code__: [400](https://tools.ietf.org/html/rfc7231#section-6.5.1).
* __endpoints__: `[POST|PUT|PATCH] /cobr/{txid}` e  `[POST] /cobr/{txid}/retentativa/{data}`.

__Violações__ para o endpoint `POST|PUT /cobr/{txid}`:
    - O campo `cobr.infoAdicional` não respeita o _schema_.
    - O campo `cobr.status` não respeita o _schema_.
    - O objeto `cobr.calendario` não respeita o _schema_.
    - O campo `cobr.calendario.dataDeVencimento` é anterior à data de criação da cobrança.
    - O campo `cobr.valor` não respeita o _schema_.
    - O objeto `cobr.recebedor` não respeita o _schema_.
    - Os campos `cobr.recebedor.conta` e `cobr.recebedor.agencia` correspondem a uma conta que não pertence a este usuário recebedor.
    - O objeto `cobr.devedor` não respeita o _schema_.
    - O campo `cobr.txid` encontra-se em uso.
    - Existe uma CobR com status diferente de REJEITADA e CANCELADA referente ao mesmo `cobr.idRec` com `calendario.dataDeVencimento` no mesmo ciclo.

__Violações__ para o endpoint `PATCH /cobr/{txid}`:

    - Não é possível cancelar uma cobrança em uma data igual ou maior que a data prevista da primeira tentativa de liquidação.

__Violações__ para o endpoint `POST /cobr/{txid}/retentativa/{data}`:
    
    - Existe uma tentativa com status `SOLICITADA` ou `AGENDADA`.
    - Existe uma tentativa em andamento.
    - Existe uma tentativa ativa.
    - Existe uma tentativa não finalizada.
    - Existe uma tentativa vigente para a `data` informada.
    - O parâmetro `data` não corresponde a uma data futura.
    - A política configurada na recorrência não permite retentativa de cobrança.
    - A preferência está com produto inativo
    - A recorrência do agendamento não permite retentativa (tipo RN)
    - A data de retentativa excede a data de vencimento da cobrança em mais de 7 dias
    - A data de retentativa é igual às datas de tentativas anteriores
    - A data da requisição é após às 22h do dia anterior à dataRetentativa
    - A data de retentativa é igual ou superior à data do fim da recorrência (se houver)
    - A data de retentativa está fora do ciclo de vigência atual
    - A cobrança não está ATIVA
    - A tentativa mais recente não está REJEITADA ou EXPIRADA
    - Excedeu o número máximo de retentativas (3)

#### `CobRConsultaInvalida`

* __Significado__: os parâmetros de consulta à lista de cobranças que não respeitam o schema
ou não fazem sentido semanticamente.
* __HTTP Status Code__: [400](https://tools.ietf.org/html/rfc7231#section-6.5.1).
* __endpoints__: `GET /cobr` e `GET /cobr/{txid}`.

__Violações__ específicas para o endpoint `GET /cobr`:
    - algum dos parâmetros informados para a consulta não respeita o _schema_.
    - o _timestamp_ representado pelo parâmetro `fim` é anterior ao timestamp
    representado pelo parâmetro `inicio`.
    - ambos os parâmetros `cpf` e `cnpj` estão preenchidos.
    - o parâmetro `paginacao.paginaAtual` é negativo.
    - o parâmetro `paginacao.itensPorPagina` é negativo.


### Tag PayloadLocationRec
Esta seção reúne erros referentes a endpoints que tratam do gerenciamento de _locations_ de uma recorrência.

#### `PayloadLocationRecNaoEncontrado`
* __Significado__: _Location_ não encontrada para o `id` informado.
* __HTTP Status Code__: [404](https://tools.ietf.org/html/rfc7231#section-6.5.4).
* __endpoints__: `[GET] /locrec/{id}`, `DELETE /locrec/{id}/idRec`.

#### `PayloadLocationRecConsultaInvalida`

* __Significado__: os parâmetros de consulta à lista de _locations_ não respeitam
o _schema_ ou não fazem sentido semanticamente.
* __HTTP Status Code__: [400](https://tools.ietf.org/html/rfc7231#section-6.5.1).
* __endpoints__: `GET /locrec` e `GET /locrec/{id}`.

#### Tag WebhookRec

Reúne erros dos endpoints que tratam do gerenciamento dos Webhooks de recorrências da API Pix.

#### `WebhookRecOperacaoInvalida`
* __Significado__: a presente requisição busca criar um webhook sem respeitar o _schema_ ou,
ainda, apresenta semântica inválida.
* __HTTP Status Code__: [400](https://tools.ietf.org/html/rfc7231#section-6.5.1).
* __endpoints__: `PUT /webhookrec`.

__Violações__ para o endpoint `PUT /webhookrec`:
    - o campo `webhookUrl` não respeita o _schema_.

#### `WebhookRecConsultaInvalida`

* __Significado__: os parâmetros de consulta à lista de webhooks ativados não respeitam o schema
ou não fazem sentido semanticamente.
* __HTTP Status Code__: [400](https://tools.ietf.org/html/rfc7231#section-6.5.1).
* __endpoints__: `GET /webhookrec`.

__Violações__ específicas para o endpoint `GET /webhookrec`:
    - algum dos parâmetros informados para a consulta não respeita o _schema_.
    - o _timestamp_ representado pelo parâmetro `fim` é anterior ao timestamp
    representado pelo parâmetro `inicio`.
    - o parâmetro `paginacao.paginaAtual` é negativo.
    - o parâmetro `paginacao.itensPorPagina` é negativo.

#### Tag WebhookCobR
Reúne erros dos endpoints que tratam do gerenciamento dos Webhooks de cobranças recorrentes da API Pix.

#### `WebhookCobROperacaoInvalida`
* __Significado__: a presente requisição busca criar um webhook sem respeitar o _schema_ ou,
ainda, apresenta semântica inválida.
* __HTTP Status Code__: [400](https://tools.ietf.org/html/rfc7231#section-6.5.1).
* __endpoints__: `PUT /webhookcobr`.

__Violações__ para o endpoint `PUT /webhookcobr`:
    - o campo `webhookUrl` não respeita o _schema_.

#### `WebhookCobRConsultaInvalida`

* __Significado__: os parâmetros de consulta à lista de webhooks ativados não respeitam o schema
ou não fazem sentido semanticamente.
* __HTTP Status Code__: [400](https://tools.ietf.org/html/rfc7231#section-6.5.1).
* __endpoints__: `GET /webhookcobr`.

__Violações__ específicas para o endpoint `GET /webhookcobr`:
    - algum dos parâmetros informados para a consulta não respeita o _schema_.
    - o _timestamp_ representado pelo parâmetro `fim` é anterior ao timestamp
    representado pelo parâmetro `inicio`.
    - o parâmetro `paginacao.paginaAtual` é negativo.
    - o parâmetro `paginacao.itensPorPagina` é negativo.

