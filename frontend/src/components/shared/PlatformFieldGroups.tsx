import { useState } from 'react'
import { Link } from 'react-router-dom'

type PlatformField = {
  key?: string
  label?: string
  required?: boolean
  placeholder?: string
  options?: unknown[]
  enum?: unknown[]
  choices?: unknown[]
  allowed_values?: unknown[]
  evidence_state?: 'observed' | 'needs_category_recheck' | 'needs_edit_page_recheck' | 'needs_api_recheck'
  unified_field_key?: string
  standard_label?: string
  data_type?: string
  country_difference?: string
  platform_field_name?: string
  miaoshou_field_name?: string
}

type PlatformFieldGroup = {
  id?: string
  label?: string
  help?: string
  fields?: PlatformField[]
}

export type PlatformRequirementsLike = {
  required_attributes?: string[]
  media?: string[]
  content?: string[]
  compliance?: string[]
  attribute_values?: Record<string, unknown>
  field_groups?: unknown[]
  object_model?: string[]
  evidence_source?: string
  category_profile?: {
    id?: string
    label?: string
    matched_category?: string
    match?: string[]
  }
  category_field_gaps?: {
    needs_category_recheck?: string[]
    needs_edit_page_recheck?: string[]
    needs_api_recheck?: string[]
  }
  evidence?: {
    needs_recheck?: string[]
  }
}

