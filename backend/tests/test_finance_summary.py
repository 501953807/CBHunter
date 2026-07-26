"""Finance summary consistency regression tests."""

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models import all_models  # noqa: F401
from app.models.finance_ledger import FinanceLedgerEntry
from app.models.platform_account import PlatformAccount
from app.models.platform_listing import PlatformListing
from app.models.product import Product
from app.models.product_object_model import ProductSkuVariant
from app.integrations.base import BasePlatformClient, PlatformBillRecord
from app.integrations.factory import PlatformClientFactory
from app.integrations.status import PLATFORM_CONNECTORS
from app.services.finance_service import (
    get_finance_summary,
    get_finance_traceback,
    import_platform_bill_records,
    list_ledger_entries,
    sync_platform_bills_for_account,
)


def test_finance_summary_and_breakdown_share_one_ledger_scope(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'finance.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        now = datetime.now(timezone.utc)
        async with sessions() as session:
            session.add_all([
                FinanceLedgerEntry(user_id="finance-user", entry_type="sales_income", amount_rmb=1200, occurred_at=now),
                FinanceLedgerEntry(user_id="finance-user", entry_type="refund_reversal", amount_rmb=-100, occurred_at=now),
                FinanceLedgerEntry(user_id="finance-user", entry_type="purchase_cost", amount_rmb=400, occurred_at=now),
                FinanceLedgerEntry(user_id="finance-user", entry_type="shipping_cost", amount_rmb=50, occurred_at=now),
                FinanceLedgerEntry(user_id="finance-user", entry_type="cash_balance", amount_rmb=3000, occurred_at=now),
            ])
            await session.commit()
            summary = await get_finance_summary(session, "finance-user", "daily")
        await engine.dispose()

        assert summary["total_revenue_rmb"] == 1100
        assert summary["total_cost_rmb"] == 450
        assert summary["net_profit_rmb"] == 650
        assert summary["cost_breakdown"] == {"purchase_cost": 400, "shipping_cost": 50}
        assert summary["cash_balance_rmb"] == 3000
        assert len(summary["source_refs"]) == summary["entry_count"] == 5

    asyncio.run(run_test())


def test_finance_traceback_product_rows_include_v5_sku_context(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'finance-v5-sku-context.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        now = datetime.now(timezone.utc)
        async with sessions() as session:
            account = PlatformAccount(user_id="finance-user", platform="shopee", account_name="Shopee 财务店")
            product = Product(user_id="finance-user", sku="BAG-BASE", name="财务 SKU 商品", cost_price=30)
            session.add_all([account, product])
            await session.flush()
            listing = PlatformListing(
                user_id="finance-user",
                product_id=product.id,
                platform_account_id=account.id,
                title="财务 SKU Listing",
                price=99,
                stock=99,
                status="active",
            )
            session.add(listing)
            await session.flush()
            session.add_all([
                ProductSkuVariant(
                    user_id="finance-user",
                    product_id=product.id,
                    platform_listing_id=listing.id,
                    scope="listing_override",
                    merchant_sku="MER-RED",
                    platform_sku="PLAT-RED",
                    skc="SKC-RED",
                    option_1_name="Color",
                    option_1_value="Red",
                    price=99,
                    stock=8,
                    enabled=True,
                ),
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="sales_income",
                    amount_rmb=198,
                    platform="shopee",
                    sourcing_item_id=product.id,
                    extra={
                        "platform_account_id": account.id,
                        "account_name": account.account_name,
                        "product_id": product.id,
                        "product_name": product.name,
                        "platform_listing_id": listing.id,
                        "sku": "PLAT-RED",
                    },
                    occurred_at=now,
                ),
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="platform_fee",
                    amount_rmb=18,
                    platform="shopee",
                    sourcing_item_id=product.id,
                    extra={
                        "platform_account_id": account.id,
                        "account_name": account.account_name,
                        "product_id": product.id,
                        "product_name": product.name,
                        "platform_listing_id": listing.id,
                        "sku": "UNKNOWN-SKU",
                    },
                    occurred_at=now,
                ),
            ])
            await session.commit()

            traceback = await get_finance_traceback(session, "finance-user", "daily", platform_account_id=account.id)

        await engine.dispose()

        product_row = traceback["by_product"][0]
        contexts = product_row["v5_sku_contexts"]
        assert product_row["product_id"] == product.id
        assert contexts[0]["status"] == "matched"
        assert contexts[0]["source"] == "v5_product_sku_variants"
        assert contexts[0]["merchant_sku"] == "MER-RED"
        assert contexts[0]["platform_sku"] == "PLAT-RED"
        assert contexts[0]["listing_stock"] == 8
        assert contexts[1]["status"] == "unmatched"
        assert "财务台账 SKU 未匹配" in contexts[1]["data_gaps"][0]
        assert "财务台账 SKU 未匹配" in product_row["data_gaps"][0]

    asyncio.run(run_test())


