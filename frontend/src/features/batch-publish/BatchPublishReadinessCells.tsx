import type { PublishableItem } from './BatchPublishSelectStep'

export function PricingSnapshotBadge({ item }: { item: PublishableItem }) {
  const snapshot = pricingTemplateSnapshot(item)
  if (!snapshot) {
    return (
      <p className="mt-1 rounded-full bg-[var(--color-warning-light)] px-2 py-0.5 text-[11px] text-[var(--color-warning)]" data-ui="batch-publish-pricing-snapshot-status">
        定价快照待确认
      </p>
    )
  }
  const templateLabel = stringValue(snapshot.pricing_template_label) || stringValue(snapshot.fee_template_label) || item.pricingSourceLabel || '已确认定价模板'
  return (
    <p className="mt-1 rounded-full bg-[var(--color-success-light)] px-2 py-0.5 text-[11px] text-[var(--color-success)]" data-ui="batch-publish-pricing-snapshot-status">
      定价快照：{templateLabel}
    </p>
  )
}

export function PublishMediaSkuSummary({ item }: { item: PublishableItem }) {
  const captured = item.mediaReadiness?.captured_image_count ?? item.listingStoreOverride?.image_count ?? (item.imageUrl ? 1 : 0)
  const minImages = item.mediaReadiness?.min_platform_images ?? 5
  const retainedImages = item.mediaReadiness?.retained_image_count ?? 0
  const mediaSource = mediaSourceLabel(item.mediaReadiness?.source)
  const mediaSourceTrusted = item.mediaReadiness?.source === 'confirmed_image_slot_plan' || item.mediaReadiness?.source === 'listing_image_slot_plan'
  const skuCount = item.listingStoreOverride?.sku_count ?? 0
  const mappingCount = item.listingStoreOverride?.sku_platform_mapping_count ?? 0
  const mappingGapCount = item.listingStoreOverride?.sku_platform_mapping_gap_count ?? 0
  return (
    <div className="space-y-1 text-[11px]" data-ui="batch-publish-media-sku-readiness-summary">
      <ReadinessMiniState label="发布图" ok={captured >= minImages && mediaSourceTrusted} value={`${captured}/${minImages}`} />
      {retainedImages > 0 && <ReadinessMiniState label="素材池" ok value={`${retainedImages}`} />}
      <ReadinessMiniState label="来源" ok={mediaSourceTrusted} value={mediaSource} />
      <ReadinessMiniState label="SKU" ok={skuCount > 0} value={`${skuCount}`} />
      <ReadinessMiniState label="平台映射" ok={mappingCount > 0 && mappingGapCount === 0} value={mappingGapCount ? `缺${mappingGapCount}` : `${mappingCount}`} />
      <p className="line-clamp-2 text-[var(--color-muted)]">
        {mappingCount > 0 ? '内容工厂SKU映射已进入发布前校验' : '待从内容工厂保存SKU平台映射'}
      </p>
    </div>
  )
}

function ReadinessMiniState({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <span className={ok ? 'rounded-full bg-[var(--color-success-light)] px-2 py-0.5 text-[var(--color-success)]' : 'rounded-full bg-[var(--color-warning-light)] px-2 py-0.5 text-[var(--color-warning)]'}>
      {label}:{value}
    </span>
  )
}

function pricingTemplateSnapshot(item: PublishableItem) {
  const confirmation = item.pricingConfirmation
  if (!confirmation || typeof confirmation !== 'object') return null
  const snapshot = confirmation.pricing_template_snapshot
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null
  return snapshot as Record<string, unknown>
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function mediaSourceLabel(source?: string) {
  if (source === 'confirmed_image_slot_plan' || source === 'listing_image_slot_plan') return '图片槽位计划'
  if (source === 'stored_media_readiness') return '历史就绪度'
  return '原始素材'
}
