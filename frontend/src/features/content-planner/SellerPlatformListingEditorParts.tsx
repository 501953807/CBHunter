import type { ReactNode } from 'react'
import { CheckCircle2, GripVertical, ImagePlus } from 'lucide-react'
import type { ContentWorkbenchItem } from '../../api/content'
import { Button } from '../../components/ui/Button'
import { productImageSrc } from '../../utils/productImages'
import { ListingCriticalActionStrip } from './ListingCriticalActionStrip'
import type { ListingGap, ListingImageSlot } from './SellerPlatformListingEditorUtils'

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

export function ListingImageSlotSection({
  active,
  product,
  imageSlots,
  draggingImageIndex,
  recommendedImages,
  minImages,
  publishableSlotImageCount,
  confirmedSlotCount,
  confirmedPublishableCount,
  confirmedRetainedCount,
  changeTab,
  onDragStart,
  onDrop,
  onDragEnd,
  onSetMainImage,
  onAddImageSlot,
}: {
  active: boolean
  product: ContentWorkbenchItem | null
  imageSlots: ListingImageSlot[]
  draggingImageIndex: number | null
  recommendedImages: number
  minImages: number
  publishableSlotImageCount: number
  confirmedSlotCount: number
  confirmedPublishableCount: number
  confirmedRetainedCount: number
  changeTab: (nextTab: string, options?: { imageSlotIndex?: number }) => void
  onDragStart: (index: number) => void
  onDrop: (index: number) => void
  onDragEnd: () => void
  onSetMainImage: (index: number) => void
  onAddImageSlot: () => void
}) {
  return (
    <EditorSection id="listing-master-media" title="商品图片与素材" description="顶部先处理商品图片。素材池可以保留多张，发布到平台时只取前 9 个槽位；槽位顺序决定平台主图和辅图顺序。" active={active}>
      <div
        id="listing-field-images"
        tabIndex={-1}
        className="grid grid-cols-2 gap-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9"
        data-ui="listing-master-image-slot-grid"
      >
        {imageSlots.map((slot, index) => (
          <div
            key={slot.id}
            draggable
            onDragStart={() => onDragStart(index)}
            onDragOver={event => event.preventDefault()}
            onDrop={() => onDrop(index)}
            onDragEnd={onDragEnd}
            className={draggingImageIndex === index ? 'overflow-hidden rounded-xl border border-[var(--color-primary)] bg-[var(--color-surface)] opacity-60 shadow-[var(--shadow-md)]' : 'overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]'}
            data-ui="listing-image-slot-order-card"
          >
            <button
              type="button"
              onClick={() => changeTab('media', { imageSlotIndex: index + 1 })}
              className="group relative block w-full bg-[var(--color-bg)]"
              data-ui="listing-image-slot-edit-link"
              aria-label={`编辑${slot.label}图片槽位`}
            >
              {slot.imageUrl ? (
                <img src={productImageSrc(slot.imageUrl)} alt={slot.label} className="aspect-square w-full object-cover" />
              ) : (
                <div className="grid aspect-square place-items-center gap-1 text-[11px] text-[var(--color-muted)]">
                  <ImagePlus className="h-5 w-5" />
                  <span>{slot.required ? '必填图' : '素材位'}</span>
                </div>
              )}
              <span className="absolute bottom-0 left-0 right-0 bg-[var(--color-fg)]/70 px-1 py-1 text-[10px] text-[var(--color-surface)]">{slot.label}</span>
              <span
                className={index === 0 ? 'absolute left-1 top-1 rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-surface)] shadow-[var(--shadow-sm)]' : 'absolute left-1 top-1 rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-fg)] shadow-[var(--shadow-sm)]'}
                data-ui="listing-image-slot-publish-order"
              >
                {index === 0 ? '主图' : `第${index + 1}张`}
              </span>
              <span
                className="absolute right-1 top-1 inline-flex items-center gap-1 rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[10px] text-[var(--color-muted)] shadow-[var(--shadow-sm)]"
                data-ui="listing-image-slot-drag-handle"
              >
                <GripVertical className="h-3 w-3" />拖拽
              </span>
              <span className="absolute right-1 top-7 hidden rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[10px] text-[var(--color-primary)] shadow-[var(--shadow-sm)] group-hover:block">编辑图片</span>
            </button>
            <div className="space-y-1 border-t border-[var(--color-border)] px-2 py-1">
              <p className="truncate text-[10px] text-[var(--color-muted)]">{slot.role}</p>
              <p
                className={index < recommendedImages ? 'text-[10px] font-semibold text-[var(--color-success)]' : 'text-[10px] font-semibold text-[var(--color-muted)]'}
                data-ui="listing-image-slot-publish-state"
              >
                {index === 0 ? '平台主图 / 搜索首图' : index < recommendedImages ? `发布前${recommendedImages}张内` : '素材池保留，不随本次发布'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1 border-t border-[var(--color-border)] p-1 text-[10px]">
              <button type="button" onClick={() => onSetMainImage(index)} disabled={index === 0 || !slot.imageUrl} className="rounded-md border border-[var(--color-border)] px-1 py-1 text-[var(--color-primary)] disabled:opacity-30">设主图</button>
              <button
                type="button"
                onClick={() => changeTab('media', { imageSlotIndex: index + 1 })}
                className="rounded-md border border-[var(--color-border)] px-1 py-1 text-[var(--color-muted)]"
                data-ui="listing-image-slot-edit-link"
                aria-label={`编辑${slot.label}图片槽位`}
              >
                编辑
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={onAddImageSlot}
          className="grid min-h-[132px] place-items-center rounded-xl border border-dashed border-[var(--color-primary)] bg-[var(--color-primary-light)] p-3 text-center text-xs text-[var(--color-primary)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)]"
          data-ui="listing-master-add-image-slot"
        >
          <span>
            <ImagePlus className="mx-auto mb-2 h-6 w-6" />
            添加图片
            <span className="mt-1 block text-[11px] text-[var(--color-muted)]">素材可多于 9 张，发布取前 9 张</span>
          </span>
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]" data-ui="listing-image-operation-toolbar" aria-label="Listing 图片槽位操作规则">
        <span className="rounded-full border border-[var(--color-border)] px-2 py-1">素材池 {imageSlots.length} 张，发布取前 {recommendedImages} 张</span>
        <span className="rounded-full border border-[var(--color-border)] px-2 py-1">已排入发布 {publishableSlotImageCount}/{recommendedImages}</span>
        <span className={confirmedSlotCount ? 'rounded-full bg-[var(--color-success-light)] px-2 py-1 font-semibold text-[var(--color-success)]' : 'rounded-full border border-[var(--color-border)] px-2 py-1'} data-ui="listing-confirmed-image-slot-plan-summary">{confirmedSlotCount ? `已回显图片计划 ${confirmedPublishableCount || confirmedSlotCount} 张发布图${confirmedRetainedCount ? `，素材池 ${confirmedRetainedCount}` : ''}` : '未保存图片计划，使用源图初始化'}</span>
        <span className="rounded-full border border-[var(--color-border)] px-2 py-1">至少 {minImages} 张</span>
        <span className="rounded-full border border-[var(--color-border)] px-2 py-1">直接拖拽图片排序，首位即平台主图</span>
        <Button size="sm" variant="outline" onClick={() => changeTab('media', { imageSlotIndex: 1 })} disabled={!product}>打开第1张图片工作台</Button>
      </div>
    </EditorSection>
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
