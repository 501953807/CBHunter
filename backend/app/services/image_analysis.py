"""Evidence-only fallback for product image analysis.

This module is used only when no configured AI provider produced a structured
analysis. OCR text alone is not sufficient evidence for selling points, market
scores, titles, or target-market recommendations, so those fields remain empty.
"""

from app.services.evidence_service import data_required, source_ref


def extract_analysis(ocr_text: str, category: str) -> dict:
    """Return traceable OCR evidence without inventing product conclusions."""
    cleaned_text = (ocr_text or "").strip()
    return {
        **data_required(
            "仅获得 OCR 文本，需配置 AI Provider 或补充真实趋势/竞品数据后再生成分析",
            data_gaps=["ai_provider", "trend_evidence", "competitor_evidence", "platform_sales_evidence"],
            source_refs=[
                source_ref(
                    "ocr",
                    "image_text",
                    fields=["ocr_text"],
                    meta={
                        "ocr_text_present": bool(cleaned_text),
                        "ocr_text_length": len(cleaned_text),
                        "category": category or None,
                    },
                )
            ],
            evidence_window="当前图片 OCR 结果",
            confidence_reason="OCR 文本只能证明图片中存在可识别文字，不能推断卖点、标题、市场评分或目标市场。",
        ),
        "note": "仅获得 OCR 文本，需配置 AI Provider 或补充真实趋势/竞品数据后再生成分析",
        "product_positioning": {
            "category": category or None,
            "product_type": None,
            "style": None,
            "audience": None,
            "scene": None,
            "material": None,
            "color": None,
        },
        "selling_points": {},
        "market_score": {
            "score": None,
            "reasons": [],
            "status": "data_required",
        },
        "titles": {},
        "evidence": {
            "source": "ocr",
            "ocr_text_present": bool(cleaned_text),
            "ocr_text_length": len(cleaned_text),
        },
    }


def recommend_market(analysis: dict) -> list:
    """Do not infer target markets from OCR-only or unverified attributes."""
    return []
