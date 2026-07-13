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
              placeholder="搜索标题、平台商品ID、商品主档SKU或店铺..."
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

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="professional-table w-full text-left text-xs">
          <thead className="bg-[var(--color-bg)] text-[var(--color-muted)]">
            <tr>
              <th className="px-3 py-2">平台商品</th>
              <th className="px-3 py-2">店铺归属</th>
              <th className="px-3 py-2">商品主档</th>
              <th className="px-3 py-2">价格库存</th>
              <th className="px-3 py-2">图片/SKU</th>
              <th className="px-3 py-2">同步状态</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-[var(--color-muted)]">暂无平台店铺商品；请接入真实商品 Open API 后同步，或从 Listing 工作台创建本地店铺 Listing。</td></tr>
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

function PlatformStoreProductRow({ item }: { item: PlatformStoreProduct }) {
  const { platform_listing_statuses = [] } = useConfig()
  const mediaReadiness = item.media_readiness || {}
  const capturedImages = mediaReadiness.captured_image_count ?? item.image_count
  const minPlatformImages = mediaReadiness.min_platform_images ?? 5
  const recommendedPlatformImages = mediaReadiness.recommended_platform_images ?? 9
  const mediaGaps = mediaReadiness.gaps || []
  const mediaReadinessLabel = capturedImages >= minPlatformImages ? '图片达标' : `缺 ${minPlatformImages - capturedImages} 张`
  const statusMeta = getStatusMeta(platform_listing_statuses, item.status)
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
      <td className="px-3 py-3">
        <p className="font-medium text-[var(--color-fg)]">{item.store.account_name}</p>
        <p className="mt-1 text-[11px] text-[var(--color-muted)]">{item.store.platform} · {item.store.market || '市场待补'}</p>
      </td>
      <td className="px-3 py-3">
        <p className="font-medium text-[var(--color-fg)]">{item.product_master.name}</p>
        <p className="mt-1 text-[11px] text-[var(--color-muted)]">SKU：{item.product_master.sku}</p>
      </td>
      <td className="px-3 py-3 text-[var(--color-fg)]">
        {item.price.toLocaleString()}
        <p className="mt-1 text-[var(--color-muted)]">库存 {item.stock}</p>
      </td>
      <td className="px-3 py-3 text-[var(--color-muted)]">
        <div className="space-y-1">
          <p className="font-medium text-[var(--color-fg)]">图片 {capturedImages}/{minPlatformImages} · {mediaReadinessLabel}</p>
          <p>平台图片要求：至少 {minPlatformImages} 张，建议 {recommendedPlatformImages} 张</p>
          <p>商品主档图片：{item.product_master.image_count} 张</p>
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
      </td>
    </tr>
  )
}
