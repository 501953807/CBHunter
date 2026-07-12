"""Trend staging merge and persistence helpers."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trend_keyword import TrendKeyword


def cross_validate_staging(staging: list[dict]) -> int:
    """Cross-validate keywords that appear in both GT and Pinterest data."""
    gt_by_key: dict[str, dict] = {}
    pt_by_key: dict[str, dict] = {}
    for entry in staging:
        key = f"{entry['keyword'].lower().strip()}|{entry['market']}"
        (gt_by_key if entry["source"] == "google_trends" else pt_by_key)[key] = entry

    overlap = set(gt_by_key.keys()) & set(pt_by_key.keys())
    now = datetime.now(timezone.utc)

    for key in overlap:
        google_row = gt_by_key[key]
        pinterest_row = pt_by_key[key]

        google_row["has_pinterest_data"] = True
        google_row["pinterest_volume"] = pinterest_row.get("search_volume")
        google_row["pinterest_direction"] = pinterest_row.get("trend_direction")
        google_row["pinterest_growth"] = pinterest_row.get("growth_pct")
        google_row["pinterest_trend_data"] = pinterest_row.get("trend_data", [])

        score = 70
        direction_match = (
            google_row.get("trend_direction")
            and google_row.get("trend_direction") == pinterest_row.get("trend_direction")
        )
        if direction_match:
            score += 30

        google_row["cross_validation_score"] = score
        google_row["cross_validation_detail"] = {
            "signal_strength": "strong" if score >= 60 else ("moderate" if score >= 40 else "weak"),
            "match_type": "exact",
            "scoring_basis": "双源精确匹配70分；趋势方向一致加30分",
            "direction_match": bool(direction_match),
        }
        google_row["cross_validated_at"] = now
        if score >= 60:
            google_row["source"] = "cross"

    return len(overlap)


async def replace_trend_data(db: AsyncSession, staging: list[dict]) -> None:
    """Atomically replace system-collected trends without deleting user records."""
    for entry in staging:
        entry["id"] = str(uuid.uuid4())
        entry["user_id"] = None
        if not isinstance(entry.get("trend_data"), list):
            entry["trend_data"] = []
        if not isinstance(entry.get("pinterest_trend_data"), list):
            entry["pinterest_trend_data"] = []

    await db.execute(
        delete(TrendKeyword).where(
            TrendKeyword.user_id.is_(None),
            TrendKeyword.source.in_(["google_trends", "pinterest", "cross"]),
        )
    )
    await db.execute(insert(TrendKeyword), staging)
    await db.commit()
