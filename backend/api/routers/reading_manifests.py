from fastapi import APIRouter

from api.voice_models import (
    ReadingManifestCreate,
    ReadingManifestResponse,
    RenderManifestRequest,
    RenderManifestResponse,
)
from api.voice_service import (
    create_reading_manifest,
    get_reading_manifest,
    list_reading_manifests,
    lock_reading_manifest,
    publish_reading_manifest,
    render_reading_manifest,
)

router = APIRouter(prefix="/reading-manifests", tags=["reading-manifests"])


@router.get("", response_model=list[ReadingManifestResponse])
async def get_reading_manifests():
    return await list_reading_manifests()


@router.post("", response_model=ReadingManifestResponse)
async def post_reading_manifest(request: ReadingManifestCreate):
    return await create_reading_manifest(request)


@router.get("/{manifest_id}", response_model=ReadingManifestResponse)
async def get_reading_manifest_route(manifest_id: str):
    return await get_reading_manifest(manifest_id)


@router.post("/{manifest_id}/lock", response_model=ReadingManifestResponse)
async def post_lock_reading_manifest(manifest_id: str):
    return await lock_reading_manifest(manifest_id)


@router.post("/{manifest_id}/render", response_model=RenderManifestResponse)
async def post_render_reading_manifest(manifest_id: str, request: RenderManifestRequest):
    return await render_reading_manifest(manifest_id, request)


@router.post("/{manifest_id}/publish", response_model=ReadingManifestResponse)
async def post_publish_reading_manifest(manifest_id: str):
    return await publish_reading_manifest(manifest_id)
