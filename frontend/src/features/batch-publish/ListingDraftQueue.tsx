import { Badge } from '../../components/ui/Badge'
import type { BatchListingDraft } from '../../api/listing'

interface Props {
  drafts: BatchListingDraft[]
  activeIndex: number
  confirmedDrafts: Set<number>
  onSelect: (index: number) => void
}

export function ListingDraftQueue({ drafts, activeIndex, confirmedDrafts, onSelect }: Props) {
  return (
    <aside className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3" aria-label="草稿队列">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--color-fg)]">草稿队列</p>
          <p className="text-[11px] text-[var(--color-muted)]">选择一个商品后在右侧完整编辑</p>
        </div>
        <Badge variant="default">{confirmedDrafts.size}/{drafts.length}</Badge>
      </div>
      <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
        {drafts.map((draft, index) => {
          const active = index === activeIndex
          const confirmed = confirmedDrafts.has(index)
          const image = Array.isArray(draft.images) ? draft.images[0] : draft.images
          return (
            <button
              key={`${draft.sourcing_item_id || draft.source_product_id}-${draft.platform}-${draft.platform_account_id || draft.market}-${index}`}
              type="button"
              onClick={() => onSelect(index)}
              className="w-full rounded-xl border p-2 text-left transition-all hover:bg-[var(--color-primary-light)]"
              style={{
                borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
                background: active ? 'var(--color-primary-light)' : 'var(--color-bg)',
              }}
            >
              <div className="flex gap-2">
                {image && (
                  <img src={image} alt={draft.product_name || '草稿商品图'} className="h-11 w-11 shrink-0 rounded-lg border border-[var(--color-border)] object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-xs font-semibold text-[var(--color-fg)]">{draft.product_name || '未命名商品'}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="outline">{draft.platform}</Badge>
                    {draft.store?.account_name && <Badge variant="outline">{draft.store.account_name}</Badge>}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate text-[var(--color-muted)]">{draft.market_label || draft.market}</span>
                <span style={{ color: confirmed ? 'var(--color-success)' : draft.publishable ? 'var(--color-primary)' : 'var(--color-danger)' }}>
                  {confirmed ? '已确认' : draft.publishable ? '待确认' : '阻断'}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
