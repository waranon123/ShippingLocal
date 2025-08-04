# 2. backend/app/config.py (แก้ไข - เพิ่ม error handling)
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 60
    
    class Config:
        env_file = ".env"

# Global settings instance
try:
    settings = Settings()
except Exception as e:
    print(f"⚠️  Warning: Could not load settings: {e}")
    # Create dummy settings for development
    class DummySettings:
        supabase_url = "dummy"
        supabase_key = "dummy"
        jwt_secret_key = "dummy-secret"
        jwt_algorithm = "HS256" 
        jwt_expiration_minutes = 60
    settings = DummySettings()