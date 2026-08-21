import { useState } from 'react'
import {
  buildCategoryProfileSummary,
  CategoryProfileBadge,
  CategoryProfileRuntimeSummary,
  evidenceStateLabel,
  fallbackAttrMatchesFocus,
  FallbackAttributeList,
  FieldEvidenceAuditSummary,
  FieldFocusToolbar,
  FieldLine,
  FieldMetaHint,
  FieldReadinessStrip,
  FieldRequirementHint,
  FieldValueControl,
  fieldMatchesFocus,
  groupFieldStats,
  hasFieldValue,
  matchesHighlightedField,
  normalizeGroups,
  stringValue,
} from './PlatformFieldGroupsParts'
import type { PlatformRequirementsLike } from './PlatformFieldGroupsParts'

export type { PlatformRequirementsLike } from './PlatformFieldGroupsParts'

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
