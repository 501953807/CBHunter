import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Search } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { EvidenceBanner } from '../../components/shared/EvidenceBanner'
import { getPlatformStoreProducts, type PlatformStoreProductFilterSummary } from '../../api/products'
import { getSyncLogs, triggerProductSync, type SyncBlockDetail } from '../../api/sync'
import { usePlatforms, usePlatformStatuses } from '../../hooks/usePlatforms'
import { useConfig } from '../../hooks/useConfig'
import { toDomainOptions, withAllOption } from '../../utils/domainOptions'
import { useToast } from '../../components/ui/Toast'
import { logger } from '../../utils/logger'
import {
  buildMarketOptions,
  buildPlatformStoreSummary,
  platformStoreMarket,
} from './PlatformStoreProductUtils'
import {
  PlatformStoreGroupingBoard,
  PlatformStoreProductRow,
  ProductSyncRetryLogBoard,
  PublishPlanQueueBoard,
  SummaryCard,
} from './PlatformStoreProductsPanelParts'

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
  const [market, setMarket] = useState('')
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
  const marketOptions = buildMarketOptions(stores, platform, platformAccountId)
  const filteredStores = stores.filter(store => (!platform || store.platform === platform) && (!market || platformStoreMarket(store) === market))
  const storeStatus = (platformStatuses?.data || []).find(item => item.account_id === platformAccountId)
  const productsQuery = useQuery({
    queryKey: ['platform-store-products', platform, platformAccountId, market, status, search, page],
    queryFn: () => getPlatformStoreProducts({
      platform: platform || undefined,
      platform_account_id: platformAccountId || undefined,
      market: market || undefined,
      status: status || undefined,
      search: search || undefined,
      page,
      page_size: 20,
    }),
  })
  const items = productsQuery.data?.data || []
  const meta = productsQuery.data?.meta
  const summary = buildPlatformStoreSummary(items, productsQuery.data?.meta?.summary as PlatformStoreProductFilterSummary | undefined)
  const productSyncLogsQuery = useQuery({
    queryKey: ['platform-product-sync-logs', platformAccountId],
    queryFn: () => getSyncLogs(platformAccountId || undefined, 1, 'products'),
  })

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
      <div className="product-store-console rounded-[var(--radius-xl)] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-fg)]">平台店铺商品</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              展示从 Shopee、TEMU、TikTok Shop 各店铺同步或本地创建的 Listing 实例；店铺归属、平台商品 ID、发布图数量、SKU/规格数量和同步时间必须可见。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/inventory-alerts"
              data-ui="platform-store-inventory-alert-entry"
              className="inline-flex items-center rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-bg)]"
            >
              库存预警
            </Link>
            <Button onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`mr-1.5 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? '同步中...' : '平台商品同步'}
            </Button>
          </div>
        </div>
        <div className="product-store-filter-bar mt-4 grid grid-cols-1 gap-3 rounded-[var(--radius-xl)] p-3 lg:grid-cols-[140px_220px_140px_140px_1fr]">
          <Select
            value={platform}
            onChange={(value) => { setPlatform(value); setPlatformAccountId(''); setMarket(''); setPage(1) }}
            options={withAllOption('全部平台', platformOptionsFromConfig)}
          />
          <Select
            value={platformAccountId}
            onChange={(value) => { setPlatformAccountId(value); setPage(1) }}
            options={[{ value: '', label: '全部店铺' }, ...filteredStores.map(store => ({ value: store.id, label: `${store.account_name} · ${store.platform}` }))]}
          />
          <div data-ui="platform-store-market-filter">
            <Select
              value={market}
              onChange={(value) => { setMarket(value); setPlatformAccountId(''); setPage(1) }}
              options={withAllOption('全部市场', marketOptions)}
            />
          </div>
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
      {productsQuery.isError && (
        <div
          data-ui="platform-store-products-error"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-danger)] bg-[var(--color-danger-light)] px-3 py-2 text-xs"
        >
          <span className="text-[var(--color-danger)]">平台店铺商品加载失败，当前店铺 Listing、发布图缺口和 SKU 覆盖暂不可用。</span>
          <Button size="sm" variant="secondary" onClick={() => productsQuery.refetch()}>
            重新加载平台店铺商品
          </Button>
        </div>
      )}

      <section aria-label="平台店铺商品库总览" className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <SummaryCard label="平台 Listing" value={String(summary.totalListingCount)} hint="当前筛选全量店铺商品实例" dataUi="platform-store-filter-summary-total" />
        <SummaryCard label="覆盖店铺" value={String(summary.storeCount)} hint={summary.platforms.length ? summary.platforms.join(' / ') : '暂无平台'} dataUi="platform-store-filter-summary-scope" />
        <SummaryCard label="覆盖市场" value={String(summary.marketCount)} hint="按当前筛选全量店铺市场汇总" dataUi="platform-store-market-summary" />
        <SummaryCard label="已同步" value={String(summary.syncedCount)} hint={`${summary.localDraftCount} 个本地草稿 · 全量`} />
        <SummaryCard label="库存风险" value={String(summary.inventoryRiskCount)} hint="规则/告警驱动 · 全量" warning={summary.inventoryRiskCount > 0} dataUi="platform-store-inventory-risk-summary" />
        <SummaryCard label="发布图不足" value={String(summary.mediaGapCount)} hint="低于平台最低发布图要求 · 全量" warning={summary.mediaGapCount > 0} />
        <SummaryCard label="发布队列" value={String(summary.publishQueueCount)} hint="本地草稿/待提交平台 · 全量" warning={summary.publishQueueCount > 0} />
      </section>

      <PlatformStoreGroupingBoard items={items} />
      <PublishPlanQueueBoard items={items} />
      <ProductSyncRetryLogBoard
        logs={productSyncLogsQuery.data?.data || []}
        isError={productSyncLogsQuery.isError}
        onRetry={() => productSyncLogsQuery.refetch()}
      />

      <div className="product-store-table-shell overflow-x-auto rounded-[var(--radius-xl)]">
        <table className="professional-table w-full text-left text-xs">
          <thead className="bg-[var(--color-bg)] text-[var(--color-muted)]">
            <tr>
              <th className="px-3 py-2">平台商品</th>
              <th className="px-3 py-2">对象关系</th>
              <th className="px-3 py-2">店铺归属</th>
              <th className="px-3 py-2">店铺覆盖字段</th>
              <th className="px-3 py-2">价格库存</th>
              <th className="px-3 py-2">发布图/SKU</th>
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
