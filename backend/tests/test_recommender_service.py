import asyncio
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models import all_models  # noqa: F401
from app.models.competitor_product import CompetitorProduct
from app.models.sourcing_item import SourcingItem
from app.models.supply_product import SupplyProduct
from app.models.trend_keyword import TrendKeyword
from app.services.recommender_service import (
    _competition_level,
    _demand_level,
    _decision,
    _profit_level,
    _score,
    build_recommendation_bundle,
    evaluate_readiness,
)
from app.api.v1 import recommender as recommender_api
from app.models.user import User


def test_readiness_endpoint_promotes_evidence_to_api_response(monkeypatch):
    async def fake_readiness(db, user_id, platform, market):
        return {
            "platform": platform,
            "market": market,
            "rules_decision_status": "data_required",
            "model_training_status": "data_required",
            "counts": {},
            "minimums": {},
            "rule_gaps": ["trend_signals"],
            "data_gaps": ["trend_signals"],
            "source_refs": [{"type": "trend_keyword", "label": "趋势资料"}],
            "evidence_window": "当前资料快照",
            "confidence_reason": "只按真实资料计数",
            "required_actions": ["补趋势信号"],
            "note": "测试",
        }

    monkeypatch.setattr(recommender_api, "get_recommender_readiness", fake_readiness)

    import asyncio
    response = asyncio.run(recommender_api.get_decision_readiness(
        platform="shopee",
        market="MY",
        current_user=User(id="user-a", username="u", email="u@example.com", hashed_password="x"),
        db=None,
    ))

    assert response.status == "data_required"
    assert response.evidence_window == "当前资料快照"
    assert response.confidence_reason == "只按真实资料计数"
    assert response.data_gaps == ["trend_signals"]
    assert response.source_refs[0].type == "trend_keyword"


def test_missing_recommendation_evidence_stays_unknown():
    assert _demand_level(None, None, None) == "unknown"
    assert _competition_level(0) == "unknown"
    assert _profit_level([]) == "unknown"
    assert _score(None, None, None, None, []) == (
        0,
        "仅有商品或供应链记录，尚无可评分的趋势、销量或利润资料",
    )


def test_real_evidence_produces_rankable_score():
    score, reason = _score(1200, 200, 25, 80, [32])
    assert score > 0
    assert "趋势搜索量" in reason
    assert _demand_level(1200, 200, 25) == "high"
    assert _competition_level(3) == "medium"
    assert _profit_level([32]) == "high"


def test_score_maps_to_traffic_light_decision():
    assert _decision(82, [])["decision_level"] == "green"
    assert _decision(58, ["缺竞品资料"])["decision_level"] == "yellow"
    assert _decision(30, [])["decision_level"] == "red"


def test_readiness_keeps_model_training_blocked_without_history():
    result = evaluate_readiness({
        "candidate_products": 3,
        "trend_signals": 2,
        "competitor_products": 4,
        "supply_products": 2,
        "historical_outcomes": 0,
    })

    assert result["rules_decision_status"] == "ready"
    assert result["model_training_status"] == "data_required"
    assert any("100" in action for action in result["required_actions"])


def test_readiness_lists_missing_real_evidence():
    result = evaluate_readiness({
        "candidate_products": 0,
        "trend_signals": 0,
        "competitor_products": 0,
        "supply_products": 0,
        "historical_outcomes": 100,
    })

    assert result["rules_decision_status"] == "data_required"
    assert result["model_training_status"] == "ready"
    assert set(result["rule_gaps"]) == {
        "candidate_products",
        "trend_signals",
        "competitor_products",
        "supply_products",
    }


