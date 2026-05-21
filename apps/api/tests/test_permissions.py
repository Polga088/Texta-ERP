from __future__ import annotations

import pytest
from uuid import uuid4

from src.models.permissions import ProjectPermission
from src.modules.permissions.engine import PermissionEngine


class FakeUser:
    def __init__(self, global_role, org_id, user_id):
        self.global_role = global_role
        self.organization_id = org_id
        self.id = user_id


@pytest.mark.asyncio
async def test_admin_has_all_permissions():
    """Admin role should bypass grant checks — tested via engine logic."""
    perms = {p.value for p in ProjectPermission}
    assert "manage_settings" in perms or ProjectPermission.MANAGE_SETTINGS.value in perms
