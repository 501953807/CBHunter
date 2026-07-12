import { useCallback, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Video, Lightbulb, Hash, Calendar, Copy, Check, Sparkles } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Select } from '../../components/ui/Select'
import { Tabs } from '../../components/ui/Tabs'
import { useToast } from '../../components/ui/Toast'
import { generateVideoContentPlan, type ContentWorkbenchItem } from '../../api/content'
import { logger } from '../../utils/logger'
import { usePlatforms } from '../../hooks/usePlatforms'
import { useConfig } from '../../hooks/useConfig'
import { filterPlatformsByCapability } from '../../utils/platformCapabilities'
import { ContentTitleGenerator } from './ContentTitleGenerator'
import { ContentMediaStudio } from './ContentMediaStudio'
import { ContentProductQueue } from './ContentProductQueue'
import { ContentTaskMatrix } from './ContentTaskMatrix'
import { ContentPublishGuide } from './ContentPublishGuide'
import { SelectionBusinessPipeline } from '../../components/shared/SelectionBusinessPipeline'
import { ProfessionalWorkspaceFrame } from '../../components/shared/ProfessionalWorkspaceFrame'
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
const CONTENT_TABS = [
  { id: 'scripts', label: '视频脚本' },
  { id: 'calendar', label: '内容日历' },
  { id: 'hashtags', label: '热门标签' },
  { id: 'title', label: 'AI标题' },
  { id: 'export', label: '平台刊登' },
  { id: 'media', label: '素材工坊' },
]
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
  const routeTab = tab === 'title' ? 'title' : tab === 'export' ? 'export' : tab === 'image' || tab === 'video' ? 'media' : null
  const [localTab, setLocalTab] = useState('scripts')
  const activeTab = routeTab || localTab
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
    setLocalTab(nextTab)
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
      <SelectionBusinessPipeline />
      <ProfessionalWorkspaceFrame
        eyebrow="Content Operations"
        title="内容制作"
        description="围绕已决策商品编制标题、卖点、视频、图片处理和刊登前内容任务，所有内容必须绑定具体商品和平台字段。"
        metrics={[
          { label: '当前商品', value: selectedProduct ? selectedProduct.product_name : '未选择', hint: selectedProduct?.lifecycle_label || '先从下方队列选择商品' },
          { label: '任务矩阵', value: contentRefreshToken ? '已刷新' : '待处理', hint: 'AI 候选需人工确认' },
          { label: '内容分区', value: CONTENT_TABS.length, hint: '脚本/标题/素材/刊登路径' },
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

      <ContentProductQueue onSelect={handleSelectProduct} initialProductId={initialProductId} />
      <ContentTaskMatrix product={selectedProduct} refreshToken={contentRefreshToken} />
      <Tabs tabs={CONTENT_TABS} activeTab={activeTab} onChange={changeTab} />

      {activeTab === 'scripts' && (
        <div className="space-y-4">
          {renderPlanForm()}
          {plan.confidence_reason && <div className="text-xs text-[var(--color-muted)] border border-[var(--color-border)] rounded-lg px-3 py-2">依据：{plan.evidence_window || '当前输入'}；{plan.confidence_reason}</div>}
          {scripts.length === 0 && renderEmptyPlan()}
          {scripts.map((item, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--color-fg)] flex items-center gap-2">
                      <Video className="w-4 h-4 text-[var(--color-danger)]" />
                      {item.title}
                    </h3>
                    {item.hook && <p className="text-xs text-[var(--color-muted)] mt-1">{item.hook}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(item.script || '', i)}
                  >
                    {copiedIndex === i ? (
                      <><Check className="w-3 h-3 mr-1" />已复制</>
                    ) : (
                      <><Copy className="w-3 h-3 mr-1" />复制脚本</>
                    )}
                  </Button>
                </div>
                <pre className="whitespace-pre-wrap text-sm text-[var(--color-fg)] bg-[var(--color-bg)] rounded-lg p-4 mb-3 font-sans leading-relaxed">
                  {item.script}
                </pre>
                {(item.shots || []).length > 0 && (
                  <div className="mb-3 grid gap-1 text-xs text-[var(--color-muted)]">
                    {item.shots?.map((shot, j) => <span key={j}>{j + 1}. {shot}</span>)}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {(item.tips || []).map((tip, j) => (
                    <span key={j} className="inline-flex items-center px-2.5 py-1 bg-[var(--color-warning-light)] text-[var(--color-warning)] rounded-full text-xs">
                      {tip}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="space-y-4">
          {calendar.length === 0 && renderEmptyPlan()}
          {calendar.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-3 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  内容计划
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                  {calendar.map((day, i) => (
                    <Card key={`${day.day || 'day'}-${i}`} className="hover:shadow-md transition-shadow">
                      <CardContent className="pt-3">
                        <p className="text-sm font-bold text-[var(--color-fg)] mb-1">{day.day || `Day ${i + 1}`}</p>
                        <Badge variant="default" className="mb-2">{day.type || '内容'}</Badge>
                        <p className="text-xs text-[var(--color-muted)]">{day.angle}</p>
                        <p className="text-[11px] text-[var(--color-primary)] mt-2">{day.asset}</p>
                        <p className="text-[11px] text-[var(--color-success)] mt-1">{day.cta}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'title' && <ContentTitleGenerator toast={toast} product={selectedProduct} onGenerated={refreshContentTasks} />}
      {activeTab === 'export' && <ContentPublishGuide product={selectedProduct} />}
      {activeTab === 'media' && <ContentMediaStudio mode={tab === 'video' ? 'video' : tab === 'image' ? 'image' : 'all'} product={selectedProduct} />}

      {activeTab === 'hashtags' && (
        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-3 flex items-center gap-1">
              <Hash className="w-4 h-4" />
              推荐标签
            </h3>
            <p className="text-xs text-[var(--color-muted)] mb-4">
              标签来自当前商品、平台、市场和品类，不使用固定模板。
            </p>
            {hashtags.length === 0 && renderEmptyPlan()}
            <div className="flex flex-wrap gap-2">
              {hashtags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-3 py-1.5 bg-[var(--color-primary-light)] text-[var(--color-primary)] rounded-full text-sm font-medium cursor-pointer hover:bg-[var(--color-primary-light)] transition-colors"
                  onClick={() => handleCopy(tag, hashtags.indexOf(tag))}
                >
                  <Hash className="w-3 h-3 mr-1" />
                  {tag.replace('#', '')}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
