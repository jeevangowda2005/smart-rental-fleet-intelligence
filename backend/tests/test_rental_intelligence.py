import datetime
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from backend.database.session import Base, get_db
from backend.models.domain import (
    User, UserRole, Site, Equipment, EquipmentStatus, Rental, RentalStatus, UsageLog, Alert
)
from backend.services.auth import get_password_hash, create_access_token
from backend.services.rental_intelligence import (
    calculate_rental_progress,
    evaluate_early_return_opportunity,
    simulate_early_return
)
from backend.main import app

from sqlalchemy.pool import StaticPool

# Setup in-memory SQLite database for testing with StaticPool
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Seed test users
    mgr = User(name="Test Manager", email="testmgr@cat.com", password_hash=get_password_hash("pass"), role=UserRole.MANAGER)
    op1 = User(name="Test Operator 1", email="testop1@cat.com", password_hash=get_password_hash("pass"), role=UserRole.OPERATOR)
    op2 = User(name="Test Operator 2", email="testop2@cat.com", password_hash=get_password_hash("pass"), role=UserRole.OPERATOR)
    db.add_all([mgr, op1, op2])
    db.commit()

    # Seed test sites
    s1 = Site(site_code="SITE-01", site_name="Pit North", location="Denver", latitude=39.7, longitude=-104.9)
    s2 = Site(site_code="SITE-02", site_name="Quarry South", location="Salt Lake", latitude=40.7, longitude=-111.8)
    db.add_all([s1, s2])
    db.commit()

    # Seed test equipment
    eq1 = Equipment(equipment_id="CAT-EXC-100", equipment_type="Hydraulic Excavator", model="CAT 349", status=EquipmentStatus.AVAILABLE, engine_hours=100.0, idle_hours=20.0, fuel_usage=40.0, utilization=80.0)
    eq2 = Equipment(equipment_id="CAT-TRK-200", equipment_type="Off-Highway Haul Truck", model="CAT 777", status=EquipmentStatus.AVAILABLE, engine_hours=50.0, idle_hours=35.0, fuel_usage=60.0, utilization=30.0)
    db.add_all([eq1, eq2])
    db.commit()

    yield db

    db.close()
    Base.metadata.drop_all(bind=engine)

def get_auth_headers(email: str, role: str):
    token = create_access_token(data={"sub": email, "role": role})
    return {"Authorization": f"Bearer {token}"}


# 1. Test Rental Progress Calculation
def test_calculate_rental_progress(setup_database):
    db = setup_database
    eq = db.query(Equipment).filter(Equipment.equipment_id == "CAT-EXC-100").first()
    op = db.query(User).filter(User.email == "testop1@cat.com").first()
    site = db.query(Site).filter(Site.site_code == "SITE-01").first()

    now = datetime.datetime.utcnow()
    checkout = now - datetime.timedelta(days=1, hours=12) # 1.5 days elapsed
    expected = checkout + datetime.timedelta(days=3)       # 3 days planned total (1.5 days remaining)

    rental = Rental(
        equipment_id=eq.id,
        operator_id=op.id,
        site_id=site.id,
        checkout_time=checkout,
        expected_return_time=expected,
        status=RentalStatus.ACTIVE
    )
    db.add(rental)
    db.commit()

    progress = calculate_rental_progress(rental, eq)
    assert progress["planned_duration_days"] == 3.0
    assert progress["elapsed_duration_days"] == 1.5
    assert progress["remaining_duration_days"] == 1.5
    assert progress["progress_pct"] == 50.0
    assert progress["utilization_pct"] == 80.0


# 2. Test Early Return Detection - Single Isolated Event vs Persistent Evidence
def test_early_return_single_event_not_triggered(setup_database):
    db = setup_database
    eq = db.query(Equipment).filter(Equipment.equipment_id == "CAT-EXC-100").first()
    op = db.query(User).filter(User.email == "testop1@cat.com").first()
    site = db.query(Site).filter(Site.site_code == "SITE-01").first()

    # Active rental with 2 days remaining
    now = datetime.datetime.utcnow()
    checkout = now - datetime.timedelta(days=1)
    expected = now + datetime.timedelta(days=2)
    rental = Rental(equipment_id=eq.id, operator_id=op.id, site_id=site.id, checkout_time=checkout, expected_return_time=expected, status=RentalStatus.ACTIVE)
    db.add(rental)
    db.commit()

    # Add 4 active logs and 1 single low utilization log
    for i in range(4):
        log = UsageLog(equipment_id=eq.id, timestamp=now - datetime.timedelta(hours=i*4), engine_hours=80.0, idle_hours=10.0, operating_status="ACTIVE")
        db.add(log)
    # Single low utilization log
    single_idle = UsageLog(equipment_id=eq.id, timestamp=now, engine_hours=5.0, idle_hours=95.0, operating_status="IDLE")
    db.add(single_idle)
    db.commit()

    # High machine overall utilization (80%) + single idle log -> SHOULD NOT TRIGGER
    op_result = evaluate_early_return_opportunity(rental, eq, db)
    assert op_result is None


