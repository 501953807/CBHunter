import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Search } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { EvidenceBanner } from '../../components/shared/EvidenceBanner'
import { getPlatformStoreProducts, type PlatformStoreProduct } from '../../api/products'
import { triggerProductSync, type SyncBlockDetail } from '../../api/sync'
import { usePlatforms, usePlatformStatuses } from '../../hooks/usePlatforms'
import { useConfig } from '../../hooks/useConfig'
import { getStatusMeta, toDomainOptions, withAllOption } from '../../utils/domainOptions'
import { useToast } from '../../components/ui/Toast'
import { logger } from '../../utils/logger'
import { productImageSrc } from '../../utils/productImages'

interface PlatformStoreProductsPanelProps {
  initialPlatform?: string
  initialPlatformAccountId?: string
}

export function PlatformStoreProductsPanel({ initialPlatform = '', initialPlatformAccountId = '' }: PlatformStoreProductsPanelProps) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { data: platformsData } = usePlatforms()
  const { data: platformStatuses } = usePlatformStatuses()
  const { platforms: configPlatforms = [], platform_listing_statuses = [] } = useConfig()
  const [platform, setPlatform] = useState(initialPlatform)
  const [platformAccountId, setPlatformAccountId] = useState(initialPlatformAccountId)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [syncGaps, setSyncGaps] = useState<string[]>([])
  const [syncBlockDetail, setSyncBlockDetail] = useState<SyncBlockDetail | null>(null)

  const stores = platformsData?.data || []
  const platformOptionsFromConfig = configPlatforms
    .filter(item => item.capabilities?.includes('listing') || item.capabilities?.includes('products'))
    .map(item => ({ value: item.id, label: item.label }))
  const listingStatusOptions = toDomainOptions(platform_listing_statuses)
  const filteredStores = stores.filter(store => !platform || store.platform === platform)
  const storeStatus = (platformStatuses?.data || []).find(item => item.account_id === platformAccountId)
  const productsQuery = useQuery({
    queryKey: ['platform-store-products', platform, platformAccountId, status, search, page],
    queryFn: () => getPlatformStoreProducts({
      platform: platform || undefined,
      platform_account_id: platformAccountId || undefined,
      status: status || undefined,
      search: search || undefined,
      page,
      page_size: 20,
    }),
  })
  const items = productsQuery.data?.data || []
  const meta = productsQuery.data?.meta
  const summary = buildPlatformStoreSummary(items)

  const handleSync = async () => {
    setSyncing(true)
    setSyncMessage('')
    setSyncGaps([])
    setSyncBlockDetail(null)
    try {
      const result = await triggerProductSync(platformAccountId || undefined)
      const payload = Array.isArray(result.data) ? result.data : result.data ? [result.data] : []
      const processed = payload.reduce((sum, item) => sum + (item.records_processed || 0), 0)
      await queryClient.invalidateQueries({ queryKey: ['platform-store-products'] })
      await queryClient.invalidateQueries({ queryKey: ['sync-status'] })
      setSyncMessage(`平台商品同步完成：处理 ${processed} 条`)
      toast.addToast('success', '平台商品同步完成')
    } catch (e: any) {
      logger.error('Platform product sync failed', e)
      const detail = e?.response?.data?.detail
      const message = typeof detail === 'string' ? detail : detail?.message || '平台商品同步未完成'
      setSyncMessage(message)
      setSyncGaps(detail?.data_gaps || ['platform_products_open_api'])
      setSyncBlockDetail(typeof detail === 'object' ? detail : null)
      toast.addToast('error', message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-fg)]">平台店铺商品</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              展示从 Shopee、TEMU、TikTok Shop 各店铺同步或本地创建的 Listing 实例；店铺归属、平台商品 ID、图片数量、SKU/规格数量和同步时间必须可见。
            </p>
          </div>
          <Button onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? '同步中...' : '平台商品同步'}
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[140px_220px_140px_1fr]">
          <Select
            value={platform}
            onChange={(value) => { setPlatform(value); setPlatformAccountId(''); setPage(1) }}
            options={withAllOption('全部平台', platformOptionsFromConfig)}
          />
          <Select
            value={platformAccountId}
            onChange={(value) => { setPlatformAccountId(value); setPage(1) }}
            options={[{ value: '', label: '全部店铺' }, ...filteredStores.map(store => ({ value: store.id, label: `${store.account_name} · ${store.platform}` }))]}
          />
          <Select
            value={status}
            onChange={(value) => { setStatus(value); setPage(1) }}
            options={withAllOption('全部状态', listingStatusOptions)}
          />
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--color-muted)]" />
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
              placeholder="搜索标题、平台商品ID、基础SKU或店铺..."
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-9 pr-3 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none"
            />
          </div>
        </div>
        {storeStatus && (
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            当前店铺商品接口：{storeStatus.operations?.products ? '已接入' : '未接入'} · {storeStatus.message}
          </p>
        )}
        {syncMessage && (
          <div className="mt-3 rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-light)] p-3 text-xs text-[var(--color-warning)]">
            <p>{syncMessage}</p>
            {syncGaps.length > 0 && <p className="mt-1">缺口：{syncGaps.join('、')}。真实商品 Open API 未接入前不生成模拟商品。</p>}
            {syncBlockDetail?.next_action && <p className="mt-1">下一步：{syncBlockDetail.next_action}</p>}
            {syncBlockDetail?.operation_details?.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {syncBlockDetail.operation_details.map((detail) => (
                  <span key={detail.id} className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] text-[var(--color-muted)]">
                    {detail.label}：{detail.status === 'implemented' ? '已实现' : '待接入'}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <EvidenceBanner evidence={productsQuery.data} compact />

      <section aria-label="平台店铺商品库总览" className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="平台 Listing" value={String(meta?.total ?? items.length)} hint="当前筛选下的店铺商品实例" />
        <SummaryCard label="覆盖店铺" value={String(summary.storeCount)} hint={summary.platforms.length ? summary.platforms.join(' / ') : '暂无平台'} />
        <SummaryCard label="已同步" value={String(summary.syncedCount)} hint={`${summary.localDraftCount} 个本地草稿`} />
        <SummaryCard label="图片不足" value={String(summary.mediaGapCount)} hint="低于平台最低图片要求" warning={summary.mediaGapCount > 0} />
        <SummaryCard label="SKU/规格" value={String(summary.variationCount)} hint="当前页规格合计" />
      </section>

      <PlatformStoreGroupingBoard items={items} />

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="professional-table w-full text-left text-xs">
          <thead className="bg-[var(--color-bg)] text-[var(--color-muted)]">
            <tr>
              <th className="px-3 py-2">平台商品</th>
              <th className="px-3 py-2">对象关系</th>
              <th className="px-3 py-2">店铺归属</th>
              <th className="px-3 py-2">店铺覆盖字段</th>
              <th className="px-3 py-2">价格库存</th>
              <th className="px-3 py-2">图片/SKU</th>
              <th className="px-3 py-2">同步/动作</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-[var(--color-muted)]">暂无平台店铺商品；请接入真实商品 Open API 后同步，或从 Listing 工作台创建本地店铺 Listing。</td></tr>
            )}
            {items.map(item => <PlatformStoreProductRow key={item.id} item={item} />)}
          </tbody>
        </table>
      </div>
      {meta && meta.total_pages > 1 && (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
          <span className="py-2 text-xs text-[var(--color-muted)]">{page} / {meta.total_pages}</span>
          <Button size="sm" variant="secondary" disabled={page >= meta.total_pages} onClick={() => setPage(page + 1)}>下一页</Button>
        </div>
      )}
    </div>
  )
}

function PlatformStoreGroupingBoard({ items }: { items: PlatformStoreProduct[] }) {
  const groups = buildPlatformStoreGroups(items)
  return (
    <section
      aria-label="平台店铺商品分组态势"
      data-ui="platform-store-grouping-board"
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">平台店铺商品分组态势</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">按平台/店铺查看商品同步、图片缺口和 SKU 覆盖，先判断哪个店铺商品库需要处理。</p>
        </div>
        <Badge variant="outline">店铺分组 {groups.length}</Badge>
      </div>
      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] p-5 text-center text-xs text-[var(--color-muted)]">暂无可分组商品；同步平台商品后按店铺形成态势。</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {groups.map(group => (
            <article key={group.key} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-fg)]">{group.storeName}</p>
                  <p className="mt-1 text-[11px] text-[var(--color-muted)]">{group.platform.toUpperCase()} · {group.market || '市场待补'}</p>
                </div>
                <Badge variant={group.mediaGapCount || group.unsyncedCount ? 'warning' : 'success'}>{group.mediaGapCount || group.unsyncedCount ? '需处理' : '就绪'}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <GroupMetric label="店铺商品数" value={String(group.productCount)} />
                <GroupMetric label="图片缺口" value={String(group.mediaGapCount)} warning={group.mediaGapCount > 0} />
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
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className={warning ? 'mt-1 text-sm font-semibold text-[var(--color-warning)]' : 'mt-1 text-sm font-semibold text-[var(--color-fg)]'}>{value}</p>
    </div>
  )
}

