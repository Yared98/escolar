#!/bin/sh
# Restaura um backup gerado pelo serviço "backup" (pg_dump -Fc) no Postgres deste compose.
# AVISO: este comando SOBRESCREVE o banco de dados atual. Use com cautela.
# Uso (a partir de deploy/homelab, com o .env preenchido e a stack no ar):
#   ./restaurar-backup.sh ./backups/escolar_20261013_030000.dump

set -e

cd "$(dirname "$0")"

DUMP_FILE="$1"

if [ -z "$DUMP_FILE" ]; then
  echo "Uso: ./restaurar-backup.sh <caminho-do-arquivo.dump>"
  echo "Exemplo: ./restaurar-backup.sh ./backups/escolar_20261013_030000.dump"
  exit 1
fi

if [ ! -f "$DUMP_FILE" ]; then
  echo "Erro: arquivo não encontrado: $DUMP_FILE"
  exit 1
fi

if [ ! -f .env ]; then
  echo "Erro: .env não encontrado em $(pwd). Copie .env.example para .env e preencha."
  exit 1
fi

# Lê POSTGRES_USER e POSTGRES_DB do .env (a senha não é necessária: o restore roda dentro do container).
POSTGRES_USER=$(grep -E '^POSTGRES_USER=' .env | head -n 1 | cut -d= -f2-)
POSTGRES_DB=$(grep -E '^POSTGRES_DB=' .env | head -n 1 | cut -d= -f2-)

echo "===================================================================="
echo " ATENÇÃO: a restauração vai APAGAR e recriar os dados do banco atual."
echo "          Dados que não estão no backup serão perdidos permanentemente."
echo "===================================================================="
echo "Arquivo: $DUMP_FILE"
echo "Banco:   $POSTGRES_DB (usuário $POSTGRES_USER)"
echo ""
echo "Pressione Ctrl+C agora para cancelar. Continuando em 10 segundos..."
sleep 10

echo "Parando backend e worker durante a restauração..."
docker compose stop backend worker

# Religa os serviços mesmo se a restauração falhar no meio.
religar() {
  echo "Religando backend e worker..."
  docker compose start backend worker
}
trap religar EXIT

# Recria o banco vazio: restaurar com --clean sobre tabelas com RLS e dependências gera conflitos.
# Os papéis (escolar_runtime) ficam no servidor e as permissões vêm do próprio dump.
echo "Recriando o banco $POSTGRES_DB vazio..."
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres \
  -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\" WITH (FORCE);" \
  -c "CREATE DATABASE \"$POSTGRES_DB\" OWNER \"$POSTGRES_USER\";"

echo "Restaurando backup..."
docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --exit-on-error < "$DUMP_FILE"

echo ""
echo "Restauração concluída."
