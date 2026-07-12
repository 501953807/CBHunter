import { useEffect, useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import {
  createFinanceLedger,
  listFinanceEntryTypes,
  listFinanceLedger,
  type FinanceEntryTypeOption,
  type FinanceLedgerEntry,
} from '../../api/finance'
import { useConfig } from '../../hooks/useConfig'
import { logger } from '../../utils/logger'
import { EvidenceBanner } from '../../components/shared/EvidenceBanner'
import type { ApiResponse } from '../../types/common'
import { EmptyState } from '../../components/ui/EmptyState'

interface FinanceLedgerPanelProps {
  onLedgerChanged: () => void
  initialEntryType?: string
  initialOrderId?: string
  initialPlatformAccountId?: string
}

export function FinanceLedgerPanel({ onLedgerChanged, initialEntryType = '', initialOrderId = '', initialPlatformAccountId = '' }: FinanceLedgerPanelProps) {
  const [ledger, setLedger] = useState<FinanceLedgerEntry[]>([])
  const [evidence, setEvidence] = useState<ApiResponse<FinanceLedgerEntry[]> | null>(null)
  const [entryTypes, setEntryTypes] = useState<FinanceEntryTypeOption[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    entry_type: '',
    amount_rmb: '',
    platform: '',
    market: '',
    order_id: initialOrderId,
    description: '',
  })
  const { platforms, markets, finance_entry_types } = useConfig()

  const loadLedger = () => {
    listFinanceLedger({
      page_size: 8,
      entry_type: initialEntryType || undefined,
      platform_account_id: initialPlatformAccountId || undefined,
    })
      .then(r => { setLedger(r.data || []); setEvidence(r) })
      .catch(e => logger.error('Load finance ledger failed', e))
  }

  const loadEntryTypes = () => {
    listFinanceEntryTypes()
      .then(r => setEntryTypes(r.data || []))
      .catch(e => logger.error('Load finance entry types failed', e))
  }

  useEffect(() => {
    loadLedger()
    loadEntryTypes()
  }, [initialEntryType, initialPlatformAccountId])

  useEffect(() => {
    setForm(prev => ({ ...prev, entry_type: prev.entry_type || initialEntryType, order_id: initialOrderId }))
  }, [initialEntryType, initialOrderId])

  const handleCreateLedger = async () => {
    const amount = Number(form.amount_rmb)
    if (!form.entry_type.trim() || !Number.isFinite(amount) || amount <= 0) return
    setSaving(true)
    try {
      await createFinanceLedger({
        entry_type: form.entry_type.trim(),
        amount_rmb: amount,
        currency: 'CNY',
        platform: form.platform || null,
        market: form.market || null,
        order_id: form.order_id || null,
        description: form.description || null,
        extra: {
          source: 'finance_page_manual',
          order_id_prefilled: Boolean(form.order_id),
          platform_account_id: initialPlatformAccountId || undefined,
        },
      })
      setForm({ entry_type: initialEntryType, amount_rmb: '', platform: '', market: '', order_id: initialOrderId, description: '' })
      onLedgerChanged()
      loadLedger()
      loadEntryTypes()
    } catch (e: any) {
      logger.error('Create finance ledger failed', e)
    } finally {
      setSaving(false)
    }
  }

  const mergedEntryTypes = [
    ...(finance_entry_types || []).map(t => ({ id: t.id, label: t.label, source: 'dictionary' as const })),
    ...entryTypes.filter(t => !(finance_entry_types || []).some(dict => dict.id === t.id)),
  ]

  return (
    <>
      <Card id="finance-ledger">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-[var(--color-primary)]" />
            <h2 className="font-semibold text-[var(--color-fg)]">真实台账补录</h2>
          </div>
          <p className="text-xs mt-1 text-[var(--color-muted)]">广告费、达人寄样、应收回款、现金余额等业务动作按实际金额录入。</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <div>
              <Input
                label="台账类型"
                list="finance-entry-types"
                value={form.entry_type}
                placeholder="输入或选择类型编码"
                onChange={e => setForm({ ...form, entry_type: e.target.value })}
              />
              <datalist id="finance-entry-types">
                {mergedEntryTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </datalist>
            </div>
            <Input
              label="金额 RMB"
              type="number"
              min="0"
              step="0.01"
              value={form.amount_rmb}
              onChange={e => setForm({ ...form, amount_rmb: e.target.value })}
            />
            <Select
              label="平台"
              placeholder="可选"
              value={form.platform}
              onChange={platform => setForm({ ...form, platform })}
              options={platforms.map(p => ({ value: p.id, label: p.label }))}
            />
            <Select
              label="市场"
              placeholder="可选"
              value={form.market}
              onChange={market => setForm({ ...form, market })}
              options={markets.map(m => ({ value: m.id, label: m.label }))}
            />
            <Input
              label="关联订单ID"
              value={form.order_id}
              placeholder="从订单详情带入或手工填写"
              onChange={e => setForm({ ...form, order_id: e.target.value })}
            />
            <Button
              onClick={handleCreateLedger}
              disabled={saving || !form.entry_type.trim() || !Number(form.amount_rmb)}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />{saving ? '保存中' : '保存台账'}
            </Button>
          </div>
          <div className="mt-3">
            <Input
              label="说明"
              value={form.description}
              placeholder="记录来源、订单、广告计划、达人名称或回款备注"
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[var(--color-fg)]">最近台账</h2>
            <Button variant="ghost" size="sm" onClick={loadLedger} className="gap-1">
              <RefreshCw className="w-3.5 h-3.5" />刷新
            </Button>
          </div>
          {(initialEntryType || initialPlatformAccountId) && (
            <p className="mt-1 text-[11px] text-[var(--color-primary)]">
              当前筛选：{[initialEntryType ? (mergedEntryTypes.find((item) => item.id === initialEntryType)?.label || initialEntryType) : '', initialPlatformAccountId ? `店铺 ${initialPlatformAccountId}` : ''].filter(Boolean).join(' · ')}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <EvidenceBanner evidence={evidence} compact />
          {ledger.length === 0 ? (
            <EmptyState icon={<Plus className="h-9 w-9" />} title="暂无台账记录" description="使用上方表单补录真实收支，或先同步平台订单。" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-[var(--color-bg)]" style={{ borderColor: 'var(--color-border)' }}>
                    <th className="text-left py-2 pr-3 font-medium text-[var(--color-muted)]">时间</th>
                    <th className="text-left py-2 pr-3 font-medium text-[var(--color-muted)]">类型</th>
                    <th className="text-right py-2 pr-3 font-medium text-[var(--color-muted)]">金额</th>
                    <th className="text-left py-2 pr-3 font-medium text-[var(--color-muted)]">平台/市场</th>
                    <th className="text-left py-2 font-medium text-[var(--color-muted)]">说明</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map(entry => (
                    <tr key={entry.id} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="py-2 pr-3 text-[var(--color-muted)]">{new Date(entry.occurred_at).toLocaleString('zh-CN')}</td>
                      <td className="py-2 pr-3 text-[var(--color-fg)]">{mergedEntryTypes.find(t => t.id === entry.entry_type)?.label || entry.entry_type}</td>
                      <td className={`py-2 pr-3 text-right font-medium ${Number(entry.amount_rmb) < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-fg)]'}`}>¥{Number(entry.amount_rmb).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2 pr-3 text-[var(--color-muted)]">{[entry.platform, entry.market].filter(Boolean).join(' / ') || '-'}</td>
                      <td className="py-2 text-[var(--color-muted)]">{entry.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
