"""
Claude Agent SDK integration with Context Graph tools.
Provides MCP tools for querying and updating the context graph.
"""

import json
import os
from typing import Any

from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient, create_sdk_mcp_server, tool

from .config import config
from .context_graph_client import context_graph_client
from .schema_service import SchemaService


def slim_properties(props: dict) -> dict:
    """Remove large properties to reduce response size."""
    slim = {}
    for key, value in props.items():
        # Skip embedding vectors
        if key in ("fastrp_embedding", "reasoning_embedding", "embedding"):
            continue
        # Truncate long strings
        if isinstance(value, str) and len(value) > 200:
            slim[key] = value[:200] + "..."
        # Limit list sizes
        elif isinstance(value, list) and len(value) > 10:
            slim[key] = value[:10]
        else:
            slim[key] = value
    return slim


def graph_data_to_dict(graph_data) -> dict:
    """Convert GraphData to frontend format."""
    if not graph_data:
        return {"nodes": [], "relationships": []}
    node_ids = {n.id for n in graph_data.nodes}
    nodes = [
        {"id": n.id, "labels": n.labels, "properties": slim_properties(n.properties)}
        for n in graph_data.nodes
    ]
    relationships = [
        {
            "id": r.id,
            "type": r.type,
            "startNodeId": r.start_node_id,
            "endNodeId": r.end_node_id,
            "properties": slim_properties(r.properties),
        }
        for r in graph_data.relationships
        if r.start_node_id in node_ids and r.end_node_id in node_ids
    ]
    return {"nodes": nodes, "relationships": relationships}


def build_system_prompt() -> str:
    """Build dynamic system prompt with schema summary."""
    schema_summary = SchemaService.get_schema_summary()
    return f"""You are an AI assistant with access to a knowledge graph.

## Graph Schema
{schema_summary}

## Available Operations
- **get_schema**: Get full schema (use when you need more detail than above)
- **explore_nodes**: Explore a node and its neighbors by node_id
- **search_nodes**: Search nodes by label and/or property (label, property, value optional)
- **find_paths**: Find paths between two nodes
- **analyze_patterns**: Get overview stats, degree distribution, or sample nodes
- **execute_cypher**: Run custom Cypher for complex analysis (read-only)

## Guidelines
1. Use get_schema or the schema above to understand the data structure
2. Use explore_nodes to investigate specific entities when you have a node ID
3. Use search_nodes to find nodes by type or property
4. Use execute_cypher for complex queries - generate Cypher based on the schema
5. Always explain findings clearly to the user
6. When returning graph_data, the frontend can visualize it"""


# ============================================
# MCP TOOLS
# ============================================


@tool(
    "get_schema",
    "Get the full graph database schema: node labels, relationship types, property keys, relationship patterns. Use to understand the data structure before querying.",
    {},
)
async def get_schema(args: dict[str, Any]) -> dict[str, Any]:
    """Get the graph database schema."""
    try:
        schema = SchemaService.get_schema()
        return {"content": [{"type": "text", "text": json.dumps(schema, indent=2, default=str)}]}
    except Exception as e:
        return {
            "content": [{"type": "text", "text": f"Error getting schema: {str(e)}"}],
            "is_error": True,
        }


@tool(
    "explore_nodes",
    "Explore a node and its neighbors. Returns subgraph centered on the given node. Use node_id (UUID property or elementId).",
    {"node_id": str, "depth": int, "limit": int},
)
async def explore_nodes(args: dict[str, Any]) -> dict[str, Any]:
    """Explore nodes around a given node."""
    try:
        node_id = args["node_id"]
        depth = args.get("depth", 2)
        limit = args.get("limit", 50)
        graph_data = context_graph_client.get_graph_data(
            center_node_id=node_id, depth=depth, limit=limit
        )
        gd = graph_data_to_dict(graph_data)
        response = {
            "graph_data": gd,
            "node_count": len(gd["nodes"]),
            "relationship_count": len(gd["relationships"]),
        }
        return {"content": [{"type": "text", "text": json.dumps(response, indent=2, default=str)}]}
    except Exception as e:
        return {
            "content": [{"type": "text", "text": f"Error exploring nodes: {str(e)}"}],
            "is_error": True,
        }


