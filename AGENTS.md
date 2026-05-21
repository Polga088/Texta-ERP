# Instructions pour agents (Cursor / GitHub)

## Avant toute modification

1. Lire [docs/architecture.md](docs/architecture.md) et [docs/rbac.md](docs/rbac.md)
2. Respecter le monorepo : `apps/api` (Python), `apps/web` (Next.js)
3. UI en **français**, code (noms, commentaires techniques) en **anglais**

## Conventions

| Zone | Convention |
|------|------------|
| API routes | `snake_case`, préfixe `/api/v1` |
| Modèles SQLAlchemy | `snake_case`, `organization_id` sur toutes les tables métier |
| TypeScript | `camelCase` variables, `PascalCase` composants |
| Commits | Ne pas committer sans demande explicite de l'utilisateur |
| Secrets | Jamais dans le repo — utiliser `.env.example` |

## Autorisation (critique)

- Toujours utiliser `PermissionEngine` pour les droits projet
- Ne jamais faire de `if user.id == owner` ad-hoc dans les routes
- Les grants passent par `POST /projects/{id}/grants`

## Tests

- API : `pytest` dans `apps/api`
- Web : `npm run lint` dans `apps/web`
- Tester les endpoints auth et permissions après changement RBAC

## PR / modules

Une PR = un module (`module:crm`, `module:hr`, `module:rbac`, etc.)

## Skills projet

Voir `.cursor/skills/` pour les workflows spécialisés (RBAC, scaffold module, UI patterns).
