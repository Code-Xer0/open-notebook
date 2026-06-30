from fastapi import APIRouter, HTTPException, Query

from api.evidence_models import (
    EvidenceSnapshotCreate,
    EvidenceSnapshotResponse,
    FileAssetResponse,
    IntakeSourceCreate,
    IntakeSourceResponse,
)
from api.evidence_service import (
    create_intake_source,
    create_snapshot,
    get_asset,
    list_assets,
    list_events,
    list_intake_sources,
    list_snapshots,
)

router = APIRouter(prefix="/evidence", tags=["evidence"])


@router.get("/assets", response_model=list[FileAssetResponse])
async def get_evidence_assets(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return await list_assets(limit=limit, offset=offset)


@router.get("/assets/{asset_id}", response_model=FileAssetResponse)
async def get_evidence_asset(asset_id: str):
    try:
        return await get_asset(asset_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/events")
async def get_evidence_events(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return await list_events(limit=limit, offset=offset)


@router.get("/snapshots", response_model=list[EvidenceSnapshotResponse])
async def get_evidence_snapshots(limit: int = Query(20, ge=1, le=100)):
    return await list_snapshots(limit=limit)


@router.post("/snapshots", response_model=EvidenceSnapshotResponse)
async def post_evidence_snapshot(request: EvidenceSnapshotCreate):
    return await create_snapshot(request.reason)


@router.get("/intake-sources", response_model=list[IntakeSourceResponse])
async def get_intake_sources(limit: int = Query(100, ge=1, le=200)):
    return await list_intake_sources(limit=limit)


@router.post("/intake-sources", response_model=IntakeSourceResponse)
async def post_intake_source(request: IntakeSourceCreate):
    return await create_intake_source(request)
