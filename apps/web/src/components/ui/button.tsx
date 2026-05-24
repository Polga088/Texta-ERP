import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    const variants = {
      primary:
        "btn-primary bg-[var(--color-primary-600)] text-white shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-500)] active:bg-[var(--color-primary-700)]",
      secondary:
        "bg-[var(--color-slate-0)] text-[var(--color-slate-700)] border border-[var(--color-slate-200)] hover:bg-[var(--color-slate-50)]",
      ghost: "text-[var(--color-slate-600)] hover:bg-[var(--color-slate-100)]",
      danger: "bg-[var(--color-danger-500)] text-white hover:bg-[var(--color-danger-600)]",
    };
    const sizes = {
      sm: "h-11 px-3 text-sm",
      md: "h-11 px-4 text-sm",
      lg: "h-12 px-6 text-base",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-300)]/60 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
