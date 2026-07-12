"""Tests for the platform-neutral paginated order sync contract."""

import asyncio
from types import SimpleNamespace

from app.services.sync_service import SyncService


def test_order_page_fetch_collects_all_unique_remote_orders():
    class FakeClient:
        async def get_orders(self, start_at, end_at, page=1, page_size=50):
            pages = {
                1: [SimpleNamespace(platform_order_id="1"), SimpleNamespace(platform_order_id="2")],
                2: [SimpleNamespace(platform_order_id="2"), SimpleNamespace(platform_order_id="3")],
            }
            return pages.get(page, []), 3

    service = SyncService(None)
    items = asyncio.run(service._fetch_order_pages(FakeClient(), None, None))

    assert [item.platform_order_id for item in items] == ["1", "2", "3"]
