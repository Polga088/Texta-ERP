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
      className={`kanban-card interactive-card group cursor-grab ${isDragging ? "dragging" : ""}`}
      {...listeners}
      {...attributes}
      onDoubleClick={() => onOpenTask?.(task)}
    >
      <div className={`absolute left-0 top-0 h-[3px] w-full ${PRIORITY_COLOR[task.priority || "low"]}`} />
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="card-id">{task.task_code || "—"}</p>
          <p className="card-title">{task.title}</p>
        </div>
        <GripVertical size={16} strokeWidth={1.5} className="shrink-0 text-slate-400" />
      </div>
      <p className="card-meta">
        Échéance: {task.due_date || "—"} {task.delay_days && task.delay_days > 0 ? `· ${task.delay_days}j retard` : ""}
      </p>
      <p className="card-meta">Temps: {formatHours(task)}</p>
      {task.checklist && task.checklist.length > 0 && (
        <p className="card-meta">
          Checklist: {task.checklist.filter((item) => item.completed).length}/{task.checklist.length}
        </p>
      )}
      <div className="mt-auto flex flex-wrap gap-2 overflow-hidden">
        <Badge status={task.priority} label={task.priority} />
        <Badge status={task.status} label={STATUS_LABELS[task.status]} />
        {task.attachments && task.attachments.length > 0 && (
          <span className="inline-flex h-[22px] items-center gap-1 rounded-[var(--radius-full)] bg-[var(--color-slate-100)] px-2 text-[11px] font-semibold text-[var(--color-slate-600)]">
            <Paperclip size={12} strokeWidth={1.5} />
            {task.attachments.length}
          </span>
        )}
        {task.status === "blocked" && (
          <span className="inline-flex h-[22px] items-center gap-1 rounded-[var(--radius-full)] bg-[var(--color-danger-50)] px-2 text-[11px] font-semibold text-[var(--color-danger-600)]">
            <AlertTriangle size={12} strokeWidth={1.5} />
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
      className={`kanban-column rounded-[var(--radius-lg)] border border-[var(--color-slate-200)] bg-[var(--color-slate-100)] p-4 transition ${
        isOver ? "drop-target" : ""
      }`}
    >
      <header className="kanban-column-header mb-3 flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-slate-200)] bg-[var(--color-slate-0)] px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.03em] text-[var(--color-slate-700)]">{label}</h3>
        <span className="kanban-count rounded-[var(--radius-full)] bg-[var(--color-slate-800)] px-2.5 py-0.5 text-xs font-bold text-white">
          {tasks.length}
        </span>
      </header>

      <div className="space-y-3">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onOpenTask={onOpenTask} />
        ))}
        {tasks.length === 0 && (
          <div className="rounded-[var(--radius-md)] border-2 border-dashed border-[var(--color-slate-300)] p-4 text-center text-xs font-semibold text-[var(--color-slate-500)]">
            Aucune tâche dans cette colonne
          </div>
        )}
        <button className="kanban-add-card mt-2 w-full rounded-[var(--radius-md)] border-2 border-dashed border-[var(--color-slate-300)] p-3 text-center text-xs font-semibold text-[var(--color-slate-500)] transition hover:border-[var(--color-primary-400)] hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary-700)]">
          Ajouter une tâche
        </button>
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
      <div className="kanban-board">
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
