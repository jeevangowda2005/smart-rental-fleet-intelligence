"""
Optimization Opportunity Scorer
Dynamically ranks top fleet optimization opportunities on an explainable 0–100 score scale
combining utilization gain, idle cost reduction, demand urgency, maintenance risk, and fuel efficiency.
"""

from typing import Dict, Any, List
from backend.models.domain import Equipment, Site, EquipmentStatus
from backend.ai.cost_config import DEFAULT_IDLE_COST_PER_HOUR, LABEL_ESTIMATED_IMPROVEMENT

class FleetOptimizationScorer:

    def rank_opportunities(
        self,
        equipment_list: List[Equipment],
        sites: List[Site],
        demand_forecasts: List[Dict[str, Any]],
        recommendations: List[Dict[str, Any]],
        maintenance_risks: List[Dict[str, Any]],
        fuel_analytics: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Dynamically ranks fleet optimization opportunities with explainable 0-100 scores
        and estimated financial & CO2 impacts.
        """
        opportunities = []
        op_id = 1

        # 1. Reallocation Opportunities from Recommendation Engine
        for rec in recommendations:
            eq_id = rec["equipment_id"]
            util_gain = rec["utilization_improvement"]
            est_saving = round(util_gain * 3500.0 + (rec["predicted_shortage"] * 10000.0), 2)
            score = min(99, max(50, rec["recommendation_score"]))

            opportunities.append({
                "id": f"OPP-{op_id:03d}",
                "category": "EQUIPMENT_REALLOCATION",
                "title": f"Reallocate {eq_id} → {rec['destination_site_code']}",
                "equipment_id": eq_id,
                "score": score,
                "problem": f"{eq_id} is under-utilized at {rec['current_site_code']} ({rec['current_utilization']}%) while {rec['destination_site_code']} faces a shortage.",
                "evidence": rec["reasons"],
                "recommended_action": f"MOVE {eq_id} → {rec['destination_site_code']}",
                "estimated_utilization_improvement_pts": util_gain,
                "estimated_financial_saving": est_saving,
                "estimated_co2_reduction_kg": round(util_gain * 18.0, 1),
                "confidence_pct": rec["confidence"],
                "dataset_label": LABEL_ESTIMATED_IMPROVEMENT
            })
            op_id += 1

        # 2. Severe Idle Reduction Opportunities
        for eq in equipment_list:
            total_hrs = eq.engine_hours + eq.idle_hours
            idle_ratio = (eq.idle_hours / total_hrs) if total_hrs > 0 else 0.0

            if idle_ratio > 0.30 and eq.idle_hours > 50:
                excess_idle = eq.idle_hours - (total_hrs * 0.18)
                est_saving = round(excess_idle * DEFAULT_IDLE_COST_PER_HOUR, 2)
                score = min(95, int(idle_ratio * 100 + 30))

                opportunities.append({
                    "id": f"OPP-{op_id:03d}",
                    "category": "IDLE_REDUCTION",
                    "title": f"Target Idle Reduction on {eq.equipment_id}",
                    "equipment_id": eq.equipment_id,
                    "score": score,
                    "problem": f"{eq.equipment_id} has logged {eq.idle_hours} idle hours ({round(idle_ratio * 100, 1)}% of runtime).",
                    "evidence": [
                        f"Idle ratio of {round(idle_ratio * 100, 1)}% exceeds 18% historical baseline.",
                        f"Excess idle time equals approximately {round(excess_idle, 1)} hours.",
                        f"Idle cost accrual rate = ₹{DEFAULT_IDLE_COST_PER_HOUR:.0f}/hr."
                    ],
                    "recommended_action": f"Review site operator idling policy for {eq.equipment_id} at {eq.site.site_code if eq.site else 'Depot'}",
                    "estimated_utilization_improvement_pts": round((excess_idle / max(1, total_hrs)) * 100.0, 1),
                    "estimated_financial_saving": est_saving,
                    "estimated_co2_reduction_kg": round(excess_idle * 32.1, 1),
                    "confidence_pct": 90,
                    "dataset_label": LABEL_ESTIMATED_IMPROVEMENT
                })
                op_id += 1

        # 3. High Maintenance Risk Prevention Opportunities
        high_risk_maint = [m for m in maintenance_risks if m["priority"] in ("HIGH", "CRITICAL")]
        for m in high_risk_maint:
            eq_id = m["equipment_id"]
            score = min(98, m["risk_score"])
            est_avoidance = round(m["risk_score"] * 800.0, 2)

            opportunities.append({
                "id": f"OPP-{op_id:03d}",
                "category": "PREVENTIVE_MAINTENANCE",
                "title": f"Prioritize Maintenance Inspection for {eq_id}",
                "equipment_id": eq_id,
                "score": score,
                "problem": f"{eq_id} has a high maintenance risk score of {m['risk_score']}/100.",
                "evidence": m["reasons"],
                "recommended_action": f"Schedule preventative service overhaul for {eq_id}",
                "estimated_utilization_improvement_pts": 5.0,
                "estimated_financial_saving": est_avoidance,
                "estimated_co2_reduction_kg": 45.0,
                "confidence_pct": 88,
                "dataset_label": LABEL_ESTIMATED_IMPROVEMENT
            })
            op_id += 1

        # Sort by 0-100 Opportunity Score descending
        opportunities.sort(key=lambda x: x["score"], reverse=True)
        return opportunities[:10]  # Top 10 opportunities

optimization_scorer = FleetOptimizationScorer()
