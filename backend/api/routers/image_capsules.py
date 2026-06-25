import json
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from api.image_capsule_models import (
    ImageCapsuleConfirmationUpdate,
    ImageCapsuleListResponse,
    ImageCapsulePublishRequest,
    ImageCapsuleResponse,
    ImageRegionUpdate,
)
from api.image_capsule_service import (
    get_capsule,
    intake_image,
    list_capsules,
    publish_capsule,
    replace_regions,
    update_confirmation,
)

router = APIRouter(prefix="/image-capsules", tags=["image-capsules"])


def _parse_notebooks(raw: Optional[str]) -> Optional[List[str]]:
    if not raw:
        return None
    value = raw.strip()
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        parsed = [item.strip() for item in value.split(",") if item.strip()]
    if isinstance(parsed, str):
        parsed = [parsed]
    if not isinstance(parsed, list) or not all(isinstance(item, str) and item for item in parsed):
        raise HTTPException(status_code=400, detail="notebooks must be a JSON array of strings")
    return parsed


@router.post("/intake", response_model=ImageCapsuleResponse)
async def intake_image_capsule(
    file: UploadFile = File(...),
    project_namespace: Optional[str] = Form(None),
    notebooks: Optional[str] = Form(None),
):
    return await intake_image(
        upload_file=file,
        project_namespace=project_namespace,
        notebooks=_parse_notebooks(notebooks),
    )


@router.get("", response_model=ImageCapsuleListResponse)
async def get_image_capsules(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    return ImageCapsuleListResponse(capsules=await list_capsules(limit=limit, offset=offset))


@router.get("/{capsule_id}", response_model=ImageCapsuleResponse)
async def get_image_capsule(capsule_id: str):
    return await get_capsule(capsule_id)


@router.put("/{capsule_id}/confirmation", response_model=ImageCapsuleResponse)
async def confirm_image_capsule(
    capsule_id: str,
    update: ImageCapsuleConfirmationUpdate,
):
    return await update_confirmation(capsule_id, update)


@router.put("/{capsule_id}/regions", response_model=ImageCapsuleResponse)
async def update_image_capsule_regions(
    capsule_id: str,
    update: ImageRegionUpdate,
):
    return await replace_regions(capsule_id, update.regions)


@router.post("/{capsule_id}/publish", response_model=ImageCapsuleResponse)
async def publish_image_capsule_route(
    capsule_id: str,
    request: ImageCapsulePublishRequest,
):
    return await publish_capsule(capsule_id, request)
