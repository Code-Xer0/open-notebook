from __future__ import annotations

import importlib
from datetime import datetime, timezone
from typing import Any

from loguru import logger
from surreal_commands import registry

from open_notebook.database.repository import repo_query


EXPECTED_COMMAND_MODULES = [
    "commands.source_commands",
    "commands.embedding_commands",
    "commands.podcast_commands",
    "commands.voice_commands",
]

EXPECTED_COMMANDS = {
    "open_notebook.process_source",
    "open_notebook.embed_source",
    "open_notebook.embed_note",
    "open_notebook.rebuild_embeddings",
    "open_notebook.generate_podcast",
    "open_notebook.render_reading_manifest",
    "open_notebook.regenerate_performance_take",
    "open_notebook.run_transformation",
}

COMMAND_WORKERS = {
    "source": [
        "open_notebook.process_source",
        "open_notebook.run_transformation",
    ],
    "embedding": [
        "open_notebook.embed_source",
        "open_notebook.embed_note",
        "open_notebook.rebuild_embeddings",
    ],
    "podcast": [
        "open_notebook.generate_podcast",
    ],
    "voice": [
        "open_notebook.render_reading_manifest",
        "open_notebook.regenerate_performance_take",
    ],
}

PLACEHOLDER_WORKER_REASON = (
    "Command is registered for schema compatibility, but the packaged local "
    "worker implementation is a placeholder and raises a worker-unavailable error."
)

SOURCE_WORKER_UNVERIFIED_REASON = (
    "Source processing is registered, but no local process_source command has "
    "completed in this database yet."
)

VOICE_WORKER_UNVERIFIED_REASON = (
    "Voice rendering commands are registered, but no local render command has "
    "completed in this database yet."
)


def ensure_command_modules() -> dict[str, Any]:
    """Import command modules so surreal-commands can register local jobs."""
    imported: list[str] = []
    failed: dict[str, str] = {}

    for module_name in EXPECTED_COMMAND_MODULES:
        try:
            importlib.import_module(module_name)
            imported.append(module_name)
        except Exception as exc:
            failed[module_name] = str(exc)
            logger.error(f"Failed to import command module {module_name}: {exc}")

    return {
        "imported": imported,
        "failed": failed,
        "ok": not failed,
    }


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _worker_fact(
    status: str,
    commands: list[str],
    *,
    missing: list[str] | None = None,
    reason: str,
    last_probe_status: str,
    last_probe_at: str | None = None,
    last_error: str | None = None,
    blocking_reason: str | None = None,
) -> dict[str, Any]:
    return {
        "status": status,
        "commands": commands,
        "missing": missing or [],
        "reason": reason,
        "lastProbeAt": last_probe_at,
        "lastProbeStatus": last_probe_status,
        "lastError": last_error,
        "blockingReason": blocking_reason,
    }


