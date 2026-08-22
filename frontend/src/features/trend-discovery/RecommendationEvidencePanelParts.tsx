import { CheckCircle2 } from 'lucide-react'
import type { ProductRecommendation } from '../../types/recommender'

const EVIDENCE_LABELS: Record<string, string> = {
  trend: '趋势',
  social: '社媒',
  platform: '平台',
  supply: '供应',
  profit: '利润',
  competitor: '竞品',
  content: '内容',
  risk: '风险',
}

const STATUS_LABELS: Record<string, string> = {
  present: '已具备',
  missing: '缺失',
  stale: '过期',
  low_confidence: '低置信',
}

function statusTone(status: string) {
  if (status === 'present') return 'var(--color-success)'
  if (status === 'low_confidence') return 'var(--color-warning)'
  if (status === 'stale') return 'var(--color-info)'
  return 'var(--color-danger)'
}

function decisionTone(level: string) {
  if (level === 'green') return 'var(--color-success)'
  if (level === 'yellow') return 'var(--color-warning)'
  return 'var(--color-danger)'
}

function evidenceCompleteness(item: ProductRecommendation) {
  return item.evidence_completeness || {}
}

export function evidenceSummary(item: ProductRecommendation) {
  const completeness = evidenceCompleteness(item)
  const fallback = Object.values(completeness).reduce((acc, status) => ({
    ...acc,
    total: acc.total + 1,
    present: acc.present + (status === 'present' ? 1 : 0),
    missing: acc.missing + (status === 'missing' ? 1 : 0),
    stale: acc.stale + (status === 'stale' ? 1 : 0),
    low_confidence: acc.low_confidence + (status === 'low_confidence' ? 1 : 0),
  }), { total: 0, present: 0, missing: 0, stale: 0, low_confidence: 0 })
  return {
    ...fallback,
    ...(item.evidence_summary || {}),
  }
}

function safeTextList(value?: string[]) {
  return Array.isArray(value) ? value : []
}

function EvidenceChips({ item }: { item: ProductRecommendation }) {
  const entries = Object.entries(evidenceCompleteness(item))
  if (entries.length === 0) {
    return <p className="text-xs text-[var(--color-warning)]">验证资料待补齐</p>
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([key, status]) => (
        <span
          key={key}
          className="rounded-full border px-2 py-0.5 text-[11px]"
          style={{ borderColor: statusTone(status), color: statusTone(status) }}
        >
          {EVIDENCE_LABELS[key] || key}：{STATUS_LABELS[status] || status}
        </span>
      ))}
    </div>
  )
}

export function RecommendationSummaryStrip({
  total,
  highDemand,
  highProfit,
}: {
  total: number
  highDemand: number
  highProfit: number
}) {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-[var(--color-muted)]">
      <span><CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-[var(--color-success)]" />候选 {total}</span>
      <span>高需求 {highDemand}</span>
      <span>高利润 {highProfit}</span>
    </div>
  )
}

