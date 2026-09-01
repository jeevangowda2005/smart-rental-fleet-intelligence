from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database.session import get_db
from backend.models.domain import Alert, Equipment, User, UserRole
from backend.schemas.domain import AlertCreate, IssueReportCreate, AlertResponse
from backend.services.auth import get_current_user, require_role

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])

def format_alert_response(a: Alert) -> AlertResponse:
    return AlertResponse(
        id=a.id,
        equipment_id=a.equipment_id,
        alert_type=a.alert_type,
        severity=a.severity,
        message=a.message,
        created_at=a.created_at,
        is_resolved=a.is_resolved,
        equipment_code=a.equipment.equipment_id if a.equipment else f"EQ-{a.equipment_id}"
    )

@router.get("", response_model=List[AlertResponse])
def list_alerts(
    is_resolved: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Alert)
    if is_resolved is not None:
        query = query.filter(Alert.is_resolved == is_resolved)

    if current_user.role == UserRole.OPERATOR:
        query = query.join(Equipment).filter(Equipment.operator_id == current_user.id)

    alerts = query.order_by(Alert.created_at.desc()).all()
    return [format_alert_response(a) for a in alerts]

@router.post("", response_model=AlertResponse)
def create_alert(
    request: AlertCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    alert = Alert(
        equipment_id=request.equipment_id,
        alert_type=request.alert_type,
        severity=request.severity,
        message=request.message
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return format_alert_response(alert)

@router.post("/report-issue", response_model=AlertResponse)
def report_operator_issue(
    request: IssueReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    eq_id_val = request.equipment_id
    equipment = None
    if isinstance(eq_id_val, int) or (isinstance(eq_id_val, str) and eq_id_val.isdigit()):
        equipment = db.query(Equipment).filter(Equipment.id == int(eq_id_val)).first()
    if not equipment and isinstance(eq_id_val, str):
        equipment = db.query(Equipment).filter(Equipment.equipment_id == eq_id_val).first()

    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment asset not found")

    issue_type_str = request.issue_type.upper() if request.issue_type else "OPERATOR_REPORT"

    alert = Alert(
        equipment_id=equipment.id,
        alert_type=f"OPERATOR_REPORT: {issue_type_str}",
        severity=request.severity,
        message=f"Reported by {current_user.name}: {request.description}",
        is_resolved=False
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return format_alert_response(alert)

@router.patch("/{alert_id}/resolve", response_model=AlertResponse)
def resolve_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.is_resolved = True
    db.commit()
    db.refresh(alert)
    return format_alert_response(alert)
