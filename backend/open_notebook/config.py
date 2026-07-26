import os
from pathlib import Path

# ROOT DATA FOLDER
_runtime_data_dir = os.environ.get("CODEX_RUNTIME_DATA_DIR", "").strip()
DATA_FOLDER = str(
    Path(_runtime_data_dir).resolve()
    if _runtime_data_dir
    else Path("./data").resolve()
)

# LANGGRAPH CHECKPOINT FILE
sqlite_folder = os.path.join(DATA_FOLDER, "sqlite-db")
os.makedirs(sqlite_folder, exist_ok=True)
LANGGRAPH_CHECKPOINT_FILE = os.path.join(sqlite_folder, "checkpoints.sqlite")

# UPLOADS FOLDER
UPLOADS_FOLDER = os.path.join(DATA_FOLDER, "uploads")
os.makedirs(UPLOADS_FOLDER, exist_ok=True)

# TIKTOKEN CACHE FOLDER
# Reads TIKTOKEN_CACHE_DIR from the environment so packaged or managed runtimes
# can redirect the cache to a writable path when needed.
TIKTOKEN_CACHE_DIR = os.environ.get("TIKTOKEN_CACHE_DIR", "").strip() or os.path.join(
    DATA_FOLDER, "tiktoken-cache"
)
os.makedirs(TIKTOKEN_CACHE_DIR, exist_ok=True)
