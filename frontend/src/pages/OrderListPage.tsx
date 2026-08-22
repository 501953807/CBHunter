import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useOrderList, useOrderStats } from '../hooks/useOrders'
import { useConfig } from '../hooks/useConfig'
import type { ManualOrderCreate, ManualOrderImportResult } from '../types/order'
import { ManualOrderModal } from '../features/orders/ManualOrderModal'
import { usePlatformStatuses } from '../hooks/usePlatforms'
import { importManualOrders } from '../api/orders'
import { useToast } from '../components/ui/Toast'
import { logger } from '../utils/logger'
import {
  buildOrderSearchParams,
  parseManualOrderCsv,
} from '../features/orders/OrderListUtils'
import {
  OrderImportPanel,
  OrderListHero,
  OrderListTableSection,
  OrderStatsSection,
  buildOrderListColumns,
  orderStatusFilterOptions,
} from '../features/orders/OrderListPageParts'

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
  const orderStatusOptions = orderStatusFilterOptions(order_statuses)
  const columns = buildOrderListColumns(order_statuses, platformLabelMap)

  const applyExceptionSearchParams = (nextExceptionMode: boolean) => {
    setSearchParams(buildOrderSearchParams(nextExceptionMode, platformAccountId, platform, fulfillmentExceptionStatus, syncStatus, shippingSla))
  }

  const handleImportFile = async (file: File) => {
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
  }

  const handleSubmitImport = async () => {
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
  }

  return (
    <div className="orders-shell space-y-6 page-enter">
      <OrderListHero onToggleImport={() => setImportHelpOpen((value) => !value)} onOpenManual={() => setManualOpen(true)} />

      <OrderImportPanel
        open={importHelpOpen}
        importRows={importRows}
        importResult={importResult}
        importing={importing}
        onFileChange={handleImportFile}
        onSubmit={handleSubmitImport}
      />

      <OrderStatsSection
        isError={orderStatsQuery.isError}
        stats={orderStatsQuery.data?.data || null}
        platformLabelMap={platformLabelMap}
        onRetry={() => orderStatsQuery.refetch()}
        onOpenExceptions={() => {
          setExceptionMode(true)
          applyExceptionSearchParams(true)
          setPage(1)
        }}
      />

      <OrderListTableSection
        evidence={data}
        platformAccountId={platformAccountId}
        platform={platform}
        platformStatuses={platformStatusesQuery.data?.data || []}
        hasError={orderListQuery.isError}
        onRetry={() => orderListQuery.refetch()}
        orderStatusOptions={orderStatusOptions}
        platformOptions={platformOptions}
        fulfillmentExceptionStatus={fulfillmentExceptionStatus}
        syncStatus={syncStatus}
        shippingSla={shippingSla}
        exceptionMode={exceptionMode}
        status={status}
        orders={orders}
        loading={isLoading}
        pagination={pagination}
        columns={columns}
        onStatusChange={(value) => { setStatus(value); setExceptionMode(false); setPage(1) }}
        onPlatformChange={(value) => { setPlatform(value); setPage(1) }}
        onFulfillmentExceptionChange={(value) => { setFulfillmentExceptionStatus(value); setPage(1) }}
        onSyncStatusChange={(value) => { setSyncStatus(value); setPage(1) }}
        onShippingSlaChange={(value) => { setShippingSla(value); setPage(1) }}
        onToggleExceptions={() => {
          const next = !exceptionMode
          setExceptionMode(next)
          applyExceptionSearchParams(next)
          setPage(1)
        }}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/orders/${row.id}`)}
      />
      <ManualOrderModal open={manualOpen} onClose={() => setManualOpen(false)} onCreated={() => { refetch() }} />
    </div>
  )
}
