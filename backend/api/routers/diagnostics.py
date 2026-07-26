import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter
from api.artifact_workflow import get_artifact_workflow_contracts
from api.audio_adapters import get_audio_adapter_capabilities
from api.command_registry import command_registry_status_async
from api.credentials_service import get_provider_status
from api.evidence_service import probe_evidence_vault
from open_notebook.database.async_migrate import AsyncMigrationManager
from open_notebook.database.repository import repo_query
import open_notebook

logger = logging.getLogger(__name__)

router = APIRouter()


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fact(
    status: str,
    evidence: str,
    *,
    blocking_reason: str | None = None,
    last_error: str | None = None,
    last_probe_at: str | None = None,
) -> dict[str, Any]:
    return {
        "status": status,
        "evidence": evidence,
        "lastProbeAt": last_probe_at or _utc_now(),
        "blockingReason": blocking_reason,
        "lastError": last_error,
    }


def _worker_to_capability(worker: dict[str, Any] | None, evidence: str) -> dict[str, Any]:
    if not worker:
        return _fact(
            "not verified",
            evidence,
            blocking_reason="Worker diagnostics did not return a fact for this lane.",
        )
    return _fact(
        worker.get("status", "not verified"),
        evidence,
        blocking_reason=worker.get("blockingReason") or worker.get("reason"),
        last_error=worker.get("lastError"),
        last_probe_at=worker.get("lastProbeAt"),
    )


def _path_fact(path_value: str | None) -> dict[str, Any]:
    if not path_value:
        return {"path": None, "exists": False}
    try:
        return {"path": path_value, "exists": Path(path_value).exists()}
    except Exception:
        return {"path": path_value, "exists": False}


def _runtime_dependencies() -> dict[str, Any]:
    backend_path = os.getenv("CODEX_BACKEND_PATH")
    surreal_path = os.getenv("CODEX_SURREAL_PATH")
    data_dir = os.getenv("CODEX_RUNTIME_DATA_DIR") or os.getcwd()
    log_path = os.getenv("CODEX_BACKEND_LOG_PATH")
    resources_path = os.getenv("CODEX_RESOURCES_PATH")
    return {
        "appVersion": os.getenv("CODEX_APP_VERSION", "unknown"),
        "resourcesPath": _path_fact(resources_path),
        "backend": _path_fact(backend_path),
        "surreal": _path_fact(surreal_path),
        "dataDir": _path_fact(data_dir),
        "logPath": _path_fact(log_path),
        "docker": {
            "required": False,
            "status": "not required",
            "evidence": "Electron launches bundled/local SurrealDB and Python API sidecars directly.",
        },
    }


async def _count_table(table: str) -> tuple[int | str, str | None]:
    try:
        rows = await repo_query(f"SELECT id FROM {table}")
        return (len(rows) if rows else 0), None
    except Exception as exc:
        return "Unknown", str(exc)


async def _chat_capability(provider_status: dict[str, Any]) -> dict[str, Any]:
    try:
        from open_notebook.ai.models import DefaultModels, Model

        defaults = await DefaultModels.get_instance()
        default_chat_model = getattr(defaults, "default_chat_model", None)
        if not default_chat_model:
            return _fact(
                "blocked",
                "No default chat model is assigned in backend model defaults.",
                blocking_reason="Set and test a backend credential, then assign a default chat model.",
            )
        model = await Model.get(default_chat_model)
        provider = model.provider
        if provider_status.get("usable", {}).get(provider):
            return _fact(
                "ready",
                f"Default chat model {provider}/{model.name} has a usable tested backend credential.",
            )
        if provider_status.get("present", {}).get(provider):
            return _fact(
                "not verified",
                f"Default chat model {provider}/{model.name} has provider material present but no passed backend credential test.",
                blocking_reason="Run a backend credential test before enabling grounded chat.",
            )
        return _fact(
            "provider missing",
            f"Default chat model {provider}/{model.name} has no backend credential or environment fallback.",
            blocking_reason=f"Configure and test a {provider} credential.",
        )
    except Exception as exc:
        return _fact(
            "failed",
            "Chat readiness probe failed.",
            blocking_reason="Default chat model or credential status could not be inspected.",
            last_error=str(exc),
        )


