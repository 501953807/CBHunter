import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, PackageCheck } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/shared/LoadingSkeleton'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'
import { useShipment, useCreateShipment, useUpdateShipment } from '../hooks/useShipments'
import { useOrder } from '../hooks/useOrders'
import { useToast } from '../components/ui/Toast'
import { useConfig } from '../hooks/useConfig'
import { getStatusMeta, toDomainOptions } from '../utils/domainOptions'
import {
  OrderShipmentContextPanel,
  ShipmentFormPanel,
  ShipmentRelatedOrderPanel,
  ShipmentStatusLifecycle,
  ShipmentTrackingTimeline,
  shippingAddressValue,
  type ShipmentDetailFormState,
} from '../features/shipments/ShipmentDetailParts'

export default function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const orderIdFromQuery = searchParams.get('order_id')
  const isNew = !id
  const toast = useToast()
  const { carriers = [], shipping_methods = [], markets = [], shipment_statuses = [] } = useConfig()

  const { data, isLoading } = useShipment(id || '')
  const createMutation = useCreateShipment()
  const updateMutation = useUpdateShipment()

  const shipment = data?.data
  const orderContextId = isNew ? (orderIdFromQuery || '') : (shipment?.order_id || '')
  const orderContextQuery = useOrder(orderContextId)
  const orderContext = orderContextQuery.data?.data || null

  const [form, setForm] = useState<ShipmentDetailFormState>({
    order_id: orderIdFromQuery || '',
    carrier: '',
    shipping_method: '',
    tracking_number: '',
    status: '',
    shipping_cost: '',
    actual_weight_g: '',
    volumetric_weight_g: '',
    destination_market: '',
    destination_city: '',
    destination_address: '',
    estimated_delivery_date: '',
  })

  useEffect(() => {
    if (!shipment) return
    setForm({
      order_id: shipment.order_id,
      carrier: shipment.carrier || '',
      shipping_method: shipment.shipping_method || '',
      tracking_number: shipment.tracking_number || '',
      status: shipment.status,
      shipping_cost: shipment.shipping_cost == null ? '' : String(shipment.shipping_cost),
      actual_weight_g: shipment.actual_weight_g == null ? '' : String(shipment.actual_weight_g),
      volumetric_weight_g: shipment.volumetric_weight_g == null ? '' : String(shipment.volumetric_weight_g),
      destination_market: shipment.destination_address?.market || '',
      destination_city: shipment.destination_address?.city || '',
      destination_address: shipment.destination_address?.address || '',
      estimated_delivery_date: shipment.estimated_delivery_date || '',
    })
  }, [shipment])

  useEffect(() => {
    if (isNew && !form.status && shipment_statuses.length > 0) {
      setForm(prev => ({ ...prev, status: shipment_statuses[0].id }))
    }
  }, [form.status, isNew, shipment_statuses])

  useEffect(() => {
    if (!isNew || !orderContext) return
    const address = orderContext.shipping_address || {}
    setForm(prev => ({
      ...prev,
      destination_market: prev.destination_market || shippingAddressValue(address, 'market') || shippingAddressValue(address, 'country_code'),
      destination_city: prev.destination_city || shippingAddressValue(address, 'city'),
      destination_address: prev.destination_address || shippingAddressValue(address, 'address') || shippingAddressValue(address, 'full_address'),
    }))
  }, [isNew, orderContext])

  if (!isNew && isLoading) {
    return (
      <div className="shipment-shell page-enter space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!isNew && !shipment) {
    return (
      <div className="shipment-shell page-enter text-center py-12">
        <p className="text-[var(--color-muted)]">物流记录未找到</p>
        <Button className="mt-4" onClick={() => navigate('/shipments')}>返回物流列表</Button>
      </div>
    )
  }

  const handleSave = async () => {
    if (!form.carrier) {
      toast.addToast('error', '请选择承运商')
      return
    }

    if (isNew) {
      const shippingCost = form.shipping_cost === '' ? undefined : parseFloat(form.shipping_cost)
      const actualWeight = form.actual_weight_g === '' ? undefined : parseFloat(form.actual_weight_g)
      const volumetricWeight = form.volumetric_weight_g === '' ? undefined : parseFloat(form.volumetric_weight_g)
      const selectedMarket = markets.find(item => item.id === form.destination_market)
      const result = await createMutation.mutateAsync({
        order_id: form.order_id,
        carrier: form.carrier,
        shipping_method: form.shipping_method || undefined,
        tracking_number: form.tracking_number || undefined,
        status: form.status,
        shipping_cost: Number.isFinite(shippingCost) ? shippingCost : undefined,
        actual_weight_g: Number.isFinite(actualWeight) ? actualWeight : undefined,
        volumetric_weight_g: Number.isFinite(volumetricWeight) ? volumetricWeight : undefined,
        destination_address: form.destination_market ? { market: form.destination_market, country: selectedMarket?.label || '', city: form.destination_city, address: form.destination_address } : undefined,
        estimated_delivery_date: form.estimated_delivery_date || undefined,
      })
      if (result.data?.id) {
        navigate(`/shipments/${result.data.id}`, { replace: true })
      }
    } else if (id) {
      const shippingCost = form.shipping_cost === '' ? null : parseFloat(form.shipping_cost)
      const actualWeight = form.actual_weight_g === '' ? null : parseFloat(form.actual_weight_g)
      const volumetricWeight = form.volumetric_weight_g === '' ? null : parseFloat(form.volumetric_weight_g)
      const selectedMarket = markets.find(item => item.id === form.destination_market)
      await updateMutation.mutateAsync({ id, data: {
        carrier: form.carrier,
        shipping_method: form.shipping_method || null,
        tracking_number: form.tracking_number || null,
        status: form.status,
        shipping_cost: Number.isFinite(shippingCost) ? shippingCost : null,
        actual_weight_g: Number.isFinite(actualWeight) ? actualWeight : null,
        volumetric_weight_g: Number.isFinite(volumetricWeight) ? volumetricWeight : null,
        destination_address: form.destination_market ? { market: form.destination_market, country: selectedMarket?.label || '', city: form.destination_city, address: form.destination_address } : null,
        estimated_delivery_date: form.estimated_delivery_date || null,
      } })
    }
  }

  const displayShipment = isNew ? null : shipment
  const carrierOptions = carriers.map(item => ({ value: item.label, label: item.label }))
  const shippingMethodOptions = shipping_methods.map(item => ({ value: item.id, label: item.label }))
  const marketOptions = markets.map(item => ({ value: item.id, label: `${item.label} (${item.id})` }))
  const shipmentStatusOptions = toDomainOptions(shipment_statuses)

  return (
    <div className="shipment-shell shipment-detail-shell page-enter space-y-6">
      <div className="shipment-detail-hero">
        <div className="flex items-center gap-3">
          <button aria-label={isNew ? '返回订单列表' : '返回物流列表'} title={isNew ? '返回订单列表' : '返回物流列表'} onClick={() => navigate(isNew ? '/orders' : '/shipments')} className="text-[var(--color-muted)] hover:text-[var(--color-fg)]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">
            {isNew ? '新建物流' : `物流 ${displayShipment?.tracking_number || displayShipment?.id.slice(0, 8)}`}
          </h1>
          {displayShipment && (
            <Badge variant={getStatusMeta(shipment_statuses, displayShipment.status).variant}>
              {getStatusMeta(shipment_statuses, displayShipment.status).label}
            </Badge>
          )}
        </div>
        <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
          <PackageCheck className="w-4 h-4 mr-1.5" />
          {isNew ? '创建物流' : '保存'}
        </Button>
      </div>

      {!isNew && <EvidenceBanner evidence={data} />}

      <div className="shipment-detail-grid">
        <div className="shipment-detail-main">
          {isNew && (
            <OrderShipmentContextPanel
              order={orderContext}
              loading={orderContextQuery.isLoading}
              orderId={orderIdFromQuery || form.order_id}
              onBackToOrder={() => {
                const target = orderContext?.id || orderIdFromQuery || form.order_id
                if (target) navigate(`/orders/${target}`)
              }}
            />
          )}
          <ShipmentFormPanel
            carrierOptions={carrierOptions}
            form={form}
            isNew={isNew}
            marketOptions={marketOptions}
            setForm={setForm}
            shipmentStatusOptions={shipmentStatusOptions}
            shippingMethodOptions={shippingMethodOptions}
          />

          {displayShipment && (
            <ShipmentStatusLifecycle
              shipment={displayShipment}
              statusOptions={shipment_statuses}
            />
          )}

          {displayShipment && <ShipmentTrackingTimeline shipment={displayShipment} />}
        </div>

        {displayShipment && (
          <ShipmentRelatedOrderPanel shipment={displayShipment} onOpenOrder={() => navigate(`/orders/${displayShipment.order_id}`)} />
        )}
      </div>
    </div>
  )
}
