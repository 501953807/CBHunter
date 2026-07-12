import { useEffect, useState } from "react"
import { Tabs } from "../../components/ui/Tabs"
import { getDictionary, type DictCategory, type DictMarket, type DictPlatform } from "../../api/config"
import { logger } from "../../utils/logger"
import { OldTrendsTab } from "./TrendSignalsTab"
import { UploadTab } from "./TrendUploadTab"
import { PipelineTab } from "./TrendPipelineTab"
import { TrendingTab } from "./TrendTrendingTab"
import { RecommenderTab } from "./TrendRecommenderTab"
import { SelectionBusinessPipeline } from "../../components/shared/SelectionBusinessPipeline"
import { RecommendationEvidencePanel } from "./RecommendationEvidencePanel"
import { RecommenderReadinessPanel } from "./RecommenderReadinessPanel"

const PAGE_TABS = [
  { id: "trends", label: "趋势热点" }, { id: "upload", label: "图片选品" },
  { id: "trending", label: "热卖商品" }, { id: "recommender", label: "选品推荐" },
  { id: "pipeline", label: "选品库" },
]

export default function TrendDiscoveryPage() {
  const [activeTab, setActiveTab] = useState('trends')
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
    <div className="space-y-6">
      <SelectionBusinessPipeline />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">候选商品验证</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">归并四层信号，补充图片、市场、供应和竞争证据后进入选品决策</p>
        </div>
      </div>
      <section className="space-y-3" aria-label="候选机会总览">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)]">
          <h2 className="text-sm font-semibold text-[var(--color-fg)]">候选机会总览</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">先看真实证据归并出的具体商品机会，再进入趋势、图片、热卖和 AI 工具补证据。</p>
        </div>
        <div className="grid grid-cols-1 gap-3 2xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
          <RecommendationEvidencePanel dict={dict} />
          <RecommenderReadinessPanel dict={dict} />
        </div>
      </section>
      <Tabs tabs={PAGE_TABS} activeTab={activeTab} onChange={setActiveTab} />
      {activeTab === 'trends' && <OldTrendsTab dict={dict} />}
      {activeTab === 'upload' && <UploadTab data={uploadData} setData={setUploadData} preview={uploadPreview} setPreview={setUploadPreview} uploading={uploading} setUploading={setUploading} dict={dict} />}
      {activeTab === 'trending' && <TrendingTab platformOptions={effectivePlatforms} marketOptions={effectiveMarkets} categoryOptions={dict?.categories || []} />}
      {activeTab === 'recommender' && <RecommenderTab dict={dict} />}
      {activeTab === 'pipeline' && <PipelineTab dict={dict} />}
    </div>
  )
}
