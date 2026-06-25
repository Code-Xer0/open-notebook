from __future__ import annotations

import importlib
from typing import Any

from loguru import logger
from surreal_commands import registry


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


def command_registry_status() -> dict[str, Any]:
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
            "error": str(exc),
        }

    registered = sorted(f"{item.app_id}.{item.name}" for item in items)
    missing = sorted(EXPECTED_COMMANDS.difference(registered))
    return {
        "ok": import_status["ok"] and not missing,
        "imported": import_status["imported"],
        "failed": import_status["failed"],
        "registered": registered,
        "missing": missing,
    }
