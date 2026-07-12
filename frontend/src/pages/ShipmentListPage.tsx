import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Select } from '../components/ui/Select'
import { DataTable } from '../components/shared/DataTable'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'
import { useShipmentList } from '../hooks/useShipments'
import { useConfig } from '../hooks/useConfig'
import type { Column } from '../components/shared/DataTable'
import type { Shipment } from '../types/shipment'
import { getStatusMeta, toDomainOptions, withAllOption } from '../utils/domainOptions'

export default function ShipmentListPage() {
  const navigate = useNavigate()
  const { carriers = [], shipment_statuses = [] } = useConfig()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [carrier, setCarrier] = useState('')

  const { data, isLoading } = useShipmentList({
    status: status || undefined,
    carrier: carrier || undefined,
    page,
    page_size: 20,
  })

  const shipments = data?.data ?? []
  const pagination = data?.meta ?? undefined
  const carrierOptions = carriers.map(item => ({ value: item.label, label: item.label }))
  const shipmentStatusOptions = toDomainOptions(shipment_statuses)

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
      render: (row) => <span className="text-xs text-[var(--color-muted)] font-mono">{row.order_id.slice(0, 8)}...</span>,
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