def test_recommendations_expose_unified_work_object_state(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'recommendation-work-object.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        now = datetime.now(timezone.utc)
        async with sessions() as session:
            user = User(
                id="recommendation-user",
                username="recommendation_admin",
                email="recommendation@example.com",
                hashed_password="x",
            )
            supply = SupplyProduct(
                user_id=user.id,
                name="越南风编织包",
                category_path="bags",
                price_min=16,
                price_max=22,
                sales_volume=260,
                images=["https://cbu01.alicdn.com/img/ibank/O1CN-real-bag-1.jpg"],
                product_url="https://detail.1688.com/offer/123456.html",
                is_active=True,
            )
            session.add_all([
                user,
                supply,
                TrendKeyword(
                    user_id=user.id,
                    keyword="越南风编织包",
                    market="MY",
                    category="bags",
                    search_volume=1800,
                    growth_pct=35,
                    cross_validation_score=82,
                ),
                CompetitorProduct(
                    user_id=user.id,
                    platform="shopee",
                    name="越南风编织包",
                    price=39,
                    currency="MYR",
                    market="MY",
                    last_updated=now,
                ),
                SourcingItem(
                    user_id=user.id,
                    product_name="越南风编织包",
                    source_name="1688",
                    source_price_rmb=18,
                    source_url="https://detail.1688.com/offer/123456.html",
                    source_image="https://cbu01.alicdn.com/img/ibank/O1CN-real-bag-1.jpg",
                    category="bags",
                    platform="shopee",
                    market="MY",
                    monthly_sales=120,
                    profit_margin_pct=34,
                ),
            ])
            await session.commit()

            bundle = await build_recommendation_bundle(session, user.id, "shopee", "MY", "bags")
        await engine.dispose()

        recommendation = bundle["recommendations"][0]
        assert recommendation["work_item_id"] == f"supply_product:{supply.id}"
        assert recommendation["lifecycle_status"] == "decision_passed"
        assert recommendation["lifecycle_label"] == "选品已通过"
        assert recommendation["object_refs"] == [
            {"type": "supply_product", "id": supply.id, "label": "越南风编织包"}
        ]
        assert recommendation["image_url"] == "https://cbu01.alicdn.com/img/ibank/O1CN-real-bag-1.jpg"
        assert recommendation["image_count"] == 1
        assert recommendation["source_url"] == "https://detail.1688.com/offer/123456.html"
        assert recommendation["source_label"] == "1688供应商品"
        assert set(recommendation["evidence_completeness"]) == {
            "trend", "social", "platform", "supply", "profit", "competitor", "content", "risk"
        }
        assert recommendation["evidence_completeness"]["trend"] == "present"
        assert recommendation["evidence_completeness"]["platform"] == "present"
        assert recommendation["evidence_completeness"]["supply"] == "present"
        assert recommendation["evidence_completeness"]["profit"] == "present"
        assert recommendation["evidence_completeness"]["competitor"] == "present"
        assert recommendation["evidence_summary"]["present"] >= 5
        assert recommendation["product_context"] == {
            "category": "bags",
            "platform": "shopee",
            "market": "MY",
            "trend": {
                "search_volume": 1800,
                "trend_direction": None,
                "seasonal": False,
                "keywords": ["越南风编织包"],
            },
            "pricing": {
                "avg_price_local": 39,
                "avg_price_rmb_equivalent": 19,
                "suggested_sourcing_price_rmb": "¥16.00 - ¥22.00",
                "suggested_selling_price_local": 39,
            },
            "evidence": {
                "source_ref_count": 4,
                "evidence_window": "当前数据库最新采集快照",
            },
            "media": {
                "image_url": "https://cbu01.alicdn.com/img/ibank/O1CN-real-bag-1.jpg",
                "image_count": 1,
                "source_url": "https://detail.1688.com/offer/123456.html",
                "source_label": "1688供应商品",
            },
        }
        assert recommendation["experience_notes"] == [
            {"type": "market", "title": "市场经验", "content": "MY / shopee 已有趋势、平台、供应、利润、竞品资料，可进入精细化验证。"},
            {"type": "pricing", "title": "价格经验", "content": "竞品均价 39，建议售价 39，1688 采购参考 ¥16.00 - ¥22.00。"},
            {"type": "content", "title": "内容经验", "content": "暂无内容缺口，Listing 可围绕 越南风编织包 展开标题、图片和短视频脚本。"},
            {"type": "risk", "title": "风险经验", "content": "资料完整度 6/8，仍需在刊登前复核缺失或低置信字段。"},
        ]

    asyncio.run(run_test())
