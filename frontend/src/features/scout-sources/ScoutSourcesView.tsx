import { AlertTriangle, CheckCircle2, CircleDashed, Factory, Globe2, RefreshCw, RotateCw, ShoppingBag, TrendingUp } from "lucide-react"
import { Button } from "../../components/ui/Button"
import { Card, CardContent } from "../../components/ui/Card"
import { PageHeader } from "../../components/shared/PageHeader"
import SupplyProductsPanel from "../../components/scout/SupplyProductsPanel"
import TrendingProductsPanel from "../../components/scout/TrendingProductsPanel"
import { ThreeColumnTrends } from "./ThreeColumnTrends"
import { ScoutSourceCards } from "./ScoutSourceCards"
import { ScoutStageRail } from "./ScoutStageRail"
import { SignalFunnelOverview } from "./SignalFunnelOverview"

export function ScoutSourcesView(props: any) {
  const {
    signalSources,
    activeTab,
    setActiveTab,
    sourcesError,
    syncingTrends,
    syncStatus,
    syncMessage,
    syncError,
    handleSyncTrends,
    marketOptions,
    selectedMarkets,
    setSelectedMarkets,
    toggleMarket,
    trendKeywords,
    setTrendKeywords,
    addingKeyword,
    setAddingKeyword,
  } = props

  return (
    <div className="page-enter scout-workflow-page space-y-6">
      <ScoutStageRail activeStage="signal" />
      <div className="scout-workflow-main min-w-0 space-y-6">
        <PageHeader title="信号捕获" description="把社交文娱影响、流行趋势、销售平台、供应渠道四层信号放在主工作区，先铺开市场线索，再沉淀候选商品。" />
        <SignalLayerPrimaryTabs
          sources={signalSources}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          syncStatus={syncStatus}
          platformCount={props.platformOptions?.length || 0}
        />

        {sourcesError && (
          <Card>
            <CardContent className="pt-4 text-center py-10" style={{ color: 'var(--color-muted)' }}>
              <p className="inline-flex items-center gap-1 text-sm text-[var(--color-danger)]"><AlertTriangle className="h-4 w-4" />品源数据加载失败</p>
              <p className="text-xs mt-1">请确认后端服务正常运行</p>
            </CardContent>
          </Card>
        )}

        {!sourcesError && (
          <section aria-label="四层信号当前详情" className="signal-detail-shell">
            <div className="signal-detail-main">
              {activeTab === 'trend' && (
                <TrendTab
                  syncingTrends={syncingTrends}
                  syncStatus={syncStatus}
                  syncMessage={syncMessage}
                  syncError={syncError}
                  handleSyncTrends={handleSyncTrends}
                  marketOptions={marketOptions}
                  selectedMarkets={selectedMarkets}
                  setSelectedMarkets={setSelectedMarkets}
                  toggleMarket={toggleMarket}
                  trendKeywords={trendKeywords}
                  setTrendKeywords={setTrendKeywords}
                  addingKeyword={addingKeyword}
                  setAddingKeyword={setAddingKeyword}
                />
              )}
              {activeTab === 'platform' && <TrendingProductsPanel />}
              {activeTab === 'supply' && <SupplyProductsPanel />}
              {activeTab !== 'trend' && activeTab !== 'platform' && activeTab !== 'supply' && <ScoutSourceCards {...props} />}
            </div>
            <aside className="signal-detail-side" aria-label="当前信号层处理重点">
              <LayerWorkGuide activeTab={activeTab} syncStatus={syncStatus} platformCount={props.platformOptions?.length || 0} />
              <LayerReadiness sources={signalSources} syncStatus={syncStatus} platformCount={props.platformOptions?.length || 0} />
            </aside>
          </section>
        )}
        <SignalFunnelOverview />
      </div>
    </div>
  )
}