export function PlatformFieldGroupSummary({
  requirements,
  maxGroups,
  compact = false,
}: {
  requirements?: PlatformRequirementsLike
  maxGroups?: number
  compact?: boolean
}) {
  const groups = normalizeGroups(requirements)
  const shownGroups = maxGroups ? groups.slice(0, maxGroups) : groups
  const values = requirements?.attribute_values || {}
  const fallbackAttrs = requirements?.required_attributes || []

  if (groups.length === 0 && fallbackAttrs.length === 0) {
    return <p className="text-xs text-[var(--color-muted)]">平台字段组待补齐。</p>
  }

  return (
    <div className="space-y-3" aria-label="平台字段组摘要">
      {requirements?.object_model?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {requirements.object_model.map(item => (
            <span key={item} className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5 text-[11px] text-[var(--color-muted)]">
              {item}
            </span>
          ))}
        </div>
      ) : null}
      {requirements?.evidence?.needs_recheck?.length ? (
        <p className="text-[11px] text-[var(--color-warning)]">
          待补资料：{requirements.evidence.needs_recheck.join('；')}
        </p>
      ) : null}
      <CategoryProfileBadge requirements={requirements} />

      {shownGroups.length > 0 ? (
        <div className={compact ? 'space-y-2' : 'grid gap-3 md:grid-cols-2'}>
          {shownGroups.map(group => (
            <div key={group.id || group.label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5">
              <p className="text-xs font-semibold text-[var(--color-fg)]">{group.label || group.id}</p>
              {!compact && group.help && <p className="mt-1 text-[11px] leading-5 text-[var(--color-muted)]">{group.help}</p>}
              <div className="mt-2 grid grid-cols-1 gap-1.5">
                {(group.fields || []).slice(0, compact ? 4 : 10).map(field => (
                  <FieldLine key={field.key || field.label} field={field} value={values[field.key || '']} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <FallbackAttributeList attrs={fallbackAttrs} values={values} />
      )}
    </div>
  )
}

export function PlatformFieldGroupEditor({
  requirements,
  onChange,
  highlightedFieldKey,
}: {
  requirements?: PlatformRequirementsLike
  onChange: (next: PlatformRequirementsLike) => void
  highlightedFieldKey?: string
}) {
  const groups = normalizeGroups(requirements)
  const values = requirements?.attribute_values || {}
  const fallbackAttrs = requirements?.required_attributes || []
  const normalizedHighlightedFieldKey = highlightedFieldKey?.trim() || ''
  const [fieldSearch, setFieldSearch] = useState('')
  const [fieldFilter, setFieldFilter] = useState<'all' | 'missing' | 'recheck'>('all')
  const allFields = groups.flatMap(group => group.fields || [])
  const visibleGroups = groups.map(group => ({
    ...group,
    fields: (group.fields || []).filter(field => fieldMatchesFocus(field, values, fieldSearch, fieldFilter)),
  })).filter(group => group.fields.length > 0)
  const visibleFallbackAttrs = fallbackAttrs.filter(attr => fallbackAttrMatchesFocus(attr, values, fieldSearch, fieldFilter))
  const requiredFieldCount = allFields.filter(field => field.required).length || fallbackAttrs.length
  const filledFieldCount = allFields.length
    ? allFields.filter(field => hasFieldValue(field, values)).length
    : fallbackAttrs.filter(attr => stringValue(values[attr]).trim()).length
  const missingRequiredFields = allFields.filter(field => field.required && !hasFieldValue(field, values)).map(field => field.label || field.key || '未命名字段')
  const recheckCount = Object.values(requirements?.category_field_gaps || {}).reduce((total, items) => total + (Array.isArray(items) ? items.length : 0), 0) + (requirements?.evidence?.needs_recheck?.length || 0)
  const categoryProfileSummary = buildCategoryProfileSummary(requirements, groups, allFields)

  const updateValue = (key: string, value: string) => {
    onChange({
      ...(requirements || {}),
      attribute_values: { ...values, [key]: value },
    })
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <p className="text-[11px] font-semibold text-[var(--color-fg)]">平台属性编辑</p>
        <CategoryProfileRuntimeSummary summary={categoryProfileSummary} />
        <FieldReadinessStrip total={requiredFieldCount} filled={filledFieldCount} missing={fallbackAttrs.filter(attr => !stringValue(values[attr]).trim())} recheckCount={recheckCount} />
        <FieldFocusToolbar search={fieldSearch} onSearch={setFieldSearch} filter={fieldFilter} onFilter={setFieldFilter} total={fallbackAttrs.length} visible={visibleFallbackAttrs.length} />
        {normalizedHighlightedFieldKey ? (
          <p
            data-ui="platform-field-highlight-target"
            className="mt-2 rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-2.5 py-2 text-[11px] font-medium text-[var(--color-primary)]"
          >
            已从批量刊登定位字段：{normalizedHighlightedFieldKey}
          </p>
        ) : null}
        <div className="mt-2 grid grid-cols-2 xl:grid-cols-4 gap-2">
          {visibleFallbackAttrs.slice(0, 12).map(attr => {
            const highlighted = matchesHighlightedField({ key: attr, label: attr }, normalizedHighlightedFieldKey)
            return (
              <label
                key={attr}
                className={highlighted
                  ? 'rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary-light)] p-2 text-[11px] font-medium text-[var(--color-primary)]'
                  : 'text-[11px] text-[var(--color-muted)]'
                }
              >
                {attr}
                <input
                  value={stringValue(values[attr])}
                  onChange={event => updateValue(attr, event.target.value)}
                  className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs text-[var(--color-fg)]"
                />
              </label>
            )
          })}
          {visibleFallbackAttrs.length === 0 ? <p className="col-span-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-muted)]">当前筛选下没有字段。</p> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3" aria-label="平台字段组编辑">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold text-[var(--color-fg)]">平台字段组编辑</p>
          {requirements?.evidence_source && <p className="mt-1 text-[11px] text-[var(--color-muted)]">{requirements.evidence_source}</p>}
          {requirements?.evidence?.needs_recheck?.length ? (
            <p className="mt-1 text-[11px] text-[var(--color-warning)]">待补资料：{requirements.evidence.needs_recheck.join('；')}</p>
          ) : null}
          {normalizedHighlightedFieldKey ? (
            <p
              data-ui="platform-field-highlight-target"
              className="mt-2 rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-2.5 py-2 text-[11px] font-medium text-[var(--color-primary)]"
            >
              已从批量刊登定位字段：{normalizedHighlightedFieldKey}
            </p>
          ) : null}
          <CategoryProfileBadge requirements={requirements} />
        </div>
      </div>
      <CategoryProfileRuntimeSummary summary={categoryProfileSummary} />
      <FieldReadinessStrip total={requiredFieldCount} filled={filledFieldCount} missing={missingRequiredFields} recheckCount={recheckCount} />
      <FieldFocusToolbar search={fieldSearch} onSearch={setFieldSearch} filter={fieldFilter} onFilter={setFieldFilter} total={allFields.length} visible={visibleGroups.reduce((total, group) => total + group.fields.length, 0)} />
      <FieldEvidenceAuditSummary fields={allFields} requirements={requirements} />
      {requirements?.object_model?.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {requirements.object_model.map(item => <span key={item} className="rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-[11px] text-[var(--color-muted)]">{item}</span>)}
        </div>
      ) : null}
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
        {visibleGroups.map(group => {
          const stats = groupFieldStats(group.fields, values)
          return (
          <div key={group.id || group.label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2" data-ui="platform-field-group-readiness-summary">
              <p className="text-xs font-semibold text-[var(--color-fg)]">{group.label || group.id}</p>
              <div className="flex flex-wrap gap-1 text-[10px]">
                <span className={stats.missing === 0 && stats.required > 0 ? 'rounded-full bg-[var(--color-success-light)] px-2 py-0.5 text-[var(--color-success)]' : 'rounded-full bg-[var(--color-warning-light)] px-2 py-0.5 text-[var(--color-warning)]'}>必填 {stats.filled}/{stats.required}</span>
                <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[var(--color-muted)]">待补 {stats.missing}</span>
                <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[var(--color-muted)]">复核 {stats.recheck}</span>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              {(group.fields || []).map(field => {
                const key = field.key || field.label || ''
                const highlighted = matchesHighlightedField(field, normalizedHighlightedFieldKey)
                return (
                  <label
                    key={key}
                    className={highlighted
                      ? 'rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary-light)] p-2 text-[11px] font-medium text-[var(--color-primary)]'
                      : 'text-[11px] text-[var(--color-muted)]'
                    }
                  >
                    {field.label || key}{field.required ? <span className="text-[var(--color-primary)]"> *</span> : null}
                    {field.evidence_state ? <span className="ml-1 text-[var(--color-warning)]">({evidenceStateLabel(field.evidence_state)})</span> : null}
                    <FieldMetaHint field={field} />
                    <FieldRequirementHint field={field} hasValue={hasFieldValue(field, values)} />
                    <FieldValueControl field={field} value={stringValue(values[key])} onChange={value => updateValue(key, value)} />
                  </label>
                )
              })}
            </div>
          </div>
          )
        })}
        {visibleGroups.length === 0 ? <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-3 text-xs text-[var(--color-muted)]">当前筛选下没有字段。请清空搜索或切回“全部字段”。</p> : null}
      </div>
    </div>
  )
}

function matchesHighlightedField(field: PlatformField, highlightedFieldKey: string) {
  if (!highlightedFieldKey) return false
  return [
    field.key,
    field.label,
    field.unified_field_key,
    field.standard_label,
    field.platform_field_name,
    field.miaoshou_field_name,
  ].filter(Boolean).some(value => String(value) === highlightedFieldKey)
}

function buildCategoryProfileSummary(requirements: PlatformRequirementsLike | undefined, groups: PlatformFieldGroup[], fields: PlatformField[]) {
  const profile = requirements?.category_profile
  const gaps = requirements?.category_field_gaps || {}
  const gapCount = Object.values(gaps).reduce((total, items) => total + (Array.isArray(items) ? items.length : 0), 0)
  const matchedGroupCount = groups.filter(group => {
    const text = `${group.id || ''} ${group.label || ''} ${group.help || ''}`.toLowerCase()
    return /category|类目|profile/.test(text)
  }).length
  const categoryFieldCount = fields.filter(field => {
    const text = [
      field.key,
      field.label,
      field.standard_label,
      field.unified_field_key,
      field.platform_field_name,
      field.miaoshou_field_name,
      field.country_difference,
      field.evidence_state,
    ].filter(Boolean).join(' ').toLowerCase()
    return /category|类目|category_recheck/.test(text)
  }).length
  const sourceMissingCount = fields.filter(field => !field.platform_field_name && !field.miaoshou_field_name && !field.unified_field_key).length
  const matched = Boolean(profile?.id || profile?.label || profile?.matched_category || matchedGroupCount > 0)
  return {
    matched,
    profileLabel: profile?.label || profile?.id || '',
    matchedCategory: profile?.matched_category || '',
    matchRules: profile?.match || [],
    matchedGroupCount,
    categoryFieldCount,
    gapCount,
    sourceMissingCount,
    evidenceSource: requirements?.evidence_source || '',
    fallbackAttrCount: requirements?.required_attributes?.length || 0,
    governanceHref: `/settings/fields?focus=platform_field_groups${profile?.id ? `&profile=${encodeURIComponent(profile.id)}` : ''}${profile?.matched_category ? `&category=${encodeURIComponent(profile.matched_category)}` : ''}`,
  }
}

function CategoryProfileRuntimeSummary({ summary }: { summary: ReturnType<typeof buildCategoryProfileSummary> }) {
  const headline = summary.matched
    ? `已命中类目字段 Profile：${summary.profileLabel || summary.matchedCategory || '专属字段包'}`
    : '当前类目未命中专属字段 Profile，使用平台通用字段组'
  const help = summary.matched
    ? '当前字段来自已发布字段包，发布前仍需按待复核字段补齐类目、编辑页或接口资料。'
    : '需在设置中心补齐该平台/类目的字段包并发布后，Listing 编辑器才会切换为专属字段。'
  return (
    <div
      className={summary.matched
        ? 'mt-3 rounded-xl border border-[var(--color-success)] bg-[var(--color-success-light)] p-2.5 text-[11px]'
        : 'mt-3 rounded-xl border border-[var(--color-warning)] bg-[var(--color-warning-light)] p-2.5 text-[11px]'
      }
      data-ui="platform-category-profile-hit-summary"
      aria-label="平台类目字段Profile命中摘要"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={summary.matched ? 'font-semibold text-[var(--color-success)]' : 'font-semibold text-[var(--color-warning)]'}>{headline}</span>
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[var(--color-muted)]">
          字段来源：{summary.evidenceSource || '待登记'}
        </span>
      </div>
      <p className="mt-1 leading-5 text-[var(--color-muted)]">{help}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Link
          to={summary.governanceHref}
          className="inline-flex rounded-full border border-[var(--color-primary)] bg-[var(--color-surface)] px-3 py-1 text-[11px] font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary-light)]"
          data-ui="platform-category-profile-governance-link"
        >
          去设置中心补字段包
        </Link>
        <span className="text-[11px] text-[var(--color-muted)]">从当前字段缺口下钻到平台字段组 Schema 审批，不在本页伪造字段。</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {summary.matchedCategory ? <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[var(--color-muted)]">匹配类目：{summary.matchedCategory}</span> : null}
        {summary.matchRules.length ? <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[var(--color-muted)]">命中规则 {summary.matchRules.length}</span> : null}
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[var(--color-muted)]">类目字段组 {summary.matchedGroupCount}</span>
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[var(--color-muted)]">类目字段 {summary.categoryFieldCount}</span>
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[var(--color-warning)]">待复核 {summary.gapCount}</span>
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[var(--color-danger)]">来源缺口 {summary.sourceMissingCount}</span>
        {!summary.matched && summary.fallbackAttrCount ? <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[var(--color-muted)]">通用字段 {summary.fallbackAttrCount}</span> : null}
      </div>
    </div>
  )
}

function FieldReadinessStrip({ total, filled, missing, recheckCount }: { total: number; filled: number; missing: string[]; recheckCount: number }) {
  const safeTotal = Math.max(total, 0)
  const ready = safeTotal > 0 && filled >= safeTotal && missing.length === 0
  return (
    <div className="mt-3 grid gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-[11px] md:grid-cols-3" data-ui="platform-field-readiness-strip" aria-label="平台字段填写就绪摘要">
      <span className={ready ? 'rounded-lg bg-[var(--color-success-light)] px-2 py-1 text-[var(--color-success)]' : 'rounded-lg bg-[var(--color-warning-light)] px-2 py-1 text-[var(--color-warning)]'}>必填字段 {filled}/{safeTotal}</span>
      <span className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-[var(--color-muted)]">待补字段 {missing.slice(0, 4).join('、') || '无'}</span>
      <span className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-[var(--color-muted)]">待复核 {recheckCount}</span>
    </div>
  )
}

function FieldFocusToolbar({
  search,
  onSearch,
  filter,
  onFilter,
  total,
  visible,
}: {
  search: string
  onSearch: (value: string) => void
  filter: 'all' | 'missing' | 'recheck'
  onFilter: (value: 'all' | 'missing' | 'recheck') => void
  total: number
  visible: number
}) {
  const filters: Array<['all' | 'missing' | 'recheck', string]> = [['all', '全部字段'], ['missing', '只看待补'], ['recheck', '只看复核']]
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2" data-ui="platform-field-focus-toolbar" aria-label="平台字段搜索与缺口聚焦">
      <input
        value={search}
        onChange={event => onSearch(event.target.value)}
        placeholder="搜索字段、平台字段名、标准字段或类型"
        className="min-w-[220px] flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-fg)] outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)]"
        data-ui="platform-field-search-input"
      />
      <div className="flex flex-wrap gap-1" data-ui="platform-field-focus-filter">
        {filters.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onFilter(value)}
            className={filter === value ? 'rounded-full border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)]' : 'rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-muted)]'}
          >
            {label}
          </button>
        ))}
      </div>
      <span className="rounded-full border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-muted)]" data-ui="platform-field-visible-count">显示 {visible}/{total}</span>
    </div>
  )
}

function FieldEvidenceAuditSummary({ fields, requirements }: { fields: PlatformField[]; requirements?: PlatformRequirementsLike }) {
  const stats = buildFieldEvidenceStats(fields)
  if (!fields.length && !requirements?.evidence_source && !requirements?.category_profile) return null
  const items = [
    ['已观察字段', stats.observed, 'var(--color-success)'],
    ['待类目资料', stats.needsCategoryRecheck, 'var(--color-warning)'],
    ['待编辑页资料', stats.needsEditPageRecheck, 'var(--color-warning)'],
    ['待接口资料', stats.needsApiRecheck, 'var(--color-warning)'],
    ['来源缺口', stats.missingSource, 'var(--color-danger)'],
  ] as const
  return (
    <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5 text-[11px]" data-ui="platform-field-evidence-summary" aria-label="平台字段来源与资料摘要">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-[var(--color-fg)]">字段来源与资料</span>
        {requirements?.evidence_source ? <span className="text-[var(--color-muted)]">来源：{requirements.evidence_source}</span> : <span className="text-[var(--color-warning)]">字段包来源待登记</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map(([label, count, color]) => (
          <span key={label} className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5" style={{ color }}>
            {label} {count}
          </span>
        ))}
      </div>
    </div>
  )
}

function FieldMetaHint({ field }: { field: PlatformField }) {
  const details = [
    field.unified_field_key ? ['统一字段', field.standard_label || field.unified_field_key] : null,
    field.data_type ? ['类型', field.data_type] : null,
    field.platform_field_name ? ['平台字段', field.platform_field_name] : null,
    field.miaoshou_field_name ? ['妙手参考', field.miaoshou_field_name] : null,
    field.country_difference ? ['市场差异', field.country_difference] : null,
  ].filter((item): item is string[] => Boolean(item))
  if (!details.length) return null
  return (
    <span className="mt-1 flex flex-wrap gap-1" data-ui="platform-field-source-chip">
      {details.map(([label, value]) => (
        <span key={`${label}-${value}`} className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
          {label}：{value}
        </span>
      ))}
    </span>
  )
}

function fieldMatchesFocus(field: PlatformField, values: Record<string, unknown>, search: string, filter: 'all' | 'missing' | 'recheck') {
  const text = [field.key, field.label, field.standard_label, field.unified_field_key, field.platform_field_name, field.miaoshou_field_name, field.data_type].filter(Boolean).join(' ').toLowerCase()
  const query = search.trim().toLowerCase()
  if (query && !text.includes(query)) return false
  if (filter === 'missing') return Boolean(field.required && !hasFieldValue(field, values))
  if (filter === 'recheck') return Boolean(field.evidence_state && field.evidence_state !== 'observed')
  return true
}

function fallbackAttrMatchesFocus(attr: string, values: Record<string, unknown>, search: string, filter: 'all' | 'missing' | 'recheck') {
  const query = search.trim().toLowerCase()
  if (query && !attr.toLowerCase().includes(query)) return false
  if (filter === 'missing') return !stringValue(values[attr]).trim()
  if (filter === 'recheck') return false
  return true
}

function groupFieldStats(fields: PlatformField[], values: Record<string, unknown>) {
  const requiredFields = fields.filter(field => field.required)
  const filled = requiredFields.filter(field => hasFieldValue(field, values)).length
  const recheck = fields.filter(field => field.evidence_state && field.evidence_state !== 'observed').length
  return { required: requiredFields.length, filled, missing: Math.max(requiredFields.length - filled, 0), recheck }
}

function buildFieldEvidenceStats(fields: PlatformField[]) {
  return fields.reduce((stats, field) => {
    if (field.evidence_state === 'needs_category_recheck') stats.needsCategoryRecheck += 1
    else if (field.evidence_state === 'needs_edit_page_recheck') stats.needsEditPageRecheck += 1
    else if (field.evidence_state === 'needs_api_recheck') stats.needsApiRecheck += 1
    else stats.observed += 1
    if (!field.platform_field_name && !field.miaoshou_field_name && !field.unified_field_key) stats.missingSource += 1
    return stats
  }, { observed: 0, needsCategoryRecheck: 0, needsEditPageRecheck: 0, needsApiRecheck: 0, missingSource: 0 })
}

function FieldRequirementHint({ field, hasValue }: { field: PlatformField; hasValue: boolean }) {
  if (!field.required && !field.evidence_state) return null
  return (
    <span className={field.required && !hasValue ? 'mt-1 block text-[10px] font-semibold text-[var(--color-warning)]' : 'mt-1 block text-[10px] text-[var(--color-muted)]'} data-ui="platform-field-requirement-hint">
      {field.required ? (hasValue ? '必填已填写' : '必填待补') : '建议复核'}{field.evidence_state ? ` / ${evidenceStateLabel(field.evidence_state)}` : ''}
    </span>
  )
}

function FieldValueControl({ field, value, onChange }: { field: PlatformField; value: string; onChange: (value: string) => void }) {
  const type = normalizeFieldType(field)
  const enumOptions = fieldEnumOptions(field)
  const commonClass = 'mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-fg)] outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)]'
  const placeholder = field.placeholder || field.label || field.key || ''
  if (enumOptions.length) {
    return (
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className={commonClass}
        data-ui="platform-field-dynamic-input"
        data-field-input-type="enum"
        aria-label={`${field.label || field.key}选项字段`}
      >
        <option value="">待选择</option>
        {enumOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    )
  }
  if (type === 'boolean') {
    return (
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className={commonClass}
        data-ui="platform-field-dynamic-input"
        data-field-input-type="boolean"
        aria-label={`${field.label || field.key}是否字段`}
      >
        <option value="">待选择</option>
        <option value="true">是</option>
        <option value="false">否</option>
      </select>
    )
  }
  if (type === 'number') {
    return (
      <input
        type="number"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className={commonClass}
        data-ui="platform-field-dynamic-input"
        data-field-input-type="number"
      />
    )
  }
  if (type === 'long_text') {
    return (
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        className={`${commonClass} min-h-20 resize-y leading-5`}
        data-ui="platform-field-dynamic-input"
        data-field-input-type="long_text"
      />
    )
  }
  return (
    <input
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      className={commonClass}
      data-ui="platform-field-dynamic-input"
      data-field-input-type="text"
    />
  )
}

function normalizeFieldType(field: PlatformField) {
  const raw = String(field.data_type || field.key || field.label || '').toLowerCase()
  if (/bool|boolean|是否|yes_no|true_false/.test(raw)) return 'boolean'
  if (/number|numeric|integer|decimal|float|price|weight|length|width|height|库存|价格|重量|尺寸|数量/.test(raw)) return 'number'
  if (/textarea|long_text|rich_text|description|desc|详情|描述|说明/.test(raw)) return 'long_text'
  return 'text'
}

function fieldEnumOptions(field: PlatformField) {
  const source = [field.options, field.enum, field.choices, field.allowed_values].find(Array.isArray) as unknown[] | undefined
  return (source || []).map(item => {
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>
      const value = stringValue(record.value ?? record.id ?? record.key ?? record.label ?? record.name)
      const label = stringValue(record.label ?? record.name ?? record.value ?? record.id ?? record.key)
      return value ? { value, label: label || value } : null
    }
    const value = stringValue(item)
    return value ? { value, label: value } : null
  }).filter((item): item is { value: string; label: string } => Boolean(item))
}

function CategoryProfileBadge({ requirements }: { requirements?: PlatformRequirementsLike }) {
  const profile = requirements?.category_profile
  if (!profile) return null
  const gapCount = Object.values(requirements?.category_field_gaps || {}).reduce((total, items) => total + (Array.isArray(items) ? items.length : 0), 0)
  return (
    <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-2 text-[11px]" aria-label="类目差异字段组">
      <span className="font-semibold text-[var(--color-fg)]">类目差异字段组：{profile.label || profile.id || '已匹配'}</span>
      {profile.matched_category && <span className="ml-2 text-[var(--color-muted)]">匹配类目：{profile.matched_category}</span>}
      <span className="ml-2 text-[var(--color-warning)]">待复核字段 {gapCount}</span>
    </div>
  )
}

function FieldLine({ field, value }: { field: PlatformField; value: unknown }) {
  const text = stringValue(value)
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-[var(--color-muted)]">
        {field.label || field.key}{field.required ? ' *' : ''}
        {field.evidence_state ? ` (${evidenceStateLabel(field.evidence_state)})` : ''}
      </span>
      <span className={text ? 'truncate text-[var(--color-fg)]' : 'text-[var(--color-warning)]'}>{text || '待补'}</span>
    </div>
  )
}

function FallbackAttributeList({ attrs, values }: { attrs: string[]; values: Record<string, unknown> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {attrs.map(attr => (
        <span key={attr} className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[11px] text-[var(--color-muted)]">
          {attr}: {stringValue(values[attr]) || '待补'}
        </span>
      ))}
    </div>
  )
}

function normalizeGroups(requirements?: PlatformRequirementsLike): PlatformFieldGroup[] {
  return (requirements?.field_groups || [])
    .filter((item): item is PlatformFieldGroup => Boolean(item && typeof item === 'object'))
    .map(group => ({
      ...group,
      fields: Array.isArray(group.fields) ? group.fields.filter(field => field && typeof field === 'object') : [],
    }))
}

function stringValue(value: unknown) {
  if (Array.isArray(value)) return value.join(', ')
  if (value && typeof value === 'object') return JSON.stringify(value)
  return value == null ? '' : String(value)
}

function hasFieldValue(field: PlatformField, values: Record<string, unknown>) {
  return Boolean(stringValue(values[field.key || field.label || '']).trim())
}

function evidenceStateLabel(state: PlatformField['evidence_state']) {
  if (state === 'needs_category_recheck') return '待类目资料复核'
  if (state === 'needs_edit_page_recheck') return '待编辑页资料复核'
  if (state === 'needs_api_recheck') return '待接口/账单资料复核'
  return '已观察'
}
