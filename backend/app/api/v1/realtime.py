"""Authenticated same-port WebSocket endpoints."""

import logging
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services import realtime_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/realtime", tags=["realtime"])


@router.post("/ticket", response_model=ApiResponse)
async def create_realtime_ticket(current_user: User = Depends(get_current_user)):
    ticket = await realtime_service.issue_ticket(current_user.id)
    return ApiResponse(data={"ticket": ticket, "expires_in": realtime_service.TICKET_TTL_SECONDS})


@router.websocket("/notifications")
async def notification_socket(websocket: WebSocket, ticket: str):
    user_id = await realtime_service.consume_ticket(ticket)
    if not user_id:
        await websocket.close(code=4401, reason="Invalid or expired ticket")
        return
    await realtime_service.connect(user_id, websocket)
    try:
        while True:
            message = await websocket.receive_text()
            if message == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        await realtime_service.disconnect(user_id, websocket)
    except Exception as exc:
        logger.error("Realtime notification socket failed for user %s: %s", user_id, exc)
        await realtime_service.disconnect(user_id, websocket)
        await websocket.close()
