import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

const priorityTone: Record<NonNullable<CardProps["priority"]>, string> = {
  violet: "before:bg-[var(--color-primary-500)]",
  success: "before:bg-[var(--color-success-500)]",
  danger: "before:bg-[var(--color-danger-500)]",
  warning: "before:bg-[var(--color-warning-500)]",
  info: "before:bg-[var(--color-info-500)]",
};

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  priority?: "violet" | "success" | "danger" | "warning" | "info";
}

export function Card({ className, priority, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "card-base interactive-card relative rounded-[var(--radius-lg)] border border-[var(--color-slate-200)] bg-[var(--color-slate-0)] p-6 shadow-[var(--shadow-sm)]",
        priority &&
          "before:absolute before:left-0 before:right-0 before:top-0 before:h-[3px] before:rounded-t-[var(--radius-lg)]",
        priority ? priorityTone[priority] : "",
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