def _base_command_registry_status() -> dict[str, Any]:
    import_status = ensure_command_modules()
    try:
        items = registry.get_all_commands()
    except Exception as exc:
        return {
            "ok": False,
            "imported": import_status["imported"],
            "failed": import_status["failed"],
            "registered": [],
            "missing": sorted(EXPECTED_COMMANDS),
            "workerAvailability": {
                name: _worker_fact(
                    "worker unavailable",
                    commands,
                    missing=commands,
                    reason="Registry could not be inspected.",
                    last_probe_status="registry_error",
                    last_probe_at=_utc_now(),
                    last_error=str(exc),
                    blocking_reason="Registry inspection failed.",
                )
                for name, commands in COMMAND_WORKERS.items()
            },
            "error": str(exc),
        }

    registered = sorted(f"{item.app_id}.{item.name}" for item in items)
    missing = sorted(EXPECTED_COMMANDS.difference(registered))
    worker_availability: dict[str, Any] = {}
    for worker_name, worker_commands in COMMAND_WORKERS.items():
        worker_missing = sorted(set(worker_commands).difference(registered))
        if worker_missing:
            worker_availability[worker_name] = _worker_fact(
                "worker unavailable",
                worker_commands,
                missing=worker_missing,
                reason=f"Missing command registrations: {', '.join(worker_missing)}",
                last_probe_status="missing_registration",
                last_probe_at=_utc_now(),
                blocking_reason="Required command registration is missing.",
            )
        elif worker_name == "source":
            worker_availability[worker_name] = _worker_fact(
                "blocked",
                worker_commands,
                reason=SOURCE_WORKER_UNVERIFIED_REASON,
                last_probe_status="not_run",
                blocking_reason=SOURCE_WORKER_UNVERIFIED_REASON,
            )
        elif worker_name == "voice":
            worker_availability[worker_name] = _worker_fact(
                "blocked",
                worker_commands,
                reason=VOICE_WORKER_UNVERIFIED_REASON,
                last_probe_status="not_run",
                blocking_reason=VOICE_WORKER_UNVERIFIED_REASON,
            )
        else:
            worker_availability[worker_name] = _worker_fact(
                "worker unavailable",
                worker_commands,
                reason=PLACEHOLDER_WORKER_REASON,
                last_probe_status="placeholder",
                last_probe_at=_utc_now(),
                blocking_reason=PLACEHOLDER_WORKER_REASON,
            )

    return {
        "ok": import_status["ok"] and not missing,
        "registrationOk": import_status["ok"] and not missing,
        "imported": import_status["imported"],
        "failed": import_status["failed"],
        "registered": registered,
        "missing": missing,
        "workerAvailability": worker_availability,
    }


async def _last_command_probe(
    app: str, name: str, status: str | None = None
) -> dict[str, Any] | None:
    where_status = "AND status = $status" if status else ""
    params: dict[str, Any] = {"app": app, "name": name}
    if status:
        params["status"] = status

    try:
        rows = await repo_query(
            f"""
            SELECT id, status, result, error_message, created, updated
            FROM command
            WHERE app = $app AND name = $name
            {where_status}
            ORDER BY updated DESC, created DESC
            LIMIT 1
            """,
            params,
        )
    except Exception as exc:
        logger.warning(f"Failed to read command probe for {app}.{name}: {exc}")
        if "table 'command' does not exist" in str(exc).lower():
            return None
        return {
            "status": "probe_error",
            "error_message": str(exc),
            "updated": _utc_now(),
        }

    return rows[0] if rows else None


