# Codex App ↔ Video Evidence Vault — Integration (STAGING)

> **Status: STAGED — proposal-only.** Entry point for the **Codex team** to integrate this app with
> the **video-captures evidence vault**. Read-first; producer/capture wiring is deferred behind
> operator approval. Authored 2026-06-13 by the workspace continuity pass.
>
> **Repo note:** this repo's git history is an upstream `electron-vite` template (2024), but the working
> tree is an active rebuild — **Electron + React 19 + a Python `backend/`** (knowledge/telemetry UI:
> `SourcePipelineCard`, `TelemetryGraph`, `KnowledgeHealthScore`, `KnowledgeAlerts`, …). This doc is the
> team's vault entry point, not a description of the finished app.

## Jurisdiction (Codex's role re: the vault)
Codex is an **agent/app team**, a *consumer* (and, later, a gated *producer*) of evidence objects —
not an authority over them. It renders and references the vault; it does not own the bytes, the hash,
the provenance (CHRON), or the continuity memory (MNEM).

> **Memory says: "there was a recording." Evidence says: "here are the bytes."** Codex *displays* both, and must never blur them in the UI.

## Where the vault is (read these)
- `C:\Users\Inf3r\Git\video-captures\INDEX.md` — generated catalog (fastest read)
- `…\SCHEMA.md` — record fields + integrity rules · `…\README.md` — the model
- `…\metadata\<capture_id>.json` — the evidence objects (13 today)

## A) Consumer path (allowed now — read-only)
Parse `metadata/*.json` and render in the knowledge/telemetry surfaces. Suggested TS type (from `SCHEMA.md`):

```ts
type CaptureStatus =
  | "verified_local" | "unclassified_prior"
  | "canonical_pending_export" | "pending_external_export" | "failed";

interface CaptureRecord {
  capture_id: string;
  timestamp: string;            // ISO 8601
  workflow: string;
  status: CaptureStatus;
  source_app: string;
  recording_tool: string;
  duration: string | null;      // null until probed — do not invent
  resolution: string | null;
  known_issue: string | null;
  canonical_use: string | null; // exactly one record starts "CANONICAL"
  hash: string | null;          // "sha256:…" or null — null ⇒ unverified
  source_of_record: string;     // verified-from-fs vs known-from-notes
  source_path: string | null;
}
```

**UI honesty rules (non-negotiable):**
- Render `pending_*` / `failed` records **visibly distinct** from `verified_local` (e.g. badge + muted). Never show a pending capture as if its bytes exist.
- If `hash` is null, show "unverified — bytes not on host." **Never** synthesize a hash, duration, or thumbnail.
- Surface `source_of_record` so a viewer can tell verified-from-filesystem from known-from-notes.
- The single `canonical_use: "CANONICAL …"` record (`2026-06-13_18-44-25`) may be highlighted, but still flagged pending until exported.

## B) Producer path (DEFERRED — operator-gated)
If/when Codex drives captures (via the `capture-stack` MCP, see workspace
`VIDEO_AUTOMATION_MCP_EXTRACTION_REPORT.md`):
- Write a `metadata/<capture_id>.json` per `SCHEMA.md`; compute a **real SHA-256**; set `status` truthfully.
- **Non-destructive:** reference source bytes by path; do not move/edit originals.
- Recording start/stop, streaming, and `synthesize_tool(auto_register=true)` stay **operator-gated** (no auto-attach of the MCP).

## Cross-agent coordination (Claude + Codex share this workspace)
- The vault is **shared read, coordinated write.** Claude authored the current 13 records; coordinate before writing/editing records to avoid collisions.
- The **operator owns the vault**; Codex stages, the operator promotes (canonical/verified, memory promotion).
- **Local-only:** read the vault from the host filesystem; never upload capture bytes or hashes off-host. No secrets.

## Staging checklist (operator-gated; nothing here auto-runs)
- [ ] Add a read-only vault adapter under `src/renderer/src/services/` that parses `metadata/*.json` → `CaptureRecord[]`.
- [ ] Add an "Evidence" view (reuse `SourcePipelineCard` / `TelemetryGraph` / `KnowledgeHealthScore`) honoring the UI honesty rules.
- [ ] Dry-run against the 13 current records; confirm pending vs verified render distinctly.
- [ ] Leave the producer/capture-stack path unwired until the operator approves it.

**Definition of staged-done:** read adapter + honest Evidence view defined and dry-run against real records; no writes to the vault; producer path deferred.
