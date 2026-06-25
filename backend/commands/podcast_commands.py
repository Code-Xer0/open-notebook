from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel
from surreal_commands import command


class GeneratePodcastInput(BaseModel):
    episode_name: Optional[str] = None
    notebook_id: Optional[str] = None
    profile_id: Optional[str] = None
    speaker_profile_ids: Optional[list[str]] = None
    config: Optional[dict[str, Any]] = None


@command("generate_podcast", app="open_notebook", retry={"enabled": False})
def generate_podcast(_: GeneratePodcastInput) -> dict[str, Any]:
    raise RuntimeError(
        "Podcast generation command worker is not implemented in this local build. "
        "Use diagnostics before starting podcast jobs."
    )
