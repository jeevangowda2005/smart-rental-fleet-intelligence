"""
Database Seeding Module — Idempotent Production-Safe Version

CRITICAL RULES:
- NEVER call Base.metadata.drop_all() — that destroys all user and rental data.
- NEVER delete existing users, rentals, equipment, telemetry, alerts, or billing records.
- This function is safe to call on EVERY startup; it only inserts missing seed records.
- New records are identified by unique keys (email, equipment_id, site_code) before insert.
"""
import datetime
from sqlalchemy.orm import Session
from backend.database.session import Base, engine, SessionLocal
import backend.models.domain  # Ensures all ORM models register on Base.metadata
from backend.models.domain import (
    User, UserRole, Site, Equipment, EquipmentStatus,
    Rental, RentalStatus, UsageLog, Alert, Maintenance, Billing
)
from backend.services.auth import get_password_hash
from backend.services.fleet_intelligence import calculate_utilization


from sqlalchemy import text

def ensure_schema_migrations():
    """Ensure newly added columns exist on pre-existing PostgreSQL/SQLite tables."""
    statements = [
        "ALTER TABLE rentals ADD COLUMN IF NOT EXISTS engine_hours_at_checkout DOUBLE PRECISION DEFAULT 0.0;",
        "ALTER TABLE rentals ADD COLUMN IF NOT EXISTS idle_hours_at_checkout DOUBLE PRECISION DEFAULT 0.0;",
        "ALTER TABLE rentals ADD COLUMN IF NOT EXISTS fuel_usage_at_checkout DOUBLE PRECISION DEFAULT 0.0;",
        "ALTER TABLE rentals ADD COLUMN IF NOT EXISTS engine_hours_at_checkin DOUBLE PRECISION DEFAULT 0.0;",
        "ALTER TABLE rentals ADD COLUMN IF NOT EXISTS idle_hours_at_checkin DOUBLE PRECISION DEFAULT 0.0;",
        "ALTER TABLE rentals ADD COLUMN IF NOT EXISTS fuel_usage_at_checkin DOUBLE PRECISION DEFAULT 0.0;",
        "ALTER TABLE billing ADD COLUMN IF NOT EXISTS engine_hours_at_checkout DOUBLE PRECISION DEFAULT 0.0;",
        "ALTER TABLE billing ADD COLUMN IF NOT EXISTS idle_hours_at_checkout DOUBLE PRECISION DEFAULT 0.0;",
        "ALTER TABLE billing ADD COLUMN IF NOT EXISTS fuel_usage_at_checkout DOUBLE PRECISION DEFAULT 0.0;",
        "ALTER TABLE billing ADD COLUMN IF NOT EXISTS rental_operating_hours DOUBLE PRECISION DEFAULT 0.0;",
        "ALTER TABLE billing ADD COLUMN IF NOT EXISTS rental_idle_hours DOUBLE PRECISION DEFAULT 0.0;",
        "ALTER TABLE billing ADD COLUMN IF NOT EXISTS rental_fuel_used DOUBLE PRECISION DEFAULT 0.0;",
    ]
    try:
        with engine.begin() as conn:
            for stmt in statements:
                try:
                    conn.execute(text(stmt))
                except Exception as ex:
                    print(f"Migration statement notice: {ex}")
    except Exception as e:
        print(f"Schema migration notice: {e}")

def seed_database():
    """
    Idempotent seed: creates schema tables if absent (additive only),
    then inserts default seed records only if they do not yet exist.
    Does NOT drop tables, does NOT delete any existing data.
    """
    # create_all is safe — it creates missing tables/columns without touching data
    Base.metadata.create_all(bind=engine)
    ensure_schema_migrations()

    db: Session = SessionLocal()
    try:
        _seed_users(db)
        _seed_sites(db)
        _seed_equipment(db)
        _seed_rentals(db)
        _seed_usage_logs(db)
        _seed_alerts(db)
        _seed_maintenance(db)
        print("Database seed check complete — all required default records verified.")
    except Exception as e:
        db.rollback()
        print(f"Seed error (non-fatal): {e}")
    finally:
        db.close()


