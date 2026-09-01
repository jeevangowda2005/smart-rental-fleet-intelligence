"""
Incident Intelligence Engine — Phase 7
Converts telemetry anomalies, alerts, and AI predictions into structured incidents.
Implements incident severity scoring, deduplication, playbooks, and notification generation.
"""

import datetime
import json
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.models.domain import (
    Equipment, Alert, Maintenance, Rental, RentalStatus, EquipmentStatus,
    Incident, IncidentAction, IncidentAudit, IncidentStatus, IncidentActionStatus,
    Notification, UserRole
)
from backend.ai.predictive_maintenance import predictive_engine

LABEL_AI_RECOMMENDED = "AI RECOMMENDED ACTION"
LABEL_APPROVAL_REQUIRED = "MANAGER APPROVAL REQUIRED"
LABEL_AI_ESTIMATED = "AI PREDICTED / ESTIMATED"


def _calculate_severity(score: int) -> str:
    if score >= 75:
        return "CRITICAL"
    elif score >= 50:
        return "HIGH"
    elif score >= 25:
        return "WARNING"
    return "INFO"


def _deduplicate_incident(db: Session, equipment_id: int, incident_type: str) -> Optional[Incident]:
    """Return existing open incident of same type, or None if none exists."""
    return (
        db.query(Incident)
        .filter(
            Incident.equipment_id == equipment_id,
            Incident.incident_type == incident_type,
            Incident.status.notin_([IncidentStatus.RESOLVED, IncidentStatus.DISMISSED])
        )
        .first()
    )


def _write_audit(
    db: Session,
    incident: Incident,
    user_name: str,
    role: str,
    action: str,
    prev_state: str,
    new_state: str,
    reason: str = "",
    user_id: int = None
):
    audit = IncidentAudit(
        incident_id=incident.id,
        equipment_id=incident.equipment_id,
        user_id=user_id,
        user_name=user_name,
        role=role,
        action=action,
        previous_state=prev_state,
        new_state=new_state,
        reason=reason,
        timestamp=datetime.datetime.utcnow()
    )
    db.add(audit)


def _create_notification(
    db: Session,
    incident: Incident,
    message: str,
    notification_type: str = "WARNING"
):
    """Create a manager-targeted in-app notification for this incident."""
    notif = Notification(
        incident_id=incident.id,
        equipment_id=incident.equipment_id,
        notification_type=notification_type,
        message=message,
        is_read=False,
        created_at=datetime.datetime.utcnow()
    )
    db.add(notif)


def _create_or_update_incident(
    db: Session,
    equipment: Equipment,
    incident_type: str,
    score: int,
    description: str,
    evidence: Dict,
    recommended_action: str,
    playbook_actions: List[str]
) -> Incident:
    """Create a new incident or update existing deduped incident."""
    severity = _calculate_severity(score)
    existing = _deduplicate_incident(db, equipment.id, incident_type)

    if existing:
        # Update existing incident: increment occurrence_count & last_seen_at
        existing.last_seen_at = datetime.datetime.utcnow()
        existing.occurrence_count += 1
        existing.severity_score = score
        existing.severity = severity
        existing.evidence_json = json.dumps(evidence)
        db.commit()
        return existing

    # Create new incident
    incident = Incident(
        equipment_id=equipment.id,
        incident_type=incident_type,
        severity=severity,
        severity_score=score,
        status=IncidentStatus.NEW,
        detected_at=datetime.datetime.utcnow(),
        last_seen_at=datetime.datetime.utcnow(),
        occurrence_count=1,
        source="AI_ENGINE",
        description=description,
        evidence_json=json.dumps(evidence),
        recommended_action=recommended_action,
        created_at=datetime.datetime.utcnow()
    )
    db.add(incident)
    db.flush()

    # Create pending-approval actions from playbook
    for action_type in playbook_actions:
        action = IncidentAction(
            incident_id=incident.id,
            action_type=action_type,
            status=IncidentActionStatus.PENDING_APPROVAL,
            description=f"{LABEL_APPROVAL_REQUIRED}: {action_type} for {equipment.equipment_id}",
            created_at=datetime.datetime.utcnow()
        )
        db.add(action)

    _write_audit(db, incident, "AI_ENGINE", "SYSTEM", "INCIDENT_CREATED", "N/A", "NEW",
                 f"Auto-detected: {incident_type} for {equipment.equipment_id}")

    _create_notification(
        db, incident,
        f"{severity}: {description}",
        "CRITICAL" if severity == "CRITICAL" else "WARNING"
    )

    db.commit()
    return incident


