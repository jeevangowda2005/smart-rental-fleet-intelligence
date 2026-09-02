import datetime
import enum
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Enum as SQLEnum, Text, JSON
)
from sqlalchemy.orm import relationship
from backend.database.session import Base

class UserRole(str, enum.Enum):
    MANAGER = "MANAGER"
    OPERATOR = "OPERATOR"

class EquipmentStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    RENTED = "RENTED"
    ACTIVE = "ACTIVE"
    IDLE = "IDLE"
    OVERDUE = "OVERDUE"
    MAINTENANCE = "MAINTENANCE"

class RentalStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    OVERDUE = "OVERDUE"

class IncidentStatus(str, enum.Enum):
    NEW = "NEW"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    INVESTIGATING = "INVESTIGATING"
    ACTION_REQUIRED = "ACTION_REQUIRED"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"

class IncidentActionStatus(str, enum.Enum):
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXECUTED = "EXECUTED"
    FAILED = "FAILED"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.OPERATOR, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    rentals = relationship("Rental", back_populates="operator")
    assigned_equipment = relationship("Equipment", back_populates="operator")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")

class Site(Base):
    __tablename__ = "sites"

    id = Column(Integer, primary_key=True, index=True)
    site_code = Column(String, unique=True, index=True, nullable=False)
    site_name = Column(String, nullable=False)
    location = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    # Relationships
    equipment = relationship("Equipment", back_populates="site")
    rentals = relationship("Rental", back_populates="site")

class Equipment(Base):
    __tablename__ = "equipment"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(String, unique=True, index=True, nullable=False)
    equipment_type = Column(String, nullable=False)
    model = Column(String, nullable=False)
    status = Column(SQLEnum(EquipmentStatus), default=EquipmentStatus.AVAILABLE, index=True, nullable=False)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True, index=True)
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    latitude = Column(Float, default=0.0)
    longitude = Column(Float, default=0.0)
    engine_hours = Column(Float, default=0.0)
    idle_hours = Column(Float, default=0.0)
    fuel_usage = Column(Float, default=0.0)
    utilization = Column(Float, default=0.0)
    qr_code = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    site = relationship("Site", back_populates="equipment")
    operator = relationship("User", back_populates="assigned_equipment")
    rentals = relationship("Rental", back_populates="equipment")
    usage_logs = relationship("UsageLog", back_populates="equipment", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="equipment", cascade="all, delete-orphan")
    maintenance_records = relationship("Maintenance", back_populates="equipment", cascade="all, delete-orphan")
    incidents = relationship("Incident", back_populates="equipment", cascade="all, delete-orphan")

class Rental(Base):
    __tablename__ = "rentals"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False, index=True)
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    checkout_time = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    expected_return_time = Column(DateTime, nullable=False)
    actual_return_time = Column(DateTime, nullable=True)
    status = Column(SQLEnum(RentalStatus), default=RentalStatus.ACTIVE, index=True, nullable=False)

    # Telemetry baseline at checkout
    engine_hours_at_checkout = Column(Float, nullable=True, default=0.0)
    idle_hours_at_checkout = Column(Float, nullable=True, default=0.0)
    fuel_usage_at_checkout = Column(Float, nullable=True, default=0.0)

    # Telemetry snapshot at checkin
    engine_hours_at_checkin = Column(Float, nullable=True, default=0.0)
    idle_hours_at_checkin = Column(Float, nullable=True, default=0.0)
    fuel_usage_at_checkin = Column(Float, nullable=True, default=0.0)

    # Relationships
    equipment = relationship("Equipment", back_populates="rentals")
    operator = relationship("User", back_populates="rentals")
    site = relationship("Site", back_populates="rentals")
    billing = relationship("Billing", back_populates="rental", uselist=False)

class UsageLog(Base):
    __tablename__ = "usage_logs"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    engine_hours = Column(Float, default=0.0)
    idle_hours = Column(Float, default=0.0)
    fuel_usage = Column(Float, default=0.0)
    latitude = Column(Float, default=0.0)
    longitude = Column(Float, default=0.0)
    operating_status = Column(String, default="ACTIVE")

    # Relationships
    equipment = relationship("Equipment", back_populates="usage_logs")

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False, index=True)
    alert_type = Column(String, nullable=False)
    severity = Column(String, default="WARNING", nullable=False)
    message = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    is_resolved = Column(Boolean, default=False, index=True)

    # Relationships
    equipment = relationship("Equipment", back_populates="alerts")

