import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Select } from '../components/ui/Select'
import { DataTable } from '../components/shared/DataTable'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'
import { StoreContextBanner } from '../components/shared/StoreContextBanner'
import { useShipmentList } from '../hooks/useShipments'
import { useConfig } from '../hooks/useConfig'
import { usePlatformStatuses } from '../hooks/usePlatforms'
import type { Column } from '../components/shared/DataTable'
import type { Shipment } from '../types/shipment'
import { getStatusMeta, toDomainOptions, withAllOption } from '../utils/domainOptions'

export default function ShipmentListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { carriers = [], shipment_statuses = [], platforms = [] } = useConfig()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [carrier, setCarrier] = useState('')
  const [platform, setPlatform] = useState(searchParams.get('platform') || '')
  const platformAccountId = searchParams.get('platform_account_id') || ''
  const platformStatusesQuery = usePlatformStatuses()

  const { data, isLoading } = useShipmentList({
    status: status || undefined,
    carrier: carrier || undefined,
    platform: platform || undefined,
    platform_account_id: platformAccountId || undefined,
    page,
    page_size: 20,
  })

  const shipments = data?.data ?? []
  const pagination = data?.meta ?? undefined
  const carrierOptions = carriers.map(item => ({ value: item.label, label: item.label }))
  const shipmentStatusOptions = toDomainOptions(shipment_statuses)
  const platformLabelMap = new Map(platforms.map(item => [item.id, item.label]))
  const platformOptions = [
    { value: '', label: '全部平台' },
    ...platforms.map(item => ({ value: item.id, label: item.label })),
  ]

  const columns: Column<Shipment>[] = [
    {
      key: 'tracking_number',
      header: '运单号',
      width: '160px',
      render: (row) => (
        <span className="font-mono text-sm">{row.tracking_number || '--'}</span>
      ),
    },
    {
      key: 'carrier',
      header: '承运商',
      width: '100px',
    },
    {
      key: 'platform',
      header: '平台/店铺',
      width: '150px',
      render: (row) => (
        <div>
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
          >
            {platformLabelMap.get(row.platform || '') || row.platform?.toUpperCase() || '--'}
          </span>
          <p className="mt-1 line-clamp-1 text-[11px] text-[var(--color-muted)]">{row.platform_account_name || '店铺待补'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: '状态',
      width: '100px',
      render: (row) => {
        const badge = getStatusMeta(shipment_statuses, row.status)
        return <Badge variant={badge.variant}>{badge.label}</Badge>
      },
    },
    {
      key: 'destination_address',
      header: '目的地',
      render: (row) => row.destination_address?.country || row.destination_address?.market || '--',
    },
    {
      key: 'shipping_cost',
      header: '运费',
      width: '90px',
      render: (row) => (row.shipping_cost != null ? `¥${row.shipping_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '--'),
    },
    {
      key: 'order_id',
      header: '关联订单',
      render: (row) => (
        <div>
          <p className="font-mono text-sm text-[var(--color-fg)]">{row.order_number || `${row.order_id.slice(0, 8)}...`}</p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">{row.buyer_name || '买家待补'}</p>
        </div>
      ),
    },
    {
      key: 'fulfillment_deadline_at',
      header: '发货时限',
      width: '160px',
      render: (row) => (
        <div>
          <Badge variant={shipmentFulfillmentVariant(row.fulfillment_exception?.severity)}>
            {row.fulfillment_exception?.status === 'shipping_overdue' ? '已超期' : row.fulfillment_exception?.status === 'shipping_due_soon' ? '临近时限' : '履约跟踪'}
          </Badge>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">
            {row.fulfillment_deadline_at ? new Date(row.fulfillment_deadline_at).toLocaleString('zh-CN') : '平台时限待同步'}
          </p>
        </div>
      ),
    },
    {
      key: 'created_at',
      header: '创建时间',
      width: '160px',
      render: (row) => row.created_at ? new Date(row.created_at).toLocaleString('zh-CN') : '--',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">物流管理</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">发货与物流追踪</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <EvidenceBanner evidence={data} compact />
          <StoreContextBanner
            platformAccountId={platformAccountId}
            platform={platform}
            statuses={platformStatusesQuery.data?.data || []}
            currentModule="shipments"
            clearHref="/shipments"
          />
          <div className="flex items-center gap-3 mb-4">
            <Select
              options={withAllOption('全部状态', shipmentStatusOptions)}
              value={status}
              onChange={(v) => { setStatus(v); setPage(1) }}
              className="w-36"
            />
            <Select
              options={withAllOption('全部承运商', carrierOptions)}
              value={carrier}
              onChange={(v) => { setCarrier(v); setPage(1) }}
              className="w-36"
            />
            <Select
              options={platformOptions}
              value={platform}
              onChange={(v) => { setPlatform(v); setPage(1) }}
              className="w-32"
            />
          </div>

          <DataTable
            columns={columns}
            data={shipments}
            keyField="id"
            loading={isLoading}
            emptyMessage="暂无物流记录，从订单页创建物流"
            pagination={pagination}
            onPageChange={setPage}
            onRowClick={(row) => navigate(`/shipments/${row.id}`)}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function shipmentFulfillmentVariant(value?: string | null) {
  if (value === 'critical') return 'danger'
  if (value === 'warning') return 'warning'
  if (value === 'clear') return 'success'
  return 'outline'
}
