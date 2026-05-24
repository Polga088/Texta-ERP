import { cn } from "@/lib/utils";

const colors: Record<string, string> = {
  todo: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  in_review: "bg-violet-100 text-violet-700",
  done: "bg-emerald-100 text-emerald-700",
  blocked: "bg-rose-100 text-rose-700",
  active: "bg-emerald-100 text-emerald-700",
  lead: "bg-purple-100 text-purple-700",
  submitted: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  critical: "bg-rose-100 text-rose-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-700",
  urgent: "bg-red-100 text-red-700",
};

export function Badge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", colors[status] || "bg-slate-100")}>
      {label || status}
    </span>
  );
}