export function CandidatePoolTable({
  items,
  selectedRecommendationId,
  onSelect,
  onDecide,
}: {
  items: ProductRecommendation[]
  selectedRecommendationId: string
  onSelect: (id: string) => void
  onDecide: (item: ProductRecommendation) => void
}) {
  return (
    <div className="grid min-w-0 gap-3 2xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table aria-label="候选商品池主表" className="w-full min-w-[860px] text-left text-xs">
          <thead className="bg-[var(--color-bg)] text-[var(--color-muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">商品图</th>
              <th className="px-3 py-2 font-medium">候选商品</th>
              <th className="px-3 py-2 font-medium">目标平台/市场</th>
              <th className="px-3 py-2 font-medium">需求</th>
              <th className="px-3 py-2 font-medium">利润</th>
              <th className="px-3 py-2 font-medium">竞品</th>
              <th className="px-3 py-2 font-medium">资料完整度</th>
              <th className="px-3 py-2 font-medium">综合分</th>
              <th className="px-3 py-2 text-right font-medium">动作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const summary = evidenceSummary(item)
              const active = item.work_item_id === selectedRecommendationId
              return (
                <tr
                  key={item.work_item_id}
                  onClick={() => onSelect(item.work_item_id)}
                  className={active ? 'border-t border-[var(--color-border)] bg-[var(--color-primary-light)]' : 'border-t border-[var(--color-border)] transition hover:bg-[var(--color-bg)]'}
                >
                  <td className="px-3 py-3">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.product_name} className="h-12 w-12 rounded-lg border border-[var(--color-border)] object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] text-[10px] leading-4 text-[var(--color-muted)]">
                        待采集图片
                      </div>
                    )}
                  </td>
                  <td className="max-w-[240px] px-3 py-3">
                    <button className="block w-full text-left" onClick={() => onSelect(item.work_item_id)}>
                      <span className="block truncate font-semibold text-[var(--color-fg)]">{item.product_name}</span>
                      <span className="mt-1 block truncate text-[11px] text-[var(--color-muted)]">
                        {item.source_label || item.lifecycle_label || item.work_item_id} · 图片 {item.image_count || 0} 张
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-3 text-[var(--color-muted)]">{item.target_platform || '平台待选'} / {item.target_market || '市场待选'}</td>
                  <td className="px-3 py-3 text-[var(--color-fg)]">{item.demand_level}</td>
                  <td className="px-3 py-3 text-[var(--color-fg)]">{item.profit_potential}</td>
                  <td className="px-3 py-3 text-[var(--color-fg)]">{item.competition_level}</td>
                  <td className="px-3 py-3">
                    <span className={summary.missing > 0 ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]'}>
                      {summary.present}/{summary.total}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-semibold" style={{ color: decisionTone(item.decision_level) }}>{item.score}</span>
                    <span className="ml-1 text-[11px] text-[var(--color-muted)]">{item.decision_label}</span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      onClick={(event) => { event.stopPropagation(); onDecide(item) }}
                      className="rounded-md border border-[var(--color-primary)] px-2 py-1 text-[11px] text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
                    >
                      进入选品决策
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <CandidateDetailSidebar item={items.find((item) => item.work_item_id === selectedRecommendationId) || items[0]} onDecide={onDecide} />
    </div>
  )
}

