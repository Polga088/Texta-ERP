"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DashboardStats } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api<DashboardStats>("/dashboard/stats").then(setStats).catch(console.error);
  }, []);

  const items = stats
    ? [
        { label: "Projets actifs", value: stats.projects_active, total: stats.projects_total },
        { label: "Tâches terminées", value: stats.tasks_done, total: stats.tasks_total },
        { label: "Employés", value: stats.employees_total },
        { label: "Congés en attente", value: stats.leave_pending },
        { label: "Réunions cette semaine", value: stats.events_this_week },
        { label: "Comptes clients", value: stats.accounts_total },
      ]
    : [];

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold">Tableau de bord</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Card key={item.label}>
            <CardTitle className="text-sm font-normal text-slate-500">{item.label}</CardTitle>
            <p className="mt-2 text-3xl font-bold text-indigo-600">
              {item.value}
              {"total" in item && item.total !== undefined && (
                <span className="text-lg text-slate-400"> / {item.total}</span>
              )}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
