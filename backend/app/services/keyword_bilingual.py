"""Bilingual keyword map for cross-border e-commerce trend matching.

Maps English trend keywords to their Chinese equivalents, enabling
Chinese product titles/categories to be matched against English keywords.
"""

# English keyword → list of Chinese equivalents
EN_TO_CN: dict[str, list[str]] = {
    # Styles & aesthetics
    "kpop": ["kpop", "韩流", "韩国", "偶像", "明星同款", "周边"],
    "minimalist": ["极简", "简约", "简约风", "性冷淡", "北欧风"],
    "y2k": ["y2k", "千禧", "复古辣妹", "千禧风", "辣妹风"],
    "aesthetic": ["ins风", "网红风", "氛围感", "ins"],
    "vintage": ["复古", "古着", "怀旧", "vintage"],
    "cute": ["可爱", "萌", "甜美", "少女", "软萌"],
    "kawaii": ["卡哇伊", "可爱", "萌系", "日系可爱"],
    "streetwear": ["街头", "潮牌", "嘻哈", "街头风", "潮人"],
    "boho": ["波西米亚", "民族风", "度假风", "boho"],
    "coquette": ["蝴蝶结", "蕾丝", "甜美", "公主风", "少女感"],
    "gorpcore": ["户外", "机能", "工装", "山系", "户外风"],
    "balletcore": ["芭蕾", "绑带", "舞蹈", "芭蕾风", "舞者"],
    "office": ["通勤", "上班", "职场", "OL", "商务"],
    "sporty": ["运动", "健身", "运动风", "athleisure"],
    "preppy": ["学院", "学院风", "藤校", "常春藤"],
    "grunge": ["颓废", "摇滚", "朋克", "grunge"],
    "cyberpunk": ["赛博", "赛博朋克", "未来感", "机能"],
    "fairy": ["仙女", "精灵", "梦幻", "仙气"],
    "dark_academia": ["暗黑学院", "学术风", "复古学院"],

    # Materials & details
    "pearl": ["珍珠", "珍珠风", "珍珠款"],
    "bow": ["蝴蝶结", "绑带", "系带"],
    "denim": ["牛仔", "丹宁"],
    "lace": ["蕾丝", "镂空"],
    "crochet": ["钩针", "针织", "手工编织", "编织"],
    "sustainable": ["环保", "可持续", "有机"],
    "oversized": ["宽松", "oversize", "大码", "宽大"],
    "patchwork": ["拼接", "拼布", "拼色"],
    "embroidery": ["刺绣", "绣花"],
    "flare": ["喇叭", "阔腿", "微喇"],
    "cargo": ["工装", "多口袋", "口袋"],
    "sheer": ["透视", "薄纱", "透明"],
    "plaid": ["格子", "格纹", "苏格兰"],
    "striped": ["条纹", "条子"],
    "floral": ["碎花", "花卉", "花朵", "印花"],
    "tie_dye": ["扎染"],
    "gradient": ["渐变", "渐变色"],
    "animal_print": ["豹纹", "虎纹", "斑马纹"],
    "crystal": ["水晶", "钻石", "亮片", "闪亮"],
    "metallic": ["金属", "亮面", "金属感", "镭射"],
    "matte": ["磨砂", "哑光"],
    "holographic": ["全息", "镭射", "炫彩", "幻彩"],
    "sequin": ["亮片", "闪片"],
    "fringe": ["流苏"],
    "velvet": ["丝绒", "天鹅绒"],
    "satin": ["缎面", "丝绸感", "缎子"],
    "mesh": ["网纱", "网眼"],
    "leather": ["皮革", "皮质", "真皮"],
    "suede": ["麂皮", "翻毛皮"],
    "canvas": ["帆布"],
    "nylon": ["尼龙", "锦纶"],
    "cotton": ["纯棉", "棉质"],

    # Functions & features
    "organizer": ["收纳", "整理", "收纳盒", "收纳袋"],
    "storage": ["收纳", "储物", "储物盒"],
    "foldable": ["折叠", "可折叠", "便携"],
    "multi_function": ["多功能", "多用途", "多用"],
    "smart": ["智能", "智能家居"],
    "wireless": ["无线", "蓝牙"],
    "portable": ["便携", "迷你", "旅行装", "旅行"],
    "mini": ["迷你", "小型", "小巧", "mini"],
    "waterproof": ["防水", "防雨"],
    "anti_slip": ["防滑"],
    "shockproof": ["防摔", "防震", "抗震"],
    "transparent": ["透明", "可视"],
    "magnetic": ["磁吸", "磁性"],
    "modular": ["模块化", "组合", "可拆卸"],
    "adjustable": ["可调节", "调节"],

    # Price & quality tiers
    "premium": ["高端", "奢华", "高级", "轻奢"],
    "budget": ["平价", "实惠", "便宜", "性价比"],
    "custom": ["定制", "个性化", "专属", "定制化"],
    "handmade": ["手工", "手作", "自制"],
    "luxury": ["奢侈", "高端", "名牌"],

    # Occasions & seasons
    "gift": ["礼物", "礼品", "送礼", "伴手礼"],
    "holiday": ["节日", "圣诞", "新年", "春节"],
    "summer": ["夏季", "夏天", "清凉", "防晒"],
    "winter": ["冬季", "冬天", "保暖", "加厚"],
    "spring": ["春季", "春天", "春装"],
    "autumn": ["秋季", "秋天", "秋装"],
    "beach": ["沙滩", "海边", "度假", "泳装"],
    "party": ["派对", "聚会", "晚宴"],
    "wedding": ["婚礼", "婚纱", "新娘"],
    "travel": ["旅行", "旅游", "出差"],

    # Product categories (cross-border hot)
    "phone_case": ["手机壳", "手机套", "保护壳"],
    "earphone_case": ["耳机套", "耳机壳", "airpods套"],
    "sticker": ["贴纸", "贴画", "装饰贴"],
    "keychain": ["钥匙扣", "挂件", "钥匙链"],
    "tote_bag": ["托特包", "帆布袋", "大包", "tote"],
    "sling_bag": ["斜挎包", "胸包", "sling"],
    "hair_clip": ["发夹", "发卡", "抓夹"],
    "scrunchies": ["大肠圈", "发圈", "头绳"],
    "socks": ["袜子", "短袜", "长袜", "船袜"],
    "bracelet": ["手链", "手镯", "手环"],
    "necklace": ["项链", "颈链", "锁骨链"],
    "earrings": ["耳环", "耳饰", "耳钉"],
    "ring": ["戒指", "指环"],
    "anklet": ["脚链", "脚环"],
    "sunglasses": ["墨镜", "太阳镜"],
    "watch": ["手表", "腕表"],
    "belt": ["腰带", "皮带"],
    "scarf": ["围巾", "丝巾"],
    "hat": ["帽子", "棒球帽", "渔夫帽"],
    "backpack": ["背包", "双肩包"],
    "wallet": ["钱包", "卡包"],
    "water_bottle": ["水杯", "水壶", "保温杯"],
    "lunch_box": ["饭盒", "便当盒", "餐盒"],
    "fan": ["风扇", "小风扇", "手持风扇"],
    "lamp": ["灯", "台灯", "氛围灯", "夜灯"],
    "candle": ["蜡烛", "香薰蜡"],
    "diffuser": ["扩香器", "香薰机", "diffuser"],
    "rug": ["地毯", "地垫", "门垫"],
    "pillow": ["抱枕", "靠垫", "枕头"],
    "blanket": ["毯子", "毛毯", "盖毯"],
    "curtain": ["窗帘"],
    "mirror": ["镜子", "化妆镜"],
    "frame": ["相框", "画框"],
    "vase": ["花瓶"],
    "planter": ["花盆", "花器"],
    "figurine": ["摆件", "手办", "公仔", "玩偶"],
    "plush": ["毛绒", "玩偶", "公仔", "布偶"],
    "fidget": ["解压", "指间", "减压"],
    "slime": ["史莱姆", "水晶泥", "slime"],
    "squishy": ["捏捏", "慢回弹", "减压"],
    "board_game": ["桌游", "棋牌"],
    "puzzle": ["拼图"],
    "dice": ["骰子"],
    "trading_card": ["卡牌", "卡片", "收藏卡"],
    "notebook": ["笔记本", "手账", "本子", "日记本"],
    "pen": ["笔", "钢笔", "圆珠笔"],
    "highlighter": ["荧光笔", "标记笔"],
    "washi_tape": ["胶带", "和纸胶带", "手账胶带"],
    "stamp": ["印章", "图章"],

    # Cross-border market specific
    "halal": ["清真", "halal"],
    "modest": ["保守", "端庄", "穆斯林"],
    "hijab": ["头巾", "hijab"],
    "tudung": ["头巾", "tudung"],
    "baju": ["马来服", "baju", "传统服饰"],
    "batik": ["蜡染", "batik"],
    "songket": ["织锦", "songket"],
    "kebaya": ["可巴雅", "kebaya"],
}