@tool(
    "search_nodes",
    "Search for nodes by label and/or property. All params optional: label filters by node type, property+value filter by property (partial match). Returns matching nodes and their neighborhood as graph_data.",
    {"label": str, "property": str, "value": str, "limit": int},
)
async def search_nodes(args: dict[str, Any]) -> dict[str, Any]:
    """Search nodes by label and property."""
    try:
        label = args.get("label")
        property_key = args.get("property")
        value = args.get("value")
        limit = args.get("limit", 20)
        from .context_graph_client import convert_node_properties

        with context_graph_client.driver.session(database=context_graph_client.database) as session:
            label_clause = f":`{label}`" if label else ""
            if property_key and value:
                cypher = f"""
                MATCH (n{label_clause})
                WHERE n.`{property_key}` IS NOT NULL AND toString(n.`{property_key}`) CONTAINS $value
                WITH n LIMIT $limit
                OPTIONAL MATCH (n)-[r]-(m)
                WITH collect(DISTINCT n) + collect(DISTINCT m) AS nodes,
                     collect(DISTINCT r) AS rels
                RETURN [x IN nodes WHERE x IS NOT NULL] AS nodes,
                       [x IN rels WHERE x IS NOT NULL] AS rels
                """
            else:
                cypher = f"""
                MATCH (n{label_clause})
                WITH n LIMIT $limit
                OPTIONAL MATCH (n)-[r]-(m)
                WITH collect(DISTINCT n) + collect(DISTINCT m) AS nodes,
                     collect(DISTINCT r) AS rels
                RETURN [x IN nodes WHERE x IS NOT NULL] AS nodes,
                       [x IN rels WHERE x IS NOT NULL] AS rels
                """
            result = session.run(cypher, {"value": value if value else "", "limit": limit})
            record = result.single()
            if not record:
                return {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(
                                {"graph_data": {"nodes": [], "relationships": []}},
                                indent=2,
                            ),
                        }
                    ]
                }
            nodes = []
            seen = set()
            for node in record["nodes"] or []:
                if node and node.element_id not in seen:
                    seen.add(node.element_id)
                    nodes.append(
                        {
                            "id": str(node.element_id),
                            "labels": list(node.labels),
                            "properties": slim_properties(convert_node_properties(dict(node))),
                        }
                    )
            node_ids = {n["id"] for n in nodes}
            relationships = []
            rel_seen = set()
            for rel in record["rels"] or []:
                if rel and rel.element_id not in rel_seen:
                    rel_seen.add(rel.element_id)
                    if str(rel.start_node.element_id) in node_ids and str(rel.end_node.element_id) in node_ids:
                        relationships.append(
                            {
                                "id": str(rel.element_id),
                                "type": rel.type,
                                "startNodeId": str(rel.start_node.element_id),
                                "endNodeId": str(rel.end_node.element_id),
                                "properties": slim_properties(dict(rel)),
                            }
                        )
            gd = {"nodes": nodes, "relationships": relationships}
            response = {"graph_data": gd, "node_count": len(nodes), "relationship_count": len(relationships)}
            return {"content": [{"type": "text", "text": json.dumps(response, indent=2, default=str)}]}
    except Exception as e:
        return {
            "content": [{"type": "text", "text": f"Error searching nodes: {str(e)}"}],
            "is_error": True,
        }


@tool(
    "find_paths",
    "Find paths between two nodes. Returns paths and the subgraph of nodes/relationships along those paths.",
    {"start_id": str, "end_id": str, "max_depth": int},
)
async def find_paths(args: dict[str, Any]) -> dict[str, Any]:
    """Find paths between two nodes."""
    try:
        start_id = args["start_id"]
        end_id = args["end_id"]
        max_depth = min(args.get("max_depth", 5), 10)
        from .context_graph_client import convert_node_properties

        with context_graph_client.driver.session(database=context_graph_client.database) as session:
            result = session.run(
                """
                MATCH (a), (b)
                WHERE (a.id = $start_id OR elementId(a) = $start_id)
                  AND (b.id = $end_id OR elementId(b) = $end_id)
                MATCH path = shortestPath((a)-[*1..$max_depth]-(b))
                WITH nodes(path) AS pathNodes, relationships(path) AS pathRels
                UNWIND pathNodes AS n
                WITH collect(DISTINCT n) AS nodes, pathRels
                UNWIND pathRels AS r
                WITH nodes, collect(DISTINCT r) AS rels
                RETURN nodes, rels
                LIMIT 1
                """,
                {"start_id": start_id, "end_id": end_id, "max_depth": max_depth},
            )
            record = result.single()
            if not record or not record["nodes"]:
                return {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(
                                {"paths_found": 0, "graph_data": {"nodes": [], "relationships": []}, "message": "No path found."},
                                indent=2,
                            ),
                        }
                    ]
                }
            nodes = []
            seen = set()
            for node in record["nodes"]:
                if node and node.element_id not in seen:
                    seen.add(node.element_id)
                    nodes.append(
                        {
                            "id": str(node.element_id),
                            "labels": list(node.labels),
                            "properties": slim_properties(convert_node_properties(dict(node))),
                        }
                    )
            node_ids = {n["id"] for n in nodes}
            relationships = []
            for rel in record["rels"] or []:
                if rel and str(rel.start_node.element_id) in node_ids and str(rel.end_node.element_id) in node_ids:
                    relationships.append(
                        {
                            "id": str(rel.element_id),
                            "type": rel.type,
                            "startNodeId": str(rel.start_node.element_id),
                            "endNodeId": str(rel.end_node.element_id),
                            "properties": slim_properties(dict(rel)),
                        }
                    )
            gd = {"nodes": nodes, "relationships": relationships}
            response = {"paths_found": 1, "path_length": len(record["rels"]) if record["rels"] else 0, "graph_data": gd}
            return {"content": [{"type": "text", "text": json.dumps(response, indent=2, default=str)}]}
    except Exception as e:
        return {
            "content": [{"type": "text", "text": f"Error finding paths: {str(e)}"}],
            "is_error": True,
        }


