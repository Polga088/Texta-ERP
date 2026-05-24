"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Pencil, Trophy, X } from "lucide-react";
import { api } from "@/lib/api";
import { Lead } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  LeadBrief,
  emptyLeadBrief,
  parseLeadNotes,
  serializeLeadNotes,
} from "@/lib/lead-brief";

const STATUS_LABELS: Record<Lead["status"], string> = {
  new: "Nouveau",
  qualified: "Qualifié",
  proposal: "Proposition",
  won: "Gagné",
  lost: "Perdu",
};

const WORKFLOW: Lead["status"][] = ["new", "qualified", "proposal", "won"];

const BRIEF_SECTIONS = [
  {
    title: "1. Identité du projet",
    fields: [
      { key: "identity_project_name", label: "Nom du projet", placeholder: "OmJep Platform" },
      { key: "identity_baseline", label: "Slogan / baseline", placeholder: "La compétition EA FC 26, réinventée" },
      { key: "identity_description_short", label: "Description en 1 phrase" },
      { key: "identity_description_long", label: "Description détaillée" },
      { key: "identity_sector", label: "Secteur d'activité", placeholder: "Gaming / E-sport" },
      { key: "identity_launch_date", label: "Date de lancement visée", placeholder: "Juillet 2026" },
      { key: "identity_budget", label: "Budget estimé", placeholder: "50 000 - 100 000 MAD" },
    ],
  },
  {
    title: "2. Objectifs & enjeux",
    fields: [
      { key: "objectives_main", label: "Objectif principal" },
      { key: "objectives_secondary", label: "Objectifs secondaires" },
      { key: "objectives_problem", label: "Problème résolu" },
      { key: "objectives_kpis", label: "KPIs de succès" },
      { key: "objectives_duration", label: "Durée du projet" },
    ],
  },
  {
    title: "3. Cible & utilisateurs",
    fields: [
      { key: "target_primary_user", label: "Utilisateur principal" },
      { key: "target_secondary_user", label: "Utilisateur secondaire" },
      { key: "target_persona", label: "Persona" },
      { key: "target_needs", label: "Besoins utilisateurs" },
      { key: "target_frustrations", label: "Frustrations actuelles" },
      { key: "target_languages", label: "Langues supportées", placeholder: "FR / AR / EN" },
    ],
  },
  {
    title: "4. Fonctionnalités & périmètre",
    fields: [
      { key: "features_mvp", label: "Fonctionnalités MVP" },
      { key: "features_v2", label: "Fonctionnalités V2" },
      { key: "features_v3", label: "Fonctionnalités V3+" },
      { key: "features_pages", label: "Pages / écrans nécessaires" },
      { key: "features_roles", label: "Rôles & permissions" },
      { key: "features_flows", label: "Flux utilisateurs clés" },
    ],
  },
  {
    title: "5. Design & expérience",
    fields: [
      { key: "design_tone", label: "Tone & voice" },
      { key: "design_direction", label: "Direction visuelle" },
      { key: "design_colors", label: "Palette de couleurs" },
      { key: "design_typography", label: "Typographie" },
      { key: "design_theme_mode", label: "Mode sombre / clair" },
      { key: "design_references", label: "Références visuelles" },
      { key: "design_logo_assets", label: "Logo & assets" },
      { key: "design_responsive", label: "Responsive", placeholder: "Desktop / Mobile / Les deux" },
    ],
  },
  {
    title: "6. Contenu & données",
    fields: [
      { key: "content_existing", label: "Contenu existant" },
      { key: "content_to_create", label: "Contenu à créer" },
      { key: "content_database", label: "Base de données" },
      { key: "content_sources", label: "Sources de données externes" },
      { key: "content_privacy", label: "RGPD / confidentialité" },
    ],
  },
  {
    title: "7. Technique & infrastructure",
    fields: [
      { key: "tech_platform_type", label: "Type de plateforme" },
      { key: "tech_stack", label: "Tech stack" },
      { key: "tech_hosting", label: "Hébergement" },
      { key: "tech_domain", label: "Nom de domaine" },
      { key: "tech_security", label: "Sécurité" },
      { key: "tech_integrations", label: "Intégrations tierces" },
      { key: "tech_seo", label: "SEO & référencement" },
    ],
  },
  {
    title: "8. Gestion & livraison",
    fields: [
      { key: "delivery_team", label: "Équipe projet" },
      { key: "delivery_method", label: "Méthodologie" },
      { key: "delivery_phases", label: "Phases de livraison" },
      { key: "delivery_tools", label: "Outils de collaboration" },
      { key: "delivery_tests", label: "Recette & tests" },
      { key: "delivery_maintenance", label: "Maintenance post-launch" },
    ],
  },
  {
    title: "9. Monétisation & business model",
    fields: [
      { key: "business_model", label: "Modèle économique" },
      { key: "business_pricing", label: "Tarification" },
      { key: "business_payment", label: "Passerelles de paiement" },
      { key: "business_legal", label: "Conditions générales" },
    ],
  },
] as const;

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    source: "",
    status: "new" as Lead["status"],
    estimated_value: "",
  });
  const [editBrief, setEditBrief] = useState<LeadBrief>(emptyLeadBrief());
  const [editPlainNotes, setEditPlainNotes] = useState("");
  const [activeSection, setActiveSection] = useState(0);

  const load = () =>
    api<Lead[]>("/leads")
      .then(setLeads)
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur de chargement"));

  useEffect(() => {
    load();
  }, []);

  const briefCoverage = useMemo(() => {
    const total = Object.keys(editBrief).length;
    const filled = Object.values(editBrief).filter((value) => value.trim().length > 0).length;
    return total === 0 ? 0 : Math.round((filled / total) * 100);
  }, [editBrief]);

  const createLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await api("/leads", {
        method: "POST",
        body: JSON.stringify({ title, source }),
      });
      setTitle("");
      setSource("");
      setError("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de création");
    }
  };

  const moveLead = async (lead: Lead, status: Lead["status"]) => {
    try {
      await api(`/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setError("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de mise à jour");
    }
  };

  const beginEdit = (lead: Lead) => {
    const parsed = parseLeadNotes(lead.notes);
    setEditingLeadId(lead.id);
    setEditForm({
      title: lead.title,
      source: lead.source || "",
      status: lead.status,
      estimated_value: lead.estimated_value ? String(lead.estimated_value) : "",
    });
    setEditBrief(parsed.brief);
    setEditPlainNotes(parsed.plainNotes);
    setActiveSection(0);
  };

  const cancelEdit = () => {
    setEditingLeadId(null);
    setEditForm({ title: "", source: "", status: "new", estimated_value: "" });
    setEditBrief(emptyLeadBrief());
    setEditPlainNotes("");
  };

  const saveLead = async () => {
    if (!editingLeadId) return;
    try {
      await api(`/leads/${editingLeadId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editForm.title,
          source: editForm.source || null,
          status: editForm.status,
          estimated_value: editForm.estimated_value ? Number(editForm.estimated_value) : null,
          notes: serializeLeadNotes(editBrief, editPlainNotes),
        }),
      });
      setError("");
      cancelEdit();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de mise à jour");
    }
  };

  const grouped = useMemo(() => {
    return {
      new: leads.filter((lead) => lead.status === "new"),
      qualified: leads.filter((lead) => lead.status === "qualified"),
      proposal: leads.filter((lead) => lead.status === "proposal"),
      won: leads.filter((lead) => lead.status === "won"),
      lost: leads.filter((lead) => lead.status === "lost"),
    };
  }, [leads]);

  const conversionRate = useMemo(() => {
    const active = leads.filter((lead) => lead.status !== "lost").length;
    if (active === 0) return 0;
    return Math.round((grouped.won.length / active) * 100);
  }, [grouped.won.length, leads]);

  const convertLeadToProject = (lead: Lead) => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      "texta_lead_project_prefill",
      JSON.stringify({
        id: lead.id,
        title: lead.title,
        source: lead.source || "",
        notes: lead.notes || "",
      }),
    );
    router.push(`/projects/new?fromLead=${lead.id}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Leads</h1>
        <p className="mt-1 text-sm text-slate-500">Portail de gestion commerciale des opportunités.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-500">Nouveaux</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{grouped.new.length}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-500">En pipeline</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {grouped.qualified.length + grouped.proposal.length}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-500">Gagnés</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{grouped.won.length}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-500">Taux conversion</p>
          <p className="mt-1 text-2xl font-bold text-indigo-700">{conversionRate}%</p>
        </Card>
      </div>

      <Card>
        <CardTitle className="mb-3">Nouveau lead</CardTitle>
        <form onSubmit={createLead} className="grid gap-3 md:grid-cols-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nom opportunité" />
          <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Source (LinkedIn, referral...)" />
          <Button type="submit">Ajouter</Button>
        </form>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      </Card>

      <Card>
        <CardTitle className="mb-4">Workflow commercial</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {WORKFLOW.map((status, idx) => (
            <div
              key={status}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
            >
              {idx === WORKFLOW.length - 1 ? <Trophy size={13} /> : <span>{idx + 1}.</span>}
              {STATUS_LABELS[status]}
              {idx < WORKFLOW.length - 1 && <ArrowRight size={12} className="text-slate-400" />}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-5">
        {(Object.keys(grouped) as Array<keyof typeof grouped>).map((status) => (
          <Card key={status} className="min-h-[260px] border border-slate-200 p-3">
            <div className="mb-3 flex items-center justify-between">
              <Badge status={status} label={STATUS_LABELS[status]} />
              <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {grouped[status].length}
              </span>
            </div>
            <div className="space-y-2">
              {grouped[status].map((lead) => (
                <article key={lead.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  {editingLeadId === lead.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editForm.title}
                        onChange={(e) => setEditForm((s) => ({ ...s, title: e.target.value }))}
                        placeholder="Nom opportunité"
                      />
                      <Input
                        value={editForm.source}
                        onChange={(e) => setEditForm((s) => ({ ...s, source: e.target.value }))}
                        placeholder="Source"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={editForm.status}
                          onChange={(e) => setEditForm((s) => ({ ...s, status: e.target.value as Lead["status"] }))}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          {Object.keys(STATUS_LABELS).map((option) => (
                            <option key={option} value={option}>
                              {STATUS_LABELS[option as Lead["status"]]}
                            </option>
                          ))}
                        </select>
                        <Input
                          type="number"
                          value={editForm.estimated_value}
                          onChange={(e) => setEditForm((s) => ({ ...s, estimated_value: e.target.value }))}
                          placeholder="Valeur €"
                        />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                        <div className="mb-2 flex flex-wrap gap-2">
                          {BRIEF_SECTIONS.map((section, idx) => (
                            <button
                              key={section.title}
                              className={`rounded-lg px-2 py-1 text-xs ${
                                idx === activeSection
                                  ? "bg-indigo-600 text-white"
                                  : "bg-white text-slate-600 hover:bg-slate-100"
                              }`}
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveSection(idx);
                              }}
                            >
                              {idx + 1}
                            </button>
                          ))}
                          <span className="ml-auto rounded-lg bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700">
                            Brief rempli à {briefCoverage}%
                          </span>
                        </div>
                        <p className="mb-2 text-xs font-semibold text-slate-700">{BRIEF_SECTIONS[activeSection].title}</p>
                        <div className="grid gap-2">
                          {BRIEF_SECTIONS[activeSection].fields.map((field) => (
                            <label key={field.key} className="text-xs text-slate-600">
                              {field.label}
                              <textarea
                                value={editBrief[field.key] || ""}
                                onChange={(e) =>
                                  setEditBrief((prev) => ({
                                    ...prev,
                                    [field.key]: e.target.value,
                                  }))
                                }
                                placeholder={"placeholder" in field ? field.placeholder : ""}
                                className="mt-1 min-h-16 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                      <textarea
                        value={editPlainNotes}
                        onChange={(e) => setEditPlainNotes(e.target.value)}
                        placeholder="Notes internes complémentaires"
                        className="min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveLead}>
                          Enregistrer
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit}>
                          <X size={14} />
                          Annuler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {(() => {
                        const parsedBrief = parseLeadNotes(lead.notes).brief;
                        return (
                          <>
                      <p className="text-sm font-semibold text-slate-800">{lead.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {lead.source || "Source non renseignée"}
                        {lead.estimated_value ? ` · ${lead.estimated_value} €` : ""}
                      </p>
                      <p className="mt-1 text-xs text-indigo-600">
                        {parsedBrief.identity_project_name
                          ? `Projet: ${parsedBrief.identity_project_name}`
                          : "Template projet non encore rempli"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {lead.status !== "won" && lead.status !== "lost" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => moveLead(lead, WORKFLOW[WORKFLOW.indexOf(lead.status) + 1])}
                          >
                            Étape suivante
                          </Button>
                        )}
                        {lead.status !== "lost" && lead.status !== "won" && (
                          <Button size="sm" variant="ghost" onClick={() => moveLead(lead, "lost")}>
                            Perdu
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => beginEdit(lead)}>
                          <Pencil size={14} />
                          Éditer
                        </Button>
                        <Button size="sm" onClick={() => convertLeadToProject(lead)}>
                          Convertir en projet
                        </Button>
                      </div>
                          </>
                        );
                      })()}
                    </>
                  )}
                </article>
              ))}
              {grouped[status].length === 0 && <p className="text-xs text-slate-400">Aucun lead</p>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
