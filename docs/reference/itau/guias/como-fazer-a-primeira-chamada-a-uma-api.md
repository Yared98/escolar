# Como fazer sua primeira chamada a uma API

Fonte: https://devportal.itau.com.br/como-fazer-a-primeira-chamada-a-uma-api

Como fazer sua primeira chamada a uma API

Use este guia para validar sua configuração realizando a primeira chamada a uma API do Itaú em ambiente de produção.



Esta etapa deve ser realizada após a geração das credenciais e a emissão do certificado dinâmico.

    O fluxo apresentado nesta documentação é aplicável às APIs que utilizam:

      - OAuth 2.0 Client Credentials

      - mTLS (Mutual TLS)

    Antes de começar

    Confirme que sua aplicação possui:

      - Client ID de produção ativo.

      - Certificado dinâmico válido.

      - Chave privada correspondente ao certificado.

      - Arquivos .crt e .key configurados na ferramenta utilizada para testes.

      - URL da API que será consumida.

      - URL do serviço de autenticação OAuth do Itaú.

      -
        Adequação à cadeia de certificados (Certificate Authority - CA) utilizada pelo Itaú.

      -
        Endereços de conexão (DNS e IPs) configurados e liberados na sua infraestrutura.

    Como funciona

    A primeira chamada a uma API do Itaú é composta por duas etapas:

      - Gerar o access token.

      - Consumir a API utilizando o token e o certificado dinâmico.

    Etapa 1: Gerar o access token

    Antes de consumir uma API, sua aplicação precisa obter um access token junto ao serviço de autenticação do Itaú.

    O access token será utilizado para autorizar as chamadas à API.

    Para gerar o token, siga as instruções da documentação em testar o certificado.

    Etapa 2: Realizar a chamada à API

    Com o access token disponível, sua aplicação já pode consumir as APIs do Itaú.

    Requisitos da chamada

      - Conexão protegida com mTLS.

      - Header de autorização contendo o access token obtido anteriormente.

    Monte sua requisição

    Utilize a ferramenta de sua preferência, como Postman, Insomnia ou outra solução compatível.

    Antes de enviar a chamada:

      - Configure o access token obtido na etapa anterior.

      - Configure o certificado dinâmico e a chave privada.

      - Informe a URL da API que será consumida.

      - Execute a requisição e valide a resposta recebida.

    Exemplo conceitual

      http
      GET https://api.itau.com.br/{api}/{versao}/{recurso}

      Authorization: Bearer {access_token}

      Content-Type: application/json

    Se a autenticação e o endpoint estiverem configurados corretamente, a API retornará uma resposta de sucesso, como:

      http
      HTTP 200 OK

    Se a chamada foi concluída com sucesso, sua aplicação já está apta a consumir as APIs do Itaú utilizando o modelo de autenticação configurado.

       Boas práticas para o uso de credenciais

    Nesta página

      Antes de começar
      Como funciona
      Etapa 1: Gerar o access token

          Etapa 2: Realizar a chamada

        Requisitos da chamada
        Monte sua requisição
        Exemplo conceitual

    Jornada de integração

      Como se conectar às APIs do Itaú
      Pré-requisitos
      Obter credenciais e certificado dinâmico
      Boas práticas para o uso de credenciais
      Como fazer sua primeira chamada a uma API

max-w-7xl-xl primeiros-passos md:font-text leading-normal m-auto pt-8 pb-12
