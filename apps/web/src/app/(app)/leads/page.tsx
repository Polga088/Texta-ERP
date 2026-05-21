"use client";

import { useEffect, useState } from "react";
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

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");

  const load = () => api<Lead[]>("/leads").then(setLeads).catch(console.error);

  useEffect(() => {
    load();
  }, []);

  const createLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await api("/leads", {
      method: "POST",
      body: JSON.stringify({ title, source }),
    });
    setTitle("");
    setSource("");
    load();
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
      </Card>

      <Card className="p-0">
        <ul className="divide-y divide-slate-100">
          {leads.map((lead) => (
            <li key={lead.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium text-slate-800">{lead.title}</p>
                <p className="text-xs text-slate-500">
                  Source: {lead.source || "N/A"}
                  {lead.estimated_value ? ` · Valeur: ${lead.estimated_value}` : ""}
                </p>
              </div>
              <Badge status={lead.status} label={STATUS_LABELS[lead.status]} />
            </li>
          ))}
          {leads.length === 0 && <li className="px-4 py-5 text-sm text-slate-500">Aucun lead pour le moment.</li>}
        </ul>
      </Card>
    </div>
  );
}
