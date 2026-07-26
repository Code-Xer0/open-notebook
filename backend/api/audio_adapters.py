from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from api.credentials_service import get_provider_status


AUDIO_ADAPTERS: dict[str, dict[str, Any]] = {
    "openai_speech": {
        "provider": "openai",
        "capabilities": ["text_to_speech"],
        "outputModes": ["file_asset"],
        "runtime": "backend_http",
        "maturity": "v1_render",
    },
    "openai_stt": {
        "provider": "openai",
        "capabilities": ["speech_to_text"],
        "outputModes": ["file_asset", "metadata"],
        "runtime": "backend_http",
        "maturity": "planned_qa_lane",
    },
    "elevenlabs_speech": {
        "provider": "elevenlabs",
        "capabilities": ["text_to_speech"],
        "outputModes": ["file_asset", "mcp_resource", "both"],
        "runtime": "provider_adapter",
        "maturity": "contract_only",
    },
    "elevenlabs_stt": {
        "provider": "elevenlabs",
        "capabilities": ["speech_to_text"],
        "outputModes": ["file_asset", "metadata", "mcp_resource"],
        "runtime": "provider_adapter",
        "maturity": "contract_only",
    },
    "elevenlabs_voice_design": {
        "provider": "elevenlabs",
        "capabilities": ["voice_design", "voice_library"],
        "outputModes": ["metadata", "mcp_resource"],
        "runtime": "provider_adapter",
        "maturity": "contract_only",
    },
    "elevenlabs_voice_conversion": {
        "provider": "elevenlabs",
        "capabilities": ["voice_conversion"],
        "outputModes": ["file_asset", "mcp_resource", "both"],
        "runtime": "provider_adapter",
        "maturity": "contract_only",
        "rightsGate": "requires locked Voice Capsule rights proof before use",
    },
    "elevenlabs_sound_effects": {
        "provider": "elevenlabs",
        "capabilities": ["sound_effects"],
        "outputModes": ["file_asset", "mcp_resource", "both"],
        "runtime": "provider_adapter",
        "maturity": "contract_only",
    },
    "elevenlabs_audio_isolation": {
        "provider": "elevenlabs",
        "capabilities": ["audio_isolation"],
        "outputModes": ["file_asset", "mcp_resource", "both"],
        "runtime": "provider_adapter",
        "maturity": "contract_only",
    },
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def get_audio_adapter_capabilities() -> dict[str, dict[str, Any]]:
    """Return factual audio adapter readiness.

    This is intentionally separate from concrete generation code. It gives
    FastAPI, the renderer, and future MCP tools the same provider/rights truth
    without making ElevenLabs or any other provider a hard runtime dependency.
    """
    provider_status = await get_provider_status()
    present = provider_status.get("present", {})
    usable = provider_status.get("usable", {})
    source = provider_status.get("source", {})
    last_tested = provider_status.get("lastTested", {})
    last_success = provider_status.get("lastTestSuccess", {})
    last_message = provider_status.get("lastTestMessage", {})

    facts: dict[str, dict[str, Any]] = {}
    for adapter_id, adapter in AUDIO_ADAPTERS.items():
        provider = adapter["provider"]
        provider_present = bool(present.get(provider))
        provider_usable = bool(usable.get(provider))
        status = (
            "ready"
            if provider_usable
            else "not verified"
            if provider_present
            else "provider missing"
        )
        blocking_reason = None
        if status == "not verified":
            blocking_reason = (
                f"{provider} material is present, but no backend credential test has passed."
            )
        elif status == "provider missing":
            blocking_reason = f"Configure and test a backend {provider} credential."

        if adapter["maturity"] == "contract_only" and status == "ready":
            status = "blocked"
            blocking_reason = (
                f"{adapter_id} is defined as a CODEX adapter contract, but no V1 renderer/worker implementation is bundled yet."
            )

        facts[adapter_id] = {
            "id": adapter_id,
            **adapter,
            "status": status,
            "providerPresent": provider_present,
            "providerUsable": provider_usable,
            "credentialSource": source.get(provider, "none"),
            "lastTested": last_tested.get(provider),
            "lastTestSuccess": last_success.get(provider),
            "lastTestMessage": last_message.get(provider),
            "lastProbeAt": _now(),
            "blockingReason": blocking_reason,
            "evidence": (
                f"{provider} backend credential usable={provider_usable}; adapter maturity={adapter['maturity']}."
            ),
        }
    return facts
