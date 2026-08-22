export function PlatformRequiredFieldStatusTable({ requiredAttrs, values }: { requiredAttrs: string[]; values: Record<string, unknown> }) {
  return (
    <div aria-label="平台必填字段状态表" className="mb-3 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <table className="w-full text-left text-xs">
        <thead className="bg-[var(--color-bg)] text-[var(--color-muted)]">
          <tr>
            <th className="px-3 py-2 font-medium">平台字段</th>
            <th className="px-3 py-2 font-medium">字段状态</th>
            <th className="px-3 py-2 font-medium">当前值</th>
          </tr>
        </thead>
        <tbody>
          {requiredAttrs.length === 0 && (
            <tr>
              <td colSpan={3} className="px-3 py-3 text-[var(--color-muted)]">当前平台/类目还没有已确认必填字段，需继续补证平台字段组。</td>
            </tr>
          )}
          {requiredAttrs.map(field => {
            const filled = hasValue(values[field])
            return (
              <tr key={field} className="border-t border-[var(--color-border)]">
                <td className="px-3 py-2 font-semibold text-[var(--color-fg)]">{field}</td>
                <td className={filled ? 'px-3 py-2 text-[var(--color-success)]' : 'px-3 py-2 text-[var(--color-warning)]'}>
                  {filled ? '已填写' : '待填写'}
                </td>
                <td className="px-3 py-2 text-[var(--color-muted)]">{formatFieldValue(values[field])}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function hasValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function formatFieldValue(value: unknown) {
  if (!hasValue(value)) return '--'
  if (Array.isArray(value)) return value.join('、')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
