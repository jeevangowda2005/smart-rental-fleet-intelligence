import datetime
from typing import Dict, Any, List
from backend.models.domain import Equipment, EquipmentStatus


UTILIZATION_THRESHOLDS = {
    "HIGHLY_UTILIZED": 75.0,
    "NORMAL": 50.0,
    "UNDER_UTILIZED": 35.0,
    # Below 35.0 = SEVERELY_UNDER_UTILIZED
}


class UtilizationAnalyzer:

    def classify_equipment(
        self,
        eq: Equipment,
        recent_logs: List[Any],
        upcoming_demand: Dict[str, int]
    ) -> Dict[str, Any]:
        """
        Multi-factor under-utilization classifier considering:
        - Current utilization
        - 7-day utilization trend
        - Idle ratio
        - Upcoming site demand context
        """
        current_util = eq.utilization
        total_hrs = eq.engine_hours + eq.idle_hours
        idle_ratio = (eq.idle_hours / total_hrs) if total_hrs > 0 else 0.0

        # Calculate 7-day utilization trend from recent logs
        recent_utils = []
        for log in (recent_logs or [])[:7]:
            t = log.engine_hours + log.idle_hours
            if t > 0:
                recent_utils.append((log.engine_hours / t) * 100.0)
        trend_util = (sum(recent_utils) / len(recent_utils)) if recent_utils else current_util
        util_trend_delta = current_util - trend_util  # Positive = improving, Negative = declining

        # Site demand pressure
        site_code = eq.site.site_code if eq.site else "DEPOT"
        demand_at_site = upcoming_demand.get(f"{site_code}:{eq.equipment_type}", 0)

        # Classification logic (multi-factor, not just threshold)
        reasons = []

        if current_util >= UTILIZATION_THRESHOLDS["HIGHLY_UTILIZED"] and idle_ratio < 0.25:
            classification = "HIGHLY_UTILIZED"
            reasons.append(f"Utilization is {current_util}%, well above the 75% high-utilization threshold.")
            if util_trend_delta > 0:
                reasons.append(f"7-day utilization trend is improving (+{round(util_trend_delta, 1)}%).")
        elif current_util >= UTILIZATION_THRESHOLDS["NORMAL"]:
            classification = "NORMAL"
            reasons.append(f"Utilization is {current_util}%, within the normal operating range (50–75%).")
            if idle_ratio > 0.25:
                reasons.append(f"Idle ratio of {round(idle_ratio * 100, 1)}% is approaching cautionary levels.")
        elif current_util >= UTILIZATION_THRESHOLDS["UNDER_UTILIZED"]:
            classification = "UNDER_UTILIZED"
            reasons.append(f"Utilization is {current_util}%, below the 50% efficiency target.")
            if idle_ratio > 0.30:
                reasons.append(f"Idle ratio is elevated at {round(idle_ratio * 100, 1)}% (baseline: 18%).")
            if util_trend_delta < -5:
                reasons.append(f"7-day utilization trend is declining ({round(util_trend_delta, 1)}%).")
            if demand_at_site < 1:
                reasons.append(f"Upcoming demand at {site_code} for {eq.equipment_type} is LOW — relocation may improve efficiency.")
        else:
            classification = "SEVERELY_UNDER_UTILIZED"
            reasons.append(f"Utilization is {current_util}%, severely below the 35% minimum efficiency threshold.")
            if idle_ratio > 0.35:
                pct_pts = round((idle_ratio - 0.18) * 100, 1)
                rel_pct = round(((idle_ratio - 0.18) / 0.18) * 100.0, 1)
                reasons.append(
                    f"Idle ratio ({round(idle_ratio * 100, 1)}%) is {pct_pts} percentage points above "
                    f"the 18% baseline — a +{rel_pct}% relative increase."
                )
            reasons.append("Immediate reallocation or reassignment should be evaluated.")

        return {
            "equipment_id": eq.equipment_id,
            "id": eq.id,
            "model": eq.model,
            "equipment_type": eq.equipment_type,
            "status": eq.status.value,
            "site_code": site_code,
            "current_utilization": current_util,
            "idle_ratio": round(idle_ratio * 100, 1),
            "trend_utilization": round(trend_util, 1),
            "trend_delta": round(util_trend_delta, 1),
            "classification": classification,
            "reasons": reasons,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "dataset_label": "AI PREDICTED / ESTIMATED"
        }

    def analyze_fleet(
        self,
        equipment_list: List[Equipment],
        logs_by_eq: Dict[int, List[Any]],
        upcoming_demand: Dict[str, int]
    ) -> List[Dict[str, Any]]:
        results = []
        for eq in equipment_list:
            logs = logs_by_eq.get(eq.id, [])
            result = self.classify_equipment(eq, logs, upcoming_demand)
            results.append(result)
        # Sort: most under-utilized first
        results.sort(key=lambda x: x["current_utilization"])
        return results


utilization_analyzer = UtilizationAnalyzer()
