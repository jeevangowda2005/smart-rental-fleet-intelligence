import datetime
import math
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.models.domain import (
    Rental, RentalStatus, Equipment, EquipmentStatus, Site, User, UsageLog, Alert
)
from backend.services.fleet_intelligence import compute_equipment_health, calculate_utilization
from backend.ai.cost_config import DEFAULT_IDLE_COST_PER_HOUR, DEFAULT_FUEL_COST_PER_LITER, DEFAULT_CO2_EMISSION_FACTOR
from backend.ai.demand_predictor import demand_predictor


def calculate_rental_progress(rental: Rental, equipment: Optional[Equipment] = None) -> Dict[str, Any]:
    """
    Calculates dynamic rental progress metrics strictly from actual database timestamps and telemetry.
    No hardcoded duration or utilization values.
    """
    now = datetime.datetime.utcnow()
    checkout = rental.checkout_time
    expected = rental.expected_return_time
    actual = rental.actual_return_time

    # Planned duration
    planned_seconds = max(0.0, (expected - checkout).total_seconds())
    planned_hours = round(planned_seconds / 3600.0, 1)
    planned_days = round(planned_seconds / 86400.0, 1)

    # Elapsed duration
    end_ref = actual if actual else now
    elapsed_seconds = max(0.0, (end_ref - checkout).total_seconds())
    elapsed_hours = round(elapsed_seconds / 3600.0, 1)
    elapsed_days = round(elapsed_seconds / 86400.0, 1)

    # Remaining duration
    if rental.status in [RentalStatus.ACTIVE, RentalStatus.OVERDUE] and not actual:
        remaining_seconds = max(0.0, (expected - now).total_seconds())
        remaining_hours = round(remaining_seconds / 3600.0, 1)
        remaining_days = round(remaining_seconds / 86400.0, 1)
    else:
        remaining_seconds = 0.0
        remaining_hours = 0.0
        remaining_days = 0.0

    # Progress percentage
    progress_pct = round(min(100.0, (elapsed_seconds / planned_seconds * 100.0)) if planned_seconds > 0 else 100.0, 1)

    # Telemetry metrics from equipment
    engine_hrs = equipment.engine_hours if equipment else 0.0
    idle_hrs = equipment.idle_hours if equipment else 0.0
    operating_hrs = max(0.0, engine_hrs - idle_hrs)
    utilization_pct = equipment.utilization if equipment else 0.0
    fuel_usage = equipment.fuel_usage if equipment else 0.0

    return {
        "rental_id": rental.id,
        "status": rental.status.value if hasattr(rental.status, "value") else str(rental.status),
        "checkout_time": checkout.isoformat(),
        "expected_return_time": expected.isoformat(),
        "actual_return_time": actual.isoformat() if actual else None,
        "planned_duration_hours": planned_hours,
        "planned_duration_days": planned_days,
        "elapsed_duration_hours": elapsed_hours,
        "elapsed_duration_days": elapsed_days,
        "remaining_duration_hours": remaining_hours,
        "remaining_duration_days": remaining_days,
        "progress_pct": progress_pct,
        "engine_hours": engine_hrs,
        "operating_hours": round(operating_hrs, 1),
        "idle_hours": idle_hrs,
        "utilization_pct": utilization_pct,
        "fuel_usage": fuel_usage,
    }


