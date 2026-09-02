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

    Pricing uses the project's centralized cost_config rates:
      - Rental charge: actual operating hours × DEFAULT_OPERATING_COST_PER_HOUR
      - Fuel charge: fuel_usage (L/hr) × actual_hours × DEFAULT_FUEL_COST_PER_LITER
      - Idle charge: idle_hours × DEFAULT_IDLE_COST_PER_HOUR
      - Tax: 18% GST on subtotal
    """
    # Idempotency check — never create a duplicate invoice
    existing = db.query(Billing).filter(Billing.rental_id == rental.id).first()
    if existing:
        return existing

    eq = rental.equipment
    op = rental.operator
    site = rental.site

    checkin_time = rental.actual_return_time or datetime.datetime.utcnow()
    checkout_time = rental.checkout_time

    # Duration calculations
    planned_seconds = max(0.0, (rental.expected_return_time - checkout_time).total_seconds())
    planned_hours = round(planned_seconds / 3600.0, 2)

    actual_seconds = max(0.0, (checkin_time - checkout_time).total_seconds())
    actual_hours = round(actual_seconds / 3600.0, 2)

    # Telemetry snapshot values
    engine_hours = eq.engine_hours if eq else 0.0
    idle_hours = eq.idle_hours if eq else 0.0
    fuel_usage_rate = eq.fuel_usage if eq else 0.0  # L/hr

    # Operating hours = engine hours minus idle hours (clamped to 0)
    operating_hours = max(0.0, engine_hours - idle_hours)

    # Charge calculations using centralized cost_config rates
    rental_charge = round(operating_hours * DEFAULT_OPERATING_COST_PER_HOUR, 2)

    # Fuel charge: fuel burn rate × actual rental hours × cost per liter
    fuel_charge = round(fuel_usage_rate * actual_hours * DEFAULT_FUEL_COST_PER_LITER, 2)

    # Idle charge
    idle_charge = round(idle_hours * DEFAULT_IDLE_COST_PER_HOUR, 2)

    additional_charge = 0.0
    subtotal = round(rental_charge + fuel_charge + idle_charge + additional_charge, 2)
    tax_amount = round(subtotal * TAX_RATE, 2)
    total_amount = round(subtotal + tax_amount, 2)

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
        # Snapshot fields
        equipment_code=eq.equipment_id if eq else None,
        equipment_model=eq.model if eq else None,
        equipment_type=eq.equipment_type if eq else None,
        operator_name=op.name if op else None,
        operator_email=op.email if op else None,
        site_name=site.site_name if site else None,
        # Telemetry snapshot
        engine_hours_at_checkin=engine_hours,
        idle_hours_at_checkin=idle_hours,
        fuel_usage_at_checkin=fuel_usage_rate,
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
