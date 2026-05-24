from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.deps import get_current_user
from src.models.audit import AuditLog
from src.models.calendar import CalendarEvent
from src.models.collaboration import Notification
from src.models.crm import Account, Lead, LeadStatus, Project, ProjectHealthStatus, ProjectStatus
from src.models.hr import Employee, LeaveRequest, LeaveStatus
from src.models.organization import User
from src.models.task import Task, TaskStatus
from src.models.time_tracking import TimeEntry
from src.schemas.dashboard import (
    DashboardActivityItem,
    DashboardAlert,
    DashboardKpis,
    DashboardKpiValue,
    DashboardOverviewResponse,
    DashboardPipelinePoint,
    DashboardProjectPoint,
    DashboardReportsResponse,
    DashboardRiskProject,
    DashboardStats,
    DashboardTeamLoadCell,
    DashboardTopOpportunity,
    DashboardUrgentTask,
    ReportClientRow,
    ReportCommercialRow,
    ReportProductivityRow,
    ReportProfitabilityRow,
    ReportProjectRow,
)

router = APIRouter()


def _to_float(value: Decimal | float | int | None) -> float:
    return float(value or 0)


def _split_ids(value: str | None) -> set[UUID]:
    if not value:
        return set()
    parsed: set[UUID] = set()
    for raw in value.split(","):
        item = raw.strip()
        if not item:
            continue
        try:
            parsed.add(UUID(item))
        except ValueError:
            continue
    return parsed


def _split_words(value: str | None) -> set[str]:
    if not value:
        return set()
    return {item.strip() for item in value.split(",") if item.strip()}