def _seed_users(db: Session):
    """Seed default manager and operator accounts only if they don't already exist."""
    seed_accounts = [
        {
            "name": "Alex Mercer (Fleet Director)",
            "email": "manager@catfleet.com",
            "password": "password123",
            "role": UserRole.MANAGER,
        },
        {
            "name": "Marcus Vance (Senior Equipment Operator)",
            "email": "operator@catfleet.com",
            "password": "password123",
            "role": UserRole.OPERATOR,
        },
        {
            "name": "Sarah Jenkins (Heavy Machinery Specialist)",
            "email": "operator2@catfleet.com",
            "password": "password123",
            "role": UserRole.OPERATOR,
        },
    ]

    for account in seed_accounts:
        existing = db.query(User).filter(User.email == account["email"]).first()
        if not existing:
            user = User(
                name=account["name"],
                email=account["email"],
                password_hash=get_password_hash(account["password"]),
                role=account["role"],
            )
            db.add(user)
            print(f"  Seeding user: {account['email']}")

    db.commit()


def _seed_sites(db: Session):
    """Seed default mining sites only if they don't already exist."""
    seed_sites = [
        {
            "site_code": "SITE-PIT-01",
            "site_name": "Northern Mining Pit A",
            "location": "Denver, CO",
            "latitude": 39.7392,
            "longitude": -104.9903,
        },
        {
            "site_code": "SITE-QRY-02",
            "site_name": "Apex Granite Quarry",
            "location": "Salt Lake City, UT",
            "latitude": 40.7608,
            "longitude": -111.8910,
        },
        {
            "site_code": "SITE-MTR-03",
            "site_name": "Metro Transit Infra Project",
            "location": "Phoenix, AZ",
            "latitude": 33.4484,
            "longitude": -112.0740,
        },
        {
            "site_code": "SITE-DEP-04",
            "site_name": "Central Logistics Depot",
            "location": "Las Vegas, NV",
            "latitude": 36.1699,
            "longitude": -115.1398,
        },
    ]

    for s in seed_sites:
        existing = db.query(Site).filter(Site.site_code == s["site_code"]).first()
        if not existing:
            site = Site(**s)
            db.add(site)
            print(f"  Seeding site: {s['site_code']}")

    db.commit()


def _seed_equipment(db: Session):
    """Seed default fleet equipment only if not already present."""
    # Load the site and user records we need for foreign keys
    site1 = db.query(Site).filter(Site.site_code == "SITE-PIT-01").first()
    site2 = db.query(Site).filter(Site.site_code == "SITE-QRY-02").first()
    site3 = db.query(Site).filter(Site.site_code == "SITE-MTR-03").first()
    site4 = db.query(Site).filter(Site.site_code == "SITE-DEP-04").first()
    op1 = db.query(User).filter(User.email == "operator@catfleet.com").first()
    op2 = db.query(User).filter(User.email == "operator2@catfleet.com").first()

    if not all([site1, site2, site3, site4]):
        print("  Skipping equipment seed — required sites not found.")
        return

    def make_eq(eq_id, eq_type, model, status, site, operator, lat, lng, eng, idle, fuel):
        existing = db.query(Equipment).filter(Equipment.equipment_id == eq_id).first()
        if existing:
            return  # Already exists — never overwrite
        util = calculate_utilization(eng, idle)
        eq = Equipment(
            equipment_id=eq_id,
            equipment_type=eq_type,
            model=model,
            status=status,
            site_id=site.id if site else None,
            operator_id=operator.id if operator else None,
            latitude=lat,
            longitude=lng,
            engine_hours=eng,
            idle_hours=idle,
            fuel_usage=fuel,
            utilization=util,
            qr_code=f"QR-{eq_id}",
        )
        db.add(eq)
        print(f"  Seeding equipment: {eq_id}")

    make_eq("CAT-EXC-349", "Hydraulic Excavator",    "CAT 349 Next Gen",            EquipmentStatus.ACTIVE,       site1, op1,  39.7401, -104.9912, 1420.0, 210.0,  42.5)
    make_eq("CAT-EXC-320", "Hydraulic Excavator",    "CAT 320 GC Medium",           EquipmentStatus.MAINTENANCE,  site2, None, 40.7600, -111.8900, 3110.0, 580.0,  28.5)
    make_eq("CAT-EXC-390", "Hydraulic Excavator",    "CAT 390F Mass Excavator",     EquipmentStatus.AVAILABLE,    site4, None, 36.1705, -115.1410,  520.0,  45.0,  65.0)
    make_eq("CAT-TRK-777", "Off-Highway Haul Truck", "CAT 777G Mining Truck",       EquipmentStatus.ACTIVE,       site1, op2,  39.7385, -104.9890, 2850.0, 310.0,  78.2)
    make_eq("CAT-TRK-745", "Articulated Haul Truck", "CAT 745 45-Ton Payload",      EquipmentStatus.OVERDUE,      site3, op1,  33.4490, -112.0752, 1890.0, 412.0,  56.0)
    make_eq("CAT-TRK-730", "Articulated Haul Truck", "CAT 730 Ejector Truck",       EquipmentStatus.RENTED,       site3, op2,  33.4475, -112.0730, 1120.0, 180.0,  48.0)
    make_eq("CAT-DOZ-D8T", "Track Dozer",            "CAT D8T Heavy Crawler",       EquipmentStatus.IDLE,         site2, None, 40.7612, -111.8925,  980.0, 420.0,  31.0)
    make_eq("CAT-DOZ-D11", "Track Dozer",            "CAT D11 Heavy Mining Dozer",  EquipmentStatus.ACTIVE,       site1, op1,  39.7410, -104.9920, 4100.0, 620.0,  95.0)
    make_eq("CAT-WLD-980", "Wheel Loader",           "CAT 980M Performance Series", EquipmentStatus.AVAILABLE,    site4, None, 36.1702, -115.1405,  450.0,  85.0,  24.0)
    make_eq("CAT-WLD-992", "Wheel Loader",           "CAT 992 Large Mining Loader", EquipmentStatus.ACTIVE,       site2, op2,  40.7620, -111.8940, 2150.0, 340.0,  82.0)
    make_eq("CAT-MGD-16M", "Motor Grader",           "CAT 16M3 Mining Motor Grader",EquipmentStatus.RENTED,       site3, op1,  33.4460, -112.0720, 1640.0, 290.0,  38.0)
    make_eq("CAT-CMP-825", "Soil Compactor",         "CAT 825K Soil Compactor",     EquipmentStatus.AVAILABLE,    site4, None, 36.1690, -115.1385,  680.0, 120.0,  29.0)

    db.commit()


