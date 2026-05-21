---
name: texta-module-scaffold
description: Scaffolder un nouveau module métier Texta (router, model, schema, migration, page). Utiliser quand on ajoute un module API ou une section UI.
---

# Skill — Scaffold module

## Checklist API

1. Modèle SQLAlchemy dans `src/models/` avec `organization_id`
2. Schémas Pydantic dans `src/schemas/`
3. Router dans `src/routers/` avec `Depends(get_current_user)` ou `PermissionEngine`
4. Enregistrer dans `src/routers/__init__.py`
5. Migration Alembic
6. Tests pytest basiques

## Checklist Web

1. Types dans `src/types/index.ts`
2. Page sous `src/app/(app)/<module>/page.tsx`
3. Entrée sidebar dans `src/components/layout/sidebar.tsx`

## Nommage

- Route API : `/api/v1/<module>`
- Label UI français
