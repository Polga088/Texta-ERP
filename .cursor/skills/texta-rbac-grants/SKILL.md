---
name: texta-rbac-grants
description: Modèle habilitations projet Texta — grants user/groupe, PermissionEngine, tests. Utiliser pour permissions, habilitations, groupes, organigramme.
---

# Skill — Habilitations Texta

## Modèle

- `ProjectPermissionGrant` : project_id, grantee_type (user|group), grantee_id, permissions[]
- Évaluation : `src/modules/permissions/engine.py`

## API

- `GET /projects/{id}/grants`
- `POST /projects/{id}/grants` — body GrantCreate
- `DELETE /projects/{id}/grants/{grant_id}`
- `GET /projects/{id}/permissions/effective`

## Tests à couvrir

- Admin voit tout
- Owner a manage_*
- Grant groupe donne edit_tasks au membre
- Grant expiré ignoré

## UI

Page `/permissions` + détail projet `/projects/[id]`
