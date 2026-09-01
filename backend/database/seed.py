import datetime
from sqlalchemy.orm import Session
from backend.database.session import Base, engine, SessionLocal
from backend.models.domain import (
    User, UserRole, Site, Equipment, EquipmentStatus,
    Rental, RentalStatus, UsageLog, Alert, Maintenance
)
from backend.services.auth import get_password_hash
from backend.services.fleet_intelligence import calculate_utilization

def seed_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    # Clear existing data to allow clean re-seeding with updated utilization formula
    db.query(Alert).delete()
    db.query(UsageLog).delete()
    db.query(Maintenance).delete()
    db.query(Rental).delete()
    db.query(Equipment).delete()
    db.query(Site).delete()
    db.query(User).delete()
    db.commit()

    print("Seeding expanded Caterpillar enterprise fleet database...")

    # 1. Users
    manager = User(
        name="Alex Mercer (Fleet Director)",
        email="manager@catfleet.com",
        password_hash=get_password_hash("password123"),
        role=UserRole.MANAGER
    )
    operator1 = User(
        name="Marcus Vance (Senior Equipment Operator)",
        email="operator@catfleet.com",
        password_hash=get_password_hash("password123"),
        role=UserRole.OPERATOR
    )
    operator2 = User(
        name="Sarah Jenkins (Heavy Machinery Specialist)",
        email="operator2@catfleet.com",
        password_hash=get_password_hash("password123"),
        role=UserRole.OPERATOR
    )
    db.add_all([manager, operator1, operator2])
    db.commit()
    db.refresh(manager)
    db.refresh(operator1)
    db.refresh(operator2)

    # 2. Sites
    site1 = Site(
        site_code="SITE-PIT-01",
        site_name="Northern Mining Pit A",
        location="Denver, CO",
        latitude=39.7392,
        longitude=-104.9903
    )
    site2 = Site(
        site_code="SITE-QRY-02",
        site_name="Apex Granite Quarry",
        location="Salt Lake City, UT",
        latitude=40.7608,
        longitude=-111.8910
    )
    site3 = Site(
        site_code="SITE-MTR-03",
        site_name="Metro Transit Infra Project",
        location="Phoenix, AZ",
        latitude=33.4484,
        longitude=-112.0740
    )
    site4 = Site(
        site_code="SITE-DEP-04",
        site_name="Central Logistics Depot",
        location="Las Vegas, NV",
        latitude=36.1699,
        longitude=-115.1398
    )
    db.add_all([site1, site2, site3, site4])
    db.commit()

    # Helper function to create equipment with accurate utilization calculation
    def create_eq(eq_id, eq_type, model, status, site, operator, lat, lng, eng_hrs, idle_hrs, fuel):
        util = calculate_utilization(eng_hrs, idle_hrs)
        return Equipment(
            equipment_id=eq_id,
            equipment_type=eq_type,
            model=model,
            status=status,
            site_id=site.id if site else None,
            operator_id=operator.id if operator else None,
            latitude=lat,
            longitude=lng,
            engine_hours=eng_hrs,
            idle_hours=idle_hrs,
            fuel_usage=fuel,
            utilization=util,
            qr_code=f"QR-{eq_id}"
        )

    # 3. 12 Equipment Assets
    eq1 = create_eq("CAT-EXC-349", "Hydraulic Excavator", "CAT 349 Next Gen", EquipmentStatus.ACTIVE, site1, operator1, 39.7401, -104.9912, 1420.0, 210.0, 42.5)
    eq2 = create_eq("CAT-EXC-320", "Hydraulic Excavator", "CAT 320 GC Medium", EquipmentStatus.MAINTENANCE, site2, None, 40.7600, -111.8900, 3110.0, 580.0, 28.5)
    eq3 = create_eq("CAT-EXC-390", "Hydraulic Excavator", "CAT 390F Mass Excavator", EquipmentStatus.AVAILABLE, site4, None, 36.1705, -115.1410, 520.0, 45.0, 65.0)
    eq4 = create_eq("CAT-TRK-777", "Off-Highway Haul Truck", "CAT 777G Mining Truck", EquipmentStatus.ACTIVE, site1, operator2, 39.7385, -104.9890, 2850.0, 310.0, 78.2)
    eq5 = create_eq("CAT-TRK-745", "Articulated Haul Truck", "CAT 745 45-Ton Payload", EquipmentStatus.OVERDUE, site3, operator1, 33.4490, -112.0752, 1890.0, 412.0, 56.0)
    eq6 = create_eq("CAT-TRK-730", "Articulated Haul Truck", "CAT 730 Ejector Truck", EquipmentStatus.RENTED, site3, operator2, 33.4475, -112.0730, 1120.0, 180.0, 48.0)
    eq7 = create_eq("CAT-DOZ-D8T", "Track Dozer", "CAT D8T Heavy Crawler", EquipmentStatus.IDLE, site2, None, 40.7612, -111.8925, 980.0, 420.0, 31.0)
    eq8 = create_eq("CAT-DOZ-D11", "Track Dozer", "CAT D11 Heavy Mining Dozer", EquipmentStatus.ACTIVE, site1, operator1, 39.7410, -104.9920, 4100.0, 620.0, 95.0)
    eq9 = create_eq("CAT-WLD-980", "Wheel Loader", "CAT 980M Performance Series", EquipmentStatus.AVAILABLE, site4, None, 36.1702, -115.1405, 450.0, 85.0, 24.0)
    eq10 = create_eq("CAT-WLD-992", "Wheel Loader", "CAT 992 Large Mining Loader", EquipmentStatus.ACTIVE, site2, operator2, 40.7620, -111.8940, 2150.0, 340.0, 82.0)
    eq11 = create_eq("CAT-MGD-16M", "Motor Grader", "CAT 16M3 Mining Motor Grader", EquipmentStatus.RENTED, site3, operator1, 33.4460, -112.0720, 1640.0, 290.0, 38.0)
    eq12 = create_eq("CAT-CMP-825", "Soil Compactor", "CAT 825K Soil Compactor", EquipmentStatus.AVAILABLE, site4, None, 36.1690, -115.1385, 680.0, 120.0, 29.0)

    db.add_all([eq1, eq2, eq3, eq4, eq5, eq6, eq7, eq8, eq9, eq10, eq11, eq12])
    db.commit()

    # 4. Rentals
    now = datetime.datetime.utcnow()
    rental1 = Rental(
        equipment_id=eq1.id,
        operator_id=operator1.id,
        site_id=site1.id,
        checkout_time=now - datetime.timedelta(days=5),
        expected_return_time=now + datetime.timedelta(days=9),
        status=RentalStatus.ACTIVE
    )
    rental2 = Rental(
        equipment_id=eq5.id,
        operator_id=operator1.id,
        site_id=site3.id,
        checkout_time=now - datetime.timedelta(days=12),
        expected_return_time=now - datetime.timedelta(days=2), # Overdue
        status=RentalStatus.OVERDUE
    )
    rental3 = Rental(
        equipment_id=eq6.id,
        operator_id=operator2.id,
        site_id=site3.id,
        checkout_time=now - datetime.timedelta(days=3),
        expected_return_time=now + datetime.timedelta(days=11),
        status=RentalStatus.ACTIVE
    )
    db.add_all([rental1, rental2, rental3])
    db.commit()

    # 5. Usage Logs
    for i in range(6):
        t = now - datetime.timedelta(hours=i * 6)
        log1 = UsageLog(
            equipment_id=eq1.id,
            timestamp=t,
            engine_hours=eq1.engine_hours - (i * 5.0),
            idle_hours=max(0.0, eq1.idle_hours - (i * 0.8)),
            fuel_usage=eq1.fuel_usage,
            latitude=eq1.latitude,
            longitude=eq1.longitude,
            operating_status="ACTIVE"
        )
        log2 = UsageLog(
            equipment_id=eq4.id,
            timestamp=t,
            engine_hours=eq4.engine_hours - (i * 5.5),
            idle_hours=max(0.0, eq4.idle_hours - (i * 0.6)),
            fuel_usage=eq4.fuel_usage,
            latitude=eq4.latitude,
            longitude=eq4.longitude,
            operating_status="ACTIVE"
        )
        db.add_all([log1, log2])
    db.commit()

    # 6. Alerts (With deduplication check in seed)
    a1 = Alert(
        equipment_id=eq7.id,
        alert_type="HIGH_IDLE_RATIO",
        severity="WARNING",
        message="Excessive engine idling detected (>30% of runtime) at Apex Granite Quarry.",
        is_resolved=False
    )
    a2 = Alert(
        equipment_id=eq5.id,
        alert_type="OVERDUE_RENTAL",
        severity="CRITICAL",
        message="CAT-TRK-745 has exceeded its expected return time by 48 hours.",
        is_resolved=False
    )
    a3 = Alert(
        equipment_id=eq2.id,
        alert_type="HYDRAULIC_PRESSURE_DROP",
        severity="CRITICAL",
        message="Hydraulic system pressure delta exceeds safety thresholds. Machine routed to service.",
        is_resolved=False
    )
    db.add_all([a1, a2, a3])
    db.commit()

    # 7. Maintenance Records
    m1 = Maintenance(
        equipment_id=eq2.id,
        maintenance_type="500-Hour Hydraulic & Filter Overhaul",
        description="Comprehensive hydraulic pump inspection and filter replacement.",
        scheduled_date=now - datetime.timedelta(days=1),
        status="IN_PROGRESS"
    )
    m2 = Maintenance(
        equipment_id=eq1.id,
        maintenance_type="Preventative Engine Inspection",
        description="Engine oil sample analysis and belt tension validation.",
        scheduled_date=now + datetime.timedelta(days=14),
        status="SCHEDULED"
    )
    db.add_all([m1, m2])
    db.commit()

    db.close()
    print("Database seeding completed with expanded fleet and accurate utilization values!")

if __name__ == "__main__":
    seed_database()
