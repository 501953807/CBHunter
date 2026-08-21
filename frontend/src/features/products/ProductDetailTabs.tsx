import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { PlatformFieldGroupEditor, type PlatformRequirementsLike } from '../../components/shared/PlatformFieldGroups'
import { getProductListingMatrix, promoteListingToBaseVersion, updateListingOverrides, type ListingInstanceMatrixItem, type ProductListingMatrix } from '../../api/listing'
import type { ProductListing, ProductVariant, ProductCompliance } from '../../types/product'
import { logger } from '../../utils/logger'
import { productImageSrc } from '../../utils/productImages'
import {
  CurrentListingInstanceCommandPanel,
  ListingInlineSectionNavigator,
  PlatformListingSellerPreview,
  ProductListingEditOverview,
  SectionHeading,
  listingInstanceReadiness,
  type ListingEditSectionKey,
  type StoreListingEditForm,
  type VariantEditRow,
} from './ProductListingEditorChrome'
import { LegacyListingsTable, ListingFieldEvidencePanel, ListingMasterMatrixPanel } from './ProductDetailTabsParts'

export function VariationsPanel({ variants, onChange }: { variants: ProductVariant[]; onChange: (items: ProductVariant[]) => void }) {
  const add = () => onChange([...variants, { sku: '', name: '', stock: 0 }])
  const update = (index: number, patch: Partial<ProductVariant>) => onChange(variants.map((item, i) => i === index ? { ...item, ...patch } : item))
  return <div className="space-y-3">
    <div className="flex items-center justify-between"><p className="text-sm text-[var(--color-muted)]">维护颜色、尺寸等销售规格；SKU 在商品内必须唯一。</p><Button size="sm" variant="secondary" onClick={add}><Plus className="mr-1 h-4 w-4" />添加规格</Button></div>
    {variants.length === 0 ? <p className="rounded-lg border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-muted)]">暂无规格；单规格商品可保持为空。</p> : variants.map((item, index) => <div key={index} className="grid grid-cols-1 gap-3 rounded-lg border border-[var(--color-border)] p-3 md:grid-cols-[1fr_1.5fr_120px_120px_36px]">
      <Input label="子 SKU *" value={item.sku} onChange={e => update(index, { sku: e.target.value })} />
      <Input label="规格名称 *" value={item.name} onChange={e => update(index, { name: e.target.value })} placeholder="如：黑色 / L" />
      <Input label="库存" type="number" min="0" value={item.stock} onChange={e => update(index, { stock: Number(e.target.value) })} />
      <Input label="附加售价" type="number" min="0" value={item.price ?? ''} onChange={e => update(index, { price: e.target.value === '' ? undefined : Number(e.target.value) })} />
      <button type="button" aria-label="删除规格" className="mt-6 text-[var(--color-danger)]" onClick={() => onChange(variants.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></button>
    </div>)}
  </div>
}

export function CompliancePanel({ value, onChange }: { value: ProductCompliance; onChange: (value: ProductCompliance) => void }) {
  const field = (key: keyof ProductCompliance, label: string, placeholder?: string) => <Input label={label} value={value[key] || ''} placeholder={placeholder} onChange={e => onChange({ ...value, [key]: e.target.value })} />
  return <div className="grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2">
    {field('origin_country', '原产国/地区', '请填写真实原产地')}{field('material', '材质')}{field('safety_standard', '适用安全标准')}{field('certification_number', '认证编号')}
    <div className="md:col-span-2">{field('restricted_goods_note', '禁限售与运输说明', '如含电池、液体、磁性等，请如实填写')}</div>
    <p className="md:col-span-2 text-xs text-[var(--color-muted)]">系统不代替平台合规审核；缺失资料会在刊登预检中标记为数据缺口。</p>
  </div>
}

export function ListingsPanel({ productId, listings, initialListingId = '', initialSection = '' }: { productId?: string; listings: ProductListing[]; initialListingId?: string; initialSection?: string }) {
  const navigate = useNavigate()
  const [matrix, setMatrix] = useState<ProductListingMatrix | null>(null)
  const [loadingMatrix, setLoadingMatrix] = useState(false)
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null)
  const [savingOverride, setSavingOverride] = useState(false)
  const [promotingBase, setPromotingBase] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [editForm, setEditForm] = useState<StoreListingEditForm>({
    title: '',
    description: '',
    price: '',
    stock: '',
    imagesText: '',
    videoUrl: '',
    sourceUrl: '',
    packageWeightG: '',
    packageLengthCm: '',
    packageWidthCm: '',
    packageHeightCm: '',
    logisticsNote: '',
    publishMode: 'immediate',
    scheduledAt: '',
  })
  const [variantRows, setVariantRows] = useState<VariantEditRow[]>([])
  const [selectedListingRequirements, setSelectedListingRequirements] = useState<PlatformRequirementsLike>({})
  const [listingEditSection, setListingEditSection] = useState<ListingEditSectionKey>('basic')

  useEffect(() => {
    if (!productId) return
    let cancelled = false
    setLoadingMatrix(true)
    getProductListingMatrix(productId)
      .then(result => {
        if (!cancelled) setMatrix(result.data || null)
      })
      .catch((e: any) => {
        logger.error('Load product listing matrix failed', e)
        if (!cancelled) setMatrix(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingMatrix(false)
      })
    return () => { cancelled = true }
  }, [productId])

  const matrixInstances = matrix?.listing_instances || []
  const selectedListing = matrixInstances.find(item => item.id === selectedListingId) || matrixInstances[0] || null
  const requestedSection = normalizeListingSectionParam(initialSection)
  const masterImages = matrix?.product_master.images || []
  const selectedListingImageSet = new Set(editForm.imagesText.split('\n').map(item => item.trim()).filter(Boolean))
  const selectedListingReadiness = selectedListing
    ? listingInstanceReadiness(selectedListing, editForm, variantRows, selectedListingRequirements)
    : null
  const selectListingEditSection = (section: ListingEditSectionKey) => {
    setListingEditSection(section)
    window.setTimeout(() => {
      document.getElementById(`listing-section-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  useEffect(() => {
    if (initialListingId && matrixInstances.some(item => item.id === initialListingId)) {
      setSelectedListingId(initialListingId)
    }
  }, [initialListingId, matrixInstances])

  useEffect(() => {
    if (!selectedListingId && matrixInstances.length > 0) setSelectedListingId(matrixInstances[0].id)
  }, [matrixInstances, selectedListingId])

  useEffect(() => {
    if (!selectedListing) return
    setEditForm({
      title: selectedListing.title || '',
      description: selectedListing.description || '',
      price: selectedListing.price == null ? '' : String(selectedListing.price),
      stock: selectedListing.stock == null ? '' : String(selectedListing.stock),
      imagesText: (selectedListing.images || []).join('\n'),
      videoUrl: String(selectedListing.video_url || selectedListing.listing_overrides?.video_url || ''),
      sourceUrl: String(selectedListing.source_url || selectedListing.listing_overrides?.source_url || ''),
      packageWeightG: listingShippingValue(selectedListing, 'weight_g'),
      packageLengthCm: listingPackageSizeValue(selectedListing, 'length'),
      packageWidthCm: listingPackageSizeValue(selectedListing, 'width'),
      packageHeightCm: listingPackageSizeValue(selectedListing, 'height'),
      logisticsNote: listingShippingValue(selectedListing, 'logistics_note'),
      publishMode: listingPublishMode(selectedListing),
      scheduledAt: listingPublishValue(selectedListing, 'scheduled_at'),
    })
    setVariantRows(toVariantRows(selectedListing.variations || []))
    setSelectedListingRequirements(buildSelectedListingRequirements(selectedListing.platform_requirements, (selectedListing.listing_overrides || {}).platform_attributes))
    setSaveMessage('')
    setListingEditSection(requestedSection || 'basic')
  }, [requestedSection, selectedListing?.id])

  useEffect(() => {
    if (!selectedListing || !requestedSection) return
    window.setTimeout(() => {
      document.getElementById(`listing-section-${requestedSection}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
  }, [requestedSection, selectedListing?.id])

  const saveStoreOverride = async () => {
    if (!selectedListing) return
    setSavingOverride(true)
    setSaveMessage('')
    try {
      const variations = variantRows
        .map(row => ({
          sku: row.sku.trim(),
          name: row.name.trim(),
          stock: row.stock === '' ? 0 : Number(row.stock),
          price: row.price === '' ? undefined : Number(row.price),
        }))
        .filter(row => row.sku || row.name)
      const platformAttributes = selectedListingRequirements.attribute_values || {}
      const result = await updateListingOverrides(selectedListing.id, {
        title: editForm.title.trim(),
        description: editForm.description,
        price: editForm.price === '' ? selectedListing.price : Number(editForm.price),
        stock: editForm.stock === '' ? selectedListing.stock : Number(editForm.stock),
        images: editForm.imagesText.split('\n').map(item => item.trim()).filter(Boolean),
        video_url: editForm.videoUrl.trim(),
        source_url: editForm.sourceUrl.trim(),
        shipping_config: buildShippingConfig(editForm),
        publish_plan: buildPublishPlan(editForm),
        variations,
        platform_attributes: platformAttributes,
      })
      if (result.data) {
        setMatrix(prev => prev ? {
          ...prev,
          listing_instances: prev.listing_instances.map(item => item.id === result.data?.id ? result.data : item),
        } : prev)
        setSelectedListingId(result.data.id)
        setSaveMessage('保存店铺覆盖成功；仅更新当前店铺 Listing，不回写商品主档或其他店铺。')
      }
    } catch (e: any) {
      logger.error('Save store listing overrides failed', e)
      setSaveMessage(e?.message || '保存店铺覆盖失败')
    } finally {
      setSavingOverride(false)
    }
  }
  const promoteBaseVersion = async () => {
    if (!selectedListing) return
    setPromotingBase(true)
    setSaveMessage('')
    try {
      const result = await promoteListingToBaseVersion(selectedListing.id)
      if (result.data) {
        setMatrix(result.data)
        setSelectedListingId(selectedListing.id)
        setSaveMessage(`已从当前店铺 Listing 生成商品基础版本 V${String(result.data.base_version.version || '')}；这是显式反哺动作，其他店铺 Listing 未被修改。`)
      }
    } catch (e: any) {
      logger.error('Promote listing to base version failed', e)
      setSaveMessage(e?.message || '生成新基础版本失败')
    } finally {
      setPromotingBase(false)
    }
  }
  const toggleListingImage = (url: string) => {
    const next = new Set(selectedListingImageSet)
    if (next.has(url)) next.delete(url)
    else next.add(url)
    setEditForm({ ...editForm, imagesText: Array.from(next).join('\n') })
  }

  if (!productId) return <p className="rounded-lg border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-muted)]">请先保存商品，再创建平台 Listing 草稿。</p>

  return <div className="space-y-3">
    {matrix && (
      <ListingMasterMatrixPanel
        matrix={matrix}
        matrixInstances={matrixInstances}
        selectedListingId={selectedListing?.id}
        loadingMatrix={loadingMatrix}
        onCreateDraft={() => navigate(`/publish?product_id=${productId}`)}
        onSelectListing={setSelectedListingId}
      />
    )}

    {selectedListing && (
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4" aria-label="店铺级 Listing 编辑">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--color-fg)]">当前编辑店铺 Listing</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">{selectedListing.platform.toUpperCase()} · {selectedListing.store.account_name} · {selectedListing.store.market || '市场待补'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={promoteBaseVersion} disabled={promotingBase} aria-label="从当前店铺 Listing 生成新基础版本">{promotingBase ? '生成中...' : '生成新基础版本'}</Button>
            <Button size="sm" onClick={saveStoreOverride} disabled={savingOverride}>{savingOverride ? '保存中...' : '保存店铺覆盖'}</Button>
          </div>
        </div>
        {selectedListingReadiness && (
          <ProductListingEditOverview
            listing={selectedListing}
            master={matrix?.product_master}
            form={editForm}
            variantRows={variantRows}
            readiness={selectedListingReadiness}
            onSelectSection={selectListingEditSection}
          />
        )}
        <CurrentListingInstanceCommandPanel
          listing={selectedListing}
          master={matrix?.product_master}
          readiness={selectedListingReadiness || listingInstanceReadiness(selectedListing, editForm, variantRows, selectedListingRequirements)}
          onSelectSection={selectListingEditSection}
        />
        <PlatformListingSellerPreview
          listing={selectedListing}
          master={matrix?.product_master}
          form={editForm}
          variantRows={variantRows}
          requirements={selectedListingRequirements}
          onSelectSection={selectListingEditSection}
        />
        <ListingInlineSectionNavigator activeSection={listingEditSection} onSelectSection={selectListingEditSection} />

        <div aria-label="当前 Listing 连续编辑分区" data-ui="listing-continuous-edit-sections" data-route-param="listing_section" className="space-y-4">
          <section id="listing-section-basic" className="scroll-mt-24 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <SectionHeading title="基础信息" note="店铺标题、货源链接和当前平台店铺身份。" />
            <div className="grid gap-3 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-3">
              <Input label="店铺专属标题" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
              <Input label="货源链接" value={editForm.sourceUrl} onChange={e => setEditForm({ ...editForm, sourceUrl: e.target.value })} placeholder="如 1688、供应商或采集来源链接，仅保存到当前店铺 Listing" />
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="text-sm font-semibold text-[var(--color-fg)]">当前店铺覆盖</p>
              <p className="mt-2 text-xs text-[var(--color-muted)]">平台：{selectedListing.platform.toUpperCase()}</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">店铺：{selectedListing.store.account_name}</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">市场：{selectedListing.store.market || '市场待补'}</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">状态：{selectedListing.status}</p>
            </div>
          </div>
          </section>

          <section id="listing-section-detail" className="scroll-mt-24 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <SectionHeading title="商品详情" note="描述、卖点和买家可见的商品说明集中维护。" />
            <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-[var(--color-fg)] mb-1">店铺专属描述</label>
              <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} rows={5} className="block w-full rounded-lg border px-3 py-2 text-sm bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-fg)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs text-[var(--color-muted)]">
              <p className="font-semibold text-[var(--color-fg)]">商品详情编写规则</p>
              <p className="mt-2">Listing 详情应围绕标题、卖点、材质、尺寸、使用场景、包装清单和售后说明组织；AI 文案优化后仍要落到当前店铺 Listing 实例，不能直接覆盖其他平台/店铺。</p>
            </div>
          </div>
          </section>

          <section id="listing-section-sales" className="scroll-mt-24 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <SectionHeading title="销售资料/SKU" note="当前店铺售价、库存、SKU 和规格矩阵。" />
            <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="店铺售价" type="number" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: e.target.value })} />
              <Input label="店铺库存" type="number" value={editForm.stock} onChange={e => setEditForm({ ...editForm, stock: e.target.value })} />
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs text-[var(--color-muted)]" aria-label="促销活动独立模块提示">
              促销折扣是独立活动模块：一个活动可包含多个商品。请到“运营增长 / 促销活动”创建活动、添加商品和维护折扣，当前 Listing 编辑页只维护商品本身的售价和库存。
            </div>
            <div className="rounded-lg border border-[var(--color-border)] p-3" aria-label="SKU 变体结构化编辑">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-fg)]">SKU 变体结构化编辑</p>
                  <p className="text-xs text-[var(--color-muted)]">按当前店铺 Listing 维护平台 SKU、规格名、库存和售价。</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setVariantRows([...variantRows, { sku: '', name: '', stock: '0', price: '' }])}><Plus className="mr-1 h-4 w-4" />添加变体</Button>
              </div>
              {variantRows.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-muted)]">单规格商品可不添加变体。</p>
              ) : variantRows.map((row, index) => (
                <div key={index} className="mb-2 grid grid-cols-1 gap-2 rounded-lg border border-[var(--color-border)] p-2 md:grid-cols-[1fr_1fr_90px_100px_36px]">
                  <Input label="平台 SKU" value={row.sku} onChange={e => updateVariantRow(index, { sku: e.target.value }, variantRows, setVariantRows)} />
                  <Input label="规格名" value={row.name} onChange={e => updateVariantRow(index, { name: e.target.value }, variantRows, setVariantRows)} placeholder="如：黑色 / L" />
                  <Input label="库存" type="number" value={row.stock} onChange={e => updateVariantRow(index, { stock: e.target.value }, variantRows, setVariantRows)} />
                  <Input label="售价" type="number" value={row.price} onChange={e => updateVariantRow(index, { price: e.target.value }, variantRows, setVariantRows)} />
                  <button type="button" aria-label="删除变体" className="mt-6 text-[var(--color-danger)]" onClick={() => setVariantRows(variantRows.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </div>
          </section>

          <section id="listing-section-media" className="scroll-mt-24 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <SectionHeading title="媒体素材" note="主图、辅图、店铺视频和主档图片复用。" />
            <div className="space-y-3">
            <Input label="店铺视频 URL" value={editForm.videoUrl} onChange={e => setEditForm({ ...editForm, videoUrl: e.target.value })} placeholder="生成或采集的视频素材 URL；平台发布前按 TikTok/Shopee 规则复核格式和大小" />
            <div>
              <label className="block text-sm font-medium text-[var(--color-fg)] mb-1">图片 URL（第一张主图，其余辅图）</label>
              <textarea value={editForm.imagesText} onChange={e => setEditForm({ ...editForm, imagesText: e.target.value })} rows={6} className="block w-full rounded-lg border px-3 py-2 font-mono text-xs bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-fg)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" placeholder="每行一张真实图片 URL" />
            </div>
            <div className="rounded-lg border border-[var(--color-border)] p-3" aria-label="从商品图片选择">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-fg)]">从商品图片选择</p>
                  <p className="text-xs text-[var(--color-muted)]">商品主档已入库图片可直接用于当前店铺 Listing；勾选后会写入店铺图片列表。</p>
                </div>
                <span className="text-xs text-[var(--color-muted)]">使用主档图片 {masterImages.filter(url => selectedListingImageSet.has(url)).length}/{masterImages.length}</span>
              </div>
              {masterImages.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-muted)]">商品主档暂无已入库图片；请先到“图片”分区上传或采集图片入库。</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {masterImages.map((url, index) => {
                    const selected = selectedListingImageSet.has(url)
                    return (
                      <button
                        key={`${url}-${index}`}
                        type="button"
                        onClick={() => toggleListingImage(url)}
                        className={`rounded-xl border p-2 text-left transition ${selected ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]' : 'border-[var(--color-border)] bg-[var(--color-bg)]'}`}
                      >
                        <img src={productImageSrc(url)} alt="商品主档已入库图片" className="aspect-square w-full rounded-lg object-cover" />
                        <p className="mt-2 truncate text-[11px] text-[var(--color-muted)]">{selected ? '已用于当前 Listing' : '点击使用主档图片'}</p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs text-[var(--color-muted)]">
              <p className="font-semibold text-[var(--color-fg)]">视频与图片处理</p>
              <p className="mt-2">当前页先管理 Listing 主图/辅图引用；图片编辑、视频翻译、AI 图生视频等制作动作从内容与刊登模块进入，生成后应回填到当前店铺 Listing。</p>
            </div>
          </div>
          </section>

          <section id="listing-section-logistics" className="scroll-mt-24 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <SectionHeading title="物流与发布" note="包裹重量、尺寸、本地发布计划和平台同步边界。" />
            <div className="grid gap-3 xl:grid-cols-2">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="text-sm font-semibold text-[var(--color-fg)]">物流资料</p>
              <p className="mt-2 text-xs text-[var(--color-muted)]">商品主档重量：{matrix?.product_master.weight_g == null ? '待补' : `${matrix.product_master.weight_g}g`}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Input label="包裹重量(g)" type="number" value={editForm.packageWeightG} onChange={e => setEditForm({ ...editForm, packageWeightG: e.target.value })} />
                <Input label="物流备注" value={editForm.logisticsNote} onChange={e => setEditForm({ ...editForm, logisticsNote: e.target.value })} placeholder="如平台物流模板、特殊包装说明" />
              </div>
              <p className="mt-3 text-xs font-semibold text-[var(--color-fg)]">包裹长宽高(cm)</p>
              <div className="mt-2 grid grid-cols-3 gap-3">
                <Input label="长" type="number" value={editForm.packageLengthCm} onChange={e => setEditForm({ ...editForm, packageLengthCm: e.target.value })} />
                <Input label="宽" type="number" value={editForm.packageWidthCm} onChange={e => setEditForm({ ...editForm, packageWidthCm: e.target.value })} />
                <Input label="高" type="number" value={editForm.packageHeightCm} onChange={e => setEditForm({ ...editForm, packageHeightCm: e.target.value })} />
              </div>
              <p className="mt-3 text-xs text-[var(--color-muted)]">包裹尺寸：按当前店铺覆盖保存为 shipping_config；发布前必须满足对应平台校验。</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">平台参考：TikTok 编辑页将包裹重量、长宽高作为独立必填物流分区。</p>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="text-sm font-semibold text-[var(--color-fg)]">发布边界</p>
              <p className="mt-2 text-xs text-[var(--color-muted)]">发布状态：{selectedListing.platform_publish_status || selectedListing.platform_api_status || '本地草稿'}</p>
              <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3" aria-label="本地发布计划">
                <p className="text-xs font-semibold text-[var(--color-fg)]">本地发布计划</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--color-fg)]">
                  <label className="inline-flex items-center gap-2"><input type="radio" checked={editForm.publishMode === 'immediate'} onChange={() => setEditForm({ ...editForm, publishMode: 'immediate', scheduledAt: '' })} />立即计划</label>
                  <label className="inline-flex items-center gap-2"><input type="radio" checked={editForm.publishMode === 'scheduled'} onChange={() => setEditForm({ ...editForm, publishMode: 'scheduled' })} />定时计划</label>
                </div>
                {editForm.publishMode === 'scheduled' && (
                  <div className="mt-3">
                    <Input label="定时发布时间" value={editForm.scheduledAt} onChange={e => setEditForm({ ...editForm, scheduledAt: e.target.value })} placeholder="2026-07-16T10:30:00+08:00" />
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs text-[var(--color-muted)]">当前保存只更新本地 Listing；平台 API 接通后，由平台刊登流程执行同步、更新或定时发布。</p>
            </div>
          </div>
          </section>

          <section id="listing-section-attributes" className="scroll-mt-24 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <SectionHeading title="平台属性" note="按 Shopee / TEMU / TikTok Shop 类目字段组补齐平台要求。" />
            <div className="rounded-lg border border-[var(--color-border)] p-3" aria-label="按三平台字段组编辑">
              <div className="mb-3">
                <p className="text-sm font-semibold text-[var(--color-fg)]">按三平台字段组编辑</p>
                <p className="text-xs text-[var(--color-muted)]">根据当前 Listing 的 `field_groups` 渲染平台字段组编辑，不再要求手工猜属性 Key。</p>
              </div>
              <ListingFieldEvidencePanel requirements={selectedListingRequirements} platform={selectedListing.platform} />
              <PlatformFieldGroupEditor
                requirements={selectedListingRequirements}
                onChange={setSelectedListingRequirements}
              />
            </div>
          </section>
        </div>
        <p className="mt-3 text-xs text-[var(--color-warning)]">保存后只写入当前 `PlatformListing.platform_data.listing_overrides` 和当前 Listing 字段；不会自动同步平台，也不会改商品主档。只有点击“生成新基础版本”才会把当前店铺 Listing 显式反哺为商品基础版本并写审计。</p>
        {saveMessage && <p className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-muted)]">{saveMessage}</p>}
      </section>
    )}

    {!matrix && <LegacyListingsTable listings={listings} />}
  </div>
}