def evaluate_early_return_opportunity(
    rental: Rental,
    equipment: Optional[Equipment],
    db: Session
) -> Optional[Dict[str, Any]]:
    """
    Evaluates whether an active rental qualifies for an EARLY RETURN OPPORTUNITY.
    
    STRICT REQUIREMENT:
    - Rental must be currently ACTIVE.
    - Substantial remaining rental period (>= 0.5 days / 12 hours).
    - Meaningful/persistent recent evidence of low utilization or prolonged idling
      across telemetry logs (NOT just a single temporary snapshot).
    """
    if not equipment or rental.status != RentalStatus.ACTIVE:
        return None

    progress = calculate_rental_progress(rental, equipment)
    remaining_days = progress["remaining_duration_days"]

    # Gate 1: Meaningful remaining duration required (>= 0.5 days)
    if remaining_days < 0.5:
        return None

    # Gather recent telemetry usage logs for persistent evidence check
    recent_logs = (
        db.query(UsageLog)
        .filter(UsageLog.equipment_id == equipment.id)
        .order_by(UsageLog.timestamp.desc())
        .limit(6)
        .all()
    )

    # Persistent Evidence Analysis
    total_logs = len(recent_logs)
    low_util_count = 0
    idle_count = 0
    high_idle_ratio_count = 0

    for log in recent_logs:
        log_total = log.engine_hours + log.idle_hours
        log_util = calculate_utilization(log.engine_hours, log.idle_hours)
        log_idle_ratio = (log.idle_hours / log_total) if log_total > 0 else 0.0

        if log_util < 35.0:
            low_util_count += 1
        if log.operating_status == "IDLE" or log_util < 15.0:
            idle_count += 1
        if log_idle_ratio > 0.40:
            high_idle_ratio_count += 1

    # Main machine overall utilization & idle ratio
    overall_total = equipment.engine_hours + equipment.idle_hours
    overall_idle_ratio = (equipment.idle_hours / overall_total) if overall_total > 0 else 0.0

    # Gate 2: Require PERSISTENT evidence across multiple data points or heavy overall idle ratio
    # If we have multiple logs, at least 50% of recent logs must show low activity / high idle.
    has_persistent_evidence = False
    evidence_reasons = []

    if total_logs >= 2:
        if low_util_count >= (total_logs // 2) or idle_count >= (total_logs // 2):
            has_persistent_evidence = True
            evidence_reasons.append(
                f"Persistent low utilization across {low_util_count} of last {total_logs} shift logs."
            )
        elif high_idle_ratio_count >= (total_logs // 2):
            has_persistent_evidence = True
            evidence_reasons.append(
                f"Consistently high idle ratio (>40%) logged across {high_idle_ratio_count} of last {total_logs} shifts."
            )
    else:
        # Fallback for fresh rentals with single/no log: check overall machine meters
        if equipment.utilization < 35.0 and overall_idle_ratio > 0.40:
            has_persistent_evidence = True
            evidence_reasons.append(
                f"Current machine utilization ({equipment.utilization}%) and overall idle ratio ({round(overall_idle_ratio * 100, 1)}%) indicate persistent low demand."
            )

    if not has_persistent_evidence:
        return None

    # Evidence verified! Check if another site has predicted demand for this equipment category
    all_sites = db.query(Site).all()
    all_eq = db.query(Equipment).all()
    forecasts = demand_predictor.predict_site_demands(all_sites, all_eq)

    target_reallocation = None
    for f in forecasts:
        if f["equipment_type"] == equipment.equipment_type and f["site_id"] != rental.site_id and f["predicted_shortage"] > 0:
            dest_site = db.query(Site).filter(Site.id == f["site_id"]).first()
            if dest_site:
                target_reallocation = {
                    "site_id": dest_site.id,
                    "site_code": dest_site.site_code,
                    "site_name": dest_site.site_name,
                    "predicted_shortage": f["predicted_shortage"],
                    "demand_level": f["demand_level"]
                }
                evidence_reasons.append(
                    f"Target site {dest_site.site_code} ({dest_site.site_name}) has predicted shortage of {f['predicted_shortage']} {equipment.equipment_type}(s)."
                )
                break

    # Calculate estimated avoided idle cost if returned early
    unused_hours = remaining_days * 24.0
    estimated_avoided_idle_cost = round(unused_hours * DEFAULT_IDLE_COST_PER_HOUR * max(0.3, overall_idle_ratio), 2)
    estimated_fuel_saved_l = round(unused_hours * 5.0, 1)

    eq_code = equipment.equipment_id
    site_name = rental.site.site_name if rental.site else "current site"

    opportunity = {
        "is_opportunity": True,
        "title": "EARLY RETURN OPPORTUNITY",
        "equipment_code": eq_code,
        "equipment_model": equipment.model,
        "equipment_type": equipment.equipment_type,
        "current_site_name": site_name,
        "remaining_days": remaining_days,
        "remaining_hours": progress["remaining_duration_hours"],
        "current_utilization": equipment.utilization,
        "idle_hours": equipment.idle_hours,
        "estimated_avoided_idle_cost": estimated_avoided_idle_cost,
        "estimated_fuel_saved_l": estimated_fuel_saved_l,
        "evidence_summary": f"{eq_code} has {remaining_days} rental days remaining, but persistent telemetry indicates low productive usage. The machine may no longer be required at {site_name}.",
        "evidence_reasons": evidence_reasons,
        "reallocation_target": target_reallocation,
        "recommended_actions": [
            {
                "key": "RETURN_EARLY",
                "label": "Return Early to Depot",
                "description": "Mark rental completed early to make machine available for fleet dispatch."
            },
            {
                "key": "REALLOCATE",
                "label": f"Reallocate to {target_reallocation['site_code']}" if target_reallocation else "Reallocate Equipment",
                "description": f"Transfer to {target_reallocation['site_name']} with predicted demand." if target_reallocation else "Reallocate to higher-demand mining site."
            },
            {
                "key": "CONTINUE_RENTAL",
                "label": "Continue Current Rental",
                "description": "Maintain active rental contract if work activity is expected to resume."
            }
        ],
        "operator_guidance": f"Machine activity has decreased and the rental has approximately {remaining_days} days remaining. Your manager may review whether the machine is still required."
    }

    # Deduplicated alert creation
    existing_alert = db.query(Alert).filter(
        Alert.equipment_id == equipment.id,
        Alert.alert_type == "EARLY_RETURN_OPPORTUNITY",
        Alert.is_resolved == False
    ).first()

    if not existing_alert:
        alert = Alert(
            equipment_id=equipment.id,
            alert_type="EARLY_RETURN_OPPORTUNITY",
            severity="INFO",
            message=opportunity["evidence_summary"],
            is_resolved=False
        )
        db.add(alert)
        db.commit()

    return opportunity


def simulate_early_return(rental: Rental, equipment: Equipment, db: Session) -> Dict[str, Any]:
    """
    Simulates early return impact for a given active rental contract.
    COMPLETELY NON-MUTATING: Does NOT modify any database record. Decision support only.
    """
    progress = calculate_rental_progress(rental, equipment)
    remaining_days = progress["remaining_duration_days"]
    remaining_hours = progress["remaining_duration_hours"]

    total_hrs = equipment.engine_hours + equipment.idle_hours
    idle_ratio = (equipment.idle_hours / total_hrs) if total_hrs > 0 else 0.25

    # Financial & Operational Savings Estimates
    avoided_idle_cost = round(remaining_hours * DEFAULT_IDLE_COST_PER_HOUR * idle_ratio, 2)
    fuel_saved_l = round(remaining_hours * 6.0 * idle_ratio, 1)
    co2_saved_kg = round(fuel_saved_l * DEFAULT_CO2_EMISSION_FACTOR, 1)

    # Check potential reallocation destination
    all_sites = db.query(Site).all()
    all_eq = db.query(Equipment).all()
    forecasts = demand_predictor.predict_site_demands(all_sites, all_eq)

    dest_site_info = None
    for f in forecasts:
        if f["equipment_type"] == equipment.equipment_type and f["site_id"] != rental.site_id and f["predicted_shortage"] > 0:
            site_obj = db.query(Site).filter(Site.id == f["site_id"]).first()
            if site_obj:
                dest_site_info = {
                    "site_code": site_obj.site_code,
                    "site_name": site_obj.site_name,
                    "predicted_shortage": f["predicted_shortage"],
                    "estimated_utilization_gain": 25.0
                }
                break

    return {
        "feasible": True,
        "rental_id": rental.id,
        "equipment_id": equipment.equipment_id,
        "equipment_model": equipment.model,
        "equipment_type": equipment.equipment_type,
        "current_site": rental.site.site_name if rental.site else "Current Site",
        "planned_duration_days": progress["planned_duration_days"],
        "elapsed_duration_days": progress["elapsed_duration_days"],
        "remaining_duration_days": remaining_days,
        "current_utilization": equipment.utilization,
        "simulation_results": {
            "avoided_idle_cost": avoided_idle_cost,
            "potential_fuel_saved_liters": fuel_saved_l,
            "potential_co2_reduction_kg": co2_saved_kg,
            "availability_gained": f"1 unit of {equipment.equipment_type} restored to AVAILABLE depot inventory",
            "reallocation_opportunity": dest_site_info,
            "fleet_utilization_impact": f"+{round(remaining_days * 3.5, 1)} pts fleet capacity optimization score"
        },
        "verdict": "RECOMMENDED" if remaining_days >= 0.5 and equipment.utilization < 50.0 else "NEUTRAL",
        "safety_note": "This is a decision-support simulation only. No rental contracts, equipment statuses, or database records have been modified."
    }
