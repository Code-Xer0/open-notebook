import hashlib
import json
import mimetypes
import os
from pathlib import Path
from typing import Any, Dict, Iterable, Optional
from uuid import uuid4

from loguru import logger

from api.evidence_models import (
    ArtifactEventResponse,
    EvidenceSnapshotResponse,
    EvidenceVaultProbe,
    FileAssetResponse,
    FileDerivativeResponse,
    IntakeSourceCreate,
    IntakeSourceResponse,
)
from open_notebook.config import UPLOADS_FOLDER
from open_notebook.database.repository import ensure_record_id, repo_create, repo_query

EVIDENCE_ROOT = Path(UPLOADS_FOLDER).resolve() / "evidence"
RAW_ROOT = EVIDENCE_ROOT / "raw" / "sha256"
DERIVATIVE_ROOT = EVIDENCE_ROOT / "derivatives" / "sha256"


def _utc_str(value: Any) -> Optional[str]:
    return str(value) if value else None


def _safe_suffix(filename: Optional[str], default: str = ".bin") -> str:
    suffix = Path(filename or "").suffix.lower()
    if not suffix or len(suffix) > 16:
        return default
    return "".join(ch for ch in suffix if ch.isalnum() or ch == ".") or default


def _atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        return
    tmp = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    tmp.write_bytes(content)
    os.replace(tmp, path)


def _within_uploads(path: Path) -> bool:
    uploads = Path(UPLOADS_FOLDER).resolve()
    try:
        resolved = path.resolve()
    except Exception:
        return False
    return str(resolved).startswith(str(uploads) + os.sep) or resolved == uploads


def _file_asset_response(record: Dict[str, Any], duplicates: Optional[Iterable[str]] = None) -> FileAssetResponse:
    return FileAssetResponse(
        id=str(record.get("id")),
        sha256=record.get("sha256") or "",
        byteSize=int(record.get("byte_size") or 0),
        mimeType=record.get("mime_type"),
        storagePath=record.get("storage_path") or "",
        originalPath=record.get("original_path"),
        originKind=record.get("origin_kind") or "system",
        sourceFilename=record.get("source_filename"),
        status=record.get("status") or "not_verified",
        sourceId=str(record.get("source")) if record.get("source") else None,
        imageCapsuleId=str(record.get("image_capsule")) if record.get("image_capsule") else None,
        audioAssetId=str(record.get("audio_asset")) if record.get("audio_asset") else None,
        duplicateOf=str(record.get("duplicate_of")) if record.get("duplicate_of") else None,
        duplicateAssetIds=list(duplicates or []),
        provenance=record.get("provenance") or {},
        created=_utc_str(record.get("created")),
        updated=_utc_str(record.get("updated")),
    )


def _single_record(result: Any) -> Dict[str, Any]:
    if isinstance(result, list):
        if not result:
            raise RuntimeError("Database write returned no rows")
        first = result[0]
        if isinstance(first, dict):
            return first
    if isinstance(result, dict):
        return result
    raise RuntimeError("Database write returned an unexpected shape")


def _derivative_response(record: Dict[str, Any]) -> FileDerivativeResponse:
    return FileDerivativeResponse(
        id=str(record.get("id")),
        assetId=str(record.get("asset")) if record.get("asset") else None,
        sourceId=str(record.get("source")) if record.get("source") else None,
        derivativeType=record.get("derivative_type") or "metadata",
        status=record.get("status") or "not_verified",
        storagePath=record.get("storage_path"),
        content=record.get("content"),
        sha256=record.get("sha256"),
        byteSize=record.get("byte_size"),
        provenance=record.get("provenance") or {},
        created=_utc_str(record.get("created")),
        updated=_utc_str(record.get("updated")),
    )


def _event_response(record: Dict[str, Any]) -> ArtifactEventResponse:
    return ArtifactEventResponse(
        id=str(record.get("id")),
        eventType=record.get("event_type") or "unknown",
        status=record.get("status") or "not_verified",
        subjectTable=record.get("subject_table"),
        subjectId=record.get("subject_id"),
        assetId=str(record.get("asset")) if record.get("asset") else None,
        sourceId=str(record.get("source")) if record.get("source") else None,
        evidence=record.get("evidence"),
        payload=record.get("payload") or {},
        created=_utc_str(record.get("created")),
        updated=_utc_str(record.get("updated")),
    )


