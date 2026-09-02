from datetime import datetime
from typing import Optional, List, Union
from pydantic import BaseModel, EmailStr, Field
from backend.models.domain import UserRole, EquipmentStatus, RentalStatus

# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str
    user: "UserResponse"

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: UserRole = UserRole.OPERATOR

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Site Schemas
class SiteBase(BaseModel):
    site_code: str
    site_name: str
    location: str
    latitude: float
    longitude: float

class SiteCreate(SiteBase):
    pass

class SiteResponse(SiteBase):
    id: int
    equipment_count: Optional[int] = 0

    class Config:
        from_attributes = True

# Equipment Schemas
class EquipmentBase(BaseModel):
    equipment_id: str
    equipment_type: str
    model: str
    status: EquipmentStatus = EquipmentStatus.AVAILABLE
    site_id: Optional[int] = None
    operator_id: Optional[int] = None
    latitude: float = 0.0
    longitude: float = 0.0
    engine_hours: float = Field(default=0.0, ge=0.0)
    idle_hours: float = Field(default=0.0, ge=0.0)
    fuel_usage: float = Field(default=0.0, ge=0.0)
    utilization: float = Field(default=0.0, ge=0.0, le=100.0)
    qr_code: Optional[str] = None

class EquipmentCreate(EquipmentBase):
    pass

class EquipmentUpdate(BaseModel):
    status: Optional[EquipmentStatus] = None
    site_id: Optional[int] = None
    operator_id: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    engine_hours: Optional[float] = Field(default=None, ge=0.0)
    idle_hours: Optional[float] = Field(default=None, ge=0.0)
    fuel_usage: Optional[float] = Field(default=None, ge=0.0)
    utilization: Optional[float] = Field(default=None, ge=0.0, le=100.0)

class EquipmentResponse(EquipmentBase):
    id: int
    created_at: datetime
    site_name: Optional[str] = None
    operator_name: Optional[str] = None
    health_status: Optional[str] = "HEALTHY"
    health_score: Optional[float] = 100.0

    class Config:
        from_attributes = True

# Rental Schemas
class RentalBase(BaseModel):
    equipment_id: int
    operator_id: int
    site_id: int
    expected_return_time: datetime

class RentalCheckout(BaseModel):
    equipment_id: int
    operator_id: int
    site_id: int
    expected_return_days: int = Field(default=7, ge=1)

class RentalCheckin(BaseModel):
    rental_id: Optional[int] = None
    notes: Optional[str] = None

class RentalResponse(BaseModel):
    id: int
    equipment_id: int
    operator_id: int
    site_id: int
    checkout_time: datetime
    expected_return_time: datetime
    actual_return_time: Optional[datetime] = None
    status: RentalStatus
    equipment_code: Optional[str] = None
    equipment_model: Optional[str] = None
    equipment_category: Optional[str] = None
    operator_name: Optional[str] = None
    site_name: Optional[str] = None
    planned_duration_days: Optional[float] = 0.0
    elapsed_duration_days: Optional[float] = 0.0
    remaining_duration_days: Optional[float] = 0.0
    planned_duration_hours: Optional[float] = 0.0
    elapsed_duration_hours: Optional[float] = 0.0
    remaining_duration_hours: Optional[float] = 0.0
    progress_pct: Optional[float] = 0.0
    utilization: Optional[float] = 0.0
    engine_hours: Optional[float] = 0.0
    operating_hours: Optional[float] = 0.0
    idle_hours: Optional[float] = 0.0
    fuel_usage: Optional[float] = 0.0
    health_status: Optional[str] = "HEALTHY"
    health_score: Optional[float] = 100.0
    active_alerts_count: Optional[int] = 0
    early_return_opportunity: Optional[dict] = None
    lifecycle_stages: Optional[list] = None

    class Config:
        from_attributes = True

# Usage Log Schemas
class UsageLogCreate(BaseModel):
    equipment_id: int
    engine_hours: float = Field(..., ge=0.0)
    idle_hours: float = Field(..., ge=0.0)
    fuel_usage: float = Field(..., ge=0.0)
    latitude: float
    longitude: float
    operating_status: str = "ACTIVE"

class UsageLogResponse(UsageLogCreate):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True

# Alert Schemas
class AlertCreate(BaseModel):
    equipment_id: int
    alert_type: str
    severity: str = "WARNING" # CRITICAL, WARNING, INFO
    message: str

class IssueReportCreate(BaseModel):
    equipment_id: Union[int, str]
    issue_type: Optional[str] = "OPERATOR_REPORT"
    severity: str = "WARNING"
    description: str

class AlertResponse(AlertCreate):
    id: int
    created_at: datetime
    is_resolved: bool
    equipment_code: Optional[str] = None

    class Config:
        from_attributes = True

# Maintenance Schemas
class MaintenanceCreate(BaseModel):
    equipment_id: int
    maintenance_type: str
    description: str
    scheduled_date: datetime

class MaintenanceUpdate(BaseModel):
    status: Optional[str] = None
    completed_date: Optional[datetime] = None

class MaintenanceResponse(MaintenanceCreate):
    id: int
    completed_date: Optional[datetime] = None
    status: str
    equipment_code: Optional[str] = None

    class Config:
        from_attributes = True

# Equipment Detailed Overview Schema
class EquipmentDetailResponse(EquipmentResponse):
    health_reasons: List[str] = []
    active_rental: Optional[RentalResponse] = None
    recent_logs: List[UsageLogResponse] = []
    recent_alerts: List[AlertResponse] = []
    recent_maintenance: List[MaintenanceResponse] = []

# Dashboard Metrics Schema
class DashboardStats(BaseModel):
    total_equipment: int
    available_count: int
    rented_count: int
    active_count: int
    idle_count: int
    overdue_count: int
    maintenance_count: int
    avg_utilization: float
    avg_fuel_usage: float
    total_sites: int
    active_alerts: int


# Billing / Invoice Schemas
class BillingResponse(BaseModel):
    id: int
    rental_id: int
    equipment_id: int
    operator_id: int
    invoice_number: str
    status: str
    currency: str

    # Period
    rental_start: datetime
    actual_checkin: datetime
    planned_duration_hours: float
    actual_duration_hours: float

    # Rate
    base_rate_per_hour: float

    # Charges
    rental_charge: float
    fuel_charge: float
    idle_charge: float
    additional_charge: float

    # Totals
    subtotal: float
    tax_rate: float
    tax_amount: float
    total_amount: float

    # Snapshot info
    equipment_code: Optional[str] = None
    equipment_model: Optional[str] = None
    equipment_type: Optional[str] = None
    operator_name: Optional[str] = None
    operator_email: Optional[str] = None
    site_name: Optional[str] = None

    # Telemetry snapshot
    engine_hours_at_checkout: float = 0.0
    idle_hours_at_checkout: float = 0.0
    fuel_usage_at_checkout: float = 0.0

    engine_hours_at_checkin: float = 0.0
    idle_hours_at_checkin: float = 0.0
    fuel_usage_at_checkin: float = 0.0

    # Rental-specific usage
    rental_operating_hours: float = 0.0
    rental_idle_hours: float = 0.0
    rental_fuel_used: float = 0.0

    generated_at: datetime

    class Config:
        from_attributes = True

