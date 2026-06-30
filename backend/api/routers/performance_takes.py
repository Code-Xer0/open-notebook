from fastapi import APIRouter, Query
from fastapi.responses import FileResponse

from api.command_service import CommandService
from api.local_command_runner import schedule_local_command_job
from api.voice_models import (
    PerformanceTakeResponse,
    RegeneratePerformanceTakeJobResponse,
    RegeneratePerformanceTakeRequest,
    TakeStatusUpdate,
)
from api.voice_service import (
    get_audio_asset_path,
    get_performance_take,
    list_performance_takes,
    update_take_status,
)

router = APIRouter(prefix="/performance-takes", tags=["performance-takes"])


@router.get("", response_model=list[PerformanceTakeResponse])
async def get_performance_takes(manifest_id: str | None = Query(None)):
    return await list_performance_takes(manifest_id=manifest_id)


@router.put("/{take_id}/status", response_model=PerformanceTakeResponse)
async def put_take_status(take_id: str, request: TakeStatusUpdate):
    return await update_take_status(take_id, request)


@router.post("/{take_id}/regenerate", response_model=RegeneratePerformanceTakeJobResponse)
async def post_regenerate_take(take_id: str, request: RegeneratePerformanceTakeRequest):
    take = await get_performance_take(take_id)
    command_input = {
        "take_id": take_id,
        "force_provider": request.forceProvider,
        "settings": request.settings,
    }
    command_id = await CommandService.submit_command_job(
        "open_notebook",
        "regenerate_performance_take",
        command_input,
    )
    schedule_local_command_job(
        command_id,
        "open_notebook.regenerate_performance_take",
        command_input,
    )
    return RegeneratePerformanceTakeJobResponse(
        commandId=command_id,
        takeId=take_id,
        manifestId=take.readingManifestId,
        segmentId=take.segmentId,
        status="submitted",
    )


@router.get("/{take_id}/audio")
async def get_take_audio(take_id: str):
    path = await get_audio_asset_path(take_id)
    return FileResponse(path, media_type="audio/mpeg", filename=path.name)
