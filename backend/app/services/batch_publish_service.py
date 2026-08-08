"""Batch listing publish service — reads real templates, writes platform_listings."""
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import desc, select
from app.services.media_readiness_service import media_readiness_from_extra
from app.services.platform_product_field_service import merge_platform_requirements, merge_platform_requirements_map
from app.services.listing_draft_asset_service import (
    build_compliance,
    build_logistics,
    build_media_assets,
    build_sku_plan,
    build_validation_checks,
    normalize_compliance,
    normalize_logistics,
    normalize_media_assets,
    normalize_sku_plan,
    platform_field_gaps_for_requirements,
    videos_from_attributes,
)
from app.services.listing_store_override_service import (
    confirmed_image_slot_plan,
    listing_store_override,
    listing_store_override_summary,
    merge_override_platform_attributes,
    override_compliance,
    override_logistics,
    override_master_sku,
    override_variants,
)
from app.services.batch_publish_receipt_service import build_local_publish_receipt, skipped_publish_result
from app.services.listing_assist_service import generate_listing_assist
from app.services.platform_publish_submit_service import submit_listing_to_platform_if_ready
logger = logging.getLogger(__name__)
async def list_publish_ready_items(db: AsyncSession, user_id: str) -> list[dict]:
    from app.models.sourcing_item import SourcingItem
    from app.services import config_service
    from app.services.sourcing_work_item_projection_service import build_sourcing_work_item
    field_schemas = await config_service.get_platform_product_field_groups(db)
    result = await db.execute(
        select(SourcingItem)
        .where(
            SourcingItem.user_id == user_id,
            SourcingItem.is_active == True,  # noqa: E712
        )
        .order_by(desc(SourcingItem.updated_at))
        .limit(100)
    )
    items = []
    for item in result.scalars().all():
        gaps = _listing_readiness_gaps(item)
        if gaps:
            continue
        listing_store_override_payload = listing_store_override(item)
        image_plan = confirmed_image_slot_plan(item)
        platform_requirements = merge_platform_requirements(((item.extra_data or {}).get("platform_requirements") or {}).get(item.platform) or {}, item.platform, field_schemas)
        platform_requirements = merge_override_platform_attributes(platform_requirements, listing_store_override_payload)
        items.append({
            **build_sourcing_work_item(
                item,
                stage_key="listing",
                status="ready",
                gaps=[],
                route="/publish",
            ),
            "id": item.id,
            "key": f"sourcing:{item.id}",
            "source_type": "sourcing",
            "name": item.product_name,
            "cost_price": item.source_price_rmb,
            "selling_price_local": item.selling_price_local,
            "platform": item.platform,
            "market": item.market,
            "image_url": item.source_image,
            "media_readiness": media_readiness_from_extra(item.extra_data or {}, item.source_image, image_plan=image_plan),
            "platform_requirements": platform_requirements,
            "listing_master_status": _listing_master_status(item),
            "listing_store_override": listing_store_override_summary(listing_store_override_payload),
            "pricing_confirmation": (item.extra_data or {}).get("pricing_confirmation") or {},
            "data_gaps": [],
        })
    return items
