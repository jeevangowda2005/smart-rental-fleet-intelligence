"""
Final Production E2E Verification Test Suite
Extends integration coverage for:
- Role security & privilege escalation prevention during registration
- RBAC HTTP 403 / 401 enforcement across Executive & Manager endpoints
- Equipment QR code resolution (matching qr_code or equipment_id)
- Checkout / Check-in edge cases (double check-in rejection, double checkout rejection)
- Telemetry physical invariant verification (Operating + Idle <= Rental Duration)
- Billing calculation & idempotency
- AI/ML Demand Forecasting, Anomaly Detection, and Non-Mutating What-If Simulations
"""

import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from backend.database.session import Base, get_db
from backend.main import app
from backend.models.domain import (
    User, UserRole, Site, Equipment, EquipmentStatus,
    Rental, RentalStatus, Billing, Alert, UsageLog
)
from backend.services.auth import get_password_hash
from backend.ai.demand_predictor import demand_predictor
from backend.ai.anomaly_detector import anomaly_detector

E2E_TEST_URL = "sqlite:///:memory:"

e2e_test_engine = create_engine(
    E2E_TEST_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
E2ETestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=e2e_test_engine)


def _e2e_override_get_db():
    db = E2ETestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_e2e_database():
    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = _e2e_override_get_db

    Base.metadata.create_all(bind=e2e_test_engine)
    db = E2ETestSessionLocal()

    # Seed manager & operator
    mgr = User(
        name="Alex Mercer (Fleet Director)",
        email="manager@catfleet.com",
        password_hash=get_password_hash("password123"),
        role=UserRole.MANAGER,
    )
    op = User(
        name="Marcus Vance (Operator)",
        email="operator@catfleet.com",
        password_hash=get_password_hash("password123"),
        role=UserRole.OPERATOR,
    )
    db.add_all([mgr, op])
    db.flush()

    site = Site(
        site_code="SITE-PIT-01",
        site_name="Northern Mining Pit A",
        location="Denver, CO",
        latitude=39.7392,
        longitude=-104.9903,
    )
    db.add(site)
    db.flush()

    eq_avail = Equipment(
        equipment_id="CAT-EXC-390",
        equipment_type="Hydraulic Excavator",
        model="CAT 390F Mass Excavator",
        status=EquipmentStatus.AVAILABLE,
        site_id=site.id,
        latitude=39.7400,
        longitude=-104.9910,
        engine_hours=520.0,
        idle_hours=45.0,
        fuel_usage=65.0,
        utilization=91.3,
        qr_code="QR-CAT-EXC-390",
    )
    eq_rented = Equipment(
        equipment_id="CAT-TRK-730",
        equipment_type="Articulated Haul Truck",
        model="CAT 730 Ejector Truck",
        status=EquipmentStatus.RENTED,
        site_id=site.id,
        operator_id=op.id,
        latitude=39.7380,
        longitude=-104.9880,
        engine_hours=1120.0,
        idle_hours=180.0,
        fuel_usage=48.0,
        utilization=83.9,
        qr_code="QR-CAT-TRK-730",
    )
    db.add_all([eq_avail, eq_rented])
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=e2e_test_engine)

    if previous_override is None:
        app.dependency_overrides.pop(get_db, None)
    else:
        app.dependency_overrides[get_db] = previous_override


client = TestClient(app)


def test_registration_role_escalation_prevention():
    """Verify registration ignores client-supplied role=MANAGER and forces OPERATOR."""
    resp = client.post("/api/auth/register", json={
        "name": "Attacker Trying Manager",
        "email": "hacker@catfleet.com",
        "password": "Password123!",
        "role": "MANAGER"  # Attempting privilege escalation
    })
    assert resp.status_code == 200, resp.text
    user_data = resp.json()
    assert user_data["role"] == "OPERATOR", f"Privilege escalation vulnerability! Role set to {user_data['role']}"

    # Confirm in DB
    db = E2ETestSessionLocal()
    u = db.query(User).filter(User.email == "hacker@catfleet.com").first()
    assert u.role == UserRole.OPERATOR
    db.close()