def test_finance_traceback_summary_exposes_real_refund_settlement_and_profit(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'finance-traceback-summary.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        now = datetime.now(timezone.utc)
        async with sessions() as session:
            session.add_all([
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="sales_income",
                    amount_rmb=500,
                    order_id="ORDER-1",
                    sourcing_item_id="PRODUCT-1",
                    platform="shopee",
                    extra={"product_id": "PRODUCT-1", "platform_account_id": "STORE-1", "account_name": "Shopee 店"},
                    occurred_at=now,
                ),
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="purchase_cost",
                    amount_rmb=200,
                    order_id="ORDER-1",
                    sourcing_item_id="PRODUCT-1",
                    platform="shopee",
                    extra={"product_id": "PRODUCT-1", "platform_account_id": "STORE-1", "account_name": "Shopee 店"},
                    occurred_at=now,
                ),
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="platform_fee",
                    amount_rmb=30,
                    order_id="ORDER-1",
                    sourcing_item_id="PRODUCT-1",
                    platform="shopee",
                    extra={"product_id": "PRODUCT-1", "platform_account_id": "STORE-1", "account_name": "Shopee 店"},
                    occurred_at=now,
                ),
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="refund",
                    amount_rmb=25,
                    order_id="ORDER-1",
                    sourcing_item_id="PRODUCT-1",
                    platform="shopee",
                    extra={"product_id": "PRODUCT-1", "platform_account_id": "STORE-1", "account_name": "Shopee 店"},
                    occurred_at=now,
                ),
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="withdrawal",
                    amount_rmb=100,
                    platform="shopee",
                    extra={"platform_account_id": "STORE-1", "account_name": "Shopee 店"},
                    occurred_at=now,
                ),
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="platform_wallet_balance",
                    amount_rmb=900,
                    platform="shopee",
                    extra={"platform_account_id": "STORE-1", "account_name": "Shopee 店"},
                    occurred_at=now,
                ),
            ])
            await session.commit()

            traceback = await get_finance_traceback(session, "finance-user", "daily")

        await engine.dispose()

        summary = traceback["summary"]
        assert summary["entry_count"] == 6
        assert summary["order_count"] == 1
        assert summary["product_count"] == 1
        assert summary["store_count"] == 1
        assert summary["total_revenue_rmb"] == 500
        assert summary["total_cost_rmb"] == 255
        assert summary["net_profit_rmb"] == 245
        assert summary["refund_rmb"] == 25
        assert summary["platform_bill_rmb"] == 55
        assert summary["settlement_movement_rmb"] == 155

    asyncio.run(run_test())


def test_finance_ledger_can_filter_exact_platform_store(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'finance-ledger-store-filter.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        now = datetime.now(timezone.utc)
        async with sessions() as session:
            session.add_all([
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="sales_income",
                    amount_rmb=100,
                    platform="shopee",
                    extra={"platform_account_id": "store-a", "account_name": "Shopee A"},
                    occurred_at=now,
                ),
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="sales_income",
                    amount_rmb=200,
                    platform="shopee",
                    extra={"platform_account_id": "store-b", "account_name": "Shopee B"},
                    occurred_at=now,
                ),
            ])
            await session.commit()

            entries, total = await list_ledger_entries(session, "finance-user", page_size=10, platform_account_id="store-a")

        await engine.dispose()

        assert total == 1
        assert entries[0].amount_rmb == 100
        assert entries[0].extra["platform_account_id"] == "store-a"

    asyncio.run(run_test())


