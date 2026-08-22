import type { ReactNode } from 'react'

export { ReadinessPanel } from './BatchPublishReadinessParts'

export function buildPublishDisabledReason({
  confirmedCount,
  missingSchedule,
  confirmedTargetBlockingCount,
}: {
  confirmedCount: number
  missingSchedule: boolean
  confirmedTargetBlockingCount: number
}) {
  if (confirmedCount === 0) return '至少确认一个目标店铺 Listing 草稿后才能创建。'
  if (missingSchedule) return '定时发布计划必须填写计划时间。'
  if (confirmedTargetBlockingCount > 0) return `${confirmedTargetBlockingCount} 个已确认草稿仍存在目标店铺、平台字段或发布门禁阻断。`
  return ''
}

export function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--color-fg)]">
        <span className="text-[var(--color-primary)]">{icon}</span>
        <span>{title}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}
