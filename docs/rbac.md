# RBAC & Organigramme d'habilitation

## Rôles globaux (organisation)

| Rôle | Code | Capacités |
|------|------|-----------|
| Administrateur | `admin` | Accès total |
| Responsable RH | `hr_manager` | Module RH, congés |
| Chef de projet | `project_manager` | Création projets, vue étendue |
| Membre | `member` | Accès limité par défaut |

## Permissions projet

| Permission | Code | Description |
|------------|------|-------------|
| Voir | `view` | Lire le projet |
| Éditer tâches | `edit_tasks` | CRUD tâches |
| Gérer membres | `manage_members` | Accorder/révoquer habilitations |
| Gérer paramètres | `manage_settings` | Modifier le projet |

## Grants délégués

Le chef de projet (owner) ou un admin peut créer un `ProjectPermissionGrant` :

- **grantee_type** : `user` ou `group`
- **grantee_id** : UUID utilisateur ou groupe
- **permissions** : liste de codes permission
- **expires_at** : optionnel

## Ordre d'évaluation (`PermissionEngine`)

1. `admin` → toutes permissions
2. `owner_id == user.id` → toutes permissions projet
3. `project_manager` global → view + edit_tasks
4. Grants actifs (user direct ou via groupe)
5. `member` sans grant → `view` uniquement si politique par défaut

## Audit

Actions `grant.create`, `grant.revoke`, `user.create` sont journalisées dans `audit_logs` (admin UI).
