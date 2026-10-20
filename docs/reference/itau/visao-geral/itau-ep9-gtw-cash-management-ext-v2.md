# API Boletos - Emissão e Instrução (v2.75.150)

Fonte: https://devportal.itau.com.br/nossas-apis/itau-ep9-gtw-cash-management-ext-v2 (aba visão geral, atualizada em 2026-10-09T04:08:39.000Z)
Sandbox: https://sandbox.devportal.itau.com.br/itau-ep9-gtw-cash-management-ext-v2/v2
Spec: ../openapi/itau-ep9-gtw-cash-management-ext-v2.json

---



**Atualização de segurança e vencimento de certificados até 15/09**

Com o objetivo de aumentar a segurança das comunicações e assegurar a continuidade das integrações com nossas APIs, é necessário que sua equipe realize as seguintes adequações:

+ Atualizar a cadeia de certificados, adicionando a nova Root CA e o novo certificado intermediário ao truststore ou keystore da aplicação. Durante o período de transição, recomendamos manter também a cadeia atual, garantindo uma migração segura e sem impacto para a operação.

+ Liberar os novos ranges de IP nos firewalls dos ambientes consumidores. Essa atualização é necessária para manter a comunicação segura e contínua com a infraestrutura, mesmo que as URLs atualmente utilizadas permaneçam inalteradas.

+ Atualizar as URLs das APIs que passarão a utilizar novos endereços de conexão, assegurando que as integrações continuem operando normalmente após a evolução da infraestrutura.

Consulte o passo a passo na rota: Comunicados > Atualização de segurança e Vencimento de certificados ou pelo link: https://devportal.itau.com.br/certificados-apis-expiracao-2026

## **sobre a API**
A solução de Cobrança Itaú através de API visa reinventar a experiência de recebimento pelas suas vendas e/ou serviços prestados com a emissão de boletos. Ela oferece agilidade operacional no recebimento das vendas ou serviços prestados por sua empresa, oferecendo soluções que tragam flexibilidade ao pagador, e com ferramentas de conciliação que dão rapidez ao processo de identificação e liberação de pedidos.

Com as APIs de Boletos do Itaú, a sua empresa terá o máximo em agilidade e segurança para emitir, comandar instruções e alterações, além de consultar o status de seus boletos. 

Nessa documentação, iremos apresentar todo o passo a passo para desenvolvimento dessa solução que ajudará sua empresa a ser mais eficiente no processo de recebimento. Consulte sempre essa documentação pois, através dela, disponibilizamos melhorias e evoluções.

O passo a passo descrito abaixo demonstra como é o processo de registro de boletos de cobrança através dessa solução.

| 1                                                                                                       | 2 | 3 |
|---------------------------------------------------------------------------------------------------------|---|---|
| Registro do boleto                                                                                      | Disponiblização ao pagador |	Pagamento do boleto |
| Sua empresa envia o compromisso (individual) ao banco através da API, e o banco registra este na Nuclea | Banco retorna com informação individual do registro do boleto via API, e sua empresa disponibiliza o boleto ao seu cliente no formato desejado | Seu cliente escolhe o canal mais conveniente para realizar o pagamento |

Após emitir um boleto, é possível alterar alguns dados, comandar uma instrução para o boleto ou consulta-lo. Os comandos de instruções podem ser realizados pelo beneficiário (contratante do serviço de Cobrança e quem cedeu os títulos de crédito ao Banco para que esse realizasse a sua cobrança). No entanto, este beneficiário deve estar habilitado a realizar o comando de instrução, ou seja, ter a cobrança contratada, não ter pendência de contrato, não ter a conta migrada e nem sustada.

## **para quem é esta API?**
Para os clientes Itaú e seus respectivos desenvolvedores e/ou equipe de TI envolvidas no processo de emissão, instrução e consulta de boletos.

## **restrições de uso**
A API é destinada apenas para os clientes PJ, correntistas Itaú, e que possuem as credenciais validas junto ao Itaú.
Importante reforçar que a credencial é concedida por CNPJ e que deve ser o mesmo CNPJ cadastrado na conta corrente a qual será registrado o boleto.

## **conhecimentos técnicos necessários**
Conhecimentos prévios necessários:

`HTTP` `JSON` `Postman`

## **quais necessidades que essa API ajuda a resolver?**
Orientar os clientes quanto as regras de negócios e formatação de um request para registrar o boleto no Itaú.

## **tempo aproximado para integração**
**2 dias:** essa é a média de tempo que um desenvolvedor pode levar para preparar toda a integração com essa API. Isso pode variar de acordo com o tamanho do time e experiência dos desenvolvedores envolvidos.

### Autenticação
Para começar a sua jornada de desenvolvimento é importante que o ambiente esteja preparado e configurado para realizar os testes e suportar o desenvolvimento da aplicação de maneira segura. Nosso modelo de comunicação atual requer a autenticação do parceiro através do fluxo **OAuth 2.0**.

## Fluxo de autenticação – OAuth 2.0 (Private KeyJWT e Mutual-TLS Client Authentication)

Os fluxos de autenticação do OAuth 2.0 são baseados em obtenção de *access_tokens* que permitem a autenticação e autorização das APIs. O método previsto para as APIS do PIX do Itaú é o *Private Key JWT Client Authentication (private_key_jwt)* que consiste em autenticação no fluxo *client_credentials* baseada em chaves (privada e pública).

Ambas as chaves são criadas pelo desenvolvedor que irá integrar com as APIs do Itaú. A chave privada, deve ser criada e armazenada de maneira segura dentro do ambiente da aplicação que consumirá as APIs e é utilizada para assinar todas as obtenções de *access_tokens*. A chave pública deve ser exposta em um terminal de configuração descoberta *(well-known endpoint)* em uma sessão específica conhecida como *jwks_uri  (JSON Web Key Sets – URI)*.   A *jwks_uri* deve ser informada para o agente comercial Itaú no momento da contratação. Saiba mais em https://auth0.com/docs/tokens/json-web-tokens/json-web-key-sets