# Build reverse index: Chinese term → [English keywords]
_CN_TO_EN = None  # type: Optional[Dict[str, List[str]]]


def _build_cn_index():  # -> Dict[str, List[str]]
    """Build Chinese-to-English lookup index."""
    global _CN_TO_EN
    if _CN_TO_EN is not None:
        return _CN_TO_EN
    _CN_TO_EN = {}
    for en_keyword, cn_list in EN_TO_CN.items():
        for cn_term in cn_list:
            cn_lower = cn_term.lower()
            if cn_lower not in _CN_TO_EN:
                _CN_TO_EN[cn_lower] = []
            _CN_TO_EN[cn_lower].append(en_keyword)
    return _CN_TO_EN


def match_keywords(text: str, trend_keywords: list[dict]) -> list[dict]:
    """Match trend keywords against product text (supports both EN and CN).

    Args:
        text: Product name or description (Chinese/English/mixed)
        trend_keywords: List of trend keyword dicts with at least 'keyword' key

    Returns:
        List of matching trend keywords with relevance info
    """
    if not text or not trend_keywords:
        return []

    text_lower = text.lower()
    cn_index = _build_cn_index()
    matches: list[dict] = []

    for kw in trend_keywords:
        keyword = kw.get("keyword", "")
        if not keyword:
            continue
        kw_lower = keyword.lower()

        match_type = None

        # 1. Direct English keyword match in text
        if kw_lower in text_lower:
            match_type = "direct"
        else:
            # 2. Check each Chinese equivalent
            cn_terms = EN_TO_CN.get(kw_lower, [keyword])
            for cn_term in cn_terms:
                if cn_term.lower() in text_lower:
                    match_type = "translation"
                    break

        # 3. Also check if the text contains any Chinese term that maps back to this keyword
        if not match_type:
            for cn_term, en_keywords in cn_index.items():
                if cn_term in text_lower and keyword in en_keywords:
                    match_type = "reverse"
                    break

        if match_type:
            matches.append({
                "id": kw.get("id", ""),
                "keyword": keyword,
                "match_type": match_type,
                "market": kw.get("market", ""),
                "relevance_score": 70 if match_type == "direct" else 50,
                "growth_pct": kw.get("growth_pct"),
                "trend_direction": kw.get("trend_direction", ""),
            })

    matches.sort(key=lambda x: x["relevance_score"], reverse=True)
    return matches
