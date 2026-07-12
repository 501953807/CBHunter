"""Tests for truthful content generation and CSV export inputs."""

import asyncio
import inspect
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.v1.collect import CollectHotProductRequest, CollectToSourcingRequest
from app.api.v1.content import CSVExportItem
from app.api.v1.pricing import recommend_price
from app.api.v1.scout import DecisionRequest, execute_decision, list_captured_trending_products
from app.database import Base
from app.models import all_models  # noqa: F401
from app.models.sourcing_item import SourcingItem
from app.models.supply_product import SupplyProduct
from app.models.user import User
from app.services.content_workbench_service import get_content_workbench
from app.services import content_service
from app.services import title_service


def test_csv_export_item_requires_confirmed_stock_and_weight():
    with pytest.raises(ValidationError):
        CSVExportItem(sku="SKU-1", name="商品", price=12.5)

    with pytest.raises(ValidationError):
        CSVExportItem(
            sku="SKU-1",
            name="商品",
            price=12.5,
            stock=-1,
            weight_g=200,
        )


def test_video_plan_without_ai_returns_no_generated_content(monkeypatch):
    async def no_api_key(_db):
        return None

    monkeypatch.setattr(content_service, "get_gemini_key", no_api_key)

    result = asyncio.run(content_service.generate_video_content_plan(None, {
        "product_name": "测试商品",
        "platform": "shopee",
        "market": "MY",
    }))

    assert result["status"] == "configuration_required"
    assert result["scripts"] == []
    assert result["hashtags"] == []
    assert result["calendar"] == []
    assert result["source_refs"] == []


def test_collection_keeps_unknown_sales_empty_and_requires_real_sourcing_price():
    item = CollectHotProductRequest(
        platform="shopee",
        market="MY",
        product_name="测试商品",
    )
    assert item.sales_volume is None

    with pytest.raises(ValidationError):
        CollectToSourcingRequest(product_name="测试商品", source_price_rmb=0)


def test_pricing_rejects_missing_source_price():
    with pytest.raises(HTTPException) as exc:
        asyncio.run(recommend_price({
            "platform": "shopee",
            "market": "MY",
            "target_profit_pct": 20,
            "pricing_mode": "cost_based",
        }, None))

    assert exc.value.status_code == 400


def test_pricing_missing_fee_names_platform_market_and_currency(monkeypatch):
    class EmptyResult:
        def scalar_one_or_none(self):
            return None

    class FakeDb:
        async def execute(self, _query):
            return EmptyResult()

    async def markets(_db):
        return [{"id": "TH", "label": "泰国", "currency": "THB"}]

    monkeypatch.setattr("app.api.v1.pricing.config_service.get_markets", markets)

    result = asyncio.run(recommend_price({
        "source_price_rmb": 100,
        "platform": "shopee",
        "market": "TH",
        "target_profit_pct": 20,
        "pricing_mode": "cost_based",
    }, FakeDb()))

    assert result.status == "configuration_required"
    assert "shopee TH 泰国 THB 费率未配置" in result.data["note"]


def test_pricing_uses_selected_margin_basis_and_returns_real_net_profit():
    fee = SimpleNamespace(
        id="fee-1",
        commission_pct=10.0,
        transaction_fee_pct=2.0,
        tech_service_pct=3.0,
    )

    class FakeResult:
        def scalar_one_or_none(self):
            return fee

    class FakeDb:
        async def execute(self, _query):
            return FakeResult()

    cost_based = asyncio.run(recommend_price({
        "source_price_rmb": 100,
        "platform": "shopee",
        "market": "MY",
        "target_profit_pct": 20,
        "pricing_mode": "cost_based",
    }, FakeDb()))
    selling_based = asyncio.run(recommend_price({
        "source_price_rmb": 100,
        "platform": "shopee",
        "market": "MY",
        "target_profit_pct": 20,
        "pricing_mode": "selling_based",
    }, FakeDb()))

    cost_rec = cost_based.data["recommendations"]["conservative"]
    selling_rec = selling_based.data["recommendations"]["conservative"]
    assert cost_rec["selling_price"] == 141.18
    assert cost_rec["net_profit_rmb"] == 20.0
    assert selling_rec["selling_price"] == 153.85
    assert selling_rec["net_profit_pct"] == 20.0
    assert cost_based.status == "ready"
    assert len(cost_based.source_refs) == 2


