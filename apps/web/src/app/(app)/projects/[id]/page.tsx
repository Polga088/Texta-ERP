"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Grant, Project } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [perms, setPerms] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    api<Project>(`/projects/${id}`).then(setProject).catch(console.error);
    api<Grant[]>(`/projects/${id}/grants`).then(setGrants).catch(() => setGrants([]));
    api<{ permissions: string[] }>(`/projects/${id}/permissions/effective`)
      .then((r) => setPerms(r.permissions))
      .catch(() => setPerms([]));
  }, [id]);

  if (!project) return <p>Chargement...</p>;

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">{project.name}</h1>
      <Badge status={project.status} />
      <p className="mt-4 text-slate-600">{project.description}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Vos permissions</CardTitle>
          <ul className="mt-4 flex flex-wrap gap-2">
            {perms.map((p) => (
              <li key={p} className="rounded bg-indigo-50 px-2 py-1 text-sm text-indigo-700">
                {p}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle>Habilitations déléguées</CardTitle>
          <ul className="mt-4 space-y-2 text-sm">
            {grants.map((g) => (
              <li key={g.id} className="border-b pb-2">
                <span className="font-medium">{g.grantee_type}</span> — {g.permissions.join(", ")}
              </li>
            ))}
            {grants.length === 0 && <p className="text-slate-500">Aucune habilitation</p>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
