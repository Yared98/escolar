#!/bin/sh
# Restaura um backup gerado pelo serviço backup (pg_dump -Fc).
# AVISO: este comando SOBRESCREVE o banco de dados atual. Use com cautela.

set -e

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

if [ -z "$DATABASE_URL" ]; then
  echo "Erro: defina a variável DATABASE_URL antes de executar."
  echo "Exemplo: export DATABASE_URL=postgres://escolar_app:sua-senha@localhost:5432/escolar_db"
  exit 1
fi

echo "===================================================================="
echo " ATENÇÃO: a restauração vai APAGAR e recriar o banco de dados atual."
echo "          Dados não salvos em backup serão perdidos permanentemente."
echo "===================================================================="
echo "Arquivo: $DUMP_FILE"
echo "Destino: ${DATABASE_URL//:*@/:***@}"
echo ""
echo "Pressione Ctrl+C agora para cancelar. Continuando em 10 segundos..."
sleep 10

echo "Restaurando backup..."
pg_restore -d "$DATABASE_URL" --clean --if-exists --no-owner --no-privileges "$DUMP_FILE"

echo ""
echo "Restauração concluída com sucesso."
