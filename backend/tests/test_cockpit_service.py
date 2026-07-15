"""Operating cockpit truthfulness and isolation regression tests."""

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models import all_models  # noqa: F401
from app.models.ai_suggestion import AISuggestion
from app.models.finance_ledger import FinanceLedgerEntry
from app.models.inventory_alert import InventoryAlertLog, InventoryAlertRule
from app.models.notification import Notification
from app.models.operation_record import OperationRecord
from app.models.order import Order
from app.models.platform_account import PlatformAccount
from app.models.platform_listing import PlatformListing
from app.models.product import Product
from app.models.sourcing_item import SourcingItem
from app.models.user import User
from app.schemas.risk_control import RiskStateUpdateRequest
from app.schemas.business_flow import (
    BusinessFlowTaskBulkRequest,
    BusinessFlowTaskCommentRequest,
    BusinessFlowTaskCompleteReviewRequest,
    BusinessFlowTaskItemRef,
)
from app.services.business_flow_service import get_business_flow_overview
from app.services.business_flow_task_service import (
    add_flow_task_comment,
    bulk_update_flow_tasks,
    complete_flow_task_with_review,
    list_flow_task_assignees,
    list_flow_task_events,
)
from app.services.cockpit_service import _window, get_operating_cockpit
from app.services.risk_control_service import get_risk_control_overview, get_risk_event_audit, update_risk_event_state


def test_cockpit_window_displays_inclusive_end_date():
    start = datetime(2026, 6, 15, tzinfo=timezone.utc)
    end_exclusive = datetime(2026, 7, 15, tzinfo=timezone.utc)
    assert _window(start, end_exclusive) == "2026-06-15T00:00:00+00:00 至 2026-07-14T23:59:59.999999+00:00"