Para estabelecer conexão segura com os API Gateways do Itaú é necessário enviar um *client certificate*. Este certificado é usado para estabelecer o *mTLS (OAuth 2.0 Mutual Transport Layer Security* - https://tools.ietf.org/html/rfc8705):

**1**.	A partir de um *client_id* e <u>token temporário para ativação</u>, ambos fornecidos pelo agente comercial após a contratação, o desenvolvedor gera um arquivo CSR *(Certificate Signing Request)* baseado em um *template* e documentação será fornecida no nosso Portal do Desenvolvedor;

**2**.	O desenvolvedor solicita um certificado assinado pelo Itaú (CRT – *Certificate File*) , através de uma API informando o CSR e token temporário de ativação;

**3**.	O desenvolvedor configura sua aplicação com o arquivo CRT, que será utilizado junto com o *private_key_jwt* para a obtenção de *access_tokens* e junto com o *access_token* para todas as chamadas de APIs. Lembrando que o access_token deve ser informado no header Authorization acrescentando a palavra Bearer.

**4**.	A renovação automática e revogação estão também documentadas no Portal do Desenvolvedor.

**5**.	Preferencialmente, todos os caracteres devem ser maiúsculos. Não aceitamos a utilização de caracteres especiais (ex: * !   á   é  í  ú  ó  à  è   ì   ò   /   º   ª   -   *   &   !   (  a  )  &  ª  º   +  :  '  ;  °  ½   ¾ %   ±    ¥    ð    Ð    ×    ¦    ¿    ¶    ø    Ø    #    ©    ?    ¢    ß   ®   ç  ¯    '    ´    <    =    >    $    @    µ    £  `   |   ¡    §    æ    Æ    ý    Ý   °   þ    Þ   ·    ¹    ²    ³    ;    ´    ¨ http “ , “ javascript “ , “ alert “) e acentuação gráfica (ex.: “Á”, “É”, “Ê”, etc) e os campos não utilizados deverão ser preenchidos com brancos.

## **URLs**
Para garantir uma integração segura, as funcionalidades da API estão disponíveis nas seguintes URLs:

| ambiente    | endpoint                         | path                                                                  |
| ---------   |----------------------------------|-----------------------------------------------------------------------|                    
| sandbox     | https://api.gateway.itau.com.br/ | sandbox/ca-validation/itau-ep9-gtw-cash-management-ext-v2/v2          |
| produção    | https://api.gateway.itau.com.br/ | cash_management/v2                                                    |

## **Endpoints**
| ambiente    | endpoint                         | path                                                                  |
| ---------   |----------------------------------|-----------------------------------------------------------------------|                    
| sandbox     | https://api.gateway.itau.com.br/ | sandbox/ca-validation/itau-ep9-gtw-cash-management-ext-v2/v2          |
| produção    | https://api.gateway.itau.com.br/ | cash_management/v2                                                    |

Todas as requisições devem usar o *schema https* por questões de segurança.

### Parâmetros comuns de cabeçalho
Para consumo das APIs do Itaú, alguns parâmetros de cabeçalho são necessários:

*x-itau-apikey*

O *x-itau-apikey* é um parâmetro que será requerido em todas as chamadas das APIs que contemplam essa solução. A informação que deve ser usada nesse campo é o código gerado através da autenticação OAuth 2.0 para o client_id. Para saber como gerar o client_id ou como recuperar as informações de códigos já gerados basta acessar a etapa de ‘autenticação’ desse tutorial.

*x-itau-flowID*

A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. Recomenda-se mandar um uuid version 4 nesse campo como: b47ec51b-b2a7-4a78-933c-f0b67667e7dc.

*x-itau-correlationID*

A implementação de um correlationID permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes, conseguindo fornecer um mapeamento de ponta-a-ponta. Por exemplo, uma aplicação client gera uma chamada à API, neste momento fornecendo o correlationID gerado pelo consumidor, o qual é repassado em todas as camadas/microserviços que a api precisa para realizar determinada funcionalidade. É importante lembrar que o header x-itau-correlationID deve sempre ser diferente a cada requisição. É obrigatório mandar um uuid version 4 nesse campo como exemplo: a1e64241-7fdb-4d05-a7f6-c44febcdd8d9.

### Body:
Campos de entrada descritos nas outras seções.

## **Padrões de erros**
Essa API retorna códigos de status HTTP para indicar sucesso ou falhas das requisições.

Códigos **2xx** indicam sucesso.

Códigos **4xx** indicam falhas causadas pelas informações enviadas pelo cliente ou pelo estado atual das entidades.

Códigos **5xx** indicam problemas no serviço no lado da API.

As respostas de erro incluem no corpo detalhes do erro e o campo type identifica o tipo de erro.

Abaixo estão listados os tipos de erro que podem ser retornados por quaisquer endpoints listados nessa documentação.

| HTTP Status Code          | Descrição               | Significado                                                                                      |
|---------------------------|-------------------------|--------------------------------------------------------------------------------------------------|                     
| 201 Created               | Created                 | o recurso foi criado de forma síncrona                                                           |
| 204 No Content            | NoContent               | alteração/instrução realizada com sucesso                                                        |
| 400 Bad Request           | Bad Request             | requisição inválida                                                                              |
| 401 Unauthorized          | Não Autorizado          | não autorizada                                                                                   |
| 403 Forbidden             | Acesso Negado           | requisição de participante autenticado que viola alguma regra de autorização                     |
| 404 Not Found	            | Nao Encontrado          | recurso inexistente                                                                              |
| 405 Method Not Allowed    | Método não permitido    | indica tentativa de usar um método não permitido                                                 |
| 422 Unprocessable Entity  | Entidade não processada | dados informados estão fora do escopo definido para o campo                                      |
| 428 Precondition Required | Pré-condição necessária | indica que o servidor precisa de uma solicitação condicional                                     |
| 500 Internal Server Error | Erro inesperado         | indica que o servidor encontrou um problema inesperado e não foi capaz de atender à solicitação  |
| 501 Not Implemented       | Não implementado        | indica que o servidor não oferece suporte à funcionalidade necessária para atender à solicitação |
| 503 Serviço indisponível  | Serviço indisponível    | indica que o servidor não está preparado para processar uma solicitação.                         |

### Parâmetros comuns de cabeçalho
Para consumo das APIs do Itaú, alguns parâmetros de cabeçalho são necessários:

*x-itau-apikey*

O *x-itau-apikey* é um parâmetro que será requerido em todas as chamadas das APIs que contemplam essa solução. A informação que deve ser usada nesse campo é o código gerado através da autenticação OAuth 2.0 para o client_id. Para saber como gerar o client_id ou como recuperar as informações de códigos já gerados basta acessar a etapa de ‘autenticação’ desse tutorial.

*x-itau-flowID*

A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. Recomenda-se mandar um uuid version 4 nesse campo como: b47ec51b-b2a7-4a78-933c-f0b67667e7dc.

*x-itau-correlationID*

A implementação de um correlationID permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes, conseguindo fornecer um mapeamento de ponta-a-ponta. Por exemplo, uma aplicação client gera uma chamada à API, neste momento fornecendo o correlationID gerado pelo consumidor, o qual é repassado em todas as camadas/microserviços que a api precisa para realizar determinada funcionalidade. É importante lembrar que o header x-itau-correlationID deve sempre ser diferente a cada requisição. É obrigatório mandar um uuid version 4 nesse campo como exemplo: a1e64241-7fdb-4d05-a7f6-c44febcdd8d9.

### Body:
Campos de entrada descritos nas outras seções.

|| API de Emissão de boleto |
Os itens a seguir detalham as informações necessárias para a emissão de boletos de Cobrança Itaú.

Mantenha a guarda dos documentos comprobatórios que dão origem aos boletos emitidos por 10 anos, pois poderão ser solicitados a qualquer momento.

Garanta que os dados constantes no registro do boleto e no contrato de venda do produto ou serviço a que se refere o boleto emitido estejam corretos.

O CPF e/ou CNPJ do pagador e beneficiário final indicado deve constar como ativo/regular na Receita Federal.

Para endereço, a responsabilidade do dado estar correto é do cliente. O Itaú valida se estão preenchidos com algum caracter: logradouro, bairro e cidade; CEP com 8 números e informado uma Unidade Federativa.

Atenção: Para que os serviços de negativação expressa, protesto, cálculo de encargos em dias úteis sejam efetivados, o endereço deve estar conforme consta no site dos Correio.

***Conceitos figuras do Boleto***

+ **Beneficiário** – emissor do boleto e beneficiário dos recursos oriundos do pagamento do boleto quando a cobrança não for emitida por meio do terceiro habilitador.
+ **Pagador** – quem deverá realizar o pagamento do boleto.
+ **Sacador Avalista (atual Beneficiário Final)** – figura que receberá o crédito referente ao pagamento do boleto devido a prestação de serviço ou venda de produto ao pagador. O preenchimento do presente campo, no boleto, apenas deve ser realizado nos casos em que o Beneficiário figura como Terceiro Habilitador.
+ **Terceiro habilitador** – beneficiário que emite boletos para viabilizar o recebimento de recursos através do pagamento de boletos para outras pessoas/empresas.

***Atenção!***

**Sacador Avalista**: Essa figura deixou de existir desde a vigência da Circular nº 3.956 do Banco Central do Brasil. Ao emitir o boleto, atenção para indicar as figuras corretas. Nesta documentação, todos os campos que citarem o sacador avalista deve-se considerar Sacador Avalista (atual Beneficiário Final). Estamos ajustando o termo sistemicamente e em breve, será atualizado.

**Beneficiário**: O Beneficiário não deve ser o Pagador e nem o Beneficiário final.

**Pagador**: O pagador é igual ao Beneficiário Final quando a espécie do boleto for Boleto Depósito Aporte, as demais espécies, caso tenha um beneficiário final, será uma terceira pessoa/empresa.

## Emitir boleto

### [POST] /cash_management/v2/boletos

API responsável por efetuar a emissão de um boleto. A emissão consiste na ação de efetuar o registro do boleto, o comando de emissão é realizado pelo beneficiário, contratante do serviço de Cobrança.

A API não efetua a validação do Cadastro de Beneficiário, sendo assim, será necessário adicionar as instruções na requisição.

A seguir estão expostos os parâmetros exigidos por essa API e a descrição deles. Para obter mais informações de onde conseguir o x-itau-apikey, e o x-itau-correlationID, acesse o tópico ‘Informações necessárias’.

### Parâmetros

| **Parâmetro**        | **Tipo Parâmetro** | **Tipo Dado** | **Obrigatório** | **Descrição**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 
|----------------------|--------------------|---------------|-----------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| x-itau-apikey        | header             | string        | sim             | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 
| x-itau-correlationID | header             | string        | sim             | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes.                                                                                                                                                                                                                                                                                                                                                                                                  | 
| x-itau-flowID        | header             | string        | sim             | A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. | 

## Parâmetros para emissão de boleto
Abaixo você encontrará a descrição de todos os campos, valores, tipos de dados, formatações, objetos e informações necessárias para preenchimento dos parâmetros de entrada da API.

O payload de entrada é composto por campos e objetos obrigatórios mais os opcionais. Os objetos são: Beneficiario, Dado Boleto, Pagador (composto pelos objetos Pessoa e Endereço*), Pessoa (composto pelo objeto Tipo Pessoa), Tipo Pessoa, Endereço, Sacador Avalista (composto pelos objetos Pessoa e Endereço) e Dados Individuais do Boleto. Os objetos opcionais, que devem ter os seus campos obrigatórios incluídos caso sejam utilizados, são: Desconto, Negativação, Protesto, Juros, Multa, Recebimento Divergente.

*O bloco de endereço do pagador é opcional, exceto quando o beneficiário possui os serviços de protesto e/ou negativação contratados.

### Body de Entrada
| **Parâmetro**                                                                      | **Obrigatoriedade** | **Tipo**  | **Descrição**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
|------------------------------------------------------------------------------------|---------------------|-----------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| etapa_processo_boleto                                                              | obrigatório         | (String)  | Emissão - 'efetivacao' (usado para ambinte produtivo)   Simulação de Emissão - 'validacao'   (usado para testes)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 
| beneficiario > id_beneficiario                                                     | obrigatório         | (String)  | Agência (4 dígitos) + Conta (7 dígitos) + DAC (1 dígito).   Exemplo: 150000123450                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 
| dado_boleto > descricao_instrumento_cobranca                                       | obrigatório         | (String)  | Tipo de cobrança. Preencher com 'boleto'                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 
| dado_boleto > tipo_boleto                                                          | obrigatório         | (String)  | Deve ser indicado um dos tipos do boleto:   'a vista'   'proposta'     -        Proposta: Este tipo de boleto é utilizado para que seu cliente aceite uma oferta de produto ou serviço, um convite para fazer parte de uma associação ou até mesmo fazer uma doação. Não se esqueça que seu cliente deverá concordar com seu recebimento antes de sua emissão. O pagamento desse boleto não é obrigatório.                                                                                                                                                                                                                                                                                                                           |
| dado_boleto > codigo_carteira                                                      | obrigatório         | (String)  | Deve ser informado algum dos códigos de carteiras disponíveis. Ver "Tabela de Carteiras".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| dado_boleto > codigo_especie                                                       | obrigatório         | (String)  | Espécie do título. Ver "Tabela de Espécies"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| dado_boleto > valor_abatimento                                                     | opcional            | (String)  | Valor do abatimento do título. Este valor não pode superar o valor da cobrança. Este valor que será subtraído do valor total da cobrança. Mesmo vencida, a cobrança será paga com abatimento.   Formato do campo: 15 dígitos inteiros e 2 casas decimais                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| dado_boleto > data_emissao                                                         | opcional            | (String)  | Data efetiva da transação comercial entre beneficiário e pagador. Pode ser igual ou menor a data de vencimento, mas não deve ser maior que a data de vencimento. Formato: AAAA-MM-DD. Caso a data de emissão informada seja posterior ao vencimento, será atribuída a data do registro para esse campo.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| dado_boleto > pagamento_parcial                                                    | opcional            | (boolean) | Indicador de pagamento parcial. Caso não seja enviado, assume-se o padrão 'false'.    'true' - Aceita pagamento parcial.    'false' - Não aceita pagamento parcial.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| dado_boleto > quantidade_maximo_parcial                                            | opcional            | (Integer) | Obrigatório envio apenas quando indicado pagamento_parcial = true. Quantidade permitida de pagamentos parciais da cobrança, valor deve ser entre 1 e 99. Em caso de pagamento_parcial = false, não enviar o atributo de quantidade_maximo_parcial.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| dado_boleto > forma_envio                                                          | opcional            | (String)  | Deve ser indicado um dos tipos 'impressao' ou 'email'. Caso seja informado 'email', é obrigatório informar o campo dado_boleto > pagador > texto_endereco_email com um endereço de e-mail válido. Quando informado "e-mail" o campo "texto_endereco_email" se torna obrigatório, será realizado o envio do boleto, anexo ao e-mail informado nesse campo.                                                                                                                                                                                                                                                                                                                                                                            |
| dado_boleto > pagador > texto_endereço_email                                       | opcional            | (String)  | Caso seja informado 'email' no campo dado_boleto > forma_envio, é obrigatório informar um e-mail válido no campo dado_boleto > pagador > texto_endereço_email. Máximo caracteres: 250. É possível informar até três e-mails sparados por um ";", o primeiro endereço informado será atribuído como destinatário e os demais como cópia oculta, desde que respeitado o limite de 250 caracteres.                                                                                                                                                                                                                                                                                                                                      |
| dado_boleto > assunto_email                                                        | opcional            | (String)  | O campo pode ser preenchido de forma personalizada. Máximo caracteres: 50                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| dado_boleto > mensagem_email                                                       | opcional            | (String)  | O campo pode ser preenchido de forma personalizada. Máximo caracteres: 200                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| dado_boleto > lista_mensagem_cobranca > mensagens                                  | opcional            | (String)  | Pode ser enviado até 3 mensagens com até 50 caracteres. Caso na requisição seja enviado o e-mail do pagador, adicionaremos as mensagens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| pagador > pessoa > nome_pessoa                                                     | obrigatório         | (String)  | Nome/Razão social do pagador não devem ter abreviações no primeiro e no último nome. Desse modo, as abreviações deverão ocorrer no nome do meio, limitados a 50 caracteres.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 
| pagador > pessoa > tipo_pessoa > codigo_tipo_pessoa                                | obrigatório         | (String)  | Tipo de pessoa do pagador   Pessoa Física - 'F'   Pessoa Jurídica - 'J'                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 
| pagador > pessoa > tipo_pessoa > numero_cadastro_pessoa_fisica                     | opcional            | (String)  | CPF do pagador - Obrigatório caso tipo_pessoa = F com 11 numeros (sem pontos, traços ou barras); não informar o campo caso tipo_pessoa = J. Exemplo: 12345678910                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| pagador > pessoa > tipo_pessoa > numero_cadastro_nacional_pessoa_juridica          | opcional            | (String)  | CNPJ do pagador - Obrigatório caso tipo_pessoa = J com 14 números e/ou letras (sem pontos, traços ou barras); não informar o campo caso tipo_pessoa = F. Exemplo: 12312312EX0110                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| pagador > endereco > nome_logradouro                                               | opcional            | (String)  | Nome do logradouro, número, complemento. Máximo: 45 caracteres. Se informado deve constar conforme site do Correios.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| pagador > endereco > nome_bairro                                                   | opcional            | (String)  | Nome do bairro. Máximo: 15 caracteres. Se informado deve constar conforme site dos Correios.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| pagador > endereco > nome_cidade                                                   | opcional            | (String)  | Nome do bairro. Máximo: 20 caracteres. Se informado deve constar conforme site dos Correios.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| pagador > endereco > sigla_UF                                                      | opcional            | (String)  | Sigla da UF. Máximo: 02 caracteres. Se informado deve constar conforme site dos Correios.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| pagador > endereco > numero_CEP                                                    | opcional            | (String)  | CEP. Formato: 8 números, sem pontos e traços. Se informado deve constar conforme site dos Correios.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| sacador_avalista > pessoa > nome_pessoa                                            | opcional            | (String)  | Nome/Razão social do sacador avalista. Máximo de caracteres: 50.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 
| sacador_avalista > pessoa > tipo_pessoa > codigo_tipo_pessoa                       | opcional            | (String)  | Tipo de pessoa do sacador avalista.   Pessoa Física - 'F'   Pessoa Jurídica - 'J'                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 
| sacador_avalista > pessoa > tipo_pessoa > numero_cadastro_pessoa_fisica            | opcional            | (String)  | CPF do sacador avalista - Obrigatório caso tipo_pessoa = F com 11 números (sem pontos, traços ou barras); não informar o campo caso tipo_pessoa = J. Exemplo: 12345678910                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| sacador_avalista > pessoa > tipo_pessoa > numero_cadastro_nacional_pessoa_juridica | opcional            | (String)  | CNPJ do sacador avalista - Obrigatório caso tipo_pessoa = J com 14 números e/ou letras (sem pontos, traços ou barras); não informar o campo caso tipo_pessoa = F. Exemplo: 12312312EX0110                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| sacador_avalista > endereco > nome_logradouro                                      | opcional            | (String)  | Nome do logradouro, número, complemento. Deve estar igual ao site dos Correios. Obrigatório caso o sacador_avalista tenha sido indicado. **Atualmente, o preenchimento é opcional. Em breve será obrigatório quando o sacador avalista for informado** Máximo: 45 caracteres*                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| sacador_avalista > endereco > nome_bairro                                          | opcional            | (String)  | Nome do bairro. Obrigatório caso informe sacador avalista. Deve estar igual ao site dos Correios. **Atualmente, o preenchimento é opcional. Em breve será obrigatório quando o sacador avalista for informado** Máximo: 15 caracteres*                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| sacador_avalista > endereco > nome_cidade                                          | opcional            | (String)  | Nome da cidade. Obrigatório caso informe sacador avalista. Deve estar igual ao site dos Correios. **Atualmente, o preenchimento é opcional. Em breve será obrigatório quando o sacador avalista for informado** Máximo: 20 caracteres*                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| sacador_avalista > endereco > sigla_UF                                             | opcional            | (String)  | Sigla da UF. Obrigatório caso informe sacador avalista. Deve estar igual ao site dos Correios. **Atualmente, o preenchimento é opcional. Em breve será obrigatório quando o sacador avalista for informado** Máximo: 2 caracteres*                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| sacador_avalista > endereco > numero_CEP                                           | opcional            | (String)  | CEP. Obrigatório caso informe sacador avalista. Deve estar igual ao site dos Correios. **Atualmente, o preenchimento é opcional. Em breve será obrigatório quando o sacador avalista for informado** Formato: 8 números, sem pontos e traços                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| dados_individuais_boleto > numero_nosso_numero                                     | opcional            | (String)  | Número de identificação do título. De livre utilização do usuário seguindo as regras da carteira do produto contratado. Não pode ser repetido se nosso número ainda estiver ativo ou tiver menos de 45 dias de sua baixa/liquidação. Nosso número é obrigatório para carteira 109. Máximo: 08 caracteres.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| dados_individuais_boleto > data_vencimento                                         | obrigatório         | (String)  | Data máxima para pagamento do título sem que haja acréscimo de juros e multa.  Formato: AAAA-MM-DD                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| dados_individuais_boleto > valor_titulo                                            | obrigatório         | (String)  | Valor a ser cobrado. Formato do campo: 15 dígitos inteiros e 2 casas decimais                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| dados_individuais_boleto > data_limite_pagamento                                   | opcional            | (String)  | Data limite para pagamento do título. Após esta data, o título não poderá ser pago.  Informar, no mínimo a data de vencimento, e no máximo data futura de 10 anos. Caso não seja informada a data, será assumido como 10 anos. Formato: AAAA-MM-DD. Em breve, caso a data de limite de pagamento informada seja anterior ao vencimento, será atribuída a data de vecimento para esse campo.                                                                                                                                                                                                                                                                                                                                          |
| dados_individuais_boleto > texto_seu_numero                                        | opcional            | (String)  | Seu número é a identificação do boleto que poderá ter letras e números e facilitará a consulta e acompanhamento do status do boleto. Este campo é para controle do cliente e obrigatório em caso de serviço de protesto. Máximo: 10 caracteres*                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| desconto_expresso                                                                  | obrigatório         | (boolean) | Indicador de desconto. Enviar como "false"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| juros > codigo_tipo_juros                                                          | obrigatório         | (String)  | Tipo da cobrança dos juros no cálculo da cobrança. Para cada um dos valores informados, será impresso no boleto a notação referente ao valor correspondente em porcentagem mensal. <br>'05' Quando não se deseja cobrar juros caso o pagamento seja feito após o vencimento (isento)  <br>'90' Percentual mensal (utilizando parâmetros do cadastro de beneficiário para dias úteis ou corridos)  <br>'91' - Percentual diário (utilizando parâmetros do cadastro de beneficiário para dias úteis ou corridos)  <br>'92' - Percentual anual (utilizando parâmetros do cadastro de beneficiário para dias úteis ou corridos)  <br>'93' - Valor diário (utilizando parâmetros do cadastro de beneficiário para dias úteis ou corridos) |
| juros > valor_juros                                                                | opcional            | (String)  | Valor dos juros a ser cobrado. Formato do campo: 15 dígitos inteiros e 2 casas decimais. Exemplo: 99999999999999900. Obrigatório para codigo_tipo_juros ‘93’. Se valor informado ficar inferior à R$ 0,01 ao dia ou acima de 99,99% ao mês / 3,33333% ao dia / 1.199,88% ao ano, o registro do juros será desconsiderado e boleto emitido, sem juros.                                                                                                                                                                                                                                                                                                                                                                                |
| juros > percentual_juros                                                           | opcional            | (String)  | Valor dos juros a ser cobrado. Formato do campo: 7 dígitos inteiros e 5 casas decimais. Exemplo: 999999900000. Obrigatório para codigo_tipo_juros ‘90’, ‘91’ e ‘92’. Se valor informado ficar inferior à R$ 0,01 ao dia ou acima de 99,99% ao mês / 3,33333% ao dia / 1.199,88% ao ano, o registro do juros será desconsiderado e boleto emitido, sem juros.                                                                                                                                                                                                                                                                                                                                                                         |
| juros > data_juros                                                                 | opcional            | (String)  | Data de início de cobrança de juros, deve ser posterior ao vencimento. Caso o campo esteja vazio, será automaticamente assumido que a cobrança de juros se inicia logo após o vencimento.  Formato: AAAA-MM-DD. Em breve, quando informada uma data anterior ao vencimento, será atribuída a data de vencimento ao parâmetro.                                                                                                                                                                                                                                                                                                                                                                                                        |
| multa > codigo_tipo_multa                                                          | obrigatório         | (String)  | Código da multa   '01' - Quando se deseja cobrar um valor fixo de multa após o vencimento.  '02' - Quando se deseja cobrar um percentual do valor do título de multa após o vencimento.  '03' - Quando não se deseja cobrar multa caso o pagamento seja feito após o vencimento (isento)                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| multa > valor_multa                                                                | opcional            | (String)  | Valor da multa a ser cobrada. Formato do campo: 15 dígitos inteiros e 2 casas decimais. Exemplo: 99999999999999900. Obrigatório para codigo_tipo_multa 01. Se valor informado ficar inferior à R$ 0,01 ao dia ou acima de 99,99% ao mês, o registro da multa será desconsiderado e boleto emitido, sem multa.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| multa > percentual_multa                                                           | opcional            | (String)  | Valor dos multa a ser cobrado. Formato do campo: 7 dígitos inteiros e 5 casas decimais. Exemplo: 999999900000. Obrigatório para codigo_tipo_multa 02. Se valor informado ficar inferior à R$ 0,01 ao dia ou acima de 99,99% ao mês, o registro da multa será desconsiderado e boleto                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| multa > data_multa                                                                 | opcional            | (String)  | Data de início de cobrança de multa, deve ser posterior ao vencimento. Caso o campo esteja vazio, será automaticamente assumido que a cobrança de multa se inicia logo após o vencimento.  Formato: AAAA-MM-DD. Em breve, quando informada uma data anterior ao vencimento, será atribuída a data de vencimento ao parâmetro.                                                                                                                                                                                                                                                                                                                                                                                                        |
| desconto > codigo_tipo_desconto                                                    | obrigatório         | (String)  | Código do desconto. Caso exista mais de um desconto, todos os tipo_desconto deverão ter o mesmo código.  '00' - Quando não houver condição de desconto (sem desconto).  '01' - Quando o desconto for um valor fixo se o título for pago até a data informada (data_desconto).  '02' - Quando o desconto for um percentual (mensal) do valor do título e for pago até a data informada (data_desconto).  '90' - Percentual por antecipação (utilizando parâmetros do cadastro de beneficiário para dias úteis ou corridos).  '91' - Valor por antecipação (utilizando parâmetros do cadastro de beneficiário para dias úteis ou corridos).                                                                                            |
| desconto > data_desconto                                                           | opcional            | (Integer) | Data limite de cobrança de desconto, deve ser anterior ou igual ao vencimento. Caso o campo esteja vazio, será automaticamente assumido que a cobrança de desconto é até a data de vencimento.  Formato: AAAA-MM-DD. Obrigatório quando codigo_tipo_desconto é informado e deve ser inserido em ordem decrescente. Em breve, quando informada uma data posterior ao vencimento, será atribuída a data de vencimento ao parâmetro.                                                                                                                                                                                                                                                                                                    |
| desconto > valor_desconto                                                          | opcional            | (String)  | Valor do desconto a ser cobrado. Obrigatório para codigo_tipo_desconto 1 ou 91. Valor calculado deve ser superior a R$0,01. Formato do campo: 15 dígitos inteiros e 2 casas decimais. Obrigatório quando codigo_tipo_desconto é informado. Quando o valor informado for inferior à R$ 0,01 ao dia o parâmetro será ignorado e o boleto emitido, sem desconto.                                                                                                                                                                                                                                                                                                                                                                        |
| desconto > percentual_desconto                                                     | opcional            | (String)  | Percentual do desconto concedido. Obrigatório para codigo_tipo_desconto 2 ou 90. Valor calculado deve ser superior a R$0,01. Formato do campo: 7 dígitos inteiros e 5 casas decimais. Obrigatório quando codigo_tipo_desconto é informado. Quando o valor calculado for inferior à R$ 0,01 ao dia o parâmetro será ignorado e o boleto emitido, sem desconto.                                                                                                                                                                                                                                                                                                                                                                        |
| recebimento_divergente > codigo_tipo_autorizacao                                   | obrigatório         | (String)  | Tipo de autorização de recebimento divergente da cobrança.  "01" - Quando o título aceita qualquer valor divergente ao da cobrança.  "02" - Quando o título contém uma faixa de valores aceitos para recebimentos divergentes.  "03" - Quando o título não deve aceitar pagamentos de valores divergentes ao da cobrança.  "04" - Quando o título aceitar pagamentos de valores superiores ao mínimo definido"                                                                                                                                                                                                                                                                                                                       |
| recebimento_divergente > codigo_tipo_recebimento                                   | opcional            | (String)  | Tipo de autorização de recebimento divergente da cobrança. Obrigatório para codigo_tipo_autorizacao diferente de 01 e 03.   V - Recebimento divergente for informado por valores   P - Recebimento divergente for informado por percentuais                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| recebimento_divergente > valor_minimo                                              | opcional            | (String)  | Valor mínimo permitido para pagamento.  Obrigatório para codigo_aceite_pagamento_divergente 2 ou 4. Formato do campo: 15 dígitos inteiros e 2 casas decimais                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| recebimento_divergente > percentual_minimo                                         | opcional            | (String)  | Percentual mínimo permitido para pagamento.  Obrigatório para codigo_tipo_autorizacao 2 ou 4. Formato do campo: 7 dígitos inteiros e 5 casas decimais                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| recebimento_divergente > valor_maximo                                              | opcional            | (String)  | Valor máximo permitido para pagamento.  Obrigatório para codigo_tipo_autorizacao 2. Formato do campo: 15 dígitos inteiros e 2 casas decimais                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| recebimento_divergente > percentual_maximo                                         | opcional            | (String)  | Percentual máximo permitido.  Obrigatório para codigo_tipo_autorizacao 2. Formato do campo: 7 dígitos inteiros e 5 casas decimais                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| protesto > protesto                                                                | opcional            | (boolean) | Para solicitar o registro da instrução de 'protesto', informar "true". Para solicitar o registro da instrução de 'não protestar', informar "false". Se não tiver interesse em registrar nenhuma instrução relativa a protesto, não enviar o bloco de protesto.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| protesto > quantidade_dias_protesto                                                | opcional            | (Integer) | Em caso de protesto "true" (campo acima) enviar a quantidade de dias, mínimo 1 e máximo 99. Em caso de protesto "false" não enviar quantidade de dias OU enviar valor zero.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| negativacao > negativacao                                                          | opcional            | (boolean) | Em caso de negativação informar "true". Em caso de não negativar não enviar o bloco de negativação.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| negativacao > quantidade_dias_negativacao                                          | opcional            | (Integer) | Em caso de negativação "true" (campo acima) enviar a quantidade de dias, mínimo 2 e máximo 99. Em caso de negativação "false" não enviar o campo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| dados_individuais_boleto > texto_uso_beneficiario                                  | opcional            | (String)  | Campo de 25 caracteres. Deve ser utilizado apenas letras e números. Caso seja preenchido, a informação registrada será devolvida no campo “uso da empresa” do arquivo de retorno CNAB.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| instrucao_cobranca > codigo_instrucao_cobranca                                     | opcional            | (String)  | Códigos das instruções de protesto. Podem ser enviadas até 4 instruções de Recebimentos e até 3 instruções de Cobrança, ou seja, até 7 instruções por boleto. Se houverem mais comandos, iremos descartar um instrução aleatoriamente. Ver "Tabela de Instruções de Recebimentos" e "Tabela de Instruções de Cobrança".                                                                                                                                                                                                                                                                                                                                                                                                              |
| instrucao_cobranca > quantidade_dias_apos_vencimento                               | opcional            | (Integer) | Quantidade de dias após vencimento do boleto, o prazo deve ser entre 01 e 99 dias. Para baixa também é possível 365 dias de vencido.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| instrucao_cobranca > dia_util                                                      | opcional            | (Boolean) | Caso a quantidade de dias após o vencimento tenha que ser contabilizada em dia útil, informar true. Caso tenha que ser contabilizada em dias corridos, informar false. Importante as orientações mencionadas, não são validas para as instruções 7 - “Não receber após XX de vencimento” e 8 – “Cancelar (Baixar/Devolver) após XX de vencimento, o prazo deve ser entre 01 e 99 dias, ou 365 dias de vencido.” **Atenção**: O CEP do pagador e sacador avalista (se houver) precisa estar correto conforme site dos Correios.  Caso não informado será atribuído false/corridos.                                                                                                                                                    |

**A partir de março passamos a truncar os campos de logradouro, bairro e cidade de acordo com o limite de caracteres. Desse modo se for encaminhado um conteúdo maior que o indicado, acateremos o limite e o excedente será ignorado.*

### Body de Saída
O payload de saída da API pode conter os mesmos campos do body de entrada mais os que constam abaixo.

| Parâmetro | Tipo        | Descrição                                                                                                                        |
|-----------|-------------|----------------------------------------------------------------------------------------------------------------------------------|
| codigo_canal_operacao | (String)    | API                                                                                                                              | 
| codigo_operador | (String)    | Agência (4 dígitos) + Conta (5 dígitos)                                                                                          | 
| beneficiario > nome_cobranca | (String)    | Razão social do beneficiário. Máximo caracteres: 50.                                                                             | 
| beneficiario > tipo_pessoa > codigo_tipo_pessoa | obrigatório | (String) Tipo pessoa do beneficiario   Pessoa Física - 'F'   Pessoa Jurídica - 'J'                                               | 
| beneficiario > tipo_pessoa > numero_cadastro_pessoa_fisica | opcional    | (String) CPF do beneficiario - Obrigatório caso tipo_pessoa = F   Exemplo: 12345678910                                           |
| beneficiario > tipo_pessoa > numero_cadastro_nacional_pessoa_juridica | opcional    | (String) CNPJ do beneficiario - Obrigatório caso tipo_pessoa = J   Exemplo: 12312312000110                                       |
| dado_boleto > forma_envio | (String) | 'impressão' 'e-mail'                                                                                                             |
| dado_boleto > codigo_tipo_vencimento | (Integer)   | Tipo de vencimento do boleto.   '3' - Data de vencimento informada pelo cliente                                                  | 
| pagador > pagador_eletronico_DDA | (boolean)   | Indica se o pagador possui cadastro no DDA                                                                                       |
| pagador > praca_protesto | (boolean)   | Indica se o CEP do pagador é de uma praça protestável                                                                            |
| dados_individuais_boleto > id_boleto_individual | (String)    | Identificador do título                                                                                                          |
| dados_individuais_boleto > codigo_barras | (String)    | Número do código de barras                                                                                                       |
| dados_individuais_boleto > numero_linha_digitavel | (String)    | Número da linha digitável                                                                                                        |
| dados_individuais_boleto > texto_uso_beneficiario | (String)    | Campo de 25 caractéres, utilizado na API legado como "identificador_titulo_empresa". Deve ser utilizado apenas letras e números. |
| juros > codigo_tipo_juros | (String)    | O retorno será de acordo com o parâmetros do cadastro de beneficiário para dias úteis ou corridos. <br>Isento - '05' para dias úteis e '05' para dias corridos.  <br>Percentual mensal - '08' para dias úteis e '03' para dias corridos.  <br>Percentual diário - '07' para dias úteis e '02' para dias corridos.  <br>Percentual anual- '09' para dias úteis e '04' para dias corridos.  <br>Valor diário - '06' para dias úteis e '01' para dias corridos.    |

### Tabela de Instruções de Cobrança
| Código | Instrução                                                                                                      |
|--------|----------------------------------------------------------------------------------------------------------------|
| 01     | Protestar                                                                                                      |
| 02     | Negativar                                                                                                      |
| 04     | Não protestar                                                                                                  |
| 05     | Não negativar                                                                                                  |
| 07     | Não receber após XX de vencimento                                                                              |
| 08     | Cancelar (Baixar/Devolver) após XX de vencimento, o prazo deve ser entre 01 e 99 dias, ou 365 dias de vencido. |

### Tabela de Instruções de Recebimentos
| Código | Instrução                   |
|--------|-----------------------------|
| 05     | Juros - Isento              |
| 91     | Juros - Percentual diário   |
| 92     | Juros - Percentual anual    |
| 93     | Juros - Valor diário        |
| 01     | Multa - Valor fixo          |
| 02     | Multa - Percentual          |
| 03     | Multa - Isento              |
|        | Abatimento                  |
|        | Desconto * até 3 por boleto |

### Tabela de Carteiras
| **Carteira** | **Descrição**                        | **Vencimento Mínimo** | **Vencimento Máximo**  |
|--------------|--------------------------------------|----------------------|------------------------|
| 109          | Direta entrega do boleto pelo cliente| 1 ano (-360)         | 10 anos (+3650)        |
| 148          | Direta Emissão com IOF 0,38%         | 1 ano (-360)         | 10 anos (+3650)        |
| 153          | Direta Emissão com IOF 7,38%         | 1 ano (-360)         | 10 anos (+3650)        |
| 175          | Direta entrega do boleto pelo cliente| 1 ano (-360)         | 10 anos (+3650)        |
| 176          | E-commerce                           | 5 dias (-5)          | 1 ano (+365)           |
| 198          | Direta Emissao cliente 15 digitos    | 1 ano (-360)         | 10 anos (+3650)        |

Atenção:  
Carteiras 148, 153, 176 e 198 não podem emitir boletos com Pix (bolecode).  
As carteiras IOF 148 e 153 serão descontinuadas em 01/01/2027, em razão das adequações decorrentes da Emenda Constitucional nº 132/2023.

### Tabela de Espécies
| Código | Sigla | Descrição da espécie                                        |
|--------|-------|-------------------------------------------------------------|
| 01     | DM    | Duplicata de Venda Mercantil                                |
| 02     | NP    | Nota Promissória                                            |
| 03     | NS    | Nota de Seguro                                              |
| 04     | ME    | Mensalidade Escolar                                         |
| 05     | RC    | Recibo                                                      |
| 06     | CT    | Contrato                                                    |
| 08     | DS    | Duplicata de Prestação de Serviços Original                 |
| 09     | LC    | Letra de Câmbio                                             |
| 15     | DD    | Documento de Dívida                                         |
| 16     | EC    | Encargos Condominais                                        |
| 17     | FS    | Fatura de Serviço                                           |
| 18     | BDP   | Boleto Proposta (nota 1)                                    |
| 33     | BDA   | Boleto Depósito Aporte (nota 2)                             |
| 88     | CBI   | Cédula de Crédito Bancário por Indicação                    |
| 89     | CC    | Contrato de Câmbio                                          |
| 90     | CCB   | Cédula de Crédito Bancário                                  |
| 91     | CD    | Confissão de Dívida                                         |
| 92     | CH    | Cheque                                                      |
| 93     | CM    | Contrato de Mútuo                                           |
| 94     | CPS   | Conta de Prestação de Serviços                              |
| 95     | DMI   | Duplicata de Venda Mercantil por Indicação                  |
| 96     | DSI   | Duplicata de Prestação de Serviços - Original Por Indicação |
| 97     | RA    | Recibo de Aluguel (PJ)                                      |
| 98     | TA    | Termo de acordo                                             |
| 99     | DV    | Diversos                                                    |

*Nota 1* - Para Boleto Proposta (BDP) é obrigatório colocar a mensagem ao pagador:
“Este boleto se refere a uma proposta já feita à você e seu pagamento não é obrigatório.
Deixar de pagá-lo não dará causa a protesto, cobrança judicial ou extrajudicial, nem a inserção de seu nome em cadastro de restrição de crédito.
Pagar até a data de vencimento significa aceitar a proposta. Informações adicionais sobre a proposta e sobre o respectivo contrato poderão ser solicitadas a qualquer momento ao beneficiário, por meio de seus canais de atendimento.”

*Nota 2* – Para Boleto Depósito Aporte é obrigatório registrar os dados do pagador e beneficiário final com os mesmos dados.

### Exemplo de entrada

+ **POST /cash_management/v2/boletos**

Todos os campos da requisição devem estar posicionados dentro do bloco de informação correspondente conforme exemplo abaixo.
Por motivos de segurança, desconsideramos a informação que é encaminhada desposicionada.

Obs: O bloco referente a **endereço do pagador e todos os seus campos** são obrigatórios apenas quando o beneficiário possui os serviços de protesto e/ou negativação contratados. Quando um desses serviços não está habilitado, esse bloco e todos os seus campos tornam-se opcional para a emissão do boleto.

**Body:**
```json
{
  "data": {
    "etapa_processo_boleto": "efetivacao",
    "codigo_canal_operacao": "API",
    "beneficiario": {
      "id_beneficiario": "id_beneficiario"
    },
    "dado_boleto": {
      "descricao_instrumento_cobranca": "boleto",
      "forma_envio": "email",
      "assunto_email": "Assunto do e-mail",
      "mensagem_email": "Texto para enviar ao cliente",
      "tipo_boleto": "a vista",
      "codigo_carteira": "109",
      "valor_titulo": "00000000000001000",
      "codigo_especie": "01",
      "valor_abatimento": "000",
      "data_emissao": "2022-12-21",
      "pagamento_parcial": true,
      "quantidade_maximo_parcial": 2,
      "pagador": {
        "texto_endereco_email": "exemplo@itau.com.br",
        "pessoa": {
          "nome_pessoa": "Pessoa teste",
          "tipo_pessoa": {
            "codigo_tipo_pessoa": "F",
            "numero_cadastro_pessoa_fisica": "cpf_cnpj_pagador"
          }
        },
        "endereco": {
          "nome_logradouro": "Rua endereço,71",
          "nome_bairro": "Bairro",
          "nome_cidade": "Cidade",
          "sigla_UF": "PE",
          "numero_CEP": "51340540"
        }
      },
      "dados_individuais_boleto": [
        {
          "numero_nosso_numero": "20000000",
          "data_vencimento": "2023-01-14",
          "valor_titulo": "00000000000119900",
          "texto_uso_beneficiario": "2",
          "texto_seu_numero": "2"
        }
      ],
      "multa": {
        "codigo_tipo_multa": "02",
        "data_multa": "2024-09-21",
        "percentual_multa": "000000100000"
      },
      "juros": {
        "codigo_tipo_juros": 90,
        "data_juros": "2024-09-21",
        "percentual_juros": "000000100000"
      },
      "recebimento_divergente": {
        "codigo_tipo_autorizacao": "01"
      },
      "instrucao_cobranca": [
        {
          "codigo_instrucao_cobranca": "2",
          "quantidade_dias_apos_vencimento": 10,
          "dia_util": false
        }
      ],
      "protesto": {
        "protesto": true,
        "quantidade_dias_protesto": 10
      },
      "desconto_expresso": false
    }
  }
}

```

### Códigos de Resposta
| Código de Status | Descrição                                                                                                                         |
|------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| `200`            | Boleto simulado ou emitido e registrado com sucesso                                                                               |
| `202`            | Operação em andamento, consulte seu boleto em instantes                                                                           |
| `204`            | Emissão de cobrança realizada com sucesso                                                                                         |
| `400`            | Parâmetros incorretos                                                                                                             |
| `401`            | Não autorizado                                                                                                                    |
| `403`            | Acesso proibido                                                                                                                   |
| `404`            | Recurso inexistente                                                                                                               |
| `405`            | Método não permitido                                                                                                              |
| `422`            | Dados informados estão fora do escopo definido para o campo                                                                       |
| `428`            | Pré-requisito necessário                                                                                                          |
| `500`            | Erro inesperado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente.          |
| `501`            | Não implementado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente.         |
| `503`            | Serviço indisponível, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente.     |
| `504`            | Time Out, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente.                 |

### Exemplo de saída

+ (status = 200, application/json)

```json
{
  "headers": [],
  "status": 200,
  "content": {
      "data": {
        "codigo_canal_operacao": "API",
        "codigo_operador": "889911348",
        "etapa_processo_boleto": "efetivacao",
        "beneficiario": {
          "id_beneficiario": "150000052061",
          "nome_cobranca": nome_beneficiario,
          "tipo_pessoa": {
            "codigo_tipo_pessoa": "J",
            "numero_cadastro_nacional_pessoa_juridica": cpf_cnpj_beneficiario
          },
          "endereco": {
            "nome_logradouro": "R PORTUGAL, 13, EDF T NOVO 1 AN",
            "nome_bairro": "COMERCIO",
            "nome_cidade": "SALVADOR",
            "sigla_UF": "BA",
            "numero_CEP": "40015000"
          }
        },
        "dado_boleto": {
          "descricao_instrumento_cobranca": "boleto",
          "forma_envio": "email",
          "assunto_email": "Assunto do e-mail",
          "mensagem_email": "Texto para enviar ao cliente",
          "tipo_boleto": "a vista",
          "pagador": {
            "texto_endereco_email": "exemplo@itau.com.br",
            "pessoa": {
              "nome_pessoa": "Nubibat",
              "tipo_pessoa": {
                "codigo_tipo_pessoa": "F",
                "numero_cadastro_pessoa_fisica": cpf_pagador
              }
            },
            "endereco": {
              "nome_logradouro": "Av Hilario Pereira de Souza, 492",
              "nome_bairro": " ",
              "nome_cidade": "Osasco",
              "sigla_UF": "SP",
              "numero_CEP": "04131020"
            },
            "pagador_eletronico_DDA": false,
            "praca_protesto": true
          },
          "sacador_avalista": {
            "pessoa": {
              "nome_pessoa": "Sacador Teste",
              "nome_fantasia": "Empresa A",
              "tipo_pessoa": {
                "codigo_tipo_pessoa": "F",
                "numero_cadastro_pessoa_fisica": "38365972840"
              }
            },
            "endereco": {
              "nome_logradouro": "Av do Estado, 55343",
              "nome_bairro": "Ipiranga",
              "nome_cidade": "São Paulo",
              "sigla_UF": "SP",
              "numero_CEP": "06120100"
            }
          },
          "codigo_carteira": "109",
          "codigo_tipo_vencimento": 3,
          "valor_titulo": "00000000000010001",
          "dados_individuais_boleto": [
            {
              "id_boleto_individual": "a6e48c70-5bc4-492e-b7d8-eb65c056a1bb",
              "numero_nosso_numero": "00001046",
              "dac_titulo": "9",
              "data_vencimento": "2021-06-01",
              "valor_titulo": "00000000000010001",
              "codigo_barras": "34194863800000100011570000104691500052061000",
              "numero_linha_digitavel": "34191570070010469150600520610007486380000010001",
              "data_limite_pagamento": "2031-06-01",
              "lista_mensagens_cobranca": []
            }
          ],
          "juros": {
            "codigo_tipo_juros": "03",
            "data_juros": "2021-06-02",
            "percentual_juros": "000000100000"
          },
          "codigo_especie": "01",
          "data_emissao": "2021-05-25",
          "pagamento_parcial": false,
          "quantidade_maximo_parcial": "0",
          "lista_mensagem_cobranca": [
            {
              "mensagem": "jaime3 desconto fixo percentual"
            },
            {
              "mensagem": "teste2"
            }
          ],
          "recebimento_divergente": {
            "codigo_tipo_autorizacao": "03",
            "codigo_tipo_recebimento": "P",
            "percentual_minimo": "00000000000000000",
            "percentual_maximo": "00000000000000000"
          },
          "desconto_expresso": "{{body_dado_boleto_desconto_expresso}}"
        }
      }
  }
}
```
+ (status = 202, application/json)

```json
{
	"codigo": "202",
	"mensagem": "Operação em andamento, consulte seu boleto em instantes"
}
```

|| API de Alterações e Instruções de Cobrança |
Os itens a seguir detalham quais chamadas são possíveis, bem como a responsabilidade de cada uma destas quanto suas possibilidades de alteração ou instruções permitidas nos boletos de Cobrança Itaú.

### Exemplos de saída comuns aos endpoints de instrução

Obs: Exemplos não replicáveis na virtualização

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "idBoleto",
    "mensagem": "Agência do beneficiário inválida",
    "valor": "00000005201415600000070"
  }]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "idBoleto",
    "mensagem": "Conta Corrente do beneficiário inválida",
    "valor": "15000000000215600000070"
  }]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "idBoleto",
    "mensagem": "Código da carteira inválido",
    "valor": "15000005201200000000070"
  }]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "idBoleto",
    "mensagem": "Nosso número inválido",
    "valor": "15000005201215600000000"
  }]
}
```

+ (status = 422, application/json)

```json
{
  "codigo": "422",
  "mensagem": "Erro na execução da instrução",
  "campos": [{
    "campo": "id_boleto",
    "mensagem": "Identificador do boleto não encontrado",
    "valor": "15000005201415600000070"
  }]
}
```

+ (status = 422, application/json)

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação",
  "campos": [{
    "campo": "idBoleto",
    "mensagem": "Conjunto agencia/conta/DAC inválido",
    "valor": "15000005201415600000070"
  }]
}
```

## Baixa Imediata

### [PATCH] /cash_management/v2/boletos/{idBoleto}/baixa

API responsável por efetuar a baixa em um boleto. O processo de baixa consiste na ação de cancelar o boleto.

Os boletos elegíveis para serem baixados são:
* Títulos cadastrados no sistema;
* Títulos abertos (não baixados e liquidados);
* Títulos não pagos (sem baixa operacional);
* Títulos vencidos;
* Títulos não vencidos;
* Títulos não protestados;
* Títulos com instrução de protesto cadastrada;
* Títulos em processo de protesto*;
* Titulos negativados;
* Títulos com instrução de negativação cadastrada;
* Títulos em processo de negativação;

*Caso o titulo esteja em processo de protesto, o sistema sustará automaticamente o boleto e baixará o título. Caso o título esteja em processo de negativação, o sistema fará a exclusão da negativação automaticamente e baixará o título. Não deve ser solicitado a baixa do título no mesmo dia da emissão, para carteiras 156/157.

<span style="color:yellow; background-color:black; font-weight:bold;">
Regras para instrução ou alteração de dados do boleto:
</span>

<span style="color:yellow; background-color:black;">
Boletos ficam disponíveis para instruções e alterações no mesmo dia da emissão.
</span>

 

A seguir estão expostos os parâmetros exigidos por essa API e a descrição deles. Para obter mais informações de onde conseguir o x-itau-apikey, e o x-itau-correlationID, acesse o tópico ‘Informações necessárias’.

### Parâmetros
| **Parâmetro** | **Tipo Parâmetro** | **Tipo Dado** | **Obrigatório** | **Descrição** |
|-----------|----------------|-----------|-------------|-----------|
| x-itau-apikey | header | string | sim | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante. |
| x-itau-correlationID | header | string | sim |identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes. |
| x-itau-flowID | header | string | sim | A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log.
| idBoleto | path | string | sim | Dados para identificação do boleto para alteração, sendo composto por:   Código Agência - Obrigatório (4 caracteres)   Código Conta Corrente - Obrigatório (7 caracteres)   Dígito verificador (DAC) - Obrigatório (1 caracter)   Código Carteira - Obrigatório (3 caracteres)   Nosso Número - Obrigatório (8 ou 16 caracteres) - Máximo de 23 ou 31 caracteres |

### Exemplo de Entrada

+ **PATCH /cash_management/v2/boletos/15000005206110900123522/baixa**

**Body:**
```json
{}
```

### Códigos de Resposta

| Código de Status | Descrição |
|--------|-----------|
| `204` | Alteração/Instrução realizada com sucesso |
| `201` | O recurso foi criado de forma síncrona |
| `400` | parâmetros incorretos |
| `401` | Não autorizado |
| `403` | Acesso proibido |
| `404` | Recurso inexistente |
| `405` | Método não permitido |
| `422` | Dados informados estão fora do escopo definido para o campo |
| `428` | Pré-requisito necessário |
| `500` | Erro inesperado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `501` | Não implementado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `503` | Serviço indisponível, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |

### Exemplo de Saídas

+ (status = 204 (No content), application/json)

```json
{}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "idBoleto",
      "mensagem": "Id Boleto inválido",
      "valor": "111111111"
    }
  ]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Entradas Bloqueadas, conta suspensa em cobrança.",
  "campos": [{
    "campo": "categoria_cobranca",
    "mensagem": "Entradas Bloqueadas, conta suspensa em cobrança.",
    "valor": 
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Ação não permitida, conta migrada",
  "campos": [{
    "campo": "beneficiário",
    "mensagem": "Ação não permitida, conta migrada",
    "valor": null
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Alteração não permitida para título já baixado ou liquidado",
    "valor": "BAIXADO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "data.dado_boleto.desconto.codigo_tipo_desconto",
    "mensagem": "Alteração não permitida para título descontado",
    "valor": "Descontado"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Ação não permitida para título em processo de liquidação",
    "valor": "EM_PAGAMENTO"
  }]
}
```

## Valor Nominal

### [PATCH] /cash_management/v2/boletos/{idBoleto}/valor_nominal

API responsável por efetuar a alteração do valor nominal em um boleto. O valor nominal do boleto consiste no valor integral do boleto, informado pelo cliente, sem adição de outros encargos.

Ao alterar o valor nominal de um boleto que possui abatimento e outra instrução de recebimento como juros, multa ou desconto o sistema irá recalcular automaticamente os valores a pagar de juros, multa e desconto, pois estes são calculados sobre o valor nominal do boleto já abatido. Ou seja, o percentual de juros, multa e desconto serão aplicados sobre o Valor do boleto menos o Valor do abatimento. Se esse recálculo resultar em um juros ao dia, multa ou desconto menor que R$0,01, a alteração será rejeitada.

Os boletos elegíveis para alteração de valor nominal são:
* Títulos cadastrados no sistema;
* Títulos abertos (não baixados e liquidados);
* Títulos não pagos (sem baixa operacional);
* Títulos vencidos;
* Títulos não vencidos;
* Títulos que não estejam em processo de protesto;
* Títulos não descontados;
* Títulos com Negativação agendada;
* Títulos com Negativação em andamento;
* Títulos negativados;

<span style="color:yellow; background-color:black; font-weight:bold;">
Regras para instrução ou alteração de dados do boleto:
</span>

<span style="color:yellow; background-color:black;">
Boletos ficam disponíveis para instruções e alterações no mesmo dia da emissão.
</span>

A seguir estão expostos os parâmetros exigidos por essa API e a descrição deles. Para obter mais informações de onde conseguir o x-itau-apikey, e o x-itau-correlationID, acesse o tópico ‘Informações necessárias’.

### Parâmetros

| **Parâmetro** | **Tipo Parâmetro** | **Tipo Dado** | **Obrigatório** | **Descrição** |
|---|---|---|---|---|
| x-itau-apikey | header | string | sim | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante. |
| x-itau-correlationID | header | string | sim | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes. |
| x-itau-flowID | header | string | sim | A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. |
| idBoleto | Path |	string|	sim|	Dados para identificação do boleto para alteração, sendo composto por:   Código Agência - Obrigatório (4 caracteres)   Código Conta Corrente - Obrigatório (7 caracteres)   Dígito verificador (DAC) - Obrigatório (1 caracter)   Código Carteira - Obrigatório (3 caracteres)   Nosso Número - Obrigatório (8 ou 16 caracteres) - Máximo de 23 ou 31 caracteres |
| valor_titulo | body | string | sim | Valor a ser cobrado no boleto.  Inserir em formato 999999999999999.00, sendo 15 os dígitos inteiros e 2 as casas decimais|

### Exemplo de Entrada

+ **PATCH/cash_management/v2/boletos/15000005201215600000074/valor_nominal**

**Body:**
```json
{
  "valor_titulo": "500.00"
}
```

### Códigos de Resposta

| Código de Status | Descrição |
|--------|-----------|
| `204` | Alteração/Instrução realizada com sucesso |
| `201` | O recurso foi criado de forma síncrona |
| `400` | parâmetros incorretos |
| `401` | Não autorizado |
| `403` | Acesso proibido |
| `404` | Recurso inexistente |
| `405` | Método não permitido |
| `422` | Dados informados estão fora do escopo definido para o campo |
| `428` | Pré-requisito necessário |
| `500` | Erro inesperado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `501` | Não implementado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `503` | Serviço indisponível, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |

### Exemplos de Saída

+ (status = 204 (No content), application/json)

```json
{}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "idBoleto",
      "mensagem": "Id Boleto inválido",
      "valor": "            15700024089"
    }
  ]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de campos",
  "campos": [
    {
      "campo": "lote.instrucoes.valor_nominal.valor_titulo",
      "mensagem": "Valor do título é inválido.",
      "valor": ""
    }
  ]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de campos",
  "campos": [
    {
      "campo": "lote.instrucoes.valor_nominal.valor_titulo",
      "mensagem": "Valor da cobrança deve ser maior que zero",
      "valor": "0.00"
    }
  ]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Entradas Bloqueadas, conta suspensa em cobrança.",
  "campos": [{
    "campo": "categoria_cobranca",
    "mensagem": "Entradas Bloqueadas, conta suspensa em cobrança.",
    "valor": null
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Ação não permitida, conta migrada",
  "campos": [{
    "campo": "beneficiário",
    "mensagem": "Ação não permitida, conta migrada",
    "valor": null
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Alteração não permitida para título já baixado ou liquidado",
    "valor": "BAIXADO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "data.dado_boleto.desconto.codigo_tipo_desconto",
    "mensagem": "Alteração não permitida para título descontado",
    "valor": "Descontado"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Ação não permitida para título em processo de liquidação",
    "valor": "EM_PAGAMENTO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação",
  "campos": [{
    "campo": "valor_titulo",
    "mensagem": "Valor não pode ser maior que 10.000.000,00",
    "valor": "200000000000.00"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação",
  "campos": [{
    "campo": "COD-RET",
    "mensagem": "Valor do desconto somado ao valor do abatimento é maior que o valor do título",
    "valor": ""
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "valor_titulo",
    "mensagem": "Valor da cobrança informado é igual ao cadastrado no título",
    "valor": "1000.00"
  }]
}
```

## Juros

### [PATCH] /cash_management/v2/boletos/{idBoleto}/juros

API responsável por efetuar a inclusão/alteração de juros em um boleto. Juros é uma cobrança que leva em consideração o tempo de atraso no recebimento do boleto com relação a data de vencimento. Os juros agem como uma penalidade ao pagador por não ter feito o pagamento no prazo estipulado.

Os boletos elegíveis para alteração de juros são:
* Títulos cadastrados no sistema;
* Títulos abertos (não baixados e liquidados);
* Títulos não pagos (sem baixa operacional);
* Títulos vencidos;
* Títulos não vencidos;
* Títulos que não estejam em processo de protesto;
* Títulos não descontados;

<span style="color:yellow; background-color:black; font-weight:bold;">
Regras para instrução ou alteração de dados do boleto:
</span>

<span style="color:yellow; background-color:black;">
Boletos ficam disponíveis para instruções e alterações no mesmo dia da emissão.
</span>

<span style="color:yellow; background-color:black; font-weight:bold;">
Regra de instrução de recebimento (Abatimento, Desconto, Juros e Multa):
</span>

<span style="color:yellow; background-color:black;">
Para um mesmo boleto, pode ser cadastrado no máximo 4 instruções.
</span>

Exemplos:
- 1 abatimento e até 3 descontos.
- 1 juros, 1 abatimento, 1 desconto e 1 multa

A seguir estão expostos os parâmetros exigidos por essa API e a descrição deles. Para obter mais informações de onde conseguir o x-itau-apikey, e o x-itau-correlationID, acesse o tópico ‘Informações necessárias’.

### Parâmetros

| **Parâmetro** | **Tipo Parâmetro** | **Tipo Dado** | **Obrigatório** | **Descrição**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
|---|---|---|---|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| x-itau-apikey | header | string | sim | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| x-itau-correlationID | header | string | sim | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| x-itau-flowID | header | string | sim | A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log.                                                           |
| idBoleto | Path |	string|	sim| 	Dados para identificação do boleto para alteração, sendo composto por:   Código Agência - Obrigatório (4 caracteres)   Código Conta Corrente - Obrigatório (7 caracteres)   Dígito verificador (DAC) - Obrigatório (1 caracter)   Código Carteira - Obrigatório (3 caracteres)   Nosso Número - Obrigatório (8 ou 16 caracteres) - Máximo de 23 ou 31 caracteres                                                                                                                                                                                                                                                                                   |
| juros > codigo_tipo_juros | body | string | sim | Tipo da  cobrança dos juros no cálculo da cobrança. Para cada um dos valores informados, será impresso no boleto uma anotação referente. <br>'05' - Quando se deseja efetuar a exclusão do juros. <br>'90' - Percentual mensal (utilizando parâmetros do cadastro de beneficiário para dias úteis ou corridos). <br>'91' - Percentual diário (utilizando parâmetros do cadastro de beneficiário para dias úteis ou corridos). <br>'92' - Percentual anual (utilizando parâmetros do cadastro de beneficiário para dias úteis ou corridos). <br>'93' - Valor diário (utilizando parâmetros do cadastro de beneficiário para dias úteis ou corridos). | 
| juros > valor_juros | body | string | não | Valor dos juros a ser cobrado.   Obrigatório para codigo_tipo_juros ‘93’. Formato do campo: 15 dígitos inteiros e 2 casas decimais. Exemplo: 999999999999999.00<br>Se valor informado ficar inferior à R$ 0,01 ao dia ou acima de 99,99% ao mês / 3,33333% ao dia / 1.199,88% ao ano, o registro do juros será desconsiderado.                                                                                                                                                                                                                                                                                                                      |
| juros > percentual_juros | body | string | não | Percentual dos juros a ser cobrado.   Obrigatório para tipo_juros ‘90’, ‘91’ ou ‘92’. Formato do campo: 7 dígitos inteiros e 5 casas decimais. Exemplo: 9999999.00000<br>Se valor informado ficar inferior à R$ 0,01 ao dia ou acima de 99,99% ao mês / 3,33333% ao dia / 1.199,88% ao ano, o registro do juros será desconsiderado.                                                                                                                                                                                                                                                                                                                |
| juros > quantidade_dias_juros | body | integer | sim | Quantidade de dias úteis/corridos após o vencimento para cobrança de juros. Será cobrado juros a partir da data calculada (data de vencimento + dias úteis/corridos). Informar entre 1 e 99 dias.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

### Exemplo de Entrada 1

+ **PATCH/cash_management/v2/boletos/15000076969811091984690/juros**

**Body:**
```json 
{
    "juros": {
        "codigo_tipo_juros": "93",
        "quantidade_dias_juros": 1,
        "valor_juros": "150.00"
    }
}
```

### Exemplo de Entrada 2

+ **PATCH/cash_management/v2/boletos/15000005206115700007114/juros**

**Body:**
```json 
{
    "juros": {
        "codigo_tipo_juros": "90",
        "quantidade_dias_juros": 2,
        "percentual_juros": "15.85000"
    }
}
```

### Códigos de Resposta

| Código de Status | Descrição |
|--------|-----------|
| `204` | Alteração/Instrução realizada com sucesso |
| `201` | O recurso foi criado de forma síncrona |
| `400` | parâmetros incorretos |
| `401` | Não autorizado |
| `403` | Acesso proibido |
| `404` | Recurso inexistente |
| `405` | Método não permitido |
| `422` | Dados informados estão fora do escopo definido para o campo |
| `428` | Pré-requisito necessário |
| `500` | Erro inesperado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `501` | Não implementado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `503` | Serviço indisponível, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |

### Exemplos de Saída

+ (status = 204 (No content), application/json)

```json 
{}
``` 

+ (status = 400, application/json)

```json 
{
    "codigo": "400",
    "mensagem": "Erro na validação de Campos.",
    "campos": [
        {
            "campo": "idBoleto",
            "mensagem": "Id Boleto inválido",
            "valor": "            15700024089"
        }
    ]
}
```

+ (status = 400, application/json)

```json 
{
    "codigo": "400",
    "mensagem": "Erro na validação",
    "campos": [
        {
            "campo": "codigo_tipo_juros",
            "mensagem": "Código tipo de juros inválido",
            "valor": "07"
        }
    ]
}
```

+ (status = 400, application/json)

```json 
{
    "codigo": "400",
    "mensagem": "Erro na validação de Campos.",
    "campos": [
        {
            "campo": "valor_juros",
            "mensagem": "Valor de juros inválido",
            "valor": "3.00000"
        }
    ]
}
``` 

+ (status = 400, application/json)

```json 
{
    "codigo": "400",
    "mensagem": "Erro na validação de Campos.",
    "campos": [
        {
            "campo": "valor_juros",
            "mensagem": "Favor informar campo de valor de juros",
            "valor": ""
        }
    ]
}
``` 

+ (status = 400, application/json)

```json 
{
    "codigo": "400",
    "mensagem": "Erro na validação de Campos.",
    "campos": [
        {
            "campo": "valor_juros",
            "mensagem": "O valor de juros deve ser maior que zero",
            "valor": "00.00"
        }
    ]
}
```

+ (status = 400, application/json)

```json 
{
    "codigo": "400",
    "mensagem": "Erro na validação de Campos.",
    "campos": [
        {
            "campo": "percentual_juros",
            "mensagem": "Favor informar campo de percentual de juros",
            "valor": ""
        }
    ]
}
```

+ (status = 400, application/json)

```json 
{
    "codigo": "400",
    "mensagem": "Erro na validação de Campos.",
    "campos": [
        {
            "campo": "percentual_juros",
            "mensagem": "O percentual de juros deve ser maior que zero",
            "valor": "0.00000"
        }
    ]
}
```

+ (status = 400, application/json)

```json 
{
   "codigo": "400",
    "mensagem": "Erro na validação de Campos.",
    "campos": [
        {
            "campo": "percentual_juros",
            "mensagem": "Percentual de juros inválido",
            "valor": "02.000000"
        }
    ]
}
```

+ (status = 400, application/json)

```json 
{
    "codigo": "400",
    "mensagem": "Erro na validação de Campos.",
    "campos": [
        {
            "campo": "idBoleto",
            "mensagem": "Id Boleto inválido",
            "valor": "150000052061   00007114"
        }
    ]
}
```

+ (status = 400, application/json)

```json 
{
    "codigo": "400",
    "mensagem": "Erro na validação de Campos.",
    "campos": [
        {
            "campo": "percentual_juros",
            "mensagem": "Quantidade de dias deve ser de 1 à 99",
            "valor": "0"
        }
    ]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Entradas Bloqueadas, conta suspensa em cobrança.",
  "campos": [{
    "campo": "categoria_cobranca",
    "mensagem": "Entradas Bloqueadas, conta suspensa em cobrança.",
    "valor": null
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Ação não permitida, conta migrada",
  "campos": [{
    "campo": "beneficiário",
    "mensagem": "Ação não permitida, conta migrada",
    "valor": null
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Alteração não permitida para título já baixado ou liquidado",
    "valor": "BAIXADO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "data.dado_boleto.desconto.codigo_tipo_desconto",
    "mensagem": "Alteração não permitida para título descontado",
    "valor": "Descontado"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Ação não permitida para título em processo de liquidação",
    "valor": "EM_PAGAMENTO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "quantidade_dias_juros",
    "mensagem": "Alteração de quantidade de dias não permitida",
    "valor": "5"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [
    {
      "campo": "percentual_juros",
      "mensagem": "Percentual de juros informado excede 100% de juros mensal",
      "valor": "100.00000"
    }
  ]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [
    {
      "campo": "valor_juros",
      "mensagem": "Valor de juros informado excede 100% de juros mensal",
      "valor": "100.00000"
    }
  ]
}
```

## Data de Vencimento

### [PATCH] /cash_management/v2/boletos/{idBoleto}/data_vencimento

API responsável por efetuar a alteração da data de vencimento em um boleto.

Os boletos elegíveis para terem data de vencimento alterados são:
* Títulos cadastrados no sistema;
* Títulos abertos (não baixados e liquidados);
* Títulos a vencer ou vencidos;
* Títulos que não estejam em processo de protesto;
* Títulos não descontados;
* Titulos não pagos (sem baixa operacional.)

<span style="color:yellow; background-color:black; font-weight:bold;">
Regras para instrução ou alteração de dados do boleto:
</span>

<span style="color:yellow; background-color:black;">
Boletos ficam disponíveis para instruções e alterações no mesmo dia da emissão.
</span>

A seguir estão expostos os parâmetros exigidos por essa API e a descrição deles. Para obter mais informações de onde conseguir o x-itau-apikey, e o x-itau-correlationID, acesse o tópico ‘Informações necessárias’.

### Comando de Instrução

| **Parâmetro** | **Tipo Parâmetro** | **Tipo Dado** | **Obrigatório** | **Descrição** |
|---|---|---|---|---|
| x-itau-apikey | header | string | sim | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante. |
| x-itau-correlationID | header | string | sim | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes. |
| x-itau-flowID | header | string | sim | A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. |
| idBoleto | Path |	string|	sim|	Dados para identificação do boleto para alteração, sendo composto por:   Código Agência - Obrigatório (4 caracteres)   Código Conta Corrente - Obrigatório (7 caracteres)   Dígito verificador (DAC) - Obrigatório (1 caracter)   Código Carteira - Obrigatório (3 caracteres)   Nosso Número - Obrigatório (8 ou 16 caracteres) - Máximo de 23 ou 31 caracteres |
|data_vencimento|	body|	string|sim|	Data máxima a ser inserida no boleto para pagamento do título sem que haja acréscimo de juros e multa, em formato AAAA-MM-DD.|

### Exemplo de Entrada

+ **PATCH/cash_management/v2/boletos/15000076969811091304690/data_vencimento**

**Body:**
```json
{
  "data_vencimento": "2020-02-10"
}
```

### Códigos de Resposta

| Código de Status | Descrição |
|--------|-----------|
| `204` | Alteração/Instrução realizada com sucesso |
| `201` | O recurso foi criado de forma síncrona |
| `400` | parâmetros incorretos |
| `401` | Não autorizado |
| `403` | Acesso proibido |
| `404` | Recurso inexistente |
| `405` | Método não permitido |
| `422` | Dados informados estão fora do escopo definido para o campo |
| `428` | Pré-requisito necessário |
| `500` | Erro inesperado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `501` | Não implementado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `503` | Serviço indisponível, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |

### Exemplos de Saída

+ (status = 204 (No content), application/json)

```json
{}
``` 

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "idBoleto",
      "mensagem": "Id Boleto inválido",
      "valor": "            11098733188"
    }
  ]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "data.lote.instrucoes.data_vencimento.data_vencimento",
      "mensagem": "Data de vencimento informada não é válida, deve estar no formato aaaa-mm-dd",
      "valor": "00000-14-540"
    }
  ]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Entradas Bloqueadas, conta suspensa em cobrança.",
  "campos": [{
    "campo": "categoria_cobranca",
    "mensagem": "Entradas Bloqueadas, conta suspensa em cobrança.",
    "valor": null
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Ação não permitida, conta migrada",
  "campos": [{
    "campo": "beneficiário",
    "mensagem": "Ação não permitida, conta migrada",
    "valor": null
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Alteração não permitida para título já baixado ou liquidado",
    "valor": "BAIXADO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "data.dado_boleto.desconto.codigo_tipo_desconto",
    "mensagem": "Alteração não permitida para título descontado",
    "valor": "Descontado"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Ação não permitida para título em processo de liquidação",
    "valor": "EM_PAGAMENTO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "data_vencimento",
    "mensagem": "Data de vencimento informada é igual a cadastrada no título",
    "valor": "30/01/2020"
  }]
}
```

## Desconto

### [PATCH] /cash_management/v2/boletos/{idBoleto}/desconto

API responsável por efetuar a inclusão/alteração de desconto em um boleto, possibilitando oferecer descontos para pagamentos antecipados do boleto. Existem 2 tipos de descontos que podem ser aplicados:
1.	Desconto Fixo: Beneficiário determina o valor do desconto e a quantidade de dias antecipados para a concessão do desconto. Podem ser cadastrados até 3 descontos fixos por boleto.
2.	Desconto proporcional: Beneficiário determina o valor do desconto por dia de antecipação do pagamento.

Após o vencimento do boleto, o desconto perde sua validade.

O valor do desconto somado ao abatimento, quando houver, deve ser menor que o valor nominal do boleto.

Em casos de alteração da data de vencimento a quantidade de dias de desconto permanece e a data será atualizada de acordo com o novo vencimento.

Os boletos elegíveis para terem descontos alterados são:
* Títulos cadastrados no sistema;
* Títulos abertos (não baixados e liquidados);
* Títulos não pagos (sem baixa operacional);
* Títulos não vencidos;
* Títulos que não estejam em processo de protesto;
* Títulos não descontados;

<span style="color:yellow; background-color:black; font-weight:bold;">
Regras para instrução ou alteração de dados do boleto:
</span>

<span style="color:yellow; background-color:black;">
Boletos ficam disponíveis para instruções e alterações no mesmo dia da emissão.
</span>

<span style="color:yellow; background-color:black; font-weight:bold;">
Regra de instrução de recebimento (Abatimento, Desconto, Juros e Multa):
</span>

<span style="color:yellow; background-color:black;">
Para um mesmo boleto, pode ser cadastrado no máximo 4 instruções.
</span>

Exemplos:
- 1 abatimento e até 3 descontos.
- 1 juros, 1 abatimento, 1 desconto e 1 multa

A seguir estão expostos os parâmetros exigidos por essa API e a descrição deles. Para obter mais informações de onde conseguir o x-itau-apikey, e o x-itau-correlationID, acesse o tópico ‘Informações necessárias’.

### Comando de Instrução

| **Parâmetro** | **Tipo Parâmetro** | **Tipo Dado** | **Obrigatório** | **Descrição**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
|---|---|---------------|---|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| x-itau-apikey | header | string        | sim | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| x-itau-correlationID | header | string        | sim | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| x-itau-flowID | header | string        | sim | A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log.                                                                                                           |
| idBoleto | Path | 	string       |	sim| 	Dados para identificação do boleto para alteração, sendo composto por:   Código Agência - Obrigatório (4 caracteres)   Código Conta Corrente - Obrigatório (7 caracteres)   Dígito verificador (DAC) - Obrigatório (1 caracter)   Código Carteira - Obrigatório (3 caracteres)   Nosso Número - Obrigatório (8 ou 16 caracteres) - Máximo de 23 ou 31 caracteres                                                                                                                                                                                                                                                                                                                                   |
| desconto > codigo_tipo_desconto | body | string        | sim | Código do desconto. Caso exista mais de um desconto, todos os tipo_desconto deverão ter o mesmo código. '1' - Concede desconto de valor fixo ao pagador se a cobrança for paga até a data estipulada (quantidade_dias_desconto). '2' - Concede desconto percentual fixo ao pagador se a cobrança for paga até a data estipulada (quantidade_dias_desconto). '90' - Até a data de vencimento, concede desconto percentual. O desconto deve ser envido ao mês, mas o desconto é concedido por dia antecipado de pagamento. '91' - Até a data de vencimento, concede valor de desconto por dia antecipado de pagamento. '00' - Quando não houver condição de desconto ou efetuar exclusão de desconto. |
| desconto > descontos > quantidade_dias_desconto | body | string   | sim | Quantidade de dias anteriores à data de vencimento em que o desconto será aplicado. Informar entre 0 e 99 dias. Não deve ser preenchido para codigo_tipo_desconto '90', '91', e '00'                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| desconto > descontos > valor_desconto | body | string        | não | Valor do desconto a ser cobrado.  Obrigatório para codigo_tipo_desconto 1 ou 91. Não deve ser preenchido para codigo_tipo_desconto 00. Formato do campo: 15 dígitos inteiros e 2 casas decimais. <br>Observação: É obrigatório o preenchimento em casos de alteração da quantidade de dias (quantidade_dias_desconto).                                                                                                                                                                                                                                                                                                                                                                              |
| desconto > descontos > percentual_desconto | body | string        | não | Percentual do desconto concedido. Obrigatório para codigo_tipo_desconto 2 ou 90. Não deve ser preenchido para codigo_tipo_desconto 00. Formato do campo: 7 dígitos inteiros e 5 casas decimais. <br>Observação: É obrigatório o preenchimento em casos de alteração da quantidade de dias (quantidade_dias_desconto).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

### Exemplo de Entrada 1

+ **PATCH/cash_management/v2/boletos/15000001008515600003732/desconto**

**Body:**
```json
{
  "desconto": {
    "codigo_tipo_desconto": "90",
    "descontos": [
      {
        "percentual_desconto": "10.00000"
      }
    ]
  }
}
```

### Exemplo de Entrada 2

+ **PATCH/cash_management/v2/boletos/15000001008515600003659/desconto**

**Body:**
```json
{
  "desconto": {
    "codigo_tipo_desconto": "91",
    "descontos": [
      {
        "valor_desconto": "10.00"
      }
    ]
  }
}
```

### Exemplo de Entrada 3

+ **PATCH/cash_management/v2/boletos/15000005206115700021810/desconto**

**Body:**
```json
{
  "desconto": {
    "codigo_tipo_desconto": "02",
    "descontos": [
      {
        "quantidade_dias_desconto": 0,
        "percentual_desconto": "02.00000"
      },
      {
        "quantidade_dias_desconto": 1,
        "percentual_desconto": "03.00000"
      }
    ]
  }
}

```

### Exemplo de Entrada 4

+ **PATCH/cash_management/v2/boletos/15000001008515600003732/desconto**

**Body:**
```json
{
  "desconto": {
    "codigo_tipo_desconto": "02",
    "descontos":[{
      " quantidade_dias_desconto ": 5,
      "percentual_desconto": "10.00000"
    },
      {
        " quantidade_dias_desconto”: 3,
        "percentual_desconto": "5.00000"
      },
      {
        " quantidade_dias_desconto ": 1,
        "percentual_desconto": "2.00000"
      }]
  }
}

```

### Exemplo de Entrada 5

+ **PATCH/cash_management/v2/boletos/15000005201215600000062/desconto**

**Body:**
```json
{
  "desconto": {
    "codigo_tipo_desconto": "01",
    "descontos": [
      {
        " quantidade_dias_desconto ": 0,
        "valor_desconto": "10.00"
      },
      {
        " quantidade_dias_desconto ": 5,
        "valor_desconto": "20.00"
      }
    ]
  }
}
```

### Exemplo de Entrada 6

+ **PATCH/cash_management/v2/boletos/15000001008515600003732/desconto**

**Body:**
```json
{
  "desconto": {
    "codigo_tipo_desconto": "01",
    "descontos": [
      {
        " quantidade_dias_desconto ": 3,
        "valor_desconto": "10.00"
      },
      {
        " quantidade_dias_desconto ": 1,
        "valor_desconto": "50.00"
      },
      {
        " quantidade_dias_desconto ": 2,
        "valor_desconto": "40.00"
      }
    ]
  }
}

```

### Exemplo de Entrada 7

+ **PATCH/cash_management/v2/boletos/15000001008515600003732/desconto**

**Body:**
```json
{
  "desconto": {
    "codigo_tipo_desconto": "00",
    "descontos": [
      {}
    ]
  }
}
```

### Códigos de Resposta

| Código de Status | Descrição |
|--------|-----------|
| `204` | Alteração/Instrução realizada com sucesso |
| `201` | O recurso foi criado de forma síncrona |
| `400` | parâmetros incorretos |
| `401` | Não autorizado |
| `403` | Acesso proibido |
| `404` | Recurso inexistente |
| `405` | Método não permitido |
| `422` | Dados informados estão fora do escopo definido para o campo |
| `428` | Pré-requisito necessário |
| `500` | Erro inesperado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `501` | Não implementado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `503` | Serviço indisponível, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |

### Exemplos de Saída

+ (status = 204 (No content), application/json)

```json
{}
```

+ (status = 400, application/json)

```json
{

  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "idBoleto",
      "mensagem": "Id Boleto inválido",
      "valor": "150000010085156        "
    }
  ]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Entradas Bloqueadas, conta suspensa em cobrança.",
  "campos": [{
    "campo": "categoria_cobranca",
    "mensagem": "Entradas Bloqueadas, conta suspensa em cobrança.",
    "valor": null
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Ação não permitida, conta migrada",
  "campos": [{
    "campo": "beneficiário",
    "mensagem": "Ação não permitida, conta migrada",
    "valor": null
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Alteração não permitida para título já baixado ou liquidado",
    "valor": "BAIXADO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "data.dado_boleto.desconto.codigo_tipo_desconto",
    "mensagem": "Alteração não permitida para título descontado",
    "valor": "Descontado"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Ação não permitida para título em processo de liquidação",
    "valor": "EM_PAGAMENTO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "",
    "mensagem": "Valor do desconto não pode ser igual ou superior ao valor do título",
    "valor": ""
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "",
    "mensagem": "Instruções de recebimento superam o limite de ocorrências permitidas",
    "valor": "2"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "situacaoProtesto",
    "mensagem": "Alteração não permitida para título em processo de protesto",
    "valor": "Em protesto"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "percentual_desconto",
    "mensagem": "Percentual de desconto informado é igual ao percentual de desconto já cadastrado no título",
    "valor": "10.00000"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "valor_desconto",
    "mensagem": "Valor de desconto informado é igual ao valor de desconto já cadastrado no título",
    "valor": "15.00"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "",
    "mensagem": "Valor do desconto não pode ser superior a 90% do valor do título",
    "valor": ""
  }]
}
```

+ (status = 400, application/json)

```json
{

  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "codigo_tipo_desconto",
    "mensagem": "Para desconto com o código 00, não enviar dias, valor e percentual de desconto",
    "valor": "00"
  }]
}
```

## Abatimento

### [PATCH] /cash_management/v2/boletos/{idBoleto}/abatimento

API responsável por efetuar a inclusão/alteração de abatimento em um boleto, concede redução no valor do boleto, mesmo após o vencimento. O valor de abatimento somado ao valor de desconto deve ser menor que o valor nominal do boleto

Ao incluir ou alterar o abatimento para um boleto que possui juros, multa ou desconto o sistema irá recalcular automaticamente os valores a pagar de juros, multa e desconto, pois estes são calculados sobre o valor nominal do boleto já abatido. Ou seja, o percentual de juros, multa e desconto serão aplicados sobre o Valor do boleto menos o Valor do abatimento. Se esse recálculo resultar em um juros ao dia, multa ou desconto menor que R$0,01, a alteração será rejeitada.

Os boletos elegíveis para terem abatimentos são:
* Títulos cadastrados no sistema;
* Títulos abertos (não baixados e liquidados);
* Títulos não pagos (sem baixa operacional);
* Títulos vencidos;
* Títulos não vencidos;
* Títulos que não estejam em processo de protesto;
* Títulos não descontados;

<span style="color:yellow; background-color:black; font-weight:bold;">
Regras para instrução ou alteração de dados do boleto:
</span>

<span style="color:yellow; background-color:black;">
Boletos ficam disponíveis para instruções e alterações no mesmo dia da emissão.
</span>

<span style="color:yellow; background-color:black; font-weight:bold;">
Regra de instrução de recebimento (Abatimento, Desconto, Juros e Multa):
</span>

<span style="color:yellow; background-color:black;">
Para um mesmo boleto, pode ser cadastrado no máximo 4 instruções.
</span>

Exemplos:
- 1 abatimento e até 3 descontos.
- 1 juros, 1 abatimento, 1 desconto e 1 multa

A seguir estão expostos os parâmetros exigidos por essa API e a descrição deles. Para obter mais informações de onde conseguir o x-itau-apikey, e o x-itau-correlationID, acesse o tópico ‘Informações necessárias’.

### Comando de Instrução

| **Parâmetro** | **Tipo Parâmetro** | **Tipo Dado** | **Obrigatório** | **Descrição** |
|---|---|---|---|---|
| x-itau-apikey | header | string | sim | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante. |
| x-itau-correlationID | header | string | sim | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes. |
| x-itau-flowID | header | string | sim | A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. |
| idBoleto | Path |	string | sim | Dados para identificação do boleto para alteração, sendo composto por:   Código Agência - Obrigatório (4 caracteres)   Código Conta Corrente - Obrigatório (7 caracteres)   Dígito verificador (DAC) - Obrigatório (1 caracter)   Código Carteira - Obrigatório (3 caracteres)   Nosso Número - Obrigatório (8 ou 16 caracteres) - Máximo de 23 ou 31 caracteres |
| valor_abatimento | body | string | sim | Valor do abatimento do título. Inserir em formato 999999999999999.00, sendo 15 os dígitos inteiros e 2 casas decimais. O sistema limita o desconto concedido (soma entre valor_abatimento e valor_desconto) que deve ser menor que 90% do valor do Boleto titulo. Se o valor do abatimento for igual a zero é feita a exclusão do abatimento.|

### Exemplo de Entrada 1

+ **PATCH/cash_management/v2/boletos/15000005201215600000083/abatimento**

**Body:**
```json
{
  "valor_abatimento": "10.00"
}
```

### Exemplo de Entrada 2

+ **PATCH/cash_management/v2/boletos/15000005201215600000083/abatimento**

**Body:**
```json
{
  "valor_abatimento": "0"
}
```

### Códigos de Resposta

| Código de Status | Descrição |
|--------|-----------|
| `204` | Alteração/Instrução realizada com sucesso |
| `201` | O recurso foi criado de forma síncrona |
| `400` | parâmetros incorretos |
| `401` | Não autorizado |
| `403` | Acesso proibido |
| `404` | Recurso inexistente |
| `405` | Método não permitido |
| `422` | Dados informados estão fora do escopo definido para o campo |
| `428` | Pré-requisito necessário |
| `500` | Erro inesperado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `501` | Não implementado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `503` | Serviço indisponível, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |

### Exemplos de Saída

+ (status = 204 (No content), application/json)

```json
{}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "idBoleto",
    "mensagem": "Id Boleto inválido",
    "valor": "    15000076969811068722123"
  }]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "lote.instrucoes.abatimento.valor_abatimento",
      "mensagem": "Valor do abatimento inválido",
      "valor": ""
    }
  ]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "lote.instrucoes.abatimento.valor_abatimento",
      "mensagem": "Valor do abatimento inválido",
      "valor": "1000000000000000.00"
    }
  ]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "lote.instrucoes.abatimento.valor_abatimento",
      "mensagem": "Valor do abatimento inválido",
      "valor": "1A.00"
    }
  ]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Entradas Bloqueadas, conta suspensa em cobrança.",
  "campos": [{
    "campo": "categoria_cobranca",
    "mensagem": "Entradas Bloqueadas, conta suspensa em cobrança.",
    "valor": null
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Ação não permitida, conta migrada",
  "campos": [{
    "campo": "beneficiário",
    "mensagem": "Ação não permitida, conta migrada",
    "valor": null
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Alteração não permitida para título já baixado ou liquidado",
    "valor": "BAIXADO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "data.dado_boleto.desconto.codigo_tipo_desconto",
    "mensagem": "Alteração não permitida para título descontado",
    "valor": "Descontado"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Ação não permitida para título em processo de liquidação",
    "valor": "EM_PAGAMENTO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "situacaoProtesto",
    "mensagem": "Alteração não permitida para título em processo de protesto",
    "valor": "Em protesto"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "",
    "mensagem": "Não é permitido abatimento para boleto proposta",
    "valor": "18"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação",
  "campos": [{
    "campo": "COD-RET",
    "mensagem": " Instruções de recebimento superam o limite de ocorrências permitidas",
    "valor": ""
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "lote.instrucoes.abatimento.valor_abatimento",
    "mensagem": "Valor do abatimento maior ou igual ao valor do título",
    "valor": ""
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação",
  "campos": [{
    "campo": "valor_abatimento",
    "mensagem": "Exclusão de abatimento não permitido para boleto descontado",
    "valor": ""
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação",
  "campos": [{
    "campo": "valor_abatimento",
    "mensagem": "Título não possui abatimento cadastrado",
    "valor": ""
  }]
}
```

## Multa

### [PATCH] /cash_management/v2/boletos/{idBoleto}/multa

API responsável por efetuar a inclusão/alteração de multa em um boleto. Multa é uma cobrança referente ao recebimento do boleto em atraso em relação a data de vencimento. A multa leva em consideração o tempo de atraso no recebimento, podendo ser cobrada a partir de um prazo (dias) após o vencimento.

Os boletos elegíveis para terem multa alterada são:
* Títulos cadastrados no sistema;
* Títulos abertos (não baixados e liquidados);
* Títulos não pagos (sem baixa operacional);
* Títulos vencidos;
* Títulos não vencidos;
* Títulos que não estejam em processo de protesto;
* Títulos não descontados;

<span style="color:yellow; background-color:black; font-weight:bold;">
Regras para instrução ou alteração de dados do boleto:
</span>

<span style="color:yellow; background-color:black;">
Boletos ficam disponíveis para instruções e alterações no mesmo dia da emissão.
</span>

<span style="color:yellow; background-color:black; font-weight:bold;">
Regra de instrução de recebimento (Abatimento, Desconto, Juros e Multa):
</span>

<span style="color:yellow; background-color:black;">
Para um mesmo boleto, pode ser cadastrado no máximo 4 instruções.
</span>

Exemplos:
- 1 abatimento e até 3 descontos.
- 1 juros, 1 abatimento, 1 desconto e 1 multa

A seguir estão expostos os parâmetros exigidos por essa API e a descrição deles. Para obter mais informações de onde conseguir o x-itau-apikey, e o x-itau-correlationID, acesse o tópico ‘Informações necessárias’.

### Comando de Instrução
| **Parâmetro** | **Tipo Parâmetro** | **Tipo Dado** | **Obrigatório** | **Descrição** |
|---|---|---|---|---|
| x-itau-apikey | header | string | sim | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante. |
| x-itau-correlationID | header | string | sim | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes. |
| x-itau-flowID | header | string | sim | A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. |
| idBoleto | Path |	string|	sim|	Dados para identificação do boleto para alteração, sendo composto por:   Código Agência - Obrigatório (4 caracteres)   Código Conta Corrente - Obrigatório (7 caracteres)   Dígito verificador (DAC) - Obrigatório (1 caracter)   Código Carteira - Obrigatório (3 caracteres)   Nosso Número - Obrigatório (8 ou 16 caracteres) - Máximo de 23 ou 31 caracteres |
| multa > codigo_tipo_multa |	body|	string|	sim| Código da multa.    '01' - Quando se deseja cobrar um valor fixo de multa após o vencimento.   '02' - Quando se deseja cobrar um percentual do valor do título de multa após o vencimento. '03' - Quando se deseja efetuar a exclusão da multa. |
| multa > quantidade_dias_multa|	body|	integer|	sim | A partir de quantos dias cobrar multa após vencimento, inserir no formato 01. Informar entre 1 e 99 dias. Não deve ser preenchido para codigo_tipo_multa 03.|
| multa > valor_multa|	body|	string|	não| Valor da multa cobrada.  Obrigatório para codigo_tipo_multa 01. Formato do campo: 15 dígitos inteiros e 2 casas decimais. Não deve ser preenchido para codigo_tipo_multa 03.|
| multa > percentual_multa|	body|	String|	não| Percentual da multa cobrada.  Obrigatório para tipo_multa 02. Formato do campo: 7 dígitos inteiros e 5 casas decimais. Não deve ser preenchido para codigo_tipo_multa 03.|

### Exemplo de Entrada 1

+ **PATCH/cash_management/v2/boletos/15000076507615700024073/multa**

**Body:**
```json
{
  "multa": {
    "codigo_tipo_multa": "01",
    "quantidade_dias_multa": 1,
    "valor_multa": "10.00"
  }

}
```

### Exemplo de Entrada 2

+ **PATCH/cash_management/v2/boletos/15000005206115600039949/multa**

**Body:**
```json
{
  "multa": {
    "codigo_tipo_multa": "02",
    "quantidade_dias_multa": 1,
    "percentual_multa": "1.00000"
  }
}
```

### Exemplo de Entrada 3

+ **PATCH/cash_management/v2/boletos/15000005206115600039949/multa**

**Body:**
```json
{
  "multa": {
    "codigo_tipo_multa": "02",
    "quantidade_dias_multa": 1,
    "percentual_multa": "10.00000"
  }
}
```

### Exemplo de Entrada 4

+ **PATCH/cash_management/v2/boletos/15000005206115600039949/multa**

**Body:**
```json
{
  "multa": {
    "codigo_tipo_multa": "03"
  }
}
```

### Códigos de Resposta

| Código de Status | Descrição |
|--------|-----------|
| `204` | Alteração/Instrução realizada com sucesso |
| `201` | O recurso foi criado de forma síncrona |
| `400` | parâmetros incorretos |
| `401` | Não autorizado |
| `403` | Acesso proibido |
| `404` | Recurso inexistente |
| `405` | Método não permitido |
| `422` | Dados informados estão fora do escopo definido para o campo |
| `428` | Pré-requisito necessário |
| `500` | Erro inesperado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `501` | Não implementado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `503` | Serviço indisponível, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |

### Exemplos de Saída

+ (status = 204 (No content), application/json)

```json
{}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "lote.instrucoes.multa.valor_multa",
      "mensagem": "Valor de multa obrigatório para código do tipo de multa 01",
      "valor": ""
    }
  ]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "lote.instrucoes.multa.valor_multa",
      "mensagem": "Valor de multa é inválido",
      "valor": "-9"
    }
  ]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "lote.instrucoes.multa.percentual_multa",
      "mensagem": "Percentual de multa obrigatório para código do tipo de multa 02",
      "valor": ""
    }
  ]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "lote.instrucoes.multa.percentual_multa",
      "mensagem": "Percentual de multa é inválido",
      "valor": "-10000000000000000000000.000001"
    }
  ]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "lote.instrucoes.multa.percentual_multa",
      "mensagem": "Percentual de multa năo é permitido para código tipo 1",
      "valor": "15.00000"
    }
  ]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "lote.instrucoes.multa.quantidade_dias_multa",
      "mensagem": "Quantidade de dias deve ser de 1 à 99",
      "valor": "1000"
    }
  ]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "lote.instrucoes.multa.valor_multa",
      "mensagem": "Valor de multa năo é permitido para código tipo 2",
      "valor": "100.00"
    }
  ]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Entradas Bloqueadas, conta suspensa em cobrança.",
  "campos": [{
    "campo": "categoria_cobranca",
    "mensagem": "Entradas Bloqueadas, conta suspensa em cobrança.",
    "valor": null
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Ação não permitida, conta migrada",
  "campos": [{
    "campo": "beneficiário",
    "mensagem": "Ação não permitida, conta migrada",
    "valor": null
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Alteração não permitida para título já baixado ou liquidado",
    "valor": "BAIXADO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "data.dado_boleto.desconto.codigo_tipo_desconto",
    "mensagem": "Alteração não permitida para título descontado",
    "valor": "Descontado"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Ação não permitida para título em processo de liquidação",
    "valor": "EM_PAGAMENTO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo" : "situacaoGeral",
    "mensagem" : "Alteraçăo năo permitida para titulo já liquidado parcialmente",
    "valor" : "EM_ABERTO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo" : "quantidade_dias_multa",
    "mensagem" : "Alteração de quantidade de dias não permitida",
    "valor" : "9"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo" : "percentual_multa",
    "mensagem" : "Percentual de multa não pode ser igual ou maior que o valor do título",
    "valor" : "100.00000"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo" : "valor_multa",
    "mensagem" : "Valor de multa não pode ser igual ou maior que o valor do título",
    "valor" : "100.00000"
  }]
}
```

## Protesto

### [PATCH] /cash_management/v2/boletos/{idBoleto}/protesto

API responsável por efetuar a inclusão/alteração/exclusão de protesto em um boleto.

Não Protestar consiste em cancelar o envio de um boleto para protesto (boleto ainda não foi enviado para cartório)

Sustar Protesto consiste em cancelar um protesto de um boleto já enviado ao cartório, porém protesto ainda não foi concluído.

Os boletos elegíveis para terem protesto são:
* Títulos cadastrados no sistema;
* Títulos abertos (não baixados e liquidados);
* Títulos não pagos (sem baixa operacional);
* Títulos vencidos;
* Títulos não vencidos;
* Títulos que não estejam em processo de protesto;
* Títulos não descontados;

<span style="color:yellow; background-color:black; font-weight:bold;">
Regras para instrução ou alteração de dados do boleto:
</span>

<span style="color:yellow; background-color:black;">
Boletos ficam disponíveis para instruções e alterações no mesmo dia da emissão.
</span>

A seguir estão expostos os parâmetros exigidos por essa API e a descrição deles. Para obter mais informações de onde conseguir o x-itau-apikey, e o x-itau-correlationID, acesse o tópico ‘Informações necessárias’.

### Comando de Instrução

| **Parâmetro** | **Tipo Parâmetro** | **Tipo Dado** | **Obrigatório** | **Descrição** |
|---|---|---|---|---|
| x-itau-apikey | header | string | sim | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante. |
| x-itau-correlationID | header | string | sim | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes. |
| x-itau-flowID | header | string | sim | A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. |
| idBoleto | Path |	string|	sim|	Dados para identificação do boleto para alteração, sendo composto por:   Código Agência - Obrigatório (4 caracteres)   Código Conta Corrente - Obrigatório (7 caracteres)   Dígito verificador (DAC) - Obrigatório (1 caracter)   Código Carteira - Obrigatório (3 caracteres)   Nosso Número - Obrigatório (8 ou 16 caracteres) - Máximo de 23 ou 31 caracteres |
| Protesto > codigo_tipo_protesto|	body|	integer|	sim|	O Código do protesto indica qual o tipo de ação de protesto. Podendo ser:   '1' - Protestar   '4' - Não Protestar  	'9' - Cancelar protesto |
| Protesto > quantidade_dias_protesto|	body|	integer|	sim|	A quantidade de dias de protesto é a quantidade requerida após o vencimento para protestar o título. Informar entre 1 e 99 dias. |

### Exemplo de Entrada 1

+ **PATCH/cash_management/v2/boletos/15000076969811091304690/protesto**

**Body:**
```json
{
  "protesto": {
    "codigo_tipo_protesto": 1,
    "quantidade_dias_protesto": 1
  }
}
```

### Exemplo de Entrada 2

+ **PATCH/cash_management/v2/boletos/15000005206111221674554/protesto**

**Body:**
```json
{
  "protesto": {
    "codigo_tipo_protesto": 9
  }
}
```

### Exemplo de Entrada 3

+ **PATCH/cash_management/v2/boletos/15000005206111221674554/protesto**

**Body:**
```json
{
  "protesto": {
    "codigo_tipo_protesto": 4
  }
}
```

### Códigos de Resposta

| Código de Status | Descrição |
|--------|-----------|
| `204` | Alteração/Instrução realizada com sucesso |
| `201` | O recurso foi criado de forma síncrona |
| `400` | parâmetros incorretos |
| `401` | Não autorizado |
| `403` | Acesso proibido |
| `404` | Recurso inexistente |
| `405` | Método não permitido |
| `422` | Dados informados estão fora do escopo definido para o campo |
| `428` | Pré-requisito necessário |
| `500` | Erro inesperado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `501` | Não implementado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `503` | Serviço indisponível, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |

### Exemplos de Saída

+ (status = 204 (No content), application/json)

```json
{}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "idBoleto",
      "mensagem": "Id Boleto inválido",
      "valor": "    0005206115700021961"
    }
  ]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "quantidade_dias_protesto",
      "mensagem": "Quantidade de dias de protesto inválido",
      "valor": "-2"
    }
  ]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "quantidade_dias_protesto",
      "mensagem": "Quantidade de dias de protesto inválido",
      "valor": "100"
    }
  ]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "quantidade_dias_protesto",
      "mensagem": "Quantidade de dias de protesto inválido",
      "valor": "0"
    }
  ]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "quantidade_dias_protesto",
      "mensagem": "Não informar quantidade de dias para instrução não protestar",
      "valor": "1"
    }
  ]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Entradas Bloqueadas, conta suspensa em cobrança.",
  "campos": [{
    "campo": "categoria_cobranca",
    "mensagem": "Entradas Bloqueadas, conta suspensa em cobrança.",
    "valor": null
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Ação não permitida, conta migrada",
  "campos": [{
    "campo": "beneficiário",
    "mensagem": "Ação não permitida, conta migrada",
    "valor": null
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Alteração não permitida para título já baixado ou liquidado",
    "valor": "BAIXADO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "data.dado_boleto.desconto.codigo_tipo_desconto",
    "mensagem": "Alteração não permitida para título descontado",
    "valor": "Descontado"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Ação não permitida para título em processo de liquidação",
    "valor": "EM_PAGAMENTO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação",
  "campos": [{
    "campo": "COD-RET",
    "mensagem": "Instrução não permitida, título enviado para protesto, aguardando retorno",
    "valor": ""
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação",
  "campos": [{
    "campo": "COD-RET",
    "mensagem": " Instrução não permitida, título não possui protesto em andamento",
    "valor": ""
  }]
}
```

## Seu Número

### [PATCH] /cash_management/v2/boletos/{idBoleto}/seu_numero

API responsável por efetuar a inclusão/alteração de seu número em um boleto. Seu número é a identificação do boleto que poderá ter letras e números e facilitará a consulta e acompanhamento do status do boleto. Este campo é para controle do cliente.

Os boletos elegíveis para terem ‘seu número’ alterado / cadastrado são:
* Títulos cadastrados no sistema;
* Títulos abertos (não baixados e liquidados);
* Títulos não pagos (sem baixa operacional);
* Títulos vencidos;
* Títulos não vencidos;
* Títulos que não estejam em processo de protesto;
* Títulos não descontados;

<span style="color:yellow; background-color:black; font-weight:bold;">
Regras para instrução ou alteração de dados do boleto:
</span>

<span style="color:yellow; background-color:black;">
Boletos ficam disponíveis para instruções e alterações no mesmo dia da emissão.
</span>

A seguir estão expostos os parâmetros exigidos por essa API e a descrição deles. Para obter mais informações de onde conseguir o x-itau-apikey, e o x-itau-correlationID, acesse o tópico ‘Informações necessárias’.

### Comando de Instrução
| **Parâmetro** | **Tipo Parâmetro** | **Tipo Dado** | **Obrigatório** | **Descrição** |
|---|---|---|---|---|
| x-itau-apikey | header | string | sim | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante. |
| x-itau-correlationID | header | string | sim | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes. |
| x-itau-flowID | header | string | sim | A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. |
| idBoleto | Path |	string|	sim|	Dados para identificação do boleto para alteração, sendo composto por:   Código Agência - Obrigatório (4 caracteres)   Código Conta Corrente - Obrigatório (7 caracteres)   Dígito verificador (DAC) - Obrigatório (1 caracter)   Código Carteira - Obrigatório (3 caracteres)   Nosso Número - Obrigatório (8 ou 16 caracteres) - Máximo de 23 ou 31 caracteres |
|texto_seu_numero|	body|	string|	sim|	Inserir no formato “9999999999”, possuindo 10 caracteres.|

### Exemplo de Entrada

+ **PATCH/cash_management/v2/boletos/15000005206115600039949/seu_numero**

**Body:**
```json
{
  "texto_seu_numero": "1234567890"
}
```

### Códigos de Resposta

| Código de Status | Descrição |
|--------|-----------|
| `204` | Alteração/Instrução realizada com sucesso |
| `201` | O recurso foi criado de forma síncrona |
| `400` | parâmetros incorretos |
| `401` | Não autorizado |
| `403` | Acesso proibido |
| `404` | Recurso inexistente |
| `405` | Método não permitido |
| `422` | Dados informados estão fora do escopo definido para o campo |
| `428` | Pré-requisito necessário |
| `500` | Erro inesperado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `501` | Não implementado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `503` | Serviço indisponível, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |

### Exemplos de Saída

+ (status = 204 (No content), application/json)

```json
{}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "lote.instrucoes.seu_numero.texto_seu_numero",
      "mensagem": "Texto Seu número inválido",
      "valor": "15000005206115700024089123456789012345678901234567"
    }
  ]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "idBoleto",
      "mensagem": "Id Boleto inválido",
      "valor": "           115600039949"
    }
  ]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Entradas Bloqueadas, conta suspensa em cobrança.",
  "campos": [{
    "campo": "categoria_cobranca",
    "mensagem": "Entradas Bloqueadas, conta suspensa em cobrança.",
    "valor": null
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Ação não permitida, conta migrada",
  "campos": [{
    "campo": "beneficiário",
    "mensagem": "Ação não permitida, conta migrada",
    "valor": null
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Alteração não permitida para título já baixado ou liquidado",
    "valor": "BAIXADO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "data.dado_boleto.desconto.codigo_tipo_desconto",
    "mensagem": "Alteração não permitida para título descontado",
    "valor": "Descontado"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Ação não permitida para título em processo de liquidação",
    "valor": "EM_PAGAMENTO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "lote.instrucoes.seu_numero.texto_seu_numero",
    "mensagem": "Seu número informado é igual ao cadastrado no título",
    "valor": "123"
  }]
}
```

## Data Limite de Pagamento

### [PATCH] /cash_management/v2/boletos/{idBoleto}/data_limite_pagamento

API responsável por efetuar a alteração da data limite de pagamento em um boleto. Após a data limite cadastrada o boleto não poderá mais ser pago e será cancelado no mercado após 7 dias automaticamente.

Obs: A data limite de pagamento padrão cadastrada na emissão do boleto caso não seja informada uma específica é de 10 anos após o vencimento.

Os boletos elegíveis para terem sua data limite de pagamento alterada são:
* Títulos cadastrados no sistema;
* Títulos abertos (não baixados e liquidados);
* Títulos não pagos (sem baixa operacional);
* Títulos vencidos;
* Títulos não vencidos;
* Títulos que não estejam em processo de protesto;
* Títulos não descontados;

<span style="color:yellow; background-color:black; font-weight:bold;">
Regras para instrução ou alteração de dados do boleto:
</span>

<span style="color:yellow; background-color:black;">
Boletos ficam disponíveis para instruções e alterações no mesmo dia da emissão.
</span>

A seguir estão expostos os parâmetros exigidos por essa API e a descrição deles. Para obter mais informações de onde conseguir o x-itau-apikey, e o x-itau-correlationID, acesse o tópico ‘Informações necessárias’.

### Comando de Instrução
| **Parâmetro** | **Tipo Parâmetro** | **Tipo Dado** | **Obrigatório** | **Descrição** |
|---|---|---|---|---|
| x-itau-apikey | header | string | sim | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante. |
| x-itau-correlationID | header | string | sim | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes. |
| x-itau-flowID | header | string | sim | A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. |
| idBoleto | Path |	string|	sim|	Dados para identificação do boleto para alteração, sendo composto por:   Código Agência - Obrigatório (4 caracteres)   Código Conta Corrente - Obrigatório (7 caracteres)   Dígito verificador (DAC) - Obrigatório (1 caracter)   Código Carteira - Obrigatório (3 caracteres)   Nosso Número - Obrigatório (8 ou 16 caracteres) - Máximo de 23 ou 31 caracteres |
|data_limite_pagamento|	body|	string|	sim|	Inserir no formato: AAAA-MM-DD.| 

### Exemplo de Entrada

+ **PATCH/cash_management/v2/boletos/15000005206115600039949/data_limite_pagamento**

**Body:**
```json
{
  "data_limite_pagamento": "2020-12-31"
}
```

### Códigos de Resposta

| Código de Status | Descrição |
|--------|-----------|
| `204` | Alteração/Instrução realizada com sucesso |
| `201` | O recurso foi criado de forma síncrona |
| `400` | parâmetros incorretos |
| `401` | Não autorizado |
| `403` | Acesso proibido |
| `404` | Recurso inexistente |
| `405` | Método não permitido |
| `422` | Dados informados estão fora do escopo definido para o campo |
| `428` | Pré-requisito necessário |
| `500` | Erro inesperado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `501` | Não implementado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `503` | Serviço indisponível, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |

### Exemplos de Saída

+ (status = 204 (No content), application/json)

```json
{}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "idBoleto",
      "mensagem": "Id Boleto inválido",
      "valor": "15000076 969811091304690"
    }
  ]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "data_limite_pagamento",
      "mensagem": "data limite de pagamento inválida",
      "valor": ""
    }
  ]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "data_limite_pagamento",
      "mensagem": "data limite de pagamento inválida",
      "valor": "null"
    }
  ]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "data_limite_pagamento",
      "mensagem": "data limite de pagamento inválida",
      "valor": "AAAA-11-13"
    }
  ]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "data_limite_pagamento",
      "mensagem": "data limite de pagamento inválida",
      "valor": "00-11-2013"
    }
  ]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Entradas Bloqueadas, conta suspensa em cobrança.",
  "campos": [{
    "campo": "categoria_cobranca",
    "mensagem": "Entradas Bloqueadas, conta suspensa em cobrança.",
    "valor": null
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Ação não permitida, conta migrada",
  "campos": [{
    "campo": "beneficiário",
    "mensagem": "Ação não permitida, conta migrada",
    "valor": null
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Alteração não permitida para título já baixado ou liquidado",
    "valor": "BAIXADO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "data.dado_boleto.desconto.codigo_tipo_desconto",
    "mensagem": "Alteração não permitida para título descontado",
    "valor": "Descontado"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Ação não permitida para título em processo de liquidação",
    "valor": "EM_PAGAMENTO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "lote.instrucoes.data_limite_pagamento.data_limite_pagamento",
    "mensagem": "Data limite de pagamento menor ou igual a data de vencimento",
    "valor": "2020-03-18"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "lote.instrucoes.data_limite_pagamento.data_limite_pagamento",
    "mensagem": "Data limite de pagamento menor que a data atual",
    "valor": "18.12.2019"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "lote.instrucoes.data_limite_pagamento.data_limite_pagamento",
    "mensagem": "Data limite de pagamento informada é igual a cadastrada no título",
    "valor": "2020-03-18"
  }]
}
```

## Negativação

### [PATCH] /cash_management/v2/boletos/{idBoleto}/negativacao

API responsável por efetuar a negativação em um boleto. Solicita o envio do boleto em atraso para negativação. Os pagadores serão notificados, informando que a negativação ocorrerá após 15 dias caso o boleto não seja pago.
- Não Negativar consiste em cancelar o envio do boleto para a negativação quando boleto possui negativação agendada.
- Cancelar negativação consiste em uma das duas situações abaixo:
    - Excluir o processo de Negativação durante o período de 15 dias onde o Pagador é notificado;
    - Retirar a negativação de um boleto que já está com processo de negativação concluído (após os 15 dias da carta de notificação).

Os boletos elegíveis para terem negativação alterada são:
* Títulos cadastrados no sistema;
* Títulos abertos (não baixados e liquidados);
* Títulos não pagos (sem baixa operacional);
* Títulos vencidos;
* Títulos não vencidos;
* Títulos não protestados;
* Títulos com instrução de protesto cadastrada;
* Titulos negativados;
* Títulos com instrução de negativação cadastrada;
* Títulos em processo de negativação;

<span style="color:yellow; background-color:black; font-weight:bold;">
Regras para instrução ou alteração de dados do boleto:
</span>

<span style="color:yellow; background-color:black;">
Boletos ficam disponíveis para instruções e alterações no mesmo dia da emissão.
</span>

A seguir estão expostos os parâmetros exigidos por essa API e a descrição deles. Para obter mais informações de onde conseguir o x-itau-apikey, e o x-itau-correlationID, acesse o tópico ‘Informações necessárias’.

### Comando de Instrução
| **Parâmetro** | **Tipo Parâmetro** | **Tipo Dado** | **Obrigatório** | **Descrição** |
|---|---|---|---|---|
| x-itau-apikey | header | string | sim | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante. |
| x-itau-correlationID | header | string | sim | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes. |
| x-itau-flowID | header | string | sim | A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. |
| idBoleto | Path |	string|	sim|	Dados para identificação do boleto para alteração, sendo composto por:   Código Agência - Obrigatório (4 caracteres)   Código Conta Corrente - Obrigatório (7 caracteres)   Dígito verificador (DAC) - Obrigatório (1 caracter)   Código Carteira - Obrigatório (3 caracteres)   Nosso Número - Obrigatório (8 ou 16 caracteres) - Máximo de 23 ou 31 caracteres |
| Negativação > codigo_tipo_negativacao|	body|	integer|	sim|	Código que indica qual o tipo de acao de negativação   '2' - Negativar   '5' - Não Negativar   '10' - Cancelar Negativação |
| Negativação > quantidade_dias_negativacao|	body|	integer|	não |	Quantidade de dias após o vencimento para negativar o título. Campo obrigatório quando tipo for igual a '2'. Informar entre 2 e 99 dias |

### Exemplo de Entrada 1

+ **PATCH/cash_management/v2/boletos/15000076969811091984690/negativacao**

**Body:**
```json
{
  "negativacao": {
    "codigo_tipo_negativacao": 2,
    "quantidade_dias_negativacao": 23
  }
}
```

### Exemplo de Entrada 2

+ **PATCH/cash_management/v2/boletos/15000076969811091984690/negativacao**

**Body:**
```json
{
  "negativacao": {
    "codigo_tipo_negativacao": 5
  }
}
```

### Exemplo de Entrada 3

+ **PATCH/cash_management/v2/boletos/15000076969811091984690/negativacao**

**Body:**
```json
{
  "negativacao": {
    "codigo_tipo_negativacao": 10
  }
}
```

### Códigos de Resposta

| Código de Status | Descrição |
|--------|-----------|
| `204` | Alteração/Instrução realizada com sucesso |
| `201` | O recurso foi criado de forma síncrona |
| `400` | parâmetros incorretos |
| `401` | Não autorizado |
| `403` | Acesso proibido |
| `404` | Recurso inexistente |
| `405` | Método não permitido |
| `422` | Dados informados estão fora do escopo definido para o campo |
| `428` | Pré-requisito necessário |
| `500` | Erro inesperado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `501` | Não implementado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `503` | Serviço indisponível, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |

### Exemplos de Saída

+ (status = 204 (No content), application/json)

```json
{}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "codigo_tipo_negativacao",
      "mensagem": "código tipo de negativação inválido",
      "valor": "3"
    }
  ]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "idBoleto",
      "mensagem": "Id Boleto inválido",
      "valor": "1500007 69811091984690"
    }
  ]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Entradas Bloqueadas, conta suspensa em cobrança.",
  "campos": [{
    "campo": "categoria_cobranca",
    "mensagem": "Entradas Bloqueadas, conta suspensa em cobrança.",
    "valor": null
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Ação não permitida, conta migrada",
  "campos": [{
    "campo": "beneficiário",
    "mensagem": "Ação não permitida, conta migrada",
    "valor": null
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Alteração não permitida para título já baixado ou liquidado",
    "valor": "BAIXADO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "data.dado_boleto.desconto.codigo_tipo_desconto",
    "mensagem": "Alteração não permitida para título descontado",
    "valor": "Descontado"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Ação não permitida para título em processo de liquidação",
    "valor": "EM_PAGAMENTO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "lote.instrucoes.negativacao.quantidade_dias_negativacao",
    "mensagem": "Quantidade dias de negativação deve ser igual ou maior a 2",
    "valor": "0"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "",
    "mensagem": "Instrução não permitida, título negativado",
    "valor": ""
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "",
    "mensagem": "Instrução não permitida, título enviado para negativação, aguardando resposta",
    "valor": ""
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "situacaoProtesto",
    "mensagem": "Alteração não permitida para título em processo de protesto",
    "valor": "Em protesto"
  }]
}
```

## Pagador

### [PATCH] /cash_management/v2/boletos/{idBoleto}/pagador

API responsável por efetuar a alteração de dados de um pagador em um boleto.

Os boletos elegíveis para terem o ‘pagador‘ alterado são:
* Títulos cadastrados no sistema;
* Títulos abertos (não baixados e liquidados);
* Títulos não pagos (sem baixa operacional);
* Títulos vencidos;
* Títulos não vencidos;
* Títulos não protestados;
* Títulos com instrução de protesto cadastrada;
* Títulos com instrução de negativação cadastrada;

<span style="color:yellow; background-color:black; font-weight:bold;">
Regras para instrução ou alteração de dados do boleto:
</span>

<span style="color:yellow; background-color:black;">
Boletos ficam disponíveis para instruções e alterações no mesmo dia da emissão.
</span>

A seguir estão expostos os parâmetros exigidos por essa API e a descrição deles. Para obter mais informações de onde conseguir o x-itau-apikey, e o x-itau-correlationID, acesse o tópico ‘Informações necessárias’.

### Comando de Instrução
| **Parâmetro**                        | **Tipo Parâmetro** | **Tipo Dado** | **Obrigatório** | **Descrição**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
|--------------------------------------|---|---|---|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| x-itau-apikey                        | header | string | sim | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| x-itau-correlationID                 | header | string | sim | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes.                                                                                                                                                                                                                                                                                                                                                                                                  |
| x-itau-flowID                        | header | string | sim | A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. |
| idBoleto                             | Path |	string|	sim| 	Dados para identificação do boleto para alteração, sendo composto por:   Código Agência - Obrigatório (4 caracteres)   Código Conta Corrente - Obrigatório (7 caracteres)   Dígito verificador (DAC) - Obrigatório (1 caracter)   Código Carteira - Obrigatório (3 caracteres)   Nosso Número - Obrigatório (8 ou 16 caracteres) - Máximo de 23 ou 31 caracteres                                                                                                                                                                                                                         |
| pagador > pessoa > nome_pessoa       | body | string | sim | <br/>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 
| pagador > endereco > nome_logradouro | body | string | sim | Nome do logradouro, número, complemento  Tamanho do campo: máximo 45 caracteres                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| pagador > endereco > nome_bairro     | body | string | sim | Nome do bairro  Tamanho do campo: máximo 15 caracteres                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| pagador > endereco > nome_cidade     | body | string | sim | Nome da cidade  Tamanho do campo: 20 máximo caracteres                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| pagador > endereco > sigla_UF        | body | string | sim | Sigla da UF  Tamanho do campo: 2 caracteres                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| pagador > endereco > numero_CEP      | body | string | sim | CEP  Tamanho do campo: 8 caracteres                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

### Exemplo de Entrada 1

+ **PATCH/cash_management/v2/boletos/15000076969811090764690/pagador**

**Body:**
```json
{
  "pagador": {
    "pessoa": {
      "nome_pessoa": "João Silva",
      "tipo_pessoa": {
        "codigo_tipo_pessoa": "F",
        "numero_cadastro_pessoa_fisica": "33378996846"
      }
    },
    "endereco": {
      "nome_logradouro": "Av do Estado, 5533",
      "nome_bairro": "Mooca",
      "nome_cidade": "São Paulo",
      "sigla_uf": "SP",
      "numero_cep": "12345678"
    }
  }
}
```

### Exemplo de Entrada 2

+ **PATCH/cash_management/v2/boletos/15000076969811090764690/pagador**

**Body:**
```json
{
  "pagador": {
    "pessoa": {
      "nome_pessoa": "João Silva",
      "tipo_pessoa": {
        "codigo_tipo_pessoa": "J",
        "numero_cadastro_nacional_pessoa_juridica": "33378990006846"
      }
    },
    "endereco": {
      "nome_logradouro": "Av do Estado, 5533",
      "nome_bairro": "Mooca",
      "nome_cidade": "São Paulo",
      "sigla_uf": "SP",
      "numero_cep": "12345678"
    },
    "mensagem_email": "Refere-se ao produto/serviço prestado ",
    "assunto_email": "Boleto Itaú",
    "pagador": {
      "texto_endereco_email": "joao@itau.com.br"
    }
  }
```

### Códigos de Resposta

| Código de Status | Descrição |
|--------|-----------|
| `204` | Alteração/Instrução realizada com sucesso |
| `201` | O recurso foi criado de forma síncrona |
| `400` | parâmetros incorretos |
| `401` | Não autorizado |
| `403` | Acesso proibido |
| `404` | Recurso inexistente |
| `405` | Método não permitido |
| `422` | Dados informados estão fora do escopo definido para o campo |
| `428` | Pré-requisito necessário |
| `500` | Erro inesperado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `501` | Não implementado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `503` | Serviço indisponível, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |

### Exemplos de Saida

+ (status = 204 (No content), application/json)

```json
{}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "idBoleto",
      "mensagem": "Id Boleto inválido",
      "valor": "15000 05206110900038995"
    }
  ]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Entradas Bloqueadas, conta suspensa em cobrança.",
  "campos": [{
    "campo": "categoria_cobranca",
    "mensagem": "Entradas Bloqueadas, conta suspensa em cobrança.",
    "valor": null
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Ação não permitida, conta migrada",
  "campos": [{
    "campo": "beneficiário",
    "mensagem": "Ação não permitida, conta migrada",
    "valor": null
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Alteração não permitida para título já baixado ou liquidado",
    "valor": "BAIXADO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "data.dado_boleto.desconto.codigo_tipo_desconto",
    "mensagem": "Alteração não permitida para título descontado",
    "valor": "Descontado"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Ação não permitida para título em processo de liquidação",
    "valor": "EM_PAGAMENTO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação",
  "campos": [{
    "campo": "endereco",
    "mensagem": "Para alteração do estado, obrigatório informar o CEP",
    "valor": ""
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação",
  "campos": [{
    "campo": "numero_cep ",
    "mensagem": "CEP do Pagador inválido",
    "valor": "1234"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação",
  "campos": [{
    "campo": "COD-RET ",
    "mensagem": " CEP do pagador incompatível com a sigla do estado",
    "valor": ""
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação",
  "campos": [{
    "campo": "COD-RET",
    "mensagem": "Beneficiário possui pendência de contrato",
    "valor": ""
  }]
}
```

## Recebimento Divergente

### [PATCH] /cash_management/v2/boletos/{idBoleto}/recebimento_divergente

API responsável por efetuar a inclusão ou alteração de parâmetros de configuração de aceite de recebimento divergente do valor de um boleto.

Os boletos elegíveis para terem o ‘recebimento divergente‘ alterado são:
* Títulos cadastrados no sistema;
* Títulos abertos (não baixados e liquidados);
* Títulos não pagos (sem baixa operacional);
* Títulos vencidos;
* Títulos não vencidos;
* Títulos não protestados;
* Títulos com instrução de protesto cadastrada;
* Títulos com instrução de negativação cadastrada;

<span style="color:yellow; background-color:black; font-weight:bold;">
Regras para instrução ou alteração de dados do boleto:
</span>

<span style="color:yellow; background-color:black;">
Boletos ficam disponíveis para instruções e alterações no mesmo dia da emissão.
</span>

A seguir estão expostos os parâmetros exigidos por essa API e a descrição deles. Para obter mais informações de onde conseguir o x-itau-apikey, e o x-itau-correlationID, acesse o tópico ‘Informações necessárias’.

### Comando de Instrução
| **Parâmetro** | **Tipo Parâmetro** | **Tipo Dado** | **Obrigatório** | **Descrição** |
|---|---|---|---|---|
| x-itau-apikey | header | string | sim | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante. |
| x-itau-correlationID | header | string | sim | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes. |
| x-itau-flowID | header | string | sim | A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. |
| idBoleto | Path |	string|	sim|	Dados para identificação do boleto para alteração, sendo composto por:   Código Agência - Obrigatório (4 caracteres)   Código Conta Corrente - Obrigatório (7 caracteres)   Dígito verificador (DAC) - Obrigatório (1 caracter)   Código Carteira - Obrigatório (3 caracteres)   Nosso Número - Obrigatório (8 ou 16 caracteres) - Máximo de 23 ou 31 caracteres |
| recebimento_divergente > codigo_tipo_autorizacao | body | string | sim | Tipo de autorização de recebimento divergente da cobrança, 1 - Quando o título aceita qualquer valor divergente ao da cobrança, 2 - Quando o título contém uma faixa de valores aceitos para recebimentos divergentes, 3 - Quando o título não deve aceitar pagamentos de valores divergentes ao da cobrança, 4 - Quando o título aceitar pagamentos de valores superiores ao mínimo definido | 
| recebimento_divergente > valor_minimo | body | string | sim | Valor mínimo permitido para pagamento. Obrigatório para codigo_aceite_pagamento_divergente 2 ou 4 e codigo_tipo_recebimento V  |
| recebimento_divergente > percentual_minimo | body | string | sim | Percentual mínimo permitido para pagamento. Obrigatório para codigo_tipo_autorizacao 2 ou 4 e codigo_tipo_recebimento P |
| recebimento_divergente > valor_maximo | body | string | sim | Valor máximo permitido para pagamento. Obrigatório para codigo_tipo_autorizacao 2 e codigo_tipo_recebimento V |
| recebimento_divergente > percentual_maximo | body | string | sim | Percentual máximo permitido. Obrigatório para codigo_tipo_autorizacao 2 e codigo_tipo_recebimento P |

### Exemplo de Entrada 1

+ **PATCH/cash_management/v2/boletos/15000076969811090764690/recebimento_divergente**

**Body:**
```json
{
  "recebimento_divergente": {
    "codigo_tipo_autorizacao": 2,
    "percentual_minimo": "10.00000",
    "percentual_maximo": "100.00000"
  }
}
```

### Exemplo de Entrada 2

+ **PATCH/cash_management/v2/boletos/15000076969811090764690/recebimento_divergente**

Quando o código tipo autorização for igual a um deve ser enviado na requisição a seguinte estrutura do json:

**Body:**
```json
{
  "recebimento_divergente": {
    "codigo_tipo_autorizacao": 1
  }
}
```

### Exemplo de Entrada 3

+ **PATCH/cash_management/v2/boletos/15000076969811090764690/recebimento_divergente**

Quando o código tipo autorização for igual a três deve ser enviado na requisição a seguinte estrutura do json:

**Body:**
```json
{
  "recebimento_divergente": {
    "codigo_tipo_autorizacao": 3
  }
}
```

### Exemplo de Entrada 4

+ **PATCH/cash_management/v2/boletos/15000076969811090764690/recebimento_divergente**

Quando o código tipo autorização for igual a quatro deve ser enviado na requisição a seguinte estrutura do json:

**Body:**
```json
{
  "recebimento_divergente": {
    "codigo_tipo_autorizacao": 4,
    "percentual_minimo": "10.00000"
  }
}
```

### Exemplo de Entrada 5

+ **PATCH/cash_management/v2/boletos/15000076969811090764690/recebimento_divergente**

Quando o código tipo autorização for igual a quatro deve ser enviado na requisição a seguinte estrutura do json:

**Body:**
```json
{
  "recebimento_divergente": {
    "codigo_tipo_autorizacao": 4,
    "valor_minimo": "10.00"
  }
}
```

### Códigos de Resposta

| Código de Status | Descrição |
|--------|-----------|
| `204` | Alteração/Instrução realizada com sucesso |
| `201` | O recurso foi criado de forma síncrona |
| `400` | parâmetros incorretos |
| `401` | Não autorizado |
| `403` | Acesso proibido |
| `404` | Recurso inexistente |
| `405` | Método não permitido |
| `422` | Dados informados estão fora do escopo definido para o campo |
| `428` | Pré-requisito necessário |
| `500` | Erro inesperado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `501` | Não implementado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `503` | Serviço indisponível, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |

### Exemplos de Saida

+ (status = 204 (No content), application/json)

```json
{}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "idBoleto",
      "mensagem": "Id Boleto inválido",
      "valor": "1500005206110900038995"
    }
  ]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos",
  "campos": [
    {
      "campo": "",
      "mensagem": "Não é permitido o envio do percentual mínimo e percentual máximo com o mesmo valor",
      "valor": "100.00000"
    }
  ]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [
    {
      "campo": "percentual_minimo",
      "mensagem": "Percentual mínimo inválido",
      "valor": "50.000"
    }
  ]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos",
  "campos": [
    {
      "campo": "percentual_minimo",
      "mensagem": "Percentual mínimo deve ser menor que percentual máximo",
      "valor": "100.00000"
    },
    {
      "campo": "percentual_maximo",
      "mensagem": "Percentual máximo deve ser maior que percentual mínimo",
      "valor": "10.00000"
    }
  ]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos",
  "campos": [
    {
      "campo": "percentual_maximo",
      "mensagem": "Percentual máximo deve ser maior ou igual a 100",
      "valor": "90.00000"
    }
  ]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [
    {
      "campo": "valor_minimo",
      "mensagem": "Valor minimo deve ser menor ou igual ao valor do titulo",
      "valor": "100000.00"
    }
  ]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos",
  "campos": [
    {
      "campo": "valor_minimo",
      "mensagem": "Valor mínimo deve ser maior que zero",
      "valor": "00.00"
    }
  ]
}
```

## Sacador Avalista (atual Beneficiário Final)

### [PATCH] /cash_management/v2/boletos/{idBoleto}/sacador_avalista

API responsável por efetuar a inclusão ou alteração de dados do Sacador Avalista (atual Beneficiário Final) em um boleto.

Os boletos elegíveis para terem o ‘Sacador Avalista (atual Beneficiário Final)‘ alterado são:
* Títulos cadastrados no sistema;
* Títulos abertos (não baixados e liquidados);
* Títulos não pagos (sem baixa operacional);
* Títulos vencidos;
* Títulos não vencidos;
* Títulos não protestados;
* Títulos com instrução de protesto cadastrada;
* Títulos com instrução de negativação cadastrada;

<span style="color:yellow; background-color:black; font-weight:bold;">
Regras para instrução ou alteração de dados do boleto:
</span>

<span style="color:yellow; background-color:black;">
Boletos ficam disponíveis para instruções e alterações no mesmo dia da emissão.
</span>

A seguir estão expostos os parâmetros exigidos por essa API e a descrição deles. Para obter mais informações de onde conseguir o x-itau-apikey, e o x-itau-correlationID, acesse o tópico ‘Informações necessárias’.

### Comando de Instrução
| **Parâmetro**                                 | **Tipo Parâmetro** | **Tipo Dado** | **Obrigatório** | **Descrição**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
|-----------------------------------------------|---|---------------|---|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| x-itau-apikey                                 | header | string        | sim | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| x-itau-correlationID                          | header | string        | sim | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes.                                                                                                                                                                                                                                                                                                                                                                                                  |
| x-itau-flowID                                 | header | string        | sim | A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. |
| idBoleto                                      | Path | 	string       |	sim| 	Dados para identificação do boleto para alteração, sendo composto por:   Código Agência - Obrigatório (4 caracteres)   Código Conta Corrente - Obrigatório (7 caracteres)   Dígito verificador (DAC) - Obrigatório (1 caracter)   Código Carteira - Obrigatório (3 caracteres)   Nosso Número - Obrigatório (8 ou 16 caracteres) - Máximo de 23 ou 31 caracteres                                                                                                                                                                                                                         |
| sacador_avalista > pessoa > nome_pessoa       | body | string        | sim | Nome/Razão social do pagador                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 
| sacador_avalista > endereco > nome_logradouro | body | string        | sim | Nome do logradouro, número, complemento  Tamanho do campo: máximo 45 caracteres                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| sacador_avalista > endereco > nome_bairro     | body | string        | sim | Nome do bairro  Tamanho do campo: máximo 15 caracteres                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| sacador_avalista > endereco > nome_cidade     | body | string        | sim | Nome da cidade  Tamanho do campo: 20 máximo caracteres                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| sacador_avalista > endereco > sigla_UF        | body | string        | sim | Sigla da UF  Tamanho do campo: 2 caracteres                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| sacador_avalista > endereco > numero_CEP      | body | string        | sim | CEP  Tamanho do campo: 8 caracteres                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| sacador_avalista > exclusao_sacador_avalista  |	body | boolean       | não| Indicador de exclusão do Sacador Avalista (atual Beneficiário Final) do boleto. Para realizar a exclusão do beneficiario final, deve-se enviar esse parametro como "true" e todos os outros campos devem ser nulos.                                                                                                                                                                                                                                                                                                                                                                       |	
| pagador > texto_endereco_email                |	body | string        | não| Inclusão de e-mail do pagador. Não é possível alterar o e-mail do pagador                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |	

### Exemplo de Entrada 1

+ **PATCH/cash_management/v2/boletos/15000076969811090764690/sacador_avalista**

Exemplo de inclusão ou alteração de Sacador Avalista (atual Beneficiário Final), tipo pessoa física.

**Body:**
```json
{
  "sacador_avalista": {
    "pessoa": {
      "nome_pessoa": "Paulo",
      "tipo_pessoa": {
        "codigo_tipo_pessoa": "F",
        "numero_cadastro_pessoa_fisica": "05201005225"
      }
    },
    "endereco": {
      "nome_logradouro": "Av do Estado, 5533",
      "nome_bairro": "Mooca",
      "nome_cidade": "São Paulo",
      "sigla_UF": "SP",
      "numero_CEP": "01001000"
    }
  }
}
```

### Exemplo de Entrada 2

+ **PATCH/cash_management/v2/boletos/15000076969811090764690/sacador_avalista**

Exemplo de inclusão ou alteração de Sacador Avalista (atual Beneficiário Final), tipo pessoa jurídica.

**Body:**
```json
{
  "sacador_avalista": {
    "pessoa": {
      "nome_pessoa": "Paulo",
      "tipo_pessoa": {
        "codigo_tipo_pessoa": "J",
        "numero_cadastro_nacional_pessoa_juridica": "84768661000151"
      }
    },
    "endereco": {
      "nome_logradouro": "Av do Estado, 5533",
      "nome_bairro": "Mooca",
      "nome_cidade": "São Paulo",
      "sigla_UF": "SP",
      "numero_CEP": "01001000"
    }
  }
}
```

### Exemplo de Entrada 3

+ **PATCH/cash_management/v2/boletos/15000076969811090764690/sacador_avalista**

Exemplo de solicitação de exclusão de Sacador Avalista (atual Beneficiário Final), quando já existe sacador avalista cadastrado no título.

**Body:**
```json
{
  "sacador_avalista": {
    "exclusao_sacador_avalista": true
  }
}
```

### Códigos de Resposta

| Código de Status | Descrição |
|--------|-----------|
| `204` | Alteração/Instrução realizada com sucesso |
| `201` | O recurso foi criado de forma síncrona |
| `400` | parâmetros incorretos |
| `401` | Não autorizado |
| `403` | Acesso proibido |
| `404` | Recurso inexistente |
| `405` | Método não permitido |
| `422` | Dados informados estão fora do escopo definido para o campo |
| `428` | Pré-requisito necessário |
| `500` | Erro inesperado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `501` | Não implementado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |
| `503` | Serviço indisponível, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente. |

### Exemplos de Saida

+ (status = 204 (No content), application/json)

```json
{}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos.",
  "campos": [
    {
      "campo": "idBoleto",
      "mensagem": "Id Boleto inválido",
      "valor": "1500005206110900038995"
    }
  ]
}
```

+ (status = 400, application/json)

```json
{
  "codigo": "400",
  "mensagem": "Erro na validação de Campos",
  "campos": [
    {
      "mensagem": "Para exclusão de Sacador Avalista (atual Beneficiário Final) os demais parâmetros da requisição devem ser nulos",
      "valor": "br.com.itau.caps.boleto.command.instrucao.dto.request.DadosBeneficiarioRequestDto@383b80e4"
    }
  ]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Alteração não permitida para título já baixado ou liquidado",
    "valor": "BAIXADO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação de Campos.",
  "campos": [{
    "campo": "situacaoGeral",
    "mensagem": "Ação não permitida para título em processo de liquidação",
    "valor": "EM_PAGAMENTO"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação",
  "campos": [{
    "campo": "endereco",
    "mensagem": "Para alteração do estado, obrigatório informar o CEP",
    "valor": ""
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação",
  "campos": [{
    "campo": "numero_cep ",
    "mensagem": "CEP do Sacador Avalista (atual Beneficiário Final) inválido",
    "valor": "1234"
  }]
}
```

+ (status = 422, application/json)

Obs: Exemplo não replicável na virtualização

```json
{
  "codigo": "422",
  "mensagem": "Erro na validação",
  "campos": [{
    "campo": "COD-RET ",
    "mensagem": " CEP do Sacador Avalista (atual Beneficiário Final) incompatível com a sigla do estado",
    "valor": ""
  }]
}
```

|| API Consulta de Detalhes do Título |

## Guia de Implementação da Solução
A empresa parceira que utilizará a API Consulta de Detalhes do Título do Banco Itaú, deverá previamente ser cadastrada pelo Banco no Sistema Autorizador interno. Ao realizar este cadastro, o Banco retornará ao cliente três parâmetros para uso do autorizador (client_id, client_secret e grant_type). Estes três parâmetros servirão para que o STS, ao recebê-los via método POST (*Endpoint* https://sts.itau.com.br/api/oauth/token, retorne ao usuário um *Token*  de acesso que deverá ser validado pela API. Confira abaixo:

*Tecnicamente, todas as requisições ao Endpoint do STS devem ser realizadas por usuários que estejam previamente cadastrados no Banco. A autenticação deve ser feita via header no POST.*

## Consulta Detalhes do Título

### [GET] /boletos

API responsável por retornar os detalhes do boleto, tais como: dados do pagador, beneficiário, beneficiário final, dados de pagamentos, histórico.

Os status dos boletos elegíveis para serem consultados são:
* Em Aberto;
* Aguardando Confirmação de Pagamento;
* Paga;
* Baixada;

Para boletos baixados:
Quando o motivo da baixa for “baixa por ter sido liquidado”, o boleto foi pago por meio de um Qr Code

### Scopes
Para que o cliente consiga acessar nossa API de consulta de boletos, na hora do cadastro da aplicação consumidora no portal de certificados de parceiro, deve ser adicionado o scope/funcionalidade: **boletoscash-boletos-consulta_titulo**

### Parâmetros para a Consulta
| **Parâmetro**          | **Tipo Parâmetro** | **Tipo Dado** | **Obrigatório** | **Descrição**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
|------------------------|--------------------|---------------|-----------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `x-itau-apikey`        | header             | string        | sim             | client_id gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `x-itau-correlationID` | header             | string        | sim             | identificador de correlação utilizado como um agrupar dentro da estrutura de audit trail e que permite relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes.                                                                                                                                                                                                                                                                                                                                                                                                 |
| `x-itau-flowID`        | header             | string        | sim             | A implementação de um flowID permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do flowID, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o flowID nos logs também permite extrair algum tipo de métrica através do log. 
| `id_beneficiario`      | param              | integer       | sim             | Dados para identificação do boleto para consulta, sendo composto por:   Código Agência - Obrigatório (4 caracteres), Código Conta - Obrigatório (7 caracteres), DAC - Obrigatório (1 caractere)                                                                                                                                                                                                                                                                                                                                                                                          |
| `codigo_carteira`      | param              | integer       | sim             | Código da carteira do boleto                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `nosso_numero`         | param              | integer       | sim             | Número de identificação do boleto                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

### URLs Gateway de Parceiros Externos
| **Ambiente** | **URL** | **Exemplo** |
|--------------|---------|-------------|
| Produção | secure.api.cloud.itau.com.br | https://secure.api.cloud.itau.com.br/boletoscash/v2/boletos?id_beneficiario={id_beneficiario}&codigo_carteira={codigo_carteira}&nosso_numero={nosso_numero}&view={view} |

### Exemplo de Entrada

+ **GET ../boletos?id_beneficiario=123456789012&codigo_carteira=123&nosso_numero=1234567890123456&view=specific**

### Códigos de Resposta
| Código de Status | Descrição                                                   |
|--------|-------------------------------------------------------------|
| `200` | Consulta realizada com sucesso                              |
| `400` | Parâmetros incorretos                                       |
| `401` | Não autorizado                                              |
| `403` | Acesso Proibido                                             |
| `404` | Recurso inexistente                                         |
| `405` | Método não permitido                                        |
| `422` | Dados informados estão fora do escopo definido para o campo |
| `428` | Pré-requisito necessário                                    |
| `500` | Erro inesperado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente.                                             |
| `501` | Não implementado, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente.                                            |
| `503` | Serviço indisponível, consulte em instantes se seu boleto foi emitido. Caso não seja encontrado, efetue o registro novamente.                                        |

### Glossário
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

### Situação Boleto / Situação Geral Boleto
| **Código** | **Situação**                        | **Descrição**                                                                                                                                                    |
|------------|-------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `1`        | Em Aberto                           | Boleto em aberto que não foi pago ou baixado. O pagador pode efetuar o pagamento do boleto normalmente                                                           |
| `2`        | Aguardando Confirmação de Pagamento | Boleto com confirmação de pagamento realizado em outra instituição financeira, em que o valor ainda não foi recebido pelo Itaú e transferido para o beneficiário |
| `4`        | Paga                                | Boleto pago em seu valor total a ser disponibilizado ao beneficiário de acordo com o floating contratado.                                            	           |
| `8`        | Baixada                             | Boleto cancelado: boleto foi baixado por solicitação do cliente ou por decurso de prazo (baixa automática pelo sistema).                                         |

### Descrição Instrumento Cobrança
| **Retorno**        | **Descrição**                                                     |
|--------------------|-------------------------------------------------------------------|
| `boleto`           | Boleto padrão                                                     |
| `bolecode`         | Boleto com QR code que permite que o pagamento seja feito via PIX |

### Forma Envio
| **Retorno** | **Descrição**                                                         |
|-------------|-----------------------------------------------------------------------|
| `impressão` | Boleto disponibilizado para o pagador por meio de arquivo pdf na tela |
| `postagem`  | Boleto enviado para o pagador em sua residencia via correspondencia   |
| `email`     | Boleto enviado para o pagador via email                               |

### Tipo Boleto
| **Retorno** | **Descrição**                                   |
|-------------|-------------------------------------------------|
| `a vista`   | Boleto emitido à vista                          |
| `proposta`  | Boleto emitido com oferta de produto ou serviço |

### Código Espécie e Descrição Espécie
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

### Código Tipo Protesto
| **Código** | **Descrição**                                                                                                                   |
|------------|---------------------------------------------------------------------------------------------------------------------------------|
| `1`        | Protesto Agendado, o boleto será enviado para protesto quando estiver vencido pela quantidade de dias estabelecida pelo cliente |
| `3`        | Protesto Falimentar, Protesto solicitado para fins falimentares                                                                 |
| `4`        | Não Protestar, cancela o status `1` de protesto agendado, boleto não será enviado para protesto                                 |

### Código Tipo Vencimento
| **Código** | **Situação**                                          |
|------------|-------------------------------------------------------|
| `1`        | Vencimento do boleto no mesmo dia de sua emissão      |
| `3`        | Vencimento do boleto na data determinada pelo cliente |

### Código canal pagamento
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

### Código Meio pagamento
| **Código** | **Descrição**           |
|------------|-------------------------|
| `1`        | Espécie      	       |
| `2`        | Débito em conta         |
| `3`        | Cartão de crédito       |
| `4`        | Cheque      	       |
| `5`        | Não identificado        |

### Código Tipo Recebimento
| **Código** | **Descrição**           |
|------------|-------------------------|
| `V`        | Valor      	       |
| `P`        | Percentual              |

### Código Tipo Autorização
| **Código** | **Descrição**           									                                                  |
|------------|------------------------------------------------------------------------------------|
| `01`        | Quando o boleto aceita qualquer valor divergente ao da cobrança      	       		    |
| `02`        | Quando o boleto contém uma faixa de valores aceitos para recebimentos divergentes  |
| `03`        | Quando o boleto não deve aceitar pagamentos de valores divergentes ao da cobrança  |
| `04`        | Quando o boleto aceitar pagamentos de valores superiores ao mínimo definido      	 |

Chamada da API
```
/boletos
```

### Exemplo de Saída

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

|| Como montar o seu boleto? |

Atenção: o fator vencimento será reiniciado a partir de 22/02/20225, atualize a forma como gera o boleto físico, garantindo assim o formato correto, que contribui para uma experiência de pagamento mais eficiente e segura aos pagadores.

| FATOR | VENCIMENTO |
|-------|------------|
| 9998  | 20/02/2025 | 
| 9999  | 21/02/2025 | 
| 1000  | 22/02/2025 | 
| 1001  | 23/02/2025 | 
| 1002  | 24/02/2025 | 
| 1003  | 25/02/2025 | 
| 1004  | 26/02/2025 | 
| 9999  | 13/10/2049 | 

## Modelo de ficha de Compensação

### Itens obrigatórios

1 – NOME DO BANCO DESTINATÁRIO

Deve ser obrigatoriamente indicado na margem superior esquerda da Ficha de Compensação (Banco Itaú), devendo conter também o logotipo do banco.

2 – CÓDIGO DO BANCO DESTINATÁRIO

Deve ser impresso na margem superior esquerda do boleto (341-7), à direita do nome do banco, com o seu respectivo DV (Dígito Verificador)

3 – LOCAL DE PAGAMENTO

Deverá apresentar as literais: “Pague pelo aplicativo, internet ou em agências e correspondentes”

4 – DATA DO DOCUMENTO

Deve ser indicada a data em que o documento foi gerado.

5 – NÚMERO DO DOCUMENTO

Para as carteiras de 15 dígitos (nas quais são utilizadas 15 posições numéricas para identificação do título liquidado), há a obrigatoriedade de preenchimento deste campo, que se compõe de 7 dígitos mais o respectivo DAC, calculado pelo critério do Módulo 10. Para as demais carteiras, caso não haja necessidade de protesto, este campo pode ser deixado em branco.

6 – CARTEIRA

Informar o número da carteira utilizada no Itaú.

7 - ESPÉCIE

Essencial para identificação da moeda em que a operação foi efetuada - “R$” se em Real.

8 – AGÊNCIA / CONTA BENEFICIÁRIO / NOSSO NÚMERO

Os dados deverão ser preenchidos de forma a ser facilmente identificados, conforme layout do Banco, ou seja, “1234/56789-7” e “123/45678901-5”, respectivamente.

9 – CAMPOS SITUADOS ABAIXO DO CAMPO “VALOR DO DOCUMENTO”

Não deverão ser preenchidos (uso exclusivo do funcionário-caixa). Eventuais valores que o beneficiário queira cobrar deverão ser indicados no campo “Instruções” do boleto.

10 – INSTRUÇÕES

•	Deverá ser utilizado exclusivamente para indicação das condições de recebimento do título na forma mais objetiva possível.  
•	Deverá apresentar na frente da sua identificação a literal “AS INFORMAÇÕES DESTE BOLETO SÃO DE EXCLUSIVA RESPONSABILIDADE DO BENEFICIÁRIO”.  
•	Para evitar comprometimento de cálculos e erros de recebimento, as condições devem ser expressas em valores, ao invés de percentuais e os prazos devem ser estipulados em datas, nunca em quantidade de dias.  
•	Não utilizar instruções desnecessárias, em duplicidade, incompatíveis às demais ou que firam as normas de defesa do consumidor (entre elas o repasse da "Tarifa Bancária" que é negociada entre o Banco e o Beneficiário e não entre o Banco e o Pagador);

•	Exemplos:

▪ 	Após DD/MM/AAAA, cobra R$(valor) por dia de atraso;  
▪ 	Após DD/MM/AAAA cobrar multa de R$ (valor);  
▪ 	Até DD/MM/AAAA conceder desconto de R$ (valor);  
▪ 	Até DD/MM/AAAA conceder desconto de R$ (valor) por dia de antecipação;  
▪ 	Dispensar juros de mora até DD/MM/AAAA  
▪ 	Banco autorizado a receber até DD/MM/AAAA

11 – BENEFICIÁRIO FINAL (EX-SACADOR AVALISTA)

Deve ser informado o Nome do beneficiário Final (ex-Sacador Avalista), se for o caso.  
Caso o título possua a figura do Beneficiário Final deverá ser preenchido com Razão Social/Nome e respectivo CPF/CNPJ.  
Não indicar os mesmos dados do beneficiário e pagador, exceto se for boleto depósito aporte.

12 – ENDEREÇO BENEFICIÁRIO / EX-SACADOR AVALISTA

Deve ser informado o endereço completo do Beneficiário. Se o título possuir a figura de Beneficiário Final (Ex-Sacador Avalista) o endereço informado deverá ser do Beneficiário Final, conforme Lei Federal 12.039 de 01/10/2009.

13 – PAGADOR

Deve ser obrigatoriamente informado o Nome/Razão Social, CPF ou CNPJ e endereço completo do pagador.

### Cálculo do DAC do Código de Barras

Por definição da FEBRABAN e do Banco Central do Brasil, na 5ª posição do Código de Barras,
deve ser indicado obrigatoriamente o “dígito verificador” (DAC), calculado através do módulo 11, conforme
demonstramos a seguir:

a)	Tomando-se os 43 algarismos que compõem o Código de Barras (sem considerar a 5ª posição),
multiplique-os, iniciando-se da direita para a esquerda, pela sequência numérica de 2 a 9 (2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4... e assim por diante);

b)	Some o resultado de cada produto efetuado e determine o total como (N);

c)	Divida o total (N) por 11 e determine o resto obtido da divisão como Mod 11(N);

d)	Calcule o dígito verificador (DAC) através da expressão:  DAC = 11 - Mod 11(N)

OBS.: Se o resultado desta for igual a 0, 1, 10 ou 11, considere DAC = 1.

Exemplo - Considerando o seguinte conteúdo do Código de Barras:

3419?166700000123451101234567880057123457000

Onde:

341	            Código do Banco

9	            Código da Moeda

?	            DAC do Código de Barras

1667	        Fator de Vencimento	        (01/05/2002)

0000012345	    Valor do Título	            (123,45)

110123456788	Carteira/Nosso Número/DAC	(110/13245678-8)

0057123457	    Agência/Conta Corrente/DAC	(0057/12345-7)

000	            Posições Livres	            (zeros)

Temos:

a) Multiplica-se a sequência do código de barras pelo módulo 11:  
3419166700000123451101234567880057123457000  
X   4329876543298765432987654329876543298765432

b) Soma-se o resultado dos produtos obtidos no item “a” acima:  
12 + 12 + 2 + 81 + 8 + 42 + 36 + 35 + 0 + 0 + 0 + 0 + 0 + 7 + 12 + 15 + 16 + 15 + 2 + 9 + 0 + 7 + 12 + 15 + 16 + 15 + 12 + 63 + 64 + 56 + 0 + 0 + 20 + 21 + 2 + 18 + 24 + 28 + 30 + 35 + 0 + 0 + 0 = 742

c) Determina-se o resto da Divisão:  
742 / 11 = 67, resto 5

d) Calcula-se o DAC:  DAC = 11 – 5 => DAC = 6  
Portanto, a sequência correta do código de barras será:

3419 6 166700000123451101234567880057123457000

### Cálculo do DAC da Representação Numérica

A representação numérica do código de barras é composta, por cinco campos: 1, 2, 3 4 e 5,
sendo os três primeiros amarrados por DAC's, calculados pelo módulo 10, conforme mostramos abaixo:

a)	Multiplique cada algarismo do campo pela sequência de multiplicadores 2, 1, 2, 1, 2,  
1..., posicionados da direita para a esquerda;

b)	Some individualmente, os algarismos dos resultados dos produtos, obtendo-se o total
(N);

