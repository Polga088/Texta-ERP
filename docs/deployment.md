# Déploiement

> **Production VPS** : voir le guide détaillé [deployment-vps.md](./deployment-vps.md)

## Staging local (Docker Compose dev)

```bash
docker compose up -d
docker compose exec api alembic upgrade head
docker compose exec api python -m src.scripts.seed
```

Services :
- Web : http://localhost:3000
- API : http://localhost:8000
- Docs OpenAPI : http://localhost:8000/docs

## Variables d'environnement production

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL async (asyncpg) |
| `JWT_SECRET_KEY` | Clé forte (openssl rand -hex 32) |
| `CORS_ORIGINS` | URL du frontend |
| `NEXT_PUBLIC_API_URL` | URL publique de l'API |

## Checklist production

- [ ] Changer `JWT_SECRET_KEY` et mots de passe seed
- [ ] HTTPS terminé (reverse proxy)
- [ ] Backups PostgreSQL
- [ ] Rate limiting sur `/auth/login` (V1.1)
