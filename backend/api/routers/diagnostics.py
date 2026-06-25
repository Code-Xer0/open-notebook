import logging
import os
import time
from fastapi import APIRouter
from api.command_registry import command_registry_status
from open_notebook.database.async_migrate import AsyncMigrationManager
from open_notebook.database.repository import repo_query
import open_notebook

logger = logging.getLogger(__name__)

router = APIRouter()

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
        "commandRegistry": command_registry_status(),
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
    return {
        "health": "shallow",
        "database": database,
        "version": version,
        "commandRegistry": version["commandRegistry"],
        "workers": version["commandRegistry"].get("workerAvailability", {}),
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

    command_status = command_registry_status()
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
