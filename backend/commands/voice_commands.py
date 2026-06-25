from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel
from surreal_commands import command


class RenderReadingManifestInput(BaseModel):
    manifest_id: str
    segment_ids: Optional[list[str]] = None
    force_provider: Optional[str] = None


class RegeneratePerformanceTakeInput(BaseModel):
    take_id: str
    force_provider: Optional[str] = None
    settings: Optional[dict[str, Any]] = None


@command("render_reading_manifest", app="open_notebook", retry={"enabled": False})
def render_reading_manifest(_: RenderReadingManifestInput) -> dict[str, Any]:
    raise RuntimeError(
        "Voice rendering command worker is not implemented in this local build. "
        "Use the synchronous reading-manifest render endpoint or diagnostics before starting queued voice jobs."
    )


@command("regenerate_performance_take", app="open_notebook", retry={"enabled": False})
def regenerate_performance_take(_: RegeneratePerformanceTakeInput) -> dict[str, Any]:
    raise RuntimeError(
        "Performance take regeneration worker is not implemented in this local build. "
        "Use diagnostics before starting queued voice jobs."
    )
