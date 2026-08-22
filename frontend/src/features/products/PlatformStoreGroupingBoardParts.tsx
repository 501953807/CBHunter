import { Badge } from '../../components/ui/Badge'
import type { PlatformStoreProduct } from '../../api/products'

export function PlatformStoreGroupingBoard({ items }: { items: PlatformStoreProduct[] }) {
  const groups = buildPlatformStoreGroups(items)
  return (
    <section
      aria-label="平台店铺商品分组态势"
      data-ui="platform-store-grouping-board"
      className="product-store-board rounded-[var(--radius-xl)] p-4"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">平台店铺商品分组态势</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">按平台/店铺查看商品同步、发布图缺口和 SKU 覆盖，先判断哪个店铺商品库需要处理。</p>
        </div>
        <Badge variant="outline">店铺分组 {groups.length}</Badge>
      </div>
      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] p-5 text-center text-xs text-[var(--color-muted)]">暂无可分组商品；同步平台商品后按店铺形成态势。</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {groups.map(group => (
            <article key={group.key} className="product-store-group-card rounded-[var(--radius-xl)] border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-fg)]">{group.storeName}</p>
                  <p className="mt-1 text-[11px] text-[var(--color-muted)]">{group.platform.toUpperCase()} · {group.market || '市场待补'}</p>
                </div>
                <Badge variant={group.mediaGapCount || group.unsyncedCount ? 'warning' : 'success'}>{group.mediaGapCount || group.unsyncedCount ? '需处理' : '就绪'}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <GroupMetric label="店铺商品数" value={String(group.productCount)} />
                <GroupMetric label="发布图缺口" value={String(group.mediaGapCount)} warning={group.mediaGapCount > 0} />
                <GroupMetric label="SKU 覆盖" value={`${group.variationCount}/${group.productCount}`} />
                <GroupMetric label="同步状态" value={group.unsyncedCount ? `待同步 ${group.unsyncedCount}` : '已同步'} warning={group.unsyncedCount > 0} />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function GroupMetric({ label, value, warning }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="product-store-metric rounded-lg border px-3 py-2">
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className={warning ? 'mt-1 text-sm font-semibold text-[var(--color-warning)]' : 'mt-1 text-sm font-semibold text-[var(--color-fg)]'}>{value}</p>
    </div>
  )
}

function buildPlatformStoreGroups(items: PlatformStoreProduct[]) {
  const groupMap = new Map<string, {
    key: string
    platform: string
    storeName: string
    market: string
    productCount: number
    mediaGapCount: number
    variationCount: number
    unsyncedCount: number
  }>()
  items.forEach(item => {
    const key = `${item.platform}:${item.store.id}`
    const current = groupMap.get(key) || {
      key,
      platform: item.platform,
      storeName: item.store.account_name,
      market: item.store.market || '',
      productCount: 0,
      mediaGapCount: 0,
      variationCount: 0,
      unsyncedCount: 0,
    }
    const captured = item.media_readiness?.captured_image_count ?? item.image_count
    const minImages = item.media_readiness?.min_platform_images ?? 5
    current.productCount += 1
    current.mediaGapCount += captured < minImages ? 1 : 0
    current.variationCount += item.variation_count || 0
    current.unsyncedCount += item.last_synced_at ? 0 : 1
    groupMap.set(key, current)
  })
  return Array.from(groupMap.values()).sort((a, b) => b.productCount - a.productCount)
}
