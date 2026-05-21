from __future__ import annotations

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field

from src.models.task import TaskPriority, TaskStatus
from src.schemas.common import BaseSchema, TimestampSchema


class TaskCreate(BaseModel):
    title: str = Field(min_length=1)
    project_id: UUID | None = None
    parent_id: UUID | None = None
    description: str | None = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    assignee_id: UUID | None = None
    due_date: date | None = None
    position: int = 0


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    assignee_id: UUID | None = None
    due_date: date | None = None
    position: int | None = None
    project_id: UUID | None = None


class TaskResponse(TimestampSchema):
    id: UUID
    title: str
    description: str | None
    status: TaskStatus
    priority: TaskPriority
    project_id: UUID | None
    parent_id: UUID | None
    assignee_id: UUID | None
    due_date: date | None
    position: int
    organization_id: UUID
    created_by_id: UUID | None
