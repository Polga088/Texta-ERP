# Architecture Texta CRM+ERP

## Vue d'ensemble

```
┌─────────────┐     REST/JWT      ┌──────────────┐     SQL      ┌────────────┐
│  Next.js    │ ◄──────────────► │   FastAPI    │ ◄──────────► │ PostgreSQL │
│  apps/web   │                   │   apps/api   │              └────────────┘
└─────────────┘                   └──────┬───────┘
                                         │
                                  ┌──────▼───────┐
                                  │    Redis     │  (jobs async V2)
                                  └──────────────┘
```

## Mono-organisation V1, multi-tenant ready

Chaque entité métier inclut `organization_id`. En V1 une seule organisation est créée au bootstrap (`seed`). Le passage multi-tenant activera l'isolation par `organization_id` sur toutes les requêtes.

## Modules API

| Module | Route prefix | Description |
|--------|--------------|-------------|
| auth | `/auth` | register, login, refresh, me |
| users | `/users` | gestion utilisateurs (admin) |
| groups | `/groups` | équipes pour habilitations |
| accounts | `/accounts` | comptes clients CRM |
| contacts | `/contacts` | contacts |
| projects | `/projects` | projets CRM |
| grants | `/projects/{id}/grants` | habilitations déléguées |
| tasks | `/tasks` | todo / kanban |
| hr | `/hr` | employés, départements, congés |
| calendar | `/calendar` | événements & réunions |
| dashboard | `/dashboard` | statistiques |
| audit | `/audit` | journal (admin) |

## Frontend

- Route group `(app)` : pages authentifiées avec sidebar
- Token JWT en `localStorage` (`access_token`, `refresh_token`)
- Client API : `src/lib/api.ts`

## Déploiement

- **Dev** : Docker Compose (postgres, redis) + uvicorn + next dev
- **Prod** (futur) : API container + Web container + Postgres managé
