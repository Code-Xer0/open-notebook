import hashlib
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from fastapi import HTTPException
from loguru import logger

from api.audio_adapters import get_audio_adapter_capabilities
from api.evidence_service import create_derivative, preserve_bytes, safe_record_event
from api.voice_models import (
    ManuscriptIntakeRequest,
    ManuscriptResponse,
    ManuscriptSegmentResponse,
    PerformanceTakeResponse,
    ReadingManifestCreate,
    ReadingManifestResponse,
    RenderManifestRequest,
    RenderManifestResponse,
    SegmentAttributionUpdate,
    TakeStatusUpdate,
    VoiceAssignmentCreate,
    VoiceAssignmentResponse,
    VoiceCapsuleCreate,
    VoiceCapsuleResponse,
    VoiceCapsuleUpdate,
    VoiceCharacterCreate,
    VoiceCharacterResponse,
)
from open_notebook.ai.models import DefaultModels, Model
from open_notebook.config import UPLOADS_FOLDER
from open_notebook.database.repository import ensure_record_id, repo_create, repo_query, repo_update
from open_notebook.domain.credential import Credential
from open_notebook.domain.notebook import Notebook, Source


RIGHTS_BLOCKERS = {
    "unverified_source",
    "do_not_publish",
    "requires_consent",
    "expired_license",
}

SUPPORTED_TTS_PROVIDERS = {"openai_speech"}
DEFAULT_OPENAI_TTS_MODEL = "gpt-4o-mini-tts"
DEFAULT_OPENAI_TTS_VOICE = "alloy"


def _single_row(result: Any) -> Dict[str, Any]:
    if isinstance(result, list):
        if not result:
            raise RuntimeError("Database write returned no rows")
        return result[0]
    if isinstance(result, dict):
        return result
    raise RuntimeError("Database write returned an unexpected shape")


def _full_id(value: str, table: str) -> str:
    return value if value.startswith(f"{table}:") else f"{table}:{value}"


def _record_or_none(value: Optional[str], table: str) -> Any:
    if not value:
        return None
    return ensure_record_id(_full_id(value, table))


def _iso(value: Any) -> Optional[str]:
    return str(value) if value else None


def _voice_response(record: Dict[str, Any]) -> VoiceCapsuleResponse:
    return VoiceCapsuleResponse(
        id=str(record["id"]),
        displayName=record.get("display_name") or "",
        voiceType=record.get("voice_type") or "synthetic",
        provider=record.get("provider") or "openai_speech",
        model=record.get("model"),
        voiceId=record.get("voice_id"),
        version=record.get("version") or "v1.0",
        status=record.get("status") or "draft",
        rightsStatus=record.get("rights_status") or "unverified_source",
        description=record.get("description"),
        doctrineCard=record.get("doctrine_card"),
        toneProfile=record.get("tone_profile") or {},
        providerSettings=record.get("provider_settings") or {},
        allowedUse=record.get("allowed_use") or [],
        forbiddenUse=record.get("forbidden_use") or [],
        sampleAudioRefs=record.get("sample_audio_refs") or [],
        calibrationTextRefs=record.get("calibration_text_refs") or [],
        provenance=record.get("provenance") or {},
        lockedAt=_iso(record.get("locked_at")),
        created=_iso(record.get("created")),
        updated=_iso(record.get("updated")),
    )


def _character_response(record: Dict[str, Any]) -> VoiceCharacterResponse:
    return VoiceCharacterResponse(
        id=str(record["id"]),
        displayName=record.get("display_name") or "",
        aliases=record.get("aliases") or [],
        description=record.get("description"),
        doctrineCard=record.get("doctrine_card"),
        created=_iso(record.get("created")),
        updated=_iso(record.get("updated")),
    )


def _assignment_response(record: Dict[str, Any]) -> VoiceAssignmentResponse:
    return VoiceAssignmentResponse(
        id=str(record["id"]),
        characterId=str(record["character"]) if record.get("character") else None,
        voiceCapsuleId=str(record["voice_capsule"]),
        assignmentType=record.get("assignment_type") or "canonical_dialogue",
        canonStatus=record.get("canon_status") or "draft",
        version=record.get("version") or "v1.0",
        notes=record.get("notes"),
        lockedAt=_iso(record.get("locked_at")),
        created=_iso(record.get("created")),
        updated=_iso(record.get("updated")),
    )


def _segment_response(record: Dict[str, Any]) -> ManuscriptSegmentResponse:
    return ManuscriptSegmentResponse(
        id=str(record["id"]),
        manuscriptId=str(record["manuscript"]),
        chapterId=record.get("chapter_id"),
        sceneId=record.get("scene_id"),
        segmentType=record.get("segment_type") or "narration",
        text=record.get("text") or "",
        speakerId=record.get("speaker_id"),
        speakerLabel=record.get("speaker_label"),
        speakerConfidence=float(record.get("speaker_confidence") or 0.0),
        needsReview=bool(record.get("needs_review")),
        resolverNotes=record.get("resolver_notes") or [],
        orderIndex=int(record.get("order_index") or 0),
        created=_iso(record.get("created")),
        updated=_iso(record.get("updated")),
    )


