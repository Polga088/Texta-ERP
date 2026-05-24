from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from src.models.task import TaskPriority, TaskStatus
from src.schemas.common import TimestampSchema


class TaskCreate(BaseModel):
    title: str = Field(min_length=1)
    project_id: UUID
    parent_id: UUID | None = None
    task_code: str | None = None
    description: str | None = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    assignee_id: UUID | None = None
    reviewer_id: UUID | None = None
    start_date: date | None = None
    due_date: date
    estimated_hours: float = Field(default=0, ge=0)
    billable: bool = False
    hourly_rate: float | None = Field(default=None, ge=0)
    tags: list[str] = Field(default_factory=list)
    category: str | None = None
    milestone: str | None = None
    attachments: list[str] = Field(default_factory=list)
    checklist: list[dict] = Field(default_factory=list)
    position: int = 0


class TaskUpdate(BaseModel):
    title: str | None = None
    task_code: str | None = None
    description: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    assignee_id: UUID | None = None
    reviewer_id: UUID | None = None
    start_date: date | None = None
    due_date: date | None = None
    estimated_hours: float | None = Field(default=None, ge=0)
    billable: bool | None = None
    hourly_rate: float | None = Field(default=None, ge=0)
    tags: list[str] | None = None
    category: str | None = None
    milestone: str | None = None
    attachments: list[str] | None = None
    checklist: list[dict] | None = None
    completion_percentage: int | None = Field(default=None, ge=0, le=100)
    block_reason: str | None = None
    unblock_note: str | None = None
    position: int | None = None
    project_id: UUID | None = None


class TaskCommentCreate(BaseModel):
    content: str = Field(min_length=1)
    attachments: list[str] = Field(default_factory=list)


class TaskTimeLogCreate(BaseModel):
    date: date
    hours: float = Field(gt=0)
    description: str | None = None


class TaskResponse(TimestampSchema):
    id: UUID
    title: str
    task_code: str | None
    description: str | None
    status: TaskStatus
    priority: TaskPriority
    project_id: UUID | None
    parent_id: UUID | None
    assignee_id: UUID | None
    reviewer_id: UUID | None
    start_date: date | None
    due_date: date | None
    actual_start_date: date | None
    actual_end_date: date | None
    duration_days: int | None
    delay_days: int | None
    completion_percentage: int
    estimated_hours: float
    actual_hours: float
    billable: bool
    hourly_rate: float | None
    tags: list[str]
    category: str | None
    milestone: str | None
    attachments: list[str]
    comments: list[dict]
    checklist: list[dict]
    block_reason: str | None
    blocked_since: datetime | None
    blocked_by: UUID | None
    unblocked_at: datetime | None
    unblock_note: str | None
    position: int
    organization_id: UUID
    created_by_id: UUID | None


class TaskKpis(BaseModel):
    total: int
    todo: int
    in_progress: int
    done: int
    blocked: int
    estimated_hours: float
    actual_hours: float
    variance_percent: float
