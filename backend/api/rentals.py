from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database.session import get_db
from backend.models.domain import Rental, RentalStatus, Equipment, EquipmentStatus, User, Site, UserRole, Alert
from backend.schemas.domain import RentalCheckout, RentalCheckin, RentalResponse
from backend.services.auth import get_current_user, require_role

router = APIRouter(prefix="/api/rentals", tags=["Rentals"])

def process_overdue_rentals(db: Session):
    """
    Scans active rentals past expected return time.
    Updates status to OVERDUE and creates a deduplicated CRITICAL alert.
    """
    now = datetime.utcnow()
    overdue_rentals = db.query(Rental).filter(
        Rental.status == RentalStatus.ACTIVE,
        Rental.expected_return_time < now,
        Rental.actual_return_time.is_(None)
    ).all()

    for rental in overdue_rentals:
        rental.status = RentalStatus.OVERDUE
        if rental.equipment:
            rental.equipment.status = EquipmentStatus.OVERDUE

            # Deduplication check for active unresolved OVERDUE_RENTAL alert
            existing_alert = db.query(Alert).filter(
                Alert.equipment_id == rental.equipment.id,
                Alert.alert_type == "OVERDUE_RENTAL",
                Alert.is_resolved == False
            ).first()

            if not existing_alert:
                overdue_seconds = (now - rental.expected_return_time).total_seconds()
                overdue_hours = max(1, int(overdue_seconds / 3600))
                alert = Alert(
                    equipment_id=rental.equipment.id,
                    alert_type="OVERDUE_RENTAL",
                    severity="CRITICAL",
                    message=f"{rental.equipment.equipment_id} has exceeded its expected return time by {overdue_hours} hours.",
                    is_resolved=False
                )
                db.add(alert)
    db.commit()

def format_rental_response(r: Rental) -> RentalResponse:
    return RentalResponse(
        id=r.id,
        equipment_id=r.equipment_id,
        operator_id=r.operator_id,
        site_id=r.site_id,
        checkout_time=r.checkout_time,
        expected_return_time=r.expected_return_time,
        actual_return_time=r.actual_return_time,
        status=r.status,
        equipment_code=r.equipment.equipment_id if r.equipment else f"EQ-{r.equipment_id}",
        equipment_model=r.equipment.model if r.equipment else "",
        operator_name=r.operator.name if r.operator else "Unassigned",
        site_name=r.site.site_name if r.site else "Site Location"
    )

@router.get("", response_model=List[RentalResponse])
def list_rentals(
    status: Optional[RentalStatus] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Process overdue check
    process_overdue_rentals(db)

    query = db.query(Rental)
    if current_user.role == UserRole.OPERATOR:
        query = query.filter(Rental.operator_id == current_user.id)
    if status:
        query = query.filter(Rental.status == status)
    
    rentals = query.order_by(Rental.checkout_time.desc()).all()
    return [format_rental_response(r) for r in rentals]

@router.get("/my-active", response_model=Optional[RentalResponse])
def get_operator_active_rental(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    process_overdue_rentals(db)
    rental = db.query(Rental).filter(
        Rental.operator_id == current_user.id,
        Rental.status.in_([RentalStatus.ACTIVE, RentalStatus.OVERDUE])
    ).first()
    if not rental:
        return None
    return format_rental_response(rental)

@router.post("/checkout", response_model=RentalResponse)
def checkout_equipment(
    request: RentalCheckout,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    equipment = db.query(Equipment).filter(Equipment.id == request.equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment asset not found")
    
    if equipment.status not in [EquipmentStatus.AVAILABLE, EquipmentStatus.IDLE]:
        raise HTTPException(
            status_code=400,
            detail=f"Equipment {equipment.equipment_id} is currently {equipment.status.value} and cannot be checked out"
        )
    
    site = db.query(Site).filter(Site.id == request.site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Target site location not found")
    
    operator = db.query(User).filter(User.id == request.operator_id).first()
    if not operator:
        raise HTTPException(status_code=404, detail="Assigned operator user not found")

    checkout_now = datetime.utcnow()
    expected_return = checkout_now + timedelta(days=request.expected_return_days)

    rental = Rental(
        equipment_id=request.equipment_id,
        operator_id=request.operator_id,
        site_id=request.site_id,
        checkout_time=checkout_now,
        expected_return_time=expected_return,
        status=RentalStatus.ACTIVE
    )
    db.add(rental)

    # Update Equipment status & site/operator assignment
    equipment.status = EquipmentStatus.ACTIVE
    equipment.site_id = request.site_id
    equipment.operator_id = request.operator_id

    db.commit()
    db.refresh(rental)
    return format_rental_response(rental)

@router.post("/{rental_id}/checkin", response_model=RentalResponse)
def checkin_equipment(
    rental_id: int,
    request: RentalCheckin,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rental = db.query(Rental).filter(Rental.id == rental_id).first()
    if not rental:
        raise HTTPException(status_code=404, detail="Rental record not found")

    if current_user.role == UserRole.OPERATOR and rental.operator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to check in this rental assignment")

    rental.actual_return_time = datetime.utcnow()
    rental.status = RentalStatus.COMPLETED

    if rental.equipment:
        rental.equipment.status = EquipmentStatus.AVAILABLE
        rental.equipment.operator_id = None

    db.commit()
    db.refresh(rental)
    return format_rental_response(rental)

@router.post("/checkin-by-equipment/{id_or_code}", response_model=RentalResponse)
def checkin_equipment_by_code(
    id_or_code: str,
    request: Optional[RentalCheckin] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if id_or_code.isdigit():
        eq = db.query(Equipment).filter(Equipment.id == int(id_or_code)).first()
    else:
        eq = db.query(Equipment).filter(Equipment.equipment_id == id_or_code).first()

    if not eq:
        raise HTTPException(status_code=404, detail="Equipment asset not found")

    rental = db.query(Rental).filter(
        Rental.equipment_id == eq.id,
        Rental.status.in_([RentalStatus.ACTIVE, RentalStatus.OVERDUE])
    ).first()

    if not rental:
        if eq.status == EquipmentStatus.AVAILABLE:
            raise HTTPException(status_code=400, detail=f"Equipment {eq.equipment_id} is already checked in and AVAILABLE")
        else:
            raise HTTPException(status_code=400, detail=f"No active rental contract found for equipment {eq.equipment_id}")

    if current_user.role == UserRole.OPERATOR and rental.operator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to check in this rental assignment")

    rental.actual_return_time = datetime.utcnow()
    rental.status = RentalStatus.COMPLETED

    eq.status = EquipmentStatus.AVAILABLE
    eq.operator_id = None

    # Auto-resolve overdue alerts if present
    overdue_alert = db.query(Alert).filter(
        Alert.equipment_id == eq.id,
        Alert.alert_type == "OVERDUE_RENTAL",
        Alert.is_resolved == False
    ).first()
    if overdue_alert:
        overdue_alert.is_resolved = True

    db.commit()
    db.refresh(rental)
    return format_rental_response(rental)

