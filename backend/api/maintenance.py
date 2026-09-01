from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database.session import get_db
from backend.models.domain import Maintenance, Equipment, EquipmentStatus, User, UserRole
from backend.schemas.domain import MaintenanceCreate, MaintenanceUpdate, MaintenanceResponse
from backend.services.auth import get_current_user, require_role

router = APIRouter(prefix="/api/maintenance", tags=["Maintenance"])

def format_maint_response(m: Maintenance) -> MaintenanceResponse:
    return MaintenanceResponse(
        id=m.id,
        equipment_id=m.equipment_id,
        maintenance_type=m.maintenance_type,
        description=m.description,
        scheduled_date=m.scheduled_date,
        completed_date=m.completed_date,
        status=m.status,
        equipment_code=m.equipment.equipment_id if m.equipment else f"EQ-{m.equipment_id}"
    )

@router.get("", response_model=List[MaintenanceResponse])
def list_maintenance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    records = db.query(Maintenance).order_by(Maintenance.scheduled_date.desc()).all()
    return [format_maint_response(m) for m in records]

@router.post("", response_model=MaintenanceResponse)
def schedule_maintenance(
    request: MaintenanceCreate,
    current_user: User = Depends(require_role([UserRole.MANAGER])),
    db: Session = Depends(get_db)
):
    equipment = db.query(Equipment).filter(Equipment.id == request.equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    maint = Maintenance(
        equipment_id=request.equipment_id,
        maintenance_type=request.maintenance_type,
        description=request.description,
        scheduled_date=request.scheduled_date,
        status="SCHEDULED"
    )
    db.add(maint)
    db.commit()
    db.refresh(maint)
    return format_maint_response(maint)

@router.patch("/{maint_id}", response_model=MaintenanceResponse)
def update_maintenance(
    maint_id: int,
    request: MaintenanceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    maint = db.query(Maintenance).filter(Maintenance.id == maint_id).first()
    if not maint:
        raise HTTPException(status_code=404, detail="Maintenance record not found")

    if request.status:
        maint.status = request.status
        if request.status == "COMPLETED":
            maint.completed_date = request.completed_date or datetime.utcnow()
            if maint.equipment and maint.equipment.status == EquipmentStatus.MAINTENANCE:
                maint.equipment.status = EquipmentStatus.AVAILABLE
        elif request.status == "IN_PROGRESS":
            if maint.equipment:
                maint.equipment.status = EquipmentStatus.MAINTENANCE

    db.commit()
    db.refresh(maint)
    return format_maint_response(maint)
