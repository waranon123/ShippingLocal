# backend/app/models.py - Updated schema for better monthly data support

from sqlalchemy import Column, String, DateTime, Date, create_engine, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.orm import sessionmaker
import uuid
import os

Base = declarative_base()

class Truck(Base):
    __tablename__ = "trucks"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    terminal = Column(String(50), nullable=False, index=True)  # Added index for filtering
    shipping_no = Column(String(100), nullable=False, index=True)  # Increased size for date suffix
    dock_code = Column(String(50), nullable=False)
    truck_route = Column(String(100), nullable=False)
    preparation_start = Column(String, nullable=True)
    preparation_end = Column(String, nullable=True)
    loading_start = Column(String, nullable=True)
    loading_end = Column(String, nullable=True)
    status_preparation = Column(String(20), default="On Process", index=True)  # Added index
    status_loading = Column(String(20), default="On Process", index=True)     # Added index
    created_at = Column(DateTime, default=func.now(), index=True)  # Added index for date filtering
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Add composite index for common query patterns
    __table_args__ = (
        Index('idx_terminal_date', 'terminal', 'created_at'),
        Index('idx_shipping_date', 'shipping_no', 'created_at'),
        Index('idx_status_date', 'status_preparation', 'status_loading', 'created_at'),
    )

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

# Helper function to get password hash (moved from main.py for better organization)
import bcrypt

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')