"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, GanttChartSquare, LayoutList, LayoutPanelLeft, Plus, Search, Timer, Trash2, X } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { Project, Task, TaskKpis, User } from "@/types";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const STATUS_LABELS: Record<string, string> = {
  todo: "À faire",
  in_progress: "En cours",
  in_review: "En revue",
  done: "Terminé",
  blocked: "Bloquée",
};

const INITIAL_FORM = {
  title: "",
  description: "",
  project_id: "",
  parent_id: "",
  category: "",
  tags: "",
  milestone: "",
  start_date: "",
  due_date: "",
  priority: "medium",
  assignee_id: "",
  reviewer_id: "",
  estimated_hours: "1",
  hourly_rate: "",
  billable: false,
  checklist: "",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [kpis, setKpis] = useState<TaskKpis | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [view, setView] = useState<"kanban" | "list" | "calendar" | "gantt">("kanban");
  const [projectId, setProjectId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Task["status"] | "all">("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<Task["priority"] | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"due_date" | "priority" | "created" | "estimated_hours">("due_date");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createTab, setCreateTab] = useState<"info" | "planning" | "assign" | "checklist">("info");
  const [form, setForm] = useState(INITIAL_FORM);
  const [drawerTask, setDrawerTask] = useState<Task | null>(null);
  const [drawerTab, setDrawerTab] = useState<"details" | "checklist" | "comments" | "documents" | "history">(
    "details",
  );
  const [commentText, setCommentText] = useState("");
  const [timeLogHours, setTimeLogHours] = useState("1");
  const [timeLogDesc, setTimeLogDesc] = useState("");

  const load = useCallback(() => {
    const queryParams = new URLSearchParams();
    if (projectId) queryParams.set("project_id", projectId);
    if (statusFilter !== "all") queryParams.set("status", statusFilter);
    if (assigneeFilter !== "all") queryParams.set("assignee_id", assigneeFilter);
    if (priorityFilter !== "all") queryParams.set("priority", priorityFilter);
    if (categoryFilter !== "all") queryParams.set("category", categoryFilter);
    if (search.trim()) queryParams.set("q", search.trim());
    const suffix = queryParams.toString() ? `?${queryParams.toString()}` : "";

    api<Task[]>(`/tasks${suffix}`)
      .then(setTasks)
      .catch((err) => setError(err instanceof Error ? err.message : "Impossible de charger les tâches"));
    api<Project[]>("/projects")
      .then(setProjects)
      .catch(() => setProjects([]));
    api<User[]>("/users")
      .then(setUsers)
      .catch(() => setUsers([]));
    if (projectId) {
      api<TaskKpis>(`/tasks/kpis?project_id=${projectId}`)
        .then(setKpis)
        .catch(() => setKpis(null));
    } else {
      setKpis(null);
    }
  }, [projectId, statusFilter, assigneeFilter, priorityFilter, categoryFilter, search]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const preselectedProjectId = new URL(window.location.href).searchParams.get("project_id") || "";
    if (preselectedProjectId) {
      setProjectId(preselectedProjectId);
      setForm((prev) => ({ ...prev, project_id: preselectedProjectId }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const doneRate = useMemo(() => {
    if (tasks.length === 0) return 0;
    return Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100);
  }, [tasks]);

  const categories = useMemo(() => {
    const set = new Set(tasks.map((task) => task.category).filter(Boolean) as string[]);
    return Array.from(set);
  }, [tasks]);

  const sortedTasks = useMemo(() => {
    const rows = [...tasks];
    const priorityWeight: Record<string, number> = { critical: 5, urgent: 4, high: 3, medium: 2, low: 1 };
    rows.sort((a, b) => {
      if (sortBy === "due_date") return (a.due_date || "").localeCompare(b.due_date || "");
      if (sortBy === "priority") return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
      if (sortBy === "estimated_hours") return (b.estimated_hours || 0) - (a.estimated_hours || 0);
      return (b.created_at || "").localeCompare(a.created_at || "");
    });
    return rows;
  }, [tasks, sortBy]);

  const createTask = async (keepOpen: boolean) => {
    if (!form.title.trim() || !form.project_id || !form.due_date || !form.assignee_id) {
      setError("Veuillez renseigner les champs obligatoires.");
      return;
    }
    setError("");
    try {
      await api("/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          project_id: form.project_id,
          parent_id: form.parent_id || null,
          category: form.category || null,
          tags: form.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          start_date: form.start_date || null,
          due_date: form.due_date,
          priority: form.priority,
          assignee_id: form.assignee_id,
          reviewer_id: form.reviewer_id || null,
          estimated_hours: Number(form.estimated_hours || "0"),
          hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
          billable: form.billable,
          checklist: form.checklist
            .split("\n")
            .map((label) => label.trim())
            .filter(Boolean)
            .map((label) => ({ label, completed: false })),
        }),
      });
      setToast("Tâche créée");
      if (keepOpen) {
        setForm((prev) => ({ ...INITIAL_FORM, project_id: prev.project_id }));
      } else {
        setCreateOpen(false);
        setForm(INITIAL_FORM);
      }
      load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError("Permission insuffisante pour créer une tâche sur ce projet.");
      } else {
        setError(err instanceof Error ? err.message : "Erreur de création");
      }
    }
  };

  const updateStatus = async (taskId: string, status: Task["status"], extra: Record<string, unknown> = {}) => {
    try {
      await api(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status, ...extra }),
      });
      setToast("Statut mis à jour");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de mise à jour");
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await api(`/tasks/${taskId}`, { method: "DELETE" });
      setToast("Tâche supprimée");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de suppression");
    }
  };

  const addComment = async () => {
    if (!drawerTask || !commentText.trim()) return;
    try {
      const updated = await api<Task>(`/tasks/${drawerTask.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: commentText }),
      });
      setDrawerTask(updated);
      setCommentText("");
      setToast("Commentaire ajouté");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur commentaire");
    }
  };

  const saveChecklist = async () => {
    if (!drawerTask) return;
    try {
      const updated = await api<Task>(`/tasks/${drawerTask.id}`, {
        method: "PATCH",
        body: JSON.stringify({ checklist: drawerTask.checklist || [] }),
      });
      setDrawerTask(updated);
      setToast("Checklist mise à jour");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de mise à jour");
    }
  };

  const logTime = async () => {
    if (!drawerTask || !timeLogHours) return;
    try {
      const updated = await api<Task>(`/tasks/${drawerTask.id}/time-logs`, {
        method: "POST",
        body: JSON.stringify({
          date: new Date().toISOString().slice(0, 10),
          hours: Number(timeLogHours),
          description: timeLogDesc || null,
        }),
      });
      setDrawerTask(updated);
      setTimeLogDesc("");
      setToast("Temps enregistré");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur log time");
    }
  };

  const exportCsv = async () => {
    if (!projectId) {
      setError("Sélectionnez un projet pour exporter.");
      return;
    }
    const csv = await api<string>(`/tasks/export?project_id=${projectId}`);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "tasks_export.csv";
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Tâches</h1>
          <p className="mt-1 text-sm text-slate-500">
            {tasks.length} tâches, {doneRate}% terminées.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          Nouvelle tâche
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase text-slate-500">Tâches totales</p>
          <p className="text-2xl font-bold text-slate-900">{kpis?.total || 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-slate-500">En cours</p>
          <p className="text-2xl font-bold text-blue-700">{kpis?.in_progress || 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-slate-500">Terminées</p>
          <p className="text-2xl font-bold text-emerald-700">{kpis?.done || 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-slate-500">Bloquées</p>
          <p className="text-2xl font-bold text-rose-700">{kpis?.blocked || 0}</p>
        </Card>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              className="w-full rounded-xl border border-slate-200 px-8 py-2 text-sm"
              placeholder="Recherche tâche, code, description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Projet (obligatoire KPI/export)</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Task["status"] | "all")}>
            <option value="all">Tous statuts</option>
            <option value="todo">À faire</option>
            <option value="in_progress">En cours</option>
            <option value="in_review">En revue</option>
            <option value="done">Terminée</option>
            <option value="blocked">Bloquée</option>
          </select>
          <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
            <option value="all">Tous assignés</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>
          <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as Task["priority"] | "all")}>
            <option value="all">Toutes priorités</option>
            <option value="critical">Critique</option>
            <option value="urgent">Urgente</option>
            <option value="high">Haute</option>
            <option value="medium">Moyenne</option>
            <option value="low">Basse</option>
          </select>
          <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">Toutes catégories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
            <option value="due_date">Échéance</option>
            <option value="priority">Priorité</option>
            <option value="created">Date création</option>
            <option value="estimated_hours">Temps estimé</option>
          </select>
          <Button variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
          <div className="ml-auto flex rounded-xl border border-slate-200 bg-white p-1">
            <Button variant={view === "kanban" ? "primary" : "ghost"} className="rounded-lg" onClick={() => setView("kanban")}>
              <LayoutPanelLeft size={16} />
              Kanban
            </Button>
            <Button variant={view === "list" ? "primary" : "ghost"} className="rounded-lg" onClick={() => setView("list")}>
              <LayoutList size={16} />
              Liste
            </Button>
            <Button variant={view === "calendar" ? "primary" : "ghost"} className="rounded-lg" onClick={() => setView("calendar")}>
              <CalendarDays size={16} />
              Calendrier
            </Button>
            <Button variant={view === "gantt" ? "primary" : "ghost"} className="rounded-lg" onClick={() => setView("gantt")}>
              <GanttChartSquare size={16} />
              Gantt
            </Button>
          </div>
        </div>
      </Card>

      {view === "kanban" ? (
        <KanbanBoard tasks={sortedTasks} onUpdate={load} onOpenTask={setDrawerTask} />
      ) : view === "list" ? (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {sortedTasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-xs text-slate-400">{task.task_code || "TSK-..."}</p>
                  <p className="font-medium text-slate-800">{task.title}</p>
                  <p className="text-xs text-slate-500">
                    Priorité: {task.priority}
                    {task.due_date ? ` · Échéance: ${task.due_date}` : ""}
                    {(task.delay_days || 0) > 0 ? ` · ⚠️ ${task.delay_days}j retard` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge status={task.status} label={STATUS_LABELS[task.status]} />
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                    value={task.status}
                    onChange={(e) => {
                      const next = e.target.value as Task["status"];
                      if (next === "blocked") {
                        const reason = window.prompt("Raison de blocage obligatoire");
                        if (!reason) return;
                        updateStatus(task.id, next, { block_reason: reason });
                      } else if (task.status === "blocked") {
                        const note = window.prompt("Note de déblocage obligatoire");
                        if (!note) return;
                        updateStatus(task.id, next, { unblock_note: note });
                      } else {
                        updateStatus(task.id, next);
                      }
                    }}
                  >
                    <option value="todo">À faire</option>
                    <option value="in_progress">En cours</option>
                    <option value="in_review">En revue</option>
                    <option value="done">Terminée</option>
                    <option value="blocked">Bloquée</option>
                  </select>
                  <Button size="sm" variant="ghost" onClick={() => setDrawerTask(task)}>
                    Détail
                  </Button>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Supprimer la tâche"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : view === "calendar" ? (
        <Card className="space-y-2 p-4">
          {sortedTasks.map((task) => (
            <button
              key={task.id}
              onClick={() => setDrawerTask(task)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span>{task.title}</span>
              <span className="text-slate-500">{task.due_date || "Sans échéance"}</span>
            </button>
          ))}
          {sortedTasks.length === 0 && <p className="text-sm text-slate-500">Aucune tâche pour cette période.</p>}
        </Card>
      ) : (
        <Card className="space-y-3 p-4">
          {sortedTasks.map((task) => {
            const progress = task.completion_percentage || 0;
            return (
              <button
                key={task.id}
                onClick={() => setDrawerTask(task)}
                className="w-full rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-800">{task.title}</p>
                  <p className="text-xs text-slate-500">{task.start_date || "N/A"} → {task.due_date || "N/A"}</p>
                </div>
                <div className="mt-2 h-2 rounded bg-slate-100">
                  <div className="h-2 rounded bg-indigo-500" style={{ width: `${progress}%` }} />
                </div>
              </button>
            );
          })}
          {sortedTasks.length === 0 && <p className="text-sm text-slate-500">Aucune tâche à afficher en Gantt.</p>}
        </Card>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/30">
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Nouvelle Tâche</h2>
              <button onClick={() => setCreateOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              <Button size="sm" variant={createTab === "info" ? "primary" : "secondary"} onClick={() => setCreateTab("info")}>
                📋 Informations
              </Button>
              <Button size="sm" variant={createTab === "planning" ? "primary" : "secondary"} onClick={() => setCreateTab("planning")}>
                📅 Planification
              </Button>
              <Button size="sm" variant={createTab === "assign" ? "primary" : "secondary"} onClick={() => setCreateTab("assign")}>
                👤 Assignation
              </Button>
              <Button size="sm" variant={createTab === "checklist" ? "primary" : "secondary"} onClick={() => setCreateTab("checklist")}>
                ✅ Checklist
              </Button>
            </div>

            {createTab === "info" && (
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} placeholder="Nom tâche *" />
                <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.project_id} onChange={(e) => setForm((s) => ({ ...s, project_id: e.target.value }))}>
                  <option value="">Projet parent *</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.parent_id} onChange={(e) => setForm((s) => ({ ...s, parent_id: e.target.value }))}>
                  <option value="">Tâche parente</option>
                  {tasks
                    .filter((task) => task.project_id === form.project_id)
                    .map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                </select>
                <Input value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))} placeholder="Catégorie" />
                <Input value={form.tags} onChange={(e) => setForm((s) => ({ ...s, tags: e.target.value }))} placeholder="Tags (virgules)" className="md:col-span-2" />
                <textarea className="min-h-24 rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2" value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} placeholder="Description détaillée" />
              </div>
            )}

            {createTab === "planning" && (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm text-slate-600">
                  Date début
                  <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" type="date" value={form.start_date} onChange={(e) => setForm((s) => ({ ...s, start_date: e.target.value }))} />
                </label>
                <label className="text-sm text-slate-600">
                  Date échéance *
                  <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" type="date" value={form.due_date} onChange={(e) => setForm((s) => ({ ...s, due_date: e.target.value }))} />
                </label>
                <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.priority} onChange={(e) => setForm((s) => ({ ...s, priority: e.target.value }))}>
                  <option value="critical">Critique</option>
                  <option value="urgent">Urgente</option>
                  <option value="high">Haute</option>
                  <option value="medium">Moyenne</option>
                  <option value="low">Basse</option>
                </select>
                <Input value={form.milestone || ""} onChange={(e) => setForm((s) => ({ ...s, milestone: e.target.value }))} placeholder="Jalon (optionnel)" />
              </div>
            )}

            {createTab === "assign" && (
              <div className="grid gap-3 md:grid-cols-2">
                <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.assignee_id} onChange={(e) => setForm((s) => ({ ...s, assignee_id: e.target.value }))}>
                  <option value="">Assigné à *</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </select>
                <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.reviewer_id} onChange={(e) => setForm((s) => ({ ...s, reviewer_id: e.target.value }))}>
                  <option value="">Réviseur</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </select>
                <Input type="number" value={form.estimated_hours} onChange={(e) => setForm((s) => ({ ...s, estimated_hours: e.target.value }))} placeholder="Heures estimées *" />
                <Input type="number" value={form.hourly_rate} onChange={(e) => setForm((s) => ({ ...s, hourly_rate: e.target.value }))} placeholder="Taux horaire" />
                <label className="inline-flex items-center gap-2 text-sm text-slate-600 md:col-span-2">
                  <input type="checkbox" checked={form.billable} onChange={(e) => setForm((s) => ({ ...s, billable: e.target.checked }))} />
                  Facturable
                </label>
              </div>
            )}

            {createTab === "checklist" && (
              <textarea className="min-h-36 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.checklist} onChange={(e) => setForm((s) => ({ ...s, checklist: e.target.value }))} placeholder="Un élément par ligne" />
            )}
            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Annuler
              </Button>
              <Button variant="secondary" onClick={() => createTask(true)}>
                Créer & créer une autre
              </Button>
              <Button onClick={() => createTask(false)}>Créer la tâche</Button>
            </div>
          </div>
        </div>
      )}

      {drawerTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/30">
          <div className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">{drawerTask.task_code || "TSK-..."}</p>
                <h2 className="text-xl font-semibold">{drawerTask.title}</h2>
                <Badge status={drawerTask.status} label={STATUS_LABELS[drawerTask.status]} />
              </div>
              <button onClick={() => setDrawerTask(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Button size="sm" variant={drawerTab === "details" ? "primary" : "secondary"} onClick={() => setDrawerTab("details")}>
                📋 Détails
              </Button>
              <Button size="sm" variant={drawerTab === "checklist" ? "primary" : "secondary"} onClick={() => setDrawerTab("checklist")}>
                ✅ Checklist
              </Button>
              <Button size="sm" variant={drawerTab === "comments" ? "primary" : "secondary"} onClick={() => setDrawerTab("comments")}>
                💬 Commentaires
              </Button>
              <Button size="sm" variant={drawerTab === "documents" ? "primary" : "secondary"} onClick={() => setDrawerTab("documents")}>
                📎 Docs
              </Button>
              <Button size="sm" variant={drawerTab === "history" ? "primary" : "secondary"} onClick={() => setDrawerTab("history")}>
                📈 Historique
              </Button>
            </div>

            {drawerTab === "details" && (
              <div className="space-y-2 text-sm">
                <p><span className="font-semibold">Description:</span> {drawerTask.description || "Aucune"}</p>
                <p><span className="font-semibold">Projet:</span> {drawerTask.project_id}</p>
                <p><span className="font-semibold">Dates:</span> {drawerTask.start_date || "N/A"} → {drawerTask.due_date || "N/A"}</p>
                <p><span className="font-semibold">Temps:</span> {drawerTask.actual_hours || 0}h / {drawerTask.estimated_hours || 0}h</p>
                <p><span className="font-semibold">Assigné:</span> {drawerTask.assignee_id || "N/A"}</p>
                <p><span className="font-semibold">Réviseur:</span> {drawerTask.reviewer_id || "N/A"}</p>
                <p><span className="font-semibold">Facturable:</span> {drawerTask.billable ? "Oui" : "Non"}</p>
                <p><span className="font-semibold">Taux horaire:</span> {drawerTask.hourly_rate || 0}</p>
              </div>
            )}

            {drawerTab === "checklist" && (
              <div className="space-y-2">
                {(drawerTask.checklist || []).map((item, idx) => (
                  <label key={`${item.label}-${idx}`} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={(e) => {
                        const next = [...(drawerTask.checklist || [])];
                        next[idx] = {
                          ...next[idx],
                          completed: e.target.checked,
                          completed_at: e.target.checked ? new Date().toISOString() : undefined,
                        };
                        setDrawerTask({ ...drawerTask, checklist: next });
                      }}
                    />
                    {item.label}
                  </label>
                ))}
                <Button size="sm" onClick={saveChecklist}>
                  Sauvegarder checklist
                </Button>
              </div>
            )}

            {drawerTab === "comments" && (
              <div className="space-y-3">
                <div className="max-h-64 space-y-2 overflow-auto">
                  {(drawerTask.comments || []).map((comment, idx) => (
                    <div key={`${comment.created_at}-${idx}`} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                      <p className="font-medium text-slate-800">{comment.author_name || comment.author_id}</p>
                      <p className="text-slate-600">{comment.content}</p>
                      <p className="text-xs text-slate-400">{new Date(comment.created_at).toLocaleString("fr-FR")}</p>
                    </div>
                  ))}
                </div>
                <textarea className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Ajouter un commentaire" value={commentText} onChange={(e) => setCommentText(e.target.value)} />
                <Button size="sm" onClick={addComment}>Envoyer</Button>
              </div>
            )}

            {drawerTab === "documents" && (
              <div className="space-y-2">
                {(drawerTask.attachments || []).length === 0 ? (
                  <p className="text-sm text-slate-500">Aucune pièce jointe.</p>
                ) : (
                  (drawerTask.attachments || []).map((doc) => (
                    <div key={doc} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                      {doc}
                    </div>
                  ))
                )}
              </div>
            )}

            {drawerTab === "history" && (
              <ul className="space-y-2 text-sm text-slate-600">
                <li>Tâche créée le {new Date(drawerTask.created_at || new Date().toISOString()).toLocaleString("fr-FR")}.</li>
                <li>Statut actuel: {STATUS_LABELS[drawerTask.status]}.</li>
                <li>
                  Heures: {drawerTask.actual_hours || 0} / {drawerTask.estimated_hours || 0}
                  {(drawerTask.actual_hours || 0) > (drawerTask.estimated_hours || 0) * 1.2 ? " ⚠️ dépassement" : ""}
                </li>
              </ul>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <Button size="sm" variant="secondary" onClick={() => updateStatus(drawerTask.id, "in_progress")}>
                ▶️ Démarrer
              </Button>
              <Button size="sm" variant="secondary" onClick={() => updateStatus(drawerTask.id, "in_review")}>
                🔄 Soumettre revue
              </Button>
              <Button size="sm" variant="secondary" onClick={() => updateStatus(drawerTask.id, "done")}>
                ✅ Terminer
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const reason = window.prompt("Raison de blocage");
                  if (!reason) return;
                  updateStatus(drawerTask.id, "blocked", { block_reason: reason });
                }}
              >
                🚫 Bloquer
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Input type="number" value={timeLogHours} onChange={(e) => setTimeLogHours(e.target.value)} className="w-20" />
                <Input value={timeLogDesc} onChange={(e) => setTimeLogDesc(e.target.value)} placeholder="Description" className="w-40" />
                <Button size="sm" onClick={logTime}>
                  <Timer size={14} />
                  Log time
                </Button>
              </div>
            </div>
            <div className="mt-3">
              <Button size="sm" variant="ghost" onClick={() => deleteTask(drawerTask.id)}>
                <Trash2 size={14} />
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
