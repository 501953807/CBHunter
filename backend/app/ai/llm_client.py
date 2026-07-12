"""Deprecated LLM integration adapter.

This module is kept for backward compatibility. For real AI-powered analysis,
use app.services.ai_analysis (Gemini Vision for product images) instead.

For title optimization and description generation, the AI suggestion engine
(app.ai.engine) uses rule-based analyzers. This adapter intentionally never
returns template-generated commerce content.
"""

import logging
import warnings

logger = logging.getLogger(__name__)


class LLMClient:
    """Deprecated: use app.services.ai_analysis for real AI calls.

    The legacy methods fail closed instead of returning placeholder suggestions.
    """

    def __init__(self, api_key: str = ""):
        warnings.warn(
            "LLMClient is deprecated. Use app.services.ai_analysis for AI-powered analysis.",
            DeprecationWarning,
            stacklevel=2,
        )
        self.api_key = api_key
        self.enabled = bool(api_key)

    async def optimize_title(self, title: str, platform: str, keywords: list[str]) -> list[str]:
        logger.warning("LLMClient.optimize_title is deprecated; no LLM call was made")
        return []

    async def generate_description(self, product_name: str, features: list[str], platform: str) -> str:
        logger.warning("LLMClient.generate_description is deprecated; no LLM call was made")
        return ""

    async def competitive_analysis(self, our_price: float, competitor_price: float, product_name: str) -> str:
        logger.warning("LLMClient.competitive_analysis is deprecated; no LLM call was made")
        return ""
