"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutList, LayoutPanelLeft, Pencil, Plus, Trash2, X } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { Project, Task } from "@/types";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const STATUS_LABELS: Record<string, string> = {
  todo: "À faire",
  in_progress: "En cours",
  in_review: "En revue",
  done: "Terminé",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<"kanban" | "list">("list");
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [error, setError] = useState("");
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskForm, setEditTaskForm] = useState({
    title: "",
    description: "",
    status: "todo",
    priority: "medium",
    due_date: "",
    project_id: "",
  });

  const load = useCallback(() => {
    api<Task[]>("/tasks")
      .then(setTasks)
      .catch((err) => setError(err instanceof Error ? err.message : "Impossible de charger les tâches"));
    api<Project[]>("/projects")
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const doneRate = useMemo(() => {
    if (tasks.length === 0) return 0;
    return Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100);
  }, [tasks]);

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoadingCreate(true);
    setError("");
    try {
      await api("/tasks", {
        method: "POST",
        body: JSON.stringify({
          title,
          priority,
          project_id: projectId || null,
        }),
      });
      setTitle("");
      setProjectId("");
      setPriority("medium");
      load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError("Permission insuffisante pour créer une tâche sur ce projet.");
      } else {
        setError(err instanceof Error ? err.message : "Erreur de création");
      }
    } finally {
      setLoadingCreate(false);
    }
  };

  const updateStatus = async (taskId: string, status: Task["status"]) => {
    try {
      await api(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de mise à jour");
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await api(`/tasks/${taskId}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de suppression");
    }
  };

  const beginEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTaskForm({
      title: task.title,
      description: task.description || "",
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || "",
      project_id: task.project_id || "",
    });
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditTaskForm({
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      due_date: "",
      project_id: "",
    });
  };

  const saveTask = async () => {
    if (!editingTaskId) return;
    try {
      await api(`/tasks/${editingTaskId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editTaskForm.title,
          description: editTaskForm.description || null,
          status: editTaskForm.status,
          priority: editTaskForm.priority,
          due_date: editTaskForm.due_date || null,
          project_id: editTaskForm.project_id || null,
        }),
      });
      setError("");
      cancelEditTask();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de mise à jour");
    }
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
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          <Button
            variant={view === "kanban" ? "primary" : "ghost"}
            className="rounded-lg"
            onClick={() => setView("kanban")}
          >
            <LayoutPanelLeft size={16} />
            Kanban
          </Button>
          <Button
            variant={view === "list" ? "primary" : "ghost"}
            className="rounded-lg"
            onClick={() => setView("list")}
          >
            <LayoutList size={16} />
            Liste
          </Button>
        </div>
      </div>

      <Card>
        <form onSubmit={createTask} className="grid gap-3 md:grid-cols-4">
          <input
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            placeholder="Nouvelle tâche..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">Sans projet</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Task["priority"])}
          >
            <option value="low">Priorité basse</option>
            <option value="medium">Priorité moyenne</option>
            <option value="high">Priorité haute</option>
            <option value="urgent">Priorité urgente</option>
          </select>
          <Button type="submit" disabled={loadingCreate}>
            <Plus size={16} />
            {loadingCreate ? "Création..." : "Créer"}
          </Button>
        </form>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      </Card>

      {view === "kanban" ? (
        <KanbanBoard tasks={tasks} onUpdate={load} />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-4 px-4 py-3">
                {editingTaskId === task.id ? (
                  <div className="grid w-full gap-2 md:grid-cols-6">
                    <input
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm md:col-span-2"
                      value={editTaskForm.title}
                      onChange={(e) => setEditTaskForm((s) => ({ ...s, title: e.target.value }))}
                    />
                    <select
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={editTaskForm.status}
                      onChange={(e) => setEditTaskForm((s) => ({ ...s, status: e.target.value }))}
                    >
                      <option value="todo">À faire</option>
                      <option value="in_progress">En cours</option>
                      <option value="in_review">En revue</option>
                      <option value="done">Terminé</option>
                    </select>
                    <select
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={editTaskForm.priority}
                      onChange={(e) => setEditTaskForm((s) => ({ ...s, priority: e.target.value }))}
                    >
                      <option value="low">Basse</option>
                      <option value="medium">Moyenne</option>
                      <option value="high">Haute</option>
                      <option value="urgent">Urgente</option>
                    </select>
                    <input
                      type="date"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={editTaskForm.due_date}
                      onChange={(e) => setEditTaskForm((s) => ({ ...s, due_date: e.target.value }))}
                    />
                    <select
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={editTaskForm.project_id}
                      onChange={(e) => setEditTaskForm((s) => ({ ...s, project_id: e.target.value }))}
                    >
                      <option value="">Sans projet</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                    <textarea
                      className="min-h-16 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm md:col-span-4"
                      value={editTaskForm.description}
                      onChange={(e) => setEditTaskForm((s) => ({ ...s, description: e.target.value }))}
                      placeholder="Description"
                    />
                    <div className="flex items-center gap-2 md:col-span-2 md:justify-end">
                      <Button size="sm" onClick={saveTask}>
                        Enregistrer
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEditTask}>
                        <X size={14} />
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="font-medium text-slate-800">{task.title}</p>
                      <p className="text-xs text-slate-500">
                        Priorité: {task.priority}
                        {task.due_date ? ` · Échéance: ${task.due_date}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge status={task.status} label={STATUS_LABELS[task.status]} />
                      <select
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                        value={task.status}
                        onChange={(e) => updateStatus(task.id, e.target.value as Task["status"])}
                      >
                        <option value="todo">À faire</option>
                        <option value="in_progress">En cours</option>
                        <option value="in_review">En revue</option>
                        <option value="done">Terminé</option>
                      </select>
                      <button
                        onClick={() => beginEditTask(task)}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
                        aria-label="Éditer la tâche"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Supprimer la tâche"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
