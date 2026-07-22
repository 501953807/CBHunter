import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Select } from '../components/ui/Select'
import { DataTable } from '../components/shared/DataTable'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'
import { useOrderList, useOrderStats } from '../hooks/useOrders'
import { useConfig } from '../hooks/useConfig'
import type { Column } from '../components/shared/DataTable'
import type { ManualOrderCreate, ManualOrderImportResult, OrderFulfillmentStats, OrderListRow } from '../types/order'
import { getStatusMeta, toDomainOptions, withAllOption } from '../utils/domainOptions'
import { ManualOrderModal } from '../features/orders/ManualOrderModal'
import { Plus } from 'lucide-react'
import { StoreContextBanner } from '../components/shared/StoreContextBanner'
import { usePlatformStatuses } from '../hooks/usePlatforms'
import { importManualOrders } from '../api/orders'
import { useToast } from '../components/ui/Toast'
import { logger } from '../utils/logger'

export default function OrderListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { platforms, order_statuses = [] } = useConfig()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [platform, setPlatform] = useState(searchParams.get('platform') || '')
  const platformAccountId = searchParams.get('platform_account_id') || ''
  const [exceptionMode, setExceptionMode] = useState(searchParams.get('exceptions') === '1')
  const [fulfillmentExceptionStatus, setFulfillmentExceptionStatus] = useState(searchParams.get('fulfillment_exception_status') || '')
  const [syncStatus, setSyncStatus] = useState(searchParams.get('sync_status') || '')
  const [shippingSla, setShippingSla] = useState(searchParams.get('shipping_sla') || '')
  const [manualOpen, setManualOpen] = useState(false)
  const [importHelpOpen, setImportHelpOpen] = useState(false)
  const [importRows, setImportRows] = useState<ManualOrderCreate[]>([])
  const [importFileName, setImportFileName] = useState('')
  const [importResult, setImportResult] = useState<ManualOrderImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const toast = useToast()
  const platformStatusesQuery = usePlatformStatuses()
  const orderStatsQuery = useOrderStats()

  const orderListQuery = useOrderList({
    status: exceptionMode ? undefined : status || undefined,
    platform: platform || undefined,
    platform_account_id: platformAccountId || undefined,
    exceptions: exceptionMode ? '1' : undefined,
    fulfillment_exception_status: fulfillmentExceptionStatus || undefined,
    sync_status: syncStatus || undefined,
    shipping_sla: shippingSla || undefined,
    page,
    page_size: 20,
  })

  const { data, isLoading, refetch } = orderListQuery
  const orders = data?.data ?? []
  const pagination = data?.meta ?? undefined
  const platformOptions = [
    { value: '', label: '全部平台' },
    ...platforms.map(p => ({ value: p.id, label: p.label })),
  ]
  const platformLabelMap = new Map(platforms.map(p => [p.id, p.label]))
  const orderStatusOptions = toDomainOptions(order_statuses)
  const fulfillmentExceptionOptions = [
    { value: '', label: '全部履约状态' },
    { value: 'shipping_overdue', label: '发货超期' },
    { value: 'shipping_due_soon', label: '临近时限' },
    { value: 'logistics_missing', label: '物流待补' },
    { value: 'sync_required', label: '同步待补' },
    { value: 'after_sales_open', label: '售后处理中' },
    { value: 'clear', label: '正常' },
  ]
  const syncStatusOptions = [
    { value: '', label: '全部同步状态' },
    { value: 'synced', label: '已同步' },
    { value: 'sync_failed', label: '同步异常' },
    { value: 'manual_not_synced', label: '手工未同步' },
    { value: 'not_synced', label: '未同步' },
  ]
  const shippingSlaOptions = [
    { value: '', label: '全部发货时效' },
    { value: 'overdue', label: '已超期' },
    { value: 'due_soon', label: '12小时内临近' },
    { value: 'within_24h', label: '24小时内到期' },
    { value: 'missing_deadline', label: '缺发货时限' },
  ]

  const columns: Column<OrderListRow>[] = [
    {
      key: 'order_number',
      header: '订单号',
      width: '180px',
      render: (row) => (
        <span className="font-mono text-sm">{row.order_number || row.id.slice(0, 8)}</span>
      ),
    },
    {
      key: 'platform',
      header: '平台/店铺',
      width: '150px',
      render: (row) => (
        <div>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
          >
            {platformLabelMap.get(row.platform) || row.platform.toUpperCase() || '--'}
          </span>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">{row.platform_account_name || '店铺未命名'}</p>
        </div>
      ),
    },
    {
      key: 'source',
      header: '来源',
      width: '90px',
      render: (row) => <Badge variant={row.source === 'manual' || row.source === 'manual_import' ? 'warning' : 'outline'}>{orderSourceLabel(row.source)}</Badge>,
    },
    {
      key: 'status',
      header: '状态',
      width: '100px',
      render: (row) => {
        const badge = getStatusMeta(order_statuses, row.status)
        return <Badge variant={badge.variant}>{badge.label}</Badge>
      },
    },
    {
      key: 'buyer_name',
      header: '商品/买家',
      width: '130px',
      render: (row) => (
        <div>
          <p className="text-[var(--color-fg)]">{row.item_count ? `${row.item_count} 件商品` : '商品待补'}</p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">{row.buyer_name || '买家待补'}</p>
        </div>
      ),
    },
    {
      key: 'total',
      header: '金额',
      width: '100px',
      render: (row) => `${row.currency} ${row.total.toFixed(2)}`,
    },
    {
      key: 'ordered_at',
      header: '下单时间',
      width: '160px',
      render: (row) => row.ordered_at ? new Date(row.ordered_at).toLocaleString('zh-CN') : '--',
    },
    {
      key: 'fulfillment_deadline_at',
      header: '履约异常',
      width: '170px',
      render: (row) => (
        <div>
          <Badge variant={fulfillmentBadgeVariant(row.fulfillment_exception?.severity)}>
            {fulfillmentStatusLabel(row.fulfillment_exception?.status)}
          </Badge>
          <p className="mt-1 line-clamp-1 text-[11px] text-[var(--color-muted)]">
            {(row.fulfillment_exception?.reasons || [])[0]
              || (row.fulfillment_deadline_at ? `时限 ${new Date(row.fulfillment_deadline_at).toLocaleString('zh-CN')}` : '履约信息待平台同步')}
          </p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">{shippingSlaLabel(row.fulfillment_exception?.hours_to_deadline)}</p>
        </div>
      ),
    },
    {
      key: 'logistics_channel',
      header: '物流/售后',
      width: '150px',
      render: (row) => (
        <div>
          <p className="text-[var(--color-fg)]">{row.logistics_channel || '物流待补'}</p>
          <p className="mt-1 text-[11px]" style={{ color: row.after_sales_status && row.after_sales_status !== 'none' ? 'var(--color-warning)' : 'var(--color-muted)' }}>
            售后：{orderListText(row.after_sales_status)}
          </p>
        </div>
      ),
    },
    {
      key: 'financial_reconciliation_status',
      header: '对账',
      width: '110px',
      render: (row) => (
        <Badge variant={row.financial_reconciliation_status === 'bill_imported' || row.financial_reconciliation_status === 'reconciled' ? 'success' : 'warning'}>
          {reconciliationLabel(row.financial_reconciliation_status)}
        </Badge>
      ),
    },
    {
      key: 'platform_sync_status',
      header: '同步复盘',
      width: '150px',
      render: (row) => (
        <div>
          <Badge variant={syncBadgeVariant(row.platform_sync_status?.status)}>
            {syncStatusLabel(row.platform_sync_status?.status)}
          </Badge>
          <p className="mt-1 line-clamp-1 text-[11px] text-[var(--color-muted)]">
            {row.platform_sync_status?.latest_store_sync?.completed_at
              ? `店铺同步 ${new Date(row.platform_sync_status.latest_store_sync.completed_at).toLocaleString('zh-CN')}`
              : row.platform_sync_status?.message || '同步记录待补'}
          </p>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">订单跟踪</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>跨平台统一订单管理</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setImportHelpOpen((value) => !value)}>CSV/Excel批量导入</Button>
          <Button onClick={() => setManualOpen(true)}><Plus className="h-4 w-4" />手工创建订单</Button>
        </div>
      </div>

      {importHelpOpen && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-fg)]">订单导入模板字段</h2>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  平台 Open API 未接通时，可先按模板整理 Shopee、TEMU、TikTok Shop 卖家后台导出的订单；当前支持 CSV 文件解析并写入本地订单，Excel 文件请先另存为 CSV 后导入。
                </p>
              </div>
              <Badge variant={importRows.length ? 'success' : 'outline'}>
                {importRows.length ? `已解析 ${importRows.length} 个订单` : 'CSV 本地导入'}
              </Badge>
            </div>
            <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
              {[
                'platform_account_id / merchant_order_number / ordered_at',
                'buyer_name / shipping_address / logistics_channel / fulfillment_deadline_at',
                'currency / total / shipping_fee / platform_fee / discount',
                'payment_status / payment_method / fulfillment_status',
                'items[].name / items[].sku / items[].quantity / items[].unit_price',
                'notes / source_file / import_ref',
              ].map((field) => (
                <span key={field} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-muted)]">
                  {field}
                </span>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <label className="text-xs font-medium text-[var(--color-fg)]">
                  选择 CSV 文件
                  <input
                    className="mt-2 block w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted)]"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={async (event) => {
                      const file = event.target.files?.[0]
                      if (!file) return
                      try {
                        const text = await file.text()
                        const parsed = parseManualOrderCsv(text)
                        setImportRows(parsed)
                        setImportFileName(file.name)
                        setImportResult(null)
                      } catch (error: any) {
                        logger.error('parse manual order csv failed', error)
                        toast.addToast('error', error?.message || 'CSV 解析失败，请检查表头和必填字段')
                      }
                    }}
                  />
                </label>
                <Button
                  disabled={!importRows.length || importing}
                  onClick={async () => {
                    if (!importRows.length) return
                    setImporting(true)
                    try {
                      const response = await importManualOrders({
                        rows: importRows,
                        import_ref: `order-import-${Date.now()}`,
                        source_file: importFileName || null,
                      })
                      setImportResult(response.data || null)
                      refetch()
                      orderStatsQuery.refetch()
                      toast.addToast('success', `导入完成：新增 ${response.data?.created_count || 0} 单，跳过 ${response.data?.skipped_count || 0} 单`)
                    } catch (error: any) {
                      logger.error('import manual orders failed', error)
                      toast.addToast('error', error?.response?.data?.detail || '订单导入失败')
                    } finally {
                      setImporting(false)
                    }
                  }}
                >
                  {importing ? '导入中...' : '提交导入'}
                </Button>
              </div>
              {importResult && (
                <div className="mt-3 grid gap-2 text-xs md:grid-cols-4">
                  <span className="rounded-xl bg-[var(--color-bg)] px-3 py-2">接收 {importResult.received_count} 单</span>
                  <span className="rounded-xl bg-[var(--color-bg)] px-3 py-2">新增 {importResult.created_count} 单</span>
                  <span className="rounded-xl bg-[var(--color-bg)] px-3 py-2">跳过 {importResult.skipped_count} 单</span>
                  <span className="rounded-xl bg-[var(--color-bg)] px-3 py-2">失败 {importResult.failed_count} 单</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {orderStatsQuery.isError ? (
        <Card>
          <CardContent className="pt-4">
            <div
              data-ui="order-stats-error"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-danger)] bg-[var(--color-danger-light)] px-3 py-2 text-xs"
            >
              <span className="text-[var(--color-danger)]">履约统计加载失败，无法判断当前平台/店铺的待发货、临近超期和售后风险。</span>
              <Button size="sm" variant="secondary" onClick={() => orderStatsQuery.refetch()}>
                重新加载履约统计
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <OrderFulfillmentOverview
          stats={orderStatsQuery.data?.data || null}
          platformLabelMap={platformLabelMap}
          onOpenExceptions={() => {
            setExceptionMode(true)
            setSearchParams(buildOrderSearchParams(true, platformAccountId, platform, fulfillmentExceptionStatus, syncStatus, shippingSla))
            setPage(1)
          }}
        />
      )}

      <Card>
        <CardContent className="pt-4">
          <EvidenceBanner evidence={data} compact />
          <StoreContextBanner
            platformAccountId={platformAccountId}
            platform={platform}
            statuses={platformStatusesQuery.data?.data || []}
            currentModule="orders"
            clearHref="/orders"
          />
          {orderListQuery.isError && (
            <div
              data-ui="order-list-error"
              className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-danger)] bg-[var(--color-danger-light)] px-3 py-2 text-xs"
            >
              <span className="text-[var(--color-danger)]">订单列表加载失败，当前筛选条件下的订单、履约异常和同步复盘暂不可用。</span>
              <Button size="sm" variant="secondary" onClick={() => orderListQuery.refetch()}>
                重新加载订单列表
              </Button>
            </div>
          )}
          <div
            data-ui="order-fulfillment-filter-bar"
            className="mb-4 grid gap-3 lg:grid-cols-[minmax(130px,0.8fr)_minmax(130px,0.8fr)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_auto]"
          >
            <Select
              options={withAllOption('全部状态', orderStatusOptions)}
              value={exceptionMode ? '' : status}
              onChange={(v) => { setStatus(v); setExceptionMode(false); setPage(1) }}
            />
            <Select
              options={platformOptions}
              value={platform}
              onChange={(v) => { setPlatform(v); setPage(1) }}
            />
            <Select
              options={fulfillmentExceptionOptions}
              value={fulfillmentExceptionStatus}
              onChange={(v) => { setFulfillmentExceptionStatus(v); setPage(1) }}
            />
            <Select
              options={syncStatusOptions}
              value={syncStatus}
              onChange={(v) => { setSyncStatus(v); setPage(1) }}
            />
            <Select
              options={shippingSlaOptions}
              value={shippingSla}
              onChange={(v) => { setShippingSla(v); setPage(1) }}
            />
            <Button
              variant={exceptionMode ? 'primary' : 'secondary'}
              size="sm"
              aria-pressed={exceptionMode}
              onClick={() => {
                const next = !exceptionMode
                setExceptionMode(next)
                setSearchParams(buildOrderSearchParams(next, platformAccountId, platform, fulfillmentExceptionStatus, syncStatus, shippingSla))
                setPage(1)
              }}
            >
              仅异常订单
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={orders}
            keyField="id"
            loading={isLoading}
            emptyMessage="暂无订单；可同步平台数据，或在平台 API 未接入时手工创建订单"
            pagination={pagination}
            onPageChange={setPage}
            onRowClick={(row) => navigate(`/orders/${row.id}`)}
            selectedIds={undefined}
          />
        </CardContent>
      </Card>
      <ManualOrderModal open={manualOpen} onClose={() => setManualOpen(false)} onCreated={() => { refetch() }} />
    </div>
  )
}

