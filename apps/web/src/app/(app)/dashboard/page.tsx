"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, CalendarClock, CheckCircle2, FolderKanban, Hourglass, Users } from "lucide-react";
import { api } from "@/lib/api";
import { DashboardStats } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api<DashboardStats>("/dashboard/stats").then(setStats).catch(console.error);
  }, []);

  const items = useMemo(
    () =>
      stats
        ? [
            {
              label: "Projets actifs",
              value: stats.projects_active,
              hint: `${stats.projects_total} total`,
              icon: FolderKanban,
            },
            {
              label: "Tâches terminées",
              value: stats.tasks_done,
              hint: `${stats.tasks_total} total`,
              icon: CheckCircle2,
            },
            { label: "Employés", value: stats.employees_total, hint: "RH", icon: Users },
            { label: "Congés en attente", value: stats.leave_pending, hint: "Validation RH", icon: Hourglass },
            {
              label: "Réunions cette semaine",
              value: stats.events_this_week,
              hint: "Agenda",
              icon: CalendarClock,
            },
            { label: "Comptes clients", value: stats.accounts_total, hint: "CRM", icon: Building2 },
          ]
        : [],
    [stats],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Tableau de bord</h1>
        <p className="mt-1 text-sm text-slate-500">Vue d&apos;ensemble de votre plateforme CRM+ERP.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Card key={item.label} className="relative overflow-hidden">
            <div className="absolute -right-6 -top-6 rounded-full bg-indigo-100 p-5 text-indigo-500/40">
              <item.icon size={26} />
            </div>
            <CardTitle className="text-sm font-medium text-slate-500">{item.label}</CardTitle>
            <p className="mt-3 text-3xl font-bold text-slate-900">{item.value}</p>
            <p className="mt-1 text-xs text-slate-500">{item.hint}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
