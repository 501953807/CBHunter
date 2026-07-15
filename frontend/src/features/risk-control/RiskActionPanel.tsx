import { useEffect, useState } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import type { RiskControlRisk } from '../../types/riskControl'

interface Props {
  risk: RiskControlRisk
  saving: boolean
  taskSaving: boolean
  operationSaving: boolean
  onOpen: () => void
  onCreateBusinessTask: () => void
  onCreateOperationAction: () => void
  onStateChange: (status: RiskControlRisk['status'], note?: string, dueAt?: string | null) => void
}

export function RiskActionPanel({ risk, saving, taskSaving, operationSaving, onOpen, onCreateBusinessTask, onCreateOperationAction, onStateChange }: Props) {
  const [note, setNote] = useState('')
  const [dueAt, setDueAt] = useState('')
  const nextAction = risk.status === 'pending'
    ? { label: '标记处理中', status: 'processing' as const }
    : risk.status === 'processing'
      ? { label: '关闭风险', status: 'closed' as const }
      : { label: '重新打开', status: 'pending' as const }

  useEffect(() => {
    setNote(risk.note || '')
    setDueAt(toDateTimeLocal(risk.due_at))
  }, [risk.id, risk.note, risk.due_at])

  const submit = () => onStateChange(
    nextAction.status,
    note.trim() || undefined,
    dueAt ? new Date(dueAt).toISOString() : null,
  )

  return (
    <div>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-[var(--color-primary)]" />
        <h2 className="text-sm font-semibold text-[var(--color-fg)]">处理动作</h2>
      </div>
      <div className="mt-3 space-y-3">
        <div>
          <p className="mb-1 text-xs font-semibold text-[var(--color-fg)]">预计处理时间</p>
          <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-2 text-xs text-[var(--color-fg)] outline-none transition focus:border-[var(--color-primary)]" />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-[var(--color-fg)]">处理备注</p>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={4} className="w-full resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-2 text-xs text-[var(--color-fg)] outline-none transition focus:border-[var(--color-primary)]" placeholder="记录复核、补货、关闭或忽略原因" />
        </div>
        <button onClick={submit} disabled={saving} className="w-full rounded-md bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-[var(--color-primary-text)] transition hover:bg-[var(--color-primary-hover)] disabled:opacity-50">
          {saving ? '提交中' : nextAction.label}
        </button>
        <button onClick={onOpen} className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-primary)] transition hover:border-[var(--color-primary)]">
          进入专业模块处理 <ArrowRight className="h-3 w-3" />
        </button>
        <button onClick={onCreateBusinessTask} disabled={taskSaving} className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-primary)] transition hover:border-[var(--color-primary)] disabled:opacity-50">
          {taskSaving ? '生成中' : '生成业务任务'} <ArrowRight className="h-3 w-3" />
        </button>
        <button onClick={onCreateOperationAction} disabled={operationSaving} className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-primary)] transition hover:border-[var(--color-primary)] disabled:opacity-50">
          {operationSaving ? '生成中' : '生成运营台账动作'} <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

function toDateTimeLocal(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
