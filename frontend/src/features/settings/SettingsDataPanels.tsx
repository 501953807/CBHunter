import { useEffect, useState } from "react"
import { BookOpen, Check, CircleAlert, CircleCheck, DollarSign, Edit3, Plus, RefreshCw, Trash2, X } from "lucide-react"
import { Card, CardContent, CardHeader } from "../../components/ui/Card"
import { useConfirm } from "../../components/ui/ConfirmDialog"
import { calculateSmartProfit, listExchangeRates, refreshExchangeRates } from "../../api/smart"
import { createDictItem, deleteDictItem, listDicts, listFeeRates, updateDictItem, updateFeeRates } from "../../api/settings"
import { listSeeds } from "../../api/seeds"
import { logger } from "../../utils/logger"
import SeedManagerTab from "./SeedManagerTab"
import { EvidenceBanner } from "../../components/shared/EvidenceBanner"
import type { ApiResponse } from "../../types/common"
import type { DictionaryAdminConfig, DictionaryDefinition } from "../../api/settings"

export function DictSettingsCRUD({ toast }: { toast: any }) {
  const confirmAction = useConfirm()
  const [dicts, setDicts] = useState<{ key: string; label: string; items: any[] }[]>([]); const [definitions, setDefinitions] = useState<DictionaryDefinition[]>([]); const [activeDict, setActiveDict] = useState(''); const [evidence, setEvidence] = useState<ApiResponse<DictionaryAdminConfig> | null>(null); const [editingId, setEditingId] = useState<string | null>(null); const [editForm, setEditForm] = useState<Record<string, string>>({}); const [adding, setAdding] = useState(false); const [addForm, setAddForm] = useState<Record<string, string>>({})
  const [seedCount, setSeedCount] = useState(0)
  const loadDicts = async () => { try { const r = await listDicts(); const data = r.data; setEvidence(r); setDefinitions(data?.definitions || []); setActiveDict(current => current || data?.definitions[0]?.id || ''); setDicts((data?.definitions || []).map(t => ({ key: t.id, label: t.label, items: data?.dictionaries[t.id] || [] }))) } catch (e: any) { logger.error('Load dicts failed', e); setDicts([]) } }
  const loadSeedCount = async () => { try { const r = await listSeeds({ page_size: 1 }); setSeedCount(r.meta?.total ?? r.data?.total ?? 0) } catch (e: any) { logger.error('Load seed count failed', e); setSeedCount(0) } }
  useEffect(() => { loadDicts(); loadSeedCount() }, [])
  const getTabCount = (tabId: string) => tabId === 'seeds' ? seedCount : (dicts.find(d => d.key === tabId)?.items.length || 0)
  const active = activeDict === 'seeds' ? { key: 'seeds', label: '种子词', items: [] } : (dicts.find(d => d.key === activeDict) || { key: activeDict, label: '', items: [] })
  const fieldDefinitions = definitions.find(item => item.id === activeDict)?.fields || []
  const fields = fieldDefinitions.map(item => item.key)
  const fieldLabel = (key: string) => fieldDefinitions.find(item => item.key === key)?.label || key
  const startEdit = (item: any) => { setEditingId(item.id); const f: Record<string, string> = {}; fields.forEach(k => f[k] = item[k] || ''); setEditForm(f) }
  const handleSave = async () => { try { await updateDictItem(activeDict, editingId!, editForm); toast.addToast('success', '已更新'); setEditingId(null); loadDicts() } catch (e: any) { logger.error('Update dict item failed', e); toast.addToast('error', '保存失败') } }
  const handleAdd = async () => {
    try {
      const payload: any = {}
      fields.forEach(f => { payload[f] = addForm[f] || '' })
      await createDictItem(activeDict, payload)
      toast.addToast('success', '已添加'); setAdding(false); setAddForm({}); loadDicts()
    } catch (e: any) {
      logger.error('Create dictionary item failed', e)
      toast.addToast('error', e?.response?.data?.detail || e?.response?.data?.error?.message || '添加失败')
    }
  }
  const handleDelete = async (id: string) => {
    const ok = await confirmAction({
      title: '删除业务字典项',
      message: '确定删除该业务字典项？删除后相关下拉选项将不再出现。',
      confirmText: '删除',
      tone: 'danger',
    })
    if (!ok) return
    try { await deleteDictItem(activeDict, id); toast.addToast('success', '已删除'); loadDicts() } catch (e: any) { logger.error('Delete dict item failed', e); toast.addToast('error', '删除失败') }
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
            <h2 className="font-semibold" style={{ color: 'var(--color-fg)' }}>业务字典</h2>
          </div>
          {activeDict !== 'seeds' && !adding && (
            <button onClick={() => { setAdding(true); setAddForm({}) }}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-[var(--color-primary-text)]"
              style={{ background: 'var(--gradient-accent)' }}>
              <Plus className="w-3 h-3" /> 新增
            </button>
          )}
        </div>
        <div className="flex gap-1 mt-2 bg-[var(--color-bg)] rounded-lg p-0.5 w-fit">
          {definitions.map(t => (
            <button key={t.id}
              onClick={() => { setActiveDict(t.id); setEditingId(null); setAdding(false) }}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all ${activeDict === t.id ? 'bg-[var(--color-surface)] shadow-sm text-[var(--color-fg)]' : 'text-[var(--color-muted)]'}`}>
              {t.label} ({getTabCount(t.id)})
            </button>
          ))}
        </div>
      </CardHeader>
      <EvidenceBanner evidence={evidence} compact />
      {activeDict === 'seeds' ? (
        <CardContent><SeedManagerTab toast={toast} /></CardContent>
      ) : (
        <CardContent>
      {adding && <div className="mb-3 p-3 rounded-lg border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}><div className="flex items-end gap-2 flex-wrap">{fields.map(f => <div key={f}><label className="text-[11px] block mb-0.5" style={{ color: 'var(--color-muted)' }}>{fieldLabel(f)}</label><input className="text-xs border rounded px-2 py-1.5 w-24" placeholder={fieldLabel(f)} value={addForm[f] || ''} onChange={e => setAddForm({...addForm, [f]: e.target.value})} style={{ borderColor: 'var(--color-border)' }} /></div>)}<button onClick={handleAdd} className="text-xs px-3 py-1.5 rounded bg-[var(--color-success)] text-[var(--color-primary-text)]"><Check className="w-3 h-3 inline mr-1" />添加</button><button onClick={() => setAdding(false)} className="text-xs px-3 py-1.5 rounded border" style={{ borderColor: 'var(--color-border)' }}>取消</button></div></div>}
      <table className="w-full text-xs"><thead><tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>{fields.map(f => <th key={f} className="text-left py-2 pr-3 font-medium" style={{ color: 'var(--color-muted)' }}>{fieldLabel(f)}</th>)}<th className="text-left py-2 font-medium" style={{ color: 'var(--color-muted)' }}>操作</th></tr></thead><tbody>{active.items.map((item: any) => <tr key={item.id} className="border-b" style={{ borderColor: 'var(--color-border)' }}>{fields.map(f => <td key={f} className="py-2 pr-3">{editingId === item.id ? <input className="text-xs border rounded px-1.5 py-0.5 w-full" value={editForm[f] || ''} onChange={e => setEditForm({...editForm, [f]: e.target.value})} style={{ borderColor: 'var(--color-border)' }} /> : <span style={{ color: 'var(--color-fg)' }}>{item[f]}</span>}</td>)}<td className="py-2 flex gap-1">{editingId === item.id ? <><button onClick={handleSave} className="text-[var(--color-success)]"><Check className="w-3 h-3" /></button><button onClick={() => setEditingId(null)} className="text-[var(--color-muted)]"><X className="w-3 h-3" /></button></> : <><button onClick={() => startEdit(item)} className="text-[var(--color-primary)]"><Edit3 className="w-3 h-3" /></button><button onClick={() => handleDelete(item.id)} className="text-[var(--color-danger)]"><Trash2 className="w-3 h-3" /></button></>}</td></tr>)}</tbody></table>
    </CardContent>
  )}
  </Card>
)
}

export function FeeRateSettings({ toast }: { toast: any }) {
  const [grouped, setGrouped] = useState<Record<string, any[]>>({})
  const [activePlatform, setActivePlatform] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ commission: '', transaction: '', tech: '', low_value_tax: '' })
  // Exchange rates
  const [rates, setRates] = useState<any[]>([])
  const [refreshingRates, setRefreshingRates] = useState(false)
  // Profit calculator
  const [costRmb, setCostRmb] = useState('')
  const [shippingRmb, setShippingRmb] = useState('')
  const [markupPct, setMarkupPct] = useState('')
  const [calcResults, setCalcResults] = useState<any[]>([])
  const [calcLoading, setCalcLoading] = useState(false)

  const loadFees = async () => {
    try {
      const r = await listFeeRates()
      if (r.data?.grouped) {
        setGrouped(r.data.grouped)
        setActivePlatform(current => current || Object.keys(r.data.grouped)[0] || '')
      }
    } catch (e: any) { logger.error('Load fee rates failed', e) }
  }
  const loadRates = async () => {
    try { const r = await listExchangeRates(); setRates(r.data || []) } catch (e: any) { logger.error('Operation failed', e) }
  }
  useEffect(() => { loadFees(); loadRates() }, [])

  const refreshRates = async () => {
    setRefreshingRates(true)
    try { await refreshExchangeRates(); await loadRates(); toast.addToast('success', '汇率已刷新') }
    catch (e: any) { logger.error('Refresh exchange rates failed', e); toast.addToast('error', '刷新失败') }
    setRefreshingRates(false)
  }

  const handleCalc = async () => {
    setCalcLoading(true)
    try { const r = await calculateSmartProfit({ cost_rmb: Number(costRmb), shipping_rmb: Number(shippingRmb), markup_pct: Number(markupPct) }); setCalcResults(r.data?.results || []) } catch (e: any) { logger.error('Operation failed', e) }
    setCalcLoading(false)
  }

  const items = grouped[activePlatform] || []
  const platformNames = Object.keys(grouped)
  const FF = ['commission', 'transaction', 'tech', 'low_value_tax'] as const
  const FL: Record<string, string> = { commission: '佣金', transaction: '交易费', tech: '技术费', low_value_tax: '低价值税' }
  const bestMarket = calcResults.length > 0 ? calcResults[0] : null
  const calcDisabledReason = Number(costRmb) <= 0
    ? '请填写大于 0 的进货成本'
    : shippingRmb === '' || Number(shippingRmb) < 0
      ? '请填写不小于 0 的头程运费'
      : Number(markupPct) <= 0
        ? '请填写大于 0 的加价率'
        : ''

  return (
    <div className="space-y-6">
      {/* Exchange Rates Bar */}
      <div className="rounded-xl border p-3" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium" style={{ color: 'var(--color-fg)' }}>实时汇率 (1 CNY =)</span>
          <button onClick={refreshRates} disabled={refreshingRates}
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border hover:bg-[var(--color-bg)]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
            <RefreshCw className={`w-3 h-3 ${refreshingRates ? 'animate-spin' : ''}`} />
            {refreshingRates ? '刷新中' : '刷新汇率'}
          </button>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5">
          {rates.map((r: any) => (
            <div key={r.to_currency} className="text-center px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
              <div className="text-[11px] font-semibold" style={{ color: 'var(--color-fg)' }}>{r.rate < 0.01 ? r.rate.toFixed(6) : r.rate.toFixed(4)}</div>
              <div className="text-[11px]" style={{ color: 'var(--color-primary)' }}>{r.to_currency}</div>
            </div>
          ))}
          {rates.length === 0 && <div className="col-span-full text-[11px] text-center py-1" style={{ color: 'var(--color-muted)' }}>点击刷新获取最新汇率</div>}
        </div>
      </div>

      {/* Profit Calculator */}
      <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-fg)' }}><DollarSign className="w-4 h-4 text-[var(--color-primary)]" />利润试算器</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <div>
            <label className="text-[11px] block mb-0.5" style={{ color: 'var(--color-muted)' }}>进货成本 (¥)</label>
            <input type="number" value={costRmb} onChange={e => setCostRmb(e.target.value)}
              className="w-full text-xs border rounded px-2 py-1.5" style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)', backgroundColor: 'var(--color-bg)' }} />
          </div>
          <div>
            <label className="text-[11px] block mb-0.5" style={{ color: 'var(--color-muted)' }}>头程运费 (¥)</label>
            <input type="number" value={shippingRmb} onChange={e => setShippingRmb(e.target.value)}
              className="w-full text-xs border rounded px-2 py-1.5" style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)', backgroundColor: 'var(--color-bg)' }} />
          </div>
          <div>
            <label className="text-[11px] block mb-0.5" style={{ color: 'var(--color-muted)' }}>加价率 (%)</label>
            <input type="number" value={markupPct} onChange={e => setMarkupPct(e.target.value)}
              className="w-full text-xs border rounded px-2 py-1.5" style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)', backgroundColor: 'var(--color-bg)' }} />
          </div>
          <div className="flex items-end">
            <button onClick={handleCalc} disabled={calcLoading || Boolean(calcDisabledReason)}
              className="w-full text-xs px-3 py-2 rounded-lg text-[var(--color-primary-text)] disabled:opacity-40" style={{ background: 'var(--gradient-accent)' }}>
              {calcLoading ? '计算中...' : '计算利润'}
            </button>
          </div>
        </div>
        {calcDisabledReason && <p className="mb-2 text-[11px] text-[var(--color-warning)]">暂不能试算：{calcDisabledReason}</p>}
        <div className="text-[11px] mb-2" style={{ color: 'var(--color-muted)' }}>总成本: {costRmb === '' || shippingRmb === '' ? '--' : `¥${(Number(costRmb) + Number(shippingRmb)).toFixed(2)}`} · 加价率: {markupPct === '' ? '--' : `${markupPct}%`} · 目标售价: {markupPct === '' ? '--' : `${(1 + Number(markupPct) / 100).toFixed(1)}x`}</div>
        {bestMarket && (
          <div className={`rounded-lg p-2 mb-2 flex items-center gap-2 ${bestMarket.is_profitable ? 'bg-[var(--color-success-light)]' : 'bg-[var(--color-danger-light)]'}`}>
            {bestMarket.is_profitable ? <CircleCheck className="w-4 h-4 text-[var(--color-success)]" /> : <CircleAlert className="w-4 h-4 text-[var(--color-danger)]" />}
            <span className="text-xs font-medium" style={{ color: 'var(--color-fg)' }}>最佳: {bestMarket.platform} · {bestMarket.market}</span>
            <span className="text-xs font-semibold" style={{ color: bestMarket.is_profitable ? 'var(--color-success)' : 'var(--color-danger)' }}>¥{bestMarket.profit_rmb} ({bestMarket.margin_pct}%)</span>
          </div>
        )}
        {calcResults.length > 0 && (
          <div className="rounded border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
            <table className="w-full text-[11px]">
              <thead style={{ backgroundColor: 'var(--color-bg)' }}>
                <tr>
                  <th className="text-left px-1.5 py-1" style={{ color: 'var(--color-muted)' }}>平台</th>
                  <th className="text-left px-1.5 py-1" style={{ color: 'var(--color-muted)' }}>市场</th>
                  <th className="text-right px-1.5 py-1" style={{ color: 'var(--color-muted)' }}>售价</th>
                  <th className="text-right px-1.5 py-1" style={{ color: 'var(--color-muted)' }}>费率</th>
                  <th className="text-right px-1.5 py-1" style={{ color: 'var(--color-muted)' }}>利润¥</th>
                  <th className="text-right px-1.5 py-1" style={{ color: 'var(--color-muted)' }}>利润率</th>
                </tr>
              </thead>
              <tbody>
                {calcResults.map((r: any, i: number) => (
                  <tr key={i} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-1.5 py-1" style={{ color: 'var(--color-fg)' }}>{r.platform}</td>
                    <td className="px-1.5 py-1" style={{ color: 'var(--color-muted)' }}>{r.market}</td>
                    <td className="px-1.5 py-1 text-right" style={{ color: 'var(--color-fg)' }}>{r.selling_local.toFixed(2)}</td>
                    <td className="px-1.5 py-1 text-right" style={{ color: 'var(--color-muted)' }}>{r.fee_pct}%</td>
                    <td className="px-1.5 py-1 text-right font-semibold" style={{ color: r.is_profitable ? 'var(--color-success)' : 'var(--color-danger)' }}>{r.profit_rmb > 0 ? '+' : ''}{r.profit_rmb}</td>
                    <td className="px-1.5 py-1 text-right" style={{ color: r.margin_pct >= 20 ? 'var(--color-success)' : r.margin_pct > 0 ? 'var(--color-fg)' : 'var(--color-danger)' }}>{r.margin_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fee Rate Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[var(--color-success)]" />
            <h2 className="font-semibold" style={{ color: 'var(--color-fg)' }}>费率与汇率</h2>
          </div>
          <div className="flex gap-1 mt-2 bg-[var(--color-bg)] rounded-lg p-0.5 w-fit">
            {platformNames.map(pf => (
              <button key={pf} onClick={() => { setActivePlatform(pf); setEditingId(null) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-all ${activePlatform === pf ? 'bg-[var(--color-surface)] shadow-sm text-[var(--color-fg)]' : 'text-[var(--color-muted)]'}`}>
                <span className="w-4 h-4 rounded flex items-center justify-center text-[11px] text-[var(--color-primary-text)] font-bold bg-[var(--color-primary)]">{pf[0]}</span>{pf}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <table className="w-full text-xs">
            <thead><tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
              <th className="text-left py-2 pr-3 font-medium" style={{ color: 'var(--color-muted)' }}>市场</th>
              {FF.map(f => <th key={f} className="text-right py-2 pr-3 font-medium" style={{ color: 'var(--color-muted)' }}>{FL[f]}</th>)}
              <th className="text-right py-2 pr-3 font-medium" style={{ color: 'var(--color-muted)' }}>总费率</th>
              <th className="text-center py-2 font-medium" style={{ color: 'var(--color-muted)' }}>操作</th>
            </tr></thead>
            <tbody>
              {items.map((item: any) => {
                const isE = editingId === item.id
                return (
                  <tr key={item.id || item.market} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="py-2 pr-3 font-medium" style={{ color: 'var(--color-fg)' }}>{item.market}</td>
                    {FF.map(f => (
                      <td key={f} className="py-2 pr-3 text-right">
                        {isE ? (
                          <input type="number" step="0.001" className="w-14 text-xs border rounded px-1 py-0.5 text-right"
                            value={form[f]} onChange={e => setForm({...form, [f]: e.target.value})}
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)' }} />
                        ) : (
                          <span style={{ color: item[f] == null ? 'var(--color-muted)' : 'var(--color-fg)' }}>{item[f] == null ? '--' : `${(item[f] * 100).toFixed(1)}%`}</span>
                        )}
                      </td>
                    ))}
                    <td className="py-2 pr-3 text-right font-semibold" style={{ color: item.total_pct == null ? 'var(--color-muted)' : 'var(--color-fg)' }}>{item.total_pct ?? '--'}</td>
                    <td className="py-2 text-center">
                      {isE ? (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={async () => {
                            if (Object.values(form).some(value => value === '')) return
                            try { await updateFeeRates({ id: editingId, ...Object.fromEntries(Object.entries(form).map(([key, value]) => [key, Number(value)])) }); toast.addToast('success', '费率已更新'); setEditingId(null); loadFees() }
                            catch (e: any) { logger.error('Update fee rates failed', e); toast.addToast('error', '保存失败') }
                          }} disabled={Object.values(form).some(value => value === '')} className="text-[var(--color-success)] disabled:opacity-40"><Check className="w-3 h-3" /></button>
                          <button onClick={() => setEditingId(null)} className="text-[var(--color-muted)]"><X className="w-3 h-3" /></button>
                        </div>
                      ) : (
                        <button onClick={() => {
                          setEditingId(item.id)
                          setForm({ commission: item.commission == null ? '' : String(item.commission), transaction: item.transaction == null ? '' : String(item.transaction), tech: item.tech == null ? '' : String(item.tech), low_value_tax: item.low_value_tax == null ? '' : String(item.low_value_tax) })
                        }} className="text-[var(--color-primary)]"><Edit3 className="w-3 h-3" /></button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
