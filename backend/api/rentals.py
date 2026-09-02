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

from backend.services.rental_intelligence import (
    calculate_rental_progress,
    evaluate_early_return_opportunity,
    simulate_early_return
)
from backend.services.fleet_intelligence import compute_equipment_health

def format_rental_response(r: Rental, db: Optional[Session] = None) -> RentalResponse:
    eq = r.equipment
    prog = calculate_rental_progress(r, eq)

    # Health & alerts info
    active_alerts = [a for a in (eq.alerts if eq else []) if not a.is_resolved]
    health_info = compute_equipment_health(eq, active_alerts, []) if eq else {"status": "HEALTHY", "health_score": 100.0}

    # Early return opportunity check
    early_return_op = evaluate_early_return_opportunity(r, eq, db) if (db and eq) else None

    # Lifecycle stages construction
    eq_code = eq.equipment_id if eq else f"EQ-{r.equipment_id}"
    eq_model = eq.model if eq else ""
    eq_cat = eq.equipment_type if eq else ""
    op_name = r.operator.name if r.operator else "Unassigned"
    s_name = r.site.site_name if r.site else "Site Location"

    lifecycle = [
        {
            "stage": "CHECKED OUT",
            "timestamp": r.checkout_time.isoformat(),
            "title": "Equipment Checked Out",
            "details": f"{eq_code} ({eq_model}) dispatched to {s_name} assigned to {op_name}."
        },
        {
            "stage": "CURRENT USAGE",
            "timestamp": r.checkout_time.isoformat(),
            "title": "Shift Telematics Metering",
            "details": f"Recorded Engine Meter: {prog['engine_hours']} hrs | Operating: {prog['operating_hours']} hrs | Idle: {prog['idle_hours']} hrs."
        },
        {
            "stage": "CURRENT TELEMETRY",
            "timestamp": datetime.utcnow().isoformat(),
            "title": "Live Machine Health",
            "details": f"Health Score: {health_info['health_score']}/100 ({health_info['status']}) | Active Alerts: {len(active_alerts)} | Fuel: {prog['fuel_usage']} L/hr."
        },
        {
            "stage": "RENTAL PROGRESS",
            "timestamp": datetime.utcnow().isoformat(),
            "title": "Contract Time & Utilization Progress",
            "details": f"Planned: {prog['planned_duration_days']}d | Elapsed: {prog['elapsed_duration_days']}d | Remaining: {prog['remaining_duration_days']}d | Utilization: {prog['utilization_pct']}%."
        },
        {
            "stage": "AI INSIGHTS",
            "timestamp": datetime.utcnow().isoformat(),
            "title": "AI Fleet Intelligence Analysis",
            "details": early_return_op["evidence_summary"] if early_return_op else "Machine telemetry indicates normal operational utilization. No early-return opportunity detected."
        },
        {
            "stage": "EXPECTED RETURN",
            "timestamp": r.expected_return_time.isoformat(),
            "title": "Contract Expected Return Schedule",
            "details": f"Expected return date: {r.expected_return_time.strftime('%b %d, %Y %H:%M UTC')}."
        },
        {
            "stage": "CHECK-IN",
            "timestamp": r.actual_return_time.isoformat() if r.actual_return_time else None,
            "title": "Depot Return & Release",
            "details": f"Returned and released to AVAILABLE depot inventory on {r.actual_return_time.strftime('%b %d, %Y %H:%M UTC')}" if r.actual_return_time else "Contract active - machine in field operation."
        }
    ]

    return RentalResponse(
        id=r.id,
        equipment_id=r.equipment_id,
        operator_id=r.operator_id,
        site_id=r.site_id,
        checkout_time=r.checkout_time,
        expected_return_time=r.expected_return_time,
        actual_return_time=r.actual_return_time,
        status=r.status,
        equipment_code=eq_code,
        equipment_model=eq_model,
        equipment_category=eq_cat,
        operator_name=op_name,
        site_name=s_name,
        planned_duration_days=prog["planned_duration_days"],
        elapsed_duration_days=prog["elapsed_duration_days"],
        remaining_duration_days=prog["remaining_duration_days"],
        planned_duration_hours=prog["planned_duration_hours"],
        elapsed_duration_hours=prog["elapsed_duration_hours"],
        remaining_duration_hours=prog["remaining_duration_hours"],
        progress_pct=prog["progress_pct"],
        utilization=prog["utilization_pct"],
        engine_hours=prog["engine_hours"],
        operating_hours=prog["operating_hours"],
        idle_hours=prog["idle_hours"],
        fuel_usage=prog["fuel_usage"],
        health_status=health_info["status"],
        health_score=health_info["health_score"],
        active_alerts_count=len(active_alerts),
        early_return_opportunity=early_return_op,
        lifecycle_stages=lifecycle
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
    return [format_rental_response(r, db) for r in rentals]

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
    return format_rental_response(rental, db)

@router.get("/{rental_id}", response_model=RentalResponse)
def get_rental_by_id(
    rental_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rental = db.query(Rental).filter(Rental.id == rental_id).first()
    if not rental:
        raise HTTPException(status_code=404, detail="Rental contract not found")
    if current_user.role == UserRole.OPERATOR and rental.operator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this rental contract")
    return format_rental_response(rental, db)

@router.post("/{rental_id}/what-if-early-return")
def run_early_return_what_if(
    rental_id: int,
    current_user: User = Depends(require_role([UserRole.MANAGER])),
    db: Session = Depends(get_db)
):
    rental = db.query(Rental).filter(Rental.id == rental_id).first()
    if not rental:
        raise HTTPException(status_code=404, detail="Rental contract not found")
    if not rental.equipment:
        raise HTTPException(status_code=400, detail="Associated equipment asset not found")
    
    return simulate_early_return(rental, rental.equipment, db)

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
    return format_rental_response(rental, db)

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

    # Auto-generate billing record for this completed rental (idempotent)
    try:
        from backend.api.billing import calculate_and_create_billing
        calculate_and_create_billing(rental, db)
    except Exception as e:
        print(f"Billing generation notice for rental {rental_id}: {e}")

    return format_rental_response(rental, db)

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

    # Auto-generate billing record for this completed rental (idempotent)
    try:
        from backend.api.billing import calculate_and_create_billing
        calculate_and_create_billing(rental, db)
    except Exception as e:
        print(f"Billing generation notice for equipment {eq.equipment_id}: {e}")

    return format_rental_response(rental, db)

