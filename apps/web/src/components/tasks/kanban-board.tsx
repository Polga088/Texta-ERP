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
import { GripVertical } from "lucide-react";
import { CSS } from "@dnd-kit/utilities";
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

function TaskCard({ task }: { task: Task }) {
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
      className="cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing"
      {...listeners}
      {...attributes}
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
  );
}

function Column({
  id,
  label,
  tasks,
}: {
  id: string;
  label: string;
  tasks: Task[];
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
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </section>
  );
}

export function KanbanBoard({ tasks, onUpdate }: Props) {
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
            <Column key={col.id} id={col.id} label={col.label} tasks={colTasks} />
          );
        })}
      </div>
    </DndContext>
  );
}
