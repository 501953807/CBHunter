import type { ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'
import type { ContentWorkbenchItem } from '../../api/content'
import { PlatformFieldGroupEditor, type PlatformRequirementsLike } from '../../components/shared/PlatformFieldGroups'
import { productImageSrc } from '../../utils/productImages'
import { ListingCriticalActionStrip } from './ListingCriticalActionStrip'
import { hasAttributeValue, type ListingGap } from './SellerPlatformListingEditorUtils'

export function EditorSection({
  id,
  title,
  description,
  active,
  children,
}: {
  id: string
  title: string
  description: string
  active?: boolean
  children: ReactNode
}) {
  return (
    <section id={id} className={active ? 'listing-editor-section scroll-mt-24 rounded-2xl border border-[var(--color-primary)] bg-[var(--color-primary-light)] p-4 shadow-[var(--shadow-md)] transition' : 'listing-editor-section scroll-mt-24 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 transition'}>
      <div className="mb-4">
        <h4 className="text-base font-semibold text-[var(--color-fg)]">{title}</h4>
        <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">{description}</p>
      </div>
      {children}
    </section>
  )
}

export function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={ok ? 'inline-flex items-center gap-1 rounded-full bg-[var(--color-success-light)] px-2 py-1 text-[var(--color-success)]' : 'inline-flex items-center gap-1 rounded-full bg-[var(--color-warning-light)] px-2 py-1 text-[var(--color-warning)]'}>
      {ok && <CheckCircle2 className="h-3 w-3" />}
      {label}
    </span>
  )
}

export function StatusMetric({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className={ok ? 'mt-1 text-sm font-semibold text-[var(--color-success)]' : 'mt-1 text-sm font-semibold text-[var(--color-warning)]'}>{value}</p>
    </div>
  )
}

export function EditableInput({
  label,
  value,
  onChange,
  placeholder,
  fieldId,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  fieldId?: string
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3">
      <p className="text-xs font-semibold text-[var(--color-fg)]">{label}</p>
      <input
        id={fieldId}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-2 text-xs text-[var(--color-fg)] outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)]"
      />
    </div>
  )
}

export function InlineInput({
  value,
  onChange,
  placeholder,
  fieldId,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  fieldId?: string
}) {
  return (
    <input
      id={fieldId}
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full min-w-[88px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-fg)] outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)]"
    />
  )
}