c)	Divida o total encontrado (N) por 10, e determine o resto da divisão como MOD 10  
(N);

d)	Encontre o DAC através da seguinte expressão:  DAC = 10 – Mod 10 (N)  
OBS.: Se o resultado da etapa d for 10, considere o DAC = 0.

Exemplo:

Considerando-se a seguinte representação numérica do código de barras:

Campo 1 -----> 34191.1012?

Campo 2 -----> 34567.88005?

Campo 3 -----> 71234.57000?

Campo 4 -----> 6

Campo 5 -----> 16670000012345

Temos:

a)	Multiplicando a sequência dos campos pelo módulo 10:

Campo 1 -----> 341911012 X 212121212

Campo 2 -----> 3456788005 X 1212121212

Campo 3 -----> 7123457000 X 1212121212

Observação: Os campos 4 e 5 não tem DAC

b)	Some, individualmente, os algarismos dos resultados dos produtos:

Campo 1 → 6 + 4 + 2 + 9 + 2 + 1 + 0 + 1 + 4 = 29

Campo 2 → 3 + 8 + 5 + 1 + 2 + 7 + 1 + 6 + 8 + 0 + 0 + 1 + 0 = 42

Campo 3 → 7 + 2 + 2 + 6 + 4 + 1 + 0 + 7 + 0 + 0 + 0 = 29

