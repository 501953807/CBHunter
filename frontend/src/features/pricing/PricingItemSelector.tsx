import type { PricingWorkbenchItem } from '../../api/pricing'
import { PlatformFieldGroupSummary } from '../../components/shared/PlatformFieldGroups'
import { productImageSrc } from '../../utils/productImages'

export function PricingItemSelector({
  items,
  selectedItemId,
  selectedStoreId,
  onSelectItem,
  onSelectStore,
}: {
  items: PricingWorkbenchItem[]
  selectedItemId: string
  selectedStoreId: string
  onSelectItem: (itemId: string) => void
  onSelectStore: (storeId: string) => void
}) {
  const item = items.find(entry => entry.id === selectedItemId)
  const media = item?.platform_requirements?.media || []
  const mediaReadiness = item?.media_readiness
  const mediaGaps = mediaReadiness?.gaps || []
  const pricingInputs = item?.pricing_inputs
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--color-muted)' }}>待定价商品</label>
          <select value={selectedItemId} onChange={e => onSelectItem(e.target.value)} className="w-full rounded-lg px-3 py-2 outline-none" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }}>
            <option value="">选择内容已确认的商品</option>
            {items.map(entry => <option key={entry.id} value={entry.id}>{entry.product_name} · ¥{entry.source_price_rmb} · {entry.platform}/{entry.market}</option>)}
          </select>
          {items.length === 0 && <p className="mt-1 text-[11px]" style={{ color: 'var(--color-muted)' }}>暂无内容已确认且成本完整的待定价商品，请先完成内容工厂确认。</p>}
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--color-muted)' }}>目标店铺</label>
          <select value={selectedStoreId} onChange={e => onSelectStore(e.target.value)} disabled={!item} className="w-full rounded-lg px-3 py-2 outline-none disabled:opacity-50" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }}>
            <option value="">选择用于本地草稿的店铺</option>
            {(item?.store_options || []).map(store => <option key={store.id} value={store.id}>{store.account_name}{store.shop_id ? ` · ${store.shop_id}` : ''}</option>)}
          </select>
          {item && item.store_options.length === 0 && <p className="mt-1 text-[11px]" style={{ color: 'var(--color-warning)' }}>当前平台没有可用店铺，确认价格前需先配置店铺。</p>}
        </div>
      </div>

      {item && (
        <section aria-label="定价商品上下文" className="rounded-xl p-3 flex gap-3" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
          {item.image_url ? (
            <img src={productImageSrc(item.image_url)} alt={item.product_name} className="w-20 h-20 object-cover rounded-lg shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-lg shrink-0 flex items-center justify-center text-xs" style={{ background: 'var(--color-surface)', color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}>无图片</div>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold truncate" style={{ color: 'var(--color-fg)' }}>{item.product_name}</p>
                <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{item.source_name} · {item.platform}/{item.market} · 内容确认{pricingInputs?.content_confirmed ? '已完成' : '待复核'}</p>
              </div>
              {item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer" className="text-xs" style={{ color: 'var(--color-primary)' }}>查看货源</a>}
            </div>
            <div className="grid gap-2 md:grid-cols-3 text-xs">
              <Info label="采购价" value={`¥${pricingInputs?.cost_rmb ?? item.source_price_rmb}`} />
              <Info label="平台" value={`${item.platform}/${item.market}`} />
              <Info label="素材要求" value={media.length ? media.slice(0, 3).join('、') : '待补素材要求'} />
            </div>
            {mediaReadiness && (
              <div className="rounded-lg px-2 py-1 text-[11px]" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }} aria-label="媒体缺口">
                <span style={{ color: 'var(--color-fg)' }}>图片就绪：</span>
                <span style={{ color: 'var(--color-muted)' }}>已采集 {mediaReadiness.captured_image_count ?? 0} 张，平台至少 {mediaReadiness.min_platform_images ?? 5} 张，建议 {mediaReadiness.recommended_platform_images ?? 9} 张。</span>
                {mediaGaps.length > 0 && <span style={{ color: 'var(--color-warning)' }}> 缺口：{mediaGaps.join('、')}</span>}
              </div>
            )}
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
              <p className="mb-2 text-[11px] font-semibold text-[var(--color-fg)]">平台字段组核验</p>
              <PlatformFieldGroupSummary requirements={item.platform_requirements} compact maxGroups={3} />
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg px-2 py-1" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <p style={{ color: 'var(--color-muted)' }}>{label}</p>
      <p className="truncate" style={{ color: 'var(--color-fg)' }}>{value}</p>
    </div>
  )
}
