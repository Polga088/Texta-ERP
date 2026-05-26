from __future__ import annotations

from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import get_settings
from src.core.database import get_db
from src.core.deps import get_current_user
from src.models.document import Document, DocumentEntityType
from src.models.organization import GlobalRole, User
from src.schemas.document import DocumentResponse
from src.services.audit import log_audit

router = APIRouter()
settings = get_settings()

ALLOWED_UPLOAD_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx", ".xls", ".xlsx", ".txt"}
ALLOWED_UPLOAD_MIME_PREFIXES = ("image/", "text/")
ALLOWED_UPLOAD_MIME_EXACT = {
    "application/pdf",
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

ENTITY_STORAGE_FOLDER: dict[DocumentEntityType, str] = {
    DocumentEntityType.LEAD: "leads",
    DocumentEntityType.PROJECT: "projects",
    DocumentEntityType.TASK: "tasks",
    DocumentEntityType.QUOTE: "quotes",
    DocumentEntityType.INVOICE: "invoices",
    DocumentEntityType.CLIENT: "clients",
}


def _sanitize_filename(filename: str) -> str:
    safe = Path(filename).name.strip()
    return safe or "document.bin"


def _storage_dir(entity_type: DocumentEntityType, entity_id: UUID) -> Path:
    base = Path(settings.documents_files_dir)
    target = base / ENTITY_STORAGE_FOLDER[entity_type] / str(entity_id)
    target.mkdir(parents=True, exist_ok=True)
    return target


def _document_to_response(document: Document) -> DocumentResponse:
    return DocumentResponse(
        id=document.id,
        entity_type=document.entity_type,
        entity_id=document.entity_id,
        original_filename=document.original_filename,
        stored_filename=document.stored_filename,
        file_path=document.file_path,
        mime_type=document.mime_type,
        file_size=document.file_size,
        organization_id=document.organization_id,
        uploaded_by_id=document.uploaded_by_id,
        created_at=document.created_at,
        updated_at=document.updated_at,
        uploaded_by_name=document.uploaded_by.full_name if document.uploaded_by else None,
    )


@router.post("/upload", response_model=DocumentResponse, status_code=201)
async def upload_document(
    file: Annotated[UploadFile, File(...)],
    entity_type: Annotated[DocumentEntityType, Form(...)],
    entity_id: Annotated[UUID, Form(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    extension = Path(file.filename or "").suffix.lower()
    if extension not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Type de fichier non autorise")
    content_type = (file.content_type or "").lower()
    if not (
        content_type in ALLOWED_UPLOAD_MIME_EXACT
        or any(content_type.startswith(prefix) for prefix in ALLOWED_UPLOAD_MIME_PREFIXES)
    ):
        raise HTTPException(status_code=400, detail="Type MIME non autorise")

    target_dir = _storage_dir(entity_type, entity_id)
    stored_filename = f"{uuid4().hex}{extension}"
    output_path = target_dir / stored_filename
    total_size = 0
    max_size = settings.documents_max_upload_mb * 1024 * 1024

    with output_path.open("wb") as destination:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            total_size += len(chunk)
            if total_size > max_size:
                destination.close()
                output_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 10 Mo)")
            destination.write(chunk)
    await file.close()

    document = Document(
        organization_id=user.organization_id,
        entity_type=entity_type,
        entity_id=entity_id,
        original_filename=_sanitize_filename(file.filename or ""),
        stored_filename=stored_filename,
        file_path=str(output_path),
        mime_type=file.content_type,
        file_size=total_size,
        uploaded_by_id=user.id,
    )
    db.add(document)
    await db.flush()
    await db.refresh(document)

    await log_audit(
        db,
        organization_id=user.organization_id,
        actor_user_id=user.id,
        action="document.upload",
        entity_type="document",
        entity_id=document.id,
        payload={
            "entity_type": entity_type.value,
            "entity_id": str(entity_id),
            "original_filename": document.original_filename,
            "size_bytes": total_size,
        },
    )
    return _document_to_response(document)


@router.get("/entity/{entity_type}/{entity_id}", response_model=list[DocumentResponse])
async def list_documents(
    entity_type: DocumentEntityType,
    entity_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = (
        select(Document)
        .where(
            Document.organization_id == user.organization_id,
            Document.entity_type == entity_type,
            Document.entity_id == entity_id,
        )
        .order_by(Document.created_at.desc())
    )
    result = await db.execute(stmt)
    documents = result.scalars().all()
    return [_document_to_response(document) for document in documents]


@router.get("/download/{document_id}")
async def download_document(
    document_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    document = await db.get(Document, document_id)
    if not document or document.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Document introuvable")
    file_path = Path(document.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Fichier introuvable sur le disque")
    return FileResponse(
        str(file_path),
        filename=document.original_filename,
        media_type=document.mime_type or "application/octet-stream",
    )


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    document = await db.get(Document, document_id)
    if not document or document.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Document introuvable")
    if document.uploaded_by_id != user.id and user.global_role != GlobalRole.ADMIN:
        raise HTTPException(status_code=403, detail="Vous ne pouvez pas supprimer ce document")

    file_path = Path(document.file_path)
    file_path.unlink(missing_ok=True)

    await db.delete(document)
    await db.flush()
    await log_audit(
        db,
        organization_id=user.organization_id,
        actor_user_id=user.id,
        action="document.delete",
        entity_type="document",
        entity_id=document_id,
        payload={"entity_type": document.entity_type.value, "entity_id": str(document.entity_id)},
    )
    return None
