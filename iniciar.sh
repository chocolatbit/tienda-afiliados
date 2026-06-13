#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR/server"

if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js no está instalado." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[iniciar] Instalando dependencias..."
  npm install
fi

echo "[iniciar] Arrancando servidor en http://localhost:${PORT:-3000}"
exec node server.js
