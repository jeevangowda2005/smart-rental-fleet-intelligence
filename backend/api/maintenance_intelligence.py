from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.database.session import get_db
from backend.models.domain import User, UserRole, Equipment, Alert, Maintenance, UsageLog
from backend.services.auth import require_role

from backend.ai.predictive_maintenance import predictive_engine
from backend.ai.maintenance_priority_engine import priority_engine
from backend.ai.maintenance_what_if import maintenance_what_if

router = APIRouter(prefix="/api/maintenance-intelligence", tags=["Predictive Maintenance Intelligence"])

# All Predictive Maintenance Intelligence endpoints strictly require MANAGER role
manager_only = require_role([UserRole.MANAGER])


@router.get("/fleet-risk")
def get_fleet_predictive_risk(
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    """
    Returns 0-100 Maintenance Risk Scores, early warning states, and 7-day risk trends for all assets.
    """
    equipment_list = db.query(Equipment).all()
    logs_by_eq = {}
    alerts_by_eq = {}
    maint_by_eq = {}
    for eq in equipment_list:
        logs_by_eq[eq.id] = db.query(UsageLog).filter(UsageLog.equipment_id == eq.id).all()
        alerts_by_eq[eq.id] = db.query(Alert).filter(Alert.equipment_id == eq.id).all()
        maint_by_eq[eq.id] = db.query(Maintenance).filter(Maintenance.equipment_id == eq.id).all()

    fleet_risks = predictive_engine.analyze_fleet_predictive_risk(
        equipment_list, logs_by_eq, alerts_by_eq, maint_by_eq
    )

    avg_risk = round(sum(r["risk_score"] for r in fleet_risks) / max(1, len(fleet_risks)), 1)
    critical_count = len([r for r in fleet_risks if r["priority"] == "CRITICAL"])
    high_count = len([r for r in fleet_risks if r["priority"] == "HIGH"])
    early_warning_count = len([r for r in fleet_risks if r["early_warning_state"] in ("EARLY WARNING", "HIGH RISK", "CRITICAL")])

    return {
        "fleet_risks": fleet_risks,
        "total_equipment": len(fleet_risks),
        "average_risk_score": avg_risk,
        "critical_risk_count": critical_count,
        "high_risk_count": high_count,
        "early_warning_count": early_warning_count,
        "dataset_label": "MAINTENANCE RISK ESTIMATE"
    }


@router.get("/high-risk")
def get_high_risk_equipment(
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    """
    Returns assets classified in HIGH or CRITICAL risk states.
    """
    equipment_list = db.query(Equipment).all()
    logs_by_eq = {}
    alerts_by_eq = {}
    maint_by_eq = {}
    for eq in equipment_list:
        logs_by_eq[eq.id] = db.query(UsageLog).filter(UsageLog.equipment_id == eq.id).all()
        alerts_by_eq[eq.id] = db.query(Alert).filter(Alert.equipment_id == eq.id).all()
        maint_by_eq[eq.id] = db.query(Maintenance).filter(Maintenance.equipment_id == eq.id).all()

    fleet_risks = predictive_engine.analyze_fleet_predictive_risk(
        equipment_list, logs_by_eq, alerts_by_eq, maint_by_eq
    )
    high_risk = [r for r in fleet_risks if r["priority"] in ("HIGH", "CRITICAL")]

    return {
        "high_risk_assets": high_risk,
        "total": len(high_risk),
        "dataset_label": "MAINTENANCE RISK ESTIMATE"
    }


@router.get("/early-warnings")
def get_early_warning_assets(
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    """
    Returns assets exhibiting early warning telemetry degradation.
    """
    equipment_list = db.query(Equipment).all()
    logs_by_eq = {}
    alerts_by_eq = {}
    maint_by_eq = {}
    for eq in equipment_list:
        logs_by_eq[eq.id] = db.query(UsageLog).filter(UsageLog.equipment_id == eq.id).all()
        alerts_by_eq[eq.id] = db.query(Alert).filter(Alert.equipment_id == eq.id).all()
        maint_by_eq[eq.id] = db.query(Maintenance).filter(Maintenance.equipment_id == eq.id).all()

    fleet_risks = predictive_engine.analyze_fleet_predictive_risk(
        equipment_list, logs_by_eq, alerts_by_eq, maint_by_eq
    )
    warnings = [r for r in fleet_risks if r["early_warning_state"] in ("WATCH", "EARLY WARNING", "HIGH RISK", "CRITICAL")]

    return {
        "early_warnings": warnings,
        "total": len(warnings),
        "dataset_label": "AI PREDICTED / ESTIMATED"
    }


@router.get("/priorities")
def get_maintenance_priorities(
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    """
    Returns ranked Maintenance Priority List (#1, #2...) with recommended inspection actions.
    """
    equipment_list = db.query(Equipment).all()
    logs_by_eq = {}
    alerts_by_eq = {}
    maint_by_eq = {}
    for eq in equipment_list:
        logs_by_eq[eq.id] = db.query(UsageLog).filter(UsageLog.equipment_id == eq.id).all()
        alerts_by_eq[eq.id] = db.query(Alert).filter(Alert.equipment_id == eq.id).all()
        maint_by_eq[eq.id] = db.query(Maintenance).filter(Maintenance.equipment_id == eq.id).all()

    priorities = priority_engine.rank_maintenance_priorities(
        equipment_list, logs_by_eq, alerts_by_eq, maint_by_eq
    )

    return {
        "priorities": priorities,
        "total": len(priorities),
        "dataset_label": "AI PREDICTED / ESTIMATED"
    }


@router.get("/alerts")
def get_predictive_maintenance_alerts(
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    """
    Returns predictive maintenance alerts (MAINTENANCE_RISK_HIGH, MAINTENANCE_EARLY_WARNING...).
    """
    alerts = (
        db.query(Alert)
        .filter(Alert.alert_type.in_([
            "MAINTENANCE_RISK_HIGH",
            "MAINTENANCE_RISK_CRITICAL",
            "MAINTENANCE_EARLY_WARNING",
            "FUEL_EFFICIENCY_DEGRADATION",
            "UTILIZATION_DEGRADATION"
        ]))
        .order_by(Alert.created_at.desc())
        .all()
    )
    return {
        "predictive_alerts": [
            {
                "id": a.id,
                "equipment_id": a.equipment_id,
                "equipment_code": a.equipment.equipment_id if a.equipment else f"EQ-{a.equipment_id}",
                "alert_type": a.alert_type,
                "severity": a.severity,
                "message": a.message,
                "created_at": a.created_at.isoformat() if a.created_at else "",
                "is_resolved": a.is_resolved
            } for a in alerts
        ],
        "total": len(alerts),
        "dataset_label": "LIVE APPLICATION DATA"
    }


@router.get("/{equipment_id_val}")
def get_asset_predictive_risk_detail(
    equipment_id_val: str,
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    """
    Returns detailed predictive maintenance risk metrics for a single asset.
    """
    if equipment_id_val.isdigit():
        eq = db.query(Equipment).filter(Equipment.id == int(equipment_id_val)).first()
    else:
        eq = db.query(Equipment).filter(Equipment.equipment_id == equipment_id_val).first()

    if not eq:
        raise HTTPException(status_code=404, detail="Equipment asset not found")

    logs = db.query(UsageLog).filter(UsageLog.equipment_id == eq.id).all()
    alerts = db.query(Alert).filter(Alert.equipment_id == eq.id).all()
    maint = db.query(Maintenance).filter(Maintenance.equipment_id == eq.id).all()

    risk_detail = predictive_engine.calculate_predictive_risk(eq, logs, alerts, maint)
    return risk_detail


class MaintenanceWhatIfRequest(BaseModel):
    equipment_id: int


@router.post("/what-if")
def run_maintenance_what_if(
    request: MaintenanceWhatIfRequest,
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    """
    Simulates operational and financial impact of servicing an equipment asset immediately.
    DOES NOT modify database state.
    """
    eq = db.query(Equipment).filter(Equipment.id == request.equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Equipment asset not found")

    logs = db.query(UsageLog).filter(UsageLog.equipment_id == eq.id).all()
    alerts = db.query(Alert).filter(Alert.equipment_id == eq.id).all()
    maint = db.query(Maintenance).filter(Maintenance.equipment_id == eq.id).all()

    result = maintenance_what_if.simulate_service(eq, logs, alerts, maint)
    return result
