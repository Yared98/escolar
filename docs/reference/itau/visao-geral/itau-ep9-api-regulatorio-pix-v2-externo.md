# Recebimentos Pix (v2.27.2)

Fonte: https://devportal.itau.com.br/nossas-apis/itau-ep9-api-regulatorio-pix-v2-externo (aba visão geral, atualizada em 2026-08-22T01:08:41.000Z)
Sandbox: https://sandbox.devportal.itau.com.br/itau-ep9-api-regulatorio-pix-v2-externo/v2
Spec: ../openapi/itau-ep9-api-regulatorio-pix-v2-externo.json

---



> **Atenção: Fique atento para a sua segurança**
>
> Golpistas podem utilizar o tema da atualização de certificados para enviar links, arquivos ou orientações falsas. Utilize apenas os canais oficiais de atendimento e nunca compartilhe senhas ou códigos de autenticação.

## **sobre a API**

Importante! Em breve as API’s no modelo antigo serão desativadas. Se programe para realizar a atualização de endpoints. Na aba “API Reference” poderá consultas as novas rotas.
Atualmente, expomos nossas APIs por meio de duas rotas principais:
· Modelo antigo: https://secure.gateway.api.itau/...
· Modelo novo: https://pix-pj.itau.com/...

- Configuração de Certificados das APIs
Para consumir as APIs PIX do Itaú, é necessário configurar no certificado digital correspondente à rota utilizada.
Na maioria dos casos, essa confiança é gerenciada automaticamente por sistemas operacionais, servidores e linguagens de programação. Contudo, em
alguns cenários, pode ser necessário adicionar manualmente o certificado raiz ao ambiente de desenvolvimento ou ao servidor, garantindo o funcionamento adequado das conexões SSL/TLS.

· Modelo Antigo — secure.gateway.api.itau
Caso você esteja consumindo APIs que utilizam a rota secure.gateway.api.itau, se programe para atualizar os enpoints e a nova CA.
No modelo antigo o certificado raiz utilizado é da GlobalSign. Essa rota utiliza a autoridade certificadora (CA) “GlobalSign Extended Validation CA – SHA256 – G3”. O certificado raiz correspondente é o “GlobalSign Root R3”, disponível em: https://support.globalsign.com/ca-certificates/globalsign-root-certificates

· Modelo Novo — pix-pj.itau.com
Caso você esteja consumindo APIs que utilizam a rota pix-pj.itau.com ou realizando as atualizações de enpoitns e CA, pode ser necessário confiar manualmente no certificado raiz da Amazon.
Essa rota utiliza a CA “Amazon RSA 2048 M04”. O certificado raiz correspondente é o “Amazon Root CA 1”, disponível em: https://www.amazontrust.com/repository/AmazonRootCA1.pem

API Regulatoria Pix Pagamentos PJ (regulatorio/v2):
As APIs de recebimentos Pix são padronizadas pelo Banco Central e permitem que o cliente recebedor realize a gestão completa de seus recebimentos, desde a emissão de QR Codes até a conciliação dos valores recebidos, tanto de QR Code quanto de transferências Pix recebidas. Como principais funções podemos elencar:

* **QR Code imediato**:
    * Emitir QR Code imediato;
    * Alterar ou cancelar QR Code imediato;
    * Consultar dados de um QR Code imediato específico;
    * Consultar listagem de QR Codes imediatos.

* **QR Code com vencimento**:
    * Emitir QR Code com vencimento;
    * Alterar ou cancelar QR Code com vencimento;
    * Consultar dados de um QR Code com vencimento específico;
    * Consultar listagem de QR Codes com vencimento.

* **Consultar Pix Recebido (QR Code ou transferência Pix)**:
    * Consultar Pix recebido específico;
    * Consultar listagem de Pix recebidos.

* **Notificações de recebimento via webhook**:
    * Configuração de recebimento webhook;
    * Receber notificações de recebimento via webhook;
    * Consultar webhooks cadastrados;
    * Deletar cadastro do webhook.

* **Devolução de valores**:
    * Realizar devoluções de valores;
    * Consultar devoluções específicas.

Além disso, as APIs regulatórias do Pix contam com as seguintes funcionalidades adicionais:
* **Emissão em lote de QR Code com vencimento**;
* **Saque e Troco Pix (requer contratação adicional)**;
* **Criação de location**.

Nesta página você encontrará todas as informações necessárias para se integrar com as APIs. Além disso, você também encontrará exemplos de requisições, exemplos de respostas e os padrões de erros utilizados para melhor entendimento e fluidez na sua integração.

Para auxiliá-lo nos testes, você ainda conta com nosso ambiente sandbox para testes.

A seguir, faremos o detalhamento de cada funcionalidade.

**QR Code imediato (COB)**

Um QR Code imediato tem como principais características o pagamento único e o tempo de expiração. É uma forma de recebimento que facilita a conciliação do cliente recebedor, podendo ser realizada através do identificador do QR Code (txid). Além disso, permite a inserção de valor e de dados do cliente pagador de forma opcional.

Como funcionalidade adicional, essas APIs podem ser utilizadas para QR Codes de Saque e Troco Pix. Este produto, permite que seja realizado um saque em espécie através do pagamento de um QR Code do Pix. Caso a operação seja apenas para sacar valores em espécie, sem nenhuma compra de produto ou pagamento de um serviço atrelado, denomina-se essa operação de Saque Pix. Caso essa retirada de valor em espécie esteja atrelada a uma compra de produto ou pagamento de um serviço, denomina-se essa operação de Troco Pix.

Para utilização do **produto Saque e Troco Pix é necessária uma contratação específica** que deve ser tratada com o seu contato comercial.

**QR Code com vencimento (COBV)**

Um QR Code com vencimento tem como principais características o pagamento único e a data de vencimento. Este QR Code pode ser comparado com o boleto bancário devido as suas características. É uma forma de recebimento que permite que o recebedor configure uma data de forma opcional, valores de juros, multa, descontos e abatimento. Para realizar a conciliação o cliente recebedor, pode utilizar o identificador do QR Code (txid).

**Consultas de Pix recebidos (QR Code ou transferência Pix)**

As consultas de Pix recebidos permitem ao cliente realizar a conciliação dos seus recebimentos, sejam eles através de QR Codes ou de transferências Pix.

Essas consultas podem ser realizadas individualmente, ou seja, consulta de um Pix recebido específico ou através de uma lista, consultando, vários Pix recebidos de uma só vez.

**Notificações de recebimento via webhook**

A notificação de recebimento via webhook é uma solução voltada para otimizar o processo de conciliação transacional de um recebimento via Pix, em que o cliente pode cadastrar uma URL para receber uma notificação toda vez que um Pix for recebido.

Para que o webhook funcione, é necessário que o cliente desenvolva uma API de callback através de uma URL exposta na web que possua uma camada de autenticação mTLS (HTTPS).

Para maiores detalhes das especificações para desenvolvimento desta API callback, acessar a área de "informações adicionais" e buscar por "[Webhook] Notificação de Recebimento PIX (POST)".

Com isso desenvolvido, o Itaú realizará uma chamada nessa URL de forma imediata toda vez que um Pix for recebido.

Opcionalmente, é possível receber notificações de devoluções emitidas. Para isso, é necessário solicitar ao seu contato comercial a liberação dessa funcionalidade. Para notificações de devoluções emitidas, em caso de devoluções parciais, será notificado transação a transação e não a soma de todas as devoluções parciais.

Webhook Exclusivo

No Webhook Exclusivo, o cliente passa a receber, nas notificações de cada Pix recebido, os dados de quem efetuou o pagamento (dados da contraparte). Entre os dados disponibilizados estão:

· Nome do pagador

· Documento do pagador

· ISPB do pagador

· Nome da instituição do pagador

Pré-requisito para utilizar o Webhook Exclusivo Pix, é que o cliente já tenha o Webhook Pix no padrão regulatório configurado conforme orientação disponível no DevPortal (Portal do Desenvolvedor).
Para habilitar essa funcionalidade entre em contato com a Central de Atendimento ou com seu Especialista Cash.

**Devolução de valores**

A devolução de um recebimento Pix pode ser realizada de forma integral (mesmo valor da transação original) ou parcial (parte do valor da transação original) para valores recebidos através de QR Codes estáticos, QR Codes imediatos, QR Codes com vencimento ou transferências em até 90 dias da data do recebimento. Exclusivamente para operações de Saque e Troco Pix, o limite para devolução dos valores relacionados ao saque de dinheiro em espécie é de 1 hora a partir do horário do recebimento.

Além disso, é possível consultar devoluções realizadas anteriormente através do identificador da devolução (id).

**Emissão em lote de QR Codes com vencimento (COBV)**

É possível emitir um lote de QR Codes com vencimento. Este lote terá um identificador e não será possível adicionar ou retirar QR Codes com vencimento desse lote após a sua criação.

É possível também alterar e consultar QR Codes com vencimento dentro de um lote. Para o caso de alteração, existem dois possíveis caminhos:
* Alteração de todos os QR Codes do lote;
* Alteração de um QR Code específico do lote.

E para cada tipo de alteração, será necessário utilizar um endpoint diferente.

