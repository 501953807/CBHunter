import { useEffect, useState } from "react"
import { BookOpen, Check, CircleAlert, CircleCheck, DollarSign, Edit3, Plus, RefreshCw, Trash2, X } from "lucide-react"
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

function FieldDictionaryRow({
  item,
  editing,
  onEdit,
  onCancel,
  onChange,
}: {
  item: UnifiedFieldDictionaryItem
  editing: boolean
  onEdit: () => void
  onCancel: () => void
  onChange: (updater: (item: UnifiedFieldDictionaryItem) => UnifiedFieldDictionaryItem) => void
}) {
  const rawFieldText = (platform: "shopee" | "temu" | "tiktok" | "miaoshou") => item.platforms?.[platform]?.field || ""
  const fieldText = (platform: "shopee" | "temu" | "tiktok" | "miaoshou") => rawFieldText(platform) || "待映射"
  const updateText = (field: keyof UnifiedFieldDictionaryItem, value: string) => {
    onChange(current => ({ ...current, [field]: value }))
  }
  const updatePlatformField = (platform: "shopee" | "temu" | "tiktok" | "miaoshou", value: string) => {
    onChange(current => ({
      ...current,
      platforms: {
        ...(current.platforms || {}),
        [platform]: {
          ...((current.platforms || {})[platform] || {}),
          field: value,
        },
      },
    }))
  }
  const textInput = (value: string, onValueChange: (value: string) => void, width = "w-28") => (
    <input
      value={value}
      onChange={event => onValueChange(event.target.value)}
      className={`${width} rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[11px] text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]`}
    />
  )
  return (
    <tr className="border-b border-[var(--color-border)] last:border-b-0">
      <td className="px-3 py-2 font-mono text-[11px] text-[var(--color-fg)]">{item.key}</td>
      <td className="px-3 py-2 font-medium text-[var(--color-fg)]">{editing ? textInput(item.label, value => updateText("label", value)) : item.label}</td>
      <td className="px-3 py-2 text-[var(--color-muted)]">{editing ? textInput(item.data_type, value => updateText("data_type", value), "w-24") : item.data_type}</td>
      <td className="px-3 py-2 text-[var(--color-muted)]">{editing ? textInput(item.module, value => updateText("module", value), "w-24") : item.module}</td>
      <td className="px-3 py-2 text-[var(--color-muted)]">{editing ? textInput(rawFieldText("shopee"), value => updatePlatformField("shopee", value)) : fieldText("shopee")}</td>
      <td className="px-3 py-2 text-[var(--color-muted)]">{editing ? textInput(rawFieldText("temu"), value => updatePlatformField("temu", value)) : fieldText("temu")}</td>
      <td className="px-3 py-2 text-[var(--color-muted)]">{editing ? textInput(rawFieldText("tiktok"), value => updatePlatformField("tiktok", value)) : fieldText("tiktok")}</td>
      <td className="px-3 py-2 text-[var(--color-muted)]">{editing ? textInput(rawFieldText("miaoshou"), value => updatePlatformField("miaoshou", value)) : fieldText("miaoshou")}</td>
      <td className="px-3 py-2 text-[var(--color-muted)]">{editing ? textInput(item.country_difference || "", value => updateText("country_difference", value), "w-32") : item.country_difference || "无"}</td>
      <td className="px-3 py-2">
        {editing ? (
          <button onClick={onCancel} className="rounded border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-muted)]">
            完成
          </button>
        ) : (
          <button onClick={onEdit} className="rounded border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-primary)]">
            编辑
          </button>
        )}
      </td>
    </tr>
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

  return (
    <div className="space-y-6">
      <div
        className="rounded-xl border p-4"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        data-ui="settings-fee-rate-governance-summary"
        aria-label="费率汇率治理摘要"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>费率、汇率与定价模板治理摘要</h3>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--color-muted)' }}>
              这里只读取已启用平台费率模板、汇率记录和定价附加模板；缺失项保持待配置，不按 0% 或固定汇率代算。
            </p>
          </div>
          <span
            className="rounded-full px-2 py-1 text-[11px] font-medium"
            style={{
              backgroundColor: governanceSummary.missingFeeRows || governanceSummary.exchangeCurrencyCount === 0 ? 'var(--color-warning-light)' : 'var(--color-success-light)',
              color: governanceSummary.missingFeeRows || governanceSummary.exchangeCurrencyCount === 0 ? 'var(--color-warning)' : 'var(--color-success)',
            }}
          >
            {governanceSummary.missingFeeRows || governanceSummary.exchangeCurrencyCount === 0 ? '配置待补齐' : '配置可用于定价'}
          </span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          <FeeGovernanceMetric label="平台" value={governanceSummary.platformCount} />
          <FeeGovernanceMetric label="市场" value={governanceSummary.marketCount} />
          <FeeGovernanceMetric label="完整费率" value={governanceSummary.completeFeeRows} />
          <FeeGovernanceMetric label="费率缺口" value={governanceSummary.missingFeeRows} tone={governanceSummary.missingFeeRows ? 'warning' : 'success'} />
          <FeeGovernanceMetric label="汇率币种" value={governanceSummary.exchangeCurrencyCount} tone={governanceSummary.exchangeCurrencyCount ? 'success' : 'warning'} />
          <FeeGovernanceMetric label="定价模板" value={governanceSummary.pricingTemplateCount} />
        </div>
        <div className="mt-3 grid gap-2 text-[11px] md:grid-cols-2">
          <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
            <span className="font-medium" style={{ color: 'var(--color-fg)' }}>当前平台费率：</span>
            <span style={{ color: 'var(--color-muted)' }}>
              {activePlatform || '未选择'} · {items.length} 个市场 · 缺口 {items.filter(hasFeeGap).length}
            </span>
          </div>
          <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
            <span className="font-medium" style={{ color: 'var(--color-fg)' }}>接口说明：</span>
            <span style={{ color: feeStatusText ? 'var(--color-muted)' : 'var(--color-warning)' }}>
              {feeStatusText || '费率接口暂未返回来源说明或缺口。'}
            </span>
          </div>
        </div>
      </div>
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

function buildFeeGovernanceSummary(grouped: Record<string, any[]>, rates: any[], pricingTemplates: any[]) {
  const rows = Object.values(grouped).flat()
  const markets = new Set(rows.map(item => `${item.platform || ''}_${item.market || ''}`))
  return {
    platformCount: Object.keys(grouped).length,
    marketCount: markets.size,
    completeFeeRows: rows.filter(item => !hasFeeGap(item)).length,
    missingFeeRows: rows.filter(hasFeeGap).length,
    exchangeCurrencyCount: rates.length,
    pricingTemplateCount: pricingTemplates.length,
  }
}

function hasFeeGap(item: any) {
  return ['commission', 'transaction', 'tech', 'low_value_tax'].some(key => item?.[key] == null)
}

function FeeGovernanceMetric({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'warning' }) {
  const color = tone === 'success'
    ? 'var(--color-success)'
    : tone === 'warning'
      ? 'var(--color-warning)'
      : 'var(--color-fg)'
  return (
    <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
      <div className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{label}</div>
      <div className="mt-1 text-base font-semibold" style={{ color }}>{value}</div>
    </div>
  )
}
