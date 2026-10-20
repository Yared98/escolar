# API Boletos - Extrato Boleto Cobranca (v1.13.7)

Fonte: https://devportal.itau.com.br/nossas-apis/itau-ep9-api-extrato-v1-externo (aba visão geral, atualizada em 2025-11-12T04:54:41.000Z)
Sandbox: https://sandbox.devportal.itau.com.br/itau-ep9-api-extrato-v1-externo/v1
Spec: ../openapi/itau-ep9-api-extrato-v1-externo.json

---



## **sobre a API**

Esta API refere-se ao contexto do extrato e serviço da francesa. É disponibilizado nas rotas desta API as informações das movimentações e tarifas de cobrança, podendo ser filtradas por parâmetros que permitem maior visibilidade dos dados.
Essa API permite que o cliente obtenha relatórios detalhados ou resumidos a respeito das movimentações de boletos e suas tarifas. Pode-se utilizar as datas retornadas para consultar o Extrato de Movimentação Resumido e o Extrato de Movimentação Detalhado. Retorna a movimentação resumida da cobrança, desconto e tarifação mensal. Sendo desconto e tarifação mensal informações não obrigatórias no retorno.

As operações disponíveis são:

- Consulta de dados de cobrança e conciliação (Francesa)
- Movimentação Detalhada e Resumida

## **para quem é esta API?**

Clientes externos que precisam de informações sobre consulta de dados de cobrança e conciliação para os clientes
e que precisam analisar os dados da movimentacão de extrato detalhada e resumida.

## **restrições de uso**

Para começar a sua jornada de desenvolvimento é importante que o ambiente esteja preparado e configurado para realizar os testes e suportar o desenvolvimento da aplicação de maneira segura. Nosso modelo de comunicação atual requer a autenticação do parceiro através do fluxo **OAuth 2.0**.

**Fluxo de autenticação – OAuth 2.0 (Private KeyJWT e Mutual-TLS Client Authentication)**

Os fluxos de autenticação do OAuth 2.0 são baseados em obtenção de _access_tokens_ que permitem a autenticação e autorização das APIs. O método previsto para as APIS do Itaú é o _Private Key JWT Client Authentication (private_key_jwt)_ que consiste em autenticação no fluxo _client_credentials_ baseada em chaves (privada e pública).

Ambas as chaves são criadas pelo desenvolvedor que irá integrar com as APIs do Itaú. A chave privada, deve ser criada e armazenada de maneira segura dentro do ambiente da aplicação que consumirá as APIs e é utilizada para assinar todas as obtenções de _access_tokens_. A chave pública deve ser exposta em um terminal de configuração descoberta _(well-known endpoint)_ em uma sessão específica conhecida como _jwks_uri (JSON Web Key Sets – URI)_. A _jwks_uri_ deve ser informada para o agente comercial Itaú no momento da contratação. Saiba mais em https://auth0.com/docs/tokens/json-web-tokens/json-web-key-sets.

