from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "sqlite+aiosqlite:///./credence.db"
    OPENAI_API_KEY: str = ""

    GITHUB_TOKEN: str = ""
    FIRECRAWL_API_KEY: str = ""

    STORACHA_KEY: str = ""
    STORACHA_PROOF: str = ""
    STORACHA_SPACE_DID: str = ""

    LIT_RELAY_API_KEY: str = ""

    OPERATOR_PRIVATE_KEY: str = ""
    IDENTITY_REGISTRY_ADDRESS: str = "0x8004A818BFB912233c491871b3d84c89A494BD9e"
    REPUTATION_REGISTRY_ADDRESS: str = "0x8004B663056A597Dffe9eCcC1965A193B7388713"
    VALIDATION_REGISTRY_ADDRESS: str = ""
    AGENT_ID_EXTRACTOR: str = ""
    AGENT_ID_VERIFIER: str = ""
    AGENT_ID_SKEPTIC: str = ""
    AGENT_ID_JUDGE: str = ""
    RPC_URL: str = "https://sepolia.base.org"

    ATPROTO_HANDLE: str = "credence.bsky.social"
    ATPROTO_APP_PASSWORD: str = ""
    ATPROTO_PDS_URL: str = "https://bsky.social"

    CORS_ORIGINS: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]


settings = Settings()
