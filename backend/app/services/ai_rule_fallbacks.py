"""Deterministic low-confidence AI task fallbacks."""


def rule_fallback(task_type: str, data: dict) -> dict:
    product_name = data.get("product_name") or "当前商品"
    category = data.get("category") or "未填写品类"
    platform = data.get("platform") or "目标平台待补"
    market = data.get("market") or "目标市场待补"
    features = data.get("features") or "核心特性待补充"
    points = data.get("selling_points") or data.get("features") or []
    point_text = "、".join(points[:3]) if isinstance(points, list) and points else str(points or "核心卖点待补充")
    if task_type == "listing_copy":
        return _low_confidence(
            f"标题：{product_name} {market} {platform} 实用款\n"
            f"卖点：1. {point_text}；2. 适合 {market} 日常使用场景；3. 规格、材质和认证需按真实商品补齐。\n"
            f"描述：{product_name} 面向 {market} {platform} 买家，属于{category}。核心特性为 {features}。"
            "本候选由规则生成，只能作为 Listing 草稿参考，发布前必须人工补齐尺寸、材质、包装、禁限售和平台字段。",
            ["ai_provider", "product_specifications", "platform_policy"],
        )
    if task_type == "selling_points":
        return _low_confidence(
            f"{product_name} 卖点候选：1. {features}；2. 面向 {market} 的使用场景需结合真实竞品验证；"
            f"3. {point_text}。规则生成，需人工确认并补充平台热词和合规依据。",
            ["ai_provider", "competitor_listing_examples"],
        )
    if task_type == "description":
        return _low_confidence(
            f"{product_name} 商品描述候选：这是一款面向 {market} {platform} 的{category}商品，核心特性为 {features}。"
            "请人工补充材质、尺寸、包装、使用限制、售后说明和平台禁用词校验后再采用。",
            ["ai_provider", "product_specifications", "platform_policy"],
        )
    if task_type == "image_understanding":
        return _low_confidence(
            f"{product_name} 图片理解候选：规则引擎未读取真实图片，仅能提示人工检查主体、背景、材质细节、"
            "尺寸参照、文字遮挡和平台主图规范；上传图片并配置视觉 AI 后可生成真实理解结果。",
            ["ai_provider", "product_images"],
        )
    if task_type == "video_script":
        return _low_confidence(
            f"15秒短视频候选脚本：1秒展示{product_name}使用场景；5秒说明{point_text}；"
            "6秒展示细节和包装；3秒引导下单。规则生成，需人工确认后使用。",
            ["ai_provider"],
        )
    if task_type == "pricing_explanation":
        return _low_confidence(
            "定价解释候选：基于当前采购价、费率、汇率和竞品价格带生成说明；缺少 AI Provider 时仅输出规则摘要，需人工确认。",
            ["ai_provider"],
        )
    if task_type == "risk_summary":
        return _low_confidence(
            "风险摘要候选：规则引擎仅能汇总已存在风险字段，不能替代 AI 判断；需人工确认处置建议。",
            ["ai_provider"],
        )
    if task_type == "image_edit_plan":
        return _low_confidence(
            f"{product_name} 图片处理建议候选：检查主图清晰度、背景干净度、主体占比、文字遮挡和平台合规；"
            "规则生成，需人工确认。",
            ["ai_provider", "local_image_tool"],
        )
    if task_type == "compliance_check":
        return _low_confidence(
            f"{product_name} 合规检查候选：按 {platform} {market} 检查禁限售词、侵权词、夸大功效、"
            "认证声明、价格/促销承诺和图片文字风险；规则生成，需人工结合平台规则复核。",
            ["ai_provider", "platform_policy"],
        )
    if task_type == "enhanced_content":
        return _low_confidence(
            f"{product_name} A+图文增强内容候选：模块1展示核心使用场景；模块2解释{point_text}；"
            "模块3补充规格、材质、包装和注意事项。规则生成，需人工补真实图片和参数。",
            ["ai_provider", "product_images", "product_specifications"],
        )
    if task_type == "ad_creative":
        return _low_confidence(
            f"{product_name} 广告素材脚本候选：首屏突出{point_text}，中段展示使用前后对比，"
            f"结尾引导进入 {platform} 商品页；投放前需校验 {market} 平台广告规则。",
            ["ai_provider", "ad_platform_policy", "creative_assets"],
        )
    if task_type == "influencer_brief":
        return _low_confidence(
            f"{product_name} 达人合作 Brief 候选：适合生活方式/收纳/开箱类达人；要求展示真实使用场景、"
            "核心卖点、禁用夸大承诺、交付短视频和封面图；需人工补预算与样品规则。",
            ["ai_provider", "influencer_budget", "sample_policy"],
        )
    return {"success": False, "error": f"规则引擎无法处理{task_type}"}


def _low_confidence(text: str, data_gaps: list[str]) -> dict:
    return {
        "success": True,
        "data": {
            "text": text,
            "provider": "rule_engine",
            "confidence": "low",
            "data_gaps": data_gaps,
        },
    }
