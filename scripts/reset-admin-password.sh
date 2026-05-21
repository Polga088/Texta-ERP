#!/usr/bin/env bash
# Réinitialise ou crée le compte admin (mot de passe affiché une seule fois)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
COMPOSE="docker compose -f docker-compose.prod.yml"

EMAIL="${1:-admin@texta.local}"

$COMPOSE exec -T api python - <<PY
import asyncio
import secrets

from sqlalchemy import select

from src.core.database import async_session_maker
from src.core.security import get_password_hash
from src.models.organization import GlobalRole, Organization, User

EMAIL = "${EMAIL}".lower()
NEW_PASSWORD = secrets.token_urlsafe(14)[:16] + "A1!"


async def main() -> None:
    async with async_session_maker() as db:
        org = (
            await db.execute(select(Organization).order_by(Organization.created_at.asc()))
        ).scalars().first()
        if not org:
            print("Aucune organisation. Créez-en une via /register d'abord.")
            return

        user = (
            await db.execute(
                select(User).where(User.organization_id == org.id, User.email == EMAIL)
            )
        ).scalars().first()

        if not user:
            user = User(
                organization_id=org.id,
                email=EMAIL,
                full_name="Admin Principal",
                global_role=GlobalRole.ADMIN,
                is_active=True,
                hashed_password=get_password_hash(NEW_PASSWORD),
            )
            db.add(user)
            action = "créé"
        else:
            user.global_role = GlobalRole.ADMIN
            user.is_active = True
            user.hashed_password = get_password_hash(NEW_PASSWORD)
            action = "mis à jour"

        await db.commit()
        print(f"Compte admin {action}.")
        print(f"  Email   : {EMAIL}")
        print(f"  Mot de passe : {NEW_PASSWORD}")


asyncio.run(main())
PY
