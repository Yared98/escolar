# Pré-requisitos para se conectar às APIs do Itaú

Fonte: https://devportal.itau.com.br/pre-requisitos-para-se-conectar-ao-ambiente-itau

Pré-requisitos para se conectar às APIs do Itaú

Antes de iniciar sua integração, verifique se seu ambiente atende aos requisitos necessários para se conectar às APIs do Itaú com segurança e estabilidade.



Conceitos

    Se esta é sua primeira integração com o Itaú, recomendamos começar pela documentação de conceitos.

    Ela apresenta os principais termos e componentes utilizados ao longo da jornada de integração.

      Acesse o Glossário

    Cadeia de certificação e endereços de conexão

    Para acompanhar a evolução dos padrões de segurança do mercado, o Itaú está atualizando a cadeia de certificação utilizada nas conexões com suas APIs.

    Além da nova cadeia de certificados, sua empresa também deve validar os endereços de conexão utilizados na integração.

    Essa adequação é necessária para manter a confiança TLS e garantir a continuidade das conexões com os ambientes do Itaú.

    Mudanças no prazo de validade dos certificados

    O prazo de validade dos certificados digitais está sendo reduzido globalmente conforme definição do CA/Browser Forum.

    O cronograma previsto é:

      -
        200 dias para certificados emitidos a partir de 15/03/2026

      -
        100 dias para certificados emitidos a partir de 15/03/2027

      -
        47 dias para certificados emitidos a partir de 15/03/2029

    Para evitar interrupções nas integrações, recomendamos adequar sua infraestrutura dentro dos prazos definidos.

    O que sua empresa precisa fazer

      - Atualizar a cadeia de certificados digitais utilizada na integração.

      - Revisar os endereços de conexão (DNS e IPs).

      - Garantir que as novas configurações estejam liberadas em sua infraestrutura.

    Acesse o guia completo

    Requisitos para gerar credenciais e emitir o certificado dinâmico

    Antes de iniciar o processo, tenha disponível:

      - Um computador com Windows, Linux ou macOS.

      - Uma linguagem de programação instalada localmente.

      - As credenciais cifradas enviadas pelo Itaú por e-mail após a solicitação junto ao Analista de Operações.

        Importante: você não precisa saber programar para utilizar a ferramenta. A linguagem é utilizada apenas na execução do processo.

    Qual linguagem utilizar?

    A ferramenta está disponível em cinco linguagens e todas oferecem a mesma funcionalidade.

    Se possível, utilize uma linguagem que já esteja instalada no seu ambiente.

      Java é a opção recomendada.

         |

             | Linguagem
             | Recomendação
             | Uso mais comum

             | Java
             | Recomendada
             | Ambientes corporativos

             | Python
             | Opcional
             | Linux e macOS

             | Node.js
             | Opcional
             | Aplicações web

             | Go
             | Opcional
             | Ambientes específicos

             | C# (.NET)
             | Opcional
             | Ecossistema Microsoft

    Verifique se a linguagem está instalada

    Abra o terminal do seu sistema operacional e execute o comando correspondente à linguagem escolhida.

    Se uma versão for exibida, a instalação está correta.

    Se aparecer uma mensagem indicando que o comando não foi encontrado, será necessário realizar a instalação da linguagem.

    Como abrir o terminal

      Windows

      - Pressione Windows + R

      - Digite cmd

      - Pressione Enter

      macOS

      - Pressione ? + Espaço

      - Digite Terminal

      - Pressione Enter

      Linux

      - Pressione Ctrl + Alt + T

    Comandos de verificação

         |

             | Linguagem
             | Comando

             | Java
             |
              javac -version

             | Python
             |
              python --version ou python3 --version

             | Node.js
             |
              node --version

             | Go
             |
              go version

             | C# (.NET)
             |
              dotnet --version

    Precisa instalar uma linguagem?

    Consulte abaixo as opções disponíveis para seu sistema operacional.

      Windows

         |

             | Linguagem
             | Download

             | Java
             |
              Adoptium

             | Python
             |
              Python.org

             | Node.js
             |
              Node.js

             | Go
             |
              Go.dev

             | C# (.NET)
             |
              Microsoft .NET

      Linux

    Utilize os gerenciadores de pacotes da sua distribuição.

      macOS

    Utilize o Homebrew para instalar a linguagem desejada.

    Se você ainda não possui o Homebrew instalado, consulte a documentação oficial do projeto.

    Próximo passo

    Com os pré-requisitos concluídos, siga para a geração das credenciais e emissão do certificado dinâmico.

      Acesse o guia completo

         Como se conectar às APIs do Itaú
       Obter credenciais e emitir o certificado dinâmico

    Nesta página

      Conceitos

          Cadeia de certificação e endereços de conexão

        Mudanças no prazo de validade
        O que sua empresa precisa fazer

          Requisitos para gerar credenciais

        Qual linguagem utilizar?
        Verifique se a linguagem está instalada
        Precisa instalar uma linguagem?

      Próximo passo

    Jornada de integração

      Como se conectar às APIs do Itaú
      Pré-requisitos
      Obter credenciais e certificado dinâmico
      Boas práticas para o uso de credenciais
      Como fazer sua primeira chamada a uma API

max-w-7xl-xl primeiros-passos md:font-text leading-normal m-auto pt-8 pb-12
