from fastapi import APIRouter, Query

from api.voice_models import (
    ManuscriptIntakeRequest,
    ManuscriptResponse,
    ManuscriptSegmentResponse,
    SegmentAttributionUpdate,
)
from api.voice_service import (
    get_manuscript,
    intake_manuscript,
    list_manuscripts,
    list_segments,
    update_segment_attribution,
)

router = APIRouter(prefix="/manuscripts", tags=["manuscripts"])


@router.get("", response_model=list[ManuscriptResponse])
async def get_manuscripts():
    return await list_manuscripts()


@router.post("/intake", response_model=ManuscriptResponse)
async def post_manuscript_intake(request: ManuscriptIntakeRequest):
    return await intake_manuscript(request)


@router.get("/{manuscript_id}", response_model=ManuscriptResponse)
async def get_manuscript_route(manuscript_id: str):
    return await get_manuscript(manuscript_id)


@router.get("/{manuscript_id}/segments", response_model=list[ManuscriptSegmentResponse])
async def get_manuscript_segments(manuscript_id: str, review_only: bool = Query(False)):
    return await list_segments(manuscript_id, review_only=review_only)


@router.put("/segments/{segment_id}/attribution", response_model=ManuscriptSegmentResponse)
async def put_segment_attribution(segment_id: str, request: SegmentAttributionUpdate):
    return await update_segment_attribution(segment_id, request)
