import asyncio
from typing import Any

from loguru import logger
from surreal_commands.core.service import command_service as surreal_command_service


async def execute_local_command_job(
    command_id: str,
    command_name: str,
    command_args: dict[str, Any],
) -> None:
    try:
        await surreal_command_service.execute_command(
            str(command_id),
            command_name,
            command_args,
        )
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


def schedule_local_command_job(
    command_id: str,
    command_name: str,
    command_args: dict[str, Any],
) -> None:
    task = asyncio.create_task(
        execute_local_command_job(command_id, command_name, command_args)
    )
    task.add_done_callback(
        lambda completed: logger.error(
            f"Local command task crashed for {command_id}: {completed.exception()}"
        )
        if completed.exception()
        else None
    )
