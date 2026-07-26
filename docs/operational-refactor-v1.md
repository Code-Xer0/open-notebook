# CODEX Operational Refactor V1

Status: implementation guide. This document is source-level only and is excluded from packaged app output.

## Goal

Make CODEX operational before expanding the surface area. The app should prove its basic loop every release:

1. Sidecars launch from local/bundled resources without Docker.
2. Sources can be stored as durable local notebook context.
3. Evidence assets, duplicate hints, and audit events are created.
4. Chat context builds from stored sources.
5. Provider-backed actions block truthfully until backend credentials and default models are usable.
6. Image and voice lanes create durable capsules/manifests without fake extraction or fake generation claims.

## NotebookLM-Py Primitives To Adapt

`teng-lin/notebooklm-py` is useful as an architecture reference, not a dependency. Its relevant primitives are:

- adapter separation: CLI, MCP, REST/server surfaces over a shared app/core layer;
- typed facade APIs for notebooks, sources, chat, notes, artifacts, labels, settings, and sharing;
- explicit source/artifact workflows with wait/download/export steps;
- capability and stability documentation around unofficial/fragile upstream APIs;
- repeatable smoke/release checks for docs, CLI, Python API, and package outputs.

CODEX should adapt the layering pattern locally:

- backend service core for notebooks, sources, evidence, chat, image capsules, voice capsules, and reading manifests;
- thin FastAPI routers and renderer services as adapters;
- future MCP adapters that call the same backend service layer rather than duplicating business logic;
- artifact exports that always attach file assets, hashes, provenance, and notebook source context cards.

## ElevenLabs-Style Voice Primitives To Build

The official ElevenLabs MCP shape is a good external reference for voice tooling, especially:

- text-to-speech generation;
- voice library and voice design;
- voice conversion/cloning with rights gates;
- speech-to-text/transcription;
- sound effects and audio isolation;
- output modes that either save files, return MCP resources, or both.

CODEX should keep these as provider adapters behind the existing Voice Capsule doctrine:

- `elevenlabs_speech` TTS adapter;
- `elevenlabs_voice_design` audition/import lane;
- `elevenlabs_stt` transcript QA lane;
- `audio_output_mode: file_asset | mcp_resource | both`;
- hard rights blockers before export/publish;
- credential truth only from backend credential tests, never localStorage drafts.

## Test Spine

`npm run smoke:operational` is the first executable test spine. It launches throwaway local sidecars and checks:

- `/health`;
- `/api/diagnostics`;
- notebook create;
- text source storage and evidence hashes;
- duplicate source hints;
- `/api/chat/context`;
- `/api/chat/execute` blocked without provider/model readiness;
- image capsule intake, confirmation, and publish;
- voice capsule, manuscript, reading manifest, and provider-missing render block;
- evidence snapshot/assets/events.

This runner should be extended before each new major capability. A feature is not operational until it has a smoke check that proves the happy path or the truthful blocker.
