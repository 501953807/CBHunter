import { ExternalLink, Send } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { PlatformFieldGroupSummary, type PlatformRequirementsLike } from '../../components/shared/PlatformFieldGroups'
import type { ListingInstanceMatrixItem, ProductListingMatrix } from '../../api/listing'
import type { ProductListing } from '../../types/product'

type FieldEvidenceGap = { key: string; label: string; group: string; state: string }

export function ListingMasterMatrixPanel({
  matrix,
  matrixInstances,
  selectedListingId,
  loadingMatrix,
  onCreateDraft,
  onSelectListing,
}: {
  matrix: ProductListingMatrix
  matrixInstances: ListingInstanceMatrixItem[]
  selectedListingId?: string
  loadingMatrix: boolean
  onCreateDraft: () => void
  onSelectListing: (id: string) => void
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-muted)]">展示“商品主档 → 基础版本 → 平台/店铺 Listing 实例”矩阵；店铺级覆盖字段只影响当前 Listing。</p>
        <Button size="sm" onClick={onCreateDraft}>
          <Send className="mr-1 h-4 w-4" />创建 Listing 草稿
        </Button>
      </div>

      <div className="grid gap-3 xl:grid-cols-[280px_1fr]">
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <p className="text-xs font-semibold text-[var(--color-fg)]">商品主档</p>
          <p className="mt-2 line-clamp-2 text-sm font-medium text-[var(--color-fg)]">{matrix.product_master.name}</p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">SKU：{matrix.product_master.sku}</p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">成本：{matrix.product_master.cost_price == null ? '待补' : `¥${matrix.product_master.cost_price}`} · 重量：{matrix.product_master.weight_g == null ? '待补' : `${matrix.product_master.weight_g}g`}</p>
          <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
            <p className="text-[11px] font-semibold text-[var(--color-fg)]">基础版本</p>
            <p className="mt-1 text-[11px] text-[var(--color-muted)]">版本：{String(matrix.base_version.version || 1)}</p>
            <p className="mt-1 line-clamp-2 text-[11px] text-[var(--color-muted)]">标题基稿：{String(matrix.base_version.title || matrix.product_master.name)}</p>
          </div>
          <p className="mt-3 text-[11px] text-[var(--color-warning)]">规则：修改店铺 Listing 不会自动回写商品主档；需要沉淀为通用能力时必须生成新基础版本。</p>
        </section>

        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold text-[var(--color-fg)]">平台/店铺 Listing 实例矩阵</p>
            {loadingMatrix && <span className="text-[11px] text-[var(--color-muted)]">刷新中...</span>}
          </div>
          {matrixInstances.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted)]">暂无平台/店铺 Listing 实例，点击右上角进入批量刊登创建。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--color-bg)] text-[var(--color-muted)]">
                  <tr><th className="px-3 py-2">平台/店铺</th><th className="px-3 py-2">店铺覆盖内容</th><th className="px-3 py-2">价格库存</th><th className="px-3 py-2">字段缺口</th><th className="px-3 py-2">状态</th><th className="px-3 py-2">操作</th></tr>
                </thead>
                <tbody>{matrixInstances.map(item => <tr key={item.id} className={`border-t border-[var(--color-border)] align-top ${selectedListingId === item.id ? 'bg-[var(--color-primary-light)]' : ''}`}>
                  <td className="px-3 py-3"><Badge>{item.platform.toUpperCase()}</Badge><p className="mt-2 text-[var(--color-fg)]">{item.store.account_name}</p><p className="text-[11px] text-[var(--color-muted)]">{item.store.market || '市场待补'}</p></td>
                  <td className="min-w-72 px-3 py-3"><p className="line-clamp-2 text-sm text-[var(--color-fg)]">{item.title}</p><p className="mt-1 text-[11px] text-[var(--color-muted)]">覆盖字段：{Object.keys(item.listing_overrides || {}).length || 0} 项 · SKU/变体 {item.variations?.length || 0}</p></td>
                  <td className="px-3 py-3 text-[var(--color-fg)]">{item.price.toLocaleString()}<p className="mt-1 text-[var(--color-muted)]">库存 {item.stock}</p></td>
                  <td className="min-w-72 px-3 py-3"><PlatformFieldGroupSummary requirements={item.platform_requirements} compact maxGroups={1} /></td>
                  <td className="px-3 py-3"><Badge variant={item.status === 'active' ? 'success' : 'default'}>{item.status}</Badge><p className="mt-2 text-[11px] text-[var(--color-muted)]">{item.platform_publish_status || item.platform_api_status || '本地草稿'}</p></td>
                  <td className="px-3 py-3"><Button size="sm" variant="secondary" onClick={() => onSelectListing(item.id)}>编辑</Button></td>
                </tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  )
}