c)	Divida o total encontrado por 10, a fim de determinar o resto da divisão:

Campo 1 → 29 / 10 = 2, resto 9  
Campo 2 → 42 / 10 = 4, resto 2  
Campo 3 → 29 / 10 = 2, resto 9

d)	Calculando o DAC:

Campo 1 → DAC   = 10 - 9 → DAC = 1

Campo 2 → DAC   = 10 - 2 → DAC = 8

Campo 3 →  - 9 → DAC = 1

Campo 1 → 1

Campo 2 → 8

Campo 3 → 1

Portanto, a sequência correta da linha digitável será:  
34191.1012 1  	34567.88005 8  	71234.57000 1  	6  	16670000012345

### Cálculo do DAC do Campo "Nosso Número" em Boletos emitidos pelo cliente

Para a grande maioria das carteiras, são considerados para a obtenção do DAC os dados “AGÊNCIA / CONTA (sem DAC) / CARTEIRA / NOSSO NÚMERO”, calculado
pelo critério do Módulo 10. À exceção, estão as carteiras 126 – 131 – 146 e 168 cuja obtenção está baseada apenas nos dados “CARTEIRA/NOSSO NUMERO” da operação.

Exemplo:   	AG/CONTA = 057/12345-7  	CART/Nosso Número = 110/12345678-?

