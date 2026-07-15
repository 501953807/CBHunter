import { useCallback, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Video, Lightbulb, Sparkles, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'
import { generateVideoContentPlan, type ContentWorkbenchItem } from '../../api/content'
import { logger } from '../../utils/logger'
import { usePlatforms } from '../../hooks/usePlatforms'
import { useConfig } from '../../hooks/useConfig'
import { filterPlatformsByCapability } from '../../utils/platformCapabilities'
import { ContentProductQueue } from './ContentProductQueue'
import { ContentTaskMatrix } from './ContentTaskMatrix'
import { ProfessionalWorkspaceFrame } from '../../components/shared/ProfessionalWorkspaceFrame'
import { productImageSrc } from '../../utils/productImages'
import { ContentListingStageRail } from './ContentListingStageRail'
import { ListingUnifiedEditorSections } from './ListingUnifiedEditorSections'
import { ListingObjectScopeMap } from './ListingObjectScopeMap'
import { ListingStoreOverrideEditor } from './ListingStoreOverrideEditor'
type VideoPlan = {
  scripts?: { title?: string; hook?: string; script?: string; shots?: string[]; tips?: string[] }[]
  hashtags?: string[]
  calendar?: { day?: string; type?: string; angle?: string; asset?: string; cta?: string }[]
  note?: string
  status?: string
  evidence_window?: string
  confidence_reason?: string
  task_version?: { task_type: string; version: number }
}
export default function ContentPlannerPage() {
  const navigate = useNavigate()
  const { tab } = useParams()
  const [searchParams] = useSearchParams()
  const initialProductId = searchParams.get('product_id') || ''
  const toast = useToast()
  const { data: platformsData } = usePlatforms()
  const { platforms, markets, categories } = useConfig()
  const storeOptions = (platformsData?.data || []).map((account: any) => ({
    value: account.id,
    label: `${account.platform} · ${account.account_name}`,
  }))
  const [activeStore, setActiveStore] = useState('')
  const activeStoreLabel = storeOptions.find(store => store.value === activeStore)?.label || ''
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [plan, setPlan] = useState<VideoPlan>({ scripts: [], hashtags: [], calendar: [] })
  const [planLoading, setPlanLoading] = useState(false)
  const [planForm, setPlanForm] = useState({
    product_name: '',
    category: '',
    platform: '',
    market: '',
    features: '',
    target_audience: '',
    selling_points: '',
  })
  const [selectedProduct, setSelectedProduct] = useState<ContentWorkbenchItem | null>(null)
  const [contentRefreshToken, setContentRefreshToken] = useState(0)
  const refreshContentTasks = useCallback(() => setContentRefreshToken(value => value + 1), [])
  const handleSelectProduct = useCallback((item: ContentWorkbenchItem) => {
    setSelectedProduct(item)
    setPlanForm(current => ({
      ...current,
      product_name: item.product_name,
      category: item.category || current.category,
      platform: item.target_platform || current.platform,
      market: item.target_market || current.market,
    }))
  }, [])

  const scripts = plan.scripts || []
  const hashtags = plan.hashtags || []
  const calendar = plan.calendar || []
  const contentPlatforms = filterPlatformsByCapability(platforms, 'content')
  const changeTab = (nextTab: string) => {
    const path = nextTab === 'title' ? '/content/title' : nextTab === 'export' ? '/content/export' : nextTab === 'media' ? '/content/image' : '/content'
    navigate(path)
  }
  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }
  const handleGeneratePlan = async () => {
    if (!planForm.product_name.trim() || !planForm.platform || !planForm.market) {
      toast.addToast('error', '请填写产品名称')
      return
    }
    setPlanLoading(true)
    setPlan({ scripts: [], hashtags: [], calendar: [] })
    try {
      const res = await generateVideoContentPlan({ ...planForm, content_item_id: selectedProduct?.id })
      const data = (res.data || {}) as VideoPlan
      setPlan(data)
      if (data.task_version) refreshContentTasks()
      if (data.note) toast.addToast(data.status === 'ready' ? 'success' : 'error', data.note)
    } catch (e: any) {
      logger.error('Generate video content plan failed', e)
      toast.addToast('error', e?.response?.data?.detail || '内容生成失败')
    }
    setPlanLoading(false)
  }

  const renderPlanForm = () => (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-[var(--color-danger)]" />
          <h3 className="font-semibold text-[var(--color-fg)]">商品内容生成</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input className="col-span-2 text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--color-danger)]" placeholder="* 产品名称"
            value={planForm.product_name} onChange={e => setPlanForm({...planForm, product_name: e.target.value})} />
          <select className="text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 outline-none bg-[var(--color-surface)]" value={planForm.platform}
            onChange={e => setPlanForm({...planForm, platform: e.target.value})}>
            <option value="">请选择平台</option>
            {contentPlatforms.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <select className="text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 outline-none bg-[var(--color-surface)]" value={planForm.market}
            onChange={e => setPlanForm({...planForm, market: e.target.value})}>
            <option value="">请选择市场</option>
            {markets.map(m => <option key={m.id} value={m.id}>{m.flag ? `${m.flag} ` : ''}{m.label}</option>)}
          </select>
          <select className="text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 outline-none bg-[var(--color-surface)]" value={planForm.category}
            onChange={e => setPlanForm({...planForm, category: e.target.value})}>
            <option value="">选择品类</option>
            {categories.map(c => <option key={c.id} value={c.label}>{c.label}</option>)}
          </select>
          <input className="text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--color-danger)]" placeholder="目标人群"
            value={planForm.target_audience} onChange={e => setPlanForm({...planForm, target_audience: e.target.value})} />
          <input className="col-span-2 text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--color-danger)]" placeholder="核心功能"
            value={planForm.features} onChange={e => setPlanForm({...planForm, features: e.target.value})} />
          <input className="col-span-2 text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--color-danger)]" placeholder="补充卖点"
            value={planForm.selling_points} onChange={e => setPlanForm({...planForm, selling_points: e.target.value})} />
        </div>
        <Button onClick={handleGeneratePlan} disabled={planLoading || !planForm.product_name.trim() || !planForm.platform || !planForm.market}>
          <Sparkles className="w-3.5 h-3.5 mr-1" />{planLoading ? '生成中...' : '生成视频内容方案'}
        </Button>
      </CardContent>
    </Card>
  )

  const renderEmptyPlan = () => (
    <div className="py-10 text-center text-[var(--color-muted)] border border-dashed border-[var(--color-border)] rounded-lg">
      <Lightbulb className="w-8 h-8 mx-auto mb-2" />
      <p className="text-sm">填写商品信息后生成真实内容方案</p>
      {plan.note && <p className="text-xs mt-2 text-[var(--color-warning)]">{plan.note}</p>}
    </div>
  )

  return (
    <div className="space-y-6">
      <ContentListingStageRail />
      <ProfessionalWorkspaceFrame
        eyebrow="Content Operations"
        title="内容制作"
        description="围绕已决策商品编制标题、卖点、视频、图片处理和刊登前内容任务，所有内容必须绑定具体商品和平台字段。"
        metrics={[
          { label: '当前商品', value: selectedProduct ? selectedProduct.product_name : '未选择', hint: selectedProduct?.lifecycle_label || '先从下方队列选择商品' },
          { label: '任务矩阵', value: contentRefreshToken ? '已刷新' : '待处理', hint: 'AI 候选需人工确认' },
          { label: '编辑方式', value: '同屏', hint: '同一商品分组编辑' },
        ]}
        actions={<div className="w-64">
          <Select
            options={storeOptions}
            value={activeStore}
            onChange={setActiveStore}
            placeholder="选择已绑定店铺"
          />
        </div>}
      />

      <ListingObjectScopeMap product={selectedProduct} storeLabel={activeStoreLabel} onNavigate={navigate} />
      <ListingStoreOverrideEditor
        product={selectedProduct}
        storeId={activeStore}
        storeLabel={activeStoreLabel}
        toast={toast}
        onSaved={refreshContentTasks}
      />

      <section aria-label="Listing 一体化内容工作台" className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
        <div className="xl:sticky xl:top-24 xl:self-start">
          <ContentProductQueue onSelect={handleSelectProduct} initialProductId={initialProductId} layout="rail" />
        </div>
        <div className="min-w-0 space-y-4">
          <CurrentListingHeader product={selectedProduct} />
          <ContentTaskMatrix product={selectedProduct} refreshToken={contentRefreshToken} />
          <section aria-label="当前商品 Listing 编辑器" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-fg)]">当前商品 Listing 编辑器</h3>
                <p className="mt-1 text-xs text-[var(--color-muted)]">标题、图片、视频、卖点、描述、平台字段、合规和发布衔接都绑定当前商品，不再脱离对象切换。</p>
              </div>
              <Badge variant={selectedProduct ? 'success' : 'warning'}>{selectedProduct ? '已锁定商品' : '未选择商品'}</Badge>
            </div>
            <ListingCompositionBoard product={selectedProduct} changeTab={changeTab} />
            <ListingUnifiedEditorSections
              product={selectedProduct}
              storeId={activeStore}
              storeLabel={activeStoreLabel}
              mediaMode={tab === 'video' ? 'video' : tab === 'image' ? 'image' : 'all'}
              renderPlanForm={renderPlanForm}
              renderEmptyPlan={renderEmptyPlan}
              plan={plan}
              scripts={scripts}
              calendar={calendar}
              hashtags={hashtags}
              copiedIndex={copiedIndex}
              onCopy={handleCopy}
              toast={toast}
              onGenerated={refreshContentTasks}
            />
          </section>
        </div>
        <ContentListingContextPanel product={selectedProduct} activeStore={activeStore} onNavigate={navigate} />
      </section>
    </div>
  )
}

