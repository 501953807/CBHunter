import { AlertTriangle, Bell, CheckCheck, PackageSearch, Trash2, Truck, WalletCards } from "lucide-react"
import { Card, CardContent } from "../../components/ui/Card"
import { Badge } from "../../components/ui/Badge"
import { useConfirm } from "../../components/ui/ConfirmDialog"
import { EmptyState } from "../../components/ui/EmptyState"
import { EvidenceBanner } from "../../components/shared/EvidenceBanner"
import { useAcknowledgeAlert, useAlertLogs, useAlertRules, useCheckInventory, useClearAlert, useCreateInventorySlowMovingOperationAction, useDeleteAlertRule, useUpdateAlertRule } from "../../hooks/useInventoryAlerts"
import { useConfig } from "../../hooks/useConfig"
import { useTriggerProductSync } from "../../hooks/useSync"
import type { ApiResponse } from "../../types/common"
import type { AlertStats, InventoryAlertLog, InventoryRiskWorkbenchSnapshot } from "../../types/inventoryAlert"
import {
  InventoryRiskActionQueue,
  InventoryRiskCommandHeader,
  InventoryRiskLaneGrid,
  InventoryStockSourceSummary,
  SlowMovingOperationPanel,
  type InventoryRiskAction,
  type InventoryRiskLane,
} from "./InventoryRiskWorkbenchParts"

type DictOption = { id: string; label: string }

function optionLabel(options: DictOption[] = [], id: string) {
  return options.find(item => item.id === id)?.label || id || "—"
}

export function InventoryRiskWorkbench({
  stats,
  alerts,
  snapshot,
  evidence,
  loading,
}: {
  stats?: AlertStats
  alerts: InventoryAlertLog[]
  snapshot?: InventoryRiskWorkbenchSnapshot | null
  evidence?: ApiResponse<InventoryRiskWorkbenchSnapshot>
  loading?: boolean
}) {
  const lanes = buildInventoryRiskLanes(stats, alerts, snapshot)
  const actions = buildInventoryRiskActions(alerts, snapshot)
  const slowMovingItems = snapshot?.slow_moving.items ?? []
  const createOperationAction = useCreateInventorySlowMovingOperationAction()
  const productSync = useTriggerProductSync()
  const { unified_field_dictionary } = useConfig()
  return (
    <section
      aria-label="库存风险处理工作台"
      data-ui="inventory-risk-workbench"
      className="inventory-risk-workbench p-4"
    >
      <InventoryRiskCommandHeader syncing={productSync.isPending} onSyncProducts={() => productSync.mutate(undefined)} />

      <InventoryRiskLaneGrid lanes={lanes} />

      {snapshot?.stock_sources ? (
        <InventoryStockSourceSummary snapshot={snapshot} />
      ) : null}

      {evidence ? (
        <div className="mt-4">
          <EvidenceBanner evidence={evidence} compact />
        </div>
      ) : null}

      <InventoryRiskActionQueue actions={actions} loading={loading} />

      <SlowMovingOperationPanel
        items={slowMovingItems}
        unifiedFieldDictionary={unified_field_dictionary}
        creatingOperation={createOperationAction.isPending}
        onCreateOperationAction={listingId => createOperationAction.mutate(listingId)}
      />
    </section>
  )
}

