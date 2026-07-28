import { Badge } from '../../components/ui/Badge'
import type { BatchListingDraft, ListingValidationCheck } from '../../api/listing'

type SkuReadinessDetails = {
  active_sku_count?: number
  blocking_gaps?: string[]
  warning_gaps?: string[]
  rows?: Array<{
    index?: number
    sku?: string
    variation?: string
    blocking?: string[]
    warnings?: string[]
  }>
}

export function BatchPublishSkuReadinessPanel({
  draft,
  check,
}: {
  draft: BatchListingDraft
  check?: ListingValidationCheck
}) {
  const details = skuReadinessDetails(check)
  if (!check || (!details.blocking_gaps.length && !details.warning_gaps.length && !details.rows.length)) {
    return null
  }
  return (
    <div
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5"
      aria-label="SKU发布准备度结构化缺口"
      data-ui="sku-publish-readiness-details"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold text-[var(--color-fg)]">SKU发布准备度</p>
          <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">
            后端发布门禁 · 启用 SKU {details.active_sku_count ?? 0} 条
          </p>
        </div>
        <Badge variant={details.blocking_gaps.length ? 'danger' : 'warning'}>
          {details.blocking_gaps.length ? `${details.blocking_gaps.length} 阻断` : `${details.warning_gaps.length} 建议`}
        </Badge>
      </div>

      {details.blocking_gaps.length > 0 && (
        <GapList title="阻断缺口" tone="danger" gaps={details.blocking_gaps} />
      )}
      {details.warning_gaps.length > 0 && (
        <GapList title="建议补充" tone="warning" gaps={details.warning_gaps} />
      )}

      {details.rows.length > 0 && (
        <div className="mt-2 space-y-1">
          <p className="text-[10px] font-medium text-[var(--color-muted)]">SKU行级校验</p>
          {details.rows.slice(0, 6).map(row => (
            <div key={`${row.index ?? 0}-${row.sku || 'sku'}`} className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[11px] font-semibold text-[var(--color-fg)]">
                  {row.sku || `第 ${(row.index ?? 0) + 1} 条 SKU`}
                </p>
                <span className="shrink-0 text-[10px] text-[var(--color-muted)]">{row.variation || '规格待补'}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {(row.blocking || []).map(gap => <SkuChip key={`b-${gap}`} label={`阻断 ${gap}`} tone="danger" />)}
                {(row.warnings || []).map(gap => <SkuChip key={`w-${gap}`} label={`建议 ${gap}`} tone="warning" />)}
              </div>
            </div>
          ))}
        </div>
      )}

      <a
        href={skuRepairHref(draft)}
        className="mt-2 inline-flex text-[10px] font-medium text-[var(--color-primary)] hover:underline"
        data-ui="sku-readiness-content-link"
      >
        回内容工厂补 SKU/规格
      </a>
    </div>
  )
}

export function skuReadinessDetails(check?: ListingValidationCheck): Required<SkuReadinessDetails> {
  const raw = check?.details || {}
  return {
    active_sku_count: numberOrZero(raw.active_sku_count),
    blocking_gaps: stringArray(raw.blocking_gaps),
    warning_gaps: stringArray(raw.warning_gaps),
    rows: Array.isArray(raw.rows) ? raw.rows.filter(isSkuRow).map(row => ({
      index: typeof row.index === 'number' ? row.index : 0,
      sku: typeof row.sku === 'string' ? row.sku : '',
      variation: typeof row.variation === 'string' ? row.variation : '',
      blocking: stringArray(row.blocking),
      warnings: stringArray(row.warnings),
    })) : [],
  }
}

function GapList({ title, tone, gaps }: { title: string; tone: 'danger' | 'warning'; gaps: string[] }) {
  return (
    <div className="mt-2 space-y-1">
      <p className="text-[10px] font-medium" style={{ color: tone === 'danger' ? 'var(--color-danger)' : 'var(--color-warning)' }}>{title}</p>
      {gaps.slice(0, 4).map(gap => (
        <p key={gap} className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[10px] text-[var(--color-muted)]">
          {gap}
        </p>
      ))}
      {gaps.length > 4 && <p className="text-[10px] text-[var(--color-muted)]">还有 {gaps.length - 4} 个 SKU 缺口，请回内容工厂补齐。</p>}
    </div>
  )
}

function SkuChip({ label, tone }: { label: string; tone: 'danger' | 'warning' }) {
  return (
    <span
      className="rounded-full border px-1.5 py-0.5 text-[10px]"
      style={{
        borderColor: tone === 'danger' ? 'var(--color-danger)' : 'var(--color-warning)',
        color: tone === 'danger' ? 'var(--color-danger)' : 'var(--color-warning)',
      }}
    >
      {label}
    </span>
  )
}

function skuRepairHref(draft: BatchListingDraft) {
  const params = new URLSearchParams()
  if (draft.source_product_id) params.set('product_id', String(draft.source_product_id))
  if (draft.sourcing_item_id) params.set('source_id', String(draft.sourcing_item_id))
  if (draft.platform) params.set('platform', draft.platform)
  if (draft.store?.id) params.set('store_id', String(draft.store.id))
  if (draft.market) params.set('market', draft.market)
  params.set('section', 'sku')
  return `/content?${params.toString()}`
}

function numberOrZero(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : []
}

function isSkuRow(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