def _intake_response(record: Dict[str, Any]) -> IntakeSourceResponse:
    return IntakeSourceResponse(
        id=str(record.get("id")),
        label=record.get("label") or "Local intake source",
        path=record.get("path") or "",
        sourceKind=record.get("source_kind") or "local_folder",
        enabled=bool(record.get("enabled")),
        provenance=record.get("provenance") or {},
        exists=Path(record.get("path") or "").exists(),
        created=_utc_str(record.get("created")),
        updated=_utc_str(record.get("updated")),
    )


def _snapshot_response(record: Dict[str, Any]) -> EvidenceSnapshotResponse:
    return EvidenceSnapshotResponse(
        id=str(record.get("id")),
        reason=record.get("reason") or "manual_snapshot",
        status=record.get("status") or "not_verified",
        manifest=record.get("manifest") or {},
        manifestSha256=record.get("manifest_sha256") or "",
        restoreSupported=bool(record.get("restore_supported", False)),
        created=_utc_str(record.get("created")),
        updated=_utc_str(record.get("updated")),
    )


async def preserve_bytes(
    content: bytes,
    *,
    origin_kind: str,
    source_filename: Optional[str] = None,
    mime_type: Optional[str] = None,
    original_path: Optional[str] = None,
    source_id: Optional[str] = None,
    image_capsule_id: Optional[str] = None,
    audio_asset_id: Optional[str] = None,
    provenance: Optional[Dict[str, Any]] = None,
) -> FileAssetResponse:
    if not content:
        raise ValueError("Cannot preserve an empty evidence asset")

    sha256 = hashlib.sha256(content).hexdigest()
    suffix = _safe_suffix(source_filename or original_path)
    storage_path = RAW_ROOT / sha256[:2] / f"{sha256}{suffix}"
    _atomic_write(storage_path, content)

    existing = await repo_query(
        "SELECT id, created FROM file_asset WHERE sha256 = $sha256 ORDER BY created ASC LIMIT 20",
        {"sha256": sha256},
    )
    duplicate_ids = [str(row.get("id")) for row in existing if row.get("id")]
    duplicate_of = duplicate_ids[0] if duplicate_ids else None

    guessed_mime = mime_type or mimetypes.guess_type(source_filename or original_path or "")[0]
    record = _single_record(
        await repo_create(
            "file_asset",
            {
                "sha256": sha256,
                "byte_size": len(content),
                "mime_type": guessed_mime,
                "storage_path": str(storage_path),
                "original_path": original_path,
                "origin_kind": origin_kind,
                "source_filename": source_filename,
                "status": "stored",
                "source": ensure_record_id(source_id) if source_id else None,
                "image_capsule": ensure_record_id(image_capsule_id) if image_capsule_id else None,
                "audio_asset": ensure_record_id(audio_asset_id) if audio_asset_id else None,
                "duplicate_of": ensure_record_id(duplicate_of) if duplicate_of else None,
                "provenance": provenance or {},
            },
        )
    )
    response = _file_asset_response(record, duplicate_ids)
    await record_event(
        "file_asset.stored",
        status="stored",
        asset_id=response.id,
        source_id=source_id,
        subject_table="file_asset",
        subject_id=response.id,
        evidence=f"sha256:{sha256}",
        payload={
            "originKind": origin_kind,
            "sourceFilename": source_filename,
            "duplicateAssetIds": duplicate_ids,
        },
    )
    return response


