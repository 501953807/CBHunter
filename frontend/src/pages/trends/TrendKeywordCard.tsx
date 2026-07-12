import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'

const DIR_LABEL: Record<string, { icon: React.ReactNode; label: string }> = {
  rising: { icon: <ArrowUp className="w-3 h-3" />, label: '上升' },
  falling: { icon: <ArrowDown className="w-3 h-3" />, label: '下降' },
  stable: { icon: <Minus className="w-3 h-3" />, label: '平稳' },
}

interface TrendKeywordCardProps {
  kw: any
  onAddToSourcing?: (kw: any) => void
  category?: string
  market?: string
  showTrendLine?: boolean
}

function TrendLine({ values }: { values: number[] }) {
  const blocks = '▁▂▃▄▅▆▇█'
  if (!values || values.length === 0) {
    return <span className="text-xs tracking-[0.5px] font-mono" style={{ color: 'var(--color-border)' }}>{'▁'.repeat(14)}</span>
  }
  const max = Math.max(...values, 1)
  const chars = values.map(v => blocks[Math.min(Math.floor((v / max) * (blocks.length - 1)), blocks.length - 1)])
  return <span className="text-xs tracking-[0.5px] text-[var(--color-muted)] font-mono">{chars.join('')}</span>
}

export function TrendKeywordCard({ kw, onAddToSourcing, showTrendLine = true }: TrendKeywordCardProps) {
  const hasData = kw.last_fetched_at != null
  const dir = DIR_LABEL[kw.trend_direction] || DIR_LABEL.stable

  return (
    <Card className="hover:shadow-md transition-shadow relative card-lift">
      <CardContent className="pt-3 px-3.5 pb-3">
        <div className="flex items-start justify-between mb-1.5 pr-5">
          <p className="text-sm font-medium truncate flex-1" style={{ color: 'var(--color-fg)' }}>
            {kw.keyword}
          </p>
          <span className="text-sm font-bold shrink-0 ml-2 min-w-[18px] text-right" style={{ color: 'var(--color-primary)' }}>
            {hasData
              ? kw.search_volume != null
                ? `量 ${Math.round(kw.search_volume)}`
                : kw.trend_index != null
                  ? `指数 ${Math.round(kw.trend_index)}`
                  : '-'
              : '-'}
          </span>
        </div>
        {showTrendLine && <TrendLine values={kw.trend_data} />}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded" style={{ color: dir.label === '上升' ? 'var(--color-success)' : dir.label === '下降' ? 'var(--color-danger)' : 'var(--color-warning)' }}>
            {dir.icon}{dir.label}
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              color: kw.growth_pct != null ? (kw.growth_pct > 0 ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--color-muted)',
            }}
          >
            {kw.growth_pct != null ? `${kw.growth_pct > 0 ? '+' : ''}${kw.growth_pct.toFixed(0)}%` : '--%'}
          </span>
          {onAddToSourcing && (
            <button
              onClick={() => onAddToSourcing(kw)}
              className="ml-auto text-[11px] px-1.5 py-0.5 rounded hover:opacity-80 transition-opacity"
              style={{ background: 'var(--color-success-light)', color: 'var(--color-success)' }}
              title="加入选品库"
            >
              +选品
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
