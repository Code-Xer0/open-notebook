

from typing import Any, Optional

from pydantic import BaseModel
from surreal_commands import command


class SourceProcessingInput(BaseModel):
    source_id: str
    content_state: dict[str, Any]
    notebook_ids: Optional[list[str]] = None
    transformations: Optional[list[str]] = None

SourceProcessingInput.model_rebuild()


class TransformationInput(BaseModel):
    source_id: str
    transformation_id: str
    input_data: dict[str, Any] | None = None


@command("process_source", app="open_notebook", retry={"enabled": False})
def process_source(input_data: dict[str, Any]) -> dict[str, Any]:
    raise RuntimeError(
        "Source processing command worker is not implemented in this local build. "
        "Use diagnostics before starting ingestion jobs."
    )


@command("run_transformation", app="open_notebook", retry={"enabled": False})
def run_transformation(input_data: dict[str, Any]) -> dict[str, Any]:
    raise RuntimeError(
        "Transformation command worker is not implemented in this local build. "
        "Use diagnostics before starting transformation jobs."
    )
