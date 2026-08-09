import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
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
  category_profiles?: Array<{
    id?: string
    label?: string
    match?: string[]
    help?: string
    fields?: Array<PlatformFieldShape>
  }>
  category_field_gaps?: {
    needs_category_recheck?: string[]
    needs_edit_page_recheck?: string[]
    needs_api_recheck?: string[]
  }
  groups?: Array<{
    id?: string
    label?: string
    fields?: Array<PlatformFieldShape>
  }>
}
type PlatformFieldShape = {
  key?: string
  label?: string
  required?: boolean
  evidence_state?: string
  unified_field_key?: string
  data_type?: string
  platform_field_name?: string
  miaoshou_field_name?: string
  country_difference?: string
}
type PlatformFieldSchema = NonNullable<NonNullable<PlatformSchema["groups"]>[number]["fields"]>[number]
type CategoryTreePlatformSummary = {
  platform?: string
  profile_count?: number
  category_field_count?: number
  total_recheck_count?: number
  match_rule_count?: number
  profile_labels?: string[]
}
type CategoryTreeSummary = {
  active?: {
    profile_count?: number
    category_field_count?: number
    total_recheck_count?: number
    platforms?: CategoryTreePlatformSummary[]
  }
  draft?: {
    profile_count?: number
    category_field_count?: number
    total_recheck_count?: number
    platforms?: CategoryTreePlatformSummary[]
  } | null
  runtime_rule?: string
}

const PLATFORM_LABELS: Record<string, string> = {
  shopee: "Shopee",
  tiktok: "TikTok Shop",
  temu: "TEMU",
}