Já em relação a conciliação, é possível consultar um lote individualmente ou consultar uma lista de lotes de QR Codes com vencimento (estas APIs de consultas são específicas para consultas de lotes e não de QR Codes dentro de lotes).

**Location**

Location é um código que pode ser associado a um QR Code para emitir diferentes QR Codes através de uma mesma imagem.

Ao criar uma location, o cliente poderá usar posteriormente este código para vinculá-lo a um QR Code gerado. Após o pagamento deste QR Code, caso o cliente queira gerar outro QR Code utilizando a mesma imagem do QR Code já enviado ao pagador, basta incluir o identificador deste código na hora da emissão de um novo QR Code.

## **para quem é esta API?**

Os **QR Codes imediatos** são indicados para todos os clientes que têm a necessidade de emitir e conciliar QR Codes para serem pagas no ato da compra ou do serviço.

Os principais casos de uso atualmente são:
* Comércios e serviços físicos (mercados, farmácias, restaurantes e postos);
* Lojas virtuais (e-commerce).

Os **QR Codes com vencimento** são indicados para todos os clientes que têm a necessidade de emitir e conciliar QR Codes com possibilidade de pagamento em data futura. Além disso, é indicado para aqueles clientes que precisam emitir QR Codes com encargos e descontos.
Os principais casos de uso atualmente são:

* Prestadores de serviços;
* Administradoras de condomínio;
* Escolas e universidades.

As **APIs de conciliação ou consultas de QR Codes e transferências recebidas** são recomendadas para todos os clientes que recebem através do Pix, seja por QR Code ou transferência, que possuem a necessidade de conciliar seus recebimentos.

Os principais casos de uso atualmente são:
* Consulta individual de um recebimento para obter dados mais detalhados sobre o pagamento para conciliação transacional e financeira;
* Consulta da listagem de recebimentos a fim de validar as transações recebidas em um período específico.

O **webhook** é destinado aos clientes que tem a necessidade de confirmação imediata do recebimento de valores, auxiliando no processo de conciliação transacional do seu negócio.

Os principais casos de uso atualmente são:
* Confirmação de recebimento de valores em comércios e serviços (mercados, farmácias e postos de gasolina);
* Confirmação de recebimento de valores em lojas virtuais (e-commerce);
* Confirmação de recebimento de valores para liberação de mercadorias (distribuidoras de combustíveis).

As **APIs regulatórias de devolução de Pix recebidos** auxiliam o cliente recebedor no processo de devolução de valores parciais ou integrais aos pagadores.
Os principais casos de uso atualmente são:
* Realizar a devolução parcial ou total de valores ao pagador;
* Consultar devoluções já efetivadas.

As **APIs regulatórias de emissão de QR Codes com vencimento em lote** são indicadas para clientes que têm a necessidade de emitir e conciliar QR Codes com possibilidade de pagamento em data futura ou que precisam emitir QR Codes com encargos e descontos e desejam emitir esses QR Codes em lotes.

Os principais casos de uso atualmente são:
* Prestadores de serviços;
* Administradoras de condomínio;
* Escolas e universidades.

As **APIs regulatórias de location** são indicadas para cliente que desejam vincular diversos QR Codes a uma mesma imagem de QR Code.

Os principais casos de uso atualmente são:
* Escolas e universidades (QR Code fixo na carteirinha que emite um novo QR Code todo mês);
* Prestadores de serviços (QR Code único e fixo, onde é emitido um novo QR Code a cada novo serviço realizado).

## **restrições de uso**

Para utilização de todas as APIs, é necessário estar habilitado no Portal Itaú for Developers e possuir um certificado dinâmico ativado.

As consultas às APIs regulatórias (COB, COBV, PIX e LOCATION) estão disponíveis para um período de até 2 anos retroativos a partir da data atual. Para informações anteriores a esse período, entre em contato com a Central de Atendimento ou com seu Especialista Cash.

**Webhook**

Para utilização do webhook é necessário possuir um certificado mTLS e uma API Call Back.

**Service Level Objective (SLO) notificações via webhook** -
A API de callback deste webhook deve responder à requisição em até 5 segundos. Após esse tempo, a API considera a tentativa como sem resposta e realiza a desistência da espera, podendo registrar falha ou seguir com lógica de retentativa.

**Processamento Assíncrono das Notificações via Webhook** - A API de callback do webhook deve desacoplar a confirmação de recebimento da notificação do seu processamento. Para garantir conformidade com o SLO de tempo de resposta (até 5 segundos), recomenda-se:
Responder imediatamente à requisição do webhook com um código de sucesso (ex: HTTP 200 OK), confirmando o recebimento.
Executar o processamento da notificação de forma assíncrona, em segundo plano, utilizando mecanismos como filas, workers ou tarefas agendadas.
Essa abordagem evita atrasos na resposta e garante maior confiabilidade na comunicação entre os sistemas.

**Validação de Certificado Digital** - Recomenda-se validar apenas os certificados de autoridades certificadoras (CA) — ou seja, os certificados raiz e intermediários — presentes na cadeia de confiança.
O certificado folha (leaf certificate), utilizado pelo servidor, não precisa ser importado na truststore, pois sua validação é feita dinamicamente durante a conexão TLS.
Essa abordagem é preferível pois: minimiza o impacto na manutenção, já que certificados folha expiram com mais frequência.
Preserva a segurança, confiando apenas em autoridades certificadoras reconhecidas.

## **conhecimentos técnicos necessários**
Conhecimentos prévios necessários:

**Conhecimentos técnicos**

`Construção de APIs REST escaláveis` `Comunicações assíncronas e síncronas` `Padrões de autenticação`

`Padrões de segurança`

**Tecnologias**

`API REST/Restful` `HTTP/HTTPS` `JSON` `Postman/Insomnia` `mTls` `OAUTH2`

## **quais necessidades que essa API ajuda a resolver?**

Com as **APIs regulatórias de QR Codes imediatos** o cliente pode emitir, alterar, cancelar e consultar QR Codes imediatos.

Com as **APIs regulatórias de QR Codes com vencimento**, o cliente pode emitir, alterar, cancelar e consultar QR Codes com vencimento.

As **APIs regulatórias de consulta de Pix recebidos** auxiliam o cliente recebedor no processo de conciliação financeira de suas operações, possibilitando a consulta de um QR Code individual ou uma lista de QR Codes.

Com as APIs do **webhook** o cliente recebedor pode cadastrar uma URL (API Call Back), consultar uma URL cadastrada, consultar uma lista de URLs cadastradas, deletar uma URL cadastrada e receber as notificações de recebimentos através da URL cadastrada.

Com as **APIs regulatórias de devolução de Pix recebidos** o cliente pode realizar devoluções integrais ou parciais de valores recebidos e consultar devoluções de valores realizadas.

Com as **APIs de emissão de QR Codes com vencimento em lote** o cliente pode emitir, alterar ou consultar lotes de QR Codes com vencimento.

Com as **APIs regulatórias de location** o cliente pode criar de uma location, consultar uma location, desvincular um location e recuperar uma location através de seu identificador.

## **tempo aproximado para integração**
**15 dias:** essa é a média de tempo que um desenvolvedor pode levar para preparar toda a integração com essa API. Isso pode variar de acordo com o tamanho do time e experiência dos desenvolvedores envolvidos.

## **endpoints**

Nosso objetivo é deixar claro tudo que você precisa fazer para integrar às APIs do pix no Itaú. Para isso, todas as informações e exemplos necessários estão reunidos aqui.

Os exemplos de response de erros são demonstrados no tópico **padrões de erros** ao final desta page. Cada endpoint traz uma tabela especificando quais desses retornos aquele serviço retorna. Então, caso haja variação no json retornado, este será demonstrado na explicação do próprio endpoint, se não, deve ser visualizado no tópico citado.

### **URLs**
Para garantir uma integração segura, as funcionalidades da API estão disponíveis nas seguintes URLs:

| ambiente | endpoint                                                                                                        |
|----------|-----------------------------------------------------------------------------------------------------------------|
| sandbox  | https://vpce-sp.virtualizacaoservicos.prod.aws.cloud.ihf/apivirtual/itau-ep9-api-regulatorio-pix-v2-externo/v2/ |
| produção | https://pix-pj.api.itau.com/regulatorio-pix/v2                                                                      |  

### Emissão de Cobrança Imediata (POST)

### [POST] /cob

API para emitir um QR Code imediato em que o Itaú é responsável por criar o identificador do QR Code (txid).

**URL:** POST https://pix-pj.api.itau.com/regulatorio-pix/v2/cob

### Consulta de Lista de Cobrança Imediata (GET)

### [GET] /cob

API para consultar uma listagem de QR Codes imediatos.

**URL:** GET https://pix-pj.api.itau.com/regulatorio-pix/v2/cob

### Consulta de Cobrança Imediata (GET)

### [GET] /cob/{txid}

API para consultar um QR Code imediato específico através do identificador do QR Code (txid).

**URL:** GET https://pix-pj.api.itau.com/regulatorio-pix/v2/cob/{txid}

### Emissão de Cobrança Imediata (PUT)

### [PUT] /cob/{txid}

API para emitir um QR Code imediato.