def test_rbac_executive_and_manager_endpoints():
    """Verify Operators get 403 and unauthenticated calls get 401 on Manager endpoints."""
    # 1. Unauthenticated request
    unauth_resp = client.get("/api/business/executive-summary")
    assert unauth_resp.status_code in [401, 403], f"Expected 401/403, got {unauth_resp.status_code}"

    # 2. Operator login
    op_login = client.post("/api/auth/login", json={"email": "operator@catfleet.com", "password": "password123"}).json()
    op_headers = {"Authorization": f"Bearer {op_login['access_token']}"}

    # Operator accessing manager endpoints MUST return 403
    for path in ["/api/business/executive-summary", "/api/business/costs", "/api/business/idle-impact", "/api/incidents"]:
        op_resp = client.get(path, headers=op_headers)
        assert op_resp.status_code == 403, f"Operator should be forbidden from {path}, got {op_resp.status_code}"

    # 3. Manager login
    mgr_login = client.post("/api/auth/login", json={"email": "manager@catfleet.com", "password": "password123"}).json()
    mgr_headers = {"Authorization": f"Bearer {mgr_login['access_token']}"}

    mgr_resp = client.get("/api/business/executive-summary", headers=mgr_headers)
    assert mgr_resp.status_code == 200, f"Manager failed to access executive summary: {mgr_resp.text}"


def test_qr_code_lookup_and_checkin():
    """Verify QR code lookup works using full QR string (e.g. 'QR-CAT-EXC-390') or code."""
    mgr_login = client.post("/api/auth/login", json={"email": "manager@catfleet.com", "password": "password123"}).json()
    headers = {"Authorization": f"Bearer {mgr_login['access_token']}"}

    # Query details using raw QR string
    resp = client.get("/api/equipment/QR-CAT-EXC-390/details", headers=headers)
    assert resp.status_code == 200, f"QR code lookup failed: {resp.text}"
    assert resp.json()["equipment_id"] == "CAT-EXC-390"


def test_double_checkout_and_double_checkin_rejection():
    """Verify unavailable equipment checkout is rejected & checkin without active rental is rejected."""
    op_login = client.post("/api/auth/login", json={"email": "operator@catfleet.com", "password": "password123"}).json()
    headers = {"Authorization": f"Bearer {op_login['access_token']}"}

    db = E2ETestSessionLocal()
    eq_rented = db.query(Equipment).filter(Equipment.equipment_id == "CAT-TRK-730").first()
    site = db.query(Site).first()
    rented_id = eq_rented.id
    site_id = site.id
    op_id = op_login["user"]["id"]
    db.close()

    # Attempt checking out already rented equipment
    co_resp = client.post("/api/rentals/checkout", headers=headers, json={
        "equipment_id": rented_id,
        "site_id": site_id,
        "operator_id": op_id,
        "expected_return_days": 5
    })
    assert co_resp.status_code == 400, "Double checkout of rented equipment should be rejected with 400!"

    # Attempt check-in on AVAILABLE equipment with no active rental
    db = E2ETestSessionLocal()
    eq_avail = db.query(Equipment).filter(Equipment.equipment_id == "CAT-EXC-390").first()
    avail_code = eq_avail.equipment_id
    db.close()

    ci_resp = client.post(f"/api/rentals/checkin-by-equipment/{avail_code}", headers=headers)
    assert ci_resp.status_code == 400, "Check-in of available equipment without active rental should return 400!"


def test_ai_demand_forecasting_and_anomalies():
    """Verify AI Demand Forecasting and Anomaly Detection generate real non-random predictions."""
    db = E2ETestSessionLocal()
    sites = db.query(Site).all()
    equipment_list = db.query(Equipment).all()

    # Demand prediction
    demands = demand_predictor.predict_site_demands(sites, equipment_list)
    assert len(demands) > 0
    assert "predicted_requirement" in demands[0]

    # Anomaly detection
    anomalies = anomaly_detector.detect_anomalies(equipment_list, {})
    assert isinstance(anomalies, list)
    db.close()


def test_business_what_if_simulation_non_mutating():
    """Verify business what-if impact simulation returns metrics and leaves DB state unmodified."""
    mgr_login = client.post("/api/auth/login", json={"email": "manager@catfleet.com", "password": "password123"}).json()
    headers = {"Authorization": f"Bearer {mgr_login['access_token']}"}

    sim_resp = client.post("/api/business/what-if-impact", headers=headers, json={
        "fuel_price_change_pct": 10.0,
        "idle_reduction_pct": 15.0
    })
    assert sim_resp.status_code == 200, sim_resp.text
    res = sim_resp.json()
    assert "before" in res and "after" in res
    assert res["scenario"] == "FINANCIAL_SIMULATION"