async def generate_listing_drafts(
    db: AsyncSession, user_id: str, sourcing_item_ids: list[str],
    platforms: list[str], markets: list[str],
    pricing_mode: str, target_profit_pct: float,
    product_ids: list[str] | None = None,
    platform_account_ids: list[str] | None = None,
) -> list[dict]:
    from app.models.sourcing_item import SourcingItem
    from app.models.product import Product
    from app.models.platform_account import PlatformAccount
    from app.models.platform_listing import PlatformListing
    from app.models.fee_template import FeeTemplate
    from app.models.listing_template import ListingTemplate
    from app.services import config_service
    from app.services.evidence_service import source_ref
    from app.services.product_service import product_name_quality_flags
    from app.services.template_service import render_template_fields

    field_schemas = await config_service.get_platform_product_field_groups(db)
    items = []
    for sid in sourcing_item_ids:
        result = await db.execute(
            select(SourcingItem).where(SourcingItem.id == sid, SourcingItem.user_id == user_id)
        )
        item = result.scalar_one_or_none()
        if item:
            items.append(_source_from_sourcing(item, field_schemas))
    for product_id in product_ids or []:
        result = await db.execute(
            select(Product).where(Product.id == product_id, Product.user_id == user_id)
        )
        product = result.scalar_one_or_none()
        if product:
            listing_result = await db.execute(
                select(PlatformListing, PlatformAccount.platform)
                .join(PlatformAccount, PlatformListing.platform_account_id == PlatformAccount.id)
                .where(
                    PlatformListing.product_id == product.id,
                    PlatformListing.user_id == user_id,
                    PlatformListing.status == "draft",
                )
                .order_by(desc(PlatformListing.updated_at))
            )
            draft_listings = {}
            for listing, listing_platform in listing_result.all():
                draft_listings.setdefault(listing_platform, listing)
            items.append(_source_from_product(product, field_schemas, draft_listings))
    if not items:
        return []
    if not platform_account_ids:
        return []
    account_result = await db.execute(
        select(PlatformAccount).where(
            PlatformAccount.user_id == user_id,
            PlatformAccount.is_active == True,  # noqa: E712
        )
    )
    all_accounts = list(account_result.scalars().all())
    selected_account_ids = set(platform_account_ids or [])
    accounts_by_platform: dict[str, list[PlatformAccount]] = {}
    for account in all_accounts:
        if account.platform not in platforms:
            continue
        if selected_account_ids and account.id not in selected_account_ids:
            continue
        accounts_by_platform.setdefault(account.platform, []).append(account)
    market_config = await config_service.get_markets(db)
    market_labels = {market["id"]: market["label"] for market in market_config}

    template_result = await db.execute(
        select(ListingTemplate)
        .where(ListingTemplate.user_id == user_id)
        .order_by(ListingTemplate.is_default.desc(), ListingTemplate.name)
    )
    all_templates = {}
    for template in template_result.scalars().all():
        all_templates.setdefault(template.platform, template)

    drafts = []
    for item in items:
        for platform in platforms:
            target_accounts = accounts_by_platform.get(platform) or [None]
            for acct in target_accounts:
                for market in markets:
                    fee_result = await db.execute(select(FeeTemplate).where(
                        FeeTemplate.platform == platform, FeeTemplate.market == market, FeeTemplate.is_active == True))
                    fee = fee_result.scalar_one_or_none()

                    source_price = item["source_price_rmb"] if item["source_price_rmb"] and item["source_price_rmb"] > 0 else None
                    commission_pct = fee.commission_pct if fee else None
                    transaction_pct = fee.transaction_fee_pct if fee else None
                    tech_pct = fee.tech_service_pct if fee else None
                    total_fee_pct = (
                        round(commission_pct + transaction_pct + tech_pct, 1)
                        if fee and all(value is not None for value in (
                            commission_pct, transaction_pct, tech_pct
                        ))
                        else None
                    )

                    existing_listing = (item.get("draft_listings") or {}).get(platform)
                    if existing_listing and existing_listing.get("selling_price"):
                        selling_price = existing_listing["selling_price"]
                    elif pricing_mode == "cost_based" and total_fee_pct is not None and source_price is not None:
                        divisor = 1 - (total_fee_pct / 100) - (target_profit_pct / 100)
                        selling_price = round(source_price / max(divisor, 0.05), 2)
                    else:
                        selling_price = item["selling_price_local"]

                    tpl = all_templates.get(platform) or all_templates.get("all")
                    if existing_listing:
                        rendered = {}
                        title = existing_listing.get("title") or item["product_name"] or ""
                        description = existing_listing.get("description") or ""
                    else:
                        rendered = render_template_fields(
                            tpl.template_data,
                            {
                                "product_name": item["product_name"] or "",
                                "keywords": item["product_name"] or "",
                                "category": item["category"] or "",
                            },
                            source_price,
                        ) if tpl else {}
                        title = rendered.get("title_template", item["product_name"] or "")
                        description = rendered.get("description_template", "")
                    if not isinstance(title, str):
                        title = item["product_name"] or ""
                    if not isinstance(description, str):
                        description = ""
                    blocking_reasons = []
                    data_gaps = []
                    if not tpl and not existing_listing:
                        blocking_reasons.append("未配置Listing模板")
                        data_gaps.append("listing_templates")
                    if not fee or total_fee_pct is None:
                        blocking_reasons.append("未配置完整平台费率")
                        data_gaps.append("fee_templates")
                    if source_price is None:
                        blocking_reasons.append("未填写真实采购价")
                        data_gaps.append("sourcing_items.source_price_rmb")
                    if not selling_price or selling_price <= 0:
                        blocking_reasons.append("未填写有效售价")
                        data_gaps.append("sourcing_items.selling_price_local")
                    if "test_residue" in product_name_quality_flags(item["product_name"]):
                        blocking_reasons.append("商品名称疑似测试残留，请先更名或归档后再刊登")
                        data_gaps.append("products.name_quality")
                    platform_requirements = (existing_listing or {}).get("platform_requirements") or item.get("platform_requirements", {}).get(platform, {})
                    platform_field_gaps = platform_field_gaps_for_requirements(platform_requirements)
                    if platform_field_gaps["blocking"]:
                        blocking_reasons.append("平台必填字段未填写：" + "、".join(platform_field_gaps["blocking"]))
                        data_gaps.append("platform_fields.required")
                    if item["source_type"] == "sourcing":
                        readiness_gaps = list(item.get("readiness_gaps") or [])
                        if item.get("target_platform") and platform != item["target_platform"]:
                            readiness_gaps.append("sourcing_items.platform")
                            blocking_reasons.append("目标平台与定价确认平台不一致")
                        if item.get("target_market") and market != item["target_market"]:
                            readiness_gaps.append("sourcing_items.market")
                            blocking_reasons.append("目标市场与定价确认市场不一致")
                        if readiness_gaps:
                            data_gaps.extend(readiness_gaps)
                            if "content_tasks.confirmed" in readiness_gaps:
                                blocking_reasons.append("Listing 内容尚未全部人工确认")
                            if "sourcing_items.pricing_confirmation" in readiness_gaps:
                                blocking_reasons.append("商品尚未完成定价确认")
                    status = "ready"
                    data_gaps = list(dict.fromkeys(data_gaps))
                    blocking_reasons = list(dict.fromkeys(blocking_reasons))
                    if any(gap in data_gaps for gap in ("listing_templates", "fee_templates")):
                        status = "configuration_required"
                    elif data_gaps:
                        status = "data_required"
                    estimated_profit_margin = None
                    if selling_price and selling_price > 0 and total_fee_pct is not None and source_price is not None:
                        estimated_profit_margin = round(
                            ((selling_price - source_price) / max(selling_price, 0.01)) * 100 - total_fee_pct, 1
                        )

                    sku_plan = build_sku_plan(item, selling_price)
                    media_assets = build_media_assets(item)
                    logistics = build_logistics(item)
                    compliance = build_compliance(item)
                    validation_checks = build_validation_checks(
                        title=title,
                        selling_price=selling_price,
                        sku_plan=sku_plan,
                        media_assets=media_assets,
                        logistics=logistics,
                        compliance=compliance,
                        platform_requirements=platform_requirements,
                        fee_missing=not bool(fee),
                        blocking_reasons=blocking_reasons,
                        platform=platform,
                    )
                    validation_blocks = [check for check in validation_checks if check.get("state") == "block"]
                    for check in validation_blocks:
                        blocking_reasons.append(check["message"])
                        data_gaps.append(
                            "platform_fields.required"
                            if check.get("code") == "platform_fields"
                            else f"listing_validation.{check.get('code')}"
                        )
                    data_gaps = list(dict.fromkeys(data_gaps))
                    blocking_reasons = list(dict.fromkeys(blocking_reasons))
                    if any(gap in data_gaps for gap in ("listing_templates", "fee_templates")):
                        status = "configuration_required"
                    elif data_gaps:
                        status = "data_required"

                    drafts.append({
                        "source_type": item["source_type"],
                        "source_product_id": item["source_product_id"],
                        "sourcing_item_id": item["sourcing_item_id"],
                        "product_name": item["product_name"],
                        "product_name_cn": item["product_name_cn"],
                        "category": item["category"],
                        "platform": platform, "market": market,
                        "platform_account_id": acct.id if acct else None,
                        "store": _store_payload(acct) if acct else None,
                        "market_label": market_labels.get(market, market),
                        "selling_price": selling_price, "source_price_rmb": source_price,
                        "commission_pct": commission_pct, "transaction_fee_pct": transaction_pct,
                        "tech_service_pct": tech_pct, "total_fee_pct": total_fee_pct,
                        "estimated_profit_margin": estimated_profit_margin,
                        "images": item["images"],
                        "sku_plan": sku_plan,
                        "media_assets": media_assets,
                        "media_readiness": item.get("media_readiness") or {},
                        "logistics": logistics,
                        "compliance": compliance,
                        "validation_checks": validation_checks,
                        "template_title": title,
                        "template_description": description,
                        "platform_requirements": platform_requirements,
                        "listing_master_status": item["listing_master_status"],
                        "listing_store_override": listing_store_override_summary(item.get("listing_store_override") or {}),
                        "template_missing": not bool(tpl or existing_listing),
                        "fee_missing": not bool(fee),
                        "status": status,
                        "data_gaps": data_gaps,
                        "evidence_window": "当前选品库商品、Listing模板和平台费率配置快照",
                        "confidence_reason": "批量刊登草稿只基于真实选品、模板和费率生成；缺关键字段时只允许保存前置补数状态。",
                        "source_refs": [source_ref(item["source_ref_type"], item["source_id"], label=item["product_name"])],
                        "publishable": len(blocking_reasons) == 0,
                        "blocking_reasons": blocking_reasons,
                    })
    return drafts


