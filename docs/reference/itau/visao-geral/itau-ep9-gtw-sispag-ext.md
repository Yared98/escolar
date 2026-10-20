# API Cash Management (v1.14.30)

Fonte: https://devportal.itau.com.br/nossas-apis/itau-ep9-gtw-sispag-ext (aba visão geral, atualizada em 2026-09-29T04:03:40.000Z)
Sandbox: https://sandbox.devportal.itau.com.br/itau-ep9-gtw-sispag-ext/v1
Spec: ../openapi/itau-ep9-gtw-sispag-ext.json

---



## **sobre a API**

As APIs do SISPAG permitem a inclusão de transferências de Pix, pagamentos de Pix QR Code, consultar a lista de pagamentos e o detalhe para todas as formas de pagamento. O Pix permitirá transferências e pagamentos via QR Code Estático e Dinâmico entre diferentes instituições financeiras em até 40 segundos, 24 horas por dia e todos os dias do ano, incluindo finais de semana e feriados. Para utilizar o Pix através dessa API é necessário que o SISPAG esteja contratado.

## **para quem é esta API?**

O público-alvo desta API são empresas que contrataram o SISPAG e desejam integrar seus sistemas para realizar transferências Pix e pagamentos de QR Code, além de consultas de pagamentos.

## **restrições de uso**

Para utilizar o Pix através dessa API é necessário que o SISPAG esteja contratado. É necessário obter as credenciais conforme política de consumo de API do Itaú.

## **conhecimentos técnicos necessários**

Conhecimentos prévios necessários: `HTTP`, `JSON`, `OAuth 2.0` e `mTLS`.

## **quais necessidades que essa API ajuda a resolver?**

O Pix permitirá a transferências e pagamentos via QR Code Estático e Dinâmico entre diferentes instituições financeiras em até 40 segundos, 24 horas por dia e todos os dias do ano, incluindo finais de semana e feriados.

## **tempo aproximado para integração**

**5 dias:** essa é a média de tempo que um desenvolvedor pode levar para preparar toda a integração com essa API. Isso pode variar de acordo com o tamanho do time e experiência dos desenvolvedores envolvidos.

## Atualização de segurança

Com o objetivo de aumentar a segurança das comunicações é necessário que sua equipe realize as seguintes adequações:

- **Liberar os novos ranges de IP** nos firewalls dos ambientes consumidores. Essa atualização é necessária para manter a comunicação segura e contínua com a infraestrutura, mesmo que a URLs atualmente utilizas permaneçam inalteradas. **Atualizar as URLs das APIs** que passarão a utilizar novos endereços de conexão, assegurando que as integrações continuem operando normalmente após a evolução da infraestrutura.
- Consulte o passo a passo na rota:Comunicados>Atualização de segurança e Vencimento de certificados ou pelo link: https://devportal.itau.com.br/certificados-apis-expiracao-2026

## API Cash Management

## Endpoints

| Ambiente | Endpoint                                  | Autenticação                                    |
|----------|-------------------------------------------|-------------------------------------------------|
| Sandbox  | https://api.itau.com.br/sandbox/sispag/v1 | https://api.itau.com.br/sandbox/api/oauth/token |
| Produção | https://api.gateway.itau.com.br/sispag/v1 | https://sts.itau.com.br/api/oauth/token         |

## Sobre a solução

O Pix permitirá a transferências e pagamentos via QR Code Estático e Dinâmico entre diferentes instituições financeiras em até 40 segundos, 24 horas por dia e todos os dias do ano,
incluindo finais de semana e feriados. Para utilizar o Pix através dessa API é necessário que o SISPAG esteja contratado.

### Autenticação e Segurança

Para começar a sua jornada de desenvolvimento é importante que o ambiente esteja preparado e configurado para realizar os testes e suportar o desenvolvimento da aplicação de
maneira segura. Nosso modelo de comunicação atual requer a autenticação do parceiro através do fluxo OAuth 2.0.

### Fluxo de autenticação – OAuth 2.0 (Private Key JWT e Mutual-TLS Client Authentication)

Os fluxos de autenticação do OAuth 2.0 são baseados em obtenção de access_tokens que permitem a autenticação e autorização das APIs.

O método previsto para as APIs do Pix do Itaú é o Private Key JWT Client Authentication (private_key_jwt) que consiste em autenticação no fluxo client_credentials baseada em chaves (pública e privada).

Ambas as chaves são criadas pelo desenvolvedor que irá integrar com as APIs do Itaú.
A chave privada deve ser criada e armazenada de maneira segura dentro do ambiente da aplicação que consumirá as APIs e é utilizada para assinar todas as obtenções de access_tokens.
A chave pública deve ser exposta em um terminal de configuração descoberta (well-known endpoint) em uma sessão específica conhecida como jwks_uri (JSON Web Key Sets – URI).

