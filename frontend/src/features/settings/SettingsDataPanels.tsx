import { useEffect, useState } from "react"
import { BookOpen, Check, Edit3, Plus, Trash2, X } from "lucide-react"
import { Card, CardContent, CardHeader } from "../../components/ui/Card"
import { useConfirm } from "../../components/ui/ConfirmDialog"
import { calculateSmartProfit, listExchangeRates, refreshExchangeRates } from "../../api/smart"
import {
  createDictItem,
  deleteDictItem,
  getFieldDictionaryVersions,
  listDicts,
  listFeeRates,
  publishFieldDictionaryDraft,
  saveFieldDictionaryDraft,
  updateDictItem,
  updateFeeRates,
} from "../../api/settings"
import { listSeeds } from "../../api/seeds"
import { logger } from "../../utils/logger"
import SeedManagerTab from "./SeedManagerTab"
import { EvidenceBanner } from "../../components/shared/EvidenceBanner"
import type { ApiResponse } from "../../types/common"
import { useFullConfig } from "../../hooks/useConfig"
import type { DictionaryAdminConfig, DictionaryDefinition } from "../../api/settings"
import type { UnifiedFieldDictionary, UnifiedFieldDictionaryItem } from "../../api/config"
import { PlatformFieldGroupGovernance } from "./PlatformFieldGroupGovernance"
import {
  ExchangeRatesPanel,
  FeeRateGovernanceSummary,
  FeeRateTable,
  FieldDictionaryRow,
  ProfitCalculatorPanel,
  buildFeeGovernanceSummary,
} from "./SettingsDataPanelsParts"

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

