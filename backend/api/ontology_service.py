from loguru import logger
from api.ontology_models import (
    SourcePriorityItem,
    ConflictCleanupEntry,
    VisualDoctrineCard,
    NotebookQueryTest,
    StylePackPrimitive,
    OntologyDataResponse
)
from open_notebook.database.repository import repo_query

MOCK_SOURCE_PRIORITY_STACK = [
    {
        "id": "v04-locks",
        "level": "Hard canon locks",
        "status": "HARD LOCK",
        "citation": "NEX-00",
        "title": "v0.4 correction pass",
        "detail": "Overrides older contradictory notes, rewrite fragments, image prompts, and blended drafts."
    },
    {
        "id": "author-corrections",
        "level": "Author corrections",
        "status": "AUTHOR CORRECTION",
        "citation": "NEX-00.1",
        "title": "Direct author correction",
        "detail": "Human corrections outrank assistant assumptions and generated summaries."
    },
    {
        "id": "scene-precision",
        "level": "Current written scenes",
        "status": "WORKING CANON",
        "citation": "NEX-02",
        "title": "Scene beats before summary language",
        "detail": "Current scenes win when they are more precise than recap wording."
    },
    {
        "id": "memory-locks",
        "level": "Conversation memory locks",
        "status": "WORKING CANON",
        "citation": "NEX-17",
        "title": "Reveal timing memory",
        "detail": "Memory locks can override older exports when the package explicitly says so."
    },
    {
        "id": "idea-banks",
        "level": "Experimental branches",
        "status": "EXPERIMENTAL / LINK-LATER",
        "citation": "NEX-21",
        "title": "Idea banks stay quarantined",
        "detail": "Experimental material can be evaluated later but cannot silently become plot truth."
    }
]

MOCK_CONFLICT_CLEANUP_ENTRIES = [
    {
        "id": "cain-oberon",
        "drift": "Cain described as Black, bald, and breach-coded.",
        "lock": "That visual lock belongs to Oberon. Cain is white/light-skinned, silver-haired, clean-cut, and gravity/stabilization coded.",
        "status": "HARD LOCK",
        "boundary": "Deprecated",
        "citations": ["NEX-00.1", "NEX-20"]
    },
    {
        "id": "tet-khepra",
        "drift": "Tet fight, Raziel kidnapping, and ceremony breach moved into Khepra-9.",
        "lock": "Tet belongs to the Aegis ceremony breach aftermath. Khepra-9 is a later deniable black-ops relic-node probe.",
        "status": "HARD LOCK",
        "boundary": "Public enough",
        "citations": ["NEX-00.1", "NEX-23"]
    },
    {
        "id": "regalia-inheritance",
        "drift": "Regalia treated as inherited objects passed down through bloodlines.",
        "lock": "Expression traits are heritable. Regalia are soul-bound manifestations shaped by identity, trauma, affinity, and awakening conditions.",
        "status": "HARD LOCK",
        "boundary": "Public enough",
        "citations": ["NEX-00.1", "NEX-04"]
    },
    {
        "id": "rayne-parentage",
        "drift": "Rayne presented as unrelated to Lucius and Aurora.",
        "lock": "Rayne is the hidden daughter of Lucius and Aurora, held behind the Volume 1 reveal boundary.",
        "status": "HIDDEN TRUTH",
        "boundary": "Hidden truth",
        "citations": ["NEX-17", "NEX-20"]
    },
    {
        "id": "holy-arms",
        "drift": "Holy Arms treated as safe weak-user weapons or as true Regalia.",
        "lock": "Holy Arms are weaker synthesized weapons carrying dead Nephilim residue and can devour insufficient-affinity users.",
        "status": "WORKING CANON",
        "boundary": "Hidden truth",
        "citations": ["NEX-04", "NEX-15"]
    }
]

MOCK_VISUAL_DOCTRINE_CARDS = [
    {
        "id": "aegis-style",
        "title": "Aegis mythic-tech opera",
        "status": "HARD LOCK",
        "summary": "Clean anime cinematic rendering, readable faces, restrained tech detail, military fashion realism, luminous blue-white divine accents.",
        "tokens": ["Black / white / blue", "Sharp silhouette", "Controlled FX"],
        "swatches": ["#f8fbff", "#0d1c2e", "#1d64a7", "#8cc7ff"]
    },
    {
        "id": "lumina-style",
        "title": "Lumina Hell-coded expression",
        "status": "WORKING CANON",
        "summary": "More demonic, less standardized, more personally expressive than Aegis while still governed by source boundaries.",
        "tokens": ["Combustion", "Gold pressure", "Irregular forms"],
        "swatches": ["#fff8ed", "#31150f", "#bd5745", "#d19a40"]
    },
    {
        "id": "character-firewall",
        "title": "Cain / Oberon firewall",
        "status": "HARD LOCK",
        "summary": "Separate shared visual symbols before generation: Cain is silver-haired gravity command; Oberon is bald hammer breach.",
        "tokens": ["Identity split", "Silhouette guard", "Casting lock"],
        "swatches": ["#f4f7fb", "#27313c", "#7d8ba1", "#102c57"]
    },
    {
        "id": "storyboard-first",
        "title": "Storyboard-first production",
        "status": "AUTHOR CORRECTION",
        "summary": "Reference archive output comes before online manga polish: one clear beat per page, 4-5 panels maximum, animation handoff ready.",
        "tokens": ["Beat clarity", "Continuity", "Shot handoff"],
        "swatches": ["#ffffff", "#1f2937", "#0f8b8d", "#a66a00"]
    }
]

