"""Validation rule chunk for frontend information architecture."""
from .context import *  # noqa: F401,F403

_CHUNK = r'''
for required in (
    "ListingMediaSlotBoard",
    "data-ui=\"listing-media-editor-seller-console\"",
    "SellerImageEditorWorkbench",
    "data-ui=\"listing-image-editor-workbench\"",
    "2xl:grid-cols-[220px_minmax(640px,1fr)_180px]",
    "aria-label=\"Listing 图片编辑工作台\"",
    "aria-label=\"左侧图片工具栏\"",
    "aria-label=\"图片编辑画布\"",
    "aria-label=\"右侧图片槽位缩略图\"",
    "真实素材绑定",
    "消除笔",
    "裁剪旋转",
    "修改尺寸",
    "AI设计",
    "上传/替换当前槽位",
    "保存槽位顺序",
    "保存槽位变更",
    "slotPlanDirty", "imageOptionsKeyRef",
    "setSlotPlanDirty(true)",
    "setSlotPlanDirty(false)",
    "saveCurrentSlotPlan",
    "data-ui=\"image-slot-plan-dirty-state\"", "buildImageProcessingSummary", "publishImageLimit", "publishableSlotCount", "publishable_image_count", "retained_image_count", "emptySlotCount",
    "data-ui=\"image-processing-before-save-summary\"", "data-ui=\"image-processing-summary-chip\"", "data-ui=\"image-workbench-slot-publish-state\"", "data-ui=\"image-canvas-transform-preview\"", "data-ui=\"image-crop-preview-frame\"", "data-ui=\"image-platform-size-presets\"", "平台尺寸预设", "Shopee/TEMU 方图", "TikTok 主图", "平台主图", "发布前${publishImageLimit}张", "素材池保留",
    "保存前处理摘要", "data-ui=\"save-dirty-image-slot-plan\"", "data-ui=\"image-workbench-publish-readiness-summary\"", "data-ui=\"image-workbench-save-blocked-reason\"",
    "当前图片槽位有未保存变更，保存后才写入 Listing 图片计划。",
    "loadSavedImageSlotPlan",
    "parseSavedImageSlotPlan",
    "initialSavedSlotPlan",
    "data-ui=\"restored-image-slot-plan-state\"",
    "已回显保存计划",
    "setAsMainImage",
    "reorderSlot",
    "replaceActiveSlotWithAsset",
    "clearActiveSlot",
    "removeActiveSlot",
    "fillEmptySlotsFromAssets",
    "toggleAssetSelection",
    "appendSelectedAssetsAsSlots",
    "data-ui=\"image-slot-clear-remove-actions\"",
    "data-ui=\"clear-active-image-slot\"",
    "data-ui=\"remove-active-image-slot\"",
    "data-ui=\"fill-empty-image-slots-from-assets\"",
    "data-ui=\"append-selected-assets-as-image-slots\"",
    "data-ui=\"selectable-product-image-asset\"",
    "清空当前槽位",
    "删除当前槽位",
    "一键填充空槽位",
    "用当前商品真实素材填充空图片槽位",
    "将选中真实素材批量追加为图片槽位",
    "当前商品真实素材库",
    "批量追加槽位",
    "uploadSlotImage",
    "data-ui=\"image-slot-file-input\"",
    "data-ui=\"listing-image-empty-slot\"",
    "data-ui=\"replace-active-slot-with-asset\"",
    "{activeSlot.index}/{imageSlots.length}",
    "aria-label=\"Listing 媒体字段快速定位\"",
    "data-ui=\"media-editor-section-nav\"",
    "aria-label=\"Listing 图片槽位工作台\"",
    "aria-label=\"卖家后台图片槽位主表\"",
    "平台图片槽位与素材门禁",
    "图片角色",
    "素材状态",
    "处理动作",
    "必补发布图",
    "aria-label=\"Listing 图片处理动作\"",
    "aria-label=\"图片处理参数表\"",
    "aria-label=\"视频素材编辑区\"",
    "商品视频",
    "aria-label=\"当前商品素材库\"",
    "当前商品素材库",
    "处理当前主图",
    "MediaHealthCard",
    "productImageAssets",
    "productVideoAssets",
):
    if required not in content_media_surface:
        errors.append(f"content media studio must expose seller-console listing media slots: {required}")
for forbidden in ("grid-cols-[220px_minmax(520px,1fr)_150px]",):
    if forbidden in CONTENT_MEDIA_STUDIO:
        errors.append(f"content media studio must not force the image editor into a compressed three-column layout: {forbidden}")
for required in (
    "aria-label=\"Listing 文案编辑工作台\"",
    "data-ui=\"listing-copy-editor-seller-console\"",
    "aria-label=\"Listing 文案字段快速定位\"",
    "data-ui=\"copy-editor-section-nav\"",
    "aria-label=\"卖家后台标题编辑区\"",
    "aria-label=\"平台标题规则状态表\"",
    "标题规则",
    "待优化",
    "标题、卖点摘要与商品详情编辑台",
    "Listing 文案校验面板",
    "标题候选与人工定稿",
    "卖点摘要",
    "aria-label=\"卖点摘要编辑表\"",
    "摘要类型",
    "买家可见内容",
    "长描述 / 商品详情",
    "aria-label=\"长描述编辑区\"",
    "saveAndConfirm('listing_copy'",
    "saveAndConfirm('selling_points'",
    "saveAndConfirm('description'",
    "saveContentTaskVersion",
    "confirmContentTaskVersion",
):
    if required not in CONTENT_TITLE_GENERATOR:
        errors.append(f"content title generator must behave as a seller-console listing copy editor: {required}")
for forbidden in ("xl:grid-cols-[280px_minmax(0,1fr)_260px]", "xl:border-l xl:border-t-0"):
    if forbidden in CONTENT_TITLE_GENERATOR:
        errors.append(f"content title generator must not squeeze listing copy fields into narrow side rails: {forbidden}")
for forbidden in ("五点卖点", "aria-label=\"五点卖点编辑表\"", "filledBullets}/5", "卖点 {brief.length}/5", "bulletReady"):
    if forbidden in CONTENT_TITLE_GENERATOR + LISTING_UNIFIED_EDITOR_SECTIONS:
        errors.append(f"listing copy editor must not hard-code Amazon five-bullet UI as a platform-wide requirement: {forbidden}")
for required in ("useConfirm", "删除内容素材", "确认删除素材"):
    if required not in CONTENT_MEDIA_STUDIO:
        errors.append(f"content media asset delete must use system confirm dialog: {required}")
for required in ("useConfirm", "删除选品图片", "确认删除图片"):
    if required not in TREND_DISCOVERY_FILES:
        errors.append(f"trend discovery image delete must use system confirm dialog: {required}")
if "ContentCsvExport" in CONTENT_PLANNER_WORKSPACE or "Shopee批量上架CSV" in CONTENT_PLANNER_WORKSPACE:
    errors.append("content planner must not expose the old Shopee-only CSV listing workflow")
for required in ("useSearchParams", "product_id", "initialProductId"):
    if required not in CONTENT_PLANNER_WORKSPACE:
        errors.append(f"content planner must auto-select product from route parameter: {required}")
for required in (
    "image_slot",
    "parseListingImageSlot",
    "normalizeListingImageSlot",
    "activeImageSlotIndex",
    "initialSlotIndex={activeImageSlotIndex}", "onImageSlotPlanSaved={refreshSelectedProductFromWorkbench}", "refreshSelectedProductFromWorkbench", "queryClient.setQueryData(['content-workbench'], response)",
):
    if required not in CONTENT_PLANNER_WORKSPACE:
        errors.append(f"content planner must route listing image slot context into image editor: {required}")
for required in (
    "initialSlotIndex",
    "clampImageSlotIndex",
    "data-ui=\"listing-image-active-slot-context\"",
    "当前槽位：",
):
    if required not in SELLER_IMAGE_EDITOR_WORKBENCH + CONTENT_MEDIA_STUDIO:
        errors.append(f"seller image editor must preserve active listing image slot context: {required}")
if "aria-label=\"专业工作台视觉框架\"" not in PROFESSIONAL_WORKSPACE_FRAME:
    errors.append("professional workspace visual frame component must exist with accessible shell label")
if "aria-label=\"业务对象下钻动作\"" not in BUSINESS_OBJECT_ACTION_BAR:
    errors.append("business object action bar must exist with accessible drill-down action label")
for required in ("内容工厂待制作产品列表", "data-ui=\"content-factory-product-queue-page\"", "data-ui=\"content-queue-command-toolbar\"", "min-h-[calc(100vh-190px)]", "data-ui=\"content-listing-detail-overlay-workspace\"", "data-ui=\"content-image-edit-overlay-workspace\"", "data-ui=\"content-factory-editor-overlay\"", "覆盖式工作台", "workspaceMode === 'listing'", "workspaceMode === 'image'", "onOpenListing", "SellerPlatformListingEditorPanel", "layout=\"table\"", "data-ui=\"content-queue-real-action-guide\""):
    if required not in CONTENT_PLANNER_WORKSPACE:
        errors.append(f"content planner must separate queue, listing detail, and image editor flows: {required}")
for forbidden in ("onOpenImageEditor={openImageEditor}", "编辑主图", "ListingCompositionBoard product={selectedProduct}", "<Button variant=\"outline\" disabled>批量生成文案</Button>", "<Button variant=\"outline\" disabled>批量校验素材</Button>", "<Button variant=\"secondary\" disabled>推送到定价队列</Button>"):
    if forbidden in CONTENT_PLANNER_WORKSPACE or forbidden in CONTENT_PRODUCT_QUEUE:
        errors.append(f"content factory queue/detail must not expose old squeezed or misplaced action: {forbidden}")
for required in ("listing-master-copy", "listing-master-media", "listing-master-attributes", "listing-master-sku", "listing-master-logistics"):
    if required not in CONTENT_PLANNER_WORKSPACE + SELLER_PLATFORM_LISTING_EDITOR:
        errors.append(f"listing detail must keep direct anchors to editable sections: {required}")
for required in (
    "data-ui=\"content-product-bulk-action-workbench\"",
    "aria-label=\"内容商品批量处理队列\"",
    "BulkActionWorkbench",
    "批量文案处理队列",
    "批量素材校验队列",
    "批量定价校验队列",
    "onOpenMediaWorkbench",
    "productIdForAction",
    "data-ui=\"content-product-store-context-summary\"", "storeContextLabel", "data-ui=\"content-product-selection-command-deck\"", "aria-label=\"已选内容商品发布准备操作台\"", "bulkWorkflowUrl", "进入批量刊登", "处理首个发布图",
):
    if required not in CONTENT_PRODUCT_QUEUE + CONTENT_PLANNER_WORKSPACE:
        errors.append(f"content product queue must turn selected products into actionable local batch work queues: {required}")
for forbidden in ("title=\"批量生成文案需要接入内容任务批量接口后启用\"", "title=\"批量素材校验需要接入后端批量校验接口后启用\"", "title=\"送入定价队列需要完成智能定价模板后启用\"", "店铺：发布前选择/覆盖"):
    if forbidden in CONTENT_PRODUCT_QUEUE:
        errors.append(f"content product bulk actions must not remain disabled placeholders: {forbidden}")
for forbidden in ("内容诊断", "Preview", "Product Detail"):
    if forbidden in SELLER_PLATFORM_LISTING_EDITOR:
        errors.append(f"seller listing editor embedded in CBHunter must not copy platform side diagnosis/preview panels: {forbidden}")
for required in (
    "density=\"compact\"",
    "data-ui=\"content-listing-compact-toolbar\"",
    "aria-label=\"单商品 Listing 详情编辑工作区\"",
    "aria-label=\"当前商品主图编辑工作区\"",
):
    if required not in CONTENT_PLANNER_WORKSPACE:
        errors.append(f"content factory must prioritize editable listing workspace over explanatory cards: {required}")
for forbidden in (
    "aria-label=\"AI 内容与视频计划辅助折叠区\"",
    "aria-label=\"Listing 校验与衔接折叠区\"",
    "aria-label=\"店铺 Listing 覆盖字段折叠编辑区\"",
    "aria-label=\"Listing 对象关系折叠说明\"",
    "ContentListingContextPanel",
    "ListingObjectScopeMap product={selectedProduct}",
    "ListingStoreOverrideEditor",
    "ContentTaskMatrix product={selectedProduct}",
):
    if forbidden in CONTENT_PLANNER_WORKSPACE:
        errors.append(f"content factory detail page must not expose backend/explanatory panels in the primary editor: {forbidden}")
for forbidden in ("xl:grid-cols-[380px_minmax(720px,1fr)_360px]", "xl:grid-cols-[320px_minmax(900px,1fr)]", "professional-context-rail space-y-3"):
    if forbidden in CONTENT_PLANNER_WORKSPACE:
        errors.append(f"content planner must not squeeze the listing editor with a permanent right rail: {forbidden}")
if "description=\"围绕已决策商品编制标题、卖点、视频、图片处理和刊登前内容任务，所有内容必须绑定具体商品和平台字段。\"" in CONTENT_PLANNER_WORKSPACE:
    errors.append("content factory must not render a large explanatory description card above the listing editor")
if "xl:grid-cols-[minmax(0,1fr)_320px]" in LISTING_STORE_OVERRIDE_EDITOR:
    errors.append("listing store override editor must not squeeze store-level fields with a permanent status side rail")
for required in (
    "aria-label=\"当前商品 Listing 对象总览\"",
    "当前编辑商品",
    "ListingReadinessMeter",
    "ListingFact",
    "发布图 {imageCount}/{minImages}",
    "价格链路",
    "当前缺口",
    "暂无阻断缺口",
    "data-ui=\"listing-gap-jump-chip\"",
):
    if required not in CONTENT_PLANNER_WORKSPACE:
        errors.append(f"content planner must expose a seller-backend style current listing object overview: {required}")
for required in (
    "listingImageRoleByIndex",
    "main_image",
    "scene_image",
    "dimension_image",
    "detail_image",
    "sku_image",
    "description_image",
    "role: slot.role || roleMeta.role",
    "label: slot.label || roleMeta.label", "publishable?: boolean", "isSlotPublishable", "preservePublishable", "data.publishable", "notifyImageSlotPlanSaved", "data-ui=\"content-image-plan-refresh-after-save\"", "最低发布图", "建议发布图", "发布图缺口", "发布图已达标",
):
    if required not in CONTENT_MEDIA_STUDIO + SELLER_IMAGE_EDITOR_WORKBENCH:
        errors.append(f"content media studio must preserve V5 image slot roles in saved image plans: {required}")
for required in (
    "SellerPlatformListingEditorPanel",
    "data-ui=\"unified-listing-master-editor\"",
    "aria-label=\"统一 Listing 母版编辑器\"", "data-ui=\"seller-listing-product-context-strip\"", "当前商品对象：基础商品 → 平台 Listing → 店铺 Listing 覆盖",
    "data-ui=\"unified-listing-sticky-field-nav\"", "data-ui=\"listing-gap-clickable-summary\"",
    "aria-label=\"Listing 缺口点击定位摘要\"",
    "data-ui=\"listing-gap-click-to-field\"", "data-ui=\"listing-active-gap-context\"",
    "aria-label=\"当前定位的 Listing 缺口\"",
    "activeGap", "anchorLabel", "targetLabel", "targetId",
    "document.getElementById(gap.targetId)",
    "focus({ preventScroll: true })",
    "id=\"listing-field-images\"", "id=\"listing-field-title\"", "id=\"listing-field-description\"", "id=\"listing-platform-field-group\"",
    "id=\"listing-field-sku-table\"", "listing-field-sku-price", "listing-field-package-size", "fieldId={fieldId}",
    "active={activeAnchor === 'listing-master-sku'}",
    "border border-[var(--color-primary)] bg-[var(--color-primary-light)]",
    "当前缺口定位",
    "点击标签直接定位到对应编辑区",
    "正在处理：",
    "请在高亮编辑区内补齐字段后保存",
    "buildListingGaps",
    "发布图不足",
    "SKU 销售资料待补", "data-ui=\"listing-sku-row-readiness-status\"", "发布就绪", "待补：",
    "data-ui=\"listing-master-image-slot-grid\"", "data-ui=\"listing-image-operation-toolbar\"", "直接拖拽图片排序，首位即平台主图",
    "data-ui=\"listing-image-slot-edit-link\"", "changeTab('media', { imageSlotIndex: index + 1 })",
    "dropImageSlot", "draggable", "onDrop",
    "data-ui=\"listing-image-slot-order-card\"", "data-ui=\"listing-image-slot-publish-order\"",
    "data-ui=\"listing-image-slot-drag-handle\"", "data-ui=\"listing-image-slot-publish-state\"", "confirmed_image_slot_plan", "data-ui=\"listing-confirmed-image-slot-plan-summary\"",
    "平台主图 / 搜索首图", "发布前${recommendedImages}张内", "素材池保留，不随本次发布",
    "data-ui=\"listing-master-add-image-slot\"",
    "添加图片",
    "setMainImage",
    "image_slots",
    "场景辅图",
    "尺寸图",
    "细节图",
    "SKU图",
    "详情图",
    "搜索页首图 / 商品页主图",
    "统一 Listing 母版",
    "一次编辑，按店铺实例分发到 Shopee / TEMU / TikTok Shop",
    "商品基础内容在母版维护",
    "商品图片与素材",
    "商品标题与商品描述",
    "商品描述 / 图文详情",
    "类目属性",
    "SKU、销售资料与库存",
    "data-ui=\"seller-listing-platform-attribute-editor\"",
    "aria-label=\"卖家后台平台属性编辑区\"",
    "aria-label=\"平台必填字段状态表\"",
    "data-ui=\"seller-listing-sku-sales-editor\"",
    "aria-label=\"卖家后台 SKU 销售资料编辑区\"",
    "aria-label=\"SKU 批量操作工具条\"", "data-ui=\"listing-sku-batch-fill-summary\"", "本次写入：",
    "aria-label=\"卖家后台 SKU 销售资料编辑表\"",
    "规格一",
    "规格二",
    "平台 SKU / SPU/SKC",
    "SKU 图角色", "data-ui=\"listing-sku-image-slot-select\"", "data-ui=\"listing-sku-image-slot-preview\"", "选择图片槽位",
    "包装尺寸",
    "填充启用 SKU",
    "新增 SKU 变体",
    "物流、包装与合规",
    "ListingCopyAiAssistPanel", "data-ui=\"listing-copy-field-ai-assist-panel\"", "data-ui=\"listing-field-ai-candidate-card\"",
    "AI 只生成候选，点击采用后仍是草稿",
    "采用候选到当前字段",
    "候选未写入",
    "保存母版草稿", "notifySaved", "await notifySaved()", "当前商品上下文刷新失败", "resetDraft", "product.confirmed_image_slot_plan?.image_slots", "publishableSlotImageCount", "confirmedPublishableCount", "confirmedRetainedCount", "slice(0, recommendedImages)", "publishableImageCount", "retainedImageCount", "当前发布图", "发布图 ${listingImageCount}/${minImages}", "已排入发布 {publishableSlotImageCount}/{recommendedImages}", "schema: 'listing_image_slots.v1'", "publish_image_limit",
    "保存到店铺覆盖", "发布图与视频", "平台通常至少需要 5 张发布图", "StatusMetric", "ListingCriticalActionStrip", "listingWorkflowUrl", "product_id", "target_platform", "target_store", "target_market",
    "data-ui=\"listing-critical-action-strip\"", "发布前关键操作", "补发布图", "补平台属性", "补SKU/销售", "补物流合规",
    "去定价校验", "进入批量刊登", "changeTab('media'", "window.location.href = listingWorkflowUrl('/pricing'", "window.location.href = listingWorkflowUrl('/publish'",
):
    if required not in CONTENT_PLANNER_WORKSPACE + SELLER_PLATFORM_LISTING_EDITOR + SELLER_PLATFORM_LISTING_EDITOR_UTILS + LISTING_STORE_OVERRIDE_EDITOR + LISTING_CRITICAL_ACTION_STRIP + LISTING_COPY_AI_ASSIST_PANEL:
        errors.append(f"content planner must expose a focused same-product listing editor: {required}")
for forbidden in ("listing-inline-ai-title", "listing-inline-ai-description", "applyTitleCandidate", "applyDescriptionCandidate"):
    if forbidden in SELLER_PLATFORM_LISTING_EDITOR: errors.append(f"listing copy AI assist must not regress to old inline hidden buttons in main editor: {forbidden}")
for forbidden in ("xl:grid-cols-[240px_minmax(560px,1fr)_260px]",):
    if forbidden in SELLER_PLATFORM_LISTING_EDITOR: errors.append(f"seller platform listing editor must not force the editing form into a compressed three-column layout: {forbidden}")
for forbidden in ("xl:grid-cols-5", "进入编制 <ArrowRight"):
    if forbidden in CONTENT_PLANNER_WORKSPACE:
        errors.append(f"content planner listing composition must not regress to large clickable-card grid: {forbidden}")
for forbidden in ("<ListingUnifiedEditorSections", "AI 内容辅助、视频计划与搜索词", "短视频与内容计划", "标签与搜索词"):
    if forbidden in CONTENT_PLANNER_WORKSPACE:
        errors.append(f"content planner listing detail must not mix secondary AI/video/search helpers into primary listing editor: {forbidden}")
for forbidden in ("xl:grid-cols-[180px_minmax(0,1fr)_240px]", "xl:border-l xl:border-t-0"):
    if forbidden in LISTING_UNIFIED_EDITOR_SECTIONS:
        errors.append(f"listing unified editor must not compress fields into nested three-column layout: {forbidden}")
for forbidden in ("短视频与内容计划", "标签与搜索词", "listing-editor-video", "listing-editor-tags", "listing-editor-handoff"):
    if forbidden in LISTING_UNIFIED_EDITOR_SECTIONS: errors.append(f"listing unified editor must keep secondary helpers out of the primary listing form: {forbidden}")
for required in ("data-ui=\"listing-auxiliary-support-strip\"", "Listing 辅助功能收拢条", "视频与话题只做候选摘要", "定价与发布只保留去向"):
    if required not in LISTING_UNIFIED_EDITOR_SECTIONS: errors.append(f"listing unified editor must collapse secondary helpers into an auxiliary strip: {required}")
for required in (
    "aria-label=\"Listing 搜索词后台编辑区\"",
    "data-ui=\"listing-search-terms-editor\"",
    "后台 Search Terms",
    "品类词",
    "场景词",
    "平台标签",
    "搜索词来源",
    "复制搜索词包",
    "onCopy(searchTermPackage",
):
    if required not in LISTING_UNIFIED_EDITOR_SECTIONS:
        errors.append(f"listing unified editor must expose seller-backend search terms editing: {required}")
for required in (
    "aria-label=\"Listing SKU 属性物流合规工作台\"",
    "data-ui=\"listing-spec-editor-seller-console\"",
    "aria-label=\"Listing 规格字段快速定位\"",
    "data-ui=\"spec-editor-section-nav\"",
    "aria-label=\"卖家后台规格编辑主表\"",
    "data-ui=\"listing-sku-editable-variant-table\"",
    "aria-label=\"SKU 规格组合生成器\"",
    "data-ui=\"sku-variation-combination-generator\"",
    "aria-label=\"SKU 批量操作工具条\"",
    "data-ui=\"sku-bulk-edit-toolbar\"",
    "aria-label=\"SKU 发布准备度校验\"",
    "data-ui=\"sku-platform-readiness-checklist\"",
    "data-ui=\"sku-platform-field-mapping-table\"",
    "aria-label=\"SKU 平台字段映射表\"",
    "aria-label=\"SKU发布缺口列表\"",
    "buildSkuReadinessRows",
    "buildSkuPlatformMappingRows",
    "sku_platform_mapping",
    "skuPlatformMappingGapCount",
    "阻断缺口",
    "建议补充",
    "平台映射缺口",
    "平台SKU/SPU/SKC映射",
    "平台SKU/Model ID",
    "SPU/SKC",
    "包裹长宽高",
    "规格一名称",
    "规格一选项",
    "规格二名称",
    "规格二选项",
    "商家SKU前缀",
    "按规格组合追加SKU",
    "按规格组合重建SKU",
    "批量启用SKU",
    "批量停用SKU",
    "清空SKU草稿",
    "appendGeneratedSkuRows",
    "rebuildGeneratedSkuRows",
    "setAllSkuEnabled",
    "clearSkuDrafts",
    "splitSpecValues",
    "buildVariationLabel",
    "规格名: 规格值",
    "SKU/变体、平台属性、物流包装、合规检查",
    "aria-label=\"SKU 变体草稿表\"",
    "启用",
    "停用",
    "商家SKU",
    "平台SKU",
    "SPU/SKC",
    "变体属性",
    "SKU图角色",
    "aria-label=\"SKU 图片角色\"",
    "SKU图片URL",
    "getContentAssets",
    "productSkuImageAssets",
    "contentAssetImageUrl",
    "bindSkuImageAsset",
    "data-ui=\"sku-image-asset-picker\"",
    "暂无当前商品图片素材，请先在媒体素材中上传或处理真实图片。",
    "重量(g)",
    "长(cm)",
    "宽(cm)",
    "高(cm)",
    "条码/货号",
    "GTIN/EAN/货号",
    "删除第",
    "sku_image_role",
    "sku_image_url",
    "weight_g",
    "length_cm",
    "width_cm",
    "height_cm",
    "barcode",
    "aria-label=\"平台属性编辑工作台\"",
    "aria-label=\"平台必填字段状态表\"",
    "字段状态",
    "待填写",
    "PlatformFieldGroupEditor",
    "aria-label=\"物流包装编辑区\"",
    "aria-label=\"物流包裹尺寸表\"",
    "aria-label=\"规格合规校验面板\"",
    "confirmCompliance",
    "saveContentTaskVersion(product.id, 'compliance_check'",
    "getContentTaskMatrix(product.id)",
    "parseListingOverridePayload",
    "saveSpecificationOverride",
    "saveContentTaskVersion(product.id, 'listing_store_override'",
    "confirmContentTaskVersion(product.id, 'listing_store_override'",
    "保存规格到店铺覆盖草稿",
    "复制规格字段包",
):
    if required not in LISTING_SPECIFICATION_EDITOR:
        errors.append(f"content planner must expose actionable listing specs/attributes/logistics/compliance editor: {required}")
if "xl:grid-cols-[minmax(0,1fr)_320px]" in LISTING_SPECIFICATION_EDITOR:
    errors.append("listing specification editor must not squeeze SKU/spec fields with a permanent compliance side rail")
if "xl:grid-cols-[minmax(0,1fr)_280px]" in CONTENT_MEDIA_STUDIO:
    errors.append("content media studio must not squeeze image slots with a permanent image action side rail")
for required in ("draggable", "onDragStart", "onDragOver", "onDrop", "reorderSlot", "draggingSlotIndex !== null", "新增图片空位", "aria-label=\"新增图片空位\"", "拖拽缩略图调整主图/辅图顺序", "平台至少 ${minImages} 张发布图", "张发布图", "待补发布图", "发布图达标"):
    if required not in SELLER_IMAGE_EDITOR_WORKBENCH + LISTING_UNIFIED_EDITOR_SECTIONS:
        errors.append(f"content media studio must support drag-sort image slots and add empty slots: {required}")
if "draggingSlotIndex !== null" not in SELLER_IMAGE_EDITOR_WORKBENCH:
    errors.append("seller image editor must allow dragging the first/main image slot; do not use a truthy index check")
for required in ("aria-label=\"图片裁剪参数表\"", "aria-label=\"图片水印参数表\"", "crop_mode", "crop_x", "crop_width", "watermark_text", "watermark_position", "rotate_degrees", "flip_horizontal", "flip_vertical", "image_edit_options"):
    if required not in CONTENT_MEDIA_STUDIO:
        errors.append(f"content media studio must persist crop/watermark image edit options: {required}")
for required in (
    "listListingTemplates",
    "isImageWatermarkTemplate",
    "toImageWatermarkTemplateOption",
    "normalizeWatermarkOpacity",
    "template_data?.template_type === 'image_watermark'",
    "watermarkTemplates",
    "applyWatermarkTemplate",
    "clearWatermark",
    "data-ui=\"content-image-watermark-template-picker\"",
):
    if required not in CONTENT_MEDIA_STUDIO:
        errors.append(f"content media studio must load real image watermark templates into image edit options: {required}")
for required in (
    "ImageWatermarkTemplateOption",
    "data-ui=\"listing-image-watermark-template-picker\"",
    "应用水印模板",
    "清除水印",
    "watermarkTemplates.slice(0, 4)",
):
    if required not in SELLER_IMAGE_EDITOR_WORKBENCH:
        errors.append(f"seller image editor must expose quick watermark template application near the canvas: {required}")
for required in (
    "processSourceImageIntoActiveSlot",
    "data-ui=\"process-source-image-into-active-slot\"",
    "处理源图并替换当前槽位",
    "if (asset) replaceActiveSlotWithAsset(asset)",
    "onUseSourceImage: () => Promise<ContentAsset | null>",
):
    if required not in SELLER_IMAGE_EDITOR_WORKBENCH:
        errors.append(f"seller image editor must process source image back into the active slot: {required}")
for required in ("return response.data || null", "return null"):
    if required not in CONTENT_MEDIA_STUDIO:
        errors.append(f"content media source image edit must return the generated asset for active slot replacement: {required}")
for forbidden in ("FALLBACK_WATERMARK", "mockWatermark", "defaultWatermarkTemplates", "const watermarkTemplates = ["):
    if forbidden in CONTENT_MEDIA_STUDIO + SELLER_IMAGE_EDITOR_WORKBENCH:
        errors.append(f"content media watermark templates must come from API, not fallback/mock data: {forbidden}")
for required in ("data-ui=\"image-orientation-controls\"", "旋转90°", "水平翻转", "垂直翻转"):
    if required not in SELLER_IMAGE_EDITOR_WORKBENCH:
        errors.append(f"seller image editor must expose deterministic orientation controls: {required}")
for required in ("platformAttributeAliases", "platformFields(platformRequirements)", "pickLegacyAttributes"):
    if required not in SELLER_PLATFORM_LISTING_EDITOR_UTILS:
        errors.append(f"listing editor must merge dynamic platform field schema before legacy compatibility fields: {required}")
if "...pickAttributes(draft)" in SELLER_PLATFORM_LISTING_EDITOR_UTILS:
    errors.append("listing editor must not blindly overwrite platform schema attribute values with old hardcoded pickAttributes")
for forbidden in ("moveSlot(", "上移</button>", "下移</button>"):
    if forbidden in CONTENT_MEDIA_STUDIO:
        errors.append(f"content media studio must not rely on old up/down image sorting buttons: {forbidden}")
for forbidden in ("const CONTENT_TABS", "<Tabs tabs={CONTENT_TABS}", "activeTab ===", "{ id: 'title', label: 'AI标题' }", "{ id: 'export', label: '平台刊登' }", "{ id: 'media', label: '素材工坊' }"):
    if forbidden in CONTENT_PLANNER_WORKSPACE:
        errors.append(f"content planner tabs must not expose split tool/module labels: {forbidden}")
for forbidden in (
    "ContentPlatformMappingPanel",
    "aria-label=\"三平台 Listing 字段映射与差异缺口\"",
    "data-ui=\"platform-listing-field-mapping-panel\"",
    "统一母版负责沉淀 90% 共性字段",
):
    if forbidden in CONTENT_PLANNER_WORKSPACE:
        errors.append(f"content planner primary listing editor must not expose platform-difference mapping panels: {forbidden}")
if "aria-label=\"内容商品侧边队列\"" not in CONTENT_PRODUCT_QUEUE:
    errors.append("content product queue must support compact side-rail selection inside the listing workbench")
for required in (
    "data-ui=\"content-product-seller-filter-toolbar\"",
    "data-ui=\"content-product-seller-console-table\"",
    "商品信息",
    "平台 / 店铺 / 市场",
    "发布图 / 视频",
    "标题 / 描述",
    "SKU / 属性",
    "价格 / 库存",
    "待处理缺口",
    "搜索商品名称、平台、市场、类目",
    "statusFilter",
    "data-ui=\"content-product-bulk-action-toolbar\"",
    "当前页全选",
    "内容商品列表每页条数",
    "批量生成文案",
    "批量校验素材",
    "送入定价校验", "data-ui=\"content-product-row-action-set\"", "处理图片", "刊登",
):
    if required not in CONTENT_PRODUCT_QUEUE:
        errors.append(f"content product queue must follow seller-console product list structure: {required}")
for required in (
    "图片/水印模板",
    "data-ui=\"image-watermark-template-workspace\"",
    "data-ui=\"watermark-template-filter-toolbar\"",
    "data-ui=\"watermark-template-console-table\"",
    "营销水印",
    "我的主图水印",
    "系统水印模板",
    "创建水印",
    "搜水印 / 搜产品",
    "水印信息",
    "水印状态",
    "定时添加",
    "编辑水印",
    "删除水印",
    "投放详情",
    "追加投放",
    "fabric.js / cropperjs",
):
    if required not in MODULE_SUBNAV + ROUTE_META + LISTING_TEMPLATES_WORKSPACE:
        errors.append(f"listing templates route must become Miaoshou-style image/watermark templates: {required}")
for forbidden in ("Listing 模板", "标题模板", "描述模板", "新建 Listing 模板", "编辑 Listing 模板"):
    if forbidden in MODULE_SUBNAV + ROUTE_META + LISTING_TEMPLATES_WORKSPACE:
        errors.append(f"content publishing templates must not regress to duplicated listing copy templates: {forbidden}")
for required in ("aria-label=\"内容商品队列分页\"", "queuePage", "visibleItems", "getPageSize", "上一页", "下一页"):
    if required not in CONTENT_PRODUCT_QUEUE:
        errors.append(f"content product queue must paginate dense listing workbench items: {required}")
for required in ("useQuery", "contentWorkbenchQuery", "queryKey: ['content-workbench']", "data-ui=\"content-workbench-error\"", "重新加载内容商品队列"):
    if required not in CONTENT_PRODUCT_QUEUE:
        errors.append(f"AUDIT-P2-03 content product queue must use React Query and visible error recovery: {required}")
if "证据 {item.evidence_summary.present}" in CONTENT_PRODUCT_QUEUE:
    errors.append("content product queue must use user-facing 资料 wording instead of 证据 in the product list")
for page_name, page_content in (
    ("content planner", CONTENT_PLANNER_WORKSPACE),
    ("batch publish", BATCH_PUBLISH_WORKSPACE),
    ("product list", PRODUCT_LIST_PAGE),
):
    if "ProfessionalWorkspaceFrame" not in page_content:
        errors.append(f"{page_name} must use the professional workspace visual frame")
if "内容到刊登商品上下文" not in CONTENT_PUBLISH_GUIDE:
    errors.append("content planner publish tab must guide selected product into pricing and batch publishing")
for required in ("content_item_id=${product.id}", "product_id=", "带入当前商品"):
    if required not in CONTENT_PUBLISH_GUIDE:
        errors.append(f"content publish guide must carry selected object id into downstream pages: {required}")
for page_name, page_content in (
    ("content publish guide", CONTENT_PUBLISH_GUIDE),
    ("batch publish", BATCH_PUBLISH_WORKSPACE),
    ("product seller workbench", PRODUCT_SELLER_WORKBENCH),
):
    if "BusinessObjectActionBar" not in page_content:
        errors.append(f"{page_name} must use shared business object drill-down actions")
for required in ("activeProductId", "`/products/${activeProductId}`", "`/content?product_id=${activeProductId}`", "`/pricing?product_id=${activeProductId}`"):
    if required not in BATCH_PUBLISH_WORKSPACE:
        errors.append(f"batch publish action bar must preserve the selected product object: {required}")
for required in ("Listing 内容任务", "任务状态分组", "任务详情诊断", "aria-label=\"Listing 内容任务表格\""):
    if required not in CONTENT_TASK_MATRIX:
        errors.append(f"content task matrix must become a seller-console task workbench element: {required}")
for required in ("Listing标题", "商品描述", "PlatformFieldGroupEditor", "onDraftChange", "发布图 / 视频"):
    if required not in BATCH_PUBLISH_PREVIEW:
        errors.append(f"batch publish preview must keep editable listing draft field: {required}")
for required in ("draft_only", "保存草稿", "立即发布计划", "定时发布计划", "aria-label=\"发布计划模式说明\"", "data-ui=\"publish-plan-mode-guide\""):
    if required not in BATCH_PUBLISH_PREVIEW + BATCH_PUBLISH_WORKSPACE + LISTING_API:
        errors.append(f"batch publish preview must support draft-only/immediate/scheduled publish modes: {required}")
for required in ("PlatformRealtimePreview", "平台适配实时预览", "Shopee 商品卡", "TEMU 商品卡", "TikTok Shop 商品卡"):
    if required not in BATCH_PUBLISH_PREVIEW:
        errors.append(f"batch publish preview must expose three-platform realtime listing preview: {required}")
for required in ("PlatformFieldGapDetails", "data-ui=\"platform-field-gap-details\"", "aria-label=\"平台字段结构化缺口\"", "blocking_fields", "recheck_fields", "unified_field_key", "platform_field_name"):
    if required not in BATCH_PUBLISH_PREVIEW + LISTING_API:
        errors.append(f"batch publish preview must expose structured platform field gaps from backend validation details: {required}")
for required in ("field-gaps-content-link", "platform_field_key", "fieldRepairHref", "encodeURIComponent(field.key)", "/content?"):
    if required not in BATCH_PUBLISH_PREVIEW:
        errors.append(f"batch publish structured field gaps must link back to content factory field repair context: {required}")
for required in (
    "BatchPublishSkuReadinessPanel",
    "data-ui=\"sku-publish-readiness-details\"",
    "aria-label=\"SKU发布准备度结构化缺口\"",
    "sku-readiness-content-link",
    "skuReadinessDetails",
    "blocking_gaps",
    "warning_gaps",
    "active_sku_count",
    "section', 'sku'",
):
    if required not in BATCH_PUBLISH_PREVIEW + BATCH_PUBLISH_SKU_READINESS:
        errors.append(f"batch publish preview must expose backend SKU readiness blocking details and repair link: {required}")
for required in (
    "searchParams.get('section')",
    "searchParams.get('listing_section')",
    "listingSectionAnchor",
    "initialListingAnchor",
    "listing-master-sku",
    "scrollIntoView",
):
    if required not in CONTENT_PLANNER_WORKSPACE:
        errors.append(f"content factory must consume listing section deep links and scroll to SKU repair target: {required}")
for required in ("skuBlocked", "skuValidationCheck", "listing_validation.{check.get('code')}", "SKU发布准备度"):
    if required not in BATCH_PUBLISH_PREVIEW + BATCH_PUBLISH_SKU_READINESS + BATCH_PUBLISH_SERVICE:
        errors.append(f"batch publish realtime preview must consume backend SKU validation state: {required}")
for required in ("searchParams.get('platform_field_key')", "highlightPlatformFieldKey", "highlightedFieldKey", "data-ui=\"platform-field-highlight-target\"", "decodeURIComponent(highlightPlatformFieldKey)", "data-ui=\"platform-field-readiness-strip\"", "data-ui=\"platform-field-requirement-hint\"", "FieldReadinessStrip", "FieldRequirementHint"):
    if required not in CONTENT_PLANNER_WORKSPACE + SELLER_PLATFORM_LISTING_EDITOR + PLATFORM_FIELD_GROUPS:
        errors.append(f"content factory must consume platform_field_key and highlight the dynamic platform field: {required}")
for required in ("FieldValueControl", "normalizeFieldType", "fieldEnumOptions", "FieldFocusToolbar", "fieldMatchesFocus", "fallbackAttrMatchesFocus", "groupFieldStats", "data-ui=\"platform-field-group-readiness-summary\"", "data-ui=\"platform-field-focus-toolbar\"", "data-ui=\"platform-field-search-input\"", "data-ui=\"platform-field-focus-filter\"", "data-ui=\"platform-field-visible-count\"", "options?: unknown[]", "allowed_values?: unknown[]", "data-ui=\"platform-field-dynamic-input\"", "data-field-input-type=\"enum\"", "data-field-input-type=\"boolean\"", "data-field-input-type=\"number\"", "data-field-input-type=\"long_text\""):
    if required not in PLATFORM_FIELD_GROUPS:
        errors.append(f"platform field editor must render dynamic input controls by field type: {required}")
for required in ("草稿结果明细", "平台字段落库诊断", "PlatformFieldGroupSummary"):
    if required not in BATCH_PUBLISH_RESULT:
        errors.append(f"batch publish result step must expose listing draft persistence diagnostics: {required}")
for required in ("aria-label=\"发布失败与重试处理队列\"", "data-ui=\"publish-result-retry-action-panel\"", "FailureActionCard", "ResultActions", "返回重选重试", "补 Listing 内容", "补发布图/SKU", "补定价", "resultRepairHref", "resultPricingHref"):
    if required not in BATCH_PUBLISH_RESULT:
        errors.append(f"batch publish result step must expose failure reasons and repair/retry actions: {required}")
for required in ("PublishReceipt", "publish_receipt", "data-ui=\"publish-result-receipt-status-table\"", "data-ui=\"publish-result-local-receipt\"", "data-ui=\"publish-result-platform-api-status\"", "data-ui=\"publish-result-retry-entry\"", "publish-result-official-writeback", "official_publish_writeback", "官方回写", "平台 Open API 状态", "失败重试", "next_action", "retryable"):
    if required not in (BATCH_PUBLISH_RESULT + LISTING_API):
        errors.append(f"batch publish result must expose platform receipt and retry guidance: {required}")
for required in ("查看商品 Listing", "?tab=listings"):
    if required not in BATCH_PUBLISH_RESULT:
        errors.append(f"batch publish result step must link created drafts back to product listing detail: {required}")
for required in ("useSearchParams", "product_id", "product_ids", "getProduct", "setSelectedItems"):
    if required not in BATCH_PUBLISH_WORKSPACE:
        errors.append(f"batch publish workspace must keep product detail deep-link support: {required}")
for required in ("initialTargetsApplied", "productTargetPlatforms", "productTargetMarkets", "matchingStores.length === 1", "initialTargetPlatform", "initialTargetStore", "initialTargetMarket", "data-ui=\"batch-publish-content-context-handoff\"", "内容工厂带入", "target_platform", "target_store", "target_market"):
    if required not in BATCH_PUBLISH_WORKSPACE:
        errors.append(f"batch publish workspace must carry product target platform/market context safely: {required}")
for required in ("toggleItemSelection", "targetStoreIds", "availablePlatformIds", "availableMarketIds", "availableStoreIds", "selectablePlatforms", "selectableMarkets", "setSelectedStores(current =>"):
    if required not in BATCH_PUBLISH_WORKSPACE:
        errors.append(f"batch publish manual item selection must carry known target context: {required}")
if "不选则按平台默认店铺生成" in BATCH_PUBLISH_SELECT + BATCH_PUBLISH_WORKSPACE:
    errors.append("batch publish must not generate drafts for an implicit default store")
for required in ("selectedStores.size === 0", "请选择至少一个目标店铺"):
    if required not in BATCH_PUBLISH_SELECT + BATCH_PUBLISH_WORKSPACE:
        errors.append(f"batch publish must require explicit target store selection: {required}")
for required in ("selectedPlatformsList", "多平台字段组", "platformRequirementsForSelection"):
    if required not in BATCH_PUBLISH_SELECT:
        errors.append(f"batch publish select step must show requirements for every selected platform: {required}")
for required in ("目标归属", "ItemTargetContext", "商品目标归属", "待选择目标平台/市场/店铺"):
    if required not in BATCH_PUBLISH_SELECT:
        errors.append(f"batch publish select step must show product target context, not only field requirements: {required}")
for required in ("aria-label=\"发布门禁总览\"", "PublishGateCard", "PublishGateStack", "aria-label=\"发布门禁状态\"", "publishReadiness", "发布图门禁", "字段门禁", "目标归属", "Listing 母版", "masterReady"):
    if required not in BATCH_PUBLISH_SELECT:
        errors.append(f"batch publish select step must expose publish gate summary and row diagnostics: {required}")
for required in ("listingMasterStatus", "ListingMasterSummary", "aria-label=\"统一 Listing 母版摘要\"", "本地 Listing 草稿"):
    if required not in BATCH_PUBLISH_SELECT + BATCH_PUBLISH_WORKSPACE:
        errors.append(f"batch publish select step must expose listing master status before publish: {required}")
for required in ("ListingMasterStatus", "listing_master_status"):
    if required not in LISTING_API:
        errors.append(f"listing API types must carry backend listing master status: {required}")
for required in ("listingStoreOverride", "ListingOverrideSummary", "aria-label=\"店铺覆盖字段摘要\"", "未保存店铺覆盖草稿", "SKU", "属性", "物流", "合规"):
    if required not in BATCH_PUBLISH_SELECT + BATCH_PUBLISH_WORKSPACE:
        errors.append(f"batch publish select step must carry store override summary into publish gates: {required}")
for required in ("StoreOverridePreviewPanel", "aria-label=\"发布预览店铺覆盖来源\"", "店铺覆盖版本", "SKU/变体来源", "物流来源", "合规来源", "平台属性来源", "未使用店铺覆盖版本", "listing_store_override"):
    if required not in BATCH_PUBLISH_PREVIEW + BATCH_PUBLISH_OVERRIDE_PREVIEW + LISTING_API:
        errors.append(f"batch publish preview must expose store override source/status before draft creation: {required}")
for required in ("data-ui=\"batch-publish-sku-platform-mapping-summary\"", "店铺覆盖SKU平台字段映射状态", "sku_platform_mapping_count", "sku_platform_mapping_gap_count", "SKU平台字段映射", "平台SKU/SPU/SKC"):
    if required not in BATCH_PUBLISH_OVERRIDE_PREVIEW + LISTING_API + LISTING_STORE_OVERRIDE_SERVICE:
        errors.append(f"batch publish preview must carry content-factory SKU platform mapping into store override summary: {required}")
for required in ("field_sources", "override_boundary", "字段来源矩阵", "店铺 Listing 独立覆盖边界"):
    if required not in BATCH_PUBLISH_OVERRIDE_PREVIEW + LISTING_API:
        errors.append(f"batch publish preview must expose field source matrix for store override persistence: {required}")
for required in ("blocking_validation = [", "check.get(\"state\") == \"block\"", "Listing 发布前校验未通过", "listing_validation.", "test_confirm_publish_rechecks_blocking_validation_before_creating_draft"):
    if required not in BATCH_PUBLISH_SERVICE + (ROOT / "backend/tests/test_business_closure.py").read_text(encoding="utf-8"):
        errors.append(f"batch publish backend must recheck every blocking validation before draft creation: {required}")
for required in ("confirmed_image_slot_plan", "image_edit_plan", "listing_image_slots.v1", '"image_slots": item.get("image_slots")', "test_batch_preview_uses_confirmed_image_slot_plan"):
    if required not in BATCH_PUBLISH_SERVICE + (ROOT / "backend/app/services/listing_draft_asset_service.py").read_text(encoding="utf-8") + (ROOT / "backend/tests/test_business_closure.py").read_text(encoding="utf-8"):
        errors.append(f"batch publish backend must carry confirmed image_edit_plan slots into draft media assets: {required}")
if "check.get(\"state\") == \"block\" and check.get(\"code\") == \"platform_fields\"" in BATCH_PUBLISH_SERVICE:
    errors.append("batch publish backend must not only block platform_fields validation failures")
if "Array.from(selectedPlatforms)[0]" in BATCH_PUBLISH_SELECT:
    errors.append("batch publish select step must not inspect only the first selected platform for field requirements")
for required in (
    "data-ui=\"publish-target-command-bar\"",
    "aria-label=\"发布目标批量操作条\"",
    "data-ui=\"batch-publish-ready-list-toolbar\"",
    "data-ui=\"batch-publish-ready-list-table\"",
    "data-ui=\"publish-ready-pagination\"",
    "选择本页",
    "商品搜索",
    "发布门禁",
    "价格/定价快照",
    "发布图/SKU",
    "确认定价",
    "目标平台 / 店铺",
    "市场跟随店铺归属",
    "min-w-[1240px]",
    "space-y-4",
):
    if required not in BATCH_PUBLISH_SELECT:
        errors.append(f"batch publish select must prioritize product table and responsive target operation bar: {required}")
for required in (
    "data-ui=\"batch-publish-pricing-snapshot-status\"",
    "data-ui=\"batch-publish-media-sku-readiness-summary\"", "发布图", "aria-label=\"发布图缺口\"", "retained_image_count", "mediaSourceLabel", "isTrustedMediaSource",
    "data-ui=\"selected-publish-preflight-gate-summary\"",
    "data-ui=\"selected-publish-blocking-reason\"",
    "已选商品发布前校验",
    "定价快照待确认",
    "阻断",
    "不能进入 Listing 预览",
):
    if required not in BATCH_PUBLISH_SELECT + BATCH_PUBLISH_PREFLIGHT + BATCH_PUBLISH_READINESS_CELLS:
        errors.append(f"batch publish select must expose selected-item preflight and readiness details: {required}")
for required in ("selectedBlockingCounts", "selectedBlockingReason", "previewDisabled", "buildSelectedBlockingReason"):
    if required not in BATCH_PUBLISH_SELECT:
        errors.append(f"batch publish preview button must be blocked by selected item gates: {required}")
for required in ("pricingConfirmation", "pricing_template_snapshot", "hasPricingTemplateSnapshot"):
    if required not in BATCH_PUBLISH_SELECT + BATCH_PUBLISH_WORKSPACE:
        errors.append(f"batch publish select must carry confirmed pricing snapshot into publish readiness: {required}")
for required in (
    "BatchPublishTargetValidationPanel",
    "buildTargetPublishValidation",
    "TargetPublishValidation",
    "data-ui=\"batch-publish-target-validation-panel\"",
    "data-ui=\"batch-publish-target-validation-grid\"",
    "data-ui=\"batch-publish-target-validation-blocks\"",
    "目标店铺发布校验",
    "平台 Open API",
    "发布计划模式",
    "confirmedTargetBlockingCount",
    "publishDisabled",
    "buildPublishDisabledReason",
    "data-ui=\"batch-publish-preview-confirm-blocking-reason\"",
):
    if required not in BATCH_PUBLISH_PREVIEW + BATCH_PUBLISH_TARGET_VALIDATION:
        errors.append(f"batch publish preview must block confirmation by target store publish validation: {required}")
if "const priceReady = item.sellingPrice != null || item.costPrice != null" in BATCH_PUBLISH_SELECT:
    errors.append("batch publish select must not treat cost price alone as confirmed publish pricing")
for forbidden in (
    "className=\"grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]\"",
    "2xl:grid-cols-[minmax(0,1fr)_360px]",
    "aria-label=\"目标平台店铺操作区\"",
    "onToggleMarket",
    "请选择至少一个目标市场",
):
    if forbidden in BATCH_PUBLISH_SELECT:
        errors.append(f"batch publish select must not squeeze the product table with a permanent xl side rail: {forbidden}")
if "ProductBulkToolbar" not in PRODUCT_EDIT_PAGE and "ProductBulkToolbar" not in PRODUCT_LIST_PAGE:
    errors.append("product list selected toolbar must not regress to empty batch action buttons")
if "库存待接入" in PRODUCT_BULK_TOOLBAR:
    errors.append("product selected toolbar must not expose stock update as a disabled placeholder")
for required in ("batchUpdateStock", "stockValue", "onApplyStock", "批量设置店铺库存"):
    if required not in PRODUCT_LIST_PAGE + PRODUCT_BULK_TOOLBAR + PRODUCTS_API:
        errors.append(f"product selected toolbar must support batch store listing stock updates: {required}")
inventory_alert_content = INVENTORY_ALERT_WORKSPACE + INVENTORY_ALERT_PANELS + INVENTORY_ALERT_API + INVENTORY_ALERT_HOOKS + SYNC_HOOKS + INVENTORY_ALERT_BACKEND_API + INVENTORY_RISK_ACTION_SERVICE
for required in (
    "InventoryRiskWorkbench",
    "/inventory-alerts/risk-workbench",
    "getInventoryRiskWorkbench",
    "useInventoryRiskWorkbench",
    "InventoryRiskWorkbenchSnapshot",
    "aria-label=\"库存风险处理工作台\"",
    "data-ui=\"inventory-risk-workbench\"",
    "库存资金占用",
    "缺货风险",
    "滞销风险",
    "发货超期风险",
    "库存风险处理队列",
    "buildInventoryRiskLanes",
    "buildInventoryRiskActions",
    "查看店铺商品",
    "复核订单履约",
    "复核运营诊断",
    "createInventorySlowMovingOperationAction",
    "useCreateInventorySlowMovingOperationAction",
    "滞销 Listing 运营动作",
    "生成运营台账动作",
    "/inventory-alerts/risk-workbench/slow-moving/",
    "inventory_risk_action_service",
    "triggerProductSync",
    "同步平台商品库存",
    "平台商品同步未完成",
    "sku_source",
    "v5_product_sku_variants",
    "V5 SKU结构",
):
    if required not in inventory_alert_content:
        errors.append(f"inventory alerts must expose platform/store inventory risk workbench: {required}")
'''

def run(env: dict[str, object]) -> None:
    exec(_CHUNK, globals(), env)