async def confirm_publish(
    db: AsyncSession,
    user_id: str,
    drafts: list[dict],
    publish_plan: dict | None = None,
) -> list[dict]:
    """Write confirmed drafts — creates Product first, then local PlatformListing draft."""
    from app.models.platform_listing import PlatformListing
    from app.models.platform_account import PlatformAccount
    from app.models.product import Product
    from app.models.sourcing_item import SourcingItem
    from app.services.product_service import generate_sku
    from app.services.product_service import product_name_quality_flags
    from app.services.store_access_service import list_accessible_store_ids_for_user_id
    from app.services.listing_publish_plan_service import build_local_publish_plan
    from app.services.product_object_model_service import persist_listing_object_model
    from datetime import datetime, timezone

    store_ids = await list_accessible_store_ids_for_user_id(db, user_id)
    acct_result = await db.execute(select(PlatformAccount).where(PlatformAccount.id.in_(store_ids)))
    accessible_accounts = list(acct_result.scalars().all())
    accounts_by_id = {a.id: a for a in accessible_accounts}
    accounts = {a.platform: a for a in accessible_accounts}
    local_plan, plan_gaps = build_local_publish_plan(publish_plan)

    results = []
    now = datetime.now(timezone.utc)
    for draft in drafts:
        if not draft.get("confirmed"):
            continue
        if plan_gaps:
            results.append(skipped_publish_result(
                draft,
                error="发布计划配置不完整",
                publish_plan=local_plan,
                data_gaps=plan_gaps,
            ))
            continue
        if not draft.get("publishable", True):
            results.append(skipped_publish_result(draft, error="草稿信息不完整，未创建", publish_plan=local_plan))
            continue
        requested_account_id = draft.get("platform_account_id")
        acct = accounts_by_id.get(requested_account_id) if requested_account_id else accounts.get(draft["platform"])
        if not acct or not acct.is_active:
            results.append(skipped_publish_result(draft, error=f"未配置{draft['platform']}平台账号", publish_plan=local_plan))
            continue
        source_type = draft.get("source_type") or "sourcing"
        item = None
        product = None
        if source_type == "product":
            product_result = await db.execute(
                select(Product).where(Product.id == draft.get("source_product_id"), Product.user_id == user_id)
            )
            product = product_result.scalar_one_or_none()
            if not product:
                results.append(skipped_publish_result(draft, error="商品不存在或无权访问", publish_plan=local_plan))
                continue
            if product_name_quality_flags(product.name):
                results.append(skipped_publish_result(draft, error="商品名称疑似测试残留，请先更名或归档后再刊登", publish_plan=local_plan))
                continue
            source_price = product.cost_price if product.cost_price and product.cost_price > 0 else None
        else:
            item_result = await db.execute(
                select(SourcingItem).where(
                    SourcingItem.id == draft.get("sourcing_item_id"),
                    SourcingItem.user_id == user_id,
                )
            )
            item = item_result.scalar_one_or_none()
            if not item:
                results.append(skipped_publish_result(draft, error="选品不存在或无权访问", publish_plan=local_plan))
                continue
            if product_name_quality_flags(item.product_name):
                results.append(skipped_publish_result(draft, error="商品名称疑似测试残留，请先更名或归档后再刊登", publish_plan=local_plan))
                continue
            readiness_gaps = _listing_readiness_gaps(item)
            if item.platform and draft.get("platform") != item.platform:
                readiness_gaps.append("sourcing_items.platform")
            if readiness_gaps:
                results.append(skipped_publish_result(
                    draft,
                    error="商品尚未达到发布就绪状态",
                    publish_plan=local_plan,
                    data_gaps=readiness_gaps,
                ))
                continue
            source_price = item.source_price_rmb if item.source_price_rmb and item.source_price_rmb > 0 else None
        selling_price = draft.get("selling_price")
        title = (draft.get("template_title") or draft.get("product_name") or "").strip()
        if source_price is None or selling_price is None or selling_price <= 0 or not title:
            results.append(skipped_publish_result(draft, error="真实采购价、售价或标题不完整", publish_plan=local_plan))
            continue

        if product is None and item is not None:
            product = Product(
                user_id=user_id,
                sku=generate_sku(),
                name=(item.product_name or "")[:500],
                cost_price=source_price,
                category_id=None,
                attributes={"source_sourcing_item_id": item.id, "source_category": item.category},
                images=[item.source_image] if item.source_image else [],
            )
            db.add(product)
            await db.flush()

        sku_plan = normalize_sku_plan(draft.get("sku_plan"), product.sku, selling_price)
        media_assets = normalize_media_assets(draft.get("media_assets"), draft.get("images"))
        logistics = normalize_logistics(draft.get("logistics"))
        compliance = normalize_compliance(draft.get("compliance"))
        listing_images = media_assets.get("images") or (draft.get("images") if isinstance(draft.get("images"), list) else [])
        store_override_summary = draft.get("listing_store_override") or {}
        listing_master_status = draft.get("listing_master_status") or {}
        override_boundary = store_override_summary.get("override_boundary") or "store_listing_only"
        field_sources = {
            "title": "listing_store_override" if store_override_summary.get("title") else "draft",
            "description": "listing_store_override" if store_override_summary.get("title") else "draft",
            "sku_plan": "listing_store_override" if store_override_summary.get("sku_count") else "draft",
            "media_assets": "listing_store_override" if store_override_summary.get("image_count") else "draft",
            "logistics": "listing_store_override" if store_override_summary.get("has_logistics") else "draft",
            "compliance": "listing_store_override" if store_override_summary.get("has_compliance") else "draft",
            "platform_requirements": "listing_store_override" if store_override_summary.get("has_platform_attributes") else "draft",
        }
        validation_checks = build_validation_checks(
            title=title,
            selling_price=selling_price,
            sku_plan=sku_plan,
            media_assets=media_assets,
            logistics=logistics,
            compliance=compliance,
            platform_requirements=draft.get("platform_requirements") or {},
            fee_missing=draft.get("fee_missing", False),
            blocking_reasons=draft.get("blocking_reasons") or [],
            platform=draft.get("platform"),
        )
        blocking_validation = [
            check for check in validation_checks
            if check.get("state") == "block"
        ]
        if blocking_validation:
            validation_gaps = [
                "platform_fields.required" if check.get("code") == "platform_fields" else f"listing_validation.{check.get('code')}"
                for check in blocking_validation
            ]
            results.append(skipped_publish_result(
                draft,
                error="Listing 发布前校验未通过：" + " / ".join(check["message"] for check in blocking_validation),
                publish_plan=local_plan,
                data_gaps=validation_gaps,
                validation_checks=validation_checks,
            ))
            continue

        publish_receipt = build_local_publish_receipt(
            status="local_draft_created",
            message=local_plan["note"],
            publish_plan=local_plan,
            retryable=True,
            next_action="平台Open API接通并授权后，可从发布计划队列重试提交到目标店铺",
            receipt_source="local_publish_plan",
            platform_account_id=acct.id,
            store_name=acct.account_name,
        )

        listing = PlatformListing(
            user_id=user_id,
            product_id=product.id,
            platform_account_id=acct.id,
            title=title[:500],
            description=draft.get("template_description") or "",
            price=selling_price,
            stock=0,
            variations=sku_plan.get("variants") or [],
            status="draft",
            images=listing_images,
            shipping_config=logistics,
            platform_data={
                "stock_status": "missing",
                "source_sourcing_item_id": item.id if item is not None else None,
                "source_product_id": product.id if source_type == "product" else None,
                "listing_snapshot": {
                    "product_master_id": product.id,
                    "platform_account_id": acct.id,
                    "title": title[:500],
                    "description": draft.get("template_description") or "",
                    "price": selling_price,
                    "images": listing_images,
                    "sku_plan": sku_plan,
                    "media_assets": media_assets,
                    "logistics": logistics,
                    "compliance": compliance,
                    "validation_checks": validation_checks,
                    "listing_store_override": store_override_summary,
                    "listing_master_status": listing_master_status,
                    "field_sources": field_sources,
                    "override_boundary": override_boundary,
                },
                "listing_overrides": {
                    "title": title[:500],
                    "description": draft.get("template_description") or "",
                    "price": selling_price,
                    "sku_plan": sku_plan,
                    "media_assets": media_assets,
                    "logistics": logistics,
                    "compliance": compliance,
                    "validation_checks": validation_checks,
                    "platform_requirements": draft.get("platform_requirements") or {},
                    "listing_store_override": store_override_summary,
                    "listing_master_status": listing_master_status,
                    "field_sources": field_sources,
                    "override_boundary": override_boundary,
                },
                "listing_store_override": store_override_summary,
                "listing_master_status": listing_master_status,
                "field_sources": field_sources,
                "override_boundary": override_boundary,
                "platform_requirements": draft.get("platform_requirements") or {},
                "sku_plan": sku_plan,
                "media_assets": media_assets,
                "logistics": logistics,
                "compliance": compliance,
                "validation_checks": validation_checks,
                "listing_content_source": {"title": title[:500], "description": draft.get("template_description") or ""},
                "publish_plan": local_plan,
                "platform_api_status": "not_connected",
                "platform_publish_status": "not_attempted",
                "publish_receipt": publish_receipt,
            },
        )
        db.add(listing)
        await db.flush()
        publish_receipt["listing_id"] = listing.id
        official_writeback = await submit_listing_to_platform_if_ready(acct, listing, draft, local_plan)
        publish_receipt["official_publish_writeback"] = official_writeback
        publish_receipt["platform_api_status"] = official_writeback["platform_api_status"]
        publish_receipt["platform_publish_status"] = official_writeback["platform_publish_status"]
        listing.platform_data = {**(listing.platform_data or {}), "publish_receipt": publish_receipt, "official_publish_writeback": official_writeback}
        listing.platform_data["platform_api_status"] = official_writeback["platform_api_status"]
        listing.platform_data["platform_publish_status"] = official_writeback["platform_publish_status"]
        object_model = await persist_listing_object_model(
            db, user_id=user_id, product=product, listing=listing, platform=draft["platform"],
            market=draft.get("market"), sku_plan=sku_plan, platform_requirements=draft.get("platform_requirements") or {},
        )

        results.append({**draft, "validation_checks": validation_checks,
                        "product_id": product.id, "listing_id": listing.id,
                        "drafted_at": now.isoformat(), "publish_status": "draft",
                        "platform_account_id": acct.id, "store": _store_payload(acct),
                        "publish_plan": local_plan, "plan_status": local_plan["status"],
                        "platform_api_status": official_writeback["platform_api_status"],
                        "platform_publish_status": official_writeback["platform_publish_status"],
                        "publish_receipt": publish_receipt,
                        "retryable": True,
                        "retry_action": "retry_after_platform_api_connected",
                        "object_model": object_model})

    await db.commit()
    return results


