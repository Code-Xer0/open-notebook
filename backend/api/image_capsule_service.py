import hashlib
import json
import mimetypes
import os
import re
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from loguru import logger

from api.image_capsule_models import (
    ImageCapsuleConfirmationUpdate,
    ImageCapsulePublishRequest,
    ImageCapsuleRegion,
    ImageCapsuleResponse,
)
from open_notebook.config import UPLOADS_FOLDER
from open_notebook.database.repository import ensure_record_id, repo_create, repo_query, repo_update
from open_notebook.domain.notebook import Asset, Notebook, Source

try:
    from PIL import Image
except Exception:  # pragma: no cover - dependency is expected in packaged backend
    Image = None  # type: ignore[assignment]


ALLOWED_IMAGE_TYPES = {
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "image/bmp",
}


def _snake(record: Dict[str, Any]) -> Dict[str, Any]:
    similar_capsules = record.get("similar_capsules") or {}
    if isinstance(similar_capsules, dict):
        similar_capsules = similar_capsules.get("items") or []
    return {
        "id": record.get("id"),
        "assetId": record.get("asset_id"),
        "sourceId": str(record.get("source")) if record.get("source") else None,
        "originalFilename": record.get("original_filename"),
        "originalPath": record.get("original_path"),
        "canonicalAlias": record.get("canonical_alias"),
        "sha256": record.get("sha256"),
        "perceptualHash": record.get("perceptual_hash"),
        "mimeType": record.get("mime_type"),
        "width": record.get("width") or 0,
        "height": record.get("height") or 0,
        "fileSize": record.get("file_size") or 0,
        "projectNamespace": record.get("project_namespace"),
        "parserMode": record.get("parser_mode") or "heuristic_manual",
        "canonStatus": record.get("canon_status") or "draft",
        "imageType": record.get("image_type"),
        "sceneType": record.get("scene_type"),
        "confirmedContext": record.get("confirmed_context") or {},
        "provenance": record.get("provenance") or {},
        "negativeConstraints": record.get("negative_constraints") or [],
        "warnings": record.get("warnings") or [],
        "palette": record.get("palette") or [],
        "notebooks": record.get("notebooks") or [],
        "duplicateCapsules": record.get("duplicate_capsules") or [],
        "similarCapsules": similar_capsules if isinstance(similar_capsules, list) else [],
        "llmContextCard": record.get("llm_context_card"),
        "created": str(record.get("created")) if record.get("created") else None,
        "updated": str(record.get("updated")) if record.get("updated") else None,
    }


def _region_response(record: Dict[str, Any]) -> ImageCapsuleRegion:
    return ImageCapsuleRegion(
        id=record.get("id"),
        label=record.get("label") or "region",
        caption=record.get("caption"),
        manualText=record.get("manual_text"),
        tags=record.get("tags") or [],
        confidence=float(record.get("confidence") or 0.0),
        bounds=record.get("bounds") or {"x": 0.0, "y": 0.0, "width": 1.0, "height": 1.0},
        order=int(record.get("order") or 0),
        provenance=record.get("provenance") or "manual",
    )


def _safe_slug(value: str, fallback: str = "image_capsule") -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return cleaned or fallback


def _normalize_filename(filename: str) -> str:
    safe = os.path.basename(filename).strip()
    if not safe:
        raise HTTPException(status_code=400, detail="Uploaded image must have a filename")
    return safe


def _single_row(result: Any) -> Dict[str, Any]:
    if isinstance(result, list):
        if not result:
            raise RuntimeError("Database write returned no rows")
        return result[0]
    if isinstance(result, dict):
        return result
    raise RuntimeError("Database write returned an unexpected shape")


def _hamming(left: str, right: str) -> int:
    try:
        return bin(int(left, 16) ^ int(right, 16)).count("1")
    except Exception:
        return 64


