"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Project, TimeEntry } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

const SESSION_STARTED_AT_KEY = "session_started_at";
const INACTIVITY_TIMEOUT_MINUTES_KEY = "inactivity_timeout_minutes";

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function TimeTrackingPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [note, setNote] = useState("");
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [inactivityTimeoutMinutes, setInactivityTimeoutMinutes] = useState(30);

  const load = () => {
    api<TimeEntry[]>("/time-entries").then(setEntries).catch(console.error);
    api<Project[]>("/projects").then(setProjects).catch(console.error);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const now = Date.now();
    const startedAtStored = Number(localStorage.getItem(SESSION_STARTED_AT_KEY) || now);
    const startedAt = Number.isFinite(startedAtStored) ? startedAtStored : now;
    localStorage.setItem(SESSION_STARTED_AT_KEY, String(startedAt));

    const timeoutStored = Number(localStorage.getItem(INACTIVITY_TIMEOUT_MINUTES_KEY) || "30");
    if (Number.isFinite(timeoutStored) && timeoutStored > 0) {
      setInactivityTimeoutMinutes(timeoutStored);
    }

    const timer = window.setInterval(() => {
      setSessionSeconds(Math.max(Math.floor((Date.now() - startedAt) / 1000), 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const totalHours = useMemo(
    () => (entries.reduce((acc, cur) => acc + cur.duration_minutes, 0) / 60).toFixed(2),
    [entries],
  );

  const startEntry = async () => {
    if (!projectId) return;
    await api("/time-entries", {
      method: "POST",
      body: JSON.stringify({
        project_id: projectId,
        started_at: new Date().toISOString(),
        note,
      }),
    });
    setNote("");
    load();
  };

  const saveTimeout = () => {
    const normalized = Math.min(Math.max(inactivityTimeoutMinutes, 5), 240);
    setInactivityTimeoutMinutes(normalized);
    localStorage.setItem(INACTIVITY_TIMEOUT_MINUTES_KEY, String(normalized));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Timing projet</h1>
        <p className="mt-1 text-sm text-slate-500">
          Temps total suivi: <span className="font-semibold text-slate-800">{totalHours} h</span>
        </p>
      </div>

      <Card>
        <CardTitle className="mb-3">Session automatique</CardTitle>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Compteur session</p>
            <p className="mt-1 text-lg font-bold text-indigo-900">{formatDuration(sessionSeconds)}</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Kill session inactif (minutes)</label>
            <input
              type="number"
              min={5}
              max={240}
              value={inactivityTimeoutMinutes}
              onChange={(e) => setInactivityTimeoutMinutes(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            />
          </div>
          <Button onClick={saveTimeout}>Enregistrer le délai</Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Le compteur démarre automatiquement dès la connexion. La session est coupée après inactivité.
        </p>
      </Card>

      <Card>
        <CardTitle className="mb-3">Démarrer un suivi de temps</CardTitle>
        <div className="grid gap-3 md:grid-cols-3">
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">Sélectionner un projet</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optionnel)"
          />
          <Button onClick={startEntry}>Démarrer</Button>
        </div>
      </Card>

      <Card className="p-0">
        <CardTitle className="border-b border-slate-100 px-4 py-3">Historique</CardTitle>
        <ul className="divide-y divide-slate-100">
          {entries.map((e) => (
            <li key={e.id} className="px-4 py-3 text-sm">
              <p className="font-medium text-slate-800">
                Projet #{e.project_id.slice(0, 8)} · {e.duration_minutes} min
              </p>
              <p className="text-slate-500">
                Début: {new Date(e.started_at).toLocaleString("fr-FR")}
                {e.ended_at ? ` · Fin: ${new Date(e.ended_at).toLocaleString("fr-FR")}` : " · En cours"}
              </p>
            </li>
          ))}
          {entries.length === 0 && <li className="px-4 py-5 text-sm text-slate-500">Aucun temps enregistré.</li>}
        </ul>
      </Card>
    </div>
  );
}
