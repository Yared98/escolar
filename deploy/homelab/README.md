# Implantação no Homelab — Escolar ERP

Este diretório contém a stack de **produção** para rodar o Escolar ERP num servidor próprio (homelab), usando Docker Compose e Caddy como proxy reverso.

> Não use este compose para desenvolvimento local. Para desenvolvimento, use o `docker-compose.yml` da raiz do projeto.

---

## 1. Requisitos

- Docker Engine 24+ e Docker Compose plugin (`docker compose`).
- Acesso à internet para baixar as imagens e para o Caddy solicitar certificado HTTPS (Let's Encrypt).
- Um domínio apontando para o IP do servidor (ex: `escola.seudominio.com.br` → IP do homelab).
- Portas 80 e 443 liberadas no firewall.
- Git com `core.autocrlf=false` no checkout (especialmente no Windows) — veja [A armadilha das migrations](#7-armadilha-das-migrations-no-windows).

---

## 2. DNS e porta

1. Crie um registro tipo A no seu provedor de DNS apontando o domínio para o IP público do servidor.
2. Aguarde a propagação (pode levar alguns minutos).
3. Confirme que as portas 80 e 443 do servidor estão acessíveis a partir da internet.

---

## 3. Gerar a chave JWT

O backend exige uma chave Ed25519 PKCS#8 para assinar os tokens JWT.

### Linux / macOS / WSL

```bash
cd deploy/homelab
./gerar-chave-jwt.sh
```

### Windows (PowerShell, com OpenSSL instalado)

```powershell
cd deploy/homelab
mkdir segredos
openssl genpkey -algorithm ed25519 -outform PEM -out segredos/jwt_private.pem
```

O arquivo `segredos/jwt_private.pem` é um segredo: a pasta `segredos/` está no `.gitignore`. O compose monta essa pasta (somente leitura) no backend e lê a chave pelo caminho em `JWT_ED25519_PRIVATE_PEM_FILE`.

---

## 4. Preencher o `.env`

```bash
cp .env.example .env
```

Edite o `.env` com seus valores reais. Pelo menos:

- `DOMINIO`: domínio que aponta para o servidor.
- `POSTGRES_PASSWORD`: senha forte para o banco.
- `APP_ENV`: `production` para uma escola real; `demo` para mostrar o sistema com a escola-modelo.
- `JWT_ED25519_PRIVATE_PEM_FILE`: deixe o padrão (`/run/segredos/jwt_private.pem`) se gerou a chave em `segredos/`.

Nunca versione o arquivo `.env`.

---

## 5. Subir a stack

```bash
cd deploy/homelab
docker compose up -d --build
```

A primeira inicialização pode levar alguns minutos porque o backend aplica as migrations SQLx e compila em release.

---

## 6. Verificar a instalação

- Healthcheck da API: `https://<DOMINIO>/api/v1/health`
- Aplicação: `https://<DOMINIO>`

Se tudo estiver certo, a tela de login aparecerá.

### Primeiro acesso em uma instalação real

Em produção (`APP_ENV=production`) as migrations de **seed demo** são ignoradas automaticamente. Para criar a primeira escola:

1. A aba **Cadastrar Escola** fica escondida por padrão. Para criar a primeira escola, coloque `PERMITIR_CADASTRO_ESCOLA=true` no `.env` e reconstrua o frontend: `docker compose up -d --build frontend`.
2. Acesse a tela de login, clique em **Cadastrar Escola** e preencha os dados da escola e do gestor.
3. Volte `PERMITIR_CADASTRO_ESCOLA=false` e reconstrua o frontend de novo, para ninguém mais criar escolas pela tela.
4. Entre como gestor e cadastre professores, secretaria e famílias em **Pessoas > Usuários e acessos**.

### Instalação de demonstração

Para mostrar o sistema a um cliente com dados de exemplo, use `APP_ENV=demo` no `.env` **antes do primeiro `up`**: o backend aplica as migrations de seed demo (escola `escola-modelo`). O código só filtra os seeds quando `APP_ENV=production`.

> A escola-modelo tem senha conhecida (documentada em `openspec/CORE_SPEC.md`). Use um banco SEPARADO para a demonstração e nunca coloque dados reais nele. Para passar a uma escola real, suba outra instalação (outro diretório/volume) com `APP_ENV=production`.

---

## 7. Atualizar para uma nova versão

```bash
cd deploy/homelab
git pull
docker compose build
docker compose up -d
```

O backend aplicará automaticamente novas migrations no boot.

---

## 8. Backup e restauração

### Backup automático

O serviço `backup` gera um dump customizado (`pg_dump -Fc`) uma vez ao dia, salvando em `./backups`. Apenas os **14 arquivos mais recentes** são mantidos.

### Restaurar um backup

1. Pare a stack ou o serviço backend para evitar conflitos:  
   ```bash
   docker compose stop backend worker
   ```
2. Execute o script de restauração:  
   ```bash
   export DATABASE_URL=postgres://escolar_app:<SENHA>@localhost:5432/escolar_db
   ./restaurar-backup.sh ./backups/escolar_YYYYMMDD_HHMMSS.dump
   ```
3. Suba os serviços novamente:  
   ```bash
   docker compose up -d
   ```

**Atenção:** a restauração apaga e recria o banco atual. Dados não salvos em backup serão perdidos.

---

## 9. A armadilha das migrations no Windows

O SQLx calcula o checksum das migrations como **bytes**. Se os arquivos `.sql` forem checkoutados com quebras de linha CRLF, o checksum não bate e o backend pode falhar ao subir.

Antes de clonar ou fazer build no Windows, configure:

```bash
git config --global core.autocrlf false
```

Ou, preferencialmente, gere o pacote de deploy a partir de `git archive` (que preserva LF):

```bash
git archive --format=tar HEAD | tar -x -C /pasta/de/deploy
```

---

## 10. HTTPS local sem domínio público

Se for testar apenas na rede local, edite o `Caddyfile`:

1. Comente a linha `{$DOMINIO}`.
2. Descomente a linha `:80`.
3. Recrie o container Caddy: `docker compose up -d caddy`.

**Limitação:** PWA, notificações push e alguns recursos de câmera no celular exigem HTTPS com certificado válido. Para uso real no dia a dia do professor, use um domínio com HTTPS.

---

## Arquivos deste diretório

- `docker-compose.yml` — orquestração dos serviços.
- `Caddyfile` — configuração do proxy reverso.
- `.env.example` — modelo das variáveis de ambiente e segredos.
- `gerar-chave-jwt.sh` — gera a chave Ed25519 para JWT.
- `restaurar-backup.sh` — restaura um dump do PostgreSQL.
