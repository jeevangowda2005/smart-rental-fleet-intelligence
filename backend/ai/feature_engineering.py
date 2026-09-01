import numpy as np
import pandas as pd
from typing import Dict, Any, List
from backend.models.domain import Equipment, UsageLog, Site

def extract_equipment_features(eq: Equipment, logs: List[UsageLog]) -> Dict[str, Any]:
    """
    Feature engineering transformer converting an Equipment instance and its UsageLogs
    into numerical feature vectors for ML models.
    """
    total_hours = eq.engine_hours + eq.idle_hours
    idle_ratio = (eq.idle_hours / total_hours) if total_hours > 0 else 0.0

    # Calculate 7-day trend from logs if available
    recent_utils = []
    recent_idles = []
    if logs:
        for l in logs[:10]:
            tot = l.engine_hours + l.idle_hours
            if tot > 0:
                recent_utils.append((l.engine_hours / tot) * 100.0)
                recent_idles.append(l.idle_hours / tot)

    avg_recent_util = float(np.mean(recent_utils)) if recent_utils else eq.utilization
    avg_recent_idle_ratio = float(np.mean(recent_idles)) if recent_idles else idle_ratio
    util_delta = eq.utilization - avg_recent_util

    return {
        "equipment_id": eq.equipment_id,
        "id": eq.id,
        "engine_hours": eq.engine_hours,
        "idle_hours": eq.idle_hours,
        "total_hours": total_hours,
        "idle_ratio": round(idle_ratio, 3),
        "fuel_usage": eq.fuel_usage,
        "utilization": eq.utilization,
        "avg_recent_util": round(avg_recent_util, 1),
        "avg_recent_idle_ratio": round(avg_recent_idle_ratio, 3),
        "utilization_delta": round(util_delta, 1),
        "status": eq.status.value,
        "site_id": eq.site_id,
        "site_code": eq.site.site_code if eq.site else "DEPOT"
    }

def prepare_demand_features(df: pd.DataFrame) -> tuple:
    """
    Prepares X (features) and y (demand target) for time-aware model validation.
    Features: day_of_week, is_weekend, site encoded, equipment_type encoded, avg_utilization.
    """
    df_encoded = pd.get_dummies(df, columns=["site_code", "equipment_type"], drop_first=False)
    feature_cols = [c for c in df_encoded.columns if c not in ["date", "predicted_demand_count", "allocated_count", "dataset_label"]]

    X = df_encoded[feature_cols]
    y = df_encoded["predicted_demand_count"]
    return X, y, feature_cols
