import { Link } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import type { PlatformStoreProduct } from '../../api/products'
import type { SyncLogItem } from '../../api/sync'
import { useConfig } from '../../hooks/useConfig'
import { getStatusMeta } from '../../utils/domainOptions'
import { productImageSrc } from '../../utils/productImages'
import {
  inventorySummaryVariant,
  isInventoryRiskItem,
  isPublishQueueItem,
  productSyncStatusLabel,
  publishQueueLabel,
} from './PlatformStoreProductUtils'

export { PlatformStoreGroupingBoard } from './PlatformStoreGroupingBoardParts'

export function SummaryCard({ label, value, hint, warning, dataUi }: { label: string; value: string; hint: string; warning?: boolean; dataUi?: string }) {
  return (
    <div data-ui={dataUi} data-warning={warning ? 'true' : 'false'} className="product-store-summary-card rounded-[var(--radius-xl)] border p-3 shadow-[var(--shadow-sm)]">
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className={warning ? 'mt-1 text-2xl font-bold text-[var(--color-warning)]' : 'mt-1 text-2xl font-bold text-[var(--color-fg)]'}>{value}</p>
      <p className="mt-1 line-clamp-2 text-[11px] text-[var(--color-muted)]">{hint}</p>
    </div>
  )
}

export function PlatformStoreProductRow({ item }: { item: PlatformStoreProduct }) {
  const { platform_listing_statuses = [] } = useConfig()
  const mediaReadiness = item.media_readiness || {}
  const capturedImages = mediaReadiness.captured_image_count ?? item.image_count
  const minPlatformImages = mediaReadiness.min_platform_images ?? 5
  const recommendedPlatformImages = mediaReadiness.recommended_platform_images ?? 9
  const mediaGaps = mediaReadiness.gaps || []
  const mediaReadinessLabel = capturedImages >= minPlatformImages ? '发布图达标' : `缺 ${minPlatformImages - capturedImages} 张`
  const statusMeta = getStatusMeta(platform_listing_statuses, item.status)
  const override = item.store_override_summary
  return (
    <tr className="product-store-row border-t border-[var(--color-border)] align-top">
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
        <p className="mt-1 text-[11px] text-[var(--color-muted)]">店铺ID：{item.store.shop_id || item.store.id.slice(0, 8)}</p>
        <p className="mt-1 text-[11px] text-[var(--color-muted)]" data-ui="platform-store-identity-sync-state">
          商品同步：{productSyncStatusLabel(item.store.product_sync_status)}
          {item.store.product_sync_at ? ` · ${new Date(item.store.product_sync_at).toLocaleString('zh-CN')}` : ''}
        </p>
      </td>
      <td className="px-3 py-3">
        <StoreOverrideSummary summary={override} />
      </td>
      <td className="px-3 py-3 text-[var(--color-fg)]">
        {item.price.toLocaleString()}
        <p className="mt-1 text-[var(--color-muted)]">库存 {item.stock}</p>
        <InventoryAlertInlineSummary item={item} />
      </td>
      <td className="px-3 py-3 text-[var(--color-muted)]">
        <div className="space-y-1">
          <p className="font-medium text-[var(--color-fg)]">发布图 {capturedImages}/{minPlatformImages} · {mediaReadinessLabel}</p>
          <p>平台发布图要求：至少 {minPlatformImages} 张，建议 {recommendedPlatformImages} 张</p>
          <p>主档图片：{item.product_master.image_count} 张</p>
          {mediaGaps.length > 0 && (
            <p className="text-[var(--color-warning)]">发布图缺口：{mediaGaps.join('、')}</p>
          )}
          <p>SKU/规格 {item.variation_count} 个</p>
        </div>
      </td>
      <td className="px-3 py-3">
        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
        <p className="mt-2 text-[11px] text-[var(--color-muted)]">{item.last_synced_at ? new Date(item.last_synced_at).toLocaleString('zh-CN') : '未同步'}</p>
        <p className="mt-1 text-[11px] text-[var(--color-muted)]">来源：{item.source}</p>
        <SyncReceiptInlineSummary item={item} />
        <PublishPlanInlineStatus item={item} />
        <Link
          to={`/products/${item.product_master.id}?tab=listings&listing_id=${item.id}`}
          className="product-inventory-action mt-2 inline-flex rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--color-primary)]"
        >
          编辑店铺 Listing
        </Link>
        <PlatformStoreProductActionStrip item={item} />
      </td>
    </tr>
  )
}