def _manifest_response(record: Dict[str, Any]) -> ReadingManifestResponse:
    return ReadingManifestResponse(
        id=str(record["id"]),
        title=record.get("title") or "",
        manuscriptId=str(record["manuscript"]),
        readingProfile=record.get("reading_profile") or "Full Cast Canon Draft",
        narratorVoiceId=str(record["narrator_voice"]) if record.get("narrator_voice") else None,
        characterVoiceMap=record.get("character_voice_map") or {},
        pronunciationLexiconId=str(record["pronunciation_lexicon"]) if record.get("pronunciation_lexicon") else None,
        performanceRules=record.get("performance_rules") or {},
        notebooks=record.get("notebooks") or [],
        status=record.get("status") or "draft",
        qaStatus=record.get("qa_status") or "not_run",
        sourceId=str(record["source"]) if record.get("source") else None,
        lockedAt=_iso(record.get("locked_at")),
        created=_iso(record.get("created")),
        updated=_iso(record.get("updated")),
    )


def _take_response(record: Dict[str, Any]) -> PerformanceTakeResponse:
    return PerformanceTakeResponse(
        id=str(record["id"]),
        readingManifestId=str(record["reading_manifest"]),
        segmentId=str(record["segment"]),
        voiceCapsuleId=str(record["voice_capsule"]) if record.get("voice_capsule") else None,
        audioAssetId=str(record["audio_asset"]) if record.get("audio_asset") else None,
        provider=record.get("provider") or "none",
        model=record.get("model"),
        generationSettings=record.get("generation_settings") or {},
        emotionDirection=record.get("emotion_direction") or {},
        status=record.get("status") or "draft",
        qaStatus=record.get("qa_status") or "not_run",
        errorMessage=record.get("error_message"),
        notes=record.get("notes"),
        created=_iso(record.get("created")),
        updated=_iso(record.get("updated")),
    )


async def get_voice_provider_status() -> Dict[str, Any]:
    """Return factual OpenAI speech readiness without performing generation."""
    adapters = await get_audio_adapter_capabilities()
    speech_adapter = adapters.get("openai_speech", {})
    credential_source = speech_adapter.get("credentialSource", "none")
    credential_id = None
    last_error = speech_adapter.get("lastTestMessage")

    try:
        credentials = await Credential.get_by_provider("openai")
        credential = next(
            (
                item
                for item in credentials
                if item.api_key and item.last_test_success is True
            ),
            None,
        )
        if credential:
            credential_id = credential.id
    except Exception as exc:
        last_error = f"credential_error: {exc}"

    default_tts_model = None
    default_tts_model_name = None
    default_tts_model_provider = None
    try:
        defaults = await DefaultModels.get_instance()
        default_tts_model = getattr(defaults, "default_text_to_speech_model", None)
        if default_tts_model:
            model = await Model.get(default_tts_model)
            default_tts_model_name = model.name
            default_tts_model_provider = model.provider
    except Exception as exc:
        if not last_error:
            last_error = f"default_model_error: {exc}"

    if speech_adapter.get("status") != "ready":
        return {
            "status": speech_adapter.get("status") or "provider missing",
            "provider": "openai",
            "adapter": "openai_speech",
            "source": credential_source,
            "credentialId": credential_id,
            "defaultTextToSpeechModel": default_tts_model,
            "defaultTextToSpeechModelName": default_tts_model_name,
            "defaultTextToSpeechModelProvider": default_tts_model_provider,
            "lastError": last_error,
            "blockingReason": speech_adapter.get("blockingReason")
            or "OpenAI speech needs a passing backend credential test.",
            "adapters": adapters,
        }

    return {
        "status": "ready",
        "provider": "openai",
        "adapter": "openai_speech",
        "source": credential_source,
        "credentialId": credential_id,
        "defaultTextToSpeechModel": default_tts_model,
        "defaultTextToSpeechModelName": default_tts_model_name,
        "defaultTextToSpeechModelProvider": default_tts_model_provider,
        "lastError": last_error,
        "blockingReason": None,
        "adapters": adapters,
    }


async def _resolve_openai_api_key() -> Tuple[Optional[str], str]:
    credentials = await Credential.get_by_provider("openai")
    credential = next(
        (
            item
            for item in credentials
            if item.api_key and item.last_test_success is True
        ),
        None,
    )
    if credential and credential.api_key:
        return credential.api_key.get_secret_value(), "database"
    return None, "none"


async def _default_tts_model_name() -> Optional[str]:
    try:
        defaults = await DefaultModels.get_instance()
        model_id = getattr(defaults, "default_text_to_speech_model", None)
        if not model_id:
            return None
        model = await Model.get(model_id)
        if model.provider.lower() != "openai":
            return None
        return model.name
    except Exception:
        return None


async def _write_voice_revision(capsule_id: str, event: str, snapshot: Dict[str, Any], notes: Optional[str] = None) -> None:
    await repo_create(
        "voice_capsule_revision",
        {
            "capsule": ensure_record_id(_full_id(capsule_id, "voice_capsule")),
            "event": event,
            "snapshot": snapshot,
            "notes": notes,
        },
    )