def test_early_return_persistent_evidence_triggered(setup_database):
    db = setup_database
    eq = db.query(Equipment).filter(Equipment.equipment_id == "CAT-TRK-200").first()
    op = db.query(User).filter(User.email == "testop1@cat.com").first()
    site = db.query(Site).filter(Site.site_code == "SITE-01").first()

    now = datetime.datetime.utcnow()
    checkout = now - datetime.timedelta(days=1.5)
    expected = now + datetime.timedelta(days=1.5) # 1.5 days remaining
    rental = Rental(equipment_id=eq.id, operator_id=op.id, site_id=site.id, checkout_time=checkout, expected_return_time=expected, status=RentalStatus.ACTIVE)
    db.add(rental)
    db.commit()

    # Persistent low utilization logs across 4 shifts
    for i in range(4):
        log = UsageLog(equipment_id=eq.id, timestamp=now - datetime.timedelta(hours=i*6), engine_hours=10.0, idle_hours=90.0, operating_status="IDLE")
        db.add(log)
    db.commit()

    op_result = evaluate_early_return_opportunity(rental, eq, db)
    assert op_result is not None
    assert op_result["is_opportunity"] is True
    assert op_result["remaining_days"] == 1.5
    assert len(op_result["recommended_actions"]) == 3

    # Verify deduplicated alert creation
    alerts = db.query(Alert).filter(Alert.equipment_id == eq.id, Alert.alert_type == "EARLY_RETURN_OPPORTUNITY").all()
    assert len(alerts) == 1

    # Evaluating again should not create duplicate alerts
    evaluate_early_return_opportunity(rental, eq, db)
    alerts_after = db.query(Alert).filter(Alert.equipment_id == eq.id, Alert.alert_type == "EARLY_RETURN_OPPORTUNITY").all()
    assert len(alerts_after) == 1


# 3. Test What-If Non-Mutation
def test_simulate_early_return_non_mutating(setup_database):
    db = setup_database
    eq = db.query(Equipment).filter(Equipment.equipment_id == "CAT-TRK-200").first()
    op = db.query(User).filter(User.email == "testop1@cat.com").first()
    site = db.query(Site).filter(Site.site_code == "SITE-01").first()

    checkout = datetime.datetime.utcnow() - datetime.timedelta(days=1)
    expected = datetime.datetime.utcnow() + datetime.timedelta(days=2)
    rental = Rental(equipment_id=eq.id, operator_id=op.id, site_id=site.id, checkout_time=checkout, expected_return_time=expected, status=RentalStatus.ACTIVE)
    db.add(rental)
    db.commit()

    orig_rental_status = rental.status
    orig_eq_status = eq.status

    sim_res = simulate_early_return(rental, eq, db)

    # Check simulation results returned
    assert sim_res["feasible"] is True
    assert "avoided_idle_cost" in sim_res["simulation_results"]

    # Verify zero database mutation
    db.refresh(rental)
    db.refresh(eq)
    assert rental.status == orig_rental_status
    assert eq.status == orig_eq_status
    assert rental.actual_return_time is None


# 4. Test API Endpoints & RBAC Rules
def test_api_rental_endpoints_and_rbac(setup_database):
    db = setup_database
    client = TestClient(app)

    mgr_headers = get_auth_headers("testmgr@cat.com", "MANAGER")
    op1_headers = get_auth_headers("testop1@cat.com", "OPERATOR")
    op2_headers = get_auth_headers("testop2@cat.com", "OPERATOR")

    eq = db.query(Equipment).filter(Equipment.equipment_id == "CAT-EXC-100").first()
    site = db.query(Site).filter(Site.site_code == "SITE-01").first()
    op1 = db.query(User).filter(User.email == "testop1@cat.com").first()

    # Checkout equipment via API (for 3 days)
    res_checkout = client.post(
        "/api/rentals/checkout",
        json={"equipment_id": eq.id, "site_id": site.id, "operator_id": op1.id, "expected_return_days": 3},
        headers=mgr_headers
    )
    assert res_checkout.status_code == 200
    rental_data = res_checkout.json()
    rental_id = rental_data["id"]

    assert rental_data["planned_duration_days"] == 3.0
    assert rental_data["remaining_duration_days"] == 3.0
    assert rental_data["equipment_code"] == "CAT-EXC-100"

    # Manager can access rental detail & What-If
    res_detail = client.get(f"/api/rentals/{rental_id}", headers=mgr_headers)
    assert res_detail.status_code == 200
    assert len(res_detail.json()["lifecycle_stages"]) == 7

    res_whatif = client.post(f"/api/rentals/{rental_id}/what-if-early-return", headers=mgr_headers)
    assert res_whatif.status_code == 200
    assert res_whatif.json()["feasible"] is True

    # Operator 1 can access own rental
    res_op_active = client.get("/api/rentals/my-active", headers=op1_headers)
    assert res_op_active.status_code == 200
    assert res_op_active.json()["id"] == rental_id

    # Operator 2 CANNOT access Operator 1's rental detail (403 Forbidden)
    res_op2_detail = client.get(f"/api/rentals/{rental_id}", headers=op2_headers)
    assert res_op2_detail.status_code == 403

    # Operator CANNOT access Manager What-If endpoint (403 Forbidden)
    res_op_whatif = client.post(f"/api/rentals/{rental_id}/what-if-early-return", headers=op1_headers)
    assert res_op_whatif.status_code == 403

    # Check-In Equipment via API
    res_checkin = client.post(f"/api/rentals/{rental_id}/checkin", json={"rental_id": rental_id}, headers=mgr_headers)
    assert res_checkin.status_code == 200
    assert res_checkin.json()["status"] == "COMPLETED"