**URL:** PUT https://pix-pj.api.itau.com/regulatorio-pix/v2/cob/{txid}

### Alteração de Cobrança Imediata (PATCH)

### [PATCH] /cob/{txid}

API para alterar ou cancelar um QR Code imediato.

**URL:** PATCH https://pix-pj.api.itau.com/regulatorio-pix/v2/cob/{txid}

### Consulta de PIX Recebidos (GET)

### [GET] /pix

API para consultar uma listagem de Pix recebidos, seja QR Code ou transferência Pix.

**URL:** GET https://pix-pj.api.itau.com/regulatorio-pix/v2/pix

- Descrições de erro - Devolução assíncrona

| Descrição                                                                                                     |
|---------------------------------------------------------------------------------------------------------------|
| Indisponibilidade momentanea no processamento da devolução. Tente novamente mais tarde.                       |
| Instabilidade no PSP de destino da devolução. Tente novamente mais tarde                                      |
| Dados do destinatário da devolução inválido ou inexistentes. Realize a devolução de recursos por outro fluxo. |
| Devolução não permitida ou serviço indisponível. Realize a devolução de recursos por outro fluxo.             |
| Dados da devolução invalidos. Ajuste e tente novamente.                                                       |
| Participante de destino rejeitou a devolução. Realize a devolução de recursos por outro fluxo.                |
| Devolução não permitida por tempo excedido. Tente novamente mais tarde.                                       |
| Transação não permitida. Verifique dados transação, saldo e limite da conta.                                  |
| Devolução não permitida. Realize a devolução de recursos por outro fluxo.                                     |

### Consulta de PIX (GET)

### [GET] /pix/{e2eid}

API para consultar um Pix recebido, seja QR Code ou transferência Pix, através do identificador do pagamento (e2eid).

**URL:** GET https://pix-pj.api.itau.com/regulatorio-pix/v2/pix

### Consulta de Devolução (GET)

### [GET] /pix/{e2eid}/devolucao/{id}

API para consultar uma devolução através do identificador de pagamento (e2eid) e do identificador da devolução (id).

**URL:** GET https://pix-pj.api.itau.com/regulatorio-pix/v2/pix/{e2eid}/devolucao/{id}

### Solicitação de Devolução (PUT)

### [PUT] /pix/{e2eid}/devolucao/{id}

API para solicitar uma devolução através do identificador de pagamento (e2eid) e do identificador da devolução (id).

**URL:** PUT https://pix-pj.api.itau.com/regulatorio-pix/v2/pix/{e2eid}/devolucao/{id}

### [Webhook] Adesão às Notificações de Recebimento PIX (PUT)

### [PUT] /webhook/{chave}

API para cadastrar/atualizar o serviço de notificações via webhook dos QR Codes recebidos e das transferências Pix recebidas via chave Pix.
As transferências Pix recebidas com inserção manual (agência e conta) não serão notificadas e as devoluções emitidas são opcionais, sendo necessário a solicitação de um outro cadastro no Itaú.

As notificações de recebimento serão enviadas na URL cadastrada acrescentando o sufixo "/pix". Sendo assim, no momento do cadastro, não é necessário enviar a URL com o sufixo "/pix".

Exemplos:
- URL enviada: webhook_itau
- URL cadastrada: webhook_itau/pix

### [Webhook] Notificação de Recebimento PIX (POST)

### [POST] {url cadastrada pelo cliente}

**Segurança:**

O Itaú irá realizar a chamada para a API de callback através de uma URL exposta na web, protegida por uma camada de autenticação mTLS (HTTPS).

Em uma conexão mTLS, o servidor de Webhook do Itaú e a API de callback do parceiro trocam certificados entre si a partir de um CA que ambos confiam. Em troca de certificados serve para comprovar a identidade de um servidor ao outro.

Para ativar o fluxo de autenticação via mTLS primeiramente é necessário baixar a CA (chave pública) do Itaú no seguinte link:

