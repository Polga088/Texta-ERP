from __future__ import annotations

from pydantic import BaseModel


class DashboardStats(BaseModel):
    projects_total: int
    projects_active: int
    tasks_total: int
    tasks_done: int
    employees_total: int
    leave_pending: int
    events_this_week: int
    accounts_total: int


class DashboardKpiValue(BaseModel):
    value: float
    variation: float


class DashboardKpis(BaseModel):
    pipeline_revenue: DashboardKpiValue
    won_revenue: DashboardKpiValue
    conversion_rate: DashboardKpiValue
    active_projects: DashboardKpiValue
    delayed_projects: DashboardKpiValue
    logged_hours: DashboardKpiValue
    completed_tasks: DashboardKpiValue
    blocked_tasks: DashboardKpiValue


class DashboardPipelinePoint(BaseModel):
    period: str
    new: int
    qualified: int
    proposal: int
    won: int
    lost: int


class DashboardProjectPoint(BaseModel):
    period: str
    created: int
    completed: int
    delayed: int


class DashboardTeamLoadCell(BaseModel):
    member_id: str
    member_name: str
    week: str
    load_percent: float


class DashboardTopOpportunity(BaseModel):
    id: str
    title: str
    deal_value: float
    owner_name: str
    expected_close_date: str | None
    status: str


class DashboardRiskProject(BaseModel):
    id: str
    name: str
    delay_days: int
    budget_percent: float
    manager_name: str
    health_status: str


class DashboardUrgentTask(BaseModel):
    id: str
    title: str
    due_date: str | None
    assignee_name: str
    project_name: str
    priority: str
    status: str


class DashboardActivityItem(BaseModel):
    id: str
    text: str
    created_at: str
    level: str


class DashboardAlert(BaseModel):
    code: str
    label: str
    count: int
    severity: str


class DashboardOverviewResponse(BaseModel):
    kpis: DashboardKpis
    pipeline_chart: list[DashboardPipelinePoint]
    projects_chart: list[DashboardProjectPoint]
    team_load: list[DashboardTeamLoadCell]
    top_opportunities: list[DashboardTopOpportunity]
    risky_projects: list[DashboardRiskProject]
    urgent_tasks: list[DashboardUrgentTask]
    activity: list[DashboardActivityItem]
    alerts: list[DashboardAlert]


class ReportCommercialRow(BaseModel):
    user_name: str
    leads_created: int
    leads_won: int
    won_revenue: float
    conversion_rate: float
    avg_cycle_days: float


class ReportProjectRow(BaseModel):
    project_name: str
    client_name: str
    budget_total: float
    budget_consumed: float
    budget_percent: float
    delay_days: int
    health_status: str
    team_size: int


class ReportProductivityRow(BaseModel):
    member_name: str
    estimated_hours: float
    actual_hours: float
    variance_percent: float
    tasks_done: int
    tasks_late: int


class ReportProfitabilityRow(BaseModel):
    project_name: str
    revenue: float
    cost: float
    margin: float
    margin_percent: float
    profitable: bool


class ReportClientRow(BaseModel):
    client_name: str
    projects_count: int
    revenue: float
    last_contact: str | None
    status: str


class DashboardReportsResponse(BaseModel):
    commercial_performance: list[ReportCommercialRow]
    project_status: list[ReportProjectRow]
    team_productivity: list[ReportProductivityRow]
    profitability: list[ReportProfitabilityRow]
    clients: list[ReportClientRow]
