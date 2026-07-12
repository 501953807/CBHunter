"""
Task Executor — 多策略任务编排。

根据任务类型和可用 provider 自动选择最优方案执行。
支持成本感知调度：本地CLI → 免费API → 付费API → 规则引擎。
"""

import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.ai_providers import (
    PROVIDERS,
    get_available_providers,
    check_provider_available,
    call_provider,
    PROVIDER_HANDLERS,
)

logger = logging.getLogger(__name__)

# 任务类型 → 所需能力
TASK_CAPABILITIES = {
    "product_analysis": ["vision", "text"],
    "title_generation": ["text"],
    "trend_analysis": ["text"],
    "culture_signal_analysis": ["text", "analysis"],
    "image_ocr": ["vision"],
    "listing_copy": ["text"],
    "selling_points": ["text"],
    "description": ["text"],
    "decision_analysis": ["text", "analysis"],
    "image_understanding": ["vision", "text"],
    "image_edit_plan": ["vision", "text"],
    "video_script": ["text"],
    "compliance_check": ["text"],
    "enhanced_content": ["text"],
    "ad_creative": ["text"],
    "influencer_brief": ["text"],
    "pricing_explanation": ["text", "analysis"],
    "risk_summary": ["text", "analysis"],
}


class TaskResult:
    def __init__(self, success: bool, data=None, provider: str = "",
                 confidence: str = "low", error: str = ""):
        self.success = success
        self.data = data
        self.provider = provider
        self.confidence = confidence
        self.error = error

    def to_dict(self) -> dict:
        return {
            "success": self.success, "data": self.data,
            "provider": self.provider, "confidence": self.confidence, "error": self.error,
        }


async def execute_task(
    db: AsyncSession,
    task_type: str,
    input_data: dict,
    image_path: Optional[str] = None,
    preferred_providers: Optional[list[str]] = None,
) -> TaskResult:
    """
    执行任务，按优先级自动选择 provider。

    优先级逻辑：
      1. preferred_providers 指定的（用户在前端设定的顺序）
      2. 否则按 PROVIDERS 配置的 priority 升序
      3. 跳过不可用的（CLI未安装 / API Key未配置 / 网络不通）
      4. 全部失败 → 走 rule_engine 兜底
    """
    required_caps = TASK_CAPABILITIES.get(task_type, ["text"])

    # 构建候选 provider 列表
    candidates = preferred_providers or []
    if not candidates:
        candidates = sorted(PROVIDERS.keys(), key=lambda p: PROVIDERS[p]["priority"])

    # 确保规则引擎在最后
    candidates = [c for c in candidates if c != "rule_engine"] + ["rule_engine"]

    last_error = ""
    for pid in candidates:
        cfg = PROVIDERS.get(pid)
        if not cfg:
            continue

        # 检查能力匹配
        if not _provider_matches_capabilities(cfg, required_caps):
            continue

        # 检查可用性
        if not await check_provider_available(db, pid, cfg):
            last_error = f"{pid} 不可用"
            continue

        try:
            result = await call_provider(db, pid, task_type, input_data, image_path)
            if result.get("success"):
                confidence = result.get("data", {}).get("confidence") or _calc_confidence(pid)
                return TaskResult(True, result["data"], result["data"].get("provider", pid), confidence)
            last_error = result.get("error", "")
            logger.info(f"[{task_type}] {pid} 失败: {last_error}")
        except Exception as e:
            last_error = str(e)
            logger.warning(f"[{task_type}] {pid} 异常: {e}")
            continue

    return TaskResult(False, error=f"所有 provider 失败，最后错误：{last_error}")


def _provider_matches_capabilities(provider: dict, required_caps: list[str]) -> bool:
    if provider.get("type") == "rule":
        return True
    capabilities = provider.get("capabilities", [])
    return all(capability in capabilities for capability in required_caps)


def _calc_confidence(provider_id: str) -> str:
    """根据 provider 类型评估可信度。"""
    cfg = PROVIDERS.get(provider_id, {})
    t = cfg.get("type", "")
    if t == "rule":
        return "low"
    if t == "cli":
        return "high"  # 本地工具结果可靠
    if t == "paid_api":
        return "high"
    if t == "free_api":
        return "medium"  # 免费 API 可能有配额/质量限制
    return "low"


async def get_provider_status(db: AsyncSession) -> list[dict]:
    """获取所有 provider 状态（供前端展示）。"""
    return await get_available_providers(db)
