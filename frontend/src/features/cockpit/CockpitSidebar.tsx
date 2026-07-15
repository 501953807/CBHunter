import { useState } from 'react'
import { AlertTriangle, ArrowRight, Copy, Database, RefreshCw } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import type { CockpitSourceRef } from '../../types/cockpit'
import { logger } from '../../utils/logger'
import type { ActionItem } from './CockpitCommandWidgets'
import { LevelIcon } from './CockpitCommandWidgets'
import { labelBusinessCode } from '../../utils/businessLabels'

const SOURCE_LABELS: Record<string, string> = {
  order: '订单',
  finance_ledger_entry: '财务台账',
  platform_listing: '平台 Listing',
  competitor_product: '竞品快照',
  inventory_alert_log: '库存预警',
  ai_suggestion: 'AI 运营建议',
}

function sourceLabel(ref: CockpitSourceRef) {
  return ref.meta?.source_label || SOURCE_LABELS[ref.type] || labelBusinessCode(ref.type) || '业务记录'
}

export function CockpitSidebar({ actionQueue, sourceRefs, evidenceWindows, loading, onNavigate, onRefresh }: {
  actionQueue: ActionItem[]
  sourceRefs: CockpitSourceRef[]
  evidenceWindows: string[]
  loading: boolean
  onNavigate: (route: string) => void
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const visibleRefs = expanded ? sourceRefs : sourceRefs.slice(0, 8)

  const copyId = async (ref: CockpitSourceRef) => {
    try {
      await navigator.clipboard.writeText(ref.id)
    } catch (e: any) {
      logger.error('复制来源编号失败', e)
    }
  }

  return (
    <aside className="space-y-4">
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[var(--color-warning)]" />
          <h2 className="text-sm font-semibold text-[var(--color-fg)]">经营待处理</h2>
          <Badge variant="outline" className="ml-auto">{actionQueue.length}</Badge>
        </div>
        <div className="mt-3 space-y-2">
          {actionQueue.length === 0 ? (
            <div className="rounded-md border border-[var(--color-border)] p-3">
              <p className="text-xs text-[var(--color-muted)]">暂无需要处理的经营异常或数据缺口。</p>
              <button onClick={onRefresh} disabled={loading} className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--color-primary)] disabled:opacity-50">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />刷新核验
              </button>
            </div>
          ) : actionQueue.map((item) => (
            <button key={item.key} onClick={() => onNavigate(item.route)} className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-sm)]">
              <div className="flex items-start gap-2">
                <LevelIcon level={item.level} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-[var(--color-fg)]">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] text-[var(--color-muted)]">{item.detail}</p>
                  <p className="mt-2 text-[11px] text-[var(--color-muted)]">处理优先级：{levelText(item.level)}</p>
                  {item.sourceRefs.length > 0 && <p className="mt-2 truncate text-[11px] text-[var(--color-muted)]">关联记录：{item.sourceRefs.slice(0, 2).map(sourceLabel).join('、')}</p>}
                </div>
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 text-[var(--color-muted)]" />
              </div>
            </button>
          ))}
        </div>
      </section>

      <CockpitDataWindow evidenceWindows={evidenceWindows} />

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-[var(--color-primary)]" />
          <h2 className="text-sm font-semibold text-[var(--color-fg)]">数据来源</h2>
        </div>
        <div className="mt-3 space-y-2">
          {visibleRefs.length === 0 ? <p className="text-xs text-[var(--color-muted)]">暂无经营来源记录，请先同步业务数据。</p> : visibleRefs.map((ref) => (
            <div key={`${ref.type}-${ref.id}`} className="flex items-center gap-2 rounded-md bg-[var(--color-bg)] px-2 py-2 text-[11px]">
              <button onClick={() => ref.meta?.route && onNavigate(ref.meta.route)} disabled={!ref.meta?.route} title={ref.id} className="min-w-0 flex-1 text-left disabled:cursor-default">
                <span className="block text-[var(--color-muted)]">{sourceLabel(ref)}</span>
                <span className="block truncate font-medium text-[var(--color-fg)]">{ref.label || '已入库业务记录'}</span>
              </button>
              <button onClick={() => copyId(ref)} title="复制原始记录编号" aria-label={`复制${sourceLabel(ref)}记录编号`} className="rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-primary)]">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {sourceRefs.length > 8 && <button onClick={() => setExpanded((value) => !value)} className="text-xs text-[var(--color-primary)]">{expanded ? '收起来源' : `查看全部 ${sourceRefs.length} 条`}</button>}
        </div>
      </section>
    </aside>
  )
}

function CockpitDataWindow({ evidenceWindows }: { evidenceWindows: string[] }) {
  const windows = Array.from(new Set(evidenceWindows.filter(Boolean))).slice(0, 6)
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-[var(--color-info)]" />
        <h2 className="text-sm font-semibold text-[var(--color-fg)]">数据时间范围</h2>
      </div>
      <div className="mt-3 space-y-2">
        {windows.length === 0 ? (
          <p className="rounded-md border border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">暂无数据时间范围，请先同步真实业务数据。</p>
        ) : windows.map((windowText) => (
          <p key={windowText} className="rounded-md bg-[var(--color-bg)] px-2 py-2 text-[11px] text-[var(--color-muted)]">{windowText}</p>
        ))}
      </div>
    </section>
  )
}

function levelText(level: ActionItem['level']) {
  if (level === 'danger') return '高'
  if (level === 'warning') return '中'
  return '观察'
}
