"""
Fuel Efficiency & Carbon Intelligence Module
Analyzes fuel consumption rates per engine hour against category baselines,
detects fuel inefficiencies, and calculates estimated CO2 carbon emissions.
"""

from typing import Dict, Any, List
from backend.models.domain import Equipment
from backend.ai.cost_config import (
    CATEGORY_FUEL_BASELINES,
    DEFAULT_FUEL_COST_PER_LITER,
    DEFAULT_CO2_EMISSION_FACTOR,
    LABEL_ESTIMATED_CO2
)

class FuelIntelligenceAnalyzer:

    def analyze_asset_fuel(self, eq: Equipment) -> Dict[str, Any]:
        """
        Dynamically analyzes fuel efficiency and carbon emissions for a single asset.
        """
        eq_type = eq.equipment_type
        baseline_lph = CATEGORY_FUEL_BASELINES.get(eq_type, 30.0)

        # Actual or estimated fuel burn rate in L/hr
        current_lph = eq.fuel_usage if eq.fuel_usage > 0 else baseline_lph

        deviation_pct = round(((current_lph - baseline_lph) / baseline_lph) * 100.0, 1)

        if deviation_pct > 15.0:
            status = "FUEL EFFICIENCY ATTENTION"
            severity = "WARNING"
            explanation = f"Fuel consumption ({current_lph} L/hr) is +{deviation_pct}% above category baseline ({baseline_lph} L/hr)."
        elif deviation_pct < -15.0:
            status = "HIGHLY FUEL EFFICIENT"
            severity = "OPTIMAL"
            explanation = f"Fuel consumption ({current_lph} L/hr) is {abs(deviation_pct)}% below baseline category burn rate."
        else:
            status = "NORMAL FUEL EFFICIENCY"
            severity = "NORMAL"
            explanation = f"Fuel burn rate ({current_lph} L/hr) is aligned with category benchmark ({baseline_lph} L/hr)."

        eng_hrs = eq.engine_hours
        total_fuel_l = round(current_lph * (eng_hrs + eq.idle_hours), 1)
        estimated_co2_kg = round(total_fuel_l * DEFAULT_CO2_EMISSION_FACTOR, 1)

        # Idle fuel wasted (~10 Liters per idle hour for heavy equipment)
        idle_fuel_wasted_l = round(eq.idle_hours * 10.0, 1)
        idle_co2_wasted_kg = round(idle_fuel_wasted_l * DEFAULT_CO2_EMISSION_FACTOR, 1)
        idle_fuel_cost = round(idle_fuel_wasted_l * DEFAULT_FUEL_COST_PER_LITER, 2)

        return {
            "equipment_id": eq.equipment_id,
            "id": eq.id,
            "model": eq.model,
            "equipment_type": eq_type,
            "fuel_burn_rate_lph": current_lph,
            "category_baseline_lph": baseline_lph,
            "deviation_pct": deviation_pct,
            "efficiency_status": status,
            "severity": severity,
            "total_estimated_fuel_liters": total_fuel_l,
            "total_estimated_co2_kg": estimated_co2_kg,
            "idle_fuel_wasted_liters": idle_fuel_wasted_l,
            "idle_co2_wasted_kg": idle_co2_wasted_kg,
            "estimated_idle_fuel_cost": idle_fuel_cost,
            "explanation": explanation,
            "dataset_label": LABEL_ESTIMATED_CO2
        }

    def analyze_fleet_fuel(self, equipment_list: List[Equipment]) -> List[Dict[str, Any]]:
        results = [self.analyze_asset_fuel(eq) for eq in equipment_list]
        # Sort highest deviation first
        results.sort(key=lambda x: x["deviation_pct"], reverse=True)
        return results

fuel_analyzer = FuelIntelligenceAnalyzer()
