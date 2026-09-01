from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database.session import get_db
from backend.models.domain import Equipment, EquipmentStatus, Site, Alert, Rental, RentalStatus, User
from backend.schemas.domain import DashboardStats
from backend.services.auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    total_eq = db.query(Equipment).count()
    available_cnt = db.query(Equipment).filter(Equipment.status == EquipmentStatus.AVAILABLE).count()
    rented_cnt = db.query(Equipment).filter(Equipment.status == EquipmentStatus.RENTED).count()
    active_cnt = db.query(Equipment).filter(Equipment.status == EquipmentStatus.ACTIVE).count()
    idle_cnt = db.query(Equipment).filter(Equipment.status == EquipmentStatus.IDLE).count()
    overdue_cnt = db.query(Equipment).filter(Equipment.status == EquipmentStatus.OVERDUE).count()
    maint_cnt = db.query(Equipment).filter(Equipment.status == EquipmentStatus.MAINTENANCE).count()
    
    total_sites = db.query(Site).count()
    active_alerts = db.query(Alert).filter(Alert.is_resolved == False).count()

    avg_util = db.query(func.avg(Equipment.utilization)).scalar() or 0.0
    avg_fuel = db.query(func.avg(Equipment.fuel_usage)).scalar() or 0.0

    return DashboardStats(
        total_equipment=total_eq,
        available_count=available_cnt,
        rented_count=rented_cnt,
        active_count=active_cnt,
        idle_count=idle_cnt,
        overdue_count=overdue_cnt,
        maintenance_count=maint_cnt,
        avg_utilization=round(float(avg_util), 1),
        avg_fuel_usage=round(float(avg_fuel), 1),
        total_sites=total_sites,
        active_alerts=active_alerts
    )

@router.get("/charts")
def get_dashboard_charts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Equipment Status Distribution
    status_counts = (
        db.query(Equipment.status, func.count(Equipment.id))
        .group_by(Equipment.status)
        .all()
    )
    status_data = [
        {"name": status.value if hasattr(status, "value") else str(status), "value": count}
        for status, count in status_counts
    ]

    # 2. Site Utilization & Machine Count
    sites = db.query(Site).all()
    site_data = []
    for s in sites:
        eq_list = db.query(Equipment).filter(Equipment.site_id == s.id).all()
        if eq_list:
            avg_site_util = sum(e.utilization for e in eq_list) / len(eq_list)
        else:
            avg_site_util = 0
        site_data.append({
            "site_code": s.site_code,
            "site_name": s.site_name,
            "equipment_count": len(eq_list),
            "avg_utilization": round(avg_site_util, 1)
        })

    # 3. Top Machine Fuel & Utilization Breakdown
    top_machines = (
        db.query(Equipment)
        .order_by(Equipment.utilization.desc())
        .limit(8)
        .all()
    )
    machine_performance = [
        {
            "equipment_id": e.equipment_id,
            "model": e.model,
            "utilization": e.utilization,
            "fuel_usage": e.fuel_usage,
            "engine_hours": e.engine_hours,
            "idle_hours": e.idle_hours
        }
        for e in top_machines
    ]

    return {
        "status_distribution": status_data,
        "site_performance": site_data,
        "top_machines": machine_performance
    }
