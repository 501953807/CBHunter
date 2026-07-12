import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Database, RefreshCw, ShieldCheck } from 'lucide-react'
import { getConfigQuality, type ConfigQuality } from '../../api/config'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { logger } from '../../utils/logger'
import { EvidenceBanner } from '../../components/shared/EvidenceBanner'
import type { ApiResponse } from '../../types/common'
import { businessActionForCode, labelBusinessCode } from '../../utils/businessLabels'

export function ConfigQualitySettings({ toast }: { toast: any }) {
  const [quality, setQuality] = useState<ConfigQuality | null>(null)
  const [evidence, setEvidence] = useState<ApiResponse<ConfigQuality> | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await getConfigQuality()
      setQuality(res.data || null)
      setEvidence(res)
    } catch (e: any) {
      logger.error('Load config quality failed', e)
      toast.addToast('error', '配置巡检加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return <div className="text-sm py-8 text-center" style={{ color: 'var(--color-muted)' }}>加载...</div>
  }

  const checks = quality?.checks || []
  const readyCount = checks.filter(item => item.status === 'ready').length
  const gapCount = quality?.data_gaps?.length || 0

  return (
    <div className="space-y-5">
      <EvidenceBanner evidence={evidence} />
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
              <h2 className="font-semibold" style={{ color: 'var(--color-fg)' }}>配置巡检总览</h2>
            </div>
            <Button size="sm" variant="outline" onClick={load}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> 重新检查
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="巡检状态" value={quality?.status === 'ready' ? '可用' : '需补配置'} tone={quality?.status === 'ready' ? 'success' : 'warning'} />
            <Metric label="通过项" value={`${readyCount}/${checks.length}`} />
            <Metric label="配置缺口" value={`${gapCount}`} tone={gapCount > 0 ? 'warning' : 'success'} />
            <Metric label="证据窗口" value={quality?.evidence_window || '当前系统配置快照'} />
          </div>
          <p className="text-xs mt-4" style={{ color: 'var(--color-muted)' }}>
            {quality?.confidence_reason || '配置巡检读取统一配置服务、店铺授权和套餐权益。'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
            <h2 className="font-semibold" style={{ color: 'var(--color-fg)' }}>基础配置清单</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-2">
            {checks.map(item => (
              <div key={item.code} className="rounded-lg border p-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {item.status === 'ready'
                        ? <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--color-success)' }} />
                        : <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: 'var(--color-warning)' }} />}
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>{item.label}</h3>
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>配置数量：{item.count}</div>
                  </div>
                  <Badge variant={item.status === 'ready' ? 'success' : 'warning'}>
                    {item.status === 'ready' ? '已就绪' : '需配置'}
                  </Badge>
                </div>
                {item.data_gaps.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.data_gaps.map(gap => (
                      <span key={gap} className="rounded px-2 py-1 text-[11px]" style={{ backgroundColor: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>
                        {labelBusinessCode(gap)}
                      </span>
                    ))}
                  </div>
                )}
                {item.data_gaps.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.data_gaps.map((gap) => {
                      const action = businessActionForCode(gap)
                      return (
                        <a key={`${gap}-${action.route}`} href={action.route} className="text-[11px] text-[var(--color-primary)] hover:underline">
                          {action.label}
                        </a>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
            {checks.length === 0 && (
              <div className="text-sm py-6 text-center lg:col-span-2" style={{ color: 'var(--color-muted)' }}>暂无巡检结果</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'warning' }) {
  const color = tone === 'success' ? 'var(--color-success)' : tone === 'warning' ? 'var(--color-warning)' : 'var(--color-fg)'
  return (
    <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
      <div className="text-xs" style={{ color: 'var(--color-muted)' }}>{label}</div>
      <div className="mt-1 text-sm font-semibold truncate" style={{ color }}>{value}</div>
    </div>
  )
}