def _seed_rentals(db: Session):
    """Seed demo rentals only if no rentals exist at all."""
    if db.query(Rental).count() > 0:
        return  # Existing rental data — leave it alone

    now = datetime.datetime.utcnow()

    # We need equipment and operator IDs
    eq1 = db.query(Equipment).filter(Equipment.equipment_id == "CAT-EXC-349").first()
    eq5 = db.query(Equipment).filter(Equipment.equipment_id == "CAT-TRK-745").first()
    eq6 = db.query(Equipment).filter(Equipment.equipment_id == "CAT-TRK-730").first()
    op1 = db.query(User).filter(User.email == "operator@catfleet.com").first()
    op2 = db.query(User).filter(User.email == "operator2@catfleet.com").first()
    site1 = db.query(Site).filter(Site.site_code == "SITE-PIT-01").first()
    site3 = db.query(Site).filter(Site.site_code == "SITE-MTR-03").first()

    if not all([eq1, eq5, eq6, op1, op2, site1, site3]):
        print("  Skipping rental seed — required equipment/users not found.")
        return

    rentals = [
        Rental(
            equipment_id=eq1.id,
            operator_id=op1.id,
            site_id=site1.id,
            checkout_time=now - datetime.timedelta(days=5),
            expected_return_time=now + datetime.timedelta(days=9),
            status=RentalStatus.ACTIVE,
            engine_hours_at_checkout=max(0.0, eq1.engine_hours - 25.0),
            idle_hours_at_checkout=max(0.0, eq1.idle_hours - 4.0),
            fuel_usage_at_checkout=eq1.fuel_usage,
        ),
        Rental(
            equipment_id=eq5.id,
            operator_id=op1.id,
            site_id=site3.id,
            checkout_time=now - datetime.timedelta(days=12),
            expected_return_time=now - datetime.timedelta(days=2),
            status=RentalStatus.OVERDUE,
            engine_hours_at_checkout=max(0.0, eq5.engine_hours - 60.0),
            idle_hours_at_checkout=max(0.0, eq5.idle_hours - 8.0),
            fuel_usage_at_checkout=eq5.fuel_usage,
        ),
        Rental(
            equipment_id=eq6.id,
            operator_id=op2.id,
            site_id=site3.id,
            checkout_time=now - datetime.timedelta(days=3),
            expected_return_time=now + datetime.timedelta(days=11),
            status=RentalStatus.ACTIVE,
            engine_hours_at_checkout=max(0.0, eq6.engine_hours - 15.0),
            idle_hours_at_checkout=max(0.0, eq6.idle_hours - 2.0),
            fuel_usage_at_checkout=eq6.fuel_usage,
        ),
    ]
    db.add_all(rentals)
    db.commit()
    print(f"  Seeded {len(rentals)} demo rentals.")


