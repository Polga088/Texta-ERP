"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ShieldCheck, UserCog, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Grant, Project } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";

const STATUS_FR: Record<string, string> = {
  lead: "Prospect",
  active: "Actif",
  on_hold: "En pause",
  completed: "Terminé",
  cancelled: "Annulé",
};

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

  const groupedGrants = useMemo(() => {
    const users = grants.filter((g) => g.grantee_type === "user");
    const groups = grants.filter((g) => g.grantee_type === "group");
    return { users, groups };
  }, [grants]);

  if (!project) return <p className="text-slate-500">Chargement du projet...</p>;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{project.name}</h1>
          <Badge status={project.status} label={STATUS_FR[project.status] || project.status} />
        </div>
        <p className="mt-3 max-w-3xl text-sm text-slate-600">
          {project.description || "Aucune description pour ce projet."}
        </p>
        <div className="mt-4 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
          <p>
            <span className="font-medium text-slate-800">Société:</span> {project.company_name || "N/A"}
          </p>
          <p>
            <span className="font-medium text-slate-800">Code projet:</span> {project.project_code || "N/A"}
          </p>
          <p>
            <span className="font-medium text-slate-800">Standard:</span>{" "}
            {project.quality_standard || "N/A"}
          </p>
          <p>
            <span className="font-medium text-slate-800">Scope:</span> {project.scope_statement || "N/A"}
          </p>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck size={18} className="text-indigo-600" />
            Vos permissions effectives
          </CardTitle>
          <ul className="mt-4 flex flex-wrap gap-2">
            {perms.length > 0 ? (
              perms.map((p) => (
                <li key={p} className="rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                  {p}
                </li>
              ))
            ) : (
              <li className="text-sm text-slate-500">Aucune permission explicite.</li>
            )}
          </ul>
        </Card>

        <Card>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCog size={18} className="text-slate-700" />
            Habilitations utilisateurs
          </CardTitle>
          <ul className="mt-4 space-y-2">
            {groupedGrants.users.length === 0 && <li className="text-sm text-slate-500">Aucune habilitation utilisateur.</li>}
            {groupedGrants.users.map((g) => (
              <li key={g.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="font-medium text-slate-800">Utilisateur #{g.grantee_id.slice(0, 8)}</p>
                <p className="mt-1 text-slate-500">{g.permissions.join(", ")}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users size={18} className="text-slate-700" />
            Habilitations groupes
          </CardTitle>
          <ul className="mt-4 space-y-2">
            {groupedGrants.groups.length === 0 && <li className="text-sm text-slate-500">Aucune habilitation groupe.</li>}
            {groupedGrants.groups.map((g) => (
              <li key={g.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="font-medium text-slate-800">Groupe #{g.grantee_id.slice(0, 8)}</p>
                <p className="mt-1 text-slate-500">{g.permissions.join(", ")}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
