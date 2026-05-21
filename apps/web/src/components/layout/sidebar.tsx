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
    <aside className="flex h-screen w-64 flex-col border-r border-slate-200 bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 p-6">
        <p className="text-xs uppercase tracking-widest text-indigo-400">Texta</p>
        <h1 className="text-xl font-bold">CRM + ERP</h1>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              pathname.startsWith(href)
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white",
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
      <button
        onClick={logout}
        className="m-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
      >
        <LogOut size={18} />
        Déconnexion
      </button>
    </aside>
  );
}
