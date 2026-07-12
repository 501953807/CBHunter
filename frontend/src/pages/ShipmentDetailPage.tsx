import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, PackageCheck } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Skeleton } from '../components/shared/LoadingSkeleton'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'
import { useShipment, useCreateShipment, useUpdateShipment } from '../hooks/useShipments'
import { useToast } from '../components/ui/Toast'
import { useConfig } from '../hooks/useConfig'
import { getStatusMeta, toDomainOptions, withAllOption } from '../utils/domainOptions'

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

  const [form, setForm] = useState({
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

  if (!isNew && isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!isNew && !shipment) {
    return (
      <div className="text-center py-12">
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><h2 className="font-semibold text-[var(--color-fg)]">物流信息</h2></CardHeader>
            <CardContent>
              <div className="max-w-lg space-y-4">
                  <Input
                    label="关联订单 ID"
                    id="order_id"
                    value={form.order_id}
                    onChange={(e) => setForm({ ...form, order_id: e.target.value })}
                    placeholder="输入订单ID"
                    disabled={!isNew}
                  />
                  <Select
                    label="承运商 *"
                    options={withAllOption('选择承运商', carrierOptions)}
                    value={form.carrier}
                    onChange={(v) => setForm({ ...form, carrier: v })}
                  />
                  <Select label="目的市场" options={withAllOption('选择东南亚目的市场', marketOptions)} value={form.destination_market} onChange={(v) => setForm({ ...form, destination_market: v })} />
                  <div className="grid grid-cols-2 gap-4"><Input label="目的城市" value={form.destination_city} onChange={e => setForm({ ...form, destination_city: e.target.value })} /><Input label="预计送达" type="date" value={form.estimated_delivery_date} onChange={e => setForm({ ...form, estimated_delivery_date: e.target.value })} /></div>
                  <Input label="目的地址" value={form.destination_address} onChange={e => setForm({ ...form, destination_address: e.target.value })} />
                  <Select
                    label="运输方式"
                    options={withAllOption('选择运输方式', shippingMethodOptions)}
                    value={form.shipping_method}
                    onChange={(v) => setForm({ ...form, shipping_method: v })}
                  />
                  <Select
                    label="物流状态"
                    options={shipmentStatusOptions}
                    value={form.status}
                    onChange={(v) => setForm({ ...form, status: v })}
                  />
                  <Input
                    label="运单号"
                    id="tracking"
                    value={form.tracking_number}
                    onChange={(e) => setForm({ ...form, tracking_number: e.target.value })}
                    placeholder="输入追踪单号"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="运费 (¥)"
                      id="cost"
                      type="number"
                      value={form.shipping_cost}
                      onChange={(e) => setForm({ ...form, shipping_cost: e.target.value })}
                    />
                    <Input
                      label="实际重量 (g)"
                      id="weight"
                      type="number"
                      value={form.actual_weight_g}
                      onChange={(e) => setForm({ ...form, actual_weight_g: e.target.value })}
                    />
                  </div>
                  <Input label="体积重量 (g)" type="number" value={form.volumetric_weight_g} onChange={e => setForm({ ...form, volumetric_weight_g: e.target.value })} />
                </div>
            </CardContent>
          </Card>

          {/* Tracking Timeline */}
          {displayShipment && (
            <Card>
              <CardHeader><h2 className="font-semibold text-[var(--color-fg)]">物流追踪</h2></CardHeader>
              <CardContent>
                {displayShipment.tracking_events && displayShipment.tracking_events.length > 0 ? (
                  <div className="space-y-4">
                    {displayShipment.tracking_events.map((event, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${i === 0 ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`} />
                          {i < (displayShipment.tracking_events?.length || 0) - 1 && <div className="w-0.5 flex-1 bg-[var(--color-border)]" />}
                        </div>
                        <div>
                          <p className="text-sm text-[var(--color-fg)]">{event.description || event.status}</p>
                          <p className="text-xs text-[var(--color-muted)]">{event.location ? `${event.location} · ` : ''}{event.timestamp}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-[var(--color-muted)]">
                    <p className="text-sm">暂无追踪信息</p>
                    <p className="text-xs mt-1">当前未接入真实承运商轨迹，或承运商尚未返回轨迹</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {displayShipment && (
          <div className="space-y-4">
            <Card>
              <CardHeader><h2 className="font-semibold text-[var(--color-fg)]">关联订单</h2></CardHeader>
              <CardContent>
                <p className="text-sm text-[var(--color-muted)] font-mono">{displayShipment.order_id}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => navigate(`/orders/${displayShipment.order_id}`)}
                >
                  查看订单
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
