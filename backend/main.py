import os
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database.session import Base, engine
from backend.database.seed import seed_database
from backend.services.simulator import simulator_engine
from backend.api import (
    auth,
    equipment,
    sites,
    rentals,
    logs,
    alerts,
    maintenance,
    dashboard,
    websockets,
    simulation,
    ai,
    business,
    maintenance_intelligence,
    incidents
)

app = FastAPI(
    title="Smart Rental Tracking & Fleet Intelligence API",
    description="Enterprise construction & mining fleet management platform backend.",
    version="1.0.0"
)

# Configure CORS dynamically for production deployment
origins_env = os.getenv("ALLOWED_ORIGINS", "")
if origins_env:
    allowed_origins = [o.strip() for o in origins_env.split(",") if o.strip()]
else:
    allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    # Ensure database schema exists and seed default fleet data
    Base.metadata.create_all(bind=engine)
    try:
        seed_database()
    except Exception as e:
        print(f"Database seed notice: {e}")

    # Launch background telemetry simulation loop
    asyncio.create_task(simulator_engine.run_loop())

@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "Fleet Intelligence Backend",
        "version": "1.0.0",
        "simulation": "DEMO LIVE SIMULATION — NOT LIVE HARDWARE DATA"
    }

# Register Routers
app.include_router(auth.router)
app.include_router(equipment.router)
app.include_router(sites.router)
app.include_router(rentals.router)
app.include_router(logs.router)
app.include_router(alerts.router)
app.include_router(maintenance.router)
app.include_router(dashboard.router)
app.include_router(websockets.router)
app.include_router(simulation.router)
app.include_router(ai.router)
app.include_router(business.router)
app.include_router(maintenance_intelligence.router)
app.include_router(incidents.router)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=False)
