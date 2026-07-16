import { GitBranch, ShieldAlert, Store } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import type { CockpitData } from '../../types/cockpit'
import { labelBusinessCode } from '../../utils/businessLabels'
import { CommandPanel, DenseRows, formatTime, Mini } from './CockpitCommandWidgets'

interface Props {
  data: CockpitData
  onNavigate: (route: string) => void
}

export function CockpitCenterSummaryPanels({ data, onNavigate }: Props) {
  const s = data.sections
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <CommandPanel title="平台店铺矩阵" icon={<Store className="h-4 w-4" />} section={s.store_matrix} onOpen={() => onNavigate('/platforms')}>
        <div className="grid grid-cols-3 gap-2">
          <Mini label="店铺" value={String(s.store_matrix.metrics.store_count)} />
          <Mini label="活跃" value={String(s.store_matrix.metrics.active_store_count)} />
          <Mini label="Listing" value={String(s.store_matrix.metrics.active_listings)} />
        </div>
        <CockpitStoreMatrixTable stores={s.store_matrix.items} onNavigate={onNavigate} />
      </CommandPanel>

      <CommandPanel title="风险摘要" icon={<ShieldAlert className="h-4 w-4" />} section={s.risk_summary} onOpen={() => onNavigate('/risk-control')}>
        <div className="grid grid-cols-3 gap-2">
          <Mini label="开放风险" value={String(s.risk_summary.metrics.active_risk_count)} tone={s.risk_summary.metrics.active_risk_count ? 'warning' : 'normal'} />
          <Mini label="高危" value={String(s.risk_summary.metrics.critical)} tone={s.risk_summary.metrics.critical ? 'danger' : 'normal'} />
          <Mini label="警告" value={String(s.risk_summary.metrics.warning)} tone={s.risk_summary.metrics.warning ? 'warning' : 'normal'} />
        </div>
        <DenseRows empty="暂无开放风险" rows={s.risk_summary.items.slice(0, 4).map((item) => ({
          key: item.key,
          title: item.title,
          detail: item.detail,
          value: item.severity === 'critical' ? '高危' : '警告',
          danger: item.severity === 'critical',
        }))} />
      </CommandPanel>

      <CommandPanel title="链路摘要" icon={<GitBranch className="h-4 w-4" />} section={s.flow_summary} onOpen={() => onNavigate('/business-flow')}>
        <div className="grid grid-cols-4 gap-2">
          <Mini label="阶段" value={String(s.flow_summary.metrics.stage_count)} />
          <Mini label="就绪" value={String(s.flow_summary.metrics.ready)} />
          <Mini label="待补" value={String(s.flow_summary.metrics.data_required)} tone={s.flow_summary.metrics.data_required ? 'warning' : 'normal'} />
          <Mini label="阻塞" value={String(s.flow_summary.metrics.blocked)} tone={s.flow_summary.metrics.blocked ? 'danger' : 'normal'} />
        </div>
        <DenseRows empty="暂无业务链路对象" rows={s.flow_summary.items.slice(0, 5).map((item) => ({
          key: item.stage_key,
          title: item.label,
          detail: labelBusinessCode(item.gap) || item.next_action || '可继续推进',
          value: `${item.object_count} 个`,
          danger: item.status === 'blocked',
        }))} />
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">从选品到刊登</Badge>
          <Badge variant={s.flow_summary.metrics.blocked ? 'danger' : s.flow_summary.metrics.data_required ? 'warning' : 'success'}>链路健康</Badge>
        </div>
      </CommandPanel>
    </div>
  )
}

function CockpitStoreMatrixTable({ stores, onNavigate }: {
  stores: CockpitData['sections']['store_matrix']['items']
  onNavigate: (route: string) => void
}) {
  if (stores.length === 0) {
    return <p className="rounded-md border border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">暂无平台店铺经营数据</p>
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]" aria-label="平台店铺经营矩阵">
      <table className="w-full min-w-[620px] text-left text-[11px]">
        <thead className="bg-[var(--color-bg)] text-[var(--color-muted)]">
          <tr>
            <th className="px-2 py-2 font-medium">平台/店铺</th>
            <th className="px-2 py-2 font-medium">经营量</th>
            <th className="px-2 py-2 font-medium">收入</th>
            <th className="px-2 py-2 font-medium">同步状态</th>
            <th className="px-2 py-2 text-right font-medium">下钻</th>
          </tr>
        </thead>
        <tbody>
          {stores.slice(0, 5).map((store) => (
            <tr key={store.id} className="border-t border-[var(--color-border)] align-top">
              <td className="px-2 py-2">
                <p className="font-semibold text-[var(--color-fg)]">{store.account_name}</p>
                <p className="mt-0.5 text-[var(--color-muted)]">{store.platform} · {formatMarketLabel(store.market)}</p>
              </td>
              <td className="px-2 py-2 text-[var(--color-fg)]">
                <p>{store.active_listings} Listing</p>
                <p className="mt-0.5 text-[var(--color-muted)]">{store.order_count} 订单</p>
              </td>
              <td className="px-2 py-2 text-[var(--color-fg)]">{revenueText(store.revenue_by_currency) || '收入待同步'}</td>
              <td className="px-2 py-2">
                <Badge variant={store.status === 'active' ? 'success' : 'outline'}>{store.status}</Badge>
                <p className="mt-1 text-[var(--color-muted)]">{store.last_sync_at ? formatTime(store.last_sync_at) : '未同步'}</p>
              </td>
              <td className="px-2 py-2">
                <div className="flex flex-col items-end gap-1">
                  <button className="text-[var(--color-primary)] hover:underline" onClick={() => onNavigate(`/products?tab=platform_store_products&platform_account_id=${encodeURIComponent(store.id)}&platform=${encodeURIComponent(store.platform)}`)}>查看店铺商品</button>
                  <button className="text-[var(--color-primary)] hover:underline" onClick={() => onNavigate(`/orders?platform_account_id=${encodeURIComponent(store.id)}&platform=${encodeURIComponent(store.platform)}`)}>查看订单</button>
                  <button className="text-[var(--color-primary)] hover:underline" onClick={() => onNavigate(`/shipments?platform_account_id=${encodeURIComponent(store.id)}&platform=${encodeURIComponent(store.platform)}`)}>查看物流</button>
                  <button className="text-[var(--color-primary)] hover:underline" onClick={() => onNavigate(`/finance?platform_account_id=${encodeURIComponent(store.id)}`)}>查看财务</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function revenueText(values: { currency: string; orders: number; revenue: number }[]) {
  if (values.length === 0) return ''
  return values.slice(0, 2).map((item) => `${item.currency} ${item.revenue.toLocaleString()} / ${item.orders}单`).join('；')
}

function formatMarketLabel(value?: string | null) {
  if (!value || value.toLowerCase() === 'unknown') return '--'
  return value
}
