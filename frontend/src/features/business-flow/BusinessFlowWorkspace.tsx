import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Database, GitBranch, RefreshCw, Route, ShieldAlert } from 'lucide-react'
import { getBusinessFlowOverview } from '../../api/businessFlow'
import { CommandCenterFrame } from '../../components/shared/CommandCenterFrame'
import { Badge } from '../../components/ui/Badge'
import type { BusinessFlowOverview } from '../../types/businessFlow'
import { logger } from '../../utils/logger'
import { formatTime, StatusPill } from '../cockpit/CockpitCommandWidgets'
import { BusinessFlowV2Board } from './BusinessFlowV2Board'
import { BusinessFlowCommandBoard } from './BusinessFlowCommandBoard'
import { normalizeBusinessFlowOverview } from './businessFlowCompat'

export default function BusinessFlowWorkspace() {
  const navigate = useNavigate()
  const [data, setData] = useState<BusinessFlowOverview | null>(null)
  const [selectedKey, setSelectedKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getBusinessFlowOverview()
      const next = normalizeBusinessFlowOverview(response.data || null)
      setData(next)
      setSelectedKey((current) => current || next?.stages[0]?.key || '')
    } catch (e: any) {
      logger.error('业务监控台加载失败', e)
      setError(e?.response?.data?.detail || e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const stages = useMemo(() => data?.stages ?? [], [data])
  const hasNoItems = (data?.metrics.item_count ?? 0) === 0

  if (loading && !data) return <p className="text-sm text-[var(--color-muted)]">正在聚合真实业务监控数据...</p>
  if (error && !data) return <p className="text-sm text-[var(--color-danger)]">{error}</p>
  if (!data) return null

  return (
    <div className="space-y-4">
      <CommandCenterFrame
        eyebrow="Business Flow"
        title="业务处理总线"
        description="从信号、选品、内容、刊登到履约与优化的商品推进总线，按当前商品对象呈现阶段、阻塞、资料完整度和下一步动作。"
        badge={(
          <Badge variant={hasNoItems ? 'warning' : (data?.metrics.blocked ?? 0) > 0 ? 'warning' : 'success'}>
            {hasNoItems ? '尚未开始推进商品' : (data?.metrics.blocked ?? 0) > 0 ? '存在链路阻塞' : '链路可推进'}
          </Badge>
        )}
        actions={(
          <>
            <StatusPill icon={<GitBranch className="h-3.5 w-3.5" />} label="阶段" value={`${data?.metrics.stage_count ?? 0} 个`} />
            <StatusPill icon={<Route className="h-3.5 w-3.5" />} label="商品队列" value={`${data?.metrics.item_count ?? 0} 条`} />
            <StatusPill icon={<ShieldAlert className="h-3.5 w-3.5" />} label="阶段阻塞" value={`${data?.metrics.blocked ?? 0} 项`} />
            <StatusPill icon={<ShieldAlert className="h-3.5 w-3.5" />} label="商品阻塞" value={`${data?.metrics.item_blocked ?? 0} 条`} />
            <StatusPill icon={<Database className="h-3.5 w-3.5" />} label="未开始" value={`${data?.metrics.data_required ?? 0} 项`} />
            <StatusPill icon={<GitBranch className="h-3.5 w-3.5" />} label="任务" value={`${data?.metrics.task_count ?? 0} 条`} />
            <StatusPill icon={<GitBranch className="h-3.5 w-3.5" />} label="我的" value={`${data?.metrics.assigned_to_me ?? 0} 条`} />
            <StatusPill icon={<Database className="h-3.5 w-3.5" />} label="来源" value={`${data?.metrics.source_count ?? 0} 条`} />
            <StatusPill icon={<Clock className="h-3.5 w-3.5" />} label="更新" value={data ? formatTime(data.generated_at) : '-'} />
            <button
              onClick={load}
              disabled={loading}
              title="刷新业务监控台"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-primary-text)] transition hover:-translate-y-0.5 hover:border-[var(--color-command-accent)] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </>
        )}
      />

      <BusinessFlowCommandBoard data={data} onNavigate={navigate} onReload={load} />

      <BusinessFlowV2Board
        data={data}
        selectedStage={selectedKey || stages[0]?.key || ''}
        currentUsername={data?.current_username || null}
        onStageFocus={setSelectedKey}
        onNavigate={navigate}
        onReload={load}
      />
    </div>
  )
}
