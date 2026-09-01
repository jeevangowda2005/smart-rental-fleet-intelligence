import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Default to SQLite for seamless local execution if PostgreSQL environment variable isn't set or fails
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./fleet_intelligence.db"
)

# SQLite requires connect_args for multithreading in FastAPI
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

try:
    engine = create_engine(DATABASE_URL, connect_args=connect_args)
    # Quick connectivity check
    with engine.connect() as conn:
        pass
except Exception as e:
    print(f"Warning: Failed to connect using DATABASE_URL={DATABASE_URL}. Falling back to SQLite. Error: {e}")
    DATABASE_URL = "sqlite:///./fleet_intelligence.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
