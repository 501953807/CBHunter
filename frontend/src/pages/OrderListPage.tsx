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
import type { OrderFulfillmentStats, OrderListRow } from '../types/order'
import { getStatusMeta, toDomainOptions, withAllOption } from '../utils/domainOptions'
import { ManualOrderModal } from '../features/orders/ManualOrderModal'
import { Plus } from 'lucide-react'
import { StoreContextBanner } from '../components/shared/StoreContextBanner'
import { usePlatformStatuses } from '../hooks/usePlatforms'

export default function OrderListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { platforms, order_statuses = [] } = useConfig()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [platform, setPlatform] = useState(searchParams.get('platform') || '')
  const platformAccountId = searchParams.get('platform_account_id') || ''
  const [exceptionMode, setExceptionMode] = useState(searchParams.get('exceptions') === '1')
  const [manualOpen, setManualOpen] = useState(false)
  const platformStatusesQuery = usePlatformStatuses()
  const orderStatsQuery = useOrderStats()

  const { data, isLoading, refetch } = useOrderList({
    status: exceptionMode ? undefined : status || undefined,
    platform: platform || undefined,
    platform_account_id: platformAccountId || undefined,
    exceptions: exceptionMode ? '1' : undefined,
    page,
    page_size: 20,
  })

  const orders = data?.data ?? []
  const pagination = data?.meta ?? undefined
  const platformOptions = [
    { value: '', label: '全部平台' },
    ...platforms.map(p => ({ value: p.id, label: p.label })),
  ]
  const platformLabelMap = new Map(platforms.map(p => [p.id, p.label]))
  const orderStatusOptions = toDomainOptions(order_statuses)

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
      render: (row) => <Badge variant={row.source === 'manual' ? 'warning' : 'outline'}>{row.source === 'manual' ? '手工录入' : '平台数据'}</Badge>,
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
        <Button onClick={() => setManualOpen(true)}><Plus className="h-4 w-4" />手工创建订单</Button>
      </div>

      <OrderFulfillmentOverview
        stats={orderStatsQuery.data?.data || null}
        platformLabelMap={platformLabelMap}
        onOpenExceptions={() => {
          setExceptionMode(true)
          setSearchParams(buildOrderSearchParams(true, platformAccountId, platform))
          setPage(1)
        }}
      />

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
          <div className="flex items-center gap-3 mb-4">
            <Select
              options={withAllOption('全部状态', orderStatusOptions)}
              value={exceptionMode ? '' : status}
              onChange={(v) => { setStatus(v); setExceptionMode(false); setPage(1) }}
              className="w-36"
            />
            <Select
              options={platformOptions}
              value={platform}
              onChange={(v) => { setPlatform(v); setPage(1) }}
              className="w-32"
            />
            <Button
              variant={exceptionMode ? 'primary' : 'secondary'}
              size="sm"
              aria-pressed={exceptionMode}
              onClick={() => {
                const next = !exceptionMode
                setExceptionMode(next)
                setSearchParams(buildOrderSearchParams(next, platformAccountId, platform))
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

function buildOrderSearchParams(exceptionMode: boolean, platformAccountId: string, platform: string) {
  const params: Record<string, string> = {}
  if (exceptionMode) params.exceptions = '1'
  if (platformAccountId) params.platform_account_id = platformAccountId
  if (platform) params.platform = platform
  return params
}

function orderListText(value?: string | null) {
  if (!value) return '待补'
  if (value === 'none') return '无'
  return value
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
