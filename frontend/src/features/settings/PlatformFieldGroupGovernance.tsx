import { useEffect, useMemo, useState } from "react"
import { Layers3, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader } from "../../components/ui/Card"
import {
  getPlatformFieldGroupVersions,
  publishPlatformFieldGroupDraft,
  savePlatformFieldGroupDraft,
} from "../../api/settings"
import { logger } from "../../utils/logger"

type PlatformSchema = {
  version?: string
  status?: string
  groups?: Array<{
    id?: string
    label?: string
    fields?: Array<{
      key?: string
      label?: string
      required?: boolean
      evidence_state?: string
    }>
  }>
}

const PLATFORM_LABELS: Record<string, string> = {
  shopee: "Shopee",
  tiktok: "TikTok Shop",
  temu: "TEMU",
}

export function PlatformFieldGroupGovernance() {
  const [activeSchema, setActiveSchema] = useState<Record<string, PlatformSchema>>({})
  const [draftSchema, setDraftSchema] = useState<Record<string, PlatformSchema> | null>(null)
  const [editableSchema, setEditableSchema] = useState<Record<string, PlatformSchema>>({})
  const [historyCount, setHistoryCount] = useState(0)
  const [activePlatform, setActivePlatform] = useState("shopee")
  const [changeNote, setChangeNote] = useState("")
  const [statusText, setStatusText] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const platformKeys = useMemo(() => (
    Object.keys(editableSchema).filter(key => PLATFORM_LABELS[key])
  ), [editableSchema])
  const currentSchema = editableSchema[activePlatform] || {}
  const rawActiveVersion = (activeSchema as Record<string, unknown>).version
  const rawDraftVersion = draftSchema ? (draftSchema as Record<string, unknown>).version : ""
  const activeVersion = typeof rawActiveVersion === "string" && rawActiveVersion ? rawActiveVersion : "default"
  const draftVersion = typeof rawDraftVersion === "string" ? rawDraftVersion : ""

  const loadVersions = async () => {
    setLoading(true)
    try {
      const response = await getPlatformFieldGroupVersions()
      const active = (response.data?.active || {}) as Record<string, PlatformSchema>
      const draft = response.data?.draft && Object.keys(response.data.draft).length
        ? response.data.draft as Record<string, PlatformSchema>
        : null
      setActiveSchema(active)
      setDraftSchema(draft)
      setEditableSchema(draft || active)
      setHistoryCount(response.data?.history?.length || 0)
      setDirty(false)
      setStatusText(draft ? `已加载平台字段组草稿 ${(draft as Record<string, unknown>).version || ""}` : "当前无草稿，正在编辑生效版副本")
      const firstPlatform = Object.keys(draft || active).find(key => PLATFORM_LABELS[key])
      if (firstPlatform) setActivePlatform(current => PLATFORM_LABELS[current] ? current : firstPlatform)
    } catch (e: any) {
      logger.error("Load platform field group versions failed", e)
      setStatusText("平台字段组版本加载失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVersions()
  }, [])

  const updateField = (groupIndex: number, fieldIndex: number, fieldPatch: Record<string, unknown>) => {
    setEditableSchema(current => {
      const next = structuredClone(current)
      const groups = next[activePlatform]?.groups || []
      const field = groups[groupIndex]?.fields?.[fieldIndex]
      if (field) Object.assign(field, fieldPatch)
      return next
    })
    setDirty(true)
  }

  const saveDraft = async () => {
    setSaving(true)
    try {
      await savePlatformFieldGroupDraft(editableSchema, changeNote || "设置中心保存平台字段组草稿")
      setStatusText("平台字段组草稿已保存，尚未影响运行时字段渲染")
      setChangeNote("")
      await loadVersions()
    } catch (e: any) {
      logger.error("Save platform field group draft failed", e)
      setStatusText("保存失败：请检查平台、字段组、字段 key 和中文名是否完整且不重复")
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
      await publishPlatformFieldGroupDraft(draftVersion)
      setStatusText("平台字段组草稿已发布为生效版，后续动态字段渲染将读取新 Schema")
      await loadVersions()
    } catch (e: any) {
      logger.error("Publish platform field group draft failed", e)
      setStatusText("发布失败：没有可发布草稿或草稿版本已过期")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card data-ui="settings-platform-field-group-approval">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-[var(--color-primary)]" />
              <h2 className="font-semibold text-[var(--color-fg)]">平台字段组 Schema 审批</h2>
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
              管理 Shopee、TikTok Shop、TEMU 商品编辑字段组。草稿不影响内容工厂和批量刊登动态表单，发布后才进入运行时配置。
            </p>
          </div>
          <button
            onClick={loadVersions}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-fg)] disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>
        <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <p className="text-[var(--color-muted)]">生效版</p>
            <p className="mt-1 font-semibold text-[var(--color-fg)]">{String(activeVersion)}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <p className="text-[var(--color-muted)]">草稿</p>
            <p className="mt-1 font-semibold text-[var(--color-fg)]">{draftVersion || "无草稿"} {dirty ? "· 未保存" : ""}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <p className="text-[var(--color-muted)]">历史版本</p>
            <p className="mt-1 font-semibold text-[var(--color-fg)]">{historyCount} 个归档</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap gap-2">
          {platformKeys.map(platform => (
            <button
              key={platform}
              onClick={() => setActivePlatform(platform)}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${activePlatform === platform ? "border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]" : "border-[var(--color-border)] text-[var(--color-muted)]"}`}
            >
              {PLATFORM_LABELS[platform]}
            </button>
          ))}
          <input
            value={changeNote}
            onChange={event => setChangeNote(event.target.value)}
            placeholder="Schema 变更说明，例如：补齐 TEMU 包装字段"
            className="min-w-[260px] flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]"
          />
          <button onClick={saveDraft} disabled={saving || platformKeys.length === 0} className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-[var(--color-primary-text)] disabled:opacity-50">
            保存 Schema 草稿
          </button>
          <button onClick={publishDraft} disabled={saving || dirty || !draftVersion} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-fg)] disabled:opacity-50">
            发布 Schema
          </button>
        </div>
        {statusText ? <p className="mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-muted)]">{statusText}</p> : null}
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full min-w-[780px] text-xs">
              <thead className="sticky top-0 bg-[var(--color-bg)]">
                <tr>
                  {["字段组", "字段 key", "中文名", "必填", "复核状态"].map(head => (
                    <th key={head} className="border-b border-[var(--color-border)] px-3 py-2 text-left font-medium text-[var(--color-muted)]">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(currentSchema.groups || []).flatMap((group, groupIndex) => (
                  (group.fields || []).map((field, fieldIndex) => (
                    <tr key={`${group.id}-${field.key}`} className="border-b border-[var(--color-border)] last:border-b-0">
                      <td className="px-3 py-2 text-[var(--color-muted)]">{group.label || group.id}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-[var(--color-fg)]">{field.key}</td>
                      <td className="px-3 py-2">
                        <input
                          value={field.label || ""}
                          onChange={event => updateField(groupIndex, fieldIndex, { label: event.target.value })}
                          className="w-40 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[11px] text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={Boolean(field.required)}
                          onChange={event => updateField(groupIndex, fieldIndex, { required: event.target.checked })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={field.evidence_state || "observed"}
                          onChange={event => updateField(groupIndex, fieldIndex, { evidence_state: event.target.value })}
                          className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[11px] text-[var(--color-fg)]"
                        >
                          <option value="observed">已确认</option>
                          <option value="needs_category_recheck">需类目复核</option>
                          <option value="needs_edit_page_recheck">需编辑页复核</option>
                          <option value="needs_api_recheck">需 API 复核</option>
                        </select>
                      </td>
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
