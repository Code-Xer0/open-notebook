# Codex — Frontend State & UI Pass 5–6 (clean-slate handoff)

> Updated 2026-06-14. The Codex repo now has a **clean working tree** — the in-flight rebuild +
> data-truth UI pass are committed in two logical commits on `master`. **No mock data, no fake
> green; honest offline/unknown states throughout.** Build + renderer typecheck pass.

## What Codex is
An **Electron + React 19** desktop shell over an embedded **open-notebook** backend
(FastAPI + SurrealDB, `backend/`). Knowledge workstation: notebooks, sources, chat, podcasts,
Nexus corpus, narrative studio. The frontend talks to the backend over HTTP on `:5055/api`.

## Clean slate (commits)
- `f8a528c` — **backend**: track the open-notebook FastAPI + SurrealDB service (was untracked).
- `7d9b83b` — **frontend**: knowledge workstation + data-truth pass.
- `.gitignore` hardened: `node_modules`, `out`, `dist`, `backend/build|dist`, `resources/bin`, `*.exe/*.pkg/*.pyz`, `.venv`, `__pycache__`, `*.egg-info`, `backend/data`, `*.sqlite`, `.env*` are ignored. **No binaries/secrets are committed** (verified by dry-run scan).
- **Vendored binary not committed:** `resources/bin/surreal.exe` (108 MB) and `backend/dist/backend.exe` are gitignored — fetch/build them locally (`npm run build:backend`; SurrealDB binary into `resources/bin/`).

## Data-truth foundation (real)
- **API wiring fixed:** `apiClient` baseURL now includes `/api` (backend mounts every router there) + an auth interceptor (local access token via `localStorage codex.accessToken`, default `open-notebook-change-me`; **never a provider key**). This is why the app couldn't reach the backend before.
- **One honest connectivity source:** `services/health.ts` polls the auth-excluded root `/health` every 8s → store `backend.status` = `online | offline | connecting | unknown` (+ version). Topbar, Dashboard, Settings General, and the Source Pipeline all read it. Telemetry comes from real `/api/telemetry/summary` when online, honest `Unknown` when not.
- **All fabricated posture removed:** Topbar `ONLINE/IDLE/ACTIVE:1`, Dashboard "Retrying failed PDF parse… 2m", and the Settings cards that claimed `Online`/`Connected`/`Storage verified`/`Last test: OK` from mere config are gone. Status now reads `Configured · health unknown` until a real check runs.

## New UI primitives (this pass)
- **`components/Select.tsx`** — fully theme-styled dropdown replacing every native `<select>` (popup + scrollbar are app-rendered, not Windows-stock). Applied across all Settings sections + Nexus.
- **`components/ModelSelect.tsx`** — editable model field with **live discovery**: Ollama queries the local daemon's `/api/tags` directly (`{endpoint}/api/tags`); cloud asks the backend `/api/models`. Honest states: *Searching local models… / N found / Couldn't reach Ollama at … / Backend offline*. Applied to Default Chat/Embedding/Vision model + Embeddings model.
- **`components/BackendStatus.tsx`** — honest connectivity chip in the Topbar.
- **Settings persistence:** zustand `persist` → `localStorage` (`codex-settings`). Settings now survive restart (auto-save on change). Runtime state (telemetry/backend) stays ephemeral.
- **Scrollbars:** already app-styled globally (`::-webkit-scrollbar`, 4px themed) — the Windows-stock look came from native `<select>` popups, now eliminated.
- Removed dead `Versions.vue` (Vue leftover).

## Build / run / package
```
npm run dev            # Electron + Vite dev
npm run build          # renderer + main + preload (no backend needed)
npm run typecheck:web  # renderer types
npm run build:win      # full installer (build:backend + build + electron-builder)
```
Latest installer: `dist/electron-app-1.0.6-setup.exe` (149 MB; SHA-256 in `.sha256`).

## What's scaffolded / remaining (honest)
- **Provider Test/Health buttons** (Ollama/cloud/edge/embeddings/OCR) exist but are not yet wired to the backend's real `POST /api/credentials/{id}/test` / `/discover` — status stays "health unknown," never fake green. **Untestable until the sidecar loads.**
- **Per-section Save/Reset buttons** are pre-existing no-ops (persistence is now automatic) — recommend removing or wiring to `/api/settings`.
- **OCR / Vision / Video** ingestion and **Nexus import** are honest scaffolds (Nexus shows "Awaiting import"). Cloud model discovery needs the backend + a saved credential.
- **Known runtime issue:** the bundled Python **sidecar does not auto-load** — so a fresh install shows honest **OFFLINE / Unknown** everywhere (correct, not a bug in the UI). Next real task: debug the sidecar spawn in `src/main` (the `backend.exe` runs standalone; packaging works).

## How to test
1. Install `dist/electron-app-1.0.6-setup.exe`. Expect honest **OFFLINE** state (sidecar down).
2. Themes, navigation, all custom dropdowns, and Settings persistence are testable now.
3. For live data: run `cd backend && uv run uvicorn api.main:app --host 0.0.0.0 --port 5055` (set `OPEN_NOTEBOOK_ENCRYPTION_KEY`) → Topbar flips **ONLINE v…**.
4. For Ollama model dropdowns: have Ollama running, set the endpoint in Settings → Local Models, click the discover button next to a model field.
