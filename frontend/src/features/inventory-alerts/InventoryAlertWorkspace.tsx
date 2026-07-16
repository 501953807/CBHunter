import { useState } from 'react'
import { Plus, AlertTriangle, Bell } from 'lucide-react'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatCard } from '../../components/shared/StatCard'
import { Button } from '../../components/ui/Button'
import { EvidenceBanner } from '../../components/shared/EvidenceBanner'
import { useAlertLogs, useAlertRules, useAlertStats, useInventoryRiskWorkbench } from '../../hooks/useInventoryAlerts'
import { AddRuleModal } from './AddRuleModal'
import { CheckInventoryButton, HistoryTab, InventoryRiskWorkbench, RulesTab } from './InventoryAlertPanels'

export default function InventoryAlertPage() {
  const [tab, setTab] = useState<'rules' | 'history'>('rules')
  const [showAddModal, setShowAddModal] = useState(false)
  const [logStatus, setLogStatus] = useState('')
  const [logSev, setLogSev] = useState('')
  const [logPage, setLogPage] = useState(1)

  const stats = useAlertStats()
  const s = stats.data?.data
  const rules = useAlertRules()
  const openAlerts = useAlertLogs({ status: 'open', page: 1, page_size: 8 })
  const riskWorkbench = useInventoryRiskWorkbench()

  return (
    <div className="space-y-6 page-enter">
      <PageHeader
        title="库存预警"
        description="设置安全库存阈值，自动监控库存变化"
        actions={
          <div className="flex items-center gap-2">
            <CheckInventoryButton />
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4" /> 添加规则
            </Button>
          </div>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="预警规则" value={s?.total_rules ?? 0} icon={<Bell className="w-4 h-4" />} />
        <StatCard label="未处理预警" value={s?.total_open ?? 0} icon={<AlertTriangle className="w-4 h-4" />} />
        <StatCard label="严重" value={s?.critical ?? 0} icon={<AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />} />
        <StatCard label="警告" value={s?.warning ?? 0} icon={<AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />} />
      </div>

      <EvidenceBanner evidence={stats.data} />

      <InventoryRiskWorkbench
        stats={s ?? undefined}
        alerts={openAlerts.data?.data ?? []}
        snapshot={riskWorkbench.data?.data ?? undefined}
        evidence={riskWorkbench.data}
        loading={openAlerts.isLoading || riskWorkbench.isLoading}
      />

      <InventoryDetailViewPanel
        rulesCount={rules.data?.data?.length ?? 0}
        alerts={openAlerts.data?.data ?? []}
        snapshot={riskWorkbench.data?.data ?? undefined}
        loading={rules.isLoading || openAlerts.isLoading || riskWorkbench.isLoading}
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--color-border)' }}>
        <button
          onClick={() => setTab('rules')}
          className="flex-1 py-2 text-sm font-medium rounded-md transition-colors"
          style={{
            color: tab === 'rules' ? 'var(--color-fg)' : 'var(--color-muted)',
            backgroundColor: tab === 'rules' ? 'var(--color-surface)' : 'transparent',
          }}
        >
          预警规则
        </button>
        <button
          onClick={() => setTab('history')}
          className="flex-1 py-2 text-sm font-medium rounded-md transition-colors"
          style={{
            color: tab === 'history' ? 'var(--color-fg)' : 'var(--color-muted)',
            backgroundColor: tab === 'history' ? 'var(--color-surface)' : 'transparent',
          }}
        >
          预警历史
        </button>
      </div>

      {tab === 'rules' ? <RulesTab /> : <HistoryTab status={logStatus} severity={logSev} page={logPage} onStatusChange={setLogStatus} onSevChange={setLogSev} onPageChange={setLogPage} />}

      {showAddModal && <AddRuleModal onClose={() => setShowAddModal(false)} />}
    </div>
  )
}