export function FieldDictionarySettings() {
  const { unified_field_dictionary } = useFullConfig()
  const [query, setQuery] = useState("")
  const [moduleFilter, setModuleFilter] = useState("all")
  const [activeDictionary, setActiveDictionary] = useState<UnifiedFieldDictionary | null>(null)
  const [draftDictionary, setDraftDictionary] = useState<UnifiedFieldDictionary | null>(null)
  const [history, setHistory] = useState<UnifiedFieldDictionary[]>([])
  const [editableFields, setEditableFields] = useState<UnifiedFieldDictionaryItem[]>([])
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [changeNote, setChangeNote] = useState("")
  const [statusText, setStatusText] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const active = activeDictionary || unified_field_dictionary || { fields: [] }
  const fields = editableFields.length > 0 ? editableFields : active.fields || []
  const modules = Array.from(new Set(fields.map(item => item.module).filter(Boolean))).sort()
  const filteredFields = fields.filter(item => {
    const matchesModule = moduleFilter === "all" || item.module === moduleFilter
    const text = `${item.key} ${item.label} ${item.module} ${item.platforms?.shopee?.field || ""} ${item.platforms?.temu?.field || ""} ${item.platforms?.tiktok?.field || ""} ${item.platforms?.miaoshou?.field || ""}`.toLowerCase()
    return matchesModule && text.includes(query.trim().toLowerCase())
  })
  const platformCoverage = (platform: "shopee" | "temu" | "tiktok" | "miaoshou") => fields.filter(item => item.platforms?.[platform]?.field).length
  const draftVersion = draftDictionary?.version || (dirty ? "本地未保存草稿" : "")

  const loadVersions = async () => {
    setLoading(true)
    try {
      const response = await getFieldDictionaryVersions()
      const versions = response.data
      const activeVersion = versions?.active || unified_field_dictionary || { fields: [] }
      const draftVersionData = versions?.draft && Array.isArray((versions.draft as UnifiedFieldDictionary).fields)
        ? versions.draft as UnifiedFieldDictionary
        : null
      setActiveDictionary(activeVersion)
      setDraftDictionary(draftVersionData)
      setEditableFields([...(draftVersionData?.fields || activeVersion.fields || [])])
      setHistory(versions?.history || [])
      setDirty(false)
      setStatusText(draftVersionData ? `已加载草稿 ${draftVersionData.version || ""}` : "当前无草稿，正在编辑生效版副本")
    } catch (e: any) {
      logger.error("Load field dictionary versions failed", e)
      setEditableFields([...(unified_field_dictionary?.fields || [])])
      setStatusText("字段字典版本加载失败，暂按 /config/init 生效版展示")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVersions()
  }, [unified_field_dictionary?.version])

  const updateField = (key: string, updater: (item: UnifiedFieldDictionaryItem) => UnifiedFieldDictionaryItem) => {
    setEditableFields(current => current.map(item => item.key === key ? updater(item) : item))
    setDirty(true)
  }

  const saveDraft = async () => {
    setSaving(true)
    try {
      const dictionary: UnifiedFieldDictionary = {
        ...active,
        ...draftDictionary,
        fields: editableFields,
      }
      await saveFieldDictionaryDraft(dictionary, changeNote || "设置中心保存字段字典草稿")
      setStatusText("字段字典草稿已保存，尚未影响运行时字段映射")
      setChangeNote("")
      await loadVersions()
    } catch (e: any) {
      logger.error("Save field dictionary draft failed", e)
      setStatusText("保存失败：请检查字段 key、中文名和数据类型是否完整且不重复")
    } finally {
      setSaving(false)
    }
  }

  const publishDraft = async () => {
    if (dirty) {
      setStatusText("当前有未保存修改，请先保存草稿后再发布")
      return
    }
    setSaving(true)
    try {
      await publishFieldDictionaryDraft(draftDictionary?.version)
      setStatusText("字段字典草稿已发布为生效版，运行时字段映射将在重新读取配置后使用新版本")
      await loadVersions()
    } catch (e: any) {
      logger.error("Publish field dictionary draft failed", e)
      setStatusText("发布失败：没有可发布草稿或草稿版本已过期")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
    <Card data-ui="settings-unified-field-dictionary">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[var(--color-primary)]" />
              <h2 className="font-semibold text-[var(--color-fg)]">统一字段字典</h2>
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
              通过生效版、草稿和历史版本治理标准字段、数据类型、所属模块、三平台字段和妙手参考字段；草稿不影响运行时字段映射，发布后才进入全系统配置。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--color-primary-light)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
              字段 {fields.length}
            </span>
            <button
              onClick={loadVersions}
              disabled={loading}
              className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-fg)] disabled:opacity-50"
            >
              {loading ? "加载中" : "刷新版本"}
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          {[
            ["Shopee", platformCoverage("shopee")],
            ["TEMU", platformCoverage("temu")],
            ["TikTok", platformCoverage("tiktok")],
            ["妙手参考", platformCoverage("miaoshou")],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="text-[11px] text-[var(--color-muted)]">{label as string}</p>
              <p className="mt-1 text-lg font-bold text-[var(--color-fg)]">{value as number}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-2 text-xs md:grid-cols-3" data-ui="settings-field-dictionary-version-governance">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <p className="text-[var(--color-muted)]">生效版</p>
            <p className="mt-1 font-semibold text-[var(--color-fg)]">{active.version || "default"} · {active.fields?.length || 0} 字段</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <p className="text-[var(--color-muted)]">草稿</p>
            <p className="mt-1 font-semibold text-[var(--color-fg)]">{draftVersion || "无草稿"} {dirty ? "· 未保存" : ""}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <p className="text-[var(--color-muted)]">历史版本</p>
            <p className="mt-1 font-semibold text-[var(--color-fg)]">{history.length} 个归档</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap gap-2">
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="搜索标准字段、中文名、平台字段或妙手字段"
            className="min-w-[260px] flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]"
          />
          <select
            value={moduleFilter}
            onChange={event => setModuleFilter(event.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]"
          >
            <option value="all">全部模块</option>
            {modules.map(module => <option key={module} value={module}>{module}</option>)}
          </select>
          <input
            value={changeNote}
            onChange={event => setChangeNote(event.target.value)}
            placeholder="变更说明，例如：补齐 Shopee 越南字段"
            className="min-w-[260px] flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]"
          />
          <button
            onClick={saveDraft}
            disabled={saving || fields.length === 0}
            className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-[var(--color-primary-text)] disabled:opacity-50"
          >
            保存草稿
          </button>
          <button
            onClick={publishDraft}
            disabled={saving || dirty || !draftDictionary?.version}
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-fg)] disabled:opacity-50"
          >
            发布草稿
          </button>
        </div>
        {statusText ? (
          <p className="mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-muted)]">
            {statusText}
          </p>
        ) : null}
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead className="sticky top-0 bg-[var(--color-bg)]">
                <tr>
                  {["标准字段", "中文名", "类型", "模块", "Shopee", "TEMU", "TikTok", "妙手参考", "国别差异", "操作"].map(head => (
                    <th key={head} className="border-b border-[var(--color-border)] px-3 py-2 text-left font-medium text-[var(--color-muted)]">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredFields.map(item => (
                  <FieldDictionaryRow
                    key={item.key}
                    item={item}
                    editing={editingKey === item.key}
                    onEdit={() => setEditingKey(item.key)}
                    onCancel={() => setEditingKey(null)}
                    onChange={updater => updateField(item.key, updater)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {filteredFields.length === 0 ? (
            <p className="bg-[var(--color-surface)] px-4 py-8 text-center text-xs text-[var(--color-muted)]">
              当前筛选没有字段；请调整关键词或模块。
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
    <PlatformFieldGroupGovernance />
    </div>
  )
}

export function FeeRateSettings({ toast }: { toast: any }) {
  const [grouped, setGrouped] = useState<Record<string, any[]>>({})
  const [pricingTemplates, setPricingTemplates] = useState<any[]>([])
  const [feeStatusText, setFeeStatusText] = useState('')
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
      const groupedRates = r.data?.grouped || {}
      setPricingTemplates(r.data?.pricing_adjustment_templates || [])
      setFeeStatusText(r.data_gaps?.join('；') || r.confidence_reason || '')
      if (Object.keys(groupedRates).length > 0) {
        setGrouped(groupedRates)
        setActivePlatform(current => current || Object.keys(groupedRates)[0] || '')
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
  const governanceSummary = buildFeeGovernanceSummary(grouped, rates, pricingTemplates)
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
  const handleSaveFeeRate = async () => {
    if (Object.values(form).some(value => value === '')) return
    try {
      await updateFeeRates({
        id: editingId,
        ...Object.fromEntries(Object.entries(form).map(([key, value]) => [key, Number(value)])),
      })
      toast.addToast('success', '费率已更新')
      setEditingId(null)
      loadFees()
    } catch (e: any) {
      logger.error('Update fee rates failed', e)
      toast.addToast('error', '保存失败')
    }
  }

  return (
    <div className="space-y-6">
      <FeeRateGovernanceSummary
        activePlatform={activePlatform}
        feeStatusText={feeStatusText}
        governanceSummary={governanceSummary}
        items={items}
      />
      <ExchangeRatesPanel rates={rates} refreshingRates={refreshingRates} onRefreshRates={refreshRates} />
      <ProfitCalculatorPanel
        bestMarket={bestMarket}
        calcDisabledReason={calcDisabledReason}
        calcLoading={calcLoading}
        calcResults={calcResults}
        costRmb={costRmb}
        markupPct={markupPct}
        shippingRmb={shippingRmb}
        onCalculate={handleCalc}
        onCostChange={setCostRmb}
        onMarkupChange={setMarkupPct}
        onShippingChange={setShippingRmb}
      />
      <FeeRateTable
        activePlatform={activePlatform}
        editingId={editingId}
        fields={FF}
        fieldLabels={FL}
        form={form}
        items={items}
        platformNames={platformNames}
        onCancelEdit={() => setEditingId(null)}
        onEditItem={item => {
          setEditingId(item.id)
          setForm({
            commission: item.commission == null ? '' : String(item.commission),
            transaction: item.transaction == null ? '' : String(item.transaction),
            tech: item.tech == null ? '' : String(item.tech),
            low_value_tax: item.low_value_tax == null ? '' : String(item.low_value_tax),
          })
        }}
        onFormChange={(field, value) => setForm({ ...form, [field]: value })}
        onSaveItem={handleSaveFeeRate}
        onSelectPlatform={platform => {
          setActivePlatform(platform)
          setEditingId(null)
        }}
      />
    </div>
  )
}
