import { AlertTriangle, Bell, CheckCheck, PackageSearch, RefreshCw, Trash2, Truck, WalletCards } from "lucide-react"
import { Link } from "react-router-dom"
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

type DictOption = { id: string; label: string }

function optionLabel(options: DictOption[] = [], id: string) {
  return options.find(item => item.id === id)?.label || id || "—"
}

type InventoryRiskTone = "danger" | "warning" | "info" | "success"

interface InventoryRiskLane {
  key: string
  title: string
  value: string
  detail: string
  tone: InventoryRiskTone
  icon: React.ReactNode
}

interface InventoryRiskAction {
  label: string
  detail: string
  route: string
  tone: InventoryRiskTone
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
  return (
    <section
      aria-label="库存风险处理工作台"
      data-ui="inventory-risk-workbench"
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">inventory risk command</p>
          <h2 className="mt-1 text-lg font-bold text-[var(--color-fg)]">库存风险处理工作台</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            围绕平台店铺 Listing 处理缺货风险、库存资金占用、滞销风险和发货超期风险；缺少平台库存、订单或运营指标时只标出缺口，不用假数据补齐。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/products?tab=platform_store_products" className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-bg)]">
            查看店铺商品
          </Link>
          <button
            type="button"
            onClick={() => productSync.mutate(undefined)}
            disabled={productSync.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-primary)] transition hover:bg-[var(--color-bg)] disabled:opacity-50"
            title="同步平台商品库存；未接通真实商品 Open API 时会返回缺口，不会伪造同步成功。"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${productSync.isPending ? "animate-spin" : ""}`} />
            同步平台商品库存
          </button>
          <Link to="/orders" className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-bg)]">
            复核订单履约
          </Link>
          <Link to="/growth" className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-bg)]">
            复核运营诊断
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        {lanes.map(lane => (
          <InventoryRiskLaneCard key={lane.key} lane={lane} />
        ))}
      </div>

      {snapshot?.stock_sources ? (
        <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3" data-ui="inventory-stock-source-summary">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-fg)]">库存来源质量</h3>
              <p className="mt-1 text-xs text-[var(--color-muted)]">区分 V5 SKU、店铺 Listing 库存、规则扫描预警和平台库存缺口；未知库存不按 0 处理。</p>
            </div>
            <Badge variant={snapshot.stock_sources.missing_platform_stock_count ? "warning" : "success"}>
              缺口 {snapshot.stock_sources.missing_platform_stock_count}
            </Badge>
          </div>
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            {buildInventoryStockSourceCards(snapshot).map(item => (
              <article key={item.label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <p className="text-[11px] text-[var(--color-muted)]">{item.label}</p>
                <p className="mt-1 text-base font-bold text-[var(--color-fg)]">{item.value}</p>
              </article>
            ))}
          </div>
          {snapshot.supply_readiness ? (
            <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3" data-ui="inventory-supply-readiness-summary">
              <p className="text-xs font-semibold text-[var(--color-fg)]">供应与轻仓准备度</p>
              <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
                供应商品 {snapshot.supply_readiness.active_supply_product_count} 个，
                匹配当前可售商品 {snapshot.supply_readiness.matched_listing_supply_count} 个，
                有价格 {snapshot.supply_readiness.supply_with_price_count} 个，
                有 MOQ {snapshot.supply_readiness.supply_with_moq_count} 个，
                优选供应商 {snapshot.supply_readiness.preferred_supplier_count} 个；
                轻仓/货代配置 {snapshot.supply_readiness.local_warehouse_count} 个，
                库存同步可用 {snapshot.supply_readiness.warehouse_sync_ready_count} 个。
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {evidence ? (
        <div className="mt-4">
          <EvidenceBanner evidence={evidence} compact />
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">库存风险处理队列</h3>
            <p className="mt-1 text-xs text-[var(--color-muted)]">按未处理预警、已确认库存成本、Listing 运营指标和订单履约时限生成下一步动作；缺字段只进入缺口，不推导假结果。</p>
          </div>
          <Badge variant={actions.length ? "warning" : "success"}>{loading ? "加载中" : `动作 ${actions.length}`}</Badge>
        </div>
        {loading ? (
          <div className="h-20 rounded-lg bg-[var(--color-surface)]" />
        ) : actions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center text-xs text-[var(--color-muted)]">
            当前没有未处理库存预警；如平台库存尚未同步，请先执行扫描或进入平台店铺商品库复核库存来源。
          </p>
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {actions.map(action => (
              <Link key={`${action.label}-${action.detail}`} to={action.route} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-fg)]">{action.label}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">{action.detail}</p>
                  </div>
                  <Badge variant={action.tone === "danger" ? "danger" : action.tone === "warning" ? "warning" : "outline"}>处理</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {slowMovingItems.length ? (
        <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-fg)]">滞销 Listing 运营动作</h3>
              <p className="mt-1 text-xs text-[var(--color-muted)]">有库存、有浏览但近30天无订单的 Listing，可直接生成 0 预算 Listing 优化台账，进入运营增长复盘。</p>
            </div>
            <Badge variant="warning">可生成 {slowMovingItems.length} 项</Badge>
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            {slowMovingItems.map(item => (
              <article key={item.listing_id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--color-fg)]">{item.title}</p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      {item.platform || "平台待补"} · {item.account_name || "店铺待补"} · SKU {item.sku}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                      库存来源：{item.sku_source === "v5_product_sku_variants" ? `V5 SKU结构（${item.sku_count || 0} 个）` : "店铺 Listing 库存"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      库存 {item.stock} · 近30天浏览 {item.views_30d} · 订单 {item.orders_30d} · 占用 {item.capital_rmb != null ? `¥${item.capital_rmb}` : "成本待补"}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={createOperationAction.isPending}
                    onClick={() => createOperationAction.mutate(item.listing_id)}
                    className="shrink-0 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold transition hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
                    style={{ color: "var(--color-primary-text)" }}
                  >
                    生成运营台账动作
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function InventoryRiskLaneCard({ lane }: { lane: InventoryRiskLane }) {
  const color = lane.tone === "danger" ? "var(--color-danger)" : lane.tone === "warning" ? "var(--color-warning)" : lane.tone === "success" ? "var(--color-success)" : "var(--color-primary)"
  return (
    <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-surface)]" style={{ color }}>{lane.icon}</span>
        <Badge variant={lane.tone === "danger" ? "danger" : lane.tone === "warning" ? "warning" : lane.tone === "success" ? "success" : "outline"}>{lane.value}</Badge>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-[var(--color-fg)]">{lane.title}</h3>
      <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">{lane.detail}</p>
    </article>
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

function buildInventoryStockSourceCards(snapshot: InventoryRiskWorkbenchSnapshot) {
  const sources = snapshot.stock_sources
  return [
    { label: "已确认店铺 Listing", value: `${sources.confirmed_listing_count} 个` },
    { label: "V5 SKU 库存", value: `${sources.v5_sku_listing_count} 个 Listing` },
    { label: "旧 Listing 库存", value: `${sources.legacy_listing_stock_count} 个 Listing` },
    { label: "规则扫描预警", value: `${sources.manual_rule_alert_count} 条` },
    { label: "平台库存缺口", value: `${sources.missing_platform_stock_count} 个` },
    { label: "确认库存合计", value: `${sources.confirmed_stock_units} 件` },
    { label: "轻仓/货代配置", value: `${sources.local_warehouse_count} 个` },
    { label: "库存同步可用", value: `${sources.warehouse_sync_ready_count} 个` },
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
      className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors hover:bg-[var(--color-border)] disabled:opacity-50"
      style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
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
    <Card>
      <CardContent>
        <EvidenceBanner evidence={alertRulesQuery.data} compact />
        {alertRulesQuery.isError ? (
          <div
            data-ui="inventory-alert-rules-error"
            className="rounded-xl border p-4"
            style={{ borderColor: 'var(--color-danger)', backgroundColor: 'var(--color-danger-light)' }}
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
          <div className="overflow-x-auto">
            <table className="professional-table w-full text-sm">
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
                  <tr key={rule.id} className="transition-colors hover:bg-[var(--color-bg)]" style={{ borderBottom: '1px solid var(--color-border)' }}>
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
    <Card>
      <CardContent>
        <EvidenceBanner evidence={alertLogsQuery.data} compact />
        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <select
            value={status}
            onChange={(e) => { onStatusChange(e.target.value); onPageChange(1) }}
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-fg)' }}
          >
            <option value="">全部状态</option>
            {inventory_alert_statuses.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select
            value={severity}
            onChange={(e) => { onSevChange(e.target.value); onPageChange(1) }}
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-fg)' }}
          >
            <option value="">全部级别</option>
            {inventory_alert_severities.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
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
                    <div className="mx-auto max-w-xl rounded-xl border p-4 text-left" style={{ borderColor: 'var(--color-danger)', backgroundColor: 'var(--color-danger-light)' }}>
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
                  <tr key={item.id} className="transition-colors hover:bg-[var(--color-bg)]" style={{ borderBottom: '1px solid var(--color-border)' }}>
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
                className="text-xs px-3 py-1.5 rounded-md border disabled:opacity-40"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>上一页</button>
              <button disabled={page >= meta.total_pages} onClick={() => onPageChange(page + 1)}
                className="text-xs px-3 py-1.5 rounded-md border disabled:opacity-40"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>下一页</button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