Sequência para cálculo:

  	0 0 5 7 1 2 3 4 5 1 1 0 1 2 3 4 5 6 7 8       
	1 2 1 2 1 2 1 2 1 2 1 2 1 2 1 2 1 2 1 2  
	
	8 x 2 = 16 (1 + 6)
	7 x 1 = 7
	6 x 2 = 12 (1 + 2)
	5 x 1 = 5
	4 x 2 = 8
	3 x 1 = 3
	2 x 2 = 2
	1 x 1 = 1
	0 x 2 = 0
	1 x 1 = 1
	1 x 2 = 2
	5 x 1 = 5
	4 x 2 = 8
	3 x 1 = 3
	2 x 2 = 4
	1 x 1 = 1
	7 x 2 = 14 (1 + 4)
	5 x 1 = 5
	0 x 2 = 0
	0 x 1 = 0
	
	Total = 72
	
	Dividir o resultado da soma por 10:
	
	72/10, resto 2
	
	DAC = 10 - 02 = 8 (Caso resto da divisão igual a zero, considerar DAC = 0)
	
	Portanto, DAC = 8

### Código de Barras

#### 8.1 - Introdução

O Banco Central do Brasil estabeleceu, através das cartas circulares nº 2414 e 2.531 de 07/10/93
e 24/02/95, a troca de informações de cobrança entre bancos por meio magnético.