def _candidate_context(filename: str) -> Tuple[Dict[str, Any], Dict[str, Any], List[str]]:
    stem = Path(filename).stem
    tokens = [token for token in re.split(r"[_\-\s]+", stem) if token]
    inferred: Dict[str, Any] = {}
    warnings = [
        "Parser mode is heuristic_manual. OCR and multimodal vision are not verified.",
        "Identity fields are inferred from filename only until the user confirms them.",
    ]

    if tokens:
        first_alpha = next((token for token in tokens if token.isalpha() and len(token) > 2), None)
        if first_alpha:
            inferred["candidateName"] = first_alpha.capitalize()

    division_match = re.search(r"(division|div)[_\-\s]*([ivxlcdm]+|\d+)", stem, re.IGNORECASE)
    if division_match:
        inferred["candidateDivision"] = division_match.group(2).upper()

    lower_stem = stem.lower()
    if "reference" in lower_stem or "refsheet" in lower_stem or "ref_sheet" in lower_stem:
        inferred["imageType"] = "reference sheet"
    if "aegis" in lower_stem:
        inferred["candidateFaction"] = "Aegis"

    provenance = {
        "observed": {
            "filename": filename,
        },
        "inferred": inferred,
        "confirmed": {},
        "canon": {},
        "uncertain": [
            "Visible text, identity, canon status, and region meanings require user confirmation."
        ],
    }
    return inferred, provenance, warnings


def _image_facts(content: bytes, mime_type: str) -> Tuple[int, int, Optional[str], List[str]]:
    if Image is None:
        raise HTTPException(status_code=500, detail="Pillow is unavailable in the backend")

    try:
        with Image.open(BytesIO(content)) as img:
            width, height = img.size
            phash = _average_hash(img)
            palette = _palette(img)
        return width, height, phash, palette
    except Exception as exc:
        logger.warning(f"Image inspection failed: {exc}")
        raise HTTPException(status_code=400, detail="Uploaded file is not a readable image")


def _average_hash(img: Any, size: int = 8) -> str:
    grayscale = img.convert("L").resize((size, size))
    pixels = list(grayscale.getdata())
    avg = sum(pixels) / len(pixels)
    bits = "".join("1" if pixel >= avg else "0" for pixel in pixels)
    return f"{int(bits, 2):0{size * size // 4}x}"


def _palette(img: Any, max_colors: int = 6) -> List[str]:
    sample = img.convert("RGB").resize((64, 64))
    colors = sample.getcolors(maxcolors=4096) or []
    colors.sort(key=lambda item: item[0], reverse=True)
    return [f"#{r:02x}{g:02x}{b:02x}" for _, (r, g, b) in colors[:max_colors]]


async def _regions_for_capsule(capsule_id: str) -> List[ImageCapsuleRegion]:
    rows = await repo_query(
        "SELECT * FROM image_region WHERE capsule = $capsule ORDER BY order ASC",
        {"capsule": ensure_record_id(capsule_id)},
    )
    return [_region_response(row) for row in rows]


async def _capsule_response(record: Dict[str, Any]) -> ImageCapsuleResponse:
    data = _snake(record)
    data["regions"] = await _regions_for_capsule(str(record["id"]))
    return ImageCapsuleResponse(**data)


async def list_capsules(limit: int = 50, offset: int = 0) -> List[ImageCapsuleResponse]:
    rows = await repo_query(
        """
        SELECT * FROM image_capsule
        ORDER BY updated DESC
        LIMIT $limit START $offset
        """,
        {"limit": limit, "offset": offset},
    )
    return [await _capsule_response(row) for row in rows]


async def get_capsule(capsule_id: str) -> ImageCapsuleResponse:
    full_id = capsule_id if capsule_id.startswith("image_capsule:") else f"image_capsule:{capsule_id}"
    rows = await repo_query("SELECT * FROM $id", {"id": ensure_record_id(full_id)})
    if not rows:
        raise HTTPException(status_code=404, detail="Image capsule not found")
    return await _capsule_response(rows[0])


