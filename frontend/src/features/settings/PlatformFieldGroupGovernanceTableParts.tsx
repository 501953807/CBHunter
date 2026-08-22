import type { PlatformFieldSchema, PlatformSchema } from './PlatformFieldGroupGovernanceParts'

export function EditableFieldTable({
  currentSchema,
  onUpdateField,
}: {
  currentSchema: PlatformSchema
  onUpdateField: (groupIndex: number, fieldIndex: number, fieldPatch: Record<string, unknown>) => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full min-w-[780px] text-xs">
          <thead className="sticky top-0 bg-[var(--color-bg)]">
            <tr>
              {['字段组', '字段 key', '中文名', '字段来源', '必填', '复核状态'].map(head => (
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
                      value={field.label || ''}
                      onChange={event => onUpdateField(groupIndex, fieldIndex, { label: event.target.value })}
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
                      onChange={event => onUpdateField(groupIndex, fieldIndex, { required: event.target.checked })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={field.evidence_state || 'observed'}
                      onChange={event => onUpdateField(groupIndex, fieldIndex, { evidence_state: event.target.value })}
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
  )
}

function fieldSourceLabels(field: PlatformFieldSchema) {
  const labels = [
    field.unified_field_key ? `统一字段：${field.unified_field_key}` : '',
    field.platform_field_name ? `平台字段：${field.platform_field_name}` : '',
    field.miaoshou_field_name ? `妙手参考：${field.miaoshou_field_name}` : '',
    field.data_type ? `类型：${field.data_type}` : '',
    field.country_difference ? `市场差异：${field.country_difference}` : '',
  ].filter(Boolean)
  return labels.length ? labels : ['来源待登记']
}
