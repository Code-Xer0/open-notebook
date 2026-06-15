# Codex — Antigravity Team Handoff Notes

> Comprehensive handoff for the **Antigravity team** picking up the Codex knowledge-workstation
> frontend. Written 2026-06-15 by Claude after the data-truth + UI/liveliness passes. The repo is on
> a **clean slate** (`master`, working tree clean). **Core doctrine first: no mock data, honest
> states, no fabricated success. Liveliness is visual only — never let motion imply data that isn't
> there.**

---

## 1. What Codex is
**Electron + React 19 + Vite** desktop shell over an embedded **open-notebook** backend
(**FastAPI + SurrealDB**, in `backend/`). A local-first knowledge workstation: notebooks, sources,
chat, podcasts, **Nexus** corpus, narrative studio, model routing.

- Renderer ↔ backend over HTTP at **`http://localhost:5055/api`**.
- Backend protects most routes with `PasswordAuthMiddleware` (default token `open-notebook-change-me`); only root `/health`, `/api/config`, `/api/auth/status` are unauthenticated.
- Vendored binaries (`resources/bin/surreal.exe` 108 MB, `backend/dist/backend.exe`) are **gitignored** — build/fetch locally.

```
src/renderer/src/
  App.tsx            route shell; starts the backend monitor
  services/
    api.ts           axios client (baseURL=/api, auth interceptor, system.health)
    health.ts        single backend monitor → store.backend + telemetry
  store/useStore.ts  zustand store (persisted settings + ephemeral runtime state)
  components/        Select, ModelSelect, BackendStatus, Card, Sidebar, Topbar, …
  pages/             Dashboard, Settings, Sources, Notebooks, Nexus, Podcasts, NarrativeStudio
  index.css         theme system (7 families × 3 densities) + LIVELINESS LAYER
backend/             open-notebook FastAPI/SurrealDB service (api/, open_notebook/)
```

## 2. The golden rule (read this twice)
The operator explicitly values **truthful-ugly over pretty-fake**. Earlier passes ripped out fake
`A-`/`98%`/`Excellent`/`ONLINE`/"Last test: OK" posture. **Do not reintroduce it.** Every status must
come from real backend state, a real local query, or an explicit honest placeholder:
`Unknown` · `Not configured` · `Offline` · `Awaiting import` · `health unknown` · `Connecting…`.
A control that isn't wired says so; it never shows green.

## 3. Data-truth layer (how state flows)
- **`services/health.ts`** is the single source of connectivity. It polls the auth-excluded root
  `/health` every 8s → sets `store.backend.status` (`online|offline|connecting|unknown`) + version,
  and pulls `/api/telemetry/summary` when online (honest `Unknown` otherwise). Started once in `App.tsx`.
- **Everything reads the store** — never fetch connectivity per-component. Topbar, Dashboard,
  Sidebar, Settings → General all reflect `backend.status`.
- **`store/useStore.ts`** persists ONLY `settings` to `localStorage` (`codex-settings`, via zustand
  `persist` + `partialize`). Telemetry/backend stay ephemeral. Settings auto-save on change.
- **Auth token**: `localStorage codex.accessToken` (default = upstream dev password). Never a provider
  key; never displayed/logged.

## 4. Component conventions
- **`Select`** (`components/Select.tsx`) — use this for EVERY dropdown. Never a native `<select>`
  (its popup + scrollbar are Windows-stock and unstylable). Props: `value`, `onChange(value)`,
  `options: (string | {value,label})[]`, `ariaLabel`.
- **`ModelSelect`** — editable model field with live discovery. `source="ollama"` queries the local
  daemon `{endpoint}/api/tags`; `source="cloud"` asks backend `/api/models`. Honest phase states
  (loading/ok/empty/error). Manual typing always works.
- **`BackendStatus`** — the honest connectivity chip; reads the store.
- Styling is **inline-style + CSS-var heavy**. Always use theme tokens (`--accent-primary`,
  `--signal-*`, `--text-*`, `--panel-*`, `--pad-*`, `--radius-*`) — never hardcoded hex. (We migrated
  the last `#4caf50`/`#2196f3` offenders to vars.)

## 5. Liveliness layer (this pass) — `index.css`, bottom block
Inspired by **Hyperion Nest (Aviary skin)** + **Scen.OS Home** HUD motion. All of it is visual.

