"""
Flow 存储：创建流程（图谱 + 提示词 + tools + 模型）的 CRUD 与发布.
使用 MySQL 数据库持久化存储.
"""

import json
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

import pymysql
from pymysql import Error

from .config import config
from .models import FlowCreate, FlowResponse


def _make_slug(name: str) -> str:
    """从名称生成 URL 友好 slug."""
    s = re.sub(r"[^\w\s-]", "", name).strip().lower()
    return re.sub(r"[-\s]+", "-", s) or str(uuid.uuid4())[:8]


def _get_connection():
    """获取 MySQL 数据库连接."""
    return pymysql.connect(
        host=config.mysql.host,
        port=config.mysql.port,
        user=config.mysql.user,
        password=config.mysql.password,
        database=config.mysql.database,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )


def _ensure_table_exists():
    """确保 flows 表存在，不存在则创建."""
    try:
        conn = _get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS flows (
                        id VARCHAR(36) PRIMARY KEY,
                        name VARCHAR(200) NOT NULL,
                        graph_source_id VARCHAR(100) NOT NULL DEFAULT 'default',
                        system_prompt TEXT,
                        enabled_tools JSON NOT NULL,
                        model_id VARCHAR(100) NOT NULL DEFAULT 'claude-sonnet-4-20250514',
                        published BOOLEAN NOT NULL DEFAULT FALSE,
                        slug VARCHAR(200),
                        created_at DATETIME NOT NULL,
                        updated_at DATETIME NOT NULL,
                        INDEX idx_published (published),
                        INDEX idx_slug (slug),
                        INDEX idx_updated_at (updated_at)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """)
            conn.commit()
        finally:
            conn.close()
    except Error as e:
        print(f"Error creating flows table: {e}")


class FlowStore:
    def __init__(self) -> None:
        """初始化 FlowStore，确保表存在."""
        _ensure_table_exists()

    def create(self, body: FlowCreate) -> FlowResponse:
        """创建新 Flow."""
        fid = str(uuid.uuid4())
        slug = _make_slug(body.name)
        now = datetime.now(timezone.utc)

        conn = _get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO flows (
                        id, name, graph_source_id, system_prompt, enabled_tools,
                        model_id, published, slug, created_at, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    fid,
                    body.name,
                    body.graph_source_id,
                    body.system_prompt,
                    json.dumps(body.enabled_tools),
                    body.model_id,
                    False,
                    slug,
                    now,
                    now,
                ))
            conn.commit()
        finally:
            conn.close()

        return FlowResponse(
            id=fid,
            name=body.name,
            graph_source_id=body.graph_source_id,
            system_prompt=body.system_prompt,
            enabled_tools=body.enabled_tools,
            model_id=body.model_id,
            published=False,
            slug=slug,
            created_at=now.isoformat(),
            updated_at=now.isoformat(),
        )

    def get(self, flow_id: str) -> Optional[FlowResponse]:
        """根据 ID 获取 Flow."""
        conn = _get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT * FROM flows WHERE id = %s", (flow_id,))
                row = cursor.fetchone()
                if not row:
                    return None
                return self._row_to_response(row)
        finally:
            conn.close()

    def get_by_slug(self, slug: str) -> Optional[FlowResponse]:
        """根据 slug 获取 Flow."""
        conn = _get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT * FROM flows WHERE slug = %s", (slug,))
                row = cursor.fetchone()
                if not row:
                    return None
                return self._row_to_response(row)
        finally:
            conn.close()

    def list_all(self, published_only: bool = False) -> list[FlowResponse]:
        """列出所有 Flow."""
        conn = _get_connection()
        try:
            with conn.cursor() as cursor:
                if published_only:
                    cursor.execute(
                        "SELECT * FROM flows WHERE published = TRUE ORDER BY updated_at DESC"
                    )
                else:
                    cursor.execute("SELECT * FROM flows ORDER BY updated_at DESC")
                rows = cursor.fetchall()
                return [self._row_to_response(row) for row in rows]
        finally:
            conn.close()

    def update(self, flow_id: str, body: FlowCreate) -> Optional[FlowResponse]:
        """更新 Flow."""
        slug = _make_slug(body.name)
        now = datetime.now(timezone.utc)

        conn = _get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    UPDATE flows SET
                        name = %s,
                        graph_source_id = %s,
                        system_prompt = %s,
                        enabled_tools = %s,
                        model_id = %s,
                        slug = %s,
                        updated_at = %s
                    WHERE id = %s
                """, (
                    body.name,
                    body.graph_source_id,
                    body.system_prompt,
                    json.dumps(body.enabled_tools),
                    body.model_id,
                    slug,
                    now,
                    flow_id,
                ))
                if cursor.rowcount == 0:
                    return None
            conn.commit()
        finally:
            conn.close()

        return self.get(flow_id)

    def publish(self, flow_id: str) -> Optional[FlowResponse]:
        """发布 Flow."""
        now = datetime.now(timezone.utc)
        conn = _get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    "UPDATE flows SET published = TRUE, updated_at = %s WHERE id = %s",
                    (now, flow_id),
                )
                if cursor.rowcount == 0:
                    return None
            conn.commit()
        finally:
            conn.close()

        return self.get(flow_id)

    def unpublish(self, flow_id: str) -> Optional[FlowResponse]:
        """取消发布 Flow."""
        now = datetime.now(timezone.utc)
        conn = _get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    "UPDATE flows SET published = FALSE, updated_at = %s WHERE id = %s",
                    (now, flow_id),
                )
                if cursor.rowcount == 0:
                    return None
            conn.commit()
        finally:
            conn.close()

        return self.get(flow_id)

    def delete(self, flow_id: str) -> bool:
        """删除 Flow."""
        conn = _get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("DELETE FROM flows WHERE id = %s", (flow_id,))
                deleted = cursor.rowcount > 0
            conn.commit()
            return deleted
        finally:
            conn.close()

    def _row_to_response(self, row: dict) -> FlowResponse:
        """将数据库行转换为 FlowResponse."""
        # MySQL JSON 字段可能返回字符串或已解析的 dict
        enabled_tools = row["enabled_tools"]
        if isinstance(enabled_tools, str):
            enabled_tools = json.loads(enabled_tools)

        # 处理 datetime 对象
        created_at = row["created_at"]
        if isinstance(created_at, datetime):
            created_at = created_at.isoformat()
        elif created_at is None:
            created_at = None

        updated_at = row["updated_at"]
        if isinstance(updated_at, datetime):
            updated_at = updated_at.isoformat()
        elif updated_at is None:
            updated_at = None

        return FlowResponse(
            id=row["id"],
            name=row["name"],
            graph_source_id=row["graph_source_id"],
            system_prompt=row["system_prompt"],
            enabled_tools=enabled_tools,
            model_id=row["model_id"],
            published=bool(row["published"]),
            slug=row["slug"],
            created_at=created_at,
            updated_at=updated_at,
        )


flow_store = FlowStore()
