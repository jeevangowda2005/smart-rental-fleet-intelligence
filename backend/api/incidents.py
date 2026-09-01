"""
Incident Management API — Phase 7
Manager-only REST endpoints for viewing, acknowledging, approving, rejecting, and resolving fleet incidents.
All endpoints enforce MANAGER RBAC. Operators receive HTTP 403.
"""

import datetime
import json
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.models.domain import (
    User, UserRole, Equipment, Incident, IncidentAction, IncidentAudit,
    IncidentStatus, IncidentActionStatus, Notification
)
from backend.services.auth import require_role
from backend.ai.action_executor import execute_approved_action, reject_action
from backend.ai.incident_engine import _write_audit

router = APIRouter(prefix="/api/incidents", tags=["Incident Command"])
manager_only = require_role([UserRole.MANAGER])


def _serialize_incident(inc: Incident) -> dict:
    eq = inc.equipment
    evidence = {}
    if inc.evidence_json:
        try:
            evidence = json.loads(inc.evidence_json)
        except Exception:
            evidence = {}
    return {
        "id": inc.id,
        "equipment_id": inc.equipment_id,
        "equipment_code": eq.equipment_id if eq else f"EQ-{inc.equipment_id}",
        "equipment_type": eq.equipment_type if eq else "",
        "equipment_model": eq.model if eq else "",
        "site_code": eq.site.site_code if eq and eq.site else "DEPOT",
        "incident_type": inc.incident_type,
        "severity": inc.severity,
        "severity_score": inc.severity_score,
        "status": inc.status.value,
        "detected_at": inc.detected_at.isoformat() if inc.detected_at else None,
        "last_seen_at": inc.last_seen_at.isoformat() if inc.last_seen_at else None,
        "occurrence_count": inc.occurrence_count,
        "source": inc.source,
        "description": inc.description,
        "evidence": evidence,
        "recommended_action": inc.recommended_action,
        "created_at": inc.created_at.isoformat() if inc.created_at else None,
        "resolved_at": inc.resolved_at.isoformat() if inc.resolved_at else None,
        "pending_actions": [
            {
                "id": a.id,
                "action_type": a.action_type,
                "status": a.status.value,
                "description": a.description,
                "created_at": a.created_at.isoformat() if a.created_at else None
            } for a in (inc.actions or []) if a.status == IncidentActionStatus.PENDING_APPROVAL
        ],
        "dataset_label": "LIVE APPLICATION DATA"
    }


