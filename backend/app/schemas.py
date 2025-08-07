from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum

class StatusEnum(str, Enum):
    ON_PROCESS = "On Process"
    DELAY = "Delay"
    FINISHED = "Finished"

class TruckBase(BaseModel):
    terminal: str
    shipping_no: str  # Changed from truck_no
    dock_code: str
    truck_route: str
    preparation_start: Optional[str] = None
    preparation_end: Optional[str] = None
    loading_start: Optional[str] = None
    loading_end: Optional[str] = None
    status_preparation: str = "On Process"
    status_loading: str = "On Process"

class TruckCreate(TruckBase):
    pass

class TruckUpdate(BaseModel):
    terminal: Optional[str] = None
    shipping_no: Optional[str] = None  # Changed from truck_no
    dock_code: Optional[str] = None
    truck_route: Optional[str] = None
    preparation_start: Optional[str] = None
    preparation_end: Optional[str] = None
    loading_start: Optional[str] = None
    loading_end: Optional[str] = None
    status_preparation: Optional[str] = None
    status_loading: Optional[str] = None

class Truck(TruckBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str

class UserResponse(BaseModel):
    id: str
    username: str
    role: str
    
    class Config:
        from_attributes = True