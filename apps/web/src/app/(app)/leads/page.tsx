"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  AlertTriangle,
  ArrowRight,
  Mail,
  Phone,
  Plus,
  Search,
  Trophy,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { Lead, LeadKpis, User } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { buildProjectPrefillFromLead } from "@/lib/lead-brief";

type LeadStatus = Lead["status"];
type LeadView = "kanban" | "list";
type FormTab = "info" | "deal" | "follow";
type DrawerTab = "info" | "history" | "notes";

const STATUS_ORDER: LeadStatus[] = ["new", "qualified", "proposal", "won", "lost"];
const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Nouveau",
  qualified: "Qualifié",
  proposal: "Proposition",
  won: "Gagné",
  lost: "Perdu",
};
const STATUS_BG: Record<LeadStatus, string> = {
  new: "bg-slate-50 border-slate-200",
  qualified: "bg-blue-50 border-blue-200",
  proposal: "bg-orange-50 border-orange-200",
  won: "bg-emerald-50 border-emerald-200",
  lost: "bg-rose-50 border-rose-200",
};
const PRIORITY_BG: Record<string, string> = {
  high: "bg-rose-500",
  medium: "bg-amber-500",
  low: "bg-slate-300",
};

const INITIAL_FORM = {
  title: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  company_name: "",
  company_website: "",
  contact_job_title: "",
  deal_value: "",
  currency: "MAD",
  product_service: "",
  expected_close_date: "",
  conversion_probability: 20,
  priority: "medium",
  source: "LinkedIn",
  marketing_campaign: "",
  assigned_to: "",
  tags: "",
  next_action_type: "none",
  next_action_date: "",
  next_action_note: "",
  description: "",
};

function formatMoney(value?: number | null, currency = "MAD"): string {
  if (!value) return "0";
  return `${new Intl.NumberFormat("fr-MA").format(value)} ${currency}`;
}

function isOverdue(lead: Lead): boolean {
  if (!lead.expected_close_date || lead.status === "won" || lead.status === "lost") return false;
  return new Date(lead.expected_close_date) < new Date();
}

function leadMatchesSearch(lead: Lead, q: string): boolean {
  if (!q.trim()) return true;
  const haystack = [
    lead.title,
    lead.contact_name,
    lead.contact_email,
    lead.company_name,
    lead.source,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q.toLowerCase());
}

function DraggableLeadCard({
  lead,
  onOpen,
  onQuickStatus,
  onConvert,
}: {
  lead: Lead;
  onOpen: (lead: Lead) => void;
  onQuickStatus: (lead: Lead, status: LeadStatus) => void;
  onConvert: (lead: Lead) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.6 : 1,
  };
  const tagList = lead.tags || [];

  return (
    <article
      ref={setNodeRef}
      style={style}
      className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md"
      {...listeners}
      {...attributes}
      onDoubleClick={() => onOpen(lead)}
    >
      <div className={`absolute left-0 top-0 h-1 w-full ${PRIORITY_BG[lead.priority || "low"]}`} />
      <p className="mt-1 text-sm font-semibold text-slate-900">{lead.title}</p>
      <p className="text-xs text-slate-500">
        {(lead.company_name || "Entreprise N/A") + " — " + (lead.contact_name || "Contact N/A")}
      </p>
      <p className="mt-2 text-sm font-bold text-indigo-700">{formatMoney(lead.deal_value, lead.currency)}</p>
      <p className="text-xs text-slate-500">
        Clôture: {lead.expected_close_date || "N/A"} {isOverdue(lead) ? "⚠️ En retard" : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {tagList.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
            {tag}
          </span>
        ))}
        {tagList.length > 3 && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
            +{tagList.length - 3}
          </span>
        )}
      </div>
      <div className="mt-3 hidden flex-wrap gap-1.5 group-hover:flex">
        <button
          className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(lead);
          }}
        >
          Détail
        </button>
        <a
          className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600"
          href={lead.contact_phone ? `tel:${lead.contact_phone}` : "#"}
          onClick={(e) => !lead.contact_phone && e.preventDefault()}
        >
          Appeler
        </a>
        <a
          className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600"
          href={lead.contact_email ? `mailto:${lead.contact_email}` : "#"}
          onClick={(e) => !lead.contact_email && e.preventDefault()}
        >
          Email
        </a>
        {lead.status !== "won" && lead.status !== "lost" && (
          <button
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] text-indigo-700"
            onClick={(e) => {
              e.stopPropagation();
              onQuickStatus(lead, STATUS_ORDER[STATUS_ORDER.indexOf(lead.status) + 1]);
            }}
          >
            Étape suivante
          </button>
        )}
        <button
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700"
          onClick={(e) => {
            e.stopPropagation();
            onConvert(lead);
          }}
        >
          Convertir projet
        </button>
      </div>
    </article>
  );
}

