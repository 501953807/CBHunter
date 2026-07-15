import { Link, useSearchParams } from 'react-router-dom'
import { PackageX, Settings } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/shared/LoadingSkeleton'
import { useOrder } from '../hooks/useOrders'
import type { OrderDetail } from '../types/order'

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
      {order && <AfterSalesFulfillmentAnalysis order={order} />}
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

function AfterSalesFulfillmentAnalysis({ order }: { order: OrderDetail }) {
  const exception = order.fulfillment_exception || {}
  const finance = order.finance_entry_context || {}
  const afterSalesOpen = Boolean(order.after_sales_status && !['none', 'no_after_sales', 'closed', 'resolved', 'completed'].includes(order.after_sales_status))
  const refundAmount = finance.refund_rmb || 0
  const actions = [
    {
      label: '返回订单详情记录处理结果',
      route: `/orders/${order.id}`,
      detail: '平台售后 API 未接通前，系统只承接跟进，不生成模拟退款/退货单。',
    },
    {
      label: '补录退款或平台扣款',
      route: `/finance?entry_type=refund&order_id=${order.id}#finance-ledger`,
      detail: '只有真实平台账单或实际退款发生后才补录财务流水。',
    },
    {
      label: '检查店铺售后接口配置',
      route: `/platforms?platform_account_id=${order.platform_account_id}&sync_type=orders`,
      detail: '确认当前店铺授权、订单同步和后续售后 API 接入状态。',
    },
  ]
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[var(--color-fg)]">售后履约分析</h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">基于订单售后状态、履约异常和已关联财务台账判断当前处理重点。</p>
          </div>
          <Badge variant={afterSalesOpen ? 'warning' : 'outline'}>{afterSalesOpen ? '售后待处理' : '未识别开放售后'}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <AnalysisMetric label="售后状态" value={order.after_sales_status || '未知'} tone={afterSalesOpen ? 'warning' : 'default'} />
          <AnalysisMetric label="履约异常" value={fulfillmentStatusText(exception.status)} tone={exception.severity === 'critical' ? 'danger' : exception.severity === 'warning' ? 'warning' : 'default'} />
          <AnalysisMetric label="退款/扣款台账" value={`¥${refundAmount.toFixed(2)}`} tone={refundAmount > 0 ? 'warning' : 'default'} />
          <AnalysisMetric label="平台售后单" value="接口待接入" tone="warning" />
        </div>
        {(exception.reasons || []).length > 0 && (
          <div className="rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-light)] p-3 text-xs text-[var(--color-warning)]">
            <p className="font-medium">当前售后/履约处理依据</p>
            {(exception.reasons || []).map(reason => <p key={reason} className="mt-1">• {reason}</p>)}
          </div>
        )}
        <div className="grid gap-2 md:grid-cols-3">
          {actions.map(action => (
            <Link key={action.label} to={action.route} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left text-xs hover:border-[var(--color-primary)]">
              <span className="font-medium text-[var(--color-primary)]">{action.label}</span>
              <span className="mt-1 block text-[var(--color-muted)]">{action.detail}</span>
            </Link>
          ))}
        </div>
        <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs text-[var(--color-muted)]">
          售后履约分析只使用当前订单字段和已入库财务台账。平台退款、退货、争议单接口未接通前，本页不生成模拟售后记录，也不把平台后台未确认事项写成系统事实。
        </p>
      </CardContent>
    </Card>
  )
}

function AnalysisMetric({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'warning' | 'danger' }) {
  const color = tone === 'danger' ? 'var(--color-danger)' : tone === 'warning' ? 'var(--color-warning)' : 'var(--color-fg)'
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 line-clamp-2 text-sm font-semibold" style={{ color }}>{value}</p>
    </div>
  )
}

function fulfillmentStatusText(value?: string | null) {
  if (value === 'shipping_overdue') return '发货超期'
  if (value === 'shipping_due_soon') return '临近时限'
  if (value === 'after_sales_open') return '售后处理中'
  if (value === 'logistics_missing') return '物流待补'
  if (value === 'sync_required') return '同步待补'
  if (value === 'clear') return '正常'
  return '待确认'
}