def _seed_usage_logs(db: Session):
    """Seed usage logs only if no logs exist yet."""
    if db.query(UsageLog).count() > 0:
        return

    now = datetime.datetime.utcnow()
    eq1 = db.query(Equipment).filter(Equipment.equipment_id == "CAT-EXC-349").first()
    eq4 = db.query(Equipment).filter(Equipment.equipment_id == "CAT-TRK-777").first()

    if not eq1 or not eq4:
        return

    logs = []
    for i in range(6):
        t = now - datetime.timedelta(hours=i * 6)
        logs.append(UsageLog(
            equipment_id=eq1.id,
            timestamp=t,
            engine_hours=eq1.engine_hours - (i * 5.0),
            idle_hours=max(0.0, eq1.idle_hours - (i * 0.8)),
            fuel_usage=eq1.fuel_usage,
            latitude=eq1.latitude,
            longitude=eq1.longitude,
            operating_status="ACTIVE",
        ))
        logs.append(UsageLog(
            equipment_id=eq4.id,
            timestamp=t,
            engine_hours=eq4.engine_hours - (i * 5.5),
            idle_hours=max(0.0, eq4.idle_hours - (i * 0.6)),
            fuel_usage=eq4.fuel_usage,
            latitude=eq4.latitude,
            longitude=eq4.longitude,
            operating_status="ACTIVE",
        ))
    db.add_all(logs)
    db.commit()
    print(f"  Seeded {len(logs)} demo usage logs.")


def _seed_alerts(db: Session):
    """Seed demo alerts only if no alerts exist yet."""
    if db.query(Alert).count() > 0:
        return

    eq7  = db.query(Equipment).filter(Equipment.equipment_id == "CAT-DOZ-D8T").first()
    eq5  = db.query(Equipment).filter(Equipment.equipment_id == "CAT-TRK-745").first()
    eq2  = db.query(Equipment).filter(Equipment.equipment_id == "CAT-EXC-320").first()

    if not all([eq7, eq5, eq2]):
        return

    alerts = [
        Alert(
            equipment_id=eq7.id,
            alert_type="HIGH_IDLE_RATIO",
            severity="WARNING",
            message="Excessive engine idling detected (>30% of runtime) at Apex Granite Quarry.",
            is_resolved=False,
        ),
        Alert(
            equipment_id=eq5.id,
            alert_type="OVERDUE_RENTAL",
            severity="CRITICAL",
            message="CAT-TRK-745 has exceeded its expected return time by 48 hours.",
            is_resolved=False,
        ),
        Alert(
            equipment_id=eq2.id,
            alert_type="HYDRAULIC_PRESSURE_DROP",
            severity="CRITICAL",
            message="Hydraulic system pressure delta exceeds safety thresholds. Machine routed to service.",
            is_resolved=False,
        ),
    ]
    db.add_all(alerts)
    db.commit()
    print(f"  Seeded {len(alerts)} demo alerts.")


def _seed_maintenance(db: Session):
    """Seed maintenance records only if none exist yet."""
    if db.query(Maintenance).count() > 0:
        return

    now = datetime.datetime.utcnow()
    eq2 = db.query(Equipment).filter(Equipment.equipment_id == "CAT-EXC-320").first()
    eq1 = db.query(Equipment).filter(Equipment.equipment_id == "CAT-EXC-349").first()

    if not eq2 or not eq1:
        return

    records = [
        Maintenance(
            equipment_id=eq2.id,
            maintenance_type="500-Hour Hydraulic & Filter Overhaul",
            description="Comprehensive hydraulic pump inspection and filter replacement.",
            scheduled_date=now - datetime.timedelta(days=1),
            status="IN_PROGRESS",
        ),
        Maintenance(
            equipment_id=eq1.id,
            maintenance_type="Preventative Engine Inspection",
            description="Engine oil sample analysis and belt tension validation.",
            scheduled_date=now + datetime.timedelta(days=14),
            status="SCHEDULED",
        ),
    ]
    db.add_all(records)
    db.commit()
    print(f"  Seeded {len(records)} demo maintenance records.")


if __name__ == "__main__":
    seed_database()
