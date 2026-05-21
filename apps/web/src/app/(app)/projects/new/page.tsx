"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    company_name: "",
    company_logo_url: "",
    project_code: "",
    scope_statement: "",
    iso_context: "",
    iso_risk_register: "",
    iso_objectives: "",
    iso_kpis: "",
    iso_acceptance_criteria: "",
    iso_document_control: true,
    iso_change_control: true,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const project = await api<{ id: string }>("/projects", {
        method: "POST",
        body: JSON.stringify(form),
      });
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de création");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Création de projet</h1>
        <p className="mt-1 text-sm text-slate-500">
          Définissez les informations société et le profil conformité ISO (processus complet).
        </p>
      </div>

      <Card>
        <CardTitle className="mb-4">Profil conformité projet (ISO)</CardTitle>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Nom du projet</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Nom de société</label>
            <Input
              value={form.company_name}
              onChange={(e) => setForm((s) => ({ ...s, company_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Code projet</label>
            <Input
              value={form.project_code}
              onChange={(e) => setForm((s) => ({ ...s, project_code: e.target.value }))}
              placeholder="PRJ-2026-001"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Logo société (URL)</label>
            <Input
              value={form.company_logo_url}
              onChange={(e) => setForm((s) => ({ ...s, company_logo_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Description</label>
            <textarea
              className="min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              value={form.description}
              onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Périmètre (Scope Statement)</label>
            <textarea
              className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              value={form.scope_statement}
              onChange={(e) => setForm((s) => ({ ...s, scope_statement: e.target.value }))}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Contexte ISO (parties intéressées, exigences)</label>
            <textarea
              className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              value={form.iso_context}
              onChange={(e) => setForm((s) => ({ ...s, iso_context: e.target.value }))}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Registre des risques</label>
            <textarea
              className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              value={form.iso_risk_register}
              onChange={(e) => setForm((s) => ({ ...s, iso_risk_register: e.target.value }))}
              placeholder="Risque, probabilité, impact, plan de mitigation..."
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Objectifs qualité / sécurité</label>
            <textarea
              className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              value={form.iso_objectives}
              onChange={(e) => setForm((s) => ({ ...s, iso_objectives: e.target.value }))}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">KPI et méthodes de mesure</label>
            <textarea
              className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              value={form.iso_kpis}
              onChange={(e) => setForm((s) => ({ ...s, iso_kpis: e.target.value }))}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Critères d’acceptation / conformité</label>
            <textarea
              className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              value={form.iso_acceptance_criteria}
              onChange={(e) => setForm((s) => ({ ...s, iso_acceptance_criteria: e.target.value }))}
              required
            />
          </div>
          <div className="md:col-span-2 grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={form.iso_document_control}
                onChange={(e) => setForm((s) => ({ ...s, iso_document_control: e.target.checked }))}
              />
              Contrôle documentaire actif
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={form.iso_change_control}
                onChange={(e) => setForm((s) => ({ ...s, iso_change_control: e.target.checked }))}
              />
              Contrôle des changements actif
            </label>
          </div>

          {error && <p className="md:col-span-2 text-sm text-rose-600">{error}</p>}
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? "Création..." : "Créer le projet"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
