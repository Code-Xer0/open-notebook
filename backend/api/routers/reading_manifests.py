from fastapi import APIRouter

from api.voice_models import (
    ReadingManifestCreate,
    ReadingManifestResponse,
    RenderManifestJobResponse,
    RenderManifestRequest,
    RenderManifestResponse,
)
from api.command_service import CommandService
from api.voice_service import (
    create_reading_manifest,
    get_reading_manifest,
    list_reading_manifests,
    lock_reading_manifest,
    publish_reading_manifest,
    render_reading_manifest,
    validate_render_request,
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


@router.post("/{manifest_id}/render-jobs", response_model=RenderManifestJobResponse)
async def post_render_reading_manifest_job(manifest_id: str, request: RenderManifestRequest):
    accepted_segments = await validate_render_request(manifest_id, request)
    command_input = {
        "manifest_id": manifest_id,
        "segment_ids": accepted_segments,
        "render_mode": request.renderMode,
        "max_segments": request.maxSegments,
        "force_provider": request.forceProvider,
    }
    command_id = await CommandService.submit_command_job(
        "open_notebook",
        "render_reading_manifest",
        command_input,
    )
    from api.local_command_runner import schedule_local_command_job

    schedule_local_command_job(
        command_id,
        "open_notebook.render_reading_manifest",
        command_input,
    )
    return RenderManifestJobResponse(
        commandId=command_id,
        manifestId=manifest_id,
        acceptedSegmentIds=accepted_segments,
        status="submitted",
    )


@router.post("/{manifest_id}/publish", response_model=ReadingManifestResponse)
async def post_publish_reading_manifest(manifest_id: str):
    return await publish_reading_manifest(manifest_id)
