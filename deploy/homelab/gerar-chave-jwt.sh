#!/bin/sh
# Gera um par de chaves Ed25519 PKCS#8 para assinatura de JWT no backend.
# Por padrão grava em segredos/jwt_private.pem, pasta que o compose monta no backend.

set -e

if ! command -v openssl >/dev/null 2>&1; then
  echo "Erro: openssl não encontrado. Instale o OpenSSL antes de continuar."
  exit 1
fi

OUTFILE="${1:-segredos/jwt_private.pem}"
mkdir -p "$(dirname "$OUTFILE")"

openssl genpkey -algorithm ed25519 -outform PEM -out "$OUTFILE"

echo ""
echo "Chave privada salva em: $OUTFILE"
echo "Mantenha este arquivo em segurança e NUNCA o envie para o git."
echo ""
echo "O compose lê esta chave em /run/segredos/jwt_private.pem (JWT_ED25519_PRIVATE_PEM_FILE)."
