"use client";

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { Task } from "@/types";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

const COLUMNS = [
  { id: "todo", label: "À faire" },
  { id: "in_progress", label: "En cours" },
  { id: "in_review", label: "En revue" },
  { id: "done", label: "Terminé" },
];

const STATUS_LABELS: Record<string, string> = {
  todo: "À faire",
  in_progress: "En cours",
  in_review: "En revue",
  done: "Terminé",
};

interface Props {
  tasks: Task[];
  onUpdate: () => void;
}

export function KanbanBoard({ tasks, onUpdate }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const taskId = active.id as string;
    const newStatus = over.id as string;
    if (!COLUMNS.some((c) => c.id === newStatus)) return;
    try {
      await api(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      onUpdate();
    } catch {
      // silent fallback
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <section
              key={col.id}
              id={col.id}
              className="min-h-[460px] rounded-2xl border border-slate-200/80 bg-white/80 p-3 shadow-sm"
            >
              <header className="mb-3 flex items-center justify-between rounded-xl bg-slate-100/90 px-3 py-2">
                <h3 className="text-sm font-semibold text-slate-700">{col.label}</h3>
                <span className="rounded-lg bg-white px-2 py-0.5 text-xs font-medium text-slate-500">
                  {colTasks.length}
                </span>
              </header>

              <div className="space-y-2.5">
                {colTasks.map((task) => (
                  <article
                    key={task.id}
                    id={task.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("taskId", task.id)}
                    className="cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-semibold text-slate-800">{task.title}</p>
                      <GripVertical size={15} className="text-slate-400" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge status={task.priority} label={task.priority} />
                      <Badge status={task.status} label={STATUS_LABELS[task.status]} />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </DndContext>
  );
}
