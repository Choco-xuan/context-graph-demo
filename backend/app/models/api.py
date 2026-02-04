"""
Pydantic models for API requests and responses.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class ConversationMessage(BaseModel):
    """A message in the conversation history."""

    role: str  # 'user' or 'assistant'
    content: str


class ChatRequest(BaseModel):
    """Request to send a message to the AI agent."""

    message: str
    session_id: Optional[str] = None
    conversation_history: list[ConversationMessage] = Field(default_factory=list)
    flow_id: Optional[str] = Field(default=None, description="使用已发布的 Flow 配置")
    flow_preview_config: Optional["FlowPreviewConfig"] = Field(
        default=None, description="预览模式下的配置，不落库"
    )


class ToolCall(BaseModel):
    """Record of a tool call made by the agent."""

    name: str
    input: dict[str, Any] = Field(default_factory=dict)
    output: Optional[Any] = None


class ChatResponse(BaseModel):
    """Response from the AI agent."""

    response: str
    session_id: str
    tool_calls: list[ToolCall] = Field(default_factory=list)
    decisions_made: list[str] = Field(default_factory=list)  # Decision IDs


class DecisionRequest(BaseModel):
    """Request to record a new decision."""

    decision_type: str
    category: str
    reasoning: str
    customer_id: Optional[str] = None
    account_id: Optional[str] = None
    transaction_id: Optional[str] = None
    risk_factors: list[str] = Field(default_factory=list)
    precedent_ids: list[str] = Field(default_factory=list)
    confidence_score: float = Field(default=0.8, ge=0.0, le=1.0)


class GraphNode(BaseModel):
    """A node in the graph for visualization."""

    id: str
    labels: list[str]
    properties: dict[str, Any]


class GraphRelationship(BaseModel):
    """A relationship in the graph for visualization."""

    id: str
    type: str
    start_node_id: str = Field(alias="startNodeId", serialization_alias="startNodeId")
    end_node_id: str = Field(alias="endNodeId", serialization_alias="endNodeId")
    properties: dict[str, Any] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}


class GraphData(BaseModel):
    """Graph data for NVL visualization."""

    nodes: list[GraphNode]
    relationships: list[GraphRelationship]

    model_config = {"by_alias": True}


class CustomerSearchResult(BaseModel):
    """Result from customer search."""

    id: str
    name: str
    email: Optional[str] = None
    risk_score: float
    account_count: int = 0
    decision_count: int = 0


class FraudPattern(BaseModel):
    """Detected fraud pattern."""

    account_id: str
    account_number: str
    similarity_to_fraud: float
    risk_indicators: list[str] = Field(default_factory=list)
    similar_fraud_cases: list[str] = Field(default_factory=list)


class EntityMatch(BaseModel):
    """Potential duplicate entity match."""

    entity1_id: str
    entity1_name: str
    entity2_id: str
    entity2_name: str
    similarity_score: float
    match_reasons: list[str] = Field(default_factory=list)


class CommunityInfo(BaseModel):
    """Information about a decision community."""

    community_id: int
    decision_count: int
    decision_types: list[str]
    categories: list[str]
    top_decisions: list[str] = Field(default_factory=list)


# ============== Flow / Agent 创建流程 ==============


class FlowCreate(BaseModel):
    """创建或更新 Flow 的请求体：图谱 + 提示词 + tools + 模型."""

    name: str = Field(..., min_length=1, max_length=200, description="流程名称")
    graph_source_id: str = Field(
        default="default",
        description="图谱数据源 ID，如 default 表示当前 Neo4j 数据库",
    )
    system_prompt: Optional[str] = Field(
        default=None,
        description="自定义系统提示词，空则使用基于 schema 的默认提示",
    )
    enabled_tools: list[str] = Field(
        default_factory=lambda: [
            "get_schema",
            "explore_nodes",
            "search_nodes",
            "find_paths",
            "analyze_patterns",
            "execute_cypher",
        ],
        description="启用的 MCP 工具名列表",
    )
    model_id: str = Field(
        default="claude-sonnet-4-20250514",
        description="模型 ID，如 claude-sonnet-4-20250514、deepseek-chat",
    )


class FlowResponse(BaseModel):
    """Flow 的 API 响应."""

    id: str
    name: str
    graph_source_id: str
    system_prompt: Optional[str] = None
    enabled_tools: list[str]
    model_id: str
    published: bool = False
    slug: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class FlowPreviewConfig(BaseModel):
    """聊天请求中用于「预览」的配置，不落库."""

    graph_source_id: Optional[str] = None
    system_prompt: Optional[str] = None
    enabled_tools: Optional[list[str]] = None
    model_id: Optional[str] = None
