"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Task } from "@/types";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { Button } from "@/components/ui/button";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<"kanban" | "list">("kanban");

  const load = useCallback(() => {
    api<Task[]>("/tasks").then(setTasks).catch(console.error);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Tâches</h1>
        <div className="flex gap-2">
          <Button variant={view === "kanban" ? "primary" : "secondary"} onClick={() => setView("kanban")}>
            Kanban
          </Button>
          <Button variant={view === "list" ? "primary" : "secondary"} onClick={() => setView("list")}>
            Liste
          </Button>
        </div>
      </div>
      {view === "kanban" ? (
        <KanbanBoard tasks={tasks} onUpdate={load} />
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id} className="rounded-lg border bg-white p-4 dark:bg-slate-900">
              <span className="font-medium">{t.title}</span>
              <span className="ml-4 text-sm text-slate-500">{t.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
