"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Trophy } from "lucide-react";
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Leads</h1>
        <p className="mt-1 text-sm text-slate-500">Portail de gestion commerciale des opportunités.</p>
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

      <Card className="p-0">
        <ul className="divide-y divide-slate-100">
          {leads.map((lead) => (
            <li key={lead.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium text-slate-800">{lead.title}</p>
                <p className="text-xs text-slate-500">
                  Source: {lead.source || "N/A"}
                  {lead.estimated_value ? ` · Valeur: ${lead.estimated_value}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge status={lead.status} label={STATUS_LABELS[lead.status]} />
                {lead.status !== "won" && lead.status !== "lost" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => moveLead(lead, WORKFLOW[WORKFLOW.indexOf(lead.status) + 1])}
                  >
                    Étape suivante
                  </Button>
                )}
                {lead.status !== "lost" && (
                  <Button size="sm" variant="ghost" onClick={() => moveLead(lead, "lost")}>
                    Marquer perdu
                  </Button>
                )}
              </div>
            </li>
          ))}
          {leads.length === 0 && <li className="px-4 py-5 text-sm text-slate-500">Aucun lead pour le moment.</li>}
        </ul>
      </Card>
    </div>
  );
}
