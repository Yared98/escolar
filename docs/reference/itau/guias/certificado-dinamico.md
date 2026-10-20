# Obter credenciais e emitir o certificado dinâmico

Fonte: https://devportal.itau.com.br/certificado-dinamico

Obter credenciais e emitir o certificado dinâmico

Use este guia para gerar suas credenciais e emitir o certificado dinâmico necessário para integrar sua aplicação às APIs do Itaú.



Atenção: A atualização da cadeia de certificados (CA) e a obtenção ou renovação do certificado dinâmico mTLS, descrita no tutorial a seguir, são processos independentes.

      Consulte o comunicado sobre a atualização da CA e realize as ações necessárias para manter sua integração funcionando corretamente.

        Vai integrar com PISP, Corban Digital ou Extrato?

        As credenciais e o certificado dessas APIs são gerados na área logada do portal.

    Sobre este programa

    Este programa automatiza a geração das credenciais e a emissão do certificado dinâmico utilizado para autenticação nas APIs do Itaú.

    Ele está disponível em:

      - Java

      - Python

      - Node.js

      - Go

      - C#

      - Script para Windows via Git Bash ( executar-gitbash.sh)

    Todas as opções oferecem a mesma funcionalidade. Escolha a que melhor se adapta ao seu ambiente.

      Baixar arquivo .zip

    Preciso saber programar?

      Não. O programa executa automaticamente as etapas técnicas necessárias. Basta seguir as instruções apresentadas durante a execução.

    Como funciona

    O processo é dividido em quatro etapas:

         |

             | Etapa
             | O que acontece
             | Sua ação

             |
              1

             | Geração das chaves de segurança
             | Seguir as instruções exibidas pelo programa

             |
              2

             | Emissão do certificado
             | Informar os dados recebidos por e-mail

             |
              3

             | Validação da configuração
             | Executar o teste indicado pelo programa

             |
              4

             | Renovação do certificado
             | Informar o token de renovação quando necessário

    Ao final do processo, você terá as credenciais e o certificado necessários para utilizar as APIs do Itaú.

    Escolha como executar

    Você pode executar o processo de três formas:

         |

             |
             | Script de execução
             | Terminal
             | Linha de comando

             |
              Nível de conhecimento

             | Básico
             | Intermediário
             | Avançado

             |
              Indicado para

             | Primeira utilização
             | Quem utiliza terminal com frequência
             | Quem já conhece OpenSSL e cURL

             |
              Interface guiada

             | Sim
             | Sim
             | Não

             |
              Salva progresso

             | Sim
             | Sim
             | Não

             |
              Requer OpenSSL instalado

             | Não
             | Não
             | Sim

        Recomendação: utilize o script de execução se estiver realizando o processo pela primeira vez.

        Precisa de outra forma de execução?

        Se nenhuma das opções acima atender ao seu cenário, consulte a documentação complementar:

          Certificado dinâmico (demais produtos)

            Opção 1: Script de execução (Recomendado)
            Fácil

           Esta é a forma mais simples de executar o processo. Você executa um único arquivo e o programa faz o resto.

            Vantagens:

            - Basta um duplo clique (Windows) ou um único comando (Linux/macOS)

            - Menu para escolher a linguagem, sem precisar digitar comandos

            - Verificação automática da instalação da linguagem escolhida

            - Não é necessário instalar openssl

            - Salva o progresso automaticamente

            - Tratamento de erros com mensagens claras

            - Logs de cada execução para facilitar o suporte

            - Mascaramento automático de dados sensíveis

           Passo a passo

           Passo 1: Baixe arquivos

           Faça o download do arquivo .zip com a estrutura de pastas.

            Download do arquivo .zip

              Importante

              O programa foi desenvolvido para proteger suas informações:

                - Suas chaves privadas não são enviadas para outros sistemas.

                - Informações sensíveis são ocultadas nos logs e na interface.

                - O Client Secret é exibido apenas uma vez e não é salvo em arquivo.

                - Os arquivos gerados permanecem no seu computador.

                ?? Nunca compartilhe suas chaves privadas ( private.pem e ARQUIVO_CHAVE_PRIVADA.key).  Elas são necessárias para garantir a segurança da sua integração.

              Não conseguiu baixar o arquivo .zip?

              Os scripts também estão disponíveis nesta documentação. Copie os arquivos e salve-os seguindo a estrutura de pastas e as extensões indicadas a seguir.

          Estrutura de pastas

          Após descompactar o arquivo, a estrutura de pastas será:

            certificado-dinamico/

            |-- executar.bat <- Duplo clique para executar no Windows

            |-- executar-gitbash.sh <- Executar no Windows (Git Bash)

            |-- executar.sh <- Executar no Linux

            |-- executar.zsh <- Executar no macOS

            |-- java/

            |   |-- CertificadoDinamico.java

            |-- python/

            |   |-- certificado_dinamico.py

            |-- node/

            |   |-- certificadoDinamico.js

            |-- go/

            |   |-- main.go

            |-- csharp/

            |   |-- CertificadoDinamico.cs

            |-- output/ <- Criada automaticamente na primeira execução

                |-- estado_certificado.json <- Progresso salvo (etapas 1 e 2)

                |-- etapa1/

                |   |-- private.pem <- Sua chave privada (NÃO compartilhe)

                |   |-- public.pem <- Sua chave pública (envie ao Analista de Operações)

                |-- etapa2/

                |   |-- client_id.txt <- Client ID decifrado

                |   |-- token_temporario.txt <- Token temporário decifrado

                |   |-- ARQUIVO_REQUEST_CERTIFICADO.csr <- Pedido de certificado

                |   |-- ARQUIVO_CHAVE_PRIVADA.key <- Chave privada do certificado

                |   |-- certificado.crt <- Certificado assinado

                |   |-- certificado.pfx <- (Opcional) PFX protegido por senha

                |-- etapa4/

                |   |-- certificado.crt <- Certificado renovado

                |   |-- certificado.pfx <- (Opcional) PFX protegido por senha

                |-- logs/

                    |-- certificado_dinamico_YYYYMMDD_HHMMSS.log <- Log de cada execução

          Passo 2: Descompacte o arquivo ZIP

            Windows

            - Localize o arquivo .zip na pasta de Downloads.

            - Clique com o botão direito no arquivo.

            - Selecione "Extrair tudo...".

            - Escolha uma pasta de destino e clique em "Extrair".

            macOS

            - Dê um duplo clique no arquivo .zip na pasta de Downloads.

            Linux

            - Clique com o botão direito no arquivo e selecione "Extrair aqui" ou execute no terminal.

          unzip certificado-dinamico.zip

          Passo 3: Entre na pasta do projeto

              Importante: Você precisa estar dentro da pasta certificado-dinamico para executar os scripts.

            Windows

            - Abra a pasta certificado-dinamico no Explorador de Arquivos.

            macOS / Linux

            - Abra o Terminal.

            - Navegue até a pasta usando o comando cd.

          cd ~/Downloads/certificado-dinamico

          Passo 4: Execute o script correspondente ao seu sistema operacional

               |

                   | Sistema
                   | Como executar

                   | Windows
                   | Dê um duplo clique no arquivo executar.bat

                   | Windows (Git Bash)
                   |
                    chmod +x executar-gitbash.sh && ./executar-gitbash.sh

                   | Linux
                   |
                    chmod +x executar.sh && ./executar.sh

                   | macOS
                   |
                    chmod +x executar.zsh && ./executar.zsh

              Nota: o comando chmod +x precisa ser executado apenas uma vez.

          Passo 5: Escolha a linguagem

          O programa exibirá um menu semelhante ao exemplo abaixo.

            =============================================

            Certificado Dinâmico Itaú - Launcher

            =============================================

            Escolha a linguagem para executar:

            1. Java

            2. Python

            3. Node.js

            4. Go

            5. C# (.NET)

            0. Sair

            Escolha (1-5, recomendado: 1):

          Digite o número da linguagem desejada e pressione Enter. O programa verificará se a linguagem está instalada antes de continuar.

              Dica: Se você não souber qual linguagem escolher, comece pela opção 1 (Java). Caso encontre algum erro, tente a opção 2 (Python).

          Passo 6: Siga as etapas do menu principal

          Após escolher a linguagem, o programa exibirá o menu principal com as quatro etapas. Basta digitar o número da etapa e pressionar Enter. O sistema sugerirá automaticamente a próxima etapa.

          Confira o detalhamento completo das etapas em Guia completo das etapas.

            Opção 2: Executar pelo Terminal
            Médio

          Se você já sabe abrir o terminal e executar comandos, pode rodar o programa diretamente, sem usar o script launcher. O resultado é o mesmo da Opção 1.

              Importante: Entre na pasta da linguagem escolhida dentro do projeto antes de executar.

          Java (Recomendado)

            cd java

            javac CertificadoDinamico.java

            java CertificadoDinamico

              Dica: O comando javac (compilação) precisa ser executado uma única vez.

          Python

            cd python

            pip install requests

            pip install cryptography

            python certificado_dinamico.py

              Dica: No Linux/macOS pode ser necessário usar python3 e pip3.

          Node.js

            cd node

            node certificadoDinamico.js

          Go

            cd go

            go run main.go

          C# (.NET)

            cd csharp

            dotnet-script CertificadoDinamico.cs

              Dica: Se o dotnet-script não estiver disponível, crie um arquivo CertificadoDinamico.csproj com o seguinte conteúdo e use dotnet run:

              <Project Sdk="Microsoft.NET.Sdk">

                <PropertyGroup>

                  <OutputType>Exe</OutputType>

                  <TargetFramework>net8.0</TargetFramework>

                </PropertyGroup>

              </Project>

          Após executar, o menu principal será exibido. Confira o Guia completo das etapas.

            Opção 3: Linha de comando com OpenSSL e cURL
            Avançado

          Para usuários avançados. Exige openssl e curl instalados. As etapas a seguir correspondem às do menu scripts.

          Etapa 1 - Gerar chaves (openssl)

            Gerar a chave privada:

          openssl genpkey -algorithm RSA -out private.pem -pkeyopt rsa_keygen_bits:2048

            Extrair a chave pública:

          openssl rsa -in private.pem -pubout -out public.pem

            Exibir a chave pública:

          cat public.pem

            Windows: Use type public.pem em vez de cat.

          Copie todo o conteúdo exibido (incluindo -----BEGIN PUBLIC KEY----- e -----END PUBLIC KEY-----) e envie ao Analista de Operações Itaú.

          Etapa 2 - Gerar certificado (openssl + curl)

          Após receber as credenciais criptografadas por e-mail:

            Descriptografar a chave de sessão:

          echo 'CHAVE_DE_SESSAO_CIFRADA' | base64 -d | openssl rsautl -decrypt -inkey private.pem -out session_key.bin

            Descriptografar o Client ID:

          echo 'CLIENT_ID_CIFRADO' | base64 -d | openssl enc -aes-256-cbc -d -K $(xxd -p session_key.bin) -iv 0 -out client_id.txt

            Descriptografar o Token temporário:

          echo 'TOKEN_TEMPORARIO_CIFRADO' | base64 -d | openssl enc -aes-256-cbc -d -K $(xxd -p session_key.bin) -iv 0 -out token.txt

              Importante: Substitua os valores entre aspas pelos valores que você recebeu por e-mail.

            Gerar CSR:

            openssl req -new -newkey rsa:2048 -nodes \

              -keyout ARQUIVO_CHAVE_PRIVADA.key \

              -out ARQUIVO_REQUEST_CERTIFICADO.csr \

              -sha512 \

              -subj "/CN=SEU_CLIENT_ID/OU=SUA_ORGANIZACAO/L=SAO PAULO/ST=SP/C=BR"

              Importante: Substitua SEU_CLIENT_ID pelo valor decifrado e SUA_ORGANIZACAO pelo nome da sua empresa.

            Enviar CSR ao Itaú:

            curl -X POST 'https://sts.itau.com.br/seguranca/v1/certificado/solicitacao' \

              -H 'Content-Type: text/plain' \

              -H "Authorization: Bearer $(cat token.txt)" \

              -d "$(cat ARQUIVO_REQUEST_CERTIFICADO.csr)"

          A resposta conterá o certificado assinado e o client_secret. Salve o certificado:

            echo '-----BEGIN CERTIFICATE-----

            ... conteudo do certificado retornado ...

            -----END CERTIFICATE-----' > certificado.crt

              Importante: O Client Secret é equivalente a uma Senha. Ele é exibido uma única vez. Copie e guarde em local seguro (ex.: gerenciador de senhas). Não compartilhe com ninguém.

          Etapa 3 - Testar token OAuth (curl)

            curl -X POST 'https://sts.itau.com.br/as/token.oauth2' \

              --cert certificado.crt \

              --key ARQUIVO_CHAVE_PRIVADA.key \

              -H 'Content-Type: application/x-www-form-urlencoded' \

              -d 'grant_type=client_credentials&client_id=SEU_CLIENT_ID&client_secret=SEU_CLIENT_SECRET'

              Importante: Substitua SEU_CLIENT_ID e SEU_CLIENT_SECRET pelos valores obtidos na etapa 2.

            Resultado: A resposta conterá o access_token. Este é o token de acesso que deve ser informado no header Authorization: Bearer <access_token> das requisições às APIs do Itaú. O token tem validade de 300 segundos (5 minutos).

              Nota: Esta etapa é para testes. Na sua aplicação final, você deverá implementar esse fluxo OAuth diretamente no seu código, renovando o token a cada 5 minutos.

          Etapa 4 - Renovar certificado (curl)

          Renova o certificado dinâmico quando ele está próximo da expiração (menos de 30 dias).

            curl -X POST 'https://sts.itau.com.br/seguranca/v1/certificado/renovacao' \

              --cert certificado.crt \

              --key ARQUIVO_CHAVE_PRIVADA.key \

              -H 'Content-Type: text/plain' \

              -H "Authorization: Bearer SEU_TOKEN_STS" \

              -d "$(cat ARQUIVO_REQUEST_CERTIFICADO.csr)"

              Importante: Substitua SEU_TOKEN_STS por um token válido para autenticação no STS Itaú.

    Guia completo das etapas

    Esta seção detalha exatamente o que acontece e o que você precisa fazer em cada etapa do menu interativo (Opções 1 e 2).

    Como funciona o menu

    Ao abrir o programa, você pode conferir o menu principal:

      text
      =============================================

        Certificado Dinamico Itau - Menu Principal

      =============================================

        Progresso atual: Etapa 0 de 3 concluida(s)

       1. Gerar par de chaves e exibir chave publica  [PROXIMA >>] <------ voce esta aqui

        2. Descriptografar credenciais, gerar e enviar certificado  [PENDENTE]

        3. Testar geracao de token                    [PENDENTE]

        4. Renovar certificado

        0. Sair

        9. Recomecar do zero (limpa progresso)

      Como ler o menu:

      -
        [CONCLUIDA] = Você já fez esta etapa

      -
        [PROXIMA >>] < voce esta aqui = Esta é a próxima etapa que você deve fazer

      -
        [PENDENTE] = Você ainda não pode fazer esta etapa (precisa terminar as anteriores primeiro)

        Dica: O programa sugere automaticamente a próxima etapa. Se você pressionar Enter (sem digitar nada), ele executará a etapa sugerida.

    Etapa 1 - Gerar par de chaves de segurança

      Objetivo: Criar um par de chaves criptográficas (uma "chave privada" e uma "chave pública") e mostrar a chave pública para você enviar ao Analista de operações Itaú.

      O que você precisa fazer:

      - Digite 1 e pressione Enter

      - Pronto! O programa gera as chaves e mostra a chave pública na tela

      O que você vai ver na tela:

      [PASSO 1.1] Gerando par de chaves RSA 2048...

      Chave privada salva em /caminho/completo/output/etapa1/private.pem

      Chave publica salva em /caminho/completo/output/etapa1/public.pem

      [PASSO 1.2] Exibindo chave publica...

      =============================================

        Chave Publica Gerada

      =============================================

      -----BEGIN PUBLIC KEY-----

      MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...

      (varias linhas de texto)

      ...

      -----END PUBLIC KEY-----

      >> Etapa 1 concluida. Progresso salvo.

        O que fazer agora:

        1. Copie o conteudo da chave publica exibido acima

        2. Envie a chave publica para o Analista de operacoes Itau

        3. Aguarde o e-mail do Itau com as credenciais cifradas

        4. Quando receber o e-mail, execute a etapa 2

      Próximo passo (Fora do programa):

    Copie todo o texto da chave pública (incluindo as linhas -----BEGIN PUBLIC KEY----- e -----END PUBLIC KEY-----) e envie para o Analista de operações Itaú. Ele usará essa chave para gerar as credenciais criptografadas que você usará na etapa 2.

        Atenção: Aguarde, o analista de operações Itaú precisará de algum tempo para processar. Você receberá um e-mail com 3 valores criptografados. Só então poderá continuar para a etapa 2.

      Arquivos gerados:

         |

             | Arquivo
             | Onde fica
             | Para que serve

             |
              private.pem

             |
              output/etapa1/

             | Chave privada. NÃO compartilhe este arquivo com ninguém.

             |
              public.pem

             |
              output/etapa1/

             | Chave pública. Envie ao Analista de operações Itaú.

    Etapa 2 - Gerar o certificado digital

      Objetivo: Utilizar as credenciais recebidas por e-mail para gerar o certificado digital.

      Antes de começar, certifique-se de ter

      - O e-mail do Itaú contendo os três valores criptografados:
          - Client ID criptografado

          - Token temporário criptografado

          - Chave de sessão criptografada

      O que você precisa fazer:

      - Digite 2 e pressione Enter.

      - O programa solicitará três valores. Para cada um, copie do e-mail e cole no terminal:

         |

             | Valor solicitado
             | Origem para copiar

             |
              Client ID cifrado:

             | Copie o valor "Client ID criptografado" do e-mail

             |
              Token temporário cifrado:

             | Copie o valor "Token temporário criptografado" do e-mail

             |
              Chave de sessão cifrada:

             | Copie o valor "Chave de sessão criptografada" do e-mail

        Dica

          Como colar no terminal:

          -
            Windows (Prompt de Comando): Clique com o botão direito do mouse.

          -
            Windows (PowerShell/Terminal):
            Ctrl + V.

          -
            macOS:
            Cmd + V.

          -
            Linux:
            Ctrl + Shift + V.

      - O programa solicitará os dados da sua empresa. Todos os campos são obrigatórios. Caso você pressione Enter sem digitar nada, o programa solicitará o preenchimento novamente.

         |

             | Campo
             | Exemplo

             |
              Nome da Empresa:

             | Minha Empresa LTDA

             |
              Cidade:

             | SAO PAULO

             |
              Estado - UF:

             | SP

             |
              País:

             | BR

      - O programa realizará todo o processo automaticamente (descriptografar, gerar CSR, enviar ao Itaú).

      O que acontece ao final:

    O programa exibirá uma tela com os arquivos gerados e, muito importante, o Client Secret:

      ==============================================

        ATENCAO - CLIENT SECRET

      ==============================================

      O Client Secret e equivalente a uma SENHA. Trate-o com o mesmo cuidado.

      O valor do Client Secret sera exibido APENAS NESTE MOMENTO.

      Copie e salve em um local seguro. Este valor NAO sera armazenado pelo programa.

        Client Secret: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

      ==============================================

      Guarde essas informacoes em local seguro. O Client ID e o Client Secret sao equivalentes a senhas

      e serao necessarios para gerar tokens OAuth e consumir as APIs do Itau.

      NAO compartilhe essas credenciais. Quem tiver acesso a elas podera acessar as APIs em seu nome.

      O Itau nao se responsabiliza pelo armazenamento local das credenciais.

      A guarda correta e de responsabilidade exclusiva do cliente.

        Atenção: O Client Secret é equivalente a uma senha e aparece apenas uma única vez neste momento. Se você não copiar neste momento, precisará refazer todo o processo. Copie e guarde em local seguro imediatamente (ex.: gerenciador de senhas). Não compartilhe, não envie por e-mail e não deixe exposto em código-fonte. Quem tiver acesso ao Client ID e Client Secret poderá acessar as APIs em seu nome.

      Arquivos gerados:

         |

             | Arquivo
             | Onde fica
             | Para que serve

             |
              client_id.txt

             |
              output/etapa2/

             | Client ID decifrado

             |
              token_temporario.txt

             |
              output/etapa2/

             | Token temporário decifrado

             |
              ARQUIVO_REQUEST_CERTIFICADO.csr

             |
              output/etapa2/

             | Pedido de certificado (CSR)

             |
              ARQUIVO_CHAVE_PRIVADA.key

             |
              output/etapa2/

             | Chave privada do certificado. Não compartilhe.

             |
              certificado.crt

             |
              output/etapa2/

             | Certificado digital assinado pelo Itaú

             |
              certificado.pfx

             |
              output/etapa2/

             | (Opcional) Certificado + chave privada em formato PKCS#12 protegido por senha

        PFX (opcional): Após a etapa 2, o programa perguntará se você deseja gerar um arquivo .pfx. O PFX combina o certificado e a chave privada em um único arquivo protegido por senha. É útil para plataformas que trabalham com esse formato (ex: .NET, Java KeyStore, IIS, Azure). Se não precisar, basta responder N.

      Validade do certificado:

    O programa exibirá na tela as informações de validade:

      ===============================================

        VALIDADE DO CERTIFICADO

      ===============================================

        Validade: 365 dias

        Data de expiracao: DD/MM/AAAA

        Periodo de renovacao: de DD/MM/AAAA ate DD/MM/AAAA

        O processo de renovacao (etapa 4) pode ser realizado a partir de

        30 dias antes da expiracao ate um dia antes da data de expiracao do certificado.

        Importante: O certificado é válido por 365 dias a partir da data de geração. A renovação pode ser feita a partir de 30 dias antes da expiração até um dia antes da data de expiração. Anote a data de expiração para não perder o prazo!

      A responsabilidade de renovar o certificado dentro do prazo é exclusivamente sua. Certificados expirados impossibilitam o acesso às APIs do Itaú e exigem a geração de um novo certificado do zero.

    Etapa 3 - Testar o certificado

      Objetivo: Verificar se o certificado e as credenciais estão funcionando corretamente, gerando um token de acesso de teste.

      O que você precisa fazer:

      - Digite 3 e pressione Enter.

      - Se você acabou de executar a etapa 2 (sem fechar o programa), o Client Secret será usado automaticamente.

      - Se você reiniciou o programa, ele pedirá: Informe o Client Secret: — cole o valor que você guardou na etapa 2.

      O que acontece:

    O programa usa o certificado e as credenciais para gerar um token de acesso OAuth. Se tudo estiver correto, o programa informará:

      ==============================================

        Credenciais e certificado VALIDADOS!

      ==============================================

      Access Token:

      eyJhbGciOiJSUzI1NiIs... (token longo)

        Validade: 300 segundos (5 minutos)

        Uso: Informe este token no header 'Authorization: Bearer <access_token>'

             das requisicoes as APIs do Itau.

      As credenciais (client_id e client_secret) e o certificado digital estao

      validados e funcionais. Voce ja pode utiliza-los em suas integracoes.

        Nota: Esta etapa é apenas para teste. Na sua aplicação final, você deverá implementar esse fluxo OAuth no seu código, renovando o token a cada 5 minutos.

    Etapa 4 - Renovar o certificado

      Objetivo: Renovar o certificado digital quando ele estiver próximo de expirar.

      Quando usar: Somente quando o certificado estiver perto da data de vencimento (menos de 30 dias). Esta opção está sempre disponível no menu, independente do progresso das outras etapas.

      O que você precisa fazer:

      - Digite 4 e pressione Enter.

      - Informe o Token STS para renovação quando solicitado.

      - Se o arquivo CSR da etapa 2 for encontrado automaticamente, o programa o utiliza. Caso contrário, pedirá o caminho do arquivo.

      Arquivo gerado:

         |

             | Arquivo
             | Onde fica
             | Para que serve

             |
              certificado.crt

             |
              output/etapa4/

             | Novo certificado digital renovado

             |
              certificado.pfx

             |
              output/etapa4/

             | (Opcional) Certificado renovado + chave privada em formato PKCS#12 protegido por senha

        PFX (opcional): Assim como na etapa 2, o programa perguntará se você deseja gerar o arquivo .pfx para o certificado renovado.

      Validade do certificado renovado:

    Após a renovação, o programa exibirá as novas datas de validade:

      ===============================================

        VALIDADE DO CERTIFICADO RENOVADO

      ===============================================

        Validade: 365 dias

        Data de expiracao: DD/MM/AAAA

        Periodo de renovacao: de DD/MM/AAAA ate DD/MM/AAAA

        O processo de renovacao (etapa 4) pode ser realizado a partir de

        30 dias antes da expiracao ate um dia antes da data de expiracao do certificado.

        Importante: O certificado renovado também é válido por 365 dias. Anote a nova data de expiração.

      A responsabilidade pela renovação do certificado dentro do prazo é exclusivamente sua. Certificados expirados impedem o acesso às APIs do Itaú e exigem a geração de um novo certificado do zero.

    Opção 9 - Recomeçar do zero

    Se você precisar refazer todo o processo desde o início, digite 9 no menu. Isso apaga todos os arquivos gerados e o progresso salvo.

        Cuidado: Esta ação é irreversível. Todos os arquivos (chaves, certificados, estado) serão excluídos permanentemente.

    Opção 0 - Sair

    Encerra o programa. O progresso das etapas 1 e 2 é salvo automaticamente, na próxima vez que abrir o programa, ele continuará de onde parou.

        Nota: A etapa 3 (teste de token) não fica salva. Se você fechar e reabrir o programa, precisará reexecutar a etapa 3. Isso é normal, ela é apenas um teste.

    Perguntas frequentes (FAQ)

        Preciso saber programar?

            Não. O programa é interativo e guia você por cada etapa. Você só precisa digitar números e pressionar Enter. A linguagem (Java, Python, etc.) é usada internamente — você não precisa entender nada sobre ela.

        Preciso descompactar o arquivo ZIP?

            Sim. O programa não funciona de dentro do arquivo .zip. Descompacte primeiro. Confira as Descompacte o arquivo zip.

        Preciso estar dentro da pasta para executar?

            Sim. O programa precisa encontrar os arquivos internos. No Windows, abra a pasta no Explorador e dê duplo clique no executar.bat. No Linux/macOS, use cd para navegar até a pasta.

        Qual a diferença entre as 3 opções de execução?

            -
              Opção 1 (Script de execução): Mais fácil. Duplo clique e siga o menu. Para a maioria dos usuários.

            -
              Opção 2 (Terminal): Você executa direto pela linguagem. Para quem já usa terminal.

            -
              Opção 3 (openssl/curl): Você executa cada comando manualmente. Para usuários avançados ou auditoria.

        Preciso copiar e colar código?

            Não. Você não precisa copiar nenhum código de programação. O único momento em que precisará colar algo é na etapa 2, quando o programa pede as credenciais criptografadas que você recebeu por e-mail.

        O que fazer se o programa fechar sem querer?

          Não se preocupe. O progresso das etapas 1 e 2 é salvo automaticamente. Basta abrir o programa novamente e ele continuará de onde parou. Apenas a etapa 3 (teste de token) precisará ser reexecutada, pois não fica salva.

        Posso usar qualquer uma das 5 linguagens?

            Sim. Todas fazem exatamente a mesma coisa. Escolha a que já estiver instalada. Se não souber, tente Java (opção 1). Se der erro, tente Python (opção 2).

        O que fazer se aparecer "comando não encontrado"?

          A linguagem não está instalada ou não está no Path. Confira a seção Pré-requisitos e instale. Ou simplesmente tente outra linguagem no menu.

        O que é o Client Secret e por que ele só aparece uma vez?

          O Client Secret é equivalente a uma Senha da sua aplicação. Assim como uma senha de banco, quem tiver acesso a ele poderá acessar as APIs em seu nome. Por segurança, o programa exibe esse valor apenas uma vez na etapa 2 e não o salva em nenhum arquivo. Se você perder esse valor, precisará refazer o processo (opção 9 para recomeçar do zero). O mesmo vale para o Client ID, o certificado e a chave privada, todos são equivalentes a senhas e não devem ser compartilhados.

        O que fazer se a etapa 2 retornar erro 403?

          O erro 403 significa "acesso negado". Geralmente indica que o token expirou. Solicite novas credenciais ao Analista de Operações Itaú e execute novamente a etapa 2.

        O que fazer se aparecer "NullPointerException" na resposta?

          Isso pode indicar que os dados enviados estavam incompletos. Use a opção 9 para recomeçar do zero e refaça todas as etapas.

        Onde ficam os logs?

          Na pasta output/logs/. O arquivo de log é criado automaticamente a cada execução. Informações sensíveis (tokens, senhas) são mascaradas nos logs, então é seguro compartilhá-los com o suporte.

        Como renovar o certificado?

          Use a opção 4 no menu. Ela está sempre disponível. Utilize quando o certificado estiver próximo da expiração (menos de 30 dias).

        Posso executar em outro computador?

          Sim, desde que a linguagem esteja instalada. Porém, os arquivos gerados ficam na pasta output/ do computador original. Se precisar transferir, copie toda a pasta certificado-dinamico/ (incluindo output/).

        É seguro usar este programa?

            Sim. O programa:

            -
              Não envia suas chaves privadas para nenhum lugar;

            -
              Mascara informações sensíveis nos logs e na tela;

            -
              Não armazena o Client Secret em arquivo, ele aparece apenas uma vez na tela;

            - Salva todos os arquivos localmente no seu computador;

            - As chaves privadas ( private.pem e ARQUIVO_CHAVE_PRIVADA.key) nunca devem ser compartilhadas.

              Lembre-se: Client ID, Client Secret, certificado e chave privada são equivalentes a senhas. Não compartilhe, não envie por e-mail e não deixe exposto em código-fonte. Trate essas credenciais com o mesmo cuidado que você trata suas senhas bancárias.

            O Itaú não se responsabiliza pelo armazenamento local das credenciais. A guarda correta é de responsabilidade exclusiva do cliente.

    Resolução de problemas

         |

             | Erro
             | Linguagem
             | Causa provável
             | Solução

             |
              "javac não é reconhecido..."

             | Java
             | Java não instalado ou ausente no PATH.
             | Instale em https://adoptium.net/ e reinicie o terminal.

             |
              "python não é reconhecido..."

             | Python
             | Python não instalado ou ausente no PATH.
             | Instale em https://www.python.org/downloads/ e marque "Add Python to PATH" durante a instalação.

             | Erro ao descriptografar as credenciais
             | Qualquer
             | Valores criptografados copiados do e-mail incorretos ou incompletos.
             | Copie o texto completo de cada campo, sem espaços extras no início ou final.

             |
              Status 403 - Acesso negado

             | Qualquer
             | Token expirado.
             | Solicite novas credenciais ao Analista de Operações Itaú e refaça a etapa 2.

             |
              Status 500 - Erro interno do servidor

             | Qualquer
             | Erro no lado do Itaú.
             | Tente novamente em alguns minutos.

             | O programa não encontra os arquivos
             | Qualquer
             | Programa executado fora da pasta certificado-dinamico.
             | Verifique se você está executando o programa de dentro dessa pasta. Os caminhos são relativos a ela.

             | O script .bat não executa ao dar duplo clique
             | Windows
             | Permissão insuficiente para executar o script.
             | Clique com o botão direito > "Executar como administrador". Ou abra o Prompt de Comando, navegue até a pasta e execute executar.bat.

  Suporte

  Se sua empresa já estiver em processo de implementação, responda ao e-mail com as orientações já recebidas ou entre em contato com seu gerente de relacionamento.

         Pré-requisitos para se conectar ao ambiente Itaú
       Boas práticas para o uso de credenciais

    Nesta página

      Sobre este programa
      Como funciona

          Escolha como executar

        Opção 1: Script de execução
        Opção 2: Executar pelo Terminal
        Opção 3: Linha de comando

          Guia completo das etapas

        Como funciona o menu
        Etapa 1: Gerar par de chaves
        Etapa 2: Gerar o certificado digital
        Etapa 3: Testar o certificado
        Etapa 4: Renovar o certificado
        Opção 9: Recomeçar do zero
        Opção 0: Sair

      Perguntas frequentes (FAQ)
      Resolução de problemas
      Suporte

    Jornada de integração

      Como se conectar às APIs do Itaú
      Pré-requisitos
      Obter credenciais e certificado dinâmico
      Boas práticas para o uso de credenciais
      Como fazer sua primeira chamada a uma API

max-w-7xl-xl primeiros-passos md:font-text leading-normal m-auto pt-8 pb-12