def test_finance_summary_and_traceback_filter_exact_platform_store(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'finance-store-scope.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        now = datetime.now(timezone.utc)
        async with sessions() as session:
            store_a = PlatformAccount(user_id="finance-user", platform="shopee", account_name="Shopee A")
            store_b = PlatformAccount(user_id="finance-user", platform="tiktok", account_name="TikTok B")
            session.add_all([store_a, store_b])
            await session.flush()
            session.add_all([
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="sales_income",
                    amount_rmb=500,
                    platform="shopee",
                    order_id="order-a",
                    sourcing_item_id="product-a",
                    extra={"platform_account_id": store_a.id, "account_name": "Shopee A", "product_name": "斜挎包"},
                    occurred_at=now,
                ),
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="platform_fee",
                    amount_rmb=50,
                    platform="shopee",
                    order_id="order-a",
                    sourcing_item_id="product-a",
                    extra={"platform_account_id": store_a.id, "account_name": "Shopee A", "product_name": "斜挎包"},
                    occurred_at=now,
                ),
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="cash_balance",
                    amount_rmb=900,
                    platform="shopee",
                    extra={"platform_account_id": store_a.id, "account_name": "Shopee A"},
                    occurred_at=now,
                ),
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="sales_income",
                    amount_rmb=900,
                    platform="tiktok",
                    order_id="order-b",
                    sourcing_item_id="product-b",
                    extra={"platform_account_id": store_b.id, "account_name": "TikTok B", "product_name": "手机支架"},
                    occurred_at=now,
                ),
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="cash_balance",
                    amount_rmb=1800,
                    platform="tiktok",
                    extra={"platform_account_id": store_b.id, "account_name": "TikTok B"},
                    occurred_at=now,
                ),
            ])
            await session.commit()

            summary = await get_finance_summary(session, "finance-user", "daily", platform_account_id=store_a.id)
            traceback = await get_finance_traceback(session, "finance-user", "daily", platform_account_id=store_a.id)

        await engine.dispose()

        assert summary["total_revenue_rmb"] == 500
        assert summary["total_cost_rmb"] == 50
        assert summary["net_profit_rmb"] == 450
        assert summary["cash_balance_rmb"] == 900
        assert summary["entry_count"] == 3
        assert f"店铺={store_a.account_name}" in summary["evidence_window"]
        assert traceback["summary"] == {
            "order_count": 1,
            "product_count": 1,
            "store_count": 1,
            "entry_count": 3,
        }
        assert traceback["by_order"][0]["order_id"] == "order-a"
        assert traceback["by_product"][0]["product_id"] == "product-a"
        assert traceback["by_store"][0]["store_key"] == store_a.id
        assert all("order-b" not in str(row) for row in traceback["by_order"])

    asyncio.run(run_test())