async def command_registry_status_async() -> dict[str, Any]:
    status = _base_command_registry_status()
    workers = status.get("workerAvailability", {})
    source_worker = workers.get("source")

    if source_worker and source_worker.get("status") != "worker unavailable":
        probe = await _last_command_probe("open_notebook", "process_source")
        if probe:
            probe_status = str(probe.get("status") or "unknown")
            last_error = probe.get("error_message") or None
            last_probe_at = str(probe.get("updated") or probe.get("created") or _utc_now())

            if probe_status == "completed":
                workers["source"] = _worker_fact(
                    "ready",
                    COMMAND_WORKERS["source"],
                    reason="Last local source-processing command completed.",
                    last_probe_status=probe_status,
                    last_probe_at=last_probe_at,
                )
            elif probe_status == "failed":
                workers["source"] = _worker_fact(
                    "failed",
                    COMMAND_WORKERS["source"],
                    reason="Last local source-processing command failed.",
                    last_probe_status=probe_status,
                    last_probe_at=last_probe_at,
                    last_error=str(last_error or "Unknown source-processing failure."),
                    blocking_reason=str(last_error or "Last source-processing command failed."),
                )
            elif probe_status in {"new", "running", "queued"}:
                completed_probe = await _last_command_probe(
                    "open_notebook", "process_source", status="completed"
                )
                if completed_probe:
                    completed_at = str(
                        completed_probe.get("updated")
                        or completed_probe.get("created")
                        or _utc_now()
                    )
                    workers["source"] = _worker_fact(
                        "ready",
                        COMMAND_WORKERS["source"],
                        reason=(
                            "A local source-processing command has completed. "
                            "Separate pending jobs may still need review."
                        ),
                        last_probe_status="completed",
                        last_probe_at=completed_at,
                    )
                else:
                    workers["source"] = _worker_fact(
                        "blocked",
                        COMMAND_WORKERS["source"],
                        reason="A local source-processing command has not completed yet.",
                        last_probe_status=probe_status,
                        last_probe_at=last_probe_at,
                        blocking_reason="Source-processing probe is still pending or running.",
                    )
            else:
                workers["source"] = _worker_fact(
                    "blocked",
                    COMMAND_WORKERS["source"],
                    reason=f"Last source-processing probe returned {probe_status}.",
                    last_probe_status=probe_status,
                    last_probe_at=last_probe_at,
                    last_error=str(last_error) if last_error else None,
                    blocking_reason="Source-processing readiness is not proven.",
                )

    voice_worker = workers.get("voice")
    if voice_worker and voice_worker.get("status") != "worker unavailable":
        try:
            from api.voice_service import get_voice_provider_status

            provider_status = await get_voice_provider_status()
        except Exception as exc:
            workers["voice"] = _worker_fact(
                "failed",
                COMMAND_WORKERS["voice"],
                reason="Voice provider readiness could not be inspected.",
                last_probe_status="provider_probe_error",
                last_probe_at=_utc_now(),
                last_error=str(exc),
                blocking_reason="Voice provider diagnostics failed.",
            )
            return status

        if provider_status.get("status") != "ready":
            workers["voice"] = {
                **_worker_fact(
                    provider_status.get("status") or "provider missing",
                    COMMAND_WORKERS["voice"],
                    reason=provider_status.get("blockingReason") or "OpenAI speech provider is not ready.",
                    last_probe_status=provider_status.get("status") or "provider_missing",
                    last_probe_at=_utc_now(),
                    last_error=provider_status.get("lastError"),
                    blocking_reason=provider_status.get("blockingReason") or "OpenAI speech provider is not ready.",
                ),
                "provider": provider_status,
            }
            return status

        probe = await _last_command_probe("open_notebook", "render_reading_manifest")
        if not probe:
            workers["voice"] = {
                **_worker_fact(
                    "blocked",
                    COMMAND_WORKERS["voice"],
                    reason=VOICE_WORKER_UNVERIFIED_REASON,
                    last_probe_status="not_run",
                    blocking_reason=VOICE_WORKER_UNVERIFIED_REASON,
                ),
                "provider": provider_status,
            }
            return status

        probe_status = str(probe.get("status") or "unknown")
        last_error = probe.get("error_message") or None
        last_probe_at = str(probe.get("updated") or probe.get("created") or _utc_now())
        if probe_status == "completed":
            workers["voice"] = {
                **_worker_fact(
                    "ready",
                    COMMAND_WORKERS["voice"],
                    reason="Last local voice render command completed.",
                    last_probe_status=probe_status,
                    last_probe_at=last_probe_at,
                ),
                "provider": provider_status,
            }
        elif probe_status == "failed":
            workers["voice"] = {
                **_worker_fact(
                    "failed",
                    COMMAND_WORKERS["voice"],
                    reason="Last local voice render command failed.",
                    last_probe_status=probe_status,
                    last_probe_at=last_probe_at,
                    last_error=str(last_error or "Unknown voice render failure."),
                    blocking_reason=str(last_error or "Last voice render command failed."),
                ),
                "provider": provider_status,
            }
        else:
            workers["voice"] = {
                **_worker_fact(
                    "blocked",
                    COMMAND_WORKERS["voice"],
                    reason=f"Last voice render probe returned {probe_status}.",
                    last_probe_status=probe_status,
                    last_probe_at=last_probe_at,
                    last_error=str(last_error) if last_error else None,
                    blocking_reason="Voice rendering readiness is not proven.",
                ),
                "provider": provider_status,
            }

    return status


def command_registry_status() -> dict[str, Any]:
    return _base_command_registry_status()
