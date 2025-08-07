from sqlalchemy import Column, String, DateTime, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.orm import sessionmaker
import uuid
import os

Base = declarative_base()

class Truck(Base):
    __tablename__ = "trucks"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    terminal = Column(String(50), nullable=False)
    shipping_no = Column(String(50), nullable=False, index=True)  # Changed from truck_no, added index
    dock_code = Column(String(50), nullable=False)
    truck_route = Column(String(100), nullable=False)
    preparation_start = Column(String, nullable=True)
    preparation_end = Column(String, nullable=True)
    loading_start = Column(String, nullable=True)
    loading_end = Column(String, nullable=True)
    status_preparation = Column(String(20), default="On Process")
    status_loading = Column(String(20), default="On Process")
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="viewer")
    created_at = Column(DateTime, default=func.now())

# Database setup - Use data directory for persistence
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/truck_management.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create data directory if it doesn't exist
os.makedirs("./data", exist_ok=True)

# Create tables
def create_tables():
    Base.metadata.create_all(bind=engine)

# Get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()