[ca-cert.zip](https://devportal.itau.com.br/assets/ca_cert_952123c440.zip)

Após o download, essa CA deverá ser importada no API Gateway, servidor proxy ou aplicação que irá receber a requisição de Webhook do Itaú.

São autorizados todos os CACERTS  do Java 17, caso utilize algum outro entre em contato com o nosso time de atendimento técnico.

**API call-back**

Deve ser desenvolvida pelo cliente API que será responsável por efetuar a recepção da notificação de pagamento instantâneo.
Observação: Em ambientes AWS o DNS deve ser configurado com um registro A ou AAAA apontando diretamente para o API Gateway, em vez de usar um registro CNAME.

O itaú envia as notificações de recebimentos imediatamente a cada pagamento (um a um). Já para as notificações de devolução emitida, o envio é opcional. Caso queria receber este tipo de notificação, é necessário solicitar o cadastro de um parâmetro ao Itaú. Em casos de devoluções parciais, não serão acumulados dentro do array devoluções passadas.

Vale ressaltar que o processo de devolução do Itaú é síncrono e no endpoint [PUT] /pix_recebimentos/v2/pix/{e2eid}/devolucao/{id} já é retornado o status final da devolução e, por isso, o envio de notificação de devolução pelo Webhook é opcional.

A seguir os objetos que serão retornados na notificação de recebimento PIX.

### Parâmetros de saída

| Parâmetro                                                                   | Tipo do Parâmetro | Tipo do dado                       | Presença        | Descrição                                                                                                                                                                                                                                                             | Observação                                                                                                                                                                                                                                  |
|-----------------------------------------------------------------------------|-------------------|------------------------------------|-----------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Pix**                                                                     | **array**         | -                                  | **obrigatório** | -                                                                                                                                                                                                                                                                     | Estrutura com a lista de pix.                                                                                                                                                                                                               |
| **pix**.endToEndId                                                          | body              | string [a-zA-Z0-9]{32}             | **obrigatório** | ID do pagamento, que é transitado nas mensagens com o SPI.                                                                                                                                                                                                            | -                                                                                                                                                                                                                                           |
| **pix**.txid                                                                | body              | string [a-zA-Z0-9]{26,35}          | opcional        | O campo txid determina o identificador da transação. O objetivo desse campo é ser um elemento que possibilite a conciliação de pagamentos. O txid é criado exclusivamente pelo usuário recebedor e está sob sua responsabilidade. Deve ser único por CNPJ do recebedor. | Para Code dinâmico o campo deve possuir de 26 posição até 35 posições. Os caracteres permitidos no contexto do Pix para o campo txId são: Letras minúsculas, de 'a' a 'z'. Letras minúsculas, de 'A' a 'Z', Dígitos decimais, de '0' a '9'. |
| **pix**.valor                                                               | body              | string: \d{1,10}.\d{2}             | **obrigatório**        | Valor do pagamento                                                                                                                                                                                                                                                    | Valor deve ser maior que zeros. A Cobrança será criado com flag "permite alteração de valor" igual a não. Dessa forma, não será permitida edição pelo pagador do valor informado nesse campo.                                               |
| **pix**.horario                                                             | body              | string ($date-time)                | **obrigatório** | Horário do pagamento.                                                                                                                                                                                                                                                 | Horário em que o pagamento Pix foi processado no PSP.                                                                                                                                                                                       |
| **pix**.infoPagador                                                         | body              | string maxLength: 140              | opcional        | Informação livre do pagador.                                                                                                                                                                                                                                          | Campo texto livre do pagador.                                                                                                                                                                                                               | 
| **pix**.chave                                                               | body              | string <= 77                       | opcional        | Chave na qual foi realizado o PIX.                                                                                                                                                                                                                                    | -                                                                                                                                                                                                                                           |
| **pix.componentesValor**                                                    | **object**       | -                                  | opcional        | Informações relativas aos juros, multas, descontos, abatimentos, saque e troco quando o Pix se refere a um pagamento de cobrança com vencimento.                                                                                                                      | Caso todos os campos do objeto estiverem zerados ele será enviado nulo. Vide exemplo na seção payload de saída.                                                                                                                             | 
| **pix.componentesValor.original**                                           | **object**        | -                                  | opcional        | Retorna os dados originais do pix realizado.                                                                                                                                                                                                                          | -                                                                                                                                                                                                                                           | 
| **pix.componentesValor.original**.valor                                     | body              | string [0-9]                       | opcional        | Retorna o valor original do pix realizado.                                                                                                                                                                                                                            | -                                                                                                                                                                                                                                           | 
| **pix.componentesValor.saque**                                              | **object**        | -                                  | opcional        | Retorna os dados de saque do pix realizado.                                                                                                                                                                                                                           | -                                                                                                                                                                                                                                           | 
| **pix.componentesValor.saque**.valor                                        | body              | string [0-9]                       | opcional        | Retorna o valor do saque do pix realizado.                                                                                                                                                                                                                            | -                                                                                                                                                                                                                                           | 
| **pix.componentesValor.saque**.modalidadeAgente                             | body              | string [a-zA-Z0-9]                 | opcional        | Retorna a modalidade do agente que realizou o saque.                                                                                                                                                                                                                  | -                                                                                                                                                                                                                                           | 
| **pix.componentesValor.saque**.prestadorDeServicoDeSaque                    | body              | string [a-zA-Z0-9]                 | opcional        | Identificador do agente prestador de serviço do saque.                                                                                                                                                                                                                | -                                                                                                                                                                                                                                           | 
| **pix.componentesValor.troco**                                              | **object**        | -                                  | opcional        | Retorna os dados de troco do pix realizado.                                                                                                                                                                                                                           | -                                                                                                                                                                                                                                           | 
| **pix.componentesValor.troco**.valor                                        | body              | string [0-9]                       | opcional        | Retorna o valor de troco do pix realizado.                                                                                                                                                                                                                            | -                                                                                                                                                                                                                                           |
| **pix.componentesValor.troco**.modalidadeAgente                             | body              | string [a-zA-Z0-9]                 | opcional        | Retorna a modalidade do agente que realizou o troco.                                                                                                                                                                                                                  | -                                                                                                                                                                                                                                           | 
| **pix.componentesValor.troco**.prestadorDeServicoDeSaque                    | body              | string [a-zA-Z0-9]                 | opcional        | Identificador do agente prestador de serviço do troco.                                                                                                                                                                                                                | -                                                                                                                                                                                                                                           | 
| **pix.componentesValor.juros**                                              | **object**        | -                                  | opcional        | Retorna os dados referentes aos juros do pix realizado.                                                                                                                                                                                                               | -                                                                                                                                                                                                                                           | 
| **pix.componentesValor.juros**.valor_juros                                  | body              | string [0-9]                       | opcional        | Valor do juros.                                                                                                                                                                                                                                                       | -                                                                                                                                                                                                                                           | 
| **pix.componentesValor.multa**                                              | **object**        | -                                  | opcional        | Retorna os dados referentes a multa do pix realizado.                                                                                                                                                                                                                 | -                                                                                                                                                                                                                                           | 
| **pix.componentesValor.multa**.valor_multa_documento_cobranca_pix           | body              | string [0-9]                       | opcional        | Valor da multa do pix realizado                                                                                                                                                                                                                                       | -                                                                                                                                                                                                                                           | 
| **pix.componentesValor.abatimento**                                         | **object**        | -                                  | opcional        | Retorna os dados referentes aos abatimentos do pix realizado.                                                                                                                                                                                                         | -                                                                                                                                                                                                                                           | 
| **pix.componentesValor.abatimento**.valor_abatimento_documento_cobranca_pix | body              | string [0-9]                       | opcional        | Valor do abatimento do pix realizado.                                                                                                                                                                                                                                 | -                                                                                                                                                                                                                                           | 
| **pix.componentesValor.desconto**                                           | **object**        | -                                  | opcional        | Retorna os dados referentes aos descontos do pix realizado.                                                                                                                                                                                                           | -                                                                                                                                                                                                                                           | 
| **pix.componentesValor.desconto**.valor_desconto_documento_cobranca_pix     | body              | string [0-9]                       | opcional        | Valor do desconto da cobrança do pix realizado.                                                                                                                                                                                                                       | -                                                                                                                                                                                                                                           | 
| **devolucoes**                                                              | **array**        | -                                  | opcional        | Devoluções realizadas no pagamento Pix (integral ou parciais).                                                                                                                                                                                                         | Caso todos os campos deste objeto estiverem zerados ele será enviado nulo. Vide exemplo na seção payload de saída.                                                                                                                          | 
| **devolucoes**.id                                                           | body              | string [a-zA-Z0-9]{26,35}          | **obrigatório** | ID da devolução.                                                                                                                                                                                                                                                      | Id gerado pelo cliente para representar unicamente uma devolução.                                                                                                                                                                           |
| **devolucoes**.rtrId                                                        | body              | string minLength: 32 maxLength: 32 | **obrigatório** | ReturnIdentification.                                                                                                                                                                                                                                                 | ReturnIdentification que transita na PACS004.                                                                                                                                                                                               | 
| **devolucoes**.valor                                                        | body              | string pattern: \d{1,10}.\d{2}     | **obrigatório** | Valor da devolução.                                                                                                                                                                                                                                                   | Valor da devolução do pagamento.                                                                                                                                                                                                            | 
| **devolucoes**.natureza                                                     | body              | string [a-zA-Z0-9]                 | opcional        | Indica qual é a natureza da devolução.                                                                                                                                                                                                                                | Enums: ORIGINAL, RETIRADA, MED_OPERACIONAL, MED_FRAUDE, MED_PIX_AUTOMATICO.                                                                                                                                                                 | 
| **devolucoes**.descricao                                                    | body              | string [a-zA-Z0-9]                 | opcional        | Descrição das informações sobre a devolução.                                                                                                                                                                                                                          | -                                                                                                                                                                                                                                           | 
| **devolucoes**.status                                                       | body              | string maxLength: 16               | **obrigatório** | Status da devolução.                                                                                                                                                                                                                                                  | EM_PROCESSAMENTO, DEVOLVIDO, NAO_REALIZADO.                                                                                                                                                                                                 | 
| **devolucoes**.motivo                                                      | body              | string maxLength: 140              | opcional        | Campo opcional utilizado para detalhar os motivos de a devolução ter atingido o status em questão. Por exemplo, para detalhar o motivo de a devolução não ter sido realizada.                                                                                         | -                                                                                                                                                                                                                                           | 
| **devolucoes**.horario                                                      | **object**        | -                                  | **obrigatório**        | -                                                                                                                                                                                                                                                                     | -                                                                                                                                                                                                                                           | 
| **devolucoes.horario**.solicitacao                                          | body              | string ($date-time)                | **obrigatório** | -                                                                                                                                                                                                                                                                     | Horário no qual a devolução foi solicitada no PSP.                                                                                                                                                                                          | 
| **devolucoes.horario**.liquidacao                                           | body              | string ($date-time)                | opcional        | -                                                                                                                                                                                                                                                                     | Horário em que a liquidação da devolução foi efetivada no PSP.                                                                                                                                                                              | 

**Observação¹**: No QR Code Dinâmico, campo solicitacaoPagador é opcional e determina um texto a ser apresentado ao pagador para que ele possa digitar uma informação correlata, em formato livre, a ser enviada ao recebedor.

Para o QR Code Estático esse campo é limitado, devendo ser somado ao tamanho da chave + 22 posições, não podendo ser maior que 99 posições. Dessa forma, não é possível que os campos chave (77 posições) e infoAdicional cheguem simultaneamente a seus tamanhos máximos potenciais. Um exemplo ilustra melhor a situação. Supondo uma chave de tamanho 9, temos:

- ID + tamanho da GUI + ID + tamanho da chave + Tamanho da GUI: 26 (padrão EMV)
- Tamanho da chave: 9
- 26 + 9 = 35

Sobram, no exemplo acima, portanto, 64 caracteres para o campo texto livre (99 - 35 = 64). Se a chave fosse maior, menor seria o espaço destinado ao texto livre. Em outras palavras, o texto livre e a chave disputam o espaço de 99 caracteres do ID raiz (na faixa 26-51).

### Códigos de status

| Código  | Descrição                                                                                                               |
|---------|-------------------------------------------------------------------------------------------------------------------------|
| ``200`` | Requisição executada com sucesso (success).                                                                             | 
| ``400`` | Requisição com formato inválido.                                                                                        | 
| ``403`` | Requisição de participante autenticado que viola alguma regra de autorização.                                           |
| ``404`` | Recurso solicitado não foi encontrado.                                                                                  | 
| ``410`` | Indica que a entidade existia, mas foi permanentemente removida.                                                        | 
| ``500`` | Erro Inesperado. Entre em contato com o suporte Itaú.                                                                   | 
| ``503`` | Serviço não está disponível no momento. Serviço solicitado pode estar em manutenção ou fora da janela de funcionamento. | 
| ``504`` | Gateway Timeout. Entre em contato com o suporte Itaú.                                                                   |

### Exemplo de saída

(status = 200, application/json)

```json
{
  "pix": [
    {
      "endToEndId": "E12345678202009091221kkkkkkkkkkk",
      "txid": "7978c0c97ea847e78e8849634473c1f1",
      "valor": "110.00",
      "horario": "2020-01-01T00:00:00Z",
      "infoPagador": "0123456789",
      "chave": "b53609a5-56a2-4e0d-bd04-0d6b296c4ea6",
      "componentesValor": {
        "original": {
          "valor": "10.0"
        },
        "saque": {
          "valor": "0.0",
          "modalidadAgente": "",
          "prestadorDeServicoDeSaque": ""
        },
        "troco": {
          "valor": "0.0",
          "modalidadeAgente": "AGTEC",
          "prestadorDeServicoDeSaque": "12345678"
        },
        "juros": {
          "valor_juros": "0.0"
        },
        "multa": {
          "valor_multa_documento_cobranca_pix": "0.0"
        },
        "abatimento": {
          "valor_abatimento_documento_cobranca_pix": "0.0"
        },
        "desconto": {
          "valor_desconto_documento_cobranca_pix": "90.0"
        }
      },
      "devolucoes": [
        {
          "id": "123ABC",
          "rtrId": "D12345678202009091221abcdf098765",
          "valor": "10.00",
          "natureza": "ORIGINAL",
          "decricao": "Descrição da devolução",
          "horario": {
            "solicitacao": "2020-01-01T00:00:001Z",
            "liquidacao": "2020-01-01T00:00:001Z"
          },
          "status": "DEVOLVIDO",
          "motivo": ""
        }
      ]
    }
  ]
}
```
(status = 200, application/json) - Webhook exclusivo

```json
{
  "pix": [
    {
      "endToEndId": "E12345678202009091221kkkkkkkkkkk",
      "txid": "7978c0c97ea847e78e8849634473c1f1",
      "valor": "110.00",
      "horario": "2020-01-01T00:00:00Z",
      "infoPagador": "0123456789",
      "chave": "b53609a5-56a2-4e0d-bd04-0d6b296c4ea6",
      "componentesValor": {
        "original": {
          "valor": "10.0"
        },
        "saque": {
          "valor": "0.0",
          "modalidadAgente": "",
          "prestadorDeServicoDeSaque": ""
        },
        "troco": {
          "valor": "0.0",
          "modalidadeAgente": "AGTEC",
          "prestadorDeServicoDeSaque": "12345678"
        },
        "juros": {
          "valor_juros": "0.0"
        },
        "multa": {
          "valor_multa_documento_cobranca_pix": "0.0"
        },
        "abatimento": {
          "valor_abatimento_documento_cobranca_pix": "0.0"
        },
        "desconto": {
          "valor_desconto_documento_cobranca_pix": "90.0"
        }
      },
      "pagador": {
        "documento": "19317798055",
        "nome": "Nome exemplo",
        "instituicao": "Instituição exemplo",
        "ispb": "60701190"
      },
      "devolucoes": [
        {
          "id": "123ABC",
          "rtrId": "D12345678202009091221abcdf098765",
          "valor": "10.00",
          "natureza": "ORIGINAL",
          "decricao": "Descrição da devolução",
          "horario": {
            "solicitacao": "2020-01-01T00:00:001Z",
            "liquidacao": "2020-01-01T00:00:001Z"
          },
          "status": "DEVOLVIDO",
          "motivo": ""
        }
      ]
    }
  ]
}
```
(status = 200, application/json) - Campos nulos

```json
{
  "pix": [
    {
      "endToEndId": "E12345678202401221TESTE00000XX02",
      "txid": "beab0092a8954f7ca050ea50444cb10e",
      "valor": "2000.34",
      "horario": "2024-04-10T11:49:04.432Z",
      "infoPagador": "",
      "chave": "12345678901",
      "componentesValor": ,
      "pagador": {
        "documento": "00145678999",
        "nome": "TESTE FAKE",
        "instituicao": "ITAÚ UNIBANCO S.A",
        "ispb": "60701190"
      },
      "devolucoes": null
    }
  ]
}
```

(status = 400, application/json)

```json
{
  "codigo": "400", 
  "mensagem": "Problemas nos Parâmetros de entrada.", 
  "campos": [
    {
      "campo": "endToEndId", 
      "mensagem": "Identificador de pagamento não informado.", 
      "valor": ""
    }
  ]
}
```

(status = 500, application/json)

```json
{
  "codigo": "500",
  "mensagem": "Problemas de persistência no banco de dados."
}
```

### [Webhook] Consulta de Lista de URLs Cadastradas (GET)

### [GET] /webhook

API para consultar a listagem dos serviços de notificações via webhook cadastrados.

### [Webhook] Consulta de URL Cadastrada para uma chave específica (GET)

### [GET] /webhook/{chave}

API para consultar o serviço de notificações via webhook de uma chave Pix específica.

### [Webhook] Cancelamento da URL cadastrada (DELETE)

### [DELETE] /webhook/{chave}

API para excluir um serviço de notificação de recebimento de chave Pix via webhook.

### Consulta de Lotes de Cobranças com Vencimento (GET)

### [GET] /lotecobv

API para consultar uma listagem de lotes de QR Codes com vencimento.

**URL:** GET https://pix-pj.api.itau.com/regulatorio-pix/v2/lotecobv

### Criação/Alteração de Lote de Cobranças com Vencimento (PUT)

### [PUT] /lotecobv/{id}

API para emitir ou alterar um lote de QR Codes com vencimento.

**URL:** PUT https://pix-pj.api.itau.com/regulatorio-pix/v2/lotecobv/{id}

### Alteração de Cobranças com Vencimento do Lote (PATCH)

### [PATCH] /lotecobv/{id}

API para revisar um QR Code com vencimento específico dentro de um lote de QR Codes com vencimento.

**URL:** PATCH https://pix-pj.api.itau.com/regulatorio-pix/v2/lotecobv/{id}

### Consulta de Lote Específico de Cobranças com Vencimento (GET)

### [GET] /lotecobv/{id}

API para consultar um lote de QR Codes com vencimento.

**URL:** GET https://pix-pj.api.itau.com/regulatorio-pix/v2/lotecobv/{id}

### Consulta de Lista de Cobranças com Vencimento (GET)

### [GET] /cobv

API para consultar uma listagem de QR Codes com vencimento.

**URL:** GET https://pix-pj.api.itau.com/regulatorio-pix/v2/cobv

### Consulta de Cobrança com Vencimento (GET)

### [GET] /cobv/{txid}

API para consultar um QR Code com vencimento específico através do identificador do QR Code (txid).

**URL:** GET https://pix-pj.api.itau.com/regulatorio-pix/v2/cobv/{txid}

### Emissão de Cobrança com Vencimento (PUT)

### [PUT] /cobv/{txid}

API para emitir um QR Code com vencimento.

**URL:** PUT https://pix-pj.api.itau.com/regulatorio-pix/v2/cobv/{txid}

### Alteração de Cobrança com Vencimento (PATCH)

### [PATCH] /cobv/{txid}

API para alterar ou cancelar um QR Code com vencimento.

**URL:** PATCH https://pix-pj.api.itau.com/regulatorio-pix/v2/cobv/{txid}

### Consulta de Location (GET)

### [GET] /loc

API para consultar uma listagem de locations cadastradas.

**URL:** GET https://pix-pj.api.itau.com/regulatorio-pix/v2/loc

### Emissão de Location (POST)

### [POST] /loc

API para criar uma location.

**URL:** POST https://pix-pj.api.itau.com/regulatorio-pix/v2/loc

### Consulta de Location do Payload (GET)

### [GET] /loc/{id}

API para consultar uma location específica através do identificador da location.

**URL:** GET https://pix-pj.api.itau.com/regulatorio-pix/v2/loc/{id}

### Desvinculação de Location (DELETE)

### [DELETE] /loc/{id}/txid

API para desvincular um QR Code de uma location.

**URL:** DELETE https://pix-pj.api.itau.com/regulatorio-pix/v2/loc/{id}/txid

### Consulta de QrCode Imediato (GET)

### [GET] /cob/{txid}/qrcode

A API entrou em obsolescência e será desativada em breve. Entre em contato com o suporte Itaú para realizar a migração.

### Consulta de QRCode com Vencimento (GET)

### [GET] /cobv/{txid}/qrcode

A API entrou em obsolescência e será desativada em breve. Entre em contato com o suporte Itaú para realizar a migração.

### [GET] /qr/cobv/{pixUrlAccessToken}

Recuperar o payload JSON que representa a cobrança vencimento.

## padrões de erros

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
| `503` Service Unavailable    | ServicoIndisponivel               | Serviço não está disponível no momento.                                       | Serviço solicitado pode estar em manutenção ou fora da janela de funcionamento. Se não programado, entre em contato com o suporte Itaú.                                                        |
| `504` Gateway Timeout        | IndisponibilidadePorTempoEsgotado | Indica que o serviço demorou além do esperado para retornar.                  | -                                                                                                                                                                                              |

### Tag CobPayload

Esta seção reúne erros retornados pelos endpoints organizados sob a tag
`CobPayload`.

Estes erros indicam problemas na tentativa de recuperação, via _location_,
do Payload JSON que representa a cobrança.

### Tag Cob

Esta seção reúne erros retornados pelos endpoints organizados sob a tag
`Cob`.

Esses erros indicam problemas no gerenciamento de uma cobrança para
pagamento imediato.

#### `CobNaoEncontrado`

* __Significado__: Cobrança não encontrada para o txid informado.

* __HTTP Status Code__:
  [404](https://tools.ietf.org/html/rfc7231#section-6.5.4).

* __endpoints__: `[GET|PATCH] /cob/{txid}`.

#### `CobOperacaoInvalida`

* __Significado__: a requisição que busca alterar ou criar uma cobrança para
  pagamento imediato

não respeita o schema ou está semanticamente errada.

* __HTTP Status Code__:
  [400](https://tools.ietf.org/html/rfc7231#section-6.5.1).

* __endpoints__: `[POST|PUT|PATCH] /cob/{txid}`.

__Violações__ para os endpoints `PUT|PATCH /cob/{txid}`:
- O campo cob.calendario.expiracao é igual ou menor que zero.
- O campo cob.valor.original não respeita o _schema_.
- O campo cob.valor.original é zero.
- O objeto cob.devedor não respeita o _schema_.
- O campo cob.chave não respeita o _schema_.
- O campo cob.chave corresponde a uma conta que não pertence a este usuário recebedor.
- O campo solicitacaoPagador não respeita o _schema_.
- O objeto infoAdicionais não respeita o _schema.
- O location referenciado por loc.id inexiste.
- O location referenciado por loc.id já está sendo utilizado por outra cobrança.
- O location referenciado por cob.loc.id apresenta tipo "cobv" (deveria ser "cob").

__Violações__ específicas para o endpoint `PUT /cob/{txid}`:
- A cobrança já existe, não está no status ATIVA, e a presente requisição busca alterá-la.

__Violações__ específicas para o endpoint `PATCH /cob/{txid}`:
- A cobrança não está ATIVA, e a presente requisição busca alterá-la.
- A cobrança está ATIVA, e a presente requisição propõe alterar
  seu status para _REMOVIDA_PELO_USUARIO_RECEBEDOR_ juntamente com outras alterações
  (não faz sentido remover uma cobrança ao mesmo tempo em que se realizam
  alterações que não serão aproveitadas).
- o campo cob.status não respeita o _schema_.

### Tag CobV

Esta seção reúne erros retornados pelos endpoints organizados sob a tag
`CobV`.

Esses erros indicam problemas no gerenciamento de uma cobrança com
vencimento.

#### `CobVNaoEncontrada`

* __Significado__: Cobrança com vencimento não encontrada para o txid
  informado.

* __HTTP Status Code__:
  [404](https://tools.ietf.org/html/rfc7231#section-6.5.4).

* __endpoints__: `[GET|PATCH] /cobv/{txid}`.

#### `CobVOperacaoInvalida`

* __Significado__: a requisição que busca alterar ou criar uma cobrança com
  vencimento

não respeita o schema ou está semanticamente errada.

* __HTTP Status Code__:
  [400](https://tools.ietf.org/html/rfc7231#section-6.5.1).

* __endpoints__: `[PUT|PATCH] /cobv/{txid}`.

__Violações__ para os endpoints `PUT|PATCH /cobv/{txid}`:
- Este `txid` está associado a um lote e no referido lote, o status desta cobrança está atribuído como
  "EM_PROCESSAMENTO" ou "NEGADA".
- O campo `cobv.calendario.dataDeVencimento` é anterior à data de criação da cobrança.
- O campo `cobv.calendario.validadeAposVencimento` é menor do que zero.
- O objeto `cobv.devedor` não respeita o schema.
- O objeto `cobv.devedor` não respeita o _schema_.
- O campo `cobv.chave` não respeita o _schema_.
- O campo `cobv.chave` corresponde a uma conta que não pertence a este usuário recebedor.
- O campo `solicitacaoPagador` não respeita o _schema_.
- O objeto `infoAdicionais` não respeita o _schema.
- O location referenciado por `cobv.loc.id` inexiste.
- O location referenciado por `cobv.loc.id` já está sendo utilizado por outra cobrança.
- O location referenciado por `cobv.loc.id` apresenta tipo "cob" (deveria ser "cobv").
- O campo `cobv.valor.original` não respeita o _schema_.
- O campo `cobv.valor.original` apresenta o valor `zero`.
- O objeto `cobv.valor.multa` não respeita o _schema_.
- O objeto `cobv.valor.juros` não respeita o _schema_.
- O objeto `cobv.valor.abatimento` não respeita o _schema_.
- O objeto `cobv.valor.desconto` não respeita o _schema_.
- O objeto `cobv.valor.abatimento` representa um valor maior ou igual ao valor da
  cobrança original ou maior ou igual a 100%.
- O objeto `cobv.valor.desconto` apresenta algum elemento de desconto que representa um valor maior ou
  igual ao valor da cobrança original ou maior ou igual a 100%.
- O objeto `cobv.valor.desconto` apresenta algum elemento cuja data seja posterior à data de vencimento
  representada por `calendario.dataDeVencimento`.
- O objeto `cobv.valor.desconto` apresenta modalidade no valor `1` ou `2`,
  porém `cobv.valor.desconto.valorPerc` encontra-se preenchido
- O objeto `cobv.valor.desconto` apresenta modalidade no valor `1` ou `2`, porém
  o array `cobv.valor.desconto.descontoDataFixa` está vazio ou nulo.
- O objeto `cobv.valor.desconto` apresenta modalidade nos valores de `3` a `6`, porém
  o elemento `cobv.valor.desconto.valorPerc` não está preenchido.
- O objeto `cobv.valor.desconto` apresenta modalidade nos valores de `3` a `6`, porém
  o elemento `cobv.valor.desconto.descontoDataFixa` está preenchido ou não nulo.

__Violações__ específicas para o endpoint `PUT /cobv/{txid}`:
- A cobrança já existe, não está ATIVA, e a presente requisição busca alterá-la

__Violações__ específicas para o endpoint `PATCH /cobv/{txid}`:
- A cobrança não está ATIVA, e a presente requisição busca alterá-la
- A cobrança está ATIVA, e a presente requisição propõe alterar
  seu status para _REMOVIDA_PELO_USUARIO_RECEBEDOR_ juntamente com outras alterações
  (não faz sentido remover uma cobrança ao mesmo tempo em que se realizam
  alterações que não serão aproveitadas).
- o campo cob.status não respeita o _schema_.

### Tag LoteCobV

Esta seção reúne erros referentes a endpoints que tratam do gerenciamento de
lotes de cobrança.

#### `LoteCobVNaoEncontrado`

* __Significado__: Lote não encontrado para o `id` informado.

* __HTTP Status Code__:
  [404](https://tools.ietf.org/html/rfc7231#section-6.5.4).

* __endpoints__: `[GET|PATCH] /lotecobv/{id}`.

#### `LoteCobVOperacaoInvalida`

* __Significado__: a requisição que busca alterar ou criar um lote de
  cobranças com vencimento

não respeita o schema ou está semanticamente errada.

* __HTTP Status Code__:
  [400](https://tools.ietf.org/html/rfc7231#section-6.5.1).

* __endpoints__: `[PUT|PATCH] /lotecobv/{id}`.

__Violações__ para os endpoints `PUT|PATCH /lotecobv/{id}`:
- O campo loteCobV.descricao não respeita o schema.
- O objeto loteCobV.cobsV não respeita o schema.

__Violações__ para o endpoint `PUT /lotecobv/{id}`:
- a presente requisição tenta criar um conjunto de cobranças dentre as quais pelo menos
  uma cobrança já encontra-se criada.
- a presente requisição busca alterar um lote já existente, entretanto contém um array de
  solicitações de alteração de cobranças que não referencia exatamente as mesmas cobranças
  referenciadas pela requisição original que criou o lote.
  Uma vez criado um lote, não se pode remover ou adicionar solicitações de
  criação ou alteração de cobranças a este lote.

__Violações__ para o endpoint `PATCH /lotecobv/{id}`:
- a presente requisição busca alterar um lote já existente e contém, no `array`
  de cobranças representado por `cobsv`, uma cobrança não existente no array de cobranças
  atribuído pela requisição original que criou o lote.
  Uma vez criado um lote, não se pode remover ou adicionar cobranças a este lote.

__Violações__ para os endpoints `GET /lotecobv/{id}`:
- __observação__: para cada elemento do array `cobsv`, retornado por este endpoint, caso a requisição de criação de cobrança esteja em
  status "NEGADA", o atributo `problema` deste elemento deve ser preenchido respeitando
  o [schema](https://tools.ietf.org/html/rfc7807) referenciado pela API Pix.
- o preenchimento do atributo `problema`, conforme descrito acima, segue o mesmo regramento dos
  erros especificados para os endpoints `[PUT/PATCH /cobv/{txid}]`, de maneira a possibilitar, ao
  usuário recebedor, entender qual foi a violação cometida ao se tentar criar
  a cobrança referenciada por este elemento do array `cobsv`.

#### `LoteCobVConsultaInvalida`

* __Significado__: os parâmetros de consulta à lista de lotes de cobrança
  com vencimento

não respeitam o schema ou não fazem sentido semanticamente.

* __HTTP Status Code__:
  [400](https://tools.ietf.org/html/rfc7231#section-6.5.1).

* __endpoints__: `GET /lotecobv` e `GET /lotecobv/{id}`.

__Violações__ específicas para o endpoint `GET /lotecobv`:
- algum dos parâmetros informados para a consulta não respeitam o _schema_.
- o _timestamp_ representado pelo parâmetro `fim` é anterior ao timestamp
  representado pelo parâmetro `inicio`.
- o parâmetro `paginacao.paginaAtual` é negativo.
- o parâmetro `paginacao.itensPorPagina` é negativo.

### Tag PayloadLocation

Esta seção reúne erros referentes a endpoints que tratam do gerenciamento de
_locations_.

#### `PayloadLocationNaoEncontrado`

* __Significado__: _Location_ não encontrada para o `id` informado.

* __HTTP Status Code__:
  [404](https://tools.ietf.org/html/rfc7231#section-6.5.4).

* __endpoints__: `[GET|PATCH] /loc/{id}`, `DELETE /loc/{id}/txid`.

#### `PayloadLocationOperacaoInvalida`

* __Significado__: a presente requisição busca criar uma location sem
  respeitar o schema estabelecido.

* __HTTP Status Code__:
  [400](https://tools.ietf.org/html/rfc7231#section-6.5.1).

* __endpoints__: `POST /loc`.

__Violações__ para o endpoint `POST /loc`:
- o campo tipoCob não respeita o _schema_.

#### `PayloadLocationConsultaInvalida`

* __Significado__: os parâmetros de consulta à lista de _locations_ não
  respeitam

o schema ou não fazem sentido semanticamente.

* __HTTP Status Code__:
  [400](https://tools.ietf.org/html/rfc7231#section-6.5.1).

* __endpoints__: `GET /loc` e `GET /loc/{id}`.

__Violações__ específicas para o endpoint `GET /loc`:
- algum dos parâmetros informados para a consulta não respeitam o _schema_.
- o _timestamp_ representado pelo parâmetro `fim` é anterior ao timestamp
  representado pelo parâmetro `inicio`.
- o parâmetro `paginacao.paginaAtual` é negativo.
- o parâmetro `paginacao.itensPorPagina` é negativo.

### Tag Pix

Reúne erros em endpoints de gestão de Pix recebidos e solicitação de
devoluções.

#### `PayloadPixNaoEncontrado`

* __Significado__: _Pix_ não encontrado para o `e2eid` informado.

* __HTTP Status Code__:
  [404](https://tools.ietf.org/html/rfc7231#section-6.5.4).

* __endpoints__: `[GET] /pix/{e2eid}`.

#### `PayloadDevolucaoNaoEncontrada`

* __Significado__: _Devolução_ não encontrada para o `e2eid` e `id` informados.

* __HTTP Status Code__:
  [404](https://tools.ietf.org/html/rfc7231#section-6.5.4).

* __endpoints__: `[GET] /pix/{e2eid}/devolucao/{id}`.

#### `PixDevolucaoInvalida`

* __Significado__: a presente requisição de devolução não respeita o schema
  ou não faz sentido semanticamente.

* __HTTP Status Code__:
  [400](https://tools.ietf.org/html/rfc7231#section-6.5.1).

* __endpoints__: `PUT /pix/{e2eid}/devolucao/{id}`.

__Violações__ específicas para o endpoint `PUT /pix/{e2eid}/devolucao/{id}`:
-	O campo devolucao.valor não respeita o schema
-	A presente requisição de devolução, em conjunto com as demais prévias devoluções, se aplicável, excederia o valor do pix originário.
-	A presente requisição de devolução apresenta um {id} já utilizado por outra requisição de devolução para o {e2eid} em questão.
-	A presente requisição de devolução viola a janela de tempo permitida para solicitações de devoluções de um pix (hoje estabelecida como 90 dias desde a data de liquidação original do pix).

## **domínios**

### Domínio de Modalidade de Agente

Domínios relacionados às modalidades de agentes.

APIs afetadas com este domínio:
* **[PUT]** /cob/{txid}
* **[PATCH]** /cob/{txid}
* **[POST]** /cob

| Descrição                               | Domínio |
|-----------------------------------------|---------|
| Agente Estabelecimento Comercial        | `AGTEC` |
| Agente Outra Espécie de Pessoa Jurídica | `AGTOT` |
| Agente Prestador de Serviço de Saque    | `AGPSS` |

### Domínio de Tipo de Cobrança

Domínios relacionados aos tipos de cobranças utilizados.

APIs afetadas com este domínio:
* **[GET]** /cob/{txid}
* **[PUT]** /cob/{txid}
* **[PATCH]** /cob/{txid}
* **[GET]** /cob
* **[POST]** /cob
* **[GET]** /cobv
* **[PUT]** /cobv/{txid}
* **[GET]** /cobv/{txid}
* **[PATCH]** /cobv/{txid}
* **[GET]** /loc
* **[POST]** /loc
* **[DELETE]** /loc
* **[GET]** /loc/{id}

| Descrição               | Domínio |
|-------------------------|---------|
| Cobrança imediata       | `cob`   |
| Cobrança com vencimento | `cobv`  |

### Domínio Natureza da Devolução Solicitada

Domínios relacionados aos tipos de naturezas das devoluções solicitadas.

APIs afetadas com este domínio:
* **[PUT]** /pix/{e2eid}/devolucao/{id}

| Descrição                                                                                                                        | Domínio           |
|----------------------------------------------------------------------------------------------------------------------------------|-------------------|
| Quando a devolução é solicitada pelo usuário recebedor e se refere a um Pix comum ou ao valor da compra em um Pix Troco (`MD06`) | `ORIGINAL`        |
| Quando a devolução é solicitada pelo usuário recebedor e se refere a um Pix Saque ou ao valor do troco em um Pix Troco (`SL02`)  | `RETIRADA`        |

### Domínio Natureza da Devolução

Domínios relacionados aos tipos de naturezas das devoluções que podem ocorrer.

APIs afetadas com este domínio:
* **[PUT]** /pix/{e2eid}/devolucao/{id}

| Descrição                                                                                                                        | Domínio           |
|----------------------------------------------------------------------------------------------------------------------------------|-------------------|
| Quando a devolução é solicitada pelo usuário recebedor e se refere a um Pix comum ou ao valor da compra em um Pix Troco (`MD06`) | `ORIGINAL`        |
| Quando a devolução é solicitada pelo usuário recebedor e se refere a um Pix Saque ou ao valor do troco em um Pix Troco (`SL02`)  | `RETIRADA`        |
| Quando a devolução ocorre no âmbito do MED por motivo de falha operacional e se refere a um Pix comum (BE08)                     | `MED_OPERACIONAL` |
| Quando a devolução ocorre no âmbito do MED por fundada suspeita de fraude e se refere a um Pix comum (FR01)                      | `MED_FRAUDE`      |

### Domínio Status da Devolução

Domínios relacionados aos status das devoluções.

APIs afetadas com este domínio:
* **[PUT]** /pix/{e2eid}/devolucao/{id}
* **[GET]** /pix/{e2eid}/devolucao/{id}

| Descrição                  | Domínio            |
|----------------------------|--------------------|
| Devolução em processamento | `EM_PROCESSAMENTO` |
| Devolução realizada        | `DEVOLVIDO`        |
| Devolução não realizada    | `NAO_REALIZADO `   |

### Domínio Status da Solicitação de Criação/Alteração da Cobrança (Criação via Lote)

Domínios relacionados aos status de solicitações de criação e alteração de cobranças.

APIs afetadas com este domínio:
* **[GET]** /lotecobv/{id}
* **[GET]** /lotecobv

| Descrição                                        | Domínio            |
|--------------------------------------------------|--------------------|
| Lote de QR Codes com vencimento em processamento | `EM_PROCESSAMENTO` |
| Lote de QR Codes com vencimento criado           | `CRIADA`           |
| Lote de QR Codes com vencimento não aceito       | `NEGADA `          |

### Domínio Status da Cobrança

Domínios relacionados aos status das cobranças.

APIs afetadas com este domínio:
* **[PUT]** /cob/{txid}
* **[GET]** /cob/{txid}
* **[PATCH]** /cob/{txid}
* **[POST]** /cob
* **[GET]** /cob
* **[GET]** /cobv
* **[GET]** /cobv/{txid}
* **[PUT]** /cobv/{txid}
* **[PATCH]** /cobv/{txid}

| Descrição                                                                                                         | Domínio                           |
|-------------------------------------------------------------------------------------------------------------------|-----------------------------------|
| Indica que o registro se refere a um QR Code que foi gerado mas ainda não foi pago nem removido                   | `ATIVA`                           |
| Indica que o registro se refere a um QR Code que já foi pago e, por conseguinte, não pode acolher outro pagamento | `CONCLUIDA`                       |
| Indica que o usuário recebedor solicitou a remoção do registro do QR Code                                         | `REMOVIDO_PELO_USUARIO_RECEBEDOR` |
| Indica que o PSP Recebedor solicitou a remoção do registro do QR Code                                             | `REMOVIDO_PELO_PSP`               |

### Domínio multa

Domínios relacionados à multa.

APIs afetadas com este domínio:
* **[PUT]** /cobv/{txid}
* **[PATCH]** /cobv/{txid}
* **[GET]** /cobv/{txid}
* **[GET]** /cobv
* **[PUT]** /lotecobv/{id}
* **[PATCH]** /lotecobv/{id}

| Descrição  | Domínio |
|------------|---------|
| Valor Fixo | `1`     |
| Percentual | `2`     |

### Domínio desconto

Domínios relacionados ao desconto.

APIs afetadas com este domínio:
* **[PUT]** /cobv/{txid}
* **[PATCH]** /cobv/{txid}
* **[GET]** /cobv/{txid}
* **[GET]** /cobv
* **[PUT]** /lotecobv/{id}
* **[PATCH]** /lotecobv/{id}

| Descrição                                | Domínio | Descrição                              | Domínio |
|------------------------------------------|---------|----------------------------------------|---------|
| Valor Fixo até a(s) data(s) informada(s) | `1`     | Valor por antecipação dia útil         | `4`     |
| Percentual até a data informada          | `2`     | Percentual por antecipação dia corrido | `5`     |
| Valor por antecipação dia corrido        | `3`     | Percentual por antecipação dia útil    | `6`     |

### Domínio juros

Domínios relacionados aos juros.

APIs afetadas com este domínio:
* **[PUT]** /cobv/{txid}
* **[PATCH]** /cobv/{txid}
* **[GET]** /cobv/{txid}
* **[GET]** /cobv
* **[PUT]** /lotecobv/{id}
* **[PATCH]** /lotecobv/{id}

| Descrição                         | Domínio | Descrição                      | Domínio |
|-----------------------------------|---------|--------------------------------|---------|
| Valor (dias corridos)             | `1`     | Valor (dias úteis)             | `5`     |
| Percentual ao dia (dias corridos) | `2`     | Percentual ao dia (dias úteis) | `6`     |
| Percentual ao mês (dias corridos) | `3`     | Percentual ao mês (dias úteis) | `7`     |
| Percentual ao ano (dias corridos) | `4`     | Percentual ao ano (dias úteis) | `8`     |

### Domínio abatimento

Domínios relacionados ao abatimento.

APIs afetadas com este domínio:
* **[PUT]** /cobv/{txid}
* **[PATCH]** /cobv/{txid}
* **[GET]** /cobv/{txid}
* **[GET]** /cobv

| Descrição  | Domínio |
|------------|---------|
| Valor Fixo | `1`     |
| Percentual | `2`     |

## **histórico de versões**

### V2.6.4

* Inclusão de orientações na seção restrições de uso
* Inclusão detalhamento da funcionalidade Webhook Exclusivo
* Esclarecimento do envio dos campos 'componentesValor' e 'devolucao' no payload do webhook

### V2.6.3

* Ajuste na url da tabela `Endpoints` no campo `Sandbox` de "https://devportal.itau.com.br/sandboxapi/pix_recebimentos_conciliacoes_v2_ext/v2/" para "https://devportal.itau.com.br/sandboxapi/pix_recebimentos_ext_v2/v2".

### V2.6.2

* Inclusão do valor `AGTOT` no domínio do campo valor.retirada.troco.modalidadeAgente;
* Ajuste da descrição do valor domínio `AGTOT` de 'Agente Outra Espécie de Pessoa Jurídica' para 'Agente Outra Espécie de Pessoa Jurídica ou Correspondente no País';
* Substituição da expressão 'Prestador de Serviços de Saque' por 'Facilitador de Serviço de Saque' em linha com a nova instrução normativa.

### V2.6.1
* Restrição da modalidadeAgente do Pix Troco para aceitar somente `AGTEC`;
* Ajustes nos endpoints de Devolução para os diferentes tipos de natureza relacionados aos códigos `BE08` e `FR01`;
* Indicação tamanho máximo do campo `pixCopiaECola`.

### V2.6.0
* Inclusão e referenciamento de "Status do registro de cobrança" onde lia-se "Status da Cobrança" com a descrição da semântica de cada estado;
* Inclusão do campo `pixCopiaECola` (opcional) correspondente às cobranças;
* Na listagem `componentesValor` do objeto `Pix` foram incluídas as informações relativas aos juros, multas, descontos e abatimentos quando o Pix se refere a um pagamento de cobrança com vencimento. Tendo assim o detalhamento em caso de antecipações ou atrasos no pagamento;
* Inclusão do campo `descricao` nos objetos que tratam de Devoluções;
* Ajuste na descrição do campo `natureza` nas Devoluções.

### V2.5.0
* Inclusão do atributo `retirada` como campo opcional do objeto `valor` nos endpoints de consulta, criação e revisão da cobrança imediata. O campo pode ser preenchido com os atributos `saque` ou `troco` exclusivamente, detalhados pelos atributos `valor` e `modalidadeAlteracao`. Se apresentarem o campo `modalidadeAlteracao` como valor 1, significa que o usuário pagador pode alterar o valor do saque ou troco;
* Em sua ausência, assume-se o valor 0, que significa que o valor do saque ou troco não pode ser alterado;
* Inclusão do atributo `componentesValor` como campo opcional nos endpoints de consulta Pix para informações da composição do valor final do Pix, este será detalhado por um array de objetos compostos por `tipo` e `valor`;
* Formatações gerais de referências a campos, objetos e schemas;
* Inclusão do domínio `natureza` nas devoluções para diferenciamento de devoluções de Pix comuns, ou oriundos de Saque/Troco;
* Referências a https://www.bcb.gov.br/estabilidadefinanceira/pagamentosinstantaneos trocadas por https://www.bcb.gov.br/estabilidadefinanceira/pix.

### V2.4.0
* Inclusão do atributo `retirada` como campo opcional do objeto `valor` nos endpoints de consulta, criação e revisão da cobrança imediata. O campo pode ser preenchido com os atributos `saque` ou `troco` exclusivamente, detalhados pelos atributos valor e modalidadeAlteracao. Se apresentarem o campo modalidadeAlteracao como valor 1, significa que o usuário pagador pode alterar o valor do saque ou troco. Em sua ausência, assume-se o valor 0, que significa que o valor do saque ou troco não pode ser alterado;
* Inclusão do atributo `componentesValor` como campo opcional nos endpoints de consulta Pix para informações da composição do valor final do Pix, este será detalhado por um array de objetos compostos por `tipo` e `valor`;
* Formatações gerais de referências a campos, objetos e schemas.

### V2.3.0

* Inserido o campo `modalidadeAlteracao`. É um campo opcional do objeto `valor` no paylod da cobrança imediata e nos endpoints de criação e revisão da cobrança imediata. Se apresentado como valor 1, significa que o usuário pagador pode alterar o valor da cobrança. Em sua ausência, assume-se o valor 0, que significa que a cobrança não pode ser alterada;
* Aprimora a descrição do webhook detalhando que a devolução não é enviada, pois no Itau essa funcionalidade é síncrona;
* Adiciona dois cenários de erro para o endpoint PUT `/pix/{e2eid}/devolucao/{id}` na seção de tratamentos de erros;
* Aprimora a descrição do campo "motivo" de devolução;
* Corrige "case" do padrão de datas de `yyyy-mm-dd` -> `YYYY-MM-DD`.

### V2.2.2

* O campo `validadeAposVencimento` estava constando como opcional, na resposta da criação da cobrança, um efeito colateral da correção correlata ocorrida na release 2.2.1.

### V2.2.1

**Corrigido:**

* Os campos no objeto "devedor" no request do endpoint `PUT /cobv/{txid}` passam a ser opcionais. Nem sempre o usuário recebedor tem a posse de todas as informações que constavam como obrigatórias;
* O campo `validadeAposVencimento` estava constando como `required`, o que estava incorreto.  Quando não preenchido, o PSP recebedor assume o valor deste campo como 30, então não há motivos para o campo ser obrigatório;
* A regex do txid, na parte concernente ao tamanho, nos endpoints /pix e no callback webhook, estava errada. Corrigida de `{26,35}` para `{1,35}` porque pode haver a presença de pagamentos de QRs estáticos nesses locais;
* Com a entrada do campo "chave" como identificador do webhook, toda a parte referente à paginação em GET /webhook perde a razão de existir. Nesse sentido, os parâmetros de busca "inicio" e "fim" passam a ser opcionais. O objeto de paginação "parametros", também torna-se opcional;
* Conforme relatado nesta discussão, entendemos que seria interessante, tanto sob o aspecto de segurança quanto sob o aspecto de funcionalidade, que o objeto pix agregue o atributo "chave", opcional.

### V2.2.0

**Novidades**
- A cobrança agora suporta o conceito de "Vencimento", juntamente com as funcionalidades correlatas: juros, multa, descontos, abatimentos e afins;
- O formato do txid foi revisado: o tamanho do txid do estático é diferente do tamanho do txid dinâmico;
- A API agora apresenta Endpoints para gerenciamento de Cobranças com Vencimento;
- Cobranças com vencimento dispõem de seu próprio endpoint;
- A API agora apresenta Endpoints para gerenciamento de Lotes de Cobranças com Vencimento;
- Adicionado um endpoint para criação de cobrança imediata com txid criado pelo PSP recebedor;
- Adicionados Endpoints para o gerenciamento de Locations, habilitando o caso de uso "Reuso de Locations";
- Adicionado campo para descrição complementar do status da devolucão;
- A API Pix agora estabelece uma série de erros padronizados seguindo a RFC 7807 reunidos na seção "Tratamento de erros". Procuramos ser exaustivos com relação aos possíveis erros semânticos;
- Adicionado o endpoint PATCH /lotecobv/{id}. Este endpoint pode ser utilizado quando a intenção do usuário recebedor for alterar cobranças específicas dentro do conjunto de cobranças criadas no lote em questão. O endpoint PUT /lotecobv/{id} também pode ser utilizado para alterar cobranças, mas deve ser atribuído na requisição o array exatamente como especificado na requisição originária, o que torna este endpoint ineficiente no caso em que quer se alterar uma cobrança específica ou poucas dentro de um array com grande quantidade de cobranças.

**Correções**

- removido txid opcional no response do endpoint POST /loc;
- removido o objeto opcional pix.pagador;
- os webhooks agora são associados a uma chave pix.
