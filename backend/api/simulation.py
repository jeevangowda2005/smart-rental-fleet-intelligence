from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from backend.models.domain import User, UserRole
from backend.services.auth import get_current_user, require_role
from backend.services.simulator import simulator_engine

router = APIRouter(prefix="/api/simulation", tags=["Simulation Control"])

class SpeedRequest(BaseModel):
    speed: int = Field(..., description="1 for 1x, 2 for 2x, 5 for 5x")

@router.get("/status")
def get_simulation_status(current_user: User = Depends(get_current_user)):
    return {
        "is_running": simulator_engine.is_running,
        "speed": simulator_engine.speed,
        "label": "DEMO LIVE SIMULATION — NOT LIVE HARDWARE DATA"
    }

@router.post("/start")
def start_simulation(current_user: User = Depends(require_role([UserRole.MANAGER]))):
    simulator_engine.start()
    return {
        "message": "Demo telemetry simulation started",
        "is_running": True,
        "label": "DEMO LIVE SIMULATION — NOT LIVE HARDWARE DATA"
    }

@router.post("/pause")
def pause_simulation(current_user: User = Depends(require_role([UserRole.MANAGER]))):
    simulator_engine.pause()
    return {
        "message": "Demo telemetry simulation paused",
        "is_running": False,
        "label": "DEMO LIVE SIMULATION — NOT LIVE HARDWARE DATA"
    }

@router.post("/speed")
def set_simulation_speed(
    request: SpeedRequest,
    current_user: User = Depends(require_role([UserRole.MANAGER]))
):
    if request.speed not in [1, 2, 5]:
        raise HTTPException(status_code=400, detail="Invalid speed multiplier. Supported values: 1, 2, 5")
    
    simulator_engine.set_speed(request.speed)
    return {
        "message": f"Simulation speed updated to {request.speed}x",
        "speed": request.speed,
        "label": "DEMO LIVE SIMULATION — NOT LIVE HARDWARE DATA"
    }
