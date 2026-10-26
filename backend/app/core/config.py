import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "AIdoctors Middleware SIM RS - SATUSEHAT"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = True
    
    # Konfigurasi ML Engine & Smart Triaging
    DEFAULT_AMBANG: float = 0.50
    MODEL_VERSION: str = "EfficientNet-B0 v1.2"
    WEIGHTS_PATH: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "weights", "aidoctors_effnet_epoch_3.pth")
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'aidoctors.db')}")
    
    # Interoperabilitas SATUSEHAT Kemenkes RI
    SATUSEHAT_BASE_URL: str = "https://api-satusehat-stg.dto.kemkes.go.id/fhir-r4/v1"
    SATUSEHAT_ORG_ID: str = "10000004"
    SATUSEHAT_CLIENT_ID: str = "dummy_client_id"
    SATUSEHAT_CLIENT_SECRET: str = "dummy_client_secret"
    
    # CORS
    CORS_ORIGINS: list = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "*"
    ]

    class Config:
        case_sensitive = True

settings = Settings()