async def preserve_file(
    path: str | Path,
    *,
    origin_kind: str,
    source_filename: Optional[str] = None,
    mime_type: Optional[str] = None,
    source_id: Optional[str] = None,
    image_capsule_id: Optional[str] = None,
    audio_asset_id: Optional[str] = None,
    provenance: Optional[Dict[str, Any]] = None,
) -> FileAssetResponse:
    file_path = Path(path)
    if not _within_uploads(file_path):
        raise ValueError("Evidence preservation is limited to CODEX-managed upload paths in V1")
    content = file_path.read_bytes()
    return await preserve_bytes(
        content,
        origin_kind=origin_kind,
        source_filename=source_filename or file_path.name,
        mime_type=mime_type,
        original_path=str(file_path),
        source_id=source_id,
        image_capsule_id=image_capsule_id,
        audio_asset_id=audio_asset_id,
        provenance=provenance,
    )


async def preserve_text_source(
    content: str,
    *,
    title: str,
    source_id: str,
    origin_kind: str = "text_entry",
    provenance: Optional[Dict[str, Any]] = None,
) -> FileAssetResponse:
    asset = await preserve_bytes(
        content.encode("utf-8"),
        origin_kind=origin_kind,
        source_filename=f"{title or 'text_source'}.txt",
        mime_type="text/plain",
        source_id=source_id,
        provenance=provenance or {"parser": "plain_text"},
    )
    await create_derivative(
        derivative_type="canonical_text",
        content=content,
        asset_id=asset.id,
        source_id=source_id,
        provenance={"source": "stored_source.full_text"},
    )
    return asset


async def create_derivative(
    *,
    derivative_type: str,
    content: Optional[str] = None,
    asset_id: Optional[str] = None,
    source_id: Optional[str] = None,
    provenance: Optional[Dict[str, Any]] = None,
    status: str = "derived",
) -> FileDerivativeResponse:
    encoded = content.encode("utf-8") if content is not None else b""
    digest = hashlib.sha256(encoded).hexdigest() if encoded else None
    storage_path = None
    if encoded and digest:
        target = DERIVATIVE_ROOT / digest[:2] / f"{digest}.txt"
        _atomic_write(target, encoded)
        storage_path = str(target)
    record = _single_record(
        await repo_create(
            "file_derivative",
            {
                "asset": ensure_record_id(asset_id) if asset_id else None,
                "source": ensure_record_id(source_id) if source_id else None,
                "derivative_type": derivative_type,
                "status": status,
                "storage_path": storage_path,
                "content": content,
                "sha256": digest,
                "byte_size": len(encoded) if encoded else None,
                "provenance": provenance or {},
            },
        )
    )
    response = _derivative_response(record)
    await record_event(
        "file_derivative.created",
        status=status,
        asset_id=asset_id,
        source_id=source_id,
        subject_table="file_derivative",
        subject_id=response.id,
        evidence=f"sha256:{digest}" if digest else None,
        payload={"derivativeType": derivative_type},
    )
    return response


async def record_event(
    event_type: str,
    *,
    status: str,
    subject_table: Optional[str] = None,
    subject_id: Optional[str] = None,
    asset_id: Optional[str] = None,
    source_id: Optional[str] = None,
    evidence: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
) -> ArtifactEventResponse:
    record = _single_record(
        await repo_create(
            "artifact_event",
            {
                "event_type": event_type,
                "status": status,
                "subject_table": subject_table,
                "subject_id": subject_id,
                "asset": ensure_record_id(asset_id) if asset_id else None,
                "source": ensure_record_id(source_id) if source_id else None,
                "evidence": evidence,
                "payload": payload or {},
            },
        )
    )
    return _event_response(record)


async def safe_record_event(*args: Any, **kwargs: Any) -> None:
    try:
        await record_event(*args, **kwargs)
    except Exception as exc:
        logger.warning(f"Evidence audit event failed: {exc}")


async def list_assets(limit: int = 50, offset: int = 0) -> list[FileAssetResponse]:
    rows = await repo_query(
        "SELECT * FROM file_asset ORDER BY created DESC LIMIT $limit START $offset",
        {"limit": limit, "offset": offset},
    )
    return [_file_asset_response(row) for row in rows]


async def get_asset(asset_id: str) -> FileAssetResponse:
    full_id = asset_id if asset_id.startswith("file_asset:") else f"file_asset:{asset_id}"
    rows = await repo_query("SELECT * FROM $id", {"id": ensure_record_id(full_id)})
    if not rows:
        raise ValueError("File asset not found")
    return _file_asset_response(rows[0])


