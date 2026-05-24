import { ComponentType } from "react";
import { Card } from "@/components/ui/card";

interface KpiCardProps {
  title: string;
  value: string;
  trend?: string;
  trendTone?: "positive" | "negative";
  icon: ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  color: string;
}

export function KpiCard({ title, value, trend, trendTone = "positive", icon: Icon, color }: KpiCardProps) {
  return (
    <Card className="kpi-card border-l-4 p-5" style={{ borderLeftColor: color }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="kpi-label text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{title}</p>
          <p className="kpi-value mt-1 text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">{value}</p>
          {trend ? (
            <p className={`mt-1 text-sm font-medium ${trendTone === "positive" ? "text-emerald-600" : "text-rose-600"}`}>
              {trend}
            </p>
          ) : null}
        </div>
        <div
          className="kpi-icon flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: `${color}15`, color }}
        >
          <Icon size={20} strokeWidth={1.5} />
        </div>
      </div>
    </Card>
  );
}