async def intake_image(
    upload_file: UploadFile,
    project_namespace: Optional[str],
    notebooks: Optional[List[str]],
) -> ImageCapsuleResponse:
    filename = _normalize_filename(upload_file.filename or "")
    mime_type = upload_file.content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    if mime_type == "application/octet-stream":
        mime_type = mimetypes.guess_type(filename)[0] or mime_type
    if mime_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only PNG, JPEG, WebP, GIF, and BMP images are supported")

    for notebook_id in notebooks or []:
        try:
            await Notebook.get(notebook_id)
        except Exception:
            raise HTTPException(status_code=404, detail=f"Notebook {notebook_id} not found")

    content = await upload_file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")

    sha256 = hashlib.sha256(content).hexdigest()
    width, height, phash, palette = _image_facts(content, mime_type)
    inferred, provenance, warnings = _candidate_context(filename)

    duplicates = await repo_query(
        "SELECT VALUE id FROM image_capsule WHERE sha256 = $sha256",
        {"sha256": sha256},
    )
    existing_phashes = await repo_query(
        "SELECT id, perceptual_hash FROM image_capsule WHERE perceptual_hash != NONE LIMIT 1000"
    )
    similar = []
    if phash:
        for row in existing_phashes:
            other_hash = row.get("perceptual_hash")
            if not other_hash:
                continue
            distance = _hamming(phash, other_hash)
            if distance <= 8:
                similar.append({"id": str(row.get("id")), "distance": distance})

    if duplicates:
        warnings.append("Duplicate file hash detected. Review existing capsules before publishing.")
    if similar:
        warnings.append("Visually similar capsule candidates detected by perceptual hash.")

    capsule_uuid = uuid4().hex[:12]
    asset_id = f"asset:{_safe_slug(project_namespace or 'image')}_{capsule_uuid}"
    uploads_dir = Path(UPLOADS_FOLDER).resolve() / "image_capsules"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{capsule_uuid}_{filename}"
    original_path = uploads_dir / stored_name
    original_path.write_bytes(content)

    image_type = inferred.get("imageType")
    record = _single_row(await repo_create(
        "image_capsule",
        {
            "asset_id": asset_id,
            "source": None,
            "original_filename": filename,
            "original_path": str(original_path),
            "canonical_alias": None,
            "sha256": sha256,
            "perceptual_hash": phash,
            "mime_type": mime_type,
            "width": width,
            "height": height,
            "file_size": len(content),
            "project_namespace": project_namespace,
            "parser_mode": "heuristic_manual",
            "canon_status": "draft",
            "image_type": image_type,
            "scene_type": None,
            "confirmed_context": {},
            "provenance": provenance,
            "negative_constraints": [],
            "warnings": warnings,
            "palette": palette,
            "notebooks": notebooks or [],
            "duplicate_capsules": [str(item) for item in duplicates],
            "similar_capsules": {"items": similar},
            "llm_context_card": None,
            "published_at": None,
        },
    ))
    await _write_revision(str(record["id"]), "intake", record, "Raw image intake completed")
    return await _capsule_response(record)


async def update_confirmation(
    capsule_id: str,
    update: ImageCapsuleConfirmationUpdate,
) -> ImageCapsuleResponse:
    capsule = await get_capsule(capsule_id)
    data = update.model_dump()
    warnings = list(dict.fromkeys((capsule.warnings or []) + (update.warnings or [])))
    updated = await repo_update(
        "image_capsule",
        capsule.id,
        {
            "project_namespace": update.projectNamespace,
            "canon_status": update.canonStatus,
            "image_type": update.imageType,
            "scene_type": update.sceneType,
            "confirmed_context": data.get("confirmedContext") or {},
            "provenance": _merge_provenance(capsule.provenance, data.get("provenance") or {}),
            "negative_constraints": update.negativeConstraints,
            "warnings": warnings,
        },
    )
    record = _single_row(updated)
    await _write_revision(str(record["id"]), "confirmation", record, "Human confirmation updated")
    return await _capsule_response(record)


async def replace_regions(capsule_id: str, regions: List[ImageCapsuleRegion]) -> ImageCapsuleResponse:
    capsule = await get_capsule(capsule_id)
    await repo_query(
        "DELETE image_region WHERE capsule = $capsule",
        {"capsule": ensure_record_id(capsule.id)},
    )
    for index, region in enumerate(regions):
        _validate_bounds(region.bounds)
        await repo_create(
            "image_region",
            {
                "capsule": ensure_record_id(capsule.id),
                "label": region.label,
                "caption": region.caption,
                "manual_text": region.manualText,
                "tags": region.tags,
                "confidence": region.confidence,
                "bounds": region.bounds,
                "order": index,
                "provenance": region.provenance,
            },
        )
    fresh = await get_capsule(capsule.id)
    await _write_revision(capsule.id, "regions", fresh.model_dump(), "Region annotations replaced")
    return fresh