async def list_voice_capsules(limit: int = 50, offset: int = 0) -> List[VoiceCapsuleResponse]:
    rows = await repo_query(
        "SELECT * FROM voice_capsule ORDER BY updated DESC LIMIT $limit START $offset",
        {"limit": limit, "offset": offset},
    )
    return [_voice_response(row) for row in rows]


async def create_voice_capsule(request: VoiceCapsuleCreate) -> VoiceCapsuleResponse:
    record = await repo_create(
        "voice_capsule",
        {
            "display_name": request.displayName,
            "voice_type": request.voiceType,
            "provider": request.provider,
            "model": request.model,
            "voice_id": request.voiceId,
            "version": request.version,
            "status": request.status,
            "rights_status": request.rightsStatus,
            "description": request.description,
            "doctrine_card": request.doctrineCard,
            "tone_profile": request.toneProfile,
            "provider_settings": request.providerSettings,
            "allowed_use": request.allowedUse,
            "forbidden_use": request.forbiddenUse,
            "sample_audio_refs": request.sampleAudioRefs,
            "calibration_text_refs": request.calibrationTextRefs,
            "provenance": request.provenance,
            "locked_at": None,
        },
    )
    row = _single_row(record)
    await _write_voice_revision(str(row["id"]), "create", row, "Voice capsule draft created")
    return _voice_response(row)


async def get_voice_capsule(capsule_id: str) -> VoiceCapsuleResponse:
    rows = await repo_query("SELECT * FROM $id", {"id": ensure_record_id(_full_id(capsule_id, "voice_capsule"))})
    if not rows:
        raise HTTPException(status_code=404, detail="Voice capsule not found")
    return _voice_response(rows[0])


async def update_voice_capsule(capsule_id: str, request: VoiceCapsuleUpdate) -> VoiceCapsuleResponse:
    current = await get_voice_capsule(capsule_id)
    if current.status == "locked":
        raise HTTPException(status_code=409, detail="Locked voice capsules cannot be overwritten. Create a new version.")

    data: Dict[str, Any] = {}
    mapping = {
        "displayName": "display_name",
        "voiceType": "voice_type",
        "voiceId": "voice_id",
        "rightsStatus": "rights_status",
        "doctrineCard": "doctrine_card",
        "toneProfile": "tone_profile",
        "providerSettings": "provider_settings",
        "allowedUse": "allowed_use",
        "forbiddenUse": "forbidden_use",
        "sampleAudioRefs": "sample_audio_refs",
        "calibrationTextRefs": "calibration_text_refs",
    }
    payload = request.model_dump(exclude_none=True)
    notes = payload.pop("notes", None)
    for key, value in payload.items():
        data[mapping.get(key, key)] = value
    row = _single_row(await repo_update("voice_capsule", _full_id(capsule_id, "voice_capsule"), data))
    await _write_voice_revision(str(row["id"]), "update", row, notes)
    return _voice_response(row)


async def lock_voice_capsule(capsule_id: str, notes: Optional[str] = None) -> VoiceCapsuleResponse:
    current = await get_voice_capsule(capsule_id)
    if current.rightsStatus in RIGHTS_BLOCKERS:
        raise HTTPException(status_code=409, detail=f"Cannot lock voice capsule with rights status '{current.rightsStatus}'")
    row = _single_row(
        await repo_update(
            "voice_capsule",
            _full_id(capsule_id, "voice_capsule"),
            {"status": "locked", "locked_at": datetime.now(timezone.utc)},
        )
    )
    await _write_voice_revision(str(row["id"]), "lock", row, notes or "Voice capsule locked")
    return _voice_response(row)


async def deprecate_voice_capsule(capsule_id: str, notes: Optional[str] = None) -> VoiceCapsuleResponse:
    row = _single_row(await repo_update("voice_capsule", _full_id(capsule_id, "voice_capsule"), {"status": "deprecated"}))
    await _write_voice_revision(str(row["id"]), "deprecate", row, notes)
    return _voice_response(row)


async def create_voice_character(request: VoiceCharacterCreate) -> VoiceCharacterResponse:
    row = _single_row(
        await repo_create(
            "voice_character",
            {
                "display_name": request.displayName,
                "aliases": request.aliases,
                "description": request.description,
                "doctrine_card": request.doctrineCard,
            },
        )
    )
    return _character_response(row)


async def list_voice_characters() -> List[VoiceCharacterResponse]:
    rows = await repo_query("SELECT * FROM voice_character ORDER BY display_name ASC")
    return [_character_response(row) for row in rows]


