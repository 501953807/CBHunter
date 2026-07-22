"""Regression tests for runtime dictionaries and explicit profitability inputs."""

import asyncio
import json
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.v1 import inventory_alerts as inventory_alerts_api
from app.api.v1 import settings as settings_api
from app.api.v1 import sourcing as sourcing_api
from app.database import Base
from app.models import all_models  # noqa: F401
from app.models.exchange_rate import ExchangeRate
from app.models.sourcing_item import SourcingItem
from app.models.sys_dict import SysDictItem
from app.models.user import User
from app.schemas.profitability import ProfitabilityRequest
from app.schemas.inventory_alert import InventoryAlertRuleCreate
from app.services.config_service import get_all_config, get_dictionary_admin_config, get_exchange_rates, get_platform_product_field_groups
from app.services.sourcing_service import advance_stage, get_pipeline_summary
from app.services.smart_radar_service import get_latest_exchange_rates
from app.services.sys_dict_service import seed_sys_dict


def test_runtime_config_does_not_silently_fallback_to_seed_file(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'empty-config.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            config = await get_all_config(session)
        await engine.dispose()
        assert config["platforms"] == []
        assert config["markets"] == []
        assert config["categories"] == []
        assert len(config["unified_field_dictionary"]["fields"]) == 108
        assert "product_title" in {item["key"] for item in config["unified_field_dictionary"]["fields"]}

    asyncio.run(run_test())


def test_profitability_requires_merchant_markup_input():
    with pytest.raises(ValidationError):
        ProfitabilityRequest(
            purchase_cost_rmb=10,
            weight_g=100,
            platform="shopee",
            market="MY",
            shipping_cost_rmb=5,
        )


def test_default_platform_and_market_runtime_parameters_are_structured():
    config_path = Path(__file__).resolve().parents[1] / "app" / "data" / "default_dictionaries.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))

    content_platforms = [
        item for item in config["platforms"]
        if "content" in item.get("capabilities", [])
    ]
    assert content_platforms
    assert {item["id"] for item in config["platforms"]} == {"shopee", "temu", "tiktok"}
    assert {item["id"] for item in config["markets"]} == {"MY", "PH", "SG", "TH", "VN", "ID"}
    assert all(item.get("title_rule", {}).get("max_chars") for item in content_platforms)
    assert all(item.get("locale") for item in config["markets"])
    assert {item["id"] for item in config["competitor_alert_conditions"]} == {
        "price_drop", "price_rise", "delisted",
    }
    assert {item["id"] for item in config["warehouse_service_types"]} == {
        "freight_forwarder", "light_cloud_warehouse", "platform_pickup",
    }
    assert {item["id"] for item in config["warehouse_integration_statuses"]} == {
        "manual", "api_pending", "api_ready",
    }
    assert {item["id"] for item in config["warehouse_inventory_sync_modes"]} == {
        "order_shipment_link", "listing_alert_link", "manual_check",
    }
    assert {item["id"] for item in config["inventory_alert_severities"]} == {
        "info", "warning", "critical",
    }
    assert {item["id"] for item in config["inventory_alert_statuses"]} == {
        "open", "acknowledged", "cleared",
    }
    assert {item["id"] for item in config["order_statuses"]} >= {
        "pending", "processing", "shipped", "delivered", "completed", "cancelled", "refunded", "on_hold",
    }
    assert all("variant" in item for item in config["order_statuses"])
    assert any(item.get("is_exception") for item in config["order_statuses"])
    assert {item["id"] for item in config["shipment_statuses"]} >= {
        "draft", "shipped", "in_transit", "out_for_delivery", "delivered", "exception", "returned",
    }
    assert all("variant" in item for item in config["shipment_statuses"])
    assert {item["id"] for item in config["product_statuses"]} >= {
        "draft", "active", "inactive", "archived",
    }
    assert all("variant" in item for item in config["product_statuses"])
    assert {item["id"] for item in config["platform_listing_statuses"]} >= {
        "draft", "active", "paused", "rejected",
    }
    assert all("variant" in item for item in config["platform_listing_statuses"])
    assert {item["id"] for item in config["ai_suggestion_severities"]} == {
        "critical", "warning", "info",
    }
    assert {item["id"] for item in config["trend_directions"]} == {
        "rising", "falling", "stable", "seasonal",
    }
    assert {item["id"] for item in config["competition_levels"]} == {
        "low", "medium", "high",
    }
    assert {item["id"] for item in config["signal_heat_levels"]} == {
        "normal", "attention", "hot", "explosive",
    }
    assert all("min" in item and "tone" in item for item in config["signal_heat_levels"])


def test_warehouse_runtime_options_are_served_by_unified_config(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'warehouse-options.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            await seed_sys_dict(session)
            config = await get_all_config(session)
            admin_config = await get_dictionary_admin_config(session)
        await engine.dispose()

        assert {item["id"] for item in config["warehouse_service_types"]} == {
            "freight_forwarder", "light_cloud_warehouse", "platform_pickup",
        }
        assert {item["id"] for item in config["warehouse_integration_statuses"]} == {
            "manual", "api_pending", "api_ready",
        }
        assert {item["id"] for item in config["warehouse_inventory_sync_modes"]} == {
            "order_shipment_link", "listing_alert_link", "manual_check",
        }
        assert {
            item["id"] for item in admin_config["definitions"]
        } >= {
            "warehouse_service_types",
            "warehouse_integration_statuses",
            "warehouse_inventory_sync_modes",
        }

    asyncio.run(run_test())


def test_inventory_alert_runtime_options_are_served_by_unified_config(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'inventory-alert-options.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            await seed_sys_dict(session)
            config = await get_all_config(session)
            admin_config = await get_dictionary_admin_config(session)
        await engine.dispose()

        assert {item["id"] for item in config["inventory_alert_severities"]} == {
            "info", "warning", "critical",
        }
        assert {item["id"] for item in config["inventory_alert_statuses"]} == {
            "open", "acknowledged", "cleared",
        }
        assert {
            item["id"] for item in admin_config["definitions"]
        } >= {
            "inventory_alert_severities",
            "inventory_alert_statuses",
        }

    asyncio.run(run_test())


def test_domain_status_options_are_served_by_unified_config(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'domain-status-options.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            await seed_sys_dict(session)
            config = await get_all_config(session)
            admin_config = await get_dictionary_admin_config(session)
        await engine.dispose()

        assert {item["id"] for item in config["order_statuses"]} >= {"pending", "processing", "shipped"}
        assert next(item for item in config["order_statuses"] if item["id"] == "pending")["allowed_next"] == [
            "processing", "cancelled",
        ]
        assert {item["id"] for item in config["shipment_statuses"]} >= {"draft", "in_transit", "delivered"}
        assert {item["id"] for item in config["product_statuses"]} >= {"draft", "active", "archived"}
        assert {item["id"] for item in config["platform_listing_statuses"]} >= {"draft", "active", "paused"}
        assert {item["id"] for item in config["ai_suggestion_severities"]} == {
            "critical", "warning", "info",
        }
        assert {
            item["id"] for item in admin_config["definitions"]
        } >= {
            "order_statuses",
            "shipment_statuses",
            "product_statuses",
            "platform_listing_statuses",
            "ai_suggestion_severities",
        }

    asyncio.run(run_test())


def test_signal_capture_options_are_served_by_unified_config(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'signal-capture-options.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            await seed_sys_dict(session)
            config = await get_all_config(session)
            admin_config = await get_dictionary_admin_config(session)
        await engine.dispose()

        assert [item["id"] for item in config["trend_directions"]] == [
            "rising", "falling", "stable", "seasonal",
        ]
        assert [item["id"] for item in config["competition_levels"]] == [
            "low", "medium", "high",
        ]
        heat_levels = config["signal_heat_levels"]
        assert [item["id"] for item in heat_levels] == ["normal", "attention", "hot", "explosive"]
        assert next(item for item in heat_levels if item["id"] == "hot")["min"] == 60
        assert {
            item["id"] for item in admin_config["definitions"]
        } >= {
            "trend_directions",
            "competition_levels",
            "signal_heat_levels",
        }

    asyncio.run(run_test())


def test_sourcing_pipeline_stages_are_served_by_unified_config(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'sourcing-pipeline-options.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            await seed_sys_dict(session)
            config = await get_all_config(session)
            admin_config = await get_dictionary_admin_config(session)
        await engine.dispose()

        assert [item["id"] for item in config["sourcing_pipeline_stages"]] == [
            "discovery",
            "jit_testing",
            "jit_passed",
            "price_review",
            "vmi",
            "active",
            "discontinued",
        ]
        assert next(item for item in config["sourcing_pipeline_stages"] if item["id"] == "discovery")["allowed_next"] == [
            "jit_testing", "active", "discontinued",
        ]
        assert {
            item["id"] for item in admin_config["definitions"]
        } >= {"sourcing_pipeline_stages"}

    asyncio.run(run_test())


def test_sourcing_stage_endpoint_reads_runtime_dictionary(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'sourcing-stage-endpoint.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            await seed_sys_dict(session)
            discovery_result = await session.execute(
                select(SysDictItem).where(SysDictItem.id == "sourcing_pipeline_stage_discovery")
            )
            discovery = discovery_result.scalar_one()
            discovery.extra = {**(discovery.extra or {}), "allowed_next": ["jit_testing", "active", "discontinued", "pilot_run"]}
            flag_modified(discovery, "extra")
            session.add(SysDictItem(
                id="sourcing_pipeline_stage_pilot_run",
                type="sourcing_pipeline_stage",
                label="小批试跑",
                extra={"value": "pilot_run"},
                sort_order=95,
                is_active=True,
            ))
            await session.commit()

            response = await sourcing_api.list_pipeline_stages(db=session)
        await engine.dispose()

        assert {item["key"] for item in response.data} >= {"discovery", "pilot_run"}
        assert next(item for item in response.data if item["key"] == "pilot_run")["label"] == "小批试跑"

    asyncio.run(run_test())


def test_sourcing_stage_endpoint_does_not_import_code_level_stage_options():
    root = Path(__file__).resolve().parents[1]
    source = (root / "app/api/v1/sourcing.py").read_text(encoding="utf-8")
    assert "from app.services.sourcing_service import PIPELINE_STAGES" not in source
    assert "dictionaries.get(\"sourcing_pipeline_stages\"" in source


def test_sourcing_stage_transition_reads_runtime_dictionary_rules(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'sourcing-stage-transition.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            await seed_sys_dict(session)
            discovery_result = await session.execute(
                select(SysDictItem).where(SysDictItem.id == "sourcing_pipeline_stage_discovery")
            )
            discovery = discovery_result.scalar_one()
            discovery.extra = {**(discovery.extra or {}), "allowed_next": ["jit_testing", "active", "discontinued", "pilot_run"]}
            flag_modified(discovery, "extra")
            session.add(SysDictItem(
                id="sourcing_pipeline_stage_pilot_run",
                type="sourcing_pipeline_stage",
                label="小批试跑",
                extra={"value": "pilot_run", "allowed_next": ["active"]},
                sort_order=95,
                is_active=True,
            ))
            item = SourcingItem(
                user_id="stage-user",
                product_name="运行时阶段商品",
                pipeline_stage="discovery",
                source_price_rmb=12,
                platform="shopee",
                market="PH",
            )
            session.add(item)
            await session.commit()

            updated, error = await advance_stage(session, item.id, "stage-user", "pilot_run")
        await engine.dispose()

        assert error is None
        assert updated is not None
        assert updated.pipeline_stage == "pilot_run"

    asyncio.run(run_test())


def test_sourcing_pipeline_summary_counts_runtime_dictionary_stages(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'sourcing-stage-summary.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            await seed_sys_dict(session)
            session.add(SysDictItem(
                id="sourcing_pipeline_stage_pilot_run",
                type="sourcing_pipeline_stage",
                label="小批试跑",
                extra={"value": "pilot_run", "allowed_next": ["active"]},
                sort_order=95,
                is_active=True,
            ))
            session.add(SourcingItem(
                user_id="stage-summary-user",
                product_name="小批试跑商品",
                pipeline_stage="pilot_run",
                platform="shopee",
                market="PH",
            ))
            await session.commit()

            summary = await get_pipeline_summary(session, "stage-summary-user")
        await engine.dispose()

        assert summary["total"] == 1
        assert summary["pilot_run"] == 1

    asyncio.run(run_test())


def test_trend_pipeline_frontend_does_not_export_local_stage_options():
    root = Path(__file__).resolve().parents[2]
    source = (root / "frontend/src/features/trend-discovery/TrendPipelineUtils.ts").read_text(encoding="utf-8")
    assert "PIPELINE_STAGE_OPTIONS" not in source


def test_inventory_alert_request_requires_runtime_severity():
    with pytest.raises(ValidationError):
        InventoryAlertRuleCreate(product_id="p1", sku="SKU-1", product_name="商品")


def test_inventory_alert_api_rejects_unknown_runtime_options(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'inventory-alert-validation.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            await seed_sys_dict(session)
            user = User(id="alert-user", username="alert", email="alert@example.com", hashed_password="x")
            session.add(user)
            await session.commit()
            req = InventoryAlertRuleCreate(
                product_id="product-1",
                sku="SKU-1",
                product_name="商品",
                severity="urgent",
            )
            with pytest.raises(inventory_alerts_api.HTTPException) as create_exc:
                await inventory_alerts_api.create_rule(req, current_user=user, db=session)
            with pytest.raises(inventory_alerts_api.HTTPException) as list_exc:
                await inventory_alerts_api.list_alerts(
                    status="unknown",
                    severity=None,
                    page=1,
                    page_size=20,
                    current_user=user,
                    db=session,
                )
        await engine.dispose()

        assert create_exc.value.status_code == 400
        assert "库存预警级别" in create_exc.value.detail
        assert list_exc.value.status_code == 400
        assert "库存预警状态" in list_exc.value.detail

    asyncio.run(run_test())


def test_warehouse_request_requires_runtime_dictionary_options():
    with pytest.raises(ValidationError):
        settings_api.WarehouseItem(name="测试仓", address="地址")


def test_warehouse_request_rejects_unknown_runtime_option(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'warehouse-validation.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            await seed_sys_dict(session)
            user = User(id="warehouse-user", username="warehouse", email="warehouse@example.com", hashed_password="x")
            session.add(user)
            await session.commit()
            req = settings_api.WarehouseItem(
                name="测试仓",
                address="地址",
                service_type="unknown_type",
                integration_status="manual",
                inventory_sync_mode="order_shipment_link",
            )
            with pytest.raises(settings_api.HTTPException) as exc:
                await settings_api.create_warehouse(req, current_user=user, db=session)
        await engine.dispose()

        assert exc.value.status_code == 400
        assert "仓储服务类型" in exc.value.detail

    asyncio.run(run_test())


def test_exchange_rates_are_scoped_to_approved_southeast_asia_markets(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'exchange-scope.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            await seed_sys_dict(session)
            session.add_all([
                ExchangeRate(from_currency="CNY", to_currency="MYR", rate=0.65, source="test"),
                ExchangeRate(from_currency="CNY", to_currency="USD", rate=0.14, source="test"),
                ExchangeRate(from_currency="CNY", to_currency="TWD", rate=4.50, source="test"),
            ])
            await session.commit()

            config_rates = await get_exchange_rates(session)
            smart_rates = await get_latest_exchange_rates(session)
        await engine.dispose()

        assert {item["to_currency"] for item in config_rates} == {"MYR"}
        assert {item["to_currency"] for item in smart_rates} == {"MYR"}

    asyncio.run(run_test())


def test_platform_product_field_groups_have_evidence_registry():
    config_path = Path(__file__).resolve().parents[1] / "app" / "data" / "default_platform_product_field_groups.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))

    assert set(config.keys()) == {"shopee", "temu", "tiktok"}
    for platform, schema in config.items():
        evidence = schema.get("evidence")
        assert evidence, f"{platform} field schema must keep structured evidence"
        assert evidence.get("platform") == platform
        assert evidence.get("source_page")
        assert evidence.get("observed_at") == "2026-07-09"
        assert evidence.get("evidence_scope") in {"list_and_edit", "list_and_create_category", "list_only"}
        assert evidence.get("confidence") in {"confirmed", "partial"}
        assert isinstance(evidence.get("needs_recheck"), list)
        assert schema.get("evidence_source") == evidence.get("summary")


def test_unified_field_dictionary_preserves_v5_field_standard():
    config_path = Path(__file__).resolve().parents[1] / "app" / "data" / "default_unified_field_dictionary.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    fields = config.get("fields", [])
    by_key = {item["key"]: item for item in fields}

    assert config.get("source") == "CBHunter V5.0 03 字段标准对照表"
    assert len(fields) == 108
    for key in ("product_title", "product_images", "sku_price", "order_status", "currency_code", "clear_image_status"):
        assert key in by_key
    for item in fields:
        assert item.get("label")
        assert item.get("data_type")
        assert set((item.get("platforms") or {}).keys()) == {"shopee", "tiktok", "temu", "miaoshou"}
    assert by_key["product_title"]["platforms"]["shopee"]["field"]
    assert by_key["product_title"]["platforms"]["tiktok"]["field"]
    assert by_key["product_title"]["platforms"]["temu"]["field"]
    assert by_key["product_title"]["platforms"]["miaoshou"]["field"]
    assert by_key["sku_price"]["country_difference"] == "Temu为供货价"


def test_platform_field_groups_are_enriched_by_unified_field_dictionary(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'field-dictionary.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            schemas = await get_platform_product_field_groups(session)
        await engine.dispose()

        shopee_fields = {
            field["key"]: field
            for group in schemas["shopee"]["groups"]
            for field in group.get("fields", [])
        }
        tiktok_fields = {
            field["key"]: field
            for group in schemas["tiktok"]["groups"]
            for field in group.get("fields", [])
        }
        temu_fields = {
            field["key"]: field
            for group in schemas["temu"]["groups"]
            for field in group.get("fields", [])
        }

        assert shopee_fields["selling_price"]["unified_field_key"] == "sku_price"
        assert shopee_fields["selling_price"]["data_type"] == "decimal"
        assert shopee_fields["selling_price"]["platform_field_name"]
        assert shopee_fields["selling_price"]["miaoshou_field_name"]
        assert tiktok_fields["main_image"]["unified_field_key"] == "product_images"
        assert temu_fields["declared_price_cny"]["unified_field_key"] == "supply_price_cny"
        assert temu_fields["declared_price_cny"]["country_difference"] == "仅Temu"

    asyncio.run(run_test())


def test_unconfirmed_platform_fields_are_not_marked_required():
    config_path = Path(__file__).resolve().parents[1] / "app" / "data" / "default_platform_product_field_groups.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))

    tiktok_fields = {
        field["key"]: field
        for group in config["tiktok"]["groups"]
        for field in group.get("fields", [])
    }
    assert tiktok_fields["main_image"].get("evidence_state") == "needs_edit_page_recheck"
    assert tiktok_fields["short_video_required"].get("evidence_state") == "needs_edit_page_recheck"
    assert not tiktok_fields["main_image"].get("required")
    assert not tiktok_fields["short_video_required"].get("required")

    temu_fields = {
        field["key"]: field
        for group in config["temu"]["groups"]
        for field in group.get("fields", [])
    }
    assert temu_fields["product_name_cn"].get("evidence_state") == "needs_category_recheck"
    assert not temu_fields["product_name_cn"].get("required")