def test_finance_summary_excludes_future_ledger_entries(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'finance-future.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        now = datetime.now(timezone.utc)
        async with sessions() as session:
            session.add_all([
                FinanceLedgerEntry(user_id="finance-user", entry_type="sales_income", amount_rmb=1200, occurred_at=now),
                FinanceLedgerEntry(user_id="finance-user", entry_type="purchase_cost", amount_rmb=400, occurred_at=now + timedelta(days=10)),
            ])
            await session.commit()
            summary = await get_finance_summary(session, "finance-user", "monthly")
        await engine.dispose()

        assert summary["total_revenue_rmb"] == 1200
        assert summary["total_cost_rmb"] is None
        assert any("未来发生日期" in gap for gap in summary["data_gaps"])

    asyncio.run(run_test())


def test_finance_summary_exposes_backend_risk_signals(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'finance-risk-signals.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        now = datetime.now(timezone.utc)
        async with sessions() as session:
            session.add_all([
                FinanceLedgerEntry(user_id="finance-user", entry_type="sales_income", amount_rmb=300, occurred_at=now),
                FinanceLedgerEntry(user_id="finance-user", entry_type="refund", amount_rmb=500, occurred_at=now),
            ])
            await session.commit()
            summary = await get_finance_summary(session, "finance-user", "daily")
        await engine.dispose()

        risk_by_code = {signal["code"]: signal for signal in summary["risk_signals"]}

        assert risk_by_code["negative_profit"]["level"] == "high"
        assert risk_by_code["negative_profit"]["action_route"].startswith("/finance?")
        assert risk_by_code["purchase_cost_missing"]["title"] == "采购成本缺失"
        assert risk_by_code["platform_bill_missing"]["title"] == "平台费缺失"
        assert risk_by_code["cash_balance_missing"]["title"] == "资金余额未录入"
        assert "revenue_missing" not in risk_by_code
        assert all(signal["action_label"] for signal in summary["risk_signals"])

    asyncio.run(run_test())


def test_finance_summary_exposes_platform_settlement_without_counting_wallet_as_profit(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'finance-settlement.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        now = datetime.now(timezone.utc)
        async with sessions() as session:
            session.add_all([
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="sales_income",
                    amount_rmb=1000,
                    platform="shopee",
                    market="MY",
                    order_id="order-1",
                    occurred_at=now,
                ),
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="platform_wallet_balance",
                    amount_rmb=620,
                    platform="shopee",
                    market="MY",
                    amount_original=380,
                    currency="MYR",
                    extra={"account_name": "Shopee MY A 店", "reference_rate": "USD/CNY 7.18"},
                    occurred_at=now,
                ),
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="withdrawal",
                    amount_rmb=300,
                    platform="shopee",
                    market="MY",
                    extra={"destination": "微信零钱账户"},
                    occurred_at=now,
                ),
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="supplier_payment",
                    amount_rmb=220,
                    platform="shopee",
                    market="MY",
                    occurred_at=now,
                ),
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="transaction_fee",
                    amount_rmb=18,
                    platform="shopee",
                    market="MY",
                    order_id="order-1",
                    occurred_at=now,
                ),
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="service_fee",
                    amount_rmb=12,
                    platform="shopee",
                    market="MY",
                    order_id="order-1",
                    occurred_at=now,
                ),
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="refund",
                    amount_rmb=50,
                    platform="shopee",
                    market="MY",
                    order_id="order-1",
                    occurred_at=now,
                ),
                FinanceLedgerEntry(user_id="finance-user", entry_type="cash_balance", amount_rmb=1600, occurred_at=now),
            ])
            await session.commit()
            summary = await get_finance_summary(session, "finance-user", "daily")
        await engine.dispose()

        assert summary["total_revenue_rmb"] == 1000
        assert summary["total_cost_rmb"] == 300
        assert summary["net_profit_rmb"] == 700
        assert summary["cost_breakdown"] == {
            "supplier_payment": 220,
            "transaction_fee": 18,
            "service_fee": 12,
            "refund": 50,
        }
        assert summary["platform_settlement"]["wallet_balances"] == [
            {
                "platform": "shopee",
                "market": "MY",
                "amount_rmb": 620,
                "amount_original": 380,
                "currency": "MYR",
                "account_name": "Shopee MY A 店",
                "reference_rate": "USD/CNY 7.18",
                "source_entry_id": summary["platform_settlement"]["wallet_balances"][0]["source_entry_id"],
                "occurred_at": summary["platform_settlement"]["wallet_balances"][0]["occurred_at"],
            }
        ]
        assert summary["platform_settlement"]["movement_totals"] == {
            "withdrawal": 300,
            "supplier_payment": 220,
            "platform_fee": 0,
            "transaction_fee": 18,
            "service_fee": 12,
            "tax_fee": 0,
            "refund": 50,
        }
        assert summary["platform_settlement"]["order_reconciliation"] == {
            "linked_order_count": 1,
            "linked_entry_count": 4,
        }
        assert "finance_ledger_entries.platform_wallet_balance" not in summary["data_gaps"]
        assert "finance_ledger_entries.withdrawal" not in summary["data_gaps"]

    asyncio.run(run_test())