function OrderFulfillmentOverview({
  stats,
  platformLabelMap,
  onOpenExceptions,
}: {
  stats: OrderFulfillmentStats | null
  platformLabelMap: Map<string, string>
  onOpenExceptions: () => void
}) {
  const fulfillment = stats?.fulfillment
  const totalRisk = (fulfillment?.overdue || 0) + (fulfillment?.due_soon || 0) + (fulfillment?.logistics_missing || 0) + (fulfillment?.after_sales_open || 0)
  return (
    <section aria-label="订单履约运营总览" className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">Fulfillment Command</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--color-fg)]">履约运营总览</h2>
              <p className="mt-1 text-xs text-[var(--color-muted)]">按真实订单状态、平台发货时限、物流渠道和售后状态聚合；缺失字段进入数据缺口。</p>
            </div>
            <Button size="sm" variant={totalRisk ? 'primary' : 'secondary'} onClick={onOpenExceptions}>
              查看异常订单
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <FulfillmentMetric label="待发货" value={fulfillment?.pending_shipment || 0} detail="未进入已发货/完成状态" tone="warning" />
            <FulfillmentMetric label="已发货/完成" value={fulfillment?.shipped || 0} detail="已发货、运输中、已送达或完成" tone="success" />
            <FulfillmentMetric label="临近超期" value={fulfillment?.due_soon || 0} detail="距平台发货时限不足 12 小时" tone="warning" />
            <FulfillmentMetric label="已超期" value={fulfillment?.overdue || 0} detail="超过平台发货 SLA" tone="danger" />
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <FulfillmentMetric label="物流待补" value={fulfillment?.logistics_missing || 0} detail="缺物流渠道或发货记录" tone="warning" compact />
            <FulfillmentMetric label="售后处理中" value={fulfillment?.after_sales_open || 0} detail="退款/退货/争议待跟进" tone="warning" compact />
            <FulfillmentMetric label="同步待补" value={fulfillment?.sync_required || 0} detail="缺平台订单同步时间" tone="info" compact />
            <FulfillmentMetric label="时限缺口" value={fulfillment?.missing_deadline || 0} detail="缺平台发货时限" tone="info" compact />
          </div>
          {(stats?.data_gaps || []).length > 0 && (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-muted)]">
              数据缺口：{stats?.data_gaps.join('、')}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 pt-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">平台/店铺履约分布</h3>
            <p className="mt-1 text-xs text-[var(--color-muted)]">用于判断哪个平台、哪个店铺正在积压待发货或超期订单。</p>
          </div>
          <div className="space-y-2">
            {(stats?.store_breakdown || []).slice(0, 4).map(store => (
              <div key={store.platform_account_id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-fg)]">{store.platform_account_name}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">{platformLabelMap.get(store.platform) || store.platform.toUpperCase()} · {store.total_orders} 单</p>
                  </div>
                  <Badge variant={store.overdue ? 'danger' : store.due_soon ? 'warning' : 'success'}>
                    {store.overdue ? `${store.overdue} 超期` : store.due_soon ? `${store.due_soon} 临近` : '正常'}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <span className="rounded-xl bg-[var(--color-surface)] px-2 py-1 text-[var(--color-muted)]">待发 {store.pending_shipment}</span>
                  <span className="rounded-xl bg-[var(--color-surface)] px-2 py-1 text-[var(--color-muted)]">已发 {store.shipped}</span>
                  <span className="rounded-xl bg-[var(--color-surface)] px-2 py-1 text-[var(--color-muted)]">风险 {store.due_soon + store.overdue}</span>
                </div>
              </div>
            ))}
            {!stats?.store_breakdown?.length && (
              <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-muted)]">
                暂无订单履约统计；同步平台订单或创建手工订单后展示店铺分布。
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function FulfillmentMetric({
  label,
  value,
  detail,
  tone,
  compact,
}: {
  label: string
  value: number
  detail: string
  tone: 'success' | 'warning' | 'danger' | 'info'
  compact?: boolean
}) {
  const color = tone === 'danger'
    ? 'var(--color-danger)'
    : tone === 'warning'
      ? 'var(--color-warning)'
      : tone === 'success'
        ? 'var(--color-success)'
        : 'var(--color-info)'
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className={compact ? 'mt-1 text-xl font-semibold' : 'mt-2 text-3xl font-bold'} style={{ color }}>{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-[var(--color-muted)]">{detail}</p>
    </div>
  )
}

function buildOrderSearchParams(
  exceptionMode: boolean,
  platformAccountId: string,
  platform: string,
  fulfillmentExceptionStatus = '',
  syncStatus = '',
  shippingSla = '',
) {
  const params: Record<string, string> = {}
  if (exceptionMode) params.exceptions = '1'
  if (platformAccountId) params.platform_account_id = platformAccountId
  if (platform) params.platform = platform
  if (fulfillmentExceptionStatus) params.fulfillment_exception_status = fulfillmentExceptionStatus
  if (syncStatus) params.sync_status = syncStatus
  if (shippingSla) params.shipping_sla = shippingSla
  return params
}

function parseManualOrderCsv(csvText: string): ManualOrderCreate[] {
  const rows = splitCsvRows(csvText.trim())
  if (rows.length < 2) {
    throw new Error('CSV 至少需要表头和一行订单数据')
  }
  const headers = rows[0].map((header) => header.trim())
  const required = ['platform_account_id', 'merchant_order_number', 'ordered_at', 'currency', 'total', 'item_name', 'item_quantity', 'item_unit_price']
  const missing = required.filter((field) => !headers.includes(field))
  if (missing.length) {
    throw new Error(`CSV 缺少必填字段：${missing.join(', ')}`)
  }
  const orders = new Map<string, ManualOrderCreate>()
  rows.slice(1).forEach((values) => {
    if (!values.some((value) => value.trim())) return
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || ''])) as Record<string, string>
    const key = `${row.platform_account_id}::${row.merchant_order_number}`
    const item = {
      name: row.item_name,
      sku: row.item_sku || null,
      quantity: toPositiveInt(row.item_quantity),
      unit_price: toNonNegativeNumber(row.item_unit_price),
    }
    const existing = orders.get(key)
    if (existing) {
      existing.items.push(item)
      return
    }
    orders.set(key, {
      platform_account_id: row.platform_account_id,
      merchant_order_number: row.merchant_order_number,
      status: row.status || 'pending',
      buyer_name: row.buyer_name || null,
      shipping_address: row.shipping_address ? { raw: row.shipping_address, source: 'csv_import' } : null,
      shipping_fee: toOptionalNumber(row.shipping_fee),
      platform_fee: toOptionalNumber(row.platform_fee),
      discount: toOptionalNumber(row.discount),
      currency: (row.currency || 'CNY').toUpperCase(),
      total: toNonNegativeNumber(row.total),
      payment_status: row.payment_status || null,
      payment_method: row.payment_method || null,
      fulfillment_status: row.fulfillment_status || null,
      fulfillment_deadline_at: row.fulfillment_deadline_at || null,
      logistics_channel: row.logistics_channel || null,
      ordered_at: row.ordered_at,
      notes: row.notes || null,
      items: [item],
    })
  })
  return Array.from(orders.values())
}

function splitCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let current = ''
  let row: string[] = []
  let inQuotes = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (char === '"' && next === '"') {
      current += '"'
      index += 1
      continue
    }
    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (char === ',' && !inQuotes) {
      row.push(current)
      current = ''
      continue
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1
      row.push(current)
      rows.push(row)
      row = []
      current = ''
      continue
    }
    current += char
  }
  row.push(current)
  rows.push(row)
  return rows.filter((item) => item.some((value) => value.trim()))
}

function toOptionalNumber(value?: string) {
  if (!value) return null
  return toNonNegativeNumber(value)
}

function toNonNegativeNumber(value?: string) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`数值字段不合法：${value || ''}`)
  }
  return number
}

function toPositiveInt(value?: string) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`数量字段不合法：${value || ''}`)
  }
  return number
}

function orderListText(value?: string | null) {
  if (!value) return '待补'
  if (value === 'none') return '无'
  return value
}

function orderSourceLabel(value?: string | null) {
  if (value === 'manual_import') return '批量导入'
  if (value === 'manual') return '手工录入'
  return '平台数据'
}

function reconciliationLabel(value?: string | null) {
  if (value === 'bill_imported') return '已导入账单'
  if (value === 'reconciled') return '已对账'
  return '待对账'
}

function syncStatusLabel(value?: string | null) {
  if (value === 'synced') return '已同步'
  if (value === 'sync_failed') return '同步异常'
  if (value === 'manual_not_synced') return '手工未同步'
  if (value === 'not_synced') return '未同步'
  return '待确认'
}

