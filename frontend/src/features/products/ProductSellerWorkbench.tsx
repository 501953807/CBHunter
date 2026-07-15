import { AlertTriangle, CheckCircle2, Edit3, ExternalLink, Package, Send } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { PlatformFieldGroupSummary, type PlatformRequirementsLike } from '../../components/shared/PlatformFieldGroups'
import { BusinessObjectActionBar } from '../../components/shared/BusinessObjectActionBar'
import type { PaginationMeta } from '../../types/common'
import type { ProductListRow } from '../../types/product'
import { getStatusMeta } from '../../utils/domainOptions'
import { productImageSrc } from '../../utils/productImages'

interface Props {
  products: ProductListRow[]
  selectedIds: Set<string>
  activeId: string
  productStatuses: { id: string; label: string; variant?: string }[]
  pagination?: PaginationMeta
  loading: boolean
  onSelectIds: (ids: Set<string>) => void
  onActiveIdChange: (id: string) => void
  onEdit: (id: string) => void
  onPublish: (id: string) => void
  onPageChange: (page: number) => void
}

export function ProductSellerWorkbench({
  products,
  selectedIds,
  activeId,
  productStatuses,
  pagination,
  loading,
  onSelectIds,
  onActiveIdChange,
  onEdit,
  onPublish,
  onPageChange,
}: Props) {
  const active = products.find(item => item.id === activeId) || products[0]
  const allChecked = products.length > 0 && products.every(item => selectedIds.has(item.id))

  const toggleAll = () => {
    onSelectIds(allChecked ? new Set() : new Set(products.map(item => item.id)))
  }

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectIds(next)
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">基础商品资料列表</h3>
            <p className="mt-1 text-xs text-[var(--color-muted)]">作为跨平台、跨店铺 Listing 的基础版本，集中维护图片、平台字段、成本、重量和可执行动作。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {statusBuckets(products, productStatuses).map(item => (
              <span key={item.id} className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[11px] text-[var(--color-muted)]">
                {item.label} {item.count}
              </span>
            ))}
          </div>
        </div>
        <div className="max-h-[62vh] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          <table className="professional-table w-full text-left text-xs">
            <thead className="sticky top-0 z-10 bg-[var(--color-surface)] text-[var(--color-muted)]">
              <tr className="border-b border-[var(--color-border)]">
                <th className="w-10 px-3 py-2"><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
                <th className="px-3 py-2">商品基础信息</th>
                <th className="px-3 py-2">平台字段组</th>
                <th className="px-3 py-2">成本/重量</th>
                <th className="px-3 py-2">状态诊断</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {products.map(row => {
                const statusMeta = getStatusMeta(productStatuses, row.status)
                const activeRow = row.id === active?.id
                const opportunities = opportunityActions(row)
                const media = mediaReadinessForProduct(row)
                return (
                  <tr
                    key={row.id}
                    onClick={() => onActiveIdChange(row.id)}
                    className="cursor-pointer border-b border-[var(--color-border)] align-top hover:bg-[var(--color-bg)]"
                    style={{ background: activeRow ? 'var(--color-primary-light)' : 'transparent' }}
                  >
                    <td className="px-3 py-3" onClick={event => event.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleOne(row.id)} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-3">
                        <ProductThumb row={row} />
                        <div className="min-w-0">
                          <p className="line-clamp-2 font-medium text-[var(--color-fg)]">{row.name}</p>
                          <p className="mt-1 text-[11px] text-[var(--color-muted)]">{row.sku}{row.brand ? ` · ${row.brand}` : ''}</p>
                          {row.category_id && <p className="mt-1 text-[11px] text-[var(--color-muted)]">类目：{row.category_id}</p>}
                          <p className={media.missing > 0 ? 'mt-1 text-[11px] text-[var(--color-warning)]' : 'mt-1 text-[11px] text-[var(--color-success)]'}>
                            图片就绪：{media.captured}/{media.min} · 平台至少 5 张，建议 9 张
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="min-w-80 px-3 py-3">
                      <PlatformFieldGroupSummary requirements={primaryRequirements(row)} compact maxGroups={2} />
                    </td>
                    <td className="px-3 py-3 text-[var(--color-fg)]">
                      <p>{row.cost_price == null ? '成本待补' : `¥${row.cost_price.toFixed(2)}`}</p>
                      <p className="mt-1 text-[var(--color-muted)]">{row.weight_g == null ? '重量待补' : `${row.weight_g}g`}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                      {row.data_quality_flags?.includes('test_residue') && <p className="mt-2 text-[11px] text-[var(--color-warning)]">测试残留</p>}
                      <p className={opportunities.length ? 'mt-2 text-[11px] text-[var(--color-warning)]' : 'mt-2 text-[11px] text-[var(--color-success)]'}>
                        {opportunities.length ? `机会处理 ${opportunities.length} 项` : '诊断通过'}
                      </p>
                      <p className="mt-2 text-[11px] text-[var(--color-muted)]">{row.updated_at ? new Date(row.updated_at).toLocaleString('zh-CN') : '--'}</p>
                    </td>
                    <td className="px-3 py-3" onClick={event => event.stopPropagation()}>
                      <div className="flex flex-col gap-2">
                        <button onClick={() => onEdit(row.id)} className="inline-flex items-center gap-1 text-[var(--color-primary)]"><Edit3 className="h-3.5 w-3.5" />编辑</button>
                        <button onClick={() => onPublish(row.id)} className="inline-flex items-center gap-1 text-[var(--color-primary)]"><Send className="h-3.5 w-3.5" />刊登</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {loading && <p className="p-6 text-center text-sm text-[var(--color-muted)]">正在加载商品...</p>}
          {!loading && products.length === 0 && <p className="p-8 text-center text-sm text-[var(--color-muted)]">暂无商品，点击右上角「新建商品」开始。</p>}
        </div>
        {pagination && (
          <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-3 text-xs text-[var(--color-muted)]">
            <span>第 {pagination.page} / {pagination.total_pages || 1} 页 · 共 {pagination.total} 条</span>
            <div className="flex gap-2">
              <button disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)} className="rounded-lg border border-[var(--color-border)] px-3 py-1 disabled:opacity-40">上一页</button>
              <button disabled={pagination.page >= pagination.total_pages} onClick={() => onPageChange(pagination.page + 1)} className="rounded-lg border border-[var(--color-border)] px-3 py-1 disabled:opacity-40">下一页</button>
            </div>
          </div>
        )}
      </section>

      <ProductInspector product={active} productStatuses={productStatuses} onEdit={onEdit} onPublish={onPublish} />
    </div>
  )
}

function ProductInspector({ product, productStatuses, onEdit, onPublish }: { product?: ProductListRow; productStatuses: Props['productStatuses']; onEdit: (id: string) => void; onPublish: (id: string) => void }) {
  if (!product) return <aside className="rounded-2xl border border-dashed border-[var(--color-border)] p-6 text-sm text-[var(--color-muted)]">选择左侧商品查看详情和诊断。</aside>
  const statusMeta = getStatusMeta(productStatuses, product.status)
  const requirements = primaryRequirements(product)
  const opportunities = opportunityActions(product)
  const media = mediaReadinessForProduct(product)
  return (
    <aside className="professional-context-rail rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4" aria-label="商品机会处理">
      <ProductThumb row={product} large />
      <h3 className="mt-3 line-clamp-2 text-base font-semibold text-[var(--color-fg)]">{product.name}</h3>
      <p className="mt-1 text-xs text-[var(--color-muted)]">{product.sku}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
        {product.data_quality_flags?.includes('test_residue') && <Badge variant="warning">测试残留</Badge>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Info label="成本" value={product.cost_price == null ? '待补' : `¥${product.cost_price.toFixed(2)}`} />
        <Info label="重量" value={product.weight_g == null ? '待补' : `${product.weight_g}g`} />
        <Info label="品牌" value={product.brand || '未填写'} />
        <Info label="类目" value={product.category_id || '未填写'} />
      </div>
      <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3" aria-label="商品图片就绪度">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-[var(--color-fg)]">图片就绪</p>
          <Badge variant={media.missing > 0 ? 'warning' : 'success'}>{media.captured}/{media.min}</Badge>
        </div>
        <p className="mt-2 text-[11px] text-[var(--color-muted)]">平台至少 5 张，建议 9 张；当前已维护 {media.captured} 张。</p>
        {media.missing > 0 && <p className="mt-2 text-[11px] text-[var(--color-warning)]">媒体缺口：{media.gaps.join('、')}</p>}
      </div>
      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold text-[var(--color-fg)]">平台字段诊断</p>
        <PlatformFieldGroupSummary requirements={requirements} compact maxGroups={3} />
      </div>
      <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
        <div className="flex items-center gap-2">
          {opportunities.length ? <AlertTriangle className="h-4 w-4 text-[var(--color-warning)]" /> : <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />}
          <p className="text-xs font-semibold text-[var(--color-fg)]">商品机会处理</p>
        </div>
        <p className="mt-1 text-[11px] text-[var(--color-muted)]">诊断动作队列：补齐商品事实、平台字段、成本重量后，再进入 Listing。</p>
        <div className="mt-3 space-y-2">
          {opportunities.length ? opportunities.map(action => (
            <div key={action.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
              <p className="text-xs font-medium text-[var(--color-fg)]">{action.title}</p>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">{action.detail}</p>
              <button onClick={() => action.kind === 'publish' ? onPublish(product.id) : onEdit(product.id)} className="mt-2 rounded-md border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-primary)]">
                {action.cta}
              </button>
            </div>
          )) : <p className="rounded-lg bg-[var(--color-success-light)] px-2 py-2 text-xs text-[var(--color-success)]">核心商品事实和平台字段已具备，可进入刊登或继续补充营销内容。</p>}
        </div>
      </div>
      <div className="mt-4">
        <BusinessObjectActionBar
          description="围绕当前商品进入编辑、内容制作或平台刊登，保持同一业务对象连续处理。"
          actions={[
            { label: '编辑基础商品资料', description: '补图片、类目、成本、重量和平台属性。', onClick: () => onEdit(product.id) },
            { label: '进入内容制作', description: '补标题、卖点、图片处理和视频脚本。', href: `/content?product_id=${product.id}` },
            { label: '创建 Listing 草稿', description: '进入批量刊登并带入当前商品。', onClick: () => onPublish(product.id) },
          ]}
        />
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={() => onEdit(product.id)} className="flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-fg)]">编辑商品</button>
        <button onClick={() => onPublish(product.id)} className="flex-1 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs text-[var(--color-primary-text)]">创建 Listing</button>
      </div>
      {sourceUrl(product) && <a href={sourceUrl(product)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--color-primary)]"><ExternalLink className="h-3.5 w-3.5" />查看来源</a>}
    </aside>
  )
}

function ProductThumb({ row, large = false }: { row: ProductListRow; large?: boolean }) {
  const size = large ? 'h-40 w-full' : 'h-12 w-12'
  return row.images?.[0]
    ? <img src={productImageSrc(row.images[0])} alt={row.name} className={`${size} shrink-0 rounded-xl border border-[var(--color-border)] object-cover`} loading="lazy" />
    : <div className={`${size} flex shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-muted)]`}><Package className="h-5 w-5" /></div>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5"><p className="text-[var(--color-muted)]">{label}</p><p className="truncate text-[var(--color-fg)]">{value}</p></div>
}

function primaryRequirements(row: ProductListRow): PlatformRequirementsLike | undefined {
  const requirements = (row.attributes?.platform_requirements || {}) as Record<string, PlatformRequirementsLike>
  return requirements.shopee || requirements.tiktok || requirements.temu || Object.values(requirements)[0]
}

function sourceUrl(row: ProductListRow) {
  const imageEvidence = (row.attributes?.image_evidence || {}) as { source_page_url?: string }
  return imageEvidence.source_page_url
}

function opportunityActions(row: ProductListRow) {
  const actions: { id: string; title: string; detail: string; cta: string; kind: 'edit' | 'publish' }[] = []
  const requirements = primaryRequirements(row)
  const missingFieldCount = missingPlatformFieldCount(requirements)
  const media = mediaReadinessForProduct(row)
  if (!row.images?.length) actions.push({ id: 'image', title: '补商品图片', detail: '商品没有真实图片，Listing、内容制作和平台刊登都会缺少主图证据。', cta: '编辑图片', kind: 'edit' })
  else if (media.missing > 0) actions.push({ id: 'media_readiness', title: '补平台图片素材', detail: `当前仅 ${media.captured} 张图，平台至少 5 张、建议 9 张；媒体缺口：${media.gaps.join('、')}。`, cta: '编辑图片', kind: 'edit' })
  if (!row.category_id) actions.push({ id: 'category', title: '补商品类目', detail: '缺少类目会影响 Shopee/TEMU/TikTok Shop 属性映射和刊登校验。', cta: '编辑类目', kind: 'edit' })
  if (row.cost_price == null || row.weight_g == null) actions.push({ id: 'cost_weight', title: '补成本/重量', detail: '成本和重量是定价、利润和物流判断的基础字段。', cta: '编辑成本重量', kind: 'edit' })
  if (missingFieldCount > 0) actions.push({ id: 'platform_fields', title: '补平台字段', detail: `当前平台字段组仍有 ${missingFieldCount} 个必填值待补。`, cta: '编辑平台属性', kind: 'edit' })
  if (row.data_quality_flags?.includes('test_residue')) actions.push({ id: 'test_residue', title: '清理测试残留', detail: '该商品被标记为测试残留，进入真实业务前需核验来源和字段。', cta: '核验商品', kind: 'edit' })
  if (actions.length === 0) actions.push({ id: 'publish_ready', title: '创建 Listing 草稿', detail: '核心字段已具备，可进入平台刊登工作台继续编辑标题、描述和平台字段。', cta: '创建 Listing', kind: 'publish' })
  return actions
}

function mediaReadinessForProduct(row: ProductListRow) {
  const stored = row.attributes?.media_readiness as Record<string, unknown> | undefined
  const captured = Number(stored?.captured_image_count ?? row.images?.length ?? 0)
  const min = Number(stored?.min_platform_images ?? 5)
  const recommended = Number(stored?.recommended_platform_images ?? 9)
  const storedGaps = Array.isArray(stored?.gaps) ? stored.gaps.filter((item): item is string => typeof item === 'string' && item.length > 0) : []
  const fallbackGaps = captured >= min ? [] : ['缺少平台辅图', '缺少尺寸/规格图', '缺少场景使用图', '缺少包装或细节图']
  return {
    captured,
    min,
    recommended,
    missing: Math.max(min - captured, 0),
    gaps: storedGaps.length ? storedGaps : fallbackGaps,
  }
}

function missingPlatformFieldCount(requirements?: PlatformRequirementsLike) {
  const values = requirements?.attribute_values || {}
  const groups = (requirements?.field_groups || []).filter((group): group is { fields?: { key?: string; required?: boolean }[] } => Boolean(group && typeof group === 'object'))
  const groupMissing = groups.reduce((count, group) => count + (group.fields || []).filter(field => field.required && !values[field.key || '']).length, 0)
  const requiredMissing = (requirements?.required_attributes || []).filter(attr => !values[attr]).length
  return groupMissing || requiredMissing
}

function statusBuckets(products: ProductListRow[], statuses: Props['productStatuses']) {
  return statuses.map(status => ({ id: status.id, label: status.label, count: products.filter(item => item.status === status.id).length })).filter(item => item.count > 0)
}
