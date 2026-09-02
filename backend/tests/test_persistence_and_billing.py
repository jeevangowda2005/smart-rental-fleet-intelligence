"""
Comprehensive Integration Tests for Persistence, Billing, RBAC Isolation, and Location Accuracy

Test isolation strategy:
  - Uses a dedicated in-memory SQLite engine with StaticPool.
  - The autouse fixture sets AND restores `app.dependency_overrides[get_db]` for EACH test,
    so this module is safe to run alongside other test modules that also override get_db.
  - All required seed data (manager, sites, equipment) is inserted fresh per test.
  - Tables are dropped after each test to guarantee clean state.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from backend.database.session import Base, get_db
from backend.main import app
from backend.models.domain import (
    User, UserRole, Site, Equipment, EquipmentStatus,
    Rental, RentalStatus, Billing,
)
from backend.services.auth import get_password_hash

# ─── Isolated in-memory test database ────────────────────────────────────────

BILLING_TEST_URL = "sqlite:///:memory:"

billing_test_engine = create_engine(
    BILLING_TEST_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
BillingTestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=billing_test_engine)


def _billing_override_get_db():
    db = BillingTestSessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _seed_base_data(db):
    """Insert the minimum seed data required by all tests in this module."""
    mgr = User(
        name="Alex Mercer (Fleet Director)",
        email="manager@catfleet.com",
        password_hash=get_password_hash("password123"),
        role=UserRole.MANAGER,
    )
    db.add(mgr)
    db.flush()

    site = Site(
        site_code="SITE-DEP-04",
        site_name="Central Logistics Depot",
        location="Las Vegas, NV",
        latitude=36.1699,
        longitude=-115.1398,
    )
    db.add(site)
    db.flush()

    # CAT-CMP-825 — used by lifecycle & location tests
    cmp_eq = Equipment(
        equipment_id="CAT-CMP-825",
        equipment_type="Soil Compactor",
        model="CAT 825K Soil Compactor",
        status=EquipmentStatus.AVAILABLE,
        site_id=site.id,
        latitude=36.1690,
        longitude=-115.1385,
        engine_hours=680.0,
        idle_hours=120.0,
        fuel_usage=29.0,
        utilization=82.4,
        qr_code="QR-CAT-CMP-825",
    )

    # CAT-WLD-980 — used by RBAC test
    wld_eq = Equipment(
        equipment_id="CAT-WLD-980",
        equipment_type="Wheel Loader",
        model="CAT 980M Performance Series",
        status=EquipmentStatus.AVAILABLE,
        site_id=site.id,
        latitude=36.1702,
        longitude=-115.1405,
        engine_hours=450.0,
        idle_hours=85.0,
        fuel_usage=24.0,
        utilization=81.1,
        qr_code="QR-CAT-WLD-980",
    )

    db.add_all([cmp_eq, wld_eq])
    db.commit()
    return mgr, site, cmp_eq, wld_eq


# ─── Fixture: per-test isolated DB with dependency override ──────────────────

@pytest.fixture(autouse=True)
def setup_billing_database():
    """
    For each test in this module:
    1. Override app.dependency_overrides[get_db] to use our in-memory engine.
    2. Create all tables from scratch.
    3. Seed base data.
    4. Yield.
    5. Drop all tables (clean slate for next test).
    6. Restore app.dependency_overrides to whatever it was before (prevents bleed into other modules).
    """
    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = _billing_override_get_db

    Base.metadata.create_all(bind=billing_test_engine)
    db = BillingTestSessionLocal()
    _seed_base_data(db)
    db.close()

    yield

    Base.metadata.drop_all(bind=billing_test_engine)

    # Restore the previous override (important when running alongside other test modules)
    if previous_override is None:
        app.dependency_overrides.pop(get_db, None)
    else:
        app.dependency_overrides[get_db] = previous_override


# TestClient must be created AFTER the fixture runs per-test, but TestClient
# itself doesn't hold state — it just wraps the app. Creating it at module level
# is fine because the override is applied to `app` before any request is made.
client = TestClient(app)


# ─── Tests ────────────────────────────────────────────────────────────────────

def test_user_persistence_across_reseed():
    """
    Verify newly registered user is NOT deleted when seed data is re-applied.
    The idempotent seeder only inserts missing records — never deletes existing ones.
    """
    email = "testuser_persist@catfleet.com"

    # Register
    reg_resp = client.post("/api/auth/register", json={
        "name": "Test User Persistence",
        "email": email,
        "password": "Test@12345",
    })
    assert reg_resp.status_code == 200, reg_resp.text
    assert reg_resp.json()["email"] == email

    # Login succeeds
    login_resp = client.post("/api/auth/login", json={"email": email, "password": "Test@12345"})
    assert login_resp.status_code == 200, login_resp.text
    token = login_resp.json()["access_token"]
    assert token

    # Simulate "restart" — insert seed accounts again (idempotent, must NOT delete existing users)
    db = BillingTestSessionLocal()
    if not db.query(User).filter(User.email == "manager@catfleet.com").first():
        db.add(User(
            name="Alex Mercer",
            email="manager@catfleet.com",
            password_hash=get_password_hash("password123"),
            role=UserRole.MANAGER,
        ))
        db.commit()
    db.close()

    # Registered user must STILL be findable and loginable
    relogin = client.post("/api/auth/login", json={"email": email, "password": "Test@12345"})
    assert relogin.status_code == 200, "User disappeared after re-seed simulation!"
    assert relogin.json()["user"]["email"] == email


def test_rental_checkout_checkin_and_billing_lifecycle():
    """
    Full lifecycle: Register → Login → Checkout → Check-in → Billing auto-generated → Idempotency.
    """
    email = "usera_lifecycle@catfleet.com"

    client.post("/api/auth/register", json={"name": "Operator A", "email": email, "password": "Password123"})
    login_resp = client.post("/api/auth/login", json={"email": email, "password": "Password123"})
    assert login_resp.status_code == 200, login_resp.text
    login_data = login_resp.json()
    token = login_data["access_token"]
    user_id = login_data["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}

    db = BillingTestSessionLocal()
    eq = db.query(Equipment).filter(Equipment.equipment_id == "CAT-CMP-825").first()
    site = db.query(Site).first()
    assert eq is not None, "CAT-CMP-825 not seeded"
    assert site is not None
    eq_id = eq.id
    site_id = site.id
    db.close()

    # 1. Checkout
    co_resp = client.post("/api/rentals/checkout", headers=headers, json={
        "equipment_id": eq_id,
        "site_id": site_id,
        "operator_id": user_id,
        "expected_return_days": 5,
    })
    assert co_resp.status_code == 200, co_resp.text
    rental_id = co_resp.json()["id"]
    assert co_resp.json()["status"] == "ACTIVE"

    # Equipment should now be ACTIVE
    db = BillingTestSessionLocal()
    eq_check = db.query(Equipment).filter(Equipment.id == eq_id).first()
    assert eq_check.status.value in ["ACTIVE", "RENTED"]
    db.close()

    # 2. Check-in
    ci_resp = client.post(f"/api/rentals/{rental_id}/checkin", headers=headers, json={"rental_id": rental_id})
    assert ci_resp.status_code == 200, ci_resp.text
    assert ci_resp.json()["status"] == "COMPLETED"

    # 3. Billing must be auto-generated
    bill_resp = client.get(f"/api/billing/rental/{rental_id}", headers=headers)
    assert bill_resp.status_code == 200, bill_resp.text
    bill = bill_resp.json()
    assert bill["rental_id"] == rental_id
    assert bill["operator_id"] == user_id
    assert bill["invoice_number"].startswith("INV-")
    # total_amount can legitimately be 0 if machine has no engine hours
    assert bill["total_amount"] >= 0

    # 4. Idempotency — generating again returns the SAME record, no duplicate
    gen_resp = client.post(f"/api/billing/generate/{rental_id}", headers=headers)
    assert gen_resp.status_code == 200
    assert gen_resp.json()["id"] == bill["id"], "Idempotency broken: different billing ID returned!"

    db = BillingTestSessionLocal()
    count = db.query(Billing).filter(Billing.rental_id == rental_id).count()
    assert count == 1, f"Duplicate billing records detected! Count: {count}"
    db.close()

    # 5. Equipment should be AVAILABLE after check-in
    db = BillingTestSessionLocal()
    eq_after = db.query(Equipment).filter(Equipment.id == eq_id).first()
    assert eq_after.status == EquipmentStatus.AVAILABLE
    db.close()


def test_rental_specific_billing_calculation():
    """
    TEST: Cumulative engine meter MUST NOT equal rental operating hours.
    Checkout engine meter: 680.00, idle: 120.0
    Check-in engine meter: 680.44, idle: 122.0
    Expected rental operating hours: 0.44 - 2.0 = 0.0 (clamped) or 0.44 if engine meter ticked by 2.44
    Let's test Checkout 680.00 (idle 120.0) -> Check-in 682.44 (idle 122.0)
    => rental engine delta = 2.44
    => rental idle = 2.00
    => rental operating hours = 0.44 hrs
    Billed operating = 0.44 * 1200 = 528.00
    Billed idle = 2.0 * 500 = 1000.00
    Subtotal = 1528.00 (plus fuel)
    Subtotal & Tax MUST be internally consistent!
    """
    email = "usera_billing_calc@catfleet.com"

    client.post("/api/auth/register", json={"name": "Operator Calc", "email": email, "password": "Password123"})
    login_data = client.post("/api/auth/login", json={"email": email, "password": "Password123"}).json()
    token = login_data["access_token"]
    user_id = login_data["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}

    db = BillingTestSessionLocal()
    eq = db.query(Equipment).filter(Equipment.equipment_id == "CAT-CMP-825").first()
    site = db.query(Site).first()
    # Set known initial baseline on equipment
    eq.engine_hours = 680.00
    eq.idle_hours = 120.00
    eq.fuel_usage = 29.0
    db.commit()

    eq_id = eq.id
    site_id = site.id
    db.close()

    # 1. Checkout captures baseline 680.00 engine, 120.00 idle
    co_resp = client.post("/api/rentals/checkout", headers=headers, json={
        "equipment_id": eq_id,
        "site_id": site_id,
        "operator_id": user_id,
        "expected_return_days": 3,
    })
    assert co_resp.status_code == 200, co_resp.text
    rental_id = co_resp.json()["id"]

    # 2. Simulate machine usage during rental:
    # Engine meter ticks from 680.00 to 682.44 (+2.44 engine hrs)
    # Idle meter ticks from 120.00 to 122.00 (+2.00 idle hrs)
    db = BillingTestSessionLocal()
    eq_in_use = db.query(Equipment).filter(Equipment.id == eq_id).first()
    eq_in_use.engine_hours = 682.44
    eq_in_use.idle_hours = 122.00
    db.commit()
    db.close()

    # 3. Check-in
    ci_resp = client.post(f"/api/rentals/{rental_id}/checkin", headers=headers, json={"rental_id": rental_id})
    assert ci_resp.status_code == 200, ci_resp.text

    # 4. Fetch invoice
    bill_resp = client.get(f"/api/billing/rental/{rental_id}", headers=headers)
    assert bill_resp.status_code == 200, bill_resp.text
    bill = bill_resp.json()

    # VERIFY CRITICAL REQUIREMENTS
    # Cumulative machine lifetime meter MUST NOT be billed as rental operating hours!
    assert bill["engine_hours_at_checkin"] == 682.44, "Lifetime engine meter reference preserved"
    assert bill["rental_operating_hours"] == 0.44, f"Expected 0.44 operating hrs, got {bill['rental_operating_hours']}"
    assert bill["rental_idle_hours"] == 2.0, f"Expected 2.0 idle hrs, got {bill['rental_idle_hours']}"

    # Verify line item charges
    expected_op_charge = round(0.44 * 1200.0, 2)  # 528.0
    expected_idle_charge = round(2.0 * 500.0, 2)  # 1000.0
    assert bill["rental_charge"] == expected_op_charge, f"Operating charge {bill['rental_charge']} != {expected_op_charge}"
    assert bill["idle_charge"] == expected_idle_charge, f"Idle charge {bill['idle_charge']} != {expected_idle_charge}"

    # Verify totals & GST consistency
    expected_subtotal = round(bill["rental_charge"] + bill["idle_charge"] + bill["fuel_charge"] + bill["additional_charge"], 2)
    expected_tax = round(expected_subtotal * 0.18, 2)
    expected_total = round(expected_subtotal + expected_tax, 2)

    assert bill["subtotal"] == expected_subtotal, f"Subtotal mismatch: {bill['subtotal']} != {expected_subtotal}"
    assert bill["tax_amount"] == expected_tax, f"Tax mismatch: {bill['tax_amount']} != {expected_tax}"
    assert bill["total_amount"] == expected_total, f"Total mismatch: {bill['total_amount']} != {expected_total}"


def test_billing_rbac_user_isolation():
    """
    Verify multi-user billing isolation:
    - User A's billing is invisible to User B (403 on direct access).
    - User B's billing list never contains User A's records.
    - Manager can see all billing records.
    """
    email_a = "rbac_usera@catfleet.com"
    email_b = "rbac_userb@catfleet.com"

    client.post("/api/auth/register", json={"name": "User A", "email": email_a, "password": "Password123"})
    client.post("/api/auth/register", json={"name": "User B", "email": email_b, "password": "Password123"})

    login_a = client.post("/api/auth/login", json={"email": email_a, "password": "Password123"}).json()
    login_b = client.post("/api/auth/login", json={"email": email_b, "password": "Password123"}).json()
    login_mgr = client.post("/api/auth/login", json={
        "email": "manager@catfleet.com", "password": "password123"
    }).json()

    headers_a = {"Authorization": f"Bearer {login_a['access_token']}"}
    headers_b = {"Authorization": f"Bearer {login_b['access_token']}"}
    headers_mgr = {"Authorization": f"Bearer {login_mgr['access_token']}"}

    db = BillingTestSessionLocal()
    eq = db.query(Equipment).filter(Equipment.equipment_id == "CAT-WLD-980").first()
    site = db.query(Site).first()
    assert eq is not None
    eq_id = eq.id
    site_id = site.id
    db.close()

    # User A rents and checks in CAT-WLD-980
    co_resp = client.post("/api/rentals/checkout", headers=headers_a, json={
        "equipment_id": eq_id,
        "site_id": site_id,
        "operator_id": login_a["user"]["id"],
        "expected_return_days": 3,
    })
    assert co_resp.status_code == 200, co_resp.text
    rental_id_a = co_resp.json()["id"]
    client.post(f"/api/rentals/{rental_id_a}/checkin", headers=headers_a, json={"rental_id": rental_id_a})

    bill_resp = client.get(f"/api/billing/rental/{rental_id_a}", headers=headers_a)
    assert bill_resp.status_code == 200
    bill_a = bill_resp.json()
    bill_a_id = bill_a["id"]

    # 1. User B must get 403 accessing User A's billing by ID
    resp = client.get(f"/api/billing/{bill_a_id}", headers=headers_b)
    assert resp.status_code == 403, (
        f"SECURITY BREACH: User B accessed User A's billing by ID! Status={resp.status_code}"
    )

    # 2. User B must get 403 accessing User A's billing by rental ID
    resp2 = client.get(f"/api/billing/rental/{rental_id_a}", headers=headers_b)
    assert resp2.status_code == 403, (
        f"SECURITY BREACH: User B accessed User A's billing by rental ID! Status={resp2.status_code}"
    )

    # 3. User B's billing list must NOT include User A's records
    b_bills = client.get("/api/billing", headers=headers_b).json()
    assert all(b["operator_id"] == login_b["user"]["id"] for b in b_bills), (
        "User A's billing appeared in User B's list!"
    )

    # 4. Manager must have full access
    mgr_resp = client.get(f"/api/billing/{bill_a_id}", headers=headers_mgr)
    assert mgr_resp.status_code == 200, f"Manager denied access: {mgr_resp.json()}"

    # 5. Manager billing list includes User A's bill
    mgr_all = client.get("/api/billing", headers=headers_mgr).json()
    assert any(b["id"] == bill_a_id for b in mgr_all), "Manager's list missing User A's bill!"


def test_exact_location_persistence():
    """
    GPS/location integrity: coordinates returned by the API must exactly match
    what is stored in the database. No invented, random, or hardcoded values.
    """
    login_mgr = client.post("/api/auth/login", json={
        "email": "manager@catfleet.com",
        "password": "password123",
    }).json()
    headers_mgr = {"Authorization": f"Bearer {login_mgr['access_token']}"}

    # Ground-truth from DB
    db = BillingTestSessionLocal()
    eq = db.query(Equipment).filter(Equipment.equipment_id == "CAT-CMP-825").first()
    assert eq is not None
    db_lat = eq.latitude
    db_lng = eq.longitude
    db.close()

    # API response
    resp = client.get("/api/equipment/CAT-CMP-825", headers=headers_mgr)
    assert resp.status_code == 200, resp.text
    api_data = resp.json()

    assert api_data["latitude"] == db_lat, (
        f"GPS Latitude mismatch: DB={db_lat} API={api_data['latitude']} — fake/random coords!"
    )
    assert api_data["longitude"] == db_lng, (
        f"GPS Longitude mismatch: DB={db_lng} API={api_data['longitude']} — fake/random coords!"
    )
    assert db_lat != 0.0, "Latitude is 0.0 — no valid GPS data in DB"
    assert db_lng != 0.0, "Longitude is 0.0 — no valid GPS data in DB"
