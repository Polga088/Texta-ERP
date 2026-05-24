import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "input-field h-11 w-full rounded-[var(--radius-md)] border-[1.5px] border-[var(--color-slate-200)] bg-[var(--color-slate-0)] px-[14px] text-sm font-medium text-[var(--color-slate-800)] shadow-[var(--shadow-xs)] outline-none transition-all placeholder:font-normal placeholder:text-[var(--color-slate-400)] focus:border-[var(--color-primary-500)] focus:ring-4 focus:ring-[var(--color-primary-100)]",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
