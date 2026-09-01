import math
import datetime
from typing import Dict, Any, Optional
from backend.models.domain import Equipment, Site, EquipmentStatus
from backend.ai.cost_config import (
    DEFAULT_IDLE_COST_PER_HOUR,
    DEFAULT_OPERATING_COST_PER_HOUR,
    DEFAULT_FUEL_COST_PER_LITER,
    DEFAULT_CO2_EMISSION_FACTOR,
    LABEL_ESTIMATED_COST,
    LABEL_ESTIMATED_IMPROVEMENT
)

BLOCKED_STATUSES = {
    EquipmentStatus.RENTED,
    EquipmentStatus.ACTIVE,
    EquipmentStatus.MAINTENANCE,
    EquipmentStatus.OVERDUE,
}


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


class WhatIfSimulator:

    def simulate_move(
        self,
        eq: Equipment,
        destination_site: Site,
        demand_at_destination: int,
        current_supply_at_destination: int,
    ) -> Dict[str, Any]:
        """
        Simulates the estimated operational AND business impact of moving equipment to a new site.
        DOES NOT modify any database records. Decision-support only.
        """

        # Safety check: blocked statuses cannot be simulated
        if eq.status in BLOCKED_STATUSES:
            return {
                "feasible": False,
                "reason": f"Equipment {eq.equipment_id} is currently {eq.status.value} and cannot be reallocated.",
                "safety_note": "No records have been modified. This is a simulation only."
            }

        current_site = eq.site
        current_util = eq.utilization
        total_hrs = eq.engine_hours + eq.idle_hours
        current_idle_ratio = (eq.idle_hours / total_hrs) if total_hrs > 0 else 0.0

        # Distance
        dist_km = 0.0
        if current_site:
            dist_km = _haversine_km(
                current_site.latitude, current_site.longitude,
                destination_site.latitude, destination_site.longitude
            )

        # Estimated utilization after move based on demand shortage
        shortage = max(0, demand_at_destination - current_supply_at_destination)
        util_boost = shortage * 14.0  # ~14% per unit of shortage
        estimated_util_after = min(95.0, current_util + util_boost)
        util_improvement = estimated_util_after - current_util

        # Demand coverage before and after
        demand_coverage_before = (
            min(100.0, (current_supply_at_destination / demand_at_destination) * 100.0)
            if demand_at_destination > 0 else 100.0
        )
        new_supply = current_supply_at_destination + 1
        demand_coverage_after = (
            min(100.0, (new_supply / demand_at_destination) * 100.0)
            if demand_at_destination > 0 else 100.0
        )

        # Idle reduction estimate
        estimated_idle_reduction_pct = min(40.0, util_improvement * 0.6)
        estimated_idle_ratio_after = max(0.05, current_idle_ratio - (estimated_idle_reduction_pct / 100.0))
        estimated_idle_hrs_saved = round(eq.idle_hours * (estimated_idle_reduction_pct / 100.0), 1)

        # Dynamic Business & Financial Calculations
        idle_cost_before = round(eq.idle_hours * DEFAULT_IDLE_COST_PER_HOUR, 2)
        idle_cost_after = round(max(0.0, eq.idle_hours - estimated_idle_hrs_saved) * DEFAULT_IDLE_COST_PER_HOUR, 2)
        estimated_cost_reduction = round(idle_cost_before - idle_cost_after, 2)

        est_fuel_saved_l = round(estimated_idle_hrs_saved * 12.0, 1) # ~12L per reduced idle hr
        estimated_co2_reduction_kg = round(est_fuel_saved_l * DEFAULT_CO2_EMISSION_FACTOR, 1)

        # Net impact verdict
        if util_improvement >= 20.0 and demand_coverage_after > demand_coverage_before:
            verdict = "RECOMMENDED"
            confidence = min(95, 65 + int(util_improvement))
        elif util_improvement >= 5.0:
            verdict = "NEUTRAL"
            confidence = 55
        else:
            verdict = "NOT RECOMMENDED"
            confidence = 40

        return {
            "feasible": True,
            "equipment_id": eq.equipment_id,
            "equipment_type": eq.equipment_type,
            "model": eq.model,
            "current_status": eq.status.value,
            "current_site_code": current_site.site_code if current_site else "DEPOT",
            "destination_site_code": destination_site.site_code,
            "destination_site_name": destination_site.site_name,
            "distance_km": round(dist_km, 1),
            "before": {
                "utilization": current_util,
                "idle_ratio_pct": round(current_idle_ratio * 100, 1),
                "idle_hours": eq.idle_hours,
                "demand_coverage_pct": round(demand_coverage_before, 1),
                "supply_at_destination": current_supply_at_destination,
                "estimated_idle_cost": idle_cost_before,
            },
            "after": {
                "estimated_utilization": round(estimated_util_after, 1),
                "estimated_idle_ratio_pct": round(estimated_idle_ratio_after * 100, 1),
                "estimated_idle_hours": round(max(0.0, eq.idle_hours - estimated_idle_hrs_saved), 1),
                "estimated_demand_coverage_pct": round(demand_coverage_after, 1),
                "supply_at_destination": new_supply,
                "idle_reduction_pct": round(estimated_idle_reduction_pct, 1),
                "estimated_idle_cost": idle_cost_after,
            },
            "impact": {
                "utilization_improvement_pts": round(util_improvement, 1),
                "idle_hours_reduced": estimated_idle_hrs_saved,
                "estimated_potential_cost_reduction": estimated_cost_reduction,
                "estimated_co2_reduction_kg": estimated_co2_reduction_kg,
            },
            "utilization_improvement": round(util_improvement, 1),
            "verdict": verdict,
            "confidence": confidence,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "dataset_label": "AI PREDICTED / ESTIMATED (Simulation)",
            "safety_note": "This is a decision-support simulation only. No rental assignments, equipment status, operator assignments, or site allocations have been modified."
        }


what_if_simulator = WhatIfSimulator()