@router.get("")
def list_incidents(
    severity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    incident_type: Optional[str] = Query(None),
    equipment_id: Optional[int] = Query(None),
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    q = db.query(Incident)
    if severity:
        q = q.filter(Incident.severity == severity.upper())
    if status:
        q = q.filter(Incident.status == status.upper())
    if incident_type:
        q = q.filter(Incident.incident_type == incident_type.upper())
    if equipment_id:
        q = q.filter(Incident.equipment_id == equipment_id)
    incidents = q.order_by(Incident.severity_score.desc(), Incident.created_at.desc()).all()
    return {"incidents": [_serialize_incident(i) for i in incidents], "total": len(incidents)}


@router.get("/summary")
def get_incident_summary(
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    all_open = db.query(Incident).filter(
        Incident.status.notin_([IncidentStatus.RESOLVED, IncidentStatus.DISMISSED])
    ).all()
    today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0)
    resolved_today = db.query(Incident).filter(
        Incident.status == IncidentStatus.RESOLVED,
        Incident.resolved_at >= today_start
    ).count()
    pending_actions = db.query(IncidentAction).filter(
        IncidentAction.status == IncidentActionStatus.PENDING_APPROVAL
    ).count()
    return {
        "total_open": len(all_open),
        "critical": len([i for i in all_open if i.severity == "CRITICAL"]),
        "high": len([i for i in all_open if i.severity == "HIGH"]),
        "warning": len([i for i in all_open if i.severity == "WARNING"]),
        "info": len([i for i in all_open if i.severity == "INFO"]),
        "awaiting_approval": pending_actions,
        "in_progress": len([i for i in all_open if i.status == IncidentStatus.IN_PROGRESS]),
        "resolved_today": resolved_today,
        "dataset_label": "LIVE APPLICATION DATA"
    }


@router.get("/notifications")
def get_manager_notifications(
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    notifs = (
        db.query(Notification)
        .order_by(Notification.created_at.desc())
        .limit(20)
        .all()
    )
    return {
        "notifications": [
            {
                "id": n.id,
                "incident_id": n.incident_id,
                "equipment_id": n.equipment_id,
                "type": n.notification_type,
                "message": n.message,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None
            } for n in notifs
        ],
        "unread_count": sum(1 for n in notifs if not n.is_read)
    }


@router.get("/{incident_id}")
def get_incident_detail(
    incident_id: int,
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    return _serialize_incident(inc)


@router.get("/{incident_id}/audit")
def get_incident_audit(
    incident_id: int,
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    audits = (
        db.query(IncidentAudit)
        .filter(IncidentAudit.incident_id == incident_id)
        .order_by(IncidentAudit.timestamp.asc())
        .all()
    )
    return {
        "incident_id": incident_id,
        "audit_trail": [
            {
                "id": a.id,
                "user_name": a.user_name,
                "role": a.role,
                "action": a.action,
                "previous_state": a.previous_state,
                "new_state": a.new_state,
                "reason": a.reason,
                "timestamp": a.timestamp.isoformat() if a.timestamp else None
            } for a in audits
        ],
        "total": len(audits)
    }


@router.post("/{incident_id}/acknowledge")
def acknowledge_incident(
    incident_id: int,
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    prev = inc.status.value
    inc.status = IncidentStatus.ACKNOWLEDGED
    _write_audit(db, inc, current_user.name, "MANAGER", "ACKNOWLEDGED", prev, "ACKNOWLEDGED",
                 f"Manager {current_user.name} acknowledged incident.", current_user.id)
    db.commit()
    return {"success": True, "status": "ACKNOWLEDGED", "incident_id": incident_id}


class ApproveActionRequest(BaseModel):
    action_id: int


@router.post("/{incident_id}/approve")
def approve_incident_action(
    incident_id: int,
    request: ApproveActionRequest,
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    action = db.query(IncidentAction).filter(
        IncidentAction.id == request.action_id,
        IncidentAction.incident_id == incident_id
    ).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    if action.status != IncidentActionStatus.PENDING_APPROVAL:
        raise HTTPException(status_code=400, detail=f"Action is not in PENDING_APPROVAL state (current: {action.status.value})")

    result = execute_approved_action(inc, action, current_user, db)
    return result


class RejectActionRequest(BaseModel):
    action_id: int
    reason: Optional[str] = "Manager rejected this action."


@router.post("/{incident_id}/reject")
def reject_incident_action(
    incident_id: int,
    request: RejectActionRequest,
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    action = db.query(IncidentAction).filter(
        IncidentAction.id == request.action_id,
        IncidentAction.incident_id == incident_id
    ).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")

    result = reject_action(inc, action, current_user, request.reason, db)
    return result


@router.post("/{incident_id}/start-action")
def start_incident_action(
    incident_id: int,
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    prev = inc.status.value
    inc.status = IncidentStatus.IN_PROGRESS
    _write_audit(db, inc, current_user.name, "MANAGER", "STARTED_ACTION", prev, "IN_PROGRESS",
                 f"Manager {current_user.name} started investigation.", current_user.id)
    db.commit()
    return {"success": True, "status": "IN_PROGRESS", "incident_id": incident_id}


class ResolveRequest(BaseModel):
    resolution_note: Optional[str] = ""


@router.post("/{incident_id}/resolve")
def resolve_incident(
    incident_id: int,
    request: ResolveRequest,
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    prev = inc.status.value
    inc.status = IncidentStatus.RESOLVED
    inc.resolved_at = datetime.datetime.utcnow()
    _write_audit(db, inc, current_user.name, "MANAGER", "RESOLVED", prev, "RESOLVED",
                 request.resolution_note or f"Manager {current_user.name} resolved incident.", current_user.id)
    db.commit()
    return {"success": True, "status": "RESOLVED", "incident_id": incident_id}


@router.post("/{incident_id}/dismiss")
def dismiss_incident(
    incident_id: int,
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    prev = inc.status.value
    inc.status = IncidentStatus.DISMISSED
    _write_audit(db, inc, current_user.name, "MANAGER", "DISMISSED", prev, "DISMISSED",
                 f"Manager {current_user.name} dismissed incident.", current_user.id)
    db.commit()
    return {"success": True, "status": "DISMISSED", "incident_id": incident_id}
