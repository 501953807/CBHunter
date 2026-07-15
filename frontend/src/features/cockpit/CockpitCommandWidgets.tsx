import type { ReactNode } from 'react'
import { AlertTriangle, ArrowRight, CheckCircle2, FileWarning } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import type { CockpitData, CockpitSection, CockpitSourceRef } from '../../types/cockpit'
import { labelBusinessCode } from '../../utils/businessLabels'

export type SourceSection = Pick<CockpitSection<any, any>, 'status' | 'source_count' | 'source_refs' | 'evidence_window' | 'gaps' | 'actions'>

export interface ActionItem {
  key: string
  title: string
  detail: string
  level: 'danger' | 'warning' | 'info'
  route: string
  sourceRefs: CockpitSourceRef[]
}

export function StatusPill({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 text-xs">
      <span className="text-[var(--color-primary)]">{icon}</span>
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="font-semibold text-[var(--color-fg)]">{value}</span>
    </div>
  )
}

export function CommandPanel({ title, icon, section, onOpen, children }: { title: string; icon: ReactNode; section: SourceSection; onOpen: () => void; children: ReactNode }) {
  return (
    <section className="min-h-[260px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
      <div className="flex items-center gap-2">
        <span className="text-[var(--color-primary)]">{icon}</span>
        <h2 className="text-sm font-semibold text-[var(--color-fg)]">{title}</h2>
        <Badge variant={section.status === 'ready' ? 'success' : 'warning'} className="ml-auto">{section.status === 'ready' ? '真实数据' : '待补数据'}</Badge>
        <button onClick={onOpen} title={`打开${title}`} className="rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-primary)]">
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 space-y-3">{children}</div>
      <EvidenceFooter section={section} />
    </section>
  )
}

export function Mini({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'warning' | 'danger' }) {
  const toneClass = tone === 'danger' ? 'text-[var(--color-danger)]' : tone === 'warning' ? 'text-[var(--color-warning)]' : 'text-[var(--color-fg)]'
  return (
    <div className="min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
      <p className="truncate text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className={`mt-1 truncate text-sm font-semibold ${toneClass}`}>{value}</p>
    </div>
  )
}

export function DenseRows({ rows, empty }: { rows: { key: string; title: string; detail: string; value: string; danger?: boolean }[]; empty: string }) {
  if (rows.length === 0) return <p className="rounded-md border border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">{empty}</p>
  return (
    <div className="space-y-1.5">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-2 rounded-md bg-[var(--color-bg)] px-2 py-1.5 text-xs">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-[var(--color-fg)]">{row.title}</p>
            <p className="truncate text-[11px] text-[var(--color-muted)]">{row.detail}</p>
          </div>
          <span className={row.danger ? 'text-[var(--color-danger)]' : 'text-[var(--color-fg)]'}>{row.value}</span>
        </div>
      ))}
    </div>
  )
}

export function LevelIcon({ level }: { level: ActionItem['level'] }) {
  if (level === 'danger') return <FileWarning className="mt-0.5 h-4 w-4 text-[var(--color-danger)]" />
  if (level === 'warning') return <AlertTriangle className="mt-0.5 h-4 w-4 text-[var(--color-warning)]" />
  return <CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--color-info)]" />
}

