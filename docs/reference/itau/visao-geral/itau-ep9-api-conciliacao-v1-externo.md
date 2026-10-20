# Recebimentos Pix- API's Exclusivas (v1.20.7)

Fonte: https://devportal.itau.com.br/nossas-apis/itau-ep9-api-conciliacao-v1-externo (aba visão geral, atualizada em 2026-08-18T01:24:36.000Z)
Sandbox: https://sandbox.devportal.itau.com.br/itau-ep9-api-conciliacao-v1-externo/v1
Spec: ../openapi/itau-ep9-api-conciliacao-v1-externo.json

---



## **sobre a API**

Importante! Em breve as API’s no modelo antigo serão desativadas. Se programe para realizar a atualização de endpoints. Na aba “API Reference” poderá consultas as novas rotas.
Atualmente, expomos nossas APIs por meio de duas rotas principais:
· Modelo antigo: https://secure.api.itau/...
· Modelo novo: https://pix-pj.itau.com/...

- Configuração de Certificados das APIs
  Para consumir as APIs PIX do Itaú, é necessário configurar no certificado digital correspondente à rota utilizada.
  Na maioria dos casos, essa confiança é gerenciada automaticamente por sistemas operacionais, servidores e linguagens de programação. Contudo, em
  alguns cenários, pode ser necessário adicionar manualmente o certificado raiz ao ambiente de desenvolvimento ou ao servidor, garantindo o funcionamento adequado das conexões SSL/TLS.

· Modelo Antigo — secure.api.itau
Caso você esteja consumindo APIs que utilizam a rota secure.api.itau, se programe para atualizar os enpoints e a nova CA.
No modelo antigo o certificado raiz utilizado é da GlobalSign. Essa rota utiliza a autoridade certificadora (CA) “GlobalSign Extended Validation CA – SHA256 – G3”. O certificado raiz correspondente é o “GlobalSign Root R3”, disponível em: https://support.globalsign.com/ca-certificates/globalsign-root-certificates

· Modelo Novo — pix-pj.itau.com
Caso você esteja consumindo APIs que utilizam a rota pix-pj.itau.com ou realizando as atualizações de enpoitns e CA, pode ser necessário confiar manualmente no certificado raiz da Amazon.
Essa rota utiliza a CA “Amazon RSA 2048 M04”. O certificado raiz correspondente é o “Amazon Root CA 1”, disponível em: https://www.amazontrust.com/repository/AmazonRootCA1.pem

As APIs exclusivas de conciliação Pix são funcionalidades exclusivas do Itaú para uma melhor gestão de recebimentos por parte do cliente recebedor. Nessa página você encontrará funcionalidades disponíveis tanto para clientes quanto para participantes indiretos do Pix. Abaixo, listamos as principais funções disponíveis e para quem se destinam:

* **Clientes diretos e indiretos:**
  * **Consultas complementares:**
    * Listagem de recebimentos e pagamentos via QR Code ou Transferências Pix;
    * Detalhamento de recebimentos e pagamentos via QR Code ou Transferências Pix.

* **Parceiros:**
  * Webhook de consentimento.

* **Consultas complementares (disponível para clientes e participantes indiretos)**

As consultas complementares permitem ao cliente realizar a conciliação tanto dos seus recebimentos quanto dos seus pagamentos, sejam eles através de QR Codes ou de transferências Pix.
Essas consultas podem ser realizadas individualmente, ou seja, consulta de um Pix específico ou através de uma lista, consultando, vários Pix de uma só vez.

* **Webhook para parceiros Pix (disponível apenas para parceiros)**

O webhook de parceiros é uma solução que busca automatizar o processo de compartilhamento de credenciais do cliente recebedor para um parceiro homologado do Itaú para utilização do QR Code do Pix.

Para que o webhook funcione, é necessário que o cliente desenvolva uma API de callback através de uma URL exposta na web que possua uma camada de autenticação mTLS (HTTPS).

Com essa integração, o parceiro estará apto a receber automaticamente as credenciais do cliente quando o cliente recebedor realizar o consentimento diretamente nos canais digitais do Itaú.

## **para quem é esta API?**

**Consultas complementares (disponível para clientes e participantes indiretos)**

As APIs de conciliação ou consultas de QR Codes e transferências são recomendadas para todos os clientes que recebem através do Pix, seja por QR Code ou transferência, que possuem a necessidade de conciliar seus recebimentos.

**Webhook para parceiros Pix (disponível apenas para parceiros)**

O webhook de parceiros é uma solução que busca automatizar o processo de compartilhamento de credenciais do cliente recebedor para um parceiro homologado do Itaú para utilização do QR Code do Pix.

