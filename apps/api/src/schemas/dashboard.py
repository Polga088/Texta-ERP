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
