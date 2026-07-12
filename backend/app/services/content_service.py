"""AI-backed content generation for listing and short video workflows."""

import json
import logging
import re
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.evidence_service import configuration_required, data_required, evidence_payload, source_ref
from app.services.system_config_service import get_gemini_key

logger = logging.getLogger(__name__)


async def generate_video_content_plan(db: AsyncSession, data: dict[str, Any]) -> dict[str, Any]:
    """Generate short-video scripts, hashtags and a content calendar."""
    product_name = (data.get("product_name") or "").strip()
    if not product_name:
        return {"scripts": [], "hashtags": [], "calendar": [], "note": "请填写产品名称",
                **data_required("请填写产品名称", data_gaps=["product_name"], evidence_window="当前请求输入")}

    api_key = await get_gemini_key(db)
    if not api_key:
        return {
            "scripts": [],
            "hashtags": [],
            "calendar": [],
            "note": "AI API Key 未配置，无法生成真实视频脚本、标签和内容计划。",
            **configuration_required(
                "AI API Key 未配置，无法生成真实视频脚本、标签和内容计划。",
                data_gaps=["system_config.gemini_api_key"],
                evidence_window="当前 AI 配置",
                confidence_reason="Gemini API Key 未配置，未生成内容",
            ),
        }

    platform = data.get("platform") or ""
    market = data.get("market") or ""
    if not platform or not market:
        return {"scripts": [], "hashtags": [], "calendar": [], "note": "请选择平台和市场",
                **data_required("请选择平台和市场", data_gaps=["platform", "market"], evidence_window="当前请求输入")}
    category = data.get("category") or ""
    features = data.get("features") or ""
    audience = data.get("target_audience") or ""
    selling_points = data.get("selling_points") or ""

    prompt = f"""你是跨境电商短视频运营策划。

请为以下商品生成可直接执行的短视频内容方案。

商品: {product_name}
平台: {platform}
市场: {market}
品类: {category}
核心功能/卖点: {features}
目标人群: {audience}
补充卖点: {selling_points}

要求:
1. 输出严格 JSON，不要 Markdown。
2. scripts 生成 3 条，每条包含 title、hook、script、shots、tips。
3. hashtags 生成 12 个，贴合平台、市场、品类和商品，不要泛泛堆砌。
4. calendar 生成 7 天，每天包含 day、type、angle、asset、cta。
5. 内容要适合跨境电商商家拍摄，强调可执行，不要虚构价格、库存、销量、优惠。

JSON格式:
{{
  "scripts": [{{"title": "", "hook": "", "script": "", "shots": ["", ""], "tips": ["", ""]}}],
  "hashtags": ["#tag"],
  "calendar": [{{"day": "Day 1", "type": "", "angle": "", "asset": "", "cta": ""}}]
}}
"""
    try:
        from google import genai

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=[prompt],
        )
        parsed = _parse_json_payload(response.text or "")
        scripts = parsed.get("scripts", [])[:3]
        hashtags = parsed.get("hashtags", [])[:20]
        calendar = parsed.get("calendar", [])[:7]
        if not scripts and not hashtags and not calendar:
            return {
                "scripts": [],
                "hashtags": [],
                "calendar": [],
                "note": "AI 未返回可解析的视频内容方案。",
                **data_required(
                    "AI 未返回可解析的视频内容方案。",
                    data_gaps=["ai_generation_result"],
                    evidence_window="当前请求输入",
                ),
            }
        return {
            "scripts": scripts,
            "hashtags": hashtags,
            "calendar": calendar,
            "status": "ready",
            "source": "ai",
            **evidence_payload(
                source_refs=[source_ref(
                    "merchant_input",
                    fields=[
                    key for key, value in data.items()
                    if value not in (None, "", [], {})
                    ],
                )],
                evidence_window="当前请求输入",
                confidence_reason="内容由 AI 根据商家当前输入生成，未经平台表现数据验证",
            ),
        }
    except Exception as exc:
        logger.error("Video content generation failed: %s", exc)
        return {
            "scripts": [],
            "hashtags": [],
            "calendar": [],
            "note": f"AI生成失败: {exc}",
            **data_required(
                f"AI生成失败: {exc}",
                data_gaps=["ai_generation_result"],
                evidence_window="当前请求输入",
                confidence_reason="AI 调用失败，未生成内容",
            ),
        }


def _parse_json_payload(text: str) -> dict[str, Any]:
    """Parse JSON even when the model wraps it in prose or code fences."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()
    try:
        value = json.loads(cleaned)
        return value if isinstance(value, dict) else {}
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.S)
        if not match:
            return {}
        try:
            value = json.loads(match.group(0))
            return value if isinstance(value, dict) else {}
        except json.JSONDecodeError:
            return {}
