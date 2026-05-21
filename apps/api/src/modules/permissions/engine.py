from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.crm import Project
from src.models.organization import GlobalRole, GroupMember, User
from src.models.permissions import GranteeType, ProjectPermission, ProjectPermissionGrant


class PermissionEngine:
    """Evaluates project-level permissions with RBAC + delegated grants."""

    def __init__(self, db: AsyncSession, user: User):
        self.db = db
        self.user = user

    async def has_project_permission(
        self,
        project_id: UUID,
        permission: ProjectPermission | str,
    ) -> bool:
        perm = permission.value if isinstance(permission, ProjectPermission) else permission
        effective = await self.get_effective_permissions(project_id)
        return perm in effective or ProjectPermission.MANAGE_SETTINGS.value in effective

    async def get_effective_permissions(self, project_id: UUID) -> set[str]:
        if self.user.global_role == GlobalRole.ADMIN:
            return {p.value for p in ProjectPermission} | {"manage_settings"}

        project = await self.db.get(Project, project_id)
        if not project or project.organization_id != self.user.organization_id:
            return set()

        perms: set[str] = set()

        if project.owner_id == self.user.id:
            perms.update(p.value for p in ProjectPermission)

        if self.user.global_role == GlobalRole.PROJECT_MANAGER:
            perms.add(ProjectPermission.VIEW.value)
            perms.add(ProjectPermission.EDIT_TASKS.value)

        group_ids = await self._user_group_ids()
        now = datetime.now(timezone.utc)

        grant_conditions = [
            (ProjectPermissionGrant.grantee_type == GranteeType.USER)
            & (ProjectPermissionGrant.grantee_id == self.user.id),
        ]
        if group_ids:
            grant_conditions.append(
                (ProjectPermissionGrant.grantee_type == GranteeType.GROUP)
                & (ProjectPermissionGrant.grantee_id.in_(group_ids))
            )
        stmt = select(ProjectPermissionGrant).where(
            ProjectPermissionGrant.project_id == project_id,
            ProjectPermissionGrant.organization_id == self.user.organization_id,
            or_(*grant_conditions),
        )
        result = await self.db.execute(stmt)
        for grant in result.scalars().all():
            if grant.expires_at and grant.expires_at < now:
                continue
            perms.update(grant.permissions)

        if self.user.global_role == GlobalRole.MEMBER and not perms:
            perms.add(ProjectPermission.VIEW.value)

        return perms

    async def can_manage_grants(self, project_id: UUID) -> bool:
        if self.user.global_role == GlobalRole.ADMIN:
            return True
        project = await self.db.get(Project, project_id)
        if project and project.owner_id == self.user.id:
            return True
        perms = await self.get_effective_permissions(project_id)
        return ProjectPermission.MANAGE_MEMBERS.value in perms

    async def _user_group_ids(self) -> list[UUID]:
        result = await self.db.execute(
            select(GroupMember.group_id).where(GroupMember.user_id == self.user.id)
        )
        return list(result.scalars().all())
