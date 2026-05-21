#!/usr/bin/env bash
# Déploiement / mise à jour sur le VPS
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "Erreur: fichier .env manquant. Copiez .env.production.example vers .env"
  exit 1
fi

echo "==> Build et démarrage des conteneurs production..."
docker compose -f docker-compose.prod.yml build web api
docker compose -f docker-compose.prod.yml up -d

echo "==> Attente santé API..."
for i in $(seq 1 30); do
  if docker compose -f docker-compose.prod.yml exec -T api python -c \
    "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)" 2>/dev/null; then
    echo "API prête."
    break
  fi
  sleep 2
done

echo "==> Redémarrage Nginx (recharge DNS Docker)..."
docker compose -f docker-compose.prod.yml restart nginx

echo "==> Migrations (via entrypoint API au démarrage)"
docker compose -f docker-compose.prod.yml logs api --tail 20

echo ""
echo "Déploiement terminé."
echo "  Site : voir PUBLIC_APP_URL dans .env"
echo ""
echo "Premier déploiement ? Lancez le seed une fois :"
echo "  RUN_SEED=true docker compose -f docker-compose.prod.yml up -d api"
echo "  # ou : docker compose -f docker-compose.prod.yml exec api python -m src.scripts.seed"
