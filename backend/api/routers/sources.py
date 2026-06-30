import asyncio
import os
from pathlib import Path
from typing import Any, List, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
)
from fastapi.responses import FileResponse, Response
from loguru import logger
from pydantic import BaseModel
from surreal_commands import submit_command
from surreal_commands.core.service import command_service as surreal_command_service

from api.command_service import CommandService
from api.evidence_service import create_derivative, preserve_file, preserve_text_source, safe_record_event
from api.models import (
    AssetModel,
    CreateSourceInsightRequest,
    InsightCreationResponse,
    SourceCreate,
    SourceInsightResponse,
    SourceListResponse,
    SourceResponse,
    SourceStatusResponse,
    SourceUpdate,
)
try:
    from commands.source_commands import SourceProcessingInput
except ModuleNotFoundError:
    class SourceProcessingInput(BaseModel):
        source_id: str
        content_state: dict[str, Any]
        notebook_ids: Optional[List[str]] = None
        transformations: Optional[List[str]] = None
        embed: bool = True

from open_notebook.config import UPLOADS_FOLDER
from open_notebook.database.repository import ensure_record_id, repo_query
from open_notebook.domain.notebook import Asset, Notebook, Source
from open_notebook.domain.transformation import Transformation
from open_notebook.exceptions import InvalidInputError

router = APIRouter()


def generate_unique_filename(original_filename: str, upload_folder: str) -> str:
    """Generate unique filename like Streamlit app (append counter if file exists)."""
    file_path = Path(upload_folder)
    file_path.mkdir(parents=True, exist_ok=True)

    # Strip directory components to prevent path traversal
    safe_filename = os.path.basename(original_filename)
    if not safe_filename:
        raise ValueError("Invalid filename")

    # Split filename and extension
    stem = Path(safe_filename).stem
    suffix = Path(safe_filename).suffix

    # Check if file exists and generate unique name
    counter = 0
    while True:
        if counter == 0:
            new_filename = safe_filename
        else:
            new_filename = f"{stem} ({counter}){suffix}"

        full_path = file_path / new_filename
        # Verify resolved path stays within upload folder
        resolved = full_path.resolve()
        if not str(resolved).startswith(str(file_path.resolve()) + os.sep):
            raise ValueError("Invalid filename: path traversal detected")
        if not resolved.exists():
            return str(resolved)
        counter += 1


async def save_uploaded_file(upload_file: UploadFile) -> str:
    """Save uploaded file to uploads folder and return file path."""
    if not upload_file.filename:
        raise ValueError("No filename provided")

    # Generate unique filename
    file_path = generate_unique_filename(upload_file.filename, UPLOADS_FOLDER)

    try:
        # Save file
        with open(file_path, "wb") as f:
            content = await upload_file.read()
            f.write(content)

        logger.info(f"Saved uploaded file to: {file_path}")
        return file_path
    except Exception as e:
        logger.error(f"Failed to save uploaded file: {e}")
        # Clean up partial file if it exists
        if os.path.exists(file_path):
            os.unlink(file_path)
        raise


def parse_source_form_data(
    type: str = Form(...),
    notebook_id: Optional[str] = Form(None),
    notebooks: Optional[str] = Form(None),  # JSON string of notebook IDs
    url: Optional[str] = Form(None),
    content: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    transformations: Optional[str] = Form(None),  # JSON string of transformation IDs
    embed: str = Form("false"),  # Accept as string, convert to bool
    delete_source: str = Form("false"),  # Accept as string, convert to bool
    async_processing: str = Form("false"),  # Accept as string, convert to bool
    file: Optional[UploadFile] = File(None),
) -> tuple[SourceCreate, Optional[UploadFile]]:
    """Parse form data into SourceCreate model and return upload file separately."""
    import json

    # Convert string booleans to actual booleans
    def str_to_bool(value: str) -> bool:
        return value.lower() in ("true", "1", "yes", "on")

    embed_bool = str_to_bool(embed)
    delete_source_bool = str_to_bool(delete_source)
    async_processing_bool = str_to_bool(async_processing)

    # Parse JSON strings
    notebooks_list = None
    if notebooks:
        try:
            notebooks_list = json.loads(notebooks)
            if isinstance(notebooks_list, str):
                notebooks_list = [notebooks_list]
            elif not isinstance(notebooks_list, list):
                raise HTTPException(
                    status_code=422,
                    detail="notebooks must be a JSON array of notebook IDs",
                )
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON in notebooks field: {notebooks}")
            raise HTTPException(
                status_code=422,
                detail="notebooks must be a JSON array of notebook IDs",
            )

    transformations_list = []
    if transformations:
        try:
            transformations_list = json.loads(transformations)
            if not isinstance(transformations_list, list):
                raise HTTPException(
                    status_code=422,
                    detail="transformations must be a JSON array of transformation IDs",
                )
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON in transformations field: {transformations}")
            raise HTTPException(
                status_code=422,
                detail="transformations must be a JSON array of transformation IDs",
            )

    # Create SourceCreate instance
    try:
        source_data = SourceCreate(
            type=type,
            notebook_id=notebook_id,
            notebooks=notebooks_list,
            url=url,
            content=content,
            title=title,
            file_path=None,  # Will be set later if file is uploaded
            transformations=transformations_list,
            embed=embed_bool,
            delete_source=delete_source_bool,
            async_processing=async_processing_bool,
        )
        pass  # SourceCreate instance created successfully
    except Exception as e:
        logger.error(f"Failed to create SourceCreate instance: {e}")
        raise HTTPException(status_code=422, detail=str(e)) from e

    return source_data, file


