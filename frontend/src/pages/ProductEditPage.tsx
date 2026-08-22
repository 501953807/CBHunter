import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useProduct, useProductObjectModel, useCreateProduct, useUpdateProduct } from '../hooks/useProducts'
import { useToast } from '../components/ui/Toast'
import { Skeleton } from '../components/shared/LoadingSkeleton'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'
import { useConfig } from '../hooks/useConfig'
import { CompliancePanel, ListingsPanel, VariationsPanel } from '../features/products/ProductDetailTabs'
import type { ProductCompliance, ProductVariant } from '../types/product'
import { ProductImagesPanel } from '../features/products/ProductImagesPanel'
import { ProductPlatformAttributesPanel, type PlatformRequirementsByPlatform } from '../features/products/ProductPlatformAttributesPanel'
import {
  PRODUCT_EDIT_FORM_SECTIONS,
  ProductBasicInfoSection,
  ProductEditObjectOverview,
  ProductEditSection,
  ProductEditSectionNav,
  countPlatformFields,
  isAutomationTestProductName,
  type ProductEditFormState,
} from '../features/products/ProductEditPageParts'

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
  const [form, setForm] = useState<ProductEditFormState>({
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
    if (initialTab && PRODUCT_EDIT_FORM_SECTIONS.some(section => section.id === initialTab)) {
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
      <div className="materio-ecommerce-editor product-edit-loading-state page-enter space-y-6">
        <div className="product-edit-loading-hero">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Card><CardContent><div className="product-edit-loading-stack">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div></CardContent></Card>
      </div>
    )
  }

  return (
    <div className="materio-ecommerce-editor space-y-6">
      <div className="materio-editor-toolbar flex items-center justify-between">
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

      <div className="materio-editor-section-stack space-y-4">
        <ProductEditSection id="basic" title="基本信息" summary="维护基础商品版本的 SKU、名称、成本、重量和内部备注。">
          <ProductBasicInfoSection
            form={form}
            nameError={nameError}
            productNameInvalid={productNameInvalid}
            productStatuses={product_statuses}
            setForm={setForm}
            setNameError={setNameError}
          />
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
