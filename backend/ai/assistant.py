import re
import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.models.domain import Equipment, Site, EquipmentStatus, Alert, Maintenance, Incident, IncidentStatus
from backend.ai.utilization_analyzer import utilization_analyzer
from backend.ai.anomaly_detector import anomaly_detector
from backend.ai.recommendation_engine import recommendation_engine
from backend.ai.demand_predictor import demand_predictor
from backend.ai.what_if_simulator import what_if_simulator
from backend.ai.business_intelligence import fleet_bi
from backend.ai.maintenance_intelligence import maintenance_analyzer
from backend.ai.fuel_intelligence import fuel_analyzer
from backend.ai.optimization_scorer import optimization_scorer
from backend.ai.predictive_maintenance import predictive_engine
from backend.ai.maintenance_priority_engine import priority_engine
from backend.ai.maintenance_what_if import maintenance_what_if
from backend.ai.cost_config import (
    LABEL_ESTIMATED_COST,
    LABEL_ESTIMATED_IMPROVEMENT,
    LABEL_DEMO_CONFIG
)


class FleetAssistant:

    def _detect_intent(self, query: str) -> str:
        q = query.lower()
        # Incident intents — Phase 7 (specific phrases checked before generic 'incident')
        if any(w in q for w in ["critical incident", "critical incidents"]):
            return "critical_incidents"
        if any(w in q for w in ["unresolved incident", "unresolved fleet", "open incident", "open incidents"]):
            return "unresolved_incidents"
        if any(w in q for w in ["resolved today", "incidents resolved", "closed today"]):
            return "resolved_today"
        if any(w in q for w in ["waiting for approval", "actions waiting", "pending approval", "need approval"]):
            return "pending_approvals"
        if any(w in q for w in ["geofence breach", "outside boundary", "breach"]):
            return "geofence_incidents"
        if any(w in q for w in ["maintenance actions need", "maintenance approval", "inspection approval"]):
            return "maintenance_approvals"
        if any(w in q for w in ["incident", "incidents need", "need my attention", "flagged incident"]):
            return "incidents_attention"
        # Maintenance intents — Phase 6
        if any(w in q for w in ["if we service", "service now", "service this machine"]):
            return "service_now_what_if"
        if any(w in q for w in ["when should", "be serviced", "maintenance window"]):
            return "when_serviced"
        if any(w in q for w in ["early warning", "early warning signs", "watch list"]):
            return "early_warning_signs"
        if any(w in q for w in ["serviced first", "service first", "priority machine"]):
            return "serviced_first"
        if any(w in q for w in ["health risk", "highest health risk", "highest maintenance risk", "highest risk", "predictive risk", "high risk"]):
            return "highest_maintenance_risk"
        if any(w in q for w in ["prioritized for maintenance", "maintenance priority", "maintenance action", "prioritize"]):
            return "maintenance_priority"
        if any(w in q for w in ["costing us the most", "highest cost", "biggest expense", "cost driver"]):
            return "highest_cost"
        if any(w in q for w in ["lowest utilization", "poor utilization", "losing utilization", "utilization loss", "under-utiliz", "underutiliz"]):
            return "under_utilized"
        if any(w in q for w in ["idle hours", "highest idle", "highest idle cost", "idle cost", "wasting idle"]):
            return "idle_cost"
        if any(w in q for w in ["fuel efficiency", "poor fuel", "fuel burn", "fuel usage"]):
            return "fuel_efficiency"
        if any(w in q for w in ["biggest optimization", "top opportunity", "save the most"]):
            return "optimization_opportunity"
        if any(w in q for w in ["save by reducing idle", "idle saving", "save idle"]):
            return "idle_saving"
        if any(w in q for w in ["anomal", "flagged", "why is", "problem", "issue"]):
            return "anomalies"
        if any(w in q for w in ["demand", "needed", "next week", "shortage", "require"]):
            return "demand"
        if any(w in q for w in ["what if", "what happen", "simulate", "if i move"]):
            return "what_if"
        if any(w in q for w in ["recommendation", "relocate", "where should we move", "which machine to move", "which excavator to move"]):
            return "recommend"
        if any(w in q for w in ["status", "fleet", "overview", "summary", "how many"]):
            return "fleet_summary"
        return "unknown"

    def _extract_equipment_id(self, query: str) -> Optional[str]:
        match = re.search(r'\b(CAT-[A-Z]{3}-\d{3,})\b', query.upper())
        return match.group(1) if match else None

    def _extract_site_code(self, query: str) -> Optional[str]:
        match = re.search(r'\b(S\d{3}|SITE[-\s]?[A-Z0-9]+)\b', query.upper())
        return match.group(1) if match else None

    def answer(
        self,
        query: str,
        db: Session,
    ) -> Dict[str, Any]:
        intent = self._detect_intent(query)
        eq_id_hint = self._extract_equipment_id(query)
        site_hint = self._extract_site_code(query)

        all_equipment = db.query(Equipment).all()
        all_sites = db.query(Site).all()

        logs_by_eq = {}
        alerts_by_eq = {}
        maint_by_eq = {}
        for eq in all_equipment:
            logs_by_eq[eq.id] = db.query(UsageLog).filter(UsageLog.equipment_id == eq.id).all() if 'UsageLog' in globals() else []
            alerts_by_eq[eq.id] = db.query(Alert).filter(Alert.equipment_id == eq.id).all()
            maint_by_eq[eq.id] = db.query(Maintenance).filter(Maintenance.equipment_id == eq.id).all()

        if intent == "incidents_attention":
            open_incidents = db.query(Incident).filter(
                Incident.status.notin_([IncidentStatus.RESOLVED, IncidentStatus.DISMISSED])
            ).order_by(Incident.severity_score.desc()).all()
            if eq_id_hint:
                eq = db.query(Equipment).filter(Equipment.equipment_id == eq_id_hint).first()
                if eq:
                    open_incidents = [i for i in open_incidents if i.equipment_id == eq.id]
            critical = [i for i in open_incidents if i.severity == "CRITICAL"]
            return {
                "intent": intent,
                "answer": f"You have {len(open_incidents)} open incident(s) requiring attention ({len(critical)} CRITICAL). Top incident: {open_incidents[0].description[:80] if open_incidents else 'None'}.",
                "data": [{"id": i.id, "type": i.incident_type, "severity": i.severity, "status": i.status.value, "description": i.description[:100], "equipment_id": i.equipment_id} for i in open_incidents[:5]],
                "dataset_label": "LIVE APPLICATION DATA"
            }

        elif intent == "critical_incidents":
            critical = db.query(Incident).filter(
                Incident.severity == "CRITICAL",
                Incident.status.notin_([IncidentStatus.RESOLVED, IncidentStatus.DISMISSED])
            ).order_by(Incident.created_at.desc()).all()
            return {
                "intent": intent,
                "answer": f"There are {len(critical)} critical open incident(s) requiring immediate attention." if critical else "No critical incidents open at this time.",
                "data": [{"id": i.id, "type": i.incident_type, "status": i.status.value, "description": i.description[:100], "equipment_id": i.equipment_id} for i in critical[:5]],
                "dataset_label": "LIVE APPLICATION DATA"
            }

        elif intent == "pending_approvals":
            from backend.models.domain import IncidentAction, IncidentActionStatus
            pending = db.query(IncidentAction).filter(
                IncidentAction.status == IncidentActionStatus.PENDING_APPROVAL
            ).all()
            return {
                "intent": intent,
                "answer": f"There are {len(pending)} incident action(s) awaiting Manager approval." if pending else "No actions currently pending Manager approval.",
                "data": [{"id": a.id, "incident_id": a.incident_id, "action_type": a.action_type, "dataset_label": "MANAGER APPROVAL REQUIRED"} for a in pending[:5]],
                "dataset_label": "LIVE APPLICATION DATA"
            }

        elif intent == "geofence_incidents":
            geo = db.query(Incident).filter(
                Incident.incident_type == "GEOFENCE_BREACH",
                Incident.status.notin_([IncidentStatus.RESOLVED, IncidentStatus.DISMISSED])
            ).all()
            return {
                "intent": intent,
                "answer": f"{len(geo)} active geofence breach incident(s) detected. Recommended action: Verify equipment location and confirm operator status." if geo else "No active geofence breach incidents.",
                "data": [{"id": i.id, "status": i.status.value, "description": i.description[:100], "equipment_id": i.equipment_id} for i in geo],
                "dataset_label": "LIVE APPLICATION DATA"
            }

        elif intent == "maintenance_approvals":
            from backend.models.domain import IncidentAction, IncidentActionStatus
            maint_pending = db.query(IncidentAction).filter(
                IncidentAction.action_type.in_(["CREATE_INSPECTION", "CREATE_MAINTENANCE_ORDER"]),
                IncidentAction.status == IncidentActionStatus.PENDING_APPROVAL
            ).all()
            return {
                "intent": intent,
                "answer": f"{len(maint_pending)} maintenance inspection/work-order action(s) awaiting Manager approval." if maint_pending else "No maintenance actions awaiting approval.",
                "data": [{"id": a.id, "incident_id": a.incident_id, "action_type": a.action_type} for a in maint_pending],
                "dataset_label": "MANAGER APPROVAL REQUIRED"
            }

        elif intent == "unresolved_incidents":
            unresolved = db.query(Incident).filter(
                Incident.status.notin_([IncidentStatus.RESOLVED, IncidentStatus.DISMISSED])
            ).order_by(Incident.severity_score.desc()).all()
            return {
                "intent": intent,
                "answer": f"There are {len(unresolved)} unresolved fleet incident(s)." if unresolved else "All fleet incidents are resolved or dismissed.",
                "data": [{"id": i.id, "type": i.incident_type, "severity": i.severity, "status": i.status.value, "description": i.description[:100]} for i in unresolved[:8]],
                "dataset_label": "LIVE APPLICATION DATA"
            }

        elif intent == "resolved_today":
            today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0)
            resolved = db.query(Incident).filter(
                Incident.status == IncidentStatus.RESOLVED,
                Incident.resolved_at >= today_start
            ).all()
            return {
                "intent": intent,
                "answer": f"{len(resolved)} fleet incident(s) were resolved today." if resolved else "No incidents have been resolved today.",
                "data": [{"id": i.id, "type": i.incident_type, "resolved_at": i.resolved_at.isoformat() if i.resolved_at else None, "equipment_id": i.equipment_id} for i in resolved],
                "dataset_label": "LIVE APPLICATION DATA"
            }

        elif intent == "highest_maintenance_risk":
            risks = predictive_engine.analyze_fleet_predictive_risk(all_equipment, logs_by_eq, alerts_by_eq, maint_by_eq)
            if eq_id_hint:
                risks = [r for r in risks if r["equipment_id"] == eq_id_hint]
            top = risks[0] if risks else None
            if not top:
                return {"intent": intent, "answer": "No maintenance risk data available.", "data": [], "dataset_label": "MAINTENANCE RISK ESTIMATE"}
            return {
                "intent": intent,
                "answer": (
                    f"Highest predictive maintenance risk asset is {top['equipment_id']} (Risk Score: {top['risk_score']}/100, Priority: {top['priority']}). "
                    f"State: {top['early_warning_state']}. Primary Reason: {top['reasons'][0]}"
                ),
                "data": risks[:5],
                "dataset_label": "MAINTENANCE RISK ESTIMATE"
            }

        elif intent == "serviced_first":
            priorities = priority_engine.rank_maintenance_priorities(all_equipment, logs_by_eq, alerts_by_eq, maint_by_eq)
            top = priorities[0] if priorities else None
            if not top:
                return {"intent": intent, "answer": "All equipment is operating normally.", "data": [], "dataset_label": "AI PREDICTED / ESTIMATED"}
            return {
                "intent": intent,
                "answer": (
                    f"Equipment that should be serviced first: Rank #1 {top['equipment_id']} (Risk Score: {top['risk_score']}/100, Priority: {top['priority']}). "
                    f"{top['recommended_action']}"
                ),
                "data": priorities[:5],
                "dataset_label": "AI PREDICTED / ESTIMATED"
            }

        elif intent == "early_warning_signs":
            risks = predictive_engine.analyze_fleet_predictive_risk(all_equipment, logs_by_eq, alerts_by_eq, maint_by_eq)
            warnings = [r for r in risks if r["early_warning_state"] in ("WATCH", "EARLY WARNING", "HIGH RISK", "CRITICAL")]
            if not warnings:
                return {
                    "intent": intent,
                    "answer": "All fleet machines are currently operating in NORMAL early warning state.",
                    "data": [],
                    "dataset_label": "AI PREDICTED / ESTIMATED"
                }
            return {
                "intent": intent,
                "answer": f"Found {len(warnings)} machine(s) exhibiting early warning telemetry signals.",
                "data": warnings,
                "dataset_label": "AI PREDICTED / ESTIMATED"
            }

        elif intent == "when_serviced":
            eq = db.query(Equipment).filter(Equipment.equipment_id == eq_id_hint).first() if eq_id_hint else all_equipment[0]
            risk = predictive_engine.calculate_predictive_risk(eq, logs_by_eq.get(eq.id, []), alerts_by_eq.get(eq.id, []), maint_by_eq.get(eq.id, []))
            return {
                "intent": intent,
                "answer": (
                    f"Estimated maintenance window for {eq.equipment_id}: {risk['estimated_maintenance_window']}. "
                    f"Current Engine Meter: {eq.engine_hours} hrs | Risk Score: {risk['risk_score']}/100."
                ),
                "data": risk,
                "dataset_label": "AI ESTIMATED MAINTENANCE WINDOW"
            }

        elif intent == "service_now_what_if":
            eq = db.query(Equipment).filter(Equipment.equipment_id == eq_id_hint).first() if eq_id_hint else all_equipment[0]
            sim = maintenance_what_if.simulate_service(eq, logs_by_eq.get(eq.id, []), alerts_by_eq.get(eq.id, []), maint_by_eq.get(eq.id, []))
            return {
                "intent": intent,
                "answer": (
                    f"Maintenance What-If Simulation for {eq.equipment_id}: Servicing now is {sim['verdict']}. "
                    f"Risk Score reduction: {sim['before']['risk_score']} → {sim['after']['estimated_risk_score']} pts. "
                    f"Estimated downtime hours saved: {sim['impact']['downtime_hours_saved']} hrs."
                ),
                "data": sim,
                "dataset_label": "AI PREDICTED / ESTIMATED (Simulation)"
            }

        elif intent == "highest_cost":
            costs = [fleet_bi.calculate_asset_costs(eq) for eq in all_equipment]
            costs.sort(key=lambda x: x["total_estimated_cost"], reverse=True)
            top = costs[0] if costs else None
            if not top:
                return {"intent": intent, "answer": "No equipment records found.", "data": [], "dataset_label": LABEL_ESTIMATED_COST}
            return {
                "intent": intent,
                "answer": (
                    f"Highest estimated operating cost asset is {top['equipment_id']} ({top['model']}) "
                    f"at {top['site_code']} with an estimated total cost of ₹{top['total_estimated_cost']:,.0f}."
                ),
                "data": costs[:5],
                "dataset_label": LABEL_ESTIMATED_COST
            }

        elif intent == "idle_cost":
            costs = [fleet_bi.calculate_asset_costs(eq) for eq in all_equipment]
            costs.sort(key=lambda x: x["estimated_idle_cost"], reverse=True)
            top = costs[0] if costs else None
            if not top:
                return {"intent": intent, "answer": "No idle cost data available.", "data": [], "dataset_label": LABEL_ESTIMATED_COST}
            return {
                "intent": intent,
                "answer": (
                    f"Asset with highest estimated idle cost is {top['equipment_id']} with {top['idle_hours']} idle hours "
                    f"(₹{top['estimated_idle_cost']:,.0f} estimated idle cost)."
                ),
                "data": costs[:5],
                "dataset_label": LABEL_ESTIMATED_COST
            }

        elif intent == "fuel_efficiency":
            fuel_reports = [fuel_analyzer.analyze_asset_fuel(eq) for eq in all_equipment]
            fuel_reports.sort(key=lambda x: x["deviation_pct"], reverse=True)
            poor_eff = [f for f in fuel_reports if f["efficiency_status"] == "FUEL EFFICIENCY ATTENTION"]
            top = fuel_reports[0] if fuel_reports else None
            if not top:
                return {"intent": intent, "answer": "No fuel efficiency data available.", "data": [], "dataset_label": "AI PREDICTED / ESTIMATED"}
            return {
                "intent": intent,
                "answer": (
                    f"Found {len(poor_eff)} equipment unit(s) with poor fuel efficiency relative to category baselines. "
                    f"Highest burn deviation: {top['equipment_id']} ({top['model']}) at {top['fuel_burn_rate_lph']} L/hr (+{top['deviation_pct']}% above baseline)."
                ),
                "data": fuel_reports[:5],
                "dataset_label": "AI PREDICTED / ESTIMATED"
            }

        elif intent == "idle_saving":
            summary = fleet_bi.calculate_fleet_summary(all_equipment, all_sites)
            return {
                "intent": intent,
                "answer": (
                    f"By reducing excess idle time across the fleet to the 18% baseline, the estimated potential saving is "
                    f"₹{summary['estimated_potential_idle_saving']:,.0f}."
                ),
                "data": summary,
                "dataset_label": LABEL_ESTIMATED_IMPROVEMENT
            }

        elif intent == "optimization_opportunity":
            forecasts = demand_predictor.predict_site_demands(all_sites, all_equipment)
            recs = recommendation_engine.generate_recommendations(all_equipment, all_sites, forecasts)
            maint_risks = maintenance_analyzer.analyze_fleet_maintenance_risk(all_equipment, alerts_by_eq, maint_by_eq)
            fuel_analytics = fuel_analyzer.analyze_fleet_fuel(all_equipment)

            opps = optimization_scorer.rank_opportunities(all_equipment, all_sites, forecasts, recs, maint_risks, fuel_analytics)
            top = opps[0] if opps else None
            if not top:
                return {"intent": intent, "answer": "All fleet operations are currently optimized.", "data": [], "dataset_label": LABEL_ESTIMATED_IMPROVEMENT}
            return {
                "intent": intent,
                "answer": (
                    f"Top optimization opportunity: '{top['title']}' (Score: {top['score']}/100). "
                    f"Action: {top['recommended_action']}."
                ),
                "data": opps,
                "dataset_label": LABEL_ESTIMATED_IMPROVEMENT
            }

        elif intent == "maintenance_priority":
            priorities = priority_engine.rank_maintenance_priorities(all_equipment, logs_by_eq, alerts_by_eq, maint_by_eq)
            top = priorities[0] if priorities else None
            if not top:
                return {"intent": intent, "answer": "All machinery is operating within normal maintenance parameters.", "data": [], "dataset_label": "MAINTENANCE RISK ESTIMATE"}
            return {
                "intent": intent,
                "answer": (
                    f"Highest maintenance priority asset is {top['equipment_id']} (Risk Score: {top['risk_score']}/100, Priority: {top['priority']}). "
                    f"Reason: {top['primary_reason']}"
                ),
                "data": priorities,
                "dataset_label": "MAINTENANCE RISK ESTIMATE"
            }

        elif intent == "under_utilized":
            results = utilization_analyzer.analyze_fleet(all_equipment, {}, {})
            under = [r for r in results if r["classification"] in ("UNDER_UTILIZED", "SEVERELY_UNDER_UTILIZED")]
            if not under:
                return {
                    "intent": intent,
                    "answer": "All fleet assets are currently operating at normal or high utilization levels.",
                    "data": [],
                    "dataset_label": "AI PREDICTED / ESTIMATED"
                }
            return {
                "intent": intent,
                "answer": f"Found {len(under)} under-utilized machine(s). Displaying ranked by lowest utilization.",
                "data": under,
                "dataset_label": "AI PREDICTED / ESTIMATED"
            }

        elif intent == "anomalies":
            anomalies = anomaly_detector.detect_anomalies(all_equipment, {})
            if eq_id_hint:
                anomalies = [a for a in anomalies if a["equipment_id"] == eq_id_hint]
            if not anomalies:
                return {
                    "intent": intent,
                    "answer": f"No active anomalies detected{' for ' + eq_id_hint if eq_id_hint else ' in the fleet'}.",
                    "data": [],
                    "dataset_label": "AI PREDICTED / ESTIMATED"
                }
            return {
                "intent": intent,
                "answer": f"Detected {len(anomalies)} anomaly flag(s). Review details below.",
                "data": anomalies,
                "dataset_label": "AI PREDICTED / ESTIMATED"
            }

        elif intent == "demand":
            forecasts = demand_predictor.predict_site_demands(all_sites, all_equipment)
            high_demand = [f for f in forecasts if f["demand_level"] == "HIGH" and f["predicted_shortage"] > 0]
            if site_hint:
                high_demand = [f for f in high_demand if site_hint in f["site_code"].upper()]
            return {
                "intent": intent,
                "answer": f"Predicted {len(high_demand)} high-demand shortage(s) across active sites in the next 7 days.",
                "data": high_demand,
                "dataset_label": "AI PREDICTED / ESTIMATED (Time-Aware RF Model)"
            }

        elif intent == "recommend":
            forecasts = demand_predictor.predict_site_demands(all_sites, all_equipment)
            recs = recommendation_engine.generate_recommendations(all_equipment, all_sites, forecasts)
            if not recs:
                return {
                    "intent": intent,
                    "answer": "No reallocation recommendations are available at this time.",
                    "data": [],
                    "dataset_label": "AI PREDICTED / ESTIMATED"
                }
            top = recs[0]
            return {
                "intent": intent,
                "answer": f"Top recommendation: Move {top['equipment_id']} → {top['destination_site_code']}. Confidence: {top['confidence']}%.",
                "data": recs,
                "dataset_label": "AI PREDICTED / ESTIMATED"
            }

        elif intent == "what_if":
            eq = db.query(Equipment).filter(Equipment.equipment_id == eq_id_hint).first() if eq_id_hint else (db.query(Equipment).filter(Equipment.status == EquipmentStatus.AVAILABLE).first() or all_equipment[0])
            dest_site = db.query(Site).filter((Site.site_code.ilike(f"%{site_hint}%")) | (Site.site_name.ilike(f"%{site_hint}%"))).first() if site_hint else (db.query(Site).filter(Site.id != eq.site_id).first() if eq.site_id else all_sites[0])

            if not dest_site or not eq:
                return {"intent": intent, "answer": "Unable to identify target equipment or destination site.", "data": None, "dataset_label": "AI PREDICTED / ESTIMATED"}

            current_supply = db.query(Equipment).filter(Equipment.site_id == dest_site.id, Equipment.equipment_type == eq.equipment_type).count()
            forecasts = demand_predictor.predict_site_demands(all_sites, all_equipment)
            dest_demand = next((f["predicted_requirement"] for f in forecasts if f["site_id"] == dest_site.id and f["equipment_type"] == eq.equipment_type), 2)

            result = what_if_simulator.simulate_move(eq, dest_site, dest_demand, current_supply)
            return {
                "intent": intent,
                "answer": f"What-If Simulation Result: Moving {eq.equipment_id} to {dest_site.site_code} is {result.get('verdict')}.",
                "data": result,
                "dataset_label": "AI PREDICTED / ESTIMATED (Simulation)"
            }

        elif intent == "fleet_summary":
            avg_util = round(sum(e.utilization for e in all_equipment) / max(1, len(all_equipment)), 1)
            return {
                "intent": intent,
                "answer": f"Fleet has {len(all_equipment)} machines across {len(all_sites)} sites. Average utilization: {avg_util}%.",
                "data": {"total": len(all_equipment), "avg_utilization": avg_util},
                "dataset_label": "LIVE APPLICATION DATA"
            }

        else:
            return {
                "intent": "unknown",
                "answer": (
                    "I can answer predictive maintenance questions about: highest risk machines, priority service order, "
                    "early warning signs, maintenance window estimates, maintenance what-if simulations, and cost drivers. "
                    "Try asking: 'Which machines are at highest maintenance risk?' or 'Which machine should be serviced first?'"
                ),
                "supported_queries": [
                    "Which machines are at highest maintenance risk?",
                    "Which machine should be serviced first?",
                    "Why is CAT-EXC-349 high risk?",
                    "Which machines are showing early warning signs?",
                    "When should CAT-TRK-777 be serviced?",
                    "What maintenance action should we prioritize?",
                    "What happens if we service CAT-EXC-349 now?",
                    "What is costing us the most?"
                ],
                "dataset_label": "AI FLEET ASSISTANT"
            }


fleet_assistant = FleetAssistant()