export function buildActionQueue(data: CockpitData): ActionItem[] {
  const s = data.sections
  const queue: ActionItem[] = []
  const riskItems = s.risk_summary?.items ?? []
  const flowItems = s.flow_summary?.items ?? []
  riskItems.forEach((item) => queue.push({
    key: `risk-${item.key}`,
    title: `风险：${item.title}`,
    detail: item.detail,
    level: item.severity === 'critical' ? 'danger' : 'warning',
    route: item.route,
    sourceRefs: [{ type: item.object_type, id: item.object_id, label: item.title, meta: { route: item.route } }],
  }))
  flowItems.filter((item) => item.status !== 'ready').forEach((item) => queue.push({
    key: `flow-${item.stage_key}`,
    title: `链路待处理：${item.label}`,
    detail: item.gap || item.next_action,
    level: 'info',
    route: item.route,
    sourceRefs: item.source_refs,
  }))
  s.alerts.items.forEach((item) => queue.push({
    key: `alert-${item.id}`,
    title: `库存预警：${item.product_name}`,
    detail: `${item.severity} · 当前 ${item.current_stock} 件，阈值 ${item.threshold}`,
    level: item.severity === 'critical' ? 'danger' : 'warning',
    route: '/inventory-alerts',
    sourceRefs: [{ type: 'inventory_alert', id: item.id }],
  }))
  s.product_operations.items.filter((item) => item.pending_count > 0).forEach((item) => queue.push({
    key: `product-ops-${item.listing_id}`,
    title: `商品运营待复盘：${item.title}`,
    detail: `${item.diagnostic_title} · ${item.review_result || item.effect_summary || '需要填写运营台账复盘结果'}`,
    level: 'warning',
    route: '/growth',
    sourceRefs: s.product_operations.source_refs,
  }))
  s.reports.items.forEach((item) => queue.push({
    key: `report-${item.metric}`,
    title: `报表异常：${item.metric}`,
    detail: `预期 ${item.expected}，实际 ${item.actual}，偏差 ${item.deviation_pct}%`,
    level: 'warning',
    route: '/reports',
    sourceRefs: s.reports.source_refs,
  }))
  s.ai_suggestions.items.filter((item) => item.severity === 'critical').forEach((item) => queue.push({
    key: `ai-${item.id}`,
    title: `AI 建议：${item.title}`,
    detail: item.confidence_reason || item.evidence_window || '等待补充建议资料',
    level: 'info',
    route: '/ai-suggestions',
    sourceRefs: item.source_refs,
  }))
  s.competitors.items.filter((item) => item.price != null && item.previous_price != null && item.price !== item.previous_price).forEach((item) => queue.push({
    key: `competitor-${item.id}`,
    title: `竞品价格变化：${item.name}`,
    detail: `${item.platform} · ${item.previous_price} -> ${item.price}`,
    level: 'warning',
    route: '/monitor',
    sourceRefs: [{ type: 'competitor_product', id: item.id }],
  }))
  const actionableSections = [
    { key: 'finance', section: s.finance },
    { key: 'inventory', section: s.inventory },
    { key: 'orders', section: s.orders },
  ]
  actionableSections.forEach(({ key, section }) => (section.actions || []).forEach((action, index) => queue.push({
    key: `action-${key}-${index}`,
    title: action.label,
    detail: action.reason,
    level: key === 'finance' && s.finance.metrics.net_profit_rmb != null && s.finance.metrics.net_profit_rmb < 0 ? 'danger' : 'warning',
    route: action.route,
    sourceRefs: section.source_refs,
  })))
  const gapSections = [
    { key: 'orders', title: '订单数据缺口', route: '/orders', section: s.orders },
    { key: 'finance', title: '财务数据缺口', route: '/finance', section: s.finance },
    { key: 'inventory', title: '库存数据缺口', route: '/inventory-alerts', section: s.inventory },
  ]
  gapSections.forEach(({ key, title, route, section }) => section.gaps.forEach((gap, index) => queue.push({
    key: `gap-${key}-${index}`,
    title,
    detail: labelBusinessCode(gap),
    level: 'warning',
    route,
    sourceRefs: section.source_refs,
  })))
  return queue.slice(0, 12)
}

export function mergeSourceRefs(sections: SourceSection[]) {
  const seen = new Set<string>()
  return sections.flatMap((section) => section?.source_refs ?? []).filter((ref) => {
    const key = `${ref.type}-${ref.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function mergeSection(primary: SourceSection, secondary: SourceSection): SourceSection {
  return {
    status: primary?.status === 'ready' && secondary?.status === 'ready' ? 'ready' : 'data_required',
    source_count: (primary?.source_count ?? 0) + (secondary?.source_count ?? 0),
    source_refs: mergeSourceRefs([primary, secondary]),
    evidence_window: `${primary?.evidence_window || '数据范围待补'}；${secondary?.evidence_window || '数据范围待补'}`,
    gaps: [...(primary?.gaps ?? []), ...(secondary?.gaps ?? [])],
    actions: [...(primary?.actions || []), ...(secondary?.actions || [])],
  }
}

export function money(value: number | null) {
  return value == null ? '待补数据' : `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
}

export function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function EvidenceFooter({ section }: { section: SourceSection }) {
  return (
    <div className="mt-3 border-t border-[var(--color-border)] pt-2">
      {section.gaps.length > 0 && section.gaps.slice(0, 2).map((gap) => (
        <p key={gap} className="text-[11px] text-[var(--color-warning)]">{labelBusinessCode(gap)}</p>
      ))}
      <p className="mt-1 truncate text-[11px] text-[var(--color-muted)]">来源 {section.source_count} 条 · {section.evidence_window}</p>
    </div>
  )
}
