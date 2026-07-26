import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { useProduct, useProductObjectModel, useCreateProduct, useUpdateProduct } from '../hooks/useProducts'
import { useToast } from '../components/ui/Toast'
import { Skeleton } from '../components/shared/LoadingSkeleton'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'
import { useConfig } from '../hooks/useConfig'
import { toDomainOptions } from '../utils/domainOptions'
import { CompliancePanel, ListingsPanel, VariationsPanel } from '../features/products/ProductDetailTabs'
import type { ProductCompliance, ProductObjectModelSnapshot, ProductVariant } from '../types/product'
import { ProductImagesPanel } from '../features/products/ProductImagesPanel'
import { ProductPlatformAttributesPanel, type PlatformRequirementsByPlatform } from '../features/products/ProductPlatformAttributesPanel'
import { productImageSrc } from '../utils/productImages'

const FORM_SECTIONS = [
  { id: 'basic', label: '基本信息' },
  { id: 'variations', label: '规格' },
  { id: 'compliance', label: '合规资料' },
  { id: 'platform_attrs', label: '平台属性' },
  { id: 'images', label: '图片' },
  { id: 'listings', label: '平台 Listing' },
]

export default function ProductEditPage() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') || ''
  const initialListingId = searchParams.get('listing_id') || ''
  const initialListingSection = searchParams.get('listing_section') || ''
  const toast = useToast()
  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()
  const { product_statuses = [], platforms = [], platform_product_field_groups } = useConfig()

  const { data: productData, isLoading } = useProduct(id || '')
  const { data: productObjectModelData } = useProductObjectModel(id || '')
  const product = productData?.data
  const productObjectModel = productObjectModelData?.data || null

  const [activeSection, setActiveSection] = useState('basic')
  const [nameError, setNameError] = useState('')
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [compliance, setCompliance] = useState<ProductCompliance>({})
  const [platformRequirements, setPlatformRequirements] = useState<PlatformRequirementsByPlatform>({})
  const [imageText, setImageText] = useState('')
  const [form, setForm] = useState({
    name: '',
    sku: '',
    brand: '',
    description: '',
    cost_price: '',
    weight_g: '',
    status: '',
    notes: '',
  })

  useEffect(() => {
    if (product) {
      const attributes = product.attributes || {}
      setVariants(Array.isArray(attributes.variants) ? attributes.variants as ProductVariant[] : [])
      setCompliance((attributes.compliance || {}) as ProductCompliance)
      setPlatformRequirements((attributes.platform_requirements || {}) as PlatformRequirementsByPlatform)
      setImageText((product.images || []).join('\n'))
      setForm({
        name: product.name || '',
        sku: product.sku || '',
        brand: product.brand || '',
        description: product.description || '',
        cost_price: product.cost_price == null ? '' : String(product.cost_price),
        weight_g: product.weight_g == null ? '' : String(product.weight_g),
        status: product.status || '',
        notes: product.notes || '',
      })
    }
  }, [product])

  useEffect(() => {
    if (isNew && !form.status && product_statuses.length > 0) {
      setForm(prev => ({ ...prev, status: product_statuses[0].id }))
    }
  }, [form.status, isNew, product_statuses])

  useEffect(() => {
    if (initialTab && FORM_SECTIONS.some(section => section.id === initialTab)) {
      setActiveSection(initialTab)
      window.requestAnimationFrame(() => {
        document.getElementById(`product-section-${initialTab}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [initialTab])

  const handleSave = async () => {
    if (!form.name.trim()) {
      setNameError('商品名称不能为空')
      focusSection('basic')
      toast.addToast('error', '请输入商品名称')
      return
    }
    if (isAutomationTestProductName(form.name)) {
      setNameError('商品名称疑似自动化测试残留，请填写真实商品名称')
      focusSection('basic')
      toast.addToast('error', '请填写真实商品名称')
      return
    }
    if (variants.some(item => !item.sku.trim() || !item.name.trim()) || new Set(variants.map(item => item.sku.trim())).size !== variants.length) {
      focusSection('variations')
      toast.addToast('error', '规格 SKU 与名称必填，且 SKU 不能重复')
      return
    }
    setNameError('')
    const attributes = { ...(product?.attributes || {}), variants, compliance, platform_requirements: platformRequirements }
    const images = imageText.split('\n').map(item => item.trim()).filter(Boolean)

    if (isNew) {
      const result = await createMutation.mutateAsync({
        name: form.name,
        sku: form.sku || undefined,
        brand: form.brand || undefined,
        description: form.description || undefined,
        cost_price: form.cost_price === '' ? undefined : Number(form.cost_price),
        weight_g: form.weight_g === '' ? undefined : Number(form.weight_g),
        status: form.status,
        notes: form.notes || undefined,
        attributes,
        images,
      })
      if (result.data?.id) {
        navigate(`/products/${result.data.id}`, { replace: true })
      }
    } else if (id) {
      await updateMutation.mutateAsync({ id, data: {
        ...form,
        cost_price: form.cost_price === '' ? null : Number(form.cost_price),
        weight_g: form.weight_g === '' ? null : Number(form.weight_g),
        attributes,
        images,
      } })
    }
  }

  const productNameInvalid = isAutomationTestProductName(form.name)
  const currentImages = imageText.split('\n').map(item => item.trim()).filter(Boolean)
  const listingCount = product?.listings?.length || 0
  const listingPlatforms = Array.from(new Set((product?.listings || []).map(listing => listing.platform).filter(Boolean)))
  const platformFieldCount = countPlatformFields(platformRequirements)
  const focusSection = (sectionId: string) => {
    setActiveSection(sectionId)
    document.getElementById(`product-section-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!isNew && isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card><CardContent><div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div></CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button aria-label="返回商品列表" title="返回商品列表" onClick={() => navigate('/products')} className="text-[var(--color-muted)] hover:text-[var(--color-fg)]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-fg)]">
              {isNew ? '新建商品' : form.name || '加载中...'}
            </h1>
            {!isNew && <p className="text-xs" style={{ color: 'var(--color-muted)' }}>SKU: {form.sku}</p>}
          </div>
        </div>
        <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending || productNameInvalid}>
          <Save className="w-4 h-4 mr-1.5" />
          {createMutation.isPending || updateMutation.isPending ? '保存中...' : '保存'}
        </Button>
      </div>

      {!isNew && <EvidenceBanner evidence={productData} />}

      <ProductEditObjectOverview
        isNew={isNew}
        name={form.name}
        sku={form.sku}
        status={form.status}
        costPrice={form.cost_price}
        weightG={form.weight_g}
        imageUrls={currentImages}
        variantCount={variants.length}
        platformFieldCount={platformFieldCount}
        listingCount={listingCount}
        listingPlatforms={listingPlatforms}
        objectSnapshot={productObjectModel}
        onFocus={focusSection}
      />

      <ProductEditSectionNav activeSection={activeSection} onFocus={focusSection} />

      <div className="space-y-4">
        <ProductEditSection id="basic" title="基本信息" summary="维护基础商品版本的 SKU、名称、成本、重量和内部备注。">
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
                  options={toDomainOptions(product_statuses)}
                  value={form.status}
                  onChange={(v) => setForm({ ...form, status: v })}
                />
              </div>
              <Input
                label="商品名称 *"
                id="name"
                value={form.name}
                onChange={(e) => { setForm({ ...form, name: e.target.value }); if (e.target.value.trim() && !isAutomationTestProductName(e.target.value)) setNameError('') }}
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
                <label className="block text-sm font-medium text-[var(--color-fg)] mb-1">描述</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  className="block w-full rounded-lg border px-3 py-2 text-sm bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
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
                <label className="block text-sm font-medium text-[var(--color-fg)] mb-1">备注</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="block w-full rounded-lg border px-3 py-2 text-sm bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                  placeholder="内部备注..."
                />
              </div>
            </div>
        </ProductEditSection>

        <ProductEditSection id="variations" title="规格 / SKU" summary="维护基础商品规格。店铺 Listing 的价格、库存、平台 SKU 覆盖在下方平台 Listing 实例中处理。">
          <VariationsPanel variants={variants} onChange={setVariants} />
        </ProductEditSection>

        <ProductEditSection id="compliance" title="合规资料" summary="维护基础商品可复用的合规资料；店铺或平台差异在 Listing 实例中覆盖。">
          <CompliancePanel value={compliance} onChange={setCompliance} />
        </ProductEditSection>

        <ProductEditSection id="platform_attrs" title="平台属性基础要求" summary="维护基础商品层可复用的平台属性资料；具体店铺类目差异在平台 Listing 实例中继续核对。">
          <ProductPlatformAttributesPanel
            platforms={platforms}
            fieldGroups={platform_product_field_groups}
            value={platformRequirements}
            onChange={setPlatformRequirements}
          />
        </ProductEditSection>

        <ProductEditSection id="images" title="商品图片素材" summary="商品主档图片统一入库，店铺 Listing 可从主档图片中选择并形成独立覆盖。">
          <ProductImagesPanel productId={id} imageText={imageText} onChange={setImageText} />
        </ProductEditSection>

        <ProductEditSection id="listings" title="平台 Listing 实例" summary="同一基础商品在不同平台、店铺内形成独立 Listing 实例；编辑店铺级标题、图片、SKU、价格、物流和平台属性时不污染基础商品。">
          {!isNew ? (
            <ListingsPanel productId={id} listings={product?.listings || []} initialListingId={initialListingId} initialSection={initialListingSection} />
          ) : (
            <p className="rounded-lg border border-dashed border-[var(--color-border)] p-5 text-sm text-[var(--color-muted)]">先保存基础商品，再创建或同步平台店铺 Listing 实例。</p>
          )}
        </ProductEditSection>
      </div>
    </div>
  )
}

function ProductEditObjectOverview({
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
    <section aria-label="商品编辑对象总览" data-ui="product-edit-object-overview" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
      <div className="grid gap-4 xl:grid-cols-[120px_minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
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
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className={warning ? 'mt-1 truncate text-sm font-semibold text-[var(--color-warning)]' : 'mt-1 truncate text-sm font-semibold text-[var(--color-fg)]'}>{value}</p>
    </div>
  )
}

function ProductEditSectionNav({ activeSection, onFocus }: { activeSection: string; onFocus: (sectionId: string) => void }) {
  return (
    <nav aria-label="商品编辑字段快速定位" className="sticky top-16 z-20 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap gap-2">
        {FORM_SECTIONS.map(section => (
          <button
            key={section.id}
            type="button"
            onClick={() => onFocus(section.id)}
            className={`rounded-lg border px-3 py-2 text-xs transition ${activeSection === section.id ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'}`}
          >
            {section.label}
          </button>
        ))}
      </div>
    </nav>
  )
}

function ProductEditSection({ id, title, summary, children }: { id: string; title: string; summary: string; children: React.ReactNode }) {
  return (
    <section id={`product-section-${id}`} aria-label={title} className="scroll-mt-32">
      <Card>
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

function isAutomationTestProductName(value: string) {
  const name = value.trim()
  return name.endsWith('-测试') || ['自动化测试', '仅名称无其他必填', '修改后的'].some(pattern => name.includes(pattern))
}

function countPlatformFields(requirements: PlatformRequirementsByPlatform) {
  return Object.values(requirements).reduce((sum, item) => sum + Object.keys(item.attribute_values || {}).length, 0)
}
