# Boleto com Pix (v1.0.7)

Fonte: https://devportal.itau.com.br/nossas-apis/itau-ep9-api-recebimentos-v1-externo (aba visão geral, atualizada em 2026-08-22T01:08:36.000Z)
Sandbox: https://sandbox.devportal.itau.com.br/itau-ep9-api-recebimentos-v1-externo/v1
Spec: ../openapi/itau-ep9-api-recebimentos-v1-externo.json

---



## **sobre a API**

* Certificados nas Rotas das Nossas APIs
* Atualmente, expomos nossas APIs por meio de duas rotas principais:  
  Modelo antigo:  
  `https://secure.api.itau/...`  
  Modelo novo:  
  `https://pix-pj.itau.com/...`
* É importante identificar qual rota está sendo utilizada em sua integração, pois isso determina qual certificado deve ser confiado, caso seja necessário realizar essa configuração manualmente.
* Confiar nos Certificados das APIs  
Para consumir as APIs PIX do Itaú, é necessário confiar no certificado digital correspondente à rota utilizada.  
Na maioria dos casos, essa confiança é gerenciada automaticamente por sistemas operacionais, servidores e linguagens de programação. Contudo, em alguns cenários, pode ser necessário adicionar manualmente o certificado raiz ao ambiente de desenvolvimento ou ao servidor, garantindo o funcionamento adequado das conexões SSL/TLS.
* Modelo Antigo — `secure.api.itau`  
Caso você esteja consumindo APIs que utilizam a rota `secure.api.itau`, pode ser necessário confiar manualmente no certificado raiz da GlobalSign.  
Essa rota utiliza a autoridade certificadora (CA)  
> “GlobalSign Extended Validation CA – SHA256 – G3”.  
O certificado raiz correspondente é o “GlobalSign Root R3”, disponível em:  
<https://support.globalsign.com/ca-certificates/globalsign-root-certificates>
* Modelo Novo — `pix-pj.itau.com`  
Caso você esteja consumindo APIs que utilizam a rota `pix-pj.itau.com`, pode ser necessário confiar manualmente no certificado raiz da Amazon.  
Essa rota utiliza a CA  
> “Amazon RSA 2048 M04”.  
O certificado raiz correspondente é o “Amazon Root CA 1”, disponível em:  
<https://www.amazontrust.com/repository/AmazonRootCA1.pem>

* **Boleto com Pix: Solução de Recebimento**

O Boleto com Pix é uma solução que combina os dois principais meios de recebimento: PIX QR Code e Boleto, oferecendo aos clientes duas opções de pagamento em uma única emissão.

* **PIX QR Code**

- **Instantaneidade**: O pagamento é realizado de forma instantânea, sem necessidade de período de compensação.
- **Agilidade**: O sistema integrado permite um controle ativo dos pagamentos, facilitando a baixa das pendências.
- **Facilidade**: A emissão e conciliação estão disponíveis em todos os canais, como bankline, aplicativo, arquivo e API.

* **Boleto**

- **Eficiência**: Em caso de inadimplência, sua empresa pode realizar a negativação e o protesto para cobrar a dívida.
- **Praticidade**: Permite visualizar as cobranças associadas ao CNPJ através do DDA (Débito Direto Autorizado).
- **Conveniência para o cliente**: Oferece a possibilidade de pagamento presencial em caixas eletrônicos e Corban, proporcionando mais flexibilidade e comodidade, oferecendo mais opções no processo de pagamento.

* **Informações para Emissão de Boleto com Pix/Código de Barras de Cobrança Itaú**

- Mantenha a guarda dos documentos comprobatórios que dão origem aos boletos emitidos por 10 anos, pois poderão ser solicitados a qualquer momento.
- Garanta que os dados constantes no registro do boleto e no contrato de venda do produto ou serviço a que se refere o boleto emitido estejam corretos.
- O CPF e/ou CNPJ do pagador e beneficiário final indicado deve constar como ativo/regular na Receita Federal.
- Para endereço, a responsabilidade do dado estar correto é do cliente. O Itaú valida se estão preenchidos com algum caracter: logradouro, bairro e cidade; CEP com 8 números e informado uma Unidade Federativa.

**Atenção**: Para que os serviços de negativação expressa, protesto, cálculo de encargos em dias úteis sejam efetivados, o endereço deve estar conforme consta no site dos Correios.

* **Conceitos e Figuras do Boleto**

- **Beneficiário**: Emissor do boleto e beneficiário dos recursos oriundos do pagamento do boleto quando a cobrança não for emitida por meio do terceiro habilitador.

- **Pagador**: Quem deverá realizar o pagamento do boleto.

- **Sacador Avalista (atual Beneficiário Final)**: Figura que receberá o crédito referente ao pagamento do boleto devido à prestação de serviço ou venda de produto ao pagador. O preenchimento deste campo no boleto deve ser realizado apenas nos casos em que o Beneficiário figura como Terceiro Habilitador.

- **Terceiro Habilitador**: Beneficiário que emite boletos para viabilizar o recebimento de recursos através do pagamento de boletos para outras pessoas/empresas.

* **Atenção!**

- **Sacador Avalista**: Essa figura deixou de existir desde a vigência da Circular nº 3.956 do Banco Central do Brasil. Ao emitir o boleto, atenção para indicar as figuras corretas. Nesta documentação, todos os campos que citarem o sacador avalista devem ser considerados como Sacador Avalista (atual Beneficiário Final). Estamos ajustando o termo sistemicamente e, em breve, será atualizado.

- **Beneficiário**: O Beneficiário não deve ser o Pagador e nem o Beneficiário final.

- **Pagador**: O pagador é igual ao Beneficiário Final quando a espécie do boleto for Boleto Depósito Aporte. Nas demais espécies, caso tenha um beneficiário final, será uma terceira pessoa/empresa.

* **Webhook para parceiros Pix (disponível apenas para parceiros)**

O webhook de parceiros é uma solução que busca automatizar o processo de compartilhamento de credenciais do cliente recebedor para um parceiro homologado do Itaú para utilização do QR Code do Pix.

Para que o webhook funcione, é necessário que o cliente desenvolva uma API de callback através de uma URL exposta na web que possua uma camada de autenticação mTLS (HTTPS).

Com essa integração, o parceiro estará apto a receber automaticamente as credenciais do cliente quando o cliente recebedor realizar o consentimento diretamente nos canais digitais do Itaú.

## **para quem é esta API?**

**Boleto com Pix (disponível apenas para clientes)**

O Boleto com Pix é indicado aos clientes que já emitem boletos, mas desejam adicionar QR Code Pix para ampliar as formas de recebimento.
Os principais casos de uso atualmente são:

*Cobranças com recorrências (universidades, escolas, condomínios etc.).
*Lojas virtuais (e-commerce).

**Webhook para parceiros Pix (disponível apenas para parceiros)**

O webhook de parceiros é uma solução que busca automatizar o processo de compartilhamento de credenciais do cliente recebedor para um parceiro homologado do Itaú para utilização do QR Code do Pix.

