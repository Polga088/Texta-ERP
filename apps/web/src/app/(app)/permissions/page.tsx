"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Group, Project, User } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";

export default function PermissionsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    api<Project[]>("/projects").then(setProjects).catch(console.error);
    api<Group[]>("/groups").then(setGroups).catch(console.error);
    api<User[]>("/users").then(setUsers).catch(console.error);
  }, []);

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">Organigramme d&apos;habilitation</h1>
      <p className="mb-8 text-slate-600">
        Le chef de projet délègue des droits par utilisateur ou groupe sur chaque projet.
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardTitle>Utilisateurs</CardTitle>
          <ul className="mt-4 space-y-2 text-sm">
            {users.map((u) => (
              <li key={u.id} className="flex justify-between border-b pb-2">
                <span>{u.full_name}</span>
                <span className="text-slate-500">{u.global_role}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle>Groupes</CardTitle>
          <ul className="mt-4 space-y-2 text-sm">
            {groups.map((g) => (
              <li key={g.id} className="border-b pb-2">
                <span className="font-medium">{g.name}</span>
                <span className="ml-2 text-slate-500">({g.member_count} membres)</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle>Projets</CardTitle>
          <ul className="mt-4 space-y-2 text-sm">
            {projects.map((p) => (
              <li key={p.id}>
                <a href={`/projects/${p.id}`} className="text-indigo-600 hover:underline">
                  {p.name}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-8">
        <CardTitle>Matrice des permissions projet</CardTitle>
        <p className="mt-2 text-sm text-slate-500">
          view · edit_tasks · manage_members · manage_settings — détail par projet via la fiche projet.
        </p>
      </Card>
    </div>
  );
}
