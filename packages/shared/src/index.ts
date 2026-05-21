export const PROJECT_PERMISSIONS = [
  "view",
  "edit_tasks",
  "manage_members",
  "manage_settings",
] as const;

export type ProjectPermission = (typeof PROJECT_PERMISSIONS)[number];

export const GLOBAL_ROLES = [
  "admin",
  "hr_manager",
  "project_manager",
  "member",
] as const;

export type GlobalRole = (typeof GLOBAL_ROLES)[number];

export const TASK_STATUSES = ["todo", "in_progress", "in_review", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const PROJECT_STATUSES = ["lead", "active", "on_hold", "completed", "cancelled"] as const;

export const STATUS_LABELS: Record<string, string> = {
  todo: "À faire",
  in_progress: "En cours",
  in_review: "En revue",
  done: "Terminé",
  lead: "Prospect",
  active: "Actif",
  on_hold: "En pause",
  completed: "Terminé",
  cancelled: "Annulé",
  draft: "Brouillon",
  submitted: "Soumis",
  approved: "Approuvé",
  rejected: "Refusé",
};