@tool(
    "analyze_patterns",
    "Analyze graph patterns. pattern_type: 'overview' (node/rel counts), 'degree' (degree distribution), 'sample' (sample nodes per label).",
    {"pattern_type": str},
)
async def analyze_patterns(args: dict[str, Any]) -> dict[str, Any]:
    """Analyze graph patterns."""
    try:
        pattern_type = args.get("pattern_type", "overview")
        with context_graph_client.driver.session(database=context_graph_client.database) as session:
            if pattern_type == "overview":
                result = session.run("""
                    MATCH (n) WITH labels(n) AS lbls UNWIND lbls AS l WITH l, count(*) AS c
                    RETURN collect({label: l, count: c}) AS node_counts
                """)
                nc = result.single()["node_counts"]
                result = session.run("""
                    MATCH ()-[r]->() WITH type(r) AS t, count(*) AS c
                    RETURN collect({type: t, count: c}) AS rel_counts
                """)
                rc = result.single()["rel_counts"]
                return {"content": [{"type": "text", "text": json.dumps({"node_counts": nc, "relationship_counts": rc}, indent=2, default=str)}]}
            elif pattern_type == "degree":
                result = session.run("""
                    MATCH (n) WITH n, size((n)--()) AS degree
                    WITH degree, count(n) AS count
                    RETURN collect({degree: degree, count: count}) AS distribution
                """)
                dist = result.single()
                return {"content": [{"type": "text", "text": json.dumps(dist, indent=2, default=str)}]}
            elif pattern_type == "sample":
                schema = SchemaService.get_schema()
                labels = schema.get("node_labels", [])
                samples = []
                for label in labels[:10]:
                    r = session.run(f"MATCH (n:`{label}`) RETURN n LIMIT 3")
                    for rec in r:
                        node = rec["n"]
                        samples.append({"label": label, "id": str(node.element_id), "properties": slim_properties(dict(node))})
                return {"content": [{"type": "text", "text": json.dumps({"samples_by_label": samples}, indent=2, default=str)}]}
            else:
                return {
                    "content": [{"type": "text", "text": json.dumps({"error": f"Unknown pattern_type: {pattern_type}. Use 'overview', 'degree', or 'sample'."})}],
                    "is_error": True,
                }
    except Exception as e:
        return {
            "content": [{"type": "text", "text": f"Error analyzing patterns: {str(e)}"}],
            "is_error": True,
        }


@tool(
    "execute_cypher",
    "Execute a read-only Cypher query. Use for complex analysis. Only MATCH/RETURN allowed. Parameters optional.",
    {"cypher": str, "parameters": dict},
)
async def execute_cypher(args: dict[str, Any]) -> dict[str, Any]:
    """Execute a read-only Cypher query."""
    try:
        raw_params = args.get("parameters")
        params = {}
        if isinstance(raw_params, dict):
            params = raw_params
        elif raw_params and isinstance(raw_params, list):
            try:
                params = dict(raw_params)
            except (ValueError, TypeError):
                params = {}
        results = context_graph_client.execute_cypher(cypher=args["cypher"], parameters=params)
        return {"content": [{"type": "text", "text": json.dumps(results, indent=2, default=str)}]}
    except ValueError as e:
        return {
            "content": [{"type": "text", "text": f"Query not allowed: {str(e)}"}],
            "is_error": True,
        }
    except Exception as e:
        return {
            "content": [{"type": "text", "text": f"Error executing query: {str(e)}"}],
            "is_error": True,
        }


