import { RefreshCw } from "lucide-react"
import { Link } from "react-router-dom"
import type { ReactNode } from "react"
import { Badge } from "../../components/ui/Badge"
import type { UnifiedFieldDictionary } from "../../api/config"
import type { InventoryRiskWorkbenchSnapshot } from "../../types/inventoryAlert"

export type InventoryRiskTone = "danger" | "warning" | "info" | "success"

export interface InventoryRiskLane {
  key: string
  title: string
  value: string
  detail: string
  tone: InventoryRiskTone
  icon: ReactNode
}

export interface InventoryRiskAction {
  label: string
  detail: string
  route: string
  tone: InventoryRiskTone
}

export function InventoryRiskCommandHeader({
  syncing,
  onSyncProducts,
}: {
  syncing: boolean
  onSyncProducts: () => void
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">inventory risk command</p>
        <h2 className="mt-1 text-lg font-bold text-[var(--color-fg)]">库存风险处理工作台</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          围绕平台店铺 Listing 处理缺货风险、库存资金占用、滞销风险和发货超期风险；缺少平台库存、订单或运营指标时只标出缺口，不用假数据补齐。
        </p>
      </div>
      <div className="inventory-risk-actions">
        <Link to="/products?tab=platform_store_products" className="inventory-alert-action px-3 py-2 text-xs font-medium">
          查看店铺商品
        </Link>
        <button
          type="button"
          onClick={onSyncProducts}
          disabled={syncing}
          className="inventory-alert-action px-3 py-2 text-xs font-medium disabled:opacity-50"
          title="同步平台商品库存；未接通真实商品 Open API 时会返回缺口，不会伪造同步成功。"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          同步平台商品库存
        </button>
        <Link to="/orders" className="inventory-alert-action px-3 py-2 text-xs font-medium">
          复核订单履约
        </Link>
        <Link to="/growth" className="inventory-alert-action px-3 py-2 text-xs font-medium">
          复核运营诊断
        </Link>
      </div>
    </div>
  )
}

export function InventoryRiskLaneGrid({ lanes }: { lanes: InventoryRiskLane[] }) {
  return (
    <div className="inventory-risk-grid mt-4">
      {lanes.map(lane => (
        <InventoryRiskLaneCard key={lane.key} lane={lane} />
      ))}
    </div>
  )
}

