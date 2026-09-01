import datetime
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from backend.models.domain import Equipment, EquipmentStatus, Alert, Maintenance, Rental, RentalStatus

def calculate_utilization(engine_hours: float, idle_hours: float) -> float:
    """
    Utilization % = Operating Hours / (Operating Hours + Idle Hours) * 100
    Where engine_hours represents operating hours.
    Clamped strictly between 0.0% and 100.0%.
    """
    if engine_hours < 0 or idle_hours < 0:
        raise ValueError("Engine hours and idle hours cannot be negative.")

    total_hours = engine_hours + idle_hours
    if total_hours <= 0:
        return 0.0

    util = (engine_hours / total_hours) * 100.0
    return round(max(0.0, min(100.0, util)), 1)

def compute_equipment_health(
    equipment: Equipment,
    active_alerts: List[Alert],
    active_maintenance: List[Maintenance],
    is_overdue: bool = False
) -> Dict[str, Any]:
    """
    Rule-based equipment health evaluator.
    Returns HEALTHY, ATTENTION, or CRITICAL with detailed status reasons and calculated health_score (0-100).
    """
    reasons = []
    has_critical_alert = any(a.severity == "CRITICAL" for a in active_alerts)
    has_warning_alert = any(a.severity == "WARNING" for a in active_alerts)

    in_maintenance = equipment.status == EquipmentStatus.MAINTENANCE or any(m.status == "IN_PROGRESS" for m in active_maintenance)
    overdue_status = equipment.status == EquipmentStatus.OVERDUE or is_overdue

    score = 100.0

    # 1. Check for CRITICAL status conditions
    if has_critical_alert:
        reasons.append("Active CRITICAL telemetry alert reported.")
        score -= 35.0
    if in_maintenance:
        reasons.append("Machine currently undergoing active maintenance/servicing.")
        score -= 30.0
    if overdue_status:
        reasons.append("Machine has exceeded expected rental return schedule.")
        score -= 25.0

    if has_critical_alert or in_maintenance or overdue_status:
        return {
            "status": "CRITICAL",
            "badge_color": "rose",
            "health_score": round(max(10.0, score), 1),
            "reasons": reasons
        }

    # 2. Check for ATTENTION status conditions
    total_hrs = equipment.engine_hours + equipment.idle_hours
    idle_ratio = (equipment.idle_hours / total_hrs) if total_hrs > 0 else 0.0

    if has_warning_alert:
        reasons.append("Active WARNING telemetry alert logged.")
        score -= 20.0
    if idle_ratio > 0.30:
        reasons.append(f"High engine idle ratio ({round(idle_ratio * 100, 1)}% of total runtime).")
        score -= min(15.0, round(idle_ratio * 30.0, 1))
    if equipment.utilization < 40.0:
        reasons.append(f"Low machine utilization ({equipment.utilization}%).")
        score -= 10.0

    if has_warning_alert or idle_ratio > 0.30 or equipment.utilization < 40.0:
        return {
            "status": "ATTENTION",
            "badge_color": "amber",
            "health_score": round(max(40.0, score), 1),
            "reasons": reasons
        }

    # 3. Default HEALTHY
    return {
        "status": "HEALTHY",
        "badge_color": "emerald",
        "health_score": round(max(85.0, score), 1),
        "reasons": ["All telemetry parameters within optimal operating thresholds."]
    }