function ListingCompositionBoard({ product, changeTab }: {
  product: ContentWorkbenchItem | null
  changeTab: (nextTab: string) => void
}) {
  const media = product?.media_readiness
  const platformRequirements = product?.platform_requirements
  const brief = product?.content_brief
  const imageCount = media?.captured_image_count ?? 0
  const minImages = media?.min_platform_images ?? 5
  const mediaReady = imageCount >= minImages
  const requirementCount = [
    ...(platformRequirements?.required_attributes || []),
    ...(platformRequirements?.content || []),
    ...(platformRequirements?.media || []),
    ...(platformRequirements?.compliance || []),
  ].length
  const openGaps = product?.content_gaps || []
  const sections = [
    {
      key: 'title',
      title: '商品标题',
      subtitle: brief?.title || '待生成/待确认平台标题',
      status: brief?.title ? '有候选' : '待编制',
      readiness: brief?.title ? 80 : 20,
      risk: brief?.title ? '标题候选已生成，仍需按目标平台长度和关键词确认。' : '缺少平台标题，无法进入发布校验。',
      targetTab: 'title',
    },
    {
      key: 'bullets',
      title: '五点卖点',
      subtitle: brief?.bullets?.length ? `已生成 ${brief.bullets.length} 条卖点候选` : '围绕痛点、功能、规格、场景和信任点编制',
      status: brief?.bullets?.length ? '有候选' : '待编制',
      readiness: brief?.bullets?.length ? Math.min(100, brief.bullets.length * 18) : 15,
      risk: brief?.bullets?.length ? '卖点需人工选择排序，避免平台违禁词和夸大表达。' : '缺少卖点，商品详情页无法支撑转化。',
      targetTab: 'title',
    },
    {
      key: 'description',
      title: '长描述',
      subtitle: '承接材质、尺寸、用法、适配场景和品牌说明',
      status: openGaps.some(gap => gap.includes('描述')) ? '缺描述' : '待核验',
      readiness: openGaps.some(gap => gap.includes('描述')) ? 20 : product ? 55 : 0,
      risk: openGaps.some(gap => gap.includes('描述')) ? '描述缺口会影响转化和平台信息完整度。' : '长描述需补齐材质、尺寸、使用场景和售后说明。',
      targetTab: 'title',
    },
    {
      key: 'images',
      title: '主图/辅图',
      subtitle: `已采集 ${imageCount} 张 / 平台至少 ${minImages} 张${media?.gaps?.length ? `；缺 ${media.gaps.join('、')}` : ''}`,
      status: mediaReady ? '数量达标' : '需补图',
      readiness: minImages > 0 ? Math.min(100, Math.round((imageCount / minImages) * 100)) : 0,
      risk: mediaReady ? '图片数量达到基础门槛，仍需检查白底图、场景图、尺寸图和违禁元素。' : '图片数量不足，无法形成可发布 Listing。',
      targetTab: 'media',
    },
    {
      key: 'video',
      title: '商品视频',
      subtitle: brief?.video_script ? '已有视频脚本候选，可进入脚本和素材区处理' : '短视频脚本、镜头、卖点顺序和 CTA 待生成',
      status: brief?.video_script ? '有脚本' : '待制作',
      readiness: brief?.video_script ? 70 : 15,
      risk: brief?.video_script ? '脚本需与主图和详情卖点保持一致。' : 'TikTok Shop 等内容场景缺少视频脚本支撑。',
      targetTab: 'scripts',
    },
    {
      key: 'sku',
      title: 'SKU/变体',
      subtitle: '颜色、尺寸、规格、SPU/SKC 与店铺 Listing 实例隔离',
      status: '待校验',
      readiness: product ? 45 : 0,
      risk: '基础商品与店铺 Listing 实例必须隔离，店铺改价/改规格不能污染基础版本。',
      targetTab: 'export',
    },
    {
      key: 'platform-attrs',
      title: '平台属性',
      subtitle: requirementCount ? `已识别 ${requirementCount} 个平台字段/素材/合规要求` : '待选择平台和店铺后加载必填字段组',
      status: requirementCount ? '已识别' : '待加载',
      readiness: requirementCount ? 62 : 10,
      risk: requirementCount ? '字段组已识别，发布前需按店铺/平台实例逐项校验。' : '未加载平台字段组，无法判断 Shopee/TEMU/TikTok Shop 差异。',
      targetTab: 'export',
    },
    {
      key: 'logistics',
      title: '物流包装',
      subtitle: '重量、尺寸、包装、发货时效和平台配送限制需在发布前确认',
      status: '待确认',
      readiness: product ? 35 : 0,
      risk: '重量、尺寸、包装和发货时效影响运费、履约风险和平台限制。',
      targetTab: 'export',
    },
    {
      key: 'compliance',
      title: '合规检查',
      subtitle: platformRequirements?.compliance?.length ? platformRequirements.compliance.slice(0, 3).join('、') : '类目禁限售、图片文案、认证资料和平台规则待核验',
      status: platformRequirements?.compliance?.length ? '有规则' : '待核验',
      readiness: platformRequirements?.compliance?.length ? 60 : 10,
      risk: platformRequirements?.compliance?.length ? '合规规则已识别，需逐平台确认资质和禁限售表达。' : '缺少合规规则会放大发布失败和下架风险。',
      targetTab: 'export',
    },
    {
      key: 'pricing',
      title: '定价衔接',
      subtitle: product ? '内容确认后进入定价校验，生成店铺级 Listing 草稿' : '选择商品后衔接定价和发布',
      status: product?.content_status === 'ready' ? '可定价' : '待内容确认',
      readiness: product?.content_status === 'ready' ? 80 : product ? 35 : 0,
      risk: '定价必须在内容、平台字段和店铺目标明确后校验，避免重复发布错误草稿。',
      targetTab: 'export',
    },
  ]
  const overallReadiness = sections.length ? Math.round(sections.reduce((sum, section) => sum + section.readiness, 0) / sections.length) : 0
  const blockingCount = sections.filter(section => section.readiness < 50).length
  const readyCount = sections.filter(section => section.readiness >= 70).length

  return (
    <section aria-label="当前商品 Listing 编制总表" className="mb-4 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[var(--color-primary)]">同一商品 Listing 编制总表</p>
            <h3 className="mt-1 text-base font-semibold text-[var(--color-fg)]">Listing 发布门禁清单</h3>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--color-muted)]">
              这里不是模块入口卡片，而是当前商品的发布前清单。标题、卖点、长描述、主图/辅图、商品视频、SKU/变体、平台属性、物流包装、合规检查和定价衔接在一个对象下连续推进。
            </p>
          </div>
          <div className="min-w-[220px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-[var(--color-muted)]">整体完整度</span>
              <span className="text-sm font-semibold text-[var(--color-fg)]">{overallReadiness}%</span>
            </div>
            <ListingProgress value={overallReadiness} />
            <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--color-muted)]">
              <span>达标 {readyCount}</span>
              <span>阻断 {blockingCount}</span>
              <Badge variant={product ? 'default' : 'warning'}>{product ? '已锁定' : '未选择'}</Badge>
            </div>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-xs text-[var(--color-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Listing 字段</th>
              <th className="px-4 py-3 font-medium">当前状态</th>
              <th className="px-4 py-3 font-medium">完整度</th>
              <th className="px-4 py-3 font-medium">缺口/风险</th>
              <th className="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
            {sections.map(section => (
              <tr key={section.key} className="transition hover:bg-[var(--color-bg)]">
                <td className="px-4 py-3 align-top">
                  <p className="font-semibold text-[var(--color-fg)]">{section.title}</p>
                  <p className="mt-1 max-w-md text-xs leading-5 text-[var(--color-muted)]">{section.subtitle}</p>
                </td>
                <td className="px-4 py-3 align-top">
                  <ListingStatusPill value={section.status} readiness={section.readiness} />
                </td>
                <td className="w-44 px-4 py-3 align-top">
                  <div className="flex items-center gap-2">
                    <ListingProgress value={section.readiness} />
                    <span className="w-9 text-right text-xs font-semibold text-[var(--color-fg)]">{section.readiness}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <p className={section.readiness < 50 ? 'max-w-lg text-xs leading-5 text-[var(--color-warning)]' : 'max-w-lg text-xs leading-5 text-[var(--color-muted)]'}>
                    {section.risk}
                  </p>
                </td>
                <td className="px-4 py-3 text-right align-top">
                  <Button size="sm" variant="outline" onClick={() => changeTab(section.targetTab)} disabled={!product}>
                    定位处理 <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ListingProgress({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value))
  const color = clamped >= 70 ? 'var(--color-success)' : clamped >= 50 ? 'var(--color-primary)' : 'var(--color-warning)'
  return (
    <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-border)]">
      <span className="block h-full rounded-full transition-all" style={{ width: `${clamped}%`, background: color }} />
    </div>
  )
}

function ListingStatusPill({ value, readiness }: { value: string; readiness: number }) {
  const color = readiness >= 70 ? 'var(--color-success)' : readiness >= 50 ? 'var(--color-primary)' : 'var(--color-warning)'
  const background = readiness >= 70 ? 'var(--color-success-light)' : readiness >= 50 ? 'var(--color-primary-light)' : 'var(--color-warning-light)'
  return (
    <span className="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium" style={{ borderColor: color, color, background }}>
      {value}
    </span>
  )
}

function CurrentListingHeader({ product }: { product: ContentWorkbenchItem | null }) {
  const media = product?.media_readiness
  const requirements = product?.platform_requirements
  const requiredAttributes = requirements?.required_attributes || []
  const attributeValues = requirements?.attribute_values || {}
  const filledAttributes = requiredAttributes.filter(field => hasAttributeValue(attributeValues, field)).length
  const imageCount = media?.captured_image_count ?? 0
  const minImages = media?.min_platform_images ?? 5
  const recommendedImages = media?.recommended_platform_images ?? 9
  const mediaPct = minImages > 0 ? Math.min(100, Math.round((imageCount / minImages) * 100)) : 0
  const attrPct = requiredAttributes.length ? Math.round((filledAttributes / requiredAttributes.length) * 100) : 0
  const contentReady = product?.content_status === 'ready'
  const contentPct = contentReady ? 100 : product?.content_status === 'in_progress' ? 55 : product ? 18 : 0
  const readinessItems = [
    { label: '内容任务', value: product ? product.content_status === 'ready' ? '可进入定价' : product.content_status === 'in_progress' ? '制作中' : '未开始' : '未选择', pct: contentPct, tone: contentReady ? 'success' : 'warning' },
    { label: '图片素材', value: product ? `${imageCount}/${minImages} 张` : '未选择', pct: mediaPct, tone: imageCount >= minImages ? 'success' : 'warning' },
    { label: '平台属性', value: product ? `${filledAttributes}/${requiredAttributes.length || 0}` : '未选择', pct: attrPct, tone: requiredAttributes.length > 0 && filledAttributes >= requiredAttributes.length ? 'success' : 'warning' },
  ]
  const previewImages = product?.image_url ? [product.image_url] : []
  const priceText = product?.selling_price_local != null ? `${product.selling_price_local}` : '待定价'
  const sourcePriceText = product?.source_price_rmb != null ? `¥${product.source_price_rmb}` : '采购价待补'
  const profitText = product?.profit_margin_pct != null ? `${product.profit_margin_pct}%` : '利润待校验'
  const gaps = [
    ...(product?.content_gaps || []),
    ...(media?.gaps || []),
    ...requiredAttributes.filter(field => !hasAttributeValue(attributeValues, field)).slice(0, 4).map(field => `缺属性：${field}`),
  ]
  return (
    <section aria-label="当前商品 Listing 对象总览" className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
      <div className="grid gap-0 xl:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]">
        <div className="border-b border-[var(--color-border)] bg-[var(--color-bg)] p-4 xl:border-b-0 xl:border-r">
          <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            {product?.image_url ? (
              <img src={productImageSrc(product.image_url)} alt={product.product_name} className="aspect-[4/3] w-full object-cover" />
            ) : (
              <div className="grid aspect-[4/3] place-items-center text-xs text-[var(--color-muted)]">未选择商品</div>
            )}
            <div className="absolute bottom-2 left-2 rounded-full bg-[var(--color-surface)]/95 px-2 py-1 text-[11px] text-[var(--color-muted)] shadow-[var(--shadow-sm)]">
              主图 {imageCount}/{recommendedImages}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-5 gap-1">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="grid aspect-square place-items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[10px] text-[var(--color-muted)]">
                {previewImages[index] ? <img src={productImageSrc(previewImages[index])} alt={`商品图 ${index + 1}`} className="h-full w-full rounded-lg object-cover" /> : index === 0 ? '主图' : `辅${index}`}
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--color-primary)]">当前编辑商品 · 当前 Listing 商品对象</p>
              <h2 className="mt-1 line-clamp-2 text-2xl font-bold tracking-tight text-[var(--color-fg)]">{product?.product_name || '请先从左侧选择待制作商品'}</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                {product ? `${product.target_platform || '平台待补'} / ${product.target_market || '市场待补'} · ${product.category || '类目待补'} · ${product.lifecycle_label}` : '选择商品后，标题、图片、视频、平台字段和下游定价发布都围绕同一个对象处理。'}
              </p>
            </div>
            <Badge variant={contentReady ? 'success' : product ? 'warning' : 'default'}>{product ? product.next_action || product.content_status : '未锁定商品'}</Badge>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {readinessItems.map(item => <ListingReadinessMeter key={item.label} {...item} />)}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1.2fr]">
            <ListingFact label="价格链路" value={`售价 ${priceText}`} detail={`采购 ${sourcePriceText} · ${profitText}`} warning={product?.selling_price_local == null || product?.profit_margin_pct == null} />
            <ListingFact label="平台字段" value={`${filledAttributes}/${requiredAttributes.length || 0} 已填`} detail={(requirements?.evidence_source || '字段组待平台/类目补齐') as string} warning={requiredAttributes.length === 0 || filledAttributes < requiredAttributes.length} />
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="text-[11px] text-[var(--color-muted)]">当前缺口</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {gaps.slice(0, 5).map(gap => (
                  <span key={gap} className="rounded-full bg-[var(--color-warning-light)] px-2 py-1 text-[11px] text-[var(--color-warning)]">{gap}</span>
                ))}
                {gaps.length === 0 && <span className="rounded-full bg-[var(--color-success-light)] px-2 py-1 text-[11px] text-[var(--color-success)]">暂无阻断缺口</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ListingReadinessMeter({ label, value, pct, tone }: { label: string; value: string; pct: number; tone: string }) {
  const color = tone === 'success' ? 'var(--color-success)' : 'var(--color-warning)'
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-[var(--color-muted)]">{label}</span>
        <span className="text-xs font-semibold text-[var(--color-fg)]">{value}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(4, Math.min(100, pct))}%`, background: color }} />
      </div>
    </div>
  )
}

function ListingFact({ label, value, detail, warning }: { label: string; value: string; detail: string; warning?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className={warning ? 'mt-1 text-sm font-semibold text-[var(--color-warning)]' : 'mt-1 text-sm font-semibold text-[var(--color-fg)]'}>{value}</p>
      <p className="mt-1 line-clamp-2 text-[11px] text-[var(--color-muted)]">{detail}</p>
    </div>
  )
}

function ContentListingContextPanel({ product, activeStore, onNavigate }: {
  product: ContentWorkbenchItem | null
  activeStore: string
  onNavigate: (path: string) => void
}) {
  const attrs = product?.platform_requirements?.required_attributes || []
  const media = product?.platform_requirements?.media || []
  const pricingRoute = product ? `/pricing?content_item_id=${product.id}` : '/pricing'
  const publishProductId = product?.object_refs?.find(ref => ref.type === 'product')?.id
  const publishRoute = publishProductId ? `/publish?product_id=${publishProductId}` : '/publish'
  return (
    <aside className="professional-context-rail space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] xl:sticky xl:top-24 xl:self-start" aria-label="Listing 右侧校验与下游动作">
      <div>
        <p className="text-sm font-semibold text-[var(--color-fg)]">Listing 校验与衔接</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">右侧只展示当前商品的字段缺口、素材要求和下一步动作。</p>
      </div>
      <InfoRow label="目标店铺" value={activeStore || '未选择店铺'} warning={!activeStore} />
      <InfoRow label="目标平台" value={product?.target_platform || '待补'} warning={!product?.target_platform} />
      <InfoRow label="目标市场" value={product?.target_market || '待补'} warning={!product?.target_market} />
      <InfoRow label="内容状态" value={product?.content_status || '未选择商品'} warning={!product || product.content_status !== 'ready'} />
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
        <p className="text-xs font-semibold text-[var(--color-fg)]">平台字段与素材要求</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[...attrs, ...media].slice(0, 10).map(item => (
            <span key={item} className="rounded-full border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-muted)]">{item}</span>
          ))}
          {[...attrs, ...media].length === 0 && <span className="text-xs text-[var(--color-muted)]">选择商品后展示字段组和素材要求。</span>}
        </div>
      </div>
      <ContentPlatformPreviewPanel product={product} />
      <div className="grid gap-2">
        <Button onClick={() => onNavigate(pricingRoute)} disabled={!product}>
          进入定价校验 <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
        <Button variant="secondary" onClick={() => onNavigate(publishRoute)} disabled={!product}>
          打开发布队列
        </Button>
      </div>
    </aside>
  )
}

function ContentPlatformPreviewPanel({ product }: { product: ContentWorkbenchItem | null }) {
  const attrs = product?.platform_requirements?.required_attributes || []
  const content = product?.platform_requirements?.content || []
  const compliance = product?.platform_requirements?.compliance || []
  const attributeValues = product?.platform_requirements?.attribute_values || {}
  const objectModel = product?.platform_requirements?.object_model || []
  const imageCount = product?.media_readiness?.captured_image_count ?? 0
  const minImages = product?.media_readiness?.min_platform_images ?? 5
  const mediaGaps = product?.media_readiness?.gaps || []
  const title = product?.content_brief?.title || product?.product_name || '待选择商品'
  const attrFilled = attrs.filter(attr => hasAttributeValue(attributeValues, attr)).length
  const skuSignals = attrs.filter(attr => /(sku|variation|variant|颜色|色|尺码|尺寸|规格|型号|款式|color|size|model)/i.test(attr))
  const logisticsSignals = attrs.concat(objectModel).filter(attr => /(weight|dimension|package|shipping|logistics|重量|尺寸|包装|物流|长|宽|高)/i.test(attr))
  const priceText = product?.selling_price_local != null ? `${product.selling_price_local}` : '待定价'
  const sourcePriceText = product?.source_price_rmb != null ? `¥${product.source_price_rmb}` : '采购价待补'
  const profitText = product?.profit_margin_pct != null ? `${product.profit_margin_pct}%` : '利润率待校验'
  const platformCards = [
    {
      name: 'Shopee',
      accent: 'var(--color-primary)',
      summary: '商品名称、类目属性、规格库存、重量物流和图片诊断',
      fieldFocus: attrs.slice(0, 3),
      complianceFocus: compliance.slice(0, 2),
      backendFocus: ['类目属性', '规格/SKU', '重量物流', '图片诊断'],
    },
    {
      name: 'TEMU',
      accent: 'var(--color-warning)',
      summary: 'SPU/SKC/SKU、申报价格、包装尺寸、敏感属性和商品优化待办',
      fieldFocus: attrs.slice(0, 2).concat(content.slice(0, 1)),
      complianceFocus: compliance.slice(0, 2),
      backendFocus: ['SPU/SKC/SKU', '申报价格', '包装尺寸', '敏感属性'],
    },
    {
      name: 'TikTok Shop',
      accent: 'var(--color-danger)',
      summary: '商品详情、销售变体、短视频素材、包裹重量尺寸和多国家售卖',
      fieldFocus: attrs.slice(0, 2).concat('short_video'),
      complianceFocus: compliance.slice(0, 2),
      backendFocus: ['商品详情', '销售变体', '短视频素材', '包裹重量尺寸'],
    },
  ]

  return (
    <section aria-label="三平台 Listing 预览与字段缺口" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="mb-3">
        <p className="text-xs font-semibold text-[var(--color-fg)]">三平台 Listing 预览与字段缺口</p>
        <p className="mt-1 text-[11px] text-[var(--color-muted)]">按卖家后台关键项预览：图片、标题、类目属性、SKU/变体、价格、物流和合规；发布前仍以定价和批量刊登校验为准。</p>
      </div>
      <div className="space-y-2">
        {platformCards.map((platform) => {
          const fieldGaps = platform.fieldFocus.length ? platform.fieldFocus : ['目标类目字段待补']
          const complianceFocus = platform.complianceFocus.length ? platform.complianceFocus : ['禁限售/认证规则待核验']
          const mediaGapText = imageCount >= minImages
            ? `图片 ${imageCount}/${minImages}，基础数量达标`
            : `图片 ${imageCount}/${minImages}，媒体缺口：${mediaGaps.slice(0, 2).join('、') || '主图/辅图待补'}`
          const skuText = skuSignals.length ? skuSignals.slice(0, 3).join('、') : 'SKU/变体字段待补'
          const logisticsText = logisticsSignals.length ? logisticsSignals.slice(0, 3).join('、') : '重量/尺寸/包装待补'
          return (
            <div key={platform.name} className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="border-b border-[var(--color-border)] px-3 py-2" style={{ background: 'var(--color-bg)' }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold" style={{ color: platform.accent }}>{platform.name}</p>
                  <Badge variant={product ? imageCount >= minImages ? 'success' : 'warning' : 'warning'}>{product ? '卖家后台预览' : '待选'}</Badge>
                </div>
                <p className="mt-1 text-[11px] text-[var(--color-muted)]">{platform.summary}</p>
              </div>
              <div className="grid gap-3 p-3">
                <div className="flex gap-3">
                  {product?.image_url ? (
                    <img src={productImageSrc(product.image_url)} alt={product.product_name} className="h-16 w-16 shrink-0 rounded-lg border border-[var(--color-border)] object-cover" />
                  ) : (
                    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[10px] text-[var(--color-muted)]">主图待补</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-semibold text-[var(--color-fg)]">{title}</p>
                    <p className="mt-1 text-[11px] text-[var(--color-muted)]">{product?.category || '类目待补'} · {product?.target_market || '市场待补'}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {platform.backendFocus.map(item => (
                        <span key={item} className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]">{item}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid gap-1.5 text-[11px]">
                  <PreviewRow label="标题" value={title.length > 90 ? `标题偏长 ${title.length} 字` : `标题 ${title.length} 字`} warning={!product || title === product?.product_name} />
                  <PreviewRow label="图片" value={mediaGapText} warning={imageCount < minImages} />
                  <PreviewRow label="类目属性" value={`${attrFilled}/${attrs.length || 0} 已有值；${fieldGaps.slice(0, 3).join('、')}`} warning={attrs.length === 0 || attrFilled < attrs.length} />
                  <PreviewRow label="SKU/变体" value={skuText} warning={skuSignals.length === 0} />
                  <PreviewRow label="价格" value={`售价 ${priceText}；采购 ${sourcePriceText}；${profitText}`} warning={product?.selling_price_local == null || product?.profit_margin_pct == null} />
                  <PreviewRow label="物流包装" value={logisticsText} warning={logisticsSignals.length === 0} />
                  <PreviewRow label="合规重点" value={complianceFocus.join('、')} warning={compliance.length === 0} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function hasAttributeValue(values: Record<string, unknown>, field: string) {
  const value = values[field]
  if (Array.isArray(value)) return value.length > 0
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function PreviewRow({ label, value, warning }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5">
      <span className="font-medium text-[var(--color-muted)]">{label}：</span>
      <span className={warning ? 'text-[var(--color-warning)]' : 'text-[var(--color-fg)]'}>{value}</span>
    </div>
  )
}

function InfoRow({ label, value, warning }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className={warning ? 'font-medium text-[var(--color-warning)]' : 'font-medium text-[var(--color-fg)]'}>{value}</span>
    </div>
  )
}