export function InventoryStockSourceSummary({ snapshot }: { snapshot: InventoryRiskWorkbenchSnapshot }) {
  return (
    <div className="inventory-alert-panel mt-4 p-3" data-ui="inventory-stock-source-summary">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">库存来源质量</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">区分 V5 SKU、店铺 Listing 库存、规则扫描预警和平台库存缺口；未知库存不按 0 处理。</p>
        </div>
        <Badge variant={snapshot.stock_sources.missing_platform_stock_count ? "warning" : "success"}>
          缺口 {snapshot.stock_sources.missing_platform_stock_count}
        </Badge>
      </div>
      <div className="inventory-stock-source-grid">
        {buildInventoryStockSourceCards(snapshot).map(item => (
          <article key={item.label} className="inventory-stock-source-card p-3">
            <p className="text-[11px] text-[var(--color-muted)]">{item.label}</p>
            <p className="mt-1 text-base font-bold text-[var(--color-fg)]">{item.value}</p>
          </article>
        ))}
      </div>
      {snapshot.supply_readiness ? (
        <div className="inventory-detail-row mt-3 p-3" data-ui="inventory-supply-readiness-summary">
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
  )
}

export function InventoryRiskActionQueue({
  actions,
  loading,
}: {
  actions: InventoryRiskAction[]
  loading?: boolean
}) {
  return (
    <div className="inventory-alert-panel mt-4 p-3">
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
            <Link key={`${action.label}-${action.detail}`} to={action.route} className="inventory-risk-action-card">
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
  )
}

export function SlowMovingOperationPanel({
  items,
  unifiedFieldDictionary,
  creatingOperation,
  onCreateOperationAction,
}: {
  items: InventoryRiskWorkbenchSnapshot["slow_moving"]["items"]
  unifiedFieldDictionary?: UnifiedFieldDictionary
  creatingOperation: boolean
  onCreateOperationAction: (listingId: string) => void
}) {
  if (!items.length) return null

  return (
    <div className="inventory-alert-panel mt-4 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">滞销 Listing 运营动作</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">有库存、有浏览但近30天无订单的 Listing，可直接生成 0 预算 Listing 优化台账，进入运营增长复盘。</p>
        </div>
        <Badge variant="warning">可生成 {items.length} 项</Badge>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        {items.map(item => (
          <article key={item.listing_id} className="inventory-detail-row p-3">
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
                <InventoryV5SkuFieldDictionary item={item} unifiedFieldDictionary={unifiedFieldDictionary} />
              </div>
              <button
                type="button"
                disabled={creatingOperation}
                onClick={() => onCreateOperationAction(item.listing_id)}
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
  )
}

function InventoryV5SkuFieldDictionary({
  item,
  unifiedFieldDictionary,
}: {
  item: InventoryRiskWorkbenchSnapshot["slow_moving"]["items"][number]
  unifiedFieldDictionary?: UnifiedFieldDictionary
}) {
  const rows = inventoryV5SkuFieldRows(item, unifiedFieldDictionary)
  return (
    <div data-ui="inventory-v5-sku-field-dictionary" className="mt-2 flex flex-wrap gap-1.5">
      {rows.map(row => (
        <span key={row.key} className="inventory-v5-field-chip">
          <span className="font-medium text-[var(--color-fg)]">{row.label}</span>
          <span className="mx-1">·</span>
          <span>{row.value}</span>
          {row.platformField ? <span className="ml-1 text-[var(--color-primary)]">({row.platformField})</span> : null}
        </span>
      ))}
    </div>
  )
}

type InventoryV5SkuFieldRow = {
  key: string
  label: string
  value: string
  platformField?: string
}

function InventoryRiskLaneCard({ lane }: { lane: InventoryRiskLane }) {
  const color = lane.tone === "danger" ? "var(--color-danger)" : lane.tone === "warning" ? "var(--color-warning)" : lane.tone === "success" ? "var(--color-success)" : "var(--color-primary)"
  return (
    <article className="inventory-risk-lane-card p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-surface)]" style={{ color }}>{lane.icon}</span>
        <Badge variant={lane.tone === "danger" ? "danger" : lane.tone === "warning" ? "warning" : lane.tone === "success" ? "success" : "outline"}>{lane.value}</Badge>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-[var(--color-fg)]">{lane.title}</h3>
      <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">{lane.detail}</p>
    </article>
  )
}

function inventoryV5SkuFieldRows(
  item: InventoryRiskWorkbenchSnapshot["slow_moving"]["items"][number],
  unifiedFieldDictionary?: UnifiedFieldDictionary,
): InventoryV5SkuFieldRow[] {
  const platformKey = normalizeInventoryPlatformKey(item.platform || "")
  const build = (key: string, value: string): InventoryV5SkuFieldRow => {
    const field = unifiedFieldDictionary?.fields.find(entry => entry.key === key)
    const platformField = platformKey ? field?.platforms?.[platformKey]?.field : undefined
    return {
      key,
      label: field?.label || inventoryFallbackLabel(key),
      value,
      platformField: platformField || field?.platforms?.miaoshou?.field || undefined,
    }
  }
  return [
    build("product_title", item.title || "标题待补"),
    build("sku_id", item.sku || "SKU待补"),
    build("sku_stock", `${item.stock ?? "库存待补"}`),
    build("sku_price", item.capital_rmb != null ? `占用 ¥${item.capital_rmb}` : "成本/售价待补"),
  ]
}

function inventoryFallbackLabel(key: string) {
  const labels: Record<string, string> = {
    product_title: "商品标题",
    sku_id: "SKU",
    sku_stock: "库存",
    sku_price: "售价/资金",
  }
  return labels[key] || key
}

function normalizeInventoryPlatformKey(platform: string) {
  const normalized = platform.toLowerCase().replace(/[\s-]+/g, "_")
  if (normalized.includes("tiktok")) return "tiktok"
  if (normalized.includes("temu")) return "temu"
  if (normalized.includes("shopee")) return "shopee"
  return normalized
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
