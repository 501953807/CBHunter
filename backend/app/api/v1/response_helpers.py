"""Shared API response helpers."""

from app.schemas.common import ApiResponse


def evidence_response(payload: dict, *, status: str | None = None) -> ApiResponse:
    """Promote standard evidence fields from a payload to ApiResponse top level."""
    resolved_status = (
        status
        or payload.get("status")
        or payload.get("data_status")
        or ("data_required" if payload.get("data_gaps") else "ready")
    )
    return ApiResponse(
        data=payload,
        status=resolved_status,
        source_refs=payload.get("source_refs") or [],
        evidence_window=payload.get("evidence_window"),
        confidence_reason=payload.get("confidence_reason"),
        data_gaps=payload.get("data_gaps") or [],
    )
