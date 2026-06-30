from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


AssetOrigin = Literal[
    "upload",
    "text_entry",
    "image_capsule",
    "generated_audio",
    "imported_corpus",
    "system",
]
DerivativeType = Literal[
    "canonical_text",
    "canonical_markdown",
    "context_card",
    "thumbnail",
    "transcript",
    "audio",
    "metadata",
]
EvidenceStatus = Literal["stored", "derived", "blocked", "failed", "not_verified"]


class FileAssetResponse(BaseModel):
    id: str
    sha256: str
    byteSize: int
    mimeType: Optional[str] = None
    storagePath: str
    originalPath: Optional[str] = None
    originKind: str
    sourceFilename: Optional[str] = None
    status: str
    sourceId: Optional[str] = None
    imageCapsuleId: Optional[str] = None
    audioAssetId: Optional[str] = None
    duplicateOf: Optional[str] = None
    duplicateAssetIds: List[str] = Field(default_factory=list)
    provenance: Dict[str, Any] = Field(default_factory=dict)
    created: Optional[str] = None
    updated: Optional[str] = None


class FileDerivativeResponse(BaseModel):
    id: str
    assetId: Optional[str] = None
    sourceId: Optional[str] = None
    derivativeType: str
    status: str
    storagePath: Optional[str] = None
    content: Optional[str] = None
    sha256: Optional[str] = None
    byteSize: Optional[int] = None
    provenance: Dict[str, Any] = Field(default_factory=dict)
    created: Optional[str] = None
    updated: Optional[str] = None


class ArtifactEventResponse(BaseModel):
    id: str
    eventType: str
    status: str
    subjectTable: Optional[str] = None
    subjectId: Optional[str] = None
    assetId: Optional[str] = None
    sourceId: Optional[str] = None
    evidence: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)
    created: Optional[str] = None
    updated: Optional[str] = None


class IntakeSourceCreate(BaseModel):
    label: str
    path: str
    sourceKind: str = "local_folder"
    enabled: bool = True
    provenance: Dict[str, Any] = Field(default_factory=dict)


class IntakeSourceResponse(IntakeSourceCreate):
    id: str
    exists: bool = False
    created: Optional[str] = None
    updated: Optional[str] = None


class EvidenceSnapshotCreate(BaseModel):
    reason: str = "manual_snapshot"


class EvidenceSnapshotResponse(BaseModel):
    id: str
    reason: str
    status: str
    manifest: Dict[str, Any] = Field(default_factory=dict)
    manifestSha256: str
    restoreSupported: bool = False
    created: Optional[str] = None
    updated: Optional[str] = None


class EvidenceVaultProbe(BaseModel):
    status: str
    evidenceRoot: str
    writable: bool
    assetCount: int | str
    derivativeCount: int | str
    eventCount: int | str
    snapshotCount: int | str
    latestSnapshot: Optional[EvidenceSnapshotResponse] = None
    lastError: Optional[str] = None
