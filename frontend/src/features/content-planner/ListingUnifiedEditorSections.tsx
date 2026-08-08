import type { ReactNode } from 'react'
import { Copy, Hash } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import type { ToastContextType } from '../../components/ui/Toast'
import type { ContentWorkbenchItem } from '../../api/content'
import { ContentTitleGenerator } from './ContentTitleGenerator'
import { ContentMediaStudio } from './ContentMediaStudio'
import { ContentPublishGuide } from './ContentPublishGuide'
import { ListingSpecificationEditor } from './ListingSpecificationEditor'

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

type ListingUnifiedEditorSectionsProps = {
  product: ContentWorkbenchItem | null
  storeId: string
  storeLabel: string
  mediaMode: 'all' | 'image' | 'video'
  renderPlanForm: () => ReactNode
  renderEmptyPlan: () => ReactNode
  plan: VideoPlan
  scripts: NonNullable<VideoPlan['scripts']>
  calendar: NonNullable<VideoPlan['calendar']>
  hashtags: string[]
  copiedIndex: number | null
  onCopy: (text: string, index: number) => void
  toast: ToastContextType
  onGenerated: () => void
}

export function ListingUnifiedEditorSections({
  product,
  storeId,
  storeLabel,
  mediaMode,
  renderEmptyPlan,
  scripts,
  hashtags,
  onCopy,
  toast,
  onGenerated,
}: ListingUnifiedEditorSectionsProps) {
  const sections = [
    { id: 'copy', label: '文案', title: '标题与商品详情', summary: '商品名称、卖点摘要、商品详情、后台关键词候选', status: product?.content_brief?.title ? '有候选' : '待生成' },
    { id: 'media', label: '发布图', title: '发布图与素材槽位', summary: '主图、辅图、尺寸图、场景图、细节图和图片处理', status: product?.media_readiness?.captured_image_count ? `${product.media_readiness.captured_image_count} 张发布图` : '待补发布图' },
    { id: 'specs', label: '规格属性', title: 'SKU/平台属性/物流合规', summary: 'SKU/变体、平台属性、物流包装、合规检查', status: product?.platform_requirements?.required_attributes?.length ? '字段组已识别' : '待补字段组' },
  ]
  const titleTerms = (product?.content_brief?.title || '')
    .split(/[\s,，、/｜|]+/)
    .map(term => term.trim())
    .filter(Boolean)
    .slice(0, 8)
  const categoryTerms = [
    product?.category,
    product?.target_market,
    product?.target_platform,
  ].filter(Boolean) as string[]
  const sceneTerms = (product?.content_brief?.bullets || [])
    .flatMap(bullet => bullet.split(/[\s,，、/｜|]+/))
    .map(term => term.trim())
    .filter(term => term.length >= 2)
    .slice(0, 8)
  const platformTags = hashtags.map(tag => tag.replace('#', '')).slice(0, 12)
  const searchTermPackage = [...new Set([...titleTerms, ...categoryTerms, ...sceneTerms, ...platformTags])].join(' ')

  return (
    <section aria-label="当前商品 Listing 同屏分组编辑" data-ui="listing-editor-wide-continuous-layout" className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <p className="text-xs font-semibold text-[var(--color-primary)]">Listing 同屏编辑台</p>
        <h3 className="mt-1 text-base font-semibold text-[var(--color-fg)]">围绕一个商品连续编辑完整 Listing</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
          主表单只处理同一商品的标题/详情、发布图、SKU/属性/物流/合规；搜索词、内容视频和下游衔接收拢为辅助条，避免挤压核心编辑区。
        </p>
        <ContentListingCapabilityMap product={product} scriptsCount={scripts.length} hashtagsCount={hashtags.length} />
      </div>

      <div>
        <nav aria-label="Listing 字段导航" className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="flex min-w-0 gap-2 overflow-x-auto">
            {sections.map(section => (
              <a
                key={section.id}
                href={`#listing-editor-${section.id}`}
                className="min-w-[108px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-left transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
              >
                <span className="block text-xs font-semibold text-[var(--color-fg)]">{section.label}</span>
                <span className="mt-1 block text-[11px] text-[var(--color-muted)]">{section.status}</span>
              </a>
            ))}
          </div>
        </nav>

        <div className="min-w-0 space-y-4 p-4">
          <ListingEditorSection
            id="copy"
            title="标题与商品详情"
            description="商品名称、卖点摘要、商品详情和后台关键词候选先在同一商品下生成，再由人工确认进入内容任务矩阵。"
          >
            <ContentTitleGenerator toast={toast} product={product} onGenerated={onGenerated} />
          </ListingEditorSection>

          <ListingEditorSection
            id="media"
            title="发布图与素材槽位"
            description="主图、辅图、尺寸图、场景图和细节图都绑定当前商品，发布图必须来自确认图片槽位计划。"
          >
            <ContentMediaStudio mode={mediaMode} product={product} />
          </ListingEditorSection>

          <ListingEditorSection
            id="specs"
            title="SKU/属性/物流/合规"
            description="SKU/变体、平台属性、物流包装和合规检查在当前 Listing 草稿内准备，发布前再写入店铺 Listing 实例。"
          >
            <ListingSpecificationEditor product={product} storeId={storeId} storeLabel={storeLabel} toast={toast} onGenerated={onGenerated} />
          </ListingEditorSection>

          <ListingAuxiliaryStrip
            product={product}
            scriptsCount={scripts.length}
            hashtagsCount={hashtags.length}
            searchTermPackage={searchTermPackage}
            titleTerms={titleTerms}
            categoryTerms={categoryTerms}
            sceneTerms={sceneTerms}
            platformTags={platformTags}
            renderEmptyPlan={renderEmptyPlan}
            onCopy={onCopy}
          />
        </div>

        <section aria-label="Listing 段落校验摘要" className="border-t border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <p className="text-xs font-semibold text-[var(--color-fg)]">段落校验摘要</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {sections.map(section => (
              <div key={section.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[var(--color-fg)]">{section.title}</p>
                  <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]">{section.status}</span>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-[var(--color-muted)]">{section.summary}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

function ListingAuxiliaryStrip({
  product,
  scriptsCount,
  hashtagsCount,
  searchTermPackage,
  titleTerms,
  categoryTerms,
  sceneTerms,
  platformTags,
  renderEmptyPlan,
  onCopy,
}: {
  product: ContentWorkbenchItem | null
  scriptsCount: number
  hashtagsCount: number
  searchTermPackage: string
  titleTerms: string[]
  categoryTerms: string[]
  sceneTerms: string[]
  platformTags: string[]
  renderEmptyPlan: () => ReactNode
  onCopy: (text: string, index: number) => void
}) {
  return (
    <section aria-label="Listing 辅助功能收拢条" data-ui="listing-auxiliary-support-strip" className="grid gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.8fr)_minmax(260px,1fr)]">
      <section aria-label="Listing 搜索词后台编辑区" data-ui="listing-search-terms-editor" className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] p-3">
          <div>
            <p className="text-xs font-semibold text-[var(--color-primary)]">后台 Search Terms</p>
            <h3 className="mt-1 text-sm font-semibold text-[var(--color-fg)]">搜索词来源与平台标签</h3>
            <p className="mt-1 text-xs text-[var(--color-muted)]">辅助平台检索归档，不替代主表单中的标题、商品详情和平台必填属性。</p>
          </div>
          <Button size="sm" variant="outline" disabled={!searchTermPackage} onClick={() => onCopy(searchTermPackage, 9001)}>
            <Copy className="mr-1 h-3 w-3" />复制搜索词包
          </Button>
        </div>
        {searchTermPackage.length === 0 ? renderEmptyPlan() : (
          <div className="grid gap-2 p-3 md:grid-cols-2">
            <SearchTermColumn title="后台 Search Terms" source="标题候选 / 商品名称" terms={titleTerms} onCopy={onCopy} />
            <SearchTermColumn title="品类词" source="类目 / 平台 / 目标市场" terms={categoryTerms} onCopy={onCopy} />
            <SearchTermColumn title="场景词" source="卖点摘要 / 使用场景" terms={sceneTerms} onCopy={onCopy} />
            <SearchTermColumn title="平台标签" source="AI 候选 / 内容任务" terms={platformTags} onCopy={onCopy} />
          </div>
        )}
      </section>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
        <p className="text-xs font-semibold text-[var(--color-primary)]">内容素材辅助</p>
        <h3 className="mt-1 text-sm font-semibold text-[var(--color-fg)]">视频与话题只做候选摘要</h3>
        <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
          已有 {scriptsCount} 条脚本候选、{hashtagsCount} 个话题标签。这里不铺开脚本正文，避免干扰商品 Listing 主表单；后续应迁入独立内容计划页。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant={scriptsCount ? 'success' : 'warning'}>{scriptsCount ? '脚本有候选' : '脚本待生成'}</Badge>
          <Badge variant={hashtagsCount ? 'success' : 'warning'}>{hashtagsCount ? '标签有候选' : '标签待生成'}</Badge>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
        <p className="text-xs font-semibold text-[var(--color-primary)]">下游动作</p>
        <h3 className="mt-1 text-sm font-semibold text-[var(--color-fg)]">定价与发布只保留去向</h3>
        <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">当前页不重复定价或发布功能，完成 Listing 主表单后再进入定价校验和批量刊登。</p>
        <div className="mt-3">
          <ContentPublishGuide product={product} />
        </div>
      </div>
    </section>
  )
}

function ContentListingCapabilityMap({
  product,
  scriptsCount,
  hashtagsCount,
}: {
  product: ContentWorkbenchItem | null
  scriptsCount: number
  hashtagsCount: number
}) {
  const imageCount = product?.media_readiness?.captured_image_count ?? 0
  const minImages = product?.media_readiness?.min_platform_images ?? 5
  const titleReady = Boolean(product?.content_brief?.title)
  const bulletsReady = Boolean(product?.content_brief?.bullets?.length)
  const platformFieldCount = [
    ...(product?.platform_requirements?.required_attributes || []),
    ...(product?.platform_requirements?.content || []),
    ...(product?.platform_requirements?.media || []),
    ...(product?.platform_requirements?.compliance || []),
  ].length
  const capabilities = [
    {
      title: '标题生成',
      detail: titleReady ? '已有标题候选，需按平台关键词和长度人工确认。' : '用 AI/五步法生成候选标题，再保存为内容任务版本。',
      status: titleReady ? '有候选' : '待生成',
    },
    {
      title: '描述编辑',
      detail: bulletsReady ? '已有卖点摘要候选，继续补商品详情和关键词。' : '补卖点摘要、材质、尺寸、场景、包装和售后说明。',
      status: bulletsReady ? '卖点候选' : '待编辑',
    },
    {
      title: '图片处理',
      detail: `平台至少 ${minImages} 张发布图；当前 ${imageCount} 张，发布图不足时先补主图、辅图、尺寸图、场景图和细节图。`,
      status: imageCount >= minImages ? '发布图达标' : '待补发布图',
    },
    {
      title: '视频脚本',
      detail: '围绕当前商品生成 hook、镜头、脚本、CTA 和内容日历。',
      status: scriptsCount ? `${scriptsCount} 条脚本` : '待生成',
    },
    {
      title: 'A+内容',
      detail: '沉淀长详情结构：品牌/场景/规格/对比/FAQ，不冒充平台已发布 A+ 页面。',
      status: '待编排',
    },
    {
      title: '平台差异字段校验',
      detail: platformFieldCount ? `已识别 ${platformFieldCount} 个平台字段要求，需在规格区逐项补齐。` : '待从平台字段组读取类目属性、媒体、合规和物流要求。',
      status: platformFieldCount ? '已识别' : '待补字段组',
    },
    {
      title: 'AI辅助生成入口',
      detail: 'AI 只能生成候选内容；标题、描述、图片、视频脚本必须人工确认后进入下游定价和刊登。',
      status: hashtagsCount ? `${hashtagsCount} 个标签` : '候选生成',
    },
  ]

  return (
    <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4" data-ui="content-listing-capability-map">
      {capabilities.map(item => (
        <div key={item.title} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-[var(--color-fg)]">{item.title}</p>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]">{item.status}</span>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-[var(--color-muted)]">{item.detail}</p>
        </div>
      ))}
    </div>
  )
}

function SearchTermColumn({
  title,
  source,
  terms,
  onCopy,
}: {
  title: string
  source: string
  terms: string[]
  onCopy: (text: string, index: number) => void
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-[var(--color-fg)]">{title}</p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">搜索词来源：{source}</p>
        </div>
        <Badge variant={terms.length ? 'success' : 'warning'}>{terms.length ? `${terms.length} 个` : '待补'}</Badge>
      </div>
      {terms.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">待从当前商品资料生成。</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {terms.map((term, index) => (
            <button
              key={`${title}-${term}-${index}`}
              type="button"
              className="inline-flex items-center rounded-full bg-[var(--color-primary-light)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-light)]"
              onClick={() => onCopy(term, index)}
            >
              <Hash className="mr-1 h-3 w-3" />
              {term}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ListingEditorSection({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section id={`listing-editor-${id}`} className="scroll-mt-28 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-[var(--color-fg)]">{title}</h4>
        <p className="mt-1 text-xs text-[var(--color-muted)]">{description}</p>
      </div>
      {children}
    </section>
  )
}
