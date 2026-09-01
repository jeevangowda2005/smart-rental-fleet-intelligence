from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database.session import get_db
from backend.models.domain import UsageLog, Equipment, User, UserRole
from backend.schemas.domain import UsageLogCreate, UsageLogResponse
from backend.services.auth import get_current_user
from backend.services.fleet_intelligence import calculate_utilization

router = APIRouter(prefix="/api/logs", tags=["Usage Logs"])

@router.get("/equipment/{equipment_id}", response_model=List[UsageLogResponse])
def get_equipment_logs(
    equipment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    logs = (
        db.query(UsageLog)
        .filter(UsageLog.equipment_id == equipment_id)
        .order_by(UsageLog.timestamp.desc())
        .limit(100)
        .all()
    )
    return logs

@router.post("", response_model=UsageLogResponse)
@router.post("/", response_model=UsageLogResponse)
def create_log(
    request: UsageLogCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    equipment = db.query(Equipment).filter(Equipment.id == request.equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment asset not found")

    # Operators can only log usage for assigned equipment
    if current_user.role == UserRole.OPERATOR and equipment.operator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to log usage for this equipment")

    # Validation: non-negative meter values
    if request.engine_hours < 0 or request.idle_hours < 0 or request.fuel_usage < 0:
        raise HTTPException(status_code=400, detail="Engine hours, idle hours, and fuel usage values cannot be negative")

    if request.engine_hours < equipment.engine_hours:
        raise HTTPException(
            status_code=400,
            detail=f"Submitted engine meter ({request.engine_hours} hrs) cannot be less than existing recorded meter ({equipment.engine_hours} hrs)"
        )

    log = UsageLog(
        equipment_id=request.equipment_id,
        engine_hours=request.engine_hours,
        idle_hours=request.idle_hours,
        fuel_usage=request.fuel_usage,
        latitude=request.latitude,
        longitude=request.longitude,
        operating_status=request.operating_status
    )
    db.add(log)

    # Sync equipment telemetry and recalculate utilization
    equipment.engine_hours = request.engine_hours
    equipment.idle_hours = request.idle_hours
    equipment.fuel_usage = request.fuel_usage
    equipment.latitude = request.latitude
    equipment.longitude = request.longitude
    equipment.utilization = calculate_utilization(request.engine_hours, request.idle_hours)

    db.commit()
    db.refresh(log)
    return log
