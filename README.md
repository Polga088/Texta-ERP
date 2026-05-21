# Texta CRM+ERP

Plateforme SaaS CRM+ERP — gestion de projets, tâches (kanban), habilitations déléguées, RH et agenda.

## Stack

- **API** : FastAPI, SQLAlchemy 2, PostgreSQL, JWT
- **Web** : Next.js 15, TypeScript, Tailwind CSS
- **Infra** : Docker Compose, Redis (prévu)

## Hébergement VPS (recommandé)

Pour ne pas surcharger votre Mac, déployez tout sur un serveur distant :

```bash
# Sur le VPS (Ubuntu)
git clone https://github.com/Polga088/Texta-ERP.git /opt/texta-crm && cd /opt/texta-crm
sudo bash scripts/vps-bootstrap.sh
cp .env.production.example .env && nano .env
./scripts/deploy-vps.sh
```

Guide complet : **[docs/deployment-vps.md](docs/deployment-vps.md)**

## Développement local (léger)

### Prérequis

- Docker (optionnel, pour Postgres seul)
- Node.js 20+ et Python 3.11+ si vous lancez API/Web en local

### Option minimale sur Mac

```bash
# Seulement la base de données en Docker
docker compose up -d postgres redis
```

Puis API + Web en local, ou tout sur le VPS (Mac = éditeur uniquement).

### Option complète en local

```bash
cp .env.example .env
docker compose up -d
```

- **Web** : http://localhost:3000
- **API** : http://localhost:8000/docs

### Comptes démo (après seed)

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@texta.local | Admin123! |
| Chef de projet | pm@texta.local | Pm123456! |
| Membre | member@texta.local | Member123! |
| RH | hr@texta.local | Hr123456! |

## Modules V1

- CRM Projets & comptes clients
- Todo list (liste + kanban)
- Organigramme d'habilitation (grants user/groupe)
- RH (employés, départements, congés, organigramme)
- Agenda & réunions
- Tableau de bord & journal d'audit

## Documentation

- [Architecture](docs/architecture.md)
- [RBAC & habilitations](docs/rbac.md)
- [Guide agents IA](AGENTS.md)

## Structure

```
apps/api/     # Backend FastAPI
apps/web/     # Frontend Next.js
packages/shared/
docs/
.cursor/      # Règles et skills Cursor
```
