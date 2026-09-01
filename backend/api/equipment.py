from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from backend.database.session import get_db
from backend.models.domain import Equipment, User, UserRole, Site, EquipmentStatus, Rental, RentalStatus, Alert, Maintenance, UsageLog
from backend.schemas.domain import EquipmentCreate, EquipmentUpdate, EquipmentResponse, EquipmentDetailResponse, RentalResponse, UsageLogResponse, AlertResponse, MaintenanceResponse
from backend.services.auth import get_current_user, require_role
from backend.services.fleet_intelligence import calculate_utilization, compute_equipment_health

router = APIRouter(prefix="/api/equipment", tags=["Equipment"])

def build_equipment_response(item: Equipment, db: Session) -> EquipmentResponse:
    site_name = item.site.site_name if item.site else "Unassigned / Depot"
    operator_name = item.operator.name if item.operator else "Unassigned"

    active_alerts = db.query(Alert).filter(Alert.equipment_id == item.id, Alert.is_resolved == False).all()
    active_maint = db.query(Maintenance).filter(Maintenance.equipment_id == item.id, Maintenance.status == "IN_PROGRESS").all()
    health_info = compute_equipment_health(item, active_alerts, active_maint)

    item.utilization = calculate_utilization(item.engine_hours, item.idle_hours)

    return EquipmentResponse(
        id=item.id,
        equipment_id=item.equipment_id,
        equipment_type=item.equipment_type,
        model=item.model,
        status=item.status,
        site_id=item.site_id,
        operator_id=item.operator_id,
        latitude=item.latitude,
        longitude=item.longitude,
        engine_hours=item.engine_hours,
        idle_hours=item.idle_hours,
        fuel_usage=item.fuel_usage,
        utilization=item.utilization,
        qr_code=item.qr_code,
        created_at=item.created_at,
        site_name=site_name,
        operator_name=operator_name,
        health_status=health_info["status"],
        health_score=health_info.get("health_score", 100.0)
    )

@router.get("", response_model=List[EquipmentResponse])
@router.get("/", response_model=List[EquipmentResponse])
def list_equipment(
    status: Optional[EquipmentStatus] = None,
    site_id: Optional[int] = None,
    equipment_type: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = Query(default="equipment_id", description="Sort by equipment_id, utilization, engine_hours, model"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Equipment)

    if current_user.role == UserRole.OPERATOR:
        query = query.filter(
            (Equipment.operator_id == current_user.id) | (Equipment.status == EquipmentStatus.AVAILABLE)
        )

    if status:
        query = query.filter(Equipment.status == status)
    if site_id:
        query = query.filter(Equipment.site_id == site_id)
    if equipment_type:
        query = query.filter(Equipment.equipment_type == equipment_type)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Equipment.equipment_id.ilike(search_pattern)) |
            (Equipment.model.ilike(search_pattern)) |
            (Equipment.equipment_type.ilike(search_pattern))
        )

    if sort_by == "utilization":
        query = query.order_by(Equipment.utilization.desc())
    elif sort_by == "engine_hours":
        query = query.order_by(Equipment.engine_hours.desc())
    elif sort_by == "model":
        query = query.order_by(Equipment.model.asc())
    else:
        query = query.order_by(Equipment.equipment_id.asc())

    equipment_list = query.all()
    return [build_equipment_response(e, db) for e in equipment_list]