Para estabelecer conexão segura com os API Gateways do Itaú é necessário enviar um _client certificate_. Este certificado é usado para estabelecer o _mTLS (OAuth 2.0 Mutual Transport Layer Security_ - https://tools.ietf.org/html/rfc8705):

**1**. A partir de um _client_id_ e <u>token temporário para ativação</u>, ambos fornecidos pelo agente comercial após a contratação, o desenvolvedor gera um arquivo CSR _(Certificate Signing Request)_ baseado em um _template_ e documentação será fornecida no nosso Portal do Desenvolvedor;

**2**. O desenvolvedor solicita um certificado assinado pelo Itaú (CRT – _Certificate File_) , através de uma API informando o CSR e token temporário de ativação;

**3**. O desenvolvedor configura sua aplicação com o arquivo CRT, que será utilizado junto com o _private_key_jwt_ para a obtenção de _access_tokens_ e junto com o _access_token_ para todas as chamadas de APIs.

**4**. A renovação automática e revogação estão também documentadas no Portal do Desenvolvedor.

## **conhecimentos técnicos necessários**

Conhecimentos prévios necessários:

- `JSON`
- `HTTP`
- `OpenAPI`
- `OAuth 2.0`

## **quais necessidades que essa API ajuda a resolver?**

Promover uma melhor experiência ao cliente na consulta de dados de cobrança e conciliação, disponibilizando uma visão consolidada.

## **tempo aproximado para integração**

**2 dias:** essa é a média de tempo que um desenvolvedor pode levar para preparar toda a integração com essa API. Isso pode variar de acordo com o tamanho do time e experiência dos desenvolvedores envolvidos.

### Parâmetros comuns de cabeçalho

Para consumo das APIs do Itaú, alguns parâmetros de cabeçalho são necessários:

**x-itau-apikey**

O _x-itau-apikey_ é um parâmetro que será requerido em todas as chamadas das APIs que contemplam essa solução. A informação que deve ser usada nesse campo é o código gerado através da autenticação OAuth 2.0 para o client_id. Para saber como gerar o client_id ou como recuperar as informações de códigos já gerados basta acessar a etapa de ‘autenticação’ desse tutorial.

**x-itau-flowID**

A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. Recomenda-se utilizar um uuid version 4 nesse campo como: b47ec51b-b2a7-4a78-933c-f0b67667e7dc.

**x-itau-correlationID**

A implementação de um correlationID permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes, conseguindo fornecer um mapeamento de ponta-a-ponta. Por exemplo, uma aplicação client gera uma chamada à API, neste momento fornecendo o correlationID gerado pelo consumidor, o qual é repassado em todas as camadas/microserviços que a api precisa para realizar determinada funcionalidade. É importante lembrar que o header x-itau-correlationID deve sempre ser diferente a cada requisição. Necessário utilizar um uuid version 4 válido nesse campo como por exemplo: a1e64241-7fdb-4d05-a7f6-c44febcdd8d9.

## Objetivo

Esta **API extrato Boleto Francesa** é responsável pela consulta de dados de cobrança e conciliação. Utilizando parâmetros de pesquisa que irão retornar uma lista das movimentações da cobrança e tarifas do cliente.

## Endpoints

Os exemplos de respostas de erros são demonstrados no tópico padrões de erros ao final desta página. Cada _endpoint_ traz uma tabela especificando quais desses retornos o serviço retorna. Então, caso haja variação no _JSON_ retornado, este será demonstrado na explicação do próprio _endpoint_, se não, deve ser visualizado no tópico citado.

## URLs

Para garantir uma integração segura, as funcionalidades da API estão disponíveis nas seguintes URLs:

| ambiente | endpoint                               |
| -------- | -------------------------------------- |
| produção | https://boleto.api.itau.com/extrato/v1 |

### **Scopes**

Para que o cliente consiga acessar nossa API, no cadastro da aplicação consumidora no portal de certificados de parceiro, é necessário adicionar o scope/funcionalidade: `boletoscash-francesas.read`.

### Endpoint Calendário de Movimentações (Datas disponíveis)

#### [GET] ../francesas?agencia={agencia}&conta={conta}&mesReferencia={MMAAAA}&dac={dac}

API responsável por retornar as datas que há movimentações de boletos, quando informado o mês de referência. Pode-se utilizar as datas retornadas para consultar o Extrato de Movimentação Resumido e o Extrato de Movimentação Detalhado.

Os boletos elegíveis para serem consultados são:

- Boletos em aberto (vencidos e a vencer);
- Boletos baixados (inicialmente até 45 dias);
- Boletos liquidados (inicialmente até 45 dias).

A seguir estão expostos os parâmetros exigidos por essa API e a descrição deles. Para obter mais informações de onde conseguir o x-itau-apikey, e o x-itau-correlationID, acesse o tópico ‘Informações necessárias’.

#### Exemplos de saída

- HTTPStatus - 200

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

- HTTPStatus - 400

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

- Agência:

Caso tenha colocado uma agência com menos de 7 dígitos retorna um json com a mensagem "Agência inválida";
Caso não tenha informado a agência, retorna um json com a mensagem "Campo agência não preenchido";
Caso tenha informado a agência com caractere não numérico, retorna um json com a mensagem "Campo agência inválido, caractere não numérico".

- Conta:

Caso tenha colocado uma conta diferente de 7 dígitos retorna um json com a mensagem "Conta inválida";
Caso não tenha informado a conta, retorna um json com a mensagem "Campo conta não preenchido";
Caso tenha informado a conta com caractere não numérico, retorna um json com a mensagem "Campo conta inválido, caractere não numérico".

- DAC:

Caso tenha colocado uma DAC com mais de 1 dígitos retorna um json com a mensagem "DAC inválido, tente novamente";
Caso não tenha informado a DAC, retorna um json com a mensagem "DAC inválido, tente novamente";
Caso tenha informado a DAC com caractere não numérico, retorna um json com a mensagem "DAC inválido, tente novamente".

- Mês referência:

Caso tenha colocado um mês referência com mais de 6 dígitos retorna um json com a mensagem "Mês referência inválido";
Caso não tenha informado o mês referência, retorna um json com a mensagem "Mês referência inválido";
Caso tenha informado o mês referência com caractere não numérico, retorna um json com a mensagem "Mês referência inválido".

#### Parâmetros para a Consulta

| Parâmetro            | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------- | -------------- | --------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| x-itau-apikey        | header         | string    | sim         | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| x-itau-correlationID | header         | string    | sim         | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes.                                                                                                                                                                                                                                                                                                                                                                                                  |
| x-itau-flowID        | header         | string    | sim         | A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. |
| agencia              | param          | integer   | sim         | Dados para identificação do boleto para consulta, sendo composto por: Código Agência - Obrigatório (4 caracteres)                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| conta                | param          | integer   | sim         | Dados para identificação do boleto para consulta, sendo composto por: Código Conta - Obrigatório (7 caracteres)                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| dac                  | param          | integer   | sim         | Dados para identificação do boleto para consulta, sendo composto por: Código DAC - Obrigatório (1 caractere)                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| mesReferencia        | param          | integer   | sim         | Mês de referência para a consulta, no formato MMAAAA                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

#### Endpoint Movimentação Resumida (Cobrança, desconto e tarifação mensal)

#### [GET] ../francesas/{francesaId}/movimentacoes-resumidas

API responsável por retornar o Extrato de Movimentações dos boletos de cobrança e descontados de forma resumida, para determinada data. Retorna a movimentação resumida da cobrança, desconto e tarifação mensal. Sendo desconto e tarifação mensal informações não obrigatórias no retorno.

Os boletos elegíveis para serem consultados são:

- Boletos em aberto (vencidos e a vencer);
- Boletos baixados (inicialmente até 45 dias);
- Boletos liquidados (inicialmente até 45 dias).

A seguir estão expostos os parâmetros exigidos por essa API e a descrição deles. Para obter mais informações de onde conseguir o x-itau-apikey, e o x-itau-correlationID, acesse o tópico ‘Informações necessárias’.

#### Exemplos de saída da cobrança

- HTTPStatus - 200

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

- HTTPStatus - 200

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

- HTTPStatus - 200

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
          "tarifacaoMensal": {
            "dataDebito": "2020-10-09",
            "periodoConsolidado": {
              "dataInicial": "2020-10-01",
              "dataFinal": "2020-10-31"
            },
            "tarifas": [
              {
                "descricao": "liquidação",
                "quantidade": 5,
                "valor": "120.00"
              },
              {
                "descricao": "protestos solicitados",
                "quantidade": 10,
                "valor": "11.00"
              },
              {
                "descricao": "baixas",
                "quantidade": 5,
                "valor": "30.00"
              }
            ],
            "totalTarifas": {
              "quantidade": 20,
              "valor": "161.00"
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

- HTTPStatus - 400

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

- francesaId:

Caso o tamanho seja diferente de 12 (agencia + conta + dac), retorna um json com a mensagem: "Id inválido";
Caso o tipo de caractere seja diferente de numérico, retorna um json com a mensagem:
"Agência inválida" (quando os 4 primeiros dígitos);
"Conta inválida" (quando dígitos da posição 5 a 11);
"DAC da conta inválido, tente novamente" (quando dígito da posição 12);
Caso o DAC da conta seja inválido, retorna um json com a mensagem: "DAC da conta inválido, tente novamente." (Status code 422).

- data:

Caso a data esteja com o valor vazio/nulo, retorna um json com a mensagem: "Data inválida";
Caso a data esteja com o formato diferente de yyyy-mm-dd, retorna um json com a mensagem: "Data inválida";
Caso a data esteja com o tamanho diferente de 10, retorna um json com a mensagem: "Data inválida";
Caso a data > data atual, retorna um json com a mensagem: "Data não pode ser maior que data atual" (Status code 422).

#### Parâmetros para a Consulta

| Parâmetro            | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------- | -------------- | --------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| x-itau-apikey        | header         | string    | sim         | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| x-itau-correlationID | header         | string    | sim         | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes.                                                                                                                                                                                                                                                                                                                                                                                                  |
| x-itau-flowID        | header         | string    | sim         | A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. |
| francesaId           | path           | integer   | sim         | Dados para identificação do boleto para consulta, sendo composto por: Código Agência - Obrigatório (4 caracteres), Código Conta Corrente - Obrigatório (7 caracteres) e o DAC - Obrigatório (1 caractere).                                                                                                                                                                                                                                                                                                                                                                                |
| data                 | param          | date-only | sim         | Data para consulta de extrato da movimentação de boletos de cobrança e descontados na visão resumida. Informar no formato AAAA-MM-DD                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

#### Endpoint Consulta de Extrato de Movimentação de Boletos Detalhados (Francesa Detalhada)

#### [GET] ../francesas/{francesaId}/movimentacoes

API responsável por retornar o Extrato de Movimentações de forma detalhada, para determinada data. Para visualização das movimentações de boletos forma resumida desta data, consultar a API 'Extrato Resumido'.

Os boletos elegíveis para serem consultados são:

- Boletos em aberto (vencidos e a vencer);
- Boletos baixados (inicialmente até 45 dias);
- Boletos liquidados (inicialmente até 45 dias).

A seguir estão expostos os parâmetros exigidos por essa API e a descrição deles. Para obter mais informações de onde conseguir o x-itau-apikey, e o x-itau-correlationID, acesse o tópico ‘Informações necessárias’.

### Glossário

#### "codigoStatus" - Descrição das Situações de Movimentação de Títulos

| **Código** | **Descrição**                                  |
| ---------- | ---------------------------------------------- |
| 73         | Entrada                                        |
| B          | Baixa                                          |
| BA         | Baixa para acertos                             |
| BC         | Baixa por ter sido protestado                  |
| BD         | Baixa com devolução                            |
| BE         | Baixa de título liquidado anteriormente        |
| BJ         | Baixa por ter sido sustado judicialmente       |
| BL         | Baixa por ter sido liquidado                   |
| BS         | Baixa com transferência para desconto          |
| BY         | Baixa de título                                |
| BZ         | Baixa de título descontado                     |
| CC         | Custas de cancelamento do protesto             |
| CD         | Custas de cartório distribuidor                |
| CE         | Custas de publicação de edital                 |
| CI         | Custas de irregularidade                       |
| CJ         | Custas de sustação de judicial                 |
| CP         | Custas de protesto                             |
| CS         | Custas de sustação de protesto                 |
| E          | Entrada                                        |
| EA         | Entrada por acertos (reentrada)                |
| ET         | Entrada de título transferido para cobrança    |
| EY         | Entrada de título                              |
| EZ         | Entrada de título descontado                   |
| FL         | Liquidação após feriado                        |
| L          | Liquidação                                     |
| LC         | Liquidação em cartório                         |
| LD         | Liquidação com dispensa de juros               |
| LE         | Liquidação de título baixado anteriormente     |
| LI         | Liquidação em banco correspondente             |
| LP         | Liquidação parcial                             |
| LQ         | Liquidação em cheque                           |
| LZ         | Liquidação de título descontado                |
| TC         | Tarifa de Cancelamento de Neg Expressa         |
| TF         | Tarifa de Ativa Eletrônica (até 3 envios)      |
| TG         | Tarifa e-mail Cobrança Ativa Eletrônica        |
| TH         | Tarifa SMS Cobrança Ativa Eletrônica           |
| TI         | Tarifa de outras instruções                    |
| TM         | Tarifa de manutenção de título vencido         |
| TN         | Tarifa de entrada em Negativação Expressa      |
| TO         | Tarifa de outras ocorrências                   |
| TP         | Tarifa de protesto                             |
| TQ         | Tarifa exclusão por Liquidação em Neg Expressa |
| TS         | Tarifa de sustação de protesto                 |
| TX         | Tarifa exclusão de Entrada em Neg Expressa     |

#### "tipoMovimentacao" - Tipos de Movimentação de Títulos

| **Valor**   | **Descrição**          |
| ----------- | ---------------------- |
| entradas    | Entradas de títulos    |
| liquidacoes | Liquidações de títulos |
| baixas      | Baixas de títulos      |

#### "tipoCobranca" - Tipos de Cobrança

| **Valor**         | **Descrição**               |
| ----------------- | --------------------------- |
| boleto            | Boleto bancário tradicional |
| boleto_descontado | Boleto descontado           |
| bolecode          | Bolecode (código especial)  |

#### Exemplos de saída

- HTTPStatus - 200

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
      "dataInclusao": "2020-01-01",
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
      "first": "https://boleto.api.itau.com/extrato/v1/francesas/123411111111111/movimentacoes?data=2020-01-01&page=0&pageSize=20",
      "last": "https://boleto.api.itau.com/extrato/v1/francesas/123411111111111/movimentacoes?data=2020-01-01&page=15&pageSize=20",
      "previous": "",
      "next": "https://boleto.api.itau.com/extrato/v1/francesas/123411111111111/movimentacoes?data=2020-01-01&page=1&pageSize=20"
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

- HTTPStatus - 200

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
      "dataInclusaoTituloCobranca": "2020-11-06",
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

- HTTPStatus - 400

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

- francesaId:

Caso o tamanho diferente de 12 (agencia + conta + dac), retorna um json com a mensagem: "Id inválido";
Caso o tipo diferente de numérico, retorna um json com a mensagem:
"Agência inválida" (quando os 4 primeiros dígitos);
"Conta inválida" (quando dígitos da posição 5 a 11);
"DAC da conta inválido, tente novamente" (quando dígito da posição 12);
Caso o DAC da conta inválido, retorna um json com a mensagem: "DAC da conta inválido, tente novamente." (Status code 422).

- data:

Caso a data estiver com o valor vazio/nulo, retorna um json com a mensagem: "Data obrigatória";
Caso a data estiver com o formato diferente de yyyy-mm-dd, retorna um json com a mensagem: "Data inválida";
Caso a data estiver com o tamanho diferente de 10, retorna um json com a mensagem: "Data inválida";
Caso a data > data atual, retorna um json com a mensagem: "Data não pode ser maior que data atual" (Status code 422).

- tipoCobranca:

Caso estiver diferente de 'boleto', 'bolecode', 'boleto_descontado', retorna um json com a mensagem: "Tipo de Cobrança inválida" (Status code 422);
Caso estiver vazio, retorna um json com a mensagem: "Tipo de Cobrança inválida".

- tipoMovimentacao:

Caso estiver diferente de 'entradas', 'baixas', 'liquidacoes', retorna um json com a mensagem: "Tipo de Movimentação inválida" (Status code 422);
Caso estiver vazio, retorna um json com a mensagem: "Tipo de Movimentação inválida".

- nossoNumero:

Caso estiver com o tamanho for maior que 16 dígitos, retorna um json com a mensagem: "Tamanho do nosso número maior que o permitido";
Caso estiver vazio, retorna um json com a mensagem: "Nosso número inválido";
Caso estiver diferente do tipo numérico, retorna um json com a mensagem: "Nosso número inválido".

- seuNumero:

Caso estiver vazio, retorna um json com a mensagem: "Seu número inválido";
Caso estiver com o tamanho maior que 10, retorna um json com a mensagem: "Tamanho do seu número maior que o permitido";
Caso estiver com caracteres inválidos, retorna um json com a mensagem: "Seu número inválido, caractere informado não permitido".

- nomePagador:

Caso estiver com o tamanho menor que 3, retorna um json com a mensagem: "Tamanho do nome do pagador deve ser superior a 2 caracteres";
Caso estiver com o tamanho maior que 30, retorna um json com a mensagem: "Tamanho do nome do pagador maior que o permitido";
Caso estiver com o tamanho informado caractere não válido\*\*, retorna um json com a mensagem: "Nome do pagador inválido, caractere informado não permitido" ;
Caso estiver vazio, retorna um json com a mensagem: "Nome do pagador não preenchido".

\*\*Caracteres válidos: letras maiúsculas/minúsculas, caracteres com/sem acentos, números, espaços, e-comercial (&), apostrofo ('), virgula (,), barra ( /), hífen(-), ponto (.), ordinal feminino (ª), Ordinal masculino (º).

- numeroCarteira:

Caso estiver vazio, retorna um json com a mensagem: "Carteira inválida";
Caso estiver com o tamanho diferente de 3, retorna um json com a mensagem: "Tamanho da carteira inválida";
Caso estiver com o tipo diferente de numérico, retorna um json com a mensagem: "Carteira inválida".

- page:

Caso estiver vazio, retorna um json com a mensagem: "Número da página inválido";
Caso estiver menor que zero, retorna um json com a mensagem: "Número da página inválido";
Caso estiver com o tipo não-numérico, retorna um json com a mensagem: "Número da página inválido";
Caso estiver maior que 9.999.999, retorna um json com a mensagem: "Número da página deve ser inferior a 10.000.000".

- pageSize:

Valores possíveis: 10, 20, 30, 40, 50.
Caso estiver diferente desses informados, retorna um json com a mensagem: "Quantidade de resultados por página inválido" (Status code 422).

- orderBy:

Campos possíveis: nomePagador, nossoNumero, seuNumero, dataVencimento.
Caso estiver diferente desses informados, retorna um json com a mensagem: "Não é possível ordenar por esse campo" (Status code 422).
default: nomePagador.

- order

enum [asc, desc].
Caso estiver diferente, retorna um json com a mensagem: "Ordenação inválida".
default: asc.

#### Parâmetros para a Consulta

| Parâmetro            | Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------- | -------------- | --------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| x-itau-apikey        | header         | string    | sim         | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| x-itau-correlationID | header         | string    | sim         | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes.                                                                                                                                                                                                                                                                                                                                                                                                  |
| x-itau-flowID        | header         | string    | sim         | A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. |
| francesaId           | path           | integer   | sim         | Dados para identificação do boleto para consulta, sendo composto por: Código Agência - Obrigatório (4 caracteres), Código Conta Corrente - Obrigatório (7 caracteres) e o DAC - Obrigatório (1 caractere).                                                                                                                                                                                                                                                                                                                                                                                |
| data                 | param          | date-only | sim         | Data para consulta de extrato da movimentação de boletos de cobrança e descontados na visão detalhada. Informar no formato AAAA-MM-DD                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| tipoCobranca         | param          | string    | não         | Consulta pelo Tipo de Cobrança específico. Quando não informado, serão retornados todos. Opções: 'boleto','bolecode', 'boleto_descontado'                                                                                                                                                                                                                                                                                                                                                                                                                             |
| tipoMovimentacao     | param          | string    | não         | Consulta pelo Tipo de movimentação específico. Quando não informado, serão retornados todos. Opções: 'entradas', 'liquidacoes', 'baixas'                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| nossoNumero          | param          | integer   | não         | Consulta pelo Registro de identificação do boleto (Até 16 dígitos)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| seuNumero            | param          | string    | não         | Consulta pelo Número do documento específico (Até 10 dígitos)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| numeroCarteira       | param          | integer   | não         | Consulta pelo Número da Carteira específico (Até 3 dígitos)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| nomePagador          | param          | string    | não         | Consulta pelo Nome do Pagador específico (Tamanho mínimo 3 caracteres, máximo 30 caracteres)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## Padrões de erros

Essa API retorna códigos de status HTTP para indicar sucesso ou falhas das requisições.

Códigos **2xx** indicam sucesso.

Códigos **4xx** indicam falhas causadas pelas informações enviadas pelo cliente ou pelo estado atual das entidades.

Códigos **5xx** indicam problemas no serviço no lado da API.

As respostas de erro incluem no corpo detalhes do erro e o campo type identifica o tipo de erro.

Abaixo estão listados os tipos de erro que podem ser retornados por quaisquer endpoints listados nessa documentação.

| HTTP Status Code          | Descrição                         | Significado                                                                                                            |
| :------------------------ | :-------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| 400 Bad Request           | RequisicaoInvalida                | requisição inválida                                                                                                    |
| 403 Forbidden             | AcessoNegado                      | requisição de participante autenticado que viola alguma regra de autorização                                           |
| 404 Not Found             | NaoEncontrado                     | entidade não encontrada                                                                                                |
| 500 Internal Server Error | ErroInternoDoServidor             | condição inesperada ao processar requisição                                                                            |
| 503 Service Unavailable   | ServicoIndisponivel               | serviço não está disponível no momento. Serviço solicitado pode estar em manutenção ou fora da janela de funcionamento |
| 504 Gateway Timeout       | IndisponibilidadePorTempoEsgotado | indica que o serviço demorou além do esperado para retornar                                                            |

