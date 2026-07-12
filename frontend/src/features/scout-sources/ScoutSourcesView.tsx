import { AlertTriangle, CheckCircle2, CircleDashed, RefreshCw, RotateCw } from "lucide-react"
import { Button } from "../../components/ui/Button"
import { Card, CardContent } from "../../components/ui/Card"
import { PageHeader } from "../../components/shared/PageHeader"
import { Tabs } from "../../components/ui/Tabs"
import SupplyProductsPanel from "../../components/scout/SupplyProductsPanel"
import TrendingProductsPanel from "../../components/scout/TrendingProductsPanel"
import { ThreeColumnTrends } from "./ThreeColumnTrends"
import { ScoutSourceCards } from "./ScoutSourceCards"
import { SelectionBusinessPipeline } from "../../components/shared/SelectionBusinessPipeline"
import { SignalFunnelOverview } from "./SignalFunnelOverview"

export function ScoutSourcesView(props: any) {
  const {
    layerTabs,
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
    <div className="space-y-6 page-enter">
      <PageHeader title="品源管理" description="社交文娱影响 · 流行趋势 · 销售平台 · 供应渠道" />
      <SelectionBusinessPipeline />
      <SignalFunnelOverview />
      <LayerReadiness sources={signalSources} syncStatus={syncStatus} platformCount={props.platformOptions?.length || 0} />
      <Tabs tabs={layerTabs.map((tab: any) => ({ id: tab.id, label: tab.label }))} activeTab={activeTab} onChange={setActiveTab} />

      {sourcesError && (
        <Card>
          <CardContent className="pt-4 text-center py-10" style={{ color: 'var(--color-muted)' }}>
            <p className="inline-flex items-center gap-1 text-sm text-[var(--color-danger)]"><AlertTriangle className="h-4 w-4" />品源数据加载失败</p>
            <p className="text-xs mt-1">请确认后端服务正常运行</p>
          </CardContent>
        </Card>
      )}

      {!sourcesError && (
        <>
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
        </>
      )}
    </div>
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

function LayerReadiness({ sources = [], syncStatus, platformCount }: { sources: any[]; syncStatus: any; platformCount: number }) {
  const definitions = [
    { id: 'culture', label: '社交文娱影响', ready: sources.some(item => item.layer === 'culture'), detail: '小红书、Facebook、TikTok Creative Center；保存链接、截图、评论/收藏证据' },
    { id: 'trend', label: '流行趋势', ready: Boolean(syncStatus?.last_fetch_at), detail: syncStatus?.last_fetch_at ? `${syncStatus.total_keywords || 0} 个真实关键词` : 'Pinterest/Google Trends 待同步或待授权' },
    { id: 'platform', label: '销售平台', ready: platformCount > 0, detail: platformCount > 0 ? `${platformCount} 个平台字典可录入；扩展采集缺字段会标记缺口` : '缺少平台字典配置' },
    { id: 'supply', label: '供应渠道', ready: sources.some(item => item.layer === 'supply'), detail: '1688/供应商图文素材；上传图片并补齐价格、规格、起订量' },
  ]
  return <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{definitions.map(item => <div key={item.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3"><div className="flex items-center gap-2">{item.ready ? <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" /> : <CircleDashed className="h-4 w-4 text-[var(--color-warning)]" />}<span className="text-sm font-medium text-[var(--color-fg)]">{item.label}</span></div><p className="mt-1 text-[11px] text-[var(--color-muted)]">{item.detail}</p></div>)}</div>
}