async def create_voice_assignment(request: VoiceAssignmentCreate) -> VoiceAssignmentResponse:
    capsule = await get_voice_capsule(request.voiceCapsuleId)
    if request.canonStatus == "canon" and capsule.status != "locked":
        raise HTTPException(status_code=409, detail="Canon voice assignments require a locked voice capsule")
    row = _single_row(
        await repo_create(
            "voice_assignment",
            {
                "character": _record_or_none(request.characterId, "voice_character"),
                "voice_capsule": ensure_record_id(_full_id(request.voiceCapsuleId, "voice_capsule")),
                "assignment_type": request.assignmentType,
                "canon_status": request.canonStatus,
                "version": request.version,
                "notes": request.notes,
                "locked_at": datetime.now(timezone.utc) if request.canonStatus == "canon" else None,
            },
        )
    )
    return _assignment_response(row)


async def list_voice_assignments() -> List[VoiceAssignmentResponse]:
    rows = await repo_query("SELECT * FROM voice_assignment ORDER BY updated DESC")
    return [_assignment_response(row) for row in rows]


async def _source_text(source_id: str) -> str:
    source = await Source.get(_full_id(source_id, "source"))
    if not source or not source.full_text:
        raise HTTPException(status_code=404, detail="Source text not found")
    return source.full_text


def _segment_manuscript_text(text: str) -> List[Dict[str, Any]]:
    segments: List[Dict[str, Any]] = []
    chunks = [line.strip() for line in re.split(r"\n+", text) if line.strip()]
    if not chunks:
        chunks = [text.strip()] if text.strip() else []

    for index, chunk in enumerate(chunks):
        lower = chunk.lower()
        segment_type = "narration"
        confidence = 0.0
        speaker_label = None
        needs_review = False
        notes: List[str] = []

        quote_like = chunk.startswith(('"', "'", "“", "‘")) or "”" in chunk or '"' in chunk
        tag_match = re.search(r"(?:^|[\"”]\s*)([A-Z][A-Za-z0-9_ -]{1,40})\s+(said|asked|replied|whispered|shouted|murmured|called)", chunk)
        prefix_match = re.match(r"^([A-Z][A-Za-z0-9_ -]{1,40})\s*:\s*(.+)$", chunk)
        if prefix_match:
            segment_type = "dialogue"
            speaker_label = prefix_match.group(1).strip()
            confidence = 0.92
            notes.append("Speaker inferred from explicit script prefix.")
        elif tag_match:
            segment_type = "dialogue"
            speaker_label = tag_match.group(1).strip()
            confidence = 0.86
            notes.append("Speaker inferred from dialogue tag.")
        elif quote_like:
            segment_type = "ambiguous_speaker"
            confidence = 0.35
            needs_review = True
            notes.append("Quoted line has no confirmed speaker.")
        elif any(term in lower for term in ("aegis bulletin", "record:", "system:", "transmission:")):
            segment_type = "system_record"
            confidence = 0.65
            notes.append("System or record language inferred heuristically.")
        elif any(term in lower for term in ("prayer", "chant", "song")):
            segment_type = "song_chant_prayer"
            confidence = 0.5
            needs_review = True
            notes.append("Ritual/song segment requires human confirmation.")

        segments.append(
            {
                "segment_type": segment_type,
                "text": chunk,
                "speaker_id": None,
                "speaker_label": speaker_label,
                "speaker_confidence": confidence,
                "needs_review": needs_review,
                "resolver_notes": notes,
                "order_index": index,
            }
        )
    return segments


async def intake_manuscript(request: ManuscriptIntakeRequest) -> ManuscriptResponse:
    text = request.text or ""
    if request.sourceId:
        text = await _source_text(request.sourceId)
    if not text.strip():
        raise HTTPException(status_code=400, detail="Manuscript text is required")

    notebook_record = None
    if request.notebookId:
        notebook = await Notebook.get(_full_id(request.notebookId, "notebook"))
        if not notebook:
            raise HTTPException(status_code=404, detail="Notebook not found")
        notebook_record = ensure_record_id(_full_id(request.notebookId, "notebook"))

    manuscript = _single_row(
        await repo_create(
            "manuscript",
            {
                "title": request.title,
                "source": _record_or_none(request.sourceId, "source"),
                "notebook": notebook_record,
                "text": text,
                "metadata": request.metadata,
            },
        )
    )

    for segment in _segment_manuscript_text(text):
        segment["manuscript"] = ensure_record_id(str(manuscript["id"]))
        await repo_create("manuscript_segment", segment)

    return await get_manuscript(str(manuscript["id"]))


async def get_manuscript(manuscript_id: str) -> ManuscriptResponse:
    rows = await repo_query("SELECT * FROM $id", {"id": ensure_record_id(_full_id(manuscript_id, "manuscript"))})
    if not rows:
        raise HTTPException(status_code=404, detail="Manuscript not found")
    record = rows[0]
    total_rows = await repo_query(
        "SELECT count() AS count FROM manuscript_segment WHERE manuscript = $id GROUP ALL",
        {"id": ensure_record_id(str(record["id"]))},
    )
    review_rows = await repo_query(
        "SELECT count() AS count FROM manuscript_segment WHERE manuscript = $id AND needs_review = true GROUP ALL",
        {"id": ensure_record_id(str(record["id"]))},
    )
    total = total_rows[0]["count"] if total_rows else 0
    review = review_rows[0]["count"] if review_rows else 0
    return ManuscriptResponse(
        id=str(record["id"]),
        title=record.get("title") or "",
        sourceId=str(record["source"]) if record.get("source") else None,
        notebookId=str(record["notebook"]) if record.get("notebook") else None,
        metadata=record.get("metadata") or {},
        segmentCount=int(total or 0),
        reviewCount=int(review or 0),
        created=_iso(record.get("created")),
        updated=_iso(record.get("updated")),
    )


