"""Unit-level checks for the runtime order status state machine."""

import asyncio
from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.schemas.order import OrderStatusUpdate
from app.services.order_service import _validate_order_status_transition
from support.db import create_sqlite_sessionmaker, seed_order_statuses


def test_order_status_state_machine_uses_runtime_dictionary(tmp_path):
    async def run_test():
        engine, sessionmaker = await create_sqlite_sessionmaker(tmp_path / "order-status-unit.db")
        try:
            async with sessionmaker() as session:
                await seed_order_statuses(session)

                await _validate_order_status_transition(
                    session,
                    "pending",
                    OrderStatusUpdate(status="processing"),
                )

                with pytest.raises(ValueError, match="invalid_order_status_transition"):
                    await _validate_order_status_transition(
                        session,
                        "processing",
                        OrderStatusUpdate(status="delivered"),
                    )

                with pytest.raises(ValueError, match="manual_override_reason_required"):
                    await _validate_order_status_transition(
                        session,
                        "processing",
                        OrderStatusUpdate(status="delivered", manual_override=True),
                    )

                await _validate_order_status_transition(
                    session,
                    "processing",
                    OrderStatusUpdate(
                        status="delivered",
                        manual_override=True,
                        reason="平台后台人工确认已签收，补录历史状态",
                    ),
                )
        finally:
            await engine.dispose()

    asyncio.run(run_test())
