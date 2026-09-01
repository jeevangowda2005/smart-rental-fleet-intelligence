"""
Safe Software Workflow Action Executor — Phase 7
Executes approved incident response actions as software workflow operations.
NEVER controls physical machinery. Every action creates an immutable audit record.
"""

import datetime
import json
from typing import Optional
from sqlalchemy.orm import Session

from backend.models.domain import (
    Equipment, EquipmentStatus, Maintenance, Alert, Incident,
    IncidentAction, IncidentActionStatus, IncidentStatus, Notification, User
)
from backend.ai.incident_engine import _write_audit, _create_notification


def execute_approved_action(
    incident: Incident,
    action: IncidentAction,
    manager: User,
    db: Session
) -> dict:
    """
    Execute an approved software workflow action after Manager approval.
    Returns a result dict with status and details.
    IMPORTANT: Never controls physical machinery.
    """
    equipment = db.query(Equipment).filter(Equipment.id == incident.equipment_id).first()
    if not equipment:
        return {"success": False, "detail": "Equipment not found"}

    action_type = action.action_type
    prev_state = equipment.status.value if equipment else "UNKNOWN"

    try:
        if action_type in ("CREATE_INSPECTION", "CREATE_MAINTENANCE_ORDER"):
            # Create a maintenance/inspection work order linked to the incident
            maint = Maintenance(
                equipment_id=equipment.id,
                maintenance_type="INCIDENT_INSPECTION" if action_type == "CREATE_INSPECTION" else "INCIDENT_MAINTENANCE_ORDER",
                description=(
                    f"Created from Incident #{incident.id} — {incident.incident_type}. "
                    f"{incident.recommended_action}. Approved by Manager {manager.name}."
                ),
                scheduled_date=datetime.datetime.utcnow() + datetime.timedelta(hours=24),
                status="SCHEDULED",
                incident_id=incident.id
            )
            db.add(maint)
            result_detail = f"Maintenance work order scheduled for {equipment.equipment_id} within 24 hours."

        elif action_type == "FLAG_EQUIPMENT":
            # Use existing MAINTENANCE status for maintenance-related flags
            old_status = equipment.status.value
            equipment.status = EquipmentStatus.MAINTENANCE
            result_detail = f"Equipment {equipment.equipment_id} flagged to MAINTENANCE status (was {old_status})."

        elif action_type == "ESCALATE_ALERT":
            # Escalate unresolved alerts related to this equipment
            alerts = db.query(Alert).filter(
                Alert.equipment_id == equipment.id,
                Alert.is_resolved == False,
                Alert.severity != "CRITICAL"
            ).all()
            for a in alerts:
                a.severity = "CRITICAL"
            result_detail = f"Escalated {len(alerts)} alert(s) for {equipment.equipment_id} to CRITICAL severity."

        elif action_type == "NOTIFY_MANAGER":
            _create_notification(
                db, incident,
                f"ACTION REQUIRED: {incident.description} — Manager review requested.",
                "ACTION"
            )
            result_detail = f"Notification sent for incident #{incident.id} on {equipment.equipment_id}."

        elif action_type == "REQUEST_RELOCATION":
            _create_notification(
                db, incident,
                f"RELOCATION REQUEST: {equipment.equipment_id} recommended for relocation. Manager approval required.",
                "WARNING"
            )
            result_detail = f"Relocation request recorded for {equipment.equipment_id}. Awaiting Manager decision."

        elif action_type == "MARK_ACTION_COMPLETE":
            result_detail = f"Action manually marked complete for incident #{incident.id}."

        else:
            return {"success": False, "detail": f"Unknown action type: {action_type}"}

        # Mark action as EXECUTED
        action.status = IncidentActionStatus.EXECUTED
        action.approved_by_user_id = manager.id
        action.executed_at = datetime.datetime.utcnow()

        # Update incident status to IN_PROGRESS
        prev_incident_status = incident.status.value
        if incident.status not in (IncidentStatus.IN_PROGRESS, IncidentStatus.RESOLVED):
            incident.status = IncidentStatus.IN_PROGRESS

        # Write immutable audit record
        _write_audit(
            db, incident,
            user_name=manager.name,
            role="MANAGER",
            action=f"APPROVED_AND_EXECUTED:{action_type}",
            prev_state=prev_incident_status,
            new_state=incident.status.value,
            reason=f"Manager {manager.name} approved and executed {action_type}. {result_detail}",
            user_id=manager.id
        )

        db.commit()
        return {"success": True, "detail": result_detail, "action_type": action_type}

    except Exception as e:
        db.rollback()
        action.status = IncidentActionStatus.FAILED
        db.commit()
        return {"success": False, "detail": str(e), "action_type": action_type}


def reject_action(
    incident: Incident,
    action: IncidentAction,
    manager: User,
    rejection_reason: str,
    db: Session
) -> dict:
    """Record a Manager rejection for a pending action."""
    action.status = IncidentActionStatus.REJECTED
    action.approved_by_user_id = manager.id
    action.rejection_reason = rejection_reason or "Manager rejected action."

    _write_audit(
        db, incident,
        user_name=manager.name,
        role="MANAGER",
        action=f"REJECTED:{action.action_type}",
        prev_state=IncidentActionStatus.PENDING_APPROVAL.value,
        new_state=IncidentActionStatus.REJECTED.value,
        reason=f"Manager {manager.name} rejected: {rejection_reason}",
        user_id=manager.id
    )
    db.commit()
    return {"success": True, "detail": f"Action {action.action_type} rejected.", "reason": rejection_reason}


action_executor_module = type("ActionExecutor", (), {
    "execute_approved_action": staticmethod(execute_approved_action),
    "reject_action": staticmethod(reject_action),
})()