async def list_manuscripts() -> List[ManuscriptResponse]:
    rows = await repo_query("SELECT * FROM manuscript ORDER BY updated DESC")
    return [await get_manuscript(str(row["id"])) for row in rows]


async def list_segments(manuscript_id: str, review_only: bool = False) -> List[ManuscriptSegmentResponse]:
    query = "SELECT * FROM manuscript_segment WHERE manuscript = $id"
    if review_only:
        query += " AND needs_review = true"
    query += " ORDER BY order_index ASC"
    rows = await repo_query(query, {"id": ensure_record_id(_full_id(manuscript_id, "manuscript"))})
    return [_segment_response(row) for row in rows]


async def update_segment_attribution(segment_id: str, request: SegmentAttributionUpdate) -> ManuscriptSegmentResponse:
    row = _single_row(
        await repo_update(
            "manuscript_segment",
            _full_id(segment_id, "manuscript_segment"),
            {
                "speaker_id": request.speakerId,
                "speaker_label": request.speakerLabel,
                "speaker_confidence": request.speakerConfidence,
                "needs_review": request.needsReview,
                "resolver_notes": request.resolverNotes,
            },
        )
    )
    return _segment_response(row)


async def create_reading_manifest(request: ReadingManifestCreate) -> ReadingManifestResponse:
    await get_manuscript(request.manuscriptId)
    if request.narratorVoiceId:
        await get_voice_capsule(request.narratorVoiceId)
    for capsule_id in request.characterVoiceMap.values():
        await get_voice_capsule(capsule_id)
    row = _single_row(
        await repo_create(
            "reading_manifest",
            {
                "title": request.title,
                "manuscript": ensure_record_id(_full_id(request.manuscriptId, "manuscript")),
                "reading_profile": request.readingProfile,
                "narrator_voice": _record_or_none(request.narratorVoiceId, "voice_capsule"),
                "character_voice_map": request.characterVoiceMap,
                "pronunciation_lexicon": _record_or_none(request.pronunciationLexiconId, "pronunciation_lexicon"),
                "performance_rules": request.performanceRules,
                "notebooks": request.notebooks,
                "status": request.status,
                "qa_status": "not_run",
                "source": None,
                "locked_at": None,
            },
        )
    )
    return _manifest_response(row)


async def get_reading_manifest(manifest_id: str) -> ReadingManifestResponse:
    rows = await repo_query("SELECT * FROM $id", {"id": ensure_record_id(_full_id(manifest_id, "reading_manifest"))})
    if not rows:
        raise HTTPException(status_code=404, detail="Reading manifest not found")
    return _manifest_response(rows[0])


async def list_reading_manifests() -> List[ReadingManifestResponse]:
    rows = await repo_query("SELECT * FROM reading_manifest ORDER BY updated DESC")
    return [_manifest_response(row) for row in rows]


async def lock_reading_manifest(manifest_id: str) -> ReadingManifestResponse:
    manifest = await get_reading_manifest(manifest_id)
    capsule_ids = list(manifest.characterVoiceMap.values())
    if manifest.narratorVoiceId:
        capsule_ids.append(manifest.narratorVoiceId)
    for capsule_id in capsule_ids:
        capsule = await get_voice_capsule(capsule_id)
        if capsule.status != "locked":
            raise HTTPException(status_code=409, detail=f"Voice capsule {capsule.id} must be locked before locking a manifest")
        if capsule.rightsStatus in RIGHTS_BLOCKERS:
            raise HTTPException(status_code=409, detail=f"Voice capsule {capsule.id} has blocked rights status '{capsule.rightsStatus}'")
    row = _single_row(
        await repo_update(
            "reading_manifest",
            _full_id(manifest_id, "reading_manifest"),
            {"status": "locked", "locked_at": datetime.now(timezone.utc)},
        )
    )
    return _manifest_response(row)


async def _manifest_record(manifest_id: str) -> Dict[str, Any]:
    rows = await repo_query("SELECT * FROM $id", {"id": ensure_record_id(_full_id(manifest_id, "reading_manifest"))})
    if not rows:
        raise HTTPException(status_code=404, detail="Reading manifest not found")
    return rows[0]


async def _segment_record(segment_id: str) -> Dict[str, Any]:
    rows = await repo_query("SELECT * FROM $id", {"id": ensure_record_id(_full_id(segment_id, "manuscript_segment"))})
    if not rows:
        raise HTTPException(status_code=404, detail="Manuscript segment not found")
    return rows[0]


