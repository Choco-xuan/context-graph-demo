"""
Neo4j vector search client.
Handles semantic similarity using text embeddings and hybrid search.
"""

from typing import Optional

from neo4j import GraphDatabase
from openai import OpenAI

from .config import config


class VectorClient:
    """Neo4j vector search client for semantic similarity."""

    def __init__(self):
        self.driver = GraphDatabase.driver(
            config.neo4j.uri,
            auth=(config.neo4j.username, config.neo4j.password),
        )
        self.database = config.neo4j.database
        self.openai_client = (
            OpenAI(api_key=config.openai.api_key) if config.openai.api_key else None
        )
        self.embedding_model = config.openai.embedding_model
        self.embedding_dimensions = config.openai.embedding_dimensions

    def close(self):
        self.driver.close()

    # ============================================
    # EMBEDDING GENERATION
    # ============================================

    def generate_embedding(self, text: str) -> list[float]:
        """Generate an embedding for the given text using OpenAI."""
        if not self.openai_client:
            raise ValueError("OpenAI API key not configured")

        response = self.openai_client.embeddings.create(
            model=self.embedding_model,
            input=text,
        )
        return response.data[0].embedding

    def generate_embeddings_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for multiple texts."""
        if not self.openai_client:
            raise ValueError("OpenAI API key not configured")

        response = self.openai_client.embeddings.create(
            model=self.embedding_model,
            input=texts,
        )
        return [item.embedding for item in response.data]

    # ============================================
    # SEMANTIC SEARCH
    # ============================================

    def search_decisions_semantic(
        self,
        query: str,
        limit: int = 10,
        category: Optional[str] = None,
    ) -> list[dict]:
        """Search decisions by semantic similarity to query."""
        query_embedding = self.generate_embedding(query)

        category_filter = "WHERE d.category = $category" if category else ""

        with self.driver.session(database=self.database) as session:
            result = session.run(
                f"""
                MATCH (d:Decision)
                {category_filter}
                CALL db.index.vector.queryNodes(
                    'decision_reasoning_idx',
                    $limit,
                    $query_embedding
                ) YIELD node, score
                WHERE node = d
                RETURN d.id AS id,
                       d.decision_type AS decision_type,
                       d.category AS category,
                       d.reasoning_summary AS reasoning_summary,
                       d.decision_timestamp AS decision_timestamp,
                       d.confidence_score AS confidence_score,
                       score AS semantic_similarity
                ORDER BY score DESC
                """,
                {
                    "query_embedding": query_embedding,
                    "limit": limit,
                    "category": category,
                },
            )
            return [dict(record) for record in result]

    def search_policies_semantic(
        self,
        query: str,
        limit: int = 5,
    ) -> list[dict]:
        """Search policies by semantic similarity."""
        query_embedding = self.generate_embedding(query)

        with self.driver.session(database=self.database) as session:
            result = session.run(
                """
                CALL db.index.vector.queryNodes(
                    'policy_description_idx',
                    $limit,
                    $query_embedding
                ) YIELD node, score
                RETURN node.id AS id,
                       node.name AS name,
                       node.description AS description,
                       node.category AS category,
                       score AS semantic_similarity
                ORDER BY score DESC
                """,
                {"query_embedding": query_embedding, "limit": limit},
            )
            return [dict(record) for record in result]

    # ============================================
    # HYBRID SEARCH (Semantic + Structural)
    # ============================================

    def find_precedents_hybrid(
        self,
        scenario: str,
        category: Optional[str] = None,
        semantic_weight: float = 0.6,
        structural_weight: float = 0.4,
        limit: int = 5,
    ) -> list[dict]:
        """
        Find precedent decisions using semantic similarity.

        Uses text embeddings (reasoning_embedding) to find decisions with
        similar reasoning to the given scenario.
        """
        query_embedding = self.generate_embedding(scenario)

        category_filter = "AND d.category = $category" if category else ""

        with self.driver.session(database=self.database) as session:
            result = session.run(
                f"""
                CALL db.index.vector.queryNodes(
                    'decision_reasoning_idx',
                    $limit,
                    $query_embedding
                ) YIELD node AS d, score AS semantic_score
                WHERE d:Decision {category_filter}
                RETURN d.id AS id,
                       d.decision_type AS decision_type,
                       d.category AS category,
                       d.reasoning_summary AS reasoning_summary,
                       d.decision_timestamp AS decision_timestamp,
                       semantic_score AS combined_score,
                       semantic_score AS semantic_similarity,
                       null AS structural_similarity
                ORDER BY semantic_score DESC
                LIMIT $limit
                """,
                {
                    "query_embedding": query_embedding,
                    "category": category,
                    "limit": limit,
                },
            )
            return [dict(record) for record in result]

    def find_similar_decisions_hybrid(
        self,
        decision_id: str,
        semantic_weight: float = 0.5,
        structural_weight: float = 0.5,
        limit: int = 5,
    ) -> list[dict]:
        """
        Find decisions similar to a given decision using hybrid similarity.
        """
        with self.driver.session(database=self.database) as session:
            result = session.run(
                """
                // Get the source decision
                MATCH (source:Decision {id: $decision_id})

                // Find semantically similar
                CALL db.index.vector.queryNodes(
                    'decision_reasoning_idx',
                    $limit * 2,
                    source.reasoning_embedding
                ) YIELD node AS semantic_match, score AS semantic_score
                WHERE semantic_match <> source

                // Find structurally similar
                WITH source, semantic_match, semantic_score
                CALL db.index.vector.queryNodes(
                    'decision_fastrp_idx',
                    $limit * 2,
                    source.fastrp_embedding
                ) YIELD node AS structural_match, score AS structural_score
                WHERE structural_match <> source

                // Find overlap and combine
                WITH source,
                     CASE WHEN semantic_match = structural_match
                          THEN semantic_match
                          ELSE null END AS both_match,
                     semantic_match,
                     semantic_score,
                     structural_match,
                     structural_score

                // Collect all matches with their scores
                WITH collect({
                    decision: semantic_match,
                    semantic: semantic_score,
                    structural: 0.0
                }) + collect({
                    decision: structural_match,
                    semantic: 0.0,
                    structural: structural_score
                }) AS all_matches

                UNWIND all_matches AS match
                WITH match.decision AS decision,
                     sum(match.semantic) AS total_semantic,
                     sum(match.structural) AS total_structural
                WHERE decision IS NOT NULL

                WITH decision,
                     total_semantic AS semantic_score,
                     total_structural AS structural_score,
                     (total_semantic * $semantic_weight + total_structural * $structural_weight) AS combined_score

                RETURN decision.id AS id,
                       decision.decision_type AS decision_type,
                       decision.category AS category,
                       decision.reasoning_summary AS reasoning_summary,
                       decision.decision_timestamp AS decision_timestamp,
                       combined_score,
                       semantic_score AS semantic_similarity,
                       structural_score AS structural_similarity
                ORDER BY combined_score DESC
                LIMIT $limit
                """,
                {
                    "decision_id": decision_id,
                    "semantic_weight": semantic_weight,
                    "structural_weight": structural_weight,
                    "limit": limit,
                },
            )
            return [dict(record) for record in result]

    # ============================================
    # EMBEDDING STORAGE
    # ============================================

    def update_decision_reasoning_embedding(
        self,
        decision_id: str,
        reasoning: str,
    ) -> bool:
        """Generate and store reasoning embedding for a decision."""
        embedding = self.generate_embedding(reasoning)

        with self.driver.session(database=self.database) as session:
            result = session.run(
                """
                MATCH (d:Decision {id: $decision_id})
                SET d.reasoning_embedding = $embedding
                RETURN d.id AS id
                """,
                {"decision_id": decision_id, "embedding": embedding},
            )
            return result.single() is not None

    def update_policy_description_embedding(
        self,
        policy_id: str,
        description: str,
    ) -> bool:
        """Generate and store description embedding for a policy."""
        embedding = self.generate_embedding(description)

        with self.driver.session(database=self.database) as session:
            result = session.run(
                """
                MATCH (p:Policy {id: $policy_id})
                SET p.description_embedding = $embedding
                RETURN p.id AS id
                """,
                {"policy_id": policy_id, "embedding": embedding},
            )
            return result.single() is not None

    def batch_update_decision_embeddings(
        self,
        limit: int = 100,
    ) -> int:
        """Generate embeddings for decisions that don't have them."""
        with self.driver.session(database=self.database) as session:
            # Get decisions without embeddings
            result = session.run(
                """
                MATCH (d:Decision)
                WHERE d.reasoning_embedding IS NULL AND d.reasoning IS NOT NULL
                RETURN d.id AS id, d.reasoning AS reasoning
                LIMIT $limit
                """,
                {"limit": limit},
            )
            decisions = [dict(record) for record in result]

            if not decisions:
                return 0

            # Generate embeddings in batch
            texts = [d["reasoning"] for d in decisions]
            embeddings = self.generate_embeddings_batch(texts)

            # Update each decision
            for decision, embedding in zip(decisions, embeddings):
                session.run(
                    """
                    MATCH (d:Decision {id: $decision_id})
                    SET d.reasoning_embedding = $embedding
                    """,
                    {"decision_id": decision["id"], "embedding": embedding},
                )

            return len(decisions)


# Singleton instance
vector_client = VectorClient()
