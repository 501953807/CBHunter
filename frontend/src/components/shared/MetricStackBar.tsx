interface Segment {
  label: string
  value: number
  color: string
}

interface Props {
  ariaLabel: string
  segments: Segment[]
  emptyLabel?: string
}

export function MetricStackBar({ ariaLabel, segments, emptyLabel = '暂无数据' }: Props) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0)

  if (total <= 0) {
    return (
      <div aria-label={ariaLabel} data-ui="store-drilldown-priority-bar" className="min-w-32">
        <div className="h-2 rounded-full bg-[var(--color-border)]" />
        <p className="mt-1 text-[11px] text-[var(--color-muted)]">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <div aria-label={ariaLabel} data-ui="store-drilldown-priority-bar" className="min-w-32">
      <div className="flex h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
        {segments.map((segment) => {
          const width = Math.max(4, (Math.max(0, segment.value) / total) * 100)
          return (
            <span
              key={segment.label}
              title={`${segment.label}: ${segment.value}`}
              className="h-full"
              style={{ width: `${width}%`, background: segment.color }}
            />
          )
        })}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
        {segments.map((segment) => (
          <span key={segment.label} className="inline-flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: segment.color }} />
            {segment.label} {segment.value}
          </span>
        ))}
      </div>
    </div>
  )
}