# ============================================
# MCP SERVER CREATION
# ============================================


def create_context_graph_server():
    """Create the MCP server with all context graph tools."""
    return create_sdk_mcp_server(
        name="context-graph",
        version="1.0.0",
        tools=[
            get_schema,
            explore_nodes,
            search_nodes,
            find_paths,
            analyze_patterns,
            execute_cypher,
        ],
    )


# Flow 覆盖：将短工具名转为 MCP 全名
TOOL_TO_MCP = {
    "get_schema": "mcp__graph__get_schema",
    "explore_nodes": "mcp__graph__explore_nodes",
    "search_nodes": "mcp__graph__search_nodes",
    "find_paths": "mcp__graph__find_paths",
    "analyze_patterns": "mcp__graph__analyze_patterns",
    "execute_cypher": "mcp__graph__execute_cypher",
}


def _allowed_tools_from_enabled(enabled: list[str] | None) -> list[str]:
    """从启用的短工具名列表得到 MCP allowed_tools；None 表示全部启用."""
    if not enabled:
        return list(TOOL_TO_MCP.values())
    return [TOOL_TO_MCP[t] for t in enabled if t in TOOL_TO_MCP]


def get_agent_options(
    *,
    system_prompt_override: str | None = None,
    enabled_tools_override: list[str] | None = None,
    model_override: str | None = None,
) -> ClaudeAgentOptions:
    """Get the agent options, optionally overridden by Flow 配置."""
    context_graph_server = create_context_graph_server()

    if config.anthropic.base_url:
        os.environ["ANTHROPIC_BASE_URL"] = config.anthropic.base_url
        if config.anthropic.api_key:
            os.environ["ANTHROPIC_API_KEY"] = config.anthropic.api_key

    system_prompt = (
        system_prompt_override
        if system_prompt_override is not None and system_prompt_override.strip() != ""
        else build_system_prompt()
    )
    allowed_tools = _allowed_tools_from_enabled(enabled_tools_override)

    opts = ClaudeAgentOptions(
        system_prompt=system_prompt,
        mcp_servers={"graph": context_graph_server},
        allowed_tools=allowed_tools,
    )
    if model_override:
        opts.model = model_override
    return opts


# ============================================
# AGENT CONTEXT
# ============================================

AVAILABLE_TOOLS = [
    "get_schema",
    "explore_nodes",
    "search_nodes",
    "find_paths",
    "analyze_patterns",
    "execute_cypher",
]


def get_agent_context(
    system_prompt_override: str | None = None,
    enabled_tools_override: list[str] | None = None,
    model_override: str | None = None,
) -> dict[str, Any]:
    """Get agent context information for transparency/debugging."""
    prompt = (
        system_prompt_override.strip()
        if system_prompt_override and system_prompt_override.strip()
        else build_system_prompt()
    )
    tools = enabled_tools_override if enabled_tools_override else AVAILABLE_TOOLS
    return {
        "system_prompt": prompt,
        "model": model_override or "claude-sonnet-4-20250514",
        "available_tools": tools,
        "mcp_server": "context-graph",
    }


# ============================================
# AGENT SESSION MANAGEMENT
# ============================================


