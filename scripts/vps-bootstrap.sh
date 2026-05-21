#!/usr/bin/env bash
# À exécuter UNE FOIS sur un VPS Ubuntu 22.04/24.04 neuf (en root ou sudo)
set -euo pipefail

echo "==> Mise à jour système..."
apt-get update && apt-get upgrade -y

echo "==> Installation Docker..."
apt-get install -y ca-certificates curl git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

echo "==> Pare-feu (UFW) : SSH + HTTP + HTTPS..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo ""
echo "Bootstrap terminé."
echo "Prochaines étapes :"
echo "  1. git clone <votre-repo> /opt/texta-crm"
echo "  2. cd /opt/texta-crm && cp .env.production.example .env && nano .env"
echo "  3. chmod +x scripts/deploy-vps.sh && ./scripts/deploy-vps.sh"
