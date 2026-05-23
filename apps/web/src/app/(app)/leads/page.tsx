"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Pencil, Trophy, X } from "lucide-react";
import { api } from "@/lib/api";
import { Lead } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const STATUS_LABELS: Record<Lead["status"], string> = {
  new: "Nouveau",
  qualified: "Qualifié",
  proposal: "Proposition",
  won: "Gagné",
  lost: "Perdu",
};

const WORKFLOW: Lead["status"][] = ["new", "qualified", "proposal", "won"];

export default function LeadsPage() {
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
    notes: "",
  });

  const load = () => api<Lead[]>("/leads").then(setLeads).catch(console.error);

  useEffect(() => {
    load();
  }, []);

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
    setEditingLeadId(lead.id);
    setEditForm({
      title: lead.title,
      source: lead.source || "",
      status: lead.status,
      estimated_value: lead.estimated_value ? String(lead.estimated_value) : "",
      notes: lead.notes || "",
    });
  };

  const cancelEdit = () => {
    setEditingLeadId(null);
    setEditForm({ title: "", source: "", status: "new", estimated_value: "", notes: "" });
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
          notes: editForm.notes || null,
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
                      <textarea
                        value={editForm.notes}
                        onChange={(e) => setEditForm((s) => ({ ...s, notes: e.target.value }))}
                        placeholder="Notes"
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
                      <p className="text-sm font-semibold text-slate-800">{lead.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {lead.source || "Source non renseignée"}
                        {lead.estimated_value ? ` · ${lead.estimated_value} €` : ""}
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
                      </div>
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
