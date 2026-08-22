import { ExternalLink, Send } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { PlatformFieldGroupSummary, type PlatformRequirementsLike } from '../../components/shared/PlatformFieldGroups'
import type { ListingInstanceMatrixItem, ProductListingMatrix } from '../../api/listing'
import type { ProductListing } from '../../types/product'
export { ListingContinuousEditSections, ListingFieldEvidencePanel } from './ProductDetailContinuousEditSectionsParts'

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
