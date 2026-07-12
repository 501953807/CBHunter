"""AI-powered product image analysis using LLM vision APIs.

Supports multiple providers:
- Gemini (default, free tier via Google AI Studio)
- Falls back to rule-based OCR when no API key configured

IMPORTANT: All LLM API calls run in a thread executor with timeout to avoid
blocking the async event loop. Never call the google.genai SDK directly from
an async function — its HTTP calls are synchronous.
"""

import asyncio
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

ANALYSIS_PROMPT = """You are an e-commerce product analyst specializing in Southeast Asian cross-border markets (Shopee/TikTok Shop/TEMU). Analyze this product image in detail and return a JSON response.

Return ONLY valid JSON with this exact structure. Be detailed and specific in your descriptions:
{
  "product_positioning": {
    "product_type": "Detailed product type and style description in Chinese, such as: '女士斜挮包 / 单肩小方包 / 水桶包'",
    "style": "Style keywords in Chinese, such as: '日系文艺、韩系复古、法式慵懒、轻便休闲'",
    "audience": "Target audience in Chinese, such as: '学生（校园通勤）、年轻上班族（午餐包/轻便出行）、文艺青年'",
    "scene": "Usage scenarios in Chinese, such as: '校园日常、周末约会逛街、短途旅行辅助包、超市采购、午休外出'",
    "material": "Actual material from the image, in Chinese, such as: '宽条灯芯绒面料' or '头层牛皮' or '帆布'",
    "color": "Main color description in Chinese, such as: '温暖的焦糖黄/复古棕色/经典黑色'"
  },
  "selling_points": {
    "外观颜值": {
      "point": "Detailed appearance selling point in Chinese, describe what you actually see",
      "pain": "Corresponding buyer pain point in Chinese, explain why this matters"
    },
    "材质质感": {
      "point": "Detailed material selling point in Chinese",
      "pain": "Corresponding buyer pain point in Chinese"
    },
    "功能实用": {
      "point": "Detailed functional selling point in Chinese, explain capacity, compartments, etc.",
      "pain": "Corresponding buyer pain point in Chinese"
    },
    "细节设计": {
      "point": "Detailed design feature selling point in Chinese, mention specific details like zippers, pockets, straps",
      "pain": "Corresponding buyer pain point in Chinese"
    },
    "做工品质": {
      "point": "Detailed quality selling point in Chinese, mention stitching, hardware, finishing",
      "pain": "Corresponding buyer pain point in Chinese"
    }
  },
  "market_score": {
    "score": "Integer score 1-10",
    "reasons": [
      "Reason 1 in Chinese",
      "Reason 2 in Chinese",
      "Reason 3 in Chinese"
    ]
  },
  "titles": {
    "chinese": "Chinese title for Shopee high CTR, include style/audience/scene keywords, under 60 chars",
    "english": "English title for Shopee high CTR, include keywords, under 120 chars"
  }
}"""


async def call_llm_vision(image_path: str, api_key: str = "", provider: str = "gemini") -> Optional[dict]:
    """Call LLM vision API to analyze product image. Never blocks the event loop."""
    if provider == "gemini" and api_key:
        return await _call_gemini(image_path, api_key)
    return None


async def _call_gemini(image_path: str, api_key: str) -> Optional[dict]:
    """Call Google Gemini API via thread executor with timeout.

    CRITICAL: google.genai SDK uses synchronous HTTP calls (urllib/httpx sync).
    Running these directly in an async function blocks the entire FastAPI event loop,
    preventing ALL other requests from being processed. This is the #1 cause of
    "system crashes" (all pages blank) after image upload.
    """
    try:
        loop = asyncio.get_event_loop()
        result = await asyncio.wait_for(
            loop.run_in_executor(None, _gemini_sync, image_path, api_key),
            timeout=25.0,
        )
        return result
    except asyncio.TimeoutError:
        logger.warning("Gemini API call timed out (25s) — check VPN/network")
        return None
    except Exception as e:
        logger.error(f"Gemini API call failed: {e}")
        return None


def _gemini_sync(image_path: str, api_key: str) -> Optional[dict]:
    """Synchronous Gemini API call (runs in thread pool, NOT the event loop)."""
    try:
        from google import genai

        client = genai.Client(api_key=api_key)
        file_ref = client.files.upload(file=image_path)

        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=[ANALYSIS_PROMPT, file_ref],
        )

        text = response.text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        return json.loads(text)
    except Exception as e:
        logger.error(f"Gemini sync call failed: {e}")
        return None


async def analyze_with_ai(
    image_path: str,
    api_key: str = "",
    provider: str = "gemini",
) -> Optional[dict]:
    """Analyze product image using AI provider. Returns None if unavailable."""
    result = await call_llm_vision(image_path, api_key, provider)
    if result:
        logger.info(f"AI analysis successful via {provider}")
        return result
    logger.warning(f"AI analysis unavailable via {provider}")
    return None