export function buildInventoryRiskLanes(
  stats: AlertStats | undefined,
  alerts: InventoryAlertLog[],
  snapshot?: InventoryRiskWorkbenchSnapshot | null,
): InventoryRiskLane[] {
  const criticalCount = stats?.critical ?? alerts.filter(item => item.severity === "critical").length
  const warningCount = stats?.warning ?? alerts.filter(item => item.severity === "warning").length
  const stockoutCount = snapshot?.stockout.count ?? criticalCount + warningCount
  const capitalValue = snapshot ? `¥${snapshot.capital.total_rmb.toLocaleString()}` : "待核算"
  const capitalDetail = snapshot
    ? `按已确认库存与商品成本价计算；${snapshot.capital.items.length} 个 Listing 已核算，${snapshot.capital.missing_cost_count} 个缺成本价。`
    : "需要采购成本、在库数量和店铺 Listing 绑定后计算；当前先作为库存预警的资金复核入口。"
  const slowMovingValue = snapshot ? `${snapshot.slow_moving.count} 项` : "待复核"
  const slowMovingDetail = snapshot
    ? `按 Listing 30 天浏览与订单识别有库存无成交对象；${snapshot.slow_moving.missing_performance_count} 个 Listing 缺运营指标。`
    : "需要商品运营指标识别有库存、低浏览或长期无订单的 Listing，优先进入运营诊断复核。"
  const fulfillmentValue = snapshot ? `${snapshot.fulfillment_overdue.count} 单` : "待联动"
  const fulfillmentDetail = snapshot
    ? "按平台发货时限识别已超期、即将超期或缺物流渠道的订单，优先进入订单履约复核。"
    : "需要订单履约时限和平台发货 SLA 联动，缺货预警应优先复核未发货订单。"
  return [
    {
      key: "stockout",
      title: "缺货风险",
      value: `${stockoutCount} 项`,
      detail: "由安全库存规则和当前可售库存触发；库存未知时不生成假预警，需先同步平台店铺商品库存。",
      tone: criticalCount ? "danger" : warningCount ? "warning" : "success",
      icon: <AlertTriangle className="h-4 w-4" />,
    },
    {
      key: "capital",
      title: "库存资金占用",
      value: capitalValue,
      detail: capitalDetail,
      tone: snapshot && snapshot.capital.total_rmb > 0 ? "info" : "warning",
      icon: <WalletCards className="h-4 w-4" />,
    },
    {
      key: "slow-moving",
      title: "滞销风险",
      value: slowMovingValue,
      detail: slowMovingDetail,
      tone: snapshot?.slow_moving.count ? "warning" : "success",
      icon: <PackageSearch className="h-4 w-4" />,
    },
    {
      key: "fulfillment",
      title: "发货超期风险",
      value: fulfillmentValue,
      detail: fulfillmentDetail,
      tone: snapshot?.fulfillment_overdue.count ? "danger" : "success",
      icon: <Truck className="h-4 w-4" />,
    },
  ]
}

export function buildInventoryRiskActions(alerts: InventoryAlertLog[], snapshot?: InventoryRiskWorkbenchSnapshot | null): InventoryRiskAction[] {
  const openAlerts = alerts.filter(item => item.status === "open").slice(0, 6)
  const alertActions = openAlerts.map(item => ({
    label: item.severity === "critical" ? "立即处理缺货风险" : "复核库存预警",
    detail: `${item.product_name} · SKU ${item.sku} · 当前 ${item.current_stock} / 安全 ${item.threshold}`,
    route: `/products?tab=platform_store_products&search=${encodeURIComponent(item.sku)}`,
    tone: item.severity === "critical" ? "danger" as const : "warning" as const,
  }))
  const snapshotActions = snapshot?.actions.map(action => ({
    label: action.label,
    detail: `${action.count} 个对象需要处理`,
    route: action.route,
    tone: action.priority === "critical" ? "danger" as const : action.priority === "high" ? "warning" as const : "info" as const,
  })) ?? []
  return [
    ...alertActions,
    ...snapshotActions,
    { label: "查看店铺商品", detail: "按平台/店铺复核 Listing 库存、SKU 和同步状态。", route: "/products?tab=platform_store_products", tone: "info" },
    { label: "复核订单履约", detail: "检查未发货订单是否受到库存不足影响。", route: "/orders", tone: "warning" },
    { label: "复核运营诊断", detail: "识别有库存但无订单、低转化或主图标题失效的滞销 Listing。", route: "/growth", tone: "warning" },
  ]
}

/* ── Check Inventory Button ── */
export function CheckInventoryButton() {
  const check = useCheckInventory()
  return (
    <button
      onClick={() => check.mutate()}
      disabled={check.isPending}
      className="inventory-alert-action text-xs px-3 py-2 disabled:opacity-50"
    >
      <Bell className={`w-3.5 h-3.5 ${check.isPending ? 'animate-pulse' : ''}`} />
      扫描库存
    </button>
  )
}

