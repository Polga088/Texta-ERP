# Déploiement sur VPS

Guide pour héberger Texta CRM+ERP sur un serveur distant (Ubuntu 22.04/24.04 recommandé) afin de ne rien faire tourner sur votre Mac.

## Architecture sur le VPS

```
Internet :80/443
       │
   ┌───▼───┐
   │ Nginx │  reverse proxy
   └───┬───┘
       ├──────────► web (Next.js :3000)
       ├──────────► api (FastAPI :8000)
       │
   postgres + redis (réseau interne Docker, non exposés)
```

- **Votre Mac** : édition du code + `git push` éventuel
- **Le VPS** : Docker Compose production uniquement

## Prérequis VPS

| Ressource | Minimum recommandé |
|-----------|-------------------|
| RAM | 2 Go (4 Go confortable) |
| CPU | 2 vCPU |
| Disque | 20 Go SSD |
| OS | Ubuntu 22.04 ou 24.04 |
| Ports ouverts | 22 (SSH), 80, 443 |

## 1. Préparer le serveur (une fois)

Connectez-vous en SSH :

```bash
ssh root@votre-ip-vps
```

Copiez le script bootstrap sur le serveur ou clonez le repo puis :

```bash
sudo bash scripts/vps-bootstrap.sh
```

Cela installe Docker et configure le pare-feu.

## 2. Déployer l'application

Sur le VPS :

```bash
git clone https://github.com/Polga088/Texta-ERP.git /opt/texta-crm
cd /opt/texta-crm

cp .env.production.example .env
nano .env   # remplir PUBLIC_APP_URL, mots de passe, JWT_SECRET_KEY
```

Générer une clé JWT :

```bash
openssl rand -hex 32
```

Variables **obligatoires** dans `.env` :

- `PUBLIC_APP_URL` — URL publique du site (ex. `http://203.0.113.10` ou `https://crm.domaine.com`)
- `POSTGRES_PASSWORD` — mot de passe fort
- `JWT_SECRET_KEY` — clé aléatoire
- `CORS_ORIGINS` — même valeur que `PUBLIC_APP_URL`
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — pour le seed initial

Lancer le déploiement :

```bash
chmod +x scripts/deploy-vps.sh
./scripts/deploy-vps.sh
```

### Seed (première installation uniquement)

```bash
docker compose -f docker-compose.prod.yml exec api python -m src.scripts.seed
```

## 3. Vérifier

- Site : `PUBLIC_APP_URL` (ex. http://IP-du-vps)
- API docs : `PUBLIC_APP_URL/docs`
- Santé API : `PUBLIC_APP_URL/health`

## 4. HTTPS avec Let's Encrypt (domaine requis)

Si vous avez un nom de domaine pointant vers le VPS :

```bash
# Arrêter nginx temporairement si besoin, ou utiliser webroot
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d crm.votredomaine.com \
  --email vous@email.com --agree-tos --no-eff-email
```

Puis décommenter le bloc `server` port 443 dans `deploy/nginx/texta.conf` et redémarrer :

```bash
docker compose -f docker-compose.prod.yml restart nginx
```

Mettre à jour `.env` : `PUBLIC_APP_URL=https://crm.votredomaine.com` et `CORS_ORIGINS` idem, puis rebuild web :

```bash
docker compose -f docker-compose.prod.yml build web --no-cache
docker compose -f docker-compose.prod.yml up -d web
```

## 5. Dépannage Bad Gateway (502) / Auth / Audit

Symptôme : « Bad Gateway » à la connexion ou sur le journal d'audit.

**Cause fréquente** : après un `git pull` + redéploiement, Nginx garde l'ancienne IP du conteneur API → 502.

Sur le VPS :

```bash
cd /opt/texta-crm
git pull
./scripts/deploy-vps.sh

# Diagnostic complet
chmod +x scripts/diagnose-vps.sh scripts/reset-admin-password.sh
./scripts/diagnose-vps.sh
```

Si `/health` répond mais le login échoue avec **401** (pas 502), le mot de passe admin est incorrect :

```bash
./scripts/reset-admin-password.sh admin@texta.local
# Copiez le mot de passe affiché et connectez-vous
```

Vérifications `.env` :

- `CORS_ORIGINS` = exactement l'URL du site (`http://IP` si pas de HTTPS)
- `JWT_SECRET_KEY` renseigné (`openssl rand -hex 32`)
- `POSTGRES_PASSWORD` identique partout

Le journal d'audit nécessite un compte **administrateur** (403 si compte membre, 502 si API down).

## 6. Mises à jour (sans toucher au Mac)

Depuis votre Mac, poussez le code (git). Sur le VPS :

```bash
cd /opt/texta-crm
git pull
./scripts/deploy-vps.sh
```

## 7. Commandes utiles

```bash
# Logs
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web

# Arrêter tout
docker compose -f docker-compose.prod.yml down

# Backup Postgres
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U texta texta_crm > backup_$(date +%Y%m%d).sql
```

## Développement local léger

Sur le Mac, ne lancez que ce dont vous avez besoin :

```bash
# Option A : uniquement Postgres dans Docker, API/Web en local
docker compose up -d postgres redis

# Option B : tout sur le VPS, Mac = éditeur uniquement
# (aucun docker local)
```

## Sécurité production

- [ ] Changer tous les mots de passe par défaut du seed
- [ ] `JWT_SECRET_KEY` unique et long
- [ ] Ne pas exposer les ports 5432/6379 sur Internet
- [ ] Activer HTTPS dès qu'un domaine est disponible
- [ ] Sauvegardes Postgres planifiées (cron + `pg_dump`)
