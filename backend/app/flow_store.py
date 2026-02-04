"""
Flow 存储：创建流程（图谱 + 提示词 + tools + 模型）的 CRUD 与发布.
当前使用内存存储，重启后丢失；后续可改为 DB 或 JSON 文件.
"""

import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from .models import FlowCreate, FlowResponse


def _make_slug(name: str) -> str:
    """从名称生成 URL 友好 slug."""
    s = re.sub(r"[^\w\s-]", "", name).strip().lower()
    return re.sub(r"[-\s]+", "-", s) or str(uuid.uuid4())[:8]


class FlowStore:
    def __init__(self) -> None:
        self._flows: dict[str, dict] = {}

    def create(self, body: FlowCreate) -> FlowResponse:
        fid = str(uuid.uuid4())
        slug = _make_slug(body.name)
        now = datetime.now(timezone.utc).isoformat()
        record = {
            "id": fid,
            "name": body.name,
            "graph_source_id": body.graph_source_id,
            "system_prompt": body.system_prompt,
            "enabled_tools": list(body.enabled_tools),
            "model_id": body.model_id,
            "published": False,
            "slug": slug,
            "created_at": now,
            "updated_at": now,
        }
        self._flows[fid] = record
        return FlowResponse(**record)

    def get(self, flow_id: str) -> Optional[FlowResponse]:
        r = self._flows.get(flow_id)
        return FlowResponse(**r) if r else None

    def get_by_slug(self, slug: str) -> Optional[FlowResponse]:
        for r in self._flows.values():
            if r.get("slug") == slug:
                return FlowResponse(**r)
        return None

    def list_all(self, published_only: bool = False) -> list[FlowResponse]:
        items = list(self._flows.values())
        if published_only:
            items = [x for x in items if x.get("published")]
        return [FlowResponse(**x) for x in sorted(items, key=lambda x: x.get("updated_at") or "", reverse=True)]

    def update(self, flow_id: str, body: FlowCreate) -> Optional[FlowResponse]:
        if flow_id not in self._flows:
            return None
        r = self._flows[flow_id]
        now = datetime.now(timezone.utc).isoformat()
        r["name"] = body.name
        r["graph_source_id"] = body.graph_source_id
        r["system_prompt"] = body.system_prompt
        r["enabled_tools"] = list(body.enabled_tools)
        r["model_id"] = body.model_id
        r["slug"] = _make_slug(body.name)
        r["updated_at"] = now
        return FlowResponse(**r)

    def publish(self, flow_id: str) -> Optional[FlowResponse]:
        if flow_id not in self._flows:
            return None
        r = self._flows[flow_id]
        r["published"] = True
        r["updated_at"] = datetime.now(timezone.utc).isoformat()
        return FlowResponse(**r)

    def unpublish(self, flow_id: str) -> Optional[FlowResponse]:
        if flow_id not in self._flows:
            return None
        self._flows[flow_id]["published"] = False
        self._flows[flow_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
        return FlowResponse(**self._flows[flow_id])

    def delete(self, flow_id: str) -> bool:
        if flow_id in self._flows:
            del self._flows[flow_id]
            return True
        return False


flow_store = FlowStore()
