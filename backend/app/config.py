import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "FraudShield AI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Database
    DATABASE_URL: str = "sqlite:///./fraudshield.db"
    
    # Server & Environment
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    ENVIRONMENT: str = "development"
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
    
    # Live simulation
    ENABLE_LIVE_SIMULATOR: bool = True
    SIMULATION_INTERVAL_SECONDS: int = 4

    @property
    def cors_origins_list(self) -> List[str]:
        default_origins = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]
        if not self.CORS_ORIGINS:
            return default_origins
        origins = [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        # Disallow wildcards when credentials are enabled to enforce strict CORS boundaries
        filtered = [o for o in origins if o != "*"]
        return filtered if filtered else default_origins

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
