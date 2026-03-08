from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    app_name: str = "HADE"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # Database
    database_url: str = "postgresql+asyncpg://danielmeier@localhost:5432/hade"

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Celery
    celery_broker_url: str = "sqs://"
    celery_result_backend: str = "redis://localhost:6379/1"

    # JWT
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 60
    supabase_jwt_secret: str = ""
    supabase_auth_algorithm: str = "HS256"

    # External APIs
    google_places_api_key: str = ""
    openweathermap_api_key: str = ""
    
    # LLM & AI Keys
    # We include both to match your .env and prevent validation errors
    gemini_api_key: str = ""
    google_generative_ai_key: str = ""  
    openai_api_key: str = ""           
    
    gemini_model: str = "gemini-1.5-flash"
    gemini_timeout_ms: int = 2800

    # CORS
    cors_origins: list[str] = ["*"]

    # Rate limiting
    rate_limit_per_minute: int = 60

    @property
    def sync_database_url(self) -> str:
        """Sync DB URL for Celery workers (strips asyncpg driver)."""
        return self.database_url.replace("+asyncpg", "")

    # Updated configuration for Pydantic v2
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8",
        extra="ignore"  # This prevents the app from crashing if extra keys exist in .env
    )

settings = Settings()