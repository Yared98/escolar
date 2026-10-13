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

echo "Restaurando backup..."
docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --clean --if-exists --no-owner --no-privileges < "$DUMP_FILE"

echo "Religando backend e worker..."
docker compose start backend worker

echo ""
echo "Restauração concluída."
