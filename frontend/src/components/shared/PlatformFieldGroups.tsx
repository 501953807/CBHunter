type PlatformField = {
  key?: string
  label?: string
  required?: boolean
  placeholder?: string
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
          待补证：{requirements.evidence.needs_recheck.join('；')}
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
        {normalizedHighlightedFieldKey ? (
          <p
            data-ui="platform-field-highlight-target"
            className="mt-2 rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-2.5 py-2 text-[11px] font-medium text-[var(--color-primary)]"
          >
            已从批量刊登定位字段：{normalizedHighlightedFieldKey}
          </p>
        ) : null}
        <div className="mt-2 grid grid-cols-2 xl:grid-cols-4 gap-2">
          {fallbackAttrs.slice(0, 12).map(attr => {
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
            <p className="mt-1 text-[11px] text-[var(--color-warning)]">待补证：{requirements.evidence.needs_recheck.join('；')}</p>
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
      {requirements?.object_model?.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {requirements.object_model.map(item => <span key={item} className="rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-[11px] text-[var(--color-muted)]">{item}</span>)}
        </div>
      ) : null}
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
        {groups.map(group => (
          <div key={group.id || group.label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5">
            <p className="text-xs font-semibold text-[var(--color-fg)]">{group.label || group.id}</p>
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
                    <input
                      value={stringValue(values[key])}
                      onChange={event => updateValue(key, event.target.value)}
                      placeholder={field.placeholder || field.label || key}
                      className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
                    />
                  </label>
                )
              })}
            </div>
          </div>
        ))}
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

function FieldMetaHint({ field }: { field: PlatformField }) {
  const details = [
    field.unified_field_key ? `标准：${field.standard_label || field.unified_field_key}` : '',
    field.data_type ? `类型：${field.data_type}` : '',
    field.platform_field_name ? `平台：${field.platform_field_name}` : '',
    field.miaoshou_field_name ? `妙手：${field.miaoshou_field_name}` : '',
    field.country_difference ? `差异：${field.country_difference}` : '',
  ].filter(Boolean)
  if (!details.length) return null
  return <span className="mt-0.5 block truncate text-[10px] text-[var(--color-muted)]">{details.join(' / ')}</span>
}

function CategoryProfileBadge({ requirements }: { requirements?: PlatformRequirementsLike }) {
  const profile = requirements?.category_profile
  if (!profile) return null
  const gapCount = Object.values(requirements?.category_field_gaps || {}).reduce((total, items) => total + (Array.isArray(items) ? items.length : 0), 0)
  return (
    <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-2 text-[11px]" aria-label="类目差异字段组">
      <span className="font-semibold text-[var(--color-fg)]">类目差异字段组：{profile.label || profile.id || '已匹配'}</span>
      {profile.matched_category && <span className="ml-2 text-[var(--color-muted)]">匹配类目：{profile.matched_category}</span>}
      <span className="ml-2 text-[var(--color-warning)]">补证字段 {gapCount}</span>
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

function evidenceStateLabel(state: PlatformField['evidence_state']) {
  if (state === 'needs_category_recheck') return '待类目补证'
  if (state === 'needs_edit_page_recheck') return '待编辑页补证'
  if (state === 'needs_api_recheck') return '待接口/账单补证'
  return '已观察'
}
