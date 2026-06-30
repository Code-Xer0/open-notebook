from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


VoiceCapsuleStatus = Literal["draft", "locked", "alternate", "deprecated", "experimental"]
RightsStatus = Literal[
    "synthetic_original",
    "user_owned",
    "licensed_actor",
    "public_domain_na",
    "temporary_internal_test",
    "unverified_source",
    "do_not_publish",
    "requires_consent",
    "expired_license",
]
VoiceType = Literal[
    "synthetic",
    "cloned_with_consent",
    "recorded_actor",
    "temporary_audition",
    "generated_character",
    "narrator",
    "non_canon_experimental",
]
SegmentType = Literal[
    "narration",
    "dialogue",
    "inner_monologue",
    "quoted_doctrine",
    "system_record",
    "battle_callout",
    "memory_fragment",
    "song_chant_prayer",
    "unknown_speaker",
    "ambiguous_speaker",
]
PerformanceTakeStatus = Literal[
    "draft",
    "needs_review",
    "approved",
    "canon",
    "rejected",
    "superseded",
    "deprecated",
]
QaStatus = Literal["not_run", "provider_missing", "passed", "needs_review", "failed"]


class VoiceCapsuleCreate(BaseModel):
    displayName: str
    voiceType: VoiceType = "synthetic"
    provider: str = "openai_speech"
    model: Optional[str] = "gpt-4o-mini-tts"
    voiceId: Optional[str] = "alloy"
    version: str = "v1.0"
    status: VoiceCapsuleStatus = "draft"
    rightsStatus: RightsStatus = "unverified_source"
    description: Optional[str] = None
    doctrineCard: Optional[str] = None
    toneProfile: Dict[str, Any] = Field(default_factory=dict)
    providerSettings: Dict[str, Any] = Field(default_factory=dict)
    allowedUse: List[str] = Field(default_factory=list)
    forbiddenUse: List[str] = Field(default_factory=list)
    sampleAudioRefs: List[str] = Field(default_factory=list)
    calibrationTextRefs: List[str] = Field(default_factory=list)
    provenance: Dict[str, Any] = Field(default_factory=dict)


class VoiceCapsuleUpdate(BaseModel):
    displayName: Optional[str] = None
    voiceType: Optional[VoiceType] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    voiceId: Optional[str] = None
    version: Optional[str] = None
    status: Optional[VoiceCapsuleStatus] = None
    rightsStatus: Optional[RightsStatus] = None
    description: Optional[str] = None
    doctrineCard: Optional[str] = None
    toneProfile: Optional[Dict[str, Any]] = None
    providerSettings: Optional[Dict[str, Any]] = None
    allowedUse: Optional[List[str]] = None
    forbiddenUse: Optional[List[str]] = None
    sampleAudioRefs: Optional[List[str]] = None
    calibrationTextRefs: Optional[List[str]] = None
    provenance: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None


class VoiceCapsuleResponse(VoiceCapsuleCreate):
    id: str
    lockedAt: Optional[str] = None
    created: Optional[str] = None
    updated: Optional[str] = None


class VoiceCapsuleListResponse(BaseModel):
    capsules: List[VoiceCapsuleResponse]


class VoiceCharacterCreate(BaseModel):
    displayName: str
    aliases: List[str] = Field(default_factory=list)
    description: Optional[str] = None
    doctrineCard: Optional[str] = None


class VoiceCharacterResponse(VoiceCharacterCreate):
    id: str
    created: Optional[str] = None
    updated: Optional[str] = None


class VoiceAssignmentCreate(BaseModel):
    characterId: Optional[str] = None
    voiceCapsuleId: str
    assignmentType: Literal["canonical_dialogue", "alternate", "pov_narration", "narrator"] = "canonical_dialogue"
    canonStatus: Literal["draft", "canon", "alternate", "deprecated"] = "draft"
    version: str = "v1.0"
    notes: Optional[str] = None


class VoiceAssignmentResponse(VoiceAssignmentCreate):
    id: str
    lockedAt: Optional[str] = None
    created: Optional[str] = None
    updated: Optional[str] = None