def _resolve_period(period: str, start_date: date | None, end_date: date | None) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    today = now.date()
    if start_date and end_date:
        start = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)
        end = datetime.combine(end_date, datetime.max.time(), tzinfo=timezone.utc)
        return start, end
    if period == "today":
        start = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)
        end = datetime.combine(today, datetime.max.time(), tzinfo=timezone.utc)
    elif period == "this_week":
        week_start = today - timedelta(days=today.weekday())
        start = datetime.combine(week_start, datetime.min.time(), tzinfo=timezone.utc)
        end = datetime.combine(week_start + timedelta(days=6), datetime.max.time(), tzinfo=timezone.utc)
    elif period == "this_quarter":
        quarter_month = ((today.month - 1) // 3) * 3 + 1
        quarter_start = date(today.year, quarter_month, 1)
        if quarter_month == 10:
            quarter_end = date(today.year, 12, 31)
        else:
            quarter_end = date(today.year, quarter_month + 3, 1) - timedelta(days=1)
        start = datetime.combine(quarter_start, datetime.min.time(), tzinfo=timezone.utc)
        end = datetime.combine(quarter_end, datetime.max.time(), tzinfo=timezone.utc)
    elif period == "this_year":
        year_start = date(today.year, 1, 1)
        year_end = date(today.year, 12, 31)
        start = datetime.combine(year_start, datetime.min.time(), tzinfo=timezone.utc)
        end = datetime.combine(year_end, datetime.max.time(), tzinfo=timezone.utc)
    else:
        month_start = date(today.year, today.month, 1)
        next_month = date(today.year + (today.month == 12), 1 if today.month == 12 else today.month + 1, 1)
        month_end = next_month - timedelta(days=1)
        start = datetime.combine(month_start, datetime.min.time(), tzinfo=timezone.utc)
        end = datetime.combine(month_end, datetime.max.time(), tzinfo=timezone.utc)
    return start, end


def _pct_change(current: float, previous: float) -> float:
    if previous == 0:
        return 100.0 if current > 0 else 0.0
    return round(((current - previous) / previous) * 100, 2)


def _in_window(value: datetime | None, start: datetime, end: datetime) -> bool:
    if not value:
        return False
    return start <= value <= end


@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    org_id = user.organization_id
    now = datetime.now(timezone.utc)
    week_end = now + timedelta(days=7)

    projects_total = await db.scalar(
        select(func.count()).select_from(Project).where(Project.organization_id == org_id)
    )
    projects_active = await db.scalar(
        select(func.count())
        .select_from(Project)
        .where(Project.organization_id == org_id, Project.status == ProjectStatus.ACTIVE)
    )
    tasks_total = await db.scalar(
        select(func.count()).select_from(Task).where(Task.organization_id == org_id)
    )
    tasks_done = await db.scalar(
        select(func.count())
        .select_from(Task)
        .where(Task.organization_id == org_id, Task.status == TaskStatus.DONE)
    )
    employees_total = await db.scalar(
        select(func.count()).select_from(Employee).where(Employee.organization_id == org_id)
    )
    leave_pending = await db.scalar(
        select(func.count())
        .select_from(LeaveRequest)
        .where(
            LeaveRequest.organization_id == org_id,
            LeaveRequest.status == LeaveStatus.SUBMITTED,
        )
    )
    events_this_week = await db.scalar(
        select(func.count())
        .select_from(CalendarEvent)
        .where(
            CalendarEvent.organization_id == org_id,
            CalendarEvent.start_at >= now,
            CalendarEvent.start_at <= week_end,
        )
    )
    accounts_total = await db.scalar(
        select(func.count()).select_from(Account).where(Account.organization_id == org_id)
    )

    return DashboardStats(
        projects_total=projects_total or 0,
        projects_active=projects_active or 0,
        tasks_total=tasks_total or 0,
        tasks_done=tasks_done or 0,
        employees_total=employees_total or 0,
        leave_pending=leave_pending or 0,
        events_this_week=events_this_week or 0,
        accounts_total=accounts_total or 0,
    )


@router.get("/overview", response_model=DashboardOverviewResponse)
async def dashboard_overview(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    period: str = "this_month",
    start_date: date | None = None,
    end_date: date | None = None,
    user_ids: str | None = Query(default=None),
    client_ids: str | None = Query(default=None),
    tags: str | None = Query(default=None),
    priority: str | None = None,
    project_ids: str | None = Query(default=None),
):
    org_id = user.organization_id
    start, end = _resolve_period(period, start_date, end_date)
    period_days = max((end - start).days + 1, 1)
    previous_end = start - timedelta(seconds=1)
    previous_start = previous_end - timedelta(days=period_days)

    scoped_users = _split_ids(user_ids)
    scoped_clients = _split_ids(client_ids)
    scoped_projects = _split_ids(project_ids)
    scoped_tags = _split_words(tags)

    users_result = await db.execute(select(User).where(User.organization_id == org_id))
    users = users_result.scalars().all()
    user_map = {str(item.id): item.full_name for item in users}

    leads_result = await db.execute(select(Lead).where(Lead.organization_id == org_id))
    leads = leads_result.scalars().all()
    projects_result = await db.execute(select(Project).where(Project.organization_id == org_id))
    projects = projects_result.scalars().all()
    tasks_result = await db.execute(select(Task).where(Task.organization_id == org_id))
    tasks = tasks_result.scalars().all()
    entries_result = await db.execute(select(TimeEntry).where(TimeEntry.organization_id == org_id))
    time_entries = entries_result.scalars().all()
    notifications_result = await db.execute(
        select(Notification).where(Notification.organization_id == org_id).order_by(Notification.created_at.desc()).limit(20)
    )
    notifications = notifications_result.scalars().all()
    audit_result = await db.execute(
        select(AuditLog).where(AuditLog.organization_id == org_id).order_by(AuditLog.created_at.desc()).limit(20)
    )
    audit_logs = audit_result.scalars().all()

    def lead_filter(item: Lead) -> bool:
        if scoped_users and item.assigned_to not in scoped_users:
            return False
        if scoped_clients and item.account_id not in scoped_clients:
            return False
        if scoped_tags and not (set(item.tags or []) & scoped_tags):
            return False
        return True

    filtered_leads = [item for item in leads if lead_filter(item)]

    def project_filter(item: Project) -> bool:
        if scoped_users and item.project_manager_id not in scoped_users and item.owner_id not in scoped_users:
            return False
        if scoped_clients and item.account_id not in scoped_clients:
            return False
        if scoped_projects and item.id not in scoped_projects:
            return False
        if scoped_tags and not (set(item.tags or []) & scoped_tags):
            return False
        return True

    filtered_projects = [item for item in projects if project_filter(item)]
    project_ids_set = {item.id for item in filtered_projects}
    if scoped_projects:
        project_ids_set &= scoped_projects

    def task_filter(item: Task) -> bool:
        if project_ids_set and item.project_id not in project_ids_set:
            return False
        if scoped_users and item.assignee_id not in scoped_users:
            return False
        if priority and item.priority.value != priority:
            return False
        if scoped_tags and not (set(item.tags or []) & scoped_tags):
            return False
        return True

    filtered_tasks = [item for item in tasks if task_filter(item)]
    task_ids_set = {item.id for item in filtered_tasks}

    filtered_entries = [
        item for item in time_entries if (not task_ids_set or item.task_id in task_ids_set) and _in_window(item.started_at, start, end)
    ]
    previous_entries = [
        item
        for item in time_entries
        if (not task_ids_set or item.task_id in task_ids_set) and _in_window(item.started_at, previous_start, previous_end)
    ]

    pipeline_value = sum(
        _to_float(item.deal_value)
        for item in filtered_leads
        if item.status in {LeadStatus.NEW, LeadStatus.QUALIFIED, LeadStatus.PROPOSAL}
    )
    previous_pipeline_value = sum(
        _to_float(item.deal_value)
        for item in filtered_leads
        if item.status in {LeadStatus.NEW, LeadStatus.QUALIFIED, LeadStatus.PROPOSAL}
        and _in_window(item.created_at, previous_start, previous_end)
    )

    won_value = sum(
        _to_float(item.deal_value)
        for item in filtered_leads
        if item.status == LeadStatus.WON and _in_window(item.updated_at, start, end)
    )
    previous_won_value = sum(
        _to_float(item.deal_value)
        for item in filtered_leads
        if item.status == LeadStatus.WON and _in_window(item.updated_at, previous_start, previous_end)
    )

    period_leads = [item for item in filtered_leads if _in_window(item.created_at, start, end)]
    previous_period_leads = [item for item in filtered_leads if _in_window(item.created_at, previous_start, previous_end)]
    won_count = len([item for item in period_leads if item.status == LeadStatus.WON])
    conversion_rate = round((won_count / len(period_leads)) * 100, 2) if period_leads else 0.0
    previous_won_count = len([item for item in previous_period_leads if item.status == LeadStatus.WON])
    previous_conversion = (
        round((previous_won_count / len(previous_period_leads)) * 100, 2) if previous_period_leads else 0.0
    )

    active_projects = len(
        [
            item
            for item in filtered_projects
            if item.status in {ProjectStatus.IN_PROGRESS, ProjectStatus.IN_REVIEW, ProjectStatus.PLANNING, ProjectStatus.ACTIVE}
        ]
    )
    previous_active_projects = len(
        [
            item
            for item in filtered_projects
            if item.status in {ProjectStatus.IN_PROGRESS, ProjectStatus.IN_REVIEW, ProjectStatus.PLANNING, ProjectStatus.ACTIVE}
            and _in_window(item.updated_at, previous_start, previous_end)
        ]
    )
    delayed_projects = len([item for item in filtered_projects if (item.delay_days or 0) > 0])
    previous_delayed_projects = len(
        [item for item in filtered_projects if (item.delay_days or 0) > 0 and _in_window(item.updated_at, previous_start, previous_end)]
    )

    logged_hours = round(sum((item.duration_minutes or 0) for item in filtered_entries) / 60, 2)
    previous_logged_hours = round(sum((item.duration_minutes or 0) for item in previous_entries) / 60, 2)

    completed_tasks = len(
        [
            item
            for item in filtered_tasks
            if item.status == TaskStatus.DONE and _in_window(item.updated_at, start, end)
        ]
    )
    previous_completed_tasks = len(
        [
            item
            for item in filtered_tasks
            if item.status == TaskStatus.DONE and _in_window(item.updated_at, previous_start, previous_end)
        ]
    )
    blocked_tasks = len([item for item in filtered_tasks if item.status == TaskStatus.BLOCKED])
    previous_blocked_tasks = len(
        [item for item in filtered_tasks if item.status == TaskStatus.BLOCKED and _in_window(item.updated_at, previous_start, previous_end)]
    )

    kpis = DashboardKpis(
        pipeline_revenue=DashboardKpiValue(value=round(pipeline_value, 2), variation=_pct_change(pipeline_value, previous_pipeline_value)),
        won_revenue=DashboardKpiValue(value=round(won_value, 2), variation=_pct_change(won_value, previous_won_value)),
        conversion_rate=DashboardKpiValue(value=conversion_rate, variation=_pct_change(conversion_rate, previous_conversion)),
        active_projects=DashboardKpiValue(
            value=float(active_projects), variation=_pct_change(float(active_projects), float(previous_active_projects))
        ),
        delayed_projects=DashboardKpiValue(
            value=float(delayed_projects), variation=_pct_change(float(delayed_projects), float(previous_delayed_projects))
        ),
        logged_hours=DashboardKpiValue(value=logged_hours, variation=_pct_change(logged_hours, previous_logged_hours)),
        completed_tasks=DashboardKpiValue(
            value=float(completed_tasks), variation=_pct_change(float(completed_tasks), float(previous_completed_tasks))
        ),
        blocked_tasks=DashboardKpiValue(
            value=float(blocked_tasks), variation=_pct_change(float(blocked_tasks), float(previous_blocked_tasks))
        ),
    )

    pipeline_chart: list[DashboardPipelinePoint] = []
    for offset in range(5, -1, -1):
        pivot = datetime.now(timezone.utc) - timedelta(days=30 * offset)
        month_start = datetime(pivot.year, pivot.month, 1, tzinfo=timezone.utc)
        if pivot.month == 12:
            month_end = datetime(pivot.year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
        else:
            month_end = datetime(pivot.year, pivot.month + 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
        month_leads = [item for item in filtered_leads if _in_window(item.created_at, month_start, month_end)]
        pipeline_chart.append(
            DashboardPipelinePoint(
                period=month_start.strftime("%b"),
                new=len([item for item in month_leads if item.status == LeadStatus.NEW]),
                qualified=len([item for item in month_leads if item.status == LeadStatus.QUALIFIED]),
                proposal=len([item for item in month_leads if item.status == LeadStatus.PROPOSAL]),
                won=len([item for item in month_leads if item.status == LeadStatus.WON]),
                lost=len([item for item in month_leads if item.status == LeadStatus.LOST]),
            )
        )

    projects_chart: list[DashboardProjectPoint] = []
    for offset in range(5, -1, -1):
        pivot = datetime.now(timezone.utc) - timedelta(days=30 * offset)
        month_start = datetime(pivot.year, pivot.month, 1, tzinfo=timezone.utc)
        if pivot.month == 12:
            month_end = datetime(pivot.year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
        else:
            month_end = datetime(pivot.year, pivot.month + 1, 1, tzinfo=timezone.utc) - timedelta(seconds=1)
        month_projects = [item for item in filtered_projects if _in_window(item.created_at, month_start, month_end)]
        projects_chart.append(
            DashboardProjectPoint(
                period=month_start.strftime("%b"),
                created=len(month_projects),
                completed=len(
                    [
                        item
                        for item in filtered_projects
                        if item.status in {ProjectStatus.DONE, ProjectStatus.COMPLETED} and _in_window(item.updated_at, month_start, month_end)
                    ]
                ),
                delayed=len(
                    [item for item in filtered_projects if (item.delay_days or 0) > 0 and _in_window(item.updated_at, month_start, month_end)]
                ),
            )
        )

    team_load: list[DashboardTeamLoadCell] = []
    selected_members = users[:8] if not scoped_users else [item for item in users if item.id in scoped_users]
    for week_offset in range(3, -1, -1):
        week_start = (datetime.now(timezone.utc) - timedelta(days=7 * week_offset)).date()
        week_start = week_start - timedelta(days=week_start.weekday())
        week_end = week_start + timedelta(days=6)
        for member in selected_members:
            assigned_tasks = [
                task
                for task in filtered_tasks
                if task.assignee_id == member.id and task.due_date and week_start <= task.due_date <= week_end
            ]
            load_hours = sum(_to_float(task.estimated_hours) for task in assigned_tasks)
            team_load.append(
                DashboardTeamLoadCell(
                    member_id=str(member.id),
                    member_name=member.full_name,
                    week=week_start.strftime("%d/%m"),
                    load_percent=round((load_hours / 40) * 100, 2),
                )
            )

    top_opportunities = [
        DashboardTopOpportunity(
            id=str(item.id),
            title=item.title,
            deal_value=round(_to_float(item.deal_value), 2),
            owner_name=user_map.get(str(item.assigned_to), "Non assigné"),
            expected_close_date=item.expected_close_date.isoformat() if item.expected_close_date else None,
            status=item.status.value,
        )
        for item in sorted(
            [item for item in filtered_leads if item.status in {LeadStatus.NEW, LeadStatus.QUALIFIED, LeadStatus.PROPOSAL}],
            key=lambda lead: _to_float(lead.deal_value),
            reverse=True,
        )[:5]
    ]

    risky_projects = [
        DashboardRiskProject(
            id=str(item.id),
            name=item.name,
            delay_days=item.delay_days or 0,
            budget_percent=round(((_to_float(item.budget_consumed) / _to_float(item.budget)) * 100), 2)
            if _to_float(item.budget) > 0
            else 0,
            manager_name=user_map.get(str(item.project_manager_id), "N/A"),
            health_status=item.health_status.value,
        )
        for item in sorted(
            [p for p in filtered_projects if p.health_status in {ProjectHealthStatus.DANGER, ProjectHealthStatus.WATCH}],
            key=lambda p: ((p.delay_days or 0), _to_float(p.budget_consumed)),
            reverse=True,
        )[:5]
    ]

    today = datetime.now(timezone.utc).date()
    urgent_tasks = [
        DashboardUrgentTask(
            id=str(item.id),
            title=item.title,
            due_date=item.due_date.isoformat() if item.due_date else None,
            assignee_name=user_map.get(str(item.assignee_id), "N/A"),
            project_name=next((p.name for p in filtered_projects if p.id == item.project_id), "Sans projet"),
            priority=item.priority.value,
            status=item.status.value,
        )
        for item in sorted(
            [
                item
                for item in filtered_tasks
                if item.status != TaskStatus.DONE and item.due_date and item.due_date <= today + timedelta(days=3)
            ],
            key=lambda task: task.due_date or today,
        )[:5]
    ]

    activity: list[DashboardActivityItem] = []
    for item in notifications[:8]:
        activity.append(
            DashboardActivityItem(
                id=str(item.id),
                text=f"{item.title} — {item.message}",
                created_at=item.created_at.isoformat(),
                level="info" if item.is_read else "alert",
            )
        )
    for item in audit_logs[:8]:
        if len(activity) >= 10:
            break
        actor_name = user_map.get(str(item.actor_id), "Système")
        activity.append(
            DashboardActivityItem(
                id=str(item.id),
                text=f"{actor_name} a exécuté {item.action} sur {item.resource_type}",
                created_at=item.created_at.isoformat(),
                level="audit",
            )
        )
    activity = sorted(activity, key=lambda item: item.created_at, reverse=True)[:10]

    alerts = [
        DashboardAlert(code="projects_delayed", label="Projets en retard", count=delayed_projects, severity="critical" if delayed_projects > 0 else "ok"),
        DashboardAlert(
            code="tasks_due_week",
            label="Tâches à échéance cette semaine",
            count=len([item for item in filtered_tasks if item.due_date and today <= item.due_date <= today + timedelta(days=7)]),
            severity="warning",
        ),
        DashboardAlert(
            code="tasks_blocked",
            label="Tâches bloquées",
            count=blocked_tasks,
            severity="critical" if blocked_tasks > 3 else "warning",
        ),
        DashboardAlert(
            code="budget_risk",
            label="Budgets > 90%",
            count=len(
                [
                    item
                    for item in filtered_projects
                    if _to_float(item.budget) > 0
                    and (_to_float(item.budget_consumed) / _to_float(item.budget)) * 100 >= 90
                ]
            ),
            severity="warning",
        ),
    ]

    return DashboardOverviewResponse(
        kpis=kpis,
        pipeline_chart=pipeline_chart,
        projects_chart=projects_chart,
        team_load=team_load,
        top_opportunities=top_opportunities,
        risky_projects=risky_projects,
        urgent_tasks=urgent_tasks,
        activity=activity,
        alerts=alerts,
    )


@router.get("/reports", response_model=DashboardReportsResponse)
async def dashboard_reports(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    period: str = "this_month",
    start_date: date | None = None,
    end_date: date | None = None,
):
    org_id = user.organization_id
    start, end = _resolve_period(period, start_date, end_date)

    users_result = await db.execute(select(User).where(User.organization_id == org_id))
    users = users_result.scalars().all()
    user_map = {item.id: item.full_name for item in users}

    leads_result = await db.execute(select(Lead).where(Lead.organization_id == org_id))
    leads = [item for item in leads_result.scalars().all() if _in_window(item.created_at, start, end)]
    projects_result = await db.execute(select(Project).where(Project.organization_id == org_id))
    projects = projects_result.scalars().all()
    tasks_result = await db.execute(select(Task).where(Task.organization_id == org_id))
    tasks = tasks_result.scalars().all()
    accounts_result = await db.execute(select(Account).where(Account.organization_id == org_id))
    accounts = accounts_result.scalars().all()
    account_map = {item.id: item.name for item in accounts}

    commercial_stats: dict[UUID, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for lead in leads:
        if not lead.assigned_to:
            continue
        bucket = commercial_stats[lead.assigned_to]
        bucket["created"] += 1
        if lead.status == LeadStatus.WON:
            bucket["won"] += 1
            bucket["won_value"] += _to_float(lead.deal_value)
            bucket["cycle_days"] += max((lead.updated_at.date() - lead.created_at.date()).days, 0)

    commercial_performance: list[ReportCommercialRow] = []
    for uid, stats in commercial_stats.items():
        created = stats["created"]
        won = stats["won"]
        commercial_performance.append(
            ReportCommercialRow(
                user_name=user_map.get(uid, "N/A"),
                leads_created=int(created),
                leads_won=int(won),
                won_revenue=round(stats["won_value"], 2),
                conversion_rate=round((won / created) * 100, 2) if created else 0,
                avg_cycle_days=round((stats["cycle_days"] / won), 2) if won else 0,
            )
        )

    project_status = [
        ReportProjectRow(
            project_name=item.name,
            client_name=account_map.get(item.account_id, "N/A"),
            budget_total=round(_to_float(item.budget), 2),
            budget_consumed=round(_to_float(item.budget_consumed), 2),
            budget_percent=round((_to_float(item.budget_consumed) / _to_float(item.budget)) * 100, 2)
            if _to_float(item.budget) > 0
            else 0,
            delay_days=item.delay_days or 0,
            health_status=item.health_status.value,
            team_size=len(item.team_members or []),
        )
        for item in projects
    ]

    productivity_stats: dict[UUID, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for task in tasks:
        if not task.assignee_id:
            continue
        bucket = productivity_stats[task.assignee_id]
        bucket["estimated"] += _to_float(task.estimated_hours)
        bucket["actual"] += _to_float(task.actual_hours)
        if task.status == TaskStatus.DONE:
            bucket["done"] += 1
        if task.status != TaskStatus.DONE and task.due_date and task.due_date < datetime.now(timezone.utc).date():
            bucket["late"] += 1

    team_productivity: list[ReportProductivityRow] = []
    for uid, stats in productivity_stats.items():
        estimated = stats["estimated"]
        actual = stats["actual"]
        team_productivity.append(
            ReportProductivityRow(
                member_name=user_map.get(uid, "N/A"),
                estimated_hours=round(estimated, 2),
                actual_hours=round(actual, 2),
                variance_percent=round(((actual - estimated) / estimated) * 100, 2) if estimated else 0,
                tasks_done=int(stats["done"]),
                tasks_late=int(stats["late"]),
            )
        )

    lead_by_id = {item.id: item for item in leads}
    profitability = []
    for project in projects:
        revenue = 0.0
        if project.client_lead_id and project.client_lead_id in lead_by_id:
            linked = lead_by_id[project.client_lead_id]
            revenue = _to_float(linked.deal_value) if linked.status == LeadStatus.WON else 0.0
        cost = 0.0
        for task in tasks:
            if task.project_id == project.id:
                cost += _to_float(task.actual_hours) * _to_float(task.hourly_rate)
        margin = revenue - cost
        margin_percent = round((margin / revenue) * 100, 2) if revenue > 0 else 0
        profitability.append(
            ReportProfitabilityRow(
                project_name=project.name,
                revenue=round(revenue, 2),
                cost=round(cost, 2),
                margin=round(margin, 2),
                margin_percent=margin_percent,
                profitable=margin >= 0,
            )
        )

    leads_by_account: dict[UUID, list[Lead]] = defaultdict(list)
    for lead in leads:
        if lead.account_id:
            leads_by_account[lead.account_id].append(lead)

    clients = []
    for account in accounts:
        account_projects = [item for item in projects if item.account_id == account.id]
        account_leads = leads_by_account.get(account.id, [])
        revenue = sum(_to_float(item.deal_value) for item in account_leads if item.status == LeadStatus.WON)
        last_contact = max([item.last_activity for item in account_leads], default=None)
        status = "Actif" if account_projects else "À risque"
        clients.append(
            ReportClientRow(
                client_name=account.name,
                projects_count=len(account_projects),
                revenue=round(revenue, 2),
                last_contact=last_contact.isoformat() if last_contact else None,
                status=status,
            )
        )

    return DashboardReportsResponse(
        commercial_performance=sorted(commercial_performance, key=lambda item: item.won_revenue, reverse=True),
        project_status=sorted(project_status, key=lambda item: item.delay_days, reverse=True),
        team_productivity=sorted(team_productivity, key=lambda item: item.actual_hours, reverse=True),
        profitability=sorted(profitability, key=lambda item: item.margin, reverse=True),
        clients=sorted(clients, key=lambda item: item.revenue, reverse=True),
    )
