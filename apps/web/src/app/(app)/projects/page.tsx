"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Project, ProjectKpis, User } from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, Plus, Search, X } from "lucide-react";

const STATUS_FR: Record<string, string> = {
  draft: "Brouillon",
  planning: "Planification",
  in_progress: "En cours",
  in_review: "En revue",
  done: "Terminé",
  on_hold: "En pause",
  cancelled: "Annulé",
  lead: "Prospect",
  active: "Actif",
  completed: "Terminé",
};
const STATUS_ORDER: Project["status"][] = [
  "draft",
  "planning",
  "in_progress",
  "on_hold",
  "in_review",
  "done",
  "cancelled",
];
const PRIORITY_COLOR: Record<string, string> = {
  critical: "bg-rose-600",
  high: "bg-orange-500",
  medium: "bg-amber-400",
  low: "bg-slate-300",
};

const INITIAL_FORM = {
  name: "",
  project_type: "internal",
  category: "",
  description: "",
  visibility: "private",
  tags: "",
  start_date: "",
  end_date: "",
  priority: "medium",
  project_manager_id: "",
  budget: "",
  currency: "MAD",
  hourly_rate: "",
  budget_alert_threshold: 80,
  deliverables: "",
  team_members: "",
};

function formatCurrency(value?: number, currency = "MAD") {
  if (!value) return `0 ${currency}`;
  return `${new Intl.NumberFormat("fr-MA").format(value)} ${currency}`;
}

function ProjectCard({
  project,
  onOpen,
}: {
  project: Project;
  onOpen: (project: Project) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: project.id });
  const style = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.6 : 1,
  };
  const members = project.team_members || [];
  const teamPreview = members.slice(0, 3);
  const budgetPercent =
    project.budget && project.budget > 0
      ? Math.min(Math.round(((project.budget_consumed || 0) / project.budget) * 100), 100)
      : 0;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className="group relative cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md"
      {...listeners}
      {...attributes}
      onDoubleClick={() => onOpen(project)}
    >
      <div className={`absolute left-0 top-0 h-1 w-full ${PRIORITY_COLOR[project.priority || "low"]}`} />
      <p className="mt-1 text-xs font-medium text-slate-400">{project.project_code || "PRJ-XXXX"}</p>
      <p className="text-sm font-semibold text-slate-900">{project.name}</p>
      <p className="mt-1 text-xs text-slate-500">
        {(project.project_type || "internal").toUpperCase()}
        {project.company_name ? ` · ${project.company_name}` : ""}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {(project.start_date || "N/A") + " → " + (project.end_date || "N/A")}
        {(project.delay_days || 0) > 0 ? ` · ⏰ ${project.delay_days}j retard` : ""}
      </p>
      <div className="mt-2">
        <p className="text-xs text-slate-500">
          {formatCurrency(project.budget_consumed, project.currency)} / {formatCurrency(project.budget, project.currency)}
        </p>
        <div className="mt-1 h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${budgetPercent}%` }} />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs font-medium text-slate-600">{project.completion_percentage || 0}%</p>
        <span className="text-xs">
          {project.health_status === "danger" ? "🔴" : project.health_status === "watch" ? "🟡" : "🟢"}
        </span>
      </div>
      <div className="mt-2 flex -space-x-2">
        {teamPreview.map((member) => (
          <span
            key={`${project.id}-${member.user_id}`}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white bg-indigo-100 text-[10px] font-semibold text-indigo-700"
            title={member.role}
          >
            {member.role.slice(0, 1).toUpperCase()}
          </span>
        ))}
        {members.length > 3 && (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white bg-slate-100 text-[10px] font-semibold text-slate-600">
            +{members.length - 3}
          </span>
        )}
      </div>
    </article>
  );
}

function ProjectColumn({
  status,
  projects,
  onOpen,
}: {
  status: Project["status"];
  projects: Project[];
  onOpen: (project: Project) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      className={`kanban-column min-h-[360px] rounded-2xl border bg-white p-3 shadow-sm transition ${
        isOver ? "border-indigo-300 bg-indigo-50/40" : "border-slate-200"
      }`}
    >
      <div className="kanban-column-header mb-3 flex items-center justify-between">
        <Badge status={status} label={STATUS_FR[status] || status} />
        <span className="text-xs text-slate-400">{projects.length}</span>
      </div>
      <div className="kanban-cards-container space-y-2 md:space-y-2">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} onOpen={onOpen} />
        ))}
        {projects.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-4 text-xs text-slate-400">Aucun projet</p>}
      </div>
    </section>
  );
}

