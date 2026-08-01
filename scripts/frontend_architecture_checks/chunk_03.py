"""Validation rule chunk for frontend information architecture."""

from .context import *  # noqa: F401,F403

_CHUNK = r'''
for required in ("基础商品资料列表", "状态诊断", "平台字段诊断", "PlatformFieldGroupSummary", "创建 Listing"):
    if required not in PRODUCT_SELLER_WORKBENCH:
        errors.append(f"product seller workbench must keep seller-console operation element: {required}")
for required in ("商品机会处理", "诊断动作队列", "aria-label=\"商品机会处理\"", "opportunityActions"):
    if required not in PRODUCT_SELLER_WORKBENCH:
        errors.append(f"product seller workbench must expose opportunity handling diagnostics: {required}")
if "/content?product_id=${product.id}" not in PRODUCT_SELLER_WORKBENCH:
    errors.append("product seller workbench must carry product_id when drilling into content production")
if "ProductSellerWorkbench" not in PRODUCT_LIST_PAGE:
    errors.append("product list page must use the seller-console workbench instead of a generic product table")
for required in ("平台店铺商品", "PlatformStoreProductsPanel", "平台商品同步", "店铺归属", "平台店铺商品库", "基础商品资料", "searchParams.get('tab') === 'master'"):
    if required not in PRODUCT_LIST_PAGE + PLATFORM_STORE_PRODUCTS_PANEL:
        errors.append(f"product module must expose platform store product inventory: {required}")
for required in ("productListQuery", "productListQuery.isError", "data-ui=\"product-list-error\"", "重新加载商品列表"):
    if required not in PRODUCT_LIST_PAGE:
        errors.append(f"AUDIT-P2-03 product list page must expose visible React Query error recovery: {required}")
for required in ("productsQuery.isError", "data-ui=\"platform-store-products-error\"", "重新加载平台店铺商品"):
    if required not in PLATFORM_STORE_PRODUCTS_PANEL:
        errors.append(f"AUDIT-P2-03 platform store products panel must expose visible React Query error recovery: {required}")
for required in ("aria-label=\"平台店铺商品库总览\"", "SummaryCard", "覆盖店铺", "图片不足", "SKU/规格"):
    if required not in PLATFORM_STORE_PRODUCTS_PANEL:
        errors.append(f"platform store products must expose store/listing summary cards: {required}")
for required in (
    "PlatformStoreGroupingBoard",
    "aria-label=\"平台店铺商品分组态势\"",
    "data-ui=\"platform-store-grouping-board\"",
    "按平台/店铺查看商品同步、图片缺口和 SKU 覆盖",
    "店铺商品数",
    "图片缺口",
    "SKU 覆盖",
    "同步状态",
    "buildPlatformStoreGroups",
):
    if required not in PLATFORM_STORE_PRODUCTS_PANEL:
        errors.append(f"platform store products must expose grouped platform/store operating board: {required}")
for required in (
    "PlatformStoreProductActionStrip",
    "aria-label=\"平台店铺商品处理动作\"",
    "data-ui=\"platform-store-product-action-strip\"",
    "buildStoreProductActions",
    "补主图素材",
    "补 SKU/规格",
    "编辑店铺 Listing",
    "维护平台商品资料",
    "platform-store-row-platform-product-maintenance-action",
    "listingSectionRoute('attributes')",
    "同步状态待处理",
    "查看当前 Listing",
    "action.severity",
    "storeProductActionDataUi",
):
    if required not in PLATFORM_STORE_PRODUCTS_PANEL:
        errors.append(f"platform store product rows must expose row-level next actions and diagnostics: {required}")
for required in (
    "PublishPlanQueueBoard",
    "aria-label=\"发布计划队列\"",
    "data-ui=\"platform-store-publish-plan-queue\"",
    "data-ui=\"platform-store-publish-plan-card\"",
    "PublishPlanInlineStatus",
    "data-ui=\"platform-store-publish-plan-inline-status\"",
    "publish_plan_summary",
    "返回批量刊登重试",
    "平台 Open API 未接通",
):
    if required not in PLATFORM_STORE_PRODUCTS_PANEL + PRODUCTS_API:
        errors.append(f"platform store products must expose batch publish result writeback queue: {required}")
for required in (
    "market?: string",
    "market: market || undefined",
    "data-ui=\"platform-store-market-filter\"",
    "dataUi=\"platform-store-market-summary\"",
    "buildMarketOptions",
    "platformStoreMarket",
    "覆盖市场",
    "data-ui=\"platform-store-inventory-alert-entry\"",
    "platform-store-row-inventory-alert-action",
    "处理库存预警",
):
    if required not in PLATFORM_STORE_PRODUCTS_PANEL + PRODUCTS_API:
        errors.append(f"platform store products must expose market filtering and inventory alert entry: {required}")
for required in (
    "inventory_alert_summary",
    "dataUi=\"platform-store-inventory-risk-summary\"",
    "data-ui=\"platform-store-inventory-alert-summary\"",
    "isInventoryRiskItem",
    "InventoryAlertInlineSummary",
    "规则 {summary.matched_rule_count}",
    "安全库存",
    "处理库存预警",
):
    if required not in PLATFORM_STORE_PRODUCTS_PANEL + PRODUCTS_API:
        errors.append(f"platform store products must expose real inventory alert summary from backend: {required}")
for required in (
    "PlatformStoreProductFilterSummary",
    "productsQuery.data?.meta?.summary",
    "numberFromSummary",
    "dataUi=\"platform-store-filter-summary-total\"",
    "dataUi=\"platform-store-filter-summary-scope\"",
    "当前筛选全量店铺商品实例",
    "按当前筛选全量店铺市场汇总",
):
    if required not in PLATFORM_STORE_PRODUCTS_PANEL + PRODUCTS_API:
        errors.append(f"platform store products summary cards must use API full-filter summary, not current-page counts: {required}")
for required in (
    "shop_id?: string | null",
    "product_sync_status?: string | null",
    "product_sync_at?: string | null",
    "sync_receipt_summary",
    "field_writeback_summary",
    "platform-product-field-writeback-summary",
    "字段回写",
    "official_publish_writeback",
    "OfficialPublishWritebackLine",
    "platform-store-official-publish-writeback",
    "官方发布回写",
    "SyncReceiptInlineSummary",
    "ProductSyncRetryLogBoard",
    "platform-product-sync-retry-log-board",
    "platform-product-sync-retry-log-card",
    "getSyncLogs(platformAccountId || undefined, 1, 'products')",
    "重试动作",
    "data-ui=\"platform-store-product-sync-receipt-summary\"",
    "data-ui=\"platform-store-identity-sync-state\"",
    "店铺ID",
    "商品同步",
    "同步回执",
    "官方ID",
    "失败原因",
    "productSyncStatusLabel",
):
    if required not in PLATFORM_STORE_PRODUCTS_PANEL + PRODUCTS_API:
        errors.append(f"platform store product rows must expose store shop identity and product sync state: {required}")
store_context_content = PRODUCT_LIST_PAGE + ORDER_LIST_PAGE + SHIPMENT_LIST_PAGE + FINANCE_PAGE + STORE_CONTEXT_BANNER
for required in ("StoreContextBanner", "aria-label=\"平台店铺上下文横幅\"", "data-ui=\"store-context-banner\"", "当前按店铺筛选", "store drilldown context", "店铺商品", "店铺订单", "店铺物流", "店铺财务", "清除店铺筛选", "platformAccountId={initialPlatformAccountId}", "platformAccountId={platformAccountId}", "currentModule=\"products\"", "currentModule=\"orders\"", "currentModule=\"shipments\"", "currentModule=\"finance\""):
    if required not in store_context_content:
        errors.append(f"store drilldown context must persist across product/order/finance pages: {required}")
for required in ("mediaReadinessLabel", "平台图片要求", "媒体缺口", "主档图片"):
    if required not in PLATFORM_STORE_PRODUCTS_PANEL + PRODUCTS_API:
        errors.append(f"platform store products must expose listing media readiness and master image context: {required}")
for required in (
    "aria-label=\"基础商品与店铺 Listing 实例关系\"",
    "对象关系",
    "基础商品 → 店铺 Listing 实例",
    "平台返回ID",
    "主档图片",
    "Listing图片",
    "店铺覆盖字段",
    "标题覆盖",
    "价格/库存覆盖",
    "SKU/规格覆盖",
    "店铺覆盖字段不回写基础商品版本",
    "store_override_summary",
):
    if required not in PLATFORM_STORE_PRODUCTS_PANEL + PRODUCTS_API + SYNC_SERVICE_BACKEND:
        errors.append(f"platform store product rows must expose product-master to listing-instance relation and store overrides: {required}")
for required in ("编辑店铺 Listing", "?tab=listings", "listing_id=", "listing_section=", "product_master.id"):
    if required not in PLATFORM_STORE_PRODUCTS_PANEL:
        errors.append(f"platform store products must provide direct listing edit context: {required}")
for required in ("getPlatformStoreProducts", "triggerProductSync", "platform_products_open_api", "不生成模拟商品"):
    if required not in PLATFORM_STORE_PRODUCTS_PANEL + PRODUCTS_API + SYNC_API:
        errors.append(f"platform store products must use real sync boundaries and API wrappers: {required}")
for required in ("useConfig", "toDomainOptions(platform_listing_statuses)", "platformOptionsFromConfig"):
    if required not in PLATFORM_STORE_PRODUCTS_PANEL:
        errors.append(f"platform store products filters must read runtime platform/listing dictionaries: {required}")
for forbidden in ("{ value: 'shopee', label: 'Shopee' }", "{ value: 'active', label: '在售' }"):
    if forbidden in PLATFORM_STORE_PRODUCTS_PANEL:
        errors.append(f"platform store products must not hardcode platform or listing status filter options: {forbidden}")
for required in ("SyncBlockDetail", "下一步：", "operation_details", "待接入"):
    if required not in PLATFORM_STORE_PRODUCTS_PANEL + SYNC_API:
        errors.append(f"platform product sync gap must expose connector detail and next action: {required}")
for required in ("sync_state", "last_product_sync_status", "last_order_sync_status", "最近商品同步", "最近订单同步"):
    if required not in PLATFORMS_API + PLATFORM_SETTINGS_PAGE:
        errors.append(f"platform settings must expose account-level sync status writeback: {required}")
for required in ("authorization_status", "authorization", "店铺授权状态", "店铺授权：", "令牌有效期", "权限范围"):
    if required not in PLATFORMS_API + PLATFORM_SETTINGS_PAGE:
        errors.append(f"platform settings must expose OAuth authorization state separately from API key storage: {required}")
for required in ("updatePlatformAuthorization", "/authorization", "登记店铺 OAuth 授权", "Access Token", "Refresh Token", "保存授权令牌"):
    if required not in PLATFORMS_API + PLATFORM_SETTINGS_PAGE:
        errors.append(f"platform settings must provide a controlled store OAuth token entry path: {required}")
for required in ("待店铺授权", "授权过期", "授权权限不足", "凭证待验证"):
    if required not in PLATFORM_SETTINGS_PAGE:
        errors.append(f"platform settings status badge must not collapse OAuth states into generic API pending labels: {required}")
for required in ("record_blocked_sync", "connector_not_ready", "product_sync_blocked", "order_sync_blocked"):
    if required not in SYNC_SERVICE_BACKEND + SYNC_BACKEND_API:
        errors.append(f"platform sync blocked attempts must write failed logs and sync_state: {required}")
platform_product_adapter_content = f"{PRODUCT_NORMALIZERS}\n{SHOPEE_CLIENT}\n{TIKTOK_CLIENT}\n{TEMU_CLIENT}"
for required in ("normalize_platform_product", "_normalize_shopee_product", "_normalize_tiktok_product", "_normalize_temu_product", "normalize_product_payload"):
    if required not in platform_product_adapter_content:
        errors.append(f"platform product adapters must normalize raw platform payloads before sync: {required}")
if "platformRequirementsByPlatform" not in BATCH_PUBLISH_SELECT:
    errors.append("batch publish select step must show product master platform attributes by selected platform")
for required in ("pricingSourceLabel", "预览读取本地 Listing 草稿"):
    if required not in BATCH_PUBLISH_SELECT + BATCH_PUBLISH_WORKSPACE:
        errors.append(f"batch publish deep-linked products must explain draft pricing source before preview: {required}")
if "platform_attrs" not in PRODUCT_EDIT_PAGE or "ProductPlatformAttributesPanel" not in PRODUCT_EDIT_PAGE:
    errors.append("product edit page must expose platform-specific product attributes")
for required in ("ProductEditObjectOverview", "aria-label=\"商品编辑对象总览\"", "data-ui=\"product-edit-object-overview\"", "基础商品版本", "店铺 Listing 实例", "发布准备度", "仅用当前商品真实字段判断", "不回写污染其他店铺"):
    if required not in PRODUCT_EDIT_PAGE:
        errors.append(f"product detail page must show current product object overview before edit sections: {required}")
for required in ("getProductObjectModel", "/object-model", "ProductObjectModelSnapshot"):
    if required not in PRODUCTS_API + PRODUCT_EDIT_PAGE:
        errors.append(f"product detail page must consume V5 product object model snapshot: {required}")
for required in ("useProductObjectModel", "data-ui=\"product-v5-object-model-summary\"", "data-ui=\"product-v5-object-model-gaps\"", "基础版本", "V5 SKU", "字段缺口"):
    if required not in PRODUCT_EDIT_PAGE:
        errors.append(f"product detail page must expose V5 object model state: {required}")
for required in ("useSearchParams", "initialTab", "initialListingSection", "ProductEditSectionNav", "aria-label=\"商品编辑字段快速定位\"", "ProductEditSection", "scrollIntoView", "product-section-${initialTab}"):
    if required not in PRODUCT_EDIT_PAGE:
        errors.append(f"product detail page must use route-driven quick定位 and continuous sections: {required}")
for forbidden in ("<Tabs tabs={FORM_TABS}", "setActiveTab(initialTab)", "activeTab === 'basic'", "activeTab === 'listings'"):
    if forbidden in PRODUCT_EDIT_PAGE:
        errors.append(f"product detail page must not split one product into mutually exclusive tabs: {forbidden}")
if "图片”页签" in PRODUCT_DETAIL_TABS:
    errors.append("product listing panel must refer to product image section, not image tab")
for required in ("发布计划", "平台未尝试发布", "listingPublishPlanText"):
    if required not in PRODUCT_DETAIL_TABS:
        errors.append(f"product listing panel must expose local publish plan and platform publish boundary: {required}")
for required in ("店铺级 Listing 编辑", "当前编辑店铺 Listing", "updateListingOverrides", "保存店铺覆盖", "SKU/变体"):
    if required not in PRODUCT_LISTING_EDITOR_CONTENT:
        errors.append(f"product listing panel must support store-level listing instance editing: {required}")
for required in ("promoteListingToBaseVersion", "promote-base-version", "生成新基础版本", "显式反哺动作"):
    if required not in PRODUCT_DETAIL_TABS + LISTING_API:
        errors.append(f"product listing panel must make base-version promotion explicit: {required}")
for required in ("SKU 变体结构化编辑", "variantRows", "添加变体", "删除变体"):
    if required not in PRODUCT_LISTING_EDITOR_CONTENT:
        errors.append(f"product listing editor must use structured fields instead of raw JSON: {required}")
for required in ("LISTING_EDIT_SECTIONS", "listingEditSection", "基础信息", "商品详情", "销售资料/SKU", "媒体素材", "物流与发布", "平台属性"):
    if required not in PRODUCT_LISTING_EDITOR_CONTENT:
        errors.append(f"product listing editor must use seller-center style section tabs: {required}")
for required in (
    "ListingInlineSectionNavigator",
    "aria-label=\"Listing 字段快速定位\"",
    "data-ui=\"listing-inline-section-navigator\"",
    "aria-label=\"当前 Listing 连续编辑分区\"",
    "data-ui=\"listing-continuous-edit-sections\"",
    "scrollIntoView",
    "initialSection",
    "listing_section",
    "requestedSection",
    "listing-section-basic",
    "listing-section-detail",
    "listing-section-sales",
    "listing-section-media",
    "listing-section-logistics",
    "listing-section-attributes",
    "不是 Tab 分页，点击后定位到同一商品的对应字段分区",
):
    if required not in PRODUCT_LISTING_EDITOR_CONTENT:
        errors.append(f"product listing editor must render continuous same-product sections with quick anchors: {required}")
for forbidden in ("listingEditSection === 'basic'", "listingEditSection === 'detail'", "listingEditSection === 'sales'", "listingEditSection === 'media'", "listingEditSection === 'logistics'", "listingEditSection === 'attributes'"):
    if forbidden in PRODUCT_LISTING_EDITOR_CONTENT:
        errors.append(f"product listing editor must not split one listing into conditional tab pages: {forbidden}")
for required in ("TikTok：最多 9 张图", "Shopee/妙手：图片、视频、物流、货源链接同一商品上下文维护", "当前店铺覆盖"):
    if required not in PRODUCT_LISTING_EDITOR_CONTENT:
        errors.append(f"product listing editor must explain platform listing edit constraints: {required}")
for required in ("店铺视频 URL", "货源链接", "包裹重量", "包裹长宽高", "shipping_config", "video_url", "source_url"):
    if required not in PRODUCT_LISTING_EDITOR_CONTENT + LISTING_API:
        errors.append(f"product listing editor must persist media/source/logistics store overrides: {required}")
for required in ("publish_plan", "定时发布时间", "本地发布计划"):
    if required not in PRODUCT_LISTING_EDITOR_CONTENT + LISTING_API:
        errors.append(f"product listing editor must persist local publish plan store overrides: {required}")
for forbidden in ("promotion_config", "促销活动名称", "店铺促销配置", "buildPromotionConfig", "listingPromotionValue"):
    if forbidden in PRODUCT_LISTING_EDITOR_CONTENT + LISTING_API:
        errors.append(f"promotion discount must not be edited as listing override: {forbidden}")
promotion_module_content = "\n".join(
    [
        PROMOTIONS_PAGE,
        PROMOTIONS_API,
        PROMOTIONS_BACKEND_API,
        PROMOTION_SERVICE,
        PROMOTION_MODEL,
        MODULE_SUBNAV,
        NAVIGATION,
    ]
)
for required in ("PromotionCampaign", "PromotionCampaignItem", "promotion_campaigns", "promotion_campaign_items", "/promotions"):
    if required not in promotion_module_content:
        errors.append(f"promotion discounts must be independent campaign objects: {required}")
for required in ("促销活动", "活动名称/ID", "所属店铺", "活动产品", "添加产品", "修改折扣", "一个活动归属于一个平台店铺，可以包含多个参与商品"):
    if required not in promotion_module_content:
        errors.append(f"promotion module must expose seller-center campaign list semantics: {required}")
for required in ("活动效果", "PromotionEffectSummary", "price_summary", "discount_amount_total", "original_price_total", "promotion_price_total", "promotion_campaign_items", "平台 Open API 未接通前不代表真实成交效果"):
    if required not in promotion_module_content:
        errors.append(f"promotion module must expose local promotion price impact without fake platform performance: {required}")
for required in ("PromotionCreateFormState", "showCreate", "handleCreateCampaign", "选择参与商品", "selectedListingIds", "createPromotionCampaign", "getPlatformStoreProducts"):
    if required not in promotion_module_content:
        errors.append(f"promotion module must support local campaign creation with multiple listings: {required}")
for required in ("handleEndCampaign", "updatePromotionCampaignStatus", "结束活动", "promotion_platform_sync"):
    if required not in promotion_module_content:
        errors.append(f"promotion module must support local campaign state actions without fake platform sync: {required}")
for required in ("startCampaignAction", "handleAddItemsToCampaign", "handleUpdateCampaignDiscount", "addPromotionCampaignItems", "updatePromotionCampaignDiscount", "追加参与商品"):
    if required not in promotion_module_content:
        errors.append(f"promotion module must support adding items and changing campaign discounts: {required}")
for required in ("handleUpdateCampaign", "updatePromotionCampaign", "叠加规则", "保存活动"):
    if required not in promotion_module_content:
        errors.append(f"promotion module must support editing campaign basic info without touching listings: {required}")
for required in ("handleSyncCampaign", "syncPromotionCampaign", "promotion_open_api.not_implemented"):
    if required not in promotion_module_content:
        errors.append(f"promotion module must expose platform sync gap without fake success: {required}")
for required in ("useConfirm", "confirmAction", "结束促销活动", "同步促销活动", "确认结束", "确认同步"):
    if required not in PROMOTIONS_PAGE:
        errors.append(f"promotion high-risk actions must use system confirm dialog: {required}")
for required in ("按三平台字段组编辑", "PlatformFieldGroupEditor", "selectedListingRequirements", "field_groups", "平台字段组编辑"):
    if required not in PRODUCT_LISTING_EDITOR_CONTENT:
        errors.append(f"product listing editor must render platform field group form: {required}")
for required in ("ListingCopyAiAssistPanel", "listing-copy-field-ai-assist-panel", "listing-field-ai-candidate-card", "采用候选到当前字段"):
    if required not in SELLER_PLATFORM_LISTING_EDITOR + LISTING_COPY_AI_ASSIST_PANEL:
        errors.append(f"content factory AI assistance must be embedded beside concrete listing fields: {required}")
for forbidden in ("AI 辅助动作", "listing-inline-ai-title", "listing-inline-ai-description", "applyTitleCandidate", "applyDescriptionCandidate"):
    if forbidden in SELLER_PLATFORM_LISTING_EDITOR:
        errors.append(f"content factory must not keep old standalone or hidden inline AI behavior in the Listing editor: {forbidden}")
for required in ("override_image_urls", "override_sku_rows", "image_slots", "sku_rows", "package_size", "platform_attributes", "boundary"):
    if required not in LISTING_STORE_OVERRIDE_SERVICE + SELLER_PLATFORM_LISTING_EDITOR:
        errors.append(f"listing store override must bridge V5 editor payload into publish/readiness services: {required}")
for required in ("platform_sku", "spu_skc", "sku_image_role", "weight_g", "option_2_value", "test_listing_store_override_supports_v5_editor_payload"):
    if required not in LISTING_STORE_OVERRIDE_SERVICE + (ROOT / "backend/app/services/listing_draft_asset_service.py").read_text(encoding="utf-8") + (ROOT / "backend/tests/test_listing_store_override_compat.py").read_text(encoding="utf-8"):
        errors.append(f"listing SKU plan must preserve seller-console SKU fields into publish payload: {required}")
for required in (
    "default_unified_field_dictionary.json",
    "get_unified_field_dictionary",
    "unified_field_dictionary",
    "FIELD_KEY_ALIASES",
    "unified_field_key",
    "platform_field_name",
    "miaoshou_field_name",
    "FieldMetaHint",
    "product_title",
    "clear_image_status",
):
    if required not in CONFIG_SERVICE + CONFIG_API + USE_CONFIG_HOOK + PLATFORM_FIELD_GROUPS + UNIFIED_FIELD_DICTIONARY:
        errors.append(f"FIELD-V5-P0-01 must keep unified CSV field dictionary and dynamic field metadata: {required}")
for required in (
    "ProductListingEditOverview",
    "aria-label=\"当前商品编辑总览\"",
    "当前商品编辑总览",
    "基础商品主档",
    "平台店铺 Listing 上下文",
    "图片素材槽位",
    "SKU/规格矩阵",
    "平台属性进度",
    "价格库存状态",
    "data-ui=\"product-listing-edit-overview\"",
    "CurrentListingInstanceCommandPanel",
    "aria-label=\"当前店铺 Listing 实例操作台\"",
    "当前店铺 Listing 实例",
    "平台返回ID",
    "店铺覆盖隔离",
    "图片槽位",
    "价格库存",
    "SKU/规格",
    "平台字段",
    "物流发布",
    "保存只更新当前 Listing",
    "listingInstanceReadiness",
):
    if required not in PRODUCT_LISTING_EDITOR_CONTENT:
        errors.append(f"product listing editor must expose current listing instance command panel for deep-linked listing edits: {required}")
for required in (
    "PlatformListingSellerPreview",
    "aria-label=\"卖家后台 Listing 预览与字段核对\"",
    "data-ui=\"platform-listing-seller-preview\"",
    "id=\"platform-listing-seller-preview\"",
    "买家搜索卡片预览",
    "后台关键字段核对",
    "主图",
    "标题",
    "价格",
    "库存",
    "SKU",
    "平台属性",
    "物流",
    "发布前请逐项核对",
    "sellerPreviewChecks",
):
    if required not in PRODUCT_LISTING_EDITOR_CONTENT:
        errors.append(f"product listing editor must show seller-backend preview and publish field checks: {required}")
for required in ("ListingFieldEvidencePanel", "平台字段补证队列", "类目待补证字段", "编辑页待补证字段", "接口待补证字段", "补证后再发布", "platformFieldEvidenceGaps"):
    if required not in PRODUCT_LISTING_EDITOR_CONTENT:
        errors.append(f"product listing editor must expose category/edit-page/API field recheck gaps: {required}")
for required in ("类目差异字段组", "category_profile", "matched_category", "补证字段"):
    if required not in PLATFORM_FIELD_GROUPS:
        errors.append(f"platform field groups must show matched category profile and gap count: {required}")
for forbidden in ("attributeRows", "平台属性结构化编辑", "添加属性", "删除属性", "toAttributeRows", "updateAttributeRow"):
    if forbidden in PRODUCT_LISTING_EDITOR_CONTENT:
        errors.append(f"product listing editor must not use generic key/value platform attributes: {forbidden}")
for required in ("从商品图片选择", "商品主档已入库图片", "toggleListingImage", "使用主档图片", "selectedListingImageSet"):
    if required not in PRODUCT_LISTING_EDITOR_CONTENT:
        errors.append(f"product listing editor must reuse ingested product images: {required}")
for forbidden in ("SKU/变体 JSON", "平台属性 JSON", "parseJsonArray", "parseJsonObject"):
    if forbidden in PRODUCT_LISTING_EDITOR_CONTENT:
        errors.append(f"product listing editor must not expose raw JSON editing: {forbidden}")
for required in ("aria-label=\"商品图片真实预览\"", "主图", "辅图", "至少 5 张", "建议 9 张", "上移", "下移", "删除图片"):
    if required not in PRODUCT_IMAGES_PANEL:
        errors.append(f"product image editor must support platform-grade image management: {required}")
for required in ("mediaReadinessForProduct", "图片就绪", "平台至少 5 张", "建议 9 张", "媒体缺口"):
    if required not in PRODUCT_SELLER_WORKBENCH:
        errors.append(f"product seller workbench must surface platform image readiness in the list and inspector: {required}")
for required in ("上传商品图片", "采集图片入库", "素材入库后自动写入图片列表", "uploadProductImage", "importProductImageUrl"):
    if required not in PRODUCT_IMAGES_PANEL + PRODUCTS_API:
        errors.append(f"product image editor must persist image assets instead of manual URL only: {required}")
if "aria-label=\"三平台商品属性\"" not in PRODUCT_PLATFORM_ATTRIBUTES_PANEL:
    errors.append("product platform attributes panel must expose runtime platform attribute editing")
for required in ("useConfirm", "删除商品主档", "确认删除", "selectedIds.size"):
    if required not in PRODUCT_LIST_PAGE:
        errors.append(f"product bulk delete must use system confirm dialog: {required}")
for required in ("useConfirm", "删除平台店铺配置", "确认删除店铺"):
    if required not in PLATFORM_SETTINGS_PAGE:
        errors.append(f"platform account delete must use system confirm dialog: {required}")
for required in ("useConfirm", "删除仓储配置", "确认删除仓储"):
    if required not in SETTINGS_SYSTEM_PANELS:
        errors.append(f"settings warehouse delete must use system confirm dialog: {required}")
for required in ("补录平台账单", "entry_type=platform_fee", "order_id=${order.id}"):
    if required not in ORDER_DETAIL_PAGE:
        errors.append(f"order detail platform bill gap must deep-link to finance ledger replenishment: {required}")
for required in ("财务入账状态", "finance_entry_context", "OrderFinanceEntryPanel", "关联流水", "销售收入", "订单净利", "view_order_ledger", "record_sales_income", "build_order_finance_entry_context", "FinanceLedgerEntry.order_id == order.id"):
    if required not in ORDER_DETAIL_PAGE + ORDER_TYPES + ORDER_SERVICE:
        errors.append(f"order detail must expose real finance ledger posting context: {required}")
for required in ("order_id: Optional[str] = None", "FinanceLedgerEntry.order_id == order_id", "order_id: initialOrderId || undefined"):
    if required not in FINANCE_API + FINANCE_SERVICE + FINANCE_LEDGER_PANEL:
        errors.append(f"finance ledger must support order-level drilldown filtering: {required}")
for required in ("同步复盘", "platform_sync_status", "平台同步复盘", "platform_sync_review", "最近店铺订单同步"):
    if required not in ORDER_LIST_PAGE + ORDER_DETAIL_PAGE:
        errors.append(f"orders pages must expose platform order sync review context: {required}")
for required in ("useTriggerSync", "同步当前店铺订单", "syncMutation.mutate(order.platform_account_id)", "syncMutation.isPending", "qc.invalidateQueries({ queryKey: ['order'] })"):
    if required not in ORDER_DETAIL_PAGE + USE_SYNC_HOOK:
        errors.append(f"order detail must provide a real store order sync action from sync review: {required}")
for required in ("platform_account_id", "platformAccountId", "StoreContextBanner", "currentModule=\"orders\"", "store-context-banner"):
    if required not in ORDER_LIST_PAGE + ORDERS_API + STORE_CONTEXT_BANNER:
        errors.append(f"orders page must keep cockpit store drilldown filter context: {required}")
for required in ("履约异常", "履约异常复盘", "fulfillment_exception", "shipping_overdue", "异常处理动作闭环", "create_shipment", "review_after_sales", "replenish_platform_bill"):
    if required not in ORDER_LIST_PAGE + ORDER_DETAIL_PAGE + ORDER_SERVICE:
        errors.append(f"orders pages must expose fulfillment exception queue context: {required}")
for required in ("exceptions: exceptionMode ? '1' : undefined", "exceptions: bool = Query(False", "exceptions: bool = False", "fulfillment_context = build_fulfillment_exception_context(order)", "fulfillment_context.get(\"status\") == \"clear\"", "当前筛选范围没有履约异常订单"):
    if required not in ORDER_LIST_PAGE + ORDERS_API + ORDER_API + ORDER_SERVICE:
        errors.append(f"orders exception filter must use fulfillment exception context instead of order status: {required}")
for required in ("fulfillment_exception_status", "sync_status", "shipping_sla", "_matches_shipping_sla", "data-ui=\"order-fulfillment-filter-bar\"", "shippingSlaLabel"):
    if required not in ORDER_LIST_PAGE + ORDERS_API + ORDER_API + ORDER_SERVICE:
        errors.append(f"orders list must expose sync status, exception status and shipping SLA filters: {required}")
for required in ("RelatedShipmentsPanel", "关联物流记录", "useShipmentList", "order_id", "新增物流", "本地物流渠道"):
    if required not in ORDER_DETAIL_PAGE + SHIPMENTS_API:
        errors.append(f"order detail must show related shipment records: {required}")
for required in ("订单履约运营总览", "OrderFulfillmentOverview", "useOrderStats", "/orders/stats", "pending_shipment", "due_soon", "overdue", "store_breakdown", "缺失字段进入数据缺口"):
    if required not in ORDER_LIST_PAGE + ORDERS_API + ORDER_SERVICE + USE_ORDERS_HOOK:
        errors.append(f"orders page must expose fulfillment operating overview: {required}")
for required in ("orderListQuery", "orderStatsQuery.isError", "data-ui=\"order-list-error\"", "data-ui=\"order-stats-error\"", "重新加载订单列表", "重新加载履约统计"):
    if required not in ORDER_LIST_PAGE:
        errors.append(f"AUDIT-P2-03 orders page must expose visible React Query error recovery: {required}")
for required in ("useOrder", "order.after_sales_status", "履约异常原因", "不生成模拟售后记录"):
    if required not in AFTER_SALES_PAGE:
        errors.append(f"after-sales page must show linked order context without fake platform tickets: {required}")
for required in ("AfterSalesFulfillmentAnalysis", "售后履约分析", "退款/扣款台账", "finance_entry_context", "entry_type=refund", "平台售后单", "接口待接入", "不生成模拟售后记录"):
    if required not in AFTER_SALES_PAGE:
        errors.append(f"after-sales page must analyze fulfillment and finance context without fake after-sales tickets: {required}")
for required in ("OrderShipmentContextPanel", "订单发货上下文", "useOrder(orderContextId)", "平台发货时限", "买家与收货地址", "返回订单详情", "shippingAddressText"):
    if required not in SHIPMENT_DETAIL_PAGE:
        errors.append(f"shipment creation page must carry order fulfillment context: {required}")
for required in ("ShipmentStatusLifecycle", "物流状态轨迹", "物流状态字典轨迹", "基于系统物流状态字典", "承运商真实轨迹", "当前阶段", "已推进", "待推进", "当前物流状态未在统一字典中配置"):
    if required not in SHIPMENT_DETAIL_PAGE:
        errors.append(f"shipment detail must show local shipment status lifecycle separately from carrier tracking events: {required}")
for required in ("平台/店铺", "order_number", "buyer_name", "fulfillment_deadline_at", "platform_account_name", "平台时限待同步"):
    if required not in SHIPMENT_LIST_PAGE + SHIPMENT_DETAIL_PAGE + SHIPMENT_SERVICE:
        errors.append(f"shipment pages must expose platform-store-order context: {required}")
for required in ("platform_account_id", "platformAccountId", "StoreContextBanner", "currentModule=\"shipments\"", "店铺物流"):
    if required not in SHIPMENT_LIST_PAGE + SHIPMENTS_API + SHIPMENT_SERVICE + STORE_CONTEXT_BANNER:
        errors.append(f"shipment list must keep platform store drilldown filters: {required}")
for required in ("_sync_order_local_shipment_context", "local_shipment_context", "logistics_channel_source", "tracking_number_source", "local_shipment"):
    if required not in SHIPMENT_SERVICE:
        errors.append(f"shipment service must mirror real local shipment context back to order fulfillment: {required}")
for required in ("_advance_order_status_from_shipment", "terminal_statuses", "ready_to_ship", "order.status = \"shipped\"", "order.status = \"delivered\""):
    if required not in SHIPMENT_SERVICE:
        errors.append(f"shipment service must safely advance non-terminal order status from local shipment: {required}")
for required in ("fulfillment_exception", "/orders?exceptions=1", "物流时效风险", "estimated_impact", "response_deadline_at", "remaining_time_label", "sla_hours"):
    if required not in RISK_CONTROL_SERVICE:
        errors.append(f"risk control must reuse order fulfillment exception context: {required}")
for required in ("business", "店铺经营风险", "投入未转化", "spend-no-sales", "cost_rmb", "order_count"):
    if required not in RISK_CONTROL_SERVICE:
        errors.append(f"risk control must generate concrete store operating risks from store matrix: {required}")
for required in ("traffic-no-order", "traffic_no_order", "views_30d", "orders_30d", "listing_id", "Listing/定价/主图失效"):
    if required not in RISK_CONTROL_SERVICE:
        errors.append(f"risk control must generate concrete listing no-sales operating risks from product operations: {required}")
for required in ("business:sales-decline", "previous_orders_30d", "previous_sales_amount_30d", "orders_30d", "sales_amount_30d", "销售急剧下滑"):
    if required not in RISK_CONTROL_SERVICE + RISK_CONTROL_SALES_RISK_SERVICE:
        errors.append(f"risk control must generate concrete listing sales-decline risks only from real platform comparison metrics: {required}")
for required in ("get_finance_summary", "_finance_signal_risks", "finance:{code}", "真实财务台账", "finance_signal_code", "action_label"):
    if required not in RISK_CONTROL_SERVICE:
        errors.append(f"risk control must convert backend finance risk_signals into risk events: {required}")
risk_source_content = RISK_CONTROL_SERVICE + RISK_CONTROL_SOURCE_SUMMARY_SERVICE
for required in ("get_order_stats", "build_risk_source_summary", "risk_source_summary", "履约超时", "库存断货", "利润异常", "shipping_sla=overdue"):
    if required not in risk_source_content:
        errors.append(f"risk control must summarize fulfillment/inventory/profit risk sources: {required}")
for required in ("operation-action", "createRiskOperationAction", "生成运营台账动作", "operationSaving"):
    if required not in RISK_CONTROL_API + RISK_CONTROL_WORKSPACE + RISK_ACTION_PANEL:
        errors.append(f"risk control must create operation ledger actions from concrete risk events: {required}")
for required in ("record_type", "searchParams.get('record_type')", "listOperationRecords(requestedType"):
    if required not in OPERATIONS_WORKSPACE:
        errors.append(f"operations workspace must accept risk-control record_type deep links: {required}")
for required in ("allowsZeroBudgetOperationRecord", "listing_optimization", "0 预算 Listing 优化动作"):
    if required not in OPERATIONS_WORKSPACE:
        errors.append(f"operations workspace must allow zero-budget listing optimization records from risk/product diagnostics: {required}")
for required in ("initialOrderId", "order_id", "关联订单ID"):
    if required not in FINANCE_LEDGER_PANEL + FINANCE_PAGE:
        errors.append(f"finance ledger panel must accept order_id from query for platform bill replenishment: {required}")
for required in ("initialPlatformAccountId", "platform_account_id", "StoreContextBanner", "currentModule=\"finance\"", "store-context-banner"):
    if required not in FINANCE_LEDGER_PANEL + FINANCE_PAGE + FINANCE_API + STORE_CONTEXT_BANNER:
        errors.append(f"finance page must keep cockpit store drilldown filter context: {required}")
for required in (
    "getFinanceSummary(period, { platform_account_id: platformAccountId || undefined })",
    "getFinanceTraceback(period, { platform_account_id: platformAccountId || undefined })",
    "get_finance_summary(db, current_user.id, period, platform_account_id=platform_account_id)",
    "get_finance_traceback(db, current_user.id, period, platform_account_id=platform_account_id)",
    "FinanceLedgerEntry.extra[\"platform_account_id\"].as_string() == platform_account_id",
    "_latest_cash_balance(db, user_id, platform_account_id=platform_account_id, as_at=now)",
    "finance_ledger_entries.store_scope",
):
    if required not in FINANCE_PAGE + FINANCE_API + FINANCE_SERVICE + FINANCE_BACKEND_API:
        errors.append(f"finance store drilldown must filter summary, traceback and cash balance, not only ledger rows: {required}")
for required in (
    "unified_field_dictionary",
    "data-ui=\"finance-v5-sku-field-dictionary\"",
    "financeV5SkuFieldRows",
    "financeStandardFieldLabel",
    "merchant_sku",
    "platform_sku",
    "spu_skc",
    "sku_image_role",
    "FinanceV5SkuFieldRow",
):
    if required not in FINANCE_PAGE + FINANCE_API + FINANCE_V5_SKU_FIELD_DICTIONARY:
        errors.append(f"finance traceback must render V5 SKU context through unified field dictionary: {required}")
for required in (
    "useQuery",
    "financeSummaryQuery",
    "financeTracebackQuery",
    "queryKey: ['finance-summary'",
    "queryKey: ['finance-traceback'",
    "data-ui=\"finance-summary-error\"",
    "data-ui=\"finance-traceback-error\"",
    "重新加载财务汇总",
    "重新加载利润回溯",
):
    if required not in FINANCE_PAGE:
        errors.append(f"AUDIT-P2-03 finance page must use React Query boundaries and visible error recovery: {required}")
for required in ("平台账单批量导入", "importPlatformBills", "/finance/platform-bills/import", "import_ref 用于去重"):
    if required not in FINANCE_PAGE + FINANCE_API:
        errors.append(f"finance page must expose platform bill batch import workflow: {required}")
for required in ("Open API 同步", "syncPlatformBills", "/finance/platform-bills/sync", "账单API待接入", "Open API 暂不可用"):
    if required not in FINANCE_PAGE + FINANCE_API:
        errors.append(f"finance page must expose truthful platform bill Open API sync workflow: {required}")
for required in ("risk_signals", "FinanceRiskSignal", "_finance_risk_signals", "收入台账未入账", "成本台账不完整", "平台费缺失", "资金余额未录入", "negative_profit", "action_route"):
    if required not in FINANCE_PAGE + FINANCE_API + FINANCE_SERVICE + FINANCE_SCHEMA:
        errors.append(f"finance risks must come from backend reusable summary signals, not local page heuristics: {required}")
for required in ("financial_risk_signals", "ReportFinancialRiskPanel", "报表财务风险", "get_finance_summary", "_report_bounds", "finance_risk_count", "ReportFinancialRiskSignal"):
    if required not in REPORT_SERVICE + REPORT_DISPLAY + REPORT_TYPES:
        errors.append(f"reports must reuse backend finance risk signals and display them in report output: {required}")
for required in ("financial_risk", "财务风险异常", "report-finance-anomaly-list", "financeRisks", "metricAnomalies", "action_route"):
    if required not in REPORT_SERVICE + REPORT_PANELS + REPORT_TYPES:
        errors.append(f"report anomaly detection must show finance risk anomalies separately from numeric deviations: {required}")
for required in ("商品运营诊断", "getProductOperationMetrics", "/operations/product-metrics", "conversion_rate_pct", "生成运营台账", "createProductOperationAction", "/operations/product-actions"):
    if required not in GROWTH_ENGINE_PAGE + OPERATIONS_API:
        errors.append(f"growth engine must expose product-level operation metrics and diagnostics: {required}")
for required in (
    "unified_field_dictionary",
    "data-ui=\"promotion-v5-listing-field-dictionary\"",
    "data-ui=\"promotion-v5-candidate-field-dictionary\"",
    "promotionListingFieldRows",
    "normalizePromotionPlatformKey",
    "product_title",
    "platform_product_id",
    "sku_id",
    "sku_stock",
    "sku_price",
    "promotion_price",
):
    if required not in PROMOTIONS_PAGE:
        errors.append(f"promotions must render V5 product/listing fields through unified field dictionary: {required}")
for required in (
    "useQuery",
    "growthOpportunityQuery",
    "growthMetricsQuery",
    "queryKey: ['growth-opportunities']",
    "queryKey: ['growth-product-metrics']",
    "data-ui=\"growth-opportunity-error\"",
    "data-ui=\"growth-metrics-error\"",
    "重新加载增长机会",
    "重新加载运营指标",
):
    if required not in GROWTH_ENGINE_PAGE:
        errors.append(f"AUDIT-P2-03 growth engine must use React Query boundaries and visible error recovery: {required}")
for required in (
    "reportDailyQuery",
    "reportWeeklyQuery",
    "reportMonthlyQuery",
    "reportSubscriptionsQuery",
    "data-ui=\"report-daily-error\"",
    "data-ui=\"report-weekly-error\"",
    "data-ui=\"report-monthly-error\"",
    "data-ui=\"report-subscriptions-error\"",
    "重新加载日报",
    "重新加载周报",
    "重新加载月报",
    "重新加载订阅",
):
    if required not in REPORT_PANELS:
        errors.append(f"AUDIT-P2-03 reports center must expose visible React Query error recovery: {required}")
'''

def run(env: dict[str, object]) -> None:
    exec(_CHUNK, globals(), env)
