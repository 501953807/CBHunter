import { Layers3, RefreshCw } from 'lucide-react'
import { CardContent, CardHeader } from '../../components/ui/Card'
import {
  CategoryProfileSummaryPanel,
  CategoryTreeVersionSummary,
  CurrentFieldPackageSummary,
  FieldPackageCoverage,
  RuntimeImpactSummary,
} from './PlatformFieldGroupGovernanceSummaryParts'
import { EditableFieldTable } from './PlatformFieldGroupGovernanceTableParts'

export type PlatformSchema = {
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

export type PlatformFieldShape = {
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

export type PlatformFieldSchema = NonNullable<NonNullable<PlatformSchema['groups']>[number]['fields']>[number]

export type CategoryTreePlatformSummary = {
  platform?: string
  profile_count?: number
  category_field_count?: number
  total_recheck_count?: number
  match_rule_count?: number
  profile_labels?: string[]
}

export type CategoryTreeSummary = {
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

export const PLATFORM_LABELS: Record<string, string> = {
  shopee: 'Shopee',
  tiktok: 'TikTok Shop',
  temu: 'TEMU',
}

export interface PlatformStats {
  platform: string
  groupCount: number
  fieldCount: number
  requiredCount: number
  recheckCount: number
  sourceGapCount: number
  enumLikeCount: number
}

export interface RuntimeImpactStats {
  platform: string
  addedCount: number
  removedCount: number
  changedCount: number
  hasChanges: boolean
}

export interface CategoryProfileStats {
  platform: string
  profileCount: number
  categoryGroupCount: number
  categoryFieldCount: number
  categoryRecheckCount: number
  editPageRecheckCount: number
  apiRecheckCount: number
  totalGapCount: number
  profileLabels: string[]
}

export function PlatformFieldGovernanceHeader({
  activeVersion,
  draftVersion,
  dirty,
  historyCount,
  loading,
  onRefresh,
}: {
  activeVersion: string
  draftVersion: string
  dirty: boolean
  historyCount: number
  loading: boolean
  onRefresh: () => void
}) {
  return (
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
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-fg)] disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>
      <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
        <VersionTile label="生效版" value={String(activeVersion)} />
        <VersionTile label="草稿" value={`${draftVersion || '无草稿'} ${dirty ? '· 未保存' : ''}`} />
        <VersionTile label="历史版本" value={`${historyCount} 个归档`} />
      </div>
    </CardHeader>
  )
}

function VersionTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <p className="text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 font-semibold text-[var(--color-fg)]">{value}</p>
    </div>
  )
}

export function PlatformFieldGovernanceContent({
  activePlatform,
  categoryProfileStats,
  categoryTreeSummary,
  changeNote,
  currentCategoryStats,
  currentRuntimeImpact,
  currentSchema,
  currentStats,
  dirty,
  draftVersion,
  fieldPackageStats,
  focusCategory,
  focusProfile,
  fromRuntimeFieldEditor,
  onChangeNote,
  onPlatformSelect,
  onPublishDraft,
  onSaveDraft,
  onUpdateField,
  platformKeys,
  runtimeImpactStats,
  saving,
  statusText,
}: {
  activePlatform: string
  categoryProfileStats: CategoryProfileStats[]
  categoryTreeSummary: CategoryTreeSummary | null
  changeNote: string
  currentCategoryStats: CategoryProfileStats
  currentRuntimeImpact: RuntimeImpactStats
  currentSchema: PlatformSchema
  currentStats: PlatformStats
  dirty: boolean
  draftVersion: string
  fieldPackageStats: PlatformStats[]
  focusCategory: string
  focusProfile: string
  fromRuntimeFieldEditor: boolean
  onChangeNote: (value: string) => void
  onPlatformSelect: (platform: string) => void
  onPublishDraft: () => void
  onSaveDraft: () => void
  onUpdateField: (groupIndex: number, fieldIndex: number, fieldPatch: Record<string, unknown>) => void
  platformKeys: string[]
  runtimeImpactStats: RuntimeImpactStats[]
  saving: boolean
  statusText: string
}) {
  return (
    <CardContent>
      {fromRuntimeFieldEditor ? <DeepLinkContext focusCategory={focusCategory} focusProfile={focusProfile} /> : null}
      <FieldPackageCoverage activePlatform={activePlatform} stats={fieldPackageStats} onPlatformSelect={onPlatformSelect} />
      <CurrentFieldPackageSummary activePlatform={activePlatform} currentStats={currentStats} />
      <RuntimeImpactSummary
        activePlatform={activePlatform}
        currentRuntimeImpact={currentRuntimeImpact}
        runtimeImpactStats={runtimeImpactStats}
        onPlatformSelect={onPlatformSelect}
      />
      <CategoryProfileSummaryPanel
        activePlatform={activePlatform}
        categoryProfileStats={categoryProfileStats}
        currentCategoryStats={currentCategoryStats}
        onPlatformSelect={onPlatformSelect}
      />
      {categoryTreeSummary ? <CategoryTreeVersionSummary categoryTreeSummary={categoryTreeSummary} /> : null}
      <GovernanceActionBar
        activePlatform={activePlatform}
        changeNote={changeNote}
        dirty={dirty}
        draftVersion={draftVersion}
        onChangeNote={onChangeNote}
        onPlatformSelect={onPlatformSelect}
        onPublishDraft={onPublishDraft}
        onSaveDraft={onSaveDraft}
        platformKeys={platformKeys}
        saving={saving}
      />
      {statusText ? <p className="mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-muted)]">{statusText}</p> : null}
      <EditableFieldTable currentSchema={currentSchema} onUpdateField={onUpdateField} />
    </CardContent>
  )
}

