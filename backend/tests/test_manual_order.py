"""Manual order creation truthfulness and isolation tests."""

import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models import all_models  # noqa: F401
from app.models.platform_account import PlatformAccount
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.finance_ledger import FinanceLedgerEntry
from app.models.sys_dict import SysDictItem
from app.models.sync_log import SyncLog
from app.schemas.order import ManualOrderCreate, ManualOrderItemCreate, OrderStatusUpdate
from app.services.order_service import (
    build_fulfillment_exception_context,
    build_order_finance_entry_context,
    build_order_fee_context,
    build_order_list_context,
    import_manual_orders,
    create_manual_order,
    get_order_stats,
    get_order_sync_reviews,
    update_order_status,
    list_orders,
)


def test_manual_order_binds_store_marks_source_and_persists_items(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'manual-order.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            account = PlatformAccount(user_id="manual-user", platform="shopee", account_name="未接入店铺")
            other = PlatformAccount(user_id="other-user", platform="temu", account_name="其他用户店铺")
            session.add_all([account, other])
            await session.commit()

            request = ManualOrderCreate(
                platform_account_id=account.id,
                merchant_order_number="MANUAL-001",
                buyer_name="真实买家",
                currency="MYR",
                total=25,
                ordered_at=datetime.now(timezone.utc),
                items=[ManualOrderItemCreate(name="手工商品", sku="SKU-M", quantity=2, unit_price=12.5)],
            )
            order = await create_manual_order(session, "manual-user", request)

            assert order.platform_order_id == "manual:MANUAL-001"
            assert order.platform_data["source"] == "manual"
            assert order.subtotal == 25
            assert len(order.items) == 1
            assert order.items[0].total_price == 25

            with pytest.raises(ValueError, match="manual_order_number_exists"):
                await create_manual_order(session, "manual-user", request)

            unauthorized = request.model_copy(update={
                "platform_account_id": other.id,
                "merchant_order_number": "MANUAL-002",
            })
            with pytest.raises(ValueError, match="platform_account_not_accessible"):
                await create_manual_order(session, "manual-user", unauthorized)
        await engine.dispose()

    asyncio.run(run_test())


def test_manual_order_import_writes_orders_items_and_audit_summary(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'manual-order-import.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            account = PlatformAccount(user_id="manual-user", platform="tiktok", account_name="TikTok 未接入店铺")
            session.add(account)
            await session.commit()

            first = ManualOrderCreate(
                platform_account_id=account.id,
                merchant_order_number="IMPORT-001",
                buyer_name="批量买家A",
                shipping_address={"raw": "Manila, PH", "source": "csv_import"},
                shipping_fee=2.5,
                platform_fee=1.2,
                discount=0.5,
                currency="PHP",
                total=51,
                payment_status="paid",
                fulfillment_status="pending_shipment",
                logistics_channel="J&T Express",
                ordered_at=datetime(2026, 7, 16, 10, 0, tzinfo=timezone.utc),
                notes="首批导入",
                items=[
                    ManualOrderItemCreate(name="导入商品A", sku="SKU-A", quantity=2, unit_price=20),
                    ManualOrderItemCreate(name="导入商品B", sku="SKU-B", quantity=1, unit_price=11),
                ],
            )
            second = first.model_copy(update={"merchant_order_number": "IMPORT-002", "buyer_name": "批量买家B"})
            result = await import_manual_orders(
                session,
                "manual-user",
                [first, second],
                import_ref="csv-20260716-a",
                source_file="orders-20260716.csv",
            )

            assert result["created_count"] == 2
            assert result["skipped_count"] == 0
            assert result["failed_count"] == 0
            assert result["import_ref"] == "csv-20260716-a"
            assert result["source_file"] == "orders-20260716.csv"
            assert len(result["created_order_ids"]) == 2

            imported, total = await list_orders(session, "manual-user", page_size=10)
            assert total == 2
            assert {order.order_number for order in imported} == {"IMPORT-001", "IMPORT-002"}
            assert imported[0].platform_data["source"] == "manual_import"
            assert imported[0].platform_data["import_ref"] == "csv-20260716-a"
            assert sum(len(order.items or []) for order in imported) == 4

            duplicate = await import_manual_orders(
                session,
                "manual-user",
                [first],
                import_ref="csv-20260716-a-retry",
                source_file="orders-20260716.csv",
            )
            assert duplicate["created_count"] == 0
            assert duplicate["skipped_count"] == 1
            assert duplicate["skipped"][0]["merchant_order_number"] == "IMPORT-001"

            same_batch = first.model_copy(update={"merchant_order_number": "IMPORT-003"})
            same_batch_duplicate = same_batch.model_copy(update={"buyer_name": "批量买家C-重复"})
            same_batch_result = await import_manual_orders(
                session,
                "manual-user",
                [same_batch, same_batch_duplicate],
                import_ref="csv-20260716-b",
                source_file="orders-20260716-b.csv",
            )
            assert same_batch_result["created_count"] == 1
            assert same_batch_result["skipped_count"] == 1
            assert same_batch_result["skipped"][0]["merchant_order_number"] == "IMPORT-003"

            imported_after_duplicate, total_after_duplicate = await list_orders(session, "manual-user", page_size=10)
            assert total_after_duplicate == 3
            assert sum(1 for order in imported_after_duplicate if order.order_number == "IMPORT-003") == 1

        await engine.dispose()

    asyncio.run(run_test())


def test_order_list_can_filter_exact_platform_store(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'order-store-filter.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            store_a = PlatformAccount(user_id="store-user", platform="shopee", account_name="Shopee A 店")
            store_b = PlatformAccount(user_id="store-user", platform="shopee", account_name="Shopee B 店")
            session.add_all([store_a, store_b])
            await session.flush()
            session.add_all([
                Order(
                    user_id="store-user", platform_account_id=store_a.id, platform_order_id="A-001",
                    order_number="A-001", status="ready_to_ship", total=11, currency="MYR",
                    ordered_at=datetime.now(timezone.utc),
                ),
                Order(
                    user_id="store-user", platform_account_id=store_b.id, platform_order_id="B-001",
                    order_number="B-001", status="ready_to_ship", total=22, currency="MYR",
                    ordered_at=datetime.now(timezone.utc),
                ),
            ])
            await session.commit()

            orders, total = await list_orders(session, "store-user", platform="shopee", platform_account_id=store_a.id)

        await engine.dispose()

        assert total == 1
        assert [order.order_number for order in orders] == ["A-001"]
        assert orders[0].platform_account_id == store_a.id

    asyncio.run(run_test())


def test_order_list_exception_filter_uses_fulfillment_context(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'order-exception-filter.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            account = PlatformAccount(user_id="order-user", platform="shopee", account_name="Shopee 店铺")
            session.add(account)
            await session.flush()
            now = datetime.now(timezone.utc)
            overdue = Order(
                user_id="order-user",
                platform_account_id=account.id,
                platform_order_id="SP-OVERDUE",
                order_number="SP-OVERDUE",
                status="ready_to_ship",
                total=88,
                currency="MYR",
                ordered_at=now - timedelta(days=1),
                platform_data={
                    "source": "platform",
                    "fulfillment_deadline_at": (now - timedelta(hours=2)).isoformat(),
                },
            )
            clear = Order(
                user_id="order-user",
                platform_account_id=account.id,
                platform_order_id="SP-CLEAR",
                order_number="SP-CLEAR",
                status="delivered",
                fulfillment_status="delivered",
                total=66,
                currency="MYR",
                ordered_at=now,
                last_synced_at=now,
                platform_data={
                    "source": "platform",
                    "fulfillment_deadline_at": (now + timedelta(days=1)).isoformat(),
                    "logistics_channel": "Shopee Xpress",
                    "after_sales_status": "none",
                },
            )
            session.add_all([overdue, clear])
            await session.commit()

            orders, total = await list_orders(session, "order-user", exceptions=True)

        await engine.dispose()

        assert total == 1
        assert [order.order_number for order in orders] == ["SP-OVERDUE"]
        assert build_fulfillment_exception_context(orders[0])["status"] == "shipping_overdue"

    asyncio.run(run_test())


def test_order_status_update_uses_runtime_state_machine_and_manual_override(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'order-status-machine.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            account = PlatformAccount(user_id="order-user", platform="shopee", account_name="Shopee 店铺")
            session.add(account)
            await session.flush()
            session.add_all([
                SysDictItem(
                    id="pending",
                    type="order_status",
                    label="待处理",
                    sort_order=10,
                    extra={"value": "pending", "allowed_next": ["processing", "cancelled"], "variant": "warning"},
                ),
                SysDictItem(
                    id="processing",
                    type="order_status",
                    label="处理中",
                    sort_order=20,
                    extra={"value": "processing", "allowed_next": ["shipped", "cancelled"], "variant": "info"},
                ),
                SysDictItem(
                    id="shipped",
                    type="order_status",
                    label="已发货",
                    sort_order=30,
                    extra={"value": "shipped", "allowed_next": ["delivered"], "variant": "info"},
                ),
                SysDictItem(
                    id="delivered",
                    type="order_status",
                    label="已签收",
                    sort_order=40,
                    extra={"value": "delivered", "allowed_next": [], "variant": "success"},
                ),
            ])
            order = Order(
                user_id="order-user",
                platform_account_id=account.id,
                platform_order_id="SP-STATE-001",
                order_number="SP-STATE-001",
                status="pending",
                total=88,
                currency="MYR",
                ordered_at=datetime.now(timezone.utc),
                platform_data={"source": "manual"},
            )
            session.add(order)
            await session.commit()

            updated = await update_order_status(session, order, OrderStatusUpdate(status="processing"))
            assert updated.status == "processing"
            assert updated.platform_data["status_history"][-1]["transition_type"] == "state_machine"

            with pytest.raises(ValueError, match="invalid_order_status_transition"):
                await update_order_status(session, updated, OrderStatusUpdate(status="delivered"))

            corrected = await update_order_status(
                session,
                updated,
                OrderStatusUpdate(status="delivered", manual_override=True, reason="平台后台已签收，补录历史状态"),
            )
            assert corrected.status == "delivered"
            last = corrected.platform_data["status_history"][-1]
            assert last["transition_type"] == "manual_override"
            assert last["reason"] == "平台后台已签收，补录历史状态"

            with pytest.raises(ValueError, match="manual_override_reason_required"):
                await update_order_status(session, corrected, OrderStatusUpdate(status="processing", manual_override=True))
        await engine.dispose()

    asyncio.run(run_test())


def test_order_fee_context_uses_platform_bill_fields_without_fake_profit(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'order-fee-context.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            account = PlatformAccount(user_id="order-user", platform="shopee", account_name="Shopee 店铺")
            session.add(account)
            await session.flush()
            order = Order(
                user_id="order-user",
                platform_account_id=account.id,
                platform_order_id="SP-001",
                order_number="SP-001",
                status="ready_to_ship",
                subtotal=100,
                shipping_fee=10,
                platform_fee=8,
                discount=5,
                total=105,
                currency="MYR",
                ordered_at=datetime.now(timezone.utc),
                platform_data={
                    "fee_breakdown": {
                        "components": [
                            {"code": "seller_voucher", "label": "卖家优惠", "amount": 5, "direction": "deduct", "source": "platform_bill"},
                            {"code": "transaction_fee", "label": "交易费", "amount": 2.1, "direction": "deduct", "source": "platform_bill"},
                            {"code": "service_fee", "label": "服务费", "amount": 1.2, "direction": "deduct", "source": "platform_bill"},
                            {"code": "tax", "label": "税费", "amount": 0.8, "direction": "deduct", "source": "platform_bill"},
                        ],
                        "wallet": {"balance": 830.5, "currency": "MYR"},
                    },
                    "fulfillment_deadline_at": "2026-07-10T12:00:00+08:00",
                    "logistics_channel": "Shopee Xpress",
                    "after_sales_status": "none",
                    "financial_reconciliation_status": "bill_imported",
                },
            )
            session.add(order)
            await session.flush()
            session.add(OrderItem(order_id=order.id, name="费用样本商品", quantity=1, unit_price=100, total_price=100))
            await session.commit()
            context = build_order_fee_context(order)
        await engine.dispose()

        assert context["financial_reconciliation_status"] == "bill_imported"
        assert context["fulfillment_deadline_at"] == "2026-07-10T12:00:00+08:00"
        assert context["logistics_channel"] == "Shopee Xpress"
        assert context["after_sales_status"] == "none"
        assert any(item["code"] == "buyer_paid" and item["amount"] == 105 for item in context["fee_breakdown"]["components"])
        assert any(item["code"] == "transaction_fee" and item["amount"] == 2.1 for item in context["fee_breakdown"]["components"])
        assert context["fee_breakdown"]["wallet"]["balance"] == 830.5
        assert "platform_bill" not in context["fee_breakdown"]["data_gaps"]

    asyncio.run(run_test())


def test_manual_order_fee_context_marks_platform_bill_gap(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'manual-order-fee-gap.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            account = PlatformAccount(user_id="manual-user", platform="temu", account_name="TEMU 未接入店铺")
            session.add(account)
            await session.commit()
            request = ManualOrderCreate(
                platform_account_id=account.id,
                merchant_order_number="MANUAL-FEE-001",
                buyer_name="费用买家",
                currency="MYR",
                total=32,
                ordered_at=datetime.now(timezone.utc),
                items=[ManualOrderItemCreate(name="手工费用商品", quantity=1, unit_price=32)],
            )
            order = await create_manual_order(session, "manual-user", request)
            context = build_order_fee_context(order)
        await engine.dispose()

        assert context["financial_reconciliation_status"] == "not_reconciled"
        assert "platform_bill" in context["fee_breakdown"]["data_gaps"]
        assert any(item["code"] == "buyer_paid" and item["amount"] == 32 for item in context["fee_breakdown"]["components"])

    asyncio.run(run_test())


def test_order_list_context_exposes_seller_backend_operational_fields(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'order-list-context.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            account = PlatformAccount(user_id="order-user", platform="tiktok", account_name="TikTok PH 店铺")
            session.add(account)
            await session.flush()
            order = Order(
                user_id="order-user",
                platform_account_id=account.id,
                platform_order_id="TT-001",
                order_number="TT-001",
                status="ready_to_ship",
                buyer_name="buyer",
                subtotal=150,
                shipping_fee=12,
                platform_fee=9,
                discount=3,
                total=159,
                currency="PHP",
                payment_status="paid",
                fulfillment_status="pending_pickup",
                ordered_at=datetime.now(timezone.utc),
                platform_data={
                    "source": "platform",
                    "fulfillment_deadline_at": "2026-07-11T16:00:00+08:00",
                    "logistics_channel": "TikTok Shop Logistics",
                    "after_sales_status": "refund_requested",
                    "financial_reconciliation_status": "bill_imported",
                },
            )
            session.add(order)
            await session.flush()
            session.add_all([
                OrderItem(order_id=order.id, name="主商品", sku="SKU-A", quantity=1, unit_price=100, total_price=100),
                OrderItem(order_id=order.id, name="附加商品", sku="SKU-B", quantity=2, unit_price=25, total_price=50),
            ])
            await session.flush()
            await session.refresh(order, ["items"])
            context = build_order_list_context(order)
        await engine.dispose()

        expected = {
            "platform_account_name": "TikTok PH 店铺",
            "item_count": 2,
            "payment_status": "paid",
            "fulfillment_status": "pending_pickup",
            "fulfillment_deadline_at": "2026-07-11T16:00:00+08:00",
            "logistics_channel": "TikTok Shop Logistics",
            "after_sales_status": "refund_requested",
            "financial_reconciliation_status": "bill_imported",
        }
        assert {key: context[key] for key in expected} == expected
        assert context["fulfillment_exception"]["status"] in {"shipping_overdue", "after_sales_open", "sync_required"}
        assert "售后状态待处理：refund_requested" in context["fulfillment_exception"]["reasons"]

    asyncio.run(run_test())


def test_order_finance_entry_context_uses_linked_ledger_only(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'order-finance-context.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            account = PlatformAccount(user_id="finance-user", platform="shopee", account_name="Shopee 店铺")
            session.add(account)
            await session.flush()
            order = Order(
                user_id="finance-user",
                platform_account_id=account.id,
                platform_order_id="SP-FIN-001",
                order_number="SP-FIN-001",
                status="ready_to_ship",
                total=120,
                currency="MYR",
                ordered_at=datetime.now(timezone.utc),
            )
            other_order = Order(
                user_id="finance-user",
                platform_account_id=account.id,
                platform_order_id="SP-FIN-OTHER",
                order_number="SP-FIN-OTHER",
                status="ready_to_ship",
                total=80,
                currency="MYR",
                ordered_at=datetime.now(timezone.utc),
            )
            session.add_all([order, other_order])
            await session.flush()
            session.add_all([
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="sales_income",
                    amount_rmb=120,
                    currency="CNY",
                    order_id=order.id,
                    description="订单销售收入",
                ),
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="platform_fee",
                    amount_rmb=12,
                    currency="CNY",
                    order_id=order.id,
                    description="订单平台费",
                ),
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="sales_income",
                    amount_rmb=80,
                    currency="CNY",
                    order_id=other_order.id,
                    description="其他订单销售收入",
                ),
            ])
            await session.commit()
            context = await build_order_finance_entry_context(session, order)
            missing_context = await build_order_finance_entry_context(session, other_order)

        await engine.dispose()

        assert context["status"] == "ledger_ready"
        assert context["entry_count"] == 2
        assert context["revenue_rmb"] == 120
        assert context["cost_rmb"] == 12
        assert context["net_profit_rmb"] == 108
        assert "platform_bill" not in context["data_gaps"]
        assert missing_context["status"] == "ledger_incomplete"
        assert missing_context["data_gaps"] == ["platform_bill"]
        assert any(action["code"] == "replenish_platform_bill" for action in missing_context["actions"])

    asyncio.run(run_test())


def test_order_fulfillment_exception_context_flags_platform_deadline_after_sales_and_sync_gap(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'order-fulfillment-exception.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        now = datetime(2026, 7, 10, 12, 0, tzinfo=timezone.utc)
        async with sessions() as session:
            account = PlatformAccount(user_id="order-user", platform="shopee", account_name="Shopee MY 店铺")
            session.add(account)
            await session.flush()
            order = Order(
                user_id="order-user",
                platform_account_id=account.id,
                platform_order_id="SP-EX-001",
                order_number="SP-EX-001",
                status="ready_to_ship",
                buyer_name="buyer",
                total=120,
                currency="MYR",
                fulfillment_status="pending_pickup",
                ordered_at=now,
                platform_data={
                    "source": "platform",
                    "fulfillment_deadline_at": "2026-07-10T09:00:00+00:00",
                    "after_sales_status": "refund_requested",
                    "financial_reconciliation_status": "not_reconciled",
                },
            )
            session.add(order)
            await session.flush()
            await session.refresh(order)
            context = build_fulfillment_exception_context(order, now=now)
            list_context = build_order_list_context(order, now=now)
        await engine.dispose()

        assert context["status"] == "shipping_overdue"
        assert context["severity"] == "critical"
        assert "发货时限已超期" in context["reasons"]
        assert "售后状态待处理：refund_requested" in context["reasons"]
        assert "物流渠道待补" in context["reasons"]
        assert "订单缺少平台同步时间" in context["reasons"]
        assert context["route"] == "/orders?exceptions=1"
        assert "platform_order_sync" in context["data_gaps"]
        assert {action["code"] for action in context["actions"]} >= {
            "create_shipment",
            "review_after_sales",
            "sync_platform_order",
            "replenish_platform_bill",
        }
        assert any(action["route"] == f"/shipments/new?order_id={order.id}" for action in context["actions"])
        assert any(action["route"] == f"/orders/after-sales?order_id={order.id}" for action in context["actions"])
        assert any(action["route"] == f"/finance?entry_type=platform_fee&order_id={order.id}#finance-ledger" for action in context["actions"])
        assert list_context["fulfillment_exception"]["status"] == "shipping_overdue"

    asyncio.run(run_test())


def test_order_stats_exposes_fulfillment_operating_overview(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'order-fulfillment-stats.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        now = datetime(2026, 7, 10, 12, 0, tzinfo=timezone.utc)
        async with sessions() as session:
            shopee = PlatformAccount(user_id="order-user", platform="shopee", account_name="Shopee MY 店")
            tiktok = PlatformAccount(user_id="order-user", platform="tiktok", account_name="TikTok PH 店")
            session.add_all([shopee, tiktok])
            await session.flush()
            session.add_all([
                Order(
                    user_id="order-user",
                    platform_account_id=shopee.id,
                    platform_order_id="SP-OVERDUE",
                    order_number="SP-OVERDUE",
                    status="ready_to_ship",
                    total=120,
                    currency="MYR",
                    fulfillment_status="pending_pickup",
                    ordered_at=now,
                    platform_data={
                        "source": "platform",
                        "fulfillment_deadline_at": "2026-07-10T09:00:00+00:00",
                    },
                ),
                Order(
                    user_id="order-user",
                    platform_account_id=shopee.id,
                    platform_order_id="SP-DUE",
                    order_number="SP-DUE",
                    status="ready_to_ship",
                    total=80,
                    currency="MYR",
                    fulfillment_status="pending_pickup",
                    ordered_at=now,
                    last_synced_at=now,
                    platform_data={
                        "source": "platform",
                        "fulfillment_deadline_at": "2026-07-10T20:00:00+00:00",
                        "logistics_channel": "Shopee Xpress",
                    },
                ),
                Order(
                    user_id="order-user",
                    platform_account_id=tiktok.id,
                    platform_order_id="TT-SHIPPED",
                    order_number="TT-SHIPPED",
                    status="shipped",
                    total=60,
                    currency="PHP",
                    fulfillment_status="shipped",
                    ordered_at=now,
                    last_synced_at=now,
                    platform_data={
                        "source": "platform",
                        "fulfillment_deadline_at": "2026-07-11T20:00:00+00:00",
                        "logistics_channel": "TikTok Shop Logistics",
                    },
                ),
            ])
            await session.commit()
            stats = await get_order_stats(session, "order-user", now=now)
        await engine.dispose()

        assert stats["total_orders"] == 3
        assert stats["by_order_status"]["ready_to_ship"] == 2
        assert stats["by_order_status"]["shipped"] == 1
        assert stats["fulfillment"]["pending_shipment"] == 2
        assert stats["fulfillment"]["shipped"] == 1
        assert stats["fulfillment"]["overdue"] == 1
        assert stats["fulfillment"]["due_soon"] == 1
        assert stats["fulfillment"]["logistics_missing"] == 1
        assert stats["store_breakdown"][0]["platform_account_name"] == "Shopee MY 店"
        assert stats["store_breakdown"][0]["pending_shipment"] == 2
        assert "缺失字段进入数据缺口" in stats["confidence_reason"]

    asyncio.run(run_test())


def test_order_sync_review_combines_order_snapshot_and_store_sync_log(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'order-sync-review.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            synced_account = PlatformAccount(user_id="order-user", platform="shopee", account_name="Shopee MY 店铺")
            manual_account = PlatformAccount(user_id="order-user", platform="temu", account_name="TEMU 手工店铺")
            session.add_all([synced_account, manual_account])
            await session.flush()
            synced_order = Order(
                user_id="order-user",
                platform_account_id=synced_account.id,
                platform_order_id="SP-SYNC-001",
                order_number="SP-SYNC-001",
                status="ready_to_ship",
                total=100,
                currency="MYR",
                ordered_at=datetime.now(timezone.utc),
                last_synced_at=datetime.now(timezone.utc),
                platform_data={"source": "platform"},
            )
            manual_order = Order(
                user_id="order-user",
                platform_account_id=manual_account.id,
                platform_order_id="manual:TEMU-001",
                order_number="TEMU-001",
                status="pending",
                total=80,
                currency="MYR",
                ordered_at=datetime.now(timezone.utc),
                platform_data={"source": "manual"},
            )
            session.add_all([
                synced_order,
                manual_order,
                SyncLog(
                    user_id="order-user",
                    platform_account_id=synced_account.id,
                    sync_type="orders",
                    status="failed",
                    started_at=datetime.now(timezone.utc),
                    completed_at=datetime.now(timezone.utc),
                    records_processed=10,
                    records_created=3,
                    records_updated=2,
                    records_failed=5,
                    error_message="Authentication failed",
                ),
            ])
            await session.commit()
            reviews = await get_order_sync_reviews(session, [synced_order, manual_order])
        await engine.dispose()

        synced_review = reviews[synced_order.id]
        manual_review = reviews[manual_order.id]
        assert synced_review["status"] == "sync_failed"
        assert synced_review["latest_store_sync"]["records_failed"] == 5
        assert synced_review["message"] == "店铺最近一次订单同步失败，请复核平台 API 凭证或重试同步。"
        assert manual_review["status"] == "manual_not_synced"
        assert "platform_order_sync" in manual_review["data_gaps"]

    asyncio.run(run_test())
