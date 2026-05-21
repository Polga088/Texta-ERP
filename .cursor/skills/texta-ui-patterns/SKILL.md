---
name: texta-ui-patterns
description: Patterns UI Texta — kanban, calendrier, organigramme, dashboard cards. Utiliser pour pages frontend métier.
---

# Skill — UI Patterns Texta

## Kanban tâches

- `@dnd-kit/core` + colonnes todo/in_progress/in_review/done
- Composant : `src/components/tasks/kanban-board.tsx`
- PATCH `/tasks/{id}` avec `{ status }` au drop

## Calendrier

- Vue semaine avec `date-fns`
- Liste événements sous la grille
- Page : `/calendar`

## Dashboard

- Cards stats depuis `GET /dashboard/stats`

## Layout

- Sidebar fixe `src/components/layout/sidebar.tsx`
- Auth guard dans `(app)/layout.tsx`

## Design tokens

- Primaire : indigo-600
- Fond app : slate-50 / slate-950 sidebar
