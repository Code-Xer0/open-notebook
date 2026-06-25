from fastapi import APIRouter, HTTPException
from loguru import logger
from api.ontology_models import OntologyDataResponse
from api.ontology_service import get_ontology_data

router = APIRouter()

@router.get("/ontology", response_model=OntologyDataResponse)
async def fetch_ontology_data():
    """Get Nexus Ontology data."""
    try:
        return await get_ontology_data()
    except Exception as e:
        logger.error(f"Error fetching ontology data: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error fetching ontology data: {str(e)}"
        )
