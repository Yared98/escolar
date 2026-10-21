# Guia de Instalação e Configuração de mTLS para Webhook Pix do Itaú

Este guia orienta administradores de infraestrutura e DevOps na terminação TLS e validação de certificado de cliente (mTLS) para o recebimento de notificações Pix do Itaú no Escolar ERP.

> [!WARNING]
> **Limitações MVP**: Este guia e a integração foram validados contra simuladores HTTP locais e ambiente sandbox do Itaú. Não há garantia de produção pronta sem testes formais de homologação junto ao suporte técnico do Itaú e validação de conformidade da cadeia de certificados com o DevPortal do Itaú.

---

## 1. Visão Geral da Autenticação mTLS

Diferente do webhook de boletos (que utiliza autenticação OAuth2 Bearer gerada pelo sistema), o webhook Pix do Itaú utiliza **autenticação mTLS mútua** no nível da camada de transporte (HTTPS).

Na requisição enviada pelo Itaú:
- O Itaú apresenta um certificado TLS de cliente emitido pela sua Autoridade Certificadora (CA).
- O servidor proxy reverso (Nginx, Caddy, Traefik ou Load Balancer) **deve exigir e validar** esse certificado contra a raiz de confiança da CA do Itaú.
- Como a autenticação mTLS é terminada no proxy, o backend Axum do Escolar ERP recebe a notificação na rota `/webhooks/itau/:tenant_id/pix` sem token Bearer, respondendo HTTP 200 após persistir na fila `gateway_avisos`.
- A baixa da fatura **nunca** é concedida com base apenas no webhook; ela depende obrigatoriamente de consulta posterior ao endpoint regulatório `GET /pix/{e2eid}` no Itaú.

> [!IMPORTANT]
> A validação mTLS deve ser aplicada **exclusivamente** na rota do webhook Pix (`/webhooks/itau/*/pix` e `/api/webhooks/itau/*/pix`). As demais rotas (`/webhooks/itau/*/boletos`, `/webhooks/itau/*/oauth/token`, webhooks da Cora, etc.) utilizam outros esquemas de autenticação e não recebem certificado de cliente do Itaú.

---

## 2. Obtenção da Raiz de Confiança (CA do Itaú)

1. Baixe o pacote oficial de certificados CA fornecido pelo Itaú no DevPortal:
   - Link de download: [ca-cert.zip](https://devportal.itau.com.br/assets/ca_cert_952123c440.zip)
2. Extraia o pacote e localize os certificados da cadeia raiz e intermediária da CA do Itaú.
3. Concatene os certificados em um arquivo `.crt` único (ex.: `/etc/ssl/certs/itau-pix-ca.crt`).

---

## 3. Configuração do Proxy Reverso

### Exemplo Nginx

No Nginx, `ssl_verify_client` só vale no bloco `server`, não em `location`. Por isso o exemplo usa `ssl_verify_client optional` no `server` (as outras rotas seguem sem certificado) e recusa, na `location` da rota de Pix, qualquer requisição em que `$ssl_client_verify` não seja `SUCCESS`:

```nginx
# Configuração do VirtualHost HTTPS (ex.: escola.com.br)
server {
    listen 443 ssl http2;
    server_name api.escola.com.br;

    # Certificado do servidor da sua aplicação (Let's Encrypt / certificado público)
    ssl_certificate /etc/letsencrypt/live/api.escola.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.escola.com.br/privkey.pem;

    # CA do Itaú para validação do cliente
    ssl_client_certificate /etc/ssl/certs/itau-pix-ca.crt;
    # Por padrão, desativado para o restante da API:
    ssl_verify_client optional;

    # Rota específica do webhook Pix: exige certificado emitido pela CA do Itaú
    location ~ ^/(api/)?webhooks/itau/[^/]+/pix$ {
        if ($ssl_client_verify != SUCCESS) {
            return 403 "mTLS client certificate required and must be valid";
        }

        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Demais rotas da aplicação (sem exigência de mTLS do Itaú)
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Exemplo Traefik

No Traefik, crie um `tlsOption` com a CA do Itaú e aplique-o ao router correspondente ao path prefix `/webhooks/itau/`:

```yaml
tls:
  options:
    itauMtls:
      clientAuth:
        caFiles:
          - /etc/ssl/certs/itau-pix-ca.crt
        clientAuthType: RequireAndVerifyClientCert
```

### Exemplo AWS ALB (Application Load Balancer)

Se você utiliza AWS ALB com terminação TLS:
- Configure um **Trust Store** no ALB contendo o pacote `ca_cert` do Itaú.
- Configure a regra de roteamento ou segundo listener mTLS para validar certificados de cliente na porta ou host correspondente.

---

## 4. Requisito de DNS na AWS (Registro A/AAAA vs CNAME)

De acordo com as especificações do DevPortal Itaú (`itau-ep9-api-regulatorio-pix-v2-externo.md`):

> **Atenção:** Em ambientes AWS, o domínio configurado para a URL de webhook deve possuir um **registro A ou AAAA** apontando diretamente para o API Gateway / Load Balancer, **não** podendo ser configurado como registro CNAME.

Verifique no Route 53 que o registro DNS está configurado com Alias tipo A (IPv4) ou AAAA (IPv6) apontando para o seu ALB/NLB.

---

## 5. Variáveis de Ambiente no Backend

Para o correto funcionamento do registro e das consultas:

| Variável | Descrição | Exemplo |
|---|---|---|
| `ITAU_WEBHOOK_BASE_URL` | URL pública HTTPS base do servidor (sem sufixo `/pix`) | `https://api.escola.com.br` |
| `APP_SECRETS_KEY` | Chave mestra de 32 bytes em hexadecimal para cifragem AES-256-GCM dos segredos | `0123456789abcdef...` |
| `ITAU_MODE` | Modo de operação (`mock`, `sandbox`, `production`) | `sandbox` |

> [!CAUTION]
> A chave `APP_SECRETS_KEY` protege todas as credenciais do Itaú gravadas no banco (`tenant_gateway_secrets`). Faça backup seguro desta chave fora do servidor. A perda desta chave impede a decifragem das credenciais bancárias e obriga a reinserção manual de todos os segredos.
