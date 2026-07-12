import { Card, CardContent } from "../../components/ui/Card"
import { getLabel, getMarketFlag } from "./TrendPipelineUtils"

export function FilterPillCard({
  title,
  allLabel,
  active,
  items,
  accent,
  onChange,
}: {
  title: string
  allLabel: string
  active: string
  items: any[]
  accent: 'primary' | 'success'
  onChange: (value: string) => void
}) {
  const activeClass = accent === 'success'
    ? 'bg-[var(--color-success)] text-[var(--color-primary-text)]'
    : 'bg-[var(--color-primary)] text-[var(--color-primary-text)]'
  return (
    <Card>
      <CardContent className="pt-3 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] text-[var(--color-muted)] font-medium">{title}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => onChange('')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              !active ? activeClass : 'bg-[var(--color-bg)] text-[var(--color-muted)] hover:bg-[var(--color-border)]'
            }`}>{allLabel}</button>
          {items.map((item: any) => (
            <button key={item.id} onClick={() => onChange(item.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                active === item.id ? activeClass : 'bg-[var(--color-bg)] text-[var(--color-muted)] hover:bg-[var(--color-border)]'
              }`}>
              {accent === 'success' ? getMarketFlag(items, item.id) : item.icon || ''} {item.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function PipelineCountBar({ filterCat, filterMkt, cats, markets, total }: any) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-[var(--color-muted)]">
        {filterCat && <span>品类: {getLabel(cats, filterCat)}</span>}
        {filterCat && filterMkt && <span> · </span>}
        {filterMkt && <span>市场: {getLabel(markets, filterMkt)}</span>}
        {(!filterCat && !filterMkt) && <span>全部产品</span>}
        <span className="ml-2 text-[var(--color-muted)]">共 {total} 个</span>
      </p>
    </div>
  )
}

export function PipelineLoading() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-24 bg-[var(--color-bg)] rounded-xl animate-pulse" />
      ))}
    </div>
  )
}

export function PipelineEmptyState() {
  return (
    <Card>
      <CardContent className="pt-4 text-center py-10 text-[var(--color-muted)]">
        <p className="text-sm">选品库为空</p>
        <p className="text-xs mt-1">上传图片 → 确认选品 → 自动添加到此处</p>
      </CardContent>
    </Card>
  )
}

export function PipelinePagination({ page, totalPages, total, onPageChange }: any) {
  const lastPage = totalPages || 1
  return (
    <div className="flex items-center justify-center gap-3 mt-2">
      <button onClick={() => onPageChange(1)} disabled={page <= 1}
        className="text-xs px-2 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)] disabled:opacity-30">首页</button>
      <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}
        className="text-xs px-2.5 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)] disabled:opacity-30">上一页</button>
      <span className="text-xs text-[var(--color-muted)]">第 {page} / {lastPage} 页（共 {total} 个）</span>
      <button onClick={() => onPageChange(Math.min(lastPage, page + 1))} disabled={page >= lastPage}
        className="text-xs px-2.5 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)] disabled:opacity-30">下一页</button>
      <button onClick={() => onPageChange(lastPage)} disabled={page >= lastPage}
        className="text-xs px-2 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)] disabled:opacity-30">末页</button>
    </div>
  )
}
