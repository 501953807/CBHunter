import type { ReactNode } from 'react'
import { Calendar, Check, Copy, Hash, Video } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
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
  renderPlanForm,
  renderEmptyPlan,
  plan,
  scripts,
  calendar,
  hashtags,
  copiedIndex,
  onCopy,
  toast,
  onGenerated,
}: ListingUnifiedEditorSectionsProps) {
  const sections = [
    { id: 'copy', label: '文案', title: '文案与卖点', summary: '标题、卖点摘要、商品详情、关键词', status: product?.content_brief?.title ? '有候选' : '待生成' },
    { id: 'media', label: '媒体', title: '媒体素材', summary: '主图、辅图、图片处理、视频素材', status: product?.media_readiness?.captured_image_count ? `${product.media_readiness.captured_image_count} 张` : '待补图' },
    { id: 'specs', label: '规格', title: 'SKU/属性/物流/合规', summary: 'SKU/变体、平台属性、物流包装、合规检查', status: product?.platform_requirements?.required_attributes?.length ? '字段组已识别' : '待补字段组' },
    { id: 'video', label: '视频', title: '短视频与内容计划', summary: '脚本、镜头、内容日历、CTA', status: scripts.length ? `${scripts.length} 条脚本` : '待生成' },
    { id: 'tags', label: '搜索', title: '标签与搜索词', summary: '平台搜索词、话题标签、品类词', status: hashtags.length ? `${hashtags.length} 个` : '待生成' },
    { id: 'handoff', label: '衔接', title: '定价发布衔接', summary: '定价校验、发布队列、店铺草稿', status: product?.content_status === 'ready' ? '可衔接' : '待确认' },
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
          不再通过 Tabs 切换同一个商品的 Listing 字段；文案、媒体、视频计划、标签和定价发布衔接在当前商品上下文里连续处理。
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
            title="文案与卖点"
            description="标题、卖点摘要、关键词和商品详情先在同一商品下生成候选，再人工确认进入内容任务矩阵。"
          >
            <ContentTitleGenerator toast={toast} product={product} onGenerated={onGenerated} />
          </ListingEditorSection>

          <ListingEditorSection
            id="media"
            title="媒体素材"
            description="主图、辅图、源图处理和视频素材都绑定当前商品，避免图片处理脱离 Listing 对象。"
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

          <ListingEditorSection
            id="video"
            title="短视频与内容计划"
            description="短视频脚本、镜头、内容日历和 CTA 与当前商品、平台、市场一起生成，结果回写内容任务。"
          >
            <div className="space-y-4">
              {renderPlanForm()}
              {plan.confidence_reason && (
                <div className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted)]">
                  依据：{plan.evidence_window || '当前输入'}；{plan.confidence_reason}
                </div>
              )}
              {scripts.length === 0 && renderEmptyPlan()}
              {scripts.map((item, i) => (
                <Card key={i}>
                  <CardContent className="pt-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--color-fg)]">
                          <Video className="h-4 w-4 text-[var(--color-danger)]" />
                          {item.title}
                        </h3>
                        {item.hook && <p className="mt-1 text-xs text-[var(--color-muted)]">{item.hook}</p>}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => onCopy(item.script || '', i)}>
                        {copiedIndex === i ? (
                          <><Check className="mr-1 h-3 w-3" />已复制</>
                        ) : (
                          <><Copy className="mr-1 h-3 w-3" />复制脚本</>
                        )}
                      </Button>
                    </div>
                    <pre className="mb-3 whitespace-pre-wrap rounded-lg bg-[var(--color-bg)] p-4 font-sans text-sm leading-relaxed text-[var(--color-fg)]">
                      {item.script}
                    </pre>
                    {(item.shots || []).length > 0 && (
                      <div className="mb-3 grid gap-1 text-xs text-[var(--color-muted)]">
                        {item.shots?.map((shot, j) => <span key={j}>{j + 1}. {shot}</span>)}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {(item.tips || []).map((tip, j) => (
                        <span key={j} className="inline-flex items-center rounded-full bg-[var(--color-warning-light)] px-2.5 py-1 text-xs text-[var(--color-warning)]">
                          {tip}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {calendar.length > 0 && (
                <Card>
                  <CardContent className="pt-4">
                    <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-[var(--color-fg)]">
                      <Calendar className="h-4 w-4" />
                      内容计划
                    </h3>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
                      {calendar.map((day, i) => (
                        <Card key={`${day.day || 'day'}-${i}`} className="transition-shadow hover:shadow-md">
                          <CardContent className="pt-3">
                            <p className="mb-1 text-sm font-bold text-[var(--color-fg)]">{day.day || `Day ${i + 1}`}</p>
                            <Badge variant="default" className="mb-2">{day.type || '内容'}</Badge>
                            <p className="text-xs text-[var(--color-muted)]">{day.angle}</p>
                            <p className="mt-2 text-[11px] text-[var(--color-primary)]">{day.asset}</p>
                            <p className="mt-1 text-[11px] text-[var(--color-success)]">{day.cta}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </ListingEditorSection>

          <ListingEditorSection
            id="tags"
            title="标签与搜索词"
            description="后台搜索词、品类词、场景词和平台标签必须来自当前商品、平台、市场和品类，不使用固定模板；无结果时保持待生成状态。"
          >
            <section aria-label="Listing 搜索词后台编辑区" data-ui="listing-search-terms-editor" className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <div>
                  <p className="text-xs font-semibold text-[var(--color-primary)]">后台 Search Terms</p>
                  <h3 className="mt-1 text-sm font-semibold text-[var(--color-fg)]">搜索词来源与平台标签</h3>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">用于平台搜索归档，不替代买家可见标题、商品详情和平台必填属性。</p>
                </div>
                <Button size="sm" variant="outline" disabled={!searchTermPackage} onClick={() => onCopy(searchTermPackage, 9001)}>
                  <Copy className="mr-1 h-3 w-3" />复制搜索词包
                </Button>
              </div>
              {searchTermPackage.length === 0 ? renderEmptyPlan() : (
                <div className="grid gap-3 p-4 md:grid-cols-2">
                  <SearchTermColumn title="后台 Search Terms" source="标题候选 / 商品名称" terms={titleTerms} onCopy={onCopy} />
                  <SearchTermColumn title="品类词" source="类目 / 平台 / 目标市场" terms={categoryTerms} onCopy={onCopy} />
                  <SearchTermColumn title="场景词" source="卖点摘要 / 使用场景" terms={sceneTerms} onCopy={onCopy} />
                  <SearchTermColumn title="平台标签" source="AI 候选 / 内容计划" terms={platformTags} onCopy={onCopy} />
                </div>
              )}
            </section>
          </ListingEditorSection>

          <ListingEditorSection
            id="handoff"
            title="定价发布衔接"
            description="内容确认后再进入定价校验和平台刊登，当前页只保留同一商品的下游衔接，不在内容制作里重复发布功能。"
          >
            <ContentPublishGuide product={product} />
          </ListingEditorSection>
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
      detail: `平台至少 ${minImages} 张图；当前 ${imageCount} 张，缺图时先补主图、辅图、尺寸图、场景图和细节图。`,
      status: imageCount >= minImages ? '基础达标' : '待补图',
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