def test_cockpit_uses_owned_records_and_keeps_unknown_stock_out(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'cockpit.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        now = datetime.now(timezone.utc)
        async with sessions() as session:
            account = PlatformAccount(user_id="user-a", platform="shopee", account_name="真实店铺")
            other_account = PlatformAccount(user_id="user-b", platform="temu", account_name="其他店铺")
            product = Product(user_id="user-a", sku="SKU-A", name="真实商品")
            session.add_all([account, other_account, product])
            await session.flush()
            rule = InventoryAlertRule(
                user_id="user-a", product_id=product.id, sku="SKU-A",
                product_name="真实商品", safety_stock=10, severity="critical",
            )
            session.add(rule)
            await session.flush()
            order = Order(
                user_id="user-a", platform_account_id=account.id, platform_order_id="ORDER-A",
                status="completed", total=100, currency="MYR", ordered_at=now,
            )
            session.add_all([
                order,
                Order(
                    user_id="user-b", platform_account_id=other_account.id, platform_order_id="ORDER-B",
                    status="completed", total=999, currency="CNY", ordered_at=now,
                ),
                FinanceLedgerEntry(
                    user_id="user-a", entry_type="sales_income", amount_rmb=50, occurred_at=now,
                    platform="shopee", market="unknown", extra={"platform_account_id": account.id},
                ),
                FinanceLedgerEntry(
                    user_id="user-a", entry_type="purchase_cost", amount_rmb=20, occurred_at=now,
                    platform="shopee", market="unknown", extra={"platform_account_id": account.id},
                ),
                FinanceLedgerEntry(
                    user_id="user-b", entry_type="sales_income", amount_rmb=777, occurred_at=now,
                    platform="temu", market="unknown", extra={"platform_account_id": other_account.id},
                ),
                PlatformListing(
                    user_id="user-a", product_id=product.id, platform_account_id=account.id,
                    title="已确认库存", price=20, stock=7, status="active",
                    platform_data={"stock_status": "confirmed"},
                ),
                PlatformListing(
                    user_id="user-a", product_id=product.id, platform_account_id=account.id,
                    title="未知库存", price=20, stock=0, status="active",
                    platform_data={"stock_status": "missing"},
                ),
                AISuggestion(
                    user_id="user-a", suggestion_type="inventory", title="真实建议",
                    description="来自真实库存", severity="warning",
                    source_refs=[{"type": "platform_listing", "id": "listing-a"}],
                ),
                InventoryAlertLog(
                    rule_id=rule.id, user_id="user-a", product_id=product.id, sku="SKU-A",
                    product_name="真实商品", current_stock=2, threshold=10,
                    severity="critical", status="open",
                ),
                SourcingItem(
                    user_id="user-a", product_name="1688真实货源", source_name="1688",
                    source_url="https://detail.1688.com/offer/1.html",
                    source_price_rmb=12, pipeline_stage="discovery",
                ),
                SourcingItem(
                    user_id="user-a", product_name="缺上架链接商品", source_name="1688",
                    source_url="https://detail.1688.com/offer/2.html",
                    source_price_rmb=18, pipeline_stage="listed",
                ),
            ])
            await session.commit()
            cockpit = await get_operating_cockpit(session, "user-a")
            risks = await get_risk_control_overview(session, "user-a")
            flow = await get_business_flow_overview(session, "user-a")
        await engine.dispose()

        assert cockpit["sections"]["orders"]["metrics"]["order_count"] == 1
        assert cockpit["sections"]["orders"]["metrics"]["revenue_by_currency"] == [
            {"currency": "MYR", "orders": 1, "revenue": 100.0}
        ]
        assert cockpit["sections"]["finance"]["metrics"]["net_profit_rmb"] == 30
        assert cockpit["sections"]["inventory"]["metrics"]["confirmed_stock"] == 7
        assert cockpit["sections"]["inventory"]["metrics"]["unknown_stock_listings"] == 1
        assert cockpit["sections"]["store_matrix"]["metrics"]["store_count"] == 1
        assert cockpit["sections"]["store_matrix"]["items"][0]["platform"] == "shopee"
        assert cockpit["sections"]["store_matrix"]["items"][0]["order_count"] == 1
        assert cockpit["sections"]["store_matrix"]["items"][0]["active_listings"] == 2
        assert cockpit["sections"]["store_matrix"]["items"][0]["ledger_entry_count"] == 2
        assert cockpit["sections"]["store_matrix"]["items"][0]["revenue_rmb"] == 50
        assert cockpit["sections"]["store_matrix"]["items"][0]["cost_rmb"] == 20
        assert cockpit["sections"]["store_matrix"]["items"][0]["net_profit_rmb"] == 30
        assert cockpit["sections"]["store_matrix"]["metrics"]["total_revenue_rmb"] == 50
        assert cockpit["sections"]["store_matrix"]["metrics"]["total_cost_rmb"] == 20
        assert cockpit["sections"]["store_matrix"]["metrics"]["net_profit_rmb"] == 30
        assert cockpit["sections"]["risk_summary"]["metrics"]["active_risk_count"] >= 1
        assert cockpit["sections"]["risk_summary"]["items"][0]["object_type"] in {
            "inventory_alert_log", "report_anomaly", "ai_suggestion", "competitor_product", "order"
        }
        assert cockpit["sections"]["flow_summary"]["metrics"]["stage_count"] == 6
        assert any(item["stage_key"] == "fulfillment" and item["object_count"] == 1 for item in cockpit["sections"]["flow_summary"]["items"])
        assert cockpit["sections"]["orders"]["source_refs"][0]["id"] == order.id
        assert cockpit["sections"]["orders"]["source_refs"][0]["label"] == "ORDER-A"
        assert cockpit["sections"]["orders"]["source_refs"][0]["meta"]["route"] == "/orders"
        assert cockpit["sections"]["ai_suggestions"]["items"][0]["source_refs"]
        assert risks["metrics"]["pending"] >= 1
        assert risks["metrics"]["category_count"] == 6
        assert {item["key"] for item in risks["risk_categories"]} == {"account", "business", "compliance", "logistics", "currency", "inventory"}
        assert risks["risks"][0]["source_refs"][0]["id"]
        assert risks["risks"][0]["type_label"]
        assert all("ORDER-B" not in str(item) for item in risks["risks"])
        assert flow["metrics"]["stage_count"] == 6
        assert flow["metrics"]["item_count"] >= 5
        assert flow["metrics"]["item_blocked"] >= 1
        assert any(item["type"] == "sourcing_item" for item in flow["items"])
        assert any(item["type"] == "platform_listing" for item in flow["items"])
        assert any(item["type"] == "order" for item in flow["items"])
        assert any(item["type"] == "ai_suggestion" for item in flow["items"])
        assert any(item["name"] == "缺上架链接商品" and item["status"] == "blocked" for item in flow["items"])
        assert any(stage["key"] == "fulfillment" and "1 单真实订单" in stage["signal"] for stage in flow["stages"])

    asyncio.run(run_test())


def test_cockpit_distinguishes_ledger_revenue_from_platform_orders(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'ledger-only.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            session.add(FinanceLedgerEntry(
                user_id="user-ledger", entry_type="sales_income", amount_rmb=88,
                description="线下调整收入", occurred_at=datetime.now(timezone.utc),
            ))
            await session.commit()
            cockpit = await get_operating_cockpit(session, "user-ledger")
            risks = await get_risk_control_overview(session, "user-ledger")
        await engine.dispose()

        assert cockpit["sections"]["orders"]["metrics"]["order_count"] == 0
        assert cockpit["sections"]["finance"]["metrics"]["total_revenue_rmb"] == 88
        assert any("没有平台订单" in gap for gap in cockpit["sections"]["finance"]["gaps"])
        ref = cockpit["sections"]["finance"]["source_refs"][0]
        assert ref["label"] == "sales_income"
        assert ref["meta"]["source_label"] == "财务台账"
        assert risks["assessment_status"] == "insufficient"
        assert risks["metrics"]["pending"] == 0
        assert risks["gap_actions"]

    asyncio.run(run_test())


