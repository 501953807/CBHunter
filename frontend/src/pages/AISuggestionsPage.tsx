import { useState } from 'react'
import { Brain, RotateCcw } from 'lucide-react'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Select } from '../components/ui/Select'
import { useSuggestions, useMarkRead, useMarkApplied, useDismissSuggestion, useRunAnalysis } from '../hooks/useAI'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'
import { useConfig } from '../hooks/useConfig'
import { getStatusMeta, toDomainOptions, withAllOption } from '../utils/domainOptions'

export default function AISuggestionsPage() {
  const [severity, setSeverity] = useState('')
  const { data, isLoading } = useSuggestions(severity || undefined)
  const runMutation = useRunAnalysis()
  const markReadMutation = useMarkRead()
  const markAppliedMutation = useMarkApplied()
  const dismissMutation = useDismissSuggestion()
  const { ai_suggestion_severities = [] } = useConfig()

  const suggestions = data?.data ?? []

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
      <EvidenceBanner evidence={data} />

      <div className="flex items-center gap-3">
        <Select options={withAllOption('全部', toDomainOptions(ai_suggestion_severities))} value={severity} onChange={setSeverity} className="w-32" placeholder="筛选" />
      </div>

      {isLoading ? (
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
