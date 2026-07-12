import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Tabs } from '../components/ui/Tabs'
import { useProduct, useCreateProduct, useUpdateProduct } from '../hooks/useProducts'
import { useToast } from '../components/ui/Toast'
import { Skeleton } from '../components/shared/LoadingSkeleton'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'
import { useConfig } from '../hooks/useConfig'
import { toDomainOptions } from '../utils/domainOptions'
import { CompliancePanel, ListingsPanel, VariationsPanel } from '../features/products/ProductDetailTabs'
import type { ProductCompliance, ProductVariant } from '../types/product'
import { ProductImagesPanel } from '../features/products/ProductImagesPanel'
import { ProductPlatformAttributesPanel, type PlatformRequirementsByPlatform } from '../features/products/ProductPlatformAttributesPanel'

const FORM_TABS = [
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
  const toast = useToast()
  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()
  const { product_statuses = [], platforms = [], platform_product_field_groups } = useConfig()

  const { data: productData, isLoading } = useProduct(id || '')
  const product = productData?.data

  const [activeTab, setActiveTab] = useState('basic')
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
    if (initialTab && FORM_TABS.some(tab => tab.id === initialTab)) setActiveTab(initialTab)
  }, [initialTab])

  const handleSave = async () => {
    if (!form.name.trim()) {
      setNameError('商品名称不能为空')
      setActiveTab('basic')
      toast.addToast('error', '请输入商品名称')
      return
    }
    if (isAutomationTestProductName(form.name)) {
      setNameError('商品名称疑似自动化测试残留，请填写真实商品名称')
      setActiveTab('basic')
      toast.addToast('error', '请填写真实商品名称')
      return
    }
    if (variants.some(item => !item.sku.trim() || !item.name.trim()) || new Set(variants.map(item => item.sku.trim())).size !== variants.length) {
      setActiveTab('variations')
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

      <Tabs tabs={FORM_TABS} activeTab={activeTab} onChange={setActiveTab} />

      <Card>
        <CardContent className="pt-6">
          {activeTab === 'basic' && (
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
          )}

          {activeTab === 'variations' && (
            <VariationsPanel variants={variants} onChange={setVariants} />
          )}

          {activeTab === 'compliance' && <CompliancePanel value={compliance} onChange={setCompliance} />}

          {activeTab === 'platform_attrs' && (
            <ProductPlatformAttributesPanel
              platforms={platforms}
              fieldGroups={platform_product_field_groups}
              value={platformRequirements}
              onChange={setPlatformRequirements}
            />
          )}

          {activeTab === 'images' && (
            <ProductImagesPanel productId={id} imageText={imageText} onChange={setImageText} />
          )}

          {activeTab === 'listings' && (
            <ListingsPanel productId={id} listings={product?.listings || []} initialListingId={initialListingId} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function isAutomationTestProductName(value: string) {
  const name = value.trim()
  return name.endsWith('-测试') || ['自动化测试', '仅名称无其他必填', '修改后的'].some(pattern => name.includes(pattern))
}
