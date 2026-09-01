import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from backend.services.websocket_manager import ws_manager
from backend.services.auth import SECRET_KEY, ALGORITHM

router = APIRouter(tags=["WebSockets"])

@router.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(
    websocket: WebSocket,
    token: str = Query(None)
):
    # Validate JWT Authentication
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Authentication token required")
        return

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token payload")
            return
    except jwt.PyJWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Could not validate credentials")
        return

    # Authenticated client connection accepted
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; receive ping/messages from client if any
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