def _source_from_sourcing(item, field_schemas: dict | None = None) -> dict:
    listing_store_override_payload = listing_store_override(item)
    override_logistics_payload = override_logistics(listing_store_override_payload)
    image_plan = confirmed_image_slot_plan(item)
    image_urls = image_plan["images"] or ([item.source_image] if item.source_image else [])
    platform_requirements = merge_platform_requirements_map((item.extra_data or {}).get("platform_requirements") or {}, field_schemas)
    if item.platform and item.platform in platform_requirements:
        platform_requirements[item.platform] = merge_override_platform_attributes(
            platform_requirements[item.platform],
            listing_store_override_payload,
        )
    return {
        "source_type": "sourcing",
        "source_id": item.id,
        "source_ref_type": "sourcing_item",
        "source_product_id": None,
        "sourcing_item_id": item.id,
        "product_name": item.product_name,
        "product_name_cn": item.product_name_cn,
        "category": item.category,
        "source_price_rmb": item.source_price_rmb,
        "selling_price_local": item.selling_price_local,
        "target_platform": item.platform,
        "target_market": item.market,
        "readiness_gaps": _listing_readiness_gaps(item),
        "platform_requirements": platform_requirements,
        "listing_master_status": _listing_master_status(item),
        "listing_store_override": listing_store_override_payload,
        "images": image_urls,
        "image_slots": image_plan["image_slots"],
        "media_readiness": media_readiness_from_extra(item.extra_data or {}, image_urls, image_plan=image_plan),
        "master_sku": override_master_sku(listing_store_override_payload),
        "brand": None,
        "weight_g": override_logistics_payload.get("weight_g"),
        "dimensions": override_logistics_payload.get("dimensions"),
        "variants": override_variants(listing_store_override_payload),
        "videos": videos_from_attributes(item.extra_data or {}),
        "compliance": override_compliance(listing_store_override_payload) or (item.extra_data or {}).get("compliance") or {},
    }

