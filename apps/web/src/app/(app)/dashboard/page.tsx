"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  FolderKanban,
  RefreshCcw,
  Timer,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { api } from "@/lib/api";
import { DashboardOverview, DashboardReports } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";

type DashboardTab = "dashboard" | "reports" | "analytics";
type PeriodFilter = "today" | "this_week" | "this_month" | "this_quarter" | "this_year";

const PERIOD_OPTIONS: Array<{ value: PeriodFilter; label: string }> = [
  { value: "today", label: "Aujourd'hui" },
  { value: "this_week", label: "Cette semaine" },
  { value: "this_month", label: "Ce mois" },
  { value: "this_quarter", label: "Ce trimestre" },
  { value: "this_year", label: "Cette année" },
];

function formatMoney(value: number): string {
  return new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 }).format(value);
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [keys.join(","), ...rows.map((row) => keys.map((key) => esc(row[key])).join(","))].join("\n");
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("dashboard");
  const [period, setPeriod] = useState<PeriodFilter>("this_month");
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [reports, setReports] = useState<DashboardReports | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [overviewResponse, reportsResponse] = await Promise.all([
        api<DashboardOverview>(`/dashboard/overview?period=${period}`),
        api<DashboardReports>(`/dashboard/reports?period=${period}`),
      ]);
      setOverview(overviewResponse);
      setReports(reportsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger le dashboard");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      load().catch(() => undefined);
    }, 5 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [load]);

  const maxPipelineStack = useMemo(() => {
    if (!overview) return 1;
    return (
      Math.max(
        ...overview.pipeline_chart.map((item) => item.new + item.qualified + item.proposal + item.won + item.lost),
        1,
      ) || 1
    );
  }, [overview]);

  const maxProjectsValue = useMemo(() => {
    if (!overview) return 1;
    return Math.max(...overview.projects_chart.map((item) => Math.max(item.created, item.completed, item.delayed)), 1);
  }, [overview]);

  const exportCurrentView = () => {
    if (!reports) return;
    const dataset =
      activeTab === "reports"
        ? reports.commercial_performance.map((row) => ({
            commercial: row.user_name,
            leads_crees: row.leads_created,
            leads_gagnes: row.leads_won,
            ca_gagne: row.won_revenue,
            conversion: row.conversion_rate,
            delai_moyen: row.avg_cycle_days,
          }))
        : reports.project_status.map((row) => ({
            projet: row.project_name,
            client: row.client_name,
            budget_total: row.budget_total,
            budget_consomme: row.budget_consumed,
            retard: row.delay_days,
            health: row.health_status,
          }));
    const csv = toCsv(dataset);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "dashboard_export.csv";
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard Global</h1>
          <p className="mt-1 text-sm text-slate-500">Pilotage Leads, Projets, Tâches et performance équipe.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button variant="secondary" onClick={() => load()}>
            <RefreshCcw size={14} />
            Rafraîchir
          </Button>
          <Button variant="secondary" onClick={exportCurrentView}>
            <Download size={14} />
            Exporter CSV
          </Button>
        </div>
      </div>

      <Card className="sticky top-20 z-20 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["dashboard", "reports", "analytics"] as DashboardTab[]).map((tab) => (
            <Button key={tab} size="sm" variant={activeTab === tab ? "primary" : "ghost"} onClick={() => setActiveTab(tab)}>
              {tab === "dashboard" ? "Dashboard" : tab === "reports" ? "Rapports" : "Analytics"}
            </Button>
          ))}
        </div>
      </Card>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Chargement des données...</p>}

      {overview && (
        <div className="kpi-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="CA Pipeline"
            value={`${formatMoney(overview.kpis.pipeline_revenue.value)} MAD`}
            trend={`${overview.kpis.pipeline_revenue.variation >= 0 ? "↑" : "↓"} ${Math.abs(overview.kpis.pipeline_revenue.variation).toFixed(1)}% vs période précédente`}
            trendTone={overview.kpis.pipeline_revenue.variation >= 0 ? "positive" : "negative"}
            icon={TrendingUp}
            color="#8b5cf6"
          />
          <KpiCard
            title="CA Gagné"
            value={`${formatMoney(overview.kpis.won_revenue.value)} MAD`}
            trend={`${overview.kpis.won_revenue.variation >= 0 ? "↑" : "↓"} ${Math.abs(overview.kpis.won_revenue.variation).toFixed(1)}% vs période précédente`}
            trendTone={overview.kpis.won_revenue.variation >= 0 ? "positive" : "negative"}
            icon={Trophy}
            color="#10b981"
          />
          <KpiCard
            title="Taux Conversion"
            value={`${overview.kpis.conversion_rate.value.toFixed(1)}%`}
            trend={`${overview.kpis.conversion_rate.variation >= 0 ? "↑" : "↓"} ${Math.abs(overview.kpis.conversion_rate.variation).toFixed(1)}% vs période précédente`}
            trendTone={overview.kpis.conversion_rate.variation >= 0 ? "positive" : "negative"}
            icon={TrendingUp}
            color="#3b82f6"
          />
          <KpiCard
            title="Projets Actifs"
            value={String(Math.round(overview.kpis.active_projects.value))}
            trend={`${overview.kpis.active_projects.variation >= 0 ? "↑" : "↓"} ${Math.abs(overview.kpis.active_projects.variation).toFixed(1)}% vs période précédente`}
            trendTone={overview.kpis.active_projects.variation >= 0 ? "positive" : "negative"}
            icon={FolderKanban}
            color="#6366f1"
          />
          <KpiCard
            title="Projets en Retard"
            value={String(Math.round(overview.kpis.delayed_projects.value))}
            trend={`${overview.kpis.delayed_projects.variation >= 0 ? "↑" : "↓"} ${Math.abs(overview.kpis.delayed_projects.variation).toFixed(1)}% vs période précédente`}
            trendTone={overview.kpis.delayed_projects.variation >= 0 ? "positive" : "negative"}
            icon={AlertTriangle}
            color="#ef4444"
          />
          <KpiCard
            title="Heures Loggées"
            value={`${overview.kpis.logged_hours.value.toFixed(1)}h`}
            trend={`${overview.kpis.logged_hours.variation >= 0 ? "↑" : "↓"} ${Math.abs(overview.kpis.logged_hours.variation).toFixed(1)}% vs période précédente`}
            trendTone={overview.kpis.logged_hours.variation >= 0 ? "positive" : "negative"}
            icon={Timer}
            color="#f59e0b"
          />
          <KpiCard
            title="Tâches Terminées"
            value={String(Math.round(overview.kpis.completed_tasks.value))}
            trend={`${overview.kpis.completed_tasks.variation >= 0 ? "↑" : "↓"} ${Math.abs(overview.kpis.completed_tasks.variation).toFixed(1)}% vs période précédente`}
            trendTone={overview.kpis.completed_tasks.variation >= 0 ? "positive" : "negative"}
            icon={CheckCircle2}
            color="#10b981"
          />
          <KpiCard
            title="Tâches Bloquées"
            value={String(Math.round(overview.kpis.blocked_tasks.value))}
            trend={`${overview.kpis.blocked_tasks.variation >= 0 ? "↑" : "↓"} ${Math.abs(overview.kpis.blocked_tasks.variation).toFixed(1)}% vs période précédente`}
            trendTone={overview.kpis.blocked_tasks.variation >= 0 ? "positive" : "negative"}
            icon={AlertTriangle}
            color="#ef4444"
          />
        </div>
      )}

      {activeTab === "dashboard" && overview && (
        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr_320px]">
          <div className="space-y-4">
            <Card>
              <CardTitle className="text-base">Pipeline Commercial</CardTitle>
              <div className="mt-4 space-y-3">
                {overview.pipeline_chart.map((row) => {
                  const total = row.new + row.qualified + row.proposal + row.won + row.lost;
                  return (
                    <div key={row.period}>
                      <div className="mb-1 flex justify-between text-xs text-slate-500">
                        <span>{row.period}</span>
                        <span>{total}</span>
                      </div>
                      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                        <div className="bg-slate-400" style={{ width: `${(row.new / maxPipelineStack) * 100}%` }} />
                        <div className="bg-blue-500" style={{ width: `${(row.qualified / maxPipelineStack) * 100}%` }} />
                        <div className="bg-orange-500" style={{ width: `${(row.proposal / maxPipelineStack) * 100}%` }} />
                        <div className="bg-emerald-500" style={{ width: `${(row.won / maxPipelineStack) * 100}%` }} />
                        <div className="bg-rose-500" style={{ width: `${(row.lost / maxPipelineStack) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <CardTitle className="text-base">Évolution Projets</CardTitle>
              <div className="mt-4 grid gap-2">
                {overview.projects_chart.map((row) => (
                  <div key={row.period} className="grid grid-cols-[60px_1fr] items-center gap-2">
                    <span className="text-xs text-slate-500">{row.period}</span>
                    <div className="space-y-1">
                      <div className="h-2 rounded bg-indigo-100">
                        <div className="h-2 rounded bg-indigo-500" style={{ width: `${(row.created / maxProjectsValue) * 100}%` }} />
                      </div>
                      <div className="h-2 rounded bg-emerald-100">
                        <div className="h-2 rounded bg-emerald-500" style={{ width: `${(row.completed / maxProjectsValue) * 100}%` }} />
                      </div>
                      <div className="h-2 rounded bg-rose-100">
                        <div className="h-2 rounded bg-rose-500" style={{ width: `${(row.delayed / maxProjectsValue) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardTitle className="text-base">Charge d&apos;Équipe (heatmap)</CardTitle>
              <div className="mt-4 overflow-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500">
                      <th className="pb-2">Membre</th>
                      <th className="pb-2">Semaine</th>
                      <th className="pb-2">Charge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.team_load.map((cell) => (
                      <tr key={`${cell.member_id}-${cell.week}`} className="border-t border-slate-100">
                        <td className="py-2">{cell.member_name}</td>
                        <td className="py-2 text-slate-500">{cell.week}</td>
                        <td className="py-2">
                          <div className="h-2 rounded bg-slate-100">
                            <div
                              className={`h-2 rounded ${cell.load_percent > 100 ? "bg-rose-500" : cell.load_percent > 75 ? "bg-orange-500" : "bg-blue-500"}`}
                              style={{ width: `${Math.min(cell.load_percent, 130)}%` }}
                            />
                          </div>
                          <span className="mt-1 inline-block text-xs text-slate-500">{cell.load_percent.toFixed(1)}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardTitle className="text-base">Top Opportunités</CardTitle>
              <ul className="mt-3 space-y-2 text-sm">
                {overview.top_opportunities.map((item) => (
                  <li key={item.id} className="rounded-xl border border-slate-100 p-3">
                    <p className="font-medium text-slate-800">{item.title}</p>
                    <p className="text-xs text-slate-500">
                      {formatMoney(item.deal_value)} MAD · {item.owner_name} · {item.expected_close_date || "—"}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardTitle className="text-base">Projets à Risque</CardTitle>
              <ul className="mt-3 space-y-2 text-sm">
                {overview.risky_projects.map((item) => (
                  <li key={item.id} className="rounded-xl border border-rose-100 bg-rose-50/50 p-3">
                    <p className="font-medium text-slate-800">{item.name}</p>
                    <p className="text-xs text-slate-600">
                      Retard {item.delay_days}j · Budget {item.budget_percent.toFixed(1)}% · {item.manager_name}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardTitle className="text-base">Tâches Urgentes</CardTitle>
              <ul className="mt-3 space-y-2 text-sm">
                {overview.urgent_tasks.map((item) => (
                  <li key={item.id} className="rounded-xl border border-slate-100 p-3">
                    <p className="font-medium text-slate-800">{item.title}</p>
                    <p className="text-xs text-slate-500">
                      {item.project_name} · {item.assignee_name} · {item.due_date || "—"}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardTitle className="text-base">Activité en temps réel</CardTitle>
              <ul className="mt-3 space-y-2 text-sm">
                {overview.activity.map((item) => (
                  <li key={item.id} className="rounded-xl border border-slate-100 p-3">
                    <p className="text-slate-700">{item.text}</p>
                    <p className="mt-1 text-xs text-slate-400">{new Date(item.created_at).toLocaleString("fr-FR")}</p>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardTitle className="text-base">Alertes actives</CardTitle>
              <ul className="mt-3 space-y-2 text-sm">
                {overview.alerts.map((alert) => (
                  <li key={alert.code} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                    <span>{alert.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${alert.severity === "critical" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}
                    >
                      {alert.count}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "reports" && reports && (
        <div className="space-y-4">
          <Card>
            <CardTitle className="text-base">Rapport Performance Commerciale</CardTitle>
            <div className="mt-3 overflow-auto">
              <table className="responsive-table w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                    <th className="pb-2">Commercial</th>
                    <th className="pb-2">Leads créés</th>
                    <th className="pb-2">Leads gagnés</th>
                    <th className="pb-2">CA gagné</th>
                    <th className="pb-2">Conversion</th>
                    <th className="pb-2">Délai moyen</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.commercial_performance.map((row) => (
                    <tr key={row.user_name} className="border-b border-slate-50">
                      <td className="py-2" data-label="Commercial">{row.user_name}</td>
                      <td className="py-2" data-label="Leads créés">{row.leads_created}</td>
                      <td className="py-2" data-label="Leads gagnés">{row.leads_won}</td>
                      <td className="py-2" data-label="CA gagné">{formatMoney(row.won_revenue)} MAD</td>
                      <td className="py-2" data-label="Conversion">{row.conversion_rate.toFixed(1)}%</td>
                      <td className="py-2" data-label="Délai moyen">{row.avg_cycle_days.toFixed(1)} j</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardTitle className="text-base">Rapport État des Projets</CardTitle>
            <div className="mt-3 overflow-auto">
              <table className="responsive-table w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                    <th className="pb-2">Projet</th>
                    <th className="pb-2">Client</th>
                    <th className="pb-2">Budget</th>
                    <th className="pb-2">Consommé</th>
                    <th className="pb-2">%</th>
                    <th className="pb-2">Retard</th>
                    <th className="pb-2">Health</th>
                    <th className="pb-2">Équipe</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.project_status.map((row) => (
                    <tr key={row.project_name} className="border-b border-slate-50">
                      <td className="py-2" data-label="Projet">{row.project_name}</td>
                      <td className="py-2" data-label="Client">{row.client_name}</td>
                      <td className="py-2" data-label="Budget">{formatMoney(row.budget_total)} MAD</td>
                      <td className="py-2" data-label="Consommé">{formatMoney(row.budget_consumed)} MAD</td>
                      <td className="py-2" data-label="%">{row.budget_percent.toFixed(1)}%</td>
                      <td className="py-2" data-label="Retard">{row.delay_days}j</td>
                      <td className="py-2" data-label="Health">{row.health_status}</td>
                      <td className="py-2" data-label="Équipe">{row.team_size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "analytics" && reports && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle className="text-base">Productivité Équipe</CardTitle>
            <ul className="mt-3 space-y-2 text-sm">
              {reports.team_productivity.map((row) => (
                <li key={row.member_name} className="rounded-xl border border-slate-100 p-3">
                  <p className="font-medium text-slate-800">{row.member_name}</p>
                  <p className="text-xs text-slate-500">
                    {row.actual_hours.toFixed(1)}h / {row.estimated_hours.toFixed(1)}h · écart {row.variance_percent.toFixed(1)}%
                  </p>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardTitle className="text-base">Rentabilité</CardTitle>
            <ul className="mt-3 space-y-2 text-sm">
              {reports.profitability.map((row) => (
                <li key={row.project_name} className="rounded-xl border border-slate-100 p-3">
                  <p className="font-medium text-slate-800">{row.project_name}</p>
                  <p className="text-xs text-slate-500">
                    Marge {formatMoney(row.margin)} MAD ({row.margin_percent.toFixed(1)}%) · {row.profitable ? "Rentable" : "À risque"}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="lg:col-span-2">
            <CardTitle className="text-base">Analyse Clients</CardTitle>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {reports.clients.map((row) => (
                <div key={row.client_name} className="rounded-xl border border-slate-100 p-3">
                  <p className="font-medium text-slate-800">{row.client_name}</p>
                  <p className="text-xs text-slate-500">
                    {row.projects_count} projets · {formatMoney(row.revenue)} MAD · {row.status}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Dernier contact: {row.last_contact ? new Date(row.last_contact).toLocaleDateString("fr-FR") : "—"}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <p className="flex items-center gap-2 text-xs text-slate-400">
        <Clock3 size={13} />
        Rafraîchissement auto toutes les 5 minutes.
      </p>
    </div>
  );
}
