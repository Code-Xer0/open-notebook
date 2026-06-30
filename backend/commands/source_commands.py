

from typing import Any, Optional

from pydantic import BaseModel
from surreal_commands import command

from open_notebook.domain.notebook import Source
from open_notebook.domain.transformation import Transformation
from open_notebook.graphs.source import source_graph
from open_notebook.graphs.transformation import graph as transform_graph


class SourceProcessingInput(BaseModel):
    source_id: str
    content_state: dict[str, Any]
    notebook_ids: Optional[list[str]] = None
    transformations: Optional[list[str]] = None
    embed: bool = False

SourceProcessingInput.model_rebuild()


class TransformationInput(BaseModel):
    source_id: str
    transformation_id: str
    input_data: dict[str, Any] | None = None


@command("process_source", app="open_notebook", retry={"enabled": False})
async def process_source(input_data: SourceProcessingInput) -> dict[str, Any]:
    """Run the local source graph for an already-created source record."""
    transformations: list[Transformation] = []
    for transformation_id in input_data.transformations or []:
        transformation = await Transformation.get(transformation_id)
        if not transformation:
            raise RuntimeError(f"Transformation not found: {transformation_id}")
        transformations.append(transformation)

    # Embeddings remain a separate provider/worker-gated lane. A source should
    # still be stored even when the UI asked for embeddings before that lane is
    # proven available.
    embed_requested = bool(input_data.embed)
    result = await source_graph.ainvoke(
        {
            "content_state": input_data.content_state,
            "apply_transformations": transformations,
            "source_id": input_data.source_id,
            "notebook_ids": input_data.notebook_ids or [],
            "source": None,
            "transformation": [],
            "embed": False,
        }
    )

    source: Source | None = result.get("source") or await Source.get(input_data.source_id)
    full_text = source.full_text if source else None
    return {
        "status": "stored",
        "source_id": input_data.source_id,
        "title": source.title if source else None,
        "full_text_chars": len(full_text or ""),
        "transformations": result.get("transformation", []),
        "embedding": "blocked_worker_unavailable" if embed_requested else "not_requested",
    }


@command("run_transformation", app="open_notebook", retry={"enabled": False})
async def run_transformation(input_data: TransformationInput) -> dict[str, Any]:
    source = await Source.get(input_data.source_id)
    if not source:
        raise RuntimeError(f"Source not found: {input_data.source_id}")
    if not source.full_text:
        raise RuntimeError("Source has no stored text to transform.")

    transformation = await Transformation.get(input_data.transformation_id)
    if not transformation:
        raise RuntimeError(f"Transformation not found: {input_data.transformation_id}")

    text = (input_data.input_data or {}).get("input_text") or source.full_text
    result = await transform_graph.ainvoke(
        {"input_text": text, "transformation": transformation}
    )
    output = result.get("output", "")
    await source.add_insight(transformation.title, output)
    return {
        "status": "stored",
        "source_id": input_data.source_id,
        "transformation_id": input_data.transformation_id,
        "output_chars": len(output),
    }
