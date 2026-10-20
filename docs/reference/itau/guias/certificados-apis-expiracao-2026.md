# Atualização de segurança e vencimento de certificados

Fonte: https://devportal.itau.com.br/certificados-apis-expiracao-2026

Atualização de segurança e vencimento de certificados

Atualização da cadeia de certificados das APIs Itaú



Atenção: Esta atualização refere-se exclusivamente à cadeia de certificados (Certificate Authority - CA) e aos endereços de conexão do Itaú utilizados pela sua aplicação.

    Não é necessário substituir o certificado dinâmico mTLS e certificado webhook da sua empresa.

    O que fazer

          Ações necessárias

          Etapas informativas

          1. Atualize a cadeia de certificados na aplicação

              -
                Adicione a nova cadeia de certificados

              -
                Altere os endereços de IPs

              -
                Realize os testes de validação

          2. Atualize as configurações de conexão

              - Atualize as URLs das APIs, quando necessário.

              - Confira nosso tutorial para fazer a implementação no seu sistema.

          3. Valide sua integração

            Confirme que a autenticação e o consumo das APIs continuam funcionando corretamente.

          4. Conte com nosso suporte

            Em caso de dúvidas durante a adequação, leia a nossa seção de Perguntas Frequentes (FAQ) ou consulte nossos canais de atendimento.

    Adequações necessárias

    Com o objetivo de aumentar a segurança das comunicações e assegurar a continuidade das integrações com nossas APIs, é necessário que sua equipe realize as seguintes adequações:

      -
        Atualizar a cadeia de certificados, adicionando a nova Root CA e o novo certificado intermediário ao truststore ou keystore da aplicação. Durante o período de transição, recomendamos manter também a cadeia atual, garantindo uma migração segura e sem impacto para a operação.

      -
        Liberar os novos ranges de IP nos firewalls dos ambientes consumidores. Essa atualização é necessária para manter a comunicação segura e contínua com a infraestrutura, mesmo que as URLs atualmente utilizadas permaneçam inalteradas.

      -
        Atualizar as URLs das APIs que passarão a utilizar novos endereços de conexão, assegurando que as integrações continuem operando normalmente após a evolução da infraestrutura.

          Certificate Bundle

          Para baixar os certificados, preencha um breve formulário na próxima página.

        Liberar download dos certificados

         |

             | Endereço impactado*
             | Novo endereço
             | URL de validação
             | Range de IPs
             | Data de
expiração

             |

                secure.api.itau

             |

                secure.gateway.api.itau

             |
              secure.gateway.api.itau/sandbox/ca-validation

             |
              200.196.155.117/32
 138.59.163.117/32
 3.44.192.200/29

             | 15/09/2026

             |

                api.itau.com.br

             |

                api.gateway.itau.com.br

             |
              api.gateway.itau.com.br/sandbox/ca-validation

             |
              200.196.155.117/32
 138.59.163.69/32
 3.44.192.200/29

             | 18/10/2026

             |

                api-bin.itau.com.br

             |

                api-bin.gateway.itau.com.br

             |
              api-bin.gateway.itau.com.br/sandbox/ca-validation

             |
              200.196.155.86/32
 138.59.163.86/32
 200.196.155.87/32
 138.59.163.87/32
 18.96.65.56/29

             | 02/11/2026

    *Outros endereços, diferentes destes, não serão impactados neste momento.

      Atenção: Atualize a cadeia de certificados o quanto antes

    Os novos endereços já estão disponíveis na tabela acima e podem ser configurados imediatamente. Realizar a atualização antecipada garante a continuidade ininterrupta das suas comunicações com as APIs após a substituição da cadeia atual. Caso a atualização não seja efetuada antes da data de expiração, sua integração poderá ser impactada.

    Checklist de ação

        Faça agora

          -

             Baixe a nova cadeia de certificados (Root CA e intermediário).

   -

  Importe a nova cadeia como confiável, mantendo a atual.

          -

             Libere os novos ranges de IP no seu firewall.

          -

             Identifique as URLs consumidas hoje e planeje a migração para os novos endereços.

        Antes das datas de corte

          -

             Valide a conectividade utilizando a nova cadeia e os novos endereços.

          -

             Teste a emissão de tokens pelo serviço de autenticação.

          -

             Atualize as URLs conforme as datas de substituição presentes neste guia.

          -

             Conclua a adequação até 15 de setembro de 2026.

        Está com dúvidas sobre o processo? Confira o tutorial de implementação da cadeia de certificados.

        Acessar tutorial técnico

      Atenção: Fique atento para a sua segurança

    Golpistas podem utilizar o tema da atualização de certificados para enviar links, arquivos ou orientações falsas. Utilize apenas os canais oficiais de atendimento e nunca compartilhe senhas ou códigos de autenticação.

    Como testar?

    Após importar a nova cadeia de certificados em seu truststore, recomendamos validar a comunicação TLS utilizando os endpoints de validação disponibilizados pelo Itaú.

    URL para teste

    De acordo com o endereço impactado utilize a respectiva URL de validação:

						-
							https://secure.gateway.api.itau/sandbox/ca-validation

						-
							https://api.gateway.itau.com.br/sandbox/ca-validation

						-
							https://api-bin.gateway.itau.com.br/sandbox/ca-validation

    Teste utilizando cURL

    Antes de realizar a validação, gere um token de acesso utilizando suas credenciais de aplicação:

      bash