Os principais casos de uso atualmente são:

* Automações comerciais;
* TEF Houses;
* Software houses;
* Gateways e plataformas de e-commerce.

## **restrições de uso**

Para utilização de todas as APIs, é necessário estar habilitado no Portal Itaú for Developers e possuir um certificado dinâmico ativado.

Para utilização do webhook é necessário possuir um certificado mTLS e uma API Call Back.

## **conhecimentos técnicos necessários**
Conhecimentos prévios necessários:

`Construção de APIs REST escaláveis` `Comunicações assíncronas e síncronas` `Padrões de autenticação`

`Padrões de segurança`

**Tecnologias**

`API REST/Restful` `HTTP/HTTPS` `JSON` `Insomnia` `mTls`

`OAUTH2` `HTTP` `JSON`

## **quais necessidades que essa API ajuda a resolver?**

Com as **APIs de consulta complementares** auxiliam o cliente recebedor no processo de conciliação financeira de suas operações, possibilitando a consulta de um QR Code individual ou uma lista de QR Codes.

Com as **APIs do webhook** o parceiro pode cadastrar uma URL (API Call Back) para automatizar o processo de recebimento de credenciais do cliente recebedor para utilização do QR Code do Pix.

## **regras de negócio**

- Para realizar a consulta de lancamentos lista é necessário informar o idConta e dataLancamento;
- Para realizar a consulta do lancamentos detalhe é necessário informar o lancamentosPixId; 

## **tempo aproximado para integração**
**5 dias:** essa é a média de tempo que um desenvolvedor pode levar para preparar toda a integração com essa API. Isso pode variar de acordo com o tamanho do time e experiência dos desenvolvedores envolvidos.

## **endpoints**
Nosso objetivo é deixar claro tudo que você precisa fazer para integrar às APIs. Para isso, todas as informações e exemplos necessários estão reunidos aqui, assim como as regras necessárias.

Os exemplos de response de erros são demonstrados no tópico padrões de erros ao final desta page. Cada endpoint traz uma tabela especificando quais desses retornos aquele serviço retorna. Então, caso haja variação no json retornado, este será demonstrado na explicação do próprio endpoint, se não, deve ser visualizado no tópico citado.

## [GET] /lancamentos-pix
API responsável por listar todos os pagamentos e devoluções Pix (débitos e créditos) dos últimos 6 meses, contemplando tanto transferências quanto QR Code. As consultas são limitadas a 200.000 registros. Caso uma chamada tenha um retorno acima desse número, será necessário diminuir o range de datas da pesquisa ou utilizar os filtros disponíveis. Além disso, recomenda-se a utilização do filtro de "dataCriacaoLancamento" ao invés do campo "dataLancamento".

Entrada

| Parâmetro	| Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| --------- | -------------- | --------- | ----------- | --------- |
|`idConta`|query|string|sim|Chave constituida por ispb (8 digitos) + agencia (4 dígitos) + conta (13 dígitos) da conta corrente do cliente, com 25 dígitos. Sem o DAC.|
|`dataCriacaoLancamento`|query|string|não|Range de datas de pagamento/devolução dos pixs, no formato "2024-05-01T16:00,2024-06-01T08:00", limite de 6 meses a partir da data de consulta.|
|`dataLancamento`|query|string|não|Range de datas de pagamento/devolução dos pixs, no formato "2024-05-01T16:00,2024-06-01T08:00", limite de 6 meses a partir da data de consulta.|
|`txid`|query|string|não|id de transação do documento, utilizado para a sua identificação no banco central.|
|`e2eid`|query|string|não|id end to end de um pagamento instantaneo, utilizado para a sua identificação no banco central.|
|`visao`|query|string|não|Declara se a consulta deve retornar os pix pela visão emissor (os que eu emiti e forma pagos/devolvidos) ou visão pagador (os que eu paguei/ recebi devolução). Caso não informado, vem as duas visões.|
|`tipoLancamento`|query|string|não|Declara se a consulta deve retornar pagamentos ou devoluções, ou ambos se não informado.|
|`tipoOperacao`|query|string|não|Tipo da operação transacional que está sendo realizada.|
|`tipo`|query|string|não|Tipo do lançamento do Pix, podendo ser estático, dinâmico ou transferência pix.|
|`idDocumento`|query|string|não|Identificador do documento de cobrança PIX na plataforma de cash management.|
|`valorDocumentoPagadorEfetivo`|query|string|não|CNPJ/CPF do pagador efetivo.|
|`documento`|query|string|não|CNPJ do recebedor.|
|`chaves`|query|string|não|Lista de chaves de endereçamento do recebedor, utilizada na emissão de um PIX. Inserir no formato 'chave1,chave2'.|
|`devolvido`|query|string|não|Indica se um determinado pagamento foi devolvido (parcial ou total) ou não devolvido.|
|`view`|query|string|não|Definição a visão que irá permitir o mecanismo de agrupar dados de saída de um determinado recurso.  -- basico: retorna somente os atributos básicos do recurso  -- completo: retorna todos os atributos do recurso.|
|`subTipoPix`|query|string|não|Subtipo do QR Code.|
|`subCategoria`|query|string|não|Subcategoria do QR Code para filtrar saque, troco, bolecode e qrcode estático cadastral.|
|`canalOperacao`|query|string|não|Canal utilizado para emitir o QR Code.|
|`operacaoCredito`|query|string|não|Indica se determinado QR Code foi utilizado como garantia de uma operação de crédito ou antecipado.|
|`orderBy`|query|string|não|Opção para ordenação.|
|`order`|query|string|não|Opção de ordenação ascendente ou descendente.|
|`page`|query|integer|não|Definir um número de página para obter informações desta coleção. Multiplicado ao parametro page_size, não deverá exceder 200.000.|
|`pageSize`|query|integer|não|Limitar o número de elementos por página. Multiplicado ao parametro page, não deverá exceder 200.000.|
|`x-itau-apikey`|header|string|não|Chave da API utilizado para autorizar o consumo de uma aplicação requisitante.|
|`x-itau-correlationID`|header|string|não|Identificador de correlação que serve como um agrupar dentro da estrutura de audit trail.|