function SignalLayerPrimaryTabs({
  sources = [],
  activeTab,
  setActiveTab,
  syncStatus,
  platformCount,
}: {
  sources: any[]
  activeTab: string
  setActiveTab: (value: string) => void
  syncStatus: any
  platformCount: number
}) {
  const layers = [
    {
      id: 'culture',
      label: '社交文娱影响',
      subtitle: '从内容平台、兴趣社区和短视频话题发现消费动机',
      goal: '捕捉用户为什么想买',
      accent: '影响力',
      icon: Globe2,
      readiness: sources.some(item => item.layer === 'culture'),
      readinessText: sources.some(item => item.layer === 'culture') ? '渠道已配置' : '待配置渠道',
    },
    {
      id: 'trend',
      label: '流行趋势',
      subtitle: '从 Pinterest、Google Trends 等趋势源判断需求是否在上升',
      goal: '判断趋势是否值得跟进',
      accent: '趋势',
      icon: TrendingUp,
      readiness: Boolean(syncStatus?.last_fetch_at),
      readinessText: syncStatus?.last_fetch_at ? `${syncStatus.total_keywords || 0} 个关键词` : '待同步趋势',
    },
    {
      id: 'platform',
      label: '销售平台',
      subtitle: '从 Shopee、TEMU、TikTok Shop 等平台热卖商品验证购买需求',
      goal: '验证平台上是否已经卖得动',
      accent: '成交',
      icon: ShoppingBag,
      readiness: platformCount > 0,
      readinessText: platformCount > 0 ? `${platformCount} 个平台可录入` : '待配置平台',
    },
    {
      id: 'supply',
      label: '供应渠道',
      subtitle: '从 1688、供应商和实拍素材判断货源、成本与交付可行性',
      goal: '确认能不能供、能不能赚',
      accent: '供给',
      icon: Factory,
      readiness: sources.some(item => item.layer === 'supply'),
      readinessText: sources.some(item => item.layer === 'supply') ? '供应源已配置' : '待配置供应源',
    },
  ]

  return (
    <section aria-label="四层信号主入口 Tabs" data-ui-scheme="signal-command-tabs" className="signal-command-panel">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[var(--color-primary)]">核心信号主入口</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--color-fg)]">四层信号采集</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--color-muted)]">
            用四种来源把市场信号从“灵感”收敛到“候选商品”：影响力解释动机，趋势判断上升，平台验证成交，供应确认利润和交付。
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-xs text-[var(--color-muted)] shadow-[var(--shadow-sm)]">
          <span className="block text-[11px]">当前详情层</span>
          <span className="mt-1 block text-sm font-semibold text-[var(--color-primary)]">{layers.find(layer => layer.id === activeTab)?.label || '未选择'}</span>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-4" role="tablist" aria-label="四层信号来源切换">
        {layers.map((layer) => {
          const layerSources = sources.filter(source => source.layer === layer.id && source.id !== 'ai_mining')
          const isActive = activeTab === layer.id
          const Icon = layer.icon
          return (
            <button
              id={`scout-layer-${layer.id}`}
              key={layer.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-active={isActive ? 'true' : 'false'}
              onClick={() => setActiveTab(String(layer.id))}
              className="signal-layer-tab"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="signal-layer-orb">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                {layer.readiness
                  ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--color-success)]" />
                  : <CircleDashed className="h-4 w-4 shrink-0 text-[var(--color-warning)]" />}
              </div>
              <div className="mt-4">
                <span className="text-[11px] font-semibold text-[var(--color-primary)]">{layer.accent}</span>
                <h3 className="mt-1 text-base font-semibold text-[var(--color-fg)]">{layer.label}</h3>
                <p className="mt-2 line-clamp-2 min-h-[40px] text-xs leading-5 text-[var(--color-muted)]">{layer.subtitle}</p>
              </div>
              <div className="mt-4 grid gap-2 text-[11px] text-[var(--color-muted)]">
                <span className="signal-layer-chip">目标：{layer.goal}</span>
                <span className="signal-layer-chip">渠道 {layerSources.length} 个 · {layer.readinessText}</span>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function TrendTab({
  syncingTrends,
  syncStatus,
  syncMessage,
  syncError,
  handleSyncTrends,
  marketOptions,
  selectedMarkets,
  setSelectedMarkets,
  toggleMarket,
  trendKeywords,
  setTrendKeywords,
  addingKeyword,
  setAddingKeyword,
}: any) {
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RotateCw className={`w-4 h-4 ${syncingTrends ? 'animate-spin' : ''}`} style={{ color: 'var(--color-primary)' }} />
              <div>
                <span className="text-xs font-medium" style={{ color: 'var(--color-fg)' }}>趋势数据采集</span>
                <span className="text-[11px] ml-2" style={{ color: 'var(--color-muted)' }}>
                  {syncStatus?.last_fetch_at ? `上次同步: ${new Date(syncStatus.last_fetch_at).toLocaleString('zh-CN')}` : '尚未同步'}
                </span>
                <span className="text-[11px] ml-2" style={{ color: 'var(--color-muted)' }}>· {syncStatus?.total_keywords || 0} 个关键词</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-success-light)] text-[var(--color-success)]"><CheckCircle2 className="h-3 w-3" />待机</span>
              <Button size="sm" onClick={handleSyncTrends} disabled={syncingTrends}>
                <RefreshCw className={`w-3 h-3 mr-1 ${syncingTrends ? 'animate-spin' : ''}`} />
                {syncingTrends ? '同步中…' : '开始同步'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {syncError && (
        <div className="rounded-xl bg-[var(--color-danger-light)] px-3 py-2 text-xs text-[var(--color-danger)]">
          流行趋势同步失败：{syncError}。请检查后端服务、趋势源授权或网络可达状态。
        </div>
      )}
      {syncMessage && !syncError && (
        <div className="rounded-xl bg-[var(--color-success-light)] px-3 py-2 text-xs text-[var(--color-success)]">
          {syncMessage}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[11px] font-medium" style={{ color: 'var(--color-muted)' }}>市场:</span>
        <div className="flex gap-1 flex-wrap">
          {marketOptions.map((m: any) => (
            <button key={m.id} onClick={() => toggleMarket(m.id)}
              className={`text-[11px] px-2 py-0.5 rounded-full border transition-all ${
                selectedMarkets.length === 0 || selectedMarkets.includes(m.id)
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                  : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-border)]'
              }`}>
              {m.flag ? `${m.flag} ${m.label}` : m.label}
            </button>
          ))}
          {selectedMarkets.length > 0 && (
            <button onClick={() => setSelectedMarkets([])}
              className="text-[11px] px-2 py-0.5 text-[var(--color-muted)] hover:text-[var(--color-muted)]">清除</button>
          )}
        </div>
      </div>

      <ThreeColumnTrends
        trendKeywords={trendKeywords}
        setTrendKeywords={setTrendKeywords}
        addingKeyword={addingKeyword}
        setAddingKeyword={setAddingKeyword}
        marketOptions={marketOptions}
      />
    </div>
  )
}

function LayerWorkGuide({ activeTab, syncStatus, platformCount }: { activeTab: string; syncStatus: any; platformCount: number }) {
  const guideMap: Record<string, { title: string; summary: string; actions: string[]; metric: string }> = {
    culture: {
      title: '社交文娱影响',
      summary: '先记录用户为什么会被种草，再把话题、达人、内容场景沉淀为可验证商品方向。',
      actions: ['保存原始链接、截图和核心评论', '标记目标人群、场景和情绪卖点', '把高频诉求归并到候选商品'],
      metric: '重点看内容热度、互动质量、评论里的购买意图',
    },
    trend: {
      title: '流行趋势',
      summary: '用趋势源判断需求是否持续上升，避免只凭单个平台短期热卖做决策。',
      actions: ['选择东南亚目标市场', '同步趋势关键词并剔除噪声词', '把增长词关联到候选品类'],
      metric: syncStatus?.last_fetch_at ? `已同步 ${syncStatus.total_keywords || 0} 个关键词` : '尚未完成趋势同步',
    },
    platform: {
      title: '销售平台',
      summary: '用 Shopee、TEMU、TikTok Shop 的热卖与类目表现验证真实成交需求。',
      actions: ['按平台、市场、店铺筛选热卖商品', '记录价格带、销量、评分和主图风格', '把可复制商品转入候选验证'],
      metric: platformCount > 0 ? `${platformCount} 个平台可录入验证数据` : '平台字典待配置',
    },
    supply: {
      title: '供应渠道',
      summary: '确认货源、成本、规格、起订量、素材和履约能力，避免选到无法稳定交付的商品。',
      actions: ['补齐 1688/供应商链接和成本', '上传实拍图、规格、包装和发货周期', '把可供货商品转入决策评分'],
      metric: '重点看利润空间、素材完整度、起订量和交期',
    },
  }
  const guide = guideMap[activeTab] || guideMap.culture
  return (
    <div className="signal-guide-card">
      <p className="text-[11px] font-semibold text-[var(--color-primary)]">当前层处理重点</p>
      <h3 className="mt-1 text-base font-semibold text-[var(--color-fg)]">{guide.title}</h3>
      <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">{guide.summary}</p>
      <div className="mt-3 rounded-xl bg-[var(--color-primary-light)] px-3 py-2 text-xs font-medium text-[var(--color-primary)]">
        {guide.metric}
      </div>
      <ol className="mt-3 grid gap-2 text-xs text-[var(--color-muted)]">
        {guide.actions.map((action, index) => (
          <li key={action} className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg)] text-[11px] font-semibold text-[var(--color-primary)]">{index + 1}</span>
            <span>{action}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function LayerReadiness({ sources = [], syncStatus, platformCount }: { sources: any[]; syncStatus: any; platformCount: number }) {
  const definitions = [
    { id: 'culture', label: '社交文娱影响', ready: sources.some(item => item.layer === 'culture'), detail: '小红书、Facebook、TikTok Creative Center；保存链接、截图、评论/收藏资料' },
    { id: 'trend', label: '流行趋势', ready: Boolean(syncStatus?.last_fetch_at), detail: syncStatus?.last_fetch_at ? `${syncStatus.total_keywords || 0} 个真实关键词` : 'Pinterest/Google Trends 待同步或待授权' },
    { id: 'platform', label: '销售平台', ready: platformCount > 0, detail: platformCount > 0 ? `${platformCount} 个平台字典可录入；扩展采集缺字段会标记缺口` : '缺少平台字典配置' },
    { id: 'supply', label: '供应渠道', ready: sources.some(item => item.layer === 'supply'), detail: '1688/供应商图文素材；上传图片并补齐价格、规格、起订量' },
  ]
  return (
    <div className="signal-readiness-stack">
      <p className="text-[11px] font-semibold text-[var(--color-primary)]">四层数据就绪度</p>
      {definitions.map(item => (
        <div key={item.id} className="signal-readiness-row">
          <div className="flex items-center gap-2">
            {item.ready ? <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" /> : <CircleDashed className="h-4 w-4 text-[var(--color-warning)]" />}
            <span className="text-sm font-medium text-[var(--color-fg)]">{item.label}</span>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-[var(--color-muted)]">{item.detail}</p>
        </div>
      ))}
    </div>
  )
}
