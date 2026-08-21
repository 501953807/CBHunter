import { ArrowRight } from 'lucide-react'
import { PlatformFieldGroupSummary, type PlatformRequirementsLike } from '../../components/shared/PlatformFieldGroups'
import { productImageSrc } from '../../utils/productImages'
import {
  mediaSourceLabel,
  pricingTemplateSnapshot,
  type PublishableItem,
  type PublishReadiness,
} from './BatchPublishSelectUtils'

export function TargetChipGroup({
  title,
  items,
  selected,
  onToggle,
  emptyText = '暂无可选项',
  tone = 'primary',
}: {
  title: string
  items: Array<{ id: string; label: string; meta?: string }>
  selected: Set<string>
  onToggle: (id: string) => void
  emptyText?: string
  tone?: 'primary' | 'success'
}) {
  return (
    <div className="batch-publish-panel rounded-[var(--radius-xl)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--color-fg)]">{title}</p>
        <span className="text-[11px] text-[var(--color-muted)]">已选 {selected.size}</span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted)]">{emptyText}</p>
      ) : (
        <div className="max-h-28 overflow-y-auto">
          <div className="flex flex-wrap gap-2 pr-1">
            {items.map(item => {
              const checked = selected.has(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onToggle(item.id)}
                  className="batch-publish-chip rounded-full px-3 py-1.5 text-left text-xs transition"
                  data-active={checked ? 'true' : 'false'}
                  data-tone={tone}
                >
                  <span className="font-medium">{item.label}</span>
                  {item.meta && <span className="ml-1 opacity-80">{item.meta}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function SelectBox({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<[string, string]>
  onChange: (value: string) => void
}) {
  return (
    <label className="text-xs text-[var(--color-muted)]">
      {label}
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]"
      >
        {options.map(([id, optionLabel]) => (
          <option key={id} value={id}>{optionLabel}</option>
        ))}
      </select>
    </label>
  )
}

export function PublishGateCard({ label, value, detail, ok }: { label: string; value: string; detail: string; ok: boolean }) {
  return (
    <div className="batch-publish-gate-card rounded-[var(--radius-xl)] border p-3" data-ok={ok ? 'true' : 'false'}>
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className={ok ? 'mt-1 text-lg font-semibold text-[var(--color-success)]' : 'mt-1 text-lg font-semibold text-[var(--color-warning)]'}>{value}</p>
      <p className="mt-1 text-[11px] text-[var(--color-muted)]">{detail}</p>
    </div>
  )
}

export function PublishImageHoverPreview({ imageUrl, name }: { imageUrl: string; name: string }) {
  const src = productImageSrc(imageUrl)
  return (
    <div data-ui="publish-image-hover-preview" className="group relative h-12 w-12 shrink-0">
      <img
        src={src}
        alt={name}
        className="h-12 w-12 rounded-lg border object-cover"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      />
      <div className="pointer-events-none absolute left-0 top-0 z-30 hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-lg)] group-hover:block">
        <img
          src={src}
          alt={`${name} 放大预览`}
          className="h-24 w-24 origin-top-left scale-100 rounded-lg object-cover transition-transform duration-150 group-hover:scale-[2.8]"
        />
      </div>
    </div>
  )
}

export function PlatformFieldGroupDisclosure({ label, requirements }: { label: string; requirements?: PlatformRequirementsLike }) {
  const requiredCount = requirements?.required_attributes?.length ?? 0
  const groupCount = Array.isArray(requirements?.field_groups) ? requirements.field_groups.length : 0
  return (
    <details className="rounded-lg border border-[var(--color-border)] p-2" aria-label="字段组默认折叠">
      <summary className="cursor-pointer list-none text-[11px] font-semibold text-[var(--color-fg)]">
        <span className="inline-flex w-full items-center justify-between gap-2">
          <span>{label}</span>
          <span className={requiredCount ? 'text-[var(--color-warning)]' : 'text-[var(--color-muted)]'}>
            {groupCount} 组 · 必填 {requiredCount}
          </span>
        </span>
      </summary>
      <div className="mt-2">
        <PlatformFieldGroupSummary requirements={requirements} compact maxGroups={2} />
      </div>
    </details>
  )
}

export function PublishGateStack({ item, readiness, disabledReason }: { item: PublishableItem; readiness: PublishReadiness; disabledReason?: string }) {
  if (disabledReason) return <span className="text-[var(--color-warning)]">{disabledReason}</span>
  return (
    <div className="grid gap-1" aria-label="发布门禁状态">
      <GatePill label="母版" ok={readiness.masterReady} detail={item.listingMasterStatus?.label || (readiness.masterReady ? '已确认' : '待补')} />
      {!readiness.masterReady && <RepairAction href={repairHref(item, 'fields')} label="完善母版" />}
      <GatePill label="发布图" ok={readiness.mediaReady} detail={readiness.mediaLabel} />
      {!readiness.mediaReady && <RepairAction href={repairHref(item, 'media')} label="补齐发布图" />}
      <GatePill label="字段" ok={readiness.fieldReady} detail={readiness.missingAttrs.length ? `缺 ${readiness.missingAttrs.length}` : '通过'} />
      {!readiness.fieldReady && <RepairAction href={repairHref(item, 'fields')} label="补齐字段" />}
      <GatePill label="价格" ok={readiness.priceReady} detail={readiness.priceReady ? '已确认' : '待确认'} />
      {!readiness.priceReady && <RepairAction href={repairHref(item, 'pricing')} label="确认定价" />}
      <GatePill label="目标" ok={readiness.targetReady} detail={readiness.targetReady ? '已选' : '待选'} />
      {!readiness.targetReady && <RepairAction href="#target-store-panel" label="补齐目标" />}
    </div>
  )
}

export function ListingMasterSummary({ status }: { status?: PublishableItem['listingMasterStatus'] }) {
  const ready = status?.ready ?? true
  return (
    <div className={ready
      ? 'rounded-lg border border-[var(--color-success-light)] bg-[var(--color-success-light)] p-2 text-[11px]'
      : 'rounded-lg border border-[var(--color-warning-light)] bg-[var(--color-warning-light)] p-2 text-[11px]'
    } aria-label="统一 Listing 母版摘要">
      <p className={ready ? 'font-semibold text-[var(--color-success)]' : 'font-semibold text-[var(--color-warning)]'}>
        {status?.label || '本地 Listing 草稿'}
      </p>
      <p className={ready ? 'mt-1 text-[var(--color-success)]' : 'mt-1 text-[var(--color-warning)]'}>
        {status?.detail || (ready ? '可进入店铺刊登草稿' : '标题、卖点、描述或合规尚未确认')}
      </p>
    </div>
  )
}

export function ListingOverrideSummary({ override }: { override?: PublishableItem['listingStoreOverride'] }) {
  if (!override || !override.store_label) {
    return (
      <p className="rounded-lg border border-dashed border-[var(--color-border)] px-2 py-1.5 text-[11px] text-[var(--color-muted)]">
        未保存店铺覆盖草稿
      </p>
    )
  }
  return (
    <div className="space-y-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-[11px]" aria-label="店铺覆盖字段摘要">
      <p className="font-semibold text-[var(--color-fg)]">{override.store_label}</p>
      <p className="line-clamp-1 text-[var(--color-muted)]">{override.title || '标题沿用基础内容'}</p>
      <div className="flex flex-wrap gap-1">
        <MiniState label="SKU" ok={(override.sku_count || 0) > 0} value={`${override.sku_count || 0}`} />
        <MiniState label="属性" ok={Boolean(override.has_platform_attributes)} value={override.has_platform_attributes ? '已补' : '待补'} />
        <MiniState label="物流" ok={Boolean(override.has_logistics)} value={override.has_logistics ? '已补' : '待补'} />
        <MiniState label="合规" ok={Boolean(override.has_compliance)} value={override.has_compliance ? '已补' : '待补'} />
      </div>
    </div>
  )
}

function MiniState({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <span className={ok ? 'rounded-full bg-[var(--color-success-light)] px-2 py-0.5 text-[var(--color-success)]' : 'rounded-full bg-[var(--color-warning-light)] px-2 py-0.5 text-[var(--color-warning)]'}>
      {label}:{value}
    </span>
  )
}

function GatePill({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <span className={ok ? 'inline-flex items-center justify-between gap-2 rounded-full bg-[var(--color-success-light)] px-2 py-0.5 text-[11px] text-[var(--color-success)]' : 'inline-flex items-center justify-between gap-2 rounded-full bg-[var(--color-warning-light)] px-2 py-0.5 text-[11px] text-[var(--color-warning)]'}>
      <span>{label}</span>
      <span>{detail}</span>
    </span>
  )
}

function RepairAction({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--color-primary)] px-2 py-0.5 text-[11px] text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]">
      {label}<ArrowRight className="h-3 w-3" />
    </a>
  )
}

function repairHref(item: PublishableItem, section: 'media' | 'fields' | 'pricing') {
  if (section === 'pricing') {
    return item.sourceType === 'product'
      ? `/pricing?product_id=${encodeURIComponent(item.id)}`
      : `/pricing?sourcing_item_id=${encodeURIComponent(item.id)}`
  }
  const targetSection = section === 'media' ? 'media' : 'attributes'
  if (item.sourceType === 'product') {
    return `/products/${encodeURIComponent(item.id)}/edit?listing_section=${targetSection}`
  }
  return `/content?sourcing_item_id=${encodeURIComponent(item.id)}&listing_section=${targetSection}`
}

export function ItemTargetContext({
  item,
  platformLabelMap,
  marketLabelMap,
  storeLabelMap,
}: {
  item: PublishableItem
  platformLabelMap: Map<string, string>
  marketLabelMap: Map<string, string>
  storeLabelMap: Map<string, string>
}) {
  const platforms = (item.targetPlatforms || []).map(id => platformLabelMap.get(id) || id.toUpperCase())
  const markets = (item.targetMarkets || []).map(id => marketLabelMap.get(id) || id.toUpperCase())
  const stores = (item.targetStoreIds || []).map(id => storeLabelMap.get(id) || id)

  if (platforms.length === 0 && markets.length === 0 && stores.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[var(--color-border)] px-2 py-1.5 text-[11px] text-[var(--color-muted)]">
        待选择目标平台/市场/店铺
      </p>
    )
  }

  return (
    <div className="space-y-1 text-[11px]" aria-label="商品目标归属">
      {platforms.length > 0 && <TargetLine label="平台" values={platforms} />}
      {markets.length > 0 && <TargetLine label="市场" values={markets} />}
      {stores.length > 0 && <TargetLine label="店铺" values={stores} />}
    </div>
  )
}

function TargetLine({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="flex min-w-0 gap-1">
      <span className="shrink-0 text-[var(--color-muted)]">{label}</span>
      <span className="line-clamp-2 font-medium text-[var(--color-fg)]">{values.join('、')}</span>
    </div>
  )
}

export function PriceTemplateLine({ item }: { item: PublishableItem }) {
  const snapshot = pricingTemplateSnapshot(item)
  if (!snapshot) return null
  return (
    <p className="mt-1 text-[11px] text-[var(--color-muted)]">
      定价模板：{String(snapshot.name || snapshot.template_name || '已绑定')}
    </p>
  )
}

export { mediaSourceLabel }