function toVariantRows(items: Array<Record<string, unknown>>): VariantEditRow[] {
  return items.map(item => ({
    sku: String(item.sku || ''),
    name: String(item.name || item.option || ''),
    stock: item.stock == null ? '0' : String(item.stock),
    price: item.price == null ? '' : String(item.price),
  }))
}

function updateVariantRow(index: number, patch: Partial<VariantEditRow>, rows: VariantEditRow[], setRows: (rows: VariantEditRow[]) => void) {
  setRows(rows.map((row, i) => i === index ? { ...row, ...patch } : row))
}

function normalizeListingSectionParam(value: string): ListingEditSectionKey | '' {
  const allowed: ListingEditSectionKey[] = ['basic', 'detail', 'sales', 'media', 'logistics', 'attributes']
  return allowed.includes(value as ListingEditSectionKey) ? value as ListingEditSectionKey : ''
}

function buildSelectedListingRequirements(requirements: PlatformRequirementsLike | undefined, overrides: unknown): PlatformRequirementsLike {
  const platformAttributes = overrides && typeof overrides === 'object' && !Array.isArray(overrides) ? overrides as Record<string, unknown> : {}
  return {
    ...(requirements || {}),
    field_groups: requirements?.field_groups || [],
    attribute_values: {
      ...(requirements?.attribute_values || {}),
      ...platformAttributes,
    },
  }
}

