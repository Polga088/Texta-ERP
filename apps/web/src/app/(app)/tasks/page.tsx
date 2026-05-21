"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutList, LayoutPanelLeft } from "lucide-react";
import { api } from "@/lib/api";
import { Task } from "@/types";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const STATUS_LABELS: Record<string, string> = {
  todo: "À faire",
  in_progress: "En cours",
  in_review: "En revue",
  done: "Terminé",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<"kanban" | "list">("kanban");

  const load = useCallback(() => {
    api<Task[]>("/tasks").then(setTasks).catch(console.error);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const doneRate = useMemo(() => {
    if (tasks.length === 0) return 0;
    return Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100);
  }, [tasks]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Tâches</h1>
          <p className="mt-1 text-sm text-slate-500">
            {tasks.length} tâches, {doneRate}% terminées.
          </p>
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          <Button
            variant={view === "kanban" ? "primary" : "ghost"}
            className="rounded-lg"
            onClick={() => setView("kanban")}
          >
            <LayoutPanelLeft size={16} />
            Kanban
          </Button>
          <Button
            variant={view === "list" ? "primary" : "ghost"}
            className="rounded-lg"
            onClick={() => setView("list")}
          >
            <LayoutList size={16} />
            Liste
          </Button>
        </div>
      </div>

      {view === "kanban" ? (
        <KanbanBoard tasks={tasks} onUpdate={load} />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-800">{task.title}</p>
                  <p className="text-xs text-slate-500">
                    Priorité: {task.priority}
                    {task.due_date ? ` · Échéance: ${task.due_date}` : ""}
                  </p>
                </div>
                <Badge status={task.status} label={STATUS_LABELS[task.status]} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