def test_captured_trending_page_size_supports_frontend_batch_request():
    page_size = inspect.signature(list_captured_trending_products).parameters["page_size"].default

    assert any(getattr(rule, "le", None) == 200 for rule in page_size.metadata)


def test_decision_matrix_uses_ten_point_thresholds_for_counts(monkeypatch):
    async def policy(_db):
        return {
            "green_threshold": 70,
            "yellow_threshold": 50,
            "green_required": 6,
            "yellow_required": 4,
            "dimensions": [
                {"key": "weight", "label": "产品重量", "help": ""},
                {"key": "competition", "label": "竞争程度", "help": ""},
                {"key": "margin", "label": "毛利率", "help": ""},
                {"key": "video_show", "label": "视频展示性", "help": ""},
                {"key": "seasonality", "label": "季节性", "help": ""},
                {"key": "supplier_count", "label": "供应商数", "help": ""},
                {"key": "repurchase", "label": "复购潜力", "help": ""},
                {"key": "pain_point", "label": "差评可改进度", "help": ""},
                {"key": "price", "label": "采购价格", "help": ""},
            ],
            "decisions": {
                "green": {"label": "绿灯", "action": "推进"},
                "yellow": {"label": "黄灯", "action": "验证"},
                "red": {"label": "红灯", "action": "暂缓"},
            },
        }

    async def no_audit(*_args, **_kwargs):
        return None

    monkeypatch.setattr("app.api.v1.scout._get_decision_policy", policy)
    monkeypatch.setattr("app.api.v1.scout.record_audit_event", no_audit)

    response = asyncio.run(execute_decision(
        DecisionRequest(
            weight=7,
            competition=6,
            margin=3,
            video_show=8,
            seasonality=4,
            supplier_count=1,
            repurchase=9,
            pain_point=5,
            price=2,
        ),
        current_user=SimpleNamespace(id="user-a", username="admin"),
        db=None,
    ))

    assert response.data["policy"] == {"green_threshold": 7, "yellow_threshold": 4}
    assert response.data["average_score"] == 5.0
    assert response.data["green_count"] == 3
    assert response.data["yellow_count"] == 3
    assert response.data["red_count"] == 3


def test_decision_matrix_requires_visible_candidate_context(monkeypatch):
    async def policy(_db):
        return {
            "green_threshold": 7,
            "yellow_threshold": 4,
            "green_required": 6,
            "yellow_required": 4,
            "dimensions": [
                {"key": "weight", "label": "产品重量", "help": ""},
                {"key": "competition", "label": "竞争程度", "help": ""},
                {"key": "margin", "label": "毛利率", "help": ""},
                {"key": "video_show", "label": "视频展示性", "help": ""},
                {"key": "seasonality", "label": "季节性", "help": ""},
                {"key": "supplier_count", "label": "供应商数", "help": ""},
                {"key": "repurchase", "label": "复购潜力", "help": ""},
                {"key": "pain_point", "label": "差评可改进度", "help": ""},
                {"key": "price", "label": "采购价格", "help": ""},
            ],
            "decisions": {
                "green": {"label": "绿灯", "action": "推进"},
                "yellow": {"label": "黄灯", "action": "验证"},
                "red": {"label": "红灯", "action": "暂缓"},
            },
        }

    async def no_audit(*_args, **_kwargs):
        return None

    monkeypatch.setattr("app.api.v1.scout._get_decision_policy", policy)
    monkeypatch.setattr("app.api.v1.scout.record_audit_event", no_audit)

    response = asyncio.run(execute_decision(
        DecisionRequest(
            weight=8,
            competition=7,
            margin=8,
            video_show=7,
            seasonality=8,
            supplier_count=6,
            repurchase=7,
            pain_point=6,
            price=8,
            work_item_id="supply_product:supply-a",
            object_refs=[{"type": "supply_product", "id": "supply-a", "label": "越南风编织包"}],
            product_name="越南风编织包",
            target_platform="shopee",
            target_market="MY",
        ),
        current_user=SimpleNamespace(id="user-a", username="admin"),
        db=None,
    ))

    assert response.data["product_context"] == {
        "work_item_id": "supply_product:supply-a",
        "object_refs": [{"type": "supply_product", "id": "supply-a", "label": "越南风编织包"}],
        "product_name": "越南风编织包",
        "target_platform": "shopee",
        "target_market": "MY",
    }
    assert any(
        ref.type == "supply_product" and ref.id == "supply-a" and ref.label == "越南风编织包"
        for ref in response.source_refs
    )


