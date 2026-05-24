import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "card-base interactive-card rounded-[var(--radius-lg)] border border-[var(--color-slate-200)] bg-[var(--color-slate-0)] p-6 shadow-[var(--shadow-sm)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-base font-semibold tracking-[-0.01em] text-[var(--color-slate-800)]",
        className,
      )}
      {...props}
    />
  );
}
