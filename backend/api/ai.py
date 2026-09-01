from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from backend.database.session import get_db
from backend.models.domain import User, UserRole, Equipment, Site, EquipmentStatus, UsageLog
from backend.services.auth import require_role

from backend.ai.synthetic_data import generate_synthetic_historical_data
from backend.ai.anomaly_detector import anomaly_detector
from backend.ai.utilization_analyzer import utilization_analyzer
from backend.ai.demand_predictor import demand_predictor
from backend.ai.recommendation_engine import recommendation_engine
from backend.ai.what_if_simulator import what_if_simulator
from backend.ai.assistant import fleet_assistant

router = APIRouter(prefix="/api/ai", tags=["AI Fleet Intelligence"])

# All AI endpoints require MANAGER role
manager_only = require_role([UserRole.MANAGER])


@router.get("/demand")
def get_demand_forecasts(
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    sites = db.query(Site).all()
    equipment_list = db.query(Equipment).all()
    forecasts = demand_predictor.predict_site_demands(sites, equipment_list)
    return {
        "forecasts": forecasts,
        "total": len(forecasts),
        "high_demand_count": len([f for f in forecasts if f["demand_level"] == "HIGH"]),
        "shortage_count": len([f for f in forecasts if f["predicted_shortage"] > 0]),
        "dataset_label": "AI PREDICTED / ESTIMATED (Time-Aware RF Model, Synthetic 180-Day Dataset, Seed 42)"
    }


@router.get("/anomalies")
def get_anomalies(
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    equipment_list = db.query(Equipment).all()
    # Gather recent logs per equipment
    logs_by_eq = {}
    for eq in equipment_list:
        logs = (
            db.query(UsageLog)
            .filter(UsageLog.equipment_id == eq.id)
            .order_by(UsageLog.timestamp.desc())
            .limit(10)
            .all()
        )
        logs_by_eq[eq.id] = logs

    anomalies = anomaly_detector.detect_anomalies(equipment_list, logs_by_eq)
    return {
        "anomalies": anomalies,
        "total": len(anomalies),
        "critical_count": len([a for a in anomalies if a["severity"] == "CRITICAL"]),
        "warning_count": len([a for a in anomalies if a["severity"] == "WARNING"]),
        "dataset_label": "AI PREDICTED / ESTIMATED (Isolation Forest & Statistical Deviation)"
    }


@router.get("/underutilized")
def get_underutilized(
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    equipment_list = db.query(Equipment).all()
    logs_by_eq = {}
    for eq in equipment_list:
        logs = (
            db.query(UsageLog)
            .filter(UsageLog.equipment_id == eq.id)
            .order_by(UsageLog.timestamp.desc())
            .limit(7)
            .all()
        )
        logs_by_eq[eq.id] = logs

    classifications = utilization_analyzer.analyze_fleet(equipment_list, logs_by_eq, {})
    under = [c for c in classifications if c["classification"] in ("UNDER_UTILIZED", "SEVERELY_UNDER_UTILIZED")]
    return {
        "all_classifications": classifications,
        "under_utilized": under,
        "total_analyzed": len(classifications),
        "under_utilized_count": len(under),
        "dataset_label": "AI PREDICTED / ESTIMATED"
    }


@router.get("/recommendations")
def get_recommendations(
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    equipment_list = db.query(Equipment).all()
    sites = db.query(Site).all()
    forecasts = demand_predictor.predict_site_demands(sites, equipment_list)
    recs = recommendation_engine.generate_recommendations(equipment_list, sites, forecasts)
    return {
        "recommendations": recs,
        "total": len(recs),
        "dataset_label": "AI PREDICTED / ESTIMATED",
        "safety_note": "Recommendations are decision-support only. No records are modified automatically."
    }


class WhatIfRequest(BaseModel):
    equipment_id: int
    destination_site_id: int


@router.post("/what-if")
def run_what_if(
    request: WhatIfRequest,
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    eq = db.query(Equipment).filter(Equipment.id == request.equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Equipment not found")

    dest_site = db.query(Site).filter(Site.id == request.destination_site_id).first()
    if not dest_site:
        raise HTTPException(status_code=404, detail="Destination site not found")

    # Get current supply and demand at destination
    current_supply = db.query(Equipment).filter(
        Equipment.site_id == request.destination_site_id,
        Equipment.equipment_type == eq.equipment_type
    ).count()

    sites = db.query(Site).all()
    all_equipment = db.query(Equipment).all()
    forecasts = demand_predictor.predict_site_demands(sites, all_equipment)
    dest_demand = next(
        (f["predicted_requirement"] for f in forecasts
         if f["site_id"] == request.destination_site_id and f["equipment_type"] == eq.equipment_type),
        2
    )

    result = what_if_simulator.simulate_move(eq, dest_site, dest_demand, current_supply)
    return result


class AssistantRequest(BaseModel):
    query: str


@router.post("/assistant")
def query_assistant(
    request: AssistantRequest,
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    if not request.query or not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    result = fleet_assistant.answer(request.query, db)
    return result


@router.get("/synthetic-data-info")
def get_synthetic_data_info(current_user: User = Depends(manager_only)):
    df = generate_synthetic_historical_data(days=5, seed=42)  # Just a sample
    return {
        "label": "SYNTHETIC HISTORICAL DATASET (180-Day Pattern, Seed 42)",
        "description": "Deterministic synthetic operational dataset generated for ML training. Does NOT represent real Caterpillar customer data.",
        "days_generated": 180,
        "seed": 42,
        "sample_records": df.head(5).to_dict(orient="records")
    }