function SummaryCard({ label, value, hint, warning }: { label: string; value: string; hint: string; warning?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)]">
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className={warning ? 'mt-1 text-2xl font-bold text-[var(--color-warning)]' : 'mt-1 text-2xl font-bold text-[var(--color-fg)]'}>{value}</p>
      <p className="mt-1 line-clamp-2 text-[11px] text-[var(--color-muted)]">{hint}</p>
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

function buildPlatformStoreSummary(items: PlatformStoreProduct[]) {
  const stores = new Set(items.map(item => item.store.id))
  const platforms = Array.from(new Set(items.map(item => item.platform.toUpperCase()))).sort()
  const syncedCount = items.filter(item => Boolean(item.last_synced_at)).length
  const localDraftCount = items.filter(item => item.source === 'local_listing' || !item.platform_product_id).length
  const mediaGapCount = items.filter(item => {
    const captured = item.media_readiness?.captured_image_count ?? item.image_count
    const minImages = item.media_readiness?.min_platform_images ?? 5
    return captured < minImages
  }).length
  const variationCount = items.reduce((sum, item) => sum + (item.variation_count || 0), 0)
  return { storeCount: stores.size, platforms, syncedCount, localDraftCount, mediaGapCount, variationCount }
}

function PlatformStoreProductRow({ item }: { item: PlatformStoreProduct }) {
  const { platform_listing_statuses = [] } = useConfig()
  const mediaReadiness = item.media_readiness || {}
  const capturedImages = mediaReadiness.captured_image_count ?? item.image_count
  const minPlatformImages = mediaReadiness.min_platform_images ?? 5
  const recommendedPlatformImages = mediaReadiness.recommended_platform_images ?? 9
  const mediaGaps = mediaReadiness.gaps || []
  const mediaReadinessLabel = capturedImages >= minPlatformImages ? '图片达标' : `缺 ${minPlatformImages - capturedImages} 张`
  const statusMeta = getStatusMeta(platform_listing_statuses, item.status)
  const override = item.store_override_summary
  return (
    <tr className="border-t border-[var(--color-border)] align-top">
      <td className="min-w-72 px-3 py-3">
        <div className="flex gap-3">
          {item.images?.[0] ? <img src={productImageSrc(item.images[0])} alt="平台商品图" className="h-14 w-14 rounded-lg object-cover bg-[var(--color-bg)]" /> : <div className="h-14 w-14 rounded-lg bg-[var(--color-bg)]" />}
          <div>
            <Badge>{item.platform.toUpperCase()}</Badge>
            <p className="mt-1 line-clamp-2 text-sm font-medium text-[var(--color-fg)]">{item.title}</p>
            <p className="mt-1 text-[11px] text-[var(--color-muted)]">平台商品ID：{item.platform_product_id || '待同步'}</p>
          </div>
        </div>
      </td>
      <td className="min-w-72 px-3 py-3">
        <section aria-label="基础商品与店铺 Listing 实例关系" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <p className="text-[11px] font-semibold text-[var(--color-primary)]">对象关系</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[var(--color-fg)]">基础商品</span>
            <span className="text-[var(--color-muted)]">→</span>
            <span className="rounded-full bg-[var(--color-primary-light)] px-2 py-0.5 text-[var(--color-primary)]">店铺 Listing 实例</span>
          </div>
          <p className="mt-2 line-clamp-1 text-xs font-medium text-[var(--color-fg)]">{item.product_master.name}</p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">基础SKU：{item.product_master.sku}</p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">平台返回ID：{item.platform_product_id || '待同步'}</p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">Listing实例：{item.id.slice(0, 8)}</p>
          <p className="mt-2 rounded-lg bg-[var(--color-surface)] px-2 py-1 text-[11px] text-[var(--color-warning)]">
            {override?.isolation_note || '店铺覆盖字段不回写基础商品版本'}
          </p>
        </section>
      </td>
      <td className="px-3 py-3">
        <p className="font-medium text-[var(--color-fg)]">{item.store.account_name}</p>
        <p className="mt-1 text-[11px] text-[var(--color-muted)]">{item.store.platform} · {item.store.market || '市场待补'}</p>
      </td>
      <td className="px-3 py-3">
        <StoreOverrideSummary summary={override} />
      </td>
      <td className="px-3 py-3 text-[var(--color-fg)]">
        {item.price.toLocaleString()}
        <p className="mt-1 text-[var(--color-muted)]">库存 {item.stock}</p>
      </td>
      <td className="px-3 py-3 text-[var(--color-muted)]">
        <div className="space-y-1">
          <p className="font-medium text-[var(--color-fg)]">Listing图片 {capturedImages}/{minPlatformImages} · {mediaReadinessLabel}</p>
          <p>平台图片要求：至少 {minPlatformImages} 张，建议 {recommendedPlatformImages} 张</p>
          <p>主档图片：{item.product_master.image_count} 张</p>
          {mediaGaps.length > 0 && (
            <p className="text-[var(--color-warning)]">媒体缺口：{mediaGaps.join('、')}</p>
          )}
          <p>SKU/规格 {item.variation_count} 个</p>
        </div>
      </td>
      <td className="px-3 py-3">
        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
        <p className="mt-2 text-[11px] text-[var(--color-muted)]">{item.last_synced_at ? new Date(item.last_synced_at).toLocaleString('zh-CN') : '未同步'}</p>
        <p className="mt-1 text-[11px] text-[var(--color-muted)]">来源：{item.source}</p>
        <Link
          to={`/products/${item.product_master.id}?tab=listings&listing_id=${item.id}`}
          className="mt-2 inline-flex rounded-lg border border-[var(--color-border)] px-2 py-1 text-[11px] font-medium text-[var(--color-primary)] hover:bg-[var(--color-bg)]"
        >
          编辑店铺 Listing
        </Link>
        <PlatformStoreProductActionStrip item={item} />
      </td>
    </tr>
  )
}

