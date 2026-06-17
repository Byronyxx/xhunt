from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

    supabase_url: str
    supabase_service_role_key: str

    jwt_secret: str
    jwt_algorithm: str = 'HS256'
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    redis_url: str = 'redis://localhost:6379/0'

    allowed_origins: str = 'http://localhost:3000,https://xhunt.app'

    app_env: str = 'development'

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(',')]


settings = Settings()  # type: ignore[call-arg]
