"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  Calendar,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Shield,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clearTokens } from "@/lib/api";

const nav = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/projects", label: "Projets CRM", icon: FolderKanban },
  { href: "/tasks", label: "Tâches", icon: CheckSquare },
  { href: "/permissions", label: "Habilitations", icon: Shield },
  { href: "/hr", label: "Ressources Humaines", icon: Users },
  { href: "/calendar", label: "Agenda", icon: Calendar },
  { href: "/accounts", label: "Comptes clients", icon: Building2 },
  { href: "/audit", label: "Journal d'audit", icon: ScrollText },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const logout = () => {
    clearTokens();
    router.push("/login");
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-slate-200/80 bg-white/95 px-4 py-6 lg:flex">
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 p-4 text-white shadow-lg">
        <p className="text-xs uppercase tracking-widest text-indigo-300">Texta</p>
        <h1 className="mt-1 text-xl font-bold">CRM + ERP</h1>
        <p className="mt-1 text-xs text-slate-300">Pilotage moderne des opérations</p>
      </div>

      <nav className="flex-1 space-y-1.5">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              pathname.startsWith(href)
                ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <Icon size={17} />
            {label}
          </Link>
        ))}
      </nav>

      <button
        onClick={logout}
        className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      >
        <LogOut size={17} />
        Déconnexion
      </button>
    </aside>
  );
}
