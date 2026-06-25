#!/usr/bin/env python3
"""Startup script for Open Notebook API server.

In packaged Windows builds this module is executed from a PyInstaller frozen
binary. Keep the FastAPI app import behind the guarded `main()` path so
`multiprocessing.freeze_support()` can run before any dependency has a chance
to spawn child processes.
"""

import multiprocessing
import os
import sys
from pathlib import Path

import uvicorn

# Add the current directory to Python path so imports work
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))


def main() -> None:
    host = os.getenv("API_HOST", "127.0.0.1")
    port = int(os.getenv("API_PORT", "5055"))
    reload = os.getenv("API_RELOAD", "false").lower() == "true"

    print(f"Starting Open Notebook API server on {host}:{port}")
    print(f"Reload mode: {reload}")

    if reload:
        # Dev only: reload requires the import-string form.
        uvicorn.run("api.main:app", host=host, port=port, reload=True,
                    reload_dirs=[str(current_dir)])
    else:
        # Packaged / production: hand uvicorn the app object (no string import).
        from api.main import app  # noqa: WPS433 - import after freeze guard

        uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
