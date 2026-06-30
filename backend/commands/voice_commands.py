from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel
from surreal_commands import command


class RenderReadingManifestInput(BaseModel):
    manifest_id: str
    segment_ids: Optional[list[str]] = None
    render_mode: str = "chapter"
    max_segments: int = 8
    force_provider: Optional[str] = None


class RegeneratePerformanceTakeInput(BaseModel):
    take_id: str
    force_provider: Optional[str] = None
    settings: Optional[dict[str, Any]] = None


@command("render_reading_manifest", app="open_notebook", retry={"enabled": False})
async def render_reading_manifest(input_data: RenderReadingManifestInput) -> dict[str, Any]:
    from api.voice_models import RenderManifestRequest
    from api.voice_service import render_reading_manifest as render_manifest

    result = await render_manifest(
        input_data.manifest_id,
        RenderManifestRequest(
            segmentIds=input_data.segment_ids,
            renderMode=input_data.render_mode,
            maxSegments=input_data.max_segments,
            forceProvider=input_data.force_provider,
        ),
    )
    return result.model_dump()


@command("regenerate_performance_take", app="open_notebook", retry={"enabled": False})
async def regenerate_performance_take(input_data: RegeneratePerformanceTakeInput) -> dict[str, Any]:
    from api.voice_service import regenerate_performance_take as regenerate_take

    result = await regenerate_take(
        input_data.take_id,
        force_provider=input_data.force_provider,
    )
    return result.model_dump()
