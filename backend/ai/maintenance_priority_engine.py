"""
Maintenance Priority Engine
Ranks fleet equipment into an explainable Maintenance Priority List (#1, #2...)
combining predictive risk score, cumulative engine meter, active telemetry alerts,
fuel efficiency deviation, and operational criticality.
"""

from typing import Dict, Any, List
from backend.models.domain import Equipment, Alert, Maintenance
from backend.ai.predictive_maintenance import predictive_engine, LABEL_AI_PREDICTED, LABEL_RECOMMENDED_INSPECTION

class MaintenancePriorityEngine:

    def rank_maintenance_priorities(
        self,
        equipment_list: List[Equipment],
        logs_by_eq: Dict[int, List[Any]],
        alerts_by_eq: Dict[int, List[Alert]],
        maint_by_eq: Dict[int, List[Maintenance]]
    ) -> List[Dict[str, Any]]:
        """
        Dynamically ranks fleet equipment by maintenance priority with explainable reasons.
        """
        fleet_risks = predictive_engine.analyze_fleet_predictive_risk(
            equipment_list, logs_by_eq, alerts_by_eq, maint_by_eq
        )

        priorities = []
        for rank, risk in enumerate(fleet_risks, start=1):
            eq_id = risk["equipment_id"]
            rec_action = f"RECOMMENDED INSPECTION: Perform preventative service check on {eq_id} before next major assignment."
            if risk["priority"] == "CRITICAL":
                rec_action = f"RECOMMENDED INSPECTION: Inspect fuel and hydraulic system on {eq_id} and schedule service before next deployment."

            priorities.append({
                "rank": rank,
                "equipment_id": eq_id,
                "id": risk["id"],
                "model": risk["model"],
                "equipment_type": risk["equipment_type"],
                "site_code": risk["site_code"],
                "risk_score": risk["risk_score"],
                "priority": risk["priority"],
                "early_warning_state": risk["early_warning_state"],
                "risk_trend": risk["risk_trend"],
                "trend_delta_pts": risk["trend_delta_pts"],
                "primary_reason": risk["reasons"][0] if risk["reasons"] else "Standard operational monitoring.",
                "recommended_action": rec_action,
                "estimated_maintenance_window": risk["estimated_maintenance_window"],
                "business_impact": risk["business_impact"],
                "dataset_label": LABEL_AI_PREDICTED
            })

        return priorities

priority_engine = MaintenancePriorityEngine()