A jwks_uri deve ser informada para o agente comercial Itaú no momento da contratação.
Saiba mais em [JSON Web Key Sets](https://auth0.com/docs/tokens/json-web-tokens/json-web-key-sets)

Para estabelecer conexão segura com as APIs Gateways do Itaú é necessário enviar um client certificate.
Este certificado é usado para estabelecer o mTLS ([OAuth 2.0 Mutual Transport Layer Security](https://tools.ietf.org/html/rfc8705)):

1. A partir de um client_id e token temporário para ativação, ambos fornecidos pelo agente comercial após a contratação, o desenvolvedor gera um arquivo CSR (Certificate Signing
     Request) baseado em um template e a documentação será fornecida no nosso Portal do Desenvolvedor;
2. O desenvolvedor solicita um certificado assinado pelo Itaú (_CRT – Certificate File_), através de uma API informando o CSR e token temporário de ativação;
3. O desenvolvedor configura sua aplicação com o arquivo CRT, que será utilizado junto com o private_key_jwt para a obtenção de access_tokens e junto com o access_token para
     todas as chamadas de APIs;
4. A renovação automática e revogação estão também documentadas no Portal do Desenvolvedor.

### Como conhecer e testar as APIs

Após a contratação, seu agente comercial realizará o cadastro em nossos sistemas internos e enviará três informações importantes: uma credencial (client_id) que será cadastrada com
suas informações previamente fornecidas (inclusive o jwks_uri, citado anteriormente), token temporário de ativação e um código de registro para Portal do Desenvolvedor Itaú, no
qual dará acesso à toda a documentação detalhada e referências técnicas, além de um ambiente sandbox para testes simulados. Com esse código, você se cadastra e pode cadastrar
outros desenvolvedores de sua organização.

#### Um exemplo de como será essa jornada

1. O primeiro passo é criar um ‘projeto’ dentro do nosso portal, definindo o nome do projeto e quais APIs farão parte dele e, por fim, clicando no botão "Criar Projeto" para
     finalizar a criação;
2. Acesse a página da API e leia toda a documentação, com fluxos e exemplos. Isso, com certeza, vai ajudar você a diminuir o tempo e a dificuldade na construção;
3. Dentro da documentação, além das informações referentes ao processo, você encontrará as especificações técnicas de cada API, métodos, parâmetros de entrada (requests) e de
     retorno (responses);
4. Em seguida, você terá a possibilidade de selecionar a aplicação criada para seu projeto (passo 1), simular uma autorização (obtendo um access_token) e simulando uma chamada da
     API, após o preenchimento dos campos obrigatórios e opcionais;
5. Se houver dúvidas ou problemas de acesso você poderá contar com o time comercial para melhor direcionar os pontos que necessitam de atuação ou melhoria em nossa documentação.
     Contamos sua colaboração nessa jornada!

**Para testar as APIs do sandbox diretamente de sua aplicação**, basta obter um cliente_id de uma aplicação criada no Portal do Desenvolvedor e *private_key_jwt* global (que estará
disponível nas informações adicionais da aplicação) e realizar as chamadas diretamente para as *URIs* de obtenção de *access_tokens* e de APIs do *sandbox*. As *URIs* estarão
disponíveis no Portal.

#### Intervalo para obtenção de access_tokens

O *access_token* é muito eficiente quando utilizado diversas vezes antes de expirar (tempo padrão de 5 minutos), portanto é importante que sua implementação de código preveja obter
novo *access_token* somente quando estiver perto de expiração do *access_token* corrente. Isso evita fluxo desnecessário de autorização e garante mais performance para seu sistema
ou aplicativo.

## Padrões de erros

Essa API retorna códigos de status HTTP para indicar sucesso ou falhas das requisições.

Códigos **2xx** indicam sucesso.

Códigos **4xx** indicam falhas causadas pelas informações enviadas pelo cliente ou pelo estado atual das entidades.

Códigos **5xx** indicam problemas no serviço no lado da API.

As respostas de erro incluem no corpo detalhes do erro e o campo type identifica o tipo de erro.

Abaixo estão listados os tipos de erro que podem ser retornados por quaisquer endpoints listados nessa documentação.

| HTTP Status Code            | Descrição                               | Significado                                                                     | Como proceder                                                                                                                                                                                  |
| --------------------------- | --------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400` Bad Request           | Requisição inválida.                    | Requisição com formato inválido.                                                | Verifique os parâmetros informados e tente novamente.                                                                                                                                          |
| `403` Forbidden             | Não autorizado.                         | Requisição de participante autenticado que viola alguma regra de autorização.   | Verifique se os parâmetros de acesso estão válidos (certificado, expiração de token, configuração da credencial, secret ou JWT). Se o problema persistir, entre em contato com o suporte Itaú. |
| `404` Not Found             | Entidade não encontrada.                | Recurso solicitado não foi encontrado.                                          | Verifique se os parâmetros informados estão corretos.                                                                                                                                          |
| `422` Unprocessable Entity  | Erro semântico.                         | Solicitação não pode ser processada por violar regras de negócio.               | Verifique mensagem do erro retornado, efetue o ajuste na requisição e solicite novamente o serviço.                                                                                            |
| `500` Internal Server Error | Erro Inesperado.                        | Condição inesperada ao processar requisição.                                    | Entre em contato com o suporte Itaú.                                                                                                                                                           |
| `503` Service Unavailable   | Serviço não está disponível no momento. | Serviço solicitado pode estar em manutenção ou fora da janela de funcionamento. | Se não programado, entre em contato com o suporte Itaú.                                                                                                                                        |
| `504` Gateway Timeout       | Tempo esgotado.                         | Indica que o serviço demorou além do esperado para retornar.                    | Entre em contato com o suporte Itaú.                                                                                                                                                           |

### Padronização de Resposta

Há um padrão de retorno para todos os erros na API. Esse padrão segue uma estrutura específica, podendo apenas variar os valores existentes nos campos.

No exemplo a seguir, o campo *data_pagamento* não foi enviado no Body da requisição.

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação",
  "campos": [
    {
      "campo": "data_pagamento",
      "mensagem": " Inclusão de pagamento não efetuada. O campo “data_pagamento” deve conter uma data válida, no formato yyyy-MM-dd",
      "valor": " "
    }
  ]
}
```

### Parâmetros comuns de cabeçalho

Para consumo das APIs do Itaú, alguns parâmetros de cabeçalho são necessários:

#### x-itau-apikey

O x-itau-apikey é um parâmetro que será requerido em todas as chamadas das APIs do Itaú.
A informação que deve ser usada nesse campo é o client_id.

#### x-itau-flowID

A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação.

Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API
estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa
informação no log.

Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. Recomenda-se mandar um uuid version 4 nesse campo como: b47ec51b-b2a7-4a78-933c-f0b67667e7dc.

#### x-itau-correlationID

A implementação de um correlationID permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes, conseguindo fornecer um mapeamento de ponta-a-ponta.

Por exemplo, uma aplicação client gera uma chamada à API, neste momento fornecendo o correlationID gerado pelo consumidor, o qual é repassado em todas as camadas/microserviços que
a api precisa para realizar determinada funcionalidade.

É importante lembrar que o header x-itau-correlationID deve sempre ser diferente a cada requisição. Recomenda-se mandar um uuid version 4 nesse campo como:
a1e64241-7fdb-4d05-a7f6-c44febcdd8d9.

#### Authorization

Seguindo o padrão OAuth 2.0, esse cabeçalho contém o token de acesso que identifica o chamador (access_token).
Com essa informação será realizada a identificação e autorização aos recursos das APIs.

#### idempotency-key

A implementação do idempotency-key permite garantir que uma mesma requisição de pagamento não seja processada mais de uma vez, evitando duplicidades em caso de falhas de rede ou retentativas.

O valor deve ser uma chave única por pagamento, gerada pela aplicação consumidora, com até **255 caracteres ASCII printáveis**. Recomenda-se utilizar um UUID version 4 como: `c9b7e3f1-5a2d-4e8b-9f0c-1d2e3f4a5b6c`.

Quando informada, a API valida a unicidade da chave: se uma requisição com a mesma `idempotency-key` já estiver em processamento, a API retornará erro indicando que a inclusão do pagamento está em progresso para aquela chave de idempotência.

Este cabeçalho é **opcional** e utilizado apenas em requisições POST de inclusão de pagamento.

#### Exemplo de POST:

* Authorization: Bearer [access_token obtido na chamada ao autorizador]
* x-itau-flowID: [GUID gerado pela aplicação para identificar o processo de negócio]
* x-itau-correlationID: [GUID gerado pela aplicação para identificar unicamente a execução da API]
* x-itau-apikey: [client_id fornecido pelo agente comercial]
* idempotency-key: [chave única por pagamento, até 255 caracteres ASCII printáveis — opcional]

## Incluir Pix

Os itens a seguir detalham as funcionalidades disponibilizadas nas APIs do Itaú para a inclusão de Pix.

## Incluir Pix Transferência (POST)

### [POST] /transferencias

API responsável por inserir um pagamento Pix na plataforma SISPAG do Banco Itaú.

Para essa forma de pagamento, é obrigatório o envio de **no mínimo**: 
- dados para identificacao do favorecido
- valor_pagamento
- data_pagamento
- pagador:
  - tipo_conta
  - agencia
  - conta
  - tipo_pessoa
  - documento
  - modulo_sispag

#### Pix Transferência por Dados ou por Chave

Para inclusão de Transferência via Dados da Conta do Favorecido, **obrigatório** informar:
- ispb
- tipo_identificacao_conta
- agencia_recebedor
- conta_recebedor
- tipo_de_identificacao_do_recebedor
- identificacao_recebedor

Para inclusão de Transferência via Chave, **obrigatório** informar:
- chave

Quando a chave informada todas as outras informações do recebedor são **opcionais**, caso sejam enviadas, os campos (ispb, agencia, conta e documento) serão **validados** contra os dados cadastrados para
chave na DICT.

### Parâmetros de entrada

| **Parâmetro**                      | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho**        | **Presença**    | **Descrição**                                                                                                                                                                                                                   |
| ---------------------------------- | --------------------- | ---------------- | ------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| valor_pagamento                    | body                  | decimal          | (17,2)             | **obrigatório** | Valor a ser pago.                                                                                                                                                                                                               |
| data_pagamento                     | body                  | string           | 10                 | **obrigatório** | Data do pagamento, formato yyyy-MM-dd                                                                                                                                                                                           |
| chave                              | body                  | string           | 76                 | opcional        | Chave do recebedor. (CNPJ, Telefone, E-Mail ou Chave Aleatória) **Exemplos:** CNPJ: 12345678000112 Telefone: +5561912345678 E-mail: funcionario_itau@itau-unibanco.com.br Chave Aleatória: 123e4567-e12b-12d1-a456-426655440000 |
| ispb                               | body                  | string           | 8                  | opcional        | Ispb do recebedor.                                                                                                                                                                                                              |
| tipo_identificacao_conta           | body                  | string           | 2                  | opcional        | Tipo de conta do recebedor. "CC": Conta Corrente "CP": Conta Pagamento "PP": Conta Poupança                                                                                                                                     |
| agencia_recebedor                  | body                  | string           | 4                  | opcional        | Agência do recebedor.                                                                                                                                                                                                           |
| conta_recebedor                    | body                  | string           | 20                 | opcional        | Conta do recebedor + Digito Verificador.                                                                                                                                                                                        |
| tipo_de_identificacao_do_recebedor | body                  | string           | 1                  | opcional        | Tipo de pessoa do recebedor "F" - Fisica "J" - Jurídica                                                                                                                                                                         |
| identificacao_recebedor            | body                  | string           | 14 - CNPJ 11 - CPF | opcional        | Documento do recebedor (CPF ou CNPJ)                                                                                                                                                                                            |
| informacoes_entre_usuarios         | body                  | string           | 140                | opcional        | Informações entre usuários a ser trafegada no pagamento.                                                                                                                                                                        |
| referencia_empresa                 | body                  | string           | 20                 | opcional        | Texto livre de referência da empresa sobre o pagamento.                                                                                                                                                                         |
| identificacao_comprovante          | body                  | string           | 100                | opcional        | Texto livre para identificação do comprovante da empresa sobre o pagamento.                                                                                                                                                     |
| txid                               | body                  | string           | 35                 | opcional        | Identificador do PIX.                                                                                                                                                                                                           |
| **pagador**                        | body                  | object           | -                  | **obrigatório** | Objeto: Detalhe Pagador.                                                                                                                                                                                                        |
| **pagador**.tipo_conta             | body                  | string           | 2                  | **obrigatório** | Tipo de conta do pagador. "CC": Conta Corrente "CP": Conta Pagamento "PP": Conta Poupança                                                                                                                                       |
| **pagador**.agencia                | body                  | string           | 4                  | **obrigatório** | Agência do pagador                                                                                                                                                                                                              |
| **pagador**.conta                  | body                  | string           | 8                  | **obrigatório** | Conta do pagador + Digito Verificador                                                                                                                                                                                           |
| **pagador**.tipo_pessoa            | body                  | string           | 1                  | **obrigatório** | Tipo de pessoa do pagador "F" - Fisica "J" - Jurídica                                                                                                                                                                           |
| **pagador**.documento              | body                  | string           | 14 - CNPJ 11 - CPF | **obrigatório** | Documento do pagador (CPF ou CNPJ)                                                                                                                                                                                              |
| **pagador**.modulo_sispag          | body                  | string           | 13                 | **obrigatório** | Módulo SISPAG utilizado para o pagamento. Dominio: Fornecedores                                                                                                                                                                 |

### Exemplo de entrada

Exemplo de inclusão por dados bancários (Pix Dados)

```json
{
  "valor_pagamento": "123.40",
  "data_pagamento": "2020-07-13",
  "ispb": "60701190",
  "tipo_identificacao_conta": "CC",
  "agencia_recebedor": "1500",
  "conta_recebedor": "00052012",
  "tipo_de_identificacao_do_recebedor": "F",
  "identificacao_recebedor": "61389299260",
  "informacoes_entre_usuarios": "transferencia para o João - referente a manutencao",
  "referencia_empresa": "154785966666666",
  "identificacao_comprovante": "transferencia para o João - referente a manutencao",
  "txid": "bqJJjaVAThmtnUeVLNnSXQ",
  "pagador": {
    "tipo_conta": "CC",
    "agencia": "1500",
    "conta": "00800550",
    "tipo_pessoa": "J",
    "documento": "06830622000123",
    "modulo_sispag": "Fornecedores"
  }
}
```

Exemplo de inclusão por chave (Pix Chave)

```json
{
  "valor_pagamento": "123.40",
  "data_pagamento": "2020-07-13",
  "chave": "funcionario@itau-unibanco.com.br",
  "informacoes_entre_usuarios": "transferencia para o João - referente a manutencao",
  "referencia_empresa": "154785966666666",
  "identificacao_comprovante": "transferencia para o João - referente a manutencao",
  "pagador": {
    "tipo_conta": "CC",
    "agencia": "1500",
    "conta": "00800550",
    "tipo_pessoa": "J",
    "documento": "06830622000123",
    "modulo_sispag": "Fornecedores"
  }
}
```

### Parâmetros de saída

| **Parâmetro**                     | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho**        | **Presença**    | **Descrição**                                                                               |
| --------------------------------- | --------------------- | ---------------- | ------------------ | --------------- | ------------------------------------------------------------------------------------------- |
| status_pagamento                  | body                  | string           | 40                 | **obrigatório** | Status do pagamento. Domínio: Sucesso, Sucesso (pre-autorizado), Rejeitado, Nao incluido    |
| cod_pagamento                     | body                  | string           | 36                 | **obrigatório** | Identificação do pagamento.                                                                 |
| numero_lote                       | body                  | string           | int32              | **obrigatório** | Número de lote SISPAG.                                                                      |
| numero_lancamento                 | body                  | string           | int32              | **obrigatório** | Número do lançamento SISPAG.                                                                |
| tipo_pagamento                    | body                  | string           | 27                 | **obrigatório** | Tipo da transferência. Domínio: PIX ou QRCODE                                               |
| data_pagamento                    | body                  | string           | 19                 | **obrigatório** | Data em que será realizado o pagamento. Formato “YYYY-MM-DDTHH:MM:SS”.                      |
| valor_pagamento                   | body                  | decimal          | (17,2)             | **obrigatório** | Valor do pagamento.                                                                         |
| referencia_empresa                | body                  | string           | 20                 | opcional        | Texto livre de referência da empresa sobre o pagamento.                                     |
| identificacao_comprovante         | body                  | string           | 100                | opcional        | Texto livre de para identificação do comprovante da empresa sobre o pagamento.              |
| informacoes_entre_usuarios        | body                  | string           | 140                | opcional        | Mensagem enviada do pagador ao recebedor (140 posições).                                    |
| txid                              | body                  | string           | -                  | opcional        | Identificador do PIX.                                                                       |
| **pagador**                       | body                  | object           | -                  | **obrigatório** | Objeto: Detalhe Pagador.                                                                    |
| **pagador**.tipo_conta            | body                  | string           | 2                  | **obrigatório** | Tipo de conta do pagador. "CC": Conta Corrente "CP": Conta Pagamento "PP": Conta Poupança   |
| **pagador**.agencia               | body                  | string           | 4                  | **obrigatório** | Agência do pagador                                                                          |
| **pagador**.conta                 | body                  | string           | 8                  | **obrigatório** | Conta do pagador + Digito Verificador                                                       |
| **pagador**.tipo_pessoa           | body                  | string           | 1                  | **obrigatório** | Tipo de pessoa do pagador "F" - Fisica "J" - Jurídica                                       |
| **pagador**.documento             | body                  | string           | 14 - CNPJ 11 - CPF | **obrigatório** | Documento do pagador (CPF ou CNPJ)                                                          |
| **pagador**.modulo_sispag         | body                  | string           | 13                 | **obrigatório** | Módulo SISPAG utilizado para o pagamento. Dominio: Fornecedores ou Diversos                 |
| **recebedor**                     | body                  | object           | -                  | **obrigatório** | Objeto: Detalhe Recebedor.                                                                  |
| **recebedor**.banco               | body                  | string           | -                  | **opcional**        | Nome do banco do recebedor                                                                  |
| **recebedor**.ispb                | body                  | string           | 8                  | **opcional** | ISPB do banco do recebedor                                                                  |
| **recebedor**.tipo_conta          | body                  | string           | 2                  | **opcional** | Tipo de conta do recebedor. "CC": Conta Corrente "CP": Conta Pagamento "PP": Conta Poupança |
| **recebedor**.agencia             | body                  | string           | 4                  | **opcional** | Agência do recebedor                                                                        |
| **recebedor**.conta               | body                  | string           | 20                 | **opcional** | Conta do recebedor + Digito Verificador                                                     |
| **recebedor**.tipo_pessoa         | body                  | string           | 1                  | **opcional** | Tipo de pessoa do recebedor "F" - Fisica "J" - Jurídica                                     |
| **recebedor**.documento           | body                  | string           | 14 - CNPJ 11 - CPF | **obrigatório** | Documento do recebedor (CPF ou CNPJ)                                                        |
| **recebedor**.nome                | body                  | string           | 30                 | **obrigatório** | Nome do favorecido                                                                          |
| **recebedor**.identificacao_chave | body                  | string           | 76                 | **opcional**       | Identificação da chave utilizada pelo favorecido                                            |
| **motivo_recusa**                 | body                  | list-object       | -                  | opcional        | Presente apenas quando o pagamento é rejeitado por regra de negócio (HTTP 422). Lista de motivos de recusa. |
| **motivo_recusa**.codigo          | body                  | string           | -                  | opcional        | Código do motivo de recusa.                                                                 |
| **motivo_recusa**.nome            | body                  | string           | -                  | opcional        | Descrição do motivo de recusa.                                                              |

### Exemplo de saída

(status = 200, application/json)
```json
{
  "status_pagamento": "Sucesso",
  "cod_pagamento": "916BD0D6-CDC9-41E8-B2A5-19FF6BC0F823",
  "numero_lote": "199000019",
  "numero_lancamento": "13",
  "tipo_pagamento": "Transferência Pix Itaú",
  "data_pagamento": "2016-10-11",
  "valor_pagamento": "1260.00",
  "referencia_empresa": "154785966666666",
  "identificacao_comprovante": "transferencia para o João - referente a manutencao",
  "informacoes_entre_usuarios": "transferencia para o João - referente a manutencao",
  "txid": "bqJJjaVAThmtnUeVLNnSXQ",
  "pagador": {
    "tipo_conta": "CC",
    "agencia": "1500",
    "conta": "00800550",
    "tipo_pessoa": "J",
    "documento": "06830622000123",
    "modulo_sispag": "Fornecedores"
  },
  "recebedor": {
    "banco": "Itaú Unibanco",
    "documento": "61389299260",
    "nome": "Maria PIX",
    "identificacao_chave": "maria_pix@gmail.com"
  }
}
```

Quando a requisição é aceita pela API mas o pagamento **não pode ser efetivado** por violar alguma regra de negócio, a API retorna **HTTP 422**. Existem **três formatos possíveis** de resposta 422 (detalhados na seção "Formatos de resposta de erro (POST)" abaixo). Os dois exemplos a seguir ilustram os formatos mais comuns.

#### Rejeição por exceção de negócio — formato compacto

Algumas validações interrompem imediatamente o processamento e retornam o erro no formato compacto `{codigo, mensagem}`, sem retornar o corpo completo do pagamento. Exemplos: conta salário (931), tipo de conta divergente (932), chave não encontrada (916), documento recebedor inválido (926).

(status = 422, application/json)
```json
{
  "codigo": "931",
  "mensagem": "A conta favorecida informada é do tipo salário e não pode receber transferências Pix. Utilize outra conta e tente novamente."
}
```

#### Rejeição acumulada — formato com payload completo

Outras validações não interrompem o fluxo; os motivos de recusa são acumulados e devolvidos dentro do corpo do pagamento, no campo `motivo_recusa`, no lugar dos campos `numero_lote` e `numero_lancamento`. Exemplos: agência/conta do favorecido inválida (852/218), limite diário excedido (911), QR Code expirado (913), pagamento duplicado (850).

(status = 422, application/json)
```json
{
  "status_pagamento": "Rejeitado",
  "cod_pagamento": "916BD0D6-CDC9-41E8-B2A5-19FF6BC0F823",
  "tipo_pagamento": "Transferência Pix Itaú",
  "data_pagamento": "2016-10-11",
  "valor_pagamento": "1260.00",
  "referencia_empresa": "154785966666666",
  "identificacao_comprovante": "transferencia para o João - referente a manutencao",
  "informacoes_entre_usuarios": "transferencia para o João - referente a manutencao",
  "pagador": {
    "tipo_conta": "CC",
    "agencia": "1500",
    "conta": "00800550",
    "tipo_pessoa": "J",
    "documento": "06830622000123",
    "modulo_sispag": "Fornecedores"
  },
  "recebedor": {
    "banco": "Itaú Unibanco",
    "documento": "61389299260",
    "nome": "Maria PIX",
    "identificacao_chave": "maria_pix@gmail.com"
  },
  "motivo_recusa": [
    {
      "codigo": "852",
      "nome": "Agencia do favorecido invalida"
    }
  ]
}
```

Os códigos possíveis e seus respectivos formatos de resposta estão listados na seção "Códigos de rejeição (POST)".

## Incluir QR Code

Os itens a seguir detalham as funcionalidades disponibilizadas nas APIs do Itaú para a inclusão de QR Code.

## Incluir Pix QR Code (POST)

### [POST] /transferencias

API responsável por inserir um pagamento QR Code na plataforma SISPAG do Banco Itaú.

Para essa forma de pagamento, é obrigatório o envio de **no mínimo**:
- uma identificação do QR Code (pix_link, emv ou url)
- valor
- data_pagamento
- pagador:
  - tipo_conta
  - agencia
  - conta
  - tipo_pessoa
  - documento
  - modulo_sispag

Todas as outras informações são **opcionais**, e caso sejam enviadas, será validada com o QR Code decodificado.

### Parâmetros de entrada

| **Parâmetro**                      | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho**        | **Presença**    | **Descrição**                                                                                                                                                                                                                   |
| ---------------------------------- | --------------------- | ---------------- | ------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pix_link                           | body                  | string           | 77                 | opcional        | Link do QR Code. Essa informação pode ser encontrada na decodificação do QR Code.                                                                                                                                               |
| emv                                | body                  | string           | 1800               | opcional        | EMV do QR Code. Padrão EMV utilizado na geração da imagem do QR Code.                                                                                                                                                           |
| url                                | body                  | string           | 77                 | opcional        | URL do QR Code. Essa informação pode ser encontrada na leitura do QR Code ou no Pix link.                                                                                                                                       |
| txid                               | body                  | string           | -                  | opcional        | Identificador do PIX.                                                                                                                                                                                                           |
| valor_pagamento                    | body                  | string           | (17,2)             | **obrigatório** | Valor a ser pago.                                                                                                                                                                                                               |
| data_pagamento                     | body                  | string           | 10                 | **obrigatório** | Data do pagamento, formato yyyy-MM-dd                                                                                                                                                                                           |
| chave                              | body                  | string           | 76                 | opcional        | Chave do recebedor. (CNPJ, Telefone, E-Mail ou Chave Aleatória) **Exemplos:** CNPJ: 12345678000112 Telefone: +5561912345678 E-mail: funcionario_itau@itau-unibanco.com.br Chave Aleatória: 123e4567-e12b-12d1-a456-426655440000 |
| ispb                               | body                  | string           | 8                  | opcional        | ISPB do recebedor.                                                                                                                                                                                                              |
| agencia_recebedor                  | body                  | string           | 4                  | opcional        | Agência do recebedor.                                                                                                                                                                                                           |
| conta_recebedor                    | body                  | string           | 20                 | opcional        | Conta do recebedor + Digito verificador.                                                                                                                                                                                        |
| tipo_de_identificacao_do_recebedor | body                  | string           | 1                  | opcional        | Identificação do recebedor "F" - Fisica "J" - Jurídica                                                                                                                                                                          |
| identificacao_recebedor            | body                  | string           | 14 - CNPJ 11 - CPF | opcional        | CPF ou CNPJ do recebedor                                                                                                                                                                                                        |
| informacoes_entre_usuarios         | body                  | string           | 140                | opcional        | Mensagem enviada do pagador ao recebedor.                                                                                                                                                                                       |
| referencia_empresa                 | body                  | string           | 20                 | opcional        | Texto livre de referência da empresa sobre o pagamento.                                                                                                                                                                         |
| identificacao_comprovante          | body                  | string           | 100                | opcional        | Texto livre de para identificação do comprovante da empresa sobre o pagamento.                                                                                                                                                  |
| **pagador**                        | body                  | object           | -                  | **obrigatório** | Objeto: Detalhe Pagador.                                                                                                                                                                                                        |
| **pagador**.tipo_conta             | body                  | string           | 2                  | **obrigatório** | Tipo de conta do pagador. "CC": Conta Corrente "CP": Conta Pagamento "PP": Conta Poupança                                                                                                                                       |
| **pagador**.agencia                | body                  | string           | 4                  | **obrigatório** | Agência do pagador                                                                                                                                                                                                              |
| **pagador**.conta                  | body                  | string           | 8                  | **obrigatório** | Conta do pagador + Digito Verificador                                                                                                                                                                                           |
| **pagador**.tipo_pessoa            | body                  | string           | 1                  | **obrigatório** | Tipo de pessoa do pagador "F" - Fisica "J" - Jurídica                                                                                                                                                                           |
| **pagador**.documento              | body                  | string           | 14 - CNPJ 11 - CPF | **obrigatório** | Documento do pagador (CPF ou CNPJ)                                                                                                                                                                                              |
| **pagador**.modulo_sispag          | body                  | string           | 13                 | **obrigatório** | Módulo SISPAG utilizado para o pagamento. Dominio: Fornecedores                                                                                                                                                                 |

### Exemplo de entrada

Exemplo de inclusão com emv

```json
{
  "emv": "00020101021126950014BR.GOV.BCB.PIX2573spi.dev.cloud.itau.com.br/documentos/eb189f7a-1536-4f16-8951-1056a773685052040000530398654079999.005802BR5925ITAU PORTABILIDADE REIVIN6009SAO PAULO626005221Y4XMrEBhry4ao3no56nrC50300017BR.GOV.BCB.BRCODE01051.0.063046A8D",
  "valor_pagamento": "100.00",
  "data_pagamento": "2020-09-18",
  "pagador": {
    "tipo_conta": "CC",
    "agencia": "1500",
    "conta": "00052012",
    "tipo_pessoa": "J",
    "documento": "00000000000191",
    "modulo_sispag": "Fornecedores"
  }
}
```

### Parâmetros de saída

| **Parâmetro**                     | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho**        | **Presença**    | **Descrição**                                                                               |
| --------------------------------- | --------------------- | ---------------- | ------------------ | --------------- | ------------------------------------------------------------------------------------------- |
| status_pagamento                  | body                  | string           | 40                 | **obrigatório** | Status do pagamento                                                                         |
| cod_pagamento                     | body                  | string           | 36                 | **obrigatório** | Identificação do pagamento.                                                                 |
| numero_lote                       | body                  | string           | int32              | **obrigatório** | Número de lote SISPAG.                                                                      |
| numero_lancamento                 | body                  | string           | int32              | **obrigatório** | Número do lançamento SISPAG.                                                                |
| tipo_pagamento                    | body                  | string           | 27                 | **obrigatório** | Tipo da transferência.                                                                      |
| data_pagamento                    | body                  | string           | 19                 | **obrigatório** | Data em que será realizado o pagamento. Formato “YYYY-MM-DDTHH:MM:SS”.                      |
| valor_pagamento                   | body                  | decimal          | (17,2)             | **obrigatório** | Valor do pagamento.                                                                         |
| referencia_empresa                | body                  | string           | 20                 | **obrigatório** | Texto livre de referência da empresa sobre o pagamento.                                     |
| identificacao_comprovante         | body                  | string           | 100                | **obrigatório** | Texto livre de para identificação do comprovante da empresa sobre o pagamento.              |
| informacoes_entre_usuarios        | body                  | string           | 140                | **obrigatório** | Mensagem a ser enviado ao pagador via PACS008.                                              |
| txid                              | body                  | string           | -                  | opcional        | Identificador do PIX.                                                                       |
| **pagador**                       | body                  | object           | -                  | **obrigatório** | Objeto: Detalhe Pagador.                                                                    |
| **pagador**.tipo_conta            | body                  | string           | 2                  | **obrigatório** | Tipo de conta do pagador. "CC": Conta Corrente "CP": Conta Pagamento "PP": Conta Poupança   |
| **pagador**.agencia               | body                  | string           | 4                  | **obrigatório** | Agência do pagador                                                                          |
| **pagador**.conta                 | body                  | string           | 8                  | **obrigatório** | Conta do pagador + Digito Verificador                                                       |
| **pagador**.tipo_pessoa           | body                  | string           | 1                  | **obrigatório** | Tipo de pessoa do pagador "F" - Fisica "J" - Jurídica                                       |
| **pagador**.documento             | body                  | string           | 14 - CNPJ 11 - CPF | **obrigatório** | Documento do pagador (CPF ou CNPJ)                                                          |
| **pagador**.modulo_sispag         | body                  | string           | 13                 | **obrigatório** | Módulo SISPAG utilizado para o pagamento. Dominio: Fornecedores                             |
| **recebedor**                     | body                  | object           | -                  | **obrigatório** | Objeto: Detalhe Recebedor.                                                                  |
| **recebedor**.banco               | body                  | string           | -                  | opcional        | Nome do banco do recebedor                                                                  |
| **recebedor**.ispb                | body                  | string           | 8                  | **opcional** | ISPB do banco do recebedor                                                                  |
| **recebedor**.tipo_conta          | body                  | string           | 2                  | **opcional** | Tipo de conta do recebedor. "CC": Conta Corrente "CP": Conta Pagamento "PP": Conta Poupança |
| **recebedor**.agencia             | body                  | string           | 4                  | **opcional** | Agência do recebedor                                                                        |
| **recebedor**.conta               | body                  | string           | 20                 | **opcional** | Conta do recebedor + Digito Verificador                                                     |
| **recebedor**.tipo_pessoa         | body                  | string           | 1                  | **opcional** | Tipo de pessoa do recebedor "F" - Fisica "J" - Jurídica                                     |
| **recebedor**.documento           | body                  | string           | 14 - CNPJ 11 - CPF | **obrigatório** | Documento do recebedor (CPF ou CNPJ)                                                        |
| **recebedor**.nome                | body                  | string           | 30                 | **obrigatório** | Nome do favorecido                                                                          |
| **recebedor**.identificacao_chave | body                  | string           | 76                 | opcional        | Identificação da chave utilizada pelo favorecido                                            |
| **motivo_recusa**                 | body                  | list-object       | -                  | opcional        | Presente apenas quando o pagamento é rejeitado por regra de negócio (HTTP 422). Lista de motivos de recusa. |
| **motivo_recusa**.codigo          | body                  | string           | -                  | opcional        | Código do motivo de recusa.                                                                 |
| **motivo_recusa**.nome            | body                  | string           | -                  | opcional        | Descrição do motivo de recusa.                                                              |

### Exemplo de saída

(status = 200, application/json)
```json
{
  "status_pagamento": "Sucesso",
  "cod_pagamento": "93577df4-6f43-4e49-bdff-eb8b053fb931",
  "numero_lote": "291000001",
  "numero_lancamento": "000019",
  "tipo_pagamento": "Transferência Pix Itaú",
  "data_pagamento": "2020-08-28",
  "valor_pagamento": "100.00",
  "referencia_empresa": "Prestação de serviços - Empresa A",
  "identificacao_comprovante": "Pagamentos - Empresa A",
  "informacoes_entre_usuarios": "Serviço prestado pela Empresa A",
  "txid": "bqJJjaVAThmtnUeVLNnSXQ",
  "pagador": {
    "tipo_conta": "CC",
    "agencia": "1500",
    "conta": "00052012",
    "tipo_pessoa": "J",
    "documento": "00000000000191",
    "modulo_sispag": "Fornecedores"
  },
  "recebedor": {
    "banco": "Itaú Unibanco",
    "documento": "00000000019",
    "nome": "Maria PIX",
    "tipo_chave": "email",
    "identificacao_chave": "maria_pix@gmail.com"
  }
}
```

Quando a requisição é aceita pela API mas o pagamento **não pode ser efetivado** por violar alguma regra de negócio, a API retorna **HTTP 422**. O formato da resposta depende do tipo de validação que falhou (ver seção "Formatos de resposta de erro (POST)" abaixo). O exemplo a seguir ilustra o formato com payload completo (rejeição acumulada):

(status = 422, application/json)
```json
{
  "status_pagamento": "Rejeitado",
  "cod_pagamento": "93577df4-6f43-4e49-bdff-eb8b053fb931",
  "tipo_pagamento": "Transferência Pix Itaú",
  "data_pagamento": "2020-08-28",
  "valor_pagamento": "100.00",
  "referencia_empresa": "Prestação de serviços - Empresa A",
  "identificacao_comprovante": "Pagamentos - Empresa A",
  "informacoes_entre_usuarios": "Serviço prestado pela Empresa A",
  "pagador": {
    "tipo_conta": "CC",
    "agencia": "1500",
    "conta": "00052012",
    "tipo_pessoa": "J",
    "documento": "00000000000191",
    "modulo_sispag": "Fornecedores"
  },
  "recebedor": {
    "banco": "Itaú Unibanco",
    "documento": "00000000019",
    "nome": "Maria PIX",
    "tipo_chave": "email",
    "identificacao_chave": "maria_pix@gmail.com"
  },
  "motivo_recusa": [
    {
      "codigo": "913",
      "nome": "QR Code Expirado"
    }
  ]
}
```

Os códigos possíveis e seus respectivos formatos de resposta estão listados na seção "Códigos de rejeição (POST)" abaixo.

### Formatos de resposta de erro (POST)

O endpoint POST `/transferencias` pode retornar **HTTP 422** em três formatos distintos, dependendo do tipo de falha:

| # | Formato | Quando ocorre | Estrutura da resposta |
|---|---------|---------------|----------------------|
| 1 | **Erro de validação de campos** | Campo obrigatório ausente, mal formatado ou fora do padrão (ex: `chave` com formato inválido, `data_pagamento` ausente). Validação de entrada (bean validation / fluent validator). | `{"codigo", "mensagem", "campos": [{"campo", "mensagem", "valor"}]}` |
| 2 | **Exceção de negócio (compacto)** | Validação de negócio que interrompe imediatamente o processamento (ex: conta salário, chave não encontrada, documento recebedor inválido). | `{"codigo", "mensagem"}` |
| 3 | **Rejeição acumulada (payload completo)** | Validações de negócio que não interrompem o fluxo; os motivos são acumulados e devolvidos junto com o corpo do pagamento (ex: agência inválida, limite diário excedido, QR Code expirado). | Corpo completo do pagamento com `"motivo_recusa": [{"codigo", "nome"}]` |

**Formato 1** corresponde à "Padronização de Resposta" descrita na seção de informações adicionais.

**Formato 2** retorna apenas `codigo` e `mensagem` — sem o objeto do pagamento.

**Formato 3** retorna o objeto completo do pagamento (com `status_pagamento: "Rejeitado"` e sem `numero_lote`/`numero_lancamento`), incluindo o array `motivo_recusa` que pode conter um ou mais códigos.

A coluna "Formato" na tabela abaixo indica qual formato se aplica a cada código de rejeição.

### Códigos de rejeição (POST)

Abaixo os principais códigos de rejeição que podem ocorrer ao utilizar o método POST:

| **Código** | **Mensagem**                                                                                                                        | **Formato** |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| 018        | Tipo de pagamento invalido                                                                                                            | 3           |
| 901        | Tipo de conta indevida                                                                                                                | 3           |
| 515        | VALOR DO PAGAMENTO INVALIDO                                                                                                           | 3           |
| 580        | Data pagamento - repasse invalido                                                                                                     | 3           |
| 547        | Data de agendamento invalida                                                                                                          | 3           |
| 913        | QR Code Expirado                                                                                                                       | 3           |
| 902        | Agencia do pagador invalida                                                                                                           | 3           |
| 903        | Conta do pagador invalida                                                                                                             | 3           |
| 852        | Agencia do favorecido invalida                                                                                                        | 3           |
| 218        | AGE/CTA FAVORECIDO INVALIDA                                                                                                           | 3           |
| 909        | Documento pagador invalido                                                                                                            | 3           |
| 466        | Nome pagador invalido                                                                                                                 | 3           |
| 910        | Documento favorecido invalido                                                                                                         | 3           |
| 81         | Codigo do banco invalido                                                                                                              | 3           |
| 916        | Chave não encontrada                                                                                                                  | 2           |
| 906        | Identificação do QR CODE inválido                                                                                                     | 3           |
| 907        | Erro ao validar QR CODE                                                                                                               | 3           |
| 908        | Valor do pagamento divergente do valor do qrcode.                                                                                     | 2           |
| 929        | De acordo com o Banco Central, você excedeu o número de operações com chave Pix. Aguarde alguns minutos ou utilize agência e conta.   | 2           |
| 172        | Canal inválido para realizar um Pix Saque/Troco                                                                                       | 3           |
| 931        | A conta favorecida informada é do tipo salário e não pode receber transferências Pix. Utilize outra conta e tente novamente.          | 2           |
| 932        | Tipo de conta do favorecido incorreto. Confirme com o beneficiário o tipo correto da conta e tente novamente.                         | 2           |
| 905        | CNPJ PAGADOR NÃO CADASTRADO NO SISPAG                                                                                                 | 3           |
| 99         | Erro de processamento                                                                                                                 | 3           |
| 889        | CPF/CNPJ do recebedor não é o mesmo da conta transacional informada. Revise os dados e envie novamente                                | 3           |
| 627        | Conta recebedor pode conter apenas números, caso a conta possua letras, digite 0 no lugar                                             | 3           |
| 926        | O documento do recebedor é inválido, por favor revise e tente novamente.                                                              | 2           |
| 927        | Erro interno na API de instituicao financeira                                                                                         | 3           |
| 928        | Erro de conexão com a API de instituicao financeira. Tente novamente                                                                  | 3           |
| 154        | Identificador canal inválido                                                                                                          | 3           |
| 151        | Dados OPEN FINANCE não informados                                                                                                     | 3           |
| 147        | Id Open Banking não informado                                                                                                         | 3           |
| 155        | Id Open banking fora do formato esperado (UUID)                                                                                       | 3           |
| 148        | Nome iniciador não informado                                                                                                          | 3           |
| 149        | Id iniciador não informado                                                                                                            | 3           |
| 150        | Id EQ3 não informado                                                                                                                  | 3           |
| 153        | Id eq3 fora do formato esperado (UUID)                                                                                                | 3           |
| 156        | Id Conciliação iniciador com tamanho inválido                                                                                         | 3           |
| 170        | Id Cidade Cliente Iniciador com tamanho inválido                                                                                      | 3           |
| 171        | Id Cidade Cliente Iniciador utilizado apenas para Pix QRCode                                                                          | 3           |
| 157        | Tipo de pagamento Saque ou Troco inexistente                                                                                          | 3           |
| 158        | Valor do Saque não pode ser nulo                                                                                                      | 3           |
| 159        | Valor da Compra não pode ser nulo                                                                                                     | 3           |
| 160        | Valor do Troco não pode ser nulo                                                                                                      | 3           |
| 161        | O valor do Saque não pode ser diferente do valor do Pagamento                                                                         | 3           |
| 162        | A soma do valor da Compra com o valor do Troco não pode ser diferente do valor do Pagamento                                           | 3           |
| 163        | Modalidade do Agente nulo ou inválido                                                                                                 | 3           |
| 164        | ISPB do Prestador não pode ser nulo                                                                                                   | 3           |
| 165        | O valor para realizar um Pix Saque/Troco neste horário está acima do limite permitido de 500.00                                       | 3           |
| 166        | O valor para realizar um Pix Saque/Troco neste horário está acima do limite permitido de 100.00                                       | 3           |
| 167        | A data do Pagamento deve ser igual a data atual                                                                                       | 3           |
| 168        | A data do Vencimento deve ser maior ou igual a data atual                                                                             | 3           |
| 169        | Valor da Compra não pode ser menor ou igual a 0.00                                                                                    | 3           |
| 850        | Pagamento em duplicidade                                                                                                              | 3           |
| 481        | DATA DE CREDITO MAIOR QUE 1 ANO                                                                                                       | 3           |
| 041        | Data de credito maior que 1 ano                                                                                                       | 3           |
| 911        | Limite diario de pagamento excedido                                                                                                   | 3           |
| 914        | Erro ao gerar numero de lote.                                                                                                         | 3           |

## Consultas

Os itens a seguir detalham as funcionalidades disponibilizadas nas APIs do Itaú para as consultas de todas as formas de pagamento.

## Consulta de Pagamentos (GET)

### [GET] /pagamentos_sispag

API responsável por resgatar pagamentos SISPAG. Trará uma lista de pagamentos que atende aos filtros passados para API.

### Parâmetros de entrada

| **Parâmetro**           | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho**        | **Presença**    | **Descrição**                                                                                                                                |
| ----------------------- | --------------------- | ---------------- | ------------------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| agencia_operacao        | query parameter       | string           | 4                  | **obrigatório** | Agência do pagador                                                                                                                           |
| conta_operacao          | query parameter       | string           | 8                  | **obrigatório** | Conta do pagador + Digito Verificador                                                                                                        |
| cnpj_empresa            | query parameter       | string           | 14 - CNPJ 11 - CPF | **obrigatório** | Documento do pagador (CPF ou CNPJ)                                                                                                           |
| numero_lote             | query parameter       | string           | int32              | opcional        | Número do lote de pagamento                                                                                                                  |
| nome_beneficiario       | query parameter       | string           | 30                 | opcional        | Nome do recebedor                                                                                                                            |
| status                  | query parameter       | string           | 40                 | opcional        | Filtro do código do tipo do status. Dominios: "AE" - A Efetuar "EF" - Efetuado "NE" - Não Efetuado "TD" - Todos (default)                    |
| data_inicial            | query parameter       | Date-only        | 10                 | opcional        | Data do pagamento inicial para consulta (yyyy-MM-dd)                                                                                         |
| data_final              | query parameter       | Date-only        | 10                 | opcional        | Data do pagamento final para consulta (yyyy-MM-dd)                                                                                           |
| tipo_lista              | query parameter       | string           | 9                  | **obrigatório** | Consolidação da lista de pagamentos retornado. Domínio: 'Detalhada' ou 'Lote'                                                                |
| modalidade_fornecedores | query parameter       | Boolean          | -                  | opcional        | Filtro do tipo de modalidade de pagamento para fornecedores                                                                                  |
| modalidade_imposto      | query parameter       | Boolean          | -                  | opcional        | Filtro do tipo de modalidade de pagamento para impostos e tributos                                                                           |
| modalidade_salario      | query parameter       | Boolean          | -                  | opcional        | Filtro do tipo de modalidade de pagamento para salário                                                                                       |
| tipo_pagamento          | query parameter       | string           | 2                  | opcional        | Filtro do tipo da transação bancária. Inserir o código do pagamento a ser filtrado. (Consultar códigos na tabela "Domínio - Tipo Pagamento") |
| referencia_empresa      | query parameter       | string           | 100                | opcional        | Filtro pela referência da empresa                                                                                                            |
| valor_minimo            | query parameter       | decimal          | (18,2)             | opcional        | Valor mínimo do pagamento da consulta                                                                                                        |
| valor_maximo            | query parameter       | decimal          | (18,2)             | opcional        | Valor máximo do pagamento da consulta                                                                                                        |
| page                    | query parameter       | integer          | int32              | opcional        | Número da pagina a ser retornada                                                                                                             |
| page_size               | query parameter       | integer          | int32              | opcional        | Quantidade de pagamentos retornado por página                                                                                                |

### Exemplo de entrada

```text
/pagamentos_sispag?agencia_operacao=1500&conta_operacao=00062573&cnpj_empresa=60701190000104&modalidade_fornecedores=true&modalidade_impostos=true&tipo_lista=Detalhada&modalidade_salario=false&data_inicial=2020-01-01&data_final=2020-12-31&page=0&page_size=3
```

```text
/pagamentos_sispag?
    agencia_operacao=1500&
    conta_operacao=00062573&
    cnpj_empresa=60701190000104&
    modalidade_fornecedores=true&
    modalidade_impostos=true&
    tipo_lista=Detalhada&
    modalidade_salario=false&
    data_inicial=2020-01-01&
    data_final=2020-12-31&
    page=0&
    page_size=3
```

### Parâmetros de saída

| **Parâmetro**                 | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença**    | **Descrição**                                                     |
| ----------------------------- | --------------------- | ---------------- | ----------- | --------------- | ----------------------------------------------------------------- |
| itens                         | body                  | list-object      | -           | **obrigatório** | Objeto: Pagamento                                                 |
| total                         | body                  | string           | int32       | **obrigatório** | Valor total em reais da somatória de todos os pagamentos listados |
| **pagination**                | body                  | object           | -           | **obrigatório** | Objeto: Paginação                                                 |
| **pagination**.page           | body                  | string           | int32       | **obrigatório** | Número da página atual.                                           |
| **pagination**.total_pages    | body                  | string           | int32       | **obrigatório** | Número total de páginas.                                          |
| **pagination**.total_elements | body                  | string           | int32       | **obrigatório** | Número total de elementos da consulta.                            |
| **pagination**.page_size      | body                  | string           | int32       | **obrigatório** | Número total de páginas da consulta.                              |

#### Objeto — Pagamento

| **Parâmetro**         | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença**    | **Descrição**                                                                                                                                                                          |
| --------------------- | --------------------- | ---------------- | ----------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id_pagamento          | body                  | string           | 36          | **obrigatório** | Número identificador do pagamento.                                                                                                                                                     |
| numero_lote           | body                  | string           | int32       | opcional        | Número identificador do lote de pagamentos.                                                                                                                                            |
| numero_lancamento     | body                  | string           | int32       | opcional        | Número do lançamento do lote de pagamentos.                                                                                                                                            |
| nome_favorecido       | body                  | string           | 100         | opcional        | Nome do favorecido.                                                                                                                                                                    |
| nome_proprietario     | body                  | string           | 30          | opcional        | Nome do proprietario.                                                                                                                                                                  |
| nome_beneficiario     | body                  | string           | 30          | opcional        | Nome do beneficiario.                                                                                                                                                                  |
| cpf_cnpj              | body                  | string           | 14          | opcional        | Número do cpf ou cnpj.                                                                                                                                                                 |
| codigo_banco          | body                  | string           | 8           | opcional        | Identificador Banco.                                                                                                                                                                   |
| numero_agencia        | body                  | string           | 4           | opcional        | Número da agência em operação.                                                                                                                                                         |
| numero_conta          | body                  | string           | 8           | opcional        | Número da conta em operação.                                                                                                                                                           |
| referencia_empresa    | body                  | string           | 100         | opcional        | referencia_empresa.                                                                                                                                                                    |
| data_pagamento        | body                  | date-only        | 10          | **obrigatório** | Data do pagamento. Formato yyyy-MM-dd                                                                                                                                                  |
| data_vencimento       | body                  | date-only        | 10          | opcional        | Data do vencimento. Formato yyyy-MM-dd                                                                                                                                                 |
| data_apuracao         | body                  | date-only        | 10          | opcional        | Data da apuracao. Formato yyyy-MM-dd                                                                                                                                                   |
| data_infracao         | body                  | date-only        | 10          | opcional        | Data da infracao. Formato yyyy-MM-dd                                                                                                                                                   |
| valor_pagamento       | body                  | string           | (18,2)      | **obrigatório** | Valor do pagamento.                                                                                                                                                                    |
| valor_principal       | body                  | string           | (18,2)      | opcional        | Valor principal do documento.                                                                                                                                                          |
| numero_parcela        | body                  | string           | int32       | opcional        | Numero da parcela.                                                                                                                                                                     |
| valor_parcela         | body                  | string           | (18,2)      | opcional        | Valor da parcela.                                                                                                                                                                      |
| status                | body                  | string           | 40          | **obrigatório** | Status do pagamento.   "Pendente de autorização"   "Pendente de efetivacao"    "Autorizado"    "Efetuado"   "Não Efetuado"   "Pendente de alteração/exclusão"   "Rejeitado em arquivo" |
| comprovante           | body                  | string           | 100         | opcional        | Identificacão do comprovante                                                                                                                                                           |
| motivo                | body                  | string           | 50          | opcional        | Motivo de recusa                                                                                                                                                                       |
| tipo_pagamento        | body                  | string           | 2           | opcional        | Tipo do pagamento. Será apresentado a descrição do tipo do pagamento. (Consultar descrições na tabela "Domínio - Tipo Pagamento")                                                      |
| linha_digitavel       | body                  | string           | 48          | opcional        | Código de barras                                                                                                                                                                       |
| atualizacao_monetaria | body                  | string           | (18,2)      | opcional        | Valor de taxas, multa, juros                                                                                                                                                           |
| valor_boleto          | body                  | string           | (18,2)      | opcional        | Valor do boleto                                                                                                                                                                        |
| boleto_seu_numero     | body                  | string           | 20          | opcional        | Código seu numero do boleto                                                                                                                                                            |
| boleto_nosso_numero   | body                  | string           | 8           | opcional        | Código nosso numero do boleto                                                                                                                                                          |
| numero_cheque         | body                  | string           | int32       | opcional        | Número do cheque                                                                                                                                                                       |
| numero_op             | body                  | string           | int32       | opcional        | Número do cheque                                                                                                                                                                       |
| periodo_competencia   | body                  | string           | 7           | opcional        | Período de competencia. Formato MM/yyyy                                                                                                                                                |
| ano_exercicio         | body                  | string           | 4           | opcional        | Ano de exercicio. Formato yyyy                                                                                                                                                         |
| nome_prefeitura       | body                  | string           | 30          | opcional        | Nome da prefeitura.                                                                                                                                                                    |
| cod_receita           | body                  | string           | int16       | opcional        | Código da receita.                                                                                                                                                                     |
| documento_importacao  | body                  | string           | 13          | opcional        | Identificador do documento de importacao.                                                                                                                                              |
| cod_renavam           | body                  | string           | 12          | opcional        | Código de renavam.                                                                                                                                                                     |
| cod_placa             | body                  | string           | 7           | opcional        | Placa do veículo.                                                                                                                                                                      |
| tipo_guia             | body                  | string           | 100         | opcional        | Código do tipo da guia.                                                                                                                                                                |
| descricao             | body                  | string           | 100         | opcional        | Anotacoes.                                                                                                                                                                             |
| uf                    | body                  | string           | 2           | opcional        | Código UF.                                                                                                                                                                             |
| cod_pagamento         | body                  | string           | int16       | opcional        | Código identificador do pagamento GPS.                                                                                                                                                 |
| valor_inss            | body                  | string           | (17,2)      | opcional        | Valor do INSS.                                                                                                                                                                         |
| valor_dpvat           | body                  | string           | (7,2)       | opcional        | Valor do DPVAT.                                                                                                                                                                        |
| descontos             | body                  | string           | (18,2)      | opcional        | Valor dos descontos.                                                                                                                                                                   |

### Exemplo de saída

(status = 200, application/json)
```json
{
  "data": {
    "itens": [
      {
        "id_pagamento": "2d56a89a-b205-4112-a346-e57b24fbfa23",
        "status": "Efetuado",
        "motivo": "Teste",
        "nome_favorecido": "Samwise Gamgee",
        "cpf_cnpj": "60701190000104",
        "cod_banco": "0",
        "numero_agencia": "1500",
        "numero_conta": "00052061",
        "tipo_pagamento": "Transferência Pix outras instituições",
        "data_pagamento": "2020-07-10",
        "valor_pagamento": "11260.00"
      },
      {
        "id_pagamento": "46e8bcdf-3921-41f3-887c-4bd1988e3eea",
        "status": "Não Efetuado",
        "motivo": "Teste",
        "nome_favorecido": "Samwise Gamgee",
        "cpf_cnpj": "60701190000104",
        "cod_banco": "0",
        "numero_agencia": "1500",
        "numero_conta": "00052061",
        "tipo_pagamento": "Transferência Pix outras instituições",
        "data_pagamento": "2020-07-10",
        "valor_pagamento": "11260.00"
      },
      {
        "id_pagamento": "58af4526-b842-4531-91df-3fdc4c6c9477",
        "status": "Não Efetuado",
        "motivo": "Teste",
        "nome_favorecido": "Samwise Gamgee",
        "cpf_cnpj": "60701190000104",
        "cod_banco": "0",
        "numero_agencia": "1500",
        "numero_conta": "00052061",
        "tipo_pagamento": "Transferência Pix outras instituições",
        "data_pagamento": "2020-07-10",
        "valor_pagamento": "11260.00"
      }
    ],
    "total": "54750523.19"
  },
  "pagination": {
    "page": 0,
    "totalPages": 3785,
    "totalElements": 11353,
    "pageSize": 3
  }
}
```

## Consulta Detalhe do Pagamento (GET)

### [GET] /pagamentos_sispag/{id_pagamento_sispag}

API responsável por resgatar o detalhe do pagamento SISPAG. Retorno varia de acordo com a forma do pagamento detalhado.

### Parâmetros de entrada

| **Parâmetro** | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**              |
| ------------- | --------------------- | ---------------- | ----------- | ------------ | -------------------------- |
| id_pagamento  | Path                  | string           | 36          | sim          | Código único do pagamento. |

### Exemplo de entrada

```text
/pagamentos_sispag/c6d2cad8-d6ab-4870-8e0d-b4b9090e1535
```

### Parâmetros de saída

| **Parâmetro**       | **Tipo do parâmetro** | **Tipo do dado** | **Presença**    | **Descrição**               |
| ------------------- | --------------------- | ---------------- | --------------- | --------------------------- |
| dados_debito        | body                  | object           | **obrigatório** | Objeto: Dados Debito        |
| dados_pagamento     | body                  | object           | **obrigatório** | Objeto: Dados Pagamento     |
| historico_pagamento | body                  | object           | **obrigatório** | Objeto: Histórico Pagamento |

#### Objeto — Dados Debito

| **Parâmetro**         | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença**    | **Descrição**     |
| --------------------- | --------------------- | ---------------- | ----------- | --------------- | ----------------- |
| numero_agencia_debito | body                  | string           | 4           | **obrigatório** | Agência do débito |
| numero_conta_debito   | body                  | string           | 8           | **obrigatório** | Conta do débito   |
| nome_empresa_debito   | body                  | string           | 30          | **obrigatório** | Nome da empresa   |
| cnpj_debito           | body                  | string           | 14          | **obrigatório** | CNPJ da empresa   |

#### Objeto — Histórico Pagamento

| **Parâmetro** | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença**    | **Descrição**                                                                                                                                  |
| ------------- | --------------------- | ---------------- | ----------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| status        | body                  | string           | 30          | **obrigatório** | Etapa do pagamento: "Inclusão Online", "Autorização", "Efetivação", "Inclusão - Arquivo", "Autorização operacional", "1ª Autorização", "Visto" |
| data          | body                  | string           | 26          | **obrigatório** | Data que aconteceu a etapa do pagamento                                                                                                        |
| nome_operador | body                  | string           | 80          | **obrigatório** | Nome do operador que efetuou a operação                                                                                                        |
| cod_operador  | body                  | string           | int32       | **obrigatório** | Código do operador que efetuou a operação                                                                                                      |
| cpf_operador  | body                  | string           | 11          | **obrigatório** | CPF do operador que efetuou a operação                                                                                                         |

#### Objeto — Dados Pagamentos

| **Parâmetro**                 | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença**    | **Descrição**                           |
| ----------------------------- | --------------------- | ---------------- | ----------- | --------------- | --------------------------------------- |
| nome_favorecido               | body                  | string           | 100         | **obrigatório** | Nome do Favorecido                      |
| id_pagamento                  | body                  | string           | 36          | **obrigatório** | Número identificador do pagamento       |
| cod_tipo_pessoa               | body                  | string           | 1           | **obrigatório** | Tipo pessoa                             |
| cpf_cnpj_favorecido           | body                  | string           | 14          | **obrigatório** | Número do cpf cnpj do favorecido        |
| cod_banco_favorecido          | body                  | string           | 3           | **obrigatório** | Identificador Banco do favorecido       |
| nome_banco_favorecido         | body                  | string           | -           | **obrigatório** | Nome / Descrição do banco               |
| numero_agencia_favorecido     | body                  | string           | 4           | **obrigatório** | Número da agência do favorecido         |
| numero_conta_favorecido       | body                  | string           | 8           | **obrigatório** | Número da contado favorecido            |
| valor_pagamento               | body                  | decimal          | (18,2)      | **obrigatório** | Valor do pagamento                      |
| numero_lote                   | body                  | string           | int32       | **obrigatório** | Número do lote                          |
| numero_lancamento             | body                  | string           | int32       | **obrigatório** | Número do lancamento                    |
| referencia_empresa            | body                  | string           | 100         | opcional        | Número de referência da empresa         |
| data_pagamento                | body                  | string           | 10          | **obrigatório** | Data do pagamento                       |
| status                        | body                  | string           | 30          | **obrigatório** | Status do pagamento                     |
| descricao_pagamento           | body                  | string           | 100         | **obrigatório** | Texto contendo a descrição do pagamento |
| identificacao_comprovante     | body                  | string           | 100         | opcional        | Código de identificação do comprovante  |
| codigo_isbp                   | body                  | string           | 8           | **obrigatório** | Código Isbp                             |
| modalidade_pagamento          | body                  | string           | 2           | **obrigatório** | Código da modalidade de pagamento       |
| tipo_pagamento                | body                  | string           | 2           | **obrigatório** | Código da modalidade de pagamento       |
| tipo_pagamento_descricao      | body                  | string           | 33          | **obrigatório** | Descricao da modalidade de pagamento    |
| motivo_rejeicao               | body                  | list-string      | 50          | **obrigatório** | Descrição do motivo de recusa.          |
| dados_ted                     | body                  | object           | -           | opcional        | Objeto: TED                             |
| dados_dpvat                   | body                  | object           | -           | opcional        | Objeto: DPVAT                           |
| dados_fgts                    | body                  | object           | -           | opcional        | Objeto: FGTS                            |
| dados_gare_icms_sp            | body                  | object           | -           | opcional        | Objeto: GARE ICMS SP                    |
| dados_gare_icms_sp_importacao | body                  | object           | -           | opcional        | Objeto: GARE ICMS SP IMPORTACAO         |
| dados_gnre_icms_sp_importacao | body                  | object           | -           | opcional        | Objeto: GNRE ICMS SP IMPORTACAO         |
| dados_gps                     | body                  | object           | -           | opcional        | Objeto: GPS                             |
| dados_iptu                    | body                  | object           | -           | opcional        | Objeto: IPTU                            |
| dados_ipva                    | body                  | object           | -           | opcional        | Objeto: IPVA                            |
| dados_multa                   | body                  | object           | -           | opcional        | Objeto: MULTA                           |
| dados_op                      | body                  | object           | -           | opcional        | Objeto: OP                              |
| dados_doc                     | body                  | object           | -           | opcional        | Objeto: DOC                             |
| dados_darf                    | body                  | object           | -           | opcional        | Objeto: DARF                            |
| dados_cheque                  | body                  | object           | -           | opcional        | Objeto: CHEQUE                          |
| dados_tributos_cod_barras     | body                  | object           | -           | opcional        | Objeto: TRIBUTOS CODIGO DE BARRAS       |
| dados_boleto                  | body                  | object           | -           | opcional        | Objeto: BOLETO                          |
| dados_concessionaria          | body                  | object           | -           | opcional        | Objeto: CONCESSIONARIA                  |
| dados_das                     | body                  | object           | -           | opcional        | Objeto: DAS                             |
| dados_pix_transferencia       | body                  | object           | -           | opcional        | Objeto: PIX TRANSFERENCIA               |
| dados_pix_qr_code             | body                  | object           | -           | opcional        | Objeto: PIX QRCODE                      |
| dados_licenciamento           | body                  | object           | -           | opcional        | Objeto: LICENCIAMENTO                   |

#### Objeto — TED

| **Parâmetro**              | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**                    |
| -------------------------- | --------------------- | ---------------- | ----------- | ------------ | -------------------------------- |
| numero_ted                 | body                  | string           | int32       | não          | Número da TED                    |
| complemento_finalidade_ted | body                  | string           | 100         | não          | Complemento da finalidade da TED |

#### Objeto — DPVAT

| **Parâmetro**     | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**                          |
| ----------------- | --------------------- | ---------------- | ----------- | ------------ | -------------------------------------- |
| nome_contribuinte | body                  | string           | 30          | sim          | Nome do contribuinte                   |
| tipo_pessoa       | body                  | string           | 1           | não          | Personalidade (F) física, (J) jurídica |
| numero_renavam    | body                  | string           | 12          | sim          | Número do Renavam                      |
| cod_placa         | body                  | string           | 7           | sim          | Placa do veículo                       |
| valor_dpvat       | body                  | string           | (7,3)       | sim          | Valor do DPVAT                         |
| valor_descontos   | body                  | string           | (18,2)      | não          | Valor dos descontos                    |

#### Objeto — FGTS

| **Parâmetro**   | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**                          |
| --------------- | --------------------- | ---------------- | ----------- | ------------ | -------------------------------------- |
| tipo_pessoa     | body                  | string           | 1           | não          | Personalidade (F) física, (J) jurídica |
| linha_digitavel | body                  | string           | 48          | sim          | Código de barras                       |
| tipo_guia       | body                  | string           | 100         | sim          | Tipo da guia                           |
| cnpj_cei        | body                  | string           | 14          | sim          | Identificador CNPJ/CEI                 |
| data_vencimento | body                  | string           | 10          | sim          | Data do vencimento do documento        |

#### Objeto — GARE ICMS SP

| **Parâmetro**        | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**                          |
| -------------------- | --------------------- | ---------------- | ----------- | ------------ | -------------------------------------- |
| tipo_pessoa          | body                  | string           | 1           | não          | Personalidade (F) física, (J) jurídica |
| valor_multa_mora     | body                  | string           | (18,2)      | sim          | Valor de multa/mora                    |
| acrescimo_financeiro | body                  | string           | (18,2)      | sim          | Valor de acrescimo                     |
| horarios_advocativos | body                  | string           | (18,2)      | sim          | Valor de horário advocativo            |
| cod_receita          | body                  | string           | int16       | sim          | Código da receita                      |
| periodo_referencia   | body                  | string           | 6           | sim          | Período de referência                  |
| data_vencimento      | body                  | string           | 10          | sim          | Data de vencimento para o pagamento    |
| valor_receita        | body                  | string           | (18,2)      | sim          | Valor da receita                       |
| valor_juros_mora     | body                  | string           | (18,2)      | sim          | Valor de juros/mora                    |

#### Objeto — GARE ICMS SP IMPORTACAO

| **Parâmetro**        | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**                          |
| -------------------- | --------------------- | ---------------- | ----------- | ------------ | -------------------------------------- |
| tipo_pessoa          | body                  | string           | 1           | não          | Personalidade (F) física, (J) jurídica |
| nome_contribuinte    | body                  | string           | 30          | sim          | Nome do contribuinte                   |
| documento_importacao | body                  | string           | 13          | sim          | Número do documento de importacao      |
| cod_receita          | body                  | string           | int16       | sim          | Código da receita                      |

#### Objeto — GNRE ICMS SP IMPORTACAO

| **Parâmetro**     | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**                          |
| ----------------- | --------------------- | ---------------- | ----------- | ------------ | -------------------------------------- |
| linha_digitavel   | body                  | string           | 48          | sim          | Código de barras                       |
| nome_contribuinte | body                  | string           | 30          | sim          | Nome do contribuinte                   |
| tipo_pessoa       | body                  | string           | 1           | não          | Personalidade (F) física, (J) jurídica |

#### Objeto — GPS

| **Parâmetro**          | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**                                           |
| ---------------------- | --------------------- | ---------------- | ----------- | ------------ | ------------------------------------------------------- |
| nome_contribuinte      | body                  | string           | 30          | sim          | Nome do contribuinte                                    |
| cpf_cnpj               | body                  | string           | 14          | sim          | Número de cpf/cnpj do contribuinte                      |
| tipo_pessoa            | body                  | string           | 1           | não          | Personalidade (F) física, (J) jurídica                  |
| cod_pagamento          | body                  | string           | int16       | sim          | Código receita do gps                                   |
| periodo_competencia    | body                  | string           | 7           | sim          | Período de competência                                  |
| data_vencimento        | body                  | string           | 10          | date-only    | Data de vencimento para o pagamento. Formato yyyy-MM-dd |
| valor_inss             | body                  | string           | (17,2)      | não          | Valor do INSS                                           |
| valor_outras_entidades | body                  | string           | (18,2)      | não          | Valor de outras entidades                               |
| atualizacao_monetaria  | body                  | string           | (18,2)      | não          | Atualização monetária de Juros/Multa/Mora               |

#### Objeto — IPTU

| **Parâmetro**   | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**                          |
| --------------- | --------------------- | ---------------- | ----------- | ------------ | -------------------------------------- |
| linha_digitavel | body                  | string           | 48          | sim          | Código de barras                       |
| nome_prefeitura | body                  | string           | 30          | sim          | Nome da prefeitura                     |
| tipo_pessoa     | body                  | string           | 1           | não          | Personalidade (F) física, (J) jurídica |

#### Objeto — IPVA

| **Parâmetro**     | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**                                           |
| ----------------- | --------------------- | ---------------- | ----------- | ------------ | ------------------------------------------------------- |
| nome_contribuinte | body                  | string           | 30          | sim          | Código de barras                                        |
| tipo_pessoa       | body                  | string           | 1           | não          | Personalidade (F) física, (J) jurídica                  |
| numero_renavam    | body                  | string           | 12          | sim          | Número do renavam                                       |
| cod_placa         | body                  | string           | 7           | sim          | Placa do Veículo                                        |
| data_vencimento   | body                  | date-only        | 10          | sim          | Data de vencimento para o pagamento. Formato yyyy-MM-dd |
| numero_parcela    | body                  | string           | int32       | sim          | Número da parcela                                       |
| valor_parcela     | body                  | string           | (18,2)      | sim          | Valor da parcela                                        |
| valor_descontos   | body                  | string           | (18,2)      | sim          | Valor dos descontos                                     |

#### Objeto — MULTA

| **Parâmetro**       | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**                                           |
| ------------------- | --------------------- | ---------------- | ----------- | ------------ | ------------------------------------------------------- |
| nome_contribuinte   | body                  | string           | 30          | sim          | Código de barras                                        |
| tipo_pessoa         | body                  | string           | 1           | não          | Personalidade (F) física ou (J) jurídica                |
| numero_renavam      | body                  | string           | 12          | sim          | Número do renavam                                       |
| cod_placa           | body                  | string           | 7           | sim          | Placa do Veículo                                        |
| auto_infracao       | body                  | string           | 10          | sim          | Auto da infração código                                 |
| numero_guia         | body                  | string           | 10          | sim          | Número identificador da guia                            |
| nome_orgao_autuador | body                  | string           | 30          | sim          | Nome do órgão autuador                                  |
| data_vencimento     | body                  | date-only        | 10          | sim          | Data de vencimento para o pagamento. Formato yyyy-MM-dd |
| data_infracao       | body                  | date-only        | 10          | sim          | Data da infração. Formato yyyy-MM-dd                    |

#### Objeto — OP

| **Parâmetro** | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**           |
| ------------- | --------------------- | ---------------- | ----------- | ------------ | ----------------------- |
| numero_op     | body                  | string           | int32       | sim          | Código identificador OP |

#### Objeto — DOC

| **Parâmetro** | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**            |
| ------------- | --------------------- | ---------------- | ----------- | ------------ | ------------------------ |
| numero_doc    | body                  | string           | int32       | sim          | Código identificador DOC |

#### Objeto — DARF

| **Parâmetro**     | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**                            |
| ----------------- | --------------------- | ---------------- | ----------- | ------------ | ---------------------------------------- |
| nome_contribuinte | body                  | string           | 30          | sim          | Nome do contribuinte                     |
| cnpj_contribuinte | body                  | string           | 14          | sim          | Número do CNPJ                           |
| cod_receita       | body                  | string           | int16       | sim          | Número da receita                        |
| data_apuracao     | body                  | date-only        | 10          | sim          | Data da apuração. Formato yyyy-MM-dd     |
| data_vencimento   | body                  | date-only        | 10          | sim          | Data do vencimento. Formato yyyy-MM-dd   |
| valor_principal   | body                  | string           | (18,2)      | sim          | Valor principal do pagamento             |
| valor_multa       | body                  | string           | (18,2)      | sim          | Valor de multa                           |
| valor_juros       | body                  | string           | (18,2)      | sim          | Valor de Juros                           |
| descricao         | body                  | string           | 100         | não          | Descrição DARF                           |
| linha_digitavel   | body                  | string           | 48          | não          | Código de barras                         |
| tipo_pessoa       | body                  | string           | 1           | não          | Personalidade (F) física ou (J) jurídica |

#### Objeto — CHEQUE

| **Parâmetro** | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**    |
| ------------- | --------------------- | ---------------- | ----------- | ------------ | ---------------- |
| numero_cheque | body                  | string           | int32       | sim          | Número do cheque |

#### Objeto — TRIBUTOS CODIGO DE BARRAS

| **Parâmetro**   | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**                          |
| --------------- | --------------------- | ---------------- | ----------- | ------------ | -------------------------------------- |
| linha_digitavel | body                  | string           | 48          | sim          | Código de barras                       |
| tipo_pessoa     | body                  | string           | 1           | não          | Personalidade (F) física, (J) jurídica |
| descricao       | body                  | string           | 100         | não          | Descrição do pagamento                 |

#### Objeto — BOLETO

| **Parâmetro**              | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**                                    |
| -------------------------- | --------------------- | ---------------- | ----------- | ------------ | ------------------------------------------------ |
| nome_beneficiario          | body                  | string           | 30          | sim          | Nome do beneficiário                             |
| linha_digitavel            | body                  | string           | 48          | sim          | Código de barras                                 |
| razao_social               | body                  | string           | 30          | não          | Código da razão social                           |
| documento_beneficiario     | body                  | string           | 14          | não          | Documento do beneficiário                        |
| nome_sacador_avalista      | body                  | string           | 80          | sim          | Nome do sacador avalista                         |
| nome_pagador               | body                  | string           | 30          | sim          | Nome do pagador do boleto                        |
| data_vencimento            | body                  | string           | 10          | date-only    | Data de vencimento do boleto. Formato yyyy-MM-dd |
| valor_boleto               | body                  | string           | (18,2)      | sim          | Valor do boleto                                  |
| valor_descontos            | body                  | string           | (18,2)      | não          | Valor de descontos do boleto                     |
| codigo_ispb                | body                  | string           | 8           | não          | Código ISPB do banco de destino                  |
| juros                      | body                  | string           | (18,2)      | não          | Valor dos juros do boleto                        |
| documento_sacador_avalista | body                  | string           | 14          | não          | Documento do sacador avalista, CPF ou CNPJ       |
| documento_pagador          | body                  | string           | 14          | não          | Documento do pagador, CPF ou CNPJ                |
| boletos_eletronicos_dda    | body                  | string           | 1           | não          | Indicador de boleto do itaú, 0 ou 1              |

#### Objeto — CONCESSIONARIA

| **Parâmetro**       | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**          |
| ------------------- | --------------------- | ---------------- | ----------- | ------------ | ---------------------- |
| nome_concessionaria | body                  | string           | 30          | sim          | Nome da concessionaria |
| linha_digitavel     | body                  | string           | 48          | sim          | Código de barras       |

#### Objeto — DAS

| **Parâmetro**     | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**                          |
| ----------------- | --------------------- | ---------------- | ----------- | ------------ | -------------------------------------- |
| nome_contribuinte | body                  | string           | 30          | sim          | Nome do contribuinte                   |
| linha_digitavel   | body                  | string           | 48          | sim          | Código de barras                       |
| tipo_pessoa       | body                  | string           | 1           | não          | Personalidade (F) física, (J) jurídica |
| descricao         | body                  | string           | 100         | não          | Descrição do pagamento                 |

#### Objeto — PIX TRANSFERENCIA

| **Parâmetro**         | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**                                   |
| --------------------- | --------------------- | ---------------- | ----------- | ------------ | ----------------------------------------------- |
| chave_enderecamento   | body                  | string           | 76          | sim          | Chave de endereçamento do PIX                   |
| mensagem_ao_recebedor | body                  | string           | 140         | sim          | Campo de mensagem para o recebedor do pagamento |
| mensagem_do_recebedor | body                  | string           | 140         | sim          | Campo de mensagem gerada do recebedor           |

#### Objeto — PIX QRCODE

| **Parâmetro**             | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**                                                    |
| ------------------------- | --------------------- | ---------------- | ----------- | ------------ | ---------------------------------------------------------------- |
| nome_pagador_qr_code      | body                  | string           | 30          | sim          | Nome do pagador do qr code                                       |
| documento_pagador_qr_code | body                  | string           | 14          | sim          | Campo de mensagem para o recebedor do pagamento                  |
| chave_enderecamento       | body                  | string           | 76          | sim          | Campo de mensagem para o recebedor do pagamento                  |
| data_expiracao            | body                  | datetime-only    | 19          | sim          | Data de expiração do qr code. Formato 2019-10-18T12:00:00        |
| data_vencimento           | body                  | datetime-only    | 19          | sim          | Data de vencimento para o pagamento. Formato 2019-10-18T12:00:00 |
| valor_documento           | body                  | string           | (18,2)      | sim          | Valor do documento                                               |
| multa                     | body                  | string           | (18,2)      | sim          | Valor de multa                                                   |
| juros                     | body                  | string           | (18,2)      | sim          | Valor de juros                                                   |
| desconto                  | body                  | string           | (18,2)      | sim          | Valor de desconto                                                |
| identificador_qr_code     | body                  | string           | 48          | sim          | Identificador do qr code                                         |
| mensagem_ao_recebedor     | body                  | string           | 140         | sim          | Campo de mensagem enviado ao recebedor                           |
| mensagem_do_recebedor     | body                  | string           | 140         | sim          | Campo de mensagem gerada do recebedor                            |

#### Objeto — LICENCIAMENTO

| **Parâmetro**      | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**                                                    |
| ------------------ | --------------------- | ---------------- | ----------- | ------------ | ---------------------------------------------------------------- |
| nome_proprietario  | body                  | string           | 30          | sim          | Nome do proprietário                                             |
| tipo_pessoa        | body                  | string           | 1           | não          | Personalidade (F) física, (J) jurídica                           |
| numero_renavam     | body                  | string           | 12          | sim          | Número do RENAVAM do veículo                                     |
| cod_placa          | body                  | string           | 7           | sim          | Placa do veículo                                                 |
| cod_municipio      | body                  | string           | int32       | sim          | Código do município                                              |
| taxa_licenciamento | body                  | string           | (7,2)       | sim          | Taxa licenciamento                                               |
| forma_entrega_crlv | body                  | string           | 2           | sim          | Forma na qual foi retirada a crlv (detran, ciretran, poupatempo) |
| dados_ipva         | body                  | list-object      | -           | sim          | Objeto: LICENCIAMENTO IPVA                                       |
| dados_dpvat        | body                  | list-object      | -           | sim          | Objeto: LICENCIAMENTO DPVAT                                      |
| dados_multa        | body                  | list-object      | -           | sim          | Objeto: LICENCIAMENTO MULTA                                      |

#### Objeto — LICENCIAMENTO IPVA

| **Parâmetro** | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**                 |
| ------------- | --------------------- | ---------------- | ----------- | ------------ | ----------------------------- |
| exercicio     | body                  | string           | 7           | sim          | Período do vencimento mês/ano |
| valor         | body                  | string           | (7,2)       | sim          | valor do ipva                 |

#### Objeto — LICENCIAMENTO DPVAT

| **Parâmetro** | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**                 |
| ------------- | --------------------- | ---------------- | ----------- | ------------ | ----------------------------- |
| exercicio     | body                  | string           | 7           | sim          | Período do vencimento mês/ano |
| valor         | body                  | string           | (7,2)       | sim          | valor do dpvat                |

#### Objeto — LICENCIAMENTO MULTA

| **Parâmetro**   | **Tipo do parâmetro** | **Tipo do dado** | **Tamanho** | **Presença** | **Descrição**           |
| --------------- | --------------------- | ---------------- | ----------- | ------------ | ----------------------- |
| numero_guia     | body                  | string           | 10          | sim          | Número da guia da multa |
| data_infracao   | body                  | string           | 10          | sim          | Data da infração        |
| data_vencimento | body                  | string           | 10          | sim          | Data do vencimento      |
| valor           | body                  | string           | (18,2)      | sim          | Valor                   |

### Exemplo de saída

(status = 200, application/json)
```json
{
  "data": {
    "dados_debito": {
      "numero_agencia_debito": "1500",
      "numero_conta_debito": "00062573",
      "nome_empresa_debito": "Nome Pagador - 146",
      "cnpj_debito": "60701190000104"
    },
    "dados_pagamento": {
      "id_pagamento": "c6d2cad8-d6ab-4870-8e0d-b4b9090e1535",
      "cod_tipo_pessoa": "F",
      "cpf_cnpj_favorecido": "58858474872",
      "cod_banco_favorecido": "341",
      "nome_banco_favorecido": "ITAÚ UNIBANCO S.A.",
      "numero_agencia_favorecido": "1500",
      "numero_conta_favorecido": "00601743",
      "nome_favorecido": "Nome Favorecido - 146",
      "valor_pagamento": "255.85",
      "numero_lote": "146",
      "numero_lancamento": "146",
      "referencia_empresa": "Ref. Empresa - 146",
      "data_pagamento": "2020-08-07",
      "status": "Efetuado",
      "descricao_pagamento": "Desc. da Finalidade - 146",
      "identificacao_comprovante": "Desc. da Comprovante - 146",
      "codigo_isbp": "60701190",
      "descricao_finalidade": "Desc. da Finalidade - 146",
      "tipo_pagamento": "46",
      "tipo_pagamento_descricao": "Transferência Pix outras instituições",
      "motivo_rejeicao": [],
      "dados_pix_transferencia": {
        "chave_enderecamento": "alias146@itau.com.br"
      }
    },
    "historico_pagamento": [
      {
        "status": "Inclusão Online",
        "data": "2020-08-07-16.01.13.427000",
        "cod_operador": "889911348"
      },
      {
        "status": "Autorização",
        "data": "2020-08-07-17.01.13.427000",
        "cod_operador": "889911348"
      },
      {
        "status": "Efetivação",
        "data": "2020-08-07-18.01.13.427000",
        "cod_operador": "889911348"
      }
    ]
  }
}
```

## Domínios Consulta

### Domínio — Tipo Pagamento

| **Código** | **Descrição**                           |
| ---------- | --------------------------------------- |
| `01`       | "Conta Corrente"                        |
| `02`       | "Cheque pagamento"                      |
| `03`       | "DOC"                                   |
| `04`       | "OP (duas vias)"                        |
| `05`       | "Conta Poupança"                        |
| `06`       | "Conta Corrente Mesma Titularidade"     |
| `07`       | "DOC D mesma titularidade"              |
| `10`       | "OP (uma via)"                          |
| `11`       | "OP (acerto)"                           |
| `13`       | "Concessionária"                        |
| `16`       | "DARF normal"                           |
| `17`       | "GPS"                                   |
| `18`       | "DARF simples"                          |
| `19`       | "IPTU/ISS e outros tributos"            |
| `22`       | "GARE ICMS-SP"                          |
| `23`       | "GARE ICMS-SP Importação"               |
| `25`       | "Banco Múltiplo"                        |
| `27`       | "DPVAT"                                 |
| `30`       | "Boleto Itaú"                           |
| `31`       | "Boleto outros bancos"                  |
| `32`       | "Nota fiscal eletrônica"                |
| `35`       | "FGTS"                                  |
| `38`       | "Boleto outros bancos online"           |
| `41`       | "TED outro titular"                     |
| `43`       | "TED mesmo titular"                     |
| `51`       | "Licenciamento"                         |
| `53`       | "Multa"                                 |
| `63`       | "Concessionária com moeda variável"     |
| `90`       | "DAE E-SOCIAL"                          |
| `91`       | "Tributos com código de barras"         |
| `92`       | "Darf código de barras"                 |
| `93`       | "DAS código barras"                     |
| `94`       | "GNRE ICMS-SP Importação"               |
| `95`       | "IPVA"                                  |
| `45`       | "Transferência Pix Itaú"                |
| `46`       | "Transferência Pix outras instituições" |
| `47`       | "QR Code Pix Itaú"                      |
| `60`       | "Cartão Salário"                        |
| `48`       | "QR Code Pix outras instituições"       |

### Domínio — Motivos de recusa

| **Código** | **Descrição**                                      |
| ---------- | -------------------------------------------------- |
| `004`      | LOTE SEM HEADER                                    |
| `005`      | LOTE SEM TRAILER                                   |
| `006`      | LOTE SO COM HEADER                                 |
| `007`      | LOTE SO COM TRAILER                                |
| `009`      | LOTE DUPLICADO                                     |
| `014`      | DATA DE GERACAO DO ARQUIVO INVALIDA                |
| `015`      | TIPO DE OPERACAO INVALIDA                          |
| `016`      | TIPO DE INSCRICAO INVALIDA                         |
| `017`      | FORMA DE PAGAMENTO INVALIDA                        |
| `018`      | TIPO DE PAGAMENTO INVALIDO                         |
| `019`      | TIPO X FORMA DE PAGAMENTO NAO COMPATIVEIS          |
| `020`      | CODIGO SISPAG NAO CADASTRADO                       |
| `021`      | NUMERO DE LOTE FORA DE SEQUENCIA                   |
| `022`      | NUMERO DE LOTE INVALIDO                            |
| `023`      | C.G.C INVALIDO                                     |
| `024`      | QTDE TOTAL O.P.                                    |
| `025`      | NOME DO PAGADOR INVALIDO                           |
| `026`      | SEGMENTO PGI INVALIDO (DIFERENTE DE A/B/C/K/L/M)   |
| `027`      | SEQUENCIA DOS SEGMENTOS INVALIDA                   |
| `028`      | ERRO DE SEQUENCIA DOS REGISTROS                    |
| `029`      | CAMPO SEQUENCIA NAO NUMERICO                       |
| `030`      | REGISTRO DESPREZADO (PARA K/L/M)                   |
| `031`      | BANCO DIFERENTE DE 341                             |
| `032`      | CODIGO DO BANCO NAO NUMERICO                       |
| `033`      | QUANTIDADE DE REGISTROS NAO NUMERICA               |
| `034`      | QTDE DE REGS. CALCULADA DIFER. DA QTDE INFORMADA   |
| `035`      | QUANTIDADE DE REGISTROS MAIOR QUE 999999           |
| `036`      | VALOR TOTAL NAO NUMERICO                           |
| `037`      | VALOR CALCULADO DIFERENTE DO INFORMADO             |
| `038`      | CODIGO DO USUARIO SIGMA INVALIDO                   |
| `039`      | EXISTE MAIS DE UMA CONTA/CONTRAPARTIDA             |
| `040`      | NUMERO DE ORDEM INVALIDO                           |
| `041`      | DATA DE CREDITO MAIOR QUE 1 ANO                    |
| `042`      | DATA DE CREDITO EXPIRADA                           |
| `043`      | DATA DE CREDITO INVALIDA                           |
| `044`      | CONTA/CONTABIL LANCAMENTO INVALIDA                 |
| `045`      | DAC CONTA/CONTABIL LANCAMENTO INVALIDA             |
| `046`      | CONTA/CONTABIL LANCAMENTO NAO ACEITA LTR           |
| `047`      | CONTA/CONTABIL LANCAMENTO NAO CADASTRADO PCI       |
| `048`      | CONTA/BANCO MULTIPLO LANCAMENTO INVALIDA           |
| `049`      | DAC CONTA/BANCO MULTIPLO LANCAMENTO INVALIDO       |
| `050`      | CONTA/BANCO MULTIPLO LANCAMENTO NAO ACEITA LTR     |
| `051`      | CONTA/BCO MULTIPLO LANCAMENTO NAO CADASTRADO PCM   |
| `052`      | AGENCIA OU ORGAO LANCAMENTO INVALIDOS              |
| `053`      | FORMA DE PAGAMENTO ALTERADA                        |
| `054`      | TIPO DE MOVIMENTO INVALIDO                         |
| `055`      | CODIGO DE INSTRUCAO INVALIDO                       |
| `056`      | INFORMACAO DE ALTERACAO INVALIDA                   |
| `057`      | DAC INFORMACAO DE ALTERACAO INVALIDO               |
| `058`      | BANCO DEPOSIT. INVALIDO                            |
| `059`      | AGENCIA CEDENTE CONTEM ZEROS                       |
| `060`      | AGENCIA CEDENTE INVALIDA                           |
| `061`      | CONTA CEDENTE CONTEM ZEROS                         |
| `062`      | CONTA CEDENTE CONTEM BRANCOS                       |
| `063`      | CONTA CEDENTE INVALIDA                             |
| `064`      | NOME DO CEDENTE INVALIDO                           |
| `065`      | NOSSO NUMERO INVALIDO                              |
| `066`      | REMETENTE MOTIVO INVALIDO                          |
| `067`      | REMETENTE MOTIVO OBRIGATORIO                       |
| `068`      | VALOR DO TITULO INVALIDO                           |
| `069`      | VALOR DO ABATIMENTO INVALIDO                       |
| `070`      | VALOR DO DESCONTO INVALIDO                         |
| `071`      | VALOR DE MORA INVALIDO                             |
| `072`      | VALOR DA MULTA INVALIDO                            |
| `073`      | DATA DE VENCIMENTO INVALIDA                        |
| `074`      | DAC AGE/CTA/CART/NOSNUM INVALIDO                   |
| `075`      | DAC CART/NOSNUM INVALIDO                           |
| `076`      | USO BANCO INVALIDO P/ UNIBANCO                     |
| `077`      | VALOR DE DEDUCAO INVALIDO                          |
| `078`      | VALOR DE ACRESCIMO INVALIDO                        |
| `079`      | CARTEIRA INVALIDA P/ ARQ. CSC                      |
| `080`      | ALTERACAO DE LOTE INVALIDA                         |
| `081`      | CODIGO DO BANCO INVALIDO                           |
| `082`      | ORGAO DEST. INVALIDO - CMV.ORGAOS                  |
| `083`      | AGENCIA DEST. ENCERRADA                            |
| `084`      | AGENCIA DEST. FICTICIA                             |
| `085`      | AGENCIA DEST. INVALIDA B0V.AGENCIA                 |
| `086`      | DAC CONTA/CORRENTE FAVORECIDO INVALIDO             |
| `087`      | AGE/CTA FAVORECIDO INVALIDA                        |
| `088`      | CONTA/CORRENTE FAVORECIDO NAO CADASTRADO CCV.CDR   |
| `089`      | CONTA/CORRENTE MAIOR 99900                         |
| `090`      | AGE/ORGAO DEST. NAO NUMERICA                       |
| `091`      | DOC PARA BANCO ITAU                                |
| `092`      | BANCO/AGENCIA NAO CADASTRADOS NO CKV.OBA           |
| `093`      | CAM. COMPENSACAO INVALIDA                          |
| `094`      | AGENCIA CENTRALIZADORA INVALIDA                    |
| `095`      | IDENTIF. TIPO CHEQUE INVALIDA                      |
| `096`      | LOGRADOURO INVALIDO                                |
| `097`      | NUMERO LEC INVALIDO                                |
| `098`      | CIDADE LEC INVALIDA                                |
| `099`      | ESTADO LEC INVALIDO                                |
| `100`      | CEP LEC INVALIDO                                   |
| `101`      | REGISTRO DESPREZADO                                |
| `102`      | ARQUIVO SO COM HEADER                              |
| `103`      | ARQUIVO SEM HEADER VALIDO                          |
| `104`      | ARQUIVO SEM TRAILER-PGI                            |
| `105`      | VALOR DO PAGAMENTO INVALIDO                        |
| `107`      | QTDE DE MOVTOS PROCESSADOS DIFERE DO MOVTO FINAL   |
| `108`      | ARQUIVO DESPREZADO                                 |
| `109`      | REGISTRO DIFERENTE DE: 0, 1, 3, 5 E 9              |
| `110`      | MAIS DE UMA MOEDA NO LOTE                          |
| `111`      | VALOR ACIMA LIMITE                                 |
| `112`      | VALOR ABAIXO LIMITE                                |
| `113`      | DATA DE CONVERSAO INVALIDA                         |
| `114`      | TIPO DE MOEDA INVALIDO                             |
| `115`      | CAMPO DEBITO/CREDITO INVALIDO                      |
| `116`      | EMPRESA NAO CADASTRADA (AG/CONTA)                  |
| `117`      | EMPRESA NAO CADASTRADA (TIPO/CNPJ)                 |
| `118`      | CODIGO DE PAGAMENTO INVALIDO                       |
| `119`      | COMPETENCIA INVALIDA                               |
| `120`      | CAMPO IDENTIFICADOR INVALIDO                       |
| `121`      | VALOR INSS INVALIDO                                |
| `122`      | VALOR DE OUTRAS ENTIDADES INVALIDO                 |
| `123`      | VALOR DE ATUALIZACAO MONETARIA INVALIDO            |
| `124`      | VALOR TOTAL INVALIDO                               |
| `125`      | DATA DE ARRECADACAO INVALIDA                       |
| `126`      | AGENCIA RECEBEDORA INVALIDA                        |
| `127`      | INSCRICAO ESTADUAL INVALIDA                        |
| `128`      | CODIGO DA RECEITA INVALIDO                         |
| `129`      | NUMERO DO DOCUMENTO ORIGEM INVALIDO                |
| `130`      | PER.REF/PARCELA INVALIDA                           |
| `131`      | IND. PESSOA FIS/JUR. INVALIDO                      |
| `132`      | PERIODO DE APURACAO INVALIDO                       |
| `133`      | RECEITA BRUTA INVALIDA                             |
| `134`      | REFERENCIA INVALIDA                                |
| `138`      | BOLETO NAO REGISTRADO NA CIP                       |
| `139`      | BOLETO INAPTO PARA PAGAMENTO NA CIP                |
| `140`      | BANCO DIVERTENTE DO CADASTRO CIP                   |
| `141`      | DADOS DO BOLETO PREENCHIDOS INCORRETAMENTE         |
| `142`      | CNPJ PAGADOR DIVERTENTE DO CADASTRO CIP            |
| `143`      | CNPJ SACADOR AVALISTA DIVERTENTE DO CADASTRO CIP   |
| `144`      | DATA LIMITE DO BOLETO INVALIDA                     |
| `145`      | QUANTIDADE DE BAIXAS OPERACIONAIS MAIOR QUE PERMIT |
| `146`      | PAGAMENTO DE BOLETO EM DUPLICIDADE                 |
| `201`      | TIPO X FORMA DE PAGAMENTO NAO COMPATIVEIS          |
| `202`      | CODIGO DO USUARIO SIGMA INVALIDO                   |
| `203`      | CTA-CONTABIL/BCO-MULTIPLO LANCAMENTO INVALIDO      |
| `204`      | DAC CTA-CONTABIL/BCO-MULTIP LANCAMENTO INVALIDO    |
| `205`      | CTA-CONTABIL/BCO-MULT LANCAMENTO NAO ACEITA LTR    |
| `206`      | CTA-CONTABIL/BCO-MULT LANC NAO CADASTRADO CJ.CCD   |
| `211`      | AGENCIA OU ORGAO LANCAMENTO INVALIDOS              |
| `212`      | FORMA DE PAGAMENTO ALTERADA                        |
| `213`      | ORGAO DEST. INVALIDO - CMV.ORGAOS                  |
| `214`      | AGENCIA DEST. ENCERRADA                            |
| `215`      | AGENCIA DEST. FICTICIA                             |
| `216`      | AGENCIA DEST. INVALIDA B0V.AGENCIA                 |
| `217`      | DÍGITO INCORRETO PARA A CONTA INFORMADA            |
| `218`      | AGE/CTA FAVORECIDO INVALIDA                        |
| `219`      | CONTA/CORRENTE FAVORECIDO NAO CADASTRADO CCV.CDR   |
| `220`      | CONTA/CORRENTE MAIOR 99900                         |
| `221`      | AGE/ORGAO DEST. NAO NUMERICA                       |
| `222`      | DOC/TED PARA BANCO ITAU                            |
| `223`      | BANCO/AGENCIA NAO CADASTRADOS NO CKV.OBA           |
| `224`      | CAM. COMPENSACAO INVALIDA                          |
| `225`      | AGENCIA CENTRALIZADORA INVALIDA                    |
| `226`      | IDENTIF. TIPO CHEQUE INVALIDA                      |
| `227`      | LOGRADOURO INVALIDO                                |
| `228`      | NUMERO LEC INVALIDO                                |
| `229`      | CIDADE LEC INVALIDA                                |
| `230`      | ESTADO LEC INVALIDO                                |
| `231`      | CEP LEC INVALIDO                                   |
| `232`      | REGISTRO DESPREZADO                                |
| `233`      | VALOR ACIMA LIMITE                                 |
| `234`      | VALOR ABAIXO LIMITE                                |
| `235`      | DATA DE CONVERSAO INVALIDA                         |
| `236`      | DÍGITO INCORRETO PARA A CONTA INFORMADA            |
| `238`      | OPERACAO NAO REALIZADA/ BOLETO BLOQUEADO/ BOLETO J |
| `300`      | CONCESSIONARIA NAO CADASTRADA                      |
| `301`      | COD.BAR. NAO NUMERICO OU = ZEROS                   |
| `302`      | DAC COD.BAR. INVALIDO                              |
| `303`      | VALOR COD.BAR. E VALOR INFORMADO DIFERENTES        |
| `304`      | VALOR COD.BAR. NAO NUMERICO                        |
| `305`      | SEGMENTO COD.BAR. INVALIDO                         |
| `306`      | CODIGO DE BARRAS DEVE INICIAR COM 8                |
| `307`      | BANCO NAO PARTICIPANTE DO SPB                      |
| `308`      | BANCO NAO PARTICIPANTE DO SPB - TED                |
| `309`      | BANCO NAO PARTICIPA TEMPORARIAMENTE DO SPB         |
| `310`      | VALOR DE TED MENOR QUE R$ 5.000,00                 |
| `311`      | PAGTO NAO PERMITIDO POR EXCEDER HORARIO LIMITE     |
| `312`      | FAVORECIDO NAO CADASTRADO PARA TED                 |
| `313`      | VALOR DO DOC ACIMA DO LIMITE P/ FAVORECIDO         |
| `320`      | CONCESSIONARIA NAO LIBERADA PARA PGTO NO AUTO-ATEN |
| `321`      | MOEDA DO CODIGO DE BARRAS DIFERENTE DE 6,7,8 E 9   |
| `322`      | EMPRESA DO CODIGO DE BARRAS INVALIDA PARA GPS      |
| `323`      | PAGTO FROTAS REJEITADO                             |
| `324`      | LICENCIAMENTO 2VIA TRANS. NÃO PERMITIDA            |
| `325`      | LICENCIAMENTO EFETUADO E NÃO EMITIDO NO DETRAN     |
| `326`      | VEICULO DE 2 LETRAS, SOMENTE TRANSFERENCIA E LIC.  |
| `327`      | TAXA DE CORREIO OBRIGATORIO NO LICC. ANTECIPADO.   |
| `328`      | PAGTO FROTAS REJEITADO                             |
| `329`      | LICENCIAMENTO C/MULTA RENAINF - EFETUAR PAGTO      |
| `330`      | VEICULO OFICIAL - NÃO PERMITIDO EFETUAR PAGTO      |
| `331`      | VEICULO OFICIAL - NÃO PERMITIDO EFETUAR PAGTO      |
| `332`      | PAGTO BLOQUEADO                                    |
| `333`      | PAGTOS COM MAIS DE 15 MULTAS                       |
| `334`      | PAGTOS COM MAIS DE 15 MULTAS                       |
| `335`      | FALTA DE TRANSFERENCIA OU ENDEREÇO IRREGULAR       |
| `336`      | DUPLICIDADE DE PLACA                               |
| `337`      | PAGTO FROTAS REJEITADO                             |
| `338`      | DETRAN FORA DE OPERACAO                            |
| `339`      | PAGTO FROTAS REJEITADO                             |
| `340`      | PAGTO REJEITADO - NR IDENTIFICADOR DUPLICADO       |
| `341`      | PAGTO REJEITADO - NR SOLITACAO INVÁLIDO            |
| `450`      | LOTE SEM HEADER                                    |
| `451`      | LOTE SEM TRAILER                                   |
| `452`      | LOTE SO COM HEADER                                 |
| `453`      | LOTE SO COM TRAILER                                |
| `454`      | LOTE SEM TRANSACAO                                 |
| `455`      | LOTE DUPLICADO                                     |
| `456`      | DATA DE GERACAO DO ARQUIVO INVALIDA                |
| `457`      | TIPO DE OPERACAO INVALIDA                          |
| `458`      | TIPO DE INSCRICAO INVALIDA                         |
| `459`      | FORMA DE PAGAMENTO INVALIDA                        |
| `460`      | TIPO DE PAGAMENTO INVALIDO                         |
| `461`      | CODIGO SISPAG NAO CADASTRADO                       |
| `462`      | NUMERO DE LOTE FORA DE SEQUENCIA                   |
| `463`      | NUMERO DE LOTE INVALIDO                            |
| `464`      | C.G.C INVALIDO                                     |
| `465`      | QTDE TOTAL O.P.                                    |
| `466`      | NOME DO PAGADOR INVALIDO                           |
| `467`      | SEGMENTO PGI INVALIDO                              |
| `468`      | FORMATO INCORRETO DO ARQUIVO CNAB 240              |
| `469`      | ERRO DE SEQUENCIA DOS REGISTROS                    |
| `470`      | CAMPO SEQUENCIA NAO NUMERICO                       |
| `471`      | REGISTRO DESPREZADO                                |
| `472`      | BANCO DIFERENTE DE 341                             |
| `473`      | CODIGO DO BANCO NAO NUMERICO                       |
| `474`      | QUANTIDADE DE REGISTROS NAO NUMERICA               |
| `475`      | QTDE DE REGS. CALCULADA DIFER. DA QTDE INFORMADA   |
| `476`      | QUANTIDADE DE REGISTROS MAIOR QUE 999999           |
| `477`      | VALOR TOTAL NAO NUMERICO                           |
| `478`      | VALOR CALCULADO DIFERENTE DO INFORMADO             |
| `479`      | EXISTE MAIS DE UMA CONTA/CONTRAPARTIDA             |
| `480`      | NUMERO DE ORDEM INVALIDO                           |
| `481`      | DATA DE CREDITO MAIOR QUE 1 ANO                    |
| `482`      | DATA PARA PAGAMENTO INDICADA NO ARQUIVO INVÁLIDA   |
| `483`      | DATA DO AGENDAMENTO INVÁLIDA                       |
| `484`      | TIPO DE MOVIMENTO INVALIDO                         |
| `485`      | CODIGO DE INSTRUCAO INVALIDO                       |
| `486`      | INFORMACAO DE ALTERACAO INVALIDA                   |
| `487`      | DAC INFORMACAO DE ALTERACAO INVALIDO               |
| `488`      | BANCO DEPOSIT. INVALIDO                            |
| `489`      | AGENCIA CEDENTE CONTEM ZEROS                       |
| `490`      | AGENCIA CEDENTE INVALIDA                           |
| `491`      | CONTA CEDENTE CONTEM ZEROS                         |
| `492`      | CONTA CEDENTE CONTEM BRANCOS                       |
| `493`      | CONTA CEDENTE INVALIDA                             |
| `494`      | NOME DO FAVORECIDO INVALIDO                        |
| `495`      | NOSSO NUMERO INVALIDO                              |
| `496`      | REMETENTE MOTIVO INVALIDO                          |
| `497`      | REMETENTE MOTIVO OBRIGATORIO                       |
| `498`      | PAGAMENTO REJEITADO, CONTATE A CENTRAL DE ATENDIME |
| `499`      | VALOR DO ABATIMENTO INVALIDO                       |
| `500`      | VALOR DO DESCONTO INVALIDO                         |
| `501`      | VALOR DE MORA INVALIDO                             |
| `502`      | VALOR DA MULTA INVALIDO                            |
| `503`      | DATA DE VENCIMENTO INVALIDA                        |
| `504`      | DAC AGE/CTA/CART/NOSNUM INVALIDO                   |
| `505`      | DAC CART/NOSNUM INVALIDO                           |
| `506`      | USO BANCO INVALIDO P/ UNIBANCO                     |
| `507`      | VALOR DE DEDUCAO INVALIDO                          |
| `508`      | VALOR DE ACRESCIMO INVALIDO                        |
| `509`      | CARTEIRA INVALIDA P/ ARQ. CSC                      |
| `510`      | ALTERACAO DE LOTE INVALIDA                         |
| `511`      | NÚMERO DO BANCO INCORRETO                          |
| `512`      | ARQUIVO SO COM HEADER                              |
| `513`      | ARQUIVO SEM HEADER VALIDO                          |
| `514`      | ARQUIVO SEM TRAILER-PGI                            |
| `515`      | VALOR DO PAGAMENTO INVALIDO                        |
| `516`      | QTDE DE MOVTOS PROCESSADOS DIFERE DO MOVTO FINAL   |
| `517`      | ARQUIVO DESPREZADO                                 |
| `518`      | REGISTRO DIFERENTE DE: 0, 1, 3, 5 E 9              |
| `519`      | MAIS DE UMA MOEDA NO LOTE                          |
| `520`      | TIPO DE MOEDA INVALIDO                             |
| `521`      | CAMPO DEBITO/CREDITO INVALIDO                      |
| `522`      | EMPRESA NAO CADASTRADA (AG/CONTA)                  |
| `523`      | EMPRESA NAO CADASTRADA (TIPO/CNPJ)                 |
| `524`      | FORMA X SEGMENTO INCOMPATIVEIS                     |
| `525`      | SEU NUMERO INVALIDO                                |
| `526`      | DAC DO CODIGO DE BARRAS INVALIDO                   |
| `527`      | CARTEIRA DE DESCONTO INVALIDA                      |
| `528`      | VALOR LIQ. DIF. VALOR NOMINAL - DESC. + ACRESC.    |
| `529`      | DAC CART/NOSNUM DO COD. DE BARRAS INVALIDO.        |
| `530`      | DAC AG/CTA/CART/NOSNUM DO COD.BARRAS INVALIDO.     |
| `531`      | IDENTIFICACAO DO CODIGO DE BARRAS INVALIDO.        |
| `532`      | DAC CART/NOSNUM/NDOC/IDENTIF DO COD.BARRAS INV.    |
| `533`      | DOC/TED DO BFB PARA O BFB                          |
| `534`      | DAC AG/CONTA DO CEDENTE INVALIDO                   |
| `535`      | DAC AG/CONTA DO CEDENTE DO COD.BARRAS INVALIDO     |
| `536`      | DAC DO NOSSO NUMERO DO CODIGO BARRAS INVALIDO      |
| `537`      | AGENCIA CEDENTE DO CODIGO BARRAS INVALIDO          |
| `538`      | SEGMENTO J NAO PERMITIDO PARA LAYOUT 010           |
| `539`      | TITULARIDADE INVALIDA PARA ISENCAO DO CPMF.        |
| `540`      | DOC/TED DO BANERJ PARA O BANERJ                    |
| `541`      | COMPLEMENTO 1 INVALIDO                             |
| `542`      | COMPLEMENTO 2 INVALIDO                             |
| `543`      | CODIGO DE SERVICO INVALIDO                         |
| `544`      | CODIGO DE AGENDAMENTO INVALIDO                     |
| `545`      | DATA DE OPERACAO INVALIDA                          |
| `546`      | HORA DE OPERACAO INVALIDA                          |
| `547`      | DATA DE AGENDAMENTO INVALIDA                       |
| `548`      | AGENCIA DE ORIGEM INVALIDA                         |
| `549`      | TERMINAL INVALIDO                                  |
| `550`      | CANAL INVALIDO                                     |
| `551`      | NUMERO DO CARTAO DE CREDITO INVALIDO               |
| `552`      | CODIGO DE BARRAS DE CONCESSIONARIA INVALIDO        |
| `553`      | TIPO INSTITUICAO  ORIGEM INVALIDO                  |
| `554`      | TIPO INSTITUICAO CLIENTE INVALIDO                  |
| `555`      | COD. INSTITUICAO ORIGEM INVALIDO                   |
| `556`      | COD. INSTITUICAO CLIENTE INVALIDO                  |
| `557`      | COD. TERMINAL INVALIDO                             |
| `558`      | TIPO CARTAO INVALIDO                               |
| `559`      | COD. AUTORIZACAO INVALIDO                          |
| `560`      | COD. PRODUCAO INVALIDO                             |
| `561`      | TIPO PRODUCAO INVALIDO                             |
| `562`      | SUBCONTA INVALIDA                                  |
| `563`      | OPCAO DE RESGATE INVALIDA                          |
| `564`      | CODIGO DE CANAL INVALIDO                           |
| `565`      | DAC DA AG/CTA DE AGENDAMENTO INVALIDO              |
| `566`      | ENTIDADE ZERADA OU NAO NUMERICA                    |
| `567`      | GRUPO ZERADO OU NAO NUMERICO                       |
| `568`      | MATRICULA CONTEM BRANCOS                           |
| `569`      | SUPLEMENTO NAO NUMERICO                            |
| `570`      | COMPETENCIA NAO NUMERICA                           |
| `571`      | CNPJ/CPF DO FAVORECIDO INVALIDO                    |
| `572`      | CPF/CNPJ INCORRETO PARA AGÊNCIA E CONTA INFORMADA  |
| `573`      | CONTA DO FAVORECIDO INEXISTENTE OU INDISPONÍVEL PA |
| `574`      | FOLHA-BKL NAO PODE SER PROCESSADA VIA ARQUIVO      |
| `575`      | PAGAMENTO DE SALARIO PARA PESSOA JURIDICA          |
| `579`      | CNPJ/CPF INVALIDO - TODO O LOTE SERA REJEITADO     |
| `580`      | DATA PAGAMENTO - REPASSE INVALIDA                  |
| `581`      | VALOR REPASSE / TOTAL PARCELA INVALIDO             |
| `582`      | NUMERO CONTRATO INVALIDO                           |
| `583`      | NUMERO PARCELA INVALIDO                            |
| `584`      | INDICADOR DE NAO REPASSE INVALIDO                  |
| `585`      | DATA VENCIMENTO PARCELA INVALIDA                   |
| `586`      | CODIGO UNIDADE ADMINISTRATIVA INVALIDO             |
| `587`      | STATUS DO MUTUARIO INVALIDO                        |
| `588`      | VALOR DA MARGEM INVALIDO                           |
| `589`      | IDENTIFICADOR DO SINDICATO INVALIDO                |
| `590`      | QUANTIDADE PARCELAS CONTRATO INVALIDO              |
| `591`      | DATA INICIO CONTRATO INVALIDA                      |
| `592`      | DATA FIM CONTRATO INVALIDA                         |
| `593`      | VALOR TOTAL LIBERADO INVALIDO                      |
| `594`      | VALOR TOTAL OPERACAO INVALIDO                      |
| `595`      | VALOR TOTAL SALDO DEVEDOR INVALIDO                 |
| `596`      | QUANTIDADE CONTRATOS NO BANCO INVALIDA             |
| `597`      | VALOR DA CONTRAPRESTACAO INVALIDO                  |
| `598`      | VALOR RESIDUAL GARANTIDO INVALIDO                  |
| `599`      | CODIGO NAO REPASSE / INDICADOR MOTIVO INVALIDO     |
| `600`      | AGENCIA/CONTA INEXISTENTE/INVALIDA PARA CONTRATO   |
| `601`      | QUANTIDADE TOTAL DE PARCELAS INVALIDA              |
| `602`      | VALOR TOTAL DAS PARCELAS INVALIDA                  |
| `603`      | QUANTIDADE DE PARCELAS CONSIGNADAS INVALIDA        |
| `604`      | VALOR DAS PARCELAS CONSIGNADAS INVALIDA            |
| `605`      | QUANTIDADE DE PARCELAS NAO CONSIGNADAS INVALIDA    |
| `606`      | VALOR DAS PARCELAS NAO CONSIGNADAS INVALIDA        |
| `607`      | CODIGO DE PAGAMENTO NAO NUMERICO                   |
| `609`      | COMPETENCIA INVALIDA PARA A RECEITA INFORMADA      |
| `610`      | ANO ANTERIOR A 1996                                |
| `611`      | CNPJ INVALIDO                                      |
| `612`      | CEI INVALIDO                                       |
| `613`      | DEBCAD INVALIDO                                    |
| `614`      | NIT INVALIDO                                       |
| `615`      | NUMERO DO TITULO INVALIDO                          |
| `616`      | NB INVALIDO                                        |
| `617`      | VALOR DO INSS DEVE ESTAR ZERADO                    |
| `618`      | VALOR ENT. DEVE ESTAR ZERADO                       |
| `619`      | VALOR ATUALIZ. OBRIGATORIO                         |
| `620`      | VALOR ATUALIZ. OBRIGATORIO CRITERIO A/B/C          |
| `621`      | VALOR ATUALIZ. DEVE ESTAR ZERADO                   |
| `622`      | VALOR TOTAL DIFERENTE DA SOMATORIA DOS VALORES     |
| `623`      | VALOR TOTAL INFERIOR AO LIMITE PERMITIDO           |
| `624`      | GPS CODIGO DE BARRAS INVALIDO                      |
| `626`      | PAGAMENTO NÃO PROCESSADO. ENVIE NOVAMENTE.         |
| `640`      | ARQUIVO DUPLICADO                                  |
| `641`      | NUMERO UNICO EMPRESA EM BRANCO                     |
| `750`      | ERRO NA CHAMADA AO SUB-PROGRAMA R1                 |
| `751`      | CODIGO DE BARRAS DE IPTU INVALIDO                  |
| `752`      | POSICAO 1 DO CODIGO DE BARRA DIFERENTE DE 8        |
| `753`      | SEGMENTO DO CODIGO DE BARRA INVALIDO               |
| `754`      | MOEDA DO CODIGO DE BARRA INVALIDO                  |
| `755`      | VALOR EM UFIR DO CODIGO DE BARRA INVALIDO          |
| `756`      | EMPRESA/ORGAO NAO AUTORIZ. A RECEBER NO AUTO-ATEND |
| `757`      | DATA DE VENCIMENTO DO CODIGO DE BARRA INVALIDA     |
| `758`      | DOCUMENTO VENCIDO                                  |
| `759`      | DOCUMENTO VENCIDO - PAGUE PARCELADO                |
| `760`      | BANCO NAO AUTORIZADO A RECEBER APOS VENCIMENTO     |
| `761`      | TRIBUTO NAO AUTORIZADO A RECEBER                   |
| `762`      | PMSP-IDENTIFICACAO DE VIAS INVALIDA                |
| `763`      | PMSP-CONTRIBUINTE INVALIDO                         |
| `764`      | PMSP-UNIDADE DO EXERCICIO INVALIDO                 |
| `765`      | PMSP-ALGORITMO INVALIDO                            |
| `766`      | PMSP-NR INVALIDO                                   |
| `767`      | PMSP-NUMERO DE PRESTACOES INVALIDO                 |
| `768`      | PMSP-QUANTIDADE DE PRESTACOES INVALIDO             |
| `769`      | PMSP-DECADA DO EXERCICIO INVALIDA                  |
| `770`      | PMSP-MOEDA INCOMPATIVEL C/ EXERC.DO COD DE BARRA   |
| `771`      | PMSP-DAC DO CAMPO 02 INVALIDO                      |
| `772`      | PMSP-DATA DE VENCIMENTO CALCULADA INVALIDA         |
| `773`      | PMSP-EXERCICIO DO IPTU ANTERIOR A 1995             |
| `774`      | RECEBIMENTO NAO DISPONIVEL                         |
| `775`      | VALOR DE PAGAMENTO INFORMADO INVALIDO              |
| `776`      | DATA DE VENCIMENTO INFORMADA INVALIDA              |
| `777`      | BANCO DO DEMONSTRATIVO INVALIDO                    |
| `778`      | NUMERO DO LOTE DO DEMONSTRATIVO INVALIDO           |
| `779`      | TIPO DE REGISTRO INVALIDO PARA DEMONSTRATIVO       |
| `780`      | Nº SEQUENCIAL DO REGISTRO NO LOTE INVALIDO         |
| `781`      | VALOR DO DOCUMENTO INVALIDO                        |
| `782`      | VALOR DO PIS INVALIDO                              |
| `783`      | VALOR DO IR INVALIDO                               |
| `784`      | VALOR DO ISS INVALIDO                              |
| `785`      | VALOR DO COFINS INVALIDO                           |
| `786`      | VALOR DO DESCONTO INVALIDO                         |
| `787`      | VALOR DO ABATIMENTO INVALIDO                       |
| `788`      | VALOR DE OUTRAS DEDUCOES INVALIDO                  |
| `789`      | VALOR DA MORA INVALIDO                             |
| `790`      | VALOR DA MULTA INVALIDO                            |
| `791`      | VALOR DE OUTROS ACRESCIMOS INVALIDO                |
| `792`      | PRODUTO DEMPAG NAO CONTRATADO                      |
| `793`      | SOMA DAS FATURAS DIFERE DO PAGAMENTO               |
| `794`      | DATA DE VENCIMENTO DA FATURA INVALIDA              |
| `795`      | E-MAIL DO FAVORECIDO INVALIDO                      |
| `796`      | FINALIDADE DO HOLERITE INVALIDA                    |
| `797`      | MES DA COMPETENCIA DO HOLERITE INVALIDA            |
| `798`      | DIA DA COMPETENCIA DO HOLERITE INVALIDA            |
| `799`      | CENTRO DE CUSTO INVALIDO                           |
| `800`      | NUMERO DA FUNCIONAL INVALIDO                       |
| `801`      | DATA INICIO DE FERIAS NAO NUMERICA                 |
| `802`      | DATA INICIO DE FERIAS INCONSISTENTE                |
| `803`      | DATA FIM DE FERIAS NAO NUMERICA                    |
| `804`      | DATA FIM DE FERIAS INCONSISTENTE                   |
| `805`      | NUMERO DE DEPENDENTES IR INVALIDO                  |
| `806`      | NUM. DE DEP. SALARIO FAMILIA INVALIDO              |
| `807`      | NUMERO DE HORAS SEMANAIS INVALIDO                  |
| `808`      | SALARIO DE CONTRIBUICAO INSS INVALIDO              |
| `809`      | SALARIO DE CONTRIBUICAO FGTS INVALIDO              |
| `810`      | VALOR TOTAL DOS PROVENTOS INVALIDO                 |
| `811`      | VALOR TOTAL DOS DESCONTOS INVALIDO                 |
| `812`      | VALOR LIQUIDO NAO NUMERICO                         |
| `813`      | VALOR LIQ.INFORMADO DIFERENTE DO CALCULADO         |
| `814`      | TIPO DE MOVIMENTO HOLERITE INVALIDO                |
| `815`      | VALOR 01 DO HOLERITE INVALIDO                      |
| `816`      | VALOR 02 DO HOLERITE INVALIDO                      |
| `817`      | VALOR 03 DO HOLERITE INVALIDO                      |
| `818`      | VALOR 04 DO HOLERITE INVALIDO                      |
| `819`      | VALOR DO SALARIO-BASE INVALIDO                     |
| `820`      | VALOR DA CSLL INVALIDA                             |
| `821`      | BASE DE CALCULO IRRF INVALIDA                      |
| `822`      | BASE DE CALCULO FGTS INVALIDA                      |
| `823`      | FORMA DE PAGAMENTO INCOMPATIVEL C/ HOLERITE        |
| `824`      | DIVIDA ATIVA OU NUMERO DE ETIQUETA INVALIDA        |
| `825`      | VALOR DO TRIBUTO INVALIDO                          |
| `826`      | VALOR DE HONORARIOS INVALIDO                       |
| `827`      | IDENTIFICACAO DO TRIBUTO INVALIDO                  |
| `828`      | EXERCICIO (ANO BASE)                               |
| `829`      | CODIGO RENAVAM NAO ENCONTRADO/INVALIDO             |
| `830`      | UF INVALIDO                                        |
| `831`      | CODIGO DO MUNICIPIO INVALIDO                       |
| `832`      | PLACA INVALIDA                                     |
| `833`      | OPCAO/PARCELA DE PAGAMENTO INVALIDA                |
| `834`      | TRIBUTO JA FOI PAGO OU ESTA VENCIDO                |
| `835`      | CODIGO DO PRODUTO INVALIDO                         |
| `836`      | VALOR DO CODIGO BARRA INVALIDO                     |
| `837`      | DATA DE VALIDADE INVALIDA                          |
| `838`      | TIPO ARRECADADOR INVALIDO - CODIGO DE BARRAS       |
| `839`      | CNPJ/CPF INVALIDO                                  |
| `840`      | CAMPO IDENTIFICADOR IGUAL AO CNPJ                  |
| `841`      | PRIMEIRO DAC DO CAMPO IDENTIFICADOR INVALIDO       |
| `842`      | SEGUNDO DAC DO CAMPO IDENTIFICADOR INVALIDO        |
| `843`      | COMPETENCIA DO LACRE INVALIDA                      |
| `844`      | IDENTIFICADOR DO LACRE INVALIDO                    |
| `845`      | VALOR DO LACRE INVALIDO                            |
| `846`      | PRIMEIRO DAC DO CAMPO LACRE INVALIDO               |
| `847`      | SEGUNDO DAC DO CAMPO LACRE INVALIDO                |
| `850`      | PAGAMENTO EM DUPLICIDADE                           |
| `851`      | FORMA INCOMPATIVEL COM A TITULARIDADE DO PAGAMENTO |
| `852`      | AGENCIA DO FAVORECIDO INVALIDA                     |
| `853`      | VALOR INFORMADO DIFERENTE DO VALOR DO TRIBUTO      |
| `854`      | FORMA INCOMPATIVEL COM O LAYOUT 010                |
| `855`      | NUMERO DA NOTA FISCAL INVALIDO                     |
| `856`      | IDENTIFICADOR DE NF/CNPJ INVALIDO                  |
| `857`      | FORMA 32 INVALIDA                                  |
| `858`      | REG VARREDURA NAO LOCALIZADO                       |
| `859`      | CONTA REJEITADA PELO DE X PARA DE CTASAL           |
| `860`      | TRANSACAO REJEITADA, CONTATE A CENTRAL DE ATENDIME |
| `861`      | CONTA SALARIO DIVERGENTE DO PAGADOR                |
| `862`      | CARTAO SALARIO NO CADASTRO DE EXCECAO              |
| `874`      | CONTA DO FAVORECIDO INDISPONÍVEL PARA USO          |
| `881`      | CN - CONTA NAO CADASTRADA                          |
| `882`      | AN - C/C DO FAVORECIDO INVALIDA                    |
| `883`      | RJ - REGISTRO REJEITADO                            |
| `884`      | CONTA DO FAVORECIDO ENCERRADA                      |
| `885`      | AGENCIA OU CONTA DO FAVORECIDO INCORRETA           |
| `886`      | CPF/CNPJ DO FAVORECIDO INCORRETO                   |
| `887`      | VALOR ABAIXO DO PERMITIDO P/ FINALIDADE            |
| `888`      | IDENTIFICACAO DO DEP. JUDICIAL INCORRETO           |
| `889`      | CPF/CNPJ OU AG/CONTA DO FAVORECIDO INCORRETO       |
| `890`      | SALDO INSUFICIENTE PARA ESSA TRANSAÇÃO             |
| `891`      | ESSA TRANSAÇÃO ULTRAPASSOU O LIMITE DE PAGAMENTOS  |
| `892`      | CPF/CNPJ DO FAV. INAPTO JUNTO A RECEITA            |
| `894`      | PAGAMENTO NÃO AUTORIZADO PELO REPRESENTANTE DA EMP |
| `895`      | PAGAMENTO EXCLUÍDO PELO REPRESENTANTE DA EMPRESA   |
| `900`      | OPERADOR SEM ALCADA                                |
| `901`      | TIPO DE CONTA INDEVIDA                             |
| `902`      | AGENCIA DO PAGADOR INVALIDA                        |
| `903`      | CONTA DO PAGADOR INVALIDA                          |
| `904`      | ID BANCO INVALIDO                                  |
| `905`      | CNPJ PAGADOR NÃO CADASTRADO NO SISPAG              |
| `906`      | IDENTIFICAÇÃO DO QR CODE INVÁLIDO                  |
| `907`      | ERRO AO VALIDAR QR CODE                            |
| `908`      | VALORES DIVERGENTES DO QR CODE                     |
| `909`      | DOCUMENTO PAGADOR INVALIDO                         |
| `910`      | DOCUMENTO FAVORECIDO INVALIDO                      |
| `911`      | LIMITE DIARIO DE PAGAMENTO EXCEDIDO                |
| `912`      | ERRO AO VALIDAR LIMITE DIARIO DE PAGAMENTO         |
| `913`      | QR CODE EXPIRADO                                   |
| `915`      | PAGAMENTO EM DUPLICIDADE                           |
| `921`      | ERRO NO PROCESSAMENTO DE ALCADA                    |
| `931`      | A CONTA FAVORECIDA INFORMADA É DO TIPO SALÁRIO E NÃO PODE RECEBER TRANSFERÊNCIAS PIX. UTILIZE OUTRA CONTA E TENTE NOVAMENTE |
| `932`      | TIPO DE CONTA DO FAVORECIDO INCORRETO. CONFIRME COM O BENEFICIÁRIO O TIPO CORRETO DA CONTA E TENTE NOVAMENTE |
| `988`      | INF-RESERVADO (SSTI 144794 - VALIDADOR DE ARQUIVOS |
| `989`      | INFORMACAO-VALOR                                   |
| `990`      | INFORMACAO-DATA                                    |
| `991`      | INFORMACAO-NOME-FAVORECIDO                         |
| `992`      | USUARIO RECEPCIONADO SEM UTILIZACAO DE TOKEN       |
| `993`      | USUARIO RECEPCIONADO DIFERENTE DO CADASTRADO       |
| `994`      | SEGURANCA DE INTERCAMBIO - MSG1                    |
| `996`      | NOME DA EMPRESA                                    |
| `997`      | AGENCIA , CONTA E DAC                              |
| `998`      | TIPO E CNPJ                                        |
| `999`      | VALOR TOTAL DO LOTE                                |
| `A01`      | LDP - LIMITE DIARIO DE PAGAMENTO EXCEDEU EM:   VVV |
| `A02`      | LDP - EXCEDEU TAMBEM EM OUTROS DIAS.CONTATE SEU GE |
| `B03`      | TRANSAÇÃO ABORTADA POR EXCEDER O TEMPO LIMITE.     |
| `B04`      | TRANSAÇÃO ABORTADA POR ERRO INESPERADO.            |
| `C02`      | NÚMERO DA CONTA DO DEBITADO INVÁLIDA.              |
| `C03`      | NÚMERO DA CONTA DO CREDITADO INVÁLIDA.             |
| `C05`      | CONTA DO DÉBITO ENCERRADA.                         |
| `C06`      | CONTA DO DEBITADO OU CRÉDITADO ESTÁ BLOQUEADA.     |
| `C07`      | CONTA DO CRÉDITO ENCERRADA.                        |
| `C08`      | AGÊNCIA INVÁLIDA.                                  |
| `C13`      | TIPO DA CONTA DE DÉBITO INVÁLIDO                   |
| `C14`      | TIPO DA CONTA DE CRÉDITO INVÁLIDO                  |
| `D05`      | ERRO GENÉRICO NO PROCESSAMENTO DA TRANSAÇÃO        |
| `D06`      | SPI ESTÁ INDISPONIVEL                              |
| `G02`      | CÓDIGO ISPB INVÁLIDO                               |
| `G03`      | TRANSAÇÃO NÃO SUPORTADA OU NÃO AUTORIZADA.         |
| `G07`      | TRANSAÇÃO NÃO SUPORTADA OU NÃO AUTORIZADA.         |
| `M01`      | TRANSAÇÃO FORA DA GRADE DE HORÁRIO ACORDADA        |
| `M03`      | CÓDIGO MOEDA INVÁLIDA                              |
| `M04`      | SALDO INSUFICIENTE                                 |
| `M12`      | VALOR DA TRANSAÇÃO INVÁLIDO.                       |
| `M21`      | VALOR LIMITE PARA A TRANSAÇÃO FOI EXCEDIDO.        |
| `T01`      | DATA DA TRANSAÇÃO INVÁLIDA                         |
| `U03`      | TRANSAÇÃO JÁ PROCESSADA.                           |
| `AM04`     | A TRANSAÇÃO ESTÁ PENDENTE POR FALTA DE SALDO. TRANSFIRA O VALOR NECESSÁRIO ANTES DAS 23H45 PRA CONCLUI-LA AINDA HOJE  |
| `AG03`     | O TIPO DA CONTA DO BENEFICIÁRIO NÃO ACEITA ESSE TIPO DE TRANSAÇÃO. POR FAVOR, ENTRE EM CONTATO COM O BENEFICIÁRIO     |
| `AB03`     | SUA TRANSAÇÃO NÃO FOI CONCLUÍDA DEVIDO À UMA INDISPONIBILIDADE TEMPORÁRIA. POR FAVOR, TENTE NOVAMENTE MAIS TARDE      |
| `AC14`     | O TIPO INFORMADO DA CONTA DO BENEFICIÁRIO ESTÁ INCORRETO. AJUSTE ESSE DADO ANTES DE FAZER A TRANSAÇÃO NOVAMENTE       |
| `BE01`     | CPF/CNPJ DO USUÁRIO RECEBEDOR NÃO É CONSISTENTE COM O TITULAR DA CONTA TRANSACIONAL ESPECIFICADA.                     |
| `BE17`     | O QR CODE ESTÁ COM ERRO OU JÁ EXPIROU. POR FAVOR, PEÇA AO BENEFICIÁRIO PRA GERAR UM NOVO QR CODE                      |
| `AB09`     | O BANCO RECEBEDOR ESTÁ COM INDISPONIBILIDADE NO MOMENTO. POR FAVOR, TENTE NOVAMENTE MAIS TARDE                        |
| `DS04`     | O BANCO RECEBEDOR ESTÁ COM INDISPONIBILIDADE NO MOMENTO. POR FAVOR, TENTE NOVAMENTE MAIS TARDE                        |
| `CH11`     | CPF OU CNPJ DO BENEFICIÁRIO INCORRETO. POR FAVOR, VERIFIQUE AS INFORMAÇÕES E TENTE NOVAMENTE                          |
| `AB11`     | ESTAMOS COM UMA INDISPONIBILIDADE TEMPORÁRIA. POR FAVOR, TENTE NOVAMENTE MAIS TARDE                                   |
| `FF08`     | O SISTEMA PIX ESTÁ INDISPONÍVEL NO MOMENTO. POR FAVOR, TENTE NOVAMENTE MAIS TARDE                                     |
| `AC03`     | A CONTA INFORMADA ESTÁ INCORRETA. POR FAVOR, REVISE OS DADOS E TENTE NOVAMENTE                                        |
| `CH16`     | TIVEMOS UM ERRO NA TRANSAÇÃO. POR FAVOR, TENTE NOVAMENTE MAIS TARDE                                                   |
| `AM12`     | TIVEMOS UM ERRO NA TRANSAÇÃO. POR FAVOR, TENTE NOVAMENTE MAIS TARDE                                                   |
| `AM18`     | TIVEMOS UM ERRO NA TRANSAÇÃO. POR FAVOR, TENTE NOVAMENTE MAIS TARDE                                                   |

