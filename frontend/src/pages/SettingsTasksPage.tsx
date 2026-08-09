import { useState, useEffect } from 'react'
import { RefreshCw, Play, Clock, CheckCircle, AlertCircle, ExternalLink, ToggleLeft, ToggleRight, Edit3, X, Check } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { getSystemConfigItem, getTaskLogs, listSystemTasks, toggleTask, triggerTask, updateTaskTrigger, type SystemTask, type TaskRunLog } from '../api/settings'
import { logger } from '../utils/logger'
import { formatTaskTrigger, TASK_ENABLED_STATUS_META, TASK_RUN_STATUS_META } from '../utils/domainOptions'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'
import type { ApiResponse } from '../types/common'
import { EmptyState } from '../components/ui/EmptyState'

interface PinterestConfigStatus {
  email: string | null
  configured: boolean
}

type TaskGovernanceTone = 'success' | 'warning' | 'danger' | 'neutral'

interface TaskGovernanceMetric {
  label: string
  value: string
  detail: string
  tone: TaskGovernanceTone
}

export default function SystemTasksSettings() {

  const [tasks, setTasks] = useState<SystemTask[]>([])
  const [logs, setLogs] = useState<TaskRunLog[]>([])
  const [taskEvidence, setTaskEvidence] = useState<ApiResponse<{ tasks: SystemTask[]; total: number }> | null>(null)
  const [logEvidence, setLogEvidence] = useState<ApiResponse<{ logs: TaskRunLog[]; total: number }> | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingTrigger, setEditingTrigger] = useState<string | null>(null)
  const [editInterval, setEditInterval] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [taskRes, logRes] = await Promise.all([
        listSystemTasks(),
        getTaskLogs(),
      ])
      setTasks(taskRes?.data?.tasks || [])
      setLogs(logRes?.data?.logs || [])
      setTaskEvidence(taskRes)
      setLogEvidence(logRes)
    } catch (e: any) { logger.error('Operation failed', e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleTrigger = async (taskId: string) => {
    setRunning(taskId)
    try {
      await triggerTask(taskId)
      await load()
    } catch (e: any) { logger.error('Trigger failed', e) }
    setRunning(null)
  }

  const handleToggle = async (taskId: string, enabled: boolean) => {
    try {
      await toggleTask(taskId, enabled)
      await load()
    } catch (e: any) { logger.error('Toggle failed', e) }
  }

  const handleUpdateTrigger = async (taskId: string) => {
    try {
      await updateTaskTrigger(taskId, parseInt(editInterval))
      setEditingTrigger(null)
      await load()
    } catch (e: any) { logger.error('Update trigger failed', e) }
  }

  const governanceSummary = buildSystemTaskGovernanceSummary(tasks, logs, taskEvidence?.data?.total, logEvidence?.data?.total)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
              <h2 className="font-semibold" style={{ color: 'var(--color-fg)' }}>定时任务列表</h2>
            </div>
            <Button size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <EvidenceBanner evidence={taskEvidence} compact />
          <section
            data-ui="settings-system-task-governance-summary"
            aria-label="系统任务配置治理摘要"
            className="mb-5 rounded-2xl border p-4"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>系统任务治理摘要</h3>
                </div>
                <p className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>
                  按真实任务注册表和运行日志判断启用、调度和失败状态；未启用、无下次执行时间或最近失败/跳过的任务只显示待处理，不视为自动同步成功。
                </p>
              </div>
              <Badge variant={governanceSummary.blockedCount > 0 ? 'warning' : 'success'}>
                {governanceSummary.blockedCount > 0 ? `${governanceSummary.blockedCount} 项待处理` : '任务链路可调度'}
              </Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {governanceSummary.metrics.map(metric => (
                <TaskGovernanceMetricCard key={metric.label} metric={metric} />
              ))}
            </div>
            {governanceSummary.nextActions.length > 0 && (
              <div
                className="mt-4 rounded-xl border px-3 py-2 text-xs"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-muted)' }}
              >
                <span className="font-medium" style={{ color: 'var(--color-fg)' }}>下一步：</span>
                {governanceSummary.nextActions.join('；')}
              </div>
            )}
          </section>
          {loading ? (
            <div className="text-sm py-8 text-center" style={{ color: 'var(--color-muted)' }}>加载中...</div>
          ) : tasks.length === 0 ? (
            <EmptyState icon={<Clock className="h-9 w-9" />} title="暂无定时任务" description="任务由后端任务目录注册；请检查服务配置与调度器状态。" />
          ) : (
            <div className="space-y-3">
              {tasks.map(task => (
                <div key={task.id} className="flex items-center justify-between py-3 px-4 rounded-lg transition-colors"
                  style={{ background: 'var(--color-bg)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>{task.name}</span>
                      <Badge variant={(task.enabled ? TASK_ENABLED_STATUS_META.enabled : TASK_ENABLED_STATUS_META.paused).variant}>
                        {(task.enabled ? TASK_ENABLED_STATUS_META.enabled : TASK_ENABLED_STATUS_META.paused).label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {editingTrigger === task.id ? (
                          <span className="flex items-center gap-1">
                            <input className="w-20 text-xs border rounded px-1 py-0.5" type="number" value={editInterval} onChange={e => setEditInterval(e.target.value)} placeholder="秒" style={{ borderColor: 'var(--color-border)' }} />
                            <button disabled={!editInterval || Number(editInterval) < 60} onClick={() => handleUpdateTrigger(task.id)} className="disabled:opacity-40" style={{ color: 'var(--color-success)' }}><Check className="w-3 h-3" /></button>
                            <button onClick={() => setEditingTrigger(null)} style={{ color: 'var(--color-muted)' }}><X className="w-3 h-3" /></button>
                          </span>
                        ) : (
                          <>
                            {formatTaskTrigger(task.trigger)}
                            <button onClick={() => { setEditingTrigger(task.id); setEditInterval(task.interval_seconds ? String(task.interval_seconds) : '') }} className="ml-1 p-0.5 rounded hover:opacity-70" style={{ color: 'var(--color-muted)' }}><Edit3 className="w-2.5 h-2.5" /></button>
                          </>
                        )}
                      </span>
                      {task.next_run_time && (
                        <span>下次执行: {new Date(task.next_run_time).toLocaleString('zh-CN')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => handleToggle(task.id, !task.enabled)}
                      className="text-sm flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--color-bg)] transition-colors"
                      title={task.enabled ? '暂停' : '启用'}>
                      {task.enabled ? <ToggleRight className="w-5 h-5" style={{ color: 'var(--color-success)' }} /> : <ToggleLeft className="w-5 h-5" style={{ color: 'var(--color-muted)' }} />}
                    </button>
                    <Button size="sm" onClick={() => handleTrigger(task.id)}
                      disabled={running === task.id}>
                      <Play className="w-3.5 h-3.5 mr-1" />
                      {running === task.id ? '执行中...' : '立即执行'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pinterest account status */}
      <PinterestStatusCard />

      {/* Execution logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: 'var(--color-muted)' }} />
            <h2 className="font-semibold text-sm" style={{ color: 'var(--color-fg)' }}>执行日志</h2>
          </div>
        </CardHeader>
        <CardContent>
          <EvidenceBanner evidence={logEvidence} compact />
          {(logs || []).length === 0 ? (
            <EmptyState icon={<Clock className="h-9 w-9" />} title="暂无执行记录" description="任务实际运行后在此展示状态、耗时和错误信息。" className="py-6" />
          ) : (
            <div className="space-y-1">
              {logs.map((log) => {
                const badge = TASK_RUN_STATUS_META[log.status] || { variant: 'default' as const, label: log.status }
                return (
                  <div key={log.id} className="flex items-center gap-3 py-2 px-3 rounded-lg text-xs"
                    style={{ background: 'var(--color-bg)' }}>
                    <span className="shrink-0 font-mono" style={{ color: 'var(--color-muted)' }}>
                      {log.started_at ? new Date(log.started_at).toLocaleString('zh-CN') : '-'}
                    </span>
                    <span className="font-medium" style={{ color: 'var(--color-fg)' }}>{log.task_name}</span>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    {log.duration_ms && (
                      <span className={log.duration_ms > 500 ? 'text-[var(--color-warning)]' : 'text-[var(--color-muted)]'}>
                        {log.duration_ms}ms{log.duration_ms > 500 ? ' · 耗时偏高' : ''}
                      </span>
                    )}
                    {log.error_message && (
                      <span className="text-[var(--color-danger)] truncate" title={log.error_message}>{log.error_message}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TaskGovernanceMetricCard({ metric }: { metric: TaskGovernanceMetric }) {
  const toneColor = {
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    danger: 'var(--color-danger)',
    neutral: 'var(--color-muted)',
  }[metric.tone]
  return (
    <div
      className="rounded-xl border px-3 py-3"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
    >
      <div className="text-xs" style={{ color: 'var(--color-muted)' }}>{metric.label}</div>
      <div className="mt-1 text-xl font-semibold" style={{ color: toneColor }}>{metric.value}</div>
      <div className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--color-muted)' }}>{metric.detail}</div>
    </div>
  )
}

function buildSystemTaskGovernanceSummary(
  tasks: SystemTask[],
  logs: TaskRunLog[],
  taskTotal?: number,
  logTotal?: number,
) {
  const total = taskTotal ?? tasks.length
  const enabled = tasks.filter(task => task.enabled).length
  const schedulable = tasks.filter(task => task.enabled && hasRunnableSchedule(task)).length
  const missingSchedule = tasks.filter(task => task.enabled && !hasRunnableSchedule(task)).length
  const disabled = tasks.filter(task => !task.enabled).length
  const failedOrPartial = logs.filter(log => ['failed', 'partial_failed'].includes(log.status)).length
  const skipped = logs.filter(log => log.status === 'skipped').length
  const runningLogs = logs.filter(log => log.status === 'running').length
  const blockedCount = missingSchedule + disabled + failedOrPartial + skipped

  const metrics: TaskGovernanceMetric[] = [
    {
      label: '注册任务',
      value: `${total} 个`,
      detail: `当前返回 ${tasks.length} 个任务配置，日志累计 ${logTotal ?? logs.length} 条。`,
      tone: total > 0 ? 'success' : 'warning',
    },
    {
      label: '启用状态',
      value: `${enabled}/${total}`,
      detail: disabled > 0 ? `${disabled} 个任务已暂停，需要确认是否允许自动执行。` : '已返回任务均处于启用状态。',
      tone: disabled > 0 ? 'warning' : 'success',
    },
    {
      label: '调度就绪',
      value: `${schedulable}/${enabled}`,
      detail: missingSchedule > 0 ? `${missingSchedule} 个启用任务缺少下次执行或有效间隔。` : '启用任务具备可识别的调度信息。',
      tone: missingSchedule > 0 ? 'warning' : 'success',
    },
    {
      label: '最近运行',
      value: `${failedOrPartial + skipped} 项异常`,
      detail: runningLogs > 0 ? `${runningLogs} 个任务正在运行；失败/部分失败 ${failedOrPartial}，跳过 ${skipped}。` : `失败/部分失败 ${failedOrPartial}，跳过 ${skipped}。`,
      tone: failedOrPartial > 0 ? 'danger' : skipped > 0 ? 'warning' : 'success',
    },
  ]

  const nextActions: string[] = []
  if (disabled > 0) nextActions.push('复核已暂停任务是否应恢复')
  if (missingSchedule > 0) nextActions.push('补齐启用任务的调度间隔或下次执行时间')
  if (failedOrPartial > 0) nextActions.push('进入执行日志查看失败原因并重试')
  if (skipped > 0) nextActions.push('确认跳过任务是否因平台未授权或配置缺口导致')
  if (nextActions.length === 0 && total > 0) nextActions.push('保持任务运行，按日志持续观察同步、报表和趋势任务状态')
  if (total === 0) nextActions.push('检查后端任务注册表和调度器初始化状态')

  return { metrics, nextActions, blockedCount }
}

function hasRunnableSchedule(task: SystemTask) {
  if (!task.enabled) return false
  if (task.next_run_time) return true
  if (typeof task.interval_seconds === 'number' && task.interval_seconds >= 60) return true
  return task.trigger !== 'manual'
}

function PinterestStatusCard() {
  const [config, setConfig] = useState<PinterestConfigStatus | null>(null)


  useEffect(() => {
    getSystemConfigItem<PinterestConfigStatus>('pinterest-account')
      .then(res => {
        const data = res.data
        if (data?.configured) {
          setConfig({ email: data.email, configured: true })
        } else {
          setConfig({ email: null, configured: false })
        }
      })
      .catch((e: any) => {
        logger.error('Load Pinterest config status failed', e)
        setConfig({ email: null, configured: false })
      })
  }, [])

  if (!config) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ExternalLink className={`w-4 h-4 ${config.configured ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`} />
          <h2 className="font-semibold text-sm" style={{ color: 'var(--color-fg)' }}>Pinterest 账号状态</h2>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            {config.configured ? (
              <>
                <CheckCircle className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
                <span style={{ color: 'var(--color-fg)' }}>已配置: {maskEmail(config.email) || 'Pinterest 账号'}</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
                <span style={{ color: 'var(--color-fg)' }}>未配置</span>
              </>
            )}
          </div>
          <a href="/settings/keys" className="text-xs underline" style={{ color: 'var(--color-primary)' }}>
            管理配置 →
          </a>
        </div>
      </CardContent>
    </Card>
  )
}

function maskEmail(value: string | null | undefined) {
  if (!value || !value.includes('@')) return value || ''
  const [name, domain] = value.split('@')
  const prefix = name.slice(0, Math.min(2, name.length))
  return `${prefix}${'•'.repeat(Math.max(3, name.length - prefix.length))}@${domain}`
}
