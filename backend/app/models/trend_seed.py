"""Model for trend seed keywords — per-category, per-market seed terms for
Google Trends & Pinterest discovery.

Replaces the old hard-coded category seed dictionary. Seeds are stored as
individual rows so they can be enabled/disabled, auto-expired, and
discoverable per market.
"""

from datetime import datetime, timezone

from sqlalchemy import Column, String, Boolean, DateTime, Integer, JSON

from app.database import Base
from app.models.base import gen_uuid


class TrendSeed(Base):
    __tablename__ = "trend_seeds"

    id = Column(String, primary_key=True, default=gen_uuid)

    # Which category this seed belongs to (dict id, e.g. "electronics")
    category_id = Column(String(100), nullable=False, index=True)

    # Which market this seed targets (MY, PH, SG, …).  NULL = global seed
    # that applies to every market.
    market = Column(String(20), nullable=True, index=True)

    # The seed keyword phrase (e.g. "wireless earbuds")
    keyword = Column(String(200), nullable=False)

    # Whether this seed is active and will be used during sync
    is_active = Column(Boolean, default=True, nullable=False)

    # Whether this is a system default (pre-seeded) — survives "reset to
    # defaults" operations
    is_default = Column(Boolean, default=False, nullable=False)

    # Language of the keyword: "en", "zh", "th", "vi", "id", "auto"
    language = Column(String(10), default="en", nullable=False)

    # Optional: tags for grouping / filtering (e.g. ["hot", "evergreen"])
    tags = Column(JSON, default=list)

    # When this seed was last used in a sync
    last_used_at = Column(DateTime(timezone=True), nullable=True)

    # When this seed was created / updated
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
