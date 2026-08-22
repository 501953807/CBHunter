import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import type { ProductObjectModelSnapshot } from '../../types/product'
import { toDomainOptions, type RuntimeStatusOption } from '../../utils/domainOptions'
import { productImageSrc } from '../../utils/productImages'
import type { PlatformRequirementsByPlatform } from './ProductPlatformAttributesPanel'

export type ProductEditFormState = {
  name: string
  sku: string
  brand: string
  description: string
  cost_price: string
  weight_g: string
  status: string
  notes: string
}

export const PRODUCT_EDIT_FORM_SECTIONS = [
  { id: 'basic', label: '基本信息' },
  { id: 'variations', label: '规格' },
  { id: 'compliance', label: '合规资料' },
  { id: 'platform_attrs', label: '平台属性' },
  { id: 'images', label: '图片' },
  { id: 'listings', label: '平台 Listing' },
]

export function ProductBasicInfoSection({
  form,
  nameError,
  productNameInvalid,
  productStatuses,
  setForm,
  setNameError,
}: {
  form: ProductEditFormState
  nameError: string
  productNameInvalid: boolean
  productStatuses: RuntimeStatusOption[]
  setForm: Dispatch<SetStateAction<ProductEditFormState>>
  setNameError: (value: string) => void
}) {
  return (
    <div className="max-w-2xl space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="SKU"
          id="sku"
          value={form.sku}
          onChange={(e) => setForm({ ...form, sku: e.target.value })}
          placeholder="自动生成（留空）"
        />
        <Select
          label="状态"
          options={toDomainOptions(productStatuses)}
          value={form.status}
          onChange={(v) => setForm({ ...form, status: v })}
        />
      </div>
      <Input
        label="商品名称 *"
        id="name"
        value={form.name}
        onChange={(e) => {
          setForm({ ...form, name: e.target.value })
          if (e.target.value.trim() && !isAutomationTestProductName(e.target.value)) setNameError('')
        }}
        placeholder="输入商品名称"
        error={nameError || (productNameInvalid ? '商品名称疑似自动化测试残留，请填写真实商品名称' : '')}
      />
      <Input
        label="品牌"
        id="brand"
        value={form.brand}
        onChange={(e) => setForm({ ...form, brand: e.target.value })}
        placeholder="品牌名称（可选）"
      />
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-fg)]">描述</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={4}
          className="block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          placeholder="商品描述..."
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="成本价 (¥)"
          id="cost_price"
          type="number"
          step="0.01"
          value={form.cost_price}
          onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
        />
        <Input
          label="重量 (g)"
          id="weight_g"
          type="number"
          value={form.weight_g}
          onChange={(e) => setForm({ ...form, weight_g: e.target.value })}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-fg)]">备注</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={2}
          className="block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          placeholder="内部备注..."
        />
      </div>
    </div>
  )
}

