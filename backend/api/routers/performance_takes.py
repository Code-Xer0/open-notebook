from fastapi import APIRouter, Query
from fastapi.responses import FileResponse

from api.voice_models import PerformanceTakeResponse, TakeStatusUpdate
from api.voice_service import get_audio_asset_path, list_performance_takes, update_take_status

router = APIRouter(prefix="/performance-takes", tags=["performance-takes"])


@router.get("", response_model=list[PerformanceTakeResponse])
async def get_performance_takes(manifest_id: str | None = Query(None)):
    return await list_performance_takes(manifest_id=manifest_id)


@router.put("/{take_id}/status", response_model=PerformanceTakeResponse)
async def put_take_status(take_id: str, request: TakeStatusUpdate):
    return await update_take_status(take_id, request)


@router.get("/{take_id}/audio")
async def get_take_audio(take_id: str):
    path = await get_audio_asset_path(take_id)
    return FileResponse(path, media_type="audio/mpeg", filename=path.name)