PLAIN_TEXT_UPLOAD_EXTENSIONS = {".txt", ".md", ".markdown", ".csv"}


def _is_plain_text_upload(path: Optional[str]) -> bool:
    if not path:
        return False
    return Path(path).suffix.lower() in PLAIN_TEXT_UPLOAD_EXTENSIONS


def _read_plain_text_upload(path: str) -> str:
    upload_path = Path(path)
    try:
        return upload_path.read_text(encoding="utf-8-sig")
    except UnicodeDecodeError:
        return upload_path.read_text(encoding="utf-8", errors="replace")


def _source_evidence_fields(asset: Any = None, status: Optional[str] = None) -> dict[str, Any]:
    if not asset:
        return {"evidenceStatus": status or "not_verified"}
    return {
        "evidenceAssetId": getattr(asset, "id", None),
        "sha256": getattr(asset, "sha256", None),
        "evidenceStatus": getattr(asset, "status", None) or status or "stored",
        "duplicateAssetIds": getattr(asset, "duplicateAssetIds", None) or [],
    }


async def _latest_source_evidence(source_id: str) -> dict[str, Any]:
    try:
        rows = await repo_query(
            "SELECT id, sha256, status FROM file_asset WHERE source = $source ORDER BY created DESC LIMIT 1",
            {"source": ensure_record_id(source_id)},
        )
        if not rows:
            return {}
        row = rows[0]
        return {
            "evidenceAssetId": str(row.get("id")) if row.get("id") else None,
            "sha256": row.get("sha256"),
            "evidenceStatus": row.get("status") or "stored",
        }
    except Exception as exc:
        logger.debug(f"Failed to read source evidence for {source_id}: {exc}")
        return {"evidenceStatus": "not_verified"}


