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
import type { ManualOrderCreate, ManualOrderImportResult, OrderListRow } from '../types/order'
import { getStatusMeta, toDomainOptions, withAllOption } from '../utils/domainOptions'
import { ManualOrderModal } from '../features/orders/ManualOrderModal'
import { Plus } from 'lucide-react'
import { StoreContextBanner } from '../components/shared/StoreContextBanner'
import { usePlatformStatuses } from '../hooks/usePlatforms'
import { importManualOrders } from '../api/orders'
import { useToast } from '../components/ui/Toast'
import { logger } from '../utils/logger'
import { OrderFulfillmentOverview } from '../features/orders/OrderFulfillmentOverview'
import {
  buildOrderSearchParams,
  fulfillmentBadgeVariant,
  fulfillmentStatusLabel,
  orderListText,
  orderSourceLabel,
  parseManualOrderCsv,
  reconciliationLabel,
  shippingSlaLabel,
  syncBadgeVariant,
  syncStatusLabel,
} from '../features/orders/OrderListUtils'

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
          <span className="orders-platform-badge inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
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
    <div className="orders-shell space-y-6 page-enter">
      <div className="orders-hero rounded-[var(--radius-2xl)] px-5 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="luxury-section-kicker">order fulfillment</p>
          <h1 className="luxury-page-title mt-1">订单履约</h1>
          <p className="luxury-page-description mt-2">统一跟踪 Shopee、TEMU、TikTok Shop 店铺订单、发货时限、物流售后、同步复盘和财务对账状态。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setImportHelpOpen((value) => !value)}>CSV/Excel批量导入</Button>
          <Button onClick={() => setManualOpen(true)}><Plus className="h-4 w-4" />手工创建订单</Button>
        </div>
        </div>
      </div>

      {importHelpOpen && (
        <Card className="orders-import-panel">
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
                <span key={field} className="orders-import-chip rounded-[var(--radius-lg)] px-3 py-2 text-[var(--color-muted)]">
                  {field}
                </span>
              ))}
            </div>
            <div className="orders-gap-panel mt-4 rounded-[var(--radius-xl)] p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <label className="text-xs font-medium text-[var(--color-fg)]">
                  选择 CSV 文件
                  <input
                    className="luxury-input mt-2 block w-full rounded-[var(--radius-lg)] px-3 py-2 text-xs"
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
                  <span className="orders-result-tile rounded-[var(--radius-lg)] px-3 py-2">接收 {importResult.received_count} 单</span>
                  <span className="orders-result-tile rounded-[var(--radius-lg)] px-3 py-2">新增 {importResult.created_count} 单</span>
                  <span className="orders-result-tile rounded-[var(--radius-lg)] px-3 py-2">跳过 {importResult.skipped_count} 单</span>
                  <span className="orders-result-tile rounded-[var(--radius-lg)] px-3 py-2">失败 {importResult.failed_count} 单</span>
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
              className="orders-error-panel flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-xl)] px-3 py-2 text-xs"
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

      <Card className="orders-table-panel">
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
              className="orders-error-panel mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-xl)] px-3 py-2 text-xs"
            >
              <span className="text-[var(--color-danger)]">订单列表加载失败，当前筛选条件下的订单、履约异常和同步复盘暂不可用。</span>
              <Button size="sm" variant="secondary" onClick={() => orderListQuery.refetch()}>
                重新加载订单列表
              </Button>
            </div>
          )}
          <div
            data-ui="order-fulfillment-filter-bar"
            className="orders-filter-grid mb-4 grid gap-3 rounded-[var(--radius-xl)] p-3 lg:grid-cols-[minmax(130px,0.8fr)_minmax(130px,0.8fr)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_auto]"
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