class Maintenance(Base):
    __tablename__ = "maintenance"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False, index=True)
    maintenance_type = Column(String, nullable=False)
    description = Column(String, nullable=False)
    scheduled_date = Column(DateTime, nullable=False)
    completed_date = Column(DateTime, nullable=True)
    status = Column(String, default="SCHEDULED", index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True, index=True)

    # Relationships
    equipment = relationship("Equipment", back_populates="maintenance_records")
    incident = relationship("Incident", back_populates="maintenance_orders")


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False, index=True)
    incident_type = Column(String, nullable=False, index=True)
    severity = Column(String, default="WARNING", nullable=False, index=True)
    severity_score = Column(Integer, default=0)
    status = Column(SQLEnum(IncidentStatus), default=IncidentStatus.NEW, index=True, nullable=False)
    detected_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_seen_at = Column(DateTime, default=datetime.datetime.utcnow)
    occurrence_count = Column(Integer, default=1)
    source = Column(String, default="AI_ENGINE")
    description = Column(Text, nullable=False)
    evidence_json = Column(Text, nullable=True)  # JSON serialized
    recommended_action = Column(Text, nullable=True)
    assigned_to_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    resolved_at = Column(DateTime, nullable=True)

    # Relationships
    equipment = relationship("Equipment", back_populates="incidents")
    assigned_to = relationship("User", foreign_keys=[assigned_to_user_id])
    actions = relationship("IncidentAction", back_populates="incident", cascade="all, delete-orphan")
    audit_logs = relationship("IncidentAudit", back_populates="incident", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="incident")
    maintenance_orders = relationship("Maintenance", back_populates="incident")


class IncidentAction(Base):
    __tablename__ = "incident_actions"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False, index=True)
    action_type = Column(String, nullable=False)
    status = Column(SQLEnum(IncidentActionStatus), default=IncidentActionStatus.PENDING_APPROVAL, nullable=False)
    description = Column(Text, nullable=True)
    requested_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    executed_at = Column(DateTime, nullable=True)

    # Relationships
    incident = relationship("Incident", back_populates="actions")
    requested_by = relationship("User", foreign_keys=[requested_by_user_id])
    approved_by = relationship("User", foreign_keys=[approved_by_user_id])


class IncidentAudit(Base):
    __tablename__ = "incident_audits"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_name = Column(String, default="SYSTEM")
    role = Column(String, default="SYSTEM")
    action = Column(String, nullable=False)
    previous_state = Column(String, nullable=True)
    new_state = Column(String, nullable=True)
    reason = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    # Relationships
    incident = relationship("Incident", back_populates="audit_logs")
    equipment = relationship("Equipment")
    user = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=True, index=True)
    notification_type = Column(String, default="WARNING", nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    # Relationships
    user = relationship("User", back_populates="notifications")
    incident = relationship("Incident", back_populates="notifications")
    equipment = relationship("Equipment")


class Billing(Base):
    """
    Persistent billing/invoice record generated after equipment check-in.
    One record per completed rental (enforced by unique rental_id FK).
    All monetary values in INR (₹) by default, matching cost_config.py.
    """
    __tablename__ = "billing"

    id = Column(Integer, primary_key=True, index=True)
    rental_id = Column(Integer, ForeignKey("rentals.id"), nullable=False, unique=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False, index=True)
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Invoice metadata
    invoice_number = Column(String, unique=True, nullable=False, index=True)
    status = Column(String, default="PENDING", nullable=False, index=True)  # PENDING / PAID
    currency = Column(String, default="INR", nullable=False)

    # Rental period
    rental_start = Column(DateTime, nullable=False)
    actual_checkin = Column(DateTime, nullable=False)
    planned_duration_hours = Column(Float, default=0.0)
    actual_duration_hours = Column(Float, default=0.0)

    # Rate applied
    base_rate_per_hour = Column(Float, default=0.0)  # ₹/hour operating rate

    # Charge components
    rental_charge = Column(Float, default=0.0)    # operating hours × rate
    fuel_charge = Column(Float, default=0.0)      # fuel_usage_liters × fuel cost/liter
    idle_charge = Column(Float, default=0.0)      # idle_hours × idle cost/hour
    additional_charge = Column(Float, default=0.0)

    # Totals
    subtotal = Column(Float, default=0.0)
    tax_rate = Column(Float, default=0.18)   # 18% GST
    tax_amount = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)

    # Snapshot values at check-in (for audit / display)
    equipment_code = Column(String, nullable=True)
    equipment_model = Column(String, nullable=True)
    equipment_type = Column(String, nullable=True)
    operator_name = Column(String, nullable=True)
    operator_email = Column(String, nullable=True)
    site_name = Column(String, nullable=True)

    # Telemetry snapshot at checkout (baseline reference)
    engine_hours_at_checkout = Column(Float, default=0.0)
    idle_hours_at_checkout = Column(Float, default=0.0)
    fuel_usage_at_checkout = Column(Float, default=0.0)

    # Telemetry snapshot at check-in (cumulative reference)
    engine_hours_at_checkin = Column(Float, default=0.0)
    idle_hours_at_checkin = Column(Float, default=0.0)
    fuel_usage_at_checkin = Column(Float, default=0.0)

    # Rental-specific usage (calculated: checkin - checkout)
    rental_operating_hours = Column(Float, default=0.0)
    rental_idle_hours = Column(Float, default=0.0)
    rental_fuel_used = Column(Float, default=0.0)

    generated_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Relationships
    rental = relationship("Rental", back_populates="billing")
    equipment = relationship("Equipment")
    operator = relationship("User")

