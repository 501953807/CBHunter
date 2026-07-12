"""Realtime notification ticket regression tests."""

import asyncio

from app.services.realtime_service import consume_ticket, issue_ticket


def test_realtime_ticket_is_single_use():
    async def run():
        ticket = await issue_ticket("user-a")
        assert await consume_ticket(ticket) == "user-a"
        assert await consume_ticket(ticket) is None

    asyncio.run(run())