async def _record_text_source_evidence(
    source: Source,
    *,
    title: str,
    content: str,
    origin_kind: str = "text_entry",
    provenance: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    try:
        asset = await preserve_text_source(
            content,
            title=title,
            source_id=str(source.id),
            origin_kind=origin_kind,
            provenance=provenance,
        )
        return _source_evidence_fields(asset)
    except Exception as exc:
        logger.warning(f"Failed to preserve text source evidence for {source.id}: {exc}")
        await safe_record_event(
            "file_asset.failed",
            status="failed",
            source_id=str(source.id) if source.id else None,
            subject_table="source",
            subject_id=str(source.id) if source.id else None,
            payload={"originKind": origin_kind, "error": str(exc)},
        )
        return {"evidenceStatus": "failed"}


async def _record_file_source_evidence(
    source: Source,
    *,
    file_path: str,
    origin_kind: str,
    source_filename: Optional[str] = None,
    full_text: Optional[str] = None,
    provenance: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    try:
        asset = await preserve_file(
            file_path,
            origin_kind=origin_kind,
            source_filename=source_filename,
            source_id=str(source.id),
            provenance=provenance,
        )
        if full_text:
            suffix = Path(file_path).suffix.lower()
            derivative_type = "canonical_markdown" if suffix in {".md", ".markdown"} else "canonical_text"
            await create_derivative(
                derivative_type=derivative_type,
                content=full_text,
                asset_id=asset.id,
                source_id=str(source.id),
                provenance={"source": "source.full_text", "parser": provenance or {}},
            )
        return _source_evidence_fields(asset)
    except Exception as exc:
        logger.warning(f"Failed to preserve file source evidence for {source.id}: {exc}")
        await safe_record_event(
            "file_asset.failed",
            status="failed",
            source_id=str(source.id) if source.id else None,
            subject_table="source",
            subject_id=str(source.id) if source.id else None,
            payload={"originKind": origin_kind, "filePath": file_path, "error": str(exc)},
        )
        return {"evidenceStatus": "failed"}


async def _execute_local_command_job(
    command_id: str,
    command_name: str,
    command_args: dict[str, Any],
) -> None:
    """Execute a surreal-command row inside the API process.

    The packaged app does not currently launch a separate command worker
    sidecar. Running the registered command locally keeps command status rows
    factual without waiting on a nonexistent external worker.
    """
    try:
        await surreal_command_service.execute_command(
            str(command_id),
            command_name,
            command_args,
        )
        if command_name == "open_notebook.process_source":
            await _finalize_process_source_command(command_id, command_args)
    except Exception as exc:
        logger.error(f"Local command execution failed for {command_id}: {exc}")
        try:
            await surreal_command_service.update_command_result(
                str(command_id),
                "failed",
                {},
                str(exc),
            )
        except Exception:
            pass
        raise


async def _finalize_process_source_command(
    command_id: str,
    command_args: dict[str, Any],
) -> None:
    source_id = command_args.get("source_id")
    if not source_id:
        return

    source = await Source.get(str(source_id))
    if not source or not source.full_text:
        return

    try:
        command_status = await CommandService.get_command_status(str(command_id))
    except Exception:
        command_status = {"status": "unknown"}

    if command_status.get("status") not in {"completed", "failed", "canceled"}:
        await surreal_command_service.update_command_result(
            str(command_id),
            "completed",
            {
                "status": "stored",
                "source_id": str(source_id),
                "title": source.title,
                "full_text_chars": len(source.full_text or ""),
                "embedding": "not_requested",
            },
        )


def _schedule_local_command_job(
    command_id: str,
    command_name: str,
    command_args: dict[str, Any],
) -> None:
    task = asyncio.create_task(
        _execute_local_command_job(command_id, command_name, command_args)
    )
    task.add_done_callback(
        lambda completed: logger.error(
            f"Local command task crashed for {command_id}: {completed.exception()}"
        )
        if completed.exception()
        else None
    )


@router.get("/sources/status")
async def get_global_sources_status():
    """Get global status of all sources for telemetry."""
    try:
        from api.command_registry import command_registry_status_async
        from open_notebook.database.repository import repo_query
        # Basic aggregate counts
        sources_res = await repo_query("SELECT id FROM source")
        connected = len(sources_res) if sources_res else 0
        workers = (await command_registry_status_async()).get("workerAvailability", {})
        return {
            "status": "reachable",
            "connected": connected,
            "failed": "Unknown",
            "pending": "Unknown",
            "sourceWorker": workers.get("source", {"status": "unknown"}),
            "embeddingWorker": workers.get("embedding", {"status": "unknown"}),
        }
    except Exception as e:
        logger.error(f"Error fetching global source status: {e}")
        return {
            "status": "error",
            "connected": 0,
            "failed": "Unknown",
            "pending": "Unknown",
        }


@router.get("/sources", response_model=List[SourceListResponse])
async def get_sources(
    notebook_id: Optional[str] = Query(None, description="Filter by notebook ID"),
    limit: int = Query(
        50, ge=1, le=100, description="Number of sources to return (1-100)"
    ),
    offset: int = Query(0, ge=0, description="Number of sources to skip"),
    sort_by: str = Query(
        "updated", description="Field to sort by (created or updated)"
    ),
    sort_order: str = Query("desc", description="Sort order (asc or desc)"),
):
    """Get sources with pagination and sorting support."""
    try:
        # Validate sort parameters
        if sort_by not in ["created", "updated"]:
            raise HTTPException(
                status_code=400, detail="sort_by must be 'created' or 'updated'"
            )
        if sort_order.lower() not in ["asc", "desc"]:
            raise HTTPException(
                status_code=400, detail="sort_order must be 'asc' or 'desc'"
            )

        # Build ORDER BY clause
        order_clause = f"ORDER BY {sort_by} {sort_order.upper()}"

        # Build the query
        if notebook_id:
            # Verify notebook exists first
            notebook = await Notebook.get(notebook_id)
            if not notebook:
                raise HTTPException(status_code=404, detail="Notebook not found")

            # Query sources for specific notebook - include command field with FETCH
            query = f"""
                SELECT id, asset, created, title, updated, topics, command,
                (SELECT VALUE count() FROM source_insight WHERE source = $parent.id GROUP ALL)[0].count OR 0 AS insights_count,
                (SELECT VALUE id FROM source_embedding WHERE source = $parent.id LIMIT 1) != [] AS embedded
                FROM (select value in from reference where out=$notebook_id)
                {order_clause}
                LIMIT $limit START $offset
                FETCH command
            """
            result = await repo_query(
                query,
                {
                    "notebook_id": ensure_record_id(notebook_id),
                    "limit": limit,
                    "offset": offset,
                },
            )
        else:
            # Query all sources - include command field with FETCH
            query = f"""
                SELECT id, asset, created, title, updated, topics, command,
                (SELECT VALUE count() FROM source_insight WHERE source = $parent.id GROUP ALL)[0].count OR 0 AS insights_count,
                (SELECT VALUE id FROM source_embedding WHERE source = $parent.id LIMIT 1) != [] AS embedded
                FROM source
                {order_clause}
                LIMIT $limit START $offset
                FETCH command
            """
            result = await repo_query(query, {"limit": limit, "offset": offset})

        # Convert result to response model
        # Command data is already fetched via FETCH command clause
        response_list = []
        for row in result:
            command = row.get("command")
            command_id = None
            status = None
            processing_info = None

            # Extract status from fetched command object (already resolved by FETCH)
            if command and isinstance(command, dict):
                command_id = str(command.get("id")) if command.get("id") else None
                status = command.get("status")
                # Extract execution metadata from nested result structure
                result_data = command.get("result")
                execution_metadata = (
                    result_data.get("execution_metadata", {})
                    if isinstance(result_data, dict)
                    else {}
                )
                processing_info = {
                    "started_at": execution_metadata.get("started_at"),
                    "completed_at": execution_metadata.get("completed_at"),
                    "error": command.get("error_message"),
                }
            elif command:
                # Command exists but FETCH failed to resolve it (broken reference)
                command_id = str(command)
                status = "unknown"

            evidence_fields = await _latest_source_evidence(str(row["id"]))
            response_list.append(
                SourceListResponse(
                    id=row["id"],
                    title=row.get("title"),
                    topics=row.get("topics") or [],
                    asset=AssetModel(
                        file_path=row["asset"].get("file_path")
                        if row.get("asset")
                        else None,
                        url=row["asset"].get("url") if row.get("asset") else None,
                    )
                    if row.get("asset")
                    else None,
                    embedded=row.get("embedded", False),
                    embedded_chunks=0,  # Not needed in list view
                    insights_count=row.get("insights_count", 0),
                    created=str(row["created"]),
                    updated=str(row["updated"]),
                    # Status fields from fetched command
                    command_id=command_id,
                    status=status,
                    processing_info=processing_info,
                    **evidence_fields,
                )
            )

        return response_list
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching sources: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching sources: {str(e)}")


@router.post("/sources", response_model=SourceResponse)
async def create_source(
    form_data: tuple[SourceCreate, Optional[UploadFile]] = Depends(
        parse_source_form_data
    ),
):
    """Create a new source with support for both JSON and multipart form data."""
    source_data, upload_file = form_data

    # Initialize file_path before try block so exception handlers can reference it
    file_path = None

    try:
        # Verify all specified notebooks exist (backward compatibility support)
        for notebook_id in source_data.notebooks or []:
            notebook = await Notebook.get(notebook_id)
            if not notebook:
                raise HTTPException(
                    status_code=404, detail=f"Notebook {notebook_id} not found"
                )

        # Handle file upload if provided
        if upload_file and source_data.type == "upload":
            try:
                file_path = await save_uploaded_file(upload_file)
            except Exception as e:
                logger.error(f"File upload failed: {e}")
                raise HTTPException(
                    status_code=400, detail=f"File upload failed: {str(e)}"
                )

        # Prepare content_state for processing
        content_state: dict[str, Any] = {}

        if source_data.type == "link":
            if not source_data.url:
                raise HTTPException(
                    status_code=400, detail="URL is required for link type"
                )
            content_state["url"] = source_data.url
        elif source_data.type == "upload":
            # Use uploaded file path or provided file_path (backward compatibility)
            final_file_path = file_path or source_data.file_path
            if not final_file_path:
                raise HTTPException(
                    status_code=400,
                    detail="File upload or file_path is required for upload type",
                )
            # Validate file_path is within the uploads directory to prevent LFI
            uploads_resolved = Path(UPLOADS_FOLDER).resolve()
            file_resolved = Path(final_file_path).resolve()
            if not str(file_resolved).startswith(str(uploads_resolved) + os.sep):
                raise HTTPException(
                    status_code=400,
                    detail="Invalid file path: must be within the uploads directory",
                )
            content_state["file_path"] = final_file_path
            content_state["delete_source"] = source_data.delete_source
        elif source_data.type == "text":
            if not source_data.content:
                raise HTTPException(
                    status_code=400, detail="Content is required for text type"
                )
            content_state["content"] = source_data.content
        else:
            raise HTTPException(
                status_code=400,
                detail="Invalid source type. Must be link, upload, or text",
            )

        # Validate transformations exist
        transformation_ids = source_data.transformations or []
        for trans_id in transformation_ids:
            transformation = await Transformation.get(trans_id)
            if not transformation:
                raise HTTPException(
                    status_code=404, detail=f"Transformation {trans_id} not found"
                )

        if source_data.type == "text" and not transformation_ids:
            source = Source(
                title=source_data.title or "Text source",
                topics=[],
                full_text=source_data.content,
            )
            await source.save()

            for notebook_id in source_data.notebooks or []:
                await source.add_to_notebook(notebook_id)

            evidence_fields = await _record_text_source_evidence(
                source,
                title=source.title or source_data.title or "Text source",
                content=source.full_text or source_data.content,
                origin_kind="text_entry",
                provenance={"sourceType": "text", "parser": "plain_text"},
            )

            return SourceResponse(
                id=source.id or "",
                title=source.title,
                topics=source.topics or [],
                asset=None,
                full_text=source.full_text,
                embedded=False,
                embedded_chunks=0,
                created=str(source.created),
                updated=str(source.updated),
                status="stored",
                processing_info={
                    "async": False,
                    "stored": True,
                    "parser": "plain_text",
                    "embedding": "blocked_worker_unavailable"
                    if source_data.embed
                    else "not_requested",
                },
                **evidence_fields,
            )

        if (
            source_data.type == "upload"
            and not transformation_ids
            and _is_plain_text_upload(file_path or source_data.file_path)
        ):
            final_file_path = file_path or source_data.file_path
            if not final_file_path:
                raise HTTPException(
                    status_code=400,
                    detail="File upload or file_path is required for upload type",
                )
            source_title = (
                source_data.title
                or (upload_file.filename if upload_file and upload_file.filename else None)
                or Path(final_file_path).name
            )
            full_text = _read_plain_text_upload(final_file_path)
            source = Source(
                title=source_title,
                topics=[],
                asset=Asset(file_path=final_file_path),
                full_text=full_text,
            )
            await source.save()

            for notebook_id in source_data.notebooks or []:
                await source.add_to_notebook(notebook_id)

            evidence_fields = await _record_file_source_evidence(
                source,
                file_path=final_file_path,
                origin_kind="upload",
                source_filename=source_title,
                full_text=source.full_text,
                provenance={"sourceType": "upload", "parser": "plain_text_upload"},
            )

            return SourceResponse(
                id=source.id or "",
                title=source.title,
                topics=source.topics or [],
                asset=AssetModel(file_path=final_file_path, url=None),
                full_text=source.full_text,
                embedded=False,
                embedded_chunks=0,
                created=str(source.created),
                updated=str(source.updated),
                status="stored",
                processing_info={
                    "async": False,
                    "stored": True,
                    "parser": "plain_text_upload",
                    "embedding": "blocked_worker_unavailable"
                    if source_data.embed
                    else "not_requested",
                },
                **evidence_fields,
            )

        # Branch based on processing mode
        if source_data.async_processing:
            # ASYNC PATH: Create source record first, then queue command
            logger.info("Using async processing path")

            # Create source record with asset - let SurrealDB generate the ID
            # Persist asset before save so it's available for retry if processing fails
            if source_data.type == "link":
                source_asset = Asset(url=source_data.url)
            elif source_data.type == "upload":
                source_asset = Asset(file_path=file_path or source_data.file_path)
            else:
                source_asset = None

            source_title = source_data.title or (upload_file.filename if upload_file and upload_file.filename else None) or "Stored upload pending processing"
            source = Source(
                title=source_title,
                topics=[],
                asset=source_asset,
            )
            await source.save()

            # Add source to notebooks immediately so it appears in the UI
            # The source_graph will skip adding duplicates
            for notebook_id in source_data.notebooks or []:
                await source.add_to_notebook(notebook_id)

            evidence_fields: dict[str, Any] = {"evidenceStatus": "not_verified"}
            if source_data.type == "upload" and source_asset and source_asset.file_path:
                evidence_fields = await _record_file_source_evidence(
                    source,
                    file_path=source_asset.file_path,
                    origin_kind="upload",
                    source_filename=source_title,
                    provenance={"sourceType": "upload", "processing": "queued"},
                )
            elif source_data.type == "text" and source_data.content:
                evidence_fields = await _record_text_source_evidence(
                    source,
                    title=source_title,
                    content=source_data.content,
                    origin_kind="text_entry",
                    provenance={"sourceType": "text", "processing": "queued"},
                )
            elif source_data.type == "link":
                await safe_record_event(
                    "source.link.submitted",
                    status="not_verified",
                    source_id=str(source.id),
                    subject_table="source",
                    subject_id=str(source.id),
                    payload={"url": source_data.url, "processing": "queued"},
                )

            try:
                # Import command modules to ensure they're registered
                import commands.source_commands  # noqa: F401

                # Submit command for background processing
                command_input = SourceProcessingInput(
                    source_id=str(source.id),
                    content_state=content_state,
                    notebook_ids=source_data.notebooks,
                    transformations=transformation_ids,
                    embed=source_data.embed,
                )

                command_id = await CommandService.submit_command_job(
                    "open_notebook",  # app name
                    "process_source",  # command name
                    command_input.model_dump(),
                )

                logger.info(f"Submitted async processing command: {command_id}")

                # Update source with command reference immediately
                # command_id already includes 'command:' prefix
                source.command = ensure_record_id(command_id)
                await source.save()
                _schedule_local_command_job(
                    command_id,
                    "open_notebook.process_source",
                    command_input.model_dump(),
                )

                # Return source with command info
                return SourceResponse(
                    id=source.id or "",
                    title=source.title,
                    topics=source.topics or [],
                    asset=AssetModel(
                        file_path=source_asset.file_path if source_asset else None,
                        url=source_asset.url if source_asset else None,
                    )
                    if source_asset
                    else None,
                    full_text=None,  # Will be populated after processing
                    embedded=False,  # Will be updated after processing
                    embedded_chunks=0,
                    created=str(source.created),
                    updated=str(source.updated),
                    command_id=command_id,
                    status="queued",
                    processing_info={
                        "async": True,
                        "queued": True,
                        "worker": "local_api_task",
                        "embedding": "blocked_worker_unavailable"
                        if source_data.embed
                        else "not_requested",
                    },
                    **evidence_fields,
                )

            except Exception as e:
                logger.error(f"Failed to submit async processing command: {e}")
                # Clean up source record on command submission failure
                try:
                    await source.delete()
                except Exception:
                    pass
                # Clean up uploaded file if we created it
                if file_path and upload_file:
                    try:
                        os.unlink(file_path)
                    except Exception:
                        pass
                raise HTTPException(
                    status_code=500, detail=f"Failed to queue processing: {str(e)}"
                )

        else:
            # SYNC PATH: Execute synchronously using execute_command_sync
            logger.info("Using sync processing path")

            try:
                # Import command modules to ensure they're registered
                import commands.source_commands  # noqa: F401

                # Create source record - let SurrealDB generate the ID
                source_title = source_data.title or (upload_file.filename if upload_file and upload_file.filename else None) or "Stored upload pending processing"
                source = Source(
                    title=source_title,
                    topics=[],
                )
                await source.save()

                # Add source to notebooks immediately so it appears in the UI
                # The source_graph will skip adding duplicates
                for notebook_id in source_data.notebooks or []:
                    await source.add_to_notebook(notebook_id)

                # Execute command synchronously inside this API process.
                command_input = SourceProcessingInput(
                    source_id=str(source.id),
                    content_state=content_state,
                    notebook_ids=source_data.notebooks,
                    transformations=transformation_ids,
                    embed=source_data.embed,
                )

                command_id = await CommandService.submit_command_job(
                    "open_notebook",
                    "process_source",
                    command_input.model_dump(),
                )
                source.command = ensure_record_id(command_id)
                await source.save()
                await _execute_local_command_job(
                    command_id,
                    "open_notebook.process_source",
                    command_input.model_dump(),
                )

                command_status = await CommandService.get_command_status(command_id)
                if command_status.get("status") == "failed":
                    error_message = command_status.get("error_message") or "Unknown processing error"
                    logger.error(f"Sync processing failed: {error_message}")
                    # Clean up source record
                    try:
                        await source.delete()
                    except Exception:
                        pass
                    # Clean up uploaded file if we created it
                    if file_path and upload_file:
                        try:
                            os.unlink(file_path)
                        except Exception:
                            pass
                    raise HTTPException(
                        status_code=500,
                        detail=f"Processing failed: {error_message}",
                    )

                # Get the processed source
                if not source.id:
                    raise HTTPException(status_code=500, detail="Source ID is missing")
                processed_source = await Source.get(source.id)
                if not processed_source:
                    raise HTTPException(
                        status_code=500, detail="Processed source not found"
                    )

                evidence_fields = {"evidenceStatus": "not_verified"}
                if processed_source.asset and processed_source.asset.file_path:
                    evidence_fields = await _record_file_source_evidence(
                        processed_source,
                        file_path=processed_source.asset.file_path,
                        origin_kind="upload",
                        source_filename=processed_source.title,
                        full_text=processed_source.full_text,
                        provenance={"sourceType": "upload", "processing": "sync"},
                    )
                elif source_data.type == "text" and processed_source.full_text:
                    evidence_fields = await _record_text_source_evidence(
                        processed_source,
                        title=processed_source.title or source_data.title or "Text source",
                        content=processed_source.full_text,
                        origin_kind="text_entry",
                        provenance={"sourceType": "text", "processing": "sync"},
                    )
                elif source_data.type == "link":
                    await safe_record_event(
                        "source.link.processed",
                        status="stored",
                        source_id=str(processed_source.id),
                        subject_table="source",
                        subject_id=str(processed_source.id),
                        payload={"url": source_data.url, "processing": "sync"},
                    )

                embedded_chunks = await processed_source.get_embedded_chunks()
                return SourceResponse(
                    id=processed_source.id or "",
                    title=processed_source.title,
                    topics=processed_source.topics or [],
                    asset=AssetModel(
                        file_path=processed_source.asset.file_path
                        if processed_source.asset
                        else None,
                        url=processed_source.asset.url
                        if processed_source.asset
                        else None,
                    )
                    if processed_source.asset
                    else None,
                    full_text=processed_source.full_text,
                    embedded=embedded_chunks > 0,
                    embedded_chunks=embedded_chunks,
                    created=str(processed_source.created),
                    updated=str(processed_source.updated),
                    command_id=command_id,
                    status="stored",
                    processing_info={
                        "async": False,
                        "stored": True,
                        "worker": "local_api_process",
                        "command_status": command_status.get("status"),
                        "embedding": "blocked_worker_unavailable"
                        if source_data.embed
                        else "not_requested",
                    },
                    **evidence_fields,
                )

            except Exception as e:
                logger.error(f"Sync processing failed: {e}")
                # Clean up uploaded file if we created it
                if file_path and upload_file:
                    try:
                        os.unlink(file_path)
                    except Exception:
                        pass
                raise

    except HTTPException:
        # Clean up uploaded file on HTTP exceptions if we created it
        if file_path and upload_file:
            try:
                os.unlink(file_path)
            except Exception:
                pass
        raise
    except InvalidInputError as e:
        # Clean up uploaded file on validation errors if we created it
        if file_path and upload_file:
            try:
                os.unlink(file_path)
            except Exception:
                pass
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating source: {str(e)}")
        # Clean up uploaded file on unexpected errors if we created it
        if file_path and upload_file:
            try:
                os.unlink(file_path)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"Error creating source: {str(e)}")


@router.post("/sources/json", response_model=SourceResponse)
async def create_source_json(source_data: SourceCreate):
    """Create a new source using JSON payload (legacy endpoint for backward compatibility)."""
    # Convert to form data format and call main endpoint
    form_data = (source_data, None)
    return await create_source(form_data)


async def _resolve_source_file(source_id: str) -> tuple[str, str]:
    source = await Source.get(source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    file_path = source.asset.file_path if source.asset else None
    if not file_path:
        raise HTTPException(status_code=404, detail="Source has no file to download")

    safe_root = os.path.realpath(UPLOADS_FOLDER)
    resolved_path = os.path.realpath(file_path)

    if not resolved_path.startswith(safe_root):
        logger.warning(
            f"Blocked download outside uploads directory for source {source_id}: {resolved_path}"
        )
        raise HTTPException(status_code=403, detail="Access to file denied")

    if not os.path.exists(resolved_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    filename = os.path.basename(resolved_path)
    return resolved_path, filename


def _is_source_file_available(source: Source) -> Optional[bool]:
    if not source or not source.asset or not source.asset.file_path:
        return None

    file_path = source.asset.file_path
    safe_root = os.path.realpath(UPLOADS_FOLDER)
    resolved_path = os.path.realpath(file_path)

    if not resolved_path.startswith(safe_root):
        return False

    return os.path.exists(resolved_path)


@router.get("/sources/{source_id}", response_model=SourceResponse)
async def get_source(source_id: str):
    """Get a specific source by ID."""
    try:
        source = await Source.get(source_id)
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")

        # Get status information if command exists
        status = None
        processing_info = None
        if source.command:
            try:
                status = await source.get_status()
                processing_info = await source.get_processing_progress()
            except Exception as e:
                logger.warning(f"Failed to get status for source {source_id}: {e}")
                status = "unknown"

        embedded_chunks = await source.get_embedded_chunks()

        # Get associated notebooks
        notebooks_query = await repo_query(
            "SELECT VALUE out FROM reference WHERE in = $source_id",
            {"source_id": ensure_record_id(source.id or source_id)},
        )
        notebook_ids = (
            [str(nb_id) for nb_id in notebooks_query] if notebooks_query else []
        )
        evidence_fields = await _latest_source_evidence(source.id or source_id)

        return SourceResponse(
            id=source.id or "",
            title=source.title,
            topics=source.topics or [],
            asset=AssetModel(
                file_path=source.asset.file_path if source.asset else None,
                url=source.asset.url if source.asset else None,
            )
            if source.asset
            else None,
            full_text=source.full_text,
            embedded=embedded_chunks > 0,
            embedded_chunks=embedded_chunks,
            file_available=_is_source_file_available(source),
            created=str(source.created),
            updated=str(source.updated),
            # Status fields
            command_id=str(source.command) if source.command else None,
            status=status,
            processing_info=processing_info,
            # Notebook associations
            notebooks=notebook_ids,
            **evidence_fields,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching source {source_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching source: {str(e)}")


@router.head("/sources/{source_id}/download")
async def check_source_file(source_id: str):
    """Check if a source has a downloadable file."""
    try:
        await _resolve_source_file(source_id)
        return Response(status_code=200)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking file for source {source_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to verify file")


@router.get("/sources/{source_id}/download")
async def download_source_file(source_id: str):
    """Download the original file associated with an uploaded source."""
    try:
        resolved_path, filename = await _resolve_source_file(source_id)
        return FileResponse(
            path=resolved_path,
            filename=filename,
            media_type="application/octet-stream",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading file for source {source_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to download source file")


@router.get("/sources/{source_id}/status", response_model=SourceStatusResponse)
async def get_source_status(source_id: str):
    """Get processing status for a source."""
    try:
        # First, verify source exists
        source = await Source.get(source_id)
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")

        # Check if this is a legacy source (no command)
        if not source.command:
            return SourceStatusResponse(
                status=None,
                message="Legacy source (completed before async processing)",
                processing_info=None,
                command_id=None,
            )

        # Get command status and processing info
        try:
            status = await source.get_status()
            processing_info = await source.get_processing_progress()

            # Generate descriptive message based on status
            if status == "completed":
                message = "Source processing completed successfully"
            elif status == "failed":
                message = "Source processing failed"
            elif status == "running":
                message = "Source processing in progress"
            elif status == "queued":
                message = "Source processing queued"
            elif status == "unknown":
                message = "Source processing status unknown"
            else:
                message = f"Source processing status: {status}"

            return SourceStatusResponse(
                status=status,
                message=message,
                processing_info=processing_info,
                command_id=str(source.command) if source.command else None,
            )

        except Exception as e:
            logger.warning(f"Failed to get status for source {source_id}: {e}")
            return SourceStatusResponse(
                status="unknown",
                message="Failed to retrieve processing status",
                processing_info=None,
                command_id=str(source.command) if source.command else None,
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching status for source {source_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error fetching source status: {str(e)}"
        )


@router.put("/sources/{source_id}", response_model=SourceResponse)
async def update_source(source_id: str, source_update: SourceUpdate):
    """Update a source."""
    try:
        source = await Source.get(source_id)
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")

        # Update only provided fields
        if source_update.title is not None:
            source.title = source_update.title
        if source_update.topics is not None:
            source.topics = source_update.topics

        await source.save()

        embedded_chunks = await source.get_embedded_chunks()
        return SourceResponse(
            id=source.id or "",
            title=source.title,
            topics=source.topics or [],
            asset=AssetModel(
                file_path=source.asset.file_path if source.asset else None,
                url=source.asset.url if source.asset else None,
            )
            if source.asset
            else None,
            full_text=source.full_text,
            embedded=embedded_chunks > 0,
            embedded_chunks=embedded_chunks,
            created=str(source.created),
            updated=str(source.updated),
        )
    except HTTPException:
        raise
    except InvalidInputError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating source {source_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating source: {str(e)}")


@router.post("/sources/{source_id}/retry", response_model=SourceResponse)
async def retry_source_processing(source_id: str):
    """Retry processing for a failed or stuck source."""
    try:
        # First, verify source exists
        source = await Source.get(source_id)
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")

        # Check if source already has a running command
        if source.command:
            try:
                status = await source.get_status()
                if status in ["running", "queued"]:
                    raise HTTPException(
                        status_code=400,
                        detail="Source is already processing. Cannot retry while processing is active.",
                    )
            except Exception as e:
                logger.warning(
                    f"Failed to check current status for source {source_id}: {e}"
                )
                # Continue with retry if we can't check status

        # Get notebooks that this source belongs to
        query = "SELECT VALUE out FROM reference WHERE in = $source_id"
        notebook_ids = [
            str(notebook_id)
            for notebook_id in await repo_query(
                query, {"source_id": ensure_record_id(source_id)}
            )
        ]

        if not notebook_ids:
            raise HTTPException(
                status_code=400, detail="Source is not associated with any notebooks"
            )

        # Prepare content_state based on source asset
        content_state = {}
        if source.asset:
            if source.asset.file_path:
                content_state = {
                    "file_path": source.asset.file_path,
                    "delete_source": False,  # Don't delete on retry
                }
            elif source.asset.url:
                content_state = {"url": source.asset.url}
            else:
                raise HTTPException(
                    status_code=400, detail="Source asset has no file_path or url"
                )
        else:
            # Check if it's a text source by trying to get full_text
            if source.full_text:
                content_state = {"content": source.full_text}
            else:
                raise HTTPException(
                    status_code=400, detail="Cannot determine source content for retry"
                )

        try:
            # Import command modules to ensure they're registered
            import commands.source_commands  # noqa: F401

            # Submit new command for background processing
            command_input = SourceProcessingInput(
                source_id=str(source.id),
                content_state=content_state,
                notebook_ids=notebook_ids,
                transformations=[],  # Use default transformations on retry
                embed=False,
            )

            command_id = await CommandService.submit_command_job(
                "open_notebook",  # app name
                "process_source",  # command name
                command_input.model_dump(),
            )

            logger.info(
                f"Submitted retry processing command: {command_id} for source {source_id}"
            )

            # Update source with new command ID
            source.command = ensure_record_id(command_id)
            await source.save()
            _schedule_local_command_job(
                command_id,
                "open_notebook.process_source",
                command_input.model_dump(),
            )

            # Get current embedded chunks count
            embedded_chunks = await source.get_embedded_chunks()

            # Return updated source response
            return SourceResponse(
                id=source.id or "",
                title=source.title,
                topics=source.topics or [],
                asset=AssetModel(
                    file_path=source.asset.file_path if source.asset else None,
                    url=source.asset.url if source.asset else None,
                )
                if source.asset
                else None,
                full_text=source.full_text,
                embedded=embedded_chunks > 0,
                embedded_chunks=embedded_chunks,
                created=str(source.created),
                updated=str(source.updated),
                command_id=command_id,
                status="queued",
                processing_info={
                    "retry": True,
                    "queued": True,
                    "worker": "local_api_task",
                    "embedding": "blocked_worker_unavailable",
                },
            )

        except Exception as e:
            logger.error(
                f"Failed to submit retry processing command for source {source_id}: {e}"
            )
            raise HTTPException(
                status_code=500, detail=f"Failed to queue retry processing: {str(e)}"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrying source processing for {source_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error retrying source processing: {str(e)}"
        )


@router.delete("/sources/{source_id}")
async def delete_source(source_id: str):
    """Delete a source."""
    try:
        source = await Source.get(source_id)
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")

        await source.delete()

        return {"message": "Source deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting source {source_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting source: {str(e)}")


@router.get("/sources/{source_id}/insights", response_model=List[SourceInsightResponse])
async def get_source_insights(source_id: str):
    """Get all insights for a specific source."""
    try:
        source = await Source.get(source_id)
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")

        insights = await source.get_insights()
        return [
            SourceInsightResponse(
                id=insight.id or "",
                source_id=source_id,
                insight_type=insight.insight_type,
                content=insight.content,
                created=str(insight.created),
                updated=str(insight.updated),
            )
            for insight in insights
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching insights for source {source_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error fetching insights: {str(e)}"
        )


@router.post(
    "/sources/{source_id}/insights",
    response_model=InsightCreationResponse,
    status_code=202,
)
async def create_source_insight(source_id: str, request: CreateSourceInsightRequest):
    """
    Start insight generation for a source by running a transformation.

    This endpoint returns immediately with a 202 Accepted status.
    The transformation runs asynchronously in the background via the job queue.
    Poll GET /sources/{source_id}/insights to see when the insight is ready.
    """
    try:
        # Validate source exists
        source = await Source.get(source_id)
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")

        # Validate transformation exists
        transformation = await Transformation.get(request.transformation_id)
        if not transformation:
            raise HTTPException(status_code=404, detail="Transformation not found")

        # Submit transformation as background job and execute it in-process.
        command_args = {
            "source_id": source_id,
            "transformation_id": request.transformation_id,
        }
        command_id = submit_command(
            "open_notebook",
            "run_transformation",
            command_args,
        )
        logger.info(
            f"Submitted run_transformation command {command_id} for source {source_id}"
        )
        _schedule_local_command_job(
            str(command_id),
            "open_notebook.run_transformation",
            command_args,
        )

        # Return immediately with command_id for status tracking
        return InsightCreationResponse(
            status="pending",
            message="Insight generation started",
            source_id=source_id,
            transformation_id=request.transformation_id,
            command_id=str(command_id),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting insight generation for source {source_id}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Error starting insight generation: {str(e)}"
        )
