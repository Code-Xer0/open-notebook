from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


ARTIFACT_WORKFLOWS: dict[str, dict[str, Any]] = {
    "source_upload": {
        "maturity": "v1_operational",
        "steps": ["create", "preserve_original", "derive_text", "publish_to_notebook", "record_evidence"],
        "sourceOfTruth": "source + file_asset + file_derivative",
    },
    "image_capsule": {
        "maturity": "v1_operational",
        "steps": ["intake", "confirm_metadata", "annotate_regions", "publish_context_card", "record_evidence"],
        "sourceOfTruth": "image_capsule + source + file_asset + file_derivative",
    },
    "reading_manifest": {
        "maturity": "v1_provider_gated",
        "steps": ["create", "lock", "render_or_block", "review_takes", "publish_context_card", "record_evidence"],
        "sourceOfTruth": "reading_manifest + performance_take + audio_asset + source",
    },
    "audio_adapter": {
        "maturity": "contract_only",
        "steps": ["probe_provider", "generate", "preserve_audio", "return_file_or_resource", "record_evidence"],
        "sourceOfTruth": "voice_capsule + audio_asset + file_asset + artifact_event",
    },
}


def get_artifact_workflow_contracts(*, evidence_ready: bool) -> dict[str, dict[str, Any]]:
    """Return the internal artifact workflow contract for diagnostics/adapters."""
    now = datetime.now(timezone.utc).isoformat()
    result: dict[str, dict[str, Any]] = {}
    for workflow_id, workflow in ARTIFACT_WORKFLOWS.items():
        contract_only = workflow["maturity"] == "contract_only"
        status = "blocked" if contract_only else "ready" if evidence_ready else "not verified"
        blocking_reason = None
        if contract_only:
            blocking_reason = "Contract is documented for future adapters; no V1 execution path is bundled."
        elif not evidence_ready:
            blocking_reason = "Evidence vault must be writable before artifact workflows are trustworthy."
        result[workflow_id] = {
            "id": workflow_id,
            **workflow,
            "status": status,
            "lastProbeAt": now,
            "blockingReason": blocking_reason,
            "evidence": (
                "Workflow writes through evidence spine."
                if status == "ready"
                else blocking_reason
            ),
        }
    return result
