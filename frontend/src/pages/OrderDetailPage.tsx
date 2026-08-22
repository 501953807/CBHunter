import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/shared/LoadingSkeleton'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'
import { useOrder, useUpdateOrderStatus, useUpdateOrderNotes } from '../hooks/useOrders'
import { useShipmentList } from '../hooks/useShipments'
import { useTriggerSync } from '../hooks/useSync'
import { useConfig } from '../hooks/useConfig'
import { getAllowedNextStatuses, getStatusMeta } from '../utils/domainOptions'
import {
  OrderActionsPanel,
  OrderDetailHero,
  OrderFeeSummaryPanel,
  OrderFinanceEntryPanel,
  OrderFulfillmentExceptionPanel,
  OrderItemsPanel,
  OrderManualSourceWarning,
  OrderNotesPanel,
  OrderPlatformFeeBreakdownPanel,
  OrderPlatformSyncReviewPanel,
  OrderShippingAddressPanel,
  OrderTimelinePanel,
  RelatedShipmentsPanel,
} from '../features/orders/OrderDetailParts'

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, isLoading } = useOrder(id || '')
  const statusMutation = useUpdateOrderStatus()
  const notesMutation = useUpdateOrderNotes()
  const syncMutation = useTriggerSync()
  const { order_statuses = [], unified_field_dictionary } = useConfig()
  const [notes, setNotes] = useState('')

  const order = data?.data
  const shipmentListQuery = useShipmentList({
    order_id: id || undefined,
    page: 1,
    page_size: 10,
  })
  const relatedShipments = shipmentListQuery.data?.data || []

  // Sync notes from loaded order (prevents overwriting with empty string on save)
  useEffect(() => {
    if (order?.notes != null) setNotes(order.notes)
  }, [order?.notes])

  if (isLoading) {
    return (
      <div className="order-detail-shell page-enter space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="order-detail-shell page-enter text-center py-12">
        <p className="text-[var(--color-muted)]">订单未找到</p>
        <Button className="mt-4" onClick={() => navigate('/orders')}>返回订单列表</Button>
      </div>
    )
  }

  const badge = getStatusMeta(order_statuses, order.status)
  const allowedTransitions = getAllowedNextStatuses(order_statuses, order.status)

  return (
    <div className="order-detail-shell page-enter space-y-6">
      <OrderDetailHero order={order} badge={badge} onBack={() => navigate('/orders')} />

      <EvidenceBanner evidence={data} />
      <OrderManualSourceWarning source={order.source} />

      <div className="order-detail-grid">
        <div className="order-detail-main">
          <OrderItemsPanel order={order} unifiedFieldDictionary={unified_field_dictionary} />

          <OrderTimelinePanel order={order} statusLabel={badge.label} />

          <RelatedShipmentsPanel
            shipments={relatedShipments}
            loading={shipmentListQuery.isLoading}
            onCreate={() => navigate(`/shipments/new?order_id=${id}`)}
            onOpen={(shipmentId) => navigate(`/shipments/${shipmentId}`)}
          />

          <OrderNotesPanel
            notes={notes}
            saving={notesMutation.isPending}
            onChange={setNotes}
            onSave={() => id && notesMutation.mutate({ id, notes })}
          />

          <OrderActionsPanel
            allowedTransitions={allowedTransitions}
            onMarkProcessing={() => id && statusMutation.mutate({ id, status: 'processing' })}
            onCreateShipment={() => navigate(`/shipments/new?order_id=${id}`)}
            onCancel={() => id && statusMutation.mutate({ id, status: 'cancelled' })}
          />
        </div>

        <div className="order-detail-side">
          <OrderFeeSummaryPanel order={order} />

          <OrderFulfillmentExceptionPanel order={order} onNavigate={navigate} />

          <OrderPlatformFeeBreakdownPanel order={order} onNavigate={navigate} />

          <OrderFinanceEntryPanel
            context={order.finance_entry_context || {}}
            onNavigate={navigate}
          />

          <OrderPlatformSyncReviewPanel
            order={order}
            syncing={syncMutation.isPending}
            onSync={() => syncMutation.mutate(order.platform_account_id)}
          />

          <OrderShippingAddressPanel order={order} />
        </div>
      </div>
    </div>
  )
}