async def _capabilities(
    database: dict[str, Any],
    version: dict[str, Any],
    command_status: dict[str, Any],
) -> dict[str, Any]:
    workers = command_status.get("workerAvailability", {})
    provider_status = await get_provider_status()
    evidence_probe = await probe_evidence_vault()
    audio_adapters = await get_audio_adapter_capabilities()
    artifact_workflows = get_artifact_workflow_contracts(
        evidence_ready=evidence_probe.status == "ready"
    )
    source_count, source_error = await _count_table("source")
    image_count, image_error = await _count_table("image_capsule")
    podcast_count, podcast_error = await _count_table("podcast_episode")
    ontology_count, ontology_error = await _count_table("ontology_entity")

    migration_status = version.get("migrationStatus")
    migration_fact = _fact(
        "ready" if migration_status == "current" else "blocked",
        f"Schema {version.get('schemaVersion')} of {version.get('latestSchemaVersion')} reports {migration_status}.",
        blocking_reason=None if migration_status == "current" else "Run pending migrations before trusting schema-backed features.",
    )

    credentials_usable = [
        provider for provider, usable in provider_status.get("usable", {}).items() if usable
    ]

    return {
        "api": _fact("reachable", "FastAPI answered the shallow health/version request."),
        "database": _fact(
            "ready" if database.get("status") == "online" else "failed",
            "SurrealDB migration table query completed." if database.get("status") == "online" else "Database probe failed.",
            blocking_reason=None if database.get("status") == "online" else "SurrealDB is not queryable by the backend.",
            last_error=database.get("error"),
        ),
        "migrations": migration_fact,
        "sourceUpload": _fact(
            "ready" if source_error is None else "failed",
            f"Source table reachable; {source_count} source records visible." if source_error is None else "Source table probe failed.",
            blocking_reason=None if source_error is None else "Source upload cannot be trusted until the source table is reachable.",
            last_error=source_error,
        ),
        "evidenceVault": _fact(
            evidence_probe.status,
            f"Evidence vault root {evidence_probe.evidenceRoot}; assets: {evidence_probe.assetCount}; derivatives: {evidence_probe.derivativeCount}.",
            blocking_reason=None if evidence_probe.status == "ready" else "Evidence root is not writable.",
            last_error=evidence_probe.lastError,
        ),
        "intakeRegistry": _fact(
            "ready" if evidence_probe.status == "ready" else "not verified",
            "Explicit intake sources are stored in SurrealDB; no background filesystem watchers are enabled.",
            blocking_reason=None if evidence_probe.status == "ready" else "Evidence vault probe must pass before trusting intake metadata.",
            last_error=evidence_probe.lastError,
        ),
        "snapshotManifests": _fact(
            "ready" if evidence_probe.status == "ready" else "not verified",
            f"Manifest-only snapshots recorded: {evidence_probe.snapshotCount}; restoreSupported is false in V1.",
            blocking_reason=None if evidence_probe.status == "ready" else "Evidence vault probe must pass before creating snapshot manifests.",
            last_error=evidence_probe.lastError,
        ),
        "artifactWorkflows": _fact(
            "ready" if all(
                fact.get("status") == "ready"
                for key, fact in artifact_workflows.items()
                if key != "audio_adapter"
            ) else "not verified",
            "Artifact workflows publish through source/evidence records; audio adapter execution remains provider-gated.",
            blocking_reason=None if evidence_probe.status == "ready" else "Evidence vault must be ready before artifact workflow output is trustworthy.",
            last_error=evidence_probe.lastError,
        ),
        "audioAdapters": _fact(
            "ready" if any(
                fact.get("status") == "ready"
                for fact in audio_adapters.values()
            ) else (
                "not verified"
                if any(fact.get("providerPresent") for fact in audio_adapters.values())
                else "provider missing"
            ),
            "Audio adapter readiness is derived from backend credential tests and adapter maturity.",
            blocking_reason=None if any(fact.get("status") == "ready" for fact in audio_adapters.values()) else "Configure and test a backend audio provider credential before enabling generation.",
        ),
        "sourceWorker": _worker_to_capability(workers.get("source"), "Source command worker readiness."),
        "embeddings": _worker_to_capability(workers.get("embedding"), "Embedding command worker readiness."),
        "chat": await _chat_capability(provider_status),
        "imageCapsules": _fact(
            "ready" if image_error is None else "failed",
            f"Image capsule table reachable; {image_count} capsule records visible." if image_error is None else "Image capsule table probe failed.",
            blocking_reason=None if image_error is None else "Image Capsule schema is not reachable.",
            last_error=image_error,
        ),
        "voice": _worker_to_capability(workers.get("voice"), "Voice render worker and provider readiness."),
        "podcasts": _worker_to_capability(workers.get("podcast"), f"Podcast records: {podcast_count}; worker readiness is separate."),
        "nexus": _fact(
            "mock" if ontology_error else ("ready" if ontology_count not in ("Unknown", 0) else "mock"),
            "Ontology UI may use curated mock data unless database rows exist." if ontology_error or ontology_count in ("Unknown", 0) else f"Ontology table has {ontology_count} rows.",
            blocking_reason="No database-backed ontology rows were proven." if ontology_error or ontology_count in ("Unknown", 0) else None,
            last_error=ontology_error,
        ),
        "credentials": _fact(
            "ready" if credentials_usable else ("not verified" if any(provider_status.get("present", {}).values()) else "provider missing"),
            f"Usable tested providers: {', '.join(credentials_usable)}." if credentials_usable else "No provider has a persisted passing backend credential test.",
            blocking_reason=None if credentials_usable else "Create and test a backend credential before enabling provider-backed features.",
        ),
        "sidecars": _fact(
            "reachable",
            "Backend process is running; Electron sidecar ownership facts are also available through preload IPC.",
        ),
    }


