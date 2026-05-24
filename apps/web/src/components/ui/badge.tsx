import { cn } from "@/lib/utils";

const colors: Record<string, string> = {
  todo: "bg-[var(--color-slate-100)] text-[var(--color-slate-700)]",
  in_progress: "bg-[var(--color-info-50)] text-[var(--color-info-600)]",
  in_review: "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]",
  done: "bg-[var(--color-success-50)] text-[var(--color-success-600)]",
  blocked: "bg-[var(--color-danger-50)] text-[var(--color-danger-600)]",
  active: "bg-[var(--color-success-50)] text-[var(--color-success-600)]",
  lead: "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]",
  submitted: "bg-[var(--color-warning-50)] text-[var(--color-warning-600)]",
  approved: "bg-[var(--color-success-50)] text-[var(--color-success-600)]",
  critical: "bg-[var(--color-danger-50)] text-[var(--color-danger-600)]",
  high: "bg-[var(--color-warning-50)] text-[var(--color-warning-600)]",
  medium: "bg-[var(--color-info-50)] text-[var(--color-info-600)]",
  low: "bg-[var(--color-slate-100)] text-[var(--color-slate-700)]",
  urgent: "bg-[var(--color-danger-50)] text-[var(--color-danger-600)]",
};

export function Badge({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] max-w-full items-center whitespace-nowrap rounded-[var(--radius-full)] px-[10px] py-[3px] text-[11px] font-bold uppercase leading-none tracking-[0.02em]",
        colors[status] || "bg-[var(--color-slate-100)] text-[var(--color-slate-700)]",
      )}
      title={label || status}
    >
      {label || status}
    </span>
  );
}
