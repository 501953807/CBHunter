import type { PromotionCampaign, PromotionGovernanceSummary } from '../../api/promotions'

export function PromotionGovernancePanel({ summary }: { summary: PromotionGovernanceSummary }) {
  const platformText = Object.entries(summary.platform_counts || {})
    .map(([platform, count]) => `${platform.toUpperCase()} ${count}`)
    .join(' / ') || '暂无平台活动'
  const statusText = Object.entries(summary.status_counts || {})
    .map(([status, count]) => `${status} ${count}`)
    .join(' / ') || '暂无状态'
  const typeText = Object.entries(summary.type_counts || {})
    .map(([type, count]) => `${promotionTypeLabel(type)} ${count}`)
    .join(' / ') || '暂无活动类型'
  return (
    <section data-ui="promotion-governance-summary" className="grid gap-3 md:grid-cols-4">
      <PromotionGovernanceMetric label="活动对象" value={summary.campaign_count} note={`平台 ${summary.platform_count} · 店铺 ${summary.store_count}`} />
      <PromotionGovernanceMetric label="参与商品" value={summary.participating_item_count} note={`已定价 ${summary.priced_item_count} 个`} />
      <PromotionGovernanceMetric label="预计让利" value={formatMoney(summary.discount_amount_total)} note="只按活动明细计算，不代表平台成交" />
      <PromotionGovernanceMetric label="同步缺口" value={summary.platform_sync_gap_count} note={summary.next_action} tone={summary.platform_sync_gap_count > 0 ? 'warning' : 'success'} />
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 md:col-span-2">
        <p className="text-xs font-semibold text-[var(--color-fg)]">平台/店铺活动分布</p>
        <p className="mt-2 text-sm text-[var(--color-muted)]">{platformText}</p>
      </div>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <p className="text-xs font-semibold text-[var(--color-fg)]">活动类型</p>
        <p className="mt-2 text-sm text-[var(--color-muted)]">{typeText}</p>
      </div>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <p className="text-xs font-semibold text-[var(--color-fg)]">活动状态与运行边界</p>
        <p className="mt-2 text-sm text-[var(--color-muted)]">{statusText}</p>
        <p className="mt-1 text-[11px] text-[var(--color-muted)]">{summary.runtime_boundary}</p>
      </div>
    </section>
  )
}

function PromotionGovernanceMetric({
  label,
  value,
  note,
  tone = 'default',
}: {
  label: string
  value: string | number
  note: string
  tone?: 'default' | 'success' | 'warning'
}) {
  const color = tone === 'success' ? 'var(--color-success)' : tone === 'warning' ? 'var(--color-warning)' : 'var(--color-fg)'
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold" style={{ color }}>{value}</p>
      <p className="mt-1 text-xs text-[var(--color-muted)]">{note}</p>
    </div>
  )
}

export function normalizePromotionGovernanceSummary(
  summary: Record<string, unknown> | null | undefined,
  campaigns: PromotionCampaign[],
): PromotionGovernanceSummary {
  if (!summary) return buildPromotionGovernanceSummary(campaigns)
  return {
    campaign_count: Number(summary.campaign_count || 0),
    platform_count: Number(summary.platform_count || 0),
    store_count: Number(summary.store_count || 0),
    participating_item_count: Number(summary.participating_item_count || 0),
    priced_item_count: Number(summary.priced_item_count || 0),
    discount_amount_total: Number(summary.discount_amount_total || 0),
    local_campaign_count: Number(summary.local_campaign_count || 0),
    platform_sync_gap_count: Number(summary.platform_sync_gap_count || 0),
    platform_counts: isRecord(summary.platform_counts) ? summary.platform_counts as Record<string, number> : {},
    status_counts: isRecord(summary.status_counts) ? summary.status_counts as Record<string, number> : {},
    type_counts: isRecord(summary.type_counts) ? summary.type_counts as Record<string, number> : {},
    runtime_boundary: String(summary.runtime_boundary || 'promotion_campaign_local_object_not_platform_success'),
    next_action: String(summary.next_action || '继续维护活动商品与活动价'),
  }
}

export function buildPromotionGovernanceSummary(campaigns: PromotionCampaign[]): PromotionGovernanceSummary {
  const platformCounts: Record<string, number> = {}
  const storeCounts: Record<string, number> = {}
  const statusCounts: Record<string, number> = {}
  const typeCounts: Record<string, number> = {}
  let participatingItemCount = 0
  let pricedItemCount = 0
  let discountAmountTotal = 0
  let localCampaignCount = 0
  let platformSyncGapCount = 0
  campaigns.forEach((campaign) => {
    platformCounts[campaign.platform] = (platformCounts[campaign.platform] || 0) + 1
    storeCounts[campaign.store.id] = (storeCounts[campaign.store.id] || 0) + 1
    statusCounts[campaign.status] = (statusCounts[campaign.status] || 0) + 1
    typeCounts[campaign.promotion_type] = (typeCounts[campaign.promotion_type] || 0) + 1
    participatingItemCount += campaign.product_count || 0
    pricedItemCount += campaign.price_summary?.priced_item_count || 0
    discountAmountTotal += campaign.price_summary?.discount_amount_total || 0
    if (campaign.source === 'local') {
      localCampaignCount += 1
      if (!campaign.external_promotion_id) platformSyncGapCount += 1
    }
  })
  return {
    campaign_count: campaigns.length,
    platform_count: Object.keys(platformCounts).length,
    store_count: Object.keys(storeCounts).length,
    participating_item_count: participatingItemCount,
    priced_item_count: pricedItemCount,
    discount_amount_total: Number(discountAmountTotal.toFixed(2)),
    local_campaign_count: localCampaignCount,
    platform_sync_gap_count: platformSyncGapCount,
    platform_counts: platformCounts,
    status_counts: statusCounts,
    type_counts: typeCounts,
    runtime_boundary: 'promotion_campaign_local_object_not_platform_success',
    next_action: platformSyncGapCount > 0 ? '配置平台促销 Open API 后同步活动' : '继续维护活动商品与活动价',
  }
}

function promotionTypeLabel(type: string) {
  const labels: Record<string, string> = {
    discount: '折扣',
    coupon: '优惠券',
    flash_sale: '秒杀',
    affiliate: '联盟',
  }
  return labels[type] || type
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function isRecord(value: unknown): value is Record<string, number> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