async def publish_capsule(capsule_id: str, request: ImageCapsulePublishRequest) -> ImageCapsuleResponse:
    capsule = await get_capsule(capsule_id)
    notebooks = request.notebooks if request.notebooks is not None else capsule.notebooks
    for notebook_id in notebooks or []:
        try:
            await Notebook.get(notebook_id)
        except Exception:
            raise HTTPException(status_code=404, detail=f"Notebook {notebook_id} not found")

    canonical_alias = _canonical_alias(capsule)
    context_card = _context_card(capsule, canonical_alias, request.canonStatus)
    topics = _topics(capsule, request.canonStatus)

    if capsule.sourceId:
        source = await Source.get(capsule.sourceId)
        source.title = _display_title(capsule, canonical_alias)
        source.topics = topics
        source.asset = Asset(file_path=capsule.originalPath)
        source.full_text = context_card
        await source.save()
    else:
        source = Source(
            title=_display_title(capsule, canonical_alias),
            topics=topics,
            asset=Asset(file_path=capsule.originalPath),
            full_text=context_card,
        )
        await source.save()

    for notebook_id in notebooks or []:
        try:
            await source.add_to_notebook(notebook_id)
        except Exception as exc:
            logger.warning(f"Failed to link image capsule source to notebook {notebook_id}: {exc}")

    await _replace_source_insights(str(source.id), capsule, context_card)

    updated = await repo_update(
        "image_capsule",
        capsule.id,
        {
            "source": ensure_record_id(str(source.id)),
            "canonical_alias": canonical_alias,
            "canon_status": request.canonStatus,
            "notebooks": notebooks or [],
            "llm_context_card": context_card,
            "published_at": datetime.now(timezone.utc),
        },
    )
    record = _single_row(updated)
    await _write_revision(str(record["id"]), "publish", record, request.publishNote or "Image capsule published")
    return await _capsule_response(record)


def _merge_provenance(existing: Dict[str, Any], incoming: Dict[str, Any]) -> Dict[str, Any]:
    merged = {
        "observed": {},
        "inferred": {},
        "confirmed": {},
        "canon": {},
        "uncertain": [],
    }
    for source in (existing or {}, incoming or {}):
        for key in ("observed", "inferred", "confirmed", "canon"):
            if isinstance(source.get(key), dict):
                merged[key].update(source[key])
        if isinstance(source.get("uncertain"), list):
            merged["uncertain"].extend(source["uncertain"])
    merged["uncertain"] = list(dict.fromkeys(str(item) for item in merged["uncertain"]))
    return merged


def _validate_bounds(bounds: Dict[str, float]) -> None:
    required = ("x", "y", "width", "height")
    if any(key not in bounds for key in required):
        raise HTTPException(status_code=400, detail="Region bounds require x, y, width, and height")
    for key in required:
        value = bounds[key]
        if value < 0 or value > 1:
            raise HTTPException(status_code=400, detail="Region bounds must be normalized between 0 and 1")
    if bounds["width"] <= 0 or bounds["height"] <= 0:
        raise HTTPException(status_code=400, detail="Region width and height must be greater than zero")


def _confirmed_value(capsule: ImageCapsuleResponse, *keys: str) -> Optional[str]:
    for key in keys:
        value = capsule.confirmedContext.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _display_title(capsule: ImageCapsuleResponse, canonical_alias: str) -> str:
    return (
        _confirmed_value(capsule, "canonicalName", "characterName", "displayTitle")
        or canonical_alias.rsplit(".", 1)[0].replace("_", " ").title()
    )


def _canonical_alias(capsule: ImageCapsuleResponse) -> str:
    parts = [
        _confirmed_value(capsule, "canonicalName", "characterName"),
        _confirmed_value(capsule, "faction"),
        _confirmed_value(capsule, "division"),
        _confirmed_value(capsule, "regalia"),
        capsule.imageType,
    ]
    stem = "_".join(_safe_slug(part, "") for part in parts if part)
    if not stem:
        stem = _safe_slug(Path(capsule.originalFilename).stem)
    ext = Path(capsule.originalFilename).suffix.lower() or ".png"
    return f"{stem}{ext}"


