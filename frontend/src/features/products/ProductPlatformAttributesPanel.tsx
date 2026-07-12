import type { DictPlatform, PlatformProductField, PlatformProductFieldGroups } from '../../api/config'

export type PlatformRequirementsByPlatform = Record<string, {
  required_attributes?: string[]
  attribute_values?: Record<string, unknown>
  media?: string[]
  content?: string[]
  compliance?: string[]
  field_groups?: unknown[]
  object_model?: string[]
  evidence_source?: string
  evidence?: PlatformProductFieldGroups[string]['evidence']
}>

interface Props {
  platforms: DictPlatform[]
  fieldGroups?: PlatformProductFieldGroups
  value: PlatformRequirementsByPlatform
  onChange: (value: PlatformRequirementsByPlatform) => void
}

export function ProductPlatformAttributesPanel({ platforms, fieldGroups, value, onChange }: Props) {
  const listingPlatforms = platforms.filter(platform => platform.capabilities?.includes('listing'))

  const updateField = (platformId: string, field: PlatformProductField, nextValue: string) => {
    const current = value[platformId] || {}
    const schema = fieldGroups?.[platformId]
    const required = new Set(current.required_attributes || [])
    schema?.groups.forEach(group => group.fields.forEach(item => {
      if (item.required) required.add(item.key)
    }))
    if (field.required) required.add(field.key)
    onChange({
      ...value,
      [platformId]: {
        ...current,
        required_attributes: Array.from(required),
        attribute_values: { ...(current.attribute_values || {}), [field.key]: nextValue },
        field_groups: schema?.groups || current.field_groups,
        object_model: schema?.object_model || current.object_model,
        evidence_source: schema?.evidence_source || current.evidence_source,
        evidence: schema?.evidence || current.evidence,
      },
    })
  }

  const addCustomField = (platformId: string) => {
    const current = value[platformId] || {}
    const nextName = nextAttributeName(current.attribute_values || {})
    onChange({
      ...value,
      [platformId]: {
        ...current,
        required_attributes: [...(current.required_attributes || []), nextName],
        attribute_values: { ...(current.attribute_values || {}), [nextName]: '' },
      },
    })
  }

  const renameCustomField = (platformId: string, oldField: string, newField: string) => {
    const field = newField.trim()
    const current = value[platformId] || {}
    const nextAttributes = { ...(current.attribute_values || {}) }
    const currentValue = nextAttributes[oldField]
    delete nextAttributes[oldField]
    if (field) nextAttributes[field] = currentValue ?? ''
    onChange({
      ...value,
      [platformId]: {
        ...current,
        required_attributes: (current.required_attributes || []).map(item => item === oldField ? field : item).filter(Boolean),
        attribute_values: nextAttributes,
      },
    })
  }

  return (
    <div className="space-y-5" aria-label="三平台商品属性">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">平台商品模型</h3>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          按 Shopee、TEMU、TikTok Shop 卖家后台实测字段维护，不再用“随便新增几个属性”的扁平模型。
        </p>
      </div>

      <div className="space-y-4">
        {listingPlatforms.map(platform => {
          const current = value[platform.id] || {}
          const schema = fieldGroups?.[platform.id]
          const schemaKeys = new Set((schema?.groups || []).flatMap(group => group.fields.map(field => field.key)))
          const customFields = Array.from(new Set([
            ...Object.keys(current.attribute_values || {}),
            ...(current.required_attributes || []),
          ])).filter(field => field && !schemaKeys.has(field))

          return (
            <section key={platform.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold text-[var(--color-fg)]">{platform.label}</h4>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">{schema?.evidence_source || '未配置平台字段组，请在系统配置中补充。'}</p>
                  {schema?.evidence?.needs_recheck?.length ? (
                    <p className="mt-1 text-[11px] text-[var(--color-warning)]">
                      待补证：{schema.evidence.needs_recheck.join('；')}
                    </p>
                  ) : null}
                </div>
                <button type="button" onClick={() => addCustomField(platform.id)} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-fg)] hover:border-[var(--color-primary)]">
                  补充字段
                </button>
              </div>

              {schema?.object_model?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {schema.object_model.map(item => (
                    <span key={item} className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-[11px] text-[var(--color-muted)]">{item}</span>
                  ))}
                </div>
              ) : null}

              {schema?.groups?.length ? (
                <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {schema.groups.map(group => (
                    <div key={group.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-[var(--color-fg)]">{group.label}</p>
                        {group.help && <p className="mt-1 text-[11px] leading-5 text-[var(--color-muted)]">{group.help}</p>}
                      </div>
                      <div className="space-y-2">
                        {group.fields.map(field => (
                          <label key={field.key} className="grid gap-1">
                            <span className="text-[11px] font-medium text-[var(--color-muted)]">
                              {field.label}{field.required ? <span className="text-[var(--color-primary)]"> *</span> : null}
                              {field.evidence_state ? <span className="ml-1 text-[var(--color-warning)]">({evidenceStateLabel(field.evidence_state)})</span> : null}
                            </span>
                            <input
                              aria-label={`${platform.label}${field.label}`}
                              value={stringValue((current.attribute_values || {})[field.key])}
                              onChange={event => updateField(platform.id, field, event.target.value)}
                              placeholder={field.placeholder || field.label}
                              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] px-3 py-4 text-xs text-[var(--color-muted)]">
                  平台字段组未从配置加载，当前不生成默认字段。请先补齐 `platform.product_field_groups` 配置。
                </p>
              )}

              {customFields.length > 0 && (
                <div className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                  <p className="text-xs font-semibold text-[var(--color-fg)]">补充字段</p>
                  <p className="mt-1 text-[11px] text-[var(--color-muted)]">用于记录平台临时新增、类目差异或当前字段组尚未覆盖的真实字段。</p>
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {customFields.map(field => (
                      <div key={field} className="grid grid-cols-[0.9fr_1.1fr] gap-2">
                        <input
                          aria-label={`${platform.label}补充属性名`}
                          value={field}
                          onChange={event => renameCustomField(platform.id, field, event.target.value)}
                          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-fg)]"
                        />
                        <input
                          aria-label={`${platform.label}补充属性值`}
                          value={stringValue((current.attribute_values || {})[field])}
                          onChange={event => updateField(platform.id, { key: field, label: field }, event.target.value)}
                          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-fg)]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function stringValue(value: unknown) {
  if (Array.isArray(value)) return value.join(', ')
  if (value && typeof value === 'object') return JSON.stringify(value)
  return value == null ? '' : String(value)
}

function evidenceStateLabel(state: PlatformProductField['evidence_state']) {
  if (state === 'needs_category_recheck') return '待类目补证'
  if (state === 'needs_edit_page_recheck') return '待编辑页补证'
  if (state === 'needs_api_recheck') return '待接口/账单补证'
  return '已观察'
}

function nextAttributeName(values: Record<string, unknown>) {
  let index = Object.keys(values).length + 1
  let name = `补充属性${index}`
  while (Object.prototype.hasOwnProperty.call(values, name)) {
    index += 1
    name = `补充属性${index}`
  }
  return name
}
