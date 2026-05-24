"use client";

import Link from "next/link";
import { CSSProperties } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";

const apps = [
  {
    href: "/dashboard",
    label: "Tableau de bord",
    description: "Vision globale KPI, alertes et activité en temps réel.",
    icon: LayoutDashboard,
    moduleClass: "settings",
    glow: "rgba(139, 92, 246, 0.22)",
  },
  {
    href: "/projects",
    label: "Projets",
    description: "Pilotage portefeuille, budget, risques et équipe.",
    icon: FolderKanban,
    moduleClass: "projects",
    glow: "rgba(59, 130, 246, 0.22)",
  },
  {
    href: "/leads",
    label: "Leads",
    description: "Pipeline commercial, scoring et conversion en projet.",
    icon: Target,
    moduleClass: "leads",
    glow: "rgba(124, 58, 237, 0.22)",
  },
  {
    href: "/tasks",
    label: "Tâches",
    description: "Kanban, checklist, blocages et suivi détaillé.",
    icon: CheckCircle2,
    moduleClass: "tasks",
    glow: "rgba(16, 185, 129, 0.2)",
  },
  {
    href: "/time",
    label: "Temps projet",
    description: "Timesheet hebdomadaire, charges et écarts d'effort.",
    icon: Clock,
    moduleClass: "time",
    glow: "rgba(245, 158, 11, 0.22)",
  },
  {
    href: "/chat",
    label: "Chat",
    description: "Collaboration instantanée et notifications d'équipe.",
    icon: MessageSquare,
    moduleClass: "chat",
    glow: "rgba(22, 163, 74, 0.2)",
  },
  {
    href: "/hr",
    label: "Ressources Humaines",
    description: "Organigramme, employés, congés et mouvements RH.",
    icon: Users,
    moduleClass: "hr",
    glow: "rgba(239, 68, 68, 0.18)",
  },
  {
    href: "/permissions",
    label: "Habilitations",
    description: "RBAC, grants projets et matrice des accès.",
    icon: ShieldCheck,
    moduleClass: "settings",
    glow: "rgba(71, 85, 105, 0.2)",
  },
  {
    href: "/calendar",
    label: "Agenda",
    description: "Planification meetings, échéances et synchronisation.",
    icon: CalendarDays,
    moduleClass: "projects",
    glow: "rgba(37, 99, 235, 0.2)",
  },
  {
    href: "/billing",
    label: "Facturation",
    description: "Devis, factures, paiements et suivi des encaissements.",
    icon: FileText,
    moduleClass: "settings",
    glow: "rgba(217, 119, 6, 0.22)",
  },
  {
    href: "/audit",
    label: "Audit",
    description: "Traçabilité, journaux d'action et conformité.",
    icon: ClipboardList,
    moduleClass: "audit",
    glow: "rgba(147, 51, 234, 0.2)",
  },
];

export default function HomeAppsPage() {
  return (
    <div className="card-base relative overflow-hidden rounded-[var(--radius-xl)] p-6 md:p-10">
      <div className="mb-8">
        <h1 className="text-[32px] font-extrabold tracking-[-0.025em] text-[var(--color-slate-900)]">Accueil</h1>
        <p className="mt-2 text-sm font-medium text-[var(--color-slate-600)] md:text-base">
          Lancez un module métier depuis ce hub applicatif.
        </p>
      </div>

      <div className="app-launcher grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {apps.map((app, idx) => (
          <Link
            key={app.href}
            href={app.href}
            className="app-tile interactive-card stagger-item group relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-slate-200)] bg-[var(--color-slate-0)] p-5 shadow-[var(--shadow-sm)] transition-all duration-200"
            style={
              {
                animationDelay: `${idx * 50}ms`,
                ["--tile-glow-color" as string]: app.glow,
              } as CSSProperties
            }
          >
            <span className="pointer-events-none absolute -right-5 -top-5 h-20 w-20 rounded-full blur-[20px] transition-opacity duration-300 group-hover:opacity-100" style={{ background: "var(--tile-glow-color)", opacity: 0.6 }} />
            <div className="app-tile-content relative z-10 flex flex-col gap-3">
              <div className={`icon-container ${app.moduleClass}`}>
                <app.icon size={32} strokeWidth={1.5} />
              </div>
              <p className="app-tile-title text-base font-bold tracking-[-0.01em] text-[var(--color-slate-800)]">{app.label}</p>
              <p className="app-tile-desc line-clamp-2 text-[13px] font-medium text-[var(--color-slate-500)]">
                {app.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
