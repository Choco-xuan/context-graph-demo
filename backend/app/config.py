"""
Configuration management for the Context Graph application.
"""

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass
class Neo4jConfig:
    """Neo4j connection configuration."""

    uri: str
    username: str
    password: str
    database: str = "neo4j"
    # 连接池：缩短连接生命周期，避免 Windows 下“已中止连接”(10053) 使用失效连接
    max_connection_lifetime: int = 1800  # 30 分钟回收
    connection_timeout: float = 30.0  # 秒

    @classmethod
    def from_env(cls) -> "Neo4jConfig":
        return cls(
            uri=os.getenv("NEO4J_URI", "bolt://localhost:7687"),
            username=os.getenv("NEO4J_USERNAME", "neo4j"),
            password=os.getenv("NEO4J_PASSWORD", "password"),
            database=os.getenv("NEO4J_DATABASE", "neo4j"),
            max_connection_lifetime=int(
                os.getenv("NEO4J_MAX_CONNECTION_LIFETIME", "1800")
            ),
            connection_timeout=float(
                os.getenv("NEO4J_CONNECTION_TIMEOUT", "30")
            ),
        )


@dataclass
class OpenAIConfig:
    """OpenAI-compatible configuration for text embeddings (OpenAI, 硅基流动, New API, LiteLLM, etc.)."""

    api_key: str
    base_url: str | None = None  # Optional custom base URL (e.g. https://api.siliconflow.cn/v1)
    embedding_model: str = "Qwen/Qwen3-Embedding-8B"  # 硅基流动
    embedding_dimensions: int = 4096  # Qwen3-Embedding-8B 输出维度

    @classmethod
    def from_env(cls) -> "OpenAIConfig":
        return cls(
            api_key=os.getenv("OPENAI_API_KEY", ""),
            base_url=os.getenv("OPENAI_API_BASE") or None,
            embedding_model=os.getenv("OPENAI_EMBEDDING_MODEL", "Qwen/Qwen3-Embedding-8B"),
            embedding_dimensions=int(os.getenv("OPENAI_EMBEDDING_DIMENSIONS", "4096")),
        )


@dataclass
class AnthropicConfig:
    """Anthropic configuration for Claude Agent SDK."""

    api_key: str
    base_url: str | None = None  # Optional custom base URL for proxy (LiteLLM/New API)

    @classmethod
    def from_env(cls) -> "AnthropicConfig":
        return cls(
            api_key=os.getenv("ANTHROPIC_API_KEY", ""),
            base_url=os.getenv("ANTHROPIC_BASE_URL") or None,
        )


@dataclass
class AppConfig:
    """Main application configuration."""

    neo4j: Neo4jConfig
    openai: OpenAIConfig
    anthropic: AnthropicConfig

    # FastRP embedding dimensions (structural)
    fastrp_dimensions: int = 128

    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    # CORS 允许的源，用于 iframe 嵌入等场景
    cors_origins: list[str] = ()

    @classmethod
    def from_env(cls) -> "AppConfig":
        cors_str = os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,"
            "http://127.0.0.1:3001,http://10.17.97.249:3001,https://context-graph-demo.vercel.app",
        )
        cors_origins = [o.strip() for o in cors_str.split(",") if o.strip()]
        return cls(
            neo4j=Neo4jConfig.from_env(),
            openai=OpenAIConfig.from_env(),
            anthropic=AnthropicConfig.from_env(),
            fastrp_dimensions=int(os.getenv("FASTRP_DIMENSIONS", "128")),
            host=os.getenv("HOST", "0.0.0.0"),
            port=int(os.getenv("PORT", "8000")),
            debug=os.getenv("DEBUG", "false").lower() == "true",
            cors_origins=cors_origins,
        )


# Global config instance
config = AppConfig.from_env()
