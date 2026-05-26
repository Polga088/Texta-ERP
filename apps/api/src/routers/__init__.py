from __future__ import annotations

from fastapi import APIRouter

from src.routers import (
    accounts,
    audit,
    auth,
    billing,
    calendar,
    collaboration,
    contacts,
    dashboard,
    documents,
    grants,
    groups,
    hr,
    leads,
    projects,
    tasks,
    time_tracking,
    users,
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(groups.router, prefix="/groups", tags=["groups"])
api_router.include_router(accounts.router, prefix="/accounts", tags=["accounts"])
api_router.include_router(contacts.router, prefix="/contacts", tags=["contacts"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(grants.router, prefix="/projects", tags=["permissions"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(hr.router, prefix="/hr", tags=["hr"])
api_router.include_router(calendar.router, prefix="/calendar", tags=["calendar"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])
api_router.include_router(leads.router, prefix="/leads", tags=["leads"])
api_router.include_router(collaboration.router, prefix="/collaboration", tags=["collaboration"])
api_router.include_router(time_tracking.router, prefix="/time-entries", tags=["time-tracking"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