Os principais casos de uso atualmente são:

* Automações comerciais;
* TEF Houses;
* Software houses;
* Gateways e plataformas de e-commerce.

**TXID e Reutilização do Nosso Número**

O TXID é o identificador único de cada Boleto com Pix, responsável por relacionar o boleto à sua respectiva transação Pix. Esse identificador é fundamental para os processos de rastreamento, conciliação e liquidação da cobrança.

A estrutura do TXID é composta por 31 caracteres e segue o seguinte padrão:

TXID = "BL" + agência + "00" + conta (sem dígito) + carteira + "0000000" + nosso número

Exemplo:

TXID = BL29380099999109000000000616639

A funcionalidade de reutilização do nosso número permite que um mesmo identificador seja utilizado novamente após a baixa ou liquidação do título original, desde que sejam respeitadas as regras de elegibilidade definidas para o produto.

Para permitir múltiplas emissões utilizando o mesmo "nosso número", o Boleto com Pix utiliza os 7 caracteres centrais do TXID, originalmente preenchidos com zeros, para diferenciar cada nova emissão vinculada ao mesmo identificador.

**Regras para reutilização**

A reutilização do nosso número é permitida somente quando o título original:

Estiver baixado ou liquidado;

Tiver sido baixado ou liquidado há mais de 45 dias.

Caso as condições acima não sejam atendidas, a API retornará uma das mensagens abaixo:

422 – "O nosso número ainda não passou pelo processo de baixa."

422 – "Ainda não se passaram 45 dias desde a data de baixa do nosso número."

422 – "O nosso número já foi emitido."

**Disponibilidade e adesão**

Esta funcionalidade está disponível para clientes que utilizam emissão via API ou arquivo.

Para habilitação da reutilização do nosso número, o cliente deve entrar em contato com o time de atendimento do Itaú, que realizará o acionamento do time de produtos responsável pela inclusão da funcionalidade.

A partir de agora, o produto passa a contar com duas novas funcionalidades: Pix Automático e Agendamento.

**Boleto com Pix Automático**

O Pix Automático é a modalidade que permite a recorrência de pagamentos via Pix mediante autorização prévia do pagador. No contexto do Boleto com Pix, essa funcionalidade viabiliza cobranças recorrentes — como assinaturas, mensalidades e contratos de prestação de serviço — com débito automatizado em data programada.

**Disponibilidade e adesão:** Esta modalidade está disponível exclusivamente via API. O cliente interessado deve entrar em contato com o time de atendimento do Itaú, que acionará o time de produtos para inserir o cliente na modalidade.

**Transição para o Pix Automático:** Após o aceite do Pix Automático pelo pagador, a jornada deixa de ser a do Boleto com Pix e migra para a Jornada do Pix Automático. Fica a critério do emissor a continuidade de emissão do Boleto com Pix.

**Boleto com Agendamento (COBV)**

Permite que o pagador agende o pagamento do título para uma data futura, dentro do prazo de vencimento. No Boleto com Pix, o agendamento se aplica tanto ao pagamento por código de barras quanto à liquidação via Pix, respeitando as regras de cada meio. A baixa e a conciliação ocorrem na data efetiva do pagamento, e não na data do agendamento.

**Atenção:** o recebedor visualiza o crédito e a conciliação somente na data efetiva do pagamento, e não no momento do agendamento. É importante considerar esse comportamento na previsão de fluxo de caixa e nos processos de conciliação.

**Disponibilidade e adesão:** Esta modalidade está disponível via API e via arquivo. O cliente interessado deve entrar em contato com o time de atendimento do Itaú, que acionará o time de produtos para inserir o cliente na modalidade.

**Ajuste técnico para habilitar o agendamento:** Atualmente o cliente envia a cobrança com o tipo cob. Para habilitar o agendamento, o ajuste deve ser realizado nesse campo, inserindo a opção cobv (cobrança com vencimento) — o que possibilita o agendamento do pagamento.

## **restrições de uso**
Para utilização de todas as APIs, é necessário estar habilitado no Portal Itaú for Developers e possuir um certificado dinâmico ativado.

Para utilização do webhook é necessário possuir um certificado mTLS e uma API Call Back.

## **conhecimentos técnicos necessários**
Conhecimentos prévios necessários:

**Conhecimentos técnicos**

`Construção de APIs REST escaláveis` `Comunicações assíncronas e síncronas` `Padrões de autenticação`

`Padrões de segurança`

**Tecnologias**

`API REST/Restful` `HTTP/HTTPS` `JSON` `Postman/Insomnia` `mTls` `OAUTH2`

`HTTP` `JSON` `Postman`

## **quais necessidades que essa API ajuda a resolver?**

Com as **APIs de Boleto com Pix**, o cliente pode realizar a emissão de um boleto com pix associado a um QR Code do Pix.

Com as **APIs do webhook** o parceiro pode cadastrar uma URL (API Call Back) para automatizar o processo de recebimento de credenciais do cliente recebedor para utilização do QR Code do Pix.

## **tempo aproximado para integração**
**15 dias:** essa é a média de tempo que um desenvolvedor pode levar para preparar toda a integração com essa API. Isso pode variar de acordo com o tamanho do time e experiência dos desenvolvedores envolvidos.

## Endpoints

| Ambiente | Endpoint |    
| -------- | -------- |
| produção| https://pix-pj.api.itau.com/recebimentos-pix/v1

Nosso objetivo é deixar claro tudo que você precisa fazer para integrar às APIs do pix no Itaú. Para isso, todas as informações e exemplos necessários estão reunidos aqui.

Os exemplos de response de erros são demonstrados no tópico **padrões de erros** ao final desta page. Cada endpoint traz uma tabela especificando quais desses retornos aquele serviço retorna. Então, caso haja variação no json retornado, este será demonstrado na explicação do próprio endpoint, se não, deve ser visualizado no tópico citado.

### **URLs**
Para garantir uma integração segura, as funcionalidades da API estão disponíveis nas seguintes URLs:

| ambiente    | endpoint                                                                                      | 
|-------------|--------------------------------|
| sandbox     | https://vpce-sp.virtualizacaoservicos.prod.aws.cloud.ihf/apivirtual/itau-ep9-api-recebimentos-v1-externo/v1 |
| produção    | https://pix-pj.api.itau.com/recebimentos-pix/v1                               |

### Emissão de Boleto com Pix (POST)

### [POST] /boletos_pix

API responsável por efetuar a emissão de um boleto + Pix.

