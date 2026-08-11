import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, Edit3, Megaphone, Plus, RefreshCw, Trash2, Users } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'
import {
  createOperationRecord,
  deleteOperationRecord,
  getOperationOptions,
  listOperationRecords,
  updateOperationRecord,
  type OperationOptions,
  type OperationRecord,
} from '../../api/operations'
import { useConfig } from '../../hooks/useConfig'
import { logger } from '../../utils/logger'
import { EvidenceBanner } from '../../components/shared/EvidenceBanner'
import type { ApiResponse } from '../../types/common'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'

const emptyForm = { record_type: '', status: '', name: '', platform: '', market: '', counterparty: '', planned_amount_rmb: '', actual_amount_rmb: '', notes: '' }

export default function OperationsWorkspace() {
  const toast = useToast()
  const confirmAction = useConfirm()
  const [searchParams] = useSearchParams()
  const requestedType = searchParams.get('record_type') || searchParams.get('type') || ''
  const { platforms, markets } = useConfig()
  const [records, setRecords] = useState<OperationRecord[]>([])
  const [evidence, setEvidence] = useState<ApiResponse<OperationRecord[]> | null>(null)
  const [options, setOptions] = useState<OperationOptions>({ record_types: [], statuses: [] })
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [originalAmounts, setOriginalAmounts] = useState<{ planned: number | null; actual: number | null } | null>(null)

  const load = async () => {
    try {
      const [recordsResponse, optionsResponse] = await Promise.all([listOperationRecords(requestedType || undefined), getOperationOptions()])
      setRecords(recordsResponse.data || [])
      setEvidence(recordsResponse)
      const nextOptions = optionsResponse.data || { record_types: [], statuses: [] }
      setOptions(nextOptions)
      setForm(current => ({ ...current, record_type: current.record_type || (nextOptions.record_types.some(item => item.id === requestedType) ? requestedType : '') }))
    } catch (error: any) {
      logger.error('Load operation records failed', error)
      toast.addToast('error', '运营台账加载失败')
    }
  }

  useEffect(() => { load() }, [requestedType])

  const save = async () => {
    if (!form.record_type || !form.status || !form.name.trim() || !form.counterparty.trim() || hasInvalidPlannedAmount(form)) return
    if (editingId && originalAmounts) {
      const nextPlanned = form.planned_amount_rmb === '' ? null : Number(form.planned_amount_rmb)
      const nextActual = form.actual_amount_rmb === '' ? null : Number(form.actual_amount_rmb)
      if (nextPlanned !== originalAmounts.planned || nextActual !== originalAmounts.actual) {
        const ok = await confirmAction({
          title: '确认金额变更',
          message: '金额变更会同步影响关联财务台账并写入审计记录，确认继续保存？',
          confirmText: '继续保存',
          tone: 'warning',
        })
        if (!ok) return
      }
    }
    setSaving(true)
    const payload = {
      ...form,
      platform: form.platform || null,
      market: form.market || null,
      counterparty: form.counterparty || null,
      planned_amount_rmb: form.planned_amount_rmb === '' ? null : Number(form.planned_amount_rmb),
      actual_amount_rmb: form.actual_amount_rmb === '' ? null : Number(form.actual_amount_rmb),
      notes: form.notes || null,
    }
    try {
      if (editingId) await updateOperationRecord(editingId, payload)
      else await createOperationRecord(payload)
      toast.addToast('success', editingId ? '运营记录已更新' : '运营记录已创建')
      setEditingId(null)
      setOriginalAmounts(null)
      setForm(emptyForm)
      await load()
    } catch (error: any) {
      logger.error('Save operation record failed', error)
      toast.addToast('error', error?.response?.data?.detail || '运营记录保存失败')
    } finally {
      setSaving(false)
    }
  }

  const edit = (record: OperationRecord) => {
    setEditingId(record.id)
    setOriginalAmounts({ planned: record.planned_amount_rmb ?? null, actual: record.actual_amount_rmb ?? null })
    setForm({
      record_type: record.record_type, status: record.status, name: record.name,
      platform: record.platform || '', market: record.market || '', counterparty: record.counterparty || '',
      planned_amount_rmb: record.planned_amount_rmb == null ? '' : String(record.planned_amount_rmb),
      actual_amount_rmb: record.actual_amount_rmb == null ? '' : String(record.actual_amount_rmb),
      notes: record.notes || '',
    })
  }

  const remove = async (record: OperationRecord) => {
    const ok = await confirmAction({
      title: '删除运营记录',
      message: '删除记录时会同时删除其自动生成的财务台账，确认继续？',
      confirmText: '删除',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deleteOperationRecord(record.id)
      setRecords(current => current.filter(item => item.id !== record.id))
      toast.addToast('success', '运营记录已删除')
    } catch (error: any) {
      logger.error('Delete operation record failed', error)
      toast.addToast('error', '运营记录删除失败')
    }
  }

  const totalActual = records.reduce((sum, record) => sum + (record.actual_amount_rmb || 0), 0)
  const linkedCount = records.filter(record => record.ledger_entry_id).length
  const label = (items: { id: string; label: string }[], id: string) => items.find(item => item.id === id)?.label || id
  const temporaryName = isTemporaryRecordName(form.name)
  const plannedAmountInvalid = hasInvalidPlannedAmount(form)
  const formIncomplete = !form.record_type || !form.status || !form.name.trim() || !form.counterparty.trim() || plannedAmountInvalid || temporaryName

  return (
    <div className="operations-shell space-y-6">
      <section className="operations-hero">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--color-primary)]">OPERATIONS LEDGER</p>
          <h1 className="mt-2 text-2xl font-bold text-[var(--color-fg)]">运营台账</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-muted)]">广告投放、达人合作、Listing 优化与应收回款的真实业务记录，联动财务台账和经营复盘。</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="w-3.5 h-3.5 mr-1" />刷新台账</Button>
      </section>
      <div className="operations-evidence-panel">
        <EvidenceBanner evidence={evidence} />
      </div>
      <div className="operations-metric-grid">
        <SummaryCard icon={Megaphone} label="运营记录" value={String(records.length)} />
        <SummaryCard icon={CheckCircle2} label="已关联财务台账" value={String(linkedCount)} />
        <SummaryCard icon={Users} label="真实发生金额" value={`¥${totalActual.toFixed(2)}`} />
      </div>
      <OperationCadencePanel records={records} />
      <Card className="operations-form-panel">
        <CardHeader>
          <div className="operations-section-heading">
            <div>
              <h2 className="font-semibold text-[var(--color-fg)]">{editingId ? '编辑运营记录' : '新增运营记录'}</h2>
              <p className="mt-1 text-xs text-[var(--color-muted)]">记录必须来自真实运营动作；金额变更会触发财务同步确认。</p>
            </div>
            {editingId && <span className="operations-editing-pill">编辑中</span>}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="operations-form-grid">
            <Select label="业务类型" value={form.record_type} onChange={record_type => setForm({...form, record_type})} options={options.record_types.map(item => ({ value: item.id, label: item.label }))} />
            <Select label="状态" value={form.status} onChange={status => setForm({...form, status})} options={options.statuses.map(item => ({ value: item.id, label: item.label }))} />
            <Input label="记录名称" value={form.name} onChange={event => setForm({...form, name: event.target.value})} />
            <Input label="合作方/回款方" value={form.counterparty} onChange={event => setForm({...form, counterparty: event.target.value})} />
            <Select label="平台" placeholder="可选" value={form.platform} onChange={platform => setForm({...form, platform})} options={platforms.map(item => ({ value: item.id, label: item.label }))} />
            <Select label="市场" placeholder="可选" value={form.market} onChange={market => setForm({...form, market})} options={markets.map(item => ({ value: item.id, label: item.label }))} />
            <Input label="计划金额 RMB" type="number" min="0" step="0.01" value={form.planned_amount_rmb} onChange={event => setForm({...form, planned_amount_rmb: event.target.value})} />
            <Input label="真实发生金额 RMB" type="number" min="0" step="0.01" value={form.actual_amount_rmb} onChange={event => setForm({...form, actual_amount_rmb: event.target.value})} />
          </div>
          <Input label="说明" value={form.notes} onChange={event => setForm({...form, notes: event.target.value})} />
          <div className="operations-form-actions">
            <Button onClick={save} disabled={saving || formIncomplete}><Plus className="w-4 h-4 mr-1" />{saving ? '保存中' : '保存记录'}</Button>
            {editingId && <Button variant="outline" onClick={() => { setEditingId(null); setOriginalAmounts(null); setForm(emptyForm) }}>取消编辑</Button>}
            {(!form.name.trim() || !form.counterparty.trim() || plannedAmountInvalid) && <span className="text-xs text-[var(--color-muted)] self-center">{plannedAmountHint(form)}</span>}
            {temporaryName && <span className="text-xs text-[var(--color-danger)] self-center">记录名称疑似临时编辑或测试残留，请填写真实业务名称</span>}
          </div>
        </CardContent>
      </Card>
      <Card className="operations-table-panel">
        <CardHeader>
          <div className="operations-section-heading">
            <div>
              <h2 className="font-semibold text-[var(--color-fg)]">运营记录</h2>
              <p className="mt-1 text-xs text-[var(--color-muted)]">按业务类型、状态、平台、市场、金额和财务联动关系追踪真实运营动作。</p>
            </div>
            <span className="operations-count-pill">当前 {records.length} 条</span>
          </div>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? <EmptyState icon={<Megaphone className="h-9 w-9" />} title="暂无运营记录" description="使用上方表单录入真实广告、达人或回款动作。" /> : (
            <div className="operations-table-shell"><table className="professional-table w-full text-xs">
              <thead className="bg-[var(--color-bg)]"><tr className="border-b border-[var(--color-border)] text-left text-[var(--color-muted)]"><th className="py-2">类型/名称</th><th>状态</th><th>平台/市场</th><th className="text-right">计划金额</th><th className="text-right">真实金额</th><th>财务台账</th><th>操作</th></tr></thead>
              <tbody>{records.map(record => <tr key={record.id} className="operations-row border-b border-[var(--color-border)]">
                <td className="py-3"><p className="font-medium text-[var(--color-fg)]">{record.name}</p><p className="text-[var(--color-muted)]">{label(options.record_types, record.record_type)} / {record.counterparty || '-'}</p></td>
                <td><Badge variant="default">{label(options.statuses, record.status)}</Badge></td><td className="text-[var(--color-muted)]">{[record.platform, record.market].filter(Boolean).join(' / ') || '-'}</td>
                <td className="text-[var(--color-fg)] text-right tabular-nums">{record.planned_amount_rmb == null ? '--' : `¥${record.planned_amount_rmb.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}</td><td className="text-[var(--color-fg)] text-right tabular-nums">{record.actual_amount_rmb == null ? '--' : `¥${record.actual_amount_rmb.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}</td>
                <td>{record.ledger_entry_id ? <Badge variant="success">已自动入账</Badge> : <Badge variant="default">待真实金额</Badge>}</td>
                <td><button title="编辑" onClick={() => edit(record)} className="operations-action-button text-[var(--color-primary)]"><Edit3 className="w-3.5 h-3.5" /></button><button title="删除" onClick={() => remove(record)} className="operations-action-button text-[var(--color-danger)]"><Trash2 className="w-3.5 h-3.5" /></button></td>
              </tr>)}</tbody>
            </table></div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return <Card className="operations-summary-card"><CardContent className="pt-4 flex items-center gap-3"><span className="operations-summary-icon"><Icon className="w-5 h-5" /></span><div><p className="text-xs text-[var(--color-muted)]">{label}</p><p className="text-xl font-bold text-[var(--color-fg)]">{value}</p></div></CardContent></Card>
}

function OperationCadencePanel({ records }: { records: OperationRecord[] }) {
  const now = new Date()
  const oneDay = 24 * 60 * 60 * 1000
  const buckets = [
    { label: '日常运营记录', days: 1 },
    { label: '每周运营记录', days: 7 },
    { label: '每月运营记录', days: 30 },
  ].map(bucket => {
    const items = records.filter(record => {
      const time = record.created_at ? new Date(record.created_at).getTime() : 0
      return time > 0 && now.getTime() - time <= bucket.days * oneDay
    })
    return {
      ...bucket,
      count: items.length,
      amount: items.reduce((sum, record) => sum + Number(record.actual_amount_rmb || 0), 0),
    }
  })
  const maxAmount = Math.max(...buckets.map(bucket => bucket.amount), 1)
  return (
    <Card className="operations-cadence-panel">
      <CardHeader>
        <div className="operations-section-heading">
          <div>
            <h2 className="font-semibold text-[var(--color-fg)]">运营节奏与趋势</h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">按真实运营台账生成日/周/月记录视图；无记录时只显示空态，不生成模板任务。</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3" data-ui="operation-trend-chart">
          {buckets.map(bucket => (
            <div key={bucket.label} className="operations-cadence-tile">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--color-fg)]">{bucket.label}</p>
                <span className="operations-count-pill">{bucket.count} 条</span>
              </div>
              <p className="mt-2 text-xl font-semibold text-[var(--color-fg)]">¥{bucket.amount.toFixed(2)}</p>
              <div className="operations-cadence-bar">
                <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${Math.max(bucket.amount / maxAmount * 100, bucket.amount ? 4 : 0)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function isTemporaryRecordName(value: string) {
  const name = value.trim()
  return name.endsWith('-测试') || ['修改后的', '仅名称无其他必填', '自动化测试'].some(pattern => name.includes(pattern))
}

function allowsZeroBudgetOperationRecord(recordType: string) {
  return recordType === 'listing_optimization'
}

function hasInvalidPlannedAmount(form: typeof emptyForm) {
  if (form.planned_amount_rmb === '') return true
  const amount = Number(form.planned_amount_rmb)
  if (Number.isNaN(amount) || amount < 0) return true
  return amount === 0 && !allowsZeroBudgetOperationRecord(form.record_type)
}

function plannedAmountHint(form: typeof emptyForm) {
  if (allowsZeroBudgetOperationRecord(form.record_type)) {
    return '请填写记录名称、合作方/回款方；0 预算 Listing 优化动作允许保存且不会自动生成财务流水'
  }
  return '请填写记录名称、合作方/回款方和大于 0 的计划金额'
}
