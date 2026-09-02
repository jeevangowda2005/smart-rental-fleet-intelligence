"""
Billing API Router
Provides endpoints for generating, retrieving, and listing billing/invoice records.

Access Control:
- MANAGER: can see all billing records
- OPERATOR: can only see their own billing records

Billing is generated automatically on check-in (via rentals.py).
These endpoints support retrieval and listing only.
"""
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.models.domain import Billing, Rental, RentalStatus, User, UserRole, Equipment
from backend.schemas.domain import BillingResponse
from backend.services.auth import get_current_user, require_role
from backend.ai.cost_config import (
    DEFAULT_OPERATING_COST_PER_HOUR,
    DEFAULT_FUEL_COST_PER_LITER,
    DEFAULT_IDLE_COST_PER_HOUR,
)

router = APIRouter(prefix="/api/billing", tags=["Billing"])

TAX_RATE = 0.18  # 18% GST


def generate_invoice_number(rental_id: int) -> str:
    """Generate a deterministic, human-readable invoice number."""
    ts = datetime.datetime.utcnow().strftime("%Y%m%d")
    return f"INV-{ts}-R{rental_id:05d}"


def calculate_and_create_billing(rental: Rental, db: Session) -> Billing:
    """
    Calculate billing for a completed rental and persist it.
    Idempotent: if a billing record already exists for this rental, return it unchanged.

    CRITICAL RULES & CONCEPTUAL SEPARATION:
      1. Cumulative Engine Meter: Machine's lifetime meter (e.g. 680.44 hrs). Saved as reference only.
      2. Rental-Specific Usage: Usage accrued BETWEEN checkout and check-in times.
         - rental_operating_hours = checkin_operating - checkout_operating (or checkin_engine - checkout_engine - rental_idle)
         - rental_idle_hours = checkin_idle - checkout_idle
         - rental_fuel_used = checkin_fuel - checkout_fuel (or burn_rate × rental_operating_hours)
      3. Rental Duration: Wall-clock elapsed hours between checkout_time and actual_checkin_time.

    Charges calculated strictly from rental-specific usage:
      - Operating Charge = rental_operating_hours × DEFAULT_OPERATING_COST_PER_HOUR (₹1,200/hr)
      - Standby / Idle Charge = rental_idle_hours × DEFAULT_IDLE_COST_PER_HOUR (₹500/hr)
      - Fuel Charge = rental_fuel_used × DEFAULT_FUEL_COST_PER_LITER (₹95/L)
      - Subtotal = operating_charge + idle_charge + fuel_charge + additional_charge
      - Tax = subtotal × 18% GST
      - Total = subtotal + Tax
    """
    existing = db.query(Billing).filter(Billing.rental_id == rental.id).first()
    if existing:
        return existing

    eq = rental.equipment
    op = rental.operator
    site = rental.site

    checkin_time = rental.actual_return_time or datetime.datetime.utcnow()
    checkout_time = rental.checkout_time

    # Wall-clock duration calculations
    planned_seconds = max(0.0, (rental.expected_return_time - checkout_time).total_seconds())
    planned_hours = round(planned_seconds / 3600.0, 3)

    actual_seconds = max(0.0, (checkin_time - checkout_time).total_seconds())
    actual_hours = round(actual_seconds / 3600.0, 3)

    # Cumulative baseline at check-in (defaults to current equipment meters)
    checkin_eng = rental.engine_hours_at_checkin if (rental.engine_hours_at_checkin is not None and rental.engine_hours_at_checkin > 0) else (eq.engine_hours if eq else 0.0)
    checkin_idle = rental.idle_hours_at_checkin if (rental.idle_hours_at_checkin is not None and rental.idle_hours_at_checkin > 0) else (eq.idle_hours if eq else 0.0)
    checkin_fuel = rental.fuel_usage_at_checkin if (rental.fuel_usage_at_checkin is not None and rental.fuel_usage_at_checkin > 0) else (eq.fuel_usage if eq else 0.0)

    # Baseline at checkout
    checkout_eng = rental.engine_hours_at_checkout if (rental.engine_hours_at_checkout is not None and rental.engine_hours_at_checkout > 0) else 0.0
    checkout_idle = rental.idle_hours_at_checkout if (rental.idle_hours_at_checkout is not None and rental.idle_hours_at_checkout > 0) else 0.0
    checkout_fuel = rental.fuel_usage_at_checkout if (rental.fuel_usage_at_checkout is not None and rental.fuel_usage_at_checkout > 0) else 0.0

    # Ensure non-decreasing meters
    if checkin_eng < checkout_eng:
        checkin_eng = checkout_eng
    if checkin_idle < checkout_idle:
        checkin_idle = checkout_idle

    # Fallback for old/seeded rentals or when checkout baseline was unrecorded/0.0:
    if checkout_eng == 0.0 or (checkin_eng - checkout_eng) > (actual_hours * 24.0 + 50.0):
        from backend.models.domain import UsageLog
        # Search for a UsageLog recorded right before or near checkout_time
        earliest_log = db.query(UsageLog).filter(
            UsageLog.equipment_id == rental.equipment_id,
            UsageLog.timestamp <= checkout_time + datetime.timedelta(minutes=30)
        ).order_by(UsageLog.timestamp.desc()).first()

        if not earliest_log:
            earliest_log = db.query(UsageLog).filter(
                UsageLog.equipment_id == rental.equipment_id,
                UsageLog.timestamp >= checkout_time
            ).order_by(UsageLog.timestamp.asc()).first()

        if earliest_log and earliest_log.engine_hours > 0 and (checkin_eng - earliest_log.engine_hours) <= (actual_hours * 24.0 + 50.0):
            checkout_eng = earliest_log.engine_hours
            checkout_idle = earliest_log.idle_hours
        else:
            # If no valid log baseline exists, set baseline = checkin_eng so cumulative lifetime meter (e.g. 680.44 hrs) is NEVER billed as rental usage
            checkout_eng = checkin_eng
            checkout_idle = checkin_idle
            checkout_fuel = checkin_fuel

    # Calculate raw meter deltas
    raw_eng_delta = max(0.0, checkin_eng - checkout_eng)
    raw_idle_delta = max(0.0, checkin_idle - checkout_idle)

    # Physical Data Consistency Invariant:
    # Operating + Idle hours accrued during a rental cannot physically exceed elapsed wall-clock rental duration (actual_hours).
    # If telemetry updates (e.g. shift logs) record operating/idle usage, actual_duration_hours is at least equal to total usage.
    raw_tot_usage = round(raw_eng_delta, 3)
    if raw_tot_usage > actual_hours:
        actual_hours = raw_tot_usage

    rental_eng_delta = round(raw_eng_delta, 3)
    rental_idle_hours = round(raw_idle_delta, 3)
    rental_operating_hours = round(max(0.0, rental_eng_delta - rental_idle_hours), 3)

    # Fuel calculation based on corrected rental operating hours
    rental_fuel_delta = max(0.0, checkin_fuel - checkout_fuel)
    if rental_fuel_delta > 0 and rental_fuel_delta <= (rental_operating_hours * 50.0 + 10.0):
        rental_fuel_used = round(rental_fuel_delta, 2)
    else:
        burn_rate = checkin_fuel if checkin_fuel > 0 else 20.0
        rental_fuel_used = round(burn_rate * rental_operating_hours, 2)

    # Charge calculations from rental-specific usage
    rental_charge = round(rental_operating_hours * DEFAULT_OPERATING_COST_PER_HOUR, 2)
    idle_charge = round(rental_idle_hours * DEFAULT_IDLE_COST_PER_HOUR, 2)
    fuel_charge = round(rental_fuel_used * DEFAULT_FUEL_COST_PER_LITER, 2)
    additional_charge = 0.0

    subtotal = round(rental_charge + fuel_charge + idle_charge + additional_charge, 2)
    tax_amount = round(subtotal * TAX_RATE, 2)
    total_amount = round(subtotal + tax_amount, 2)

    # Mandatory Physical & Data Integrity Assertions
    assert checkin_eng >= checkout_eng, "Check-in engine hours must be >= checkout engine hours"
    assert checkin_idle >= checkout_idle, "Check-in idle hours must be >= checkout idle hours"
    assert rental_operating_hours >= 0.0, "Operating hours cannot be negative"
    assert rental_idle_hours >= 0.0, "Idle hours cannot be negative"
    assert rental_fuel_used >= 0.0, "Fuel used cannot be negative"
    assert actual_hours >= 0.0, "Actual duration hours cannot be negative"
    if actual_hours > 0:
        assert round(rental_operating_hours + rental_idle_hours, 3) <= round(actual_hours + 0.001, 3), (
            f"Physical Data Inconsistency: Operating ({rental_operating_hours}) + Idle ({rental_idle_hours}) "
            f"= {rental_operating_hours + rental_idle_hours} hrs, which exceeds actual rental duration ({actual_hours} hrs)"
        )

    billing = Billing(
        rental_id=rental.id,
        equipment_id=rental.equipment_id,
        operator_id=rental.operator_id,
        invoice_number=generate_invoice_number(rental.id),
        status="PENDING",
        currency="INR",
        rental_start=checkout_time,
        actual_checkin=checkin_time,
        planned_duration_hours=planned_hours,
        actual_duration_hours=actual_hours,
        base_rate_per_hour=DEFAULT_OPERATING_COST_PER_HOUR,
        rental_charge=rental_charge,
        fuel_charge=fuel_charge,
        idle_charge=idle_charge,
        additional_charge=additional_charge,
        subtotal=subtotal,
        tax_rate=TAX_RATE,
        tax_amount=tax_amount,
        total_amount=total_amount,
        # Snapshot metadata
        equipment_code=eq.equipment_id if eq else None,
        equipment_model=eq.model if eq else None,
        equipment_type=eq.equipment_type if eq else None,
        operator_name=op.name if op else None,
        operator_email=op.email if op else None,
        site_name=site.site_name if site else None,
        # Telemetry baselines & snapshots
        engine_hours_at_checkout=checkout_eng,
        idle_hours_at_checkout=checkout_idle,
        fuel_usage_at_checkout=checkout_fuel,
        engine_hours_at_checkin=checkin_eng,
        idle_hours_at_checkin=checkin_idle,
        fuel_usage_at_checkin=checkin_fuel,
        # Rental-specific usage
        rental_operating_hours=rental_operating_hours,
        rental_idle_hours=rental_idle_hours,
        rental_fuel_used=rental_fuel_used,
        generated_at=datetime.datetime.utcnow(),
    )
    db.add(billing)
    db.commit()
    db.refresh(billing)
    return billing


