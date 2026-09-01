"""
Centralized Financial & Environmental Intelligence Configuration
Provides uniform rate assumptions across all Phase 5 business intelligence modules.
"""

from typing import Dict, Any

# Centralized Financial & Environmental Default Rates (in INR ₹ and standard units)
DEFAULT_IDLE_COST_PER_HOUR: float = 500.0        # ₹500 per idle hour
DEFAULT_OPERATING_COST_PER_HOUR: float = 1200.0  # ₹1200 per engine operating hour
DEFAULT_FUEL_COST_PER_LITER: float = 95.0        # ₹95 per liter of diesel
DEFAULT_MAINTENANCE_COST_PER_HOUR: float = 350.0  # ₹350 per engine hour for maintenance accrual
DEFAULT_CO2_EMISSION_FACTOR: float = 2.68        # 2.68 kg CO2 per liter of diesel fuel

# Category baseline fuel consumption rates (Liters per Engine Hour)
CATEGORY_FUEL_BASELINES: Dict[str, float] = {
    "Hydraulic Excavator": 28.5,
    "Off-Highway Haul Truck": 72.0,
    "Articulated Haul Truck": 45.0,
    "Track Dozer": 55.0,
    "Wheel Loader": 32.0,
    "Motor Grader": 24.0,
    "Soil Compactor": 20.0
}

# Standard Data Honesty & Honesty Labels
LABEL_ESTIMATED_COST = "ESTIMATED COST — DEMO DATA"
LABEL_ESTIMATED_IMPROVEMENT = "AI ESTIMATED IMPROVEMENT"
LABEL_ESTIMATED_CO2 = "ESTIMATED CO₂ — DEMONSTRATION MODEL"
LABEL_DEMO_CONFIG = "DEMO CONFIGURATION — NOT ACTUAL CUSTOMER COSTS"
LABEL_MAINTENANCE_RISK = "MAINTENANCE RISK ESTIMATE"

def get_current_cost_config() -> Dict[str, Any]:
    """Returns the current active centralized cost & environmental assumptions."""
    return {
        "idle_cost_per_hour": DEFAULT_IDLE_COST_PER_HOUR,
        "operating_cost_per_hour": DEFAULT_OPERATING_COST_PER_HOUR,
        "fuel_cost_per_liter": DEFAULT_FUEL_COST_PER_LITER,
        "maintenance_cost_per_hour": DEFAULT_MAINTENANCE_COST_PER_HOUR,
        "co2_emission_factor_kg_per_l": DEFAULT_CO2_EMISSION_FACTOR,
        "currency_symbol": "₹",
        "currency_code": "INR",
        "dataset_label": LABEL_DEMO_CONFIG,
        "disclaimer": "These rates are configurable demonstration assumptions and do not represent actual Caterpillar customer financial statements."
    }
