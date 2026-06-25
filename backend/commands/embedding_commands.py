from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel
from surreal_commands import command


class EmbedSourceInput(BaseModel):
    source_id: str


class EmbedNoteInput(BaseModel):
    note_id: str


class RebuildEmbeddingsInput(BaseModel):
    mode: Literal["existing", "all"] = "existing"
    include_sources: bool = True
    include_notes: bool = True
    include_insights: bool = True
    batch_size: Optional[int] = None


@command("embed_source", app="open_notebook", retry={"enabled": False})
def embed_source(_: EmbedSourceInput) -> dict[str, Any]:
    raise RuntimeError(
        "Embedding source command worker is not implemented in this local build. "
        "Use diagnostics before starting embedding jobs."
    )


@command("embed_note", app="open_notebook", retry={"enabled": False})
def embed_note(_: EmbedNoteInput) -> dict[str, Any]:
    raise RuntimeError(
        "Embedding note command worker is not implemented in this local build. "
        "Use diagnostics before starting embedding jobs."
    )


@command("rebuild_embeddings", app="open_notebook", retry={"enabled": False})
def rebuild_embeddings(_: RebuildEmbeddingsInput) -> dict[str, Any]:
    raise RuntimeError(
        "Embedding rebuild command worker is not implemented in this local build. "
        "Use diagnostics before starting rebuild jobs."
    )
