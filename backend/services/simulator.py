import asyncio
import datetime
import math
import random
import logging
from typing import Dict, Any
from sqlalchemy.orm import Session

from backend.database.session import SessionLocal
from backend.models.domain import Equipment, EquipmentStatus, Site, Alert, UsageLog
from backend.services.websocket_manager import ws_manager
from backend.services.fleet_intelligence import calculate_utilization

logger = logging.getLogger("telemetry_simulator")

# Run incident playbooks every N ticks (not every tick) to avoid flooding
INCIDENT_EVAL_EVERY_N_TICKS = 20
_tick_counter = 0


class TelemetrySimulationEngine:
    def __init__(self):
        self.is_running: bool = True
        self.speed: int = 1  # 1x, 2x, 5x
        self._task: asyncio.Task = None

    def start(self):
        self.is_running = True
        logger.info("Telemetry simulation engine resumed.")

    def pause(self):
        self.is_running = False
        logger.info("Telemetry simulation engine paused.")

    def set_speed(self, speed: int):
        if speed in [1, 2, 5]:
            self.speed = speed
            logger.info(f"Telemetry simulation speed set to {speed}x.")

    async def run_loop(self):
        global _tick_counter
        logger.info("Starting background telemetry simulation loop...")
        while True:
            try:
                interval = max(1.0, 3.0 / float(self.speed))
                await asyncio.sleep(interval)

                if not self.is_running:
                    continue

                _tick_counter += 1

                db: Session = SessionLocal()
                try:
                    active_machines = db.query(Equipment).filter(
                        Equipment.status.in_([
                            EquipmentStatus.ACTIVE,
                            EquipmentStatus.RENTED,
                            EquipmentStatus.IDLE,
                            EquipmentStatus.OVERDUE
                        ])
                    ).all()

                    incident_ws_events = []

                    for eq in active_machines:
                        lat_delta = random.uniform(-0.00025, 0.00025) * self.speed
                        lng_delta = random.uniform(-0.00025, 0.00025) * self.speed
                        eq.latitude = round(eq.latitude + lat_delta, 6)
                        eq.longitude = round(eq.longitude + lng_delta, 6)

                        if eq.status == EquipmentStatus.IDLE:
                            eq.idle_hours = round(eq.idle_hours + (0.0008 * self.speed), 4)
                        else:
                            eq.engine_hours = round(eq.engine_hours + (0.0007 * self.speed), 4)
                            eq.idle_hours = round(eq.idle_hours + (0.0001 * self.speed), 4)

                        eq.utilization = calculate_utilization(eq.engine_hours, eq.idle_hours)

                        # Geofence boundary validation
                        if eq.site:
                            dist = math.sqrt(
                                (eq.latitude - eq.site.latitude) ** 2 +
                                (eq.longitude - eq.site.longitude) ** 2
                            )
                            if dist > 0.035:
                                existing_breach = db.query(Alert).filter(
                                    Alert.equipment_id == eq.id,
                                    Alert.alert_type == "GEOFENCE_BREACH",
                                    Alert.is_resolved == False
                                ).first()
                                if not existing_breach:
                                    alert = Alert(
                                        equipment_id=eq.id,
                                        alert_type="GEOFENCE_BREACH",
                                        severity="WARNING",
                                        message=f"Equipment {eq.equipment_id} has moved outside assigned site boundary ({eq.site.site_name}).",
                                        is_resolved=False
                                    )
                                    db.add(alert)

                        # Lightweight predictive maintenance alert generation (deduplicated)
                        total_hrs = eq.engine_hours + eq.idle_hours
                        idle_ratio = (eq.idle_hours / total_hrs) if total_hrs > 0 else 0.0

                        if eq.engine_hours > 3500:
                            existing_maint_alert = db.query(Alert).filter(
                                Alert.equipment_id == eq.id,
                                Alert.alert_type.in_(["MAINTENANCE_RISK_HIGH", "MAINTENANCE_RISK_CRITICAL"]),
                                Alert.is_resolved == False
                            ).first()
                            if not existing_maint_alert:
                                db.add(Alert(
                                    equipment_id=eq.id,
                                    alert_type="MAINTENANCE_RISK_HIGH",
                                    severity="WARNING",
                                    message=f"Equipment {eq.equipment_id} engine meter ({eq.engine_hours} hrs) has exceeded major service interval threshold.",
                                    is_resolved=False
                                ))

                        if idle_ratio > 0.35:
                            existing_idle_alert = db.query(Alert).filter(
                                Alert.equipment_id == eq.id,
                                Alert.alert_type == "MAINTENANCE_EARLY_WARNING",
                                Alert.is_resolved == False
                            ).first()
                            if not existing_idle_alert:
                                db.add(Alert(
                                    equipment_id=eq.id,
                                    alert_type="MAINTENANCE_EARLY_WARNING",
                                    severity="WARNING",
                                    message=f"Equipment {eq.equipment_id} shows early warning signal: excessive idle ratio ({round(idle_ratio * 100, 1)}%).",
                                    is_resolved=False
                                ))

                        # Record UsageLog
                        log = UsageLog(
                            equipment_id=eq.id,
                            timestamp=datetime.datetime.utcnow(),
                            engine_hours=eq.engine_hours,
                            idle_hours=eq.idle_hours,
                            fuel_usage=eq.fuel_usage,
                            latitude=eq.latitude,
                            longitude=eq.longitude,
                            operating_status=eq.status.value
                        )
                        db.add(log)
                        db.commit()

                        # Broadcast telemetry WebSocket frame
                        telemetry_frame = {
                            "type": "TELEMETRY_UPDATE",
                            "timestamp": datetime.datetime.utcnow().isoformat(),
                            "equipment_id": eq.equipment_id,
                            "id": eq.id,
                            "model": eq.model,
                            "equipment_type": eq.equipment_type,
                            "status": eq.status.value,
                            "site_name": eq.site.site_name if eq.site else "Unassigned",
                            "operator_name": eq.operator.name if eq.operator else "Unassigned",
                            "latitude": eq.latitude,
                            "longitude": eq.longitude,
                            "engine_hours": eq.engine_hours,
                            "idle_hours": eq.idle_hours,
                            "fuel_usage": eq.fuel_usage,
                            "utilization": eq.utilization,
                            "event_message": f"{eq.equipment_id} updated position to ({eq.latitude:.4f}, {eq.longitude:.4f}) | {eq.engine_hours} hrs"
                        }
                        await ws_manager.broadcast(telemetry_frame)

                    # Run incident playbooks every N ticks — prevents flooding
                    if _tick_counter % INCIDENT_EVAL_EVERY_N_TICKS == 0:
                        try:
                            from backend.ai.incident_engine import run_all_playbooks_for_equipment
                            all_machines = db.query(Equipment).all()
                            for eq in all_machines:
                                run_all_playbooks_for_equipment(db, eq)

                            # Broadcast INCIDENT_UPDATE summary
                            await ws_manager.broadcast({
                                "type": "INCIDENT_UPDATE",
                                "timestamp": datetime.datetime.utcnow().isoformat(),
                                "message": "Fleet incident scan completed",
                                "dataset_label": "DEMO LIVE SIMULATION — NOT LIVE HARDWARE DATA"
                            })
                        except Exception as inc_err:
                            logger.warning(f"Incident evaluation error (non-critical): {inc_err}")

                finally:
                    db.close()

            except Exception as e:
                logger.error(f"Error in telemetry simulator loop: {e}")


simulator_engine = TelemetrySimulationEngine()