def test_finance_traceback_groups_real_ledger_by_order_product_and_store(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'finance-traceback.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        now = datetime.now(timezone.utc)
        async with sessions() as session:
            session.add_all([
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="sales_income",
                    amount_rmb=500,
                    platform="shopee",
                    market="MY",
                    order_id="order-ready",
                    sourcing_item_id="product-a",
                    extra={"account_name": "Shopee MY A 店"},
                    occurred_at=now,
                ),
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="platform_fee",
                    amount_rmb=30,
                    platform="shopee",
                    market="MY",
                    order_id="order-ready",
                    sourcing_item_id="product-a",
                    extra={"account_name": "Shopee MY A 店"},
                    occurred_at=now,
                ),
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="transaction_fee",
                    amount_rmb=10,
                    platform="shopee",
                    market="MY",
                    order_id="order-ready",
                    sourcing_item_id="product-a",
                    extra={"account_name": "Shopee MY A 店"},
                    occurred_at=now,
                ),
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="purchase_cost",
                    amount_rmb=260,
                    platform="shopee",
                    market="MY",
                    order_id="order-ready",
                    sourcing_item_id="product-a",
                    extra={"account_name": "Shopee MY A 店", "product_name": "尼龙斜挎包"},
                    occurred_at=now,
                ),
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="sales_income",
                    amount_rmb=300,
                    platform="tiktok",
                    market="PH",
                    order_id="order-missing-bill",
                    sourcing_item_id="product-b",
                    extra={"account_name": "TikTok PH 店铺", "product_name": "手机支架"},
                    occurred_at=now,
                ),
            ])
            await session.commit()
            traceback = await get_finance_traceback(session, "finance-user", "daily")
        await engine.dispose()

        assert traceback["summary"] == {
            "order_count": 2,
            "product_count": 2,
            "store_count": 2,
            "entry_count": 5,
        }
        assert traceback["by_order"][0]["order_id"] == "order-ready"
        assert traceback["by_order"][0]["revenue_rmb"] == 500
        assert traceback["by_order"][0]["cost_rmb"] == 300
        assert traceback["by_order"][0]["net_profit_rmb"] == 200
        assert traceback["by_order"][0]["cost_breakdown"] == {
            "platform_fee": 30,
            "transaction_fee": 10,
            "purchase_cost": 260,
        }
        assert traceback["by_order"][0]["data_gaps"] == []
        missing_bill = next(item for item in traceback["by_order"] if item["order_id"] == "order-missing-bill")
        assert missing_bill["net_profit_rmb"] is None
        assert "platform_bill" in missing_bill["data_gaps"]
        assert traceback["by_product"][0]["product_id"] == "product-a"
        assert traceback["by_product"][0]["product_name"] == "尼龙斜挎包"
        assert traceback["by_store"][0]["account_name"] == "Shopee MY A 店"
        assert traceback["by_store"][0]["net_profit_rmb"] == 200

    asyncio.run(run_test())