Obs: Por regras internas não é permitido o uso de caracter especial, tais como os exemplos: *“ [ “ , “ : “ , “ < ” , “ > ” , “ & ” , “ ; ” , “ ' “ , “ " “ , “ ` “ , “ ( “ , “ ) “ , “ # “ , “ ** “ , “ / “ , “ | “ , “ *] “ , “ ü ” , “ http “ , “ javascript “ , “ alert “

### API de Emissão de Boleto com Pix com QR Code do Pix

A API é responsável por efetuar a emissão de um Boleto com Pix associado a um QR Code do Pix. A emissão consiste na ação de efetuar o registro do boleto, e o comando de emissão é realizado pelo beneficiário, contratante do serviço de Cobrança.

A seguir estão expostos os parâmetros exigidos por essa API e a descrição deles. Para obter mais informações de onde conseguir o `x-itau-apikey` e o `x-itau-correlationID`, acesse o tópico ‘Informações necessárias’.

### Parâmetros

| Parâmetro          | Tipo   | Tipo Dado | Obrigatório | Descrição                                                                                                                                                                                                 |
|--------------------|--------|-----------|-------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `x-itau-apikey`    | header | string    | Não         | `client_id` gerado pela autenticação Oauth utilizado para autorizar o consumo de uma aplicação requisitante.                                                                                               |
| `x-itau-correlationID` | header | string    | Não         | Identificador de correlação utilizado como um agrupador dentro da estrutura de audit trail, permitindo relacionar uma mesma chamada passando em diversas aplicações/sistemas diferentes.                    |
| `x-itau-flowID`    | header | string    | Não         | A implementação de um `flowID` permite identificar qual é a funcionalidade de negócio sendo executada na aplicação. Por exemplo, dentro de uma mesma aplicação, várias telas ou linhas de negócio diferentes podem acessar a mesma API. Quando é identificado que algumas chamadas a uma determinada API estão dando erro, através do `flowID`, podemos descobrir que as chamadas são de uma tela específica e com isso solucionar o problema mais rápido do que se não tivéssemos essa informação no log. Ter o `flowID` nos logs também permite extrair algum tipo de métrica através do log. |

### Parâmetros para Emissão de Boleto

Abaixo você encontrará a descrição de todos os campos, valores, tipos de dados, formatações, objetos e informações necessárias para preenchimento dos parâmetros de entrada da API.

O payload de entrada é composto por campos e objetos obrigatórios mais os opcionais. Os objetos são:

- **Beneficiário**
- **Dado Boleto**
- **Pagador** (composto pelos objetos Pessoa e Endereço*)
- **Pessoa** (composto pelo objeto Tipo Pessoa)
- **Tipo Pessoa**
- **Endereço**
- **Sacador Avalista** (composto pelos objetos Pessoa e Endereço)
- **Dados Individuais do Boleto**

Os objetos opcionais, que devem ter os seus campos obrigatórios incluídos caso sejam utilizados, são:

- **Desconto**
- **Negativação**
- **Protesto**
- **Juros**
- **Multa**
- **Recebimento Divergente**

*O bloco de endereço do pagador é opcional, exceto quando o beneficiário possui os serviços de protesto e/ou negativação contratados.

### Body de Entrada

| Parâmetro                                      | Obrigatoriedade | Tipo    | Descrição                                                                                                                                                                                                 |
|------------------------------------------------|-----------------|---------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **etapa_processo_boleto**                      | obrigatório     | String  | Emissão - 'efetivacao' (usado para ambiente produtivo) Simulação de Emissão - 'validacao' (usado para testes)                                                                                             |
| **beneficiario > id_beneficiario**             | obrigatório     | String  | Agência (4 dígitos) + Conta (7 dígitos) + DAC (1 dígito). Exemplo: 150000123450                                                                                                                           |
| **dado_boleto > descricao_instrumento_cobranca** | obrigatório     | String  | Tipo de cobrança. Preencher com 'boleto'                                                                                                                                                                  |
| **dado_boleto > tipo_boleto**                  | obrigatório     | String  | Deve ser indicado um dos tipos do boleto: 'a vista' 'proposta' - Proposta: Este tipo de boleto é utilizado para que seu cliente aceite uma oferta de produto ou serviço, um convite para fazer parte de uma associação ou até mesmo fazer uma doação. Não se esqueça que seu cliente deverá concordar com seu recebimento antes de sua emissão. O pagamento desse boleto não é obrigatório. |
| **dado_boleto > codigo_carteira**              | obrigatório     | String  | Deve ser informado algum dos códigos de carteiras disponíveis. Ver "Tabela de Carteiras".                                                                                                                 |
| **dado_boleto > valor_abatimento**             | opcional        | String  | Valor do abatimento do título. Este valor não pode superar o valor da cobrança. Este valor que será subtraído do valor total da cobrança. Mesmo vencida, a cobrança será paga com abatimento. Formato do campo: 15 dígitos inteiros e 2 casas decimais |
| **dado_boleto > data_emissao**                 | opcional        | String  | Data efetiva da transação comercial entre beneficiário e pagador. Pode ser igual ou menor a data de vencimento, mas não deve ser maior que a data de vencimento. Formato: AAAA-MM-DD. Em breve, caso a data de emissão informada seja posterior ao vencimento, será atribuída a data do registro para esse campo. |
| **dado_boleto > pagamento_parcial**            | opcional        | boolean | Indicador de pagamento parcial. Caso não seja enviado, assume-se o padrão 'false'. 'true' - Aceita pagamento parcial. 'false' - Não aceita pagamento parcial.                                             |
| **dado_boleto > quantidade_maximo_parcial**    | opcional        | Integer | Obrigatório envio apenas quando indicado pagamento_parcial = true. Quantidade permitida de pagamentos parciais da cobrança, valor deve ser entre 1 e 99. Em caso de pagamento_parcial = false, não enviar o atributo de quantidade_maximo_parcial. |
| **dado_boleto > forma_envio**                  | opcional        | String  | Deve ser indicado um dos tipos 'impressao' ou 'email'. Caso seja informado 'email', é obrigatório informar o campo dado_boleto > pagador > texto_endereco_email com um endereço de e-mail válido. Quando informado "e-mail" o campo "texto_endereco_email" se torna obrigatório, será realizado o envio do boleto, anexo ao e-mail informado nesse campo. |
| **dado_boleto > pagador > texto_endereço_email** | opcional        | String  | Caso seja informado 'email' no campo dado_boleto > forma_envio, é obrigatório informar um e-mail válido no campo dado_boleto > pagador > texto_endereço_email. Máximo caracteres: 250. É possível informar até três e-mails separados por um ";", o primeiro endereço informado será atribuído como destinatário e os demais como cópia oculta, desde que respeitado o limite de 250 caracteres. |
| **dado_boleto > assunto_email**                | opcional        | String  | O campo pode ser preenchido de forma personalizada. Máximo caracteres: 50                                                                                                                                 |
| **dado_boleto > mensagem_email**               | opcional        | String  | O campo pode ser preenchido de forma personalizada. Máximo caracteres: 200                                                                                                                                |
| **pagador > pessoa > nome_pessoa**             | obrigatório     | String  | Nome/Razão social do pagador. Máximo caracteres: 50*                                                                                                                                                      |
| **pagador > pessoa > tipo_pessoa > codigo_tipo_pessoa** | obrigatório     | String  | Tipo de pessoa do pagador Pessoa Física - 'F' Pessoa Jurídica - 'J'                                                                                                                                       |
| **pagador > pessoa > tipo_pessoa > numero_cadastro_pessoa_fisica** | opcional        | String  | CPF do pagador - Obrigatório caso tipo_pessoa = F com 11 números (sem pontos, traços ou barras); não informar o campo caso tipo_pessoa = J. Exemplo: 12345678910                                          |
| **pagador > pessoa > tipo_pessoa > numero_cadastro_nacional_pessoa_juridica** | opcional        | String  | CNPJ do pagador - Obrigatório caso tipo_pessoa = J com 14 números (sem pontos, traços ou barras); não informar o campo caso tipo_pessoa = F. Exemplo: 12312312000110                                      |
| **pagador > endereco > nome_logradouro**       | opcional        | String  | Nome do logradouro, número, complemento. Máximo: 45 caracteres. Se informado deve constar conforme site do Correios.                                                                                      |
| **pagador > endereco > nome_bairro**           | opcional        | String  | Nome do bairro. Máximo: 15 caracteres. Se informado deve constar conforme site dos Correios.                                                                                                              |
| **pagador > endereco > nome_cidade**           | opcional        | String  | Nome do bairro. Máximo: 20 caracteres. Se informado deve constar conforme site dos Correios.                                                                                                              |
| **pagador > endereco > sigla_UF**              | opcional        | String  | Sigla da UF. Máximo: 02 caracteres. Se informado deve constar conforme site dos Correios.                                                                                                                 |
| **pagador > endereco > numero_CEP**            | opcional        | String  | CEP. Formato: 8 números, sem pontos e traços. Se informado deve constar conforme site dos Correios.                                                                                                       |
| **sacador_avalista > pessoa > nome_pessoa**    | opcional        | String  | Nome/Razão social do sacador avalista. Máximo de caracteres: 50.                                                                                                                                          |
| **sacador_avalista > pessoa > tipo_pessoa > codigo_tipo_pessoa** | opcional        | String  | Tipo de pessoa do sacador avalista. Pessoa Física - 'F' Pessoa Jurídica - 'J'                                                                                                                             |
| **sacador_avalista > pessoa > tipo_pessoa > numero_cadastro_pessoa_fisica** | opcional        | String  | CPF do sacador avalista - Obrigatório caso tipo_pessoa = F com 11 números (sem pontos, traços ou barras); não informar o campo caso tipo_pessoa = J. Exemplo: 12345678910                                 |
| **sacador_avalista > pessoa > tipo_pessoa > numero_cadastro_nacional_pessoa_juridica** | opcional        | String  | CNPJ do sacador avalista - Obrigatório caso tipo_pessoa = J com 14 números (sem pontos, traços ou barras); não informar o campo caso tipo_pessoa = F. Exemplo: 12312312000110                             |
| **sacador_avalista > endereco > nome_logradouro** | opcional        | String  | Nome do logradouro, número, complemento. Deve estar igual ao site dos Correios. Obrigatório caso o sacador_avalista tenha sido indicado. Máximo: 45 caracteres*                                           |
| **sacador_avalista > endereco > nome_bairro**  | opcional        | String  | Nome do bairro. Obrigatório caso informe sacador avalista. Deve estar igual ao site dos Correios. Máximo: 15 caracteres*                                                                                  |
| **sacador_avalista > endereco > nome_cidade**  | opcional        | String  | Nome da cidade. Obrigatório caso informe sacador avalista. Deve estar igual ao site dos Correios. Máximo: 20 caracteres*                                                                                  |
| **sacador_avalista > endereco > sigla_UF**     | opcional        | String  | Sigla da UF. Obrigatório caso informe sacador avalista. Deve estar igual ao site dos Correios. Máximo: 2 caracteres*                                                                                      |
| **sacador_avalista > endereco > numero_CEP**   | opcional        | String  | CEP. Obrigatório caso informe sacador avalista. Deve estar igual ao site dos Correios. Formato: 8 números, sem pontos e traços                                                                            |
| **dados_individuais_boleto > numero_nosso_numero** | opcional        | String  | Número de identificação do título. De livre utilização do usuário seguindo as regras da carteira do produto contratado. Não pode ser repetido se nosso número ainda estiver ativo ou tiver menos de 45 dias de sua baixa/liquidação. Nosso número é obrigatório para carteira 109. Máximo: 08 caracteres. |
| **dados_individuais_boleto > data_vencimento** | obrigatório     | String  | Data máxima para pagamento do título sem que haja acréscimo de juros e multa. Formato: AAAA-MM-DD                                                                                                         |
| **dados_individuais_boleto > valor_titulo**    | obrigatório     | String  | Valor a ser cobrado. Formato do campo: 15 dígitos inteiros e 2 casas decimais                                                                                                                             |
| **dados_individuais_boleto > data_limite_pagamento** | opcional        | String  | Data limite para pagamento do título. Após esta data, o título não poderá ser pago. Informar, no mínimo a data de vencimento, e no máximo data futura de 10 anos. Caso não seja informada a data, será assumido como 10 anos. Formato: AAAA-MM-DD. Em breve, caso a data de limite de pagamento informada seja anterior ao vencimento, será atribuída a data de vencimento para esse campo. |
| **dados_individuais_boleto > texto_seu_numero** | opcional        | String  | Seu número é a identificação do boleto que poderá ter letras e números e facilitará a consulta e acompanhamento do status do boleto. Este campo é para controle do cliente e obrigatório em caso de serviço de protesto. Máximo: 10 caracteres* |
| **juros > codigo_tipo_juros**                  | obrigatório     | String  | Tipo da cobrança dos juros no cálculo da cobrança. Para cada um dos valores informados, será impresso no boleto a notação referente ao valor correspondente em porcentagem mensal. '05' Quando não se deseja cobrar juros caso o pagamento seja feito após o vencimento (isento) '90' Percentual mensal (utilizando parâmetros do cadastro de beneficiário para dias úteis ou corridos) '91' - Percentual diário (utilizando parâmetros do cadastro de beneficiário para dias úteis ou corridos) '92' - Percentual anual (utilizando parâmetros do cadastro de beneficiário para dias úteis ou corridos) '93' - Valor diário (utilizando parâmetros do cadastro de beneficiário para dias úteis ou corridos) |
| **juros > valor_juros**                        | opcional        | String  | Valor dos juros a ser cobrado. Obrigatório para codigo_tipo_juros ‘93’. Valor deve ser superior a R$0,01. Formato do campo: 15 dígitos inteiros e 2 casas decimais. Exemplo: 99999999999999900. Quando o valor informado ficar inferior à R$ 0,001 ao dia, o parâmetro será ignorado e o boleto emitido, sem juros. |
| **juros > percentual_juros**                   | opcional        | String  | Percentual dos juros a ser cobrado. Valor calculado deve ser superior a R$0,01. Obrigatório para tipo_juros ‘90’, ‘91’ e ‘92’. Formato do campo: 7 dígitos inteiros e 5 casas decimais. Exemplo: 999999900000. Quando o valor calculado for inferior à R$ 0,001 ao dia, o parâmetro será ignorado e o boleto emitido, sem juros. |
| **juros > data_juros**                         | opcional        | String  | Data de início de cobrança de juros, deve ser posterior ao vencimento. Caso o campo esteja vazio, será automaticamente assumido que a cobrança de juros se inicia logo após o vencimento. Formato: AAAA-MM-DD. Em breve, quando informada uma data anterior ao vencimento, será atribuída a data de vencimento ao parâmetro. |
| **multa > codigo_tipo_multa**                  | obrigatório     | String  | Código da multa '01' - Quando se deseja cobrar um valor fixo de multa após o vencimento. '02' - Quando se deseja cobrar um percentual do valor do título de multa após o vencimento. '03' - Quando não se deseja cobrar multa caso o pagamento seja feito após o vencimento (isento) |
| **multa > valor_multa**                        | opcional        | String  | Valor da multa cobrada. Obrigatório para codigo_tipo_multa 01. Valor calculado deve ser superior a R$0,01. Formato do campo: 15 dígitos inteiros e 2 casas decimais. Exemplo: 99999999999999900.          |
| **multa > percentual_multa**                   | opcional        | String  | Percentual da multa cobrada. Obrigatório para tipo_multa 02. Valor calculado deve ser superior a R$0,01. Formato do campo: 7 dígitos inteiros e 5 casas decimais. Exemplo: 999999900000.                  |
| **multa > data_multa**                         | opcional        | String  | Data de início de cobrança de multa, deve ser posterior ao vencimento. Caso o campo esteja vazio, será automaticamente assumido que a cobrança de multa se inicia logo após o vencimento. Formato: AAAA-MM-DD. Em breve, quando informada uma data anterior ao vencimento, será atribuída a data de vencimento ao parâmetro. |
| **desconto > codigo_tipo_desconto**            | obrigatório     | String  | Código do desconto. Caso exista mais de um desconto, todos os tipo_desconto deverão ter o mesmo código. '00' - Quando não houver condição de desconto (sem desconto). '01' - Quando o desconto for um valor fixo se o título for pago até a data informada (data_desconto). '02' - Quando o desconto for um percentual (mensal) do valor do título e for pago até a data informada (data_desconto). '90' - Percentual por antecipação (utilizando parâmetros do cadastro de beneficiário para dias úteis ou corridos). '91' - Valor por antecipação (utilizando parâmetros do cadastro de beneficiário para dias úteis ou corridos). |
| **desconto > data_desconto**                   | opcional        | Integer | Data limite de cobrança de desconto, deve ser anterior ou igual ao vencimento. Caso o campo esteja vazio, será automaticamente assumido que a cobrança de desconto é até a data de vencimento. Formato: AAAA-MM-DD. Obrigatório quando codigo_tipo_desconto é informado e deve ser inserido em ordem decrescente. Em breve, quando informada uma data posterior ao vencimento, será atribuída a data de vencimento ao parâmetro. |
| **desconto > valor_desconto**                  | opcional        | String  | Valor do desconto a ser cobrado. Obrigatório para codigo_tipo_desconto 1 ou 91. Valor calculado deve ser superior a R$0,01. Formato do campo: 15 dígitos inteiros e 2 casas decimais. Obrigatório quando codigo_tipo_desconto é informado. Quando o valor informado for inferior à R$ 0,01 ao dia o parâmetro será ignorado e o boleto emitido, sem desconto. |
| **desconto > percentual_desconto**             | opcional        | String  | Percentual do desconto concedido. Obrigatório para codigo_tipo_desconto 2 ou 90. Valor calculado deve ser superior a R$0,01. Formato do campo: 7 dígitos inteiros e 5 casas decimais. Obrigatório quando codigo_tipo_desconto é informado. Quando o valor calculado for inferior à R$ 0,01 ao dia o parâmetro será ignorado e o boleto emitido, sem desconto. |
| **recebimento_divergente > codigo_tipo_autorizacao** | obrigatório     | String  | Tipo de autorização de recebimento divergente da cobrança. "01" - Quando o título aceita qualquer valor divergente ao da cobrança. "02" - Quando o título contém uma faixa de valores aceitos para recebimentos divergentes. "03" - Quando o título não deve aceitar pagamentos de valores divergentes ao da cobrança. "04" - Quando o título aceitar pagamentos de valores superiores ao mínimo definido |
| **recebimento_divergente > codigo_tipo_recebimento** | opcional        | String  | Tipo de autorização de recebimento divergente da cobrança. Obrigatório para codigo_tipo_autorizacao diferente de 01 e 03. V - Recebimento divergente for informado por valores P - Recebimento divergente for informado por percentuais |
| **recebimento_divergente > valor_minimo**      | opcional        | String  | Valor mínimo permitido para pagamento. Obrigatório para codigo_aceite_pagamento_divergente 2 ou 4. Formato do campo: 15 dígitos inteiros e 2 casas decimais                                              |
| **recebimento_divergente > percentual_minimo** | opcional        | String  | Percentual mínimo permitido para pagamento. Obrigatório para codigo_tipo_autorizacao 2 ou 4. Formato do campo: 7 dígitos inteiros e 5 casas decimais                                                      |
| **recebimento_divergente > valor_maximo**      | opcional        | String  | Valor máximo permitido para pagamento. Obrigatório para codigo_tipo_autorizacao 2. Formato do campo: 15 dígitos inteiros e 2 casas decimais                                                               |
| **recebimento_divergente > percentual_maximo** | opcional        | String  | Percentual máximo permitido. Obrigatório para codigo_tipo_autorizacao 2. Formato do campo: 7 dígitos inteiros e 5 casas decimais                                                                          |
| **protesto > protesto**                        | opcional        | boolean | Em caso de protesto informar "true". Em caso de não protesto não enviar o bloco de protesto OU enviar "false".                                                                                            |
| **protesto > quantidade_dias_protesto**        | opcional        | Integer | Em caso de protesto "true" (campo acima) enviar a quantidade de dias, mínimo 1 e máximo 99. Em caso de protesto "false" não enviar quantidade de dias OU enviar valor zero.                               |
| **negativacao > negativacao**                  | opcional        | boolean | Em caso de negativação informar "true". Em caso de não negativar não enviar o bloco de negativação.                                                                                                        |
| **negativacao > quantidade_dias_negativacao**  | opcional        | Integer | Em caso de negativação "true" (campo acima) enviar a quantidade de dias, mínimo 2 e máximo 99. Em caso de negativação "false" não enviar o campo.                                                          |
| **dados_individuais_boleto > texto_uso_beneficiario** | opcional        | String  | Campo de 25 caracteres. Deve ser utilizado apenas letras e números.                                                                                                                                       |
| **instrucao_cobranca > codigo_instrucao_cobranca** | opcional        | String  | Códigos das instruções de protesto. Só podem ser enviadas até 4 instruções de Recebimentos e até 3 instruções de Cobrança, ou seja, até 7 instruções por boleto. Se houverem mais comandos, iremos descartar um instrução aleatoriamente. Ver "Tabela de Instruções de Recebimentos" e "Tabela de Instruções de Cobrança".                          |
| **instrucao_cobranca > quantidade_dias_apos_vencimento** | opcional        | Integer | Quantidade de dias após vencimento do boleto, o prazo deve ser entre 01 e 99 dias. Para baixa também é possível 365 dias de vencido.                                                                      |
| **instrucao_cobranca > dia_util**              | opcional        | Boolean | Caso a quantidade de dias após o vencimento tenha que ser contabilizada em dia útil, informar true. Caso tenha que ser contabilizada em dias corridos, informar false. Importante as orientações mencionadas, não são validas para as instruções 7 - “Não receber após XX de vencimento” e 8 – “Cancelar (Baixar/Devolver) após XX de vencimento, o prazo deve ser entre 01 e 99 dias, ou 365 dias de vencido.”      <br><br>**Atenção**: O CEP do pagador e sacador avalista (se houver) precisa estar correto conforme site dos Correios. Caso não informado será atribuído false/corridos. |
| **dados_qrcode**                               | opcional        | object  | Dados do qrcode vinculado ao boleto                                                                                                                                                                       |
| **chave**                                      |                 |         | Chave DICT do recebedor (CNPJ, email, chave aleatória ou telefone)                                                                                                                                        |
| **id_location**                                | integer         |         | Identificador da URL que contém a localização dos dados da cobrança atrelada ao QR Code. Observação: Esse campo deve ser utilizado quando a imagem do QR Code foi gerado pela API de Location (para reutilização da imagem do QR Code ou para emissão off-line). Caso não seja enviado a location será gerada automaticamente Tipo do campo: integer($int64) |
| **tipo_cobranca**                              | string          |         | Identificador do tipo de cobrança do PIX. Observação: Valores aceitos: cob = cobrança pix imediata.                                                                                                        |

* **A partir de março passamos a truncar os campos de logradouro, bairro e cidade de acordo com o limite de caracteres. Desse modo se for encaminhado um conteúdo maior que o indicado, acateremos o limite e o excedente será ignorado.**

### Body de Saída

O payload de saída da API pode conter os mesmos campos do body de entrada mais os que constam abaixo.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| **codigo_canal_operacao** | String | API |
| **codigo_operador** | String | Agência (4 dígitos) + Conta (5 dígitos) |
| **beneficiario > nome_cobranca** | String | Razão social do beneficiário. Máximo caracteres: 50. |
| **beneficiario > tipo_pessoa > codigo_tipo_pessoa** | obrigatório (String) | Tipo pessoa do beneficiário: Pessoa Física - 'F', Pessoa Jurídica - 'J' |
| **beneficiario > tipo_pessoa > numero_cadastro_pessoa_fisica** | opcional (String) | CPF do beneficiário - Obrigatório caso tipo_pessoa = F. Exemplo: 12345678910 |
| **beneficiario > tipo_pessoa > numero_cadastro_nacional_pessoa_juridica** | opcional (String) | CNPJ do beneficiário - Obrigatório caso tipo_pessoa = J. Exemplo: 12312312000110 |
| **dado_boleto > forma_envio** | String | 'impressão' ou 'e-mail' |
| **dado_boleto > codigo_tipo_vencimento** | Integer | Tipo de vencimento do boleto. '3' - Data de vencimento informada pelo cliente |
| **pagador > pagador_eletronico_DDA** | boolean | Indica se o pagador possui cadastro no DDA |
| **pagador > praca_protesto** | boolean | Indica se o CEP do pagador é de uma praça protestável |
| **dados_individuais_boleto > id_boleto_individual** | String | Identificador do título |
| **dados_individuais_boleto > codigo_barras** | String | Número do código de barras |
| **dados_individuais_boleto > numero_linha_digitavel** | String | Número da linha digitável |
| **dados_individuais_boleto > texto_uso_beneficiario** | String | Campo de 25 caracteres, utilizado na API legado como "identificador_titulo_empresa". Deve ser utilizado apenas letras e números. |
| **juros > codigo_tipo_juros** | String | O retorno será de acordo com os parâmetros do cadastro de beneficiário para dias úteis ou corridos. Isento - '05' para dias úteis e '05' para dias corridos. Percentual mensal - '08' para dias úteis e '03' para dias corridos. Percentual diário - '07' para dias úteis e '02' para dias corridos. Percentual anual - '09' para dias úteis e '04' para dias corridos. Valor diário - '06' para dias úteis e '01' para dias corridos. |

### Tabela de Instruções

| Código | Instrução                                                                 |
|--------|---------------------------------------------------------------------------|
| 1      | Protestar                                                                 |
| 2      | Negativar                                                                 |
| 4      | Não protestar                                                             |
| 5      | Não negativar                                                             |
| 7      | Não receber após XX de vencimento                                         |
| 8      | Cancelar (Baixar/Devolver) após XX de vencimento, o prazo deve ser entre 01 e 99 dias, ou 365 dias de vencido. |

### Tabela de Carteiras

| Carteira | Descrição                              | Vencimento Mínimo | Vencimento Máximo |
|----------|----------------------------------------|-------------------|-------------------|
| 109      | Direta entrega do boleto pelo cliente  | 1 ano (-360)      | 10 anos (+3650)   |
| 175      | Direta entrega do boleto pelo cliente  | 1 ano (-360)      | 10 anos (+3650)   |

### Tabela de Espécies

| Código | Sigla | Descrição da espécie                                           |
|--------|-------|----------------------------------------------------------------|
| 01     | DM    | Duplicata de Venda Mercantil                                   |
| 02     | NP    | Nota Promissória                                               |
| 03     | NS    | Nota de Seguro                                                 |
| 04     | ME    | Mensalidade Escolar                                            |
| 05     | RC    | Recibo                                                         |
| 06     | CT    | Contrato                                                       |
| 08     | DS    | Duplicata de Prestação de Serviços Original                    |
| 09     | LC    | Letra de Câmbio                                                |
| 15     | DD    | Documento de Dívida                                            |
| 16     | EC    | Encargos Condominais                                           |
| 17     | FS    | Fatura de Serviço                                              |
| 18     | BDP   | Boleto Proposta (Apenas API)                                   |
| 33     | BDA   | Boleto Depósito Aporte (procure seu gerente para uso dessa espécie) |
| 88     | CBI   | Cédula de Crédito Bancário por Indicação                       |
| 89     | CC    | Contrato de Câmbio                                             |
| 90     | CCB   | Cédula de Crédito Bancário                                     |
| 91     | CD    | Confissão de Dívida                                            |
| 92     | CH    | Cheque                                                         |
| 93     | CM    | Contrato de Mútuo                                              |
| 94     | CPS   | Conta de Prestação de Serviços                                 |
| 95     | DMI   | Duplicata de Venda Mercantil por Indicação                     |
| 96     | DSI   | Duplicata de Prestação de Serviços - Original Por Indicação    |
| 97     | RA    | Recibo de Aluguel (PJ)                                         |
| 98     | TA    | Termo de acordo                                                |
| 99     | DV    | Diversos                                                       |

### Exemplo de Entrada

### Requisição
- **Método**: POST
- **Endpoint**: /boletos_pix

### Body
```json
{
 "data": {
   "etapa_processo_boleto": "efetivacao",
   "codigo_canal_operacao": "API",
   "beneficiario": {
     "id_beneficiario": "id_beneficiario"
   },
   "dado_boleto": {
     "descricao_instrumento_cobranca": "boleto_pix",
     "forma_envio": "email",
     "texto_endereco_email": "exemplo@itau.com.br",
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

### Códigos de Status

| Código         | Descrição                                                           |
|----------------|---------------------------------------------------------------------|
| `200`          | Boleto com Pix emitido com sucesso.                                 |
| `202`          | Operação em andamento, consulte seu boleto com pix em instantes.    |
| `400`          | Parâmetros incorretos.                                              |
| `403`          | Acesso Proibido. Verifique se os parâmetros de acesso estão válidos |
| `422`          | Erro de negócio.                                                    |
| `5xx`          | Condição inesperada ao processar requisição.                        |

(status = 202, application/json) 

```json
    {
        "codigo": "202",
        "mensagem": "Operação em andamento, consulte seu boleto com pix em instantes"
    }
```

### Notificação de novo consentimento (POST)

### [POST] {url cadastrada pelo parceiro}

**Segurança:**

O Itaú irá realizar a chamada para a API de callback através de uma URL exposta na web, protegida por uma camada de autenticação mTLS (HTTPS).

Antes de operar, é necessário que o parceiro valide se possui um [certificado de autenticação](https://devportal.itau.com.br/certificado-dinamico) para acesso às APIs do Itaú.

**API call-back**

O parceiro deve desenvolver uma API para se integrar ao webhook e estar apto a receber as credenciais de seus clientes no fluxo de parcerias do Itaú.

A seguir os objetos que serão retornados na notificação de novo consentimento para chave PIX.

### Parâmetros de Entrada (enviados pelo webhook)

| Parâmetro                | Tipo de parâmetro | Tipo do dado | Presença        | Tamanho | Descrição                                                                         |
|--------------------------|-------------------|--------------|-----------------|---------|-----------------------------------------------------------------------------------|
| **razao_social_cliente** | body              | String       | **obrigatório** | 255     | Razão social do cliente detentor do consentimento.                                |
| **numero_cnpj_cliente**  | body              | String       | **obrigatório** | 14      | CNPJ do cliente detentor do consentimento.                                        |
| **client_id**            | body              | String       | **obrigatório** | 36      | Identificador para autenticação e autorização.                                    |
| **client_secret**        | body              | String       | **obrigatório** | 36      | Chave para autenticação e autorização.                                            |
| **chave**                | body              | String       | **obrigatório** | 255     | Chave PIX.                                                                        |
| **acao**                 | body              | String       | **obrigatório** | 8       | Ação do cliente ao consentimento. Valores possíveis: EMITIDO, ALTERADO, REVOGADO. |
| **mensagem**             | body              | String       | **obrigatório** | 255     | Mensagem informativa.                                                             |

### Códigos de Status

| Código         | Descrição                                                          |
|----------------|--------------------------------------------------------------------|
| `200`          | Parceiro recebeu a notificação com sucesso.                        |
| `400` ou `422` | Erro causado por informações enviadas pelo webhook.                |
| `5xx`          | Erro causado por indisponibilidades no serviço de API do Parceiro. |

### Exemplos de saída (resposta do parceiro) 

(status = 200, application/json) 

- Em casos de sucesso, a resposta da requisição não necessita conter corpo.

(status = 400 ou 422, application/json) 

```json
    {
        "codigo": "BAD_REQUEST",
        "mensagem": "Requisição inválida.",
        "erros": [
            {
                "campo": "client_id",
                "mensagem": "Campo obrigatório"
            }
        ],
    }
```

(status = 5xx, application/json)

```json
{
    "codigo": "SERVICE_UNAVAILABLE",
    "mensagem": "Servidor temporariamente indisponível.",
}
```

- Em caso de erros internos de servidor com código status **`5XX`**, serão realizadas até **`3`** tentativas de requisição à API do parceiro. Se o limite for excedido, o parceiro em questão será contatado.

## **domínios**

### Domínio de Modalidade de Agente

Domínios relacionados às modalidades de agentes.

APIs afetadas com este domínio:
* **[POST]** /decodificacoes_qrcode
* **[POST]** /leituras_qrcodes_pix
* **[POST]** /cobrancas_imediata_pix
* **[PATCH]** /cobrancas_imediata_pix/{id_cobranca_imediata_pix}
* **[POST]** /cobrancas_estatico_pix
* **[PATCH]** /cobrancas_estatico_pix/{id_cobranca_estatico_pix}

| Descrição                               | Domínio |
|-----------------------------------------|---------|
| Agente Estabelecimento Comercial        | `AGTEC` |
| Agente Outra Espécie de Pessoa Jurídica | `AGTOT` |
| Agente Prestador de Serviço de Saque    | `AGPSS` |

### Domínio Tipo QR Code

Domínios relacionados ao tipo do QR Code.

APIs afetadas com este domínio:
* **[POST]** /decodificacoes_qrcode
* **[POST]** /leituras_qrcodes_pix
* **[POST]** /cobrancas_estatico_pix
* **[PATCH]** /cobrancas_estatico_pix/{id_cobranca_estatico_pix}

| Descrição        | Domínio      |
|------------------|--------------|
| QR Code estático | `estatico`   |
| QR Code dinâmico | `dinamico`   |

### Domínio Tipo Modalidade

Domínios relacionados ao tipo de modalidade.

APIs afetadas com este domínio:
* **[POST]** /decodificacoes_qrcode

| Descrição                  | Domínio          |
|----------------------------|------------------|
| QR Code estático           | `estatico`       |
| QR Code dinâmico           | `dinamico`       |
| QR Code estático com saque | `estatico_saque` |
| QR Code dinâmico com saque | `dinamico_saque` |
| QR Code dinâmico com troco | `dinamico_troco` |

### Domínio de Tipo de Cobrança

Domínios relacionados aos tipos de cobranças utilizados.

APIs afetadas com este domínio:
* **[POST]** /decodificacoes_qrcode
* **[POST]** /leituras_qrcodes_pix

| Descrição               | Domínio |
|-------------------------|---------|
| Cobrança imediata       | `cob`   |
| Cobrança com vencimento | `cobv`  |

### Domínio de Tipo de Conta

Domínios relacionados aos tipos de contas.

APIs afetadas com este domínio:
* **[POST]** /decodificacoes_qrcode
* **[POST]** /leituras_qrcodes_pix
* **[POST]** /cobrancas_estatico_pix
* **[PATCH]** /cobrancas_estatico_pix/{id_cobranca_estatico_pix}

| Descrição      | Domínio      |
|----------------|--------------|
| Conta corrente | `corrente`   |
| Conta poupança | `poupanca`   |
| Conta salário  | `salario`    |

### Domínio de Tipo de Chave

Domínios relacionados aos tipos de chaves existentes.

APIs afetadas com este domínio:
* **[POST]** /decodificacoes_qrcode
* **[POST]** /leituras_qrcodes_pix
* **[POST]** /cobrancas_estatico_pix
* **[PATCH]** /cobrancas_estatico_pix/{id_cobranca_estatico_pix}

| Descrição       | Domínio |
|-----------------|---------|
| Chave CPF       | `CPF`   |
| Chave CNPJ      | `CNPJ`  |
| Chave telefone  | `PHONE` |
| Chave email     | `EMAIL` |
| Chave aleatória | `EVP`   |

### Domínio Status da Cobrança

Domínios relacionados aos status das cobranças.

APIs afetadas com este domínio:
* **[POST]** /decodificacoes_qrcode
* **[POST]** /leituras_qrcodes_pix
* **[POST]** /cobrancas_imediata_pix
* **[PATCH]** /cobrancas_imediata_pix/{id_cobranca_imediata_pix}
* **[POST]** /cobrancas_vencimento_pix
* **[PATCH]** /cobrancas_vencimento_pix/{id_cobranca_vencimento_pix}
* **[POST]** /cobrancas_estatico_pix
* **[PATCH]** /cobrancas_estatico_pix/{id_cobranca_estatico_pix}

| Descrição                                                                                                         | Domínio                           |
|-------------------------------------------------------------------------------------------------------------------|-----------------------------------|
| Indica que o registro se refere a um QR Code que foi gerado mas ainda não foi pago nem removido                   | `ATIVA`                           |
| Indica que o registro se refere a um QR Code que já foi pago e, por conseguinte, não pode acolher outro pagamento | `CONCLUIDA`                       |
| Indica que o usuário recebedor solicitou a remoção do registro do QR Code                                         | `REMOVIDO_PELO_USUARIO_RECEBEDOR` |
| Indica que o PSP Recebedor solicitou a remoção do registro do QR Code                                             | `REMOVIDO_PELO_PSP`               |

### Domínio Multa

Domínios relacionados à multa.

APIs afetadas com este domínio:
* **[POST]** /cobrancas_vencimento_pix
* **[PATCH]** /cobrancas_vencimento_pix/{id_cobranca_vencimento_pix}

| Descrição  | Domínio |
|------------|---------|
| Valor Fixo | `1`     |
| Percentual | `2`     |

### Domínio Desconto

Domínios relacionados ao desconto.

APIs afetadas com este domínio:
* **[POST]** /cobrancas_vencimento_pix
* **[PATCH]** /cobrancas_vencimento_pix/{id_cobranca_vencimento_pix}

| Descrição                                | Domínio | Descrição                              | Domínio |
|------------------------------------------|---------|----------------------------------------|---------|
| Valor Fixo até a(s) data(s) informada(s) | `1`     | Valor por antecipação dia útil         | `4`     |
| Percentual até a data informada          | `2`     | Percentual por antecipação dia corrido | `5`     |
| Valor por antecipação dia corrido        | `3`     | Percentual por antecipação dia útil    | `6`     |

### Domínio Juros

Domínios relacionados aos juros.

APIs afetadas com este domínio:
* **[POST]** /cobrancas_vencimento_pix
* **[PATCH]** /cobrancas_vencimento_pix/{id_cobranca_vencimento_pix}

| Descrição                         | Domínio | Descrição                      | Domínio |
|-----------------------------------|---------|--------------------------------|---------|
| Valor (dias corridos)             | `1`     | Valor (dias úteis)             | `5`     |
| Percentual ao dia (dias corridos) | `2`     | Percentual ao dia (dias úteis) | `6`     |
| Percentual ao mês (dias corridos) | `3`     | Percentual ao mês (dias úteis) | `7`     |
| Percentual ao ano (dias corridos) | `4`     | Percentual ao ano (dias úteis) | `8`     |

### Domínio Abatimento

Domínios relacionados ao abatimento.

APIs afetadas com este domínio:
* **[POST]** /cobrancas_vencimento_pix
* **[PATCH]** /cobrancas_vencimento_pix/{id_cobranca_vencimento_pix}

| Descrição  | Domínio |
|------------|---------|
| Valor Fixo | `1`     |
| Percentual | `2`     |

## **padrões de erros**

Essa API retorna códigos de status HTTP para indicar sucesso ou falhas das requisições.    

Códigos **2xx** indicam sucesso.

Códigos **4xx** indicam falhas causadas pelas informações enviadas pelo cliente ou pelo estado atual das entidades.

Códigos **5xx** indicam problemas no serviço no lado da API.

As respostas de erro incluem no corpo detalhes do erro e o campo type identifica o tipo de erro.

Abaixo estão listados os tipos de erro que podem ser retornados por quaisquer endpoints listados nessa documentação.

| **HTTP Status Code**         | **Descrição**                     | **Significado**                                                               | **Como proceder**                                                                                                                                                                              |
|------------------------------|-----------------------------------|-------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `400` Bad Request            | RequisicaoInvalida                | Requisição inválida.                                                          | -                                                                                                                                                                                              |
| `401` Unauthorized           | -                                 | Não autorizado.                                                               | Verifique se os parâmetros de acesso estão válidos (certificado, expiração de token, configuração da credencial, secret ou JWT). Se o problema persistir, entre em contato com o suporte Itaú. |
| `403` Forbidden              | AcessoNegado                      | Requisição de participante autenticado que viola alguma regra de autorização. | -                                                                                                                                                                                              |
| `404` Not Found              | NaoEncontrado                     | Entidade não encontrada.                                                      | -                                                                                                                                                                                              |
| `405` Method Not Allowed     | -                                 | Método não permitido.                                                         | -                                                                                                                                                                                              |
| `422` Unprocessable Entity   | -                                 | Erro semântico.                                                               | -                                                                                                                                                                                              |
| `410` Gone                   | PermanentementeRemovido           | Indica que a entidade existia, mas foi permanentemente removida.              | -                                                                                                                                                                                              |
| `428` Precondition Required  | -                                 | Solicitação requer pré-requisito ou condição que não foi enviada.             | -                                                                                                                                                                                              |
| `500` Internal Server Error  | ErroInternoDoServidor             | Condição inesperada ao processar requisição.                                  | Entre em contato com o suporte Itaú.                                                                                                                                                           |
| `501` Not Implemented        | -                                 | Não implementado.                                                             | Entre em contato com o suporte Itaú.                                                                                                                                                           |
| `503` Service Unavailable    | ServicoIndisponivel               | Serviço não está disponível no momento.                                       | Serviço solicitado pode estar em manutenção ou fora da janela de funcionamento.                                                                                                                |
| `504` Gateway Timeout        | IndisponibilidadePorTempoEsgotado | Indica que o serviço demorou além do esperado para retornar.                  | -                                                                                                                                                                                              |

