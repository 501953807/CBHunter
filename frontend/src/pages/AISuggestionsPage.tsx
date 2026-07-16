import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Brain, RotateCcw } from 'lucide-react'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Select } from '../components/ui/Select'
import { useSuggestions, useMarkRead, useMarkApplied, useDismissSuggestion, useRunAnalysis } from '../hooks/useAI'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'
import { useConfig } from '../hooks/useConfig'
import { getStatusMeta, toDomainOptions, withAllOption } from '../utils/domainOptions'
import type { AISuggestion } from '../types/ai'

export default function AISuggestionsPage() {
  const [severity, setSeverity] = useState('')
  const aiSuggestionsQuery = useSuggestions(severity || undefined)
  const runMutation = useRunAnalysis()
  const markReadMutation = useMarkRead()
  const markAppliedMutation = useMarkApplied()
  const dismissMutation = useDismissSuggestion()
  const { ai_suggestion_severities = [] } = useConfig()

  const suggestions = aiSuggestionsQuery.data?.data ?? []

  const unreadCount = suggestions.filter((s) => !s.is_read).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">AI 运营建议</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            基于数据分析的智能运营建议 · {unreadCount > 0 ? `${unreadCount} 条未读` : '全部已读'}
          </p>
        </div>
        <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
          <RotateCcw className={`w-4 h-4 mr-1.5 ${runMutation.isPending ? 'animate-spin' : ''}`} />
          重新分析
        </Button>
      </div>
      <EvidenceBanner evidence={aiSuggestionsQuery.data} />

      <AIEngineDetailPanel
        suggestions={suggestions}
        loading={aiSuggestionsQuery.isLoading}
        running={runMutation.isPending}
      />

      <div className="flex items-center gap-3">
        <Select options={withAllOption('全部', toDomainOptions(ai_suggestion_severities))} value={severity} onChange={setSeverity} className="w-32" placeholder="筛选" />
      </div>

      {aiSuggestionsQuery.isError ? (
        <Card data-ui="ai-suggestions-error">
          <CardContent className="py-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--color-fg)]">AI 建议加载失败</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  无法读取智能建议列表，请检查后端服务、登录状态或 AI 建议接口数据源。
                </p>
              </div>
              <Button onClick={() => aiSuggestionsQuery.refetch()}>
                重新加载 AI 建议
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : aiSuggestionsQuery.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-[var(--color-bg)] rounded-xl animate-pulse" />)}
        </div>
      ) : suggestions.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Brain className="w-12 h-12 mx-auto mb-3 text-[var(--color-muted)]" />
            <p className="text-[var(--color-muted)] font-medium">暂无建议</p>
            <p className="text-sm text-[var(--color-muted)] mt-1">点击「重新分析」生成运营建议</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s) => {
            const sev = getStatusMeta(ai_suggestion_severities, s.severity, 'info')
            return (
              <Card key={s.id} className={`${!s.is_read ? 'ring-1 ring-[var(--color-primary)]' : ''}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <Badge variant={sev.variant}>{sev.label}</Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-[var(--color-fg)]">{s.title}</h3>
                      <p className="text-sm text-[var(--color-muted)] mt-1">{s.description}</p>
                      {(s.evidence_window || s.confidence_reason || (s.source_refs?.length || 0) > 0) && (
                        <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs space-y-1">
                          {s.evidence_window && (
                            <p style={{ color: 'var(--color-muted)' }}>依据窗口: {s.evidence_window}</p>
                          )}
                          {s.confidence_reason && (
                            <p style={{ color: 'var(--color-muted)' }}>置信说明: {s.confidence_reason}</p>
                          )}
                          {(s.source_refs?.length || 0) > 0 && (
                            <p style={{ color: 'var(--color-muted)' }}>数据来源: {s.source_refs?.length} 个系统对象</p>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-[var(--color-muted)]">
                          {s.suggestion_type} · {s.created_at ? new Date(s.created_at).toLocaleDateString('zh-CN') : ''}
                        </span>
                        {s.confidence && (
                          <span className="text-xs text-[var(--color-muted)]">
                            置信度: {(s.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!s.is_read && (
                        <Button size="sm" variant="ghost" onClick={() => markReadMutation.mutate(s.id)}>
                          已读
                        </Button>
                      )}
                      <Button size="sm" variant="primary" onClick={() => markAppliedMutation.mutate(s.id)} disabled={s.is_applied}>
                        {s.is_applied ? '已采纳' : '采纳记录'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => dismissMutation.mutate(s.id)}>
                        忽略
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AIEngineDetailPanel({
  suggestions,
  loading,
  running,
}: {
  suggestions: AISuggestion[]
  loading: boolean
  running: boolean
}) {
  const unread = suggestions.filter(item => !item.is_read).length
  const applied = suggestions.filter(item => item.is_applied).length
  const dismissed = suggestions.filter(item => item.is_dismissed).length
  const traceable = suggestions.filter(item => (item.source_refs?.length ?? 0) > 0 || item.evidence_window || item.confidence_reason).length
  const confidenceScores = suggestions
    .map(item => item.confidence)
    .filter((value): value is number => typeof value === 'number')
  const averageConfidence = confidenceScores.length
    ? Math.round((confidenceScores.reduce((sum, value) => sum + value, 0) / confidenceScores.length) * 100)
    : null
  const latest = suggestions.slice(0, 3)

  return (
    <Card>
      <CardContent>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">ai engine operations</p>
            <h2 className="mt-1 text-lg font-bold text-[var(--color-fg)]">智能引擎详细功能视图</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              汇总 AI任务列表、Provider管理、反馈收集、可信度评分和来源追溯；当前只展示真实建议与接口状态。
            </p>
          </div>
          <Link to="/settings" className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-bg)]">
            进入 Provider管理
          </Link>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          <AIEngineMetric label="AI任务列表" value={running ? '运行中' : loading ? '加载中' : `${suggestions.length} 条`} />
          <AIEngineMetric label="反馈收集" value={`采纳 ${applied} / 忽略 ${dismissed}`} />
          <AIEngineMetric label="可信度评分" value={averageConfidence == null ? '待补' : `${averageConfidence}%`} />
          <AIEngineMetric label="来源追溯" value={`${traceable} 条`} />
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[1.1fr_0.9fr]" data-ui="ai-engine-traceability">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[var(--color-fg)]">AI任务列表</h3>
              <Badge variant={running ? 'warning' : 'outline'}>{running ? '分析任务执行中' : '等待手动触发'}</Badge>
            </div>
            <div className="space-y-2">
              <AIEngineTaskRow
                title="运营建议分析"
                detail="读取订单、商品、财务、库存等已接入数据生成建议；缺少数据时返回缺口，不生成假建议。"
                status={running ? '运行中' : suggestions.length ? '已有结果' : '待运行'}
              />
              <AIEngineTaskRow
                title="建议反馈学习"
                detail={`采纳 ${applied} 条，忽略 ${dismissed} 条，未读 ${unread} 条；反馈暂记录为运营动作依据，不自动执行。`}
                status={applied || dismissed ? '已有反馈' : '待反馈'}
              />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">可信度与来源追溯</h3>
            <div className="mt-3 space-y-2">
              {latest.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs text-[var(--color-muted)]">
                  暂无 AI 建议。请先运行分析，系统会展示可信度评分、依据窗口和来源追溯。
                </p>
              ) : latest.map(item => (
                <div key={item.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--color-fg)]">{item.title}</p>
                    <Badge variant={item.confidence == null ? 'outline' : item.confidence >= 0.7 ? 'success' : 'warning'}>
                      {item.confidence == null ? '可信度待补' : `${Math.round(item.confidence * 100)}%`}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    依据窗口：{item.evidence_window || '待补'} · 来源追溯：{item.source_refs?.length ?? 0} 个对象
                  </p>
                  {item.confidence_reason && (
                    <p className="mt-1 text-xs text-[var(--color-muted)]">置信说明：{item.confidence_reason}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AIEngineMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className="mt-2 text-lg font-bold text-[var(--color-fg)]">{value}</p>
    </div>
  )
}

function AIEngineTaskRow({ title, detail, status }: { title: string; detail: string; status: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--color-fg)]">{title}</p>
        <Badge variant={status === '运行中' ? 'warning' : status.includes('已有') ? 'success' : 'outline'}>{status}</Badge>
      </div>
      <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">{detail}</p>
    </div>
  )
}
