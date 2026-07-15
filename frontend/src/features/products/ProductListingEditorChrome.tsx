import { Badge } from '../../components/ui/Badge'
import type { PlatformRequirementsLike } from '../../components/shared/PlatformFieldGroups'
import type { ListingInstanceMatrixItem, ProductListingMatrix } from '../../api/listing'
import { productImageSrc } from '../../utils/productImages'

export type VariantEditRow = { sku: string; name: string; stock: string; price: string }
export type ListingEditSectionKey = 'basic' | 'detail' | 'sales' | 'media' | 'logistics' | 'attributes'
export type StoreListingEditForm = {
  title: string
  description: string
  price: string
  stock: string
  imagesText: string
  videoUrl: string
  sourceUrl: string
  packageWeightG: string
  packageLengthCm: string
  packageWidthCm: string
  packageHeightCm: string
  logisticsNote: string
  publishMode: 'immediate' | 'scheduled'
  scheduledAt: string
}

export const LISTING_EDIT_SECTIONS: Array<{ key: ListingEditSectionKey; label: string; note: string }> = [
  { key: 'basic', label: '基础信息', note: '标题/店铺身份' },
  { key: 'detail', label: '商品详情', note: '描述/卖点' },
  { key: 'sales', label: '销售资料/SKU', note: '价格/库存/变体' },
  { key: 'media', label: '媒体素材', note: '主图/辅图/视频' },
  { key: 'logistics', label: '物流与发布', note: '重量/尺寸/边界' },
  { key: 'attributes', label: '平台属性', note: '类目字段组' },
]

