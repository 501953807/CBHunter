import { useEffect, useState } from "react"
import { Camera, Database, Lightbulb, PackageSearch, TrendingUp } from "lucide-react"
import { getDictionary, type DictCategory, type DictMarket, type DictPlatform } from "../../api/config"
import { logger } from "../../utils/logger"
import { OldTrendsTab } from "./TrendSignalsTab"
import { UploadTab } from "./TrendUploadTab"
import { PipelineTab } from "./TrendPipelineTab"
import { TrendingTab } from "./TrendTrendingTab"
import { RecommenderTab } from "./TrendRecommenderTab"
import { RecommendationEvidencePanel } from "./RecommendationEvidencePanel"
import { RecommenderReadinessPanel } from "./RecommenderReadinessPanel"
import { ScoutStageRail } from "../scout-sources/ScoutStageRail"

const CANDIDATE_SOURCE_ENTRIES = [
  { id: "trends", title: "补趋势", sourceLabel: "趋势热点", detail: "用真实趋势关键词补充需求和增长方向", icon: TrendingUp },
  { id: "upload", title: "补图片", sourceLabel: "图片选品", detail: "用商品图识别品类、场景和相似趋势", icon: Camera },
  { id: "trending", title: "补热卖", sourceLabel: "热卖商品", detail: "用平台热卖验证成交和价格带", icon: PackageSearch },
  { id: "recommender", title: "补推荐", sourceLabel: "选品推荐", detail: "用规则/AI 辅助生成待验证商品", icon: Lightbulb },
  { id: "pipeline", title: "看选品库", sourceLabel: "选品库", detail: "查看已入库候选和供应补齐状态", icon: Database },
]

export default function TrendDiscoveryPage() {
  const [activeCandidateSource, setActiveCandidateSource] = useState('trends')
  // Lifted upload state: persists across tab switches
  const [uploadData, setUploadData] = useState<any>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  // Shared dictionary state
  const [dict, setDict] = useState<{ platforms: DictPlatform[]; markets: DictMarket[]; categories: DictCategory[] } | null>(null)
  const [, setDictError] = useState(false)
  useEffect(() => {
    let cancelled = false
    const loadDict = () => {
      setDictError(false)
      getDictionary().then(res => {
        if (cancelled) return
        if (res.data) setDict({
          platforms: res.data.platforms || [],
          markets: res.data.markets || [],
          categories: ((res.data as { categories?: unknown[] }).categories || []) as DictCategory[] })
      }).catch((e) => {
        if (cancelled) return
        logger.error('Dictionary load failed', e)
        setDictError(true)
        // Retry after 2s if dict is still null
        setTimeout(() => { if (!cancelled) loadDict() }, 2000)
      })
    }
    loadDict()
    return () => { cancelled = true }
  }, [])

  const effectivePlatforms = dict?.platforms || []
  const effectiveMarkets = dict?.markets || []

  return (
    <div className="scout-workflow-page space-y-6">
      <ScoutStageRail activeStage="candidate" />
      <div className="scout-workflow-main min-w-0 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-fg)]">候选验证</h1>
            <p className="text-sm text-[var(--color-muted)] mt-1">把四层信号归并成具体商品机会，优先补图片、市场、供应和竞品资料，再送入选品决策。</p>
          </div>
        </div>
        <section className="space-y-3" aria-label="候选商品主工作区">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)]">
            <h2 className="text-sm font-semibold text-[var(--color-fg)]">候选商品池</h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">主视觉区先呈现可决策的商品机会；趋势、图片、热卖和 AI 推荐只是补证工具，不再喧宾夺主。</p>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-3 2xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
            <RecommendationEvidencePanel dict={dict} />
            <RecommenderReadinessPanel dict={dict} />
          </div>
        </section>
        <CandidatePoolSourceHub activeCandidateSource={activeCandidateSource} setActiveCandidateSource={setActiveCandidateSource} />
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]" aria-label="候选池补资料工作区">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[var(--color-primary)]">当前补资料入口</p>
              <h2 className="mt-1 text-base font-semibold text-[var(--color-fg)]">{CANDIDATE_SOURCE_ENTRIES.find(item => item.id === activeCandidateSource)?.sourceLabel}</h2>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                这些工具只服务候选商品池：补齐趋势、图片、热卖、推荐或选品库状态，不再作为并列业务功能。
              </p>
            </div>
          </div>
          {activeCandidateSource === 'trends' && <OldTrendsTab dict={dict} />}
          {activeCandidateSource === 'upload' && <UploadTab data={uploadData} setData={setUploadData} preview={uploadPreview} setPreview={setUploadPreview} uploading={uploading} setUploading={setUploading} dict={dict} />}
          {activeCandidateSource === 'trending' && <TrendingTab platformOptions={effectivePlatforms} marketOptions={effectiveMarkets} categoryOptions={dict?.categories || []} />}
          {activeCandidateSource === 'recommender' && <RecommenderTab dict={dict} />}
          {activeCandidateSource === 'pipeline' && <PipelineTab dict={dict} />}
        </section>
      </div>
    </div>
  )
}

function CandidatePoolSourceHub({
  activeCandidateSource,
  setActiveCandidateSource,
}: {
  activeCandidateSource: string
  setActiveCandidateSource: (value: string) => void
}) {
  return (
    <section aria-label="候选池数据入口" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
      <div className="mb-3">
        <p className="text-xs font-semibold text-[var(--color-primary)]">候选商品池数据入口</p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--color-fg)]">围绕候选池补资料</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          趋势、图片、热卖、推荐和选品库不再是五个割裂页面；它们是候选商品池的五类补资料入口。
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {CANDIDATE_SOURCE_ENTRIES.map((entry) => {
          const EntryIcon = entry.icon
          const active = activeCandidateSource === entry.id
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setActiveCandidateSource(entry.id)}
              className={`rounded-2xl border p-3 text-left transition-all ${active ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] shadow-[var(--shadow-sm)]' : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)]'}`}
            >
              <div className="flex items-center gap-2">
                <span className="rounded-xl bg-[var(--color-surface)] p-2">
                  <EntryIcon className="h-4 w-4 text-[var(--color-primary)]" />
                </span>
                <span className="text-sm font-semibold text-[var(--color-fg)]">{entry.title}</span>
              </div>
              <p className="mt-2 text-xs font-medium text-[var(--color-fg)]">{entry.sourceLabel}</p>
              <p className="mt-1 text-[11px] leading-5 text-[var(--color-muted)]">{entry.detail}</p>
            </button>
          )
        })}
      </div>
    </section>
  )
}