class PronunciationLexiconCreate(BaseModel):
    name: str
    version: str = "v1.0"
    entries: List[Dict[str, Any]] = Field(default_factory=list)
    status: Literal["draft", "locked", "deprecated"] = "draft"


class ManuscriptIntakeRequest(BaseModel):
    title: str
    text: Optional[str] = None
    sourceId: Optional[str] = None
    notebookId: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ManuscriptSegmentResponse(BaseModel):
    id: str
    manuscriptId: str
    chapterId: Optional[str] = None
    sceneId: Optional[str] = None
    segmentType: SegmentType
    text: str
    speakerId: Optional[str] = None
    speakerLabel: Optional[str] = None
    speakerConfidence: float = 0.0
    needsReview: bool = False
    resolverNotes: List[str] = Field(default_factory=list)
    orderIndex: int
    created: Optional[str] = None
    updated: Optional[str] = None


class ManuscriptResponse(BaseModel):
    id: str
    title: str
    sourceId: Optional[str] = None
    notebookId: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    segmentCount: int = 0
    reviewCount: int = 0
    created: Optional[str] = None
    updated: Optional[str] = None


class SegmentAttributionUpdate(BaseModel):
    speakerId: Optional[str] = None
    speakerLabel: Optional[str] = None
    speakerConfidence: float = 1.0
    needsReview: bool = False
    resolverNotes: List[str] = Field(default_factory=list)


class ReadingManifestCreate(BaseModel):
    title: str
    manuscriptId: str
    readingProfile: str = "Full Cast Canon Draft"
    narratorVoiceId: Optional[str] = None
    characterVoiceMap: Dict[str, str] = Field(default_factory=dict)
    pronunciationLexiconId: Optional[str] = None
    performanceRules: Dict[str, Any] = Field(default_factory=dict)
    notebooks: List[str] = Field(default_factory=list)
    status: Literal["draft", "locked", "deprecated"] = "draft"


class ReadingManifestResponse(ReadingManifestCreate):
    id: str
    qaStatus: QaStatus = "not_run"
    sourceId: Optional[str] = None
    lockedAt: Optional[str] = None
    created: Optional[str] = None
    updated: Optional[str] = None


class RenderManifestRequest(BaseModel):
    segmentIds: Optional[List[str]] = None
    renderMode: Literal["selected", "chapter"] = "chapter"
    maxSegments: int = Field(default=8, ge=1, le=50)
    forceProvider: Optional[str] = None


class RenderManifestJobResponse(BaseModel):
    commandId: str
    manifestId: str
    acceptedSegmentIds: List[str] = Field(default_factory=list)
    status: str = "submitted"


class RegeneratePerformanceTakeRequest(BaseModel):
    forceProvider: Optional[str] = None
    settings: Dict[str, Any] = Field(default_factory=dict)


class RegeneratePerformanceTakeJobResponse(BaseModel):
    commandId: str
    takeId: str
    manifestId: str
    segmentId: str
    status: str = "submitted"


class AudioAssetResponse(BaseModel):
    id: str
    filePath: Optional[str] = None
    duration: Optional[float] = None
    format: str = "mp3"
    sampleRate: Optional[int] = None
    sha256: Optional[str] = None
    created: Optional[str] = None
    updated: Optional[str] = None


class PerformanceTakeResponse(BaseModel):
    id: str
    readingManifestId: str
    segmentId: str
    voiceCapsuleId: Optional[str] = None
    audioAssetId: Optional[str] = None
    provider: str
    model: Optional[str] = None
    generationSettings: Dict[str, Any] = Field(default_factory=dict)
    emotionDirection: Dict[str, Any] = Field(default_factory=dict)
    status: PerformanceTakeStatus = "draft"
    qaStatus: QaStatus = "not_run"
    errorMessage: Optional[str] = None
    notes: Optional[str] = None
    created: Optional[str] = None
    updated: Optional[str] = None


class RenderManifestResponse(BaseModel):
    manifest: ReadingManifestResponse
    takes: List[PerformanceTakeResponse]
    warnings: List[str] = Field(default_factory=list)


class TakeStatusUpdate(BaseModel):
    status: PerformanceTakeStatus
    notes: Optional[str] = None
