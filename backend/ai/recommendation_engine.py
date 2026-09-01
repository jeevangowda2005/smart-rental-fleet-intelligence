import math
import datetime
from typing import Dict, Any, List, Optional
from backend.models.domain import Equipment, EquipmentStatus, Site


# Equipment that is actively locked CANNOT be recommended for relocation
BLOCKED_STATUSES = {
    EquipmentStatus.RENTED,
    EquipmentStatus.ACTIVE,
    EquipmentStatus.MAINTENANCE,
    EquipmentStatus.OVERDUE,
}

# Equipment eligible for reallocation recommendations
ELIGIBLE_STATUSES = {
    EquipmentStatus.AVAILABLE,
    EquipmentStatus.IDLE,
}


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Approximate great-circle distance in km between two lat/lng coordinates."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


class RecommendationEngine:

    def generate_recommendations(
        self,
        equipment_list: List[Equipment],
        sites: List[Site],
        demand_forecasts: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Produces ranked, explainable equipment reallocation recommendations.
        - NEVER recommends RENTED, ACTIVE, MAINTENANCE, or OVERDUE equipment.
        - Prefers AVAILABLE and IDLE machines that are under-utilized.
        - Scores candidates on demand shortage, type match, distance, utilization improvement.
        """
        # Build a demand shortage lookup: (site_id, equipment_type) -> shortage
        shortage_map: Dict[tuple, Dict] = {}
        for forecast in demand_forecasts:
            if forecast["predicted_shortage"] > 0:
                key = (forecast["site_id"], forecast["equipment_type"])
                shortage_map[key] = forecast

        # Build site lookup
        site_map = {s.id: s for s in sites}

        recommendations = []

        for eq in equipment_list:
            # Safety gate: skip ineligible equipment
            if eq.status in BLOCKED_STATUSES:
                continue
            if eq.status not in ELIGIBLE_STATUSES and eq.utilization >= 50.0:
                continue  # Only recommend idle or low-utilization machines

            current_util = eq.utilization
            if current_util >= 60.0:
                continue  # Not under-utilized enough to justify move

            current_site = site_map.get(eq.site_id)

            for (dest_site_id, eq_type), forecast in shortage_map.items():
                # Type compatibility check
                if eq.equipment_type != eq_type:
                    continue
                # Don't recommend moving to the same site
                if dest_site_id == eq.site_id:
                    continue

                dest_site = site_map.get(dest_site_id)
                if not dest_site:
                    continue

                # Distance factor (closer = higher score)
                if current_site:
                    dist_km = _haversine_km(
                        current_site.latitude, current_site.longitude,
                        dest_site.latitude, dest_site.longitude
                    )
                else:
                    dist_km = 500.0  # Default large distance for depot equipment

                distance_score = max(0, 30 - int(dist_km / 10))  # Max 30 pts, decreases with distance

                # Demand urgency score (higher shortage = higher score)
                demand_score = min(40, forecast["predicted_shortage"] * 15)  # Max 40 pts

                # Utilization improvement score
                estimated_util_after = min(95.0, current_util + (forecast["predicted_shortage"] * 15.0))
                util_improvement = estimated_util_after - current_util
                util_score = min(30, int(util_improvement / 2))  # Max 30 pts

                total_score = distance_score + demand_score + util_score

                reasons = [
                    f"{dest_site.site_code} predicted {eq_type} shortage = {forecast['predicted_shortage']} unit(s).",
                    f"Machine current utilization = {current_util}% (under-utilized threshold: 60%).",
                    f"Equipment type '{eq_type}' matches destination demand category.",
                    f"Machine status is {eq.status.value} — eligible for reallocation.",
                ]
                if dist_km < 200:
                    reasons.append(f"Destination site is {round(dist_km, 1)} km away — logistically accessible.")
                else:
                    reasons.append(f"Destination is {round(dist_km, 1)} km away — logistics cost should be evaluated.")

                recommendations.append({
                    "equipment_id": eq.equipment_id,
                    "equipment_db_id": eq.id,
                    "model": eq.model,
                    "equipment_type": eq.equipment_type,
                    "current_status": eq.status.value,
                    "current_site_code": current_site.site_code if current_site else "DEPOT",
                    "current_site_name": current_site.site_name if current_site else "Depot",
                    "destination_site_id": dest_site_id,
                    "destination_site_code": dest_site.site_code,
                    "destination_site_name": dest_site.site_name,
                    "current_utilization": current_util,
                    "estimated_utilization_after": round(estimated_util_after, 1),
                    "utilization_improvement": round(util_improvement, 1),
                    "destination_demand_level": forecast["demand_level"],
                    "predicted_shortage": forecast["predicted_shortage"],
                    "distance_km": round(dist_km, 1),
                    "recommendation_score": total_score,
                    "confidence": min(95, total_score + 10),
                    "reasons": reasons,
                    "action": f"MOVE {eq.equipment_id} → {dest_site.site_code}",
                    "timestamp": datetime.datetime.utcnow().isoformat(),
                    "dataset_label": "AI PREDICTED / ESTIMATED",
                    "safety_note": "This is a decision-support recommendation only. No rental or equipment records are modified automatically."
                })

        # Rank by score descending, deduplicate to best move per equipment
        seen_eq = set()
        ranked = []
        for rec in sorted(recommendations, key=lambda x: x["recommendation_score"], reverse=True):
            if rec["equipment_id"] not in seen_eq:
                seen_eq.add(rec["equipment_id"])
                ranked.append(rec)

        return ranked[:10]  # Top 10 recommendations


recommendation_engine = RecommendationEngine()