Para isto, determinou a obrigatoriedade do uso do Código de Barras na Ficha de Compensação
dos Boletos de cobrança e a sua respectiva decodificação (linha digitável), visando permitir
a digitação dos dados no caso da impossibilidade da leitura do código de barras.

Aos clientes que desejarem efetuar integralmente a emissão dos Boletos em seu próprio
ambiente, descreveremos a seguir neste manual todas as informações técnicas necessárias para
a correta confecção do boleto de cobrança e do código de barras.

CARACTERÍSTICAS

•	Para sistemas de grande porte (mainframe) - deverá dispor de fontes e programas específicos catalogados nas impressoras, quando o ambiente for Xerox (PDL, FDL e FNT) e catalogados no sistema, quando o ambiente for IBM (AFP), além da criação de subrotinas, conforme linguagem utilizada no ambiente, para conversão do registro desejado em código de barras;

•	Sistemas de microcomputador - deverá obter no mercado ou desenvolver rotinas para impressão de código de barras e boleto.

Nota: Não é permitida a utilização de impressora matricial, devido ao elevado índice de rejeição
na leitura do código de barras, ocasionado pela má qualidade de impressão. Após concluído o
desenvolvimento de seu sistema, obrigatoriamente, deverá ser encaminhada uma amostragem
dos Boletos ao Banco Itaú, para análise e aprovação.

