from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database.session import get_db
from backend.models.domain import Site, Equipment, UserRole, User
from backend.schemas.domain import SiteCreate, SiteResponse
from backend.services.auth import get_current_user, require_role

router = APIRouter(prefix="/api/sites", tags=["Sites"])

@router.get("", response_model=List[SiteResponse])
def list_sites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sites = db.query(Site).all()
    results = []
    for s in sites:
        eq_count = db.query(Equipment).filter(Equipment.site_id == s.id).count()
        results.append(
            SiteResponse(
                id=s.id,
                site_code=s.site_code,
                site_name=s.site_name,
                location=s.location,
                latitude=s.latitude,
                longitude=s.longitude,
                equipment_count=eq_count
            )
        )
    return results

@router.post("", response_model=SiteResponse)
def create_site(
    request: SiteCreate,
    current_user: User = Depends(require_role([UserRole.MANAGER])),
    db: Session = Depends(get_db)
):
    existing = db.query(Site).filter(Site.site_code == request.site_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Site code already exists")
    
    site = Site(
        site_code=request.site_code,
        site_name=request.site_name,
        location=request.location,
        latitude=request.latitude,
        longitude=request.longitude
    )
    db.add(site)
    db.commit()
    db.refresh(site)
    return SiteResponse(
        id=site.id,
        site_code=site.site_code,
        site_name=site.site_name,
        location=site.location,
        latitude=site.latitude,
        longitude=site.longitude,
        equipment_count=0
    )