function DeepLinkContext({ focusCategory, focusProfile }: { focusCategory: string; focusProfile: string }) {
  return (
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
        {focusProfile ? `目标 Profile：${focusProfile}。` : ''}
        {focusCategory ? `目标类目：${focusCategory}。` : ''}
        请在草稿中补齐类目字段组、字段来源、数据类型和待复核状态，保存草稿并发布后才会进入内容工厂、商品详情和批量刊登运行时字段表单。
      </p>
    </div>
  )
}

function GovernanceActionBar({
  activePlatform,
  changeNote,
  dirty,
  draftVersion,
  onChangeNote,
  onPlatformSelect,
  onPublishDraft,
  onSaveDraft,
  platformKeys,
  saving,
}: {
  activePlatform: string
  changeNote: string
  dirty: boolean
  draftVersion: string
  onChangeNote: (value: string) => void
  onPlatformSelect: (platform: string) => void
  onPublishDraft: () => void
  onSaveDraft: () => void
  platformKeys: string[]
  saving: boolean
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {platformKeys.map(platform => (
        <button
          key={platform}
          onClick={() => onPlatformSelect(platform)}
          className={`rounded-lg border px-3 py-2 text-xs font-semibold ${activePlatform === platform ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-muted)]'}`}
        >
          {PLATFORM_LABELS[platform]}
        </button>
      ))}
      <input
        value={changeNote}
        onChange={event => onChangeNote(event.target.value)}
        placeholder="Schema 变更说明，例如：补齐 TEMU 包装字段"
        className="min-w-[260px] flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]"
      />
      <button onClick={onSaveDraft} disabled={saving || platformKeys.length === 0} className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-[var(--color-primary-text)] disabled:opacity-50">
        保存 Schema 草稿
      </button>
      <button onClick={onPublishDraft} disabled={saving || dirty || !draftVersion} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-fg)] disabled:opacity-50">
        发布 Schema
      </button>
    </div>
  )
}

export function buildCategoryProfileStats(schema?: PlatformSchema) {
  const profiles = schema?.category_profiles || []
  const categoryGroups = (schema?.groups || []).filter(group => String(group.id || '').startsWith('category_profile_'))
  const profileFields = profiles.flatMap(profile => profile.fields || [])
  const mergedCategoryFields = categoryGroups.flatMap(group => group.fields || [])
  const categoryFields = profileFields.length ? profileFields : mergedCategoryFields
  const explicitGaps = schema?.category_field_gaps || {}
  const categoryRecheckCount = countGapItems(explicitGaps.needs_category_recheck)
    || categoryFields.filter(field => field.evidence_state === 'needs_category_recheck').length
  const editPageRecheckCount = countGapItems(explicitGaps.needs_edit_page_recheck)
    || categoryFields.filter(field => field.evidence_state === 'needs_edit_page_recheck').length
  const apiRecheckCount = countGapItems(explicitGaps.needs_api_recheck)
    || categoryFields.filter(field => field.evidence_state === 'needs_api_recheck').length
  return {
    profileCount: profiles.length || categoryGroups.length,
    categoryGroupCount: categoryGroups.length,
    categoryFieldCount: categoryFields.length,
    categoryRecheckCount,
    editPageRecheckCount,
    apiRecheckCount,
    totalGapCount: categoryRecheckCount + editPageRecheckCount + apiRecheckCount,
    profileLabels: (profiles.length ? profiles : categoryGroups).map(item => item.label || item.id || '类目差异字段').slice(0, 4),
  }
}

export function buildPlatformSchemaStats(schema?: PlatformSchema) {
  const groups = schema?.groups || []
  const fields = groups.flatMap(group => group.fields || [])
  return {
    groupCount: groups.length,
    fieldCount: fields.length,
    requiredCount: fields.filter(field => field.required).length,
    recheckCount: fields.filter(field => field.evidence_state && field.evidence_state !== 'observed').length,
    sourceGapCount: fields.filter(field => !field.platform_field_name && !field.miaoshou_field_name && !field.unified_field_key).length,
    enumLikeCount: fields.filter(field => /enum|select|choice|option/i.test(String(field.data_type || ''))).length,
  }
}

export function buildRuntimeImpactStats(active?: PlatformSchema, editable?: PlatformSchema) {
  const activeFields = new Map(flattenFields(active).map(field => [field.key || field.label || '', fieldSignature(field)]))
  const editableFields = new Map(flattenFields(editable).map(field => [field.key || field.label || '', fieldSignature(field)]))
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

function countGapItems(items?: string[]) {
  return Array.isArray(items) ? items.length : 0
}

function flattenFields(schema?: PlatformSchema): PlatformFieldSchema[] {
  return (schema?.groups || []).flatMap(group => group.fields || [])
}

function fieldSignature(field: PlatformFieldSchema) {
  return [
    field.key,
    field.label,
    field.required ? 'required' : 'optional',
    field.evidence_state || 'observed',
    field.unified_field_key,
    field.data_type,
    field.platform_field_name,
    field.miaoshou_field_name,
    field.country_difference,
  ].join('|')
}
