import type { ContentWorkbenchItem } from '../../api/content'
import type { ListingGap } from './SellerPlatformListingEditorUtils'

const actionButtonClass = 'rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] transition hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-sm)] disabled:cursor-not-allowed disabled:opacity-40'

export function listingWorkflowUrl(path: string, product: ContentWorkbenchItem | null, activeStore: string) {
  const params = new URLSearchParams()
  if (product?.id) params.set('product_id', product.id)
  if (product?.target_platform) params.set('target_platform', product.target_platform)
  if (activeStore) params.set('target_store', activeStore)
  if (product?.target_market) params.set('target_market', product.target_market)
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

export function ListingCriticalActionStrip({
  product,
  activeStore,
  listingGaps,
  jump,
  changeTab,
}: {
  product: ContentWorkbenchItem | null
  activeStore: string
  listingGaps: ListingGap[]
  jump: (anchor: string, gap?: ListingGap) => void
  changeTab: (nextTab: string, options?: { imageSlotIndex?: number }) => void
}) {
  const gapFor = (anchor: string) => listingGaps.find(gap => gap.anchor === anchor)
  return (
    <div data-ui="listing-critical-action-strip" aria-label="发布前关键操作" className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-[var(--color-fg)]">发布前关键操作</p><span className="text-[11px] text-[var(--color-muted)]">按缺口补资料，确认价格后再进入刊登。</span></div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={actionButtonClass} onClick={() => jump('listing-master-media', gapFor('listing-master-media'))}>补图片</button><button type="button" className={actionButtonClass} onClick={() => jump('listing-master-attributes', gapFor('listing-master-attributes'))}>补平台属性</button><button type="button" className={actionButtonClass} onClick={() => jump('listing-master-sku', gapFor('listing-master-sku'))}>补SKU/销售</button>
        <button type="button" className={actionButtonClass} onClick={() => jump('listing-master-logistics', gapFor('listing-master-logistics'))}>补物流合规</button><button type="button" className={actionButtonClass} onClick={() => changeTab('media', { imageSlotIndex: 1 })} disabled={!product}>打开图片工作台</button>
        <button type="button" className={actionButtonClass} onClick={() => { window.location.href = listingWorkflowUrl('/pricing', product, activeStore) }} disabled={!product}>去定价校验</button><button type="button" className={actionButtonClass} onClick={() => { window.location.href = listingWorkflowUrl('/publish', product, activeStore) }} disabled={!product}>进入批量刊登</button>
      </div>
    </div>
  )
}