function syncBadgeVariant(value?: string | null) {
  if (value === 'synced') return 'success'
  if (value === 'sync_failed') return 'danger'
  if (value === 'manual_not_synced' || value === 'not_synced') return 'warning'
  return 'outline'
}

function fulfillmentStatusLabel(value?: string | null) {
  if (value === 'shipping_overdue') return '发货超期'
  if (value === 'shipping_due_soon') return '临近时限'
  if (value === 'after_sales_open') return '售后处理中'
  if (value === 'logistics_missing') return '物流待补'
  if (value === 'sync_required') return '同步待补'
  if (value === 'clear') return '正常'
  return '待确认'
}

function fulfillmentBadgeVariant(value?: string | null) {
  if (value === 'critical') return 'danger'
  if (value === 'warning') return 'warning'
  if (value === 'clear') return 'success'
  return 'outline'
}

function shippingSlaLabel(hours?: number | null) {
  if (hours == null || Number.isNaN(Number(hours))) return '发货时限待补'
  if (hours < 0) return `已超期 ${Math.abs(hours).toFixed(1)} 小时`
  if (hours <= 12) return `距发货截止 ${hours.toFixed(1)} 小时`
  if (hours <= 24) return `24小时内到期：${hours.toFixed(1)} 小时`
  return `距发货截止 ${hours.toFixed(1)} 小时`
}