/* ── Rules Tab ── */
export function RulesTab() {
  const alertRulesQuery = useAlertRules()
  const updateRule = useUpdateAlertRule()
  const deleteRule = useDeleteAlertRule()
  const confirmAction = useConfirm()
  const { inventory_alert_severities = [] } = useConfig()
  const items = (alertRulesQuery.data?.data ?? []) as any[]

  if (alertRulesQuery.isLoading) {
    return <div className="skeleton-shimmer h-48 rounded-xl" />
  }

  const handleDeleteRule = async (id: string) => {
    const ok = await confirmAction({
      title: '删除库存预警规则',
      message: '确定删除此规则？删除后该 SKU 不会再按此阈值触发库存预警。',
      confirmText: '删除',
      tone: 'danger',
    })
    if (ok) deleteRule.mutate(id)
  }

  return (
    <Card className="inventory-rule-table-panel">
      <CardContent>
        <EvidenceBanner evidence={alertRulesQuery.data} compact />
        {alertRulesQuery.isError ? (
          <div
            data-ui="inventory-alert-rules-error"
            className="inventory-alert-error-panel"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--color-fg)]">预警规则加载失败</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  无法读取安全库存规则，请检查后端服务、登录状态或库存预警接口。
                </p>
              </div>
              <button
                type="button"
                onClick={() => alertRulesQuery.refetch()}
                className="rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:opacity-90"
                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-text)' }}
              >
                重新加载预警规则
              </button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Bell className="w-10 h-10" />} title="暂无预警规则" description="点击「添加规则」设置库存阈值" />
        ) : (
          <div className="inventory-alert-table-shell overflow-x-auto">
            <table className="professional-table text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>SKU</th>
                  <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>商品名称</th>
                  <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>安全库存</th>
                  <th className="text-center py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>严重程度</th>
                  <th className="text-center py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>状态</th>
                  <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((rule: any) => (
                  <tr key={rule.id} className="inventory-alert-row" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="py-2.5 px-3" style={{ color: 'var(--color-fg)' }}>{rule.sku}</td>
                    <td className="py-2.5 px-3 text-xs" style={{ color: 'var(--color-muted)' }}>{rule.product_name}</td>
                    <td className="py-2.5 px-3 text-right font-mono" style={{ color: 'var(--color-fg)' }}>{rule.safety_stock}</td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant={rule.severity === 'critical' ? 'danger' : rule.severity === 'warning' ? 'warning' : 'info'}>
                        {optionLabel(inventory_alert_severities, rule.severity)}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-xs" style={{ color: rule.enabled ? 'var(--color-success)' : 'var(--color-muted)' }}>
                        {rule.enabled ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => updateRule.mutate({ id: rule.id, enabled: !rule.enabled })}
                          className="text-xs px-2 py-1 rounded transition-colors hover:bg-[var(--color-border)]"
                          style={{ color: 'var(--color-muted)' }}
                        >
                          {rule.enabled ? '禁用' : '启用'}
                        </button>
                        <button
                          onClick={() => void handleDeleteRule(rule.id)}
                          className="text-xs px-2 py-1 rounded transition-colors hover:bg-[var(--color-border)]"
                          style={{ color: 'var(--color-danger)' }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ── History Tab ── */
export function HistoryTab({ status, severity, page, onStatusChange, onSevChange, onPageChange }: {
  status: string; severity: string; page: number;
  onStatusChange: (v: string) => void; onSevChange: (v: string) => void; onPageChange: (v: number) => void;
}) {
  const alertLogsQuery = useAlertLogs({ status: status || undefined, severity: severity || undefined, page, page_size: 20 })
  const ack = useAcknowledgeAlert()
  const clear = useClearAlert()
  const { inventory_alert_statuses = [], inventory_alert_severities = [] } = useConfig()
  const items = (alertLogsQuery.data?.data ?? []) as any[]
  const meta = alertLogsQuery.data?.meta

  return (
    <Card className="inventory-history-table-panel">
      <CardContent>
        <EvidenceBanner evidence={alertLogsQuery.data} compact />
        {/* Filters */}
        <div className="inventory-alert-filter-bar mb-4">
          <select
            value={status}
            onChange={(e) => { onStatusChange(e.target.value); onPageChange(1) }}
            className="inventory-alert-select"
          >
            <option value="">全部状态</option>
            {inventory_alert_statuses.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select
            value={severity}
            onChange={(e) => { onSevChange(e.target.value); onPageChange(1) }}
            className="inventory-alert-select"
          >
            <option value="">全部级别</option>
            {inventory_alert_severities.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>

        <div className="inventory-alert-table-shell overflow-x-auto">
          <table className="professional-table text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>时间</th>
                <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>SKU</th>
                <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>商品</th>
                <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>当前库存</th>
                <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>阈值</th>
                <th className="text-center py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>级别</th>
                <th className="text-center py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>状态</th>
                <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {alertLogsQuery.isError ? (
                <tr data-ui="inventory-alert-logs-error">
                  <td colSpan={8} className="py-12 text-center">
                    <div className="inventory-alert-error-panel mx-auto max-w-xl text-left">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--color-fg)]">预警历史加载失败</p>
                          <p className="mt-1 text-xs text-[var(--color-muted)]">
                            无法读取库存预警处理记录，请检查后端服务、登录状态或库存预警历史接口。
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => alertLogsQuery.refetch()}
                          className="rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:opacity-90"
                          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-text)' }}
                        >
                          重新加载预警历史
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : alertLogsQuery.isLoading ? (
                <tr><td colSpan={8} className="py-12 text-center" style={{ color: 'var(--color-muted)' }}>加载中...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8}><EmptyState icon={<Bell className="h-9 w-9" />} title="暂无预警记录" description="先配置库存规则并执行扫描；没有真实库存时会保留数据缺口。" /></td></tr>
              ) : (
                items.map((item: any) => (
                  <tr key={item.id} className="inventory-alert-row" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="py-2.5 px-3 text-xs" style={{ color: 'var(--color-muted)' }}>
                      {item.created_at ? new Date(item.created_at).toLocaleString('zh-CN', { hour12: false }) : '-'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs" style={{ color: 'var(--color-fg)' }}>{item.sku}</td>
                    <td className="py-2.5 px-3 text-xs" style={{ color: 'var(--color-muted)' }}>{item.product_name}</td>
                    <td className="py-2.5 px-3 text-right font-mono" style={{ color: item.current_stock < item.threshold ? 'var(--color-danger)' : 'var(--color-fg)' }}>
                      {item.current_stock}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono" style={{ color: 'var(--color-muted)' }}>{item.threshold}</td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant={item.severity === 'critical' ? 'danger' : item.severity === 'warning' ? 'warning' : 'info'}>
                        {optionLabel(inventory_alert_severities, item.severity)}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-xs" style={{
                        color: item.status === 'open' ? 'var(--color-danger)' : item.status === 'acknowledged' ? 'var(--color-warning)' : 'var(--color-success)'
                      }}>
                        {optionLabel(inventory_alert_statuses, item.status)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {item.status === 'open' && (
                          <button onClick={() => ack.mutate(item.id)} className="text-xs px-2 py-1 rounded transition-colors hover:bg-[var(--color-border)]"
                            style={{ color: 'var(--color-warning)' }}>
                            <CheckCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {item.status !== 'cleared' && (
                          <button onClick={() => clear.mutate(item.id)} className="text-xs px-2 py-1 rounded transition-colors hover:bg-[var(--color-border)]"
                            style={{ color: 'var(--color-success)' }}>
                            清除
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {meta && meta.total_pages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>共 {meta.total} 条</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}
                className="inventory-alert-mini-button px-3 py-1.5 text-xs disabled:opacity-40">上一页</button>
              <button disabled={page >= meta.total_pages} onClick={() => onPageChange(page + 1)}
                className="inventory-alert-mini-button px-3 py-1.5 text-xs disabled:opacity-40">下一页</button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
