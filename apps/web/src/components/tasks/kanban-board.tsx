"use client";

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { AlertTriangle, GripVertical, Paperclip } from "lucide-react";
import { CSS } from "@dnd-kit/utilities";
import { Task } from "@/types";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

const COLUMNS = [
  { id: "todo", label: "À faire" },
  { id: "in_progress", label: "En cours" },
  { id: "in_review", label: "En revue" },
  { id: "done", label: "Terminé" },
  { id: "blocked", label: "Bloquée" },
];

const STATUS_LABELS: Record<string, string> = {
  todo: "À faire",
  in_progress: "En cours",
  in_review: "En revue",
  done: "Terminé",
  blocked: "Bloquée",
};

interface Props {
  tasks: Task[];
  onUpdate: () => void;
  onOpenTask?: (task: Task) => void;
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: "bg-rose-600",
  urgent: "bg-rose-500",
  high: "bg-orange-500",
  medium: "bg-amber-400",
  low: "bg-slate-300",
};

function formatHours(task: Task): string {
  const actual = task.actual_hours || 0;
  const estimated = task.estimated_hours || 0;
  return `${actual}h / ${estimated}h`;
}

function TaskCard({ task, onOpenTask }: { task: Task; onOpenTask?: (task: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });
  const style = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className="group relative cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing"
      {...listeners}
      {...attributes}
      onDoubleClick={() => onOpenTask?.(task)}
    >
      <div className={`absolute left-0 top-0 h-1 w-full ${PRIORITY_COLOR[task.priority || "low"]}`} />
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium text-slate-400">{task.task_code || "TSK-..."}</p>
          <p className="line-clamp-2 text-sm font-semibold text-slate-800">{task.title}</p>
        </div>
        <GripVertical size={15} className="text-slate-400" />
      </div>
      <p className="text-xs text-slate-500">
        Échéance: {task.due_date || "N/A"} {task.delay_days && task.delay_days > 0 ? `· ⚠️ ${task.delay_days}j` : ""}
      </p>
      <p className="mt-1 text-xs text-slate-500">Temps: {formatHours(task)}</p>
      {task.checklist && task.checklist.length > 0 && (
        <p className="mt-1 text-xs text-slate-500">
          Checklist: {task.checklist.filter((item) => item.completed).length}/{task.checklist.length}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        <Badge status={task.priority} label={task.priority} />
        <Badge status={task.status} label={STATUS_LABELS[task.status]} />
        {task.attachments && task.attachments.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
            <Paperclip size={11} />
            {task.attachments.length}
          </span>
        )}
        {task.status === "blocked" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] text-rose-700">
            <AlertTriangle size={11} />
            Bloquée
          </span>
        )}
      </div>
    </article>
  );
}

function Column({
  id,
  label,
  tasks,
  onOpenTask,
}: {
  id: string;
  label: string;
  tasks: Task[];
  onOpenTask?: (task: Task) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <section
      ref={setNodeRef}
      className={`min-h-[460px] rounded-2xl border p-3 shadow-sm transition ${
        isOver ? "border-indigo-300 bg-indigo-50/40" : "border-slate-200/80 bg-white/80"
      }`}
    >
      <header className="mb-3 flex items-center justify-between rounded-xl bg-slate-100/90 px-3 py-2">
        <h3 className="text-sm font-semibold text-slate-700">{label}</h3>
        <span className="rounded-lg bg-white px-2 py-0.5 text-xs font-medium text-slate-500">{tasks.length}</span>
      </header>

      <div className="space-y-2.5">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onOpenTask={onOpenTask} />
        ))}
        {tasks.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-4 text-xs text-slate-400">Aucune tâche</p>}
      </div>
    </section>
  );
}

export function KanbanBoard({ tasks, onUpdate, onOpenTask }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;
    const overTask = tasks.find((task) => task.id === overId);
    const newStatus = overTask?.status || overId;
    const sourceTask = tasks.find((task) => task.id === taskId);

    if (!COLUMNS.some((c) => c.id === newStatus)) return;
    if (sourceTask?.status === newStatus) return;
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
            <Column key={col.id} id={col.id} label={col.label} tasks={colTasks} onOpenTask={onOpenTask} />
          );
        })}
      </div>
    </DndContext>
  );
}