#### 8.2 - Características do Boleto

##### 8.2.1 - Especificações Gerais

•	Vias e dimensões

    • Ficha de Compensação – 95 a 108 mm de altura por 170 a 216 mm de
    comprimento;
    
    • Recibo do Pagador – a critério do Banco/Beneficiário.

•	Disposição das vias:  
•	Formulário contínuo auto copiativo – a primeira via deverá ser a Ficha de Compensação, ficando a critério do Banco a disposição das demais vias;  
•	Papel A-4 – para se evitar rasuras no código de barras ao ser destacada, a ficha de compensação deve ser impressa no rodapé. Recomenda-se a
utilização de micro serrilhas entre as vias para evitar danos às informações quando do destacamento.

•	Gramatura do papel e cor da impressão:  
• Gramatura Ideal 75 g/m², mínima: 50 g/m2;  
• Fundo branco com impressão azul ou preta, não se permitindo campos hachurados.

##### 8.2.2 - Especificações das Vias

     8.2.2.1 - Ficha de Compensação

        •	Parte superior esquerda: o nome do banco, podendo conter o seu logotipo e, à direita do nome do banco, 
            número-código/DAC de compensação do banco destinatário, em negrito;  
            Obs. O número/DAC do Itaú é 341-7 e deve ser impresso com caractere de 5 mm 
            e traços ou fios de 1,2 mm;
    
        •	Parte superior direita: deverá haver representação numérica do conteúdo do Código de Barras, 
            conforme especificação adiante;
        
        •	Quadro de impressão: deverá apresentar grade/denominação dos campos conforme modelo deste manual;
        
        •	O tamanho de cada campo (número de posições) poderá variar, desde que obedecidas a mesma disposição 
            do modelo e as dimensões mínimas do formulário;
        
        •	Os campos não utilizados poderão ficar sem indicação;
        
        •	Na parte inferior, abaixo do quadro de impressão: na extremidade direita deverá ser deixado espaço 
            para autenticação mecânica; na extremidade esquerda, o campo é destinado à indicação 
            obrigatória do código de barras, conforme mostra este manual;
        
        •	Na parte inferior, do lado direito da identificação do campo “Autenticação Mecânica”, 
            identificação da ficha (Ficha de Compensação), com dimensão máxima de 2 mm 
            e traços com fios de 0.3mm.

    8.2.2.2 - Recibo do Pagador

        •	Na parte superior, acima do quadro de impressão deverá ser impressa a identificação Recibo do Pagador;

        •	Alterações na via Recibo do Pagador podem ser admitidas, mas somente com prévia aprovação do Banco Itaú S/A;

        •	Deve conter informações do Beneficiário e/ou do Beneficiário Final (ex-Sacador Avalista¹): nome, endereço 
            e número de inscrição no Cadastro de Pessoas Físicas – CPF ou no Cadastro Nacional de 
            Pessoa Jurídica – CNPJ do fornecedor do produto ou serviço.

        •   Beneficiário Final (Ex-Sacador Avalista) – Nos casos que se aplica

