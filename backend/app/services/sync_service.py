import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.models.platform_account import PlatformAccount
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.sync_log import SyncLog
from app.models.platform_listing import PlatformListing
from app.models.finance_ledger import FinanceLedgerEntry
from app.models.exchange_rate import ExchangeRate
from app.models.product import Product
from app.integrations.factory import PlatformClientFactory
from app.integrations.status import is_order_sync_ready, is_product_sync_ready
from app.services.config_service import get_platform_product_field_groups
from app.services.media_readiness_service import media_readiness_from_extra
from app.services.platform_product_validation_service import build_synced_product_platform_validation
from app.utils.encryption import decrypt

logger = logging.getLogger(__name__)


class SyncService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_platform_store_products(
        self,
        user_id: str,
        platform: Optional[str] = None,
        platform_account_id: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict], int]:
        query = (
            select(PlatformListing, PlatformAccount, Product)
            .join(PlatformAccount, PlatformAccount.id == PlatformListing.platform_account_id)
            .join(Product, Product.id == PlatformListing.product_id)
            .where(PlatformListing.user_id == user_id)
        )
        if platform:
            query = query.where(PlatformAccount.platform == platform)
        if platform_account_id:
            query = query.where(PlatformListing.platform_account_id == platform_account_id)
        if status:
            query = query.where(PlatformListing.status == status)
        if search:
            like = f"%{search}%"
            query = query.where(or_(
                PlatformListing.title.ilike(like),
                PlatformListing.platform_product_id.ilike(like),
                Product.name.ilike(like),
                Product.sku.ilike(like),
                PlatformAccount.account_name.ilike(like),
            ))

        total = (await self.db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
        result = await self.db.execute(
            query.order_by(PlatformListing.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)
        )
        return [
            self._platform_store_product_payload(listing, account, product)
            for listing, account, product in result.all()
        ], total

    async def sync_products_for_account(self, account: PlatformAccount) -> SyncLog:
        if not is_product_sync_ready(account):
            raise ValueError("Platform Open API is not ready for product sync")

        log = SyncLog(
            user_id=account.user_id,
            platform_account_id=account.id,
            sync_type="products",
            status="running",
            started_at=datetime.now(timezone.utc),
        )
        self.db.add(log)
        await self.db.commit()

        try:
            client = PlatformClientFactory.get_client(account.platform, account, decrypt)
            if not client:
                raise ValueError(f"No client for platform: {account.platform}")
            if not await client.authenticate():
                raise ValueError("Authentication failed")

            now = datetime.now(timezone.utc)
            remote_products = await self._fetch_product_pages(client)
            field_schemas = await get_platform_product_field_groups(self.db)
            created = 0
            updated = 0
            failed = 0
            for remote_product in remote_products:
                try:
                    changed = await self._upsert_platform_product(account, remote_product, now, field_schemas)
                    if changed == "created":
                        created += 1
                    else:
                        updated += 1
                except Exception as e:
                    logger.error("Failed to process product %s: %s", getattr(remote_product, "platform_product_id", None), e)
                    failed += 1

            account.last_sync_at = now
            if failed and failed == len(remote_products):
                log.status = "failed"
                log.error_message = "所有远程商品均处理失败"
            elif failed:
                log.status = "partial_failed"
                log.error_message = f"{failed} 条远程商品处理失败"
            else:
                log.status = "success"
            log.completed_at = datetime.now(timezone.utc)
            log.records_processed = len(remote_products)
            log.records_created = created
            log.records_updated = updated
            log.records_failed = failed
            self._write_sync_state(account, log)
            await self.db.commit()
        except Exception as e:
            log.status = "failed"
            log.completed_at = datetime.now(timezone.utc)
            log.error_message = str(e)
            self._write_sync_state(account, log)
            await self.db.commit()
        return log

    async def sync_orders_for_account(self, account: PlatformAccount) -> SyncLog:
        if not is_order_sync_ready(account):
            raise ValueError("Platform Open API is not ready for order sync")

        log = SyncLog(
            user_id=account.user_id,
            platform_account_id=account.id,
            sync_type="orders",
            status="running",
            started_at=datetime.now(timezone.utc),
        )
        self.db.add(log)
        await self.db.commit()

        try:
            client = PlatformClientFactory.get_client(
                account.platform, account, decrypt
            )
            if not client:
                raise ValueError(f"No client for platform: {account.platform}")

            auth_ok = await client.authenticate()
            if not auth_ok:
                raise ValueError("Authentication failed")

            now = datetime.now(timezone.utc)
            last_sync = account.last_sync_at or (now - timedelta(days=30))
            orders = await self._fetch_order_pages(client, last_sync, now)

            created = 0
            updated = 0
            failed = 0

            for plat_order in orders:
                try:
                    if plat_order.total is None or not plat_order.currency:
                        raise ValueError("Remote order is missing total or currency")
                    existing = await self.db.execute(
                        select(Order).where(
                            Order.platform_account_id == account.id,
                            Order.platform_order_id == plat_order.platform_order_id,
                        )
                    )
                    existing_order = existing.scalar_one_or_none()

                    order_data = dict(
                        user_id=account.user_id,
                        platform_account_id=account.id,
                        platform_order_id=plat_order.platform_order_id,
                        order_number=plat_order.order_number,
                        status=plat_order.status,
                        buyer_name=plat_order.buyer_name,
                        buyer_notes=plat_order.buyer_notes,
                        shipping_address=plat_order.shipping_address,
                        subtotal=plat_order.subtotal,
                        shipping_fee=plat_order.shipping_fee,
                        platform_fee=plat_order.platform_fee,
                        discount=plat_order.discount,
                        total=plat_order.total,
                        currency=plat_order.currency,
                        payment_status=plat_order.payment_status,
                        ordered_at=plat_order.ordered_at or now,
                        last_synced_at=now,
                    )

                    if existing_order:
                        for field, value in order_data.items():
                            setattr(existing_order, field, value)
                        await self._sync_order_finance_entries(existing_order, account.platform)
                        updated += 1
                    else:
                        new_order = Order(**order_data)
                        self.db.add(new_order)
                        await self.db.flush()  # Get the ID before creating items
                        await self._sync_order_finance_entries(new_order, account.platform)

                        for item in (plat_order.items or []):
                            if item.unit_price is None or item.quantity is None:
                                logger.warning("Skip incomplete item in order %s", plat_order.platform_order_id)
                                continue
                            item_data = dict(
                                order_id=new_order.id,
                                name=item.name,
                                sku=item.sku,
                                quantity=item.quantity,
                                unit_price=item.unit_price,
                                total_price=item.quantity * item.unit_price,
                            )
                            self.db.add(OrderItem(**item_data))

                        created += 1

                except Exception as e:
                    logger.error(f"Failed to process order {plat_order.platform_order_id}: {e}")
                    failed += 1

            account.last_sync_at = now
            self._write_sync_state(account, log)
            await self.db.commit()

            if failed and failed == len(orders):
                log.status = "failed"
                log.error_message = "所有远程订单均处理失败"
            elif failed:
                log.status = "partial_failed"
                log.error_message = f"{failed} 条远程订单处理失败"
            else:
                log.status = "success"
            log.completed_at = datetime.now(timezone.utc)
            log.records_processed = len(orders)
            log.records_created = created
            log.records_updated = updated
            log.records_failed = failed
            self._write_sync_state(account, log)
            await self.db.commit()

        except Exception as e:
            log.status = "failed"
            log.completed_at = datetime.now(timezone.utc)
            log.error_message = str(e)
            self._write_sync_state(account, log)
            await self.db.commit()

        return log

    async def sync_all_platforms(self, user_id: Optional[str] = None, account_ids: Optional[list[str]] = None) -> list[SyncLog]:
        query = select(PlatformAccount).where(PlatformAccount.is_active == True)
        if account_ids is not None:
            if not account_ids:
                return []
            query = query.where(PlatformAccount.id.in_(account_ids))
        if user_id:
            query = query.where(PlatformAccount.user_id == user_id)
        result = await self.db.execute(query)
        accounts = list(result.scalars().all())

        logs = []
        for account in accounts:
            if not is_order_sync_ready(account):
                logger.info(
                    "Skip scheduled sync for %s account %s: Open API is not ready",
                    account.platform,
                    account.id,
                )
                continue
            log = await self.sync_orders_for_account(account)
            logs.append(log)

        return logs

    async def sync_all_products(self, user_id: Optional[str] = None, account_ids: Optional[list[str]] = None) -> list[SyncLog]:
        query = select(PlatformAccount).where(PlatformAccount.is_active == True)
        if account_ids is not None:
            if not account_ids:
                return []
            query = query.where(PlatformAccount.id.in_(account_ids))
        if user_id:
            query = query.where(PlatformAccount.user_id == user_id)
        result = await self.db.execute(query)
        logs = []
        for account in result.scalars().all():
            if not is_product_sync_ready(account):
                logger.info("Skip product sync for %s account %s: Open API products operation is not ready", account.platform, account.id)
                continue
            logs.append(await self.sync_products_for_account(account))
        return logs

    async def record_blocked_sync(
        self,
        account: PlatformAccount,
        sync_type: str,
        message: str,
        error_details: Optional[list[dict]] = None,
    ) -> SyncLog:
        now = datetime.now(timezone.utc)
        log = SyncLog(
            user_id=account.user_id,
            platform_account_id=account.id,
            sync_type=sync_type,
            status="failed",
            started_at=now,
            completed_at=now,
            records_processed=0,
            records_created=0,
            records_updated=0,
            records_failed=0,
            error_message=message,
            error_details=error_details or [],
        )
        self.db.add(log)
        self._write_sync_state(account, log)
        await self.db.commit()
        await self.db.refresh(log)
        await self.db.refresh(account)
        return log

    async def _fetch_order_pages(self, client, start_at: datetime, end_at: datetime) -> list:
        """Fetch all remote order pages while rejecting ambiguous empty-page totals."""
        page = 1
        page_size = 50
        orders = []
        seen_ids = set()
        while page <= 1000:
            items, total = await client.get_orders(start_at, end_at, page=page, page_size=page_size)
            if not items:
                break
            for item in items:
                if item.platform_order_id not in seen_ids:
                    orders.append(item)
                    seen_ids.add(item.platform_order_id)
            if total is not None and len(orders) >= total:
                break
            page += 1
        return orders

    async def _fetch_product_pages(self, client) -> list:
        page = 1
        page_size = 50
        products = []
        seen_ids = set()
        while page <= 1000:
            items, total = await client.get_products(page=page, page_size=page_size)
            if not items:
                break
            for item in items:
                if item.platform_product_id not in seen_ids:
                    products.append(item)
                    seen_ids.add(item.platform_product_id)
            if total is not None and len(products) >= total:
                break
            page += 1
        return products

    async def _upsert_platform_product(
        self,
        account: PlatformAccount,
        remote_product,
        synced_at: datetime,
        field_schemas: dict | None = None,
    ) -> str:
        if not remote_product.platform_product_id:
            raise ValueError("Remote product is missing platform_product_id")
        if not remote_product.title:
            raise ValueError("Remote product is missing title")
        if remote_product.price is None:
            raise ValueError("Remote product is missing price")
        if remote_product.stock is None:
            raise ValueError("Remote product is missing stock")

        existing_listing = (await self.db.execute(
            select(PlatformListing).where(
                PlatformListing.platform_account_id == account.id,
                PlatformListing.platform_product_id == remote_product.platform_product_id,
            )
        )).scalar_one_or_none()
        product = None
        if existing_listing:
            product = await self.db.get(Product, existing_listing.product_id)
        if not product:
            product = await self._find_product_master_for_remote(account, remote_product)
        if not product:
            product_sku = self._remote_product_master_sku(remote_product) or self._platform_product_sku(account, remote_product.platform_product_id)
            product = Product(
                user_id=account.user_id,
                sku=product_sku,
                name=remote_product.title,
                description=remote_product.description,
                images=remote_product.images or [],
                status="draft",
                attributes={
                    "platform_product_source": {
                        "platform": account.platform,
                        "platform_account_id": account.id,
                        "account_name": account.account_name,
                        "platform_product_id": remote_product.platform_product_id,
                        "synced_at": synced_at.isoformat(),
                    },
                    "variants": remote_product.variations or [],
                },
            )
            self.db.add(product)
            await self.db.flush()

        listing = existing_listing or PlatformListing(
            user_id=account.user_id,
            product_id=product.id,
            platform_account_id=account.id,
            platform_product_id=remote_product.platform_product_id,
        )
        if not existing_listing:
            self.db.add(listing)

        listing.platform_category_id = remote_product.platform_category_id or remote_product.category_id
        listing.title = remote_product.title
        listing.description = remote_product.description
        listing.price = remote_product.price
        listing.stock = remote_product.stock
        listing.variations = remote_product.variations or []
        listing.images = remote_product.images or []
        listing.status = remote_product.status or "draft"
        field_validation = build_synced_product_platform_validation(
            platform=account.platform,
            remote_product=remote_product,
            field_schemas=field_schemas,
        )
        listing.platform_data = {
            **(listing.platform_data or {}),
            "source": "platform_product_sync",
            "raw_data": remote_product.raw_data,
            "attribute_values": field_validation["attribute_values"],
            "platform_requirements": field_validation["platform_requirements"],
            "validation_checks": field_validation["validation_checks"],
            "listing_snapshot": {
                "title": remote_product.title,
                "description": remote_product.description,
                "images": remote_product.images or [],
                "variations": remote_product.variations or [],
                "price": remote_product.price,
                "stock": remote_product.stock,
            },
        }
        listing.last_synced_at = synced_at
        await self.db.flush()
        return "updated" if existing_listing else "created"

    async def _find_product_master_for_remote(self, account: PlatformAccount, remote_product) -> Product | None:
        """Find an existing product master by seller/internal SKU before creating a new one.

        A platform product synced from different stores may have different platform IDs,
        but the seller SKU normally points to the same internal product. Reusing the
        master keeps Product facts stable while each store keeps its own Listing
        title, price, stock, media, and platform response.
        """
        master_sku = self._remote_product_master_sku(remote_product)
        if not master_sku:
            return None
        return (await self.db.execute(
            select(Product).where(
                Product.user_id == account.user_id,
                Product.sku == master_sku,
            )
        )).scalar_one_or_none()

    def _remote_product_master_sku(self, remote_product) -> str | None:
        raw_data = remote_product.raw_data if isinstance(getattr(remote_product, "raw_data", None), dict) else {}
        for key in (
            "merchant_sku",
            "seller_sku",
            "sellerSku",
            "sellerSKU",
            "sku",
            "skuExtCode",
            "outer_sku_id",
            "item_sku",
        ):
            sku = self._clean_product_sku(raw_data.get(key))
            if sku:
                return sku
        for variant in getattr(remote_product, "variations", None) or []:
            if not isinstance(variant, dict):
                continue
            for key in ("sku", "seller_sku", "sellerSku", "skuExtCode", "model_sku"):
                sku = self._clean_product_sku(variant.get(key))
                if sku:
                    return sku
        return None

    def _clean_product_sku(self, value) -> str | None:
        if value is None:
            return None
        sku = str(value).strip()
        if not sku:
            return None
        return sku[:100]

    def _platform_store_product_payload(self, listing: PlatformListing, account: PlatformAccount, product: Product) -> dict:
        media_readiness = media_readiness_from_extra(listing.platform_data or {}, listing.images or [])
        return {
            "id": listing.id,
            "platform": account.platform,
            "platform_product_id": listing.platform_product_id,
            "title": listing.title,
            "status": listing.status,
            "price": listing.price,
            "stock": listing.stock,
            "image_count": len(listing.images or []),
            "images": listing.images or [],
            "media_readiness": media_readiness,
            "variation_count": len(listing.variations or []),
            "store_override_summary": self._listing_store_override_summary(listing, product),
            "last_synced_at": listing.last_synced_at.isoformat() if listing.last_synced_at else None,
            "source": (listing.platform_data or {}).get("source", "local_listing"),
            "store": {
                "id": account.id,
                "platform": account.platform,
                "account_name": account.account_name,
                "market": (account.settings or {}).get("market"),
            },
            "product_master": {
                "id": product.id,
                "sku": product.sku,
                "name": product.name,
                "image_count": len(product.images or []),
            },
        }

    def _listing_store_override_summary(self, listing: PlatformListing, product: Product) -> dict:
        product_images = product.images if isinstance(product.images, list) else []
        listing_images = listing.images if isinstance(listing.images, list) else []
        variations = listing.variations if isinstance(listing.variations, list) else []
        platform_data = listing.platform_data if isinstance(listing.platform_data, dict) else {}
        shipping_config = listing.shipping_config if isinstance(listing.shipping_config, dict) else {}
        raw_data = platform_data.get("raw_data") if isinstance(platform_data.get("raw_data"), dict) else {}
        attribute_values = platform_data.get("attribute_values") if isinstance(platform_data.get("attribute_values"), dict) else {}
        raw_attributes = raw_data.get("attributes") if isinstance(raw_data.get("attributes"), dict) else {}
        platform_attribute_count = len(attribute_values) or len(raw_attributes)
        return {
            "relation_label": "基础商品 → 店铺 Listing 实例",
            "isolation_note": "店铺覆盖字段不回写基础商品版本",
            "title_overridden": bool(listing.title and listing.title != product.name),
            "description_overridden": bool((listing.description or "") != (product.description or "")),
            "image_count": len(listing_images),
            "master_image_count": len(product_images),
            "images_overridden": bool(listing_images and listing_images != product_images),
            "variation_count": len(variations),
            "price_stock_overridden": True,
            "platform_attribute_count": platform_attribute_count,
            "logistics_configured": bool(shipping_config),
        }

    def _platform_product_sku(self, account: PlatformAccount, platform_product_id: str) -> str:
        raw = f"PLAT-{account.platform[:3].upper()}-{account.id[:8]}-{platform_product_id}"
        return raw[:100]

    def _write_sync_state(self, account: PlatformAccount, log: SyncLog) -> None:
        settings = dict(account.settings or {})
        sync_state = dict(settings.get("sync_state") or {})
        sync_state[log.sync_type] = {
            "status": log.status,
            "last_attempt_at": log.started_at.isoformat() if log.started_at else None,
            "last_completed_at": log.completed_at.isoformat() if log.completed_at else None,
            "records_processed": log.records_processed or 0,
            "records_created": log.records_created or 0,
            "records_updated": log.records_updated or 0,
            "records_failed": log.records_failed or 0,
            "error_message": log.error_message,
        }
        settings["sync_state"] = sync_state
        account.settings = settings

    async def _sync_order_finance_entries(self, order: Order, platform: str) -> None:
        """Create or update finance ledger entries from a synced order.

        Non-CNY orders are converted only when a matching exchange rate exists.
        Without a rate, no ledger entry is written to avoid false RMB amounts.
        """
        revenue_rmb = await self._amount_to_rmb(order.total or 0, order.currency)
        if revenue_rmb is None:
            logger.info("Skip finance ledger for order %s: missing %s/CNY rate", order.order_number, order.currency)
            return

        await self._upsert_finance_entry(
            order=order,
            entry_type="sales_income",
            amount_rmb=revenue_rmb,
            amount_original=order.total or 0,
            currency=order.currency,
            platform=platform,
            description=f"订单收入: {order.order_number or order.platform_order_id}",
        )

        if order.platform_fee and order.platform_fee > 0:
            fee_rmb = await self._amount_to_rmb(order.platform_fee, order.currency)
            if fee_rmb is not None:
                await self._upsert_finance_entry(
                    order=order,
                    entry_type="platform_fee",
                    amount_rmb=fee_rmb,
                    amount_original=order.platform_fee,
                    currency=order.currency,
                    platform=platform,
                    description=f"平台费用: {order.order_number or order.platform_order_id}",
                )

    async def _upsert_finance_entry(
        self,
        order: Order,
        entry_type: str,
        amount_rmb: float,
        amount_original: float,
        currency: str,
        platform: str,
        description: str,
    ) -> None:
        result = await self.db.execute(
            select(FinanceLedgerEntry).where(
                FinanceLedgerEntry.user_id == order.user_id,
                FinanceLedgerEntry.order_id == order.id,
                FinanceLedgerEntry.entry_type == entry_type,
            )
        )
        entry = result.scalar_one_or_none()
        if not entry:
            entry = FinanceLedgerEntry(
                user_id=order.user_id,
                order_id=order.id,
                entry_type=entry_type,
            )
            self.db.add(entry)

        entry.amount_rmb = round(amount_rmb, 2)
        entry.amount_original = amount_original
        entry.currency = currency
        entry.platform = platform
        entry.description = description
        entry.occurred_at = order.ordered_at
        entry.extra = {
            "platform_order_id": order.platform_order_id,
            "order_number": order.order_number,
            "source": "order_sync",
        }

    async def _amount_to_rmb(self, amount: float, currency: str) -> Optional[float]:
        if not amount:
            return 0
        if not currency or currency.upper() == "CNY":
            return amount
        result = await self.db.execute(
            select(ExchangeRate.rate)
            .where(
                ExchangeRate.from_currency == "CNY",
                ExchangeRate.to_currency == currency.upper(),
            )
            .order_by(ExchangeRate.fetched_at.desc())
            .limit(1)
        )
        rate = result.scalar_one_or_none()
        if not rate:
            return None
        return amount / rate
