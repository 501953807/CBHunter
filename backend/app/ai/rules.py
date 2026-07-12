"""Rule definitions for AI suggestion engine."""

RULES = {
    "PRICE_HIGH": {
        "type": "pricing",
        "severity": "info",
        "title_template": "商品「{name}」定价高于市场均价",
        "desc_template": "{name} 当前售价 ¥{price}，市场均价 ¥{market_avg}，高出 {over_pct:.0f}%。建议降价至 ¥{suggested:.2f} 以提升竞争力。",
    },
    "PRICE_LOW": {
        "type": "pricing",
        "severity": "warning",
        "title_template": "商品「{name}」利润空间过低",
        "desc_template": "{name} 当前售价 ¥{price}，成本 ¥{cost}，利润率仅 {margin_pct:.0f}%。建议考虑调整定价。",
    },
    "STOCK_LOW": {
        "type": "inventory",
        "severity": "critical",
        "title_template": "商品「{name}」库存告急",
        "desc_template": "{name} 仅剩 {stock} 件库存，日均销售 {daily_sales:.1f} 件，预计 {days} 天内售罄。请及时补货。",
    },
    "STOCK_OVER": {
        "type": "inventory",
        "severity": "warning",
        "title_template": "商品「{name}」库存积压",
        "desc_template": "{name} 库存 {stock} 件，近30天仅售 {monthly_sales} 件。建议考虑促销活动或调整采购计划。",
    },
    "LISTING_DEAD": {
        "type": "listing",
        "severity": "info",
        "title_template": "商品「{name}」30天无销售",
        "desc_template": "{name} 在 {platform} 上已经30天没有出单了。建议检查标题、图片、价格是否具有竞争力。",
    },
    "LISTING_CONV_DROP": {
        "type": "listing",
        "severity": "warning",
        "title_template": "商品「{name}」转化率明显下降",
        "desc_template": "{name} 转化率从 {conv_before:.1f}% 降至 {conv_after:.1f}%，降幅 {drop_pct:.0f}%。建议检查近期评价和竞品变化。",
    },
    "TREND_SURGE": {
        "type": "trend",
        "severity": "info",
        "title_template": "关键词「{keyword}」搜索量激增",
        "desc_template": "关键词「{keyword}」搜索量在过去7天增长了 {surge_pct:.0f}%。建议及时更新相关 Listing 以获取流量。",
    },
    "CROSS_GAP": {
        "type": "cross_platform",
        "severity": "info",
        "title_template": "商品「{name}」在 {from_platform} 表现好但未上架 {to_platform}",
        "desc_template": "该商品已在 {from_platform} 上架，但尚未在 {to_platform} 覆盖。建议结合库存、利润和平台适配度评估是否拓展。",
    },
    "NEW_CATEGORY": {
        "type": "trend",
        "severity": "info",
        "title_template": "品类「{category}」正在快速增长",
        "desc_template": "品类 {category} 在过去30天销售额增长 {growth:.0f}%。建议考虑增加该品类商品。",
    },
}


def get_rule(rule_id: str) -> dict:
    return RULES.get(rule_id, {})
