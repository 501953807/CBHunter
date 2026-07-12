import { useEffect, useState } from 'react'
import { Card, CardContent } from '../../components/ui/Card'
import { EvidenceBanner } from '../../components/shared/EvidenceBanner'
import { getProviderTaskMatrix } from '../../api/settings'
import { logger } from '../../utils/logger'
import type { ApiResponse } from '../../types/common'

export function AIProviderTaskMatrix() {
  const [matrix, setMatrix] = useState<any>(null)
  const [evidence, setEvidence] = useState<ApiResponse | null>(null)
  useEffect(() => {
    getProviderTaskMatrix()
      .then(response => {
        setMatrix(response.data)
        setEvidence(response)
      })
      .catch((e: any) => logger.error('Load AI task matrix failed', e))
  }, [])

  const tasks = matrix?.tasks || []
  return (
    <Card>
      <CardContent className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">AI 任务能力矩阵</h3>
          <p className="text-xs mt-1 text-[var(--color-muted)]">按任务声明所需能力，Provider 不具备能力时显示不可用，不自动降级为成功。</p>
        </div>
        <EvidenceBanner evidence={evidence} compact />
        <div className="grid gap-2 md:grid-cols-2">
          {tasks.map((task: any) => {
            const usable = (task.provider_options || []).filter((option: any) => option.usable)
            return (
              <div key={task.task_type} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[var(--color-fg)]">{task.label}</p>
                  <span className={task.status === 'ready' ? 'text-[var(--color-success)] text-xs' : 'text-[var(--color-warning)] text-xs'}>
                    {task.status === 'ready' ? '可用' : '待配置'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[var(--color-muted)]">能力：{(task.required_capabilities || []).join(' + ')}{task.requires_local_tool ? ' + 本地工具' : ''}</p>
                <p className="mt-1 text-[11px] text-[var(--color-muted)]">可用 Provider：{usable.map((option: any) => option.provider_name).join('、') || '暂无'}</p>
                {task.data_gaps?.length > 0 && <p className="mt-1 text-[11px] text-[var(--color-warning)]">缺口：{task.data_gaps.join('、')}</p>}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