async def _voice_for_segment(manifest: ReadingManifestResponse, segment: ManuscriptSegmentResponse) -> Optional[VoiceCapsuleResponse]:
    if segment.segmentType == "narration" and manifest.narratorVoiceId:
        return await get_voice_capsule(manifest.narratorVoiceId)
    if segment.speakerLabel and segment.speakerLabel in manifest.characterVoiceMap:
        return await get_voice_capsule(manifest.characterVoiceMap[segment.speakerLabel])
    if manifest.narratorVoiceId:
        return await get_voice_capsule(manifest.narratorVoiceId)
    return None


async def _openai_speech(text: str, voice: VoiceCapsuleResponse, output_dir: Path) -> Tuple[Optional[Dict[str, Any]], Optional[str], Dict[str, Any]]:
    api_key, credential_source = await _resolve_openai_api_key()
    if not api_key:
        return None, "provider_not_configured: backend OpenAI credential is missing", {"credentialSource": credential_source}
    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=api_key)
        model = voice.model or await _default_tts_model_name() or DEFAULT_OPENAI_TTS_MODEL
        provider_voice = voice.voiceId or DEFAULT_OPENAI_TTS_VOICE
        response_format = voice.providerSettings.get("response_format") or "mp3"
        response = await client.audio.speech.create(
            model=model,
            voice=provider_voice,
            input=text,
            response_format=response_format,
        )
        content = getattr(response, "content", None)
        if content is None and hasattr(response, "aread"):
            content = await response.aread()
        if content is None and hasattr(response, "read"):
            content = response.read()
        if not isinstance(content, (bytes, bytearray)):
            return None, "provider_error: OpenAI speech response did not contain audio bytes", {"credentialSource": credential_source, "model": model}

        output_dir.mkdir(parents=True, exist_ok=True)
        file_path = output_dir / f"{uuid4()}.{response_format}"
        file_path.write_bytes(bytes(content))
        sha256 = hashlib.sha256(bytes(content)).hexdigest()
        asset = _single_row(
            await repo_create(
                "audio_asset",
                {
                    "file_path": str(file_path),
                    "duration": None,
                    "format": response_format,
                    "sample_rate": None,
                    "word_timestamps": {},
                    "segment_timestamps": {},
                    "sha256": sha256,
                },
            )
        )
        try:
            await preserve_bytes(
                bytes(content),
                origin_kind="generated_audio",
                source_filename=Path(str(asset.get("file_path") or file_path)).name,
                mime_type=f"audio/{response_format}",
                original_path=str(file_path),
                audio_asset_id=str(asset["id"]),
                provenance={
                    "provider": "openai_speech",
                    "credentialSource": credential_source,
                    "model": model,
                    "voice": provider_voice,
                },
            )
        except Exception as exc:
            logger.warning(f"Failed to preserve generated audio evidence for {asset.get('id')}: {exc}")
            await safe_record_event(
                "audio_asset.evidence_failed",
                status="failed",
                subject_table="audio_asset",
                subject_id=str(asset.get("id")),
                payload={"error": str(exc), "provider": "openai_speech"},
            )
        return asset, None, {"credentialSource": credential_source, "model": model, "voice": provider_voice}
    except Exception as exc:
        logger.exception(exc)
        return None, f"provider_error: {exc}", {"credentialSource": credential_source}


async def _segment_records_for_render(manifest: ReadingManifestResponse, request: RenderManifestRequest) -> List[Dict[str, Any]]:
    if request.segmentIds:
        return [await _segment_record(segment_id) for segment_id in request.segmentIds]

    limit = max(1, min(int(request.maxSegments or 8), 50))
    return await repo_query(
        f"SELECT * FROM manuscript_segment WHERE manuscript = $id ORDER BY order_index ASC LIMIT {limit}",
        {"id": ensure_record_id(manifest.manuscriptId)},
    )


async def accepted_render_segment_ids(manifest_id: str, request: RenderManifestRequest) -> List[str]:
    manifest = await get_reading_manifest(manifest_id)
    records = await _segment_records_for_render(manifest, request)
    return [str(record["id"]) for record in records]


async def _validate_render_prerequisites(
    manifest: ReadingManifestResponse,
    segments: List[ManuscriptSegmentResponse],
    request: RenderManifestRequest,
) -> None:
    if manifest.status != "locked":
        raise HTTPException(status_code=409, detail="Render blocked: lock the reading manifest before generating performance takes.")
    if not segments:
        raise HTTPException(status_code=400, detail="Render blocked: no manuscript segments were selected.")

    provider_status = await get_voice_provider_status()
    if provider_status.get("status") != "ready":
        raise HTTPException(
            status_code=503,
            detail=provider_status.get("blockingReason") or "OpenAI speech provider is not configured.",
        )

    for segment in segments:
        voice = await _voice_for_segment(manifest, segment)
        if not voice:
            raise HTTPException(
                status_code=409,
                detail=f"Render blocked: no narrator or character voice resolved for segment {segment.id}.",
            )
        if voice.status != "locked":
            raise HTTPException(status_code=409, detail=f"Render blocked: voice capsule {voice.id} is not locked.")
        if voice.rightsStatus in RIGHTS_BLOCKERS:
            raise HTTPException(status_code=409, detail=f"Render blocked: voice capsule {voice.id} has rights status '{voice.rightsStatus}'.")
        provider = request.forceProvider or voice.provider
        if provider not in SUPPORTED_TTS_PROVIDERS:
            raise HTTPException(
                status_code=409,
                detail=f"Render blocked: provider '{provider}' has no bundled V1 adapter.",
            )


