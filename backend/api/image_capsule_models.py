from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


CanonStatus = Literal["draft", "canon", "alternate", "deprecated"]
ParserMode = Literal["heuristic_manual"]


class ImageCapsuleRegion(BaseModel):
    id: Optional[str] = None
    label: str
    caption: Optional[str] = None
    manualText: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    confidence: float = Field(0.0, ge=0.0, le=1.0)
    bounds: Dict[str, float] = Field(
        default_factory=lambda: {"x": 0.0, "y": 0.0, "width": 1.0, "height": 1.0}
    )
    order: int = 0
    provenance: Literal["manual", "heuristic"] = "manual"


class ImageCapsuleResponse(BaseModel):
    id: str
    assetId: str
    sourceId: Optional[str] = None
    originalFilename: str
    originalPath: str
    canonicalAlias: Optional[str] = None
    sha256: str
    perceptualHash: Optional[str] = None
    mimeType: str
    width: int
    height: int
    fileSize: int
    projectNamespace: Optional[str] = None
    parserMode: ParserMode = "heuristic_manual"
    canonStatus: CanonStatus = "draft"
    imageType: Optional[str] = None
    sceneType: Optional[str] = None
    confirmedContext: Dict[str, Any] = Field(default_factory=dict)
    provenance: Dict[str, Any] = Field(default_factory=dict)
    negativeConstraints: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    palette: List[str] = Field(default_factory=list)
    notebooks: List[str] = Field(default_factory=list)
    duplicateCapsules: List[str] = Field(default_factory=list)
    similarCapsules: List[Dict[str, Any]] = Field(default_factory=list)
    llmContextCard: Optional[str] = None
    regions: List[ImageCapsuleRegion] = Field(default_factory=list)
    created: Optional[str] = None
    updated: Optional[str] = None


class ImageCapsuleConfirmationUpdate(BaseModel):
    projectNamespace: Optional[str] = None
    canonStatus: CanonStatus = "draft"
    imageType: Optional[str] = None
    sceneType: Optional[str] = None
    confirmedContext: Dict[str, Any] = Field(default_factory=dict)
    provenance: Dict[str, Any] = Field(default_factory=dict)
    negativeConstraints: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class ImageRegionUpdate(BaseModel):
    regions: List[ImageCapsuleRegion] = Field(default_factory=list)


class ImageCapsulePublishRequest(BaseModel):
    canonStatus: CanonStatus = "canon"
    notebooks: Optional[List[str]] = None
    publishNote: Optional[str] = None


class ImageCapsuleListResponse(BaseModel):
    capsules: List[ImageCapsuleResponse]