# =============================================
# PLAYBOOKS
# =============================================

def run_high_maintenance_risk_playbook(db: Session, equipment: Equipment) -> Optional[Incident]:
    """Playbook: Critical/High Maintenance Risk detected."""
    alerts = db.query(Alert).filter(Alert.equipment_id == equipment.id, Alert.is_resolved == False).all()
    maint = db.query(Maintenance).filter(Maintenance.equipment_id == equipment.id).all()
    risk = predictive_engine.calculate_predictive_risk(equipment, [], alerts, maint)
    score = risk["risk_score"]

    if score < 35:
        return None

    evidence = {
        "risk_score": score,
        "priority": risk["priority"],
        "early_warning_state": risk["early_warning_state"],
        "reasons": risk["reasons"],
        "engine_hours": equipment.engine_hours,
        "dataset_label": LABEL_AI_ESTIMATED
    }
    return _create_or_update_incident(
        db, equipment,
        incident_type="HIGH_MAINTENANCE_RISK",
        score=score,
        description=f"AI estimates elevated maintenance risk for {equipment.equipment_id} (Score: {score}/100, Priority: {risk['priority']}). {risk['reasons'][0] if risk['reasons'] else ''}",
        evidence=evidence,
        recommended_action=f"RECOMMENDED INSPECTION: Review engine meter ({equipment.engine_hours} hrs) and maintenance history before next deployment. {LABEL_APPROVAL_REQUIRED}.",
        playbook_actions=["CREATE_INSPECTION", "NOTIFY_MANAGER"] if score >= 50 else ["NOTIFY_MANAGER"]
    )


def run_geofence_breach_playbook(db: Session, equipment: Equipment, alert: Alert) -> Optional[Incident]:
    """Playbook: Geofence Breach detected from telemetry alerts."""
    score = 60
    evidence = {
        "alert_id": alert.id,
        "alert_message": alert.message,
        "latitude": equipment.latitude,
        "longitude": equipment.longitude,
        "site": equipment.site.site_name if equipment.site else "Unknown",
        "dataset_label": "LIVE APPLICATION DATA"
    }
    return _create_or_update_incident(
        db, equipment,
        incident_type="GEOFENCE_BREACH",
        score=score,
        description=f"Equipment {equipment.equipment_id} has exceeded site geofence boundary. {alert.message}",
        evidence=evidence,
        recommended_action=f"Verify equipment location and confirm operator status. {LABEL_APPROVAL_REQUIRED}.",
        playbook_actions=["NOTIFY_MANAGER"]
    )


def run_overdue_rental_playbook(db: Session, equipment: Equipment, rental: Rental) -> Optional[Incident]:
    """Playbook: Equipment rental is overdue."""
    now = datetime.datetime.utcnow()
    overdue_hrs = round((now - rental.expected_return_time).total_seconds() / 3600, 1)
    score = min(90, 40 + int(overdue_hrs * 5))
    evidence = {
        "rental_id": rental.id,
        "expected_return": rental.expected_return_time.isoformat(),
        "overdue_hours": overdue_hrs,
        "dataset_label": "LIVE APPLICATION DATA"
    }
    return _create_or_update_incident(
        db, equipment,
        incident_type="OVERDUE_RENTAL",
        score=score,
        description=f"Rental for {equipment.equipment_id} is overdue by {overdue_hrs} hours. Operator confirmation required.",
        evidence=evidence,
        recommended_action=f"Contact operator and request equipment return confirmation. {LABEL_APPROVAL_REQUIRED}.",
        playbook_actions=["NOTIFY_MANAGER", "ESCALATE_ALERT"]
    )