def test_green_decision_promotes_supply_candidate_to_content_queue(monkeypatch, tmp_path):
    async def policy(_db):
        return {
            "green_threshold": 7,
            "yellow_threshold": 4,
            "green_required": 6,
            "yellow_required": 4,
            "dimensions": [],
            "decisions": {
                "green": {"label": "绿灯", "action": "推进内容制作"},
                "yellow": {"label": "黄灯", "action": "验证"},
                "red": {"label": "红灯", "action": "暂缓"},
            },
        }

    monkeypatch.setattr("app.api.v1.scout._get_decision_policy", policy)
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'green-content.db'}")
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    async def run_test():
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            user = User(id="green-user", username="green_admin", email="green@example.com", hashed_password="x")
            supply = SupplyProduct(
                user_id=user.id,
                name="绿灯编织包",
                category_path="bags",
                price_min=16,
                price_max=20,
                product_url="https://detail.1688.com/offer/green.html",
                is_active=True,
            )
            session.add_all([user, supply])
            await session.commit()

            response = await execute_decision(
                DecisionRequest(
                    weight=8,
                    competition=8,
                    margin=8,
                    video_show=8,
                    seasonality=8,
                    supplier_count=8,
                    repurchase=8,
                    pain_point=8,
                    price=8,
                    work_item_id=f"supply_product:{supply.id}",
                    object_refs=[{"type": "supply_product", "id": supply.id, "label": supply.name}],
                    product_name=supply.name,
                    target_platform="shopee",
                    target_market="MY",
                ),
                current_user=user,
                db=session,
            )
            result = await session.execute(select(SourcingItem).where(SourcingItem.user_id == user.id))
            promoted = result.scalar_one()
            workbench = await get_content_workbench(session, user.id)

            assert response.data["decision"] == "green_light"
            assert response.data["content_queue_item"]["id"] == promoted.id
            assert promoted.pipeline_stage == "content_required"
            assert promoted.product_name == "绿灯编织包"
            assert workbench["items"][0]["id"] == promoted.id
        await engine.dispose()

    asyncio.run(run_test())


def test_title_generation_without_runtime_platform_rule_returns_no_titles(monkeypatch):
    async def no_platforms(_db):
        return []

    monkeypatch.setattr(title_service.config_service, "get_platforms", no_platforms)
    result = asyncio.run(title_service.generate_titles(
        None,
        "user-a",
        {"product_name": "真实商品", "platform": "missing", "market": "MY"},
    ))

    assert result["status"] == "configuration_required"
    assert result["titles"] == []


def test_rule_title_builder_does_not_append_fixed_popular_tags():
    titles = title_service._build_titles(
        "真实商品",
        ["真实商品", "轻便"],
        [],
        [],
        {"max_chars": 150},
    )

    assert all("#fyp" not in title and "#trending" not in title for title in titles)
