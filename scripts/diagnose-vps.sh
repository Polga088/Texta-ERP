#!/usr/bin/env bash
# Diagnostic rapide Bad Gateway / auth / audit sur le VPS
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
COMPOSE="docker compose -f docker-compose.prod.yml"

echo "==> État des conteneurs"
$COMPOSE ps

echo ""
echo "==> Santé API (depuis l'hôte via Nginx /health)"
curl -sf "http://127.0.0.1/health" && echo "" || echo "ÉCHEC: /health inaccessible"

echo ""
echo "==> Login API (depuis l'hôte via Nginx)"
curl -sS -o /tmp/texta-login.json -w "HTTP %{http_code}\n" \
  -X POST "http://127.0.0.1/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@texta.local","password":"test"}' || true
head -c 200 /tmp/texta-login.json 2>/dev/null; echo ""

echo ""
echo "==> Dernières lignes logs API"
$COMPOSE logs api --tail 30

echo ""
echo "==> Dernières lignes logs Nginx"
$COMPOSE logs nginx --tail 20

echo ""
echo "==> Test direct API (réseau Docker, sans Nginx)"
$COMPOSE exec -T api python -c "
import urllib.request
try:
    r = urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)
    print('API interne OK:', r.read().decode())
except Exception as e:
    print('API interne ÉCHEC:', e)
"

echo ""
echo "Si /health échoue mais l'API interne OK → redémarrer Nginx:"
echo "  $COMPOSE restart nginx"