function buildShippingConfig(form: StoreListingEditForm) {
  const packageSize = {
    length: toOptionalNumber(form.packageLengthCm),
    width: toOptionalNumber(form.packageWidthCm),
    height: toOptionalNumber(form.packageHeightCm),
  }
  return {
    weight_g: toOptionalNumber(form.packageWeightG),
    package_size_cm: packageSize,
    logistics_note: form.logisticsNote.trim(),
  }
}

function buildPublishPlan(form: StoreListingEditForm) {
  return {
    mode: form.publishMode,
    scheduled_at: form.publishMode === 'scheduled' ? form.scheduledAt.trim() : undefined,
    status: form.publishMode === 'scheduled' ? 'local_scheduled' : 'local_planned',
    note: '当前仅保存本地发布计划；平台 Open API 未接通，不执行真实发布。',
  }
}

function listingShippingValue(item: ListingInstanceMatrixItem, key: string) {
  const source = item.shipping_config || (item.listing_overrides?.shipping_config as Record<string, unknown> | undefined) || {}
  const value = source[key]
  return value == null ? '' : String(value)
}

function listingPackageSizeValue(item: ListingInstanceMatrixItem, key: string) {
  const source = item.shipping_config || (item.listing_overrides?.shipping_config as Record<string, unknown> | undefined) || {}
  const packageSize = source.package_size_cm && typeof source.package_size_cm === 'object' ? source.package_size_cm as Record<string, unknown> : {}
  const value = packageSize[key]
  return value == null ? '' : String(value)
}

function listingPublishValue(item: ListingInstanceMatrixItem, key: string) {
  const source = item.publish_plan || (item.listing_overrides?.publish_plan as Record<string, unknown> | undefined) || {}
  const value = source[key]
  return value == null ? '' : String(value)
}

function listingPublishMode(item: ListingInstanceMatrixItem): 'immediate' | 'scheduled' {
  const mode = listingPublishValue(item, 'mode')
  return mode === 'scheduled' ? 'scheduled' : 'immediate'
}

function toOptionalNumber(value: string) {
  return value.trim() === '' ? undefined : Number(value)
}
