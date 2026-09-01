"""
Maintenance Risk Intelligence Module
Evaluates equipment engine meter hours, idle ratio trend, telemetry alerts,
and scheduled maintenance dates to compute transparent Maintenance Risk Scores (0-100).
"""

import datetime
from typing import Dict, Any, List
from backend.models.domain import Equipment, Alert, Maintenance, EquipmentStatus
from backend.ai.cost_config import LABEL_MAINTENANCE_RISK

class MaintenanceRiskAnalyzer:

    def compute_asset_maintenance_risk(
        self,
        eq: Equipment,
        active_alerts: List[Alert],
        maintenance_records: List[Maintenance]
    ) -> Dict[str, Any]:
        """
        Computes an explainable Maintenance Risk Score (0-100) and priority level
        (LOW, MEDIUM, HIGH, CRITICAL).
        """
        score = 0
        reasons = []

        eng_hrs = eq.engine_hours
        total_hrs = eng_hrs + eq.idle_hours
        idle_ratio = (eq.idle_hours / total_hrs) if total_hrs > 0 else 0.0

        # 1. Cumulative Engine Hours Meter Factor (Max 35 pts)
        if eng_hrs > 3500:
            score += 35
            reasons.append(f"High cumulative engine meter ({eng_hrs} hrs) exceeds major service interval.")
        elif eng_hrs > 2000:
            score += 20
            reasons.append(f"Elevated engine meter ({eng_hrs} hrs) approaching 2500-hr overhaul threshold.")
        elif eng_hrs > 1000:
            score += 10
            reasons.append(f"Standard operating hours ({eng_hrs} hrs).")

        # 2. Elevated Idle Ratio Factor (Max 20 pts)
        if idle_ratio > 0.35:
            score += 20
            reasons.append(f"Severe engine idling ({round(idle_ratio * 100, 1)}%) increases engine thermal wear.")
        elif idle_ratio > 0.25:
            score += 10
            reasons.append(f"Elevated idle ratio ({round(idle_ratio * 100, 1)}%).")

        # 3. Active Telemetry Alerts Factor (Max 30 pts)
        crit_alerts = [a for a in active_alerts if a.severity == "CRITICAL" and not a.is_resolved]
        warn_alerts = [a for a in active_alerts if a.severity == "WARNING" and not a.is_resolved]

        if crit_alerts:
            score += 30
            reasons.append(f"{len(crit_alerts)} active CRITICAL telemetry alert(s) logged.")
        elif warn_alerts:
            score += 15
            reasons.append(f"{len(warn_alerts)} active WARNING alert(s) logged.")

        # 4. Status & Service Schedule Factor (Max 15 pts)
        if eq.status == EquipmentStatus.MAINTENANCE:
            score += 15
            reasons.append("Machine currently assigned to active maintenance status.")

        active_in_prog = [m for m in maintenance_records if m.status == "IN_PROGRESS"]
        if active_in_prog:
            score += 10
            reasons.append(f"Active maintenance order in progress: '{active_in_prog[0].maintenance_type}'.")

        # Determine Priority Level
        if score >= 70 or crit_alerts or eq.status == EquipmentStatus.MAINTENANCE:
            priority = "CRITICAL"
        elif score >= 45:
            priority = "HIGH"
        elif score >= 25:
            priority = "MEDIUM"
        else:
            priority = "LOW"

        if not reasons:
            reasons.append("All mechanical and operating indicators within normal parameters.")

        return {
            "equipment_id": eq.equipment_id,
            "id": eq.id,
            "model": eq.model,
            "equipment_type": eq.equipment_type,
            "status": eq.status.value,
            "site_code": eq.site.site_code if eq.site else "DEPOT",
            "engine_hours": eng_hrs,
            "idle_ratio_pct": round(idle_ratio * 100, 1),
            "risk_score": min(100, score),
            "priority": priority,
            "reasons": reasons,
            "dataset_label": LABEL_MAINTENANCE_RISK,
            "disclaimer": "This priority score is an AI risk estimate based on telemetry meter trends and alert events."
        }

    def analyze_fleet_maintenance_risk(
        self,
        equipment_list: List[Equipment],
        alerts_by_eq: Dict[int, List[Alert]],
        maint_by_eq: Dict[int, List[Maintenance]]
    ) -> List[Dict[str, Any]]:
        results = []
        for eq in equipment_list:
            eq_alerts = alerts_by_eq.get(eq.id, [])
            eq_maint = maint_by_eq.get(eq.id, [])
            res = self.compute_asset_maintenance_risk(eq, eq_alerts, eq_maint)
            results.append(res)
        
        # Sort highest risk score first
        results.sort(key=lambda x: x["risk_score"], reverse=True)
        return results

maintenance_analyzer = MaintenanceRiskAnalyzer()