def _source_from_product(product, field_schemas: dict | None = None, draft_listings: dict | None = None) -> dict:
    images = product.images if isinstance(product.images, list) else []
    listing_map = {
        platform: {
            "selling_price": listing.price,
            "title": listing.title,
            "description": listing.description,
            "images": listing.images if isinstance(listing.images, list) else [],
            "platform_requirements": (listing.platform_data or {}).get("platform_requirements") or {},
            "sku_plan": (listing.platform_data or {}).get("sku_plan") or (listing.platform_data or {}).get("listing_overrides", {}).get("sku_plan"),
            "media_assets": (listing.platform_data or {}).get("media_assets"),
            "logistics": (listing.platform_data or {}).get("logistics") or listing.shipping_config,
            "compliance": (listing.platform_data or {}).get("compliance"),
        }
        for platform, listing in (draft_listings or {}).items()
    }
    return {
        "source_type": "product",
        "source_id": product.id,
        "source_ref_type": "product",
        "source_product_id": product.id,
        "sourcing_item_id": None,
        "product_name": product.name,
        "product_name_cn": None,
        "category": product.category_id,
        "source_price_rmb": product.cost_price,
        "selling_price_local": None,
        "target_platform": None,
        "target_market": None,
        "readiness_gaps": [],
        "platform_requirements": merge_platform_requirements_map((product.attributes or {}).get("platform_requirements") or {}, field_schemas),
        "listing_master_status": {
            "ready": True,
            "label": "本地 Listing 草稿",
            "detail": "来自商品主档或本地店铺 Listing 草稿，发布前仍需预览校验。",
            "source": "product",
            "confirmed_required": 0,
            "confirmed_count": 0,
            "missing": [],
        },
        "draft_listings": listing_map,
        "images": images,
        "media_readiness": media_readiness_from_extra(product.attributes or {}, images),
        "master_sku": product.sku,
        "brand": product.brand,
        "weight_g": product.weight_g,
        "dimensions": product.dimensions,
        "variants": (product.attributes or {}).get("variants") or [],
        "videos": videos_from_attributes(product.attributes or {}),
        "compliance": (product.attributes or {}).get("compliance") or {},
    }


