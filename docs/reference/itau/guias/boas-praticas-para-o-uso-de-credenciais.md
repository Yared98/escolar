# Boas práticas para o uso de credenciais

Fonte: https://devportal.itau.com.br/boas-praticas-para-o-uso-de-credenciais

Boas práticas para o uso de credenciais

Use este guia para proteger suas credenciais, certificados e outros mecanismos de autenticação.



O que são credenciais?

    Uma credencial é uma informação utilizada para autenticar sua aplicação e acessar os serviços disponibilizados pelo Itaú, como chaves de acesso, certificados e outros mecanismos de autenticação.

    Assim como a senha do seu Bankline, ela é confidencial, intransferível e deve ser utilizada apenas por pessoas autorizadas.

    Princípios básicos de proteção

    Trate credenciais como informações confidenciais

      - Compartilhe credenciais apenas com pessoas autorizadas a operar a integração em nome da sua empresa.

      - Adote os mesmos cuidados que você teria com a senha do seu Bankline.

      - Nunca compartilhe credenciais por canais inseguros.

    Evite expor credenciais

      - Nunca envie ou armazene credenciais em texto aberto, como e-mails, mensagens instantâneas, planilhas ou pastas compartilhadas.

      - Após concluir a configuração necessária, evite manter cópias ou registros desnecessários da credencial.

    Armazene credenciais com segurança

    Utilize mecanismos apropriados para armazenar informações sensíveis.

      - Prefira soluções como cofres de segredos (Secret Manager) e variáveis de ambiente.

      - Nunca inclua credenciais em códigos-fonte.

      - Nunca armazene credenciais em repositórios de código.

      - Evite salvar credenciais em arquivos locais ou sistemas de versionamento.

    Controle de acesso e monitoramento

    Adote o princípio do menor privilégio

      - Conceda apenas os acessos necessários para cada pessoa ou sistema.

      - Revise periodicamente quem possui acesso às credenciais utilizadas pela integração.

    Monitore o uso das credenciais

      - Mantenha mecanismos de monitoramento para acompanhar a utilização das credenciais.

      - Registre acessos e operações para facilitar auditorias e investigações de incidentes.

      - Esteja atento a comportamentos inesperados ou suspeitos.

    Mantenha suas credenciais atualizadas

    Faça a rotação periódica

      - Atualize suas credenciais periodicamente de acordo com a política de segurança da sua empresa.

      - Evite utilizar credenciais antigas por períodos prolongados.

    Revogue credenciais que não são mais necessárias

      - Remova credenciais que não estejam mais em uso.

      - Revogue imediatamente credenciais associadas a sistemas descontinuados ou pessoas que não necessitam mais de acesso.

    Em caso de suspeita de comprometimento

      - Revogue imediatamente a credencial afetada.

      - Entre em contato com o Itaú para reportar o incidente.

      - Gere novas credenciais antes de restaurar a operação da integração.

       Obter credenciais e emitir o certificado dinâmico
     Como fazer a primeira chamada a uma API?

    Nesta página

      O que são credenciais?

          Princípios básicos de proteção

        Trate como confidenciais
        Evite expor credenciais

      Armazene com segurança

          Controle de acesso e monitoramento

        Princípio do menor privilégio
        Monitore o uso das credenciais

          Mantenha as credenciais atualizadas

        Faça a rotação periódica
        Revogue credenciais não usadas
        Suspeita de comprometimento

    Jornada de integração

      Como se conectar às APIs do Itaú
      Pré-requisitos
      Obter credenciais e certificado dinâmico
      Boas práticas para o uso de credenciais
      Como fazer sua primeira chamada a uma API

max-w-7xl-xl primeiros-passos md:font-text leading-normal m-auto pt-8 pb-12
