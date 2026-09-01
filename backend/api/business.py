from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.database.session import get_db
from backend.models.domain import User, UserRole, Equipment, Site, Alert, Maintenance
from backend.services.auth import require_role

from backend.ai.cost_config import get_current_cost_config
from backend.ai.business_intelligence import fleet_bi
from backend.ai.maintenance_intelligence import maintenance_analyzer
from backend.ai.fuel_intelligence import fuel_analyzer
from backend.ai.optimization_scorer import optimization_scorer
from backend.ai.demand_predictor import demand_predictor
from backend.ai.recommendation_engine import recommendation_engine
from backend.ai.what_if_simulator import what_if_simulator

router = APIRouter(prefix="/api/business", tags=["Executive Business Intelligence"])

# All Executive & Business endpoints strictly require MANAGER role
manager_only = require_role([UserRole.MANAGER])


@router.get("/executive-summary")
def get_executive_summary(
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    """
    Returns executive-level summary KPIs including current vs optimized fleet utilization,
    estimated operating costs, estimated idle costs, optimization opportunities, and CO2 footprint.
    """
    equipment_list = db.query(Equipment).all()
    sites = db.query(Site).all()
    return fleet_bi.calculate_fleet_summary(equipment_list, sites)


@router.get("/costs")
def get_asset_cost_breakdown(
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    """
    Returns asset-level financial cost breakdown (Operating, Idle, Fuel, Maintenance, Total).
    """
    equipment_list = db.query(Equipment).all()
    costs = [fleet_bi.calculate_asset_costs(eq) for eq in equipment_list]
    costs.sort(key=lambda x: x["total_estimated_cost"], reverse=True)
    return {
        "asset_costs": costs,
        "total_assets": len(costs),
        "dataset_label": "ESTIMATED COST — DEMO DATA"
    }


@router.get("/idle-impact")
def get_idle_cost_analysis(
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    """
    Returns estimated financial impact of equipment engine idle time across the fleet.
    """
    equipment_list = db.query(Equipment).all()
    asset_costs = [fleet_bi.calculate_asset_costs(eq) for eq in equipment_list]
    high_idle = [a for a in asset_costs if a["excess_idle_hours"] > 0]
    high_idle.sort(key=lambda x: x["potential_idle_saving"], reverse=True)

    total_idle_cost = sum(a["estimated_idle_cost"] for a in asset_costs)
    total_potential_saving = sum(a["potential_idle_saving"] for a in asset_costs)

    return {
        "high_idle_assets": high_idle,
        "total_idle_assets_count": len(high_idle),
        "total_fleet_idle_cost": round(total_idle_cost, 2),
        "total_potential_idle_saving": round(total_potential_saving, 2),
        "dataset_label": "ESTIMATED COST — DEMO DATA"
    }


@router.get("/fuel-efficiency")
def get_fuel_efficiency_intelligence(
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    """
    Returns fuel burn rates, category baseline deviations, and carbon footprint (CO2 kg).
    """
    equipment_list = db.query(Equipment).all()
    analytics = fuel_analyzer.analyze_fleet_fuel(equipment_list)
    total_co2 = sum(a["total_estimated_co2_kg"] for a in analytics)
    total_idle_co2_wasted = sum(a["idle_co2_wasted_kg"] for a in analytics)

    return {
        "fuel_analytics": analytics,
        "total_fleet_co2_kg": round(total_co2, 1),
        "total_idle_co2_wasted_kg": round(total_idle_co2_wasted, 1),
        "inefficient_count": len([a for a in analytics if a["severity"] == "WARNING"]),
        "dataset_label": "ESTIMATED CO₂ — DEMONSTRATION MODEL"
    }


@router.get("/maintenance-risk")
def get_maintenance_risk_intelligence(
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    """
    Returns 0-100 Maintenance Risk Scores and priority levels (LOW, MEDIUM, HIGH, CRITICAL).
    """
    equipment_list = db.query(Equipment).all()
    alerts_by_eq = {}
    maint_by_eq = {}
    for eq in equipment_list:
        alerts_by_eq[eq.id] = db.query(Alert).filter(Alert.equipment_id == eq.id).all()
        maint_by_eq[eq.id] = db.query(Maintenance).filter(Maintenance.equipment_id == eq.id).all()

    risks = maintenance_analyzer.analyze_fleet_maintenance_risk(equipment_list, alerts_by_eq, maint_by_eq)
    return {
        "maintenance_risks": risks,
        "total_analyzed": len(risks),
        "critical_count": len([r for r in risks if r["priority"] == "CRITICAL"]),
        "high_count": len([r for r in risks if r["priority"] == "HIGH"]),
        "dataset_label": "MAINTENANCE RISK ESTIMATE"
    }


@router.get("/optimization-opportunities")
def get_optimization_opportunities(
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    """
    Returns ranked 0-100 optimization opportunities with estimated financial savings.
    """
    equipment_list = db.query(Equipment).all()
    sites = db.query(Site).all()
    forecasts = demand_predictor.predict_site_demands(sites, equipment_list)
    recs = recommendation_engine.generate_recommendations(equipment_list, sites, forecasts)

    alerts_by_eq = {}
    maint_by_eq = {}
    for eq in equipment_list:
        alerts_by_eq[eq.id] = db.query(Alert).filter(Alert.equipment_id == eq.id).all()
        maint_by_eq[eq.id] = db.query(Maintenance).filter(Maintenance.equipment_id == eq.id).all()

    maint_risks = maintenance_analyzer.analyze_fleet_maintenance_risk(equipment_list, alerts_by_eq, maint_by_eq)
    fuel_analytics = fuel_analyzer.analyze_fleet_fuel(equipment_list)

    opps = optimization_scorer.rank_opportunities(equipment_list, sites, forecasts, recs, maint_risks, fuel_analytics)
    return {
        "opportunities": opps,
        "total": len(opps),
        "dataset_label": "AI ESTIMATED IMPROVEMENT"
    }


class BusinessWhatIfRequest(BaseModel):
    fuel_price_change_pct: Optional[float] = 0.0
    idle_reduction_pct: Optional[float] = 0.0
    equipment_id: Optional[int] = None
    destination_site_id: Optional[int] = None


@router.post("/what-if-impact")
def run_business_what_if(
    request: BusinessWhatIfRequest,
    current_user: User = Depends(manager_only),
    db: Session = Depends(get_db)
):
    """
    Simulates operational AND financial Before vs After metrics.
    Does NOT modify database state.
    """
    if (request.fuel_price_change_pct != 0.0 or request.idle_reduction_pct != 0.0) or (request.equipment_id is None and request.destination_site_id is None):
        all_equipment = db.query(Equipment).all()
        all_sites = db.query(Site).all()
        baseline_summary = fleet_bi.calculate_fleet_summary(all_equipment, all_sites)

        base_op = baseline_summary["total_estimated_operating_cost"]
        base_idle = baseline_summary["total_estimated_idle_cost"]
        base_fuel = baseline_summary["total_estimated_fuel_cost"]
        base_maint = baseline_summary["total_estimated_maintenance_cost"]
        base_total = baseline_summary["total_estimated_fleet_cost"]
        base_co2 = baseline_summary["total_estimated_co2_emissions_kg"]

        fuel_mult = 1.0 + ((request.fuel_price_change_pct or 0.0) / 100.0)
        idle_reduction = (request.idle_reduction_pct or 0.0) / 100.0
        idle_mult = max(0.0, 1.0 - idle_reduction)

        adj_fuel = round(base_fuel * fuel_mult, 2)
        adj_idle = round(base_idle * idle_mult, 2)
        adj_total = round(base_op + adj_idle + adj_fuel + base_maint, 2)
        adj_co2 = round(base_co2 * idle_mult, 2)

        net_savings = round(base_total - adj_total, 2)

        return {
            "scenario": "FINANCIAL_SIMULATION",
            "fuel_price_change_pct": request.fuel_price_change_pct,
            "idle_reduction_pct": request.idle_reduction_pct,
            "before": {
                "operating_cost": base_op,
                "idle_cost": base_idle,
                "fuel_cost": base_fuel,
                "maintenance_cost": base_maint,
                "total_fleet_cost": base_total,
                "co2_emissions_kg": base_co2
            },
            "after": {
                "operating_cost": base_op,
                "idle_cost": adj_idle,
                "fuel_cost": adj_fuel,
                "maintenance_cost": base_maint,
                "total_fleet_cost": adj_total,
                "co2_emissions_kg": adj_co2
            },
            "net_financial_impact": net_savings,
            "verdict": "COST SAVINGS PROJECTED" if net_savings > 0 else ("COST INCREASE PROJECTED" if net_savings < 0 else "NO CHANGE"),
            "dataset_label": "AI PREDICTED / ESTIMATED (Simulation)"
        }

    eq = db.query(Equipment).filter(Equipment.id == request.equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Equipment not found")

    dest_site = db.query(Site).filter(Site.id == request.destination_site_id).first()
    if not dest_site:
        raise HTTPException(status_code=404, detail="Destination site not found")

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


@router.get("/config-assumptions")
def get_cost_assumptions(current_user: User = Depends(manager_only)):
    """
    Returns current centralized financial & environmental assumptions.
    """
    return get_current_cost_config()
