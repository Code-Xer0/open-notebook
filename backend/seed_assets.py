import asyncio
import os
from pathlib import Path
from typing import Any
from loguru import logger
from surrealdb import RecordID

# Setup minimal env for local testing
os.environ["SURREAL_URL"] = "ws://127.0.0.1:8000/rpc"
os.environ["SURREAL_USER"] = "root"
os.environ["SURREAL_PASS"] = "root"
os.environ["SURREAL_NS"] = "test"
os.environ["SURREAL_DB"] = "test"

async def ingest_doctrine_files():
    from open_notebook.database.repository import get_connection
    from open_notebook.domain.notebook import Source, Asset, Notebook
    
    conn = await get_connection()
    logger.info("Connected to SurrealDB.")
    
    doctrine_dir = Path(r"C:\Users\Inf3r\Downloads\Nexus Assets\NEXUS_PROJECT_SPACE\00_DOCTRINE\Latest")
    if not doctrine_dir.exists():
        logger.error(f"Directory does not exist: {doctrine_dir}")
        return
        
    notebook = Notebook(
        name="Doctrine Latest", 
        description="Ingested from NEXUS_PROJECT_SPACE/00_DOCTRINE/Latest"
    )
    await notebook.save()
    logger.info(f"Created notebook: {notebook.id}")
    
    files = list(doctrine_dir.glob("*.*"))
    logger.info(f"Found {len(files)} files to ingest.")
    
    for file_path in files:
        if file_path.is_dir():
            continue
            
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                
            source = Source(
                title=file_path.name,
                full_text=content,
                asset=Asset(file_path=str(file_path))
            )
            await source.save()
            logger.info(f"Saved source: {source.title} ({source.id})")
            
            await source.add_to_notebook(notebook.id)
            logger.info(f"Linked {source.title} to notebook.")
            
        except UnicodeDecodeError:
            logger.warning(f"Skipping binary/non-utf8 file: {file_path.name}")
        except Exception as e:
            logger.error(f"Error processing {file_path.name}: {e}")

if __name__ == "__main__":
    asyncio.run(ingest_doctrine_files())
