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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">运营台账</h1>
        <p className="text-sm mt-1 text-[var(--color-muted)]">广告投放、达人合作与应收回款的真实业务记录</p>
      </div>
      <EvidenceBanner evidence={evidence} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard icon={Megaphone} label="运营记录" value={String(records.length)} />
        <SummaryCard icon={CheckCircle2} label="已关联财务台账" value={String(linkedCount)} />
        <SummaryCard icon={Users} label="真实发生金额" value={`¥${totalActual.toFixed(2)}`} />
      </div>
      <Card>
        <CardHeader><h2 className="font-semibold text-[var(--color-fg)]">{editingId ? '编辑运营记录' : '新增运营记录'}</h2></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving || formIncomplete}><Plus className="w-4 h-4 mr-1" />{saving ? '保存中' : '保存记录'}</Button>
            {editingId && <Button variant="outline" onClick={() => { setEditingId(null); setOriginalAmounts(null); setForm(emptyForm) }}>取消编辑</Button>}
            {(!form.name.trim() || !form.counterparty.trim() || plannedAmountInvalid) && <span className="text-xs text-[var(--color-muted)] self-center">{plannedAmountHint(form)}</span>}
            {temporaryName && <span className="text-xs text-[var(--color-danger)] self-center">记录名称疑似临时编辑或测试残留，请填写真实业务名称</span>}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between"><h2 className="font-semibold text-[var(--color-fg)]">运营记录</h2><Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button></div>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? <EmptyState icon={<Megaphone className="h-9 w-9" />} title="暂无运营记录" description="使用上方表单录入真实广告、达人或回款动作。" /> : (
            <div className="overflow-x-auto"><table className="professional-table w-full text-xs">
              <thead className="bg-[var(--color-bg)]"><tr className="border-b border-[var(--color-border)] text-left text-[var(--color-muted)]"><th className="py-2">类型/名称</th><th>状态</th><th>平台/市场</th><th className="text-right">计划金额</th><th className="text-right">真实金额</th><th>财务台账</th><th>操作</th></tr></thead>
              <tbody>{records.map(record => <tr key={record.id} className="border-b border-[var(--color-border)]">
                <td className="py-3"><p className="font-medium text-[var(--color-fg)]">{record.name}</p><p className="text-[var(--color-muted)]">{label(options.record_types, record.record_type)} · {record.counterparty || '-'}</p></td>
                <td><Badge variant="default">{label(options.statuses, record.status)}</Badge></td><td className="text-[var(--color-muted)]">{[record.platform, record.market].filter(Boolean).join(' / ') || '-'}</td>
                <td className="text-[var(--color-fg)] text-right tabular-nums">{record.planned_amount_rmb == null ? '--' : `¥${record.planned_amount_rmb.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}</td><td className="text-[var(--color-fg)] text-right tabular-nums">{record.actual_amount_rmb == null ? '--' : `¥${record.actual_amount_rmb.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}</td>
                <td>{record.ledger_entry_id ? <Badge variant="success">已自动入账</Badge> : <Badge variant="default">待真实金额</Badge>}</td>
                <td><button title="编辑" onClick={() => edit(record)} className="p-1 text-[var(--color-primary)]"><Edit3 className="w-3.5 h-3.5" /></button><button title="删除" onClick={() => remove(record)} className="p-1 text-[var(--color-danger)]"><Trash2 className="w-3.5 h-3.5" /></button></td>
              </tr>)}</tbody>
            </table></div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return <Card><CardContent className="pt-4 flex items-center gap-3"><Icon className="w-5 h-5 text-[var(--color-primary)]" /><div><p className="text-xs text-[var(--color-muted)]">{label}</p><p className="text-xl font-bold text-[var(--color-fg)]">{value}</p></div></CardContent></Card>
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