##### 8.3 - Layout do Código de Barras

    8.3.1 - Tipo
        
        	Deve ser utilizado o tipo 2 de 5 Intercalado, que tem as seguintes características:

            •	Cinco barras definem um caractere, sendo duas delas, barras largas;  
            •	Intercalado significa que os espaços entre as barras também têm significado de maneira análoga às barras;  
            •	Definem apenas caracteres numéricos.
            
            Todo código 2 de 5 Intercalado deve possuir um conjunto de barras e espaços para definir um
            pseudo caractere de Start e outro para um pseudo caractere de Stop.
            
            Por causa da intercalação os campos codificados em 2 de 5 Intercalado devem possuir número par de caracteres.

    8.3.2 - Conteúdo

        POSIÇÃO         Tamanho         Picture         Conteúdo
        01 a 03           03             9(03)          Código do Banco na Câmara de
                                                        Compensação = "341"

        04 a 04           01             9(01)          Código da Moeda = '9'

        05 a 05           01             9(01)          DAC código de barras

        06 a 09           04             9(04)          Fator de Vencimento

        10 a 19           10             9(08)V9(2)     Valor

        20 a 22           03             9(03)          Carteira

        23 a 30           08             9(08)          Nosso número

        31 a 31           01             9(01)          DAC (Agência/Conta/Carteira/Nosso Número)

        32 a 35           04             9(04)          N° da Agencia beneficiário
        
        36 a 40           05             9(05)          N° da Conta Corrente

        41 a 41           01             9(01)          DAC (Agência/Conta Corrente)

        42 a 44           03             9(03)          Zeros

    
    8.3.3 - Dimensões do Código de Barras
        
        Comprimento total igual a 103 (Centro e três)mm e altura total igual a 13 (treze)mm.

    8.3.4 - Local de Impressão na Ficha de Compensação

        Na parte inferior do documento, abaixo do quadro de impressão na extremidade esquerda, respeitando-se:
        
            •	Espaço mínimo de 5 (cinco) mm (zona de silêncio) entre a margem esquerda do formulário e o início da impressão do código;  
            •	Distância mínima de 12 (doze) mm desde a margem inferior da ficha até o centro do código de barras.  
        
        Observação: Todas as especificações devem ser atendidas, com o intuito de preservar a leitura do código.

#### 8.4 - REPRESENTAÇÃO NUMÉRICA DO CÓDIGO DE BARRAS

	8.4.1 - Conteúdo

        A representação numérica do código de barras é distribuída em cinco campos, sendo 
        os três primeiros consistidos por DAC (Dígito de Autocontrole - Módulo 10) e, entre 
        cada campo, espaço equivalente a uma posição; no quarto campo é indicado, 
        isoladamente, o DAC (Módulo 11) do Código de Barras:

        AAABC.CCDDX        Campo 1
        DDDDD.DEFFFY       Campo 2
        FGGGG.GGHHHZ       Campo 3
        K                  Campo 4
        UUUUVVVVVVVVVV     Campo 5

    Campo 1 (AAABC.CCDDX)

        AAA =  Código do banco na Câmara de Compensação = “341”  
        A	=  Código da moeda = ‘9’ (*)  
        CCC =  Código da carteira de cobrança  
        DD =  Dois primeiros dígitos do Nosso Número  
        X =  DAC que amarra o campo 1

        (*) Este dígito será sempre “9”, porque independente do índice ou moeda utilizada, estes 
        deverão ser convertidos no recebimento para a moeda (R$)

    Campo 2 (DDDDD.DEFFFY)

        DDDDDD =  Restante do Nosso Número  
        E =  DAC do campo (Agência/Conta/Carteira/Nosso Número)  
        FFF =  Três primeiros números que identificam a Agência  Y =  DAC que amarra o campo 2

    Campo 3 (FGGGG.GGHHHZ)

        F =  Restante do número que identifica a agência  
        GGGGGG =  Número da conta corrente + DAC  
        HHH =  Zeros (Não utilizado)  
        Z =  DAC que amarra o campo 3

    Campo 4 (K) 

    K =  DAC do Código de Barras
    
    Campo 5 (UUUUVVVVVVVVVV)
    
    UUUU =  Fator de vencimento
    VVVVVVVVVV =  Valor do título (*)

    (*) Sem edição (Sem ponto e vírgula), com tamanho fixo (10). Em casos de cobrança com 
    valor em aberto (o valor a ser pago é preenchido pelo próprio pagador) ou cobrança em
    moeda variável, deve ser preenchido com zeros.
    
    Observação 1: Apesar de constar o DAC do código de Barras (campo 4) é necessária a existência
    dos DAC's específicos para os campos 1, 2 e 3 (estes dígitos não são representados no código de barras).
    
    Observação 2: Deve ser inserido um ponto (".") após os cinco dígitos iniciais dos campos 1, 2 e 3.  
    Este ponto facilita a digitação (cinco dígitos é o número ideal para memorização do digitador). O campo 5 não é separado por ponto ("."), pois representa a data de
    vencimento e o valor do título.
    
    Observação 3: Os dados da representação numérica não se apresentam na mesma ordem do código de barras.

    8.4.2 - Dimensões e Localização

        A representação numérica do código de barras deverá ser impressa em caracteres de 3,5
        a 4,5 mm e traços ou fios de 0,3 mm. Na parte superior direita, iniciando-se logo após o
        número Código/DAC do Banco.

### Controle de versão - Emissão de boleto

#### Controle de versão: 1.3.08 - 29/09/2026

Atualizado o bloco de regras de instrução ou alteração de dados do boleto nas seções dos endpoints de instrução e alteração (baixa, valor nominal, juros, data de vencimento, desconto, abatimento, multa, protesto, seu número, data limite de pagamento, negativação, pagador, recebimento divergente e sacador avalista): a orientação de disponibilidade no dia seguinte foi substituída pela informação de que boletos ficam disponíveis para instruções e alterações no mesmo dia da emissão.

#### Controle de versão: 1.3.07 - 25/09/2026

Incluído na Tabela de Carteiras o aviso regulatório sobre as carteiras 148, 153, 176 e 198, que não podem emitir boletos com Pix (bolecode), e sobre a descontinuação das carteiras IOF 148 e 153 em 01/01/2027, em razão das adequações decorrentes da Emenda Constitucional nº 132/2023.

#### Controle de versão: 1.3.06 - 06/08/2026

Incluído na aba de Visão Geral o comunicado sobre a atualização de segurança e o vencimento de certificados até 15/09.

Atualizado as tabelas de URLs e Endpoints, e o base path da aba API Reference, com os novos endereços de conexão (api.gateway.itau.com.br) para os ambientes de sandbox e produção.

#### Controle de versão: 1.3.05 - 22/04/2026

Complementado as descrições dos códigos de erro 500, 501, 503 e 504 em todas as seções de endpoints com orientação para consulta e reenvio do boleto.

Corrigido os exemplos de request/response do POST de emissão de boleto, ajustando a estrutura JSON do body de saída.

Atualizado os arquivos de exemplo do sandbox (boleto_command_200.json e default.json).

#### Controle de versão: 1.3.04 - 06/12/2025

Alterado a descrição do campo dados_individuais_boleto > texto_uso_beneficiario. Na aba de API Reference foi alterado o campo de quantidade_dias_instrucao_cobranca para quantidade_dias_apos_vencimento.

#### Controle de versão: 1.3.01 - 20/09/2025

Ajuste nos campos juros > valor_juros, juros > percentual_juros, multa > valor_multa e multa > percentual_multa. O campo de request para casos de 200 também passou por adequações.

#### Controle de versão: 1.2.25 - 22/08/2025

Ajuste na tabela de carteiras e suas devidas descrições e remoção de opções para boleto parcelado.

#### Controle de versão: 1.2.23 - 24/07/2025

Alterado a descrição do campo pagador > pessoa > nome_pessoa.

#### Controle de versão: 1.2.22 - 29/05/2025

Criado tabela de instruções de recebimentos, alterado descrição do campo dia_util e o link para autenticação do token.

#### Controle de versão: 1.2.21 - 27/03/2025

Alterado opções da tabela de instruções.

#### Controle de versão: 1.2.19 - 19/02/2025

Alterado campo de restrições de uso e tabela de espécie.

#### Controle de versão: 1.2.18 - 25/01/2025

Alterado descrição do campo protesto > protesto.

#### Controle de versão: 1.2.17 - 01/11/2024

Alteração da descrição dos tópicos sobre a solução, como conhecer e testar as API's, API de Emissão de boleto e nome do banco destinatário

Efetuado separação de endereço para pagador e sacador_avalista.

Alterado a descrição da carteira 109.

Removido a carteira 138 e 198.

Inserido nova orientação em como montar o seu boleto.

#### Controle de versão: 1.2.16 - 27/03/2024

Alterado o texto de referente ao truncamento, alterado descrição do campo instrucao_cobranca > quantidade_dias_apos_vencimento e alterado descrição do item 8 da tabela de instruções.

Descritivo do campo instrucao_cobranca > dia_util recebeu ajuste.

Removido a palavra shopline do descritivo do campo 176 da tabela de carteiras.

Inserida a obrigatoriedade do x-itau-correlationID no formato UUID version 4.

#### Controle de versão: 1.2.15 - 24/02/2024

Alterado o campo dado_boleto > indicador_pagamento_parcial para dado_boleto > pagamento_parcial

#### Controle de versão: 1.2.14 - 17/02/2024

Parametrizado no sandbox o retorno do campo juros > codigo_tipo_juros.

#### Controle de versão: 1.2.13 - 13/01/2024

Inserido no body de saída os devidos retornos para o campo juros > codigo_tipo_juros.

#### Controle de versão: 1.2.12 - 09/01/2024

Alterado campo do body sacador_avalista de numero_cadastro_pessoa_fisica para numero_cadastro_nacional_pessoa_juridica.

Ajuste no texto das regras para instrução de valor_nominal.

Ajuste no texto das regras para instrução de abatimento.

Inclusão do código tipo juros '05' (Quando se deseja efetuar a exclusão do juros).

Adicionando código 90 e 91 no parâmetro desconto > descontos > quantidade_dias_desconto.

Melhoria para o texto desconto parâmetro desconto > codigo_tipo_desconto.

Melhoria no texto do 'exemplo de entrada 2' do sacador_avalista.

Inserido no item 3 do fluxo de autenticação a importância do uso da palavra Bearer antes do token.

Adicionado dados_individuais_boleto > antes de texto_seu_numero.

#### Controle de versão: 1.2.11 - 14/11/2023

Alterada a descrição do campo desconto > codigo_tipo_desconto.

Atualizado os caracteres especiais que não podem ser utilizados.

Retirado o campo dado_boleto > valor_total_titulo.

Ajustado o texto de juros > codigo_tipo_juros na aba API Reference.

Inserido informações de e-mail no body de entrada e saída.

Inserido o código de resposta 504.

Ajustado para opcional os campos protesto > protesto, negativacao > negativacao.

Ajustado a tabela de carteiras.

Inserido asterisco nos campos de nome pagador, logradouro, bairro, cidade e seu número, pois a partir de novembro iremos truncar os campos que não estiverem de acordo com o limite de caracteres.

#### Controle de versão: 1.2.10 - 16/09/2023

Corrigido o número de caracteres do campo dado_boleto > assunto_email e dado_boleto > mensagem_email.

Alterado a descrição do campo dados_individuais_boleto > data_limite_pagamento.

Ajustado o nome do campo de quantidades_dias_multa para data_multa.

Ajustado o nome do campo de quantidade_dias_juros para data_juros.

#### Controle de versão: 1.2.8 - 18/08/2023

Adicionado o retorno 202 na emissao da command "Operação ainda em andamento, consulte seu boleto em instantes."

Adicionado o tipo de juros '05' - Quando não se deseja cobrar juros caso o pagamento seja feito após o vencimento (isento)

#### Controle de versão: 1.2.6 - 31/07/2023

Inserido número de caracteres no campo texto_seu_numero.

Incluído pontuação no campo dado_boleto > dado_boleto > indicador_pagamento_parcial.

Alterado para opcional o campo dado_boleto > pagador > texto_endereço_email, protesto > quantidade_dias_protesto, negativacao > quantidade_dias_negativacao.

Incluído quantidade de caracteres no campo sacador_avalista > pessoa > nome_pessoa, dados_individuais_boleto > numero_nosso_numero, beneficiario > nome_cobranca.

Incluído campos de endereço para sacador avalista.

Incluído informação que o valor calculado deve ser superior a um centavo na descrição dos campos multa > valor_multa, multa > percentual_multa, desconto > valor_desconto e desconto > percentual_desconto.

Alterado descrição do campo dados_individuais_boleto > texto_uso_beneficiario, pagador > pessoa > tipo_pessoa > numero_cadastro_pessoa_fisica, pagador > pessoa > tipo_pessoa > numero_cadastro_nacional_pessoa_juridica, sacador_avalista > pessoa > tipo_pessoa > numero_cadastro_pessoa_fisica e sacador_avalista > pessoa > tipo_pessoa > numero_cadastro_nacional_pessoa_juridica.

Retirado as carteiras 110 e 111.

