import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Filter, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useFullConfig } from '../../hooks/useConfig'
import type { CockpitData, CockpitFilters } from '../../types/cockpit'

interface Props {
  value: CockpitFilters
  active?: CockpitData['active_filters']
  loading: boolean
  onApply: (filters: CockpitFilters) => void
}

export function CockpitScopeFilters({ value, active, loading, onApply }: Props) {
  const config = useFullConfig()
  const [draft, setDraft] = useState<CockpitFilters>(value)
  const dateShortcuts = useMemo(() => buildOperatingDateShortcuts(new Date()), [])

  useEffect(() => { setDraft(value) }, [value])

  const currencies = useMemo(() => {
    const seen = new Set<string>()
    return config.markets
      .map((market) => market.currency)
      .filter((currency): currency is string => {
        if (!currency || seen.has(currency)) return false
        seen.add(currency)
        return true
      })
  }, [config.markets])

  const apply = () => onApply(cleanFilters(draft))
  const reset = () => {
    setDraft({})
    onApply({})
  }
  const applyShortcut = (shortcut: OperatingDateShortcut) => {
    const next = {
      ...draft,
      start_date: shortcut.startDate,
      end_date: shortcut.endDate,
    }
    setDraft(next)
    onApply(cleanFilters(next))
  }

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-[var(--color-primary)]" />
        <h2 className="text-sm font-semibold text-[var(--color-fg)]">经营范围筛选</h2>
        {active && (
          <span className="text-xs text-[var(--color-muted)]">
            当前 {active.start_date} 至 {active.end_date} · 店铺 {active.store_count} 个
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="经营日期快捷窗口">
        {dateShortcuts.map((shortcut) => {
          const activeShortcut = draft.start_date === shortcut.startDate && draft.end_date === shortcut.endDate
          return (
            <button
              key={shortcut.key}
              type="button"
              onClick={() => applyShortcut(shortcut)}
              disabled={loading}
              className="rounded-full border px-3 py-1.5 text-left text-xs transition disabled:opacity-50"
              style={{
                borderColor: activeShortcut ? 'var(--color-primary)' : 'var(--color-border)',
                background: activeShortcut ? 'var(--color-primary-light)' : 'var(--color-bg)',
                color: activeShortcut ? 'var(--color-primary)' : 'var(--color-muted)',
              }}
              title={`${shortcut.label}：${shortcut.detail}`}
            >
              <span className="font-semibold">{shortcut.label}</span>
              <span className="ml-1 text-[11px]">{shortcut.detail}</span>
            </button>
          )
        })}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <ScopeInput label="开始日期" type="date" value={draft.start_date || ''} onChange={(start_date) => setDraft((prev) => ({ ...prev, start_date }))} />
        <ScopeInput label="结束日期" type="date" value={draft.end_date || ''} onChange={(end_date) => setDraft((prev) => ({ ...prev, end_date }))} />
        <ScopeSelect label="平台" value={draft.platform || ''} onChange={(platform) => setDraft((prev) => ({ ...prev, platform }))}>
          {config.platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.label}</option>)}
        </ScopeSelect>
        <ScopeSelect label="市场" value={draft.market || ''} onChange={(market) => setDraft((prev) => ({ ...prev, market }))}>
          {config.markets.map((market) => <option key={market.id} value={market.id}>{market.label}</option>)}
        </ScopeSelect>
        <ScopeSelect label="店铺" value={draft.platform_account_id || ''} onChange={(platform_account_id) => setDraft((prev) => ({ ...prev, platform_account_id }))}>
          {config.store_scope.stores.map((store) => <option key={store.id} value={store.id}>{store.account_name}</option>)}
        </ScopeSelect>
        <ScopeSelect label="币种" value={draft.currency || ''} onChange={(currency) => setDraft((prev) => ({ ...prev, currency }))}>
          {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
        </ScopeSelect>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--color-muted)]">
          未选择时使用系统默认最近 30 个自然日；选择项会真实作用于订单、财务、库存、竞品与建议查询。
        </p>
        <div className="flex items-center gap-2">
          <button onClick={reset} disabled={loading} className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-50">
            <RotateCcw className="h-3.5 w-3.5" />重置
          </button>
          <button onClick={apply} disabled={loading} className="inline-flex items-center gap-1 rounded-md bg-[var(--color-primary)] px-2 py-1 text-xs font-semibold text-[var(--color-primary-text)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50">
            <Filter className="h-3.5 w-3.5" />应用筛选
          </button>
        </div>
      </div>
    </section>
  )
}

interface OperatingDateShortcut {
  key: 'week_to_date' | 'month_to_date' | 'quarter_to_date'
  label: string
  detail: string
  startDate: string
  endDate: string
}

function buildOperatingDateShortcuts(now: Date): OperatingDateShortcut[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayOfWeek = today.getDay()
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const weekStart = addDays(today, -mondayOffset)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const quarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1)
  const endDate = formatDateLocal(today)

  return [
    {
      key: 'week_to_date',
      label: '本周',
      detail: `${formatDateLocal(weekStart)} 至 ${endDate}`,
      startDate: formatDateLocal(weekStart),
      endDate,
    },
    {
      key: 'month_to_date',
      label: '本月',
      detail: `${formatDateLocal(monthStart)} 至 ${endDate}`,
      startDate: formatDateLocal(monthStart),
      endDate,
    },
    {
      key: 'quarter_to_date',
      label: '本季度',
      detail: `${formatDateLocal(quarterStart)} 至 ${endDate}`,
      startDate: formatDateLocal(quarterStart),
      endDate,
    },
  ]
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function formatDateLocal(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function ScopeInput({ label, type, value, onChange }: { label: string; type: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-xs text-[var(--color-muted)]">
      <span className="mb-1 block">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-xs text-[var(--color-fg)] outline-none transition focus:border-[var(--color-primary)]" />
    </label>
  )
}

function ScopeSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="text-xs text-[var(--color-muted)]">
      <span className="mb-1 block">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-xs text-[var(--color-fg)] outline-none transition focus:border-[var(--color-primary)]">
        <option value="">全部</option>
        {children}
      </select>
    </label>
  )
}

function cleanFilters(filters: CockpitFilters): CockpitFilters {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) as CockpitFilters
}