@router.get("/health")
async def get_health():
    """Shallow reachability check.

    This endpoint intentionally proves only that the FastAPI process can answer
    HTTP. Database, migrations, command workers, and providers are reported by
    /api/version and /api/diagnostics.
    """
    return {"status": "reachable", "health": "shallow"}

@router.get("/version")
async def get_version():
    """Get backend version."""
    version = getattr(open_notebook, "__version__", "1.9.0")
    schema_version = "Unknown"
    latest_schema_version = "Unknown"
    migration_status = "Unknown"
    try:
        manager = AsyncMigrationManager()
        current = await manager.get_current_version()
        latest = len(manager.up_migrations)
        schema_version = current
        latest_schema_version = latest
        migration_status = "current" if current >= latest else "pending"
    except Exception as e:
        logger.warning(f"Failed to read migration version: {e}")

    return {
        "version": version,
        "backendVersion": version,
        "appVersion": os.getenv("CODEX_APP_VERSION", "unknown"),
        "schemaVersion": schema_version,
        "latestSchemaVersion": latest_schema_version,
        "migrationStatus": migration_status,
        "commandRegistry": await command_registry_status_async(),
    }


@router.get("/diagnostics")
async def get_diagnostics():
    """Get factual local backend diagnostics."""
    database = {"status": "unknown", "error": None}
    try:
        await repo_query("SELECT id FROM _sbl_migrations LIMIT 1")
        database = {"status": "online", "error": None}
    except Exception as e:
        database = {"status": "error", "error": str(e)}

    version = await get_version()
    command_status = version["commandRegistry"]
    evidence_probe = await probe_evidence_vault()
    audio_adapters = await get_audio_adapter_capabilities()
    artifact_workflows = get_artifact_workflow_contracts(
        evidence_ready=evidence_probe.status == "ready"
    )
    return {
        "health": "shallow",
        "database": database,
        "version": version,
        "runtimeDependencies": _runtime_dependencies(),
        "evidence": evidence_probe.model_dump(),
        "artifactWorkflows": artifact_workflows,
        "audioAdapters": audio_adapters,
        "commandRegistry": command_status,
        "workers": command_status.get("workerAvailability", {}),
        "capabilities": await _capabilities(database, version, command_status),
    }

@router.get("/telemetry/summary")
async def get_telemetry_summary():
    """Get global knowledge telemetry summary."""
    measured_latency = "Unknown"
    try:
        start = time.perf_counter()
        await repo_query("SELECT id FROM source LIMIT 1")
        measured_latency = f"{max(1, int((time.perf_counter() - start) * 1000))}ms"
    except Exception as e:
        logger.warning(f"Failed to measure retrieval latency: {e}")

    # Attempt to fetch real counts from SurrealDB where feasible
    try:
        sources_res = await repo_query("SELECT id FROM source")
        connected = len(sources_res) if sources_res else 0
    except Exception as e:
        logger.warning(f"Failed to query sources: {e}")
        connected = "Unknown"

    try:
        insights_res = await repo_query("SELECT id FROM source_insight")
        insights_count = len(insights_res) if insights_res else 0
    except Exception as e:
        logger.warning(f"Failed to query insights: {e}")
        insights_count = "Unknown"

    command_status = await command_registry_status_async()
    workers = command_status.get("workerAvailability", {})

    # For fields we don't have direct tables for yet, return Unknown instead of
    # turning source counts into fake processing/citation metrics.
    return {
        "sourceHealth": {
            "connected": connected,
            "failed": "Unknown",
            "pending": "Unknown",
        },
        "knowledgeCoverage": {
            "citationCoverage": "Unknown",
            "insightCount": insights_count,
            "orphanContent": "Unknown",
            "unresolvedEntities": "Unknown",
        },
        "retrievalHealth": {
            "latency": measured_latency,
            "failed": "Unknown",
            "contextDepth": "Unknown",
        },
        "ingestionHealth": {
            "queued": "Unknown",
            "parsing": "Unknown",
            "failed": "Unknown",
            "completed": "Unknown",
            "storedSources": connected,
            "sourceWorker": workers.get("source", {"status": "unknown"}),
            "embeddingWorker": workers.get("embedding", {"status": "unknown"}),
        },
        "narrativeIndex": {
            "characters": "Unknown",
            "locations": "Unknown",
            "factions": "Unknown",
            "timelines": "Unknown",
        },
        "studioQueue": {
            "audiobookJobs": "Unknown",
            "reportJobs": "Unknown",
            "exportJobs": "Unknown",
            "podcastWorker": workers.get("podcast", {"status": "unknown"}),
            "voiceWorker": workers.get("voice", {"status": "unknown"}),
        }
    }
