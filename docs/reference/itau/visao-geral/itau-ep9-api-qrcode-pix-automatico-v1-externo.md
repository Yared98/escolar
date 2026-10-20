# API - Emissão de QR Code Pix Automático (v1.28.10)

Fonte: https://devportal.itau.com.br/nossas-apis/itau-ep9-api-qrcode-pix-automatico-v1-externo (aba visão geral, atualizada em 2026-05-21T01:21:34.000Z)
Sandbox: https://sandbox.devportal.itau.com.br/itau-ep9-api-qrcode-pix-automatico-v1-externo/v1
Spec: ../openapi/itau-ep9-api-qrcode-pix-automatico-v1-externo.json

---



## **sobre a API**

**API disponível à partir de 16/jun/2025**<br><br>
A API de PIX Automático  do Itaú para uma melhor gestão de recebimentos por parte do cliente recebedor.

Jornada geração de qrcode pix API responsável por realizar a emissão de um QR Code PIX.

QR Code imediato (disponível apenas para participantes indiretos) Um QR Code imediato tem como principais características o pagamento único e o tempo de expiração. É uma forma de recebimento que facilita a conciliação do cliente recebedor, podendo ser realizada através do identificador do QR Code (txid). Além disso, permite a inserção de valor e de dados do cliente pagador de forma opcional.

Como funcionalidade adicional, essas APIs podem ser utilizadas para QR Codes de Saque e Troco Pix. Este produto, permite que seja realizado um saque em espécie através do pagamento de um QR Code do Pix. Caso a operação seja apenas para sacar valores em espécie, sem nenhuma compra de produto ou pagamento de um serviço atrelado, denomina-se essa operação de Saque Pix. Caso essa retirada de valor em espécie esteja atrelada a uma compra de produto ou pagamento de um serviço, denomina-se essa operação de Troco Pix.

## **para quem é esta API?**

Para empresas do segmento Atacado que são uma instituição de pagamento, financeira ou fintech e desejam se conectar ao ecossistema do PIX tendo o Itaú como participante direto do arranjo. As APIs exclusivas de recebimentos Pix são funcionalidades exclusivas do Itaú para uma melhor gestão de recebimentos por parte do cliente recebedor.

## **restrições de uso**
Para utilizar a API o parceiro precisa estar habilitado no Portal Itaú for Developers e ter o certificado dinâmico ativado. 

## **conhecimentos técnicos necessários**
Conhecimentos prévios necessários:

`HTTP` `JSON` `Postman`

## **quais necessidades que essa API ajuda a resolver?**
Com a unificação do serviço de consignado desde a simulação até o cadastro da proposta, o Hub de Serviços traz uma inovação digital, resolvendo problemas complexos na jornada de empréstimo consignado através das seguintes soluções:
- Diminuição do tempo de integração da API com a aplicação do parceiro;
- Redução do tempo da jornada de solicitação de empréstimo consignado;
- Aumento na conversão de aceite de propostas.

## **regras de negócio** 
- Para a simulação, é obrigatório cadastrar pelo menos um número de celular; 
- A proposta só pode ser cadastrada para uma simulação que foi criada no mesmo dia;
- A proposta só pode ser cancelada se tiver o status "CADASTRADA", "FORMALIZADA" ou "AVERBADA".

## **tempo aproximado para integração**
**2 dias:** essa é a média de tempo que um desenvolvedor pode levar para preparar toda a integração com essa API. Isso pode variar de acordo com o tamanho do time e experiência dos desenvolvedores envolvidos.
Média de tempo que um desenvolvedor pode levar para preparar toda a integração com essa API.

### **URLs**

**API disponível à partir de 16/jun/2025**<br><br>
Para garantir uma integração segura, as funcionalidades da API estão disponíveis nas seguintes URLs:

| ambiente    | endpoint                                                            |
| ---------   | ------------------------------------------------------------------- |                    
| produção    | https://recebimentos-pix.api.itau.com/qrcode-pix-automatico/v1       |

## **padrões de erros**

Essa API retorna códigos de status HTTP para indicar sucesso ou falhas das requisições.

Códigos **2xx** indicam sucesso.

Códigos **4xx** indicam falhas causadas pelas informações enviadas pelo cliente ou pelo estado atual das entidades.

Códigos **5xx** indicam problemas no serviço no lado da API.

As respostas de erro incluem no corpo detalhes do erro e o campo type identifica o tipo de erro.

Abaixo estão listados os tipos de erro que podem ser retornados por quaisquer endpoints listados nessa documentação.

| HTTP Status Code | Descrição | Significado
| -------- | -------- | -------- |
| 400 Bad Request  | Bad Request | Requisição contém dados inválidos
| 404 Not Found    | Not Found   | Recurso não encontrado
| 500 Internal Server Error | Internal Server Error | Erro interno no servidor

