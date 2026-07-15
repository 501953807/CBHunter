import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Select } from '../components/ui/Select'
import { DataTable } from '../components/shared/DataTable'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'
import { useOrderList } from '../hooks/useOrders'
import { useConfig } from '../hooks/useConfig'
import type { Column } from '../components/shared/DataTable'
import type { OrderListRow } from '../types/order'
import { getExceptionStatuses, getStatusMeta, toDomainOptions, withAllOption } from '../utils/domainOptions'
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

  const effectiveStatus = exceptionMode ? getExceptionStatuses(order_statuses).join(',') || undefined : status || undefined

  const { data, isLoading, refetch } = useOrderList({
    status: effectiveStatus,
    platform: platform || undefined,
    platform_account_id: platformAccountId || undefined,
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