function CandidateDetailSidebar({ item, onDecide }: { item: ProductRecommendation; onDecide: (item: ProductRecommendation) => void }) {
  const summary = evidenceSummary(item)
  const keywords = safeTextList(item.keywords)
  const listingTips = safeTextList(item.listing_tips)
  const media = item.product_context?.media
  return (
    <aside className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 2xl:sticky 2xl:top-24 2xl:self-start" aria-label="候选详情侧栏">
      <div className="mb-3 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        {item.image_url ? (
          <img src={item.image_url} alt={item.product_name} className="h-40 w-full object-cover" />
        ) : (
          <div className="flex h-32 items-center justify-center text-xs text-[var(--color-muted)]">
            待采集真实商品图片
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] px-3 py-2 text-[11px]">
          <span className="text-[var(--color-muted)]">
            候选素材：{media?.source_label || item.source_label || '来源待确认'} · 图片 {media?.image_count ?? item.image_count ?? 0} 张
          </span>
          {(media?.source_url || item.source_url) && (
            <a href={media?.source_url || item.source_url || '#'} target="_blank" rel="noreferrer" className="font-medium text-[var(--color-primary)] hover:underline">
              查看来源
            </a>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-[var(--color-fg)]">{item.product_name}</h4>
            <span className="rounded-full border px-2 py-0.5 text-[11px]" style={{ borderColor: decisionTone(item.decision_level), color: decisionTone(item.decision_level) }}>
              {item.decision_label}
            </span>
            <span className="rounded-full bg-[var(--color-accent-light)] px-2 py-0.5 text-[11px] text-[var(--color-accent)]">
              {item.lifecycle_label}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">
            {item.work_item_id} · {item.target_platform} / {item.target_market}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-[var(--color-fg)]">{item.score}</p>
          <p className="text-[11px] text-[var(--color-muted)]">综合评分</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric label="需求" value={item.demand_level} />
        <Metric label="利润" value={item.profit_potential} />
        <Metric label="竞品" value={item.competition_level} />
        <Metric label="资料完整度" value={`${summary.present}/${summary.total}`} />
      </div>

      <ProductContext item={item} />
      <CandidateAnalysisGrid item={item} />

      <div className="mt-3">
        <EvidenceChips item={item} />
      </div>

      {keywords.length > 0 && <p className="mt-3 text-xs text-[var(--color-muted)]">关键词：{keywords.join('、')}</p>}
      <p className="mt-2 text-xs text-[var(--color-fg)]">{item.decision_action}</p>
      <button
        onClick={() => onDecide(item)}
        className="mt-3 inline-flex items-center rounded-md border border-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
      >
        进入选品决策
      </button>
      {listingTips.length > 0 && <p className="mt-1 text-xs text-[var(--color-warning)]">待补：{listingTips.join('、')}</p>}
      {item.experience_notes?.length > 0 && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {item.experience_notes.map((note) => (
            <div key={`${item.work_item_id}-${note.type}`} className="rounded-lg bg-[var(--color-bg)] p-2">
              <p className="text-[11px] font-medium text-[var(--color-fg)]">{note.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">{note.content}</p>
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}

function CandidateAnalysisGrid({ item }: { item: ProductRecommendation }) {
  const context = item.product_context
  const summary = evidenceSummary(item)
  const sourceCount = item.source_refs?.length || context?.evidence?.source_ref_count || 0
  const rows = [
    {
      title: '评分维度',
      value: `${item.score} · ${item.decision_label}`,
      detail: `需求 ${item.demand_level} / 利润 ${item.profit_potential} / 竞品 ${item.competition_level}`,
    },
    {
      title: '资料来源',
      value: `${sourceCount} 个来源`,
      detail: item.evidence_window || context?.evidence?.evidence_window || '来源时间窗口待补',
    },
    {
      title: '趋势数据',
      value: `${formatValue(context?.trend?.search_volume ?? item.search_volume)} 搜索量`,
      detail: `${context?.trend?.trend_direction || item.trend_direction || '趋势方向待补'}${item.seasonal ? ' · 季节性' : ''}`,
    },
    {
      title: '对比决策',
      value: `${summary.present}/${summary.total} 项资料`,
      detail: summary.missing > 0 ? `仍缺 ${summary.missing} 项，先补资料再决策` : item.decision_action,
    },
  ]
  return (
    <div className="mt-3 grid gap-2 md:grid-cols-2" data-ui="candidate-detail-analysis">
      {rows.map(row => (
        <div key={row.title} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
          <p className="text-[10px] font-medium text-[var(--color-primary)]">{row.title}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--color-fg)]">{row.value}</p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--color-muted)]">{row.detail}</p>
        </div>
      ))}
    </div>
  )
}

function ProductContext({ item }: { item: ProductRecommendation }) {
  const context = item.product_context
  if (!context) return null
  const facts = [
    ['品类', context.category || '未归类'],
    ['趋势搜索量', formatValue(context.trend?.search_volume)],
    ['趋势方向', context.trend?.trend_direction || (context.trend?.seasonal ? 'seasonal' : '未标记')],
    ['平台均价', formatValue(context.pricing?.avg_price_local)],
    ['采购价', context.pricing?.suggested_sourcing_price_rmb || '待补'],
    ['来源记录', `${context.evidence?.source_ref_count || 0} 个`],
  ]

  return (
    <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
      <div className="grid gap-2 md:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label}>
            <p className="text-[10px] text-[var(--color-muted)]">{label}</p>
            <p className="text-[11px] font-medium text-[var(--color-fg)]">{value}</p>
          </div>
        ))}
      </div>
      {context.evidence?.evidence_window && (
        <p className="mt-2 text-[11px] text-[var(--color-muted)]">数据范围：{context.evidence.evidence_window}</p>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] px-2 py-1.5">
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className="text-xs font-medium text-[var(--color-fg)]">{value}</p>
    </div>
  )
}

function formatValue(value?: number | null) {
  if (value === null || value === undefined) return '待补'
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
}
