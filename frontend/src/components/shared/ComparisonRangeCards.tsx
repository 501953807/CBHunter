import { CalendarRange } from 'lucide-react'
import { comparisonRangeLabel, comparisonRangeTitle, parseComparisonRange, type RangeKind } from '../../utils/comparisonRange'

interface ComparisonWindows {
  current: string
  previous: string
  last_year: string
}

interface Props {
  ariaLabel: string
  scopeLabel: string
  windows: ComparisonWindows
  descriptions: Record<RangeKind, string>
}

const accentByKind: Record<RangeKind, string> = {
  current: 'var(--color-primary)',
  previous: 'var(--color-warning)',
  lastYear: 'var(--color-info)',
}

export function ComparisonRangeCards({ ariaLabel, scopeLabel, windows, descriptions }: Props) {
  const cards = [
    { kind: 'current' as const, range: windows.current, role: '本周 / 本月 / 本季度或用户选择的业务区间' },
    { kind: 'previous' as const, range: windows.previous, role: '上周 / 上月 / 上季度或上一等长区间，用于环比' },
    { kind: 'lastYear' as const, range: windows.last_year, role: '去年同周 / 去年同月 / 去年同季或去年同日期区间，用于同比' },
  ]

  return (
    <section
      aria-label={ariaLabel}
      data-ui="comparison-range-cards"
      className="mb-4 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-sm)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-primary-light)] text-[var(--color-primary)]">
            <CalendarRange className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">{scopeLabel}业务统计区间</h3>
            <p className="mt-0.5 text-[11px] leading-5 text-[var(--color-muted)]">
              常用看板优先按本周/上周、本月/上月、本季度/上季度表达；自定义日期才显示所选区间、上一等长区间和去年同日期区间。
            </p>
          </div>
        </div>
        <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[11px] text-[var(--color-muted)]">
          周 / 月 / 季 / 自定义区间
        </span>
      </div>

      <div className="grid gap-3 p-3 lg:grid-cols-3">
        {cards.map((card) => (
          <RangeCard
            key={card.kind}
            kind={card.kind}
            range={card.range}
            role={card.role}
            description={descriptions[card.kind]}
          />
        ))}
      </div>
    </section>
  )
}

function RangeCard({ kind, range, role, description }: { kind: RangeKind; range: string; role: string; description: string }) {
  const parsed = parseComparisonRange(range)
  return (
    <article className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <span className="absolute left-0 right-0 top-0 h-1" style={{ background: accentByKind[kind] }} />
      <div className="flex flex-wrap items-start justify-between gap-2 pt-1">
        <div>
          <p className="text-xs font-semibold" style={{ color: accentByKind[kind] }}>
            {comparisonRangeTitle(kind, range)}
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--color-fg)]">{comparisonRangeLabel(kind, range)}</p>
        </div>
        <span className="rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-[11px] text-[var(--color-muted)]">
          {parsed.days ? `实际天数 ${parsed.days} 天` : '天数待补'}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2" aria-label="日期起止时间线">
        <DatePill label="开始" value={parsed.start || '待补'} />
        <span className="h-px min-w-8" style={{ background: accentByKind[kind] }} />
        <DatePill label="结束" value={parsed.end || '待补'} align="right" />
      </div>

      <p className="mt-3 rounded-lg bg-[var(--color-bg)] px-3 py-2 text-[11px] leading-5 text-[var(--color-muted)]">
        <span className="font-semibold text-[var(--color-fg)]">{role}</span> · {description}
      </p>
    </article>
  )
}

function DatePill({ label, value, align = 'left' }: { label: string; value: string; align?: 'left' | 'right' }) {
  return (
    <span className={`rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-2 ${align === 'right' ? 'text-right' : ''}`}>
      <span className="block text-[10px] text-[var(--color-muted)]">{label}</span>
      <span className="mt-0.5 block text-xs font-semibold text-[var(--color-fg)]">{value}</span>
    </span>
  )
}