MOCK_NOTEBOOK_QUERY_TESTS = [
    { "id": "mother-aurora", "query": "Explain the difference between Mother and Aurora.", "readiness": "Needs source check", "citation": "NEX-22" },
    { "id": "shouri-parents", "query": "Who are Shouri's parents?", "readiness": "Needs source check", "citation": "NEX-22" },
    { "id": "rayne-parents", "query": "Who are Rayne's parents?", "readiness": "Needs source check", "citation": "NEX-17" },
    { "id": "holy-arms", "query": "What are Holy Arms?", "readiness": "Needs source check", "citation": "NEX-22" },
    { "id": "tet-khepra", "query": "Is Tet part of Khepra-9?", "readiness": "Needs source check", "citation": "NEX-22" },
    { "id": "cain-oberon", "query": "What is the difference between Cain and Oberon?", "readiness": "Needs source check", "citation": "NEX-22" }
]

MOCK_STYLE_PACK_PRIMITIVES = [
    { "id": "aegis-pack", "title": "Aegis Mythic-Tech", "role": "StylePack", "status": "WORKING CANON" },
    { "id": "lumina-pack", "title": "Lumina Hell-coded", "role": "StylePack", "status": "WORKING CANON" },
    { "id": "storyboard-page", "title": "Storyboard Page", "role": "ArticleTemplate", "status": "AUTHOR CORRECTION" },
    { "id": "character-asset", "title": "Character Asset", "role": "PrefabComponent", "status": "HARD LOCK" },
    { "id": "event-firewall", "title": "Event Firewall", "role": "PrefabComponent", "status": "HARD LOCK" },
    { "id": "spoiler-boundary", "title": "Spoiler Boundary", "role": "ExportSafetyRule", "status": "HIDDEN TRUTH" },
    { "id": "citation-chip", "title": "Citation Chip", "role": "GroundedOutput", "status": "WORKING CANON" }
]

def _record_id(raw_id) -> str:
    id_str = str(raw_id)
    return id_str.split(":")[-1].strip("⟨⟩") if ":" in id_str else id_str


async def _read_table(table_name: str) -> list[dict]:
    """Read ontology rows without seeding or mutating the database."""
    try:
        rows = await repo_query(f"SELECT * FROM {table_name}")
        return rows or []
    except Exception as exc:
        logger.warning(f"Ontology table {table_name} not readable: {exc}")
        return []

async def get_ontology_data() -> OntologyDataResponse:
    """Get all ontology data without mutating storage."""
    warnings: list[str] = []
    database_sections = 0
    mock_sections = 0

    # 1. SourcePriorityItem
    sources_raw = await _read_table("source_priority_item")
    if sources_raw:
        database_sections += 1
    else:
        mock_sections += 1
        warnings.append("Canon priority stack is curated mock data; no database rows were found.")
        sources_raw = MOCK_SOURCE_PRIORITY_STACK
    sources = []
    for s in sources_raw:
        sources.append(SourcePriorityItem(
            id=_record_id(s["id"]),
            level=s["level"],
            status=s["status"],
            citation=s["citation"],
            title=s["title"],
            detail=s["detail"]
        ))
        
    # 2. ConflictCleanupEntry
    conflicts_raw = await _read_table("conflict_cleanup_entry")
    if conflicts_raw:
        database_sections += 1
    else:
        mock_sections += 1
        warnings.append("Conflict cleanup board is curated mock data; no database rows were found.")
        conflicts_raw = MOCK_CONFLICT_CLEANUP_ENTRIES
    conflicts = []
    for c in conflicts_raw:
        conflicts.append(ConflictCleanupEntry(
            id=_record_id(c["id"]),
            drift=c["drift"],
            lock=c["lock"],
            status=c["status"],
            boundary=c["boundary"],
            citations=c.get("citations", [])
        ))
        
    # 3. VisualDoctrineCard
    cards_raw = await _read_table("visual_doctrine_card")
    if cards_raw:
        database_sections += 1
    else:
        mock_sections += 1
        warnings.append("Visual doctrine canvas is curated mock data; no database rows were found.")
        cards_raw = MOCK_VISUAL_DOCTRINE_CARDS
    cards = []
    for c in cards_raw:
        cards.append(VisualDoctrineCard(
            id=_record_id(c["id"]),
            title=c["title"],
            status=c["status"],
            summary=c["summary"],
            tokens=c.get("tokens", []),
            swatches=c.get("swatches", [])
        ))
        
    # 4. NotebookQueryTest
    queries_raw = await _read_table("notebook_query_test")
    if queries_raw:
        database_sections += 1
    else:
        mock_sections += 1
        warnings.append("Notebook query tests are curated mock data; no database rows were found.")
        queries_raw = MOCK_NOTEBOOK_QUERY_TESTS
    queries = []
    for q in queries_raw:
        queries.append(NotebookQueryTest(
            id=_record_id(q["id"]),
            query=q["query"],
            readiness=q["readiness"],
            citation=q["citation"]
        ))
        
    # 5. StylePackPrimitive
    styles_raw = await _read_table("style_pack_primitive")
    if styles_raw:
        database_sections += 1
    else:
        mock_sections += 1
        warnings.append("StylePack primitives are curated mock data; no database rows were found.")
        styles_raw = MOCK_STYLE_PACK_PRIMITIVES
    styles = []
    for s in styles_raw:
        styles.append(StylePackPrimitive(
            id=_record_id(s["id"]),
            title=s["title"],
            role=s["role"],
            status=s["status"]
        ))
        
    mode = "database" if database_sections and not mock_sections else "mixed" if database_sections else "mock"

    return OntologyDataResponse(
        mode=mode,
        provenance="Database ontology rows" if mode == "database" else "Curated Nexus ontology mock package",
        warnings=warnings,
        sourcePriorityStack=sources,
        conflictCleanupEntries=conflicts,
        visualDoctrineCards=cards,
        notebookQueryTests=queries,
        stylePackPrimitives=styles
    )
