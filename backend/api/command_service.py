from typing import Any, Dict, List, Optional

from loguru import logger
from surreal_commands import get_command_status, submit_command

from api.command_registry import ensure_command_modules
from open_notebook.database.repository import repo_query


class CommandService:
    """Generic service layer for command operations"""

    @staticmethod
    async def submit_command_job(
        module_name: str,  # Actually app_name for surreal-commands
        command_name: str,
        command_args: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Submit a generic command job for background processing"""
        try:
            # Ensure command modules are imported before submitting
            # This is needed because submit_command validates against local registry
            import_status = ensure_command_modules()
            if not import_status["ok"]:
                raise ValueError(
                    f"Command modules not available: {import_status['failed']}"
                )

            # surreal-commands expects: submit_command(app_name, command_name, args)
            cmd_id = submit_command(
                module_name,  # This is actually the app name (e.g., "open_notebook")
                command_name,  # Command name (e.g., "process_text")
                command_args,  # Input data
            )
            # Convert RecordID to string if needed
            if not cmd_id:
                raise ValueError("Failed to get cmd_id from submit_command")
            cmd_id_str = str(cmd_id)
            logger.info(
                f"Submitted command job: {cmd_id_str} for {module_name}.{command_name}"
            )
            return cmd_id_str

        except Exception as e:
            logger.error(f"Failed to submit command job: {e}")
            raise

    @staticmethod
    async def get_command_status(job_id: str) -> Dict[str, Any]:
        """Get status of any command job"""
        try:
            status = await get_command_status(job_id)
            return {
                "job_id": job_id,
                "status": status.status if status else "unknown",
                "result": status.result if status else None,
                "error_message": getattr(status, "error_message", None)
                if status
                else None,
                "created": str(status.created)
                if status and hasattr(status, "created") and status.created
                else None,
                "updated": str(status.updated)
                if status and hasattr(status, "updated") and status.updated
                else None,
                "progress": getattr(status, "progress", None) if status else None,
            }
        except Exception as e:
            logger.error(f"Failed to get command status: {e}")
            raise

    @staticmethod
    async def list_command_jobs(
        module_filter: Optional[str] = None,
        command_filter: Optional[str] = None,
        status_filter: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """List command jobs with optional filtering"""
        conditions: list[str] = []
        params: dict[str, Any] = {"limit": max(1, min(limit, 200))}
        if module_filter:
            conditions.append("app = $app")
            params["app"] = module_filter
        if command_filter:
            conditions.append("name = $name")
            params["name"] = command_filter
        if status_filter:
            conditions.append("status = $status")
            params["status"] = status_filter

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        try:
            rows = await repo_query(
                f"""
                SELECT id, app, name, status, result, error_message, created, updated, progress
                FROM command
                {where_clause}
                ORDER BY updated DESC, created DESC
                LIMIT $limit
                """,
                params,
            )
        except Exception as exc:
            if "table 'command' does not exist" in str(exc).lower():
                return []
            raise

        return [
            {
                "job_id": str(row.get("id")),
                "app": row.get("app"),
                "command": row.get("name"),
                "status": row.get("status"),
                "result": row.get("result"),
                "error_message": row.get("error_message"),
                "created": str(row.get("created")) if row.get("created") else None,
                "updated": str(row.get("updated")) if row.get("updated") else None,
                "progress": row.get("progress"),
            }
            for row in rows
        ]

    @staticmethod
    async def cancel_command_job(job_id: str) -> bool:
        """Cancel a running command job"""
        try:
            # Implementation depends on surreal-commands cancellation support
            # For now, just log the attempt
            logger.info(f"Attempting to cancel job: {job_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to cancel command job: {e}")
            raise
