# API Boletos (v3) (v1.34.1)

Fonte: https://devportal.itau.com.br/nossas-apis/itau-ep9-gtw-boletos-boletos-v3-ext-aws (aba visão geral, atualizada em 2026-08-28T13:26:39.000Z)
Sandbox: https://sandbox.devportal.itau.com.br/itau-ep9-gtw-boletos-boletos-v3-ext-aws/v1
Spec: ../openapi/itau-ep9-gtw-boletos-boletos-v3-ext-aws.json

---



## **sobre a API**

Gateway unificado para API de boletos.

As operacoes disponiveis são:
- Consulta de dados de cobrança e conciliação.                                                          
- Habilitação da comunicação com o webhook.                                                              

## **para quem é esta API?**

Clientes externos que precisam de informaçoes sobre consulta de dados de cobrança e conciliação, habilitação da comunicação via webhook para os beneficiários de boleto e listagem de boletos para os clientes.                                                                            
## **restrições de uso**

Para utilizar a API o parceiro precisa estar habilitado no Portal Itau for Developers e ter o certificado dinamico ativado. 

## **conhecimentos técnicos necessários**

Conhecimentos previos necessarios:

- `JSON`
- `HTTP`
- `OpenAPI`
- `OAuth 2.0`

## **quais necessidades que essa API ajuda a resolver?**

Promover uma melhor experiência ao cliente na consulta de dados de cobrança e conciliação, habilitação da comunicação via webhook para os beneficiários de boletos e permitir listagem de boletos.

## **tempo aproximado para integração**

**2 dias:** essa é a média de tempo que um desenvolvedor pode levar para preparar toda a integração com essa API. Isso pode variar de acordo com o tamanho do time e experiência dos desenvolvedores envolvidos.