export function PublishPlanQueueBoard({ items }: { items: PlatformStoreProduct[] }) {
  const queueItems = items.filter(isPublishQueueItem)
  return (
    <section
      aria-label="发布计划队列"
      data-ui="platform-store-publish-plan-queue"
      className="product-store-board rounded-[var(--radius-xl)] p-4"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">发布计划队列</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">从批量刊登创建的本地草稿会回写到这里；平台 Open API 未接通时只显示待提交和重试指引，不显示平台发布成功。</p>
        </div>
        <Badge variant={queueItems.length ? 'warning' : 'success'}>{queueItems.length ? `待处理 ${queueItems.length}` : '无待提交'}</Badge>
      </div>
      {queueItems.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] p-5 text-center text-xs text-[var(--color-muted)]">当前筛选下没有待提交平台的本地发布计划。</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {queueItems.slice(0, 6).map(item => (
            <article key={item.id} className="product-store-group-card rounded-[var(--radius-xl)] border border-[var(--color-warning)] bg-[var(--color-warning-light)] p-3" data-ui="platform-store-publish-plan-card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="line-clamp-2 text-sm font-semibold text-[var(--color-fg)]">{item.title}</p>
                  <p className="mt-1 text-[11px] text-[var(--color-muted)]">{item.platform.toUpperCase()} · {item.store.account_name} · {item.store.market || '市场待补'}</p>
                </div>
                <Badge variant="warning">{publishQueueLabel(item.publish_plan_summary?.queue_status)}</Badge>
              </div>
              <p className="mt-2 text-[11px] text-[var(--color-warning)]">API：{item.publish_plan_summary?.platform_api_status || 'not_connected'} · 平台：{item.publish_plan_summary?.platform_publish_status || 'not_attempted'}</p>
              <OfficialPublishWritebackLine summary={item.publish_plan_summary?.official_publish_writeback} />
              <p className="mt-1 line-clamp-2 text-[11px] text-[var(--color-muted)]">{item.publish_plan_summary?.next_action || '接通平台 Open API 后再提交到目标店铺。'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link className="rounded-full border border-[var(--color-primary)] bg-[var(--color-surface)] px-2 py-1 text-[11px] text-[var(--color-primary)]" to={`/publish?platform_account_id=${item.store.id}&listing_id=${item.id}`}>
                  返回批量刊登重试
                </Link>
                <Link className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11px] text-[var(--color-muted)]" to={`/products/${item.product_master.id}?tab=listings&listing_id=${item.id}`}>
                  修正店铺 Listing
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export function ProductSyncRetryLogBoard({ logs, isError, onRetry }: { logs: SyncLogItem[]; isError: boolean; onRetry: () => void }) {
  const failedLogs = logs.filter(log => log.status === 'failed' || log.status === 'partial_failed' || (log.records_failed || 0) > 0)
  return (
    <section aria-label="商品同步失败与重试日志" data-ui="platform-product-sync-retry-log-board" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">商品同步失败与重试日志</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">只读取真实同步日志；失败项展示错误原因、错误明细数量和重试动作。</p>
        </div>
        <Button size="sm" variant="secondary" onClick={onRetry}>刷新日志</Button>
      </div>
      {isError ? (
        <p className="mt-3 rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-light)] px-3 py-2 text-xs text-[var(--color-danger)]">商品同步日志加载失败，请检查同步日志接口。</p>
      ) : failedLogs.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-[var(--color-border)] px-3 py-4 text-center text-xs text-[var(--color-muted)]">当前筛选下暂无商品同步失败日志。</p>
      ) : (
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {failedLogs.slice(0, 4).map(log => (
            <article key={log.id} className="rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-light)] p-3" data-ui="platform-product-sync-retry-log-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant={log.status === 'failed' ? 'danger' : 'warning'}>{log.status}</Badge>
                <span className="text-[11px] text-[var(--color-muted)]">日志 {log.id.slice(0, 8)}</span>
              </div>
              <p className="mt-2 text-[11px] text-[var(--color-warning)]">处理 {log.records_processed || 0} · 失败 {log.records_failed || 0} · 明细 {(log.error_details || []).length}</p>
              {log.error_message && <p className="mt-1 line-clamp-2 text-[11px] text-[var(--color-danger)]">失败原因：{log.error_message}</p>}
              {log.retry_action && <p className="mt-1 line-clamp-2 text-[11px] text-[var(--color-muted)]">重试动作：{log.retry_action}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function SyncReceiptInlineSummary({ item }: { item: PlatformStoreProduct }) {
  const receipt = item.sync_receipt_summary
  const writeback = item.field_writeback_summary
  if (!receipt) return null
  const failed = (receipt.records_failed || 0) > 0 || receipt.status === 'failed' || receipt.status === 'partial_failed'
  return (
    <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[11px]" data-ui="platform-store-product-sync-receipt-summary">
      <p className={failed ? 'font-semibold text-[var(--color-danger)]' : 'font-semibold text-[var(--color-success)]'}>
        同步回执：{productSyncStatusLabel(receipt.status)} · 原始字段 {receipt.raw_field_count ?? 0}
      </p>
      <p className="mt-0.5 text-[var(--color-muted)]">官方ID：{receipt.official_product_id || '待平台返回'} · 日志：{receipt.sync_log_id ? receipt.sync_log_id.slice(0, 8) : '无'}</p>
      {writeback && <p className="mt-0.5 text-[var(--color-muted)]" data-ui="platform-product-field-writeback-summary">字段回写：标准 {writeback.written_field_count ?? 0} · 属性 {writeback.attribute_field_count ?? 0} · 缺口 {(writeback.missing_core_fields || []).length}</p>}
      {receipt.error_message && <p className="mt-0.5 text-[var(--color-danger)]">失败原因：{receipt.error_message}</p>}
      {receipt.next_action && <p className="mt-0.5 text-[var(--color-muted)]">下一步：{receipt.next_action}</p>}
    </div>
  )
}

function PublishPlanInlineStatus({ item }: { item: PlatformStoreProduct }) {
  if (!isPublishQueueItem(item)) return null
  return (
    <div className="mt-2 rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-light)] px-2 py-1 text-[11px]" data-ui="platform-store-publish-plan-inline-status">
      <p className="font-semibold text-[var(--color-warning)]">发布计划：{publishQueueLabel(item.publish_plan_summary?.queue_status)}</p>
      <p className="mt-0.5 text-[var(--color-warning)]">API {item.publish_plan_summary?.platform_api_status || 'not_connected'} · {item.publish_plan_summary?.platform_publish_status || 'not_attempted'}</p>
      <OfficialPublishWritebackLine summary={item.publish_plan_summary?.official_publish_writeback} />
    </div>
  )
}

function OfficialPublishWritebackLine({ summary }: { summary?: PlatformStoreProduct['publish_plan_summary'] extends infer T ? T extends { official_publish_writeback?: infer W } ? W : never : never }) {
  if (!summary) return null
  return (
    <p className="mt-0.5 text-[var(--color-muted)]" data-ui="platform-store-official-publish-writeback">
      官方发布回写：字段 {summary.written_field_count ?? 0} · 返回 {summary.official_response_field_count ?? 0}
    </p>
  )
}

function InventoryAlertInlineSummary({ item }: { item: PlatformStoreProduct }) {
  const summary = item.inventory_alert_summary
  if (!summary) return null
  const variant = inventorySummaryVariant(summary.severity)
  return (
    <div
      className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[11px]"
      data-ui="platform-store-inventory-alert-summary"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={variant}>{summary.label}</Badge>
        <span className="text-[var(--color-muted)]">规则 {summary.matched_rule_count} · 未处理 {summary.open_alert_count}</span>
      </div>
      <p className="mt-1 text-[var(--color-muted)]">
        安全库存：{summary.safety_stock ?? '未配置'} · SKU：{summary.skus.slice(0, 2).join(' / ') || '待识别'}
      </p>
      {summary.data_gaps.length > 0 && (
        <p className="mt-1 text-[var(--color-warning)]">{summary.data_gaps[0]}</p>
      )}
    </div>
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
            data-ui={storeProductActionDataUi(action.label)}
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
  const listingSectionRoute = (section: string) => `${listingRoute}&listing_section=${section}`
  const mediaReadiness = item.media_readiness || {}
  const capturedImages = mediaReadiness.captured_image_count ?? item.image_count
  const minPlatformImages = mediaReadiness.min_platform_images ?? 5
  const inventorySummary = item.inventory_alert_summary
  const actions: StoreProductAction[] = []

  if (isPublishQueueItem(item)) {
    actions.push({
      label: '返回批量刊登重试',
      detail: item.publish_plan_summary?.next_action || '平台API未接通，接通后再提交',
      route: `/publish?platform_account_id=${item.store.id}&listing_id=${item.id}`,
      severity: 'warning',
    })
  }
  if (capturedImages < minPlatformImages) {
    actions.push({
      label: '补发布图素材',
      detail: `当前发布图 ${capturedImages}/${minPlatformImages} 张，进入图片槽位处理`,
      route: listingSectionRoute('media'),
      severity: 'warning',
    })
  }
  if (!item.variation_count) {
    actions.push({
      label: '补 SKU/规格',
      detail: '当前店铺 Listing 缺少 SKU 或变体规格',
      route: listingSectionRoute('sales'),
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
  if (inventorySummary && isInventoryRiskItem(item)) {
    actions.push({
      label: '处理库存预警',
      detail: `${inventorySummary.label}，进入库存预警工作台核对SKU库存`,
      route: `/inventory-alerts?platform_account_id=${item.store.id}&listing_id=${item.id}`,
      severity: 'danger',
    })
  }

  actions.push({
    label: '编辑店铺 Listing',
    detail: '修改当前店铺实例，不回写其他店铺',
    route: listingSectionRoute('basic'),
    severity: actions.length ? 'primary' : 'success',
  })
  actions.push({
    label: '维护平台商品资料',
    detail: item.platform_product_id ? '维护当前店铺实例的平台字段、类目属性和同步资料' : '先补齐平台字段，发布后再回写平台商品ID',
    route: listingSectionRoute('attributes'),
    severity: actions.length ? 'primary' : 'success',
  })
  actions.push({
    label: '查看当前 Listing',
    detail: '核对标题、图片、价格、库存和平台属性',
    route: `${listingSectionRoute('media')}#platform-listing-seller-preview`,
    severity: actions.length ? 'primary' : 'success',
  })

  return actions
}

function storeProductActionDataUi(label: string) {
  if (label === '处理库存预警') return 'platform-store-row-inventory-alert-action'
  if (label === '维护平台商品资料') return 'platform-store-row-platform-product-maintenance-action'
  return undefined
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