function InventoryDetailViewPanel({
  rulesCount,
  alerts,
  snapshot,
  loading,
}: {
  rulesCount: number
  alerts: Array<{
    id: string
    sku: string
    product_name: string
    current_stock: number
    threshold: number
    severity: string
  }>
  snapshot?: {
    stockout?: { items?: Array<{ alert_id: string; sku: string; product_name: string; current_stock: number; threshold: number; shortage: number }> }
    capital?: { items?: Array<{ listing_id: string; sku: string; title: string; stock: number; unit_cost_rmb: number; capital_rmb: number }> }
    slow_moving?: { items?: Array<{ listing_id: string; sku: string; title: string; stock: number; orders_30d: number; views_30d: number; capital_rmb?: number | null }> }
    data_gaps?: string[]
  }
  loading?: boolean
}) {
  const stockoutItems = snapshot?.stockout?.items ?? []
  const capitalItems = snapshot?.capital?.items ?? []
  const slowMovingItems = snapshot?.slow_moving?.items ?? []
  const stockRows = [
    ...stockoutItems.map(item => ({
      key: item.alert_id,
      sku: item.sku,
      name: item.product_name,
      stock: item.current_stock,
      threshold: item.threshold,
      source: '缺货预警',
    })),
    ...capitalItems.slice(0, 6).map(item => ({
      key: item.listing_id,
      sku: item.sku,
      name: item.title,
      stock: item.stock,
      threshold: null,
      source: '库存资金',
    })),
  ]
  const replenishItems = stockoutItems.slice(0, 5)
  const turnoverItems = slowMovingItems.slice(0, 5)

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]" data-ui="inventory-aging-turnover">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">inventory detail views</p>
          <h2 className="mt-1 text-lg font-bold text-[var(--color-fg)]">库存预警详细功能视图</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            覆盖预警规则配置、库存列表、补货建议、周转天数与库龄分析；库龄字段等待平台库存接口接入，不用人工臆造。
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <InventoryMiniMetric label="预警规则配置" value={rulesCount} />
          <InventoryMiniMetric label="库存列表" value={stockRows.length} />
          <InventoryMiniMetric label="补货建议" value={replenishItems.length} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">库存列表</h3>
            <span className="text-xs text-[var(--color-muted)]">{loading ? '加载中' : `${stockRows.length} 条`}</span>
          </div>
          {stockRows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center text-xs text-[var(--color-muted)]">
              暂无已确认库存 Listing。请先同步平台店铺商品或配置库存预警规则。
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                    <th className="px-3 py-2 text-left font-medium">SKU</th>
                    <th className="px-3 py-2 text-left font-medium">商品</th>
                    <th className="px-3 py-2 text-right font-medium">库存</th>
                    <th className="px-3 py-2 text-right font-medium">阈值</th>
                    <th className="px-3 py-2 text-left font-medium">来源</th>
                  </tr>
                </thead>
                <tbody>
                  {stockRows.map(item => (
                    <tr key={item.key} className="border-b border-[var(--color-border)] text-xs">
                      <td className="px-3 py-2 font-mono text-[var(--color-fg)]">{item.sku}</td>
                      <td className="max-w-[260px] truncate px-3 py-2 text-[var(--color-muted)]">{item.name}</td>
                      <td className="px-3 py-2 text-right font-semibold text-[var(--color-fg)]">{item.stock}</td>
                      <td className="px-3 py-2 text-right text-[var(--color-muted)]">{item.threshold ?? '—'}</td>
                      <td className="px-3 py-2 text-[var(--color-muted)]">{item.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">补货建议</h3>
            <div className="mt-3 space-y-2">
              {replenishItems.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs text-[var(--color-muted)]">
                  当前没有低于阈值的库存预警。
                </p>
              ) : replenishItems.map(item => (
                <div key={item.alert_id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                  <p className="text-sm font-semibold text-[var(--color-fg)]">{item.product_name}</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    SKU {item.sku} · 当前 {item.current_stock} · 安全库存 {item.threshold} · 建议至少补 {Math.max(0, item.shortage)} 件
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">周转天数 / 库龄分析</h3>
            <div className="mt-3 space-y-2">
              {turnoverItems.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs text-[var(--color-muted)]">
                  暂无慢动销 Listing。周转天数需要平台库存与近30日订单；库龄分析需要平台入库/上架时间字段。
                </p>
              ) : turnoverItems.map(item => {
                const turnoverDays = item.orders_30d > 0 ? Math.ceil((item.stock / item.orders_30d) * 30) : null
                return (
                  <div key={item.listing_id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                    <p className="text-sm font-semibold text-[var(--color-fg)]">{item.title}</p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      周转天数：{turnoverDays == null ? '近30日无销量' : `${turnoverDays} 天`} · 库龄分析：平台库龄字段待接入 · 浏览 {item.views_30d} · 订单 {item.orders_30d}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {alerts.length > 0 && (
        <p className="mt-3 text-xs text-[var(--color-muted)]">当前未处理预警 {alerts.length} 条，已进入库存列表与补货建议队列。</p>
      )}
      {(snapshot?.data_gaps?.length ?? 0) > 0 && (
        <p className="mt-2 text-xs text-[var(--color-warning)]">数据缺口：{snapshot?.data_gaps?.join('、')}</p>
      )}
    </section>
  )
}

function InventoryMiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-right">
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 text-base font-bold text-[var(--color-fg)]">{value}</p>
    </div>
  )
}
