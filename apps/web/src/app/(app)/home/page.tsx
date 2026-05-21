"use client";

import Link from "next/link";
import {
  Bell,
  Calendar,
  CheckSquare,
  Clock3,
  FolderKanban,
  MessageSquare,
  ScrollText,
  Shield,
  Target,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const apps = [
  { href: "/dashboard", label: "Tableau de bord", icon: FolderKanban, color: "text-indigo-600", bg: "bg-indigo-100" },
  { href: "/projects", label: "Projets", icon: FolderKanban, color: "text-blue-600", bg: "bg-blue-100" },
  { href: "/leads", label: "Leads", icon: Target, color: "text-cyan-600", bg: "bg-cyan-100" },
  { href: "/tasks", label: "Tâches", icon: CheckSquare, color: "text-violet-600", bg: "bg-violet-100" },
  { href: "/time", label: "Temps projet", icon: Clock3, color: "text-amber-600", bg: "bg-amber-100" },
  { href: "/chat", label: "Chat", icon: MessageSquare, color: "text-emerald-600", bg: "bg-emerald-100" },
  { href: "/notifications", label: "Notifications", icon: Bell, color: "text-rose-600", bg: "bg-rose-100" },
  { href: "/hr", label: "Ressources Humaines", icon: Users, color: "text-sky-600", bg: "bg-sky-100" },
  { href: "/permissions", label: "Habilitations", icon: Shield, color: "text-purple-600", bg: "bg-purple-100" },
  { href: "/calendar", label: "Agenda", icon: Calendar, color: "text-teal-600", bg: "bg-teal-100" },
  { href: "/audit", label: "Audit", icon: ScrollText, color: "text-slate-600", bg: "bg-slate-100" },
];

export default function HomeAppsPage() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(2,6,23,0.08)] backdrop-blur md:p-10">
      <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-indigo-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-cyan-300/20 blur-3xl" />

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Accueil</h1>
        <p className="mt-2 text-sm text-slate-600 md:text-base">
          Choisissez une application pour gérer votre plateforme.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {apps.map((app, idx) => (
          <Link
            key={app.href}
            href={app.href}
            className={cn(
              "group animate-app-entrance rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl",
            )}
            style={{ animationDelay: `${idx * 40}ms` }}
          >
            <div className={cn("mb-3 inline-flex rounded-xl p-2.5 transition group-hover:scale-110", app.bg, app.color)}>
              <app.icon size={20} />
            </div>
            <p className="text-sm font-semibold text-slate-800">{app.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