export function ListingEditorHeader({
  product,
  activeStore,
  listingImageCount,
  minImages,
  filledAttributes,
  requiredAttributes,
  readinessSnapshot,
  anchors,
  activeAnchor,
  jump,
  listingGaps,
  activeGap,
  anchorLabel,
  targetLabel,
  changeTab,
}: {
  product: ContentWorkbenchItem | null
  activeStore: string
  listingImageCount: number
  minImages: number
  filledAttributes: number
  requiredAttributes: string[]
  readinessSnapshot: Array<[string, string | number, boolean]>
  anchors: string[][]
  activeAnchor: string
  jump: (anchor: string, gap?: ListingGap) => void
  listingGaps: ListingGap[]
  activeGap: ListingGap | null
  anchorLabel: (anchor: string) => string
  targetLabel: (targetId?: string) => string
  changeTab: (nextTab: string, options?: { imageSlotIndex?: number }) => void
}) {
  return (
    <div className="listing-editor-header border-b border-[var(--color-border)] bg-[var(--color-bg)] px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--color-primary)]">统一 Listing 母版</p>
          <h3 className="mt-1 text-lg font-semibold text-[var(--color-fg)]">一次编辑，按店铺实例分发到 Shopee / TEMU / TikTok Shop</h3>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-[var(--color-muted)]">
            商品基础内容在母版维护；店铺、平台、市场差异通过覆盖字段保存。修改某个店铺 Listing 不会反向污染其他店铺或基础商品。
          </p>
        </div>
        <div id="listing-field-target-store" tabIndex={-1} className="flex flex-wrap gap-2 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">
          <StatusPill ok={Boolean(product)} label={product ? '已锁定商品' : '未选择商品'} />
          <StatusPill ok={Boolean(activeStore)} label={activeStore || '目标店铺待选'} />
          <StatusPill ok={listingImageCount >= minImages} label={`发布图 ${listingImageCount}/${minImages}`} />
          <StatusPill ok={filledAttributes >= requiredAttributes.length && requiredAttributes.length > 0} label={`属性 ${filledAttributes}/${requiredAttributes.length || 0}`} />
        </div>
      </div>
      <div data-ui="seller-listing-product-context-strip" aria-label="当前商品 Listing 编辑对象上下文" className="listing-editor-summary-card mt-4 grid gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 md:grid-cols-[88px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
          {product?.image_url ? <img src={productImageSrc(product.image_url)} alt={product.product_name} className="aspect-square w-full object-cover" /> : <div className="grid aspect-square place-items-center text-[11px] text-[var(--color-muted)]">未选图</div>}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-[var(--color-primary)]">当前商品对象：基础商品 → 平台 Listing → 店铺 Listing 覆盖</p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--color-fg)]">{product?.product_name || '请先从待制作列表选择商品'}</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">{product ? `${product.target_platform || '平台待补'} / ${product.target_market || '市场待补'} · ${product.category || '类目待补'} · 售价 ${product.selling_price_local ?? '待定价'}` : '选择商品后再编辑标题、图片、SKU、类目属性、物流和合规字段。'}</p>
            </div>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-muted)]">修改只写当前母版/店铺覆盖，不污染其他店铺</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            {readinessSnapshot.map(([label, value, ok]) => <StatusMetric key={String(label)} label={String(label)} value={String(value)} ok={Boolean(ok)} />)}
          </div>
        </div>
      </div>
      <nav aria-label="统一 Listing 母版字段快速定位" data-ui="unified-listing-sticky-field-nav" className="listing-editor-nav mt-4 flex gap-2 overflow-x-auto">
        {anchors.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => jump(id)}
            className={activeAnchor === id ? 'listing-editor-nav-pill shrink-0 rounded-full border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)]' : 'listing-editor-nav-pill shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'}
          >
            {label}
          </button>
        ))}
      </nav>
      <div
        className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
        data-ui="listing-gap-clickable-summary"
        aria-label="Listing 缺口点击定位摘要"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-[var(--color-fg)]">当前缺口定位</p>
            <p className="mt-1 text-[11px] text-[var(--color-muted)]">只展示会影响当前商品 Listing 保存、店铺覆盖或后续刊登的缺口；点击标签直接定位到对应编辑区。</p>
          </div>
          <span className={listingGaps.length ? 'rounded-full bg-[var(--color-warning-light)] px-2 py-1 text-[11px] font-semibold text-[var(--color-warning)]' : 'rounded-full bg-[var(--color-success-light)] px-2 py-1 text-[11px] font-semibold text-[var(--color-success)]'}>
            {listingGaps.length ? `待补 ${listingGaps.length} 项` : '暂无阻断缺口'}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {listingGaps.length ? listingGaps.map(gap => (
            <button
              key={gap.id}
              type="button"
              onClick={() => jump(gap.anchor, gap)}
              className={gap.severity === 'blocker' ? 'rounded-full border border-[var(--color-warning)] bg-[var(--color-warning-light)] px-3 py-1.5 text-xs font-semibold text-[var(--color-warning)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)]' : 'rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'}
              data-ui="listing-gap-click-to-field"
            >
              {gap.label}
            </button>
          )) : (
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs text-[var(--color-muted)]">图片、标题、属性、SKU、物流与合规已具备继续处理条件</span>
          )}
        </div>
        <div
          className="mt-3 rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-3 py-2 text-xs text-[var(--color-primary)]"
          data-ui="listing-active-gap-context"
          aria-label="当前定位的 Listing 缺口"
        >
          {activeGap ? (
            <span>正在处理：{activeGap.label}，已定位到「{anchorLabel(activeGap.anchor)} / {targetLabel(activeGap.targetId)}」。请在高亮编辑区内补齐字段后保存。</span>
          ) : (
            <span>当前定位：{anchorLabel(activeAnchor)}。点击上方缺口标签可直接跳到对应字段区域。</span>
          )}
        </div>
      </div>
      <ListingCriticalActionStrip product={product} activeStore={activeStore} listingGaps={listingGaps} jump={jump} changeTab={changeTab} />
    </div>
  )
}

