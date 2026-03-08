from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator
import logging

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    app_name: str = "HADE"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # Database
    database_url: str = Field(
        "postgresql+asyncpg://danielmeier@localhost:5432/hade",
        validation_alias="DATABASE_URL"
    )

    # Supabase & Auth
    supabase_url: str = Field("", validation_alias="SUPABASE_URL")
    supabase_anon_key: str = Field("", validation_alias="SUPABASE_ANON_KEY")
    supabase_service_role_key: str = Field("", validation_alias="SUPABASE_SERVICE_ROLE_KEY")
    jwt_secret: str = Field("", validation_alias="JWT_SECRET")
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 60
    supabase_jwt_secret: str = ""
    supabase_auth_algorithm: str = "HS256"

    # Redis (Required for Rate Limiting and Celery Results)
    redis_url: str = Field("redis://localhost:6379/0", validation_alias="REDIS_URL")

    # Celery (Restoring these fixes your AttributeError)
    celery_broker_url: str = Field("sqs://", validation_alias="CELERY_BROKER_URL")
    celery_result_backend: str = Field("redis://localhost:6379/1", validation_alias="CELERY_RESULT_BACKEND")

    # External APIs
    google_places_api_key: str = Field("", validation_alias="GOOGLE_PLACES_API_KEY")
    openweathermap_api_key: str = Field("", validation_alias="OPENWEATHERMAP_API_KEY")
    
    # LLM & AI Keys
    gemini_api_key: str = Field("", validation_alias="GEMINI_API_KEY")
    openai_api_key: str = Field("", validation_alias="OPENAI_API_KEY")
    
    gemini_model: str = "gemini-2.5-flash"
    gemini_timeout_ms: int = 2800

    # CORS & Rate Limiting
    cors_origins: list[str] = ["*"]
    rate_limit_per_minute: int = 60

    @property
    def sync_database_url(self) -> str:
        """Sync DB URL for Celery workers (strips asyncpg driver)."""
        return self.database_url.replace("+asyncpg", "")

    @field_validator("openai_api_key")
    @classmethod
    def validate_openai_key(cls, v: str) -> str:
        if v and not v.startswith("sk-"):
            logger.warning("⚠️ OPENAI_API_KEY in .env does not start with 'sk-'.")
        return v

    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Startup Audit
if not settings.openai_api_key:
    print("⚠️  Backend starting WITHOUT OpenAI support.")
if not settings.gemini_api_key:
    print("⚠️  Backend starting WITHOUT Gemini support.")