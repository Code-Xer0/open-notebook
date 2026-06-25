from typing import List, Literal
from pydantic import BaseModel, Field

CanonStatusTag = Literal[
    "HARD LOCK",
    "WORKING CANON",
    "AUTHOR CORRECTION",
    "HIDDEN TRUTH",
    "FUTURE SPOILER",
    "DEPRECATED / DO NOT USE",
    "EXPERIMENTAL / LINK-LATER"
]

SourcePriorityLevel = Literal[
    "Hard canon locks",
    "Author corrections",
    "Current written scenes",
    "Conversation memory locks",
    "Experimental branches"
]

SpoilerBoundary = Literal[
    "Public enough",
    "Hidden truth",
    "Future spoiler",
    "Deprecated",
    "Validate later"
]

class SourcePriorityItem(BaseModel):
    id: str
    level: SourcePriorityLevel
    status: CanonStatusTag
    citation: str
    title: str
    detail: str

class ConflictCleanupEntry(BaseModel):
    id: str
    drift: str
    lock: str
    status: CanonStatusTag
    boundary: SpoilerBoundary
    citations: List[str]

class VisualDoctrineCard(BaseModel):
    id: str
    title: str
    status: CanonStatusTag
    summary: str
    tokens: List[str]
    swatches: List[str]

class NotebookQueryTest(BaseModel):
    id: str
    query: str
    readiness: Literal["Prompt ready", "Needs source check"]
    citation: str

class StylePackPrimitive(BaseModel):
    id: str
    title: str
    role: str
    status: CanonStatusTag

class OntologyDataResponse(BaseModel):
    mode: Literal["mock", "database", "mixed"] = "mock"
    provenance: str = "Curated Nexus mock package"
    warnings: List[str] = Field(default_factory=list)
    sourcePriorityStack: List[SourcePriorityItem]
    conflictCleanupEntries: List[ConflictCleanupEntry]
    visualDoctrineCards: List[VisualDoctrineCard]
    notebookQueryTests: List[NotebookQueryTest]
    stylePackPrimitives: List[StylePackPrimitive]
