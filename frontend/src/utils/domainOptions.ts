type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

export interface DomainOption {
  value: string
  label: string
}

export interface RuntimeStatusOption {
  id: string
  label: string
  variant?: string
  allowed_next?: string[]
  is_exception?: boolean
}

export interface StatusMeta {
  label: string
  variant: BadgeVariant
}

export const TASK_RUN_STATUS_META: Record<string, StatusMeta> = {
  running: { label: '执行中', variant: 'info' },
  success: { label: '成功', variant: 'success' },
  skipped: { label: '已跳过', variant: 'warning' },
  partial_failed: { label: '部分失败', variant: 'warning' },
  failed: { label: '失败', variant: 'danger' },
}

export const TASK_ENABLED_STATUS_META: Record<string, StatusMeta> = {
  enabled: { label: '运行中', variant: 'success' },
  paused: { label: '已暂停', variant: 'default' },
}

export function formatTaskTrigger(trigger: string): string {
  const interval = trigger.match(/interval=(\d+)/)
  if (interval) {
    const seconds = Number(interval[1])
    if (seconds % 86400 === 0) return `每 ${seconds / 86400} 天`
    if (seconds % 3600 === 0) return `每 ${seconds / 3600} 小时`
    if (seconds % 60 === 0) return `每 ${seconds / 60} 分钟`
    return `每 ${seconds} 秒`
  }
  const cron = trigger.match(/hour=(\d+), minute=(\d+)/)
  if (cron) return `每日 ${cron[1]}:${cron[2].padStart(2, '0')}`
  return trigger
}

export function withAllOption(label: string, options: DomainOption[]): DomainOption[] {
  return [{ value: '', label }, ...options]
}

export function toDomainOptions(options: RuntimeStatusOption[] = []): DomainOption[] {
  return options.map(item => ({ value: item.id, label: item.label }))
}

export function getStatusMeta(options: RuntimeStatusOption[] = [], id: string, fallbackVariant: BadgeVariant = 'default'): StatusMeta {
  const found = options.find(item => item.id === id)
  return { label: found?.label || id || '—', variant: normalizeBadgeVariant(found?.variant, fallbackVariant) }
}

export function getAllowedNextStatuses(options: RuntimeStatusOption[] = [], id: string): string[] {
  return options.find(item => item.id === id)?.allowed_next || []
}

export function getExceptionStatuses(options: RuntimeStatusOption[] = []): string[] {
  return options.filter(item => item.is_exception).map(item => item.id)
}

function normalizeBadgeVariant(value: string | undefined, fallback: BadgeVariant): BadgeVariant {
  return value === 'success' || value === 'warning' || value === 'danger' || value === 'info' || value === 'default'
    ? value
    : fallback
}
