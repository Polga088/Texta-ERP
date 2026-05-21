"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Project } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const STATUS_FR: Record<string, string> = {
  lead: "Prospect",
  active: "Actif",
  on_hold: "En pause",
  completed: "Terminé",
  cancelled: "Annulé",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    api<Project[]>("/projects").then(setProjects).catch(console.error);
  }, []);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Projets CRM</h1>
        <Link href="/projects/new">
          <Button>Créer un projet</Button>
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <h3 className="font-semibold">{p.name}</h3>
              <p className="mt-2 line-clamp-2 text-sm text-slate-500">{p.description}</p>
              <div className="mt-4">
                <Badge status={p.status} label={STATUS_FR[p.status] || p.status} />
              </div>
            </Card>
          </Link>
        ))}
      </div>
      {projects.length === 0 && (
        <p className="text-slate-500">Aucun projet visible. Vérifiez vos habilitations.</p>
      )}
    </div>
  );
}