async def validate_render_request(manifest_id: str, request: RenderManifestRequest) -> List[str]:
    manifest = await get_reading_manifest(manifest_id)
    segment_records = await _segment_records_for_render(manifest, request)
    segments = [_segment_response(record) for record in segment_records]
    await _validate_render_prerequisites(manifest, segments, request)
    return [segment.id for segment in segments]


async def render_reading_manifest(manifest_id: str, request: RenderManifestRequest) -> RenderManifestResponse:
    manifest = await get_reading_manifest(manifest_id)
    segment_records = await _segment_records_for_render(manifest, request)
    segments = [_segment_response(record) for record in segment_records]
    await _validate_render_prerequisites(manifest, segments, request)

    warnings: List[str] = []
    takes: List[PerformanceTakeResponse] = []
    output_dir = Path(UPLOADS_FOLDER) / "voice_layer" / str(uuid4())
    for segment in segments:
        voice = await _voice_for_segment(manifest, segment)
        provider = request.forceProvider or (voice.provider if voice else "none")
        model = voice.model if voice else None
        audio_asset = None
        error_message = None
        qa_status = "not_run"
        take_status = "draft"
        generation_settings: Dict[str, Any] = {
            "adapter": provider,
            "manifestVersionPolicy": "new manifest required for locked setting changes",
            "renderMode": request.renderMode,
            "maxSegments": request.maxSegments,
        }

        if not voice:
            error_message = "voice_not_assigned: no narrator or character voice resolved for segment"
            qa_status = "needs_review"
            take_status = "needs_review"
            warnings.append(error_message)
        elif provider != "openai_speech":
            error_message = f"provider_not_configured: provider '{provider}' is registered but no adapter is bundled in V1"
            qa_status = "provider_missing"
            take_status = "needs_review"
            warnings.append(error_message)
        else:
            audio_asset, error_message, provider_facts = await _openai_speech(segment.text, voice, output_dir)
            generation_settings.update(provider_facts)
            model = provider_facts.get("model") or model
            if error_message:
                qa_status = "provider_missing" if error_message.startswith("provider_not_configured") else "failed"
                take_status = "needs_review"
                warnings.append(error_message)

        row = _single_row(
            await repo_create(
                "performance_take",
                {
                    "reading_manifest": ensure_record_id(_full_id(manifest_id, "reading_manifest")),
                    "segment": ensure_record_id(segment.id),
                    "voice_capsule": ensure_record_id(voice.id) if voice else None,
                    "audio_asset": ensure_record_id(str(audio_asset["id"])) if audio_asset else None,
                    "provider": provider,
                    "model": model,
                    "generation_settings": generation_settings,
                    "emotion_direction": manifest.performanceRules,
                    "status": take_status,
                    "qa_status": qa_status,
                    "error_message": error_message,
                    "notes": None,
                },
            )
        )
        takes.append(_take_response(row))

    manifest_row = _single_row(
        await repo_update(
            "reading_manifest",
            _full_id(manifest_id, "reading_manifest"),
            {"qa_status": "needs_review" if warnings else "not_run"},
        )
    )
    return RenderManifestResponse(manifest=_manifest_response(manifest_row), takes=takes, warnings=warnings)


async def regenerate_performance_take(take_id: str, force_provider: Optional[str] = None) -> RenderManifestResponse:
    take = await get_performance_take(take_id)
    if take.status == "canon":
        raise HTTPException(status_code=409, detail="Canon performance takes cannot be regenerated. Create a new manifest version.")
    if force_provider and take.provider != force_provider:
        raise HTTPException(status_code=409, detail="Regenerate blocked: changing provider requires a new manifest version.")

    result = await render_reading_manifest(
        take.readingManifestId,
        RenderManifestRequest(
            segmentIds=[take.segmentId],
            renderMode="selected",
            maxSegments=1,
            forceProvider=force_provider or take.provider,
        ),
    )
    await repo_update(
        "performance_take",
        _full_id(take_id, "performance_take"),
        {"status": "superseded", "notes": "Superseded by a regenerated take."},
    )
    return result


async def list_performance_takes(manifest_id: Optional[str] = None) -> List[PerformanceTakeResponse]:
    if manifest_id:
        rows = await repo_query(
            "SELECT * FROM performance_take WHERE reading_manifest = $id ORDER BY updated DESC",
            {"id": ensure_record_id(_full_id(manifest_id, "reading_manifest"))},
        )
    else:
        rows = await repo_query("SELECT * FROM performance_take ORDER BY updated DESC LIMIT 100")
    return [_take_response(row) for row in rows]