## Segurança
Para instruções ao nosso modelo de autenticação acesse [aqui](https://devportal.itau.com.br/autenticacao-documentacao).

## Objetivo

Esta **API de Listagem de Boletos** é responsável pela consulta de boletos de cobrança utilizando parâmetros de pesquisa que irão retornar uma lista de boletos com algumas informações do boleto. Para consultar todos os detalhes do boleto individualmente, deve ser utilizada a API Detalhe do Boleto.

## Endpoints

Os exemplos de respostas de erros são demonstrados no tópico padrões de erros ao final desta página. Cada *endpoint* traz uma tabela especificando quais desses retornos o serviço retorna. Então, caso haja variação no *JSON* retornado, este será demonstrado na explicação do próprio *endpoint*, se não, deve ser visualizado no tópico citado.

## URLs

Para garantir uma integração segura, as funcionalidades da API estão disponíveis nas seguintes URLs:

| ambiente | endpoint |
| - | - |
| produção | https://boletos.cloud.itau.com.br/boletos/v3                                                        |

### Endpoint Calendário de Movimentações (Datas disponíveis)

#### [GET] ../francesas?agencia={agencia}&conta={conta}&mesReferencia={MMAAAA}&dac={dac}

API responsável por retornar as datas que há movimentações de boletos, quando informado o mês de referência. Pode-se utilizar as datas retornadas para consultar o Extrato de Movimentação Resumido e o Extrato de Movimentação Detalhado.

Os boletos elegíveis para serem consultados são:
* Boletos em aberto (vencidos e a vencer);
* Boletos baixados (inicialmente até 45 dias);
* Boletos liquidados (inicialmente até 45 dias).

A seguir estão expostos os parâmetros exigidos por essa API e a descrição deles. Para obter mais informações de onde conseguir o x-itau-apikey, e o x-itau-correlationID, acesse o tópico ‘Informações necessárias’.

#### Exemplos de saída
* HTTPStatus - 200

```json
{
    "data": [
        {
            "posicao": {
                "dataPosicao": "2021-09-01"
            }
        },
        {
            "posicao": {
                "dataPosicao": "2021-09-02"
            }
        },
        {
            "posicao": {
                "dataPosicao": "2021-09-09"
            }
        }
    ]
}
```

### Erros

Há um padrão de retorno para todos os erros na API. Esse padrão segue uma estrutura específica, podendo apenas variar os valores existentes nos campos. No exemplo a seguir, representa a entrada de uma agência é inválida.

#### Exemplo de saída
* HTTPStatus - 400

```json
{
    "codigo": "400",
    "mensagem": "Erro de validação de campos",
    "campos": [
        {
            "campo": "agencia",
            "mensagem": "Agência inválido",
            "valor": ""
        }
    ]
}
```

* Agência:

Caso tenha colocado uma agência com menos de 4 dígitos retorna um json com a mensagem "Agência inválida";
Caso não tenha informado a agência, retorna um json com a mensagem "Campo agência não preenchido";
Caso tenha informado a agência com caractere não numérico, retorna um json com a mensagem "Campo agência inválido, caractere não numérico".

* Conta:

Caso tenha colocado uma conta diferente de 7 dígitos retorna um json com a mensagem "Conta inválida";
Caso não tenha informado a conta, retorna um json com a mensagem "Campo conta não preenchido";
Caso tenha informado a conta com caractere não numérico, retorna um json com a mensagem "Campo conta inválido, caractere não numérico".

* DAC:

Caso tenha colocado uma DAC com mais de 1 dígitos retorna um json com a mensagem "DAC inválido, tente novamente";
Caso não tenha informado a DAC, retorna um json com a mensagem "DAC inválido, tente novamente";
Caso tenha informado a DAC com caractere não numérico, retorna um json com a mensagem "DAC inválido, tente novamente".

* Mês referência:

Caso tenha colocado um mês referência com mais de 6 dígitos retorna um json com a mensagem "Mês referência inválido";
Caso não tenha informado o mês referência, retorna um json com a mensagem "Mês referência inválido";
Caso tenha informado o mês referência com caractere não numérico, retorna um json com a mensagem "Mês referência inválido".

#### Parâmetros para a Consulta
| Parâmetro            | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
|----------------------|----------------|-----------|-------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| x-itau-apikey        | header | string | sim | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| x-itau-correlationID | header | string | sim | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes.                                                                                                                                                                                                                                                                                                                                                                                                  |
| x-itau-flowID        | header | string | sim | A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. |
| agencia              | param | integer | sim | Dados para identificação do boleto para consulta, sendo composto por:   Código Agência - Obrigatório (4 caracteres)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| conta                | param | integer | sim | Dados para identificação do boleto para consulta, sendo composto por:   Código Conta - Obrigatório (7 caracteres)                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| dac                  | param | integer | sim | Dados para identificação do boleto para consulta, sendo composto por:   Código DAC - Obrigatório (1 caractere)                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| mesReferencia       | param | integer | sim | Mês de referência para a consulta, no formato MMAAAA                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      

#### Endpoint Movimentação Resumida (Cobrança, desconto e tarifação mensal)
#### [GET] ../francesas/{francesaId}/movimentacoes-resumidas

API responsável por retornar o Extrato de Movimentações dos boletos de cobrança e descontados de forma resumida, para determinada data. Retorna a movimentação resumida da cobrança, desconto e tarifação mensal. Sendo desconto e tarifação mensal informações não obrigatórias no retorno.

Os boletos elegíveis para serem consultados são:
* Boletos em aberto (vencidos e a vencer);
* Boletos baixados (inicialmente até 45 dias);
* Boletos liquidados (inicialmente até 45 dias).

A seguir estão expostos os parâmetros exigidos por essa API e a descrição deles. Para obter mais informações de onde conseguir o x-itau-apikey, e o x-itau-correlationID, acesse o tópico ‘Informações necessárias’.

#### Exemplos de saída da cobrança
* HTTPStatus - 200

```json
{
    "data": [
        {
            "resumidaCobranca": {
                "posicao": {
                    "dataPosicao": "2022-02-01",
                    "posicaoAnterior": {
                        "valor": "50.00",
                        "quantidade": 2
                    },
                    "entradas": {
                        "valor": "50.00",
                        "quantidade": 1
                    },
                    "baixas": {
                        "valor": "50.00",
                        "quantidade": 1
                    },
                    "liquidacoes": {
                        "valor": "50.00",
                        "quantidade": 1
                    },
                    "posicaoAtual": {
                        "valor": "50.00",
                        "quantidade": 1
                    },
                    "consolidadoVencer": [
                        {
                            "dataInicial": "2022-05-02",
                            "dataFinal": "2022-05-30",
                            "valor": "70.20",
                            "quantidade": 2
                        },
                        {
                            "dataInicial": "2022-05-12",
                            "dataFinal": "2022-05-30",
                            "valor": "70.20",
                            "quantidade": 2
                        },
                        {
                            "dataInicial": "2022-05-19",
                            "dataFinal": "2022-05-30",
                            "valor": "70.20",
                            "quantidade": 2
                        },
                        {
                            "dataInicial": "2022-05-22",
                            "dataFinal": "2022-05-30",
                            "valor": "70.20",
                            "quantidade": 2
                        }
                    ],
                    "vencidos": {
                        "dataFinal": "2022-05-02",
                        "valor": "50.00",
                        "quantidade": 1
                    }
                },
                "movimentacaoFinanceira": {
                    "principalLiquidacoes": "50.00",
                    "descontosAbatimentos": "50.00",
                    "jurosMultas": "50.00",
                    "total": "50.00"
                },
                "movimentacaoConta": {
                    "valoresDisponiveis": "50.00",
                    "valoresaCompensar": "50.00",
                    "valoresNaoLiberados": "50.00",
                    "valorTotalDeducoes": "150.00",
                    "deducoes": [
                        {
                            "descricao": "Custas",
                            "valor": "50.00"
                        },
                        {
                            "descricao": "IOF",
                            "valor": "50.00"
                        },
                        {
                            "descricao": "Tarifas",
                            "valor": "50.00"
                        }
                    ]
                }
            }
        }
    ]
}
```

#### Desconto

Ao contratar a cobrança, o(s) cliente(s) que estiverem no desconto, ao fazer a consulta na API visualizarão as informações em um módulo resumido. Este contém a quantidade de boletos, os valores e seus status - emitido, em aberto, baixado ou liquidado.

#### Exemplos de saída do desconto
* HTTPStatus - 200

```json
{
  "data": [
    {
      "resumidaCobranca": {
        "posicao": {
          "dataPosicao": "2020-10-09",
          "posicaoAnterior": {
            "valor": "17104781.61",
            "quantidade": 852
          },
          "entradas": {
            "valor": "0.00",
            "quantidade": 0
          },
          "baixas": {
            "valor": "-50.00",
            "quantidade": 0
          },
          "liquidacoes": {
            "valor": "-128847.13",
            "quantidade": 14
          },
          "baixasDesconto": {
            "valor": "-10.00",
            "quantidade": 0
          },
          "posicaoAtual": {
            "valor": "16975934.48",
            "quantidade": 838
          },
          "consolidadoVencer": [
            {
              "dataInicial": "2020-10-09",
              "dataFinal": "2020-10-31",
              "valor": "3845962.31",
              "quantidade": 263
            },
            {
              "dataInicial": "2020-11-01",
              "dataFinal": "2020-11-30",
              "valor": "3746751.81",
              "quantidade": 204
            },
            {
              "dataInicial": "2020-12-01",
              "dataFinal": "2020-12-31",
              "valor": "823106.98",
              "quantidade": 30
            },
            {
              "dataInicial": "2021-01-01",
              "dataFinal": "9999-12-31",
              "valor": "390843.32",
              "quantidade": 12
            }
          ],
          "vencidos": {
            "dataFinal": "2020-10-08",
            "valor": "8169270.06",
            "quantidade": 329
          }
        },
        "movimentacaoFinanceira": {
          "principalLiquidacoes": "128847.13",
          "descontosAbatimentos": "0.00",
          "jurosMultas": "12.88",
          "total": "128860.01"
        },
        "movimentacaoConta": {
          "valoresDisponiveis": "54428.27",
          "valoresaCompensar": "74431.74",
          "valoresNaoLiberados": "0.00",
          "valorTotalDeducoes": "-87.37",
          "deducoes": [
            {
              "descricao": "Custas",
              "valor": "0.00"
            },
            {
              "descricao": "IOF",
              "valor": "0.00"
            },
            {
              "descricao": "Tarifas",
              "valor": "-87.37"
            }
          ],
          "resumidaDescontado": {
            "posicao": {
              "dataPosicao": "2020-10-09",
              "posicaoAnterior": {
                "valor": "17104781.61",
                "quantidade": 852
              },
              "entradas": {
                "valor": "0.00",
                "quantidade": 0
              },
              "baixas": {
                "valor": "-50.00",
                "quantidade": 0
              },
              "liquidacoes": {
                "valor": "-128847.13",
                "quantidade": 14
              },
              "baixasCobranca": {
                "valor": "-34.48",
                "quantidade": 1
              },
              "posicaoAtual": {
                "valor": "16975934.48",
                "quantidade": 838
              },
              "consolidadoVencer": [
                {
                  "dataInicial": "2020-10-09",
                  "dataFinal": "2020-10-31",
                  "valor": "3845962.31",
                  "quantidade": 263
                },
                {
                  "dataInicial": "2020-11-01",
                  "dataFinal": "2020-11-30",
                  "valor": "3746751.81",
                  "quantidade": 204
                },
                {
                  "dataInicial": "2020-12-01",
                  "dataFinal": "2020-12-31",
                  "valor": "823106.98",
                  "quantidade": 30
                },
                {
                  "dataInicial": "2021-01-01",
                  "dataFinal": "9999-12-31",
                  "valor": "390843.32",
                  "quantidade": 12
                }
              ],
              "vencidos": {
                "dataFinal": "2020-10-09",
                "valor": "8169270.06",
                "quantidade": 329
              }
            },
            "resumoLiquidacaoDesconto": {
              "liquidacaoDesconto": "128847.13",
              "creditoContaCorrente": "10.00",
              "debitoContaCorrente": "-12.88",
              "jurosMoratorio": "-128860.01"
            },
            "resumoEntradaDesconto": {
              "valorCreditadoContaCorrenteAposDeducoes": "54428.27",
              "deducoes": [
                {
                  "descricao": "Juros (encargos) de desconto",
                  "valor": "0.00"
                },
                {
                  "descricao": "IOF",
                  "valor": "0.00"
                },
                {
                  "descricao": "Tarifa de contratação de desconto",
                  "valor": "-87.37"
                },
                {
                  "descricao": "Tarifa por boleto descontado",
                  "valor": "-87.37"
                }
              ]
            }
          }
        }
      }
    }
  ]
}
```

#### Tarifação Mensal

Ao contratar a cobrança o(s) cliente(s) que optarem por cobrança mensal, deverão informar a data de cobrança da tarifa. Ao consultar o extrato de movimentação, será exibido as informações resumidas contendo a quantidade de tarifas cobradas e o valor. Essa informação será exibida, somente na data de cobrança e não mais no início do mês.

#### Exemplos de saída da tarifação mensal
* HTTPStatus - 200

```json
{
  "data" : [{
    "resumidaCobranca" : {
      "posicao" : {
        "dataPosicao" : "2020-10-09",
        "posicaoAnterior" : {
          "valor" : "17104781.61",
          "quantidade" : 852
        },
        "entradas" : {
          "valor" : "0.00",
          "quantidade" : 0
        },
        "baixas" : {
          "valor" : "-50.00",
          "quantidade" : 0
        },
        "liquidacoes" : {
          "valor" : "-128847.13",
          "quantidade" : 14
        },
        "baixasDesconto" : {
          "valor" : "-10.00",
          "quantidade" : 0
        },
        "posicaoAtual" : {
          "valor" : "16975934.48",
          "quantidade" : 838
        },
        "consolidadoVencer" : [{
          "dataInicial" : "2020-10-09",
          "dataFinal" : "2020-10-31",
          "valor" : "3845962.31",
          "quantidade" : 263
        }, {
          "dataInicial" : "2020-11-01",
          "dataFinal" : "2020-11-30",
          "valor" : "3746751.81",
          "quantidade" : 204
        }, {
          "dataInicial" : "2020-12-01",
          "dataFinal" : "2020-12-31",
          "valor" : "823106.98",
          "quantidade" : 30
        }, {
          "dataInicial" : "2021-01-01",
          "dataFinal" : "9999-12-31",
          "valor" : "390843.32",
          "quantidade" : 12
        }
        ],
        "vencidos" : {
          "dataFinal" : "2020-10-08",
          "valor" : "8169270.06",
          "quantidade" : 329
        }
      },
      "movimentacaoFinanceira" : {
        "principalLiquidacoes" : "128847.13",
        "descontosAbatimentos" : "0.00",
        "jurosMultas" : "12.88",
        "total" : "128860.01"
      },
      "movimentacaoConta" : {
        "valoresDisponiveis" : "54428.27",
        "valoresaCompensar" : "74431.74",
        "valoresNaoLiberados" : "0.00",
        "valorTotalDeducoes" : "-87.37",
        "deducoes" : [{
          "descricao" : "Custas",
          "valor" : "0.00"
        }, {
          "descricao" : "IOF",
          "valor" : "0.00"
        }, {
          "descricao" : "Tarifas",
          "valor" : "-87.37"
        }
        ],
        "tarifacaoMensal" : {
          "dataDebito" : "2020-10-09",
          "periodoConsolidado" : {
            "dataInicial" : "2020-10-01",
            "dataFinal" : "2020-10-31"
          },
          "tarifas" : [{
            "descricao" : "liquidação",
            "quantidade" : 5,
            "valor" : "120.00"
          }, {
            "descricao" : "protestos solicitados",
            "quantidade" : 10,
            "valor" : "11.00"
          }, {
            "descricao" : "baixas",
            "quantidade" : 5,
            "valor" : "30.00"
          }
          ],
          "totalTarifas" : {
            "quantidade" : 20,
            "valor" : "161.00"
          }
        }
      }
    }
  }
  ]
}
```

### Erros

Há um padrão de retorno para todos os erros na API. Esse padrão segue uma estrutura específica, podendo apenas variar os valores existentes nos campos. No exemplo a seguir, o id da francesa é inválido.

#### Exemplo de saída
* HTTPStatus - 400

```json
{
    "codigo": "400",
    "mensagem": "Erro de validação de campos",
    "campos": [
        {
            "campo": "francesaId",
            "mensagem": "Id inválido",
            "valor": ""
        }
    ]
}
```
* francesaId:

Caso o tamanho seja diferente de 12 (agencia + conta + dac), retorna um json com a mensagem: "Id inválido";
Caso o tipo de caractere seja diferente de numérico, retorna um json com a mensagem:
"Agência inválida" (quando os 4 primeiros dígitos);
"Conta inválida" (quando dígitos da posição 5 a 11);
"DAC da conta inválido, tente novamente" (quando dígito da posição 12);
Caso o DAC da conta seja inválido, retorna um json com a mensagem: "DAC da conta inválido, tente novamente." (Status code 422).

* data:

Caso a data esteja com o valor  vazio/nulo, retorna um json com a mensagem: "Data inválida";
Caso a data esteja com o formato diferente de yyyy-mm-dd, retorna um json com a mensagem: "Data inválida";
Caso a data esteja com o tamanho diferente de 10, retorna um json com a mensagem: "Data inválida";
Caso a  data > data atual, retorna um json com a mensagem: "Data não pode ser maior que data atual" (Status code 422).

#### Parâmetros para a Consulta
| Parâmetro | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
|-----------|----------------|-----------|-------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| x-itau-apikey | header | string | sim | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| x-itau-correlationID | header | string | sim | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes.                                                                                                                                                                                                                                                                                                                                                                                                  |
| x-itau-flowID | header | string | sim | A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. |
| francesaId | path | integer | sim | Dados para identificação do boleto para consulta, sendo composto por:   Código Agência - Obrigatório (4 caracteres), Código Conta Corrente - Obrigatório (7 caracteres) e o DAC - Obrigatório (1 caractere).                                                                                                                                                                                                                                                                                                                                                                              |
| data | param | date-only | sim | Data para consulta de extrato da movimentação de boletos de cobrança e descontados na visão resumida. Informar no formato AAAA-MM-DD                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

#### Endpoint Consulta de Extrato de Movimentação de Boletos Detalhados (Francesa Detalhada)
#### [GET] ../francesas/{francesaId}/movimentacoes

API responsável por retornar o Extrato de Movimentações de forma detalhada, para determinada data. Para visualização das movimentações de boletos forma resumida desta data, consultar a API 'Extrato Resumido'.

Os boletos elegíveis para serem consultados são:
* Boletos em aberto (vencidos e a vencer);
* Boletos baixados (inicialmente até 45 dias);
* Boletos liquidados (inicialmente até 45 dias).

A seguir estão expostos os parâmetros exigidos por essa API e a descrição deles. Para obter mais informações de onde conseguir o x-itau-apikey, e o x-itau-correlationID, acesse o tópico ‘Informações necessárias’.

#### Exemplos de saída
* HTTPStatus - 200

```json
{
  "data": [
    {
      "agencia": 1234,
      "conta": 12345678,
      "dataMovimentacao": "2020-03-12",
      "numeroCarteira": 14,
      "codigoStatus": "E",
      "tipoMovimentacao": "entradas",
      "nossoNumero": 85022822,
      "seuNumero": "12346A-B",
      "dacTitulo": "7",
      "tipoCobranca": "Boleto",
      "sequenciaTitulo": 1,
      "pagador": "Empresa Brasileira de Armaze LTDA",
      "agenciaRecebedora": 2861,
      "dataMovimentacaoTituloCarteira": "2020-03-12",
      "dataInclusao":"2020-01-01",
      "dataVencimento": "2020-03-12",
      "valorTitulo": "100.00",
      "valorLiquidoLancado": "110.00",
      "valorAcrescimo": "100.00",
      "valorDecrescimo": "100.00",
      "indicadorPagamentoReservaAdministrativa": "R",
      "indicadorRateioCredito": false,
      "dacAgenciaContaBeneficiario": 10
    }
  ],
  "pagination": {
    "links": {
      "first": "https://boleto.api.itau.com/extrato/v1francesas/123411111111111/movimentacoes?data=2020-01-01&page=0&pageSize=20",
      "last": "https://boleto.api.itau.com/extrato/v1francesas/123411111111111/movimentacoes?data=2020-01-01&page=15&pageSize=20",
      "previous": "",
      "next": "https://boleto.api.itau.com/extrato/v1francesas/123411111111111/movimentacoes?data=2020-01-01&page=1&pageSize=20"
    },
    "page": 0,
    "total_pages": 15,
    "total_elements": 6,
    "pageSize": 20
  }
}
```

#### Desconto

O(s) cliente(s) que contratarem a cobrança com desconto, ao consultar a API, visualizam os boletos com as informações detalhadas, contendo os status, descontos, tarifação e dados necessários do boleto de sua análise.

#### Exemplos de saída do desconto
* HTTPStatus - 200

```json
{
    "data": [
        {
            "agencia": 1500,
            "conta": 1560,
            "dataMovimentacao": "2021-11-03",
            "numeroCarteira": 109,
            "codigoStatus": "E",
            "nossoNumero": "85022822",
            "seuNumero": "0000865700",
            "dacTitulo": 9,
            "tipoCobranca": "Boleto descontado",
            "pagador": "ROTHS EMP DE TRANSPORTES LTDA",
            "dataMovimentacaoTituloCarteira": "2021-01-04",
            "dataInclusao_titulo_cobranca": "2020-11-06",
            "dataVencimento": "2021-12-31",
            "valorTitulo": "958.36",
            "valorLiquidoLancado": "956.49",
            "valorAcrescimo": "3.00",
            "valorDecrescimo": "-1.87",
            "indicadorPagamentoReservaAdministrativa": "R",
            "indicadorRateioCredito": false,
            "dacAgenciaContaBeneficiario": 8,
            "operacoesDesconto": [
                {
                  "codigo": "1",
                  "descricao": "Tarifa de cobrança",
                  "valor": "15.00" 
                }
            ],
          "operacoesCobranca": [
            {
              "codigo": "1",
              "descricao": "Juros",
              "valor": "-4.23"
            },
            {
              "codigo": "2",
              "descricao": "Multa",
              "valor": "-4.23"
            },
            {
              "codigo": "2",
              "descricao": "desconto",
              "valor": "-9.32"
            }
          ]
        }
    ],
    "pagination": {
        "links": {
            "first": "https://boleto.api.itau.com/extrato/v1/francesas/150000015605/movimentacoes?data=2021-11-03&nossoNumero=85022822&numeroCarteira=109",
            "last": "https://boleto.api.itau.com/extrato/v1/francesas/150000015605/movimentacoes?data=2021-11-03&nossoNumero=85022822&numeroCarteira=109",
            "previous": ,
            "next": null
        },
        "total_elements": 1,
        "total_pages": 1,
        "pageSize": 30,
        "page": 0
    }
}
```

### Erros

Há um padrão de retorno para todos os erros na API. Esse padrão segue uma estrutura específica, podendo apenas variar os valores existentes nos campos. No exemplo a seguir, o id da francesa é inválido.

#### Exemplo de saída
* HTTPStatus - 400

```json
{
    "codigo": "400",
    "mensagem": "Erro de validação de campos",
    "campos": [
        {
            "campo": "francesaId",
            "mensagem": "Id inválido",
            "valor": ""
        }
    ]
}
```
* francesaId:

Caso o tamanho diferente de 12 (agencia + conta + dac), retorna um json com a mensagem: "Id inválido";
Caso o tipo diferente de numérico, retorna um json com a mensagem:
"Agência inválida" (quando os 4 primeiros dígitos);
"Conta inválida" (quando dígitos da posição 5 a 11);
"DAC da conta inválido, tente novamente" (quando dígito da posição 12);
Caso o DAC da conta inválido, retorna um json com a mensagem: "DAC da conta inválido, tente novamente." (Status code 422).

* data:

Caso a data estiver com o valor  vazio/nulo, retorna um json com a mensagem: "Data obrigatória";
Caso a data estiver com o formato diferente de yyyy-mm-dd, retorna um json com a mensagem: "Data inválida";
Caso a data estiver com o tamanho diferente de 10, retorna um json com a mensagem: "Data inválida";
Caso a  data > data atual, retorna um json com a mensagem: "Data não pode ser maior que data atual" (Status code 422).

* tipoCobranca:

Caso estiver diferente de 'boleto', 'cobranca_digital', 'boleto_descontado', retorna um json com a mensagem: "Tipo de Cobrança inválida" (Status code 422);
Caso estiver vazio, retorna um json com a mensagem: "Tipo de Cobrança inválida".

* tipoMovimentacao:

Caso estiver diferente de 'entradas', 'baixas', 'liquidacoes', retorna um json com a mensagem: "Tipo de Movimentação inválida" (Status code 422);
Caso estiver vazio, retorna um json com a mensagem: "Tipo de Movimentação inválida".

* nossoNumero:

Caso estiver com o tamanho for maior que 16 dígitos, retorna um json com a mensagem: "Tamanho do nosso número maior que o permitido";
Caso estiver vazio, retorna um json com a mensagem: "Nosso número inválido";
Caso estiver diferente do tipo numérico, retorna um json com a mensagem: "Nosso número inválido".

* seuNumero:

Caso estiver vazio, retorna um json com a mensagem: "Seu número inválido";
Caso estiver com o tamanho maior que 10, retorna um json com a mensagem: "Tamanho do seu número maior que o permitido";
Caso estiver com caracteres inválidos, retorna um json com a mensagem: "Seu número inválido, caractere informado não permitido".

* nomePagador:

Caso estiver com o tamanho menor que 3, retorna um json com a mensagem: "Tamanho do nome do pagador deve ser superior a 2 caracteres";
Caso estiver com o tamanho maior que 30, retorna um json com a mensagem: "Tamanho do nome do pagador maior que o permitido";
Caso estiver com o tamanho informado caractere não válido**, retorna um json com a mensagem: "Nome do pagador inválido, caractere informado não permitido" ;
Caso estiver vazio, retorna um json com a mensagem: "Nome do pagador não preenchido".

**Caracteres válidos: letras maiúsculas/minúsculas, caracteres com/sem acentos, números, espaços, e-comercial (&), apostrofo ('), virgula (,), barra ( /), hífen(-), ponto (.), ordinal feminino (ª), Ordinal masculino (º).

* numeroCarteira:

Caso estiver vazio, retorna um json com a mensagem: "Carteira inválida";
Caso estiver com o tamanho diferente de 3, retorna um json com a mensagem: "Tamanho da carteira inválida";
Caso estiver com o tipo diferente de numérico, retorna um json com a mensagem: "Carteira inválida".

* page:

Caso estiver vazio, retorna um json com a mensagem: "Número da página inválido";
Caso estiver menor que zero, retorna um json com a mensagem: "Número da página inválido";
Caso estiver com o tipo não-numérico, retorna um json com a mensagem: "Número da página inválido";
Caso estiver maior que 9.999.999, retorna um json com a mensagem: "Número da página deve ser inferior a 10.000.000".

* pageSize:

Valores possíveis: 10, 20, 30, 40, 50.
Caso estiver diferente desses informados, retorna um json com a mensagem: "Quantidade de resultados por página inválido" (Status code 422).

* orderBy:

Campos possíveis: nomePagador, nossoNumero, seuNumero, dataVencimento.
Caso estiver diferente desses informados, retorna um json com a mensagem: "Não é possível ordenar por esse campo" (Status code 422).
default: nomePagador.

* order

enum [asc, desc].
Caso estiver diferente, retorna um json com a mensagem: "Ordenação inválida".
default: asc.

#### Parâmetros para a Consulta
| Parâmetro | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
|-----------|----------------|-----------|-------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| x-itau-apikey | header | string | sim | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| x-itau-correlationID | header | string | sim | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes.                                                                                                                                                                                                                                                                                                                                                                                                  |
| x-itau-flowID | header | string | sim | A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. |
| francesaId | path | integer | sim | Dados para identificação do boleto para consulta, sendo composto por:  Código Agência - Obrigatório (4 caracteres), Código Conta Corrente - Obrigatório (7 caracteres) e o DAC - Obrigatório (1 caractere).                                                                                                                                                                                                                                                                                                                                                                               |
| data | param | date-only | sim | Data para consulta de extrato da movimentação de boletos de cobrança e descontados na visão detalhada. Informar no formato AAAA-MM-DD                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| tipoCobranca |	param | string |	não | 	Consulta pelo Tipo de Cobrança específico. Quando não informado, serão retornados todos. Opções: 'cobranca_digital', 'boleto','bolecode', 'boleto_descontado'                                                                                                                                                                                                                                                                                                                                                                                                                            |
| tipoMovimentacao |	param | string |não | 	Consulta pelo Tipo de movimentação específico. Quando não informado, serão retornados todos. Opções: 'entradas', 'liquidacoes', 'baixas'                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| nossoNumero |	param | integer | não | 	Consulta pelo Registro de identificação do boleto (Até 16 dígitos)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| seuNumero	| param     | string | não	| Consulta pelo Número do documento específico (Até 10 dígitos)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| numeroCarteira |	param | integer | não | 	Consulta pelo Número da Carteira específico  (Até 3 dígitos)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| nomePagador |	param | string |	não | 	Consulta pelo Nome do Pagador específico (Tamanho mínimo 3 caracteres, máximo 30 caracteres)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

## Padrões de erros

Essa API retorna códigos de status HTTP para indicar sucesso ou falhas das requisições.

Códigos **2xx** indicam sucesso.

Códigos **4xx** indicam falhas causadas pelas informações enviadas pelo cliente ou pelo estado atual das entidades.

Códigos **5xx** indicam problemas no serviço no lado da API.

As respostas de erro incluem no corpo detalhes do erro e o campo type identifica o tipo de erro.

Abaixo estão listados os tipos de erro que podem ser retornados por quaisquer endpoints listados nessa documentação.

HTTP Status Code     | Descrição  | Significado
:------ | :------- |:---|                     
400 Bad Request  | RequisicaoInvalida | requisição inválida
403 Forbidden  | AcessoNegado | requisição de participante autenticado que viola alguma regra de autorização
404 Not Found	  | NaoEncontrado | entidade não encontrada
500 Internal Server Error | ErroInternoDoServidor | condição inesperada ao processar requisição
503 Service Unavailable | ServicoIndisponivel | serviço não está disponível no momento. Serviço solicitado pode estar em manutenção ou fora da janela de funcionamento
504 Gateway Timeout | IndisponibilidadePorTempoEsgotado | indica que o serviço demorou além do esperado para retornar

## Webhook de Boletos ##

#### Notificação de Baixa Operacional e Liquidação

O Webhook é indicado para clientes Itaú que utilizam o serviço de cobrança e que desejam receber notificações de baixa operacional (pagamento) e/ou liquidação (crédito) de seus boletos e bolecodes (pagos com códigos de barras) em tempo real.
Nesse formato, realizamos o envio das informações em uma API de call-back, sem necessidade de requisição ou consulta. O Webhook é único por cliente ID/chave pública e as credenciais para utilização são as mesmas das APIs de Boletos.
Para receber as notificações é necessário a efetuação do cadastro da url de call-back, credenciais e preferências, conforme descrito nos itens abaixo:

**CADASTRO DE URL, CREDENCIAIS E PREFERÊNCIAS**
#### [POST] ../notificacoes_boletos

Este endpoint tem como objetivo realizar o cadastro da url, credenciais e preferências para notificações das movimentações de baixa operacional e/ou liquidação dos boletos.
Abaixo estão listados os parâmetros obrigatórios exigidos e a descrição deles.
O cadastro pode ser realizado para baixa operacional e/ou efetiva (liquidação).

Importante: Para obter mais informações sobre x-itau-apikey e o x-itau-correlationID, acesse o tópico: Como começar -> Autenticação em Produção -> Fluxos de autenticação Webhook.

 #### Campos de entrada

 **Headers** 

| Parâmetro                | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição                                                                                                                                                                                |
|--------------------------|:--------------:|:---------:|:-----------:|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Content-Type**         |     header     |  string   |     sim     | application/json.                                                                                                                                                                        |
| **x-itau-apikey**        |     header     |  string   |     sim     | Client_id gerado pela autenticação Oauth2 utilizado para autorizar o consumo de uma aplicação requisitante.                                                                              |
| **x-itau-correlationid** |     header     |  string   |     sim     | Identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes. |
| **Authorization**        |     header     |  string   |     sim     | Token de acesso: "Bearer {token}".                                                                                                                                                       |

#### Parâmetros para cadastro de notificações

Abaixo você encontrará a descrição de todos os campos, valores, tipos de dados, formatações, objetos e informações necessárias para preenchimento dos parâmetros de entrada da API.

| Parâmetro             | Obrigatório |           Tipo Dado            | Descrição                                                                                                                                                                                                                                                                                                                                                                                        |
|-----------------------|:-----------:|:------------------------------:|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| id_beneficiario       |     sim     |             String             | Identificação do beneficiário é composição das informações Agência (4) + Conta (7) + DAC (1).                                                                                                                                                                                                                                                                                                    |
| webhook_url           |     sim     |             String             | URL de callback que será utilizada para recebimento das notificações. Exemplo: https://teste1.webhook.com                                                                                                                                                                                                                                                                                        |
| webhook_client_id     |     sim     |             String             | Client_id utilizado na autenticação Oauth2.0 informado no item webhook_oauth_url desse documento. Exemplo : 821a721a-8873-4b6a-af68-da4a48cb39f6                                                                                                                                                                                                                                                 |
| webhook_client_secret |     sim     |             String             | Client_secret utilizado na autenticação Oauth2.0 informado no item webhook_oauth_url desse documento. Exemplo : f57850b5-02b0-4c6a-8154-5b94541204ed                                                                                                                                                                                                                                             | 
| webhook_oauth_url     |     sim     |             String             | URL de callback que será responsável por gerar o token de autenticação na notificação a URL informada no item webhook_url desse documento. Obrigatório ser HTTPS. API em padrão oAuth 2.0, recebendo o cliente_id e client_secret no header Authorization Basic em base64 e o body deve conter grant_type, aceitando o valor client_credentials. Exemplo: https://teste1.webhook.com/autorizacao |
| webhook_oauth_scope   |     não     |             String             | Escopo que será utilizado para recuperar o token de autenticação na notificação. Exemplo: "boletos-notificação". Caso sua API de oAuth não seja configurada esperando receber esse escopo, o envio dessa informação no cadastro poderá ser ignorado. Dessa forma, a chamada da api de autenticação será realizada com o parâmetro vazio (scope = " ").                                           |
| valor_minimo          |     sim     | String pattern: \d{1,15}.\d{2} | Valor minimo para recebimento das notificações de liquidação. Valor livre. Exemplo: 10000.00                                                                                                                                                                                                                                                                                                     |
| tipos_notificacoes    |     sim     |        Array de strings        | Tipo de notificação Webhook (BAIXA_EFETIVA, BAIXA_OPERACIONAL).                                                                                                                                                                                                                                                                                                                                  |

#### Body de saída

O payload de saída da API irá conter os parâmetros que constam abaixo.

| Parâmetro             |           Tipo Dado            | Descrição                                                                                                                                                 |
|-----------------------|:------------------------------:|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| id_beneficiario       |             String             | Identificação do beneficiário é composição das informações Agência (4) + Conta (7) + DAC (1).                                                             |
| webhook_url           |             String             | URL de callback informada no parâmetro de cadastro. Exemplo: https://teste1.webhook.com                                                                   |
| webhook_client_id     |             String             | Client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante. Exemplo : 821a721a-8873-4b6a-af68-da4a48cb39f6 |
| webhook_client_secret |             String             | Client_secret gerado na autenticação Oauth a partir do token temporário enviado. Exemplo : f57850b5-02b0-4c6a-8154-5b94541204ed                           |
| webhook_oauth_url     |             String             | URL para autenticação informada no parâmetro de cadastro. Exemplo: https://teste1.webhook.com/autorizacao                                                 |
| webhook_oauth_scope   |             String             | Escopo que será utilizado para recuperar o token de autenticação na notificação. Exemplo: boletos-notificacao                                             |
| data_criacao          |      String: ($date-time)      | Data do cadastro da WebHook. Formato "AAAA-MM-DD HH:MM:SS"                                                                                                |
| valor_minimo          | String pattern: \d{1,15}.\d{2} | Valor minimo para recebimento das notificações de liquidação. Valor livre. Exemplo: 10000.00                                                              |
| tipos_notificacoes    |        Array de strings        | Tipo de notificação Webhook (BAIXA_EFETIVA, BAIXA_OPERACIONAL).                                                                                           |

**Importante**: As URL's utilizadas no cadastro (webhook_url e webhook_oauth_url) podem ser fakes. Porém, para recebimento das notificações é necessário que os endereços seja alterados para URL's válidas.

#### Exemplo de Entrada:

Todos os campos da requisição devem estar posicionados dentro do bloco de informação correspondente conforme exemplo abaixo.

**Request**
```json
{
    "data":
        {
            "id_beneficiario":"150000154711",
            "webhook_url":"https://teste1.webhook.com",
            "webhook_client_id":"821a721a-8873-4b6a-af68-da4a48cb39f6",
            "webhook_client_secret":"f57850b5-02b0-4c6a-8154-5b94541204ed",
            "webhook_oauth_url":"https://teste1.webhook.com/autorizacao",
            "webhook_oauth_scope": "boletos-notificacao",
            "valor_minimo":1575.15,
            "tipos_notificacoes":["BAIXA_EFETIVA", "BAIXA_OPERACIONAL"]
        }
}
```

#### Exemplo de Saída:

 **Response**
```json
{
    "data":
        {
            "id_beneficiario":"150000154711",
            "webhook_url":"https://teste1.webhook.com",
            "webhook_client_id":"821a721a-8873-4b6a-af68-da4a48cb39f6",
            "webhook_client_secret":"f57850b5-02b0-4c6a-8154-5b94541204ed",
            "webhook_oauth_url":"https://teste1.webhook.com/autorizacao",
            "webhook_oauth_scope": "boletos-notificacao",
            "valor_minimo":1575.15,
            "data_criacao":"2022-10-16 09:31:22",
            "tipos_notificacoes":["BAIXA_EFETIVA", "BAIXA_OPERACIONAL"]
        }
}
```
---

**CONSULTA DA EFETIVAÇÃO DE CADASTRO**
#### [GET] ../notificacoes_boletos

Este endpoint tem como objetivo realizar a consulta da efetivação do cadastro no Webhook. A consulta do cadastro deve ser realizada por id do beneficiário e traz todos os cadastros de tipo de notificação realizadas para aquela conta.
Abaixo estão listados os parâmetros obrigatórios e não obrigatórios necessários e a descrição deles. 

#### Campos de entrada

**Headers** 

| Parâmetro                | Tipo Parâmetro  | Tipo Dado | Obrigatório | Descrição                                                                                     |
|--------------------------|:---------------:|:---------:|:-----------:|-----------------------------------------------------------------------------------------------|
| **Content-Type**         |     header      |  string   |     sim     | application/json.                                                                             |
| **x-itau-apikey**        |     header      |  string   |     sim     | Chave da API utilizado para autorizar o consumo de uma aplicação requisitante.                |
| **x-itau-correlationid** |     header      |  string   |     sim     | Identificador de correlação que serve como um agrupar dentro da estrutura de audit trail.     |
| **Authorization**        |     header      |  string   |     sim     | Token de acesso: "Bearer {token}".                                                            |
| **id_beneficiario**      | query parameter |  string   |     sim     | Identificação do beneficiário é composição das informações Agência (4) + Conta (7) + DAC (1). |
| **tipo_notificacao**     | query parameter |  string   |     não     | Tipo de notificação Webhook (BAIXA_EFETIVA, BAIXA_OPERACIONAL).                               |

#### Exemplo de Saída: 

 **Response**
```json
{
    "data":[
        {
            "id_notificacao_boleto":"b78cc2ff-cec3-4b15-be24-0073cb233266",
            "id_beneficiario":"150000154711",
            "webhook_url":"https://teste1.webhook.com",
            "webhook_oauth_url":"https://teste1.webhook.com/autorizacao",
            "webhook_oauth_scope": "boletos-notificacao",
            "valor_minimo":1575.15,
            "data_criacao":"2022-10-16 09:31:22",
            "tipo_notificacao":"BAIXA_EFETIVA"
        },
        {
            "id_notificacao_boleto":"f57850b5-02b0-4c6a-8154-5b94541204ed",
            "id_beneficiario":"150000154711",
            "webhook_url":"https://teste1.webhook.com",
            "webhook_oauth_url":"https://teste1.webhook.com/autorizacao",
            "webhook_oauth_scope": "boletos-notificacao",
            "valor_minimo":1575.15,
            "data_criacao":"2022-10-16 09:31:22",
            "tipo_notificacao":"BAIXA_OPERACIONAL"
        }
    ]
}
```
---

**ALTERAÇÃO PARCIAL DO CADASTRO**
#### [PATCH] ../notificacoes_boletos/{id_notificacao_boleto}

Este endpoint tem como objetivo realizar alteração parcial no cadastro de notificações do boleto.

#### Campos de entrada

**Headers**

| Parâmetro                 | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição                                                                                                                                |
|---------------------------|:--------------:|:---------:|:-----------:|------------------------------------------------------------------------------------------------------------------------------------------|
| **Content-Type**          |     header     |  string   |     sim     | application/json.                                                                                                                        |
| **x-itau-apikey**         |     header     |  string   |     sim     | Chave da API utilizado para autorizar o consumo de uma aplicação requisitante.                                                           |
| **x-itau-correlationid**  |     header     |  string   |     sim     | Identificador de correlação que serve como um agrupar dentro da estrutura de audit trail.                                                |
| **Authorization**         |     header     |  string   |     sim     | Token de acesso: "Bearer {token}".                                                                                                       |
| **id_notificacao_boleto** | path parameter |  string   |     sim     | Identificador do registro de notificação do boleto. Composto por Agência + Conta + DAC + Cód. Tipo Notificação. Detalhes na **tabela 1** |

Os parâmetros passíveis de alteração são:

 * webhook_url
 * webhook_client_id
 * webhook_client_secret
 * webhook_oauth_url
 * webhook_oauth_scope
 * valor_minimo

#### Exemplo de Entrada:

Todos os campos da requisição devem estar posicionados dentro do bloco de informação correspondente conforme exemplo abaixo.

 **Request**
```json
{
    "data":[
        {
            "webhook_url":"https://teste1.webhook.com",
            "webhook_client_id":"254g721a-8873-4b6a-af68-da4a48cb39f6",
            "webhook_client_secret":"h25690b5-02b0-4c6a-8154-5b94541204ed",
            "webhook_oauth_url":"https://teste1.webhook.com/autorizacao",
            "webhook_oauth_scope": "boletos-notificacao",
            "valor_minimo": 100.00
        }
    ]
}
```

 **Campos de saída**
Status code 204

----

**EXCLUSÃO DE CADASTRO**
#### [DELETE] ../notificacoes_boletos/{id_notificacao_boleto}

Este endpoint tem como objetivo realizar exclusão do cadastro de notificações do boleto.

#### Campos de entrada

**Headers**

| Parâmetro                 | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição                                                                                                                                |
|---------------------------|:--------------:|:---------:|:-----------:|------------------------------------------------------------------------------------------------------------------------------------------|
| **Content-Type**          |     header     |  string   |     sim     | application/json.                                                                                                                        |
| **x-itau-apikey**         |     header     |  string   |     sim     | Chave da API utilizado para autorizar o consumo de uma aplicação requisitante.                                                           |
| **x-itau-correlationid**  |     header     |  string   |     sim     | Identificador de correlação que serve como um agrupar dentro da estrutura de audit trail.                                                |
| **Authorization**         |     header     |  string   |     sim     | Token de acesso: "Bearer {token}".                                                                                                       |
| **id_notificacao_boleto** | path parameter |  string   |     sim     | Identificador do registro de notificação do boleto. Composto por Agência + Conta + DAC + Cód. Tipo Notificação. Detalhes na **tabela 1** |
         

 **Campos de saída**
Status code 204

-----
#### Tabelas

**Tabela 1**    

| **Descrição**           | **Tamanho** | **Tipo** | **Obs**                                    |
|-------------------------|:-----------:|:--------:|--------------------------------------------|
| Agência                 |      4      |  String  |                                            |
| Conta                   |      7      |  String  |                                            |
| DAC                     |      1      |  String  |                                            |
| Código Tipo Notificação |      2      |  String  | 01 - Baixa Efetiva; 02 - Baixa Operacional |

------

#### Endpoint de Recebimento da Notificação de Boletos e Bolecodes (pagos com barras)
#### [POST] {url cadastrada pelo cliente}

**Segurança:**

O Itaú irá realizar a chamada para a API de callback através de uma URL exposta na web, protegida por uma camada de autenticação OAuth2, utilizando-se das configurações informadas no endpoint de cadastro do webhook. Para mais detalhes, consultar a página **“Autenticação em Produção”** (Como começar -> Autenticação em Produção). 

**Importante**: A API de autenticação deverá retornar um JSON, conforme especificação do OAuth2 e não um HTML.

**API call-back**

Deve ser desenvolvida pelo cliente API que será responsável por efetuar a recepção das notificações de boleto.
O Itaú envia as notificações de eventos de boletos imediatamente após ocorrerem (um a um).
A seguir os objetos que serão utilizados na notificação de baixa operacional e baixa efetiva (Liquidação).

#### Parâmetros para recebimentos das notificações

Abaixo você encontrará a descrição de todos os campos, valores, tipos de dados, formatações, objetos e informações necessárias para preenchimento dos parâmetros de entrada da API.
O payload de entrada é composto somente por campos e objetos obrigatórios. 

| **Parâmetro**                                   | **Tipo do parâmetro** | **Tipo do dado**                | **Obrigatório** | **Descrição**                                                                                                   | 
|-------------------------------------------------|-----------------------|---------------------------------|-----------------|-----------------------------------------------------------------------------------------------------------------|
| **Boletos**                                     | **array**             | -                               | **Sim**         | Estrutura com a lista de boletos                                                                                |
| **boleto**.dataNotificacao                      | body                  | string($date-time)              | **Sim**         | Data que a informação da liquidação foi postada. Formato: AAAA-MM-DD                                            | 
| **boleto**.horaNotificacao                      | body                  | string($date-time)              | **Sim**         | Hora que a informação da liquidação foi postada. Formato: HH:MM                                                 | 
| **boleto**.tipoLiquidacao                       | body                  | string                          | **Sim**         | Indicador do tipo de liquidação. Valores possíveis: 06 (Liquidação normal); 95 (Baixa Operacional)              | 
| **boleto**.tipoCobranca                         | body                  | string                          | **Sim**         | Indicador do tipo de cobrança. Valores possíveis: boleto, bolecode                                              | 
| **boleto**.idBeneficiario                       | body                  | string                          | **Sim**         | 4 dígitos da agência concatenado com os 7 dígitos da conta corrente e 1 dígito do DAC                           | 
| **boleto**.codigoCarteira                       | body                  | integer                         | **Sim**         | Código da carteira do título                                                                                    | 
| **boleto**.numeroNossoNumero                    | body                  | integer                         | **Sim**         | Número de identificação do título                                                                               | 
| **boleto**.dacTitulo                            | body                  | integer                         | **Sim**         | Dígito verificador do título                                                                                    | 
| **boleto**.idBoleto                             | body                  | string                          | **Sim**         | Identificador do título                                                                                         | 
| **boleto**.codigoEspecie                        | body                  | string                          | **Sim**         | Código espécie do boleto                                                                                        | 
| **boleto**.descricaoEspecie                     | body                  | string                          | **Sim**         | Descrição da espécie do boleto                                                                                  | 
| **boleto**.codigoBarras                         | body                  | string                          | **Sim**         | Número do código de barras                                                                                      | 
| **boleto**.numeroLinhaDigitavel                 | body                  | string                          | **Sim**         | Número da linha digitável                                                                                       | 
| **boleto**.dataVencimento                       | body                  | string($date-time)              | **Sim**         | Data de vencimento do título. Formato: AAAA-MM-DD                                                               | 
| **boleto**.valorTitulo                          | body                  | string                          | **Sim**         | Valor nominal do título. Formato do campo: 15 dígitos inteiros e 2 casas decimais                               | 
| **boleto**.dataInclusaoPagamento                | body                  | string($date-time)              | **Sim**         | Data de pagamento do título. Formato: AAAA-MM-DD                                                                | 
| **boleto**.valorPagoTotalCobranca               | body                  | string pattern: \d{1,15}\.\d{2} | **Sim**         | Valor do pagamento do título. Formato do campo: 15 dígitos inteiros e 2 casas decimais                          | 
| **boleto**.valorCreditado                       | body                  | string pattern: \d{1,15}\.\d{2} | **Sim**         | Valor que será creditado na conta corrente do cliente. Formato do campo: 15 dígitos inteiros e 2 casas decimais | 
| **boleto**.dataCredito                          | body                  | string($date-time)              | **Sim**         | Data de crédito da liquidação considerando o float. Formato: AAAA-MM-DD                                         | 
| **boleto**.codigoInstituicaoFinanceiraPagamento | body                  | string                          | **Sim\***       | Código do banco recebedor. Obrigatório para tipoCobranca = "boleto".                                            | 
| **boleto**.numeroAgenciaRecebedora              | body                  | string                          | **Sim\***       | Agência recebedora do pagamento. Obrigatório para tipoCobranca = "boleto".                                      | 
| **boleto**.codigoTipoPessoa                     | body                  | string                          | **Sim**         | Tipo de pessoa do pagador. Valores possíveis: F; J                                                              | 
| **boleto**.numeroCadastroPessoaFisica           | body                  | string                          | **Sim**         | CPF do pagador - Obrigatório caso tipoPessoa = F                                                                | 
| **boleto**.numeroCadastroNacionalPessoaJuridica | body                  | string                          | **Sim**         | CNPJ do pagador - Obrigatório caso tipoPessoa = J                                                               | 
| **boleto**.nomePagador                          | body                  | string                          | **Sim**         | Nome do pagador cadastrado do título                                                                            | 
| **boleto**.chavePix                             | body                  | string                          | **Sim\***       | Chave Pix utilizada para recebimento. Obrigatório para tipoCobranca = "bolecode".                               | 
| **boleto**.pixCopiaECola                        | body                  | string                          | **Sim\***       | URL do Pix copia e cola. Obrigatório para tipoCobranca = "bolecode".                                            | 
| **boleto**.txid                                 | body                  | string                          | **Sim\***       | O campo txid determina o identificador da transação. Obrigatório para tipoCobranca = "bolecode".                | 
| **boleto**.endToEndId                           | body                  | string                          | **Sim\***       | Id fim a fim da transação.Esse campo é o id do pagamento. Obrigatório para tipoCobranca = "bolecode".           | 

#### Parâmetros de saída

| **Parâmetro** | **Tipo do parâmetro** | **Tipo do dado** | **Obrigatório** | **Descrição** | **Observação** |
|---------------|-----------------------|------------------|-----------------|---------------|----------------|
|               |                       |                  |                 |               |                |

**Observação**: Nenhum objeto em específico é esperado no retorno, ficando a critério do cliente.

#### Exemplo de entrada

```json
{
  "boletos": [
    {
      "dataNotificacao": "2022-07-27",
      "horaNotificacao": "10:30",
      "tipoLiquidacao": "95",
      "tipoCobranca": "boleto",
      "idBeneficiario": "150000572639",
      "codigoCarteira": "157",
      "numeroNossoNumero": "00007965",
      "dacTitulo": "9",
      "idBoleto": "139bbd22-a164-4128-bb2d-8ef1e22e1213",
      "codigoEspecie": "01",
      "descricaoEspecie": "DM - Duplicata Mercantil",
      "codigoBarras": "34191942700000300001570000796551500572639000",
      "numeroLinhaDigitavel": "34191570070079655150505726390007194270000030000",
      "dataVencimento": "2023-07-30",
      "valorTitulo": "300.00",
      "dataInclusaoPagamento": "2022-06-21",
      "valorPagoTotalCobranca": "300.00",
      "valorCreditado": null,
      "dataCredito": "2022-03-31",
      "codigoInstituicaoFinanceiraPagamento": "341",
      "numeroAgenciaRecebedora": "1500",
      "codigoTipoPessoa": "F",
      "numeroCadastroPessoaFisica": "26556923222",
      "numeroCadastroNacionalPessoaJuridica": null,
      "nomePagador": "Joao Silva",
      "chavePix": null,
      "pixCopiaECola": null,
      "txid": null,
      "endToEndId": null
    }
  ]
}
```

### Erros

Há um padrão de retorno para todos os erros na API. Esse padrão segue uma estrutura específica, podendo apenas variar os valores existentes nos campos. Observar a seção “Padrão de Erros”.

## Padrões de erros

Essa API retorna códigos de status HTTP para indicar sucesso ou falhas das requisições.

Códigos **2xx** indicam sucesso.

Códigos **4xx** indicam falhas causadas pelas informações enviadas pelo cliente ou pelo estado atual das entidades.

Códigos **5xx** indicam problemas no serviço no lado da API.

As respostas de erro incluem no corpo detalhes do erro e o campo type identifica o tipo de erro.

Abaixo estão listados os tipos de erro que podem ser retornados por quaisquer endpoints listados nessa documentação.

| HTTP Status Code          | Descrição                         | Significado                                                                                                            |
|:--------------------------|:----------------------------------|:-----------------------------------------------------------------------------------------------------------------------|                     
| 400 Bad Request           | RequisicaoInvalida                | requisição inválida                                                                                                    |
| 403 Forbidden             | AcessoNegado                      | requisição de participante autenticado que viola alguma regra de autorização                                           |
| 404 Not Found             | NaoEncontrado                     | entidade não encontrada                                                                                                |
| 500 Internal Server Error | ErroInternoDoServidor             | condição inesperada ao processar requisição                                                                            |
| 503 Service Unavailable   | ServicoIndisponivel               | serviço não está disponível no momento. Serviço solicitado pode estar em manutenção ou fora da janela de funcionamento |
| 504 Gateway Timeout       | IndisponibilidadePorTempoEsgotado | indica que o serviço demorou além do esperado para retornar                                                            |

