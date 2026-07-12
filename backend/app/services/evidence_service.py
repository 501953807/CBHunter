"""Helpers for standardized evidence-chain payloads."""

from typing import Any, Iterable, Optional

from app.schemas.evidence import EvidenceChain, SourceRef


def source_ref(
    ref_type: str,
    ref_id: Optional[str] = None,
    *,
    field: Optional[str] = None,
    label: Optional[str] = None,
    fields: Optional[Iterable[str]] = None,
    meta: Optional[dict[str, Any]] = None,
) -> dict:
    ref = SourceRef(
        type=ref_type,
        id=ref_id,
        field=field,
        label=label,
        fields=list(fields or []),
        meta=meta or {},
    )
    data = ref.model_dump(exclude_none=True)
    return {key: value for key, value in data.items() if value not in ({}, [])}


def evidence_payload(
    *,
    source_refs: Optional[Iterable[dict]] = None,
    evidence_window: Optional[str] = None,
    confidence_reason: Optional[str] = None,
    data_gaps: Optional[Iterable[str]] = None,
) -> dict:
    chain = EvidenceChain(
        source_refs=[SourceRef.model_validate(item) for item in (source_refs or [])],
        evidence_window=evidence_window,
        confidence_reason=confidence_reason,
        data_gaps=list(data_gaps or []),
    )
    return {
        "source_refs": [source_ref(item.type, item.id, field=item.field, label=item.label,
                                   fields=item.fields, meta=item.meta) for item in chain.source_refs],
        "evidence_window": chain.evidence_window,
        "confidence_reason": chain.confidence_reason,
        "data_gaps": chain.data_gaps,
    }


def configuration_required(
    message: str,
    *,
    data_gaps: Iterable[str],
    source_refs: Optional[Iterable[dict]] = None,
    evidence_window: Optional[str] = None,
    confidence_reason: Optional[str] = None,
) -> dict:
    return {
        "status": "configuration_required",
        "message": message,
        **evidence_payload(
            source_refs=source_refs,
            evidence_window=evidence_window,
            confidence_reason=confidence_reason or message,
            data_gaps=data_gaps,
        ),
    }


def data_required(
    message: str,
    *,
    data_gaps: Iterable[str],
    source_refs: Optional[Iterable[dict]] = None,
    evidence_window: Optional[str] = None,
    confidence_reason: Optional[str] = None,
) -> dict:
    return {
        "status": "data_required",
        "message": message,
        **evidence_payload(
            source_refs=source_refs,
            evidence_window=evidence_window,
            confidence_reason=confidence_reason or message,
            data_gaps=data_gaps,
        ),
    }


def unique_refs(refs: Iterable[dict], limit: int = 50) -> list[dict]:
    seen: set[tuple[str, str, str]] = set()
    result: list[dict] = []
    for ref in refs:
        item = source_ref(
            str(ref.get("type", "unknown")),
            ref.get("id"),
            field=ref.get("field"),
            label=ref.get("label"),
            fields=ref.get("fields") or [],
            meta=ref.get("meta") or {},
        )
        key = (item.get("type", ""), item.get("id", ""), item.get("field", ""))
        if key in seen:
            continue
        seen.add(key)
        result.append(item)
        if len(result) >= limit:
            break
    return result
