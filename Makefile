.PHONY: dev prod-deploy prod-logs prod-down vps-bootstrap

# Développement local
dev:
	docker compose up -d postgres redis

dev-down:
	docker compose down

# Production VPS (à lancer sur le serveur)
prod-deploy:
	./scripts/deploy-vps.sh

prod-logs:
	docker compose -f docker-compose.prod.yml logs -f

prod-down:
	docker compose -f docker-compose.prod.yml down

prod-seed:
	docker compose -f docker-compose.prod.yml exec api python -m src.scripts.seed
