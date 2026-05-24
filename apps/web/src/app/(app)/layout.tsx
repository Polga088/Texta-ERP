"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Clock3, Home, LogOut, Moon, Sun } from "lucide-react";
import { api, clearTokens, isAuthenticated } from "@/lib/api";
import { UserNotification } from "@/types";

const SESSION_STARTED_AT_KEY = "session_started_at";
const LAST_ACTIVITY_AT_KEY = "last_activity_at";
const INACTIVITY_TIMEOUT_MINUTES_KEY = "inactivity_timeout_minutes";
const THEME_KEY = "texta_theme";

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [inactivityMinutes, setInactivityMinutes] = useState(30);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const lastActivityRef = useRef<number>(Date.now());
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications],
  );

  useEffect(() => {
    if (!isAuthenticated()) router.replace("/login");
  }, [router, pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const now = Date.now();
    const startedAtStored = Number(localStorage.getItem(SESSION_STARTED_AT_KEY) || now);
    const startedAt = Number.isFinite(startedAtStored) ? startedAtStored : now;
    localStorage.setItem(SESSION_STARTED_AT_KEY, String(startedAt));

    const timeoutStored = Number(localStorage.getItem(INACTIVITY_TIMEOUT_MINUTES_KEY) || "30");
    const timeout = Number.isFinite(timeoutStored) && timeoutStored > 0 ? timeoutStored : 30;
    setInactivityMinutes(timeout);

    const previousActivity = Number(localStorage.getItem(LAST_ACTIVITY_AT_KEY) || now);
    lastActivityRef.current = Number.isFinite(previousActivity) ? previousActivity : now;

    const handleActivity = () => {
      const ts = Date.now();
      lastActivityRef.current = ts;
      localStorage.setItem(LAST_ACTIVITY_AT_KEY, String(ts));
    };

    handleActivity();

    const events: Array<keyof WindowEventMap> = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, handleActivity, { passive: true }));

    const elapsedTimer = window.setInterval(() => {
      const seconds = Math.max(Math.floor((Date.now() - startedAt) / 1000), 0);
      setElapsedSeconds(seconds);
    }, 1000);

    const inactivityTimer = window.setInterval(() => {
      const timeoutMs = timeout * 60 * 1000;
      const inactiveFor = Date.now() - lastActivityRef.current;
      if (inactiveFor >= timeoutMs) {
        clearTokens();
        localStorage.removeItem(SESSION_STARTED_AT_KEY);
        localStorage.removeItem(LAST_ACTIVITY_AT_KEY);
        router.replace("/login?reason=inactive");
      }
    }, 15000);

    return () => {
      window.clearInterval(elapsedTimer);
      window.clearInterval(inactivityTimer);
      events.forEach((eventName) => window.removeEventListener(eventName, handleActivity));
    };
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated()) return;
    const loadNotifications = () => {
      api<UserNotification[]>("/collaboration/notifications")
        .then(setNotifications)
        .catch(() => setNotifications([]));
    };
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedTheme = localStorage.getItem(THEME_KEY);
    const initialTheme = storedTheme === "dark" ? "dark" : "light";
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem(THEME_KEY, nextTheme);
    }
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  };

  const markAsRead = async (id: string) => {
    await api(`/collaboration/notifications/${id}/read`, { method: "PATCH" });
    const refreshed = await api<UserNotification[]>("/collaboration/notifications");
    setNotifications(refreshed);
  };

  const logout = () => {
    clearTokens();
    if (typeof window !== "undefined") {
      localStorage.removeItem(SESSION_STARTED_AT_KEY);
      localStorage.removeItem(LAST_ACTIVITY_AT_KEY);
    }
    router.push("/login");
  };

  return (
    <div className="page-background min-h-screen">
      <header className="navbar">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 md:px-2 lg:px-4">
          <Link href="/home" className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span className="icon-container settings h-9 w-9 rounded-[var(--radius-md)]">
              <Home size={16} strokeWidth={1.5} />
            </span>
            Accueil Applications
          </Link>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 md:inline-flex">
              <Clock3 size={14} strokeWidth={1.5} className="text-[var(--color-primary-500)]" />
              Session {formatDuration(elapsedSeconds)}
              <span className="text-slate-400">· coupure {inactivityMinutes} min</span>
            </div>

            <button
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-slate-200)] bg-[var(--color-slate-0)] px-3 py-2 text-sm font-medium text-[var(--color-slate-600)] transition hover:bg-[var(--color-slate-100)]"
            >
              {theme === "dark" ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
              {theme === "dark" ? "Clair" : "Sombre"}
            </button>

            <div className="relative">
              <button
                onClick={() => setIsNotifOpen((open) => !open)}
                className="relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <Bell size={16} strokeWidth={1.5} />
                Notifications
                {unreadCount > 0 && (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                    {unreadCount}
                  </span>
                )}
              </button>
              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-[340px] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Centre de notifications
                  </div>
                  <ul className="max-h-80 space-y-1 overflow-auto">
                    {notifications.slice(0, 8).map((notification) => (
                      <li key={notification.id} className="rounded-xl border border-slate-100 px-3 py-2">
                        <p className="text-sm font-medium text-slate-800">{notification.title}</p>
                        <p className="text-xs text-slate-500">{notification.message}</p>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-[11px] text-slate-400">
                            {new Date(notification.created_at).toLocaleString("fr-FR")}
                          </span>
                          {!notification.is_read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="text-xs font-medium text-indigo-600 hover:underline"
                            >
                              Marquer lu
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                    {notifications.length === 0 && (
                      <li className="px-3 py-4 text-sm text-slate-500">Aucune notification disponible.</li>
                    )}
                  </ul>
                  <div className="mt-2 border-t border-slate-100 px-2 pt-2">
                    <Link href="/notifications" className="text-xs font-medium text-indigo-600 hover:underline">
                      Voir tout l&apos;historique
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <LogOut size={16} strokeWidth={1.5} />
              Déconnexion
            </button>
          </div>
        </div>
      </header>
      <main className="page-enter mx-auto max-w-7xl p-4 md:p-6 lg:p-8">{children}</main>
    </div>
  );
}