curl --request POST \
  --url https://sts.itau.com.br/api/oauth/token \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --cert <certificado-mtls.crt> \
  --key <arquivo-chave-privada.key> \
  --data grant_type=client_credentials \
  --data 'client_id=<client-id>' \
  --data 'client_secret=<client-secret>'

    Após obter o token e garantir que a nova cadeia de certificados foi importada corretamente, execute a chamada abaixo para validar a comunicação com o ambiente:

      bash

curl --request GET \
  --url <url-de-validacao-utilizada>' \
  --header 'Authorization: Bearer <token-gerado-anteriormente>' \
  --header 'x-itau-apikey: <client-id>' \
  --cert <certificado-mtls.crt>' \
  --key <arquivo-chave-privada.key>' \
  --header 'x-itau-correlationID: 123' \
  --header 'x-itau-flowID: 123'

    Resultado esperado

    Se a configuração estiver correta:

      -

         A chamada para o endpoint de validação será executada com sucesso.

      -

         Não haverá erros relacionados a certificado, truststore ou SSL/TLS.

      -

         O retorno do endpoint indicará que a cadeia de certificados foi validada corretamente pelo ambiente.

    Sobre a atualização de certificados

    Para acompanhar a evolução dos padrões de segurança adotados pelo mercado, vamos atualizar a cadeia de certificação utilizada nas integrações com as APIs Itaú.

    Essa mudança ajuda a manter a segurança, a confiabilidade e a continuidade das conexões utilizadas em serviços como pagamentos, cobranças, Pix, conciliações e demais operações transacionais.

      Prazo para adequação: até 15 de setembro de 2026.

    Por que essa mudança acontece agora

    O prazo de validade dos certificados está sendo reduzido globalmente, conforme decisão do CA/Browser Forum. A redução acontecerá de forma gradual:

      - Validade de 200 dias para certificados emitidos a partir de 15/03/2026.

      - Validade de 100 dias para certificados emitidos a partir de 15/03/2027.

      - Validade de 47 dias para certificados emitidos a partir de 15/03/2029.

    Em alinhamento a essa diretriz, os novos certificados utilizados pelo Itaú nas conexões dos endereços de consumo de APIs listados acima terão validade de 200 dias. Para garantir a continuidade das integrações, será necessário adicionar a nova cadeia de certificados digitais e adequar os endereços de conexão (DNS e IPs) utilizados pela sua empresa até as datas previstas no cronograma.

    Perguntas frequentes

        O que está mudando e por que preciso agir?

          O Itaú está atualizando a cadeia de certificação utilizada nas conexões com suas APIs. A mudança envolve uma nova Autoridade Certificadora Raiz (Root CA) e um novo certificado intermediário. Também será necessário atualizar URLs e liberar novos endereços IP. A adequação é necessária para manter a confiança TLS e a continuidade das conexões.

        O que minha empresa precisa fazer?

          Baixe a nova cadeia de certificados e adicione a Root CA e o certificado intermediário como confiáveis no truststore ou keystore da aplicação. Durante a transição, mantenha também a cadeia atual. Faça a liberação dos novos ranges de IP e migre para as novas URLs. Durante o processo, teste autenticação, conectividade e consumo das APIs conforme indicado no passo a passo.

        Quais integrações exigem atenção especial?

          Dê atenção especial às aplicações que usam truststore ou keystore próprio, certificate pinning ou CA pinning, certificados instalados manualmente, regras restritivas de firewall, URLs configuradas diretamente no código ou clientes proprietários. Integrações B2B e aplicações Java, AIX, containers ou ambientes com cadeia empacotada também devem ser avaliadas.

        Qual é o prazo para concluir a adequação?

          A orientação editorial atual é concluir a adequação até 15 de setembro de 2026 para os endereços e a infraestrutura apresentados no cronograma da página principal. Consulte sempre os vencimentos disponíveis na nossa página de certificados.

        Vai acontecer algo com o meu aplicativo Itaú?

          Não. Esta mudança não afeta o internet banking. O impacto é exclusivo em sistemas e softwares que se conectam automaticamente às APIs do Itaú, como sistemas de gestão (ERP), plataformas de e-commerce ou softwares de automação financeira.

        Eu não faço nenhuma integração com o Itaú. Preciso me preocupar?

          Talvez sim. Se você usa um software (ex: sistema de gestão, ERP, plataforma de pagamentos) que processa Pix, boletos ou pagamentos via Itaú, esse fornecedor pode ter uma integração ativa, mesmo que você não se lembre de ter autorizado.

        Posso fazer a atualização no meu computador?

          Não. A atualização precisa ser feita no servidor ou ambiente onde o software de integração está instalado, não na máquina do usuário final. Se o sistema roda em um servidor da empresa, na nuvem (AWS, Azure) ou é um SaaS, é lá que a mudança precisa acontecer.

        O que acontece se eu não fizer a atualização?

          A aplicação pode deixar de confiar nos certificados apresentados pelo Itaú e apresentar falhas de handshake SSL/TLS, autenticação ou comunicação. Também pode haver indisponibilidade se os novos IPs não estiverem liberados ou se a aplicação continuar usando uma URL desativada. O efeito pode impedir o envio e o recebimento de requisições. As mudanças impactam apenas aplicações que utilizam APIs (Ex.: Softwares de ERP, Sistemas de Gestão etc.) e não impactam os canais digitais Itaú como o Internet Banking PF e o Internet Banking PJ (app Itaú Empresas e Bankline).

          Ainda tem dúvidas?

          Consulte a FAQ completa para informações sobre identificação de impacto, testes, truststore, keystore, URLs, IPs, STS e suporte.

        Consultar FAQ completa

    Canais de atendimento

    Precisa de ajuda durante a adequação? Fale com o time responsável pelo seu segmento.

        Segmento: Itaú Empresas e Middle

            Telefone

              Contato capital: (11) 4090 1685

              Demais localidades: 0800 770 1685

        Segmentos: Agro, IMOB, Large e Infra&Energia

            Telefone

              Contato capital: (11) 3004 9451

              Demais localidades: 0800 720 9451

            E-mail

              contatoitau@itau-unibanco.com.br

        Parceiros e Tecnologia

            Telefone

              (11) 3003 9483

              0800 702 9483

            E-mail

              contatoitau@itau-unibanco.com.br

Available in English
    Nesta página

      O que fazer
      Adequações necessárias
      Baixe os certificados

      Checklist de ação
      Como testar?
      Sobre a atualização
      Perguntas frequentes
      Canais de atendimento

max-w-7xl-xl primeiros-passos md:font-text leading-normal m-auto pt-8 pb-12
