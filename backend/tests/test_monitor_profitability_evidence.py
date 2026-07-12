"""Evidence-chain API response regression tests for monitor/profitability endpoints."""

import asyncio
import sys
import types
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.v1 import content as content_api
from app.api.v1 import inventory_alerts as inventory_alerts_api
from app.api.v1 import monitor as monitor_api
from app.api.v1 import profitability as profitability_api
from app.api.v1 import smart as smart_api
from app.database import Base
from app.models import all_models  # noqa: F401
from app.models.competitor_product import CompetitorProduct
from app.models.user import User
from app.schemas.profitability import ProfitabilityRequest


def test_competitor_dashboard_empty_state_promotes_data_required_to_api_response(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'monitor-evidence.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            user = User(id="monitor-user", username="monitor", email="monitor@example.com", hashed_password="x")
            session.add(user)
            await session.commit()

            response = await monitor_api.competitor_dashboard(platform=None, current_user=user, db=session)

        await engine.dispose()

        assert response.status == "data_required"
        assert response.evidence_window == "当前竞品表快照与最近价格历史"
        assert response.data_gaps == ["competitor_products", "competitor_products.delisted_status"]
        assert response.data["status"] == "data_required"
        assert response.data["competitors"] == []

    asyncio.run(run_test())


def test_competitor_dashboard_handles_sqlite_naive_last_updated(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'monitor-naive-time.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            user = User(id="monitor-user", username="monitor", email="monitor@example.com", hashed_password="x")
            competitor = CompetitorProduct(
                user_id=user.id,
                platform="shopee",
                name="真实竞品",
                seller_name="竞品店铺",
                price=18.8,
                currency="MYR",
                market="MY",
                collection_method="manual_url",
                confidence_level="merchant_input",
                is_tracked=True,
                last_updated=datetime.now() - timedelta(hours=2),
            )
            session.add_all([user, competitor])
            await session.commit()

            response = await monitor_api.competitor_dashboard(platform=None, current_user=user, db=session)

        await engine.dispose()

        assert response.status == "ready"
        assert response.data["competitors"][0]["is_new_24h"] is True
        assert response.data["competitors"][0]["last_updated"]

    asyncio.run(run_test())


def test_profitability_missing_shipping_promotes_data_required_to_api_response(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'profitability-shipping-evidence.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            user = User(id="profit-user", username="profit", email="profit@example.com", hashed_password="x")
            session.add(user)
            await session.commit()

            response = await profitability_api.calculate_profitability(
                ProfitabilityRequest(
                    purchase_cost_rmb=18,
                    weight_g=300,
                    platform="shopee",
                    market="MY",
                    markup_pct=30,
                ),
                current_user=user,
                db=session,
            )

        await engine.dispose()

        assert response.status == "data_required"
        assert response.evidence_window == "当前请求输入"
        assert response.data_gaps == ["shipping_cost_rmb"]
        assert response.data["status"] == "data_required"

    asyncio.run(run_test())


def test_quick_profitability_disabled_promotes_data_required_to_api_response():
    response = asyncio.run(profitability_api.quick_profitability(
        purchase_cost=18,
        weight=300,
        platform="shopee",
        market="MY",
        current_user=User(id="quick-user", username="quick", email="quick@example.com", hashed_password="x"),
    ))

    assert response.status == "data_required"
    assert response.evidence_window == "当前请求输入与配置快照"
    assert response.data_gaps == ["shipping_cost_rmb", "fee_templates", "exchange_rates"]
    assert response.data["status"] == "data_required"


def test_content_generate_title_missing_ai_key_promotes_configuration_required(tmp_path, monkeypatch):
    async def skip_entitlement(*args, **kwargs):
        return None

    async def noop_finalize(*args, **kwargs):
        return None

    monkeypatch.setattr(content_api, "require_entitlement", skip_entitlement)
    monkeypatch.setattr(content_api, "_finalize_content_ai_task", noop_finalize)

    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'content-title-evidence.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            user = User(id="content-user", username="content", email="content@example.com", hashed_password="x")
            session.add(user)
            await session.commit()

            response = await content_api.generate_title(
                content_api.TitleGenRequest(
                    product_name="越南风编织包",
                    platform="shopee",
                    market="MY",
                ),
                current_user=user,
                db=session,
            )

        await engine.dispose()

        assert response.status == "configuration_required"
        assert response.evidence_window == "当前 AI 配置"
        assert response.data_gaps == ["system_config.gemini_api_key"]
        assert response.data["status"] == "configuration_required"
        assert response.data["titles"] == []

    asyncio.run(run_test())


def test_content_generate_titles_result_promotes_configuration_required(monkeypatch):
    async def skip_entitlement(*args, **kwargs):
        return None

    async def noop_finalize(*args, **kwargs):
        return None

    async def fake_generate_titles(*args, **kwargs):
        return {
            "status": "configuration_required",
            "titles": [],
            "message": "AI未配置",
            "source_refs": [],
            "evidence_window": "当前 AI 配置",
            "confidence_reason": "AI未配置",
            "data_gaps": ["system_config.gemini_api_key"],
        }

    monkeypatch.setattr(content_api, "require_entitlement", skip_entitlement)
    monkeypatch.setattr(content_api, "_finalize_content_ai_task", noop_finalize)
    monkeypatch.setattr(content_api, "generate_titles", fake_generate_titles)

    response = asyncio.run(content_api.generate_titles_five_step(
        content_api.FiveStepTitleGenRequest(
            product_name="越南风编织包",
            platform="shopee",
            market="MY",
        ),
        current_user=User(id="content-user", username="content2", email="content2@example.com", hashed_password="x"),
        db=None,
    ))

    assert response.status == "configuration_required"
    assert response.evidence_window == "当前 AI 配置"
    assert response.data_gaps == ["system_config.gemini_api_key"]
    assert response.data["status"] == "configuration_required"


def test_inventory_check_without_rules_promotes_data_required_to_api_response(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'inventory-check-evidence.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            user = User(id="inventory-user", username="inventory", email="inventory@example.com", hashed_password="x")
            session.add(user)
            await session.commit()

            response = await inventory_alerts_api.check_inventory(current_user=user, db=session)

        await engine.dispose()

        assert response.status == "data_required"
        assert response.evidence_window == "当前库存预警规则与在售 Listing 快照"
        assert response.data_gaps == ["inventory_alert_rules"]
        assert response.data["status"] == "data_required"
        assert response.data["checked"] is False

    asyncio.run(run_test())


def test_exchange_rate_refresh_without_market_currency_promotes_configuration_required(monkeypatch):
    async def no_target_markets(_db):
        return [{"id": "CN", "label": "中国", "currency": "CNY"}]

    async def noop_audit(*args, **kwargs):
        return None

    monkeypatch.setattr(smart_api.config_service, "get_markets", no_target_markets)
    monkeypatch.setattr(smart_api, "record_audit_event", noop_audit)

    response = asyncio.run(smart_api.refresh_exchange_rates(
        db=None,
        admin=User(id="admin-user", username="admin", email="admin@example.com", hashed_password="x", is_admin=True),
    ))

    assert response.status == "configuration_required"
    assert response.evidence_window == "当前市场字典配置"
    assert response.data_gaps == ["markets.currency"]
    assert response.data["status"] == "configuration_required"
    assert response.data["rates"] == []


def test_smart_profit_calculator_success_promotes_evidence_to_api_response(monkeypatch):
    async def fake_fee_templates(_db):
        return [{
            "id": "fee-1",
            "platform": "shopee",
            "market": "MY",
            "commission_pct": 6.0,
            "transaction_fee_pct": 2.0,
            "tech_service_pct": 1.0,
        }]

    async def fake_rates(_db):
        return [{"to_currency": "MYR", "rate": 0.65}]

    async def fake_markets(_db):
        return [{"id": "MY", "label": "马来西亚", "currency": "MYR"}]

    monkeypatch.setattr(smart_api, "get_fee_templates", fake_fee_templates)
    monkeypatch.setattr(smart_api, "get_latest_exchange_rates", fake_rates)
    monkeypatch.setattr(smart_api.config_service, "get_markets", fake_markets)

    response = asyncio.run(smart_api.profit_calculator(
        {"cost_rmb": 20, "shipping_rmb": 5, "markup_pct": 40, "markets": ["MY"]},
        db=None,
    ))

    assert response.status == "ready"
    assert response.evidence_window == "当前请求输入 + 当前费率模板 + 最新汇率记录"
    assert response.data_gaps == []
    assert response.data["status"] == "ready"
    assert response.data["results"][0]["platform"] == "shopee"


def test_discovery_recommend_empty_ai_response_promotes_data_required(tmp_path, monkeypatch):
    async def fake_api_key(_db):
        return "test-key"

    async def skip_entitlement(*args, **kwargs):
        return None

    async def noop_finalize(*args, **kwargs):
        return None

    class FakeModels:
        def generate_content(self, *args, **kwargs):
            return types.SimpleNamespace(text="")

    class FakeClient:
        def __init__(self, *args, **kwargs):
            self.models = FakeModels()

    google_module = types.ModuleType("google")
    genai_module = types.ModuleType("google.genai")
    genai_module.Client = FakeClient
    google_module.genai = genai_module

    monkeypatch.setitem(sys.modules, "google", google_module)
    monkeypatch.setitem(sys.modules, "google.genai", genai_module)
    monkeypatch.setattr("app.api.v1.discovery.get_gemini_key", fake_api_key)
    monkeypatch.setattr("app.api.v1.discovery.require_entitlement", skip_entitlement)
    monkeypatch.setattr("app.api.v1.discovery.finalize_ai_task_result", noop_finalize)

    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'discovery-empty-ai.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            user = User(id="discovery-ai-user", username="discai", email="discai@example.com", hashed_password="x")
            session.add(user)
            await session.commit()

            response = await discovery_api.ai_recommend(
                discovery_api.RecommendRequest(prompt="请分析这个商品"),
                current_user=user,
                db=session,
            )

        await engine.dispose()

        assert response.status == "data_required"
        assert response.evidence_window == "当前请求输入"
        assert response.data_gaps == ["ai_generation_result"]
        assert response.data["status"] == "data_required"
        assert response.data["content"] == ""

    from app.api.v1 import discovery as discovery_api

    asyncio.run(run_test())
