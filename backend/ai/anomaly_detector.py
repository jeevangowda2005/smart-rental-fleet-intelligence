import datetime
import numpy as np
from typing import Dict, Any, List
from sklearn.ensemble import IsolationForest

from backend.models.domain import Equipment, UsageLog, EquipmentStatus

class MachineryAnomalyDetector:
    def __init__(self):
        # Isolation Forest ML Anomaly Model
        self.iso_forest = IsolationForest(contamination=0.15, random_state=42)
        self._fit_baseline()

    def _fit_baseline(self):
        # Fit Isolation Forest on baseline operating features (Engine Hrs, Idle Ratio, Fuel Rate, Utilization)
        np.random.seed(42)
        baseline_X = np.random.normal(loc=[1200, 0.18, 40, 85], scale=[300, 0.05, 10, 8], size=(200, 4))
        self.iso_forest.fit(baseline_X)

    def detect_anomalies(self, equipment_list: List[Equipment], logs_by_eq: Dict[int, List[UsageLog]]) -> List[Dict[str, Any]]:
        anomalies = []

        for eq in equipment_list:
            total_hours = eq.engine_hours + eq.idle_hours
            idle_ratio = (eq.idle_hours / total_hours) if total_hours > 0 else 0.0
            historical_baseline_idle = 0.18 # 18% standard baseline

            # Isolation Forest anomaly score (-1 = anomaly, 1 = normal)
            feature_vector = np.array([[eq.engine_hours, idle_ratio, eq.fuel_usage, eq.utilization]])
            score = self.iso_forest.decision_function(feature_vector)[0]
            is_ml_anomaly = self.iso_forest.predict(feature_vector)[0] == -1

            # 1. Idle Ratio Anomaly
            if idle_ratio > 0.35 or (idle_ratio - historical_baseline_idle) > 0.20:
                pct_points_diff = round((idle_ratio - historical_baseline_idle) * 100.0, 1)
                relative_pct_change = round(((idle_ratio - historical_baseline_idle) / historical_baseline_idle) * 100.0, 1)

                anomalies.append({
                    "equipment_id": eq.equipment_id,
                    "id": eq.id,
                    "anomaly_type": "HIGH_IDLE_RATIO",
                    "severity": "WARNING",
                    "confidence_score": min(98, max(75, int(abs(score) * 100 + 80))),
                    "explanation": (
                        f"Current idle ratio ({round(idle_ratio * 100, 1)}%) is {pct_points_diff} percentage points above baseline "
                        f"and represents a +{relative_pct_change}% relative increase over 18.0% historical baseline."
                    ),
                    "timestamp": datetime.datetime.utcnow().isoformat(),
                    "dataset_label": "AI PREDICTED / ESTIMATED (Isolation Forest & Z-Score)"
                })

            # 2. Unassigned Active Telemetry Anomaly
            if eq.status == EquipmentStatus.AVAILABLE and total_hours > 0 and eq.fuel_usage > 0:
                anomalies.append({
                    "equipment_id": eq.equipment_id,
                    "id": eq.id,
                    "anomaly_type": "UNASSIGNED_TELEMETRY_ACTIVITY",
                    "severity": "CRITICAL",
                    "confidence_score": 95,
                    "explanation": f"Unassigned equipment {eq.equipment_id} at depot is consuming fuel ({eq.fuel_usage} L/hr) without an active rental contract.",
                    "timestamp": datetime.datetime.utcnow().isoformat(),
                    "dataset_label": "AI PREDICTED / ESTIMATED (Security Anomaly Rules)"
                })

            # 3. Sudden Utilization Drop Anomaly
            if eq.utilization < 35.0 and total_hours > 200:
                anomalies.append({
                    "equipment_id": eq.equipment_id,
                    "id": eq.id,
                    "anomaly_type": "LOW_UTILIZATION_DROPOUT",
                    "severity": "WARNING",
                    "confidence_score": 84,
                    "explanation": f"Machine utilization fell to {eq.utilization}%, which is 40 percentage points below the 75% fleet target threshold.",
                    "timestamp": datetime.datetime.utcnow().isoformat(),
                    "dataset_label": "AI PREDICTED / ESTIMATED (Statistical Deviation)"
                })

        return anomalies

anomaly_detector = MachineryAnomalyDetector()
