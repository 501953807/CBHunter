import { Link, useSearchParams } from 'react-router-dom'
import { PackageX, Settings } from 'lucide-react'
import { Card, CardContent } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/shared/LoadingSkeleton'
import { useOrder } from '../hooks/useOrders'

export default function AfterSalesPage() {
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('order_id')
  const { data, isLoading } = useOrder(orderId || '')
  const order = data?.data
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">售后处理</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">退款、退货和平台争议需来自已授权店铺的真实售后数据</p>
        {orderId && <p className="mt-1 text-xs text-[var(--color-primary)]">当前跟进订单：{orderId}</p>}
      </div>
      {orderId && isLoading && <Skeleton className="h-28 w-full" />}
      {order && (
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--color-fg)]">订单售后上下文：{order.order_number || order.platform_order_id}</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  平台 {order.platform || '--'} · 买家 {order.buyer_name || '--'} · 金额 {order.currency} {order.total.toFixed(2)}
                </p>
              </div>
              <Badge variant={order.after_sales_status && order.after_sales_status !== 'none' ? 'warning' : 'outline'}>
                售后状态：{order.after_sales_status || '未知'}
              </Badge>
            </div>
            {(order.fulfillment_exception?.reasons || []).length > 0 && (
              <div className="mt-3 rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-light)] p-3 text-xs text-[var(--color-warning)]">
                <p className="font-medium">履约异常原因</p>
                {(order.fulfillment_exception?.reasons || []).map(reason => <p key={reason} className="mt-1">• {reason}</p>)}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="py-12 text-center">
          <PackageX className="w-12 h-12 mx-auto text-[var(--color-muted)] mb-3" />
          <h2 className="text-lg font-semibold text-[var(--color-fg)]">售后数据接口待接入</h2>
          <p className="text-sm text-[var(--color-muted)] mt-2 max-w-xl mx-auto">
            当前平台连接器尚未提供真实退款、退货与争议单读取能力，因此系统不生成模拟售后记录。
          </p>
          {orderId && (
            <p className="mt-3 rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-light)] px-3 py-2 text-xs text-[var(--color-warning)]">
              本页仅承接订单异常动作闭环，后续接入平台售后 API 后才会显示真实售后单；当前可先回到订单详情记录备注或在平台后台处理。
            </p>
          )}
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link to={orderId ? `/orders/${orderId}` : '/orders'} className="px-4 py-2 rounded-lg text-sm text-[var(--color-primary-text)] bg-[var(--color-primary)]">{orderId ? '返回订单详情' : '返回订单列表'}</Link>
            <Link to="/platforms" className="px-4 py-2 rounded-lg text-sm border border-[var(--color-border)] text-[var(--color-fg)] inline-flex items-center gap-2"><Settings className="w-4 h-4" />检查平台配置</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