function DroppableColumn({
  status,
  leads,
  onOpen,
  onQuickStatus,
  onConvert,
}: {
  status: LeadStatus;
  leads: Lead[];
  onOpen: (lead: Lead) => void;
  onQuickStatus: (lead: Lead, status: LeadStatus) => void;
  onConvert: (lead: Lead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const total = leads.reduce((acc, current) => acc + (current.deal_value || 0), 0);

  return (
    <section
      ref={setNodeRef}
      className={`kanban-column min-h-[440px] rounded-2xl border p-3 transition ${STATUS_BG[status]} ${isOver ? "ring-2 ring-indigo-300" : ""}`}
    >
      <header className="kanban-column-header mb-3 flex items-center justify-between">
        <Badge status={status} label={STATUS_LABELS[status]} />
        <span className="text-xs text-slate-500">{leads.length}</span>
      </header>
      {(status === "won" || status === "lost") && (
        <p className="mb-2 text-xs font-semibold text-slate-500">{formatMoney(total)}</p>
      )}
      <div className="kanban-cards-container space-y-2 md:space-y-2">
        {leads.map((lead) => (
          <DraggableLeadCard
            key={lead.id}
            lead={lead}
            onOpen={onOpen}
            onQuickStatus={onQuickStatus}
            onConvert={onConvert}
          />
        ))}
        {leads.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">
            Aucun lead
          </div>
        )}
      </div>
    </section>
  );
}

export default function LeadsPage() {
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [leads, setLeads] = useState<Lead[]>([]);
  const [kpis, setKpis] = useState<LeadKpis | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);
  const [view, setView] = useState<LeadView>("kanban");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"deal_desc" | "deal_asc" | "close_date" | "priority">("deal_desc");
  const [createOpen, setCreateOpen] = useState(false);
  const [formTab, setFormTab] = useState<FormTab>("info");
  const [form, setForm] = useState(INITIAL_FORM);
  const [drawerLead, setDrawerLead] = useState<Lead | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("info");
  const [drawerNotes, setDrawerNotes] = useState("");

  const load = async () => {
    try {
      const [leadRows, kpiRows] = await Promise.all([api<Lead[]>("/leads"), api<LeadKpis>("/leads/kpis")]);
      setLeads(leadRows);
      setKpis(kpiRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement leads");
    }
  };

  useEffect(() => {
    load();
    api<User[]>("/users")
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!drawerLead) return;
    setDrawerNotes(drawerLead.notes || "");
  }, [drawerLead]);

  useEffect(() => {
    if (!drawerLead || drawerTab !== "notes") return;
    const timer = window.setTimeout(async () => {
      await api(`/leads/${drawerLead.id}`, { method: "PATCH", body: JSON.stringify({ notes: drawerNotes }) });
      setToast("Notes sauvegardées");
      load();
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [drawerLead, drawerNotes, drawerTab]);

  const variation = useMemo(() => {
    const now = new Date();
    const thisMonth = leads.filter((lead) => new Date(lead.created_at || now.toISOString()).getMonth() === now.getMonth());
    const prevMonth = leads.filter(
      (lead) =>
        new Date(lead.created_at || now.toISOString()).getMonth() ===
        (now.getMonth() === 0 ? 11 : now.getMonth() - 1),
    );
    if (prevMonth.length === 0) return 100;
    return Math.round(((thisMonth.length - prevMonth.length) / prevMonth.length) * 100);
  }, [leads]);

  const filtered = useMemo(() => {
    const rows = leads
      .filter((lead) => (statusFilter === "all" ? true : lead.status === statusFilter))
      .filter((lead) => (assignedFilter === "all" ? true : (lead.assigned_to || "") === assignedFilter))
      .filter((lead) => leadMatchesSearch(lead, search));

    const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
    rows.sort((a, b) => {
      if (sortBy === "deal_desc") return (b.deal_value || 0) - (a.deal_value || 0);
      if (sortBy === "deal_asc") return (a.deal_value || 0) - (b.deal_value || 0);
      if (sortBy === "close_date") return (a.expected_close_date || "").localeCompare(b.expected_close_date || "");
      return (priorityWeight[b.priority || "low"] || 0) - (priorityWeight[a.priority || "low"] || 0);
    });
    return rows;
  }, [leads, statusFilter, assignedFilter, search, sortBy]);

  const grouped = useMemo(() => {
    return {
      new: filtered.filter((lead) => lead.status === "new"),
      qualified: filtered.filter((lead) => lead.status === "qualified"),
      proposal: filtered.filter((lead) => lead.status === "proposal"),
      won: filtered.filter((lead) => lead.status === "won"),
      lost: filtered.filter((lead) => lead.status === "lost"),
    };
  }, [filtered]);

  const kpiCards = useMemo(() => {
    if (!kpis) return [];
    return [
      { title: "Nouveaux", value: String(kpis.new_count), tone: "text-slate-700", icon: "📥" },
      { title: "En pipeline", value: String(kpis.pipeline_count), tone: "text-blue-700", icon: "📈" },
      { title: "Gagnés", value: `${kpis.won_count} · ${formatMoney(kpis.won_value)}`, tone: "text-emerald-700", icon: "🏆" },
      { title: "Perdus", value: `${kpis.lost_count} · ${formatMoney(kpis.lost_value)}`, tone: "text-rose-700", icon: "⚠️" },
      { title: "Taux conversion", value: `${kpis.conversion_rate}%`, tone: "text-violet-700", icon: "🎯" },
      { title: "Valeur pipeline", value: formatMoney(kpis.pipeline_value), tone: "text-orange-700", icon: "💰" },
    ];
  }, [kpis]);

  const updateLeadStatus = async (lead: Lead, status: LeadStatus) => {
    try {
      await api(`/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setToast("Statut mis à jour");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de mise à jour");
    }
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const lead = leads.find((row) => row.id === String(active.id));
    if (!lead) return;
    const targetStatus = STATUS_ORDER.includes(over.id as LeadStatus)
      ? (over.id as LeadStatus)
      : leads.find((row) => row.id === String(over.id))?.status;
    if (!targetStatus || targetStatus === lead.status) return;
    await updateLeadStatus(lead, targetStatus);
  };

  const createLead = async (keepOpen: boolean) => {
    if (!form.title || !form.contact_name || !form.contact_email || !form.deal_value || !form.product_service || !form.expected_close_date) {
      setError("Merci de renseigner tous les champs obligatoires.");
      return;
    }
    try {
      await api("/leads", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          contact_name: form.contact_name,
          contact_email: form.contact_email,
          contact_phone: form.contact_phone || null,
          company_name: form.company_name || null,
          company_website: form.company_website || null,
          contact_job_title: form.contact_job_title || null,
          deal_value: Number(form.deal_value),
          currency: form.currency,
          product_service: form.product_service,
          expected_close_date: form.expected_close_date,
          conversion_probability: form.conversion_probability,
          priority: form.priority,
          source: form.source,
          marketing_campaign: form.marketing_campaign || null,
          assigned_to: form.assigned_to || null,
          tags: form.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          next_action_type: form.next_action_type,
          next_action_date: form.next_action_date || null,
          next_action_note: form.next_action_note || null,
          description: form.description || null,
        }),
      });
      setToast("Lead créé avec succès");
      setError("");
      await load();
      if (keepOpen) {
        setForm(INITIAL_FORM);
        setFormTab("info");
      } else {
        setCreateOpen(false);
        setForm(INITIAL_FORM);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de création du lead");
    }
  };

  const deleteLead = async (leadId: string) => {
    await api(`/leads/${leadId}`, { method: "DELETE" });
    setDrawerLead(null);
    setToast("Lead supprimé");
    load();
  };

  const convertLeadToProject = (lead: Lead) => {
    if (typeof window === "undefined") return;
    const prefill = buildProjectPrefillFromLead(lead.title, lead.source, lead.notes);
    window.sessionStorage.setItem(
      "texta_lead_project_prefill",
      JSON.stringify({
        id: lead.id,
        title: lead.title,
        source: lead.source || "",
        notes: lead.notes || "",
        prefill,
      }),
    );
    router.push(`/projects/new?fromLead=${lead.id}`);
  };

  const exportCsv = async () => {
    const csv = await api<string>("/leads/export");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "leads_export.csv";
    link.click();
  };

  return (
    <div className="space-y-5 bg-slate-50 p-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Leads / Opportunités</h1>
          <p className="text-sm text-slate-500">Pipeline commercial visuel avec workflow et conversion projet.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          Nouveau Lead
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title} className="bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {kpi.icon} {kpi.title}
            </p>
            <p className={`mt-1 text-lg font-bold ${kpi.tone}`}>{kpi.value}</p>
            <p className="text-xs text-slate-400">{variation >= 0 ? "↑" : "↓"} {Math.abs(variation)}% vs mois dernier</p>
          </Card>
        ))}
      </div>

      <Card className="sticky top-16 z-20 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-8 py-2 text-sm"
              placeholder="Recherche opportunité, entreprise, contact..."
            />
          </div>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
          >
            <option value="all">Tous commerciaux</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "all")}
          >
            <option value="all">Tous statuts</option>
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="deal_desc">Montant ↓</option>
            <option value="deal_asc">Montant ↑</option>
            <option value="close_date">Date de clôture</option>
            <option value="priority">Priorité</option>
          </select>
          <Button variant="secondary" onClick={exportCsv}>
            Exporter CSV
          </Button>
          <div className="ml-auto flex rounded-xl border border-slate-200 bg-white p-1">
            <Button variant={view === "kanban" ? "primary" : "ghost"} size="sm" onClick={() => setView("kanban")}>
              Kanban
            </Button>
            <Button variant={view === "list" ? "primary" : "ghost"} size="sm" onClick={() => setView("list")}>
              Liste
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle className="mb-3">Workflow commercial</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_ORDER.map((status, idx) => (
            <button
              key={status}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === status ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
              }`}
              onClick={() => setStatusFilter((current) => (current === status ? "all" : status))}
            >
              {status === "won" ? <Trophy size={13} /> : status === "lost" ? <AlertTriangle size={13} /> : idx + 1}
              {STATUS_LABELS[status]}
              {idx < STATUS_ORDER.length - 1 && <ArrowRight size={12} />}
            </button>
          ))}
        </div>
      </Card>

      {view === "kanban" ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
          <div className="kanban-board grid gap-3 xl:grid-cols-5">
            {STATUS_ORDER.map((status) => (
              <DroppableColumn
                key={status}
                status={status}
                leads={grouped[status]}
                onOpen={(lead) => setDrawerLead(lead)}
                onQuickStatus={updateLeadStatus}
                onConvert={convertLeadToProject}
              />
            ))}
          </div>
        </DndContext>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="responsive-table min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Opportunité</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Entreprise</th>
                <th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Priorité</th>
                <th className="px-4 py-3">Échéance</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 20).map((lead) => (
                <tr key={lead.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium" data-label="Opportunité">{lead.title}</td>
                  <td className="px-4 py-3" data-label="Contact">{lead.contact_name || "—"}</td>
                  <td className="px-4 py-3" data-label="Entreprise">{lead.company_name || "—"}</td>
                  <td className="px-4 py-3" data-label="Montant">{formatMoney(lead.deal_value, lead.currency)}</td>
                  <td className="px-4 py-3" data-label="Statut">
                    <Badge status={lead.status} label={STATUS_LABELS[lead.status]} />
                  </td>
                  <td className="px-4 py-3" data-label="Priorité">{lead.priority || "medium"}</td>
                  <td className="px-4 py-3" data-label="Échéance">{lead.expected_close_date || "—"}</td>
                  <td className="px-4 py-3" data-label="Actions">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setDrawerLead(lead)}>
                        Détail
                      </Button>
                      <Button size="sm" onClick={() => convertLeadToProject(lead)}>
                        Convertir
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {createOpen && (
        <div className="modal-overlay fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[4px]">
          <div className="modal-content modal-panel drawer absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-2xl">
            <div className="drawer-header mb-3 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Nouveau Lead</h2>
              <button onClick={() => setCreateOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="mb-4 flex gap-2">
              <Button size="sm" variant={formTab === "info" ? "primary" : "secondary"} onClick={() => setFormTab("info")}>
                📋 Informations
              </Button>
              <Button size="sm" variant={formTab === "deal" ? "primary" : "secondary"} onClick={() => setFormTab("deal")}>
                💰 Deal
              </Button>
              <Button size="sm" variant={formTab === "follow" ? "primary" : "secondary"} onClick={() => setFormTab("follow")}>
                👤 Suivi
              </Button>
            </div>

            {formTab === "info" && (
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} placeholder="Nom opportunité *" />
                <Input value={form.contact_name} onChange={(e) => setForm((s) => ({ ...s, contact_name: e.target.value }))} placeholder="Nom contact *" />
                <Input value={form.contact_email} onChange={(e) => setForm((s) => ({ ...s, contact_email: e.target.value }))} placeholder="Email *" />
                <Input value={form.contact_phone} onChange={(e) => setForm((s) => ({ ...s, contact_phone: e.target.value }))} placeholder="Téléphone" />
                <Input value={form.company_name} onChange={(e) => setForm((s) => ({ ...s, company_name: e.target.value }))} placeholder="Entreprise" />
                <Input value={form.company_website} onChange={(e) => setForm((s) => ({ ...s, company_website: e.target.value }))} placeholder="Site web" />
                <Input value={form.contact_job_title} onChange={(e) => setForm((s) => ({ ...s, contact_job_title: e.target.value }))} placeholder="Fonction" />
              </div>
            )}
            {formTab === "deal" && (
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={form.deal_value} onChange={(e) => setForm((s) => ({ ...s, deal_value: e.target.value }))} placeholder="Montant estimé *" />
                <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.currency} onChange={(e) => setForm((s) => ({ ...s, currency: e.target.value }))}>
                  <option value="MAD">MAD</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
                <Input value={form.product_service} onChange={(e) => setForm((s) => ({ ...s, product_service: e.target.value }))} placeholder="Produit / Service *" />
                <Input type="date" value={form.expected_close_date} onChange={(e) => setForm((s) => ({ ...s, expected_close_date: e.target.value }))} />
                <label className="text-sm text-slate-600">
                  Probabilité: {form.conversion_probability}%
                  <input
                    className="mt-2 w-full"
                    type="range"
                    min={0}
                    max={100}
                    value={form.conversion_probability}
                    onChange={(e) => setForm((s) => ({ ...s, conversion_probability: Number(e.target.value) }))}
                  />
                </label>
                <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.priority} onChange={(e) => setForm((s) => ({ ...s, priority: e.target.value }))}>
                  <option value="high">Haute</option>
                  <option value="medium">Moyenne</option>
                  <option value="low">Basse</option>
                </select>
                <Input value={form.source} onChange={(e) => setForm((s) => ({ ...s, source: e.target.value }))} placeholder="Source *" />
                <Input value={form.marketing_campaign} onChange={(e) => setForm((s) => ({ ...s, marketing_campaign: e.target.value }))} placeholder="Campagne marketing" />
              </div>
            )}
            {formTab === "follow" && (
              <div className="grid gap-3 md:grid-cols-2">
                <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.assigned_to} onChange={(e) => setForm((s) => ({ ...s, assigned_to: e.target.value }))}>
                  <option value="">Assignation auto</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </select>
                <Input value={form.tags} onChange={(e) => setForm((s) => ({ ...s, tags: e.target.value }))} placeholder="Tags séparés par virgule" />
                <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.next_action_type} onChange={(e) => setForm((s) => ({ ...s, next_action_type: e.target.value }))}>
                  <option value="none">Aucune</option>
                  <option value="call">Appel</option>
                  <option value="email">Email</option>
                  <option value="meeting">RDV</option>
                  <option value="quote">Devis</option>
                  <option value="follow_up">Relance</option>
                </select>
                <Input type="date" value={form.next_action_date} onChange={(e) => setForm((s) => ({ ...s, next_action_date: e.target.value }))} />
                <textarea className="min-h-20 rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2" value={form.next_action_note} onChange={(e) => setForm((s) => ({ ...s, next_action_note: e.target.value }))} placeholder="Détail prochaine action" />
                <textarea className="min-h-24 rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2" value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} placeholder="Description / besoins" />
              </div>
            )}
            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Annuler
              </Button>
              <Button variant="secondary" onClick={() => createLead(true)}>
                Enregistrer & créer un autre
              </Button>
              <Button onClick={() => createLead(false)}>Enregistrer</Button>
            </div>
          </div>
        </div>
      )}

      {drawerLead && (
        <div className="modal-overlay fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[4px]">
          <div className="modal-content modal-panel drawer absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl">
            <div className="drawer-header mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{drawerLead.title}</h2>
                <Badge status={drawerLead.status} label={STATUS_LABELS[drawerLead.status]} />
              </div>
              <button onClick={() => setDrawerLead(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="mb-3 flex gap-2">
              <Button size="sm" variant={drawerTab === "info" ? "primary" : "secondary"} onClick={() => setDrawerTab("info")}>
                📋 Infos
              </Button>
              <Button size="sm" variant={drawerTab === "history" ? "primary" : "secondary"} onClick={() => setDrawerTab("history")}>
                📈 Historique
              </Button>
              <Button size="sm" variant={drawerTab === "notes" ? "primary" : "secondary"} onClick={() => setDrawerTab("notes")}>
                📝 Notes
              </Button>
            </div>
            {drawerTab === "info" && (
              <div className="space-y-2 text-sm">
                <p><span className="font-semibold">Contact:</span> {drawerLead.contact_name || "—"}</p>
                <p><span className="font-semibold">Email:</span> {drawerLead.contact_email || "—"}</p>
                <p><span className="font-semibold">Entreprise:</span> {drawerLead.company_name || "—"}</p>
                <p><span className="font-semibold">Montant:</span> {formatMoney(drawerLead.deal_value, drawerLead.currency)}</p>
                <p><span className="font-semibold">Échéance:</span> {drawerLead.expected_close_date || "—"}</p>
                <p><span className="font-semibold">Prochaine action:</span> {drawerLead.next_action_type || "none"} {drawerLead.next_action_date || ""}</p>
                <p><span className="font-semibold">Description:</span> {drawerLead.description || "Aucune"}</p>
              </div>
            )}
            {drawerTab === "history" && (
              <ul className="space-y-2 text-sm text-slate-600">
                <li>
                  Lead créé le {new Date(drawerLead.created_at || new Date().toISOString()).toLocaleString("fr-FR")}.
                </li>
                <li>Dernière activité le {drawerLead.last_activity ? new Date(drawerLead.last_activity).toLocaleString("fr-FR") : "—"}.</li>
                <li>Statut actuel: {STATUS_LABELS[drawerLead.status]}.</li>
              </ul>
            )}
            {drawerTab === "notes" && (
              <textarea
                className="min-h-40 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={drawerNotes}
                onChange={(e) => setDrawerNotes(e.target.value)}
                placeholder="Notes sauvegardées automatiquement (debounce 1s)"
              />
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href={drawerLead.contact_phone ? `tel:${drawerLead.contact_phone}` : "#"}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <Phone size={14} /> Appeler
              </a>
              <a
                href={drawerLead.contact_email ? `mailto:${drawerLead.contact_email}` : "#"}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <Mail size={14} /> Email
              </a>
              <Button size="sm" variant="secondary" onClick={() => convertLeadToProject(drawerLead)}>
                Convertir en projet
              </Button>
              <Button size="sm" variant="danger" onClick={() => setLeadToDelete(drawerLead.id)}>
                Supprimer
              </Button>
              <div className="ml-auto">
                <select
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={drawerLead.status}
                  onChange={(e) => updateLeadStatus(drawerLead, e.target.value as LeadStatus)}
                >
                  {STATUS_ORDER.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}
      <ConfirmDialog
        isOpen={!!leadToDelete}
        title="Supprimer ce lead ?"
        description="Cette action est définitive et supprimera le lead."
        confirmLabel="Supprimer"
        variant="danger"
        onCancel={() => setLeadToDelete(null)}
        onConfirm={() => {
          if (leadToDelete) {
            void deleteLead(leadToDelete);
          }
          setLeadToDelete(null);
        }}
      />
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