## [GET] /lancamentos-pix/{lancamentoPixId}
API responsável por retornar o detalhe de um único lançamento (crédito ou débito) do Pix de acordo com o identificador do lançamento selecionado. Para recuperar o "lancamentoPixId" será necessário consultar a Lista de Lançamentos PIX.

Entrada

| Parâmetro	| Tipo Parâmetro | Tipo Dado | Obrigatório | Descrição |
| --------- | -------------- | --------- | ----------- | --------- |
|`lancamentoPixId`|path|string|sim|ID do lancamento pix.|

## Notificação de novo consentimento (POST)

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

### **URLs**

Para garantir uma integração segura, as funcionalidades da API estão disponíveis nas seguintes URLs:

| ambiente    | endpoint                                                      |
| ---------   | ------------------------------------------------------------- |                    
| sandbox     | https://sandbox.devportal.hom.itau.com.br/itau-ep9-api-conciliacao-v1-externo/v1 |
| produção    | https://recebimentos-pix.api.itau.com/conciliacao/v1 |

## **padrões de erros**

Essa API retorna códigos de status HTTP para indicar sucesso ou falhas das requisições.

Códigos **2xx** indicam sucesso.

Códigos **4xx** indicam falhas causadas pelas informações enviadas pelo cliente ou pelo estado atual das entidades.

Códigos **5xx** indicam problemas no serviço no lado da API.

As respostas de erro incluem no corpo detalhes do erro e o campo type identifica o tipo de erro.

Abaixo estão listados os tipos de erro que podem ser retornados por quaisquer endpoints listados nessa documentação.

| HTTP Status Code | Descrição  | Significado| Como proceder|
|------------------| -----------|------------|------------|                     
| `400` Bad Request  | RequisicaoInvalida | Requisição inválida | -
| `401` Unauthorized | - | Não autorizado. | Verifique se os parâmetros de acesso estão válidos (certificado, expiração de token, configuração da credencial, secret ou JWT). Se o problema persistir, entre em contato com o suporte Itaú. |
| `403` Forbidden  | AcessoNegado | Requisição de participante autenticado que viola alguma regra de autorização | Verifique se os parâmetros de acesso estão válidos (certificado, expiração de token, configuração da credencial, secret ou JWT). Se o problema persistir, entre em contato com o suporte Itaú.| 
| `404` Not Found	  | NaoEncontrado | Entidade não encontrada | - |
| `410` Gone | PermanentementeRemovido | Indica que a entidade existia, mas foi permanentemente removida | - | 
| `500` Internal Server Error | ErroInternoDoServidor | condição inesperada ao processar requisição | Entre em contato com o suporte Itaú. |
| `503` Service Unavailable | ServicoIndisponivel | Serviço não está disponível no momento. |  Serviço solicitado pode estar em manutenção ou fora da janela de funcionamento |
| `504` Gateway Timeout | IndisponibilidadePorTempoEsgotado | indica que o serviço demorou além do esperado para retornar | - |