export function ListingInlineSectionNavigator({
  activeSection,
  onSelectSection,
}: {
  activeSection: ListingEditSectionKey
  onSelectSection: (section: ListingEditSectionKey) => void
}) {
  return (
    <nav
      aria-label="Listing 字段快速定位"
      data-ui="listing-inline-section-navigator"
      className="sticky top-3 z-10 mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[var(--color-fg)]">Listing 字段快速定位</p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">不是 Tab 分页，点击后定位到同一商品的对应字段分区。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {LISTING_EDIT_SECTIONS.map(section => {
            const active = activeSection === section.key
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => onSelectSection(section.key)}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition ${active ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary-text)]' : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-muted)] hover:border-[var(--color-primary)]'}`}
              >
                <span className="block font-semibold">{section.label}</span>
                <span className="mt-0.5 block text-[11px]">{section.note}</span>
              </button>
            )
          })}
        </div>
      </div>
      <p className="mt-3 text-[11px] text-[var(--color-muted)]">平台规则对齐：TikTok：最多 9 张图；Shopee/妙手：图片、视频、物流、货源链接同一商品上下文维护；本系统保存的是当前店铺覆盖，不改商品主档与其他店铺。</p>
    </nav>
  )
}

export function SectionHeading({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div>
        <h4 className="text-sm font-semibold text-[var(--color-fg)]">{title}</h4>
        <p className="mt-1 text-xs text-[var(--color-muted)]">{note}</p>
      </div>
      <Badge variant="outline">同一 Listing 连续编辑</Badge>
    </div>
  )
}

export function ProductListingEditOverview({
  listing,
  master,
  form,
  variantRows,
  readiness,
  onSelectSection,
}: {
  listing: ListingInstanceMatrixItem
  master?: ProductListingMatrix['product_master']
  form: StoreListingEditForm
  variantRows: VariantEditRow[]
  readiness: ReturnType<typeof listingInstanceReadiness>
  onSelectSection: (section: ListingEditSectionKey) => void
}) {
  const images = form.imagesText.split('\n').map(item => item.trim()).filter(Boolean)
  const imagePreview = images.length ? images : master?.images || []
  const platformFieldCard = readiness.cards.find(card => card.label === '平台字段')
  const priceStockReady = Boolean(form.price && form.stock !== '')
  return (
    <section
      aria-label="当前商品编辑总览"
      data-ui="product-listing-edit-overview"
      className="mb-4 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]"
    >
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4 xl:border-b-0 xl:border-r">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">当前商品编辑总览</p>
          <h3 className="mt-2 line-clamp-2 text-xl font-bold text-[var(--color-fg)]">{master?.name || listing.title}</h3>
          <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
            以基础商品主档为源头，在当前平台店铺 Listing 上维护标题、图片、SKU、平台属性、价格库存和发布状态；保存只影响当前店铺覆盖。
          </p>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            <OverviewFact label="基础商品主档" value={`SKU ${master?.sku || '待补'} · 成本 ${master?.cost_price == null ? '待补' : `¥${master.cost_price}`}`} />
            <OverviewFact label="平台店铺 Listing 上下文" value={`${listing.platform.toUpperCase()} · ${listing.store.account_name} · ${listing.store.market || '市场待补'}`} />
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {imagePreview.slice(0, 5).map((url, index) => (
              <img
                key={`${url}-${index}`}
                src={productImageSrc(url)}
                alt={`商品素材 ${index + 1}`}
                className="aspect-square rounded-xl border border-[var(--color-border)] object-cover"
              />
            ))}
            {imagePreview.length === 0 && <div className="col-span-5 rounded-xl border border-dashed border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-muted)]">暂无商品图片素材</div>}
          </div>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2">
          <OverviewActionCard
            label="图片素材槽位"
            value={`${images.length}/9`}
            detail={images.length >= 5 ? '已满足常见平台最低素材要求；建议补到 9 张。' : '图片不足，优先补主图、场景图、尺寸图和细节图。'}
            tone={images.length >= 5 ? 'ready' : images.length > 0 ? 'warning' : 'danger'}
            onClick={() => onSelectSection('media')}
          />
          <OverviewActionCard
            label="SKU/规格矩阵"
            value={variantRows.length ? `${variantRows.length} 个规格` : '单规格'}
            detail={variantRows.some(row => !row.sku.trim() || !row.name.trim()) ? '存在未填 SKU 或规格名，发布前需补齐。' : '当前规格结构可继续用于店铺 Listing。'}
            tone={variantRows.some(row => !row.sku.trim() || !row.name.trim()) ? 'warning' : 'ready'}
            onClick={() => onSelectSection('sales')}
          />
          <OverviewActionCard
            label="平台属性进度"
            value={platformFieldCard?.badge || '待检查'}
            detail={platformFieldCard?.detail || '需要根据平台类目字段继续复核。'}
            tone={platformFieldCard?.state === 'ready' ? 'ready' : platformFieldCard?.state === 'danger' ? 'danger' : 'warning'}
            onClick={() => onSelectSection('attributes')}
          />
          <OverviewActionCard
            label="价格库存状态"
            value={priceStockReady ? `${form.price} / ${form.stock}` : '待补'}
            detail={priceStockReady ? '当前店铺价格和库存已录入。' : '需要录入当前店铺售价和库存，不能只依赖基础商品。'}
            tone={priceStockReady ? 'ready' : 'warning'}
            onClick={() => onSelectSection('sales')}
          />
        </div>
      </div>
    </section>
  )
}

function OverviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[var(--color-fg)]">{value}</p>
    </div>
  )
}

function OverviewActionCard({ label, value, detail, tone, onClick }: { label: string; value: string; detail: string; tone: 'ready' | 'warning' | 'danger'; onClick: () => void }) {
  const badgeVariant = tone === 'ready' ? 'success' : tone === 'warning' ? 'warning' : 'danger'
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left transition hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-sm)]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--color-fg)]">{label}</p>
        <Badge variant={badgeVariant}>{value}</Badge>
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">{detail}</p>
    </button>
  )
}

export function CurrentListingInstanceCommandPanel({
  listing,
  master,
  readiness,
  onSelectSection,
}: {
  listing: ListingInstanceMatrixItem
  master?: ProductListingMatrix['product_master']
  readiness: ReturnType<typeof listingInstanceReadiness>
  onSelectSection: (section: ListingEditSectionKey) => void
}) {
  return (
    <section
      aria-label="当前店铺 Listing 实例操作台"
      className="mb-4 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]"
    >
      <div className="grid gap-0 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4 lg:border-b-0 lg:border-r">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">当前店铺 Listing 实例</p>
          <h3 className="mt-2 line-clamp-2 text-lg font-bold text-[var(--color-fg)]">{listing.title}</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <ListingFact label="平台/店铺" value={`${listing.platform.toUpperCase()} · ${listing.store.account_name}`} />
            <ListingFact label="市场" value={listing.store.market || '市场待补'} />
            <ListingFact label="平台返回ID" value={listing.platform_product_id || '待同步'} />
            <ListingFact label="Listing实例" value={listing.id.slice(0, 8)} />
          </div>
          <p className="mt-3 rounded-xl border border-[var(--color-warning)] bg-[var(--color-warning-light)] px-3 py-2 text-[11px] text-[var(--color-warning)]">
            店铺覆盖隔离：保存只更新当前 Listing，不回写基础商品版本，也不影响其他店铺 Listing。
          </p>
          <p className="mt-2 text-[11px] text-[var(--color-muted)]">基础商品：{master?.name || listing.product_id} · SKU {master?.sku || '待补'}</p>
        </div>
        <div className="p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {readiness.cards.map(card => (
              <button
                key={card.label}
                type="button"
                onClick={() => onSelectSection(card.section)}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left transition hover:border-[var(--color-primary)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[var(--color-fg)]">{card.label}</p>
                  <Badge variant={card.state === 'ready' ? 'success' : card.state === 'warning' ? 'warning' : 'danger'}>{card.badge}</Badge>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-[var(--color-muted)]">{card.detail}</p>
              </button>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <p className="text-xs font-semibold text-[var(--color-fg)]">当前缺口</p>
            {readiness.gaps.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {readiness.gaps.map(gap => (
                  <button
                    key={gap.label}
                    type="button"
                    onClick={() => onSelectSection(gap.section)}
                    className="rounded-full border border-[var(--color-warning)] bg-[var(--color-warning-light)] px-2 py-0.5 text-[11px] text-[var(--color-warning)]"
                  >
                    {gap.label}
                  </button>
                ))}
              </div>
            ) : <p className="mt-2 text-xs text-[var(--color-success)]">暂无阻断缺口；仍需以目标平台卖家后台校验为准。</p>}
          </div>
        </div>
      </div>
    </section>
  )
}

export function PlatformListingSellerPreview({
  listing,
  master,
  form,
  variantRows,
  requirements,
  onSelectSection,
}: {
  listing: ListingInstanceMatrixItem
  master?: ProductListingMatrix['product_master']
  form: StoreListingEditForm
  variantRows: VariantEditRow[]
  requirements: PlatformRequirementsLike
  onSelectSection: (section: ListingEditSectionKey) => void
}) {
  const images = form.imagesText.split('\n').map(item => item.trim()).filter(Boolean)
  const previewImage = images[0] || master?.images?.[0] || ''
  const checks = sellerPreviewChecks(form, variantRows, requirements, listing)
  return (
    <section
      id="platform-listing-seller-preview"
      aria-label="卖家后台 Listing 预览与字段核对"
      data-ui="platform-listing-seller-preview"
      className="mb-4 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]"
    >
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">seller backend preview</p>
            <h3 className="mt-1 text-base font-bold text-[var(--color-fg)]">卖家后台 Listing 预览与字段核对</h3>
            <p className="mt-1 text-xs text-[var(--color-muted)]">发布前请逐项核对：主图、标题、价格、库存、SKU、平台属性和物流必须落在当前平台店铺 Listing 实例。</p>
          </div>
          <Badge variant="outline">{listing.platform.toUpperCase()} · {listing.store.account_name}</Badge>
        </div>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3" aria-label="买家搜索卡片预览">
          <p className="mb-3 text-sm font-semibold text-[var(--color-fg)]">买家搜索卡片预览</p>
          {previewImage ? (
            <img src={productImageSrc(previewImage)} alt="Listing 主图预览" className="aspect-square w-full rounded-xl border border-[var(--color-border)] object-cover" />
          ) : (
            <div className="grid aspect-square w-full place-items-center rounded-xl border border-dashed border-[var(--color-border)] text-xs text-[var(--color-muted)]">主图待补</div>
          )}
          <p className="mt-3 line-clamp-2 text-sm font-semibold text-[var(--color-fg)]">{form.title || listing.title || master?.name || '标题待补'}</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-[var(--color-primary)]">{form.price ? `¥${form.price}` : '价格待补'}</span>
            <span className="text-[var(--color-muted)]">库存 {form.stock || '待补'}</span>
          </div>
          <p className="mt-2 text-[11px] text-[var(--color-muted)]">平台商品ID：{listing.platform_product_id || '待同步'} · 市场：{listing.store.market || '待补'}</p>
        </article>

        <div aria-label="后台关键字段核对" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--color-fg)]">后台关键字段核对</p>
            <Badge variant={checks.every(check => check.ready) ? 'success' : 'warning'}>{checks.filter(check => check.ready).length}/{checks.length} 已就绪</Badge>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {checks.map(check => (
              <button
                key={check.label}
                type="button"
                onClick={() => onSelectSection(check.section)}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-left transition hover:border-[var(--color-primary)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-fg)]">{check.label}</p>
                    <p className="mt-1 text-[11px] leading-5 text-[var(--color-muted)]">{check.detail}</p>
                  </div>
                  <Badge variant={check.ready ? 'success' : 'warning'}>{check.ready ? '就绪' : '待补'}</Badge>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function ListingFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5">
      <p className="text-[var(--color-muted)]">{label}</p>
      <p className="mt-0.5 truncate font-semibold text-[var(--color-fg)]">{value}</p>
    </div>
  )
}

function sellerPreviewChecks(
  form: StoreListingEditForm,
  variantRows: VariantEditRow[],
  requirements: PlatformRequirementsLike,
  listing: ListingInstanceMatrixItem,
) {
  const imageCount = form.imagesText.split('\n').map(item => item.trim()).filter(Boolean).length
  const missingFields = missingPlatformFieldCount(requirements)
  const hasSkuGap = variantRows.some(row => !row.sku.trim() || !row.name.trim())
  return [
    { label: '主图', ready: imageCount > 0, detail: imageCount ? `已选择 ${imageCount} 张图片，建议补到 9 张。` : '必须先补主图和至少一组辅图。', section: 'media' as const },
    { label: '标题', ready: Boolean(form.title.trim() || listing.title), detail: `当前标题长度 ${(form.title || listing.title || '').length} 字符。`, section: 'basic' as const },
    { label: '价格', ready: Boolean(form.price), detail: form.price ? `当前店铺售价 ${form.price}。` : '必须录入当前店铺售价。', section: 'sales' as const },
    { label: '库存', ready: form.stock !== '', detail: form.stock !== '' ? `当前店铺库存 ${form.stock}。` : '必须录入当前店铺库存。', section: 'sales' as const },
    { label: 'SKU', ready: !hasSkuGap, detail: variantRows.length ? `已维护 ${variantRows.length} 个 SKU/规格。` : '单规格商品可直接发布，多规格需维护平台 SKU。', section: 'sales' as const },
    { label: '平台属性', ready: missingFields === 0, detail: missingFields ? `仍有 ${missingFields} 个平台属性待补。` : '平台字段组未发现必填缺口。', section: 'attributes' as const },
    { label: '物流', ready: Boolean(form.packageWeightG || listing.shipping_config?.weight_g), detail: form.packageWeightG || listing.shipping_config?.weight_g ? '包裹重量/物流资料已维护。' : '需补包裹重量和物流资料。', section: 'logistics' as const },
  ]
}

export function listingInstanceReadiness(
  listing: ListingInstanceMatrixItem,
  form: StoreListingEditForm,
  variantRows: VariantEditRow[],
  requirements: PlatformRequirementsLike,
) {
  const imageCount = form.imagesText.split('\n').map(item => item.trim()).filter(Boolean).length
  const requiredFieldCount = missingPlatformFieldCount(requirements)
  const logisticsReady = Boolean(form.packageWeightG || listing.shipping_config?.weight_g)
  const publishReady = Boolean(form.publishMode === 'immediate' || form.scheduledAt)
  const cards: Array<{ label: string; badge: string; detail: string; state: 'ready' | 'warning' | 'danger'; section: ListingEditSectionKey }> = [
    {
      label: '图片槽位',
      badge: imageCount >= 5 ? '达标' : `${imageCount}/5`,
      detail: `当前 Listing 图片 ${imageCount} 张；平台常见最低 5 张，建议 9 张。`,
      state: imageCount >= 5 ? 'ready' : imageCount > 0 ? 'warning' : 'danger',
      section: 'media',
    },
    {
      label: '价格库存',
      badge: form.price && form.stock !== '' ? '已填' : '待补',
      detail: `店铺售价 ${form.price || '待补'}，店铺库存 ${form.stock || '待补'}。`,
      state: form.price && form.stock !== '' ? 'ready' : 'warning',
      section: 'sales',
    },
    {
      label: 'SKU/规格',
      badge: variantRows.length ? `${variantRows.length}个` : '单规格',
      detail: variantRows.length ? '已维护店铺级 SKU/规格覆盖。' : '单规格可不建变体，多规格商品需补平台 SKU。',
      state: variantRows.some(row => !row.sku.trim() || !row.name.trim()) ? 'warning' : 'ready',
      section: 'sales',
    },
    {
      label: '平台字段',
      badge: requiredFieldCount ? `缺${requiredFieldCount}` : '已填',
      detail: requiredFieldCount ? `仍有 ${requiredFieldCount} 个平台字段待补。` : '当前字段组未发现必填缺口。',
      state: requiredFieldCount ? 'warning' : 'ready',
      section: 'attributes',
    },
    {
      label: '物流发布',
      badge: logisticsReady && publishReady ? '已规划' : '待补',
      detail: `物流重量${logisticsReady ? '已维护' : '待补'}；发布计划 ${publishReady ? '已设置' : '待设置'}。`,
      state: logisticsReady && publishReady ? 'ready' : 'warning',
      section: 'logistics',
    },
  ]
  return {
    cards,
    gaps: cards
      .filter(card => card.state !== 'ready')
      .map(card => ({ label: card.label, section: card.section })),
  }
}

function missingPlatformFieldCount(requirements: PlatformRequirementsLike) {
  const values = requirements.attribute_values || {}
  const groups = (requirements.field_groups || []).filter((group): group is { fields?: Array<{ key?: string; required?: boolean }> } => Boolean(group && typeof group === 'object'))
  const groupMissing = groups.reduce((count, group) => count + (group.fields || []).filter(field => field.required && !values[field.key || '']).length, 0)
  const requiredMissing = (requirements.required_attributes || []).filter(attr => !values[attr]).length
  return groupMissing || requiredMissing
}
