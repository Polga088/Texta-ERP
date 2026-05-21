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
    quality_standard: "ISO 9001",
    scope_statement: "",
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
          Définissez les informations société, identité visuelle et standard qualité.
        </p>
      </div>

      <Card>
        <CardTitle className="mb-4">Normes projet</CardTitle>
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
          <div>
            <label className="mb-1 block text-sm font-medium">Standard qualité</label>
            <Input
              value={form.quality_standard}
              onChange={(e) => setForm((s) => ({ ...s, quality_standard: e.target.value }))}
              placeholder="ISO 9001 / ISO 27001"
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
            <label className="mb-1 block text-sm font-medium">Périmètre / Scope Statement</label>
            <textarea
              className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              value={form.scope_statement}
              onChange={(e) => setForm((s) => ({ ...s, scope_statement: e.target.value }))}
            />
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
