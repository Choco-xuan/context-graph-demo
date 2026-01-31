"""
Schema service for graph database.
Caches schema at startup and provides summaries for AI system prompts.
"""

from datetime import datetime
from typing import Any

from .context_graph_client import context_graph_client


class SchemaService:
    """Caches graph schema and generates summaries for AI prompts."""

    _cache: dict[str, Any] | None = None
    _cache_time: datetime | None = None

    @classmethod
    def get_schema(cls) -> dict[str, Any]:
        """Get full schema from cache or fetch from database."""
        if cls._cache is not None:
            return cls._cache
        cls.refresh()
        return cls._cache or {}

    @classmethod
    def refresh(cls) -> None:
        """Refresh schema cache from the graph database."""
        try:
            cls._cache = context_graph_client.get_schema()
            cls._cache_time = datetime.now()
        except Exception as e:
            # Keep old cache on failure
            if cls._cache is None:
                cls._cache = {}
            raise RuntimeError(f"Failed to refresh schema: {e}") from e

    @classmethod
    def get_schema_summary(cls) -> str:
        """Generate a compact schema summary suitable for System Prompt."""
        schema = cls.get_schema()
        if not schema:
            return "Schema not available. Use get_schema tool to fetch it."

        lines = []

        # Node labels with counts
        node_labels = schema.get("node_labels", [])
        node_counts = schema.get("node_counts", {})
        if node_labels:
            lines.append("## Node Labels (with counts)")
            for label in node_labels:
                count = node_counts.get(label, 0)
                lines.append(f"- {label}: {count} nodes")

        # Relationship types with counts
        rel_types = schema.get("relationship_types", [])
        rel_counts = schema.get("relationship_counts", {})
        if rel_types:
            lines.append("")
            lines.append("## Relationship Types (with counts)")
            for rt in rel_types:
                count = rel_counts.get(rt, 0)
                lines.append(f"- {rt}: {count} relationships")

        # Relationship patterns (connectivity)
        patterns = schema.get("relationship_patterns", [])
        if patterns:
            lines.append("")
            lines.append("## Relationship Patterns (from -[type]-> to)")
            for p in patterns[:50]:  # Limit to avoid huge prompts
                from_label = p.get("from_label", "?")
                rel_type = p.get("rel_type", "?")
                to_label = p.get("to_label", "?")
                count = p.get("count", 0)
                lines.append(f"- ({from_label})-[{rel_type}]->({to_label}): {count}")

        # Key property hints (for Cypher query generation)
        prop_keys = schema.get("property_keys", [])
        if prop_keys:
            lines.append("")
            lines.append("## Property Keys (available on nodes/relationships)")
            lines.append(", ".join(prop_keys[:30]) + ("..." if len(prop_keys) > 30 else ""))

        return "\n".join(lines) if lines else "Empty schema."