class ContextGraphAgent:
    """Wrapper for managing Claude Agent SDK sessions."""

    def __init__(
        self,
        *,
        system_prompt_override: str | None = None,
        enabled_tools_override: list[str] | None = None,
        model_override: str | None = None,
    ):
        self._system_prompt_override = system_prompt_override
        self._enabled_tools_override = enabled_tools_override
        self._model_override = model_override
        self.options = get_agent_options(
            system_prompt_override=system_prompt_override,
            enabled_tools_override=enabled_tools_override,
            model_override=model_override,
        )
        self.client: ClaudeSDKClient | None = None

    async def __aenter__(self):
        self.client = ClaudeSDKClient(options=self.options)
        await self.client.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.client:
            await self.client.disconnect()

    async def query(
        self, message: str, conversation_history: list[dict[str, str]] | None = None
    ) -> dict[str, Any]:
        """Send a query to the agent and get the response."""
        if not self.client:
            raise RuntimeError("Agent not connected. Use 'async with' context manager.")

        # Build message with conversation context
        if conversation_history and len(conversation_history) > 0:
            # Format history as context in the message
            history_text = "\n".join(
                [
                    f"{msg['role'].upper()}: {msg['content']}" for msg in conversation_history[-6:]
                ]  # Last 6 messages
            )
            full_message = f"""Previous conversation:
{history_text}

Current message from USER: {message}

Please respond to the current message, taking the conversation history into account."""
        else:
            full_message = message

        # Send the message
        await self.client.query(full_message)

        response_text = ""
        tool_calls = []
        decisions_made = []

        async for msg in self.client.receive_response():
            # Process different message types
            if hasattr(msg, "content"):
                for block in msg.content:
                    if hasattr(block, "text"):
                        response_text += block.text
                    elif hasattr(block, "name"):
                        # Tool use block
                        tool_calls.append(
                            {
                                "name": block.name,
                                "input": block.input if hasattr(block, "input") else {},
                            }
                        )
        return {
            "response": response_text,
            "tool_calls": tool_calls,
            "decisions_made": decisions_made,
        }

    async def query_stream(
        self, message: str, conversation_history: list[dict[str, str]] | None = None
    ):
        """Send a query to the agent and stream the response."""
        if not self.client:
            raise RuntimeError("Agent not connected. Use 'async with' context manager.")

        # Build message with conversation context
        if conversation_history and len(conversation_history) > 0:
            history_text = "\n".join(
                [f"{msg['role'].upper()}: {msg['content']}" for msg in conversation_history[-6:]]
            )
            full_message = f"""Previous conversation:
{history_text}

Current message from USER: {message}

Please respond to the current message, taking the conversation history into account."""
        else:
            full_message = message

        # Emit agent context first (with same overrides as this session)
        yield {
            "type": "agent_context",
            "context": get_agent_context(
                system_prompt_override=self._system_prompt_override,
                enabled_tools_override=self._enabled_tools_override,
                model_override=self._model_override,
            ),
        }

        # Send the message
        await self.client.query(full_message)

        tool_calls = []
        tool_id_to_name = {}  # Map tool_use_id to tool name
        decisions_made = []

        async for msg in self.client.receive_response():
            msg_type = type(msg).__name__

            # Handle UserMessage containing ToolResultBlock objects
            if msg_type == "UserMessage" and hasattr(msg, "content"):
                for block in msg.content:
                    block_type = type(block).__name__
                    # ToolResultBlock has tool_use_id and content attributes
                    if block_type == "ToolResultBlock":
                        tool_use_id = getattr(block, "tool_use_id", None)
                        block_content = getattr(block, "content", None)

                        print(f"[DEBUG] ToolResultBlock - tool_use_id: {tool_use_id}")

                        if tool_use_id:
                            parsed_output = None

                            # Parse the block content (list of content items)
                            if isinstance(block_content, list):
                                for item in block_content:
                                    if isinstance(item, dict) and item.get("type") == "text":
                                        try:
                                            parsed_output = json.loads(item.get("text", "{}"))
                                        except json.JSONDecodeError:
                                            parsed_output = item.get("text")
                                        break
                                    elif hasattr(item, "text"):
                                        try:
                                            parsed_output = json.loads(item.text)
                                        except json.JSONDecodeError:
                                            parsed_output = item.text
                                        break
                            elif isinstance(block_content, str):
                                try:
                                    parsed_output = json.loads(block_content)
                                except json.JSONDecodeError:
                                    parsed_output = block_content

                            # Look up the tool name from the tool_use_id
                            tool_name = tool_id_to_name.get(tool_use_id, "unknown")
                            print(
                                f"[DEBUG] Yielding tool_result: name={tool_name}, output_type={type(parsed_output)}"
                            )

                            yield {
                                "type": "tool_result",
                                "name": tool_name,
                                "output": parsed_output,
                            }
                continue

            # Handle AssistantMessage content blocks
            if hasattr(msg, "content"):
                for block in msg.content:
                    if hasattr(block, "text"):
                        # Stream text content
                        yield {"type": "text", "content": block.text}
                    elif hasattr(block, "name"):
                        # Tool use block
                        tool_id = getattr(block, "id", None)
                        tool_call = {
                            "name": block.name,
                            "input": block.input if hasattr(block, "input") else {},
                        }
                        tool_calls.append(tool_call)

                        # Track tool_use_id to name mapping
                        if tool_id:
                            tool_id_to_name[tool_id] = block.name

                        yield {"type": "tool_use", **tool_call}

        # Final event with summary
        yield {
            "type": "done",
            "tool_calls": tool_calls,
            "decisions_made": decisions_made,
        }