async def get_performance_take(take_id: str) -> PerformanceTakeResponse:
    rows = await repo_query(
        "SELECT * FROM $id",
        {"id": ensure_record_id(_full_id(take_id, "performance_take"))},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Performance take not found")
    return _take_response(rows[0])


async def update_take_status(take_id: str, request: TakeStatusUpdate) -> PerformanceTakeResponse:
    row = _single_row(
        await repo_update(
            "performance_take",
            _full_id(take_id, "performance_take"),
            {"status": request.status, "notes": request.notes},
        )
    )
    return _take_response(row)


async def get_audio_asset_path(take_id: str) -> Path:
    rows = await repo_query(
        """
        SELECT audio_asset FROM performance_take WHERE id = $id FETCH audio_asset
        """,
        {"id": ensure_record_id(_full_id(take_id, "performance_take"))},
    )
    if not rows or not rows[0].get("audio_asset"):
        raise HTTPException(status_code=404, detail="Performance take has no audio asset")
    asset = rows[0]["audio_asset"]
    if isinstance(asset, list):
        asset = asset[0] if asset else None
    path = Path((asset or {}).get("file_path") or "")
    if not path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found on disk")
    return path


async def publish_reading_manifest(manifest_id: str) -> ReadingManifestResponse:
    manifest = await get_reading_manifest(manifest_id)
    if manifest.status != "locked":
        raise HTTPException(status_code=409, detail="Only locked reading manifests can be published")
    capsule_ids = list(manifest.characterVoiceMap.values())
    if manifest.narratorVoiceId:
        capsule_ids.append(manifest.narratorVoiceId)
    for capsule_id in capsule_ids:
        capsule = await get_voice_capsule(capsule_id)
        if capsule.rightsStatus in RIGHTS_BLOCKERS:
            raise HTTPException(status_code=409, detail=f"Voice capsule {capsule.id} has blocked rights status '{capsule.rightsStatus}'")

    takes = await list_performance_takes(manifest_id)
    context_card = _manifest_context_card(manifest, takes)
    if manifest.sourceId:
        source = await Source.get(manifest.sourceId)
        if source:
            source.full_text = context_card
            source.title = f"Reading Manifest: {manifest.title}"
            await source.save()
            try:
                await create_derivative(
                    derivative_type="context_card",
                    content=context_card,
                    source_id=str(source.id),
                    provenance={"manifestId": manifest.id, "source": "reading_manifest.publish"},
                )
            except Exception as exc:
                logger.warning(f"Failed to create reading manifest evidence derivative for {manifest.id}: {exc}")
                await safe_record_event(
                    "reading_manifest.publish_evidence_failed",
                    status="failed",
                    source_id=str(source.id),
                    subject_table="reading_manifest",
                    subject_id=manifest.id,
                    payload={"error": str(exc)},
                )
    else:
        source = Source(title=f"Reading Manifest: {manifest.title}", topics=["voice layer", "reading manifest"], full_text=context_card)
        await source.save()
        for notebook_id in manifest.notebooks:
            await source.add_to_notebook(notebook_id)
        try:
            await create_derivative(
                derivative_type="context_card",
                content=context_card,
                source_id=str(source.id),
                provenance={"manifestId": manifest.id, "source": "reading_manifest.publish"},
            )
        except Exception as exc:
            logger.warning(f"Failed to create reading manifest evidence derivative for {manifest.id}: {exc}")
            await safe_record_event(
                "reading_manifest.publish_evidence_failed",
                status="failed",
                source_id=str(source.id),
                subject_table="reading_manifest",
                subject_id=manifest.id,
                payload={"error": str(exc)},
            )
        manifest_row = _single_row(
            await repo_update(
                "reading_manifest",
                _full_id(manifest_id, "reading_manifest"),
                {"source": ensure_record_id(str(source.id))},
            )
        )
        return _manifest_response(manifest_row)
    return await get_reading_manifest(manifest_id)


def _manifest_context_card(manifest: ReadingManifestResponse, takes: List[PerformanceTakeResponse]) -> str:
    lines = [
        f"Reading Manifest: {manifest.title}",
        f"Manifest ID: {manifest.id}",
        f"Manuscript ID: {manifest.manuscriptId}",
        f"Reading profile: {manifest.readingProfile}",
        f"Status: {manifest.status}",
        f"QA status: {manifest.qaStatus}",
        f"Narrator voice: {manifest.narratorVoiceId or 'Not assigned'}",
        "Character voice map:",
    ]
    if manifest.characterVoiceMap:
        for character, capsule_id in manifest.characterVoiceMap.items():
            lines.append(f"- {character}: {capsule_id}")
    else:
        lines.append("- None assigned")
    lines.extend(
        [
            "Performance rules:",
            str(manifest.performanceRules or {}),
            "Performance takes:",
        ]
    )
    if takes:
        for take in takes:
            lines.append(f"- {take.id}: segment {take.segmentId}, voice {take.voiceCapsuleId}, status {take.status}, qa {take.qaStatus}, audio {take.audioAssetId or 'none'}")
    else:
        lines.append("- No takes rendered yet")
    lines.append("Provenance note: This reading is generated from locked Nexus Voice Layer metadata. Provider IDs are implementation details; Voice Capsule IDs are the continuity source.")
    return "\n".join(lines)
