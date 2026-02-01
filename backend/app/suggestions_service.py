"""
Generate AI-recommended questions based on graph schema.
"""

import asyncio
import json
import logging
import re
from typing import List

import httpx

from .config import config
from .schema_service import SchemaService

logger = logging.getLogger(__name__)

DEFAULT_QUESTIONS = [
    "当前图谱中有哪些核心节点？",
    "图中各类型节点和关系的分布如何？",
    "图中最大深度的节点有哪些？",
]


def _extract_text_from_response(data: dict) -> str:
    """Extract text from Anthropic-style or OpenAI-style response."""
    # Anthropic format: content = [{"type": "text", "text": "..."}]
    content = data.get("content", [])
    if isinstance(content, list):
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                t = block.get("text", "")
                if t:
                    return t
    # OpenAI/DeepSeek format: choices[0].message.content
    choices = data.get("choices", [])
    if choices and isinstance(choices[0], dict):
        msg = choices[0].get("message", {})
        if isinstance(msg, dict):
            c = msg.get("content", "")
            if c:
                return c
    return ""


def _parse_questions_from_text(text: str) -> List[str] | None:
    """Parse JSON array of questions from model output."""
    if not text or not text.strip():
        return None
    # Try direct JSON parse first
    try:
        parsed = json.loads(text.strip())
        if isinstance(parsed, list) and len(parsed) >= 1:
            return [str(q)[:80] for q in parsed[:3]]
    except json.JSONDecodeError:
        pass
    # Try extract from markdown code block
    code_match = re.search(r"```(?:json)?\s*(\[[\s\S]*?\])\s*```", text)
    if code_match:
        try:
            parsed = json.loads(code_match.group(1))
            if isinstance(parsed, list) and len(parsed) >= 1:
                return [str(q)[:80] for q in parsed[:3]]
        except json.JSONDecodeError:
            pass
    # Try regex for standalone JSON array
    arr_match = re.search(r"\[[\s\S]*?\]", text)
    if arr_match:
        try:
            parsed = json.loads(arr_match.group())
            if isinstance(parsed, list) and len(parsed) >= 1:
                return [str(q)[:80] for q in parsed[:3]]
        except json.JSONDecodeError:
            pass
    return None


async def generate_suggested_questions() -> List[str]:
    """Generate 3 suggested questions based on current graph schema using Claude."""
    try:
        schema_summary = SchemaService.get_schema_summary()
    except Exception as e:
        logger.warning(f"Schema fetch failed: {e}")
        return DEFAULT_QUESTIONS

    if not schema_summary or schema_summary == "Schema not available. Use get_schema tool to fetch it.":
        return DEFAULT_QUESTIONS

    prompt = f"""根据以下图谱 schema，生成 3 个简短的中文问题，供用户点击后向 AI 助手提问探索图谱。

要求：
1. 每个问题必须明确提及具体的节点类型名称（如 GW、PipeNode、Person、Decision 等）或关系类型名称，直接使用 schema 中的实际标签/类型名
2. 问题要具体、可操作，例如「GW 节点有哪些？」「PipeNode 的连接模式如何？」「哪种关系类型最多？」
3. 不要用泛化的「核心节点」「图中」等，而要指向具体类型
4. 只返回 JSON 数组，格式：["问题1", "问题2", "问题3"]，不要其他内容

## 图谱 Schema
{schema_summary}
"""

    api_key = config.anthropic.api_key or ""
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY not set, using default suggestions")
        return DEFAULT_QUESTIONS

    base_url = (config.anthropic.base_url or "https://api.anthropic.com").rstrip("/")
    url = f"{base_url}/messages" if base_url.endswith("/v1") else f"{base_url}/v1/messages"

    # DeepSeek Anthropic API uses deepseek-chat
    model = "deepseek-chat" if "deepseek.com" in base_url else "claude-sonnet-4-20250514"

    max_retries = 3

    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    url,
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": model,
                        "max_tokens": 256,
                        "messages": [{"role": "user", "content": prompt}],
                    },
                )
                response.raise_for_status()
                data = response.json()
                text = _extract_text_from_response(data)
                if not text:
                    logger.warning("Empty or unknown response format from AI: %s", list(data.keys())[:5])
                    return DEFAULT_QUESTIONS

                questions = _parse_questions_from_text(text)
                if questions:
                    # Pad to 3 if needed
                    while len(questions) < 3:
                        questions.append(DEFAULT_QUESTIONS[len(questions)])
                    return questions[:3]
                return DEFAULT_QUESTIONS
        except (httpx.ConnectError, httpx.ConnectTimeout) as e:
            if attempt < max_retries - 1:
                wait = 1.0 * (attempt + 1)
                logger.info("Suggestions API connection failed (attempt %s/%s), retrying in %.1fs: %s", attempt + 1, max_retries, wait, e)
                await asyncio.sleep(wait)
            else:
                logger.warning("Suggestions API connection failed after %s attempts: %s", max_retries, e)
                return DEFAULT_QUESTIONS
        except httpx.HTTPStatusError as e:
            logger.warning("AI API HTTP error %s: %s", e.response.status_code, e.response.text[:200])
            return DEFAULT_QUESTIONS
        except Exception as e:
            logger.warning("Failed to generate suggestions: %s", e, exc_info=True)
            return DEFAULT_QUESTIONS

    return DEFAULT_QUESTIONS