type StoreProductActionSeverity = 'danger' | 'warning' | 'primary' | 'success'

interface StoreProductAction {
  label: string
  detail: string
  route: string
  severity: StoreProductActionSeverity
}

function PlatformStoreProductActionStrip({ item }: { item: PlatformStoreProduct }) {
  const actions = buildStoreProductActions(item)
  return (
    <div
      aria-label="平台店铺商品处理动作"
      data-ui="platform-store-product-action-strip"
      className="mt-3 min-w-48 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2"
    >
      <p className="text-[11px] font-semibold text-[var(--color-fg)]">下一步处理</p>
      <div className="mt-2 space-y-1.5">
        {actions.map((action) => (
          <Link
            key={action.label}
            to={action.route}
            className="flex items-start justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-[11px] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
          >
            <span>
              <span className="block font-semibold text-[var(--color-fg)]">{action.label}</span>
              <span className="mt-0.5 block text-[var(--color-muted)]">{action.detail}</span>
            </span>
            <span className={action.severity === 'danger' ? 'text-[var(--color-danger)]' : action.severity === 'warning' ? 'text-[var(--color-warning)]' : action.severity === 'success' ? 'text-[var(--color-success)]' : 'text-[var(--color-primary)]'}>
              {action.severity === 'success' ? '就绪' : '处理'}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function buildStoreProductActions(item: PlatformStoreProduct): StoreProductAction[] {
  const listingRoute = `/products/${item.product_master.id}?tab=listings&listing_id=${item.id}`
  const mediaReadiness = item.media_readiness || {}
  const capturedImages = mediaReadiness.captured_image_count ?? item.image_count
  const minPlatformImages = mediaReadiness.min_platform_images ?? 5
  const actions: StoreProductAction[] = []

  if (capturedImages < minPlatformImages) {
    actions.push({
      label: '补主图素材',
      detail: `当前 ${capturedImages}/${minPlatformImages} 张，进入图片槽位处理`,
      route: `${listingRoute}#listing-section-media`,
      severity: 'warning',
    })
  }
  if (!item.variation_count) {
    actions.push({
      label: '补 SKU/规格',
      detail: '当前店铺 Listing 缺少 SKU 或变体规格',
      route: `${listingRoute}#listing-section-sales`,
      severity: 'warning',
    })
  }
  if (!item.last_synced_at || !item.platform_product_id) {
    actions.push({
      label: '同步状态待处理',
      detail: item.platform_product_id ? '缺最近同步时间，复核店铺接口' : '缺平台商品 ID，需同步或发布',
      route: `/platforms?platform_account_id=${item.store.id}`,
      severity: 'danger',
    })
  }

  actions.push({
    label: '编辑店铺 Listing',
    detail: '修改当前店铺实例，不回写其他店铺',
    route: listingRoute,
    severity: actions.length ? 'primary' : 'success',
  })
  actions.push({
    label: '查看当前 Listing',
    detail: '核对标题、图片、价格、库存和平台属性',
    route: `${listingRoute}#platform-listing-seller-preview`,
    severity: actions.length ? 'primary' : 'success',
  })

  return actions
}

function StoreOverrideSummary({ summary }: { summary?: PlatformStoreProduct['store_override_summary'] }) {
  const items = [
    { label: '标题覆盖', active: Boolean(summary?.title_overridden), hint: summary?.title_overridden ? '店铺标题独立' : '沿用主档标题' },
    { label: '图片覆盖', active: Boolean(summary?.images_overridden), hint: `Listing ${summary?.image_count ?? 0} / 主档 ${summary?.master_image_count ?? 0}` },
    { label: '价格/库存覆盖', active: Boolean(summary?.price_stock_overridden), hint: '店铺级价格库存' },
    { label: 'SKU/规格覆盖', active: Boolean(summary?.variation_count), hint: `${summary?.variation_count ?? 0} 个规格` },
    { label: '平台属性', active: Boolean(summary?.platform_attribute_count), hint: `${summary?.platform_attribute_count ?? 0} 项` },
    { label: '物流包装', active: Boolean(summary?.logistics_configured), hint: summary?.logistics_configured ? '已配置' : '待配置' },
  ]
  return (
    <div className="min-w-56 space-y-2" aria-label="店铺覆盖字段">
      <p className="text-[11px] font-semibold text-[var(--color-fg)]">店铺覆盖字段</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => (
          <span
            key={item.label}
            className={`rounded-full border px-2 py-0.5 text-[11px] ${item.active ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-muted)]'}`}
            title={item.hint}
          >
            {item.label}
          </span>
        ))}
      </div>
      <p className="rounded-lg bg-[var(--color-bg)] px-2 py-1 text-[11px] text-[var(--color-muted)]">
        {summary?.isolation_note || '店铺覆盖字段不回写基础商品版本'}
      </p>
    </div>
  )
}
