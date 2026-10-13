#!/bin/sh
# Gera um par de chaves Ed25519 PKCS#8 para assinatura de JWT no backend.
# O arquivo jwt_private.pem deve ser informado no .env (JWT_ED25519_PRIVATE_PEM)
# ou montado no container (JWT_ED25519_PRIVATE_PEM_FILE).

set -e

if ! command -v openssl >/dev/null 2>&1; then
  echo "Erro: openssl não encontrado. Instale o OpenSSL antes de continuar."
  exit 1
fi

OUTFILE="${1:-jwt_private.pem}"

openssl genpkey -algorithm ed25519 -outform PEM -out "$OUTFILE"

echo ""
echo "Chave privada salva em: $OUTFILE"
echo "Mantenha este arquivo em segurança e NUNCA o envie para o git."
echo ""
echo "Para usar no compose de homelab, escolha UMA das opções:"
echo "  1) Copie o conteúdo de $OUTFILE para JWT_ED25519_PRIVATE_PEM no .env"
echo "     (mantenha as quebras de linha como \\n)."
echo "  2) Informe o caminho em JWT_ED25519_PRIVATE_PEM_FILE e monte o arquivo"
echo "     nos volumes do serviço backend."