export function LegacyListingsTable({ listings }: { listings: ProductListing[] }) {
  if (listings.length === 0) {
    return <p className="rounded-lg border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-muted)]">暂无关联 Listing，点击右上角进入批量刊登。</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
      <table className="w-full text-left text-xs">
        <thead className="bg-[var(--color-bg)] text-[var(--color-muted)]">
          <tr><th className="px-3 py-2">平台 Listing</th><th className="px-3 py-2">价格库存</th><th className="px-3 py-2">字段组</th><th className="px-3 py-2">发布状态</th><th className="px-3 py-2">发布计划</th><th className="px-3 py-2">操作</th></tr>
        </thead>
        <tbody>{listings.map(item => <tr key={item.id} className="border-t border-[var(--color-border)] align-top">
          <td className="px-3 py-3"><Badge>{item.platform.toUpperCase()}</Badge><p className="mt-2 line-clamp-2 text-sm text-[var(--color-fg)]">{item.title}</p><p className="mt-1 text-[11px] text-[var(--color-muted)]">{item.account_name}</p></td>
          <td className="px-3 py-3 text-[var(--color-fg)]">{item.price.toLocaleString()}<p className="mt-1 text-[var(--color-muted)]">库存 {item.stock}</p></td>
          <td className="min-w-80 px-3 py-3"><PlatformFieldGroupSummary requirements={listingRequirements(item)} compact maxGroups={2} /></td>
          <td className="px-3 py-3"><Badge variant={item.status === 'active' ? 'success' : 'default'}>{item.status}</Badge><p className="mt-2 text-[11px] text-[var(--color-muted)]">{publishStatus(item)}</p></td>
          <td className="px-3 py-3 text-[var(--color-muted)]">{listingPublishPlanText(item)}</td>
          <td className="px-3 py-3">{item.listing_url && <a aria-label="打开平台 Listing" href={item.listing_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 text-[var(--color-primary)]" /></a>}</td>
        </tr>)}</tbody>
      </table>
    </div>
  )
}

export function ListingFieldEvidencePanel({ requirements, platform }: { requirements: PlatformRequirementsLike; platform: string }) {
  const gaps = platformFieldEvidenceGaps(requirements)
  const totalGapCount = gaps.category.length + gaps.editPage.length + gaps.api.length
  const recheckNotes = requirements.evidence?.needs_recheck || []

  if (totalGapCount === 0 && recheckNotes.length === 0) {
    return (
      <div className="mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3" aria-label="平台字段补证队列">
        <p className="text-xs font-semibold text-[var(--color-fg)]">平台字段补证队列</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">字段资料状态：当前 {platform.toUpperCase()} Listing 字段未标记待补证。发布前仍需按目标店铺类目、平台后台校验和官方接口返回复核。</p>
      </div>
    )
  }

  return (
    <div className="mb-3 rounded-lg border border-[var(--color-warning)] bg-[var(--color-bg)] p-3" aria-label="平台字段补证队列">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[var(--color-fg)]">平台字段补证队列</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">字段资料状态：{platform.toUpperCase()} 当前类目仍有 {totalGapCount} 个字段需要补证，不能把未实测字段冒充为平台强规则。</p>
        </div>
        <Badge variant="warning">补证后再发布</Badge>
      </div>
      {recheckNotes.length > 0 && (
        <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
          <p className="text-[11px] font-semibold text-[var(--color-fg)]">补证说明</p>
          <ul className="mt-1 space-y-1 text-[11px] text-[var(--color-muted)]">
            {recheckNotes.map(note => <li key={note}>• {note}</li>)}
          </ul>
        </div>
      )}
      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <EvidenceGapList title="类目待补证字段" items={gaps.category} emptyText="当前类目字段未标记待补证" />
        <EvidenceGapList title="编辑页待补证字段" items={gaps.editPage} emptyText="当前编辑页字段未标记待补证" />
        <EvidenceGapList title="接口待补证字段" items={gaps.api} emptyText="当前接口字段未标记待补证" />
      </div>
      <p className="mt-3 text-[11px] text-[var(--color-warning)]">补证后再发布：先在对应平台卖家后台确认类目、编辑页字段和接口返回，再更新字段组配置或当前 Listing 属性；未补证字段只作为提示，不作为已确认发布规则。</p>
    </div>
  )
}

function EvidenceGapList({ title, items, emptyText }: { title: string; items: FieldEvidenceGap[]; emptyText: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">
      <p className="text-[11px] font-semibold text-[var(--color-fg)]">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-[11px] text-[var(--color-muted)]">{emptyText}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map(item => (
            <li key={`${item.state}-${item.key}`} className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[11px]">
              <span className="font-semibold text-[var(--color-fg)]">{item.label}</span>
              <span className="ml-1 text-[var(--color-muted)]">({item.key})</span>
              <p className="mt-0.5 text-[var(--color-muted)]">字段组：{item.group}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function platformFieldEvidenceGaps(requirements: PlatformRequirementsLike) {
  const result: { category: FieldEvidenceGap[]; editPage: FieldEvidenceGap[]; api: FieldEvidenceGap[] } = {
    category: [],
    editPage: [],
    api: [],
  }
  const groups = (requirements.field_groups || []).filter((item): item is { label?: string; id?: string; fields?: Array<{ key?: string; label?: string; evidence_state?: string }> } => Boolean(item && typeof item === 'object'))
  for (const group of groups) {
    for (const field of group.fields || []) {
      const state = field.evidence_state || ''
      const gap = {
        key: field.key || field.label || 'unknown_field',
        label: field.label || field.key || '未命名字段',
        group: group.label || group.id || '未命名字段组',
        state,
      }
      if (state === 'needs_category_recheck') result.category.push(gap)
      if (state === 'needs_edit_page_recheck') result.editPage.push(gap)
      if (state === 'needs_api_recheck') result.api.push(gap)
    }
  }
  return result
}

function listingRequirements(item: ProductListing): PlatformRequirementsLike | undefined {
  return (item.platform_data?.platform_requirements || undefined) as PlatformRequirementsLike | undefined
}

function publishStatus(item: ProductListing) {
  const data = item.platform_data || {}
  if (data.platform_publish_status === 'not_attempted') return '平台未尝试发布'
  if (data.platform_api_status === 'not_connected') return '平台 API 未接通'
  return String(data.platform_publish_status || data.platform_api_status || '本地草稿')
}

function listingPublishPlanText(item: ProductListing) {
  const plan = (item.platform_data || {}).publish_plan as Record<string, unknown> | undefined
  if (!plan) return '未设置发布计划'
  if (plan.mode === 'scheduled') return `定时发布计划 · ${String(plan.scheduled_at || '时间待补')}`
  if (plan.mode === 'immediate') return '立即发布计划 · 本地已保存'
  return `发布计划 · ${String(plan.status || '本地已保存')}`
}
