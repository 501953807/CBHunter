import { Card, CardContent } from "../../components/ui/Card"
import { CircleCheck, Search, Sparkles, Target } from "lucide-react"

export function FullAnalysisResults({ analysis, discoveryId, confirmedId, confirming, uploading, onConfirm }: any) {
  if (!analysis) return null
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <h3 className="font-semibold text-[var(--color-fg)] mb-3">5维度精准卖点 → 戳中买家痛点</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(analysis.selling_points || {}).map(([dim, data]: [string, any]) => (
              <div key={dim} className="bg-[var(--color-bg)] rounded-xl p-3">
                <div className="text-xs font-semibold text-[var(--color-primary)] mb-1.5">{dim}</div>
                <div className="text-xs text-[var(--color-fg)] mb-1 flex items-start gap-1"><Sparkles className="w-3 h-3 shrink-0 text-[var(--color-primary)]" />{data.point}</div>
                <div className="text-[11px] text-[var(--color-danger)] flex items-start gap-1"><Target className="w-3 h-3 shrink-0" /><span>{data.pain}</span></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <MarketScoreAndTitles analysis={analysis} />
      <ConfirmBlock discoveryId={discoveryId} confirmedId={confirmedId} confirming={confirming} onConfirm={onConfirm} />
      {uploading && <AnalysisProgressCard />}
    </div>
  )
}

function MarketScoreAndTitles({ analysis }: { analysis: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center shrink-0">
              <span className="text-xl font-bold text-[var(--color-primary-text)]">{analysis.market_score?.score || '--'}</span>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--color-fg)] text-sm">市场潜力评分</h3>
              <div className="space-y-0.5 mt-1">
                {(analysis.market_score?.reasons || []).slice(0, 3).map((reason: string, index: number) => <p key={index} className="text-[11px] text-[var(--color-muted)]">• {reason}</p>)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <h3 className="font-semibold text-[var(--color-fg)] text-sm mb-2">推荐电商标题</h3>
          <TitleLine label="中文" value={analysis.titles?.chinese} tone="primary" />
          <TitleLine label="英文" value={analysis.titles?.english} tone="success" />
        </CardContent>
      </Card>
    </div>
  )
}

function TitleLine({ label, value, tone }: { label: string; value?: string; tone: 'primary' | 'success' }) {
  const bg = tone === 'primary' ? 'var(--color-primary-light)' : 'var(--color-success-light)'
  const color = tone === 'primary' ? 'var(--color-primary)' : 'var(--color-success)'
  return (
    <div className={`rounded-lg px-3 py-2 ${tone === 'primary' ? 'mb-2' : ''}`} style={{ background: bg }}>
      <p className="text-[11px]" style={{ color }}>{label}</p>
      <p className="text-xs text-[var(--color-fg)]">{value || '--'}</p>
    </div>
  )
}

function ConfirmBlock({ discoveryId, confirmedId, confirming, onConfirm }: any) {
  if (!discoveryId) return null
  if (confirmedId === discoveryId) {
    return (
      <div className="flex items-center justify-between bg-[var(--color-success-light)] rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <CircleCheck className="w-5 h-5 text-[var(--color-success)]" />
          <div>
            <p className="text-sm font-medium text-[var(--color-success)]">已加入选品库</p>
            <p className="text-xs text-[var(--color-success)]">前往「选品库」标签页查看和管理供应商</p>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between bg-[var(--color-primary-light)] rounded-xl px-4 py-3">
      <div>
        <p className="text-sm font-medium text-[var(--color-primary)]">确认选品？</p>
        <p className="text-xs text-[var(--color-primary)]">确认后加入选品库，可在选品库中查看和管理</p>
      </div>
      <button onClick={() => onConfirm(discoveryId)} disabled={confirming}
        className="px-4 py-2 bg-[var(--color-primary)] text-[var(--color-primary-text)] text-sm rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50">
        {confirming ? '处理中...' : '确认选品'}
      </button>
    </div>
  )
}

export function AnalysisProgressCard() {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center animate-pulse">
            <Search className="w-4 h-4 text-[var(--color-primary)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--color-primary)]">AI 正在分析图片...</p>
            <p className="text-xs text-[var(--color-primary)]">Gemini 视觉模型识别中，大约需要 5-15 秒</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 bg-[var(--color-primary-light)] rounded-full overflow-hidden">
          <div className="h-full bg-[var(--color-primary)] rounded-full animate-pulse" style={{ width: '70%' }} />
        </div>
      </CardContent>
    </Card>
  )
}
