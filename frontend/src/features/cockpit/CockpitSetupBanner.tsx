import { useEffect, useState } from 'react'
import { ArrowRight, RefreshCw, ShieldCheck, Store } from 'lucide-react'
import { getConfigQuality, type ConfigQuality } from '../../api/config'
import { useFullConfig } from '../../hooks/useConfig'
import { Badge } from '../../components/ui/Badge'
import { logger } from '../../utils/logger'
import { labelBusinessCode } from '../../utils/businessLabels'

export function CockpitSetupBanner({ onNavigate }: { onNavigate: (route: string) => void }) {
  const config = useFullConfig()
  const [quality, setQuality] = useState<ConfigQuality | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getConfigQuality()
      .then((res) => {
        if (!cancelled) setQuality(res.data || null)
      })
      .catch((e: any) => logger.error('Load cockpit config quality failed', e))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const hasStores = (config.store_scope?.stores?.length || 0) > 0
  const gaps = quality?.data_gaps || []
  const shouldShow = !config.loading && (!hasStores || quality?.status === 'configuration_required')
  if (!shouldShow) return null

  return (
    <section className="rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-light)] p-3 shadow-[var(--shadow-sm)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--color-warning)]" />
            <h2 className="text-sm font-semibold text-[var(--color-fg)]">经营指挥台需要先补齐基础配置</h2>
            <Badge variant={loading ? 'default' : 'warning'}>{loading ? '巡检中' : '需处理'}</Badge>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {!hasStores ? '当前没有可用店铺，订单、利润、库存和报表只能显示待接入状态。' : quality?.confidence_reason || '配置缺口会影响订单同步、定价、刊登和报表判断。'}
          </p>
          {gaps.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {gaps.slice(0, 4).map((gap) => (
                <span key={gap} className="rounded px-2 py-0.5 text-[11px] text-[var(--color-warning)]" style={{ backgroundColor: 'var(--color-surface)' }}>
                  {labelBusinessCode(gap)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button onClick={() => onNavigate('/platforms')} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-fg)] transition hover:-translate-y-0.5 hover:border-[var(--color-primary)]">
            <Store className="h-3.5 w-3.5" /> 配置平台店铺
          </button>
          <button onClick={() => onNavigate('/settings/quality')} className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-2 text-xs text-[var(--color-primary-text)] transition hover:-translate-y-0.5">
            <RefreshCw className="h-3.5 w-3.5" /> 查看配置巡检 <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </section>
  )
}