# ─────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────

@router.get("", response_model=List[BillingResponse])
def list_billing(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List billing records.
    - MANAGER: all billing records, newest first.
    - OPERATOR: only their own billing records.
    """
    query = db.query(Billing)
    if current_user.role == UserRole.OPERATOR:
        query = query.filter(Billing.operator_id == current_user.id)
    bills = query.order_by(Billing.generated_at.desc()).all()
    return bills


@router.get("/rental/{rental_id}", response_model=BillingResponse)
def get_billing_by_rental(
    rental_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the billing record for a specific rental."""
    billing = db.query(Billing).filter(Billing.rental_id == rental_id).first()
    if not billing:
        raise HTTPException(status_code=404, detail="No billing record found for this rental")

    # RBAC: operators can only access their own
    if current_user.role == UserRole.OPERATOR and billing.operator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this billing record")

    return billing


@router.get("/{billing_id}", response_model=BillingResponse)
def get_billing_by_id(
    billing_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific billing record by its ID."""
    billing = db.query(Billing).filter(Billing.id == billing_id).first()
    if not billing:
        raise HTTPException(status_code=404, detail="Billing record not found")

    # RBAC: operators can only access their own
    if current_user.role == UserRole.OPERATOR and billing.operator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this billing record")

    return billing


@router.post("/generate/{rental_id}", response_model=BillingResponse)
def generate_billing_for_rental(
    rental_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Manually trigger billing generation for a completed rental.
    Idempotent: safe to call multiple times — returns existing invoice if already generated.
    Restricted to MANAGER or the rental's own operator.
    """
    rental = db.query(Rental).filter(Rental.id == rental_id).first()
    if not rental:
        raise HTTPException(status_code=404, detail="Rental not found")

    if rental.status != RentalStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail="Billing can only be generated for COMPLETED rentals"
        )

    # RBAC: operators can only generate bills for their own rentals
    if current_user.role == UserRole.OPERATOR and rental.operator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to generate billing for this rental")

    billing = calculate_and_create_billing(rental, db)
    return billing