export function PlatformFieldGroupGovernance() {
  const [searchParams] = useSearchParams()
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
  const [categoryTreeSummary, setCategoryTreeSummary] = useState<CategoryTreeSummary | null>(null)

  const platformKeys = useMemo(() => (
    Object.keys(editableSchema).filter(key => PLATFORM_LABELS[key])
  ), [editableSchema])
  const currentSchema = editableSchema[activePlatform] || {}
  const rawActiveVersion = (activeSchema as Record<string, unknown>).version
  const rawDraftVersion = draftSchema ? (draftSchema as Record<string, unknown>).version : ""
  const activeVersion = typeof rawActiveVersion === "string" && rawActiveVersion ? rawActiveVersion : "default"
  const draftVersion = typeof rawDraftVersion === "string" ? rawDraftVersion : ""
  const fieldPackageStats = useMemo(() => (
    platformKeys.map(platform => ({ platform, ...buildPlatformSchemaStats(editableSchema[platform]) }))
  ), [platformKeys, editableSchema])
  const runtimeImpactStats = useMemo(() => (
    platformKeys.map(platform => ({ platform, ...buildRuntimeImpactStats(activeSchema[platform], editableSchema[platform]) }))
  ), [platformKeys, activeSchema, editableSchema])
  const categoryProfileStats = useMemo(() => (
    platformKeys.map(platform => ({ platform, ...buildCategoryProfileStats(editableSchema[platform]) }))
  ), [platformKeys, editableSchema])
  const currentStats = buildPlatformSchemaStats(currentSchema)
  const currentRuntimeImpact = buildRuntimeImpactStats(activeSchema[activePlatform], currentSchema)
  const currentCategoryStats = buildCategoryProfileStats(currentSchema)
  const focusTarget = searchParams.get("focus") || ""
  const focusProfile = searchParams.get("profile") || ""
  const focusCategory = searchParams.get("category") || ""
  const fromRuntimeFieldEditor = focusTarget === "platform_field_groups"

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
      setCategoryTreeSummary((response.data?.category_tree_summary || null) as CategoryTreeSummary | null)
      setDirty(false)
      setStatusText(draft ? `已加载平台字段组草稿 ${(draft as Record<string, unknown>).version || ""}` : "当前无草稿，正在编辑生效版副本")
      const firstPlatform = Object.keys(draft || active).find(key => PLATFORM_LABELS[key])
      if (firstPlatform) setActivePlatform(current => PLATFORM_LABELS[current] ? current : firstPlatform)
      if (focusProfile || focusCategory) {
        const focusedPlatform = Object.keys(draft || active).find(platform => {
          const schema = (draft || active)[platform]
          return (schema?.category_profiles || []).some(profile => (
            (focusProfile && profile.id === focusProfile)
            || (focusProfile && profile.label === focusProfile)
            || (focusCategory && (profile.match || []).includes(focusCategory))
          ))
        })
        if (focusedPlatform) setActivePlatform(focusedPlatform)
      }
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
        {fromRuntimeFieldEditor ? (
          <div
            className="mb-3 rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary-light)] p-3 text-xs"
            data-ui="settings-platform-field-governance-deeplink-context"
            aria-label="平台字段组治理下钻上下文"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-[var(--color-primary)]">来自 Listing 平台字段缺口</span>
              <span className="text-[var(--color-muted)]">当前停留在字段组 Schema 审批，不直接改商品字段值</span>
            </div>
            <p className="mt-1 text-[11px] leading-5 text-[var(--color-muted)]">
              {focusProfile ? `目标 Profile：${focusProfile}。` : ""}
              {focusCategory ? `目标类目：${focusCategory}。` : ""}
              请在草稿中补齐类目字段组、字段来源、数据类型和待复核状态，保存草稿并发布后才会进入内容工厂、商品详情和批量刊登运行时字段表单。
            </p>
          </div>
        ) : null}
        <div className="mb-3 grid gap-2 text-xs md:grid-cols-3" data-ui="settings-platform-field-package-coverage" aria-label="平台字段包覆盖度摘要">
          {fieldPackageStats.map(stats => (
            <button
              type="button"
              key={stats.platform}
              onClick={() => setActivePlatform(stats.platform)}
              className={`rounded-xl border p-3 text-left ${activePlatform === stats.platform ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]" : "border-[var(--color-border)] bg-[var(--color-bg)]"}`}
            >
              <p className="font-semibold text-[var(--color-fg)]">{PLATFORM_LABELS[stats.platform]}</p>
              <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-[var(--color-muted)]">
                <span>字段组 {stats.groupCount}</span>
                <span>字段 {stats.fieldCount}</span>
                <span>必填 {stats.requiredCount}</span>
                <span className={stats.recheckCount ? "text-[var(--color-warning)]" : "text-[var(--color-success)]"}>待复核 {stats.recheckCount}</span>
                <span className={stats.sourceGapCount ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}>来源缺口 {stats.sourceGapCount}</span>
                <span>枚举 {stats.enumLikeCount}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="mb-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs" data-ui="settings-platform-field-current-summary">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-[var(--color-fg)]">{PLATFORM_LABELS[activePlatform] || activePlatform} 当前字段包</span>
            <span className="text-[var(--color-muted)]">字段 {currentStats.fieldCount} · 必填 {currentStats.requiredCount} · 待复核 {currentStats.recheckCount} · 来源缺口 {currentStats.sourceGapCount}</span>
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">发布前应优先处理来源缺口和待复核字段；草稿发布后才会进入内容工厂、商品详情和批量刊登动态字段表单。</p>
        </div>
        <div className="mb-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs" data-ui="settings-platform-field-runtime-impact" aria-label="平台字段包运行时影响摘要">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-[var(--color-fg)]">草稿相对生效版差异</span>
            <span className={currentRuntimeImpact.hasChanges ? "text-[var(--color-warning)]" : "text-[var(--color-success)]"}>{currentRuntimeImpact.hasChanges ? "发布会改变运行时字段渲染" : "当前平台无字段差异"}</span>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            {runtimeImpactStats.map(stats => (
              <button
                type="button"
                key={stats.platform}
                onClick={() => setActivePlatform(stats.platform)}
                className={`rounded-lg border px-3 py-2 text-left ${activePlatform === stats.platform ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]" : "border-[var(--color-border)] bg-[var(--color-surface)]"}`}
              >
                <p className="font-semibold text-[var(--color-fg)]">{PLATFORM_LABELS[stats.platform]}</p>
                <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                  新增 {stats.addedCount} · 删除 {stats.removedCount} · 变更 {stats.changedCount}
                </p>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[var(--color-muted)]">发布 Schema 后，内容工厂、商品详情和批量刊登读取 `/config/init` 时会使用新的生效字段包；未发布草稿不会影响运行时。</p>
        </div>
        <div className="mb-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs" data-ui="settings-platform-category-profile-summary" aria-label="平台类目差异字段摘要">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-[var(--color-fg)]">类目差异字段登记</span>
            <span className={currentCategoryStats.totalGapCount ? "text-[var(--color-warning)]" : "text-[var(--color-success)]"}>
              {PLATFORM_LABELS[activePlatform] || activePlatform} 类目待复核 {currentCategoryStats.totalGapCount}
            </span>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            {categoryProfileStats.map(stats => (
              <button
                type="button"
                key={stats.platform}
                onClick={() => setActivePlatform(stats.platform)}
                className={`rounded-lg border px-3 py-2 text-left ${activePlatform === stats.platform ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]" : "border-[var(--color-border)] bg-[var(--color-surface)]"}`}
              >
                <p className="font-semibold text-[var(--color-fg)]">{PLATFORM_LABELS[stats.platform]}</p>
                <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                  profile {stats.profileCount} · 类目字段 {stats.categoryFieldCount} · 类目待复核 {stats.categoryRecheckCount}
                </p>
                <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                  编辑页待复核 {stats.editPageRecheckCount} · API 待复核 {stats.apiRecheckCount}
                </p>
              </button>
            ))}
          </div>
          <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[11px] text-[var(--color-muted)]">
            <p className="font-medium text-[var(--color-fg)]">{PLATFORM_LABELS[activePlatform] || activePlatform} 当前类目 profile</p>
            {currentCategoryStats.profileLabels.length ? (
              <p className="mt-1">已登记：{currentCategoryStats.profileLabels.join("；")}</p>
            ) : (
              <p className="mt-1 text-[var(--color-warning)]">当前字段包未登记类目差异 profile，运行时只能使用通用字段组。</p>
            )}
            <p className="mt-1">
              待复核字段：类目 {currentCategoryStats.categoryRecheckCount} · 编辑页 {currentCategoryStats.editPageRecheckCount} · API {currentCategoryStats.apiRecheckCount}
            </p>
            <p className="mt-1">发布后运行时仍只在商品类目命中 profile 的情况下合并 `category_profile_*` 字段组，不会把全部类目字段无差别塞入所有商品。</p>
          </div>
        </div>
        {categoryTreeSummary ? (
          <div className="mb-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs" data-ui="settings-category-tree-version-governance" aria-label="类目树版本治理摘要">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-[var(--color-fg)]">类目树版本治理</span>
              <span className={categoryTreeSummary.draft ? "text-[var(--color-warning)]" : "text-[var(--color-success)]"}>
                {categoryTreeSummary.draft ? "存在待发布草稿" : "当前读取生效版"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[var(--color-muted)]">
              后端按生效版、草稿和历史归档返回类目 profile、类目字段和待复核数量；未发布草稿仅用于设置中心复核，不进入运行时字段渲染。
            </p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {([
                ["生效版", categoryTreeSummary.active],
                ["草稿", categoryTreeSummary.draft],
              ] as const).map(([label, summary]) => (
                <div key={label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                  <p className="font-medium text-[var(--color-fg)]">{label}</p>
                  {summary ? (
                    <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                      profile {summary.profile_count || 0} · 类目字段 {summary.category_field_count || 0} · 待复核 {summary.total_recheck_count || 0}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-[var(--color-muted)]">无待发布草稿</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
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
                  {["字段组", "字段 key", "中文名", "字段来源", "必填", "复核状态"].map(head => (
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
                      <td className="px-3 py-2" data-ui="settings-platform-field-source-column">
                        <div className="flex max-w-[260px] flex-wrap gap-1">
                          {fieldSourceLabels(field).map(item => (
                            <span key={item} className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">{item}</span>
                          ))}
                        </div>
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

function buildCategoryProfileStats(schema?: PlatformSchema) {
  const profiles = schema?.category_profiles || []
  const categoryGroups = (schema?.groups || []).filter(group => String(group.id || "").startsWith("category_profile_"))
  const profileFields = profiles.flatMap(profile => profile.fields || [])
  const mergedCategoryFields = categoryGroups.flatMap(group => group.fields || [])
  const categoryFields = profileFields.length ? profileFields : mergedCategoryFields
  const explicitGaps = schema?.category_field_gaps || {}
  const categoryRecheckCount = countGapItems(explicitGaps.needs_category_recheck)
    || categoryFields.filter(field => field.evidence_state === "needs_category_recheck").length
  const editPageRecheckCount = countGapItems(explicitGaps.needs_edit_page_recheck)
    || categoryFields.filter(field => field.evidence_state === "needs_edit_page_recheck").length
  const apiRecheckCount = countGapItems(explicitGaps.needs_api_recheck)
    || categoryFields.filter(field => field.evidence_state === "needs_api_recheck").length
  return {
    profileCount: profiles.length || categoryGroups.length,
    categoryGroupCount: categoryGroups.length,
    categoryFieldCount: categoryFields.length,
    categoryRecheckCount,
    editPageRecheckCount,
    apiRecheckCount,
    totalGapCount: categoryRecheckCount + editPageRecheckCount + apiRecheckCount,
    profileLabels: (profiles.length ? profiles : categoryGroups).map(item => item.label || item.id || "类目差异字段").slice(0, 4),
  }
}

function countGapItems(items?: string[]) {
  return Array.isArray(items) ? items.length : 0
}

function buildPlatformSchemaStats(schema?: PlatformSchema) {
  const groups = schema?.groups || []
  const fields = groups.flatMap(group => group.fields || [])
  return {
    groupCount: groups.length,
    fieldCount: fields.length,
    requiredCount: fields.filter(field => field.required).length,
    recheckCount: fields.filter(field => field.evidence_state && field.evidence_state !== "observed").length,
    sourceGapCount: fields.filter(field => !field.platform_field_name && !field.miaoshou_field_name && !field.unified_field_key).length,
    enumLikeCount: fields.filter(field => /enum|select|choice|option/i.test(String(field.data_type || ""))).length,
  }
}

function fieldSourceLabels(field: PlatformFieldSchema) {
  const labels = [
    field.unified_field_key ? `统一字段：${field.unified_field_key}` : "",
    field.platform_field_name ? `平台字段：${field.platform_field_name}` : "",
    field.miaoshou_field_name ? `妙手参考：${field.miaoshou_field_name}` : "",
    field.data_type ? `类型：${field.data_type}` : "",
    field.country_difference ? `市场差异：${field.country_difference}` : "",
  ].filter(Boolean)
  return labels.length ? labels : ["来源待登记"]
}

function buildRuntimeImpactStats(active?: PlatformSchema, editable?: PlatformSchema) {
  const activeFields = new Map(flattenFields(active).map(field => [field.key || field.label || "", fieldSignature(field)]))
  const editableFields = new Map(flattenFields(editable).map(field => [field.key || field.label || "", fieldSignature(field)]))
  let addedCount = 0
  let removedCount = 0
  let changedCount = 0
  for (const [key, signature] of editableFields) {
    if (!key) continue
    if (!activeFields.has(key)) addedCount += 1
    else if (activeFields.get(key) !== signature) changedCount += 1
  }
  for (const key of activeFields.keys()) {
    if (key && !editableFields.has(key)) removedCount += 1
  }
  return { addedCount, removedCount, changedCount, hasChanges: addedCount + removedCount + changedCount > 0 }
}

function flattenFields(schema?: PlatformSchema): PlatformFieldSchema[] {
  return (schema?.groups || []).flatMap(group => group.fields || [])
}

function fieldSignature(field: PlatformFieldSchema) {
  return [
    field.key,
    field.label,
    field.required ? "required" : "optional",
    field.evidence_state || "observed",
    field.unified_field_key,
    field.data_type,
    field.platform_field_name,
    field.miaoshou_field_name,
    field.country_difference,
  ].join("|")
}
