import { useEffect, useState } from "react"
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
import type { ApiResponse } from "../../types/common"
import { useFullConfig } from "../../hooks/useConfig"
import type { DictionaryAdminConfig, DictionaryDefinition } from "../../api/settings"
import type { UnifiedFieldDictionary, UnifiedFieldDictionaryItem } from "../../api/config"
import { DictionarySettingsCard } from "./SettingsDictionaryCrudParts"
import { SettingsFieldDictionaryPanel } from "./SettingsFieldDictionaryPanel"
import {
  ExchangeRatesPanel,
  FeeRateGovernanceSummary,
  FeeRateTable,
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
    <DictionarySettingsCard
      active={active}
      activeDict={activeDict}
      adding={adding}
      addForm={addForm}
      definitions={definitions}
      editingId={editingId}
      editForm={editForm}
      evidence={evidence}
      fieldLabel={fieldLabel}
      fields={fields}
      getTabCount={getTabCount}
      onAdd={handleAdd}
      onAddFormChange={(field, value) => setAddForm({ ...addForm, [field]: value })}
      onCancelAdd={() => setAdding(false)}
      onCancelEdit={() => setEditingId(null)}
      onDelete={handleDelete}
      onEditFormChange={(field, value) => setEditForm({ ...editForm, [field]: value })}
      onSave={handleSave}
      onSelectDict={(id) => { setActiveDict(id); setEditingId(null); setAdding(false) }}
      onStartAdd={() => { setAdding(true); setAddForm({}) }}
      onStartEdit={startEdit}
      toast={toast}
    />
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
    <SettingsFieldDictionaryPanel
      activeFieldCount={active.fields?.length || 0}
      activeVersion={active.version || "default"}
      changeNote={changeNote}
      dirty={dirty}
      draftVersion={draftVersion}
      editingKey={editingKey}
      fields={fields}
      filteredFields={filteredFields}
      historyCount={history.length}
      loading={loading}
      moduleFilter={moduleFilter}
      modules={modules}
      platformCoverage={{
        shopee: platformCoverage("shopee"),
        temu: platformCoverage("temu"),
        tiktok: platformCoverage("tiktok"),
        miaoshou: platformCoverage("miaoshou"),
      }}
      query={query}
      saving={saving}
      statusText={statusText}
      onCancelEdit={() => setEditingKey(null)}
      onChangeNoteChange={setChangeNote}
      onModuleFilterChange={setModuleFilter}
      onPublishDraft={publishDraft}
      onQueryChange={setQuery}
      onReload={loadVersions}
      onSaveDraft={saveDraft}
      onStartEdit={setEditingKey}
      onUpdateField={updateField}
    />
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