- **Global speed dial:** `--motion` (default `0.9`). Every animation is `calc(<time> / var(--motion))`.
  Raise it for snappier, lower for calmer. **Wire this to a Settings "Motion" control** (like Nest's
  Aviary/Foundry presets) as a good next task.
- **Ambient:** `.field` slow-drifts; `.field::before` grid breathes.
- **Entrances:** `.glass-card` rises in on mount; `.tele-grid > *` and `.sc-link` stagger
  (nth-child delays). Uses `animation-fill-mode: backwards` so hover transforms stay intact after.
- **Living indicators:** `.live-breathe` (online dot pulse), `.live-pulse` (connecting ring). Applied
  in `BackendStatus`/`Topbar`. Set `--ring` inline for pulse color.
- **Micro:** `.glass-card:hover::after` sheen sweep; `.btn.primary:hover` animated accent (`holoShift`);
  `.sc-link:hover` glide.
- **Accessibility:** a `prefers-reduced-motion: reduce` block neutralizes all of it. **Keep that block
  intact** whenever you add motion. Add new keyframes near the others and gate speed by `--motion`.

## 6. Build / run / package
```
npm run dev            # Electron + Vite dev (HMR)
npm run typecheck:web  # renderer types — MUST stay 0 errors
npm run build          # renderer + main + preload (esbuild; no backend needed)
npx electron-builder --win    # repackage installer reusing prebuilt backend.exe
npm run build:win      # full: build:backend (uv+pyinstaller) + build + package
```
- Latest installer: **`dist/electron-app-1.0.7-setup.exe`** (149 MB; SHA-256 in the `.sha256` sidecar).
- `electron-vite build` does NOT typecheck — **always run `typecheck:web` too** before shipping.

## 7. Status: real / scaffolded / next
**Real & verified:** `/api` wiring + auth, backend health monitor, honest telemetry, custom dropdowns
everywhere, settings persistence, Ollama model discovery, liveliness layer. typecheck 0 / build green.

**Scaffolded (honest "unavailable", NOT done):**
- Provider **Test/Health** buttons (Ollama/cloud/edge/embeddings/OCR) — not yet wired to backend
  `POST /api/credentials/{id}/test` + `/discover`. Status stays "health unknown."
- Per-section **Save/Reset** buttons — pre-existing no-ops (persistence is automatic now; remove or wire to `/api/settings`).
- **OCR / Vision / Video** ingestion, **Nexus** import, **cloud** model discovery — empty/honest states only.

**Suggested next tasks (priority):**
1. **Wire provider health** → real green only on a successful `/api/credentials/{id}/test` round-trip (save key → get id → test). This is the single highest-value truth win.
2. **Debug the sidecar** — `backend.exe` runs standalone but the bundled spawn in `src/main` doesn't auto-load, so installs read OFFLINE. Fix the spawn/path/port handshake.
3. **Motion presets** in Settings → Themes (Calm/Standard/Lively) driving `--motion`; persist it.
4. OCR/Vision/Video lanes + Nexus importer (replace placeholder blocks).
5. Remove dead per-section Save/Reset buttons.

## 8. Gotchas
- **Codex is on `master`** and the team works directly there (operator-directed). Commit by explicit
  path — **never `git add -A`** (it would sweep the 108 MB `surreal.exe`; `.gitignore` now guards most).
- `telemetry` fields are `number | 'Unknown'` — guard with `typeof x === 'number'` before numeric ops
  (we fixed two pre-existing `> 0` type errors in `SourcePipelineCard`).
- Don't reintroduce native `<select>`, hardcoded hex, or fabricated status.
- **Secrets:** never read/commit `.env*`, keys, tokens. `.gitignore` covers them; keep it that way.
- The installer currently shows **OFFLINE everywhere** by design (sidecar down) — now with lively
  motion. That's correct, not a bug.

## 9. Reference repos for design language
- **Hyperion Nest** `Hyperion Nest/nest/*.css` — Aviary motion (`breathe`, `halo-bob`, `drift`,
  `fade-step`, `surface-in`, `holo`), `--motion` multiplier, segmented controls, section-label gradient rules.
- **Scen.OS Home** / **scen-os-design-system** — glass-HUD operator tokens.
Borrow vocabulary, keep Codex's own theme tokens.