def _store_payload(account) -> dict:
    settings = account.settings if isinstance(account.settings, dict) else {}
    return {
        "id": account.id,
        "platform": account.platform,
        "account_name": account.account_name,
        "shop_id": account.shop_id,
        "market": settings.get("market"),
    }


def _listing_readiness_gaps(item) -> list[str]:
    from app.services.content_workbench_service import REQUIRED_CONTENT_GAPS

    gaps = []
    tasks = (item.extra_data or {}).get("content_tasks") or {}
    if any(not tasks.get(task_type, {}).get("confirmed_version") for task_type, _label in REQUIRED_CONTENT_GAPS):
        gaps.append("content_tasks.confirmed")
    if not item.source_price_rmb or item.source_price_rmb <= 0:
        gaps.append("sourcing_items.source_price_rmb")
    if not item.selling_price_local or item.selling_price_local <= 0:
        gaps.append("sourcing_items.selling_price_local")
    if not item.platform:
        gaps.append("sourcing_items.platform")
    if not item.market:
        gaps.append("sourcing_items.market")
    if item.pipeline_stage != "price_confirmed" or not ((item.extra_data or {}).get("pricing_confirmation") or {}):
        gaps.append("sourcing_items.pricing_confirmation")
    return gaps


def _listing_master_status(item) -> dict:
    from app.services.content_workbench_service import REQUIRED_CONTENT_GAPS

    tasks = (item.extra_data or {}).get("content_tasks") or {}
    missing = [
        label
        for task_type, label in REQUIRED_CONTENT_GAPS
        if not tasks.get(task_type, {}).get("confirmed_version")
    ]
    confirmed_count = len(REQUIRED_CONTENT_GAPS) - len(missing)
    ready = not missing
    return {
        "ready": ready,
        "label": "统一母版已确认" if ready else "统一母版待确认",
        "detail": (
            "内容工厂已确认标题、卖点、描述、图片理解、图片处理计划和合规检查。"
            if ready
            else " / ".join(missing[:3]) + (" 等" if len(missing) > 3 else "")
        ),
        "source": "content_workbench",
        "confirmed_required": len(REQUIRED_CONTENT_GAPS),
        "confirmed_count": confirmed_count,
        "missing": missing,
    }