async def list_events(limit: int = 50, offset: int = 0) -> list[ArtifactEventResponse]:
    rows = await repo_query(
        "SELECT * FROM artifact_event ORDER BY created DESC LIMIT $limit START $offset",
        {"limit": limit, "offset": offset},
    )
    return [_event_response(row) for row in rows]


async def create_intake_source(request: IntakeSourceCreate) -> IntakeSourceResponse:
    path = str(Path(request.path).expanduser())
    record = _single_record(
        await repo_create(
            "intake_source",
            {
                "label": request.label,
                "path": path,
                "source_kind": request.sourceKind,
                "enabled": request.enabled,
                "provenance": request.provenance,
            },
        )
    )
    await safe_record_event(
        "intake_source.registered",
        status="stored",
        subject_table="intake_source",
        subject_id=str(record.get("id")),
        payload={"label": request.label, "path": path, "exists": Path(path).exists()},
    )
    return _intake_response(record)


async def list_intake_sources(limit: int = 100) -> list[IntakeSourceResponse]:
    rows = await repo_query(
        "SELECT * FROM intake_source ORDER BY updated DESC LIMIT $limit",
        {"limit": limit},
    )
    return [_intake_response(row) for row in rows]


async def _count(table: str) -> int | str:
    try:
        rows = await repo_query(f"SELECT id FROM {table}")
        return len(rows or [])
    except Exception:
        return "Unknown"


async def list_snapshots(limit: int = 20) -> list[EvidenceSnapshotResponse]:
    rows = await repo_query(
        "SELECT * FROM evidence_snapshot ORDER BY created DESC LIMIT $limit",
        {"limit": limit},
    )
    return [_snapshot_response(row) for row in rows]


async def create_snapshot(reason: str) -> EvidenceSnapshotResponse:
    manifest: Dict[str, Any] = {
        "reason": reason,
        "restoreSupported": False,
        "tables": {
            "file_asset": await _count("file_asset"),
            "file_derivative": await _count("file_derivative"),
            "artifact_event": await _count("artifact_event"),
            "intake_source": await _count("intake_source"),
            "source": await _count("source"),
            "image_capsule": await _count("image_capsule"),
            "audio_asset": await _count("audio_asset"),
            "reading_manifest": await _count("reading_manifest"),
        },
    }
    manifest_sha = hashlib.sha256(json.dumps(manifest, sort_keys=True).encode("utf-8")).hexdigest()
    record = _single_record(
        await repo_create(
            "evidence_snapshot",
            {
                "reason": reason,
                "status": "stored",
                "manifest": manifest,
                "manifest_sha256": manifest_sha,
                "restore_supported": False,
            },
        )
    )
    response = _snapshot_response(record)
    await safe_record_event(
        "evidence_snapshot.created",
        status="stored",
        subject_table="evidence_snapshot",
        subject_id=response.id,
        evidence=f"sha256:{manifest_sha}",
        payload={"reason": reason, "restoreSupported": False},
    )
    return response


async def probe_evidence_vault() -> EvidenceVaultProbe:
    last_error = None
    writable = False
    try:
        EVIDENCE_ROOT.mkdir(parents=True, exist_ok=True)
        probe_path = EVIDENCE_ROOT / ".probe"
        probe_path.write_text("ok", encoding="utf-8")
        probe_path.unlink(missing_ok=True)
        writable = True
    except Exception as exc:
        last_error = str(exc)
    snapshots = await list_snapshots(limit=1) if writable else []
    return EvidenceVaultProbe(
        status="ready" if writable else "failed",
        evidenceRoot=str(EVIDENCE_ROOT),
        writable=writable,
        assetCount=await _count("file_asset"),
        derivativeCount=await _count("file_derivative"),
        eventCount=await _count("artifact_event"),
        snapshotCount=await _count("evidence_snapshot"),
        latestSnapshot=snapshots[0] if snapshots else None,
        lastError=last_error,
    )