def test_cockpit_negative_profit_has_actionable_finance_gap(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'negative-profit.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            now = datetime.now(timezone.utc)
            session.add_all([
                FinanceLedgerEntry(
                    user_id="user-loss",
                    entry_type="sales_income",
                    amount_rmb=100,
                    description="真实销售收入",
                    occurred_at=now,
                ),
                FinanceLedgerEntry(
                    user_id="user-loss",
                    entry_type="purchase_cost",
                    amount_rmb=160,
                    description="真实采购成本",
                    occurred_at=now,
                ),
            ])
            await session.commit()
            cockpit = await get_operating_cockpit(session, "user-loss")
            risks = await get_risk_control_overview(session, "user-loss")
        await engine.dispose()

        finance = cockpit["sections"]["finance"]
        assert finance["metrics"]["net_profit_rmb"] == -60
        assert any("净利润为负" in gap for gap in finance["gaps"])
        assert any("核对成本" in action["label"] for action in finance["actions"])
        assert any(action["route"].startswith("/finance") for action in finance["actions"])
        assert any("净利润为负" in action["detail"] for action in risks["gap_actions"])
        assert any(action["route"] == "/finance?entry_type=platform_fee#finance-ledger" for action in risks["gap_actions"])

    asyncio.run(run_test())


def test_risk_control_uses_order_fulfillment_exception_context(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'risk-order-fulfillment.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        now = datetime.now(timezone.utc)
        async with sessions() as session:
            account = PlatformAccount(user_id="risk-order-user", platform="shopee", account_name="Shopee MY 店铺")
            session.add(account)
            await session.flush()
            order = Order(
                user_id="risk-order-user",
                platform_account_id=account.id,
                platform_order_id="SP-RISK-001",
                order_number="SP-RISK-001",
                status="ready_to_ship",
                total=88,
                currency="MYR",
                fulfillment_status="pending_pickup",
                ordered_at=now - timedelta(hours=8),
                platform_data={
                    "source": "platform",
                    "fulfillment_deadline_at": (now - timedelta(hours=1)).isoformat(),
                    "after_sales_status": "return_requested",
                },
            )
            session.add(order)
            await session.commit()
            cockpit = await get_operating_cockpit(session, "risk-order-user")
            risks = await get_risk_control_overview(session, "risk-order-user")
        await engine.dispose()

        order_item = cockpit["sections"]["orders"]["items"][0]
        assert order_item["fulfillment_exception"]["status"] == "shipping_overdue"
        assert any("发货时限已超期" in item for item in order_item["fulfillment_exception"]["reasons"])
        logistics_risks = [item for item in risks["risks"] if item["type"] == "logistics"]
        assert logistics_risks
        assert logistics_risks[0]["id"] == f"logistics:{order.id}"
        assert logistics_risks[0]["severity"] == "critical"
        assert logistics_risks[0]["route"] == "/orders?exceptions=1"
        assert "return_requested" in logistics_risks[0]["detail"]
        assert logistics_risks[0]["estimated_impact"] == "订单金额 MYR 88，可能触发取消、退款或店铺履约扣分。"
        assert logistics_risks[0]["response_deadline_at"]
        assert logistics_risks[0]["remaining_time_label"] == "已超期"
        assert logistics_risks[0]["sla_hours"] == 0

    asyncio.run(run_test())


def test_risk_control_flags_store_spend_without_sales_as_business_risk(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'store-spend-risk.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        now = datetime.now(timezone.utc)
        async with sessions() as session:
            account = PlatformAccount(
                user_id="store-risk-user",
                platform="tiktok",
                account_name="TikTok PH 店铺",
                settings={"market": "PH"},
            )
            session.add(account)
            await session.flush()
            session.add(FinanceLedgerEntry(
                user_id="store-risk-user",
                entry_type="purchase_cost",
                amount_rmb=320,
                platform="tiktok",
                market="PH",
                description="TikTok PH 首批备货投入",
                extra={"platform_account_id": account.id},
                occurred_at=now,
            ))
            await session.commit()
            cockpit = await get_operating_cockpit(session, "store-risk-user")
            risks = await get_risk_control_overview(session, "store-risk-user")
        await engine.dispose()

        store = cockpit["sections"]["store_matrix"]["items"][0]
        assert store["account_name"] == "TikTok PH 店铺"
        assert store["cost_rmb"] == 320
        assert store["revenue_rmb"] is None
        assert store["order_count"] == 0
        business_risks = [item for item in risks["risks"] if item["type"] == "business"]
        assert business_risks
        risk = business_risks[0]
        assert risk["id"] == f"business:spend-no-sales:{account.id}"
        assert risk["type_label"] == "店铺经营风险"
        assert risk["platform"] == "tiktok"
        assert risk["platform_account_id"] == account.id
        assert risk["account_name"] == "TikTok PH 店铺"
        assert risk["market"] == "PH"
        assert risk["severity"] == "warning"
        assert risk["route"] == f"/finance?platform_account_id={account.id}#finance-ledger"
        assert risk["estimated_impact"] == "店铺已投入 ¥320，但当前筛选日期范围没有订单或收入，可能造成资金占用和选品/投放策略失效。"
        assert risk["response_deadline_at"]
        assert 0 < risk["sla_hours"] <= 72
        assert risk["remaining_time_label"].startswith("剩余")
        assert any(ref["type"] == "platform_account" and ref["id"] == account.id for ref in risk["source_refs"])
        assert any(item["key"] == "business" and item["active_count"] == 1 for item in risks["risk_categories"])

    asyncio.run(run_test())


def test_cockpit_exposes_product_operation_results_for_drilldown(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'cockpit-product-ops.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            account = PlatformAccount(user_id="ops-cockpit", platform="tiktok", account_name="TikTok PH 店铺")
            product = Product(user_id="ops-cockpit", sku="SKU-OPS-CP", name="旅行洗漱包")
            session.add_all([account, product])
            await session.flush()
            listing = PlatformListing(
                user_id="ops-cockpit",
                product_id=product.id,
                platform_account_id=account.id,
                title="旅行洗漱包 TikTok Listing",
                price=88,
                stock=15,
                status="active",
                performance={"impressions_30d": 2600, "views_30d": 360, "orders_30d": 0, "sales_amount_30d": 0},
            )
            session.add(listing)
            await session.flush()
            session.add_all([
                OperationRecord(
                    user_id="ops-cockpit",
                    record_type="listing_optimization",
                    status="operation_pending",
                    name="Listing优化：旅行洗漱包 - 有浏览无订单",
                    platform="tiktok",
                    market="PH",
                    counterparty="TikTok PH 店铺",
                    planned_amount_rmb=0,
                    currency="CNY",
                    metrics={"diagnostic_code": "traffic_no_order"},
                    extra={"source": "product_operation_metric", "listing_id": listing.id, "product_id": product.id},
                ),
                OperationRecord(
                    user_id="ops-cockpit",
                    record_type="listing_optimization",
                    status="operation_completed",
                    name="Listing优化：旅行洗漱包 - 主图复盘",
                    platform="tiktok",
                    market="PH",
                    counterparty="TikTok PH 店铺",
                    planned_amount_rmb=0,
                    currency="CNY",
                    metrics={"diagnostic_code": "low_conversion", "review_result": "主图替换后点击率提升"},
                    extra={"source": "product_operation_metric", "listing_id": listing.id, "product_id": product.id, "effect_summary": "可复用到同类旅行收纳品。"},
                ),
            ])
            await session.commit()
            cockpit = await get_operating_cockpit(session, "ops-cockpit")
        await engine.dispose()

        section = cockpit["sections"]["product_operations"]
        assert section["metrics"]["listing_count"] == 1
        assert section["metrics"]["diagnosed_listing_count"] == 1
        assert section["metrics"]["pending_action_count"] == 1
        assert section["metrics"]["reviewed_action_count"] == 1
        assert section["items"][0]["listing_id"] == listing.id
        assert section["items"][0]["diagnostic_title"] == "有浏览无订单"
        assert section["items"][0]["review_result"] == "主图替换后点击率提升"
        assert any(ref["type"] == "operation_record" for ref in section["source_refs"])
        assert any(action["route"] == "/growth" for action in section["actions"])

    asyncio.run(run_test())


def test_risk_control_flags_traffic_without_orders_as_business_risk(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'traffic-no-order-risk.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            account = PlatformAccount(
                user_id="traffic-risk-user",
                platform="shopee",
                account_name="Shopee SG 店铺",
                settings={"market": "SG"},
            )
            product = Product(user_id="traffic-risk-user", sku="SKU-TRAFFIC", name="防水手机袋")
            session.add_all([account, product])
            await session.flush()
            listing = PlatformListing(
                user_id="traffic-risk-user",
                product_id=product.id,
                platform_account_id=account.id,
                title="Waterproof Phone Pouch Shopee SG",
                price=29.9,
                stock=15,
                status="active",
                performance={"views_30d": 360, "orders_30d": 0, "sales_amount_30d": 0},
            )
            session.add(listing)
            await session.commit()
            cockpit = await get_operating_cockpit(session, "traffic-risk-user")
            risks = await get_risk_control_overview(session, "traffic-risk-user")
        await engine.dispose()

        operation_items = cockpit["sections"]["product_operations"]["items"]
        assert operation_items[0]["diagnostic_code"] == "traffic_no_order"
        business_risks = [item for item in risks["risks"] if item["id"] == f"business:traffic-no-order:{listing.id}"]
        assert business_risks
        risk = business_risks[0]
        assert risk["type"] == "business"
        assert risk["type_label"] == "店铺经营风险"
        assert risk["platform"] == "shopee"
        assert risk["platform_account_id"] == account.id
        assert risk["account_name"] == "Shopee SG 店铺"
        assert risk["market"] == "SG"
        assert risk["listing_id"] == listing.id
        assert risk["route"] == f"/growth?listing_id={listing.id}"
        assert risk["estimated_impact"] == "近30天浏览 360、订单 0，库存 15 件，可能造成库存占用和 Listing/定价/主图失效。"
        assert risk["response_deadline_at"]
        assert 0 < risk["sla_hours"] <= 72
        assert any(ref["type"] == "platform_listing" and ref["id"] == listing.id for ref in risk["source_refs"])

    asyncio.run(run_test())


def test_business_flow_tasks_are_persisted_and_merged_into_queue(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'flow-tasks.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            user = User(
                id="flow-user",
                username="flow_admin",
                email="flow@example.com",
                hashed_password="x",
                is_admin=True,
            )
            session.add_all([
                user,
                SourcingItem(
                    user_id=user.id,
                    product_name="待推进货源",
                    source_name="1688",
                    source_url="https://detail.1688.com/offer/task.html",
                    source_price_rmb=16,
                    pipeline_stage="listed",
                ),
            ])
            await session.commit()

            flow = await get_business_flow_overview(session, user.id, user)
            target = next(item for item in flow["items"] if item["name"] == "待推进货源")
            assert target["task_id"] is None

            ref = BusinessFlowTaskItemRef(
                item_type=target["type"],
                item_id=target["id"],
                stage_key=target["stage_key"],
                title=target["name"],
                route=target["next_action_route"],
                source_refs=target["source_refs"],
                last_gap=target["gaps"][0],
            )
            await bulk_update_flow_tasks(session, user, BusinessFlowTaskBulkRequest(
                action="assign",
                assigned_to=user.username,
                items=[ref],
            ))
            await bulk_update_flow_tasks(session, user, BusinessFlowTaskBulkRequest(
                action="follow",
                items=[ref],
            ))

            updated = await get_business_flow_overview(session, user.id, user)
            updated_item = next(item for item in updated["items"] if item["id"] == target["id"])
            assert updated_item["task_id"]
            assert updated_item["assigned_to"] == user.username
            assert updated_item["task_status"] == "processing"
            assert updated_item["is_followed"] is True
            assert updated["metrics"]["task_count"] == 1
            assert updated["metrics"]["assigned_to_me"] == 1
            assert updated["metrics"]["followed"] == 1
        await engine.dispose()

    asyncio.run(run_test())


def test_business_flow_task_comments_and_completion_review_are_audited(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'flow-task-events.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            user = User(
                id="flow-review-user",
                username="flow_reviewer",
                email="flow-review@example.com",
                hashed_password="x",
                is_admin=True,
            )
            session.add_all([
                user,
                SourcingItem(
                    user_id=user.id,
                    product_name="待复盘货源",
                    source_name="1688",
                    source_url="https://detail.1688.com/offer/review.html",
                    source_price_rmb=18,
                    pipeline_stage="listed",
                ),
            ])
            await session.commit()

            flow = await get_business_flow_overview(session, user.id, user)
            target = next(item for item in flow["items"] if item["name"] == "待复盘货源")
            ref = BusinessFlowTaskItemRef(
                item_type=target["type"],
                item_id=target["id"],
                stage_key=target["stage_key"],
                title=target["name"],
                route=target["next_action_route"],
                source_refs=target["source_refs"],
                last_gap=target["gaps"][0],
            )
            created = await bulk_update_flow_tasks(session, user, BusinessFlowTaskBulkRequest(
                action="assign",
                assigned_to=user.username,
                items=[ref],
                note="分配给当前处理人",
            ))
            task_id = created[0]["id"]

            comment = await add_flow_task_comment(session, user, task_id, BusinessFlowTaskCommentRequest(
                comment="已核对 1688 货源和上架链接，等待平台校验。",
            ))
            reviewed = await complete_flow_task_with_review(session, user, task_id, BusinessFlowTaskCompleteReviewRequest(
                outcome="平台校验通过，进入发布后跟踪。",
                impact_score=4,
                next_action="复查首日曝光和转化。",
            ))
            events = await list_flow_task_events(session, user, task_id)

            assert comment["action"] == "business_flow_task_comment"
            assert reviewed["status"] == "done"
            assert reviewed["note"] == "平台校验通过，进入发布后跟踪。"
            assert [event["action"] for event in events[:2]] == [
                "business_flow_task_completed_review",
                "business_flow_task_comment",
            ]
            assert events[0]["payload"]["impact_score"] == 4
            assert events[0]["payload"]["next_action"] == "复查首日曝光和转化。"
        await engine.dispose()

    asyncio.run(run_test())


def test_business_flow_overview_keeps_task_only_risk_items_visible(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'flow-risk-task.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            user = User(
                id="flow-risk-user",
                username="risk_owner",
                email="risk-owner@example.com",
                hashed_password="x",
                is_admin=True,
            )
            session.add(user)
            await session.commit()

            ref = BusinessFlowTaskItemRef(
                item_type="risk_event",
                item_id="risk-profit-gap",
                stage_key="optimization",
                title="利润异常需要处理",
                route="/risk-control",
                source_refs=[{"type": "risk_event", "id": "risk-profit-gap", "label": "利润异常"}],
                last_gap="利润率低于阈值",
            )
            await bulk_update_flow_tasks(session, user, BusinessFlowTaskBulkRequest(
                action="assign",
                assigned_to=user.username,
                items=[ref],
            ))

            flow = await get_business_flow_overview(session, user.id, user)
            task_item = next(item for item in flow["items"] if item["type"] == "risk_event")
            assert task_item["name"] == "利润异常需要处理"
            assert task_item["task_status"] == "processing"
            assert task_item["status"] == "blocked"
            assert task_item["gaps"] == ["利润率低于阈值"]
            assert flow["metrics"]["task_count"] == 1
            assert any(action["work_item_id"] == task_item["work_item_id"] for action in flow["next_actions"])
        await engine.dispose()

    asyncio.run(run_test())


def test_business_flow_assignee_list_is_admin_scoped(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'flow-assignees.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            admin = User(id="assign-admin", username="admin_user", email="admin@example.com", hashed_password="x", is_admin=True)
            operator = User(id="assign-operator", username="operator_user", email="operator@example.com", hashed_password="x", is_admin=False)
            inactive = User(id="assign-inactive", username="inactive_user", email="inactive@example.com", hashed_password="x", is_admin=False, is_active=False)
            session.add_all([admin, operator, inactive])
            await session.commit()

            admin_list = await list_flow_task_assignees(session, admin)
            operator_list = await list_flow_task_assignees(session, operator)

            assert [item["username"] for item in admin_list] == ["admin_user", "operator_user"]
            assert [item["username"] for item in operator_list] == ["operator_user"]
            assert next(item for item in admin_list if item["username"] == "admin_user")["is_current"] is True
        await engine.dispose()

    asyncio.run(run_test())


def test_business_flow_assignment_creates_assignee_notification(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'flow-assignment-notify.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            admin = User(id="notify-admin", username="notify_admin", email="notify-admin@example.com", hashed_password="x", is_admin=True)
            operator = User(id="notify-operator", username="notify_operator", email="notify-operator@example.com", hashed_password="x", is_admin=False)
            session.add_all([admin, operator])
            await session.commit()

            ref = BusinessFlowTaskItemRef(
                item_type="risk_event",
                item_id="risk-notify",
                stage_key="optimization",
                title="风险任务通知",
                route="/risk-control",
                source_refs=[{"type": "risk_event", "id": "risk-notify", "label": "风险任务"}],
                last_gap="需要成员处理",
            )
            await bulk_update_flow_tasks(session, admin, BusinessFlowTaskBulkRequest(
                action="assign",
                assigned_to=operator.username,
                items=[ref],
            ))

            result = await session.execute(select(Notification).where(Notification.user_id == operator.id))
            notifications = result.scalars().all()
            assert len(notifications) == 1
            assert notifications[0].title.startswith("你有新的业务任务")
            assert "风险任务通知" in notifications[0].title
            assert notifications[0].link == "/business-flow"
            assert "风险任务通知" in (notifications[0].message or "")
        await engine.dispose()

    asyncio.run(run_test())


def test_business_flow_items_expose_unified_work_object_state_and_evidence(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'flow-work-object.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            user = User(
                id="flow-object-user",
                username="flow_object",
                email="flow-object@example.com",
                hashed_password="x",
                is_admin=True,
            )
            session.add_all([
                user,
                SourcingItem(
                    user_id=user.id,
                    product_name="已决策待刊登商品",
                    source_name="1688",
                    source_url="https://detail.1688.com/offer/ready.html",
                    source_price_rmb=16,
                    pipeline_stage="listed",
                ),
            ])
            await session.commit()

            flow = await get_business_flow_overview(session, user.id, user)
        await engine.dispose()

        item = next(item for item in flow["items"] if item["name"] == "已决策待刊登商品")
        assert item["work_item_id"] == f"{item['type']}:{item['id']}"
        assert item["lifecycle_status"] == "listing_ready"
        assert item["lifecycle_label"] == "待平台刊登"
        assert item["object_refs"] == [{"type": item["type"], "id": item["id"], "label": item["name"]}]
        assert set(item["evidence_completeness"]) == {
            "trend", "social", "platform", "supply", "profit", "competitor", "content", "risk"
        }
        assert item["evidence_completeness"]["supply"] == "present"
        assert item["evidence_completeness"]["profit"] == "present"
        assert item["evidence_completeness"]["content"] == "present"
        assert item["evidence_summary"]["total"] == 8
        assert item["evidence_summary"]["present"] >= 2
        assert "统一业务对象状态" in flow["model_definition"]["object_state_contract"]

    asyncio.run(run_test())


def test_business_flow_overview_exposes_product_bus_projections(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'flow-product-bus.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            user = User(
                id="flow-bus-user",
                username="flow_bus",
                email="flow-bus@example.com",
                hashed_password="x",
                is_admin=True,
            )
            session.add_all([
                user,
                SourcingItem(
                    user_id=user.id,
                    product_name="待刊登总线商品",
                    source_name="1688",
                    source_url="https://detail.1688.com/offer/bus.html",
                    source_price_rmb=18,
                    pipeline_stage="listed",
                ),
            ])
            await session.commit()

            flow = await get_business_flow_overview(session, user.id, user)
        await engine.dispose()

        assert len(flow["stage_health"]) == 6
        listing_health = next(item for item in flow["stage_health"] if item["stage_key"] == "listing")
        assert listing_health["label"] == "平台上架"
        assert listing_health["object_count"] == 1
        assert listing_health["blocked_count"] == 1
        assert listing_health["health_pct"] == 0
        assert listing_health["route"] == "/publish"
        assert listing_health["data_gaps"]

        listing_lane = next(item for item in flow["product_pipeline"] if item["stage_key"] == "listing")
        assert listing_lane["label"] == "平台上架"
        assert listing_lane["object_count"] == 1
        assert listing_lane["items"][0]["name"] == "待刊登总线商品"
        assert listing_lane["items"][0]["work_item_id"].startswith("sourcing_item:")

        assert flow["pending_queue"][0]["name"] == "待刊登总线商品"
        assert flow["pending_queue"][0]["status"] == "blocked"
        assert flow["current_context"]["name"] == "待刊登总线商品"
        assert flow["current_context"]["lifecycle_status"] == "listing_ready"
        assert flow["current_context"]["object_refs"][0]["type"] == "sourcing_item"
        assert any(action["work_item_id"] == flow["current_context"]["work_item_id"] for action in flow["next_actions"])

    asyncio.run(run_test())


def test_business_flow_listing_item_drills_into_product_listing_tab(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'flow-listing-product-route.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            user = User(
                id="flow-listing-user",
                username="flow_listing",
                email="flow-listing@example.com",
                hashed_password="x",
                is_admin=True,
            )
            account = PlatformAccount(
                user_id=user.id,
                platform="shopee",
                account_name="Shopee PH 店铺",
            )
            product = Product(
                user_id=user.id,
                sku="FLOW-LISTING-001",
                name="真实上架商品",
                images=["https://cbu01.alicdn.com/img/ibank/demo.jpg"],
            )
            session.add_all([user, account, product])
            await session.flush()
            listing = PlatformListing(
                user_id=user.id,
                product_id=product.id,
                platform_account_id=account.id,
                title="Shopee 草稿 Listing",
                price=19.9,
                stock=12,
                images=["https://cbu01.alicdn.com/img/ibank/listing.jpg"],
                status="draft",
            )
            session.add(listing)
            await session.commit()

            flow = await get_business_flow_overview(session, user.id, user)
        await engine.dispose()

        item = next(item for item in flow["items"] if item["type"] == "platform_listing")
        product_route = f"/products/{product.id}?tab=listings"
        assert item["route"] == product_route
        assert item["next_action_route"] == product_route
        assert item["object_refs"] == [
            {"type": "platform_listing", "id": listing.id, "label": listing.title},
            {"type": "product", "id": product.id, "label": product.name},
        ]
        assert item["source_refs"][0]["meta"]["route"] == product_route

    asyncio.run(run_test())


def test_business_flow_empty_state_is_not_blocked_and_uses_supply_chain_label(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'flow-empty.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            user = User(
                id="flow-empty-user",
                username="flow_empty",
                email="flow-empty@example.com",
                hashed_password="x",
                is_admin=True,
            )
            session.add(user)
            await session.commit()

            flow = await get_business_flow_overview(session, user.id, user)
        await engine.dispose()

        assert flow["metrics"]["item_count"] == 0
        assert flow["metrics"]["blocked"] == 0
        assert flow["metrics"]["data_required"] == flow["metrics"]["stage_count"]
        assert flow["model_definition"]["stage_count"] == 6
        assert flow["model_definition"]["stage_model"] == "operating_lifecycle_6"
        assert "七阶段" in flow["model_definition"]["design_alignment"]
        assert flow["model_definition"]["stage_mapping"]["成本测算"] == "供应链/采购"
        assert all(stage["status"] == "data_required" for stage in flow["stages"])
        assert any(stage["key"] == "sourcing" and stage["name"] == "供应链/采购" for stage in flow["stages"])
        assert all(stage["name"] != "1688货源" for stage in flow["stages"])

    asyncio.run(run_test())


def test_risk_control_persists_handling_state_and_audit(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'risk-state.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            user = User(id="user-risk", username="admin", email="admin@example.com", hashed_password="x")
            product = Product(user_id=user.id, sku="SKU-R", name="风险商品")
            session.add_all([user, product])
            await session.flush()
            rule = InventoryAlertRule(
                user_id=user.id, product_id=product.id, sku="SKU-R",
                product_name="风险商品", safety_stock=10, severity="critical",
            )
            session.add(rule)
            await session.flush()
            session.add(InventoryAlertLog(
                rule_id=rule.id, user_id=user.id, product_id=product.id, sku="SKU-R",
                product_name="风险商品", current_stock=1, threshold=10,
                severity="critical", status="open",
            ))
            await session.commit()

            overview = await get_risk_control_overview(session, user.id)
            risk_id = overview["risks"][0]["id"]
            radar_inventory = next(item for item in overview["risk_radar"] if item["key"] == "inventory")
            heatmap_inventory = next(item for item in overview["risk_heatmap"] if item["category"] == "inventory")
            updated = await update_risk_event_state(
                session,
                user,
                risk_id,
                RiskStateUpdateRequest(status="processing", note="已安排补货", due_at=datetime.now(timezone.utc) - timedelta(hours=1)),
            )
            await update_risk_event_state(
                session,
                user,
                risk_id,
                RiskStateUpdateRequest(status="closed", note="补货完成，库存恢复安全线"),
            )
            refreshed = await get_risk_control_overview(session, user.id)
            audit = await get_risk_event_audit(session, user.id, risk_id)
        await engine.dispose()

        assert updated["status"] == "processing"
        assert overview["assessment_status"] == "attention"
        assert radar_inventory["active_count"] == 1
        assert radar_inventory["critical"] == 1
        assert radar_inventory["score"] > 0
        assert heatmap_inventory["critical"] == 1
        assert heatmap_inventory["heat_level"] == "critical"
        assert overview["ai_recommendations"][0]["risk_id"] == risk_id
        assert overview["ai_recommendations"][0]["status"] == "suggested"
        assert overview["ai_recommendations"][0]["does_not_change_state"] is True
        assert updated["is_overdue"] is True
        assert updated["assigned_to"] == "admin"
        assert refreshed["metrics"]["closed"] == 1
        assert refreshed["review_records"][0]["risk_id"] == risk_id
        assert refreshed["review_records"][0]["outcome"] == "已关闭"
        assert "补货完成" in refreshed["review_records"][0]["note"]
        assert audit and audit[0]["action"] == "risk_closed"
        assert audit[0]["resource_id"] == risk_id

    asyncio.run(run_test())