def test_platform_bill_import_replenishes_order_traceback_gap_idempotently(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'finance-bill-import.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        now = datetime.now(timezone.utc)
        async with sessions() as session:
            session.add(
                FinanceLedgerEntry(
                    user_id="finance-user",
                    entry_type="sales_income",
                    amount_rmb=300,
                    platform="tiktok",
                    market="PH",
                    order_id="order-bill-import",
                    sourcing_item_id="product-b",
                    extra={"account_name": "TikTok PH 店铺", "product_name": "手机支架"},
                    occurred_at=now,
                )
            )
            await session.commit()
            before = await get_finance_traceback(session, "finance-user", "daily")
            missing = next(item for item in before["by_order"] if item["order_id"] == "order-bill-import")
            assert "platform_bill" in missing["data_gaps"]

            result = await import_platform_bill_records(session, "finance-user", [
                {
                    "import_ref": "tt-ph-bill-001-fee",
                    "order_id": "order-bill-import",
                    "entry_type": "platform_fee",
                    "amount_rmb": 18,
                    "platform": "tiktok",
                    "market": "PH",
                    "sourcing_item_id": "product-b",
                    "account_name": "TikTok PH 店铺",
                    "product_name": "手机支架",
                    "occurred_at": now,
                },
                {
                    "import_ref": "tt-ph-bill-001-transaction",
                    "order_id": "order-bill-import",
                    "entry_type": "transaction_fee",
                    "amount_rmb": 6,
                    "platform": "tiktok",
                    "market": "PH",
                    "sourcing_item_id": "product-b",
                    "account_name": "TikTok PH 店铺",
                    "product_name": "手机支架",
                    "occurred_at": now,
                },
            ])
            duplicate = await import_platform_bill_records(session, "finance-user", [
                {
                    "import_ref": "tt-ph-bill-001-fee",
                    "order_id": "order-bill-import",
                    "entry_type": "platform_fee",
                    "amount_rmb": 18,
                    "platform": "tiktok",
                    "market": "PH",
                    "occurred_at": now,
                }
            ])
            after = await get_finance_traceback(session, "finance-user", "daily")
        await engine.dispose()

        assert result["imported_count"] == 2
        assert result["skipped_count"] == 0
        assert duplicate["imported_count"] == 0
        assert duplicate["skipped_count"] == 1
        completed = next(item for item in after["by_order"] if item["order_id"] == "order-bill-import")
        assert completed["cost_rmb"] == 24
        assert completed["net_profit_rmb"] == 276
        assert "platform_bill" not in completed["data_gaps"]

    asyncio.run(run_test())


def test_platform_bill_sync_reports_open_api_gap_without_fake_entries(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'finance-bill-sync-gap.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            account = PlatformAccount(
                user_id="finance-user",
                platform="shopee",
                account_name="Shopee MY 店铺",
                shop_id="shop-1",
                api_key_encrypted="stored-key",
                api_secret_encrypted="stored-secret",
            )
            session.add(account)
            await session.commit()
            result = await sync_platform_bills_for_account(session, "finance-user", account.id)
            entries = (await session.execute(select(FinanceLedgerEntry))).scalars().all()
        await engine.dispose()

        assert result["status"] == "blocked"
        assert result["import_result"]["imported_count"] == 0
        assert "platform_bill_open_api.not_implemented" in result["data_gaps"]
        assert entries == []

    asyncio.run(run_test())


def test_platform_bill_sync_imports_adapter_records_idempotently(tmp_path):
    class FakeBillClient(BasePlatformClient):
        async def authenticate(self) -> bool:
            return True

        async def refresh_token(self) -> bool:
            return True

        async def get_products(self, page: int = 1, page_size: int = 50):
            return [], 0

        async def get_orders(self, start_date, end_date, page=1, page_size=50, status_filter=None):
            return [], 0

        async def get_shipments(self, start_date, end_date, page=1):
            return [], 0

        async def push_tracking(self, platform_order_id: str, tracking_number: str, carrier: str) -> bool:
            return True

        async def get_shop_metrics(self, start_date, end_date):
            return None

        async def get_finance_bills(self, start_date, end_date, page=1, page_size=100):
            if page > 1:
                return [], 2
            return [
                PlatformBillRecord(
                    import_ref="fake-bill-001-fee",
                    entry_type="platform_fee",
                    amount_rmb=12,
                    amount_original=1.6,
                    currency="USD",
                    order_id="order-api-sync",
                    sourcing_item_id="product-api-sync",
                    product_name="旅行收纳袋",
                    description="平台佣金 API 同步",
                    occurred_at=start_date,
                ),
                PlatformBillRecord(
                    import_ref="fake-bill-001-transaction",
                    entry_type="transaction_fee",
                    amount_rmb=3,
                    amount_original=0.4,
                    currency="USD",
                    order_id="order-api-sync",
                    sourcing_item_id="product-api-sync",
                    product_name="旅行收纳袋",
                    description="交易手续费 API 同步",
                    occurred_at=start_date,
                ),
            ], 2

    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'finance-bill-sync-adapter.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        old_client = PlatformClientFactory._registry.get("fakebill")
        old_connector = PLATFORM_CONNECTORS.get("fakebill")
        PlatformClientFactory.register("fakebill", FakeBillClient)
        PLATFORM_CONNECTORS["fakebill"] = {
            "implementation_status": "implemented",
            "implemented_operations": ("authenticate", "finance_bills"),
            "required_inputs": (),
        }
        try:
            async with engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)
            async with sessions() as session:
                account = PlatformAccount(
                    user_id="finance-user",
                    platform="fakebill",
                    account_name="Fake API 店铺",
                    shop_id="shop-1",
                    api_key_encrypted="stored-key",
                    api_secret_encrypted="stored-secret",
                    access_token_encrypted="stored-access-token",
                    refresh_token_encrypted="stored-refresh-token",
                    token_expires_at=datetime.now(timezone.utc) + timedelta(days=1),
                    token_scopes=["finance_bills"],
                    settings={"market": "MY"},
                )
                session.add(account)
                await session.commit()
                first = await sync_platform_bills_for_account(session, "finance-user", account.id)
                second = await sync_platform_bills_for_account(session, "finance-user", account.id)
                traceback = await get_finance_traceback(session, "finance-user", "monthly")
            await engine.dispose()
        finally:
            if old_client:
                PlatformClientFactory.register("fakebill", old_client)
            else:
                PlatformClientFactory._registry.pop("fakebill", None)
            if old_connector:
                PLATFORM_CONNECTORS["fakebill"] = old_connector
            else:
                PLATFORM_CONNECTORS.pop("fakebill", None)

        assert first["status"] == "success"
        assert first["import_result"]["imported_count"] == 2
        assert second["status"] == "success"
        assert second["import_result"]["imported_count"] == 0
        assert second["import_result"]["skipped_count"] == 2
        order = next(item for item in traceback["by_order"] if item["order_id"] == "order-api-sync")
        assert order["cost_rmb"] == 15
        assert "platform_bill" not in order["data_gaps"]

    asyncio.run(run_test())
