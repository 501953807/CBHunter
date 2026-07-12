import { AlertCircle, Check, Globe, Loader2, Sprout, Trash2 } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import type { TrendSeed } from '../../api/seeds'

export const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  zh: '中文',
  th: 'ไทย',
  vi: 'Tiếng Việt',
  id: 'Bahasa',
  ms: 'Melayu',
  auto: 'Auto',
}

export function SeedStatsGrid({ stats }: { stats: { active: number; default: number; markets: number; categories: number } }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[
        { label: '活跃种子词', value: stats.active, color: 'var(--color-success)' },
        { label: '默认种子词', value: stats.default, color: 'var(--color-primary)' },
        { label: '覆盖市场', value: stats.markets, color: 'var(--color-accent)' },
        { label: '覆盖品类', value: stats.categories, color: 'var(--color-warning)' },
      ].map(stat => (
        <Card key={stat.label}>
          <CardContent className="pt-3 pb-3 text-center">
            <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{stat.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

type DiscoveryMarket = {
  id: string
  label: string
  flag: string
  status: 'idle' | 'running' | 'done' | 'error'
  count: number
  error?: string
}

export function DiscoveryProgressPanel({
  discovering,
  discoveryMarkets,
  discoveryTotal,
}: {
  discovering: boolean
  discoveryMarkets: DiscoveryMarket[]
  discoveryTotal: number
}) {
  if (discoveryMarkets.length === 0) return null

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>种子词发掘进度</span>
          {discovering ? (
            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>正在扫描 {discoveryMarkets.find(d => d.status === 'running')?.label || '…'}</span>
          ) : (
            <span className="text-xs" style={{ color: discoveryTotal > 0 ? 'var(--color-success)' : 'var(--color-muted)' }}>
              已完成，共新增 {discoveryTotal} 个种子词
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {discoveryMarkets.map(m => (
            <DiscoveryMarketCard key={m.id} market={m} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function DiscoveryMarketCard({ market }: { market: DiscoveryMarket }) {
  const isRunning = market.status === 'running'
  const isDone = market.status === 'done'
  const isError = market.status === 'error'
  return (
    <div className="rounded-lg border px-3 py-2.5 text-center transition-all"
      style={{
        borderColor: isRunning ? 'var(--color-primary)' : isDone ? 'var(--color-success)' : isError ? 'var(--color-danger)' : 'var(--color-border)',
        background: isRunning ? 'var(--color-primary-light)' : isDone ? 'var(--color-success-light)' : isError ? 'var(--color-danger-light)' : 'var(--color-surface)',
      }}>
      <div className="text-lg mb-0.5">{market.flag}</div>
      <div className="text-[11px] font-medium" style={{ color: 'var(--color-fg)' }}>{market.label}</div>
      <div className="mt-1.5">
        {isRunning && <Loader2 className="w-3.5 h-3.5 mx-auto animate-spin" style={{ color: 'var(--color-primary)' }} />}
        {isDone && (
          <span className="text-[11px] font-medium" style={{ color: 'var(--color-success)' }}>
            <Check className="w-3 h-3 inline mr-0.5" />
            {market.count > 0 ? `+${market.count}` : '0'}
          </span>
        )}
        {isError && (
          <span className="text-[11px] inline-flex items-center gap-0.5" style={{ color: 'var(--color-danger)' }} title={market.error}>
            <AlertCircle className="w-3 h-3" />
            失败
          </span>
        )}
        {market.status === 'idle' && (
          <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>等待中</span>
        )}
      </div>
    </div>
  )
}

export function SeedTable({
  categories,
  loading,
  seeds,
  total,
  page,
  pageSize,
  onAdd,
  onDelete,
  onPageChange,
}: {
  categories: any[]
  loading: boolean
  seeds: TrendSeed[]
  total: number
  page: number
  pageSize: number
  onAdd: () => void
  onDelete: (id: string) => void
  onPageChange: (page: number | ((prev: number) => number)) => void
}) {
  if (loading) return <div className="text-sm text-center py-12" style={{ color: 'var(--color-muted)' }}>加载种子词...</div>

  if (seeds.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 pb-6 text-center">
          <Sprout className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>暂无种子词</p>
          <button onClick={onAdd} className="text-xs text-[var(--color-primary)] mt-1">添加第一个种子词</button>
        </CardContent>
      </Card>
    )
  }

  const totalPages = Math.ceil(total / pageSize)
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
              {['品类', '市场', '种子词', '语言', '状态', '默认', '更新时间', '操作'].map(label => (
                <th key={label} className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seeds.map((seed: TrendSeed) => {
              const catLabel = categories.find((c: any) => c.id === seed.category_id)?.label || seed.category_id
              return (
                <tr key={seed.id} className="border-b" style={{ borderColor: 'var(--color-border)', opacity: seed.is_active ? 1 : 0.4 }}>
                  <td className="py-2 px-3" style={{ color: 'var(--color-fg)' }}>{catLabel}</td>
                  <td className="py-2 px-3" style={{ color: 'var(--color-muted)' }}>{seed.market || '全部'}</td>
                  <td className="py-2 px-3" style={{ color: 'var(--color-fg)' }}>{seed.keyword}</td>
                  <td className="py-2 px-3"><Badge>{LANGUAGE_LABELS[seed.language] || seed.language}</Badge></td>
                  <td className="py-2 px-3">{seed.is_active ? <span className="text-[var(--color-success)]">启用</span> : <span className="text-[var(--color-muted)]">禁用</span>}</td>
                  <td className="py-2 px-3">{seed.is_default ? <span className="text-[var(--color-primary)]">系统</span> : <span className="text-[var(--color-muted)]">用户</span>}</td>
                  <td className="py-2 px-3 text-[11px]" style={{ color: 'var(--color-muted)' }}>{seed.updated_at?.slice(0, 10) || '-'}</td>
                  <td className="py-2 px-3">
                    <button onClick={() => onDelete(seed.id)} className="text-[var(--color-danger)]"><Trash2 className="w-3 h-3" /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {total > pageSize && (
          <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>共 {total} 条，第 {page}/{totalPages} 页</span>
            <div className="flex gap-1">
              <button onClick={() => onPageChange(1)} disabled={page <= 1} className="text-[11px] px-2 py-1 rounded border disabled:opacity-30" style={{ borderColor: 'var(--color-border)' }}>首页</button>
              <button onClick={() => onPageChange(p => Math.max(1, p - 1))} disabled={page <= 1} className="text-[11px] px-2 py-1 rounded border disabled:opacity-30" style={{ borderColor: 'var(--color-border)' }}>上一页</button>
              <button onClick={() => onPageChange(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="text-[11px] px-2 py-1 rounded border disabled:opacity-30" style={{ borderColor: 'var(--color-border)' }}>下一页</button>
              <button onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} className="text-[11px] px-2 py-1 rounded border disabled:opacity-30" style={{ borderColor: 'var(--color-border)' }}>末页</button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
