from __future__ import annotations

import re
from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import AfterValidator, BaseModel, ConfigDict

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def validate_email(value: str) -> str:
    """Accepte .local / .test — contrairement à EmailStr Pydantic."""
    email = value.strip().lower()
    if not EMAIL_RE.match(email):
        raise ValueError("Adresse email invalide")
    return email


EmailAddress = Annotated[str, AfterValidator(validate_email)]


class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class IDResponse(BaseSchema):
    id: UUID


class MessageResponse(BaseModel):
    message: str


class TimestampSchema(BaseSchema):
    created_at: datetime
    updated_at: datetime