export default function ProjectsPage() {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [projects, setProjects] = useState<Project[]>([]);
  const [kpis, setKpis] = useState<ProjectKpis | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Project["status"] | "all">("all");
  const [pmFilter, setPmFilter] = useState<string>("all");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createTab, setCreateTab] = useState<"general" | "planning" | "budget" | "team">("general");
  const [form, setForm] = useState(INITIAL_FORM);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const load = async () => {
    const [projectRows, kpiRows] = await Promise.all([api<Project[]>("/projects"), api<ProjectKpis>("/projects/kpis")]);
    setProjects(projectRows);
    setKpis(kpiRows);
  };

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Erreur chargement projets"));
    api<User[]>("/users")
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  const filtered = useMemo(() => {
    return projects.filter((project) => {
      const statusOk = statusFilter === "all" ? true : project.status === statusFilter;
      const pmOk = pmFilter === "all" ? true : (project.project_manager_id || "") === pmFilter;
      const q = search.toLowerCase();
      const text = `${project.name} ${project.project_code || ""} ${project.company_name || ""} ${project.description || ""}`.toLowerCase();
      return statusOk && pmOk && (!q || text.includes(q));
    });
  }, [projects, statusFilter, pmFilter, search]);

  const grouped = useMemo(() => {
    return STATUS_ORDER.reduce(
      (acc, status) => {
        acc[status] = filtered.filter((project) => project.status === status);
        return acc;
      },
      {} as Record<Project["status"], Project[]>,
    );
  }, [filtered]);

  const kpiCards = useMemo(() => {
    if (!kpis) return [];
    return [
      { label: "Projets actifs", value: String(kpis.active_count), tone: "text-blue-700", icon: "📌" },
      { label: "Projets terminés", value: `${kpis.completed_count} (${kpis.completed_percent}%)`, tone: "text-emerald-700", icon: "✅" },
      { label: "Projets en retard", value: String(kpis.delayed_count), tone: "text-rose-700", icon: "⏰" },
      { label: "Projets en pause", value: String(kpis.paused_count), tone: "text-amber-700", icon: "⏸️" },
      { label: "Achèvement moyen", value: `${kpis.completion_avg}%`, tone: "text-violet-700", icon: "📈" },
      { label: "Budget consommé", value: `${kpis.budget_consumed_percent}%`, tone: "text-orange-700", icon: "💰" },
      { label: "Heures ce mois", value: `${kpis.hours_month}h`, tone: "text-sky-700", icon: "🕒" },
      { label: "Projets à risque", value: String(kpis.risk_count), tone: "text-red-700", icon: "⚠️" },
    ];
  }, [kpis]);

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const project = projects.find((row) => row.id === String(active.id));
    if (!project) return;
    const targetStatus = STATUS_ORDER.includes(over.id as Project["status"])
      ? (over.id as Project["status"])
      : projects.find((row) => row.id === String(over.id))?.status;
    if (!targetStatus || targetStatus === project.status) return;
    try {
      await api(`/projects/${project.id}`, { method: "PATCH", body: JSON.stringify({ status: targetStatus }) });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de déplacer le projet");
    }
  };

  const createProject = async (toTasks: boolean, draftOnly = false) => {
    try {
      const payload = {
        name: form.name,
        description: form.description,
        project_type: form.project_type,
        category: form.category || null,
        visibility: form.visibility,
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        priority: form.priority,
        project_manager_id: form.project_manager_id || null,
        budget: form.budget ? Number(form.budget) : null,
        currency: form.currency,
        hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
        budget_alert_threshold: Number(form.budget_alert_threshold),
        deliverables: form.deliverables
          .split("\n")
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => ({ name, status: "À faire" })),
        team_members: form.team_members
          .split("\n")
          .map((row) => row.trim())
          .filter(Boolean)
          .map((row) => {
            const [userId, role = "Observateur", allocation = "100"] = row.split(",").map((v) => v.trim());
            return { user_id: userId, role, allocation_percentage: Number(allocation), joined_at: new Date().toISOString().slice(0, 10) };
          }),
        status: draftOnly ? "draft" : "planning",
      };
      const created = await api<Project>("/projects", { method: "POST", body: JSON.stringify(payload) });
      setCreateOpen(false);
      setForm(INITIAL_FORM);
      await load();
      if (toTasks) {
        window.location.href = `/tasks?project_id=${created.id}`;
      } else {
        setSelectedProject(created);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur création projet");
    }
  };

  const exportCsv = async () => {
    const csv = await api<string>("/projects/export");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "projects_export.csv";
    link.click();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Portefeuille Projets</h1>
          <p className="text-sm text-slate-500">Création, pilotage, budget, équipe et livraison sur un seul module.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          Nouveau Projet
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {kpi.icon} {kpi.label}
            </p>
            <p className={`mt-1 text-lg font-bold ${kpi.tone}`}>{kpi.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              className="w-full rounded-xl border border-slate-200 px-8 py-2 text-sm"
              placeholder="Recherche nom, code, client, description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Project["status"] | "all")}>
            <option value="all">Tous statuts</option>
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {STATUS_FR[status] || status}
              </option>
            ))}
          </select>
          <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={pmFilter} onChange={(e) => setPmFilter(e.target.value)}>
            <option value="all">Tous chefs de projet</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>
          <Button variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
          <div className="ml-auto flex rounded-xl border border-slate-200 bg-white p-1">
            <Button size="sm" variant={view === "kanban" ? "primary" : "ghost"} onClick={() => setView("kanban")}>
              Kanban
            </Button>
            <Button size="sm" variant={view === "list" ? "primary" : "ghost"} onClick={() => setView("list")}>
              Liste
            </Button>
          </div>
        </div>
      </Card>

      {view === "kanban" ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
          <div className="kanban-board grid gap-3 xl:grid-cols-7">
            {STATUS_ORDER.map((status) => (
              <ProjectColumn key={status} status={status} projects={grouped[status]} onOpen={setSelectedProject} />
            ))}
          </div>
        </DndContext>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="responsive-table min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Priorité</th>
                <th className="px-4 py-3">Début</th>
                <th className="px-4 py-3">Fin</th>
                <th className="px-4 py-3">Progression</th>
                <th className="px-4 py-3">Budget</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((project) => (
                <tr key={project.id} className="border-t border-slate-100">
                  <td className="px-4 py-3" data-label="Code">{project.project_code || "—"}</td>
                  <td className="px-4 py-3 font-medium" data-label="Nom">{project.name}</td>
                  <td className="px-4 py-3" data-label="Client">{project.company_name || "Interne"}</td>
                  <td className="px-4 py-3" data-label="Statut">
                    <Badge status={project.status} label={STATUS_FR[project.status] || project.status} />
                  </td>
                  <td className="px-4 py-3" data-label="Priorité">{project.priority || "medium"}</td>
                  <td className="px-4 py-3" data-label="Début">{project.start_date || "—"}</td>
                  <td className="px-4 py-3" data-label="Fin">{project.end_date || "—"}</td>
                  <td className="px-4 py-3" data-label="Progression">{project.completion_percentage || 0}%</td>
                  <td className="px-4 py-3" data-label="Budget">{formatCurrency(project.budget, project.currency)}</td>
                  <td className="px-4 py-3" data-label="Actions">
                    <Button size="sm" variant="ghost" onClick={() => setSelectedProject(project)}>
                      Ouvrir
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {selectedProject && (
        <Card className="border-indigo-200 bg-indigo-50/40">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-indigo-500">{selectedProject.project_code || "PROJET"}</p>
              <h3 className="text-xl font-bold text-indigo-900">{selectedProject.name}</h3>
              <p className="text-sm text-indigo-700">{selectedProject.description || "Aucune description."}</p>
            </div>
            <Button variant="ghost" onClick={() => setSelectedProject(null)}>
              <X size={14} />
              Fermer
            </Button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <p className="text-sm text-indigo-800">
              <CalendarClock size={14} className="mr-1 inline" />
              {selectedProject.start_date || "—"} → {selectedProject.end_date || "—"}
            </p>
            <p className="text-sm text-indigo-800">Budget: {formatCurrency(selectedProject.budget, selectedProject.currency)}</p>
            <p className="text-sm text-indigo-800">Progression: {selectedProject.completion_percentage || 0}%</p>
          </div>
        </Card>
      )}

      {createOpen && (
        <div className="modal-overlay fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[4px]">
          <div className="modal-content modal-panel drawer absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-2xl">
            <div className="drawer-header mb-3 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Nouveau Projet</h2>
              <button onClick={() => setCreateOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              <Button size="sm" variant={createTab === "general" ? "primary" : "secondary"} onClick={() => setCreateTab("general")}>
                📋 Infos
              </Button>
              <Button size="sm" variant={createTab === "planning" ? "primary" : "secondary"} onClick={() => setCreateTab("planning")}>
                📅 Planification
              </Button>
              <Button size="sm" variant={createTab === "budget" ? "primary" : "secondary"} onClick={() => setCreateTab("budget")}>
                💰 Budget
              </Button>
              <Button size="sm" variant={createTab === "team" ? "primary" : "secondary"} onClick={() => setCreateTab("team")}>
                👥 Équipe
              </Button>
            </div>

            {createTab === "general" && (
              <div className="grid gap-3 md:grid-cols-2">
                <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2" placeholder="Nom du projet *" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
                <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.project_type} onChange={(e) => setForm((s) => ({ ...s, project_type: e.target.value }))}>
                  <option value="internal">Interne</option>
                  <option value="client">Client</option>
                  <option value="partnership">Partenariat</option>
                  <option value="rnd">R&D</option>
                  <option value="marketing">Marketing</option>
                  <option value="event">Événementiel</option>
                </select>
                <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Catégorie" value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))} />
                <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.visibility} onChange={(e) => setForm((s) => ({ ...s, visibility: e.target.value }))}>
                  <option value="public">Public</option>
                  <option value="private">Privé</option>
                  <option value="restricted">Restreint</option>
                </select>
                <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Tags (virgules)" value={form.tags} onChange={(e) => setForm((s) => ({ ...s, tags: e.target.value }))} />
                <textarea className="min-h-24 rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} />
              </div>
            )}

            {createTab === "planning" && (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm text-slate-600">
                  Date de début *
                  <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" type="date" value={form.start_date} onChange={(e) => setForm((s) => ({ ...s, start_date: e.target.value }))} />
                </label>
                <label className="text-sm text-slate-600">
                  Date de fin *
                  <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" type="date" value={form.end_date} onChange={(e) => setForm((s) => ({ ...s, end_date: e.target.value }))} />
                </label>
                <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.priority} onChange={(e) => setForm((s) => ({ ...s, priority: e.target.value }))}>
                  <option value="critical">Critique</option>
                  <option value="high">Haute</option>
                  <option value="medium">Moyenne</option>
                  <option value="low">Basse</option>
                </select>
                <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.project_manager_id} onChange={(e) => setForm((s) => ({ ...s, project_manager_id: e.target.value }))}>
                  <option value="">Chef de projet *</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {createTab === "budget" && (
              <div className="grid gap-3 md:grid-cols-2">
                <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Budget total MAD" value={form.budget} onChange={(e) => setForm((s) => ({ ...s, budget: e.target.value }))} />
                <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.currency} onChange={(e) => setForm((s) => ({ ...s, currency: e.target.value }))}>
                  <option value="MAD">MAD</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
                <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Taux horaire" value={form.hourly_rate} onChange={(e) => setForm((s) => ({ ...s, hourly_rate: e.target.value }))} />
                <label className="text-sm text-slate-600">
                  Seuil alerte budget {form.budget_alert_threshold}%
                  <input className="mt-2 w-full" type="range" min={50} max={95} value={form.budget_alert_threshold} onChange={(e) => setForm((s) => ({ ...s, budget_alert_threshold: Number(e.target.value) }))} />
                </label>
                <textarea className="min-h-24 rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2" placeholder="Livrables (1 par ligne)" value={form.deliverables} onChange={(e) => setForm((s) => ({ ...s, deliverables: e.target.value }))} />
              </div>
            )}

            {createTab === "team" && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">Format ligne: <code>user_id,role,allocation%</code></p>
                <textarea className="min-h-36 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="uuid-user-1,Chef de projet,100" value={form.team_members} onChange={(e) => setForm((s) => ({ ...s, team_members: e.target.value }))} />
              </div>
            )}

            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Annuler
              </Button>
              <Button variant="secondary" onClick={() => createProject(false, true)}>
                Enregistrer brouillon
              </Button>
              <Button variant="secondary" onClick={() => createProject(true)}>
                Créer & tâches
              </Button>
              <Button onClick={() => createProject(false)}>Créer le projet</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