def _topics(capsule: ImageCapsuleResponse, canon_status: str) -> List[str]:
    values: Iterable[Optional[str]] = [
        "image-capsule",
        canon_status,
        capsule.projectNamespace,
        capsule.imageType,
        _confirmed_value(capsule, "canonicalName", "characterName"),
        _confirmed_value(capsule, "faction"),
        _confirmed_value(capsule, "division"),
        _confirmed_value(capsule, "regalia"),
        _confirmed_value(capsule, "expression"),
    ]
    return list(dict.fromkeys(_safe_slug(value, "") for value in values if value))


def _context_card(capsule: ImageCapsuleResponse, canonical_alias: str, canon_status: str) -> str:
    title = _display_title(capsule, canonical_alias)
    lines = [
        f"Image Capsule: {title}",
        f"Capsule ID: {capsule.id}",
        f"Asset ID: {capsule.assetId}",
        f"Canonical alias: {canonical_alias}",
        f"Canon status: {canon_status}",
        "Parser mode: heuristic_manual. OCR and multimodal vision are not verified for this capsule.",
    ]

    field_labels = [
        ("canonicalName", "Canonical name"),
        ("displayTitle", "Display title"),
        ("characterName", "Character"),
        ("aliases", "Aliases"),
        ("faction", "Faction"),
        ("division", "Division"),
        ("role", "Role"),
        ("expression", "Expression"),
        ("expressionDefinition", "Expression definition"),
        ("regalia", "Regalia"),
        ("regaliaDescription", "Regalia description"),
        ("ascension", "Ascension/progression"),
        ("visualCanon", "Visual canon"),
        ("outfitNotes", "Outfit notes"),
        ("poseNotes", "Pose notes"),
        ("relationships", "Relationships"),
        ("userNotes", "User notes"),
    ]
    for key, label in field_labels:
        value = capsule.confirmedContext.get(key)
        if isinstance(value, list):
            value = ", ".join(str(item) for item in value if str(item).strip())
        if isinstance(value, str) and value.strip():
            lines.append(f"{label}: {value.strip()}")

    if capsule.negativeConstraints:
        lines.append(f"Negative constraints: {', '.join(capsule.negativeConstraints)}")

    if capsule.regions:
        lines.append("Region summary:")
        for region in capsule.regions:
            detail = region.caption or region.manualText or "No verified caption"
            lines.append(f"- {region.label}: {detail}")

    lines.append(
        "Provenance: observed values come from file metadata; inferred values are heuristic; confirmed/canon values are user supplied."
    )
    return "\n".join(lines)


async def _replace_source_insights(
    source_id: str,
    capsule: ImageCapsuleResponse,
    context_card: str,
) -> None:
    await repo_query(
        """
        DELETE source_insight
        WHERE source = $source
        AND (insight_type = 'image_capsule_context' OR insight_type = 'image_region')
        """,
        {"source": ensure_record_id(source_id)},
    )
    await repo_query(
        "CREATE source_insight CONTENT $data",
        {
            "data": {
                "source": ensure_record_id(source_id),
                "insight_type": "image_capsule_context",
                "content": context_card,
                "embedding": [],
            }
        },
    )
    for region in capsule.regions:
        content = f"Image Capsule Region: {region.label}\n{region.caption or region.manualText or 'No verified caption.'}"
        await repo_query(
            "CREATE source_insight CONTENT $data",
            {
                "data": {
                    "source": ensure_record_id(source_id),
                    "insight_type": "image_region",
                    "content": content,
                    "embedding": [],
                }
            },
        )


async def _write_revision(capsule_id: str, event: str, snapshot: Any, notes: Optional[str]) -> None:
    if hasattr(snapshot, "model_dump"):
        snapshot = snapshot.model_dump()
    if isinstance(snapshot, dict):
        safe_snapshot = json.loads(json.dumps(snapshot, default=str))
    else:
        safe_snapshot = {"value": str(snapshot)}
    await repo_create(
        "image_capsule_revision",
        {
            "capsule": ensure_record_id(capsule_id),
            "event": event,
            "snapshot": safe_snapshot,
            "notes": notes,
        },
    )
