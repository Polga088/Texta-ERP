"use client";

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
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
      /* ignore */
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <div
              key={col.id}
              id={col.id}
              className="min-h-[400px] rounded-xl bg-slate-50 p-4 dark:bg-slate-900"
            >
              <h3 className="mb-3 font-semibold text-slate-700 dark:text-slate-300">
                {col.label}
                <span className="ml-2 text-sm text-slate-400">({colTasks.length})</span>
              </h3>
              <div className="space-y-2">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    id={task.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("taskId", task.id)}
                    className="cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800"
                  >
                    <p className="font-medium text-sm">{task.title}</p>
                    <div className="mt-2 flex gap-2">
                      <Badge status={task.priority} label={task.priority} />
                      <Badge status={task.status} label={STATUS_LABELS[task.status]} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </DndContext>
  );
}
