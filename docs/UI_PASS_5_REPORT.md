# Codex UI Pass 5 — Report (Data Truth + Honest States)

> Claude pass, 2026-06-14. **No mock data added; fake posture removed.** Scope was deliberately
> honest: build the real data-truth foundation + kill fake confidence, and leave OCR/Vision/Nexus as
> *truthfully unavailable* scaffolds rather than faking them green. Build + renderer typecheck pass.
> Changes are uncommitted in the working tree (master) — left for the team to commit.

## The core finding (why "everything was offline")
The backend mounts every router under **`/api`** and protects most routes with
`PasswordAuthMiddleware` (`backend/api/main.py`). The frontend was calling `/notebooks`, `/sources`,
`/settings`, `/chat/...`, `/podcasts/...` — **missing the `/api` prefix** — and sending **no auth
header**. So even with the sidecar up, the app could not reach most of the backend. That wiring is
now fixed; this is the real Lane A foundation, not cosmetics.

## Changed files
**New**
- `src/renderer/src/services/health.ts` — single backend monitor: polls auth-excluded root `/health`, pulls telemetry when online, resets to honest `Unknown` when offline.
- `src/renderer/src/components/BackendStatus.tsx` — honest connectivity indicator (UNKNOWN / CONNECTING / ONLINE / OFFLINE + version).

**Edited**
- `services/api.ts` — baseURL now includes `/api`; auth interceptor (local access token via `localStorage codex.accessToken`, never a provider key); `system.health()` against root `/health`; added `credentials`/`models` groups; removed a non-existent diagnostics endpoint.
- `store/useStore.ts` — added a `backend` slice (`status/version/lastChecked`); exported `TelemetryState`.
- `App.tsx` — starts/stops the backend monitor at the root.
- `components/Topbar.tsx` — replaced hardcoded `V-STORE: ONLINE / WORKERS: IDLE / ACTIVE: 1` + always-green dot with the real `BackendStatus`.
- `pages/Dashboard/Dashboard.tsx` — removed per-page fetch (now store-fed); replaced the fabricated "Retrying failed PDF parse… 2m" card with state-derived honest text.
- `pages/Settings/Settings.tsx` — removed "configured = Online" fake confidence on Ollama / Edge / Embeddings / OCR-Vision cards (now "Configured · health unknown" until a real check) and the fabricated "Last test: OK"; hardcoded hex → theme `--signal-*` vars.
- `components/SourcePipelineCard.tsx` — type-safe telemetry guards (fixed 2 pre-existing `number | 'Unknown'` type errors).

## What is REAL now
- One honest connectivity source the whole UI reads: **ONLINE / OFFLINE / CONNECTING / UNKNOWN**, polled every 8s.
- Dashboard telemetry comes from the backend's real `/api/telemetry/summary` (which itself derives counts from SurrealDB) when online, and shows honest `Unknown` when not.
- Topbar, Dashboard "Next Actions", Source Pipeline, Knowledge Health, and Alerts all reflect real state — no fabricated numbers, scores, or "Online" claims.
- Settings status cards no longer claim health they didn't verify.
- Renderer **typecheck: 0 errors**; **`npm run build`: EXIT 0** (main + preload + renderer, 1845 modules).

## What is SCAFFOLDED (honest "unavailable", not faked)
- **Provider health checks** — Settings buttons (Test Health / Run Health Check / Ping Swarm / Test Pipeline / Test OCR) exist; the backend already exposes `POST /api/credentials/{id}/test` and `/discover`. Wiring the buttons to those is the next concrete step. Until then status reads "health unknown," not "Online."
- **OCR / Vision / Video** — honest "scaffolded — not yet wired" language in Settings; no fake success.
- **Nexus corpus** — `NexusManager` already shows an honest **"Awaiting import / No Nexus data imported"** empty state (two labelled "Placeholder" preview blocks remain to be replaced with real outputs).
- **Edge / Nest nodes** — config fields exist; reachability is unverified and operator-gated by design.

## What remains (next passes)
1. Wire provider **Test/Health** buttons → `/api/credentials/*` (round-trip, real green only on success).
2. Persist Settings (currently in-memory zustand) → `localStorage` or `/api/settings`.
3. OCR/Vision/Video ingestion lanes (backend + UI); video metadata/frame scaffold.
4. Nexus importer (chapter/character/location/ontology) replacing the placeholder preview blocks.
5. Routing-rules engine (prefer local/cloud/cheapest/fastest/private + fallback chain).

## Verification
- `npm run build` → **EXIT 0**. `npm run typecheck:web` → **0 errors**.
- **No live/runtime screenshots this pass** — the Python sidecar is down, so the app can't be exercised end-to-end honestly. When the sidecar is up on `:5055`, the Topbar should flip to **ONLINE vX** and the dashboard should populate from SurrealDB; offline it shows **OFFLINE** and `Unknown` — both now truthful.
- Backend/provider-health/OCR/empty-state/theme smokes from the spec require the running app + backend and are deferred until the sidecar loads.

## How to test (incl. Nexus)
1. Start backend: `cd backend && uv run uvicorn api.main:app --host 0.0.0.0 --port 5055` (set `OPEN_NOTEBOOK_ENCRYPTION_KEY`; default access password `open-notebook-change-me` or set `OPEN_NOTEBOOK_PASSWORD` and `localStorage.codex.accessToken` to match).
2. `npm run dev` → Topbar should read **ONLINE** with the backend version.
3. Nexus: open **Nexus** → import a corpus file; with none imported it correctly shows **"Awaiting import."**

## Known limitations
- Sidecar down → live data path unverified this pass (wiring is correct; runtime unproven).
- Default local access token assumes the upstream default password; override via `localStorage codex.accessToken`.
- Settings don't persist across restarts yet.