export function ProductEditObjectOverview({
  isNew,
  name,
  sku,
  status,
  costPrice,
  weightG,
  imageUrls,
  variantCount,
  platformFieldCount,
  listingCount,
  listingPlatforms,
  objectSnapshot,
  onFocus,
}: {
  isNew: boolean
  name: string
  sku: string
  status: string
  costPrice: string
  weightG: string
  imageUrls: string[]
  variantCount: number
  platformFieldCount: number
  listingCount: number
  listingPlatforms: string[]
  objectSnapshot: ProductObjectModelSnapshot | null
  onFocus: (sectionId: string) => void
}) {
  const mainImage = imageUrls[0]
  const readiness = [
    { label: '基础资料', ready: Boolean(name.trim() && sku.trim()), target: 'basic' },
    { label: 'SKU/规格', ready: variantCount > 0, target: 'variations' },
    { label: '商品图片', ready: imageUrls.length >= 5, target: 'images' },
    { label: '平台字段', ready: platformFieldCount > 0, target: 'platform_attrs' },
    { label: '店铺 Listing', ready: listingCount > 0, target: 'listings' },
  ]
  return (
    <section aria-label="商品编辑对象总览" data-ui="product-edit-object-overview" className="materio-product-overview rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
      <div className="grid gap-4 xl:grid-cols-[140px_minmax(0,1fr)_320px]">
        <div className="materio-product-overview-image overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
          {mainImage ? (
            <img src={productImageSrc(mainImage)} alt={name || '商品主图'} className="h-28 w-full object-cover" />
          ) : (
            <div className="grid h-28 place-items-center px-3 text-center text-xs text-[var(--color-muted)]">待补真实商品主图</div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-[var(--color-fg)]">{name || '未命名基础商品'}</h2>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[11px] text-[var(--color-muted)]">{isNew ? '待保存基础商品版本' : '基础商品版本'}</span>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            基础商品资料作为跨平台/跨店铺复用底座；店铺级标题、图片、SKU、价格、库存、物流和平台属性在“平台 Listing 实例”中独立覆盖，不回写污染其他店铺。
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <ProductOverviewMetric label="基础 SKU" value={sku || '待生成'} />
            <ProductOverviewMetric label="状态" value={status || '待选择'} />
            <ProductOverviewMetric label="成本价" value={costPrice ? `¥${costPrice}` : '待补'} warning={!costPrice} />
            <ProductOverviewMetric label="重量" value={weightG ? `${weightG}g` : '待补'} warning={!weightG} />
          </div>
          {objectSnapshot ? (
            <div data-ui="product-v5-object-model-summary" className="mt-3 grid gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2 sm:grid-cols-4">
              <ProductOverviewMetric label="基础版本" value={`${objectSnapshot.summary.base_version_count}`} warning={objectSnapshot.summary.base_version_count === 0} />
              <ProductOverviewMetric label="店铺实例" value={`${objectSnapshot.summary.listing_instance_count}`} warning={objectSnapshot.summary.listing_instance_count === 0} />
              <ProductOverviewMetric label="V5 SKU" value={`${objectSnapshot.summary.sku_variant_count}`} warning={objectSnapshot.summary.sku_variant_count === 0} />
              <ProductOverviewMetric label="字段缺口" value={`${objectSnapshot.summary.missing_required_field_count}`} warning={objectSnapshot.summary.missing_required_field_count > 0} />
            </div>
          ) : null}
          {objectSnapshot?.data_gaps?.length ? (
            <div data-ui="product-v5-object-model-gaps" className="mt-2 flex flex-wrap gap-1.5">
              {objectSnapshot.data_gaps.slice(0, 4).map(gap => (
                <button key={gap} type="button" onClick={() => onFocus(gap.includes('Listing') ? 'listings' : gap.includes('SKU') ? 'variations' : 'basic')} className="rounded-full border border-[var(--color-warning)] bg-[var(--color-warning-light)] px-2 py-0.5 text-[11px] text-[var(--color-warning)]">
                  {gap}
                </button>
              ))}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => onFocus('images')} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-fg)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">商品图片素材 {imageUrls.length}</button>
            <button type="button" onClick={() => onFocus('variations')} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-fg)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">SKU/规格 {variantCount}</button>
            <button type="button" onClick={() => onFocus('listings')} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-fg)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">店铺 Listing 实例 {listingCount}</button>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <p className="text-sm font-semibold text-[var(--color-fg)]">发布准备度</p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">仅用当前商品真实字段判断，不用默认值补齐。</p>
          <div className="mt-3 space-y-2">
            {readiness.map(item => (
              <button key={item.label} type="button" onClick={() => onFocus(item.target)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-left text-xs hover:border-[var(--color-primary)]">
                <span className="text-[var(--color-muted)]">{item.label}</span>
                <span className={item.ready ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}>{item.ready ? '已具备' : '待补'}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-[var(--color-muted)]">
            覆盖平台：{listingPlatforms.length ? listingPlatforms.join(' / ') : '待创建店铺 Listing'}
          </p>
        </div>
      </div>
    </section>
  )
}

function ProductOverviewMetric({ label, value, warning }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="materio-product-metric rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className={warning ? 'mt-1 truncate text-sm font-semibold text-[var(--color-warning)]' : 'mt-1 truncate text-sm font-semibold text-[var(--color-fg)]'}>{value}</p>
    </div>
  )
}

export function ProductEditSectionNav({ activeSection, onFocus }: { activeSection: string; onFocus: (sectionId: string) => void }) {
  return (
    <nav aria-label="商品编辑字段快速定位" className="materio-editor-anchor-nav sticky top-16 z-20 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap gap-2">
        {PRODUCT_EDIT_FORM_SECTIONS.map(section => (
          <button
            key={section.id}
            type="button"
            onClick={() => onFocus(section.id)}
            className={`materio-editor-anchor rounded-lg border px-3 py-2 text-xs transition ${activeSection === section.id ? 'is-active border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'}`}
          >
            {section.label}
          </button>
        ))}
      </div>
    </nav>
  )
}

export function ProductEditSection({ id, title, summary, children }: { id: string; title: string; summary: string; children: ReactNode }) {
  return (
    <section id={`product-section-${id}`} aria-label={title} className="scroll-mt-32">
      <Card className="materio-editor-section-card">
        <CardContent className="pt-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-[var(--color-fg)]">{title}</h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">{summary}</p>
          </div>
          {children}
        </CardContent>
      </Card>
    </section>
  )
}

export function isAutomationTestProductName(value: string) {
  const name = value.trim()
  return name.endsWith('-测试') || ['自动化测试', '仅名称无其他必填', '修改后的'].some(pattern => name.includes(pattern))
}

export function countPlatformFields(requirements: PlatformRequirementsByPlatform) {
  return Object.values(requirements).reduce((sum, item) => sum + Object.keys(item.attribute_values || {}).length, 0)
}
