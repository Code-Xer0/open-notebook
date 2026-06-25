from typing import Optional

from fastapi import APIRouter, Query

from api.voice_models import (
    VoiceAssignmentCreate,
    VoiceAssignmentResponse,
    VoiceCapsuleCreate,
    VoiceCapsuleListResponse,
    VoiceCapsuleResponse,
    VoiceCapsuleUpdate,
    VoiceCharacterCreate,
    VoiceCharacterResponse,
)
from api.voice_service import (
    create_voice_assignment,
    create_voice_capsule,
    create_voice_character,
    deprecate_voice_capsule,
    get_voice_capsule,
    list_voice_assignments,
    list_voice_capsules,
    list_voice_characters,
    lock_voice_capsule,
    update_voice_capsule,
)

router = APIRouter(prefix="/voice-capsules", tags=["voice-capsules"])


@router.get("", response_model=VoiceCapsuleListResponse)
async def get_voice_capsules(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
    return VoiceCapsuleListResponse(capsules=await list_voice_capsules(limit=limit, offset=offset))


@router.post("", response_model=VoiceCapsuleResponse)
async def post_voice_capsule(request: VoiceCapsuleCreate):
    return await create_voice_capsule(request)


@router.get("/casting/characters", response_model=list[VoiceCharacterResponse])
async def get_voice_characters():
    return await list_voice_characters()


@router.post("/casting/characters", response_model=VoiceCharacterResponse)
async def post_voice_character(request: VoiceCharacterCreate):
    return await create_voice_character(request)


@router.get("/casting/assignments", response_model=list[VoiceAssignmentResponse])
async def get_voice_assignments():
    return await list_voice_assignments()


@router.post("/casting/assignments", response_model=VoiceAssignmentResponse)
async def post_voice_assignment(request: VoiceAssignmentCreate):
    return await create_voice_assignment(request)


@router.get("/{capsule_id}", response_model=VoiceCapsuleResponse)
async def get_voice_capsule_route(capsule_id: str):
    return await get_voice_capsule(capsule_id)


@router.put("/{capsule_id}", response_model=VoiceCapsuleResponse)
async def put_voice_capsule(capsule_id: str, request: VoiceCapsuleUpdate):
    return await update_voice_capsule(capsule_id, request)


@router.post("/{capsule_id}/lock", response_model=VoiceCapsuleResponse)
async def post_lock_voice_capsule(capsule_id: str, notes: Optional[str] = None):
    return await lock_voice_capsule(capsule_id, notes=notes)


@router.post("/{capsule_id}/deprecate", response_model=VoiceCapsuleResponse)
async def post_deprecate_voice_capsule(capsule_id: str, notes: Optional[str] = None):
    return await deprecate_voice_capsule(capsule_id, notes=notes)