@router.get("/{id_or_code}/details", response_model=EquipmentDetailResponse)
def get_equipment_full_details(
    id_or_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if id_or_code.isdigit():
        item = db.query(Equipment).filter(Equipment.id == int(id_or_code)).first()
    else:
        item = db.query(Equipment).filter(Equipment.equipment_id == id_or_code).first()

    if not item:
        raise HTTPException(status_code=404, detail="Equipment asset not found")

    item.utilization = calculate_utilization(item.engine_hours, item.idle_hours)
    db.commit()

    base_resp = build_equipment_response(item, db)

    active_rental_obj = db.query(Rental).filter(
        Rental.equipment_id == item.id,
        Rental.status.in_([RentalStatus.ACTIVE, RentalStatus.OVERDUE])
    ).first()

    active_rental_resp = None
    if active_rental_obj:
        active_rental_resp = RentalResponse(
            id=active_rental_obj.id,
            equipment_id=active_rental_obj.equipment_id,
            operator_id=active_rental_obj.operator_id,
            site_id=active_rental_obj.site_id,
            checkout_time=active_rental_obj.checkout_time,
            expected_return_time=active_rental_obj.expected_return_time,
            actual_return_time=active_rental_obj.actual_return_time,
            status=active_rental_obj.status,
            equipment_code=item.equipment_id,
            equipment_model=item.model,
            operator_name=active_rental_obj.operator.name if active_rental_obj.operator else "Unassigned",
            site_name=active_rental_obj.site.site_name if active_rental_obj.site else "Site Location"
        )

    active_alerts = db.query(Alert).filter(Alert.equipment_id == item.id, Alert.is_resolved == False).all()
    active_maint = db.query(Maintenance).filter(Maintenance.equipment_id == item.id, Maintenance.status == "IN_PROGRESS").all()
    is_overdue = active_rental_obj.status == RentalStatus.OVERDUE if active_rental_obj else False
    health_info = compute_equipment_health(item, active_alerts, active_maint, is_overdue=is_overdue)

    recent_logs_objs = db.query(UsageLog).filter(UsageLog.equipment_id == item.id).order_by(UsageLog.timestamp.desc()).limit(10).all()
    recent_logs = [UsageLogResponse.model_validate(l) for l in recent_logs_objs]

    recent_alerts_objs = db.query(Alert).filter(Alert.equipment_id == item.id).order_by(Alert.created_at.desc()).limit(10).all()
    recent_alerts = [
        AlertResponse(
            id=a.id,
            equipment_id=a.equipment_id,
            alert_type=a.alert_type,
            severity=a.severity,
            message=a.message,
            created_at=a.created_at,
            is_resolved=a.is_resolved,
            equipment_code=item.equipment_id
        ) for a in recent_alerts_objs
    ]

    recent_maint_objs = db.query(Maintenance).filter(Maintenance.equipment_id == item.id).order_by(Maintenance.scheduled_date.desc()).limit(5).all()
    recent_maint = [
        MaintenanceResponse(
            id=m.id,
            equipment_id=m.equipment_id,
            maintenance_type=m.maintenance_type,
            description=m.description,
            scheduled_date=m.scheduled_date,
            completed_date=m.completed_date,
            status=m.status,
            equipment_code=item.equipment_id
        ) for m in recent_maint_objs
    ]

    resp_data = base_resp.model_dump()
    resp_data.update({
        "health_score": health_info.get("health_score", base_resp.health_score or 100.0),
        "health_status": health_info["status"],
        "health_reasons": health_info["reasons"],
        "active_rental": active_rental_resp,
        "recent_logs": recent_logs,
        "recent_alerts": recent_alerts,
        "recent_maintenance": recent_maint
    })
    return EquipmentDetailResponse(**resp_data)

@router.get("/{id_or_code}", response_model=EquipmentResponse)
def get_equipment_detail_single(
    id_or_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if id_or_code.isdigit():
        item = db.query(Equipment).filter(Equipment.id == int(id_or_code)).first()
    else:
        item = db.query(Equipment).filter(Equipment.equipment_id == id_or_code).first()

    if not item:
        raise HTTPException(status_code=404, detail="Equipment asset not found")
    return build_equipment_response(item, db)

@router.post("", response_model=EquipmentResponse)
@router.post("/", response_model=EquipmentResponse)
def create_equipment(
    request: EquipmentCreate,
    current_user: User = Depends(require_role([UserRole.MANAGER])),
    db: Session = Depends(get_db)
):
    existing = db.query(Equipment).filter(Equipment.equipment_id == request.equipment_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Equipment ID already exists")

    util = calculate_utilization(request.engine_hours, request.idle_hours)
    item = Equipment(
        equipment_id=request.equipment_id,
        equipment_type=request.equipment_type,
        model=request.model,
        status=request.status,
        site_id=request.site_id,
        operator_id=request.operator_id,
        latitude=request.latitude,
        longitude=request.longitude,
        engine_hours=request.engine_hours,
        idle_hours=request.idle_hours,
        fuel_usage=request.fuel_usage,
        utilization=util,
        qr_code=request.qr_code or f"QR-{request.equipment_id}"
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return build_equipment_response(item, db)

@router.patch("/{equipment_id_val}", response_model=EquipmentResponse)
def update_equipment(
    equipment_id_val: int,
    request: EquipmentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(Equipment).filter(Equipment.id == equipment_id_val).first()
    if not item:
        raise HTTPException(status_code=404, detail="Equipment asset not found")

    if current_user.role == UserRole.OPERATOR and item.operator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this equipment")

    update_data = request.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(item, field, val)

    item.utilization = calculate_utilization(item.engine_hours, item.idle_hours)

    db.commit()
    db.refresh(item)
    return build_equipment_response(item, db)
