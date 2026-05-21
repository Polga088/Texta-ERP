"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, LogOut } from "lucide-react";
import { clearTokens, isAuthenticated } from "@/lib/api";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated()) router.replace("/login");
  }, [router, pathname]);

  const logout = () => {
    clearTokens();
    router.push("/login");
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6 lg:px-8">
          <Link href="/home" className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span className="rounded-lg bg-indigo-100 p-1.5 text-indigo-600">
              <Home size={14} />
            </span>
            Accueil Applications
          </Link>
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">{children}</main>
    </div>
  );
}
