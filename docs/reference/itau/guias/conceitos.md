# Glossário de integração com as APIs Itaú

Fonte: https://devportal.itau.com.br/conceitos

Glossário de integração com as APIs Itaú

Guia de conceitos e glossário



Este glossário reúne os principais conceitos e termos que você encontra ao se conectar às APIs do Itaú — de certificado e chaves a tokens e siglas de protocolo. Use como referência rápida sempre que precisar.

        Antes de começar

        Se você ainda não iniciou a integração, comece pelo guia da jornada e volte a este glossário sempre que encontrar um termo novo.

          Como se conectar às APIs do Itaú

    Conceitos principais

    O que é o certificado dinâmico (CSR)?

    O Certificate Signing Request (CSR) é um certificado não assinado, usado apenas no ambiente de produção. Ele é gerado pelo responsável técnico e contém os dados da empresa solicitante e a sua chave pública.

    Com o CSR, ao solicitar um certificado ao Itaú, você identifica a sua aplicação e recebe um certificado de uso único e exclusivo.

    O CSR é o arquivo que contém a chave pública do certificado e as demais informações de identificação. Você usa ele para pedir ao STS Itaú a assinatura do certificado.

    O formato segue este padrão:

      -----BEGIN CERTIFICATE REQUEST-----

      ...

      -----END CERTIFICATE REQUEST-----

    A segurança do processo é baseada no conceito de chave assimétrica (ou chave pública).

        Importante

          -
            Para renovar ou gerar o certificado dentro da validade de 365 dias: use o arquivo .CSR gerado antes e o token temporário gerado pela sua aplicação, válido por 5 minutos.

          -
            Depois dos 365 dias de validade: solicite um novo token temporário ao seu ponto focal do Itaú. Nesse cenário, o token vale 7 dias corridos.

    O que é a chave pública?

    A chave pública é um valor gerado a partir de operações matemáticas com a chave privada. Como o nome sugere, pode ser de conhecimento público e não precisa ser guardada de forma confidencial. O valor dela fica embutido no próprio certificado.

    O que é a chave privada?

    A chave privada é um valor altamente sensível, então guarde com segurança. Ela é usada para comprovar que o certificado está em uso pelo dono no processo de mutual TLS (mTLS).

    O formato segue este padrão:

      -----BEGIN PRIVATE KEY-----

      ...

      -----END PRIVATE KEY-----

        Lembre-se: a chave privada é equivalente a uma senha. Não compartilhe, não envie por e-mail e não deixe exposta em código-fonte.

    O que é SSL?

    O SSL (Secure Sockets Layer) garante segurança na comunicação entre cliente e servidor, preservando a integridade e a veracidade do conteúdo que trafega na rede, com autenticação das partes envolvidas. A versão recomendada pelo banco é a 1.1.1c ou superior.

    O que são credenciais?

    As credenciais são o conjunto client_id + client_secret.

    O que é o token temporário?

    O token é um valor obtido no STS Itaú que representa a autenticação da credencial. Ele é obrigatório para consumir as APIs do Itaú, junto com o certificado.

    Como obter um token temporário?

    Depende da etapa da jornada em que você está: onboarding ou consumo.

         |

             | Etapa
             | Quando acontece
             | Como obter o token
             | Validade

             |
              Onboarding

             | Você está começando o contato com o Itaú e ainda não tem credenciais nem certificado.
             | Você recebe o token temporário por e-mail, só para emitir as suas credenciais e o certificado.
             | 7 dias corridos

             |
              Consumo

             | Você já tem as credenciais e o certificado emitidos pelo STS Itaú.
             | Você faz uma requisição ao STS Itaú.
             | 5 minutos

        Importante

          -
            Onboarding: o token vale 7 dias para iniciar o fluxo de geração do certificado, contados a partir da emissão. Se não usar nesse período, solicite de novo e aguarde o tempo de resposta, de 1 dia útil.

          -
            Consumo: o token emitido pelo STS Itaú dura 5 minutos e precisa ser usado nesse período. Renove sempre que estiver perto de expirar.

    Glossário de termos (A–Z)

    Definições rápidas dos termos mais usados na integração com as APIs do Itaú.

         |

             | Termo
             | Definição

             |
              access token

             | É um JWT que contém informações de uma autenticação. Ele é validado a cada chamada de API para identificar quem se autenticou e se tem permissão para o recurso solicitado.

             |
              arquivo .CRT (Certificate File)

             | No mesmo formato do .KEY e do .CSR, é o certificado que, no nosso contexto, contém as informações e assinaturas das duas partes envolvidas: consumidor da API e Itaú.

             |
              arquivo .CSR (Certificate Signing Request)

             | No mesmo formato de um .KEY, contém as informações que precisam constar em um certificado gerado por uma CA (Certificate Authority, ou autoridade de certificação) e a assinatura do solicitante, feita com a sua chave privada.

             |
              arquivo .KEY

             | Assim como no JWK, é uma chave criptográfica primária em um bloco de texto codificado — mas em formato de arquivo e com codificação diferente de um JWT. Ex.: arquivo.key.

             |
              bearer token

             | É um dos tipos de access token mais comuns e usado nas nossas APIs.

             |
              client_credentials

             | Tipo de autorização (grant) que obtém um access token fora do contexto de um usuário (pessoa).

             |
              client_id

             | Identificador único e público de uma aplicação no fluxo OAuth 2.0.

             |
              client_secret

             | Segredo conhecido só pela aplicação e pelo servidor de autorização ao qual pertence um client_id.

             |
              JWKS_URI

             | Endereço de internet onde é possível localizar um JWKS para validar a autenticidade de um private_key_jwt.

             |
              JWK (JSON Web Key)

             | Estrutura JSON que representa uma chave criptográfica, normalmente a primária (private_key).

             |
              JWKS (JSON Web Key Set)

             | Conjunto de chaves (JWK) que contém as chaves públicas (public_key) usadas para verificar qualquer JWT emitido e assinado por uma chave privada (private_key).

             |
              JWT (JSON Web Token)

             | Método compacto e autocontido de transmitir dados no formato JSON. Referência: jwt.io/introduction e jwt.io.

             |
              mTLS (Mutual Transport Layer Security)

             | No nosso contexto, é um método de segurança baseado em certificados gerados por uma chave privada e uma pública (ou primária e secundária), das duas partes (mútua). Também conhecido como two-way authentication.

             |
              private_key

             | Chave criptográfica (primária) usada para codificar mensagens destinadas a um destinatário específico. As mensagens criptografadas só podem ser decifradas por uma segunda chave, a public key.

             |
              private_key_jwt

             | JWT assinado por uma chave privada (private_key).

             |
              public key

             | Chave criptográfica (pública/secundária) usada para decodificar mensagens destinadas a um destinatário específico.

             |
              STS (Security Token Service)

             | Servidor de autorização responsável por gerenciar os tokens de acesso e autorizar as requisições às APIs.

             |
              token temporário de ativação

             | No contexto do Itaú, é um primeiro access token, usado para ativar o fluxo de mTLS do nosso processo de autenticação.

             |
              URI (Uniform Resource Identifier)

             | Identificador uniforme de recurso. No nosso contexto, especifica um endereço único de internet de um recurso para uma determinada função.

    Perguntas frequentes (FAQ)

        Qual a diferença entre chave pública e chave privada?

          A chave pública é gerada a partir da chave privada, pode ser de conhecimento público e fica embutida no certificado. A chave privada é sensível, fica somente com você e comprova que o certificado está em uso pelo dono no processo de mTLS.

        Qual a diferença entre credenciais e token?

          As credenciais (client_id + client_secret) identificam a sua aplicação e são permanentes. O token é obtido no STS Itaú a partir das credenciais, tem validade curta e é enviado em cada chamada de API.

        Por quanto tempo o token temporário é válido?

          Na etapa de onboarding, 7 dias corridos. Na etapa de consumo, 5 minutos.

        Preciso gerar um novo CSR para renovar o certificado?

            Não. Dentro da validade de 365 dias, use o arquivo .CSR já gerado e um token temporário da sua aplicação. Depois desse prazo, solicite um novo token ao seu ponto focal do Itaú.

    Suporte

    Se sua empresa já estiver em processo de implementação, responda ao e-mail com as orientações já recebidas ou entre em contato com seu gerente de relacionamento.

        Como se conectar às APIs Itaú?

        Agora que você já conhece os termos, veja o passo a passo para gerar credenciais, certificado e token e começar a integrar.

         Como se conectar às APIs do Itaú
       Pré-requisitos para se conectar ao ambiente Itaú

    Nesta página

          Conceitos principais

        Certificado dinâmico (CSR)
        Chave pública
        Chave privada
        SSL
        Credenciais
        Token temporário
        Como obter um token temporário

      Glossário de termos (A–Z)
      Perguntas frequentes (FAQ)
      Suporte

    Jornada de integração

      Como se conectar às APIs do Itaú
      Pré-requisitos
      Obter credenciais e certificado dinâmico
      Boas práticas para o uso de credenciais
      Como fazer sua primeira chamada a uma API

max-w-7xl-xl primeiros-passos md:font-text leading-normal m-auto pt-8 pb-12