export function ListingAttributeSection({
  active,
  draft,
  requiredAttributes,
  mergedAttributeValues,
  filledAttributes,
  effectivePlatformRequirements,
  highlightedFieldKey,
  onPlatformRequirementsChange,
  updateDraft,
}: {
  active: boolean
  draft: Record<string, string>
  requiredAttributes: string[]
  mergedAttributeValues: Record<string, unknown>
  filledAttributes: number
  effectivePlatformRequirements?: PlatformRequirementsLike
  highlightedFieldKey: string
  onPlatformRequirementsChange: (requirements?: PlatformRequirementsLike) => void
  updateDraft: (field: string, value: string) => void
}) {
  return (
    <EditorSection id="listing-master-attributes" title="类目属性" description="先按三平台字段组补齐类目属性，再维护系统统一共性字段。字段组来自商品当前平台要求，不再只展示少数固定属性。" active={active}>
      <div className="space-y-4">
        <div
          className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
          data-ui="seller-listing-platform-attribute-editor"
          id="listing-platform-field-group"
          tabIndex={-1}
          aria-label="卖家后台平台属性编辑区"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-3 py-3">
            <div>
              <p className="text-xs font-semibold text-[var(--color-fg)]">平台必填属性状态</p>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">字段来自目标平台/类目 Schema，缺口可直接在下方字段组和共性字段中补齐。</p>
            </div>
            <span className="rounded-full bg-[var(--color-primary-light)] px-2 py-1 text-[11px] font-semibold text-[var(--color-primary)]">
              已填写 {filledAttributes}/{requiredAttributes.length || 0}
            </span>
          </div>
          <table className="w-full min-w-[720px] text-left text-xs" aria-label="平台必填字段状态表">
            <thead className="bg-[var(--color-bg)] text-[var(--color-muted)]">
              <tr>
                <th className="border-b border-[var(--color-border)] px-3 py-2">平台字段</th>
                <th className="border-b border-[var(--color-border)] px-3 py-2">当前值</th>
                <th className="border-b border-[var(--color-border)] px-3 py-2">状态</th>
                <th className="border-b border-[var(--color-border)] px-3 py-2">处理位置</th>
              </tr>
            </thead>
            <tbody>
              {(requiredAttributes.length ? requiredAttributes : ['品牌/No Brand', '材质', '型号', '颜色', '尺寸']).map(field => {
                const lowerField = String(field).toLowerCase()
                const value = mergedAttributeValues[field] || mergedAttributeValues[lowerField] || ''
                const ready = hasAttributeValue(mergedAttributeValues, field) || hasAttributeValue(mergedAttributeValues, lowerField)
                return (
                  <tr key={field}>
                    <td className="border-b border-[var(--color-border)] px-3 py-2 font-medium text-[var(--color-fg)]">{field}</td>
                    <td className="border-b border-[var(--color-border)] px-3 py-2 text-[var(--color-muted)]">{String(value || '待填写')}</td>
                    <td className="border-b border-[var(--color-border)] px-3 py-2">
                      <span className={ready ? 'rounded-full bg-[var(--color-success-light)] px-2 py-1 text-[11px] text-[var(--color-success)]' : 'rounded-full bg-[var(--color-warning-light)] px-2 py-1 text-[11px] text-[var(--color-warning)]'}>
                        {ready ? '已填写' : '待补'}
                      </span>
                    </td>
                    <td className="border-b border-[var(--color-border)] px-3 py-2 text-[var(--color-muted)]">字段组 / 共性字段</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <PlatformFieldGroupEditor
          requirements={effectivePlatformRequirements}
          onChange={onPlatformRequirementsChange}
          highlightedFieldKey={highlightedFieldKey}
        />
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--color-fg)]">统一共性字段补充</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              ['category', '商品类目'],
              ['brand', requiredAttributes[0] || '品牌/No Brand'],
              ['material', requiredAttributes[1] || '材质'],
              ['model', requiredAttributes[2] || '型号'],
              ['audience', requiredAttributes[3] || '适用人群'],
              ['color', requiredAttributes[4] || '颜色'],
              ['size', requiredAttributes[5] || '尺寸'],
              ['capacity', requiredAttributes[6] || '容量'],
              ['style', requiredAttributes[7] || '风格'],
            ].map(([field, label]) => (
              <EditableInput key={field} fieldId={field === 'category' ? 'listing-field-category' : undefined} label={label} value={draft[field] || ''} onChange={value => updateDraft(field, value)} placeholder="待填写" />
            ))}
          </div>
        </div>
      </div>
    </EditorSection>
  )
}