def run_fuel_anomaly_playbook(db: Session, equipment: Equipment, alert: Alert) -> Optional[Incident]:
    """Playbook: Fuel efficiency degradation detected."""
    score = 50
    evidence = {
        "alert_id": alert.id,
        "alert_message": alert.message,
        "fuel_usage": equipment.fuel_usage,
        "dataset_label": LABEL_AI_ESTIMATED
    }
    return _create_or_update_incident(
        db, equipment,
        incident_type="FUEL_ANOMALY",
        score=score,
        description=f"Fuel efficiency degradation detected for {equipment.equipment_id}. {alert.message}",
        evidence=evidence,
        recommended_action=f"Inspect fuel system and review operator telemetry. {LABEL_APPROVAL_REQUIRED}.",
        playbook_actions=["CREATE_INSPECTION", "NOTIFY_MANAGER"]
    )


def run_utilization_degradation_playbook(db: Session, equipment: Equipment) -> Optional[Incident]:
    """Playbook: Severe under-utilization detected."""
    score = max(0, min(60, int(50 - equipment.utilization)))
    if score < 25 or equipment.utilization > 30:
        return None

    evidence = {
        "utilization_pct": equipment.utilization,
        "engine_hours": equipment.engine_hours,
        "status": equipment.status.value,
        "dataset_label": LABEL_AI_ESTIMATED
    }
    return _create_or_update_incident(
        db, equipment,
        incident_type="UTILIZATION_DEGRADATION",
        score=score,
        description=f"Equipment {equipment.equipment_id} utilization at {equipment.utilization}% — significantly below optimal threshold.",
        evidence=evidence,
        recommended_action=f"Review equipment assignment and consider relocation to higher-demand site. {LABEL_APPROVAL_REQUIRED}.",
        playbook_actions=["REQUEST_RELOCATION", "NOTIFY_MANAGER"]
    )


def run_all_playbooks_for_equipment(db: Session, equipment: Equipment):
    """Evaluate all incident playbooks for a given equipment asset."""
    # Maintenance Risk Playbook
    run_high_maintenance_risk_playbook(db, equipment)

    # Geofence Breach Playbook
    geo_alert = db.query(Alert).filter(
        Alert.equipment_id == equipment.id,
        Alert.alert_type == "GEOFENCE_BREACH",
        Alert.is_resolved == False
    ).first()
    if geo_alert:
        run_geofence_breach_playbook(db, equipment, geo_alert)

    # Overdue Rental Playbook
    now = datetime.datetime.utcnow()
    overdue_rental = db.query(Rental).filter(
        Rental.equipment_id == equipment.id,
        Rental.status == RentalStatus.ACTIVE,
        Rental.expected_return_time < now
    ).first()
    if overdue_rental:
        run_overdue_rental_playbook(db, equipment, overdue_rental)

    # Fuel Anomaly Playbook
    fuel_alert = db.query(Alert).filter(
        Alert.equipment_id == equipment.id,
        Alert.alert_type.in_(["FUEL_EFFICIENCY_DEGRADATION"]),
        Alert.is_resolved == False
    ).first()
    if fuel_alert:
        run_fuel_anomaly_playbook(db, equipment, fuel_alert)

    # Under-Utilization Playbook
    run_utilization_degradation_playbook(db, equipment)


incident_engine = type("IncidentEngine", (), {
    "run_all_playbooks_for_equipment": staticmethod(run_all_playbooks_for_equipment),
    "run_high_maintenance_risk_playbook": staticmethod(run_high_maintenance_risk_playbook),
    "run_geofence_breach_playbook": staticmethod(run_geofence_breach_playbook),
    "run_overdue_rental_playbook": staticmethod(run_overdue_rental_playbook),
    "run_fuel_anomaly_playbook": staticmethod(run_fuel_anomaly_playbook),
    "_write_audit": staticmethod(_write_audit),
    "_create_notification": staticmethod(_create_notification),
})()